import {MarketSimulation,calculateCompanyMetrics,calculateEconomicScenario,normalizeMacro} from './simulation-engine.js';

export const SESSION_TICKS=2340;
export const MODEL_VERSION='market-2';
export const MODEL_FIELDS=[
  {key:'outstandingShares',label:'종목별 발행주식',value:10000000,min:100000,max:100000000,step:1,unit:'주'},
  {key:'depth',label:'호가 한 단계 잔량',value:20000,min:100,max:100000,step:1,unit:'주'},
  {key:'dailyVolatility',label:'기본 일 변동성',value:2,min:0,max:10,step:0.1,unit:'%'},
  {key:'feeBps',label:'체결 수수료',value:1.5,min:0,max:100,step:0.1,unit:'bp / 편도'},
  {key:'borrowRate',label:'차입·대주 연 이율',value:5,min:0,max:50,step:0.1,unit:'%'},
  {key:'shortPoolPercent',label:'공매도 대주 한도',value:5,min:0,max:20,step:0.1,unit:'발행주식 %'}
];
export const DEFAULT_MODEL={backgroundLiquidity:true,...Object.fromEntries(MODEL_FIELDS.map(f=>[f.key,f.value]))};
export function normalizeModel(raw={}){
  const result={backgroundLiquidity:raw.backgroundLiquidity ?? true};
  if(typeof result.backgroundLiquidity!=='boolean')throw new Error('배경 유동성 사용 여부를 선택하세요.');
  for(const f of MODEL_FIELDS){const n=Number(raw[f.key] ?? f.value);if(!Number.isFinite(n)||n<f.min||n>f.max||(f.step===1&&!Number.isInteger(n)))throw new Error(`${f.label}: ${f.min}~${f.max} ${f.unit}`);result[f.key]=n;}
  return result;
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const active=o=>o&&['queued','open','partial'].includes(o.status);
export function tickSize(price){return price<2000?1:price<5000?5:price<20000?10:price<50000?50:price<200000?100:price<500000?500:1000;}
export function quotePrice(price,direction=0){let p=Math.max(1,price);for(let i=0;i<3;i++){const size=tickSize(p);p=(direction<0?Math.floor(price/size):direction>0?Math.ceil(price/size):Math.round(price/size))*size;}return Math.max(1,p);}
// Keyed draws isolate agents, assets and purposes. Extra orders do not consume
// the random stream used for subsequent public shocks or another participant.
export function draw(seed,...keys){let n=seed>>>0;for(const c of keys.join(':'))n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return ((n^(n>>>15))>>>0)/4294967296;}
function normal(seed,...keys){return Math.sqrt(-2*Math.log(Math.max(1e-12,draw(seed,...keys,'u'))))*Math.cos(2*Math.PI*draw(seed,...keys,'v'));}

export class LiquidMarketSimulation extends MarketSimulation {
  constructor(raw,options){
    super(raw,options);this.model=normalizeModel(raw.marketModel);this.totalShares=this.model.outstandingShares;
    // Requested initial holdings share a fixed float; an oversubscribed setup
    // receives proportional allocations, leaving the unused money as cash.
    const requested=this.agents.reduce((s,a)=>s+a.shares,0),scale=Math.min(1,this.totalShares*.35/Math.max(1,requested));
    for(const a of this.agents){a.shares=Math.floor(a.shares*scale);a.cash=a.initialEquity-a.shares*this.price;}
    this.allocationScale=scale;this.background=[];
    let remaining=this.totalShares-this.agents.reduce((s,a)=>s+a.shares,0);
    for(let i=0;i<8;i++){const shares=Math.floor(remaining/(8-i));remaining-=shares;this.background.push({id:`liquidity-${raw.id || 'primary'}-${i}`,background:true,maker:i<4,traits:{name:i<4?`유동성 공급 ${i+1}`:`배경 투자자 ${i-3}`,maxLeverage:1,risk:0},shares,cash:shares*this.price*2,initialShares:shares,lastFilled:0});}
    this.referencePrice=calculateCompanyMetrics(this.config.financials,this.price,this.totalShares).referencePrice;
    const weight=this.config.financials.priceInfluence/100;
    this.baseValueAnchor=this.price*(1-weight)+(this.referencePrice ?? this.price)*weight;
    this.newsValueFactor=1;this.refreshValue();this.center=this.price;this.volatility=1;this.flowMemory=0;
    this.book=[];this.sequence=0;this.tradeArchive=[];this.treasury=0;this.dailyReference=this.price;this.staticReference=this.price;
    this.viUntil=0;this.auctionReason='';this.auctionEvents=[];this.sessionDay=0;this.initialCash=this.allAgents().reduce((s,a)=>s+a.cash,0);
  }
  allAgents(){return [...this.agents,...this.background,...(this.manualAgent?[this.manualAgent]:[])];}
  refreshValue(){this.economicScenario=calculateEconomicScenario(this.config.financials,this.config.macro,this.config.companyProfile,this.price,this.totalShares);this.valueAnchor=Math.max(1,this.baseValueAnchor*this.newsValueFactor*this.economicScenario.valuationFactor);}
  setMacro(raw){this.config.macro=normalizeMacro(raw);this.refreshValue();}
  get lowerLimit(){return quotePrice(this.dailyReference*.7,1);}
  get upperLimit(){return quotePrice(this.dailyReference*1.3,-1);}
  get borrowedShares(){return this.allAgents().reduce((s,a)=>s+Math.max(0,-a.shares),0);}
  borrowAvailable(agent){return Math.max(0,Math.floor(this.totalShares*this.model.shortPoolPercent/100)-this.borrowedShares)+Math.max(0,agent.shares);}
  queueManualOrder(raw){
    if(raw.type==='limit'){const p=Number(raw.limit);if(p<this.lowerLimit||p>this.upperLimit||quotePrice(p)!==p)throw new Error(`지정가는 ${this.lowerLimit.toLocaleString()}~${this.upperLimit.toLocaleString()}원, 해당 가격의 호가 단위로 입력하세요.`);}
    return super.queueManualOrder(raw);
  }
  cancelManualOrder(reason){const result=super.cancelManualOrder(reason);this.book=this.book.filter(o=>!o.manualRequest||active(o.manualRequest));this.updateBook();return result;}
  startDay(day){this.sessionDay=day;this.tick=day*SESSION_TICKS;this.dailyReference=this.price;this.staticReference=this.price;this.viUntil=0;this.book=[];this.cancelManualOrder('장 마감 · 당일 주문 만료');this.updateBook();}
  newOrder(agent,side,quantity,limit,options={}){
    quantity=Math.max(0,Math.floor(quantity));if(!quantity)return;
    const order={id:`${this.assetId}-${++this.sequence}`,agentId:agent.id,side,quantity,remaining:quantity,limit:clamp(quotePrice(limit,side==='buy'?-1:1),this.lowerLimit,this.upperLimit),priority:this.sequence,createdTick:this.tick,expires:this.tick+18,allowShort:!agent.background,...options};
    this.book.push(order);return order;
  }
  updateBook(){this.orderBook={bids:this.book.filter(o=>o.remaining>0&&o.side==='buy').sort((a,b)=>b.limit-a.limit||a.priority-b.priority),asks:this.book.filter(o=>o.remaining>0&&o.side==='sell').sort((a,b)=>a.limit-b.limit||a.priority-b.priority)};}
  safeCapacity(agent,side,price,order){
    if(agent.background)return side==='buy'?Math.floor(agent.cash/(price*(1+this.model.feeBps/10000))):Math.max(0,agent.shares);
    const cap=this.capacity(agent,side,price,order);
    return side==='sell'?Math.min(cap,this.borrowAvailable(agent)):cap;
  }
  // Unlike a per-tick emotion shock, gradual changes allow participants to
  // recover and disagree while responding to sustained returns and losses.
  updateEmotions(context){for(const a of this.agents){const t=a.traits,eq=this.equity(a),r=a.emotionLastEquity>0?eq/a.emotionLastEquity-1:0;const shock=context.halted?0:clamp((context.momentum*70+r*150)*(t.emotionSensitivity/100),-2,2);a.emotion=clamp(a.emotion+shock+(t.emotionInitial-a.emotion)*(.003+t.emotionRecovery/3000),0,100);a.emotionLastEquity=eq;}}
  decision(agent,context){
    const interval=2+Math.floor(draw(this.config.seed,agent.id,'interval')*11),offset=Math.floor(draw(this.config.seed,agent.id,'offset')*interval);
    // Preserve margin checks on every tick even when discretionary decisions wait.
    const eq=this.equity(agent),gross=this.grossExposure?.(agent) ?? Math.abs(agent.shares*this.price);
    const margin=!agent.unlimited&&Math.abs(agent.shares)>0&&(eq<=0||gross>eq*agent.traits.maxLeverage*1.12);
    if(!margin&&!agent.manual&&(this.tick+offset)%interval)return {targetShares:agent.shares,label:'다음 판단 대기',reason:`${interval*10}초 간격 · 개인별 판단 시점`,signal:0};
    const horizon=[6,18,30,60][Math.floor(draw(this.config.seed,agent.id,'horizon')*4)];
    const momentum=this.price/this.prices[Math.max(0,this.prices.length-1-horizon)]-1;
    this.randomState=Math.floor(draw(this.config.seed,agent.id,this.tick,'decision')*4294967296);
    let result=super.decision(agent,{...context,momentum,sentiment:0});
    result.reason=result.reason.replace('최근 1분',`최근 ${horizon/6}분`);
    if(!result.forced){
      result.signal=clamp(result.signal*.035,-.002,.002);
      // Neutral prices do not count as an automatic upward trend.
      if(!result.source&&!result.news?.length&&Math.abs(momentum)<.001)result={...result,targetShares:agent.shares,label:'중립 구간',reason:'관찰 구간 수익률 ±0.1% 이내 · 방향 판단 유보',signal:0};
    }
    return result;
  }
  prepareQuotes(commonShock=0){
    const z=normal(this.config.seed,this.tick,'price'),v=normal(this.config.seed,this.tick,'vol');
    this.volatility=clamp(Math.exp(.99*Math.log(this.volatility)+.08*v),.35,3);
    const minute=(this.tick-this.sessionDay*SESSION_TICKS)/6,u=1+.5*Math.exp(-minute/35)+.4*Math.exp(-(390-minute)/35);
    const tail=draw(this.config.seed,this.tick,'tail')<.003?3:1;
    const innovation=this.model.dailyVolatility/100/Math.sqrt(SESSION_TICKS)*this.volatility*u*(.55*commonShock+.835*z)*tail;
    this.center=clamp(this.center*Math.exp(innovation+clamp(Math.log(this.valueAnchor/this.center)*.001,-.0003,.0003)+this.flowMemory*.00004),this.lowerLimit,this.upperLimit);
    this.flowMemory*=.92;
    if(!this.model.backgroundLiquidity)return;
    // Makers keep quotes until expiry or a meaningful change in their valuation.
    for(const a of this.background.filter(a=>a.maker)){
      const existing=this.book.filter(o=>o.agentId===a.id),size=tickSize(this.center);
      if(existing.length&&Math.abs((a.lastCenter ?? this.center)-this.center)<size&&this.tick%6)continue;
      this.book=this.book.filter(o=>o.agentId!==a.id);a.lastCenter=this.center;
      const inventory=(a.shares-a.initialShares)/Math.max(1,a.initialShares),mid=this.center*(1-clamp(inventory,-1,1)*.001);
      const spreadTicks=Math.max(1,Math.round(this.volatility));
      const bestBid=quotePrice(mid-(spreadTicks-1)*size/2,-1),bestAsk=quotePrice(bestBid+spreadTicks*size,1);
      for(let level=0;level<5;level++)for(const side of ['buy','sell']){
        const limit=(side==='buy'?bestBid:bestAsk)+(side==='buy'?-1:1)*level*size*2,qty=Math.floor(this.model.depth/4*(1+level*.5));
        this.newOrder(a,side,qty,limit,{expires:this.tick+12});
      }
    }
  }
  auctionPrice(){
    const prices=[...new Set(this.book.filter(o=>o.remaining>0).map(o=>o.limit))],agents=new Map(this.allAgents().map(a=>[a.id,a]));let best=null;
    const available=(side,price)=>{
      const grouped=new Map();
      for(const o of this.book)if(o.side===side&&o.remaining>0&&(side==='buy'?o.limit>=price:o.limit<=price)){const group=grouped.get(o.agentId)||{order:o,quantity:0};group.quantity+=o.remaining;grouped.set(o.agentId,group);}
      let total=0,borrow=Math.max(0,Math.floor(this.totalShares*this.model.shortPoolPercent/100)-this.borrowedShares);
      for(const [id,{order,quantity}] of grouped){const a=agents.get(id);let executable=Math.min(quantity,this.safeCapacity(a,side,price,order));if(side==='sell'&&!a.background){executable=Math.min(executable,Math.max(0,a.shares)+borrow);borrow-=Math.max(0,executable-Math.max(0,a.shares));}total+=executable;}
      return total;
    };
    for(const p of prices){const demand=available('buy',p),supply=available('sell',p),volume=Math.min(demand,supply),imbalance=Math.abs(demand-supply);if(!best||volume>best.volume||(volume===best.volume&&(imbalance<best.imbalance||(imbalance===best.imbalance&&Math.abs(p-this.price)<Math.abs(best.price-this.price)))))best={price:p,volume,imbalance};}
    return best?.volume?best.price:null;
  }
  match({auction=false}={}){
    this.updateBook();const trades=[],byId=new Map(this.allAgents().map(a=>[a.id,a]));let b=0,s=0;
    const bids=this.orderBook.bids,asks=this.orderBook.asks,clearing=auction?this.auctionPrice():null;
    if(auction&&clearing===null)return trades;
    while(b<bids.length&&s<asks.length){
      const bid=bids[b],ask=asks[s];if(bid.limit<ask.limit||(auction&&(bid.limit<clearing||ask.limit>clearing)))break;
      // Cancel the newer order in a self-cross, never print a self trade.
      if(bid.agentId===ask.agentId){(bid.priority>ask.priority?bid:ask).remaining=0;if(!bid.remaining)b++;if(!ask.remaining)s++;continue;}
      const price=auction?clearing:(bid.priority<ask.priority?bid.limit:ask.limit);
      if(!auction&&(Math.abs(price/this.price-1)>=.06||Math.abs(price/this.staticReference-1)>=.1)){
        this.viUntil=this.tick+12;this.auctionReason='VI';this.auctionEvents.push({tick:this.tick,type:'vi',until:this.viUntil});break;
      }
      const buyer=byId.get(bid.agentId),seller=byId.get(ask.agentId),bc=this.safeCapacity(buyer,'buy',price,bid),sc=this.safeCapacity(seller,'sell',price,ask),quantity=Math.min(bid.remaining,ask.remaining,bc,sc);
      if(quantity>0){
        const amount=quantity*price,fee=Math.ceil(amount*this.model.feeBps/10000);
        if(![amount,buyer.cash-amount-fee,seller.cash+amount-fee,this.treasury+2*fee].every(Number.isSafeInteger))throw new Error('금액 계산 한도입니다. 주문 규모를 줄여주세요.');
        const priorBuyerShares=buyer.shares,priorSellerShares=seller.shares;
        buyer.cash-=amount+fee;seller.cash+=amount-fee;this.treasury+=2*fee;buyer.shares+=quantity;seller.shares-=quantity;
        buyer.lastFilled+=quantity;seller.lastFilled-=quantity;bid.remaining-=quantity;ask.remaining-=quantity;this.price=price;
        if(buyer.manual)this.onManualFill?.({side:'buy',quantity,price,priorShares:priorBuyerShares,fee});
        if(seller.manual)this.onManualFill?.({side:'sell',quantity,price,priorShares:priorSellerShares,fee});
        for(const o of [bid,ask])if(o.manualRequest){const r=o.manualRequest;r.remaining-=quantity;r.filledQuantity+=quantity;r.amount+=amount;r.fees=(r.fees||0)+fee;r.lastFillTick=this.tick;r.afterPrice=price;r.reaction=null;}
        const aggressor=bid.priority>ask.priority?buyer:seller,sign=bid.priority>ask.priority?1:-1;
        if(!aggressor.maker)this.flowMemory=clamp(this.flowMemory+sign*quantity/(this.model.depth*5),-3,3);
        trades.push({tick:this.tick,price,quantity,buyer:buyer.id,seller:seller.id,feePerSide:fee,auction,...(bid.manualRequest||ask.manualRequest?{manualOrderId:(bid.manualRequest||ask.manualRequest).id}:{})});
      }
      if(bc<=quantity)bid.remaining=0;if(sc<=quantity)ask.remaining=0;
      if(!bid.remaining)b++;if(!ask.remaining)s++;if(!quantity&&bc>0&&sc>0)break;
    }
    return trades;
  }
  step({halted=false,auction=false,programSide=null,programParticipation=0,commonShock=0,controlPhase='normal'}={}){
    this.tick++;const open=this.price;
    for(const e of this.newsEvents){
      if(e.rumorTick===this.tick)this.newsLog.push({tick:this.tick,eventId:e.id,title:e.title,phase:'rumor',impact:e.expectedImpact});
      if(e.announceTick<=this.tick&&!e.valueApplied){e.valueApplied=true;this.newsValueFactor*=1+e.actualImpact/100;this.refreshValue();if(!this.newsLog.some(n=>n.eventId===e.id&&n.phase==='announced'))this.logAnnouncement(e);}
    }
    this.book=this.book.filter(o=>o.remaining>0&&o.expires>this.tick&&(!o.manualRequest||active(o.manualRequest)));
    const context={tick:this.tick,price:this.price,momentum:this.price/this.prices[Math.max(0,this.prices.length-7)]-1,volumeSignal:this.volumeSignal(),halted,participationFactor:1,controlPhase};
    this.updateEmotions(context);const decisions=[];
    for(const a of this.allAgents())a.lastFilled=0;
    if(!halted){
      this.prepareQuotes(commonShock);
      for(const a of [...this.agents,...(this.manualAgent?[this.manualAgent]:[])]){
        const d=this.decision(a,context),difference=d.targetShares-a.shares,side=difference>0?'buy':'sell';
        a.lastAction=d.label;a.lastReason=d.reason;a.participationRate=100;a.heat=a.traits.risk;
        if(d.forced){a.marginCalls++;if(a.manual)this.cancelManualOrder('반대매매');}
        let quantity=Math.floor(Math.abs(difference)*(d.forced?1:.025+a.traits.risk/100*.035));
        const limit=this.center*(1+d.signal+(side==='buy'?1:-1)*(d.forced?.015:.0007));
        quantity=Math.min(quantity,this.safeCapacity(a,side,Math.max(1,quotePrice(limit)),{}));
        if(quantity){this.book=this.book.filter(o=>o.agentId!==a.id||o.manualRequest);this.newOrder(a,side,quantity,limit,{forced:!!d.forced});}
        decisions.push({agentId:a.id,...d,side,quantity});
      }
      if(this.model.backgroundLiquidity)for(const a of this.background.filter(a=>!a.maker)){
        // Program-style background flows are the only orders affected by sidecar.
        const minute=(this.tick-this.sessionDay*SESSION_TICKS)/6;
        const arrival=.6+.2*Math.exp(-minute/35)+.15*Math.exp(-(390-minute)/35);
        if(draw(this.config.seed,a.id,this.tick,'arrival')>arrival)continue;
        const side=draw(this.config.seed,a.id,this.tick,'side')<.5?'buy':'sell';if(side===programSide&&draw(this.config.seed,a.id,this.tick,'program')>=programParticipation)continue;
        const size=Math.floor(this.model.depth*(.005+.035*draw(this.config.seed,a.id,this.tick,'size')));
        this.newOrder(a,side,size,this.center*(side==='buy'?1.003:.997),{expires:this.tick+1,program:true});
      }
      const request=this.manualOrder;
      if(active(request)&&!this.book.some(o=>o.manualRequest===request))this.newOrder(this.manualAgent,request.side,request.remaining,request.type==='market'?(request.side==='buy'?this.upperLimit:this.lowerLimit):request.limit,{manualRequest:request,allowShort:request.allowShort,expires:Infinity,isMarket:request.type==='market'});
    }
    const waiting=auction||(this.viUntil>this.tick),reopen=!auction&&this.viUntil&&this.tick>=this.viUntil;
    let trades=[];
    if(!halted&&!waiting){
      if(reopen)trades=this.match({auction:true});
      else {
        // A marketable order executes when it arrives. Batch-sorting all new
        // orders would incorrectly let a later order jump ahead of an earlier
        // aggressor, then use that aggressor's limit as the execution price.
        const incoming=this.book.filter(o=>o.createdTick===this.tick).sort((a,b)=>a.priority-b.priority);
        this.book=this.book.filter(o=>o.createdTick!==this.tick);
        for(const order of incoming){this.book.push(order);if(!this.viUntil)trades.push(...this.match());}
      }
    }
    if(reopen){this.viUntil=0;this.staticReference=this.price;this.auctionReason='';}
    const request=this.manualOrder;
    if(active(request)){
      if(!request.remaining)request.status='filled';
      else if(!halted&&!waiting&&!this.viUntil&&request.type==='market'){request.status=request.filledQuantity?'partialCanceled':'unfilled';request.reason='시장가 잔량 취소';this.book=this.book.filter(o=>o.manualRequest!==request);}
      else request.status=request.filledQuantity?'partial':'open';
    }
    this.book=this.book.filter(o=>o.remaining>0&&(!o.manualRequest||active(o.manualRequest)));this.updateBook();
    const volume=trades.reduce((s,t)=>s+t.quantity,0),high=Math.max(open,...trades.map(t=>t.price)),low=Math.min(open,...trades.map(t=>t.price)),index=Math.floor((this.tick-1)/6);
    let c=this.candles.at(-1);if(!c||c.index!==index){c={index,open,high,low,close:this.price,volume,trades:trades.length};this.candles.push(c);}else{c.high=Math.max(c.high,high);c.low=Math.min(c.low,low);c.close=this.price;c.volume+=volume;c.trades+=trades.length;}
    this.totalVolume+=volume;this.totalTrades+=trades.length;this.tradeArchive.push(...trades);this.trades=[...trades].reverse().concat(this.trades).slice(0,40);
    if(!halted&&!waiting)this.volumeHistory.push(volume);if(this.volumeHistory.length>36)this.volumeHistory.shift();this.prices.push(this.price);if(this.prices.length>120)this.prices.shift();
    this.high=Math.max(this.high,high);this.low=Math.min(this.low,low);for(const p of [open,...trades.map(t=>t.price)]){this.peak=Math.max(this.peak,p);this.maxDrawdown=Math.max(this.maxDrawdown,1-p/this.peak);}
    this.last={volume,tradeCount:trades.length,orders:this.book,decisions,halted,auction:!!waiting,participationFactor:1,controlPhase,volumeSignal:context.volumeSignal,buyQuantity:this.orderBook.bids.reduce((s,o)=>s+o.remaining,0),sellQuantity:this.orderBook.asks.reduce((s,o)=>s+o.remaining,0)};return this.last;
  }
}
