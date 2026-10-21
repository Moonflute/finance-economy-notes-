// Configurable simulation rules, not a reproduction of a particular exchange.
export const DEFAULT_MARKET_CONTROLS={
  sidecar:{enabled:true,threshold:5,windowMinutes:1,durationMinutes:5,participation:0},
  circuitBreaker:{enabled:true,thresholds:[8,15,20],durationMinutes:20}
};

export const MARKET_CONTROL_SECTIONS={
  sidecar:{label:'사이드카 기준',note:'선물 대신 등가중 지수를 사용하는 모형입니다. 전일 종가 대비 기준을 연속 유지하면 하루 한 번 발동합니다.',fields:[
    {path:'sidecar.enabled',label:'사이드카',type:'enabled'},
    {path:'sidecar.threshold',label:'등락 기준',unit:'%',min:0.1,max:50,step:0.1},
    {path:'sidecar.windowMinutes',label:'연속 유지 시간',unit:'분',min:1,max:60,step:1}]},
  cooling:{label:'사이드카 효과',note:'해당 방향의 배경 프로그램 주문만 제한합니다. 개인 주문은 계속 거래합니다. 재발동은 다음 거래일부터 가능합니다.',fields:[
    {path:'sidecar.durationMinutes',label:'발동 시간',unit:'분',min:1,max:60,step:1},
    {path:'sidecar.participation',label:'프로그램 참여 비율',unit:'%',min:0,max:100,step:1},
]},
  breaker:{label:'서킷브레이커 기준',note:'전일 종가 대비 하락률을 1분 유지하면 단계별로 발동합니다. 각 단계는 하루 한 번, 3단계는 당일 종료입니다.',fields:[
    {path:'circuitBreaker.enabled',label:'서킷브레이커',type:'enabled'},
    ...[0,1,2].map(index=>({path:`circuitBreaker.thresholds.${index}`,label:`${index+1}단계 하락 기준`,unit:'%',min:0.1,max:95,step:0.1}))]},
  reopening:{label:'중단·재개 시간',note:'1·2단계는 중단 뒤 10분 단일가를 거칩니다. 3단계는 다음 거래일까지 종료합니다.',fields:[
    {path:'circuitBreaker.durationMinutes',label:'단계별 거래 중단',unit:'분',min:1,max:120,step:1},
]}
};

export function normalizeMarketControls(raw={}){
  const source={...DEFAULT_MARKET_CONTROLS,...raw,sidecar:{...DEFAULT_MARKET_CONTROLS.sidecar,...raw.sidecar},circuitBreaker:{...DEFAULT_MARKET_CONTROLS.circuitBreaker,...raw.circuitBreaker}};
  const output={sidecar:{},circuitBreaker:{thresholds:[]}};
  for(const section of Object.values(MARKET_CONTROL_SECTIONS))for(const field of section.fields){
    const keys=field.path.split('.'),value=keys.reduce((object,key)=>object?.[key],source);
    let normalized;
    if(field.type==='enabled'){
      if(![true,false,'true','false'].includes(value))throw new Error(`${field.label} 사용 여부를 선택하세요.`);
      normalized=value===true || value==='true';
    }else{
      normalized=Number(value);
      if(!Number.isFinite(normalized) || normalized<field.min || normalized>field.max || (field.step===1 && !Number.isInteger(normalized)))throw new Error(`${field.label}: ${field.min}~${field.max}${field.unit} 범위로 입력하세요.`);
    }
    const target=keys.slice(0,-1).reduce((object,key)=>object[key],output);target[keys.at(-1)]=normalized;
  }
  const levels=output.circuitBreaker.thresholds;
  if(!(levels[0]<levels[1] && levels[1]<levels[2]))throw new Error('서킷브레이커 하락 기준은 1단계 < 2단계 < 3단계 순서로 입력하세요.');
  return output;
}

export class MarketControls {
  constructor(config){this.config=normalizeMarketControls(config);this.events=[];this.tick=0;this.startDay(0,100);}
  startDay(day,index){this.day=day;this.dayStart=day*2340;this.tick=this.dayStart;this.index=index;this.reference=index;this.history=[{tick:this.tick,index}];this.sidecarUntil=0;this.sidecarCooldownUntil=0;this.sidecarUsed=false;this.sidecarDirection=null;this.breakerUntil=0;this.breakerStage=0;this.auctionUntil=0;this.closed=false;this.sideCandidate=null;this.breakerCandidate=null;this.lastBreakerIndex=index;}
  event(type,label,details={}){this.events.push({tick:this.tick,type,label,index:this.index,...details});}
  triggerSidecar(change,manual=false){this.sidecarUsed=true;this.sidecarDirection=change>=0?'buy':'sell';this.sidecarUntil=this.tick+this.config.sidecar.durationMinutes*6;this.event('sidecar',`사이드카 ${manual?'시험 ':''}발동`,{change,manual});}
  triggerBreaker(stage,manual=false){this.breakerStage=stage;this.lastBreakerIndex=this.index;this.breakerCandidate=null;if(stage===3){this.closed=true;this.breakerUntil=this.dayStart+2340;}else{this.breakerUntil=this.tick+this.config.circuitBreaker.durationMinutes*6;this.auctionUntil=this.breakerUntil+60;}this.event('breaker',`서킷브레이커 ${stage}단계 ${manual?'시험 ':''}발동`,{stage,manual});}
  trigger(kind){if(this.snapshot().halted||this.closed)throw new Error('중단·장 마감 중입니다.');if(kind==='sidecar'){if(!this.config.sidecar.enabled||this.sidecarUsed)throw new Error('사이드카는 하루 한 번입니다.');this.triggerSidecar(this.snapshot().change,true);}else if(kind==='breaker'){if(!this.config.circuitBreaker.enabled||this.breakerStage>=3)throw new Error('발동 가능한 단계가 없습니다.');this.triggerBreaker(this.breakerStage+1,true);}else throw new Error('안정장치를 선택하세요.');return this.snapshot();}
  snapshot(){const halted=this.closed||this.tick<this.breakerUntil,auction=!halted&&this.tick<this.auctionUntil,sidecar=this.tick<this.sidecarUntil;return {phase:this.closed?'closed':halted?'halted':auction?'auction':sidecar?'sidecar':'normal',halted,auction,closed:this.closed,sidecar,recovering:false,participation:halted?0:1,index:this.index,change:(this.index/this.reference-1)*100,windowChange:(this.index/this.reference-1)*100,remainingTicks:Math.max(0,(halted?this.breakerUntil:auction?this.auctionUntil:sidecar?this.sidecarUntil:this.tick)-this.tick),sidecarRemaining:Math.max(0,this.sidecarUntil-this.tick),cooldownRemaining:this.sidecarUsed?Math.max(0,this.dayStart+2340-this.tick):0,breakerStage:this.breakerStage,programSide:sidecar?this.sidecarDirection:null,events:this.events};}
  observe(tick,index){
    this.tick=tick;this.index=index;this.history.push({tick,index});const state=this.snapshot(),local=tick-this.dayStart;
    if(this.sidecarUntil&&tick>=this.sidecarUntil){this.sidecarUntil=0;this.event('sidecar-end','사이드카 해제');}
    if(this.breakerUntil&&tick>=this.breakerUntil&&!this.closed){this.breakerUntil=0;this.event('auction','재개 단일가 · 10분');}
    if(this.auctionUntil&&tick>=this.auctionUntil){this.auctionUntil=0;this.event('resume','전체 종목 거래 재개');}
    if(state.halted||state.auction)return this.snapshot();
    const next=this.breakerStage+1,fall=-state.change,threshold=this.config.circuitBreaker.thresholds[next-1];
    const breakerCondition=this.config.circuitBreaker.enabled&&next<=3&&(local<2100||next===3)&&fall+1e-9>=threshold&&(next===1||index<=this.lastBreakerIndex*.99);
    if(breakerCondition){if(this.breakerCandidate===null)this.breakerCandidate=tick;if(tick-this.breakerCandidate>=6){this.triggerBreaker(next);return this.snapshot();}}else this.breakerCandidate=null;
    const side=this.config.sidecar,sign=Math.sign(state.change),condition=side.enabled&&!this.sidecarUsed&&local>=30&&local<2100&&Math.abs(state.change)+1e-9>=side.threshold;
    if(condition){if(!this.sideCandidate||this.sideCandidate.sign!==sign)this.sideCandidate={tick,sign};if(tick-this.sideCandidate.tick>=side.windowMinutes*6)this.triggerSidecar(state.change);}else this.sideCandidate=null;
    return this.snapshot();
  }
}
