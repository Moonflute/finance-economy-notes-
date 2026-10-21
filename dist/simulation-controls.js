// Configurable simulation rules, not a reproduction of a particular exchange.
const TICKS_PER_MINUTE=6;
export const DEFAULT_MARKET_CONTROLS={
  sidecar:{enabled:true,threshold:5,windowMinutes:1,durationMinutes:5,participation:15,cooldownMinutes:5},
  circuitBreaker:{enabled:true,thresholds:[8,15,20],durationMinutes:20},
  recoveryMinutes:3
};

export const MARKET_CONTROL_SECTIONS={
  sidecar:{label:'사이드카 기준',note:'전체 종목의 등가중 지수가 관찰 구간 안에 기준 이상 오르거나 내리면 발동합니다.',fields:[
    {path:'sidecar.enabled',label:'사이드카',type:'enabled'},
    {path:'sidecar.threshold',label:'등락 기준',unit:'%',min:0.1,max:50,step:0.1},
    {path:'sidecar.windowMinutes',label:'관찰 구간',unit:'분',min:1,max:60,step:1}]},
  cooling:{label:'사이드카 효과',note:'기존 행동 확률에 참여 비율을 곱합니다. 주문 수량·호가 강도도 같은 비율로 줄입니다.',fields:[
    {path:'sidecar.durationMinutes',label:'발동 시간',unit:'분',min:1,max:60,step:1},
    {path:'sidecar.participation',label:'발동 중 참여 비율',unit:'%',min:0,max:100,step:1},
    {path:'sidecar.cooldownMinutes',label:'해제 후 재발동 대기',unit:'분',min:0,max:120,step:1}]},
  breaker:{label:'서킷브레이커 기준',note:'시작 지수 대비 하락률입니다. 각 단계는 실험당 한 번 발동하며, 급락하면 상위 단계로 바로 진입합니다.',fields:[
    {path:'circuitBreaker.enabled',label:'서킷브레이커',type:'enabled'},
    ...[0,1,2].map(index=>({path:`circuitBreaker.thresholds.${index}`,label:`${index+1}단계 하락 기준`,unit:'%',min:0.1,max:95,step:0.1}))]},
  reopening:{label:'중단·재개 시간',note:'중단 중에는 모든 체결을 멈춥니다. 재개 시 참여·주문 강도가 25%부터 회복하며, 사이드카 해제 후에도 서서히 회복합니다.',fields:[
    {path:'circuitBreaker.durationMinutes',label:'단계별 거래 중단',unit:'분',min:1,max:120,step:1},
    {path:'recoveryMinutes',label:'해제 후 회복 시간',unit:'분',min:0,max:60,step:1}]}
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
  constructor(config){
    this.config=normalizeMarketControls(config);this.tick=0;this.index=100;this.history=[{tick:0,index:100}];this.events=[];
    this.sidecarUntil=0;this.sidecarCooldownUntil=0;this.breakerUntil=0;this.breakerStage=0;this.recoveryUntil=0;this.recoveryStart=0;this.recoveryFrom=1;
  }
  event(type,label,details={}){this.events.push({tick:this.tick,type,label,index:this.index,...details});this.events=this.events.slice(-60);}
  triggerSidecar(change,manual=false){
    this.sidecarUntil=this.tick+this.config.sidecar.durationMinutes*TICKS_PER_MINUTE;
    this.sidecarCooldownUntil=this.sidecarUntil+this.config.sidecar.cooldownMinutes*TICKS_PER_MINUTE;
    this.event('sidecar',`사이드카 ${manual?'시험 ':''}발동`,{change,manual});
  }
  triggerBreaker(stage,manual=false){
    this.breakerStage=stage;this.breakerUntil=this.tick+this.config.circuitBreaker.durationMinutes*TICKS_PER_MINUTE;this.recoveryUntil=0;
    this.event('breaker',`서킷브레이커 ${stage}단계 ${manual?'시험 ':''}발동`,{stage,change:this.index-100,manual});
  }
  trigger(kind){
    const state=this.snapshot();
    if(state.halted)throw new Error('거래 중단 중입니다. 시간을 진행해 거래를 재개하세요.');
    if(kind==='sidecar'){
      if(!this.config.sidecar.enabled || state.sidecar || state.cooldownRemaining)throw new Error('사이드카가 꺼져 있거나 발동·재발동 대기 중입니다.');
      this.triggerSidecar(state.windowChange,true);
    }else if(kind==='breaker'){
      if(!this.config.circuitBreaker.enabled || this.breakerStage>=3)throw new Error('서킷브레이커가 꺼져 있거나 모든 단계가 이미 발동했습니다.');
      this.triggerBreaker(this.breakerStage+1,true);
    }else throw new Error('발동할 안정장치를 선택하세요.');
    return this.snapshot();
  }
  recover(from){
    if(!this.config.recoveryMinutes || from>=1)return;
    const current=this.snapshot().participation;
    this.recoveryStart=this.tick;this.recoveryUntil=this.tick+this.config.recoveryMinutes*TICKS_PER_MINUTE;this.recoveryFrom=Math.min(from,current);
  }
  snapshot(){
    const halted=this.tick<this.breakerUntil,sidecar=this.tick<this.sidecarUntil,recovering=this.tick<this.recoveryUntil;
    const recovery=recovering?this.recoveryFrom+(1-this.recoveryFrom)*(this.tick-this.recoveryStart)/(this.recoveryUntil-this.recoveryStart):1;
    const participation=halted?0:Math.min(sidecar?this.config.sidecar.participation/100:1,recovery);
    const phase=halted?'halted':sidecar?'sidecar':recovering?'recovering':'normal';
    const until=halted?this.breakerUntil:sidecar?this.sidecarUntil:recovering?this.recoveryUntil:this.tick;
    const baseline=this.history.find(point=>point.tick>=Math.max(0,this.tick-this.config.sidecar.windowMinutes*TICKS_PER_MINUTE)) || this.history[0];
    return {phase,halted,sidecar,recovering,participation,index:this.index,change:this.index-100,windowChange:(this.index/baseline.index-1)*100,remainingTicks:Math.max(0,until-this.tick),sidecarRemaining:Math.max(0,this.sidecarUntil-this.tick),cooldownRemaining:Math.max(0,this.sidecarCooldownUntil-this.tick),breakerStage:this.breakerStage,events:this.events};
  }
  // Called after a whole exchange tick. A trigger affects the following tick;
  // the execution which crossed the threshold is never undone.
  observe(tick,index,{halted=false}={}){
    this.tick=tick;this.index=index;
    this.history.push({tick,index});this.history=this.history.filter(point=>point.tick>=tick-60*TICKS_PER_MINUTE);
    if(this.recoveryUntil && tick>=this.recoveryUntil){this.recoveryUntil=0;if(!halted && tick>=this.sidecarUntil)this.event('recovered','거래 참여 회복');}
    if(this.sidecarUntil && tick>=this.sidecarUntil){this.sidecarUntil=0;this.event('sidecar-end','사이드카 해제');if(!halted)this.recover(this.config.sidecar.participation/100);}
    if(this.breakerUntil && tick>=this.breakerUntil){this.breakerUntil=0;this.event('resume','전체 종목 거래 재개',{stage:this.breakerStage});this.recover(0.25);}
    if(halted)return this.snapshot();
    const breaker=this.config.circuitBreaker,drawdown=100-index;
    const stage=breaker.enabled?breaker.thresholds.filter(threshold=>drawdown+1e-9>=threshold).length:0;
    if(stage>this.breakerStage){
      this.triggerBreaker(stage);
      return this.snapshot();
    }
    const sidecar=this.config.sidecar,status=this.snapshot();
    if(sidecar.enabled && !status.halted && !status.sidecar && tick>=this.sidecarCooldownUntil && Math.abs(status.windowChange)+1e-9>=sidecar.threshold){
      this.triggerSidecar(status.windowChange);
    }
    return this.snapshot();
  }
}
