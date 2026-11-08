// Position-level rules use settled prices only. They submit orders; they never
// assign an execution price or create liquidity.
export const RISK_LABELS={stopLoss:'손절',takeProfit:'익절',trailingStop:'추적손절'};

export function recordPositionFill(position,{side,quantity,price,priorShares,fee=0},tick){
  const direction=side==='buy'?1:-1;
  position.realizedPnL-=fee;
  if(!priorShares || Math.sign(priorShares)===direction){
    position.averageCost=(Math.abs(priorShares)*position.averageCost+quantity*price)/(Math.abs(priorShares)+quantity);
  }else{
    const closed=Math.min(Math.abs(priorShares),quantity);
    position.realizedPnL+=closed*(price-position.averageCost)*Math.sign(priorShares);
    if(!position.shares)position.averageCost=0;
    else if(Math.sign(position.shares)!==Math.sign(priorShares))position.averageCost=price;
  }
  if(!position.shares){
    if(position.riskExit)position.riskCooldownUntil=tick+6;
    position.riskExit=null;position.riskHigh=0;position.riskLow=0;
  }else if(!priorShares || Math.sign(position.shares)!==Math.sign(priorShares)){
    position.riskExit=null;position.riskHigh=price;position.riskLow=price;
  }else{
    position.riskHigh=Math.max(position.riskHigh||position.averageCost,price);
    position.riskLow=Math.min(position.riskLow||position.averageCost,price);
  }
}

export function protectiveDecision(position,traits,price,tick){
  if(!position.shares){
    return tick<(position.riskCooldownUntil||0)?{targetShares:0,label:'청산 후 대기',reason:'전량 청산 후 1분 동안 새 포지션을 열지 않습니다.',signal:0,source:'protection',cooldown:true}:null;
  }
  if(!(position.averageCost>0))return null;
  position.riskHigh=Math.max(position.riskHigh||position.averageCost,price);
  position.riskLow=Math.min(position.riskLow||position.averageCost,price);
  const long=position.shares>0,pnl=(price/position.averageCost-1)*(long?1:-1)*100;
  let triggered=false;
  if(!position.riskExit){
    let kind,threshold;
    if(traits.stopLoss>0 && pnl<=-traits.stopLoss+1e-9){kind='stopLoss';threshold=position.averageCost*(1+(long?-1:1)*traits.stopLoss/100);}
    else if(traits.trailingStop>0 && (long?price<=position.riskHigh*(1-traits.trailingStop/100):price>=position.riskLow*(1+traits.trailingStop/100))){kind='trailingStop';threshold=(long?position.riskHigh:position.riskLow)*(1+(long?-1:1)*traits.trailingStop/100);}
    else if(traits.takeProfit>0 && pnl>=traits.takeProfit-1e-9){kind='takeProfit';threshold=position.averageCost*(1+(long?1:-1)*traits.takeProfit/100);}
    if(kind){position.riskExit={kind,threshold,triggerPrice:price,tick};triggered=true;}
  }
  if(!position.riskExit)return null;
  const exit=position.riskExit,label=RISK_LABELS[exit.kind];
  return {targetShares:0,label:`${label} 청산`,reason:`${label} 기준 ${exit.threshold.toLocaleString('ko-KR',{maximumFractionDigits:2})}원 · 감지 ${exit.triggerPrice.toLocaleString('ko-KR')}원 · 잔여 ${Math.abs(position.shares).toLocaleString('ko-KR')}주를 상대 호가에서 청산`,signal:0,source:'protection',riskExit:true,riskTrigger:triggered?{...exit}:null};
}
