import {MarketSimulation,DEFAULT_CONFIG,normalizeConfig,DEFAULT_FINANCIALS,normalizeCompanyProfile} from './simulation-engine.js';
import {MarketControls,DEFAULT_MARKET_CONTROLS,normalizeMarketControls} from './simulation-controls.js';
import {normalizeRosterPlan} from './simulation-roster.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const activeOrder=order=>order && ['queued','open','partial'].includes(order.status);
export const DEFAULT_ADDITIONAL_COMPANIES=[
  {id:'daily',ticker:'DLY',company:'데일리생활',initialPrice:8000,financials:{...DEFAULT_FINANCIALS,revenue:8,operatingProfit:1.1,netIncome:0.7,assets:5,liabilities:1.5},companyProfile:normalizeCompanyProfile({cyclicality:'defensive'}),companyNews:[{id:'dividend-plan',title:'안정적 공급 계약',announceMinute:15,leadMinutes:0,durationMinutes:10,expectedImpact:0,actualImpact:4}]},
  {id:'prime',ticker:'PRM',company:'프라임산업',initialPrice:20000,financials:{...DEFAULT_FINANCIALS,revenue:16,operatingProfit:1.5,netIncome:1.1,assets:12,liabilities:5},companyProfile:normalizeCompanyProfile({cyclicality:'cyclical'}),companyNews:[{id:'factory',title:'신규 공장 수주 발표',announceMinute:8,leadMinutes:3,durationMinutes:12,expectedImpact:7,actualImpact:10}]}
];
export const DEFAULT_EXCHANGE_CONFIG={...DEFAULT_CONFIG,additionalCompanies:DEFAULT_ADDITIONAL_COMPANIES,player:{wealth:10000,leverage:1,unlimited:false},marketControls:DEFAULT_MARKET_CONTROLS};

export function normalizeExchangeConfig(raw) {
  const base=normalizeConfig(raw),additional=raw.additionalCompanies ?? DEFAULT_ADDITIONAL_COMPANIES;
  if(!Array.isArray(additional) || additional.length>5)throw new Error('추가 종목은 5개까지 설정할 수 있습니다.');
  const ids=new Set(['primary']);
  const additionalCompanies=additional.map((company,index)=>{
    const id=String(company?.id ?? `stock-${index+1}`),ticker=String(company?.ticker ?? `S${index+1}`);
    if(!/^[a-zA-Z0-9_-]{1,24}$/.test(id) || ids.has(id) || !/^[A-Z0-9]{1,8}$/.test(ticker))throw new Error('종목 코드가 중복되거나 올바르지 않습니다.');
    ids.add(id);
    const value=normalizeConfig({...base,...company,seed:base.seed,participants:base.participants,population:undefined});
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
  return {...base,additionalCompanies,player:{wealth,leverage,unlimited},marketControls:normalizeMarketControls(raw.marketControls),...(participantPlan?{participantPlan}:{})};
}

// Each security has its own book and history. Cash, credit and collateral are
// shared across every security, for both the simulated participants and player.
export class SecuritiesSimulation {
  constructor(raw=DEFAULT_EXCHANGE_CONFIG) {
    this.config=normalizeExchangeConfig(copy(raw));
    this.controls=new MarketControls(this.config.marketControls);
    this.orderHistory=[];
    const primary={id:'primary',ticker:'FLD',...Object.fromEntries(['company','initialPrice','financials','companyProfile','companyNews'].map(key=>[key,this.config[key]]))};
    const companies=[primary,...this.config.additionalCompanies],weight=1/companies.length;
    this.markets=companies.map((company,index)=>{
      let seed=this.config.seed;
      if(index){for(const char of company.id)seed=(Math.imul(seed^char.charCodeAt(0),16777619)>>>0);seed=seed%2147483646+1;}
      const market=new MarketSimulation({...this.config,...company,seed,population:undefined},{allocationWeight:weight});
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
    }
    this.initialCash=[...this.accounts,this.player].reduce((sum,account)=>sum+account.cash,0);
  }

  get tick(){return this.markets[0].tick;}
  market(id='primary'){return this.markets.find(market=>market.assetId===id) || this.markets[0];}
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
      if(order.side==='buy')cash+=order.remaining*price;
      gross+=Math.max(0,Math.abs(next)-Math.abs(current))*price;
      short+=Math.max(0,-next-Math.max(0,-current))*price;
    }
    return {cash,gross,short};
  }
  capacity(market,agent,side,price,order={}){
    const account=this.byAccountId.get(agent.id);
    if(account.unlimited)return side==='sell' && !order.allowShort?Math.max(0,agent.shares):Infinity;
    const equity=Math.max(0,this.equity(account,{assetId:market.assetId,price}));
    const leverage=agent.traits.maxLeverage,shares=agent.shares;
    const reserved=agent.manual?this.reservations(order.manualRequest || order):{cash:0,gross:0,short:0};
    const otherGross=this.markets.reduce((sum,other)=>sum+(other===market?0:Math.abs(account.positions[other.assetId].shares*other.price)),0);
    const otherShort=this.markets.reduce((sum,other)=>sum+(other===market?0:Math.max(0,-account.positions[other.assetId].shares*other.price)),0);
    const grossRoom=Math.max(0,equity*leverage-otherGross-reserved.gross);
    const maxLong=Math.floor(grossRoom/price),credit=account.initialEquity*(leverage-1);
    const cashCapacity=Math.floor((account.cash+credit-reserved.cash)/price);
    const shortRoom=Math.max(0,Math.min(equity,account.initialEquity)*(0.1+agent.traits.risk/100*0.65)-otherShort-reserved.short);
    const maxShort=Math.floor(Math.min(shortRoom,grossRoom)/price);
    const closing=side==='buy'?Math.max(0,-shares):Math.max(0,shares);
    const allowed=side==='buy'?Math.min(maxLong-shares,cashCapacity):shares+maxShort;
    const capacity=Math.max(0,closing,allowed);
    return agent.manual && side==='sell' && !order.allowShort?Math.min(capacity,Math.max(0,shares)):capacity;
  }

  maxOrderQuantity(id,action,type='market',limit){
    if(this.controls.snapshot().halted)return 0;
    const market=this.market(id),price=type==='limit'?Number(limit):market.price;
    if(!Number.isInteger(price) || price<1)return 0;
    return this.capacity(market,market.manualAgent,action==='buy'?'buy':'sell',price,{allowShort:action==='short'});
  }
  submitOrder(id,raw){
    if(this.controls.snapshot().halted)throw new Error('서킷브레이커 발동 중입니다. 거래 재개 후 주문하세요. 대기 주문 취소는 가능합니다.');
    const market=this.market(id),order=market.queueManualOrder(raw);
    this.orderHistory.push(order);this.orderHistory=this.orderHistory.slice(-50);
    return order;
  }
  cancelOrder(id){return this.market(id).cancelManualOrder();}
  syncControlState(){
    const control=this.controls.snapshot();
    for(const market of this.markets){market.tradingHalted=control.halted;if(control.halted)market.orderBook={bids:[],asks:[]};}
  }
  triggerControl(kind){const state=this.controls.trigger(kind);this.syncControlState();return state;}
  triggerCompanyIssue(id,raw){return this.market(id).triggerCompanyIssue(raw);}
  announceCompanyIssue(id,eventId){return this.market(id).announceCompanyIssue(eventId);}
  setLeverage(value){
    const leverage=Number(value);
    if(!Number.isInteger(leverage) || leverage<1 || leverage>3)throw new Error('레버리지는 1~3배 중에서 선택하세요.');
    if(leverage!==this.player.leverage)for(const market of this.markets)market.cancelManualOrder('레버리지 변경으로 취소');
    this.player.leverage=leverage;this.config.player.leverage=leverage;
  }
  recordFill(market,{side,quantity,price,priorShares}){
    const position=this.player.positions[market.assetId],direction=side==='buy'?1:-1;
    if(!priorShares || Math.sign(priorShares)===direction){
      position.averageCost=(Math.abs(priorShares)*position.averageCost+quantity*price)/(Math.abs(priorShares)+quantity);
    }else{
      const closed=Math.min(Math.abs(priorShares),quantity);
      position.realizedPnL+=closed*(price-position.averageCost)*Math.sign(priorShares);
      if(!position.shares)position.averageCost=0;
      else if(Math.sign(position.shares)!==Math.sign(priorShares))position.averageCost=price;
    }
  }
  playerSnapshot(){
    const equity=this.equity(),gross=this.gross();
    const unlimited=this.player.unlimited;
    return {unlimited,equity:unlimited?null:equity,cash:unlimited?null:Math.max(0,this.player.cash),debt:unlimited?0:Math.max(0,-this.player.cash),profit:equity-this.player.initialEquity,returnRate:unlimited?null:(equity/this.player.initialEquity-1)*100,exposure:unlimited?null:equity>0?gross/equity:0,leverage:this.player.leverage,realizedPnL:Object.values(this.player.positions).reduce((sum,position)=>sum+position.realizedPnL,0),marginCalls:this.markets.reduce((sum,market)=>sum+market.manualAgent.marginCalls,0),positions:this.markets.map(market=>({id:market.assetId,company:market.config.company,price:market.price,...this.player.positions[market.assetId],unrealizedPnL:this.player.positions[market.assetId].shares*(market.price-this.player.positions[market.assetId].averageCost)}))};
  }
  step(){
    const control=this.controls.snapshot();
    const equity=this.equity();
    if(!this.player.unlimited && !control.halted && this.gross()>0 && (equity<=0 || this.gross()>equity*this.player.leverage*1.12))for(const market of this.markets)market.cancelManualOrder('담보 부족으로 취소');
    for(const market of this.markets)market.step({halted:control.halted,participationFactor:control.participation,controlPhase:control.phase});
    const index=100*this.markets.reduce((sum,market)=>sum+market.price/market.config.initialPrice,0)/this.markets.length;
    this.controls.observe(this.tick,index,control);this.syncControlState();
    for(const market of this.markets){
      const order=market.manualOrder;
      if(order?.lastFillTick!==null && order?.lastFillTick<this.tick && !order.reaction){
        const agents=market.last.decisions.filter(decision=>decision.agentId!=='player').map(decision=>({id:decision.agentId,name:this.byAccountId.get(decision.agentId).traits.name,label:decision.label,side:decision.side,quantity:decision.quantity,reason:decision.reason}));
        order.reaction={tick:this.tick,agents,buy:agents.filter(a=>a.quantity>0 && a.side==='buy').length,sell:agents.filter(a=>a.quantity>0 && a.side==='sell').length,hold:agents.filter(a=>!a.quantity).length};
      }
    }
    return this.markets.map(market=>market.last);
  }
}
