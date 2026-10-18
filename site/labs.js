export const LABS = [
 {id:'bond',name:'채권과 금리',tag:'PRICE & YIELD',description:'금리를 움직여 가격과 듀레이션 근사를 비교하세요.',concepts:['bond-price','duration','convexity'],color:'#255d4d'},
 {id:'portfolio',name:'함께 담으면',tag:'PORTFOLIO RISK',description:'상관관계에 따라 달라지는 두 자산의 위험.',concepts:['correlation','frontier'],color:'#3b59a8'},
 {id:'compound',name:'복리가 쌓이는 시간',tag:'COMPOUNDING',description:'과세 시점이 누적 자산에 남기는 차이.',concepts:['compound','returns'],color:'#9c6639'},
 {id:'dcf',name:'가치의 민감도',tag:'VALUATION',description:'할인율과 성장률, 말기가치의 관계.',concepts:['fcff','wacc','dcf'],color:'#77538b'},
 {id:'macro',name:'수요와 공급의 이동',tag:'AD–AS',description:'같은 물가 상승을 만드는 서로 다른 충격.',concepts:['adas','inflation','policy'],color:'#255d4d'},
 {id:'buffer',name:'현금흐름 안전판',tag:'CASH FLOW',description:'소득이 멈췄을 때의 버팀기간을 계산하세요.',concepts:['liquidity','planning'],color:'#9c6639'}
];
const fmt=(n,d=2)=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:d}).format(n);
const input=(id,name,value,min,max,step,unit='')=>`<label class="lab-control" for="${id}"><span>${name}<output id="${id}-value">${value}${unit}</output></span><input type="range" id="${id}" value="${value}" min="${min}" max="${max}" step="${step}" data-unit="${unit}"><small><span>${min}${unit}</span><span>${max}${unit}</span></small></label>`;
const number=(id,name,value,min,max,step)=>`<label class="number-control" for="${id}">${name}<input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`;
export function bondPrice(face,coupon,years,yieldRate){let p=0;for(let t=1;t<=years;t++)p+=(face*coupon+(t===years?face:0))/Math.pow(1+yieldRate,t);return p}
export function bondMetrics(coupon,years,y){const p=bondPrice(100,coupon,years,y);let weight=0,conv=0;for(let t=1;t<=years;t++){const cf=100*coupon+(t===years?100:0);weight+=t*cf/Math.pow(1+y,t);conv+=t*(t+1)*cf/Math.pow(1+y,t+2)}return{p,mac:weight/p,mod:weight/p/(1+y),conv:conv/p}}
export function portfolioRisk(w,s1,s2,rho){return Math.sqrt(Math.max(0,w*w*s1*s1+(1-w)**2*s2*s2+2*w*(1-w)*s1*s2*rho))}
export function dcfValue(f,g,w,t){if(w<=t||w<=0)return null;let explicit=0;for(let y=1;y<=5;y++)explicit+=f*(1+g)**y/(1+w)**y;const terminal=f*(1+g)**5*(1+t)/(w-t)/(1+w)**5;return{ev:explicit+terminal,terminal,share:terminal/(explicit+terminal)}}
function chart(series,{xmin=0,xmax=10,ymin=0,ymax=100,xlabel='',ylabel='',point=null}={}){
 const W=650,H=300,L=56,T=20,R=22,B=42,x=v=>L+(v-xmin)/(xmax-xmin)*(W-L-R),y=v=>H-B-(v-ymin)/(ymax-ymin)*(H-T-B);
 let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ylabel}와 ${xlabel}의 관계"><title>${ylabel}와 ${xlabel}</title>`;
 for(let i=0;i<=4;i++){const v=ymin+(ymax-ymin)*i/4;s+=`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#e3e8e3"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${fmt(v,1)}</text>`}
 for(let i=0;i<=4;i++){const v=xmin+(xmax-xmin)*i/4;s+=`<text x="${x(v)}" y="${H-20}" text-anchor="middle">${fmt(v,1)}</text>`}
 s+=`<text x="${L}" y="12">${ylabel}</text><text x="${W-R}" y="${H-2}" text-anchor="end">${xlabel}</text>`;
 for(const row of series)s+=`<polyline class="chart-line" fill="none" stroke="${row.color}" stroke-width="3" ${row.dash?'stroke-dasharray="7 5"':''} points="${row.data.map(([a,b])=>x(a)+','+y(b)).join(' ')}"/>`;
 if(point)s+=`<circle cx="${x(point[0])}" cy="${y(point[1])}" r="7" fill="#255d4d" stroke="white" stroke-width="3"/>`;
 return s+'</svg>';
}
function result(label,value,sub=''){return `<div class="lab-result"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`}
export function labMarkup(id){
 const l=LABS.find(x=>x.id===id);if(!l)return'';
 const controls={
 bond:input('bond-y','시장수익률',5,0,12,.1,'%')+input('bond-c','표면금리',5,0,10,.5,'%')+input('bond-n','잔존만기',5,1,30,1,'년'),
 portfolio:input('port-rho','상관계수',0,-1,1,.05)+input('port-w','자산 A 비중',50,0,100,5,'%')+input('port-a','자산 A 변동성',20,1,60,1,'%')+input('port-b','자산 B 변동성',20,1,60,1,'%'),
 compound:input('comp-r','연 수익률',5,0,15,.5,'%')+input('comp-n','기간',20,1,40,1,'년')+input('comp-t','가정 세율',20,0,40,1,'%'),
 dcf:number('dcf-f','현재 FCFF (백만원)',100,1,1000000,1)+input('dcf-g','5년 성장률',6,-10,20,.5,'%')+input('dcf-w','WACC',9,2,20,.25,'%')+input('dcf-t','영구성장률',3,-2,6,.25,'%'),
 macro:'<div class="scenario-buttons" role="group" aria-label="경제 충격"><button data-scenario="base" class="active" aria-pressed="true">기준 상태</button><button data-scenario="demand" aria-pressed="false">수요 확대</button><button data-scenario="supply" aria-pressed="false">공급 악화</button></div><p class="lab-assumption">물가·산출을 정규화한 설명용 선형 모형입니다. 실제 경제의 크기와 속도를 예측하지 않습니다.</p>',
 buffer:number('buffer-c','즉시 가용자금 (만원)',1200,0,100000000,1)+number('buffer-e','필수 월지출 (만원)',250,1,10000000,1)+input('buffer-m','목표 기간',6,1,24,1,'개월')
 };
 return `<div class="lab-workspace"><div class="lab-controls">${controls[id]}<button class="text-button" data-reset-lab="${id}">입력값 초기화 ↺</button></div><div class="lab-visual"><div id="labResults" class="lab-results" aria-live="polite"></div><div id="labChart" class="lab-chart"></div><p id="labExplanation" class="lab-explanation"></p></div></div>`;
}
export function mountLab(root,id){
 const get=id=>Number(root.querySelector('#'+id).value),out=root.querySelector('#labResults'),plot=root.querySelector('#labChart'),explain=root.querySelector('#labExplanation');let scenario='base';
 const update=()=>{
  for(const n of root.querySelectorAll('input[type=range]'))root.querySelector('#'+n.id+'-value').textContent=fmt(Number(n.value))+n.dataset.unit;
  if([...root.querySelectorAll('input')].some(n=>n.value.trim()===''||!Number.isFinite(Number(n.value))||!n.checkValidity())){out.innerHTML=result('입력 확인','범위를 확인하세요');plot.innerHTML='';explain.textContent='빈칸 없이 표시된 범위 안의 값을 입력하세요.';return}
  if(id==='bond'){
   const coupon=get('bond-c')/100,n=get('bond-n'),y=get('bond-y')/100,base=bondMetrics(coupon,n,.05),current=bondMetrics(coupon,n,y),approx=base.p*(1-base.mod*(y-.05)),curves=Array.from({length:49},(_,i)=>{const v=i/400;return[v*100,bondPrice(100,coupon,n,v)]}),tangent=curves.map(([r])=>[r,base.p*(1-base.mod*(r/100-.05))]);
   out.innerHTML=result('채권가격 (액면 100)',fmt(current.p),`수익률 5% 기준 대비 ${fmt((current.p/base.p-1)*100)}%`)+result('수정듀레이션',fmt(current.mod),'현재 수익률 기준 · 년');
   plot.innerHTML=chart([{data:curves,color:'#255d4d'},{data:tangent,color:'#b9c77e',dash:true}],{xmin:0,xmax:12,ymin:Math.min(0,...tangent.map(p=>p[1])),ymax:Math.ceil(Math.max(...curves.map(p=>p[1]))/10)*10,xlabel:'시장수익률 (%)',ylabel:'가격',point:[y*100,current.p]})+'<div class="legend"><span>● 실제 채권가격</span><span>┄ 5%에서의 듀레이션 근사</span></div>';
   explain.textContent=`근사 가격 ${fmt(approx)}, 실제 가격 ${fmt(current.p)}. 연 1회 쿠폰, 부도·옵션·비용 없는 고정 현금흐름 가정입니다. 기준점에서 멀어질수록 곡률에 따른 오차가 커집니다.`;
  }else if(id==='portfolio'){
   const rho=get('port-rho'),w=get('port-w')/100,a=get('port-a'),b=get('port-b'),risk=portfolioRisk(w,a,b,rho),series=Array.from({length:41},(_,i)=>{const r=-1+i/20;return[r,portfolioRisk(w,a,b,r)]});
   out.innerHTML=result('포트폴리오 변동성',fmt(risk)+'%',`A ${fmt(w*100)}% · B ${fmt((1-w)*100)}%`)+result('완전 양의 상관일 때',fmt(w*a+(1-w)*b)+'%','같은 비중과 개별 변동성');
   plot.innerHTML=chart([{data:series,color:'#3b59a8'}],{xmin:-1,xmax:1,ymin:0,ymax:Math.max(a,b),xlabel:'상관계수',ylabel:'변동성 (%)',point:[rho,risk]});explain.textContent='공매도 없는 두 자산의 평균-분산 모형입니다. 상관이 낮아질수록 분산 효과가 커지지만, 과거 상관이 미래에도 유지된다는 보장은 없습니다.';
  }else if(id==='compound'){
   const r=get('comp-r')/100,t=get('comp-t')/100,n=get('comp-n'),series=Array.from({length:n+1},(_,i)=>[i,100*(1+r*(1-t))**i]),deferred=Array.from({length:n+1},(_,i)=>[i,100+(100*(1+r)**i-100)*(1-t)]),end=series.at(-1)[1],later=deferred.at(-1)[1];
   out.innerHTML=result('매년 과세',fmt(end)+'만원','원금 100만원')+result('만기 과세',fmt(later)+'만원',`차이 ${fmt(later-end)}만원`);
   plot.innerHTML=chart([{data:series,color:'#9c6639'},{data:deferred,color:'#255d4d'}],{xmin:0,xmax:n,ymin:0,ymax:Math.ceil(later/100)*100,xlabel:'기간 (년)',ylabel:'세후 금액 (만원)'} )+'<div class="legend"><span style="color:#9c6639">● 매년 과세</span><span>● 만기 과세</span></div>';
   explain.textContent='수익률·가정 세율이 일정하고 비용·손실·공제가 없는 비교입니다. 만기 과세 선은 각 시점에 이익 과세 후 청산했을 때의 금액이며 실제 세법이나 특정 계좌의 계산이 아닙니다.';
  }else if(id==='dcf'){
   const f=get('dcf-f'),g=get('dcf-g')/100,w=get('dcf-w')/100,t=get('dcf-t')/100,v=dcfValue(f,g,w,t);
   if(!v){out.innerHTML=result('가정 확인','WACC > 성장률');plot.innerHTML='';explain.textContent='영구성장모형은 WACC가 영구성장률보다 높아야 합니다.';return}
   out.innerHTML=result('영업가치',fmt(v.ev)+'백만원','5년 예측 + 영구성장')+result('말기가치 비중',fmt(v.share*100)+'%','현재가치 기준');
   plot.innerHTML=`<div class="table-scroll"><table class="matrix"><caption>WACC × 영구성장률 · 단위 백만원</caption><thead><tr><th scope="col">WACC ↓ / g →</th>${[-.01,0,.01].map(d=>`<th scope="col">${fmt((t+d)*100)}%</th>`).join('')}</tr></thead><tbody>${[-.01,0,.01].map(dw=>`<tr><th scope="row">${fmt((w+dw)*100)}%</th>${[-.01,0,.01].map(dt=>{const r=dcfValue(f,g,w+dw,t+dt);return`<td class="${dw===0&&dt===0?'matrix-base':''}">${r?fmt(r.ev):'적용 불가'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
   explain.textContent='말기가치가 클수록 먼 미래의 가정에 더 의존합니다. 성장에 필요한 재투자가 FCFF에 이미 반영됐다는 단순 가정이며, 주주가치에는 순차입금 등 별도 조정이 필요합니다.';
  }else if(id==='macro'){
   const ad=scenario==='demand'?140:120,as=scenario==='supply'?30:0,Y=(ad-as)/2,P=ad-Y,adData=[[15,ad-15],[105,ad-105]],asData=[[15,15+as],[105,105+as]];
   out.innerHTML=result('산출',fmt(Y,0),Y===60?'기준 60':Y>60?'기준보다 증가':'기준보다 감소')+result('물가',fmt(P,0),P===60?'기준 60':'기준보다 상승');
   plot.innerHTML=chart([{data:[[15,105],[105,15]],color:'#d1d6d1',dash:true},{data:[[15,15],[105,105]],color:'#d1d6d1',dash:true},{data:adData,color:'#255d4d'},{data:asData,color:'#b57c4b'}],{xmin:0,xmax:120,ymin:0,ymax:140,xlabel:'실질산출 (설명용 지수)',ylabel:'물가 (설명용 지수)',point:[Y,P]})+'<div class="legend"><span>● AD 총수요</span><span style="color:#b57c4b">● SRAS 단기 총공급</span></div>';
   explain.textContent=scenario==='demand'?'총수요가 우측으로 이동하면 이 단기모형에서 산출과 물가가 함께 상승합니다.':scenario==='supply'?'비용 상승으로 단기 공급이 좌측으로 이동하면 물가는 오르고 산출은 줄어듭니다.':'교차점이 단기 균형입니다. 충격 버튼을 눌러 곡선 이동과 균형의 변화를 비교하세요.';
  }else if(id==='buffer'){
   const c=get('buffer-c'),e=get('buffer-e'),m=get('buffer-m'),months=c/e,gap=Math.max(0,m*e-c);
   out.innerHTML=result('현재 버팀기간',fmt(months)+'개월','가용자금 ÷ 필수 월지출')+result('목표까지 부족액',fmt(gap)+'만원',`${m}개월 목표`);
   plot.innerHTML=`<div class="buffer-track" role="img" aria-label="목표 대비 ${fmt(Math.min(100,months/m*100))}%"><div style="width:${Math.min(100,months/m*100)}%"></div></div><div class="legend"><span>현재 ${fmt(c)}만원</span><span>목표 ${fmt(m*e)}만원</span></div>`;explain.textContent='소득 유입·물가·비정기 지출을 제외한 단순 안전판입니다. 목표 기간은 소득 안정성, 부양가족, 부채 만기와 보험을 반영해 정하세요.';
  }
 };
 root.querySelectorAll('input').forEach(el=>el.addEventListener('input',update));
 root.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>{scenario=b.dataset.scenario;root.querySelectorAll('[data-scenario]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))});update()}));
 root.querySelector('[data-reset-lab]').addEventListener('click',()=>{root.innerHTML=labMarkup(id);mountLab(root,id)});update();
}
