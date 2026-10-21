import {marketTime,MAX_LIVE_ISSUES} from './simulation-engine.js';

const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const presets={earnings:{label:'실적 상향',title:'실적 전망 상향',actualImpact:8},contract:{label:'대규모 계약',title:'대규모 공급 계약',actualImpact:12},production:{label:'생산 차질',title:'생산시설 가동 중단',actualImpact:-8},capital:{label:'자금조달 부담',title:'추가 자금조달 계획',actualImpact:-10}};
const fields={content:[{key:'title',label:'이슈 제목',type:'text'},{key:'actualImpact',label:'가치 변화',unit:'%',min:-30,max:30},{key:'durationMinutes',label:'발표 후 관심 기간',unit:'분',min:1,max:120}],information:[{key:'announceDelayMinutes',label:'발표 대기',unit:'분',min:0,max:60},{key:'insiderMode',label:'발표 전 내부정보',type:'choice'},{key:'insiderLeadMinutes',label:'내부정보 전달',unit:'발표 전 분',min:0,max:60},{key:'insiderRatio',label:'자동 배정 인지 비율',unit:'%',min:0,max:100}]};
const accessLabels={auto:'이슈 비율로 배정',insider:'사전 인지자',public:'공개 정보만'};
const informationLabels={unknown:'아직 모름',rumor:'공개 기대만 인지',insider:'실제 내용 사전 인지',announced:'공개 발표 인지',expired:'관심 기간 종료'};

export class IssuePanel {
  constructor(root,{state,getContext,advance,onNotice,onLayout,onOpen,onSelected}){
    this.root=root;this.state=state;this.getContext=getContext;this.advance=advance;this.onNotice=onNotice;this.onLayout=onLayout;this.onOpen=onOpen;this.onSelected=onSelected;
    this.abort=new AbortController();const options={signal:this.abort.signal};
    this.report=root.querySelector('#simNewsReport');this.toolbar=this.report.querySelector('.sim-news-report-toolbar');this.detail=root.querySelector('#simNewsDetail');
    this.navigation=document.createElement('div');this.navigation.className='sim-issue-views';this.navigation.setAttribute('role','group');this.navigation.setAttribute('aria-label','기업 이슈 화면');
    this.navigation.innerHTML=[['report','현황'],['manual','이슈 발동'],['information','인지 현황']].map(([key,label])=>`<button type="button" data-issue-view="${key}">${label}</button>`).join('');this.report.prepend(this.navigation);
    this.openButton=document.createElement('button');this.openButton.type='button';this.openButton.id='simIssueOpen';this.openButton.textContent='기업 이슈';
    root.querySelector('.sim-chart-toolbar>span').replaceWith(this.openButton);
    this.publish=document.createElement('button');this.publish.type='button';this.publish.className='sim-issue-publish';this.publish.textContent='지금 발표';this.toolbar.append(this.publish);
    this.element=document.createElement('div');this.element.className='sim-issue-workspace';
    this.element.innerHTML='<form id="simIssueForm"><div class="sim-issue-sections" role="group" aria-label="발동할 이슈 설정"><button type="button" data-issue-section="content">내용</button><button type="button" data-issue-section="information">발표·인지</button></div><div id="simIssueEditor"></div><p id="simIssueHint" class="sim-issue-hint"></p><button class="button primary" type="submit" id="simTriggerIssue">이슈 발동</button><p id="simIssueError" class="sim-issue-error" role="alert"></p></form><div id="simIssueInformation" hidden><p id="simIssueInformationSummary" class="sim-issue-hint"></p><div id="simIssuePeople"></div><div id="simIssuePeoplePager" class="sim-page-controls"></div><p class="sim-issue-hint">관찰자용 정보입니다. 알고 있어도 소식 무시·미추첨·지연·거래 중단이면 주문하지 않을 수 있습니다.</p></div>';
    this.report.append(this.element);this.$=selector=>this.element.querySelector(selector);
    this.openButton.addEventListener('click',()=>{state.view='manual';onOpen();this.paint();onLayout();},options);
    this.navigation.addEventListener('click',event=>{const button=event.target.closest('[data-issue-view]');if(button){state.view=button.dataset.issueView;this.paint();onLayout();}},options);
    this.element.addEventListener('click',event=>{
      const section=event.target.closest('[data-issue-section]');if(section){state.section=section.dataset.issueSection;this.renderEditor();this.paint();onLayout();return;}
      const page=event.target.closest('[data-issue-people-page]');if(page){state.participantPage+=Number(page.dataset.issuePeoplePage);this.paint();}
    },options);
    this.element.addEventListener('input',event=>{
      const input=event.target,key=input.dataset.issueField;if(!key)return;
      this.draft()[key]=input.value;this.$('#simIssueError').textContent='';
      if(key==='announceDelayMinutes'){
        const draft=this.draft(),lead=this.$('[data-issue-field="insiderLeadMinutes"]');
        if(Number(draft.insiderLeadMinutes)>Number(input.value))draft.insiderLeadMinutes=String(Math.max(0,Number(input.value)||0));
        if(lead){lead.value=draft.insiderLeadMinutes;lead.max=String(Number(input.value)||0);}
      }
    },options);
    this.element.addEventListener('change',event=>{
      if(event.target.id==='simIssuePreset'){Object.assign(this.draft(),presets[event.target.value]);this.draft().preset=event.target.value;this.renderEditor();this.paint();}
      if(event.target.dataset.issueField==='insiderMode'){this.draft().insiderMode=event.target.value;this.paint();}
    },options);
    this.$('#simIssueForm').addEventListener('submit',event=>{
      event.preventDefault();const context=getContext();if(context.dirty)return;
      try{
        const issue=context.exchange.triggerCompanyIssue(context.market.assetId,this.draft());
        state.view='report';state.participantPage=0;onSelected(issue.id);if(!context.running)advance();this.paint();
        onNotice(`${context.market.config.company} · ${issue.title} · ${issue.announceTick===issue.createdTick?'즉시 발표':marketTime(issue.announceTick)+' 발표 예정'}. 현재 실험을 이어갑니다.`);
      }catch(error){this.$('#simIssueError').textContent=error.message;}
    },options);
    this.publish.addEventListener('click',()=>{
      const context=getContext();if(context.dirty)return;
      try{const event=context.exchange.announceCompanyIssue(context.market.assetId,context.eventId);state.view='report';onSelected(event.id);if(!context.running)advance();this.paint();onNotice(`${event.title} · 지금 공개했습니다. 개인별 반응 지연과 확률을 적용합니다.`);}
      catch(error){onNotice(error.message);}
    },options);
  }
  draft(){
    const id=this.getContext().market.assetId;
    return this.state.drafts[id] ||= {preset:'earnings',...presets.earnings,durationMinutes:10,announceDelayMinutes:3,insiderMode:'none',insiderLeadMinutes:2,insiderRatio:20};
  }
  renderEditor(){
    const draft=this.draft(),section=this.state.section;
    this.renderKey=this.getContext().market.assetId+':'+section;
    const preset=section==='content'?`<label class="sim-issue-preset"><span class="sr-only">기업 이슈 예시</span><select id="simIssuePreset">${Object.entries(presets).map(([key,item])=>`<option value="${key}" ${draft.preset===key?'selected':''}>${item.label}</option>`).join('')}</select></label>`:'';
    this.$('#simIssueEditor').innerHTML=preset+`<div class="sim-issue-fields">${fields[section].map(field=>`<label class="sim-field ${field.key==='title'?'sim-issue-title-field':''}" for="sim-issue-${field.key}"><span>${field.label}${field.unit?`<small>${field.unit}</small>`:''}</span>${field.type==='choice'?`<select id="sim-issue-${field.key}" data-issue-field="${field.key}"><option value="none" ${draft[field.key]==='none'?'selected':''}>아무도 모름</option><option value="enabled" ${draft[field.key]==='enabled'?'selected':''}>일부 참여자 인지</option></select>`:`<input id="sim-issue-${field.key}" data-issue-field="${field.key}" type="${field.type || 'number'}" ${field.type==='text'?'maxlength="40"':`min="${field.min}" max="${field.key==='insiderLeadMinutes'?draft.announceDelayMinutes:field.max}" step="1"`} value="${esc(draft[field.key])}" required>`}</label>`).join('')}</div>`;
    this.$('#simIssueHint').textContent=section==='content'?'양수는 호재, 음수는 악재입니다. 기존 실험에 추가하며 주가는 실제 주문 체결로 바뀝니다.':'발표 대기 0분은 즉시 공개합니다. 개인별 인지 설정을 우선하고, 자동 배정 인원 중 비율만큼 선택합니다. 내부정보에도 개인별 지연을 적용합니다.';
  }
  paint(){
    const {market,dirty,eventId}=this.getContext(),state=this.state;
    if(this.renderKey!==market.assetId+':'+state.section)this.renderEditor();
    for(const button of this.navigation.querySelectorAll('[data-issue-view]'))button.setAttribute('aria-pressed',String(button.dataset.issueView===state.view));
    const manual=state.view==='manual',information=state.view==='information';
    this.toolbar.hidden=manual;this.detail.hidden=manual || information;this.element.hidden=!manual && !information;
    this.$('#simIssueForm').hidden=!manual;this.$('#simIssueInformation').hidden=!information;
    this.report.dataset.issueView=state.view;
    for(const button of this.element.querySelectorAll('[data-issue-section]'))button.setAttribute('aria-pressed',String(button.dataset.issueSection===state.section));
    const draft=this.draft();
    for(const input of this.element.querySelectorAll('#simIssueForm input,#simIssueForm select'))input.disabled=dirty || (['insiderLeadMinutes','insiderRatio'].includes(input.dataset.issueField) && draft.insiderMode==='none');
    const total=market.newsEvents.filter(event=>event.source==='manual').length;
    this.$('#simTriggerIssue').disabled=dirty || total>=MAX_LIVE_ISSUES;
    this.$('#simTriggerIssue').textContent=total>=MAX_LIVE_ISSUES?'이슈 발동 한도 도달':'이슈 발동';
    const event=market.publicNews().find(item=>item.id===eventId);
    this.publish.hidden=!event || market.tick>=event.announceTick;this.publish.disabled=dirty;
    if(!information)return;
    const people=market.informationReport(eventId),size=2;
    state.participantPage=Math.max(0,Math.min(state.participantPage,Math.ceil(people.length/size)-1));
    const informed=people.filter(person=>['insider','announced'].includes(person.receivedPhase || person.phase)).length;
    this.$('#simIssueInformationSummary').textContent=event?`사전 인지 대상 ${event.insiderCount}명 · 현재 실제 내용 인지 ${informed} / ${people.length}명`:'기업 이슈를 등록하거나 선택하세요.';
    this.$('#simIssuePeople').innerHTML=people.slice(state.participantPage*size,state.participantPage*size+size).map(person=>{
      const reaction=market.last.decisions.find(decision=>decision.agentId===person.id),response=reaction?.news?.find(item=>item.eventId===eventId);
      const action=response?(response.accepted?reaction.label:'추첨 미반응'):person.phase==='unknown'?'정보 수신 전':person.phase==='expired'?'관심 종료':reaction?.label || '아직 판단 전';
      const label=person.phase==='expired' && person.receivedPhase?informationLabels[person.receivedPhase]+' · 관심 종료':informationLabels[person.phase];
      return `<div><strong>${esc(person.name)}<small>${accessLabels[person.access]}${person.insider?' · 사전 인지 대상':''}</small></strong><span>${label}<small>${person.receivedTick!==null?marketTime(person.receivedTick)+' 수신 · ':''}${esc(action)}</small></span></div>`;
    }).join('');
    this.$('#simIssuePeoplePager').innerHTML=`<button type="button" class="sim-subtle-button" data-issue-people-page="-1" ${state.participantPage<=0?'disabled':''} aria-label="인지 현황 이전 페이지">← 이전</button><span>${people.length?state.participantPage*size+1:0}~${Math.min((state.participantPage+1)*size,people.length)} / ${people.length}명</span><button type="button" class="sim-subtle-button" data-issue-people-page="1" ${state.participantPage>=Math.ceil(people.length/size)-1?'disabled':''} aria-label="인지 현황 다음 페이지">다음 →</button>`;
  }
  destroy(){this.abort.abort();this.openButton.remove();this.navigation.remove();this.publish.remove();this.element.remove();}
}
