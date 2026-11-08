import {DEFAULT_CONFIG,normalizeConfig,DEFAULT_FINANCIALS,normalizeCompanyProfile} from './simulation-engine.js';
import {MarketControls,DEFAULT_MARKET_CONTROLS,normalizeMarketControls} from './simulation-controls.js';
import {normalizeRosterPlan} from './simulation-roster.js';
import {LiquidMarketSimulation,normalizeModel,DEFAULT_MODEL,SESSION_TICKS,MODEL_VERSION,draw,quotePrice,tickSize} from './simulation-liquidity.js';
import {recordPositionFill} from './simulation-risk.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const activeOrder=order=>order && ['queued','open','partial'].includes(order.status);
export const DEFAULT_ADDITIONAL_COMPANIES=[
  {id:'daily',ticker:'DLY',company:'데일리생활',initialPrice:8000,financials:{...DEFAULT_FINANCIALS,revenue:800,operatingProfit:110,netIncome:70,assets:500,liabilities:150},companyProfile:normalizeCompanyProfile({cyclicality:'defensive'}),companyNews:[{id:'dividend-plan',title:'안정적 공급 계약',announceMinute:15,leadMinutes:0,durationMinutes:10,expectedImpact:0,actualImpact:4}]},
  {id:'prime',ticker:'PRM',company:'프라임산업',initialPrice:20000,financials:{...DEFAULT_FINANCIALS,revenue:1600,operatingProfit:150,netIncome:110,assets:1200,liabilities:500},companyProfile:normalizeCompanyProfile({cyclicality:'cyclical'}),companyNews:[{id:'factory',title:'신규 공장 수주 발표',announceMinute:8,leadMinutes:3,durationMinutes:12,expectedImpact:7,actualImpact:10}]}
];
export const DEFAULT_EXCHANGE_CONFIG={...DEFAULT_CONFIG,financials:{...DEFAULT_FINANCIALS,revenue:1200,operatingProfit:150,netIncome:100,assets:1500,liabilities:500},additionalCompanies:DEFAULT_ADDITIONAL_COMPANIES,player:{wealth:10000,leverage:1,unlimited:false},marketControls:DEFAULT_MARKET_CONTROLS,marketModel:DEFAULT_MODEL};

export function normalizeExchangeConfig(raw) {
  const base=normalizeConfig(raw),additional=raw.additionalCompanies ?? DEFAULT_ADDITIONAL_COMPANIES;
  // Old saves accepted arbitrary won increments. Migrate only those saves to
  // the nearest quote unit instead of discarding all their participant settings.
  if(!raw.marketModel)base.initialPrice=quotePrice(base.initialPrice);
  if(quotePrice(base.initialPrice)!==base.initialPrice)throw new Error(`시작 주가는 ${tickSize(base.initialPrice)}원 호가 단위로 입력하세요.`);
  if(!Array.isArray(additional) || additional.length>5)throw new Error('추가 종목은 5개까지 설정할 수 있습니다.');
  const ids=new Set(['primary']);
  const additionalCompanies=additional.map((company,index)=>{
    const id=String(company?.id ?? `stock-${index+1}`),ticker=String(company?.ticker ?? `S${index+1}`);
    if(!/^[a-zA-Z0-9_-]{1,24}$/.test(id) || ids.has(id) || !/^[A-Z0-9]{1,8}$/.test(ticker))throw new Error('종목 코드가 중복되거나 올바르지 않습니다.');
    ids.add(id);
    const value=normalizeConfig({...base,...company,seed:base.seed,participants:base.participants,population:undefined});
    if(!raw.marketModel)value.initialPrice=quotePrice(value.initialPrice);
    if(quotePrice(value.initialPrice)!==value.initialPrice)throw new Error(`${value.company}: 시작 주가는 ${tickSize(value.initialPrice)}원 호가 단위로 입력하세요.`);
    return {id,ticker,company:value.company,initialPrice:value.initialPrice,financials:value.financials,companyProfile:value.companyProfile,companyNews:value.companyNews};
  });
  const unlimited=raw.player?.unlimited ?? false;
  if(typeof unlimited!=='boolean')throw new Error('내 자금 설정 방식을 선택하세요.');
  const enteredWealth=Number(raw.player?.wealth ?? 10000),leverage=Number(raw.player?.leverage ?? 1);
  const validWealth=Number.isFinite(enteredWealth) && enteredWealth>=100 && Number.isSafeInteger(enteredWealth*10000);
  if(!unlimited && !validWealth)throw new Error('내 초기 자금은 100만원 이상으로 입력하세요. 매우 큰 자금은 ‘무제한’을 선택하세요.');
  const wealth=validWealth?enteredWealth:10000;
  if(!Number.isInteger(leverage) || leverage<1 || leverage>3)throw new Error('내 레버리지는 1~3배 중에서 선택하세요.');
  const participantPlan=!base.population && raw.participantPlan?normalizeRosterPlan(raw.participantPlan):null;
  if(participantPlan && participantPlan.count!==base.participants.length)throw new Error('참여자 수를 변경한 뒤 표를 생성하세요.');
  return {...base,additionalCompanies,player:{wealth,leverage,unlimited},marketModel:normalizeModel(raw.marketModel),marketControls:normalizeMarketControls(raw.marketControls),...(participantPlan?{participantPlan}:{})};
}

// Each security has its own book and history. Cash, credit and collateral are
// shared across every security, for both the simulated participants and player.
export class SecuritiesSimulation {
  constructor(raw=DEFAULT_EXCHANGE_CONFIG) {
    this.config=normalizeExchangeConfig(copy(raw));
    this.initialConfig=copy(this.config);this.actions=[];this.stepCount=0;this.day=0;this.sessionClosed=false;this.macroEvents=[];this.interestTreasury=0;
    this.controls=new MarketControls(this.config.marketControls);
    this.orderHistory=[];
    const primary={id:'primary',ticker:'FLD',...Object.fromEntries(['company','initialPrice','financials','companyProfile','companyNews'].map(key=>[key,this.config[key]]))};
    const companies=[primary,...this.config.additionalCompanies],weight=1/companies.length;
    this.markets=companies.map((company,index)=>{
      let seed=this.config.seed;
      if(index){for(const char of company.id)seed=(Math.imul(seed^char.charCodeAt(0),16777619)>>>0);seed=seed%2147483646+1;}
      const market=new LiquidMarketSimulation({...this.config,...company,seed,population:undefined},{allocationWeight:weight});
      market.assetId=company.id;market.ticker=company.ticker;
      return market;
    });
    this.accounts=this.config.participants.map((traits,index)=>{
      const positions=Object.fromEntries(this.markets.map(market=>[market.assetId,{shares:market.agents[index].shares,averageCost:market.price,realizedPnL:0}]));
      const initialEquity=traits.wealth*10000;
      return {id:`p${index+1}`,traits,initialEquity,cash:initialEquity-this.markets.reduce((sum,market)=>sum+positions[market.assetId].shares*market.price,0),positions};
    });
    // Unlimited buying power uses a finite cash-flow ledger, so settlement and
    // profit never subtract Infinity from Infinity or lose cash conservation.
    const initialEquity=this.config.player.unlimited?0:this.config.player.wealth*10000;
    this.player={id:'player',manual:true,unlimited:this.config.player.unlimited,initialEquity,cash:initialEquity,leverage:this.config.player.leverage,positions:Object.fromEntries(this.markets.map(market=>[market.assetId,{shares:0,averageCost:0,realizedPnL:0}]))};
    this.byAccountId=new Map([...this.accounts,this.player].map(account=>[account.id,account]));
    for(const market of this.markets){
      for(const agent of market.agents)this.bindAgent(market,agent,this.byAccountId.get(agent.id));
      const traits={name:'나',risk:100,allocation:0,onRise:'hold',onFall:'hold'};
      Object.defineProperty(traits,'maxLeverage',{get:()=>this.player.leverage});
      market.manualAgent={id:'player',manual:true,unlimited:this.player.unlimited,traits,initialEquity,lastAction:'직접 주문 대기',lastReason:'',lastFilled:0,marginCalls:0};
      this.bindAgent(market,market.manualAgent,this.player);
      market.equity=(agent,price=market.price)=>this.equity(this.byAccountId.get(agent.id),{assetId:market.assetId,price});
      market.grossExposure=agent=>this.gross(this.byAccountId.get(agent.id));
      market.capacity=(agent,side,price,order)=>this.capacity(market,agent,side,price,order);
      market.onManualFill=fill=>this.recordFill(market,fill);
      market.positionFor=agent=>this.byAccountId.get(agent.id).positions[market.assetId];
      market.onParticipantFill=(agent,fill)=>this.recordFill(market,fill,agent.id);
    }
    this.initialCash=[...this.accounts,this.player,...this.markets.flatMap(m=>m.background)].reduce((sum,account)=>sum+account.cash,0);
  }

  get tick(){return this.markets[0].tick;}
  market(id='primary'){const market=this.markets.find(market=>market.assetId===id);if(!market)throw new Error('존재하지 않는 종목입니다.');return market;}
  bindAgent(market,agent,account){
    Object.defineProperties(agent,{
      cash:{configurable:true,get:()=>account.cash,set:value=>{account.cash=value;}},
      shares:{configurable:true,get:()=>account.positions[market.assetId].shares,set:value=>{account.positions[market.assetId].shares=value;}}
    });
  }
  equity(account=this.player,override){
    return account.cash+this.markets.reduce((sum,market)=>sum+account.positions[market.assetId].shares*(override?.assetId===market.assetId?override.price:market.price),0);
  }
  gross(account=this.player){return this.markets.reduce((sum,market)=>sum+Math.abs(account.positions[market.assetId].shares*market.price),0);}

  reservations(exclude){
    let cash=0,gross=0,short=0;
    for(const market of this.markets){
      const order=market.manualOrder;
      if(!activeOrder(order) || order===exclude)continue;
      const price=order.limit ?? market.price,current=this.player.positions[market.assetId].shares;
      const next=current+(order.side==='buy'?1:-1)*order.remaining;
      if(order.side==='buy')cash+=Math.ceil(order.remaining*price*(1+market.model.feeBps/10000));
      gross+=Math.max(0,Math.abs(next)-Math.abs(current))*price;
      short+=Math.max(0,-next-Math.max(0,-current))*price;
    }
    return {cash,gross,short};
  }
  capacity(market,agent,side,price,order={}){
    const account=this.byAccountId.get(agent.id);
    if(account.unlimited)return side==='sell'?(order.allowShort?market.borrowAvailable(agent):Math.max(0,agent.shares)):Infinity;
    const equity=Math.max(0,this.equity(account,{assetId:market.assetId,price}));
    const leverage=agent.traits.maxLeverage,shares=agent.shares;
    const reserved=agent.manual?this.reservations(order.manualRequest || order):{cash:0,gross:0,short:0};
    const otherGross=this.markets.reduce((sum,other)=>sum+(other===market?0:Math.abs(account.positions[other.assetId].shares*other.price)),0);
    const otherShort=this.markets.reduce((sum,other)=>sum+(other===market?0:Math.max(0,-account.positions[other.assetId].shares*other.price)),0);
    const grossRoom=Math.max(0,equity*leverage-otherGross-reserved.gross);
    const maxLong=Math.floor(grossRoom/price),credit=account.initialEquity*(leverage-1);
    const cashCapacity=Math.floor((account.cash+credit-reserved.cash)/(price*(1+market.model.feeBps/10000)));
    const shortRoom=Math.max(0,Math.min(equity,account.initialEquity)*(0.1+agent.traits.risk/100*0.65)-otherShort-reserved.short);
    const maxShort=Math.floor(Math.min(shortRoom,grossRoom)/price);
    const closing=side==='buy'?Math.max(0,-shares):Math.max(0,shares);
    const allowed=side==='buy'?Math.min(maxLong-shares,cashCapacity):shares+maxShort;
    const capacity=Math.max(0,closing,allowed);
    return side==='sell'?Math.min(capacity,agent.manual&&!order.allowShort?Math.max(0,shares):market.borrowAvailable(agent)):capacity;
  }

  maxOrderQuantity(id,action,type='market',limit){
    if(this.sessionClosed||this.controls.snapshot().halted)return 0;
    const market=this.market(id),price=type==='limit'?Number(limit):market.price;
    if(!Number.isInteger(price) || price<1)return 0;
    return this.capacity(market,market.manualAgent,action==='buy'?'buy':'sell',price,{allowShort:action==='short'});
  }
  submitOrder(id,raw){
    if(this.sessionClosed)throw new Error('장 마감입니다. 다음 거래일을 시작하세요.');
    if(this.controls.snapshot().halted)throw new Error('서킷브레이커 발동 중입니다. 거래 재개 후 주문하세요. 대기 주문 취소는 가능합니다.');
    const market=this.market(id),order=market.queueManualOrder(raw);
    this.orderHistory.push(order);this.orderHistory=this.orderHistory.slice(-50);
    this.recordAction('order',{id,raw});
    return order;
  }
  cancelOrder(id){const result=this.market(id).cancelManualOrder();if(result)this.recordAction('cancel',{id});return result;}
  syncControlState(){
    const control=this.controls.snapshot();
    for(const market of this.markets)market.tradingHalted=control.halted||this.sessionClosed;
  }
  triggerControl(kind){if(this.sessionClosed)throw new Error('장 마감입니다. 다음 거래일을 시작하세요.');const state=this.controls.trigger(kind);this.recordAction('control',{kind});if(state.closed)this.closeSession();this.syncControlState();return state;}
  triggerCompanyIssue(id,raw){const result=this.market(id).triggerCompanyIssue(raw);this.recordAction('issue',{id,raw});return result;}
  announceCompanyIssue(id,eventId){const result=this.market(id).announceCompanyIssue(eventId);this.recordAction('announce',{id,eventId});return result;}
  setLeverage(value){
    const leverage=Number(value);
    if(!Number.isInteger(leverage) || leverage<1 || leverage>3)throw new Error('레버리지는 1~3배 중에서 선택하세요.');
    if(leverage!==this.player.leverage)for(const market of this.markets)market.cancelManualOrder('레버리지 변경으로 취소');
    this.player.leverage=leverage;this.config.player.leverage=leverage;this.recordAction('leverage',{value:leverage});
  }
  recordFill(market,fill,id='player'){
    recordPositionFill(this.byAccountId.get(id).positions[market.assetId],fill,market.tick);
  }
  previewOrder(id,{action,type='market',quantity,limit}){
    const market=this.market(id),reference=market.price;
    const empty=reason=>({filled:0,remaining:Number(quantity)||0,vwap:null,lastPrice:null,fees:0,amount:0,slippageBps:null,reason});
    if(this.sessionClosed||this.controls.snapshot().halted)return empty('거래 중단·장 마감');
    if(this.controls.snapshot().auction||market.viUntil>market.tick)return empty('단일가 수집 중 · 예상 체결가 계산 보류');
    if(activeOrder(market.manualOrder))return empty('현재 대기 주문을 먼저 취소하세요.');
    quantity=Number(quantity);limit=Number(limit);
    if(!['buy','sell','short'].includes(action)||!['market','limit'].includes(type)||!Number.isSafeInteger(quantity)||quantity<1)return empty('수량은 1주 이상의 정수로 입력하세요.');
    if(type==='limit'&&(!Number.isSafeInteger(limit)||limit<market.lowerLimit||limit>market.upperLimit||quotePrice(limit)!==limit))return empty('지정가 범위·호가 단위를 확인하세요.');
    const maximum=this.maxOrderQuantity(id,action,type,limit);
    if(quantity>maximum)return empty(`현재 조건에서 최대 ${maximum.toLocaleString('ko-KR')}주까지 주문할 수 있습니다.`);
    // Settle only the proposed order against a copy of the visible opposite
    // book. Reuse real capacities, fees and VI checks without touching live
    // accounts, orders, callbacks, random streams or the experiment action log.
    const shadow=Object.create(this);
    shadow.accounts=this.accounts.map(copy);shadow.player=copy(this.player);
    shadow.byAccountId=new Map([...shadow.accounts,shadow.player].map(a=>[a.id,a]));
    shadow.markets=this.markets.map(m=>{
      const view=Object.create(m);
      view.background=m.background.map(a=>({...a}));
      view.agents=m.agents.map(a=>{const agent={...a};shadow.bindAgent(view,agent,shadow.byAccountId.get(a.id));return agent;});
      view.manualAgent={...m.manualAgent};shadow.bindAgent(view,view.manualAgent,shadow.player);
      view.capacity=(agent,side,price,order)=>shadow.capacity(view,agent,side,price,order);
      view.onManualFill=undefined;view.onParticipantFill=undefined;view.auctionEvents=[];
      return view;
    });
    const view=shadow.market(id),side=action==='buy'?'buy':'sell';
    view.book=market.book.filter(o=>o.remaining>0&&o.agentId!=='player'&&o.side!==side).map(o=>({...o}));
    view.newOrder(view.manualAgent,side,quantity,type==='limit'?limit:side==='buy'?view.upperLimit:view.lowerLimit,{allowShort:action==='short'});
    const trades=view.match(),filled=trades.reduce((sum,t)=>sum+t.quantity,0),amount=trades.reduce((sum,t)=>sum+t.price*t.quantity,0),fees=trades.reduce((sum,t)=>sum+t.feePerSide,0);
    const vwap=filled?amount/filled:null,remaining=quantity-filled;
    return {filled,remaining,vwap,amount,fees,lastPrice:trades.at(-1)?.price ?? null,slippageBps:vwap===null?null:(vwap/reference-1)*(side==='buy'?1:-1)*10000,reason:view.viUntil>market.tick?'VI 발동 예상 · 이후 체결 보류':remaining?'현재 호가·주문 여력 내 부분 체결 예상':'현재 호가 내 전량 체결 예상'};
  }
  playerSnapshot(){
    const equity=this.equity(),gross=this.gross();
    const unlimited=this.player.unlimited;
    return {unlimited,equity:unlimited?null:equity,cash:unlimited?null:Math.max(0,this.player.cash),debt:unlimited?0:Math.max(0,-this.player.cash),profit:equity-this.player.initialEquity,returnRate:unlimited?null:(equity/this.player.initialEquity-1)*100,exposure:unlimited?null:equity>0?gross/equity:0,leverage:this.player.leverage,financingCosts:this.player.financingCosts||0,realizedPnL:Object.values(this.player.positions).reduce((sum,position)=>sum+position.realizedPnL,0)-(this.player.financingCosts||0),marginCalls:this.markets.reduce((sum,market)=>sum+market.manualAgent.marginCalls,0),positions:this.markets.map(market=>({id:market.assetId,company:market.config.company,price:market.price,...this.player.positions[market.assetId],unrealizedPnL:this.player.positions[market.assetId].shares*(market.price-this.player.positions[market.assetId].averageCost)}))};
  }
  step(){
    if(this.sessionClosed)return this.markets.map(m=>m.last);
    const control=this.controls.snapshot();
    const equity=this.equity();
    if(!this.player.unlimited && !control.halted && this.gross()>0 && (equity<=0 || this.gross()>equity*this.player.leverage*1.12))for(const market of this.markets)market.cancelManualOrder('담보 부족으로 취소');
    for(const event of this.macroEvents)if(!event.applied&&event.atStep<=this.stepCount){event.applied=true;for(const m of this.markets)m.setMacro(event.values);}
    const commonShock=Math.sqrt(-2*Math.log(Math.max(1e-12,draw(this.config.seed,this.tick+1,'common-u'))))*Math.cos(2*Math.PI*draw(this.config.seed,this.tick+1,'common-v'));
    // Canonical order makes shared cash allocation independent of display order.
    // Execution still serializes scarce buying power; this is a disclosed model rule.
    for(const market of [...this.markets].sort((a,b)=>a.assetId.localeCompare(b.assetId))){
      if(control.auction)market.viUntil=Math.max(market.viUntil,this.controls.auctionUntil);
      market.step({halted:control.halted,auction:control.auction,programSide:control.programSide,programParticipation:this.config.marketControls.sidecar.participation/100,commonShock,controlPhase:control.phase});
    }
    this.stepCount++;
    const index=100*this.markets.reduce((sum,market)=>sum+market.price/market.config.initialPrice,0)/this.markets.length;
    this.controls.observe(this.tick,index,control);if(this.tick>=(this.day+1)*SESSION_TICKS||this.controls.closed)this.closeSession();this.syncControlState();
    for(const market of this.markets){
      const order=market.manualOrder;
      if(order?.lastFillTick!==null && order?.lastFillTick<this.tick && !order.reaction){
        const agents=market.last.decisions.filter(decision=>decision.agentId!=='player').map(decision=>({id:decision.agentId,name:this.byAccountId.get(decision.agentId).traits.name,label:decision.label,side:decision.side,quantity:decision.quantity,reason:decision.reason}));
        order.reaction={tick:this.tick,agents,buy:agents.filter(a=>a.quantity>0 && a.side==='buy').length,sell:agents.filter(a=>a.quantity>0 && a.side==='sell').length,hold:agents.filter(a=>!a.quantity).length};
      }
    }
    return this.markets.map(market=>market.last);
  }
  closeSession(){
    if(this.sessionClosed)return;this.sessionClosed=true;
    for(const m of this.markets){m.cancelManualOrder('장 마감 · 당일 주문 만료');m.book=[];m.updateBook();}
    for(const a of [...this.accounts,this.player]){
      if(a.unlimited)continue;
      const shorts=this.markets.reduce((s,m)=>s+Math.max(0,-a.positions[m.assetId].shares)*m.price,0);
      const cost=Math.ceil((Math.max(0,-a.cash)+shorts)*this.config.marketModel.borrowRate/100/252);
      a.cash-=cost;a.financingCosts=(a.financingCosts||0)+cost;this.interestTreasury+=cost;
    }
  }
  nextSession(){if(!this.sessionClosed)throw new Error('장 마감 후 다음 거래일을 시작하세요.');this.day++;for(const m of this.markets)m.startDay(this.day);this.controls.startDay(this.day,this.controls.index);this.sessionClosed=false;this.syncControlState();this.recordAction('next',{});}
  scheduleMacro(raw,delayMinutes=0){
    if(!Number.isInteger(delayMinutes)||delayMinutes<0||delayMinutes>390)throw new Error('거시 변화 대기는 0~390분입니다.');
    // Validate through the same config normalization used by the setup editor.
    const values=normalizeConfig({...this.config,macro:raw}).macro;
    this.macroEvents.push({atStep:this.stepCount+delayMinutes*6,values,applied:false});this.recordAction('macro',{raw:values,delayMinutes});
  }
  recordAction(type,data){if(!this.replaying)this.actions.push({step:this.stepCount,type,...copy(data)});}
  exportExperiment(){return {schemaVersion:1,modelVersion:MODEL_VERSION,config:copy(this.initialConfig),steps:this.stepCount,actions:copy(this.actions)};}
  static fromExperiment(value){
    if(value?.schemaVersion!==1||value.modelVersion!==MODEL_VERSION)throw new Error(`이 실험은 ${value?.modelVersion || '알 수 없는 모형'}으로 저장됐습니다. 현재 ${MODEL_VERSION}과 체결 규칙이 달라 재생할 수 없습니다. 기존 설정은 유지됩니다.`);
    if(!Number.isInteger(value.steps)||value.steps<0||value.steps>234000||!Array.isArray(value.actions)||value.actions.length>10000)throw new Error('실험은 100거래일·10,000개 조작까지 불러올 수 있습니다.');
    const sim=new SecuritiesSimulation(value.config);sim.replaying=true;let prior=0;
    for(const action of value.actions){
      if(!Number.isInteger(action.step)||action.step<prior||action.step>value.steps)throw new Error('실험 조작 순서가 올바르지 않습니다.');
      while(sim.stepCount<action.step){if(sim.sessionClosed)throw new Error('다음 거래일 기록이 없습니다.');sim.step();}
      switch(action.type){case 'order':sim.submitOrder(action.id,action.raw);break;case 'cancel':sim.cancelOrder(action.id);break;case 'issue':sim.triggerCompanyIssue(action.id,action.raw);break;case 'announce':sim.announceCompanyIssue(action.id,action.eventId);break;case 'control':sim.triggerControl(action.kind);break;case 'leverage':sim.setLeverage(action.value);break;case 'macro':sim.scheduleMacro(action.raw,action.delayMinutes);break;case 'next':sim.nextSession();break;default:throw new Error('알 수 없는 실험 조작입니다.');}prior=action.step;
    }
    while(sim.stepCount<value.steps){if(sim.sessionClosed)throw new Error('장 마감 이후 잘못된 진행 기록입니다.');sim.step();}
    sim.replaying=false;sim.actions=copy(value.actions);return sim;
  }
  tradeCSV(){const rows=['asset,tick,price,quantity,buyer,seller,fee_per_side,auction'];for(const m of this.markets)for(const t of m.tradeArchive)rows.push([m.assetId,t.tick,t.price,t.quantity,t.buyer,t.seller,t.feePerSide,t.auction].join(','));return rows.join('\n');}
}
