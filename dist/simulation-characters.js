import {marketTime} from './simulation-engine.js';
import {characterFrame,characterLayout,thoughtFor,ThoughtDirector,visualHash} from './simulation-character-state.js';

const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:d}).format(n);
const outfits=['#6a95bc','#d69a76','#7ca697','#9a8fbd','#bd9980','#a7ad72','#8798a9','#be8c99'];
const hairs=['#534742','#756357','#3e454c','#8d7761'];
const moods={calm:'차분',happy:'들뜸',worried:'불안',alert:'긴장',focused:'집중'};

export function characterSVG(seed,id){
  const h=visualHash(seed,id,'portrait'),coat=outfits[h%outfits.length],hair=hairs[(h>>>5)%hairs.length];
  const glasses=h%3===0?'<g class="actor-glasses" fill="none" stroke="#655f5a" stroke-width="1.5"><rect x="31" y="35" width="16" height="12" rx="5"/><rect x="56" y="35" width="16" height="12" rx="5"/><path d="M47 39h9"/></g>':'';
  return `<svg class="sim-character-avatar" viewBox="0 0 104 120" aria-hidden="true" focusable="false" style="--coat:${coat};--hair:${hair}"><ellipse class="actor-shadow" cx="52" cy="112" rx="25" ry="5" fill="#dfe4e7"/><g class="actor-body"><path d="M38 94v14M65 94v14" stroke="#536375" stroke-width="10" stroke-linecap="round"/><path d="M31 109h13M61 109h13" stroke="#464d56" stroke-width="6" stroke-linecap="round"/><path d="M35 64Q52 57 69 64l6 32q-23 9-46 0z" fill="${coat}"/><path d="M48 64v32" stroke="#fff" stroke-opacity=".2" stroke-width="2"/><g class="actor-arm-left"><path d="M33 69l-9 18" stroke="${coat}" stroke-width="11" stroke-linecap="round"/><circle cx="23" cy="89" r="5.5" fill="#f1d7bc"/></g><g class="actor-arm-right"><path d="M71 69l9 18" stroke="${coat}" stroke-width="11" stroke-linecap="round"/><circle cx="81" cy="89" r="5.5" fill="#f1d7bc"/><rect x="73" y="77" width="13" height="19" rx="3" fill="#62717b"/><rect x="76" y="80" width="7" height="10" rx="1" fill="#dce7e9"/></g><g class="actor-head"><rect x="26" y="14" width="52" height="49" rx="23" fill="#f1d7bc"/><circle cx="25" cy="42" r="5" fill="#f1d7bc"/><circle cx="79" cy="42" r="5" fill="#f1d7bc"/><path d="M26 35q-7-25 23-26q31-2 29 27l-8-10q-18 5-29-5z" fill="${hair}"/><g class="actor-eyes" fill="#4e4945"><ellipse cx="40" cy="41" rx="2.4" ry="3"/><ellipse cx="63" cy="41" rx="2.4" ry="3"/></g><g class="actor-brows" fill="none" stroke="#6d5b4f" stroke-width="2" stroke-linecap="round"><path d="M35 33l10 1M58 34l10-1"/></g><path class="actor-mouth calm" d="M47 52h10" fill="none" stroke="#987667" stroke-width="2" stroke-linecap="round"/><path class="actor-mouth happy" d="M44 50q8 10 16 0" fill="#a47263" stroke="#a47263" stroke-width="1.5"/><path class="actor-mouth worried" d="M45 55q7-8 14 0" fill="none" stroke="#987667" stroke-width="2" stroke-linecap="round"/><ellipse class="actor-mouth alert" cx="52" cy="52" rx="3" ry="4" fill="#a47263"/><path class="actor-mouth focused" d="M46 53l11-2" stroke="#987667" stroke-width="2" stroke-linecap="round"/>${glasses}<path class="actor-sweat" d="M82 28q-8 10 0 10q7 0 0-10" fill="#9cbfd8"/></g></g></svg>`;
}

export class MarketCharacters{
  constructor(root,{state,getContext,onDisplayChange}){
    Object.assign(this,{root,state,getContext,onDisplayChange});
    this.director=new ThoughtDirector();this.abort=new AbortController();this.peopleNodes=new Map();this.timer=null;this.frame=null;this.disposed=false;this.elapsedAt=0;
    this.bar=document.createElement('div');this.bar.className='sim-display-controls';
    this.bar.innerHTML='<div class="sim-display-switch" role="group" aria-label="시장 보기 방식"><button type="button" data-market-display="chart">차트</button><button type="button" data-market-display="characters">캐릭터</button></div><span class="sim-character-hint">캐릭터를 눌러 생각과 상태 보기</span><button class="sim-thought-toggle" type="button" aria-pressed="true">말풍선 켜짐</button>';
    this.scene=document.createElement('section');this.scene.className='sim-character-view';this.scene.setAttribute('aria-label','시장 참여자 캐릭터');
    this.scene.innerHTML='<div class="sim-character-market"><p class="sim-character-headline"></p><span class="sim-character-flow"></span></div><div class="sim-character-floor" role="group" aria-label="참여자들"></div><div class="sim-character-navigation"><label><span class="sr-only">참여자 찾기</span><select class="sim-character-find"></select></label><div class="sim-character-pages"><button type="button" data-character-page="-1" aria-label="이전 참여자들">←</button><span></span><button type="button" data-character-page="1" aria-label="다음 참여자들">→</button></div></div>';
    root.querySelector('.sim-quote').after(this.bar,this.scene);
    this.floor=this.scene.querySelector('.sim-character-floor');
    this.dialog=document.createElement('dialog');this.dialog.className='sim-character-dialog';this.dialog.setAttribute('aria-labelledby','simCharacterName');
    this.dialog.innerHTML='<div class="sim-character-dialog-heading"><h2 id="simCharacterName"></h2><button type="button" data-character-close aria-label="참여자 상세 닫기">닫기</button></div><div class="sim-character-person"><div class="sim-character-portrait"></div><div><strong class="sim-character-person-status"></strong><span class="sim-character-person-mood"></span></div></div><p class="sim-character-detail-thought"></p><dl class="sim-character-facts"></dl><p class="sim-character-detail-reason"></p><button type="button" class="sim-character-edit">이 참여자 설정</button><small>말풍선은 현재 상태를 풀어 쓴 표현입니다.</small>';
    root.append(this.dialog);const options={signal:this.abort.signal};
    this.bar.addEventListener('click',event=>{
      const mode=event.target.closest('[data-market-display]');
      if(mode){this.state.mode=mode.dataset.marketDisplay;this.paint();onDisplayChange();}
      if(event.target.closest('.sim-thought-toggle')){state.thoughts=!state.thoughts;this.paint();}
    },options);
    this.scene.addEventListener('click',event=>{
      const page=event.target.closest('[data-character-page]');if(page){state.page+=Number(page.dataset.characterPage);this.paint();return;}
      const person=event.target.closest('[data-character-id]');if(person)this.openPerson(person.dataset.characterId);
    },options);
    this.scene.querySelector('select').addEventListener('change',event=>{
      const index=this.frame.people.findIndex(p=>p.id===event.target.value);if(index<0)return;
      state.page=Math.floor(index/this.layout.size);this.paint();this.openPerson(this.frame.people[index].id);
    },options);
    this.dialog.addEventListener('click',event=>{if(event.target===this.dialog||event.target.closest('[data-character-close]')||event.target.closest('[data-edit-participant]'))this.dialog.close();},options);
    this.dialog.addEventListener('close',()=>{this.selectedId=null;},options);
    // Direct trading remains reachable from the character view. Its existing
    // toggle listener runs first; ensure it opens the order panel on the chart.
    root.querySelector('.sim-manual-toggle').addEventListener('click',()=>{
      if(state.mode!=='characters')return;
      state.mode='chart';this.paint();onDisplayChange(true);
    },options);
    this.resize=new ResizeObserver(()=>this.paint());this.resize.observe(this.floor);
  }
  paint(){
    if(this.disposed)return;
    const context=this.getContext(),isCharacters=this.state.mode==='characters',visible=context.visible&&isCharacters;
    this.root.querySelector('.sim-terminal').dataset.display=this.state.mode;
    this.scene.hidden=!isCharacters;this.scene.dataset.running=String(context.running&&visible);
    this.bar.querySelectorAll('[data-market-display]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.marketDisplay===this.state.mode)));
    this.bar.querySelector('.sim-character-hint').hidden=!isCharacters;
    const toggle=this.bar.querySelector('.sim-thought-toggle');toggle.hidden=!isCharacters;toggle.textContent=this.state.thoughts?'말풍선 켜짐':'말풍선 꺼짐';toggle.setAttribute('aria-pressed',String(this.state.thoughts));
    if(!visible){this.stopTimer();return;}
    if(this.market!==context.market){this.market=context.market;this.director.reset();this.signature='';this.state.page=0;if(this.dialog.open)this.dialog.close();}
    const priorTick=this.frame?.context.tick;
    this.frame=characterFrame(context.exchange,context.market);
    const phase=this.frame.context.closed?'closed':this.frame.context.halted?'halted':this.frame.context.auction?'auction':!this.frame.context.tick?'ready':'normal';
    if(this.phase!==phase||(!context.running&&priorTick!==this.frame.context.tick)){this.director.visible.clear();this.director.nextAt=this.director.time;this.phase=phase;}
    this.scene.dataset.phase=phase;
    this.scene.querySelector('.sim-character-headline').textContent=this.frame.headline;
    this.scene.querySelector('.sim-character-flow').textContent=`이번 틱 · 순매수 ${this.frame.buys}명 · 순매도 ${this.frame.sells}명`;
    this.layout=characterLayout(this.floor.clientWidth,this.floor.clientHeight,this.frame.people.length);
    this.state.page=Math.max(0,Math.min(this.state.page,Math.ceil(this.frame.people.length/this.layout.size)-1));
    const start=this.state.page*this.layout.size;this.visiblePeople=this.frame.people.slice(start,start+this.layout.size);
    this.floor.style.setProperty('--character-columns',Math.min(this.layout.columns,this.visiblePeople.length));
    this.floor.style.setProperty('--character-rows',Math.ceil(this.visiblePeople.length/this.layout.columns));
    this.floor.classList.toggle('is-compact',this.floor.clientHeight<175);
    const signature=this.visiblePeople.map(p=>p.id).join(':');
    if(signature!==this.signature){
      this.signature=signature;this.peopleNodes.clear();
      this.floor.innerHTML=this.visiblePeople.map(p=>`<div class="sim-character-place" data-person="${p.id}" style="--sway-delay:-${visualHash(p.id)%40/10}s"><div class="sim-character-bubble" hidden><span></span><time></time></div><button type="button" class="sim-character-person-button" data-character-id="${p.id}">${characterSVG(this.frame.seed,p.id)}<span class="sim-character-name">${esc(p.name)}</span><small class="sim-character-action"></small></button></div>`).join('');
      this.floor.querySelectorAll('[data-person]').forEach(node=>this.peopleNodes.set(node.dataset.person,node));
    }
    for(const p of this.visiblePeople){const node=this.peopleNodes.get(p.id);node.dataset.mood=p.mood;node.dataset.direction=p.direction>0?'buy':p.direction<0?'sell':'hold';node.querySelector('button').setAttribute('aria-label',`${p.name}, ${moods[p.mood]}, ${p.status}. 상세 보기`);node.querySelector('.sim-character-name').textContent=p.name;node.querySelector('.sim-character-action').textContent=p.status+(p.filled?` ${fmt(Math.abs(p.filled))}주`:'');}
    const find=this.scene.querySelector('select'),findSignature=this.frame.people.map(p=>p.id+':'+p.name).join('|');
    if(find.dataset.signature!==findSignature){find.dataset.signature=findSignature;find.innerHTML='<option value="">참여자 찾기</option>'+this.frame.people.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');}find.value='';
    this.scene.querySelector('.sim-character-pages span').textContent=`${start+1}–${start+this.visiblePeople.length} / ${this.frame.people.length}명`;
    this.scene.querySelector('[data-character-page="-1"]').disabled=this.state.page===0;
    this.scene.querySelector('[data-character-page="1"]').disabled=start+this.layout.size>=this.frame.people.length;
    this.paintThoughts(0);this.paintPerson();
    if(context.running&&!this.timer){this.elapsedAt=performance.now();this.timer=setInterval(()=>{const now=performance.now();this.paintThoughts((now-this.elapsedAt)/1000);this.elapsedAt=now;},200);}
    else if(!context.running)this.stopTimer();
  }
  paintThoughts(elapsed){
    if(!this.frame)return;
    const context=this.getContext();
    const bubbles=this.director.update(this.visiblePeople,this.frame.seed,elapsed,{running:context.running,limit:this.layout.size<=2?1:2});
    for(const p of this.visiblePeople){const bubble=this.peopleNodes.get(p.id).querySelector('.sim-character-bubble'),item=bubbles.get(p.id);bubble.hidden=!this.state.thoughts||!item;if(item){bubble.querySelector('span').textContent=item.text;bubble.querySelector('time').textContent=marketTime(item.tick);}}
  }
  openPerson(id){this.selectedId=id;this.detailThought=null;this.paintPerson();if(!this.dialog.open)this.dialog.showModal();}
  paintPerson(){
    if(!this.selectedId||!this.frame)return;
    const p=this.frame.people.find(p=>p.id===this.selectedId);if(!p){this.dialog.close();return;}
    const {exchange,market}=this.getContext(),agent=market.agents.find(a=>a.id===p.id),equity=market.equity(agent);
    this.dialog.querySelector('h2').textContent=p.name;
    const portrait=this.dialog.querySelector('.sim-character-portrait'),portraitKey=this.frame.seed+':'+p.id;if(portrait.dataset.id!==portraitKey){portrait.dataset.id=portraitKey;portrait.innerHTML=characterSVG(this.frame.seed,p.id);}portrait.dataset.mood=p.mood;
    this.dialog.querySelector('.sim-character-person-status').textContent=p.status;
    this.dialog.querySelector('.sim-character-person-mood').textContent=`${moods[p.mood]} · 감정 ${fmt(p.emotion)} / 100`;
    if(!this.detailThought||this.detailThought.kind!==p.kind)this.detailThought={kind:p.kind,text:thoughtFor(p.kind,this.frame.seed,p.id,Math.floor(p.tick/6))};
    this.dialog.querySelector('.sim-character-detail-thought').textContent='“'+this.detailThought.text+'”';
    this.dialog.querySelector('.sim-character-facts').innerHTML=[['위험감수',fmt(p.risk)+'%'],['보유 주식',fmt(p.shares)+'주'],['전체 순자산',fmt(equity/10000,1)+'만원'],['전체 수익률',(equity>=agent.initialEquity?'+':'')+fmt((equity/agent.initialEquity-1)*100,2)+'%']].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
    const reason=this.dialog.querySelector('.sim-character-detail-reason');reason.textContent=p.reason;reason.title=p.reason;
    this.dialog.querySelector('.sim-character-edit').dataset.editParticipant=exchange.accounts.findIndex(a=>a.id===p.id);
  }
  stopTimer(){if(this.timer){clearInterval(this.timer);this.timer=null;}}
  destroy(){this.disposed=true;this.stopTimer();this.abort.abort();this.resize.disconnect();if(this.dialog.open)this.dialog.close();this.dialog.remove();this.bar.remove();this.scene.remove();}
}
