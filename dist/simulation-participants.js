import {PARTICIPANT_ATTRIBUTES,MAX_PARTICIPANTS,distributionGroups} from './simulation-engine.js';
import {defaultRosterPlan,normalizeRosterPlan,generateRoster,rosterCounts,rosterGroupCounts} from './simulation-roster.js';
import {participantHelp} from './simulation-help.js';

const esc=value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const copy=value=>JSON.parse(JSON.stringify(value));
const sections={all:{label:'전체 속성'},assets:{label:'재산·위험',keys:['wealth','risk','allocation','maxLeverage']},rise:{label:'상승 대응',keys:['onRise','riseProbability']},fall:{label:'하락 대응',keys:['onFall','fallProbability']},news:{label:'기업 소식',keys:['newsStyle','newsProbability','newsSensitivity','newsDelay','newsAccess']},volume:{label:'거래량',keys:['volumeStyle','volumeProbability','volumeSensitivity','volumeThreshold']},emotion:{label:'감정',keys:['emotionStyle','emotionInitial','emotionSensitivity','emotionRecovery','emotionProbability','panicThreshold','greedThreshold']}};

export class ParticipantSheet {
  constructor(host,pager,{getDraft,onChange,onLayout,onHelp}){
    Object.assign(this,{host,pager,getDraft,onChange,onLayout,onHelp,rowPage:0,rowSize:6,columnPage:0,columnSize:5,allocationPage:0,allocationSize:4,attributeKey:'risk',section:'all',allocationOpen:true});
    host.setAttribute('data-participant-sheet','');pager.setAttribute('data-participant-sheet','');
    this.abort=new AbortController();const options={signal:this.abort.signal};
    host.addEventListener('input',event=>this.input(event),options);
    host.addEventListener('change',event=>this.change(event),options);
    host.addEventListener('focusout',event=>{
      const input=event.target;
      if(input.hasAttribute('data-roster-cell') && input.value==='')input.value=this.rows[Number(input.dataset.rosterIndex)]?.[input.dataset.rosterCell] ?? '';
    },options);
    host.addEventListener('click',event=>this.click(event),options);
    pager.addEventListener('click',event=>this.click(event),options);
    host.addEventListener('keydown',event=>this.keydown(event),options);
    this.tooltip=document.createElement('div');this.tooltip.id='simParticipantHelp';this.tooltip.className='sim-attribute-tooltip';this.tooltip.setAttribute('role','tooltip');this.tooltip.hidden=true;document.body.append(this.tooltip);
    host.addEventListener('pointerover',event=>{const button=event.target.closest('[data-attribute-help]');if(button && !this.helpPinned && event.pointerType!=='touch')this.showHelp(button);},options);
    host.addEventListener('pointerout',event=>{if(this.helpAnchor?.contains(event.target) && !this.helpAnchor.contains(event.relatedTarget) && !this.helpPinned && document.activeElement!==this.helpAnchor)this.closeHelp();},options);
    host.addEventListener('focusin',event=>{const button=event.target.closest('[data-attribute-help]');if(button)this.showHelp(button);},options);
    host.addEventListener('focusout',event=>{if(this.helpAnchor===event.target && !this.helpPinned)this.closeHelp();},options);
    document.addEventListener('pointerdown',event=>{if(this.helpAnchor && !this.helpAnchor.contains(event.target) && !this.tooltip.contains(event.target))this.closeHelp();},options);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')this.closeHelp();},options);
    window.addEventListener('resize',()=>this.closeHelp(),options);
  }
  showHelp(button){
    if(this.helpAnchor!==button){this.closeHelp();this.helpAnchor=button;}
    const help=participantHelp(button.dataset.attributeHelp);
    this.tooltip.innerHTML=`<strong>${esc(help.label)}</strong><div>${esc(help.facts)}</div><p>${esc(help.summary)}</p><p>${esc(help.detail)}</p>`;
    this.tooltip.hidden=false;button.setAttribute('aria-describedby',this.tooltip.id);
    const anchor=button.getBoundingClientRect(),box=this.tooltip.getBoundingClientRect();
    const left=Math.max(12,Math.min(innerWidth-box.width-12,anchor.left+(anchor.width-box.width)/2));
    const preferred=anchor.bottom+box.height+20<=innerHeight?anchor.bottom+8:anchor.top-box.height-8;
    this.tooltip.style.left=`${left}px`;this.tooltip.style.top=`${Math.max(12,Math.min(innerHeight-box.height-12,preferred))}px`;
  }
  closeHelp(){
    this.helpAnchor?.removeAttribute('aria-describedby');this.helpAnchor=null;this.helpPinned=false;this.tooltip.hidden=true;
  }
  get rows(){return this.getDraft().participants;}
  get attribute(){return PARTICIPANT_ATTRIBUTES.find(attribute=>attribute.key===this.attributeKey);}
  get attributes(){return PARTICIPANT_ATTRIBUTES.filter(attribute=>!sections[this.section].keys || sections[this.section].keys.includes(attribute.key));}
  publish(rows=this.rows){this.onChange({participants:rows,participantPlan:copy(this.plan)});}
  refresh(){
    this.plan=copy(this.getDraft().participantPlan || defaultRosterPlan(this.rows.length));
    this.error='';this.render();
  }
  render(){
    this.closeHelp();
    this.host.innerHTML=`<div class="sim-sheet-toolbar"><label for="simRosterCount">전체 <input id="simRosterCount" type="number" min="2" max="${MAX_PARTICIPANTS}" step="1" value="${esc(this.plan.count)}" required aria-label="전체 참여자 수"> 명</label><button type="button" class="sim-sheet-generate" data-roster-generate>표 생성</button><button type="button" data-roster-toggle aria-expanded="${this.allocationOpen}">인원 배정 ${this.allocationOpen?'접기':'설정'}</button></div><div class="sim-sheet-allocation" ${this.allocationOpen?'':'hidden'}><div class="sim-sheet-allocation-heading"><label><span class="sr-only">인원을 배정할 속성</span><select id="simRosterAttribute">${PARTICIPANT_ATTRIBUTES.map(attribute=>`<option value="${attribute.key}" ${attribute.key===this.attributeKey?'selected':''}>${attribute.label}</option>`).join('')}</select></label><button type="button" data-roster-guide aria-label="선택한 속성의 자세한 안내">속성 안내</button><div class="sim-sheet-allocation-pager"></div></div><div class="sim-sheet-groups"></div></div><div class="sim-sheet-columnbar"><label><span class="sr-only">표의 속성 묶음</span><select id="simRosterSection">${Object.entries(sections).map(([key,section])=>`<option value="${key}" ${this.section===key?'selected':''}>${section.label}</option>`).join('')}</select></label><span class="sim-sheet-column-label"></span><div class="sim-sheet-column-pager"></div></div><div class="sim-sheet-table-wrap"><table class="sim-sheet-table"><caption class="sr-only">참여자 속성 편집표. 한 행은 실제 참여자 한 명입니다.</caption><colgroup></colgroup><thead></thead><tbody></tbody></table></div><p class="sim-sheet-feedback" role="status"></p>`;
    this.renderAllocation();this.renderRows();this.onLayout();
  }
  pageButtons(kind,page,total,label){
    return `<button type="button" data-roster-${kind}="-1" aria-label="이전 ${label}" ${page<=0?'disabled':''}>‹</button><span>${page+1}/${Math.max(1,total)}</span><button type="button" data-roster-${kind}="1" aria-label="다음 ${label}" ${page>=total-1?'disabled':''}>›</button>`;
  }
  renderAllocation(){
    const groups=distributionGroups(this.attribute),pages=Math.ceil(groups.length/this.allocationSize);
    this.allocationPage=Math.min(this.allocationPage,pages-1);
    this.host.querySelector('.sim-sheet-allocation-pager').innerHTML=this.pageButtons('allocation-page',this.allocationPage,pages,'배정 항목');
    this.host.querySelector('.sim-sheet-groups').innerHTML=groups.slice(this.allocationPage*this.allocationSize,(this.allocationPage+1)*this.allocationSize).map(group=>`<label title="${esc(group.note || group.label)}"><span>${esc(group.label)}</span><div><input type="number" min="0" max="${esc(this.plan.count)}" step="1" placeholder="자동" value="${esc(this.plan.allocations[this.attributeKey]?.[group.key])}" data-roster-group="${group.key}" aria-label="${esc(this.attribute.label)} ${esc(group.label)} 배정 인원"><small>명</small><output data-roster-actual="${group.key}"></output></div></label>`).join('');
    this.host.querySelector('.sim-sheet-groups').style.setProperty('--sheet-groups',Math.min(this.allocationSize,groups.length));
    this.feedback();
  }
  renderRows(){
    this.closeHelp();
    const attributes=this.attributes,columnPages=Math.ceil(attributes.length/this.columnSize),rowPages=Math.ceil(this.rows.length/this.rowSize);
    this.columnPage=Math.max(0,Math.min(this.columnPage,columnPages-1));this.rowPage=Math.max(0,Math.min(this.rowPage,rowPages-1));
    const columns=attributes.slice(this.columnPage*this.columnSize,(this.columnPage+1)*this.columnSize);
    this.host.querySelector('colgroup').innerHTML='<col class="sim-sheet-number-col"><col class="sim-sheet-name-col">'+columns.map(()=>'<col>').join('')+'<col class="sim-sheet-reset-col">';
    this.host.querySelector('thead').innerHTML=`<tr><th scope="col">#</th><th scope="col">이름</th>${columns.map(attribute=>`<th scope="col"><button type="button" class="sim-sheet-heading-help" data-attribute-help="${attribute.key}" aria-label="${esc(attribute.label)} 설명"><span>${esc(attribute.label)}</span>${attribute.unit?`<small>${esc(attribute.unit)}</small>`:''}<i aria-hidden="true">?</i></button></th>`).join('')}<th scope="col"><span class="sr-only">행 자동 설정</span></th></tr>`;
    const start=this.rowPage*this.rowSize;
    this.host.querySelector('tbody').innerHTML=this.rows.slice(start,start+this.rowSize).map((row,offset)=>{
      const index=start+offset;
      return `<tr data-roster-row="${index}"><th scope="row">${index+1}</th><td>${this.cell(index,'name',row.name)}</td>${columns.map(attribute=>`<td>${this.cell(index,attribute.key,row[attribute.key] ?? attribute.default,attribute)}</td>`).join('')}<td><button type="button" data-roster-reset="${index}" title="이 행의 모든 속성을 자동으로 설정" aria-label="${index+1}번 참여자 자동 설정">↺</button></td></tr>`;
    }).join('');
    this.host.querySelector('.sim-sheet-column-pager').innerHTML=this.pageButtons('column-page',this.columnPage,columnPages,'속성 열');
    this.host.querySelector('.sim-sheet-column-label').textContent=`속성 ${this.columnPage*this.columnSize+1}–${Math.min((this.columnPage+1)*this.columnSize,attributes.length)} / ${attributes.length}`;
    this.pager.innerHTML=`<span>${start+1}–${Math.min(start+this.rowSize,this.rows.length)} / ${this.rows.length}명</span><div>${this.pageButtons('row-page',this.rowPage,rowPages,'참여자 행')}</div><small>직접 수정한 셀은 파란색</small>`;
    this.feedback();
  }
  cell(index,key,value,attribute){
    const edited=Object.hasOwn(this.plan.overrides[index] || {},key),label=`${index+1}번 참여자 ${attribute?.label || '이름'}`;
    const common=`data-roster-cell="${key}" data-roster-index="${index}" aria-label="${esc(label)}" class="${edited?'is-edited':''}" title="${edited?'직접 수정 · 비우면 자동 설정':'자동 설정 · 직접 수정 가능'}"`;
    if(attribute?.type==='choice' || attribute?.type==='reaction'){
      return `<select ${common}><option value="">자동</option>${distributionGroups(attribute).map(group=>`<option value="${group.value}" ${value===group.value?'selected':''}>${esc(group.label)}</option>`).join('')}</select>`;
    }
    return `<input ${common} type="${key==='name'?'text':'number'}" value="${esc(value)}" ${key==='name'?'maxlength="24"':`min="${attribute.min}" max="${attribute.max}" step="any"`} placeholder="자동" autocomplete="off">`;
  }
  feedback(){
    const actual=rosterGroupCounts(this.rows,this.attribute);let planned,error=this.error;
    try{
      const count=Number(this.plan.count);
      if(!Number.isInteger(count) || count<2 || count>MAX_PARTICIPANTS)throw new Error(`전체 참여자는 2~${MAX_PARTICIPANTS}명으로 설정하세요.`);
      planned=rosterCounts(this.plan.allocations[this.attributeKey],this.attribute,count);
    }catch(issue){error=issue.message;}
    for(const output of this.host.querySelectorAll('[data-roster-actual]')){
      const key=output.dataset.rosterActual;
      output.textContent=`현재 ${actual.counts[key]}${planned?` · 배정 ${planned[key]}`:''}`;
    }
    const target=this.host.querySelector('.sim-sheet-feedback');
    target.classList.toggle('is-error',Boolean(error));
    target.textContent=error || (this.plan.pending?'‘표 생성’을 누르면 입력한 인원으로 채웁니다. 직접 수정값은 유지됩니다.':`빈 셀은 자동으로 채웁니다. 인원 재배정 시 직접 수정값을 우선합니다.${actual.custom?` 별도 값 ${actual.custom}명.`:''}`);
  }
  automaticRows(){
    try{return generateRoster({...this.plan,overrides:{}},this.getDraft().seed);}
    catch{return generateRoster(defaultRosterPlan(this.rows.length),this.getDraft().seed);}
  }
  input(event){
    const input=event.target;
    if(input.id==='simRosterCount' || input.hasAttribute('data-roster-group')){
      if(input.id==='simRosterCount'){
        this.plan.count=input.value;
        this.host.querySelectorAll('[data-roster-group]').forEach(field=>{field.max=input.value;});
      }
      else (this.plan.allocations[this.attributeKey] ||= {})[input.dataset.rosterGroup]=input.value===''?null:input.value;
      this.plan.pending=true;this.error='';this.publish();this.feedback();return;
    }
    if(!input.hasAttribute('data-roster-cell'))return;
    const index=Number(input.dataset.rosterIndex),key=input.dataset.rosterCell,rows=copy(this.rows);
    this.plan.overrides[index] ||= {};
    if(input.value===''){
      delete this.plan.overrides[index][key];
      rows[index][key]=this.automaticRows()[index]?.[key] ?? PARTICIPANT_ATTRIBUTES.find(attribute=>attribute.key===key)?.default ?? `참여자 ${index+1}`;
    }else{
      this.plan.overrides[index][key]=input.value;
      rows[index][key]=input.type==='number'?Number(input.value):input.value;
    }
    input.classList.toggle('is-edited',input.value!=='');input.title=input.value!==''?'직접 수정 · 비우면 자동 설정':'자동 설정 · 직접 수정 가능';this.error='';this.publish(rows);this.feedback();
  }
  change(event){
    const input=event.target;
    if(input.id==='simRosterAttribute'){this.attributeKey=input.value;this.allocationPage=0;this.error='';this.renderAllocation();this.onLayout();}
    else if(input.id==='simRosterSection'){this.section=input.value;this.columnPage=0;this.renderRows();this.onLayout();}
    else if(input.hasAttribute('data-roster-cell')){
      if(input.matches('select'))this.input(event);
      if(input.value==='')input.value=this.rows[Number(input.dataset.rosterIndex)][input.dataset.rosterCell];
    }
  }
  click(event){
    const target=event.target.closest('button');if(!target)return;
    if(target.hasAttribute('data-attribute-help')){if(this.helpAnchor===target && this.helpPinned)this.closeHelp();else{this.showHelp(target);this.helpPinned=true;}return;}
    if(target.hasAttribute('data-roster-guide')){this.closeHelp();this.onHelp?.(this.attributeKey);return;}
    if(target.hasAttribute('data-roster-toggle')){this.allocationOpen=!this.allocationOpen;this.render();return;}
    if(target.hasAttribute('data-roster-generate')){
      try{const patch=this.prepare(true);this.plan=patch.participantPlan;this.publish(patch.participants);this.error='';this.render();}
      catch(error){this.error=error.message;this.feedback();}
      return;
    }
    for(const [key,property,render] of [['rosterRowPage','rowPage','renderRows'],['rosterColumnPage','columnPage','renderRows'],['rosterAllocationPage','allocationPage','renderAllocation']]){
      if(target.dataset[key]){this[property]+=Number(target.dataset[key]);this[render]();return;}
    }
    if(target.hasAttribute('data-roster-reset')){
      const index=Number(target.dataset.rosterReset),rows=copy(this.rows);
      delete this.plan.overrides[index];rows[index]=this.automaticRows()[index] || rows[index];
      this.error='';this.publish(rows);this.renderRows();
    }
  }
  prepare(regenerate=false){
    const participantPlan=normalizeRosterPlan(this.plan);
    const participants=regenerate || this.plan.pending?generateRoster(participantPlan,this.getDraft().seed):copy(this.rows);
    return {participantPlan,participants};
  }
  add(){
    if(this.rows.length>=MAX_PARTICIPANTS)return;
    try{
      if(this.plan.pending){const patch=this.prepare();this.plan=patch.participantPlan;this.publish(patch.participants);}
      if(this.rows.length>=MAX_PARTICIPANTS){this.render();return;}
      this.plan.count=this.rows.length+1;
      for(const attribute of PARTICIPANT_ATTRIBUTES){
        const groups=distributionGroups(attribute),values=this.plan.allocations[attribute.key];
        if(groups.every(group=>values[group.key]!=null && values[group.key]!==''))values[groups[0].key]=Number(values[groups[0].key])+1;
      }
      const generated=this.automaticRows(),rows=[...copy(this.rows),generated[this.rows.length]];
      this.publish(rows);this.rowPage=Math.floor((rows.length-1)/this.rowSize);this.render();
    }catch(error){this.error=error.message;this.feedback();}
  }
  fit(){
    if(!this.host.getClientRects().length){this.closeHelp();return;}
    const width=this.host.clientWidth,table=this.host.querySelector('.sim-sheet-table-wrap');
    const columnSize=Math.max(1,Math.floor((width-(width<500?140:190))/120));
    const allocationSize=width<500?2:Math.min(4,Math.floor(width/160));
    const rowSize=Math.max(1,Math.floor((table.clientHeight-35)/32));
    const firstRow=this.rowPage*this.rowSize,firstColumn=this.columnPage*this.columnSize;
    let rowsChanged=false;
    if(columnSize!==this.columnSize){this.columnSize=columnSize;this.columnPage=Math.floor(firstColumn/columnSize);rowsChanged=true;}
    if(rowSize!==this.rowSize){this.rowSize=rowSize;this.rowPage=Math.floor(firstRow/rowSize);rowsChanged=true;}
    if(allocationSize!==this.allocationSize){this.allocationSize=allocationSize;this.allocationPage=0;this.renderAllocation();}
    if(rowsChanged)this.renderRows();
  }
  reveal(index,key,section='all'){
    this.section=section;this.rowPage=Math.floor(index/this.rowSize);this.columnPage=Math.floor(Math.max(0,this.attributes.findIndex(attribute=>attribute.key===key))/this.columnSize);
    this.render();this.host.querySelector(`[data-roster-index="${index}"][data-roster-cell="${key}"]`)?.focus();
  }
  keydown(event){
    const input=event.target;if(event.key!=='Enter' || !input.hasAttribute('data-roster-cell'))return;
    event.preventDefault();
    const index=Number(input.dataset.rosterIndex)+(event.shiftKey?-1:1);
    if(index<0 || index>=this.rows.length)return;
    const key=input.dataset.rosterCell;
    this.rowPage=Math.floor(index/this.rowSize);this.renderRows();
    this.host.querySelector(`[data-roster-index="${index}"][data-roster-cell="${key}"]`)?.focus();
  }
  destroy(){this.abort.abort();this.tooltip.remove();}
}
