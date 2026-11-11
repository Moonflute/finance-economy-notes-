// Presentation only: never call market.random(), newsOpinion(), decision(),
// informationFor() or settlement from an observation view.
export const THOUGHTS={
  ready:['오늘은 어떤 흐름일까?','내 기준부터 챙겨 두자.','서두르지 말고 시작해 보자.','호가가 들어오면 살펴봐야지.'],
  closed:['오늘 거래는 여기까지.','내일은 어떻게 움직일까?','오늘 판단을 돌아봐야겠어.','장을 마쳤네. 잠깐 쉬자.'],
  halted:['거래가 멈췄네. 숨 좀 고르자.','재개할 때 호가부터 봐야겠어.','지금은 주문을 체결할 수 없네.','다들 잠깐 멈춰 섰어.'],
  auction:['주문을 모으는 중이네.','어느 가격에서 만날까?','단일가가 정해질 때까지 기다리자.','아직 체결된 건 아니야.'],
  margin:['담보가 부족해. 포지션을 줄여야 해.','반대매매가 나왔네…','지금은 담보부터 지켜야겠어.','청산할 상대 주문이 필요해.'],
  stopLoss:['내 손절 기준에 닿았어.','정한 손실 기준대로 줄이자.','반등을 기다리기보다 기준을 지키자.','남은 수량도 정리해야겠어.'],
  takeProfit:['목표 수익에 닿았네. 정리하자.','이번엔 내 익절 기준을 지키자.','이제 수익을 확정할 차례야.','목표에 왔으니 청산을 이어가자.'],
  trailingStop:['고점에서 꽤 되돌아왔어.','추적하던 청산선에 닿았네.','수익을 더 내주기 전에 줄이자.','움직여 둔 기준선을 지키자.'],
  shortTrail:['저점에서 가격이 되돌아왔어.','공매도 추적 기준에 닿았네.','빌린 주식을 갚을 때야.','상환 기준대로 움직이자.'],
  cooldown:['정리했으니 잠깐 쉬자.','바로 다시 들어가진 말자.','한 박자 쉬고 새로 판단하자.','다음 기회를 기다릴래.'],
  panic:['마음이 급해져. 비중을 줄이자.','더 잃을까 봐 겁나네…','일단 가진 주식을 줄여야겠어.','지금은 버티기가 어렵네.'],
  fomo:['나만 기회를 놓치는 걸까?','조금 더 담고 싶은데…','상승을 더 따라가고 싶어.','마음이 자꾸 매수 쪽으로 기우네.'],
  contrarianBuy:['다들 불안해할 때 살펴보자.','공포가 기회일 수도 있어.','남들과 반대로 생각해 볼래.','불안한 분위기지만 매수를 검토하자.'],
  contrarianSell:['열기가 너무 오른 것 같은데.','다들 들떴을 때 줄여 볼까.','욕심이 커질수록 한발 물러서자.','이 분위기를 거꾸로 보고 있어.'],
  insider:['아직 공개 전이지만, 난 내용을 알아.','먼저 알게 된 소식을 따져 보자.','발표 전에 내 판단을 정리하자.','내게 전달된 정보부터 반영하자.'],
  rumor:['아직은 기대일 뿐이야.','발표 전에 기대가 움직이네.','실제 내용이 기대와 같을까?','지금은 소문을 반영해 보는 거야.'],
  newsBuy:['소식을 보고 매수 쪽으로 판단했어.','이 발표는 내게 매수 신호야.','알게 된 소식을 비중에 반영하자.','뉴스를 내 기준으로 해석해 보자.'],
  newsSell:['소식을 보고 비중을 줄이려 해.','이 발표 뒤에는 다시 계산해야겠어.','내 기준에선 비중을 줄일 소식이야.','뉴스를 보고 매도 쪽으로 판단했어.'],
  newsWait:['소식은 들었지만 이번엔 지켜볼래.','뉴스 하나로 바로 움직이진 말자.','다른 조건도 같이 봐야겠어.','알았어. 그래도 이번 판단은 보류야.'],
  volumeBuy:['거래량을 보고 매수 쪽으로 움직이자.','체결이 몰리네. 매수 판단에 반영하자.','거래량까지 확인하고 주문할래.','평소보다 활발해서 눈이 가네.'],
  volumeSell:['거래량을 보고 비중을 줄이자.','체결이 몰려서 다시 판단했어.','이번 거래량 신호는 매도 쪽이야.','평소와 다른 거래량을 반영하자.'],
  volumeWait:['거래가 뜸하네. 더 기다리자.','거래량이 적어서 확신이 안 서.','이번엔 거래량을 보고 쉬어 갈래.','활발해질 때 다시 보자.'],
  volumeObserve:['거래량은 봤지만 더 주문하진 않겠어.','목표 비중과 주문 여력도 살펴보자.','체결이 몰려도 지금은 지켜볼래.','거래량 판단과 실제 주문은 다르지.'],
  bought:['매수가 체결됐어.','주식이 더 들어왔네.','주문한 매수가 성사됐어.','이제 보유 비중을 다시 봐야지.'],
  sold:['매도가 체결됐어.','주식 비중을 조금 줄였네.','매도한 만큼 현금이 들어왔어.','이번 매도는 체결됐네.'],
  shorted:['공매도가 체결됐어.','빌려서 판 주식이 늘었네.','이제 상승 위험도 살펴야 해.','갚아야 할 주식을 기억하자.'],
  covered:['빌린 주식을 일부 갚았어.','상환 매수가 체결됐네.','공매도 포지션을 줄였어.','갚을 물량이 줄어들었네.'],
  buyOrder:['매수 주문을 냈어. 체결을 기다리자.','이 가격에 살 수 있을까?','상대 매도 주문을 기다리는 중이야.','사려는 마음과 체결은 다르지.'],
  sellOrder:['매도 주문을 내고 기다리는 중이야.','받아 줄 매수 주문이 있을까?','이 가격에 정리할 수 있을까?','상대 호가와 만날 때까지 기다리자.'],
  leverage:['차입 한도 안에서 더 담으려 해.','레버리지를 쓰려니 더 긴장되네.','빌릴 수 있는 금액도 따져 보자.','매수 규모를 키우려는 중이야.'],
  thin:['호가가 얇아졌네.','상대 주문이 넉넉하진 않아.','같은 수량도 가격을 더 밀 수 있겠어.','호가 잔량을 유심히 봐야겠네.'],
  fear:['조금 불안하네…','마음은 급하지만 판단은 따로 하자.','긴장이 쉽게 풀리지 않네.','지금은 조심스러운 마음이야.'],
  greed:['기대가 점점 커지네.','욕심이 조금 나는데…','내 기준을 다시 확인하자.','들뜨는 마음을 잘 살펴야겠어.'],
  waiting:['내 다음 판단 시점을 기다리자.','조금 더 흐름을 보고 있어.','아직은 새 판단 전이야.','한 박자 쉬면서 지켜보자.'],
  flat:['아직 뚜렷한 방향은 없네.','이 정도 움직임엔 기다릴래.','방향이 보일 때 다시 판단하자.','가격이 큰 힌트를 주진 않네.'],
  hold:['지금은 그대로 지켜볼래.','급하게 움직일 필요는 없겠어.','내 보유 상태부터 살펴보자.','이번에는 관망이야.']
};

export function visualHash(...parts){let n=2166136261;for(const c of parts.join(':'))n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n>>>0;}
export function thoughtFor(kind,seed,id,cycle,previous=''){
  const lines=THOUGHTS[kind] || THOUGHTS.hold;
  let index=visualHash(seed,id,kind,cycle)%lines.length;
  if(lines[index]===previous)index=(index+1)%lines.length;
  return lines[index];
}

export function characterReaction(agent,decision,context){
  const d=decision || {},filled=agent.lastFilled || 0,quantity=d.quantity || 0,emotion=agent.emotion ?? 50;
  const before=agent.shares-filled;
  const fillLabel=filled>0?(before<0?'상환 매수':'매수 체결'):filled<0?(agent.shares<0?'공매도 체결':'매도 체결'):'';
  const active=quantity>0;
  let kind='hold',status=fillLabel || (active?(d.side==='buy'?'매수 주문':'매도 주문'):'관망');
  if(context.closed){kind='closed';status='장 마감';}
  else if(context.halted){kind='halted';status='거래 중단';}
  else if(context.auction){kind='auction';status=fillLabel || (active?'단일가 주문':'단일가 대기');}
  else if(!context.tick){kind='ready';status='시작 전';}
  else if(d.forced)kind='margin';
  else if(d.riskExit){kind=d.riskTrigger?.kind || (d.label?.includes('추적')?'trailingStop':d.label?.includes('익절')?'takeProfit':'stopLoss');if(kind==='trailingStop'&&before<0)kind='shortTrail';}
  else if(d.cooldown){kind='cooldown';status='청산 후 대기';}
  else if(d.source==='emotion'&&d.emotion?.accepted){const e=d.emotion;kind=e.kind==='panic'?'panic':e.kind==='fomo'?'fomo':e.kind==='contrarian'?(e.action>0?'contrarianBuy':'contrarianSell'):'fear';}
  else if(d.source==='news'){
    const received=(d.news || []).filter(n=>n.accepted&&Math.abs(n.effect)>0);
    kind=received.some(n=>n.phase==='insider')?'insider':received.some(n=>n.phase==='rumor')?'rumor':active?(d.side==='buy'?'newsBuy':'newsSell'):'newsWait';
  }else if(d.source==='volume')kind=d.volume?.style==='cautious'?'volumeWait':active?(d.side==='buy'?'volumeBuy':'volumeSell'):'volumeObserve';
  else if(filled>0)kind=before<0?'covered':'bought';
  else if(filled<0)kind=agent.shares<0?'shorted':'sold';
  else if(active)kind=d.side==='buy'?(d.action==='leverage'?'leverage':'buyOrder'):'sellOrder';
  else if(emotion<=agent.traits.panicThreshold)kind='fear';
  else if(emotion>=agent.traits.greedThreshold)kind='greed';
  else if(context.thin)kind='thin';
  else if(d.label==='중립 구간')kind='flat';
  else if(d.label==='다음 판단 대기')kind='waiting';
  const mood=['margin','stopLoss','panic','fear'].includes(kind)?'worried':['halted','auction','insider','rumor','shorted'].includes(kind)?'alert':['fomo','greed','bought','takeProfit'].includes(kind)?'happy':['closed','cooldown','ready','hold','waiting','flat'].includes(kind)?'calm':'focused';
  const direction=filled?Math.sign(filled):active?(d.side==='buy'?1:-1):0;
  return {id:agent.id,name:agent.traits.name,kind,mood,status,direction,filled,quantity,emotion,shares:agent.shares,risk:agent.traits.risk,reason:context.closed?'당일 거래가 종료됐습니다.':context.halted?'서킷브레이커로 체결을 중단했습니다.':d.reason || agent.lastReason || '아직 판단 전입니다.',tick:context.tick,priority:['margin','stopLoss','trailingStop','shortTrail','panic','halted'].includes(kind)?3:['insider','newsBuy','newsSell','takeProfit','fomo'].includes(kind)?2:filled?2:1};
}

export function characterFrame(exchange,market){
  const controls=exchange.controls.snapshot();
  const context={tick:market.tick,closed:exchange.sessionClosed,halted:controls.halted,auction:controls.auction||market.viUntil>market.tick,thin:market.model.backgroundLiquidity&&market.depthFactor<.65};
  const decisions=new Map(market.last.decisions.map(d=>[d.agentId,d]));
  const people=market.agents.map(a=>characterReaction(a,decisions.get(a.id),context));
  const buys=people.filter(a=>a.filled>0).length,sells=people.filter(a=>a.filled<0).length;
  const latest=market.newsLog.at(-1);
  return {people,context,seed:exchange.config.seed,assetId:market.assetId,company:market.config.company,buys,sells,waiting:people.length-buys-sells,headline:context.closed?'장 마감':context.halted?'서킷브레이커 · 거래 중단':context.auction?'단일가 · 주문 수집 중':controls.sidecar?'사이드카 · 개인 거래는 계속됩니다.':latest?`${latest.phase==='rumor'?'사전 기대':'공개 발표'} · ${latest.title}`:context.tick?'참여자마다 판단 시점과 기준이 다릅니다.':'시작하면 참여자들의 반응이 나타납니다.'};
}

export function characterLayout(width,height,count){
  const columns=Math.max(1,Math.min(4,Math.floor(width/140),Math.ceil(count/2)));
  const rows=Math.max(1,Math.min(3,Math.floor(height/175)));
  return {columns,rows,size:Math.max(1,columns*rows)};
}

// Wall time controls readability only. Market observations are passed in;
// display scheduling has no access to trading state or the market PRNG.
export class ThoughtDirector{
  constructor(){this.reset();}
  reset(){this.time=0;this.cycle=0;this.nextAt=0;this.lastSpoke=new Map();this.previous=new Map();this.visible=new Map();}
  update(people,seed,elapsed,{running=true,limit=2}={}){
    if(running)this.time+=Math.max(0,Math.min(1,elapsed));
    const ids=new Set(people.map(p=>p.id));
    for(const [id,item] of this.visible)if(!ids.has(id)||item.until<=this.time)this.visible.delete(id);
    while(this.visible.size>limit)this.visible.delete(this.visible.keys().next().value);
    if(this.visible.size<limit&&this.time>=this.nextAt&&people.length){
      const choices=people.filter(p=>!this.visible.has(p.id)).sort((a,b)=>((this.lastSpoke.get(a.id) ?? -1000)-(this.lastSpoke.get(b.id) ?? -1000))||(b.priority-a.priority)||(visualHash(seed,a.id,this.cycle)-visualHash(seed,b.id,this.cycle)));
      const person=choices[0];
      if(person){const text=thoughtFor(person.kind,seed,person.id,this.cycle++,this.previous.get(person.id));this.visible.set(person.id,{text,kind:person.kind,tick:person.tick,until:this.time+4.6});this.lastSpoke.set(person.id,this.time);this.previous.set(person.id,text);this.nextAt=this.time+2.8;}
    }
    return this.visible;
  }
}
