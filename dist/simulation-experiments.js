import {MODEL_FIELDS,normalizeModel} from './simulation-liquidity.js';
import {SecuritiesSimulation} from './simulation-exchange.js';
import {MACRO_PRESETS} from './simulation-engine.js';
const SAVE_KEY='fieldbook-market-experiment-v2';
const download=(name,text,type)=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
export function mountExperiments(root,{getExchange,replaceExchange,pause,notice,onChange,isDirty}){
  const button=document.createElement('button');button.type='button';button.id='simExperimentOpen';button.className='sim-subtle-button';button.textContent='실험실';root.querySelector('.sim-play-controls').append(button);
  const dialog=document.createElement('dialog');dialog.className='sim-experiment-dialog';dialog.id='simExperimentDialog';dialog.setAttribute('aria-labelledby','simExperimentTitle');
  dialog.innerHTML=`<div class="sim-experiment-heading"><h2 id="simExperimentTitle">시장 실험실</h2><button type="button" id="simExperimentClose" aria-label="실험실 닫기">닫기</button></div>
    <p>작은 주문은 두꺼운 호가에서 흡수됩니다. 유동성을 줄이면 같은 주문의 가격 충격이 커집니다. 배경 공급자도 유한한 현금·재고로 거래합니다.</p>
    <form id="simModelForm"><div class="sim-model-grid">${MODEL_FIELDS.map(f=>`<label>${f.label}<small>${f.unit}</small><input type="number" data-model="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" required></label>`).join('')}<label>배경 시장<select id="simBackgroundLiquidity"><option value="true">유동성 공급·배경 투자자 사용</option><option value="false">선택한 참여자만 거래</option></select></label></div><button class="button secondary" type="submit">모형 적용 · 새 실험 시작</button></form>
    <section><h3>현재 실험</h3><p id="simExperimentStats"></p><div class="sim-experiment-actions"><button type="button" id="simNextDay">다음 거래일</button><button type="button" id="simExperimentSave">브라우저에 저장</button><button type="button" id="simExperimentRestore">저장본 불러오기</button><button type="button" id="simExperimentExport">실험 JSON 내보내기</button><button type="button" id="simExperimentImport">실험 JSON 불러오기</button><button type="button" id="simTradeExport">전체 체결 CSV</button><input id="simExperimentFile" type="file" accept=".json,application/json" hidden></div></section>
    <section><h3>거시경제 변화 예약</h3><form id="simMacroEventForm"><div class="sim-model-grid"><label>발표할 시나리오<select id="simMacroEventPreset">${Object.entries(MACRO_PRESETS).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}</select></label><label>지금부터 대기 시간<small>거래 시간 · 분</small><input type="number" id="simMacroEventDelay" value="0" min="0" max="390" step="1" required></label></div><button type="submit">현재 실험에 예약</button></form></section>
    <p class="sim-model-note">09:00–15:30 · 10초 단위 · 가격제한 ±30% · VI 2분 단일가. 사이드카는 선물 대신 모형 지수를 사용합니다. 수수료·이율은 실험 가정이며 세금·배당·기업행동은 미포함입니다. 실측 시세에 적합한 예측 모형으로 검증된 것은 아닙니다.</p><p id="simExperimentNotice" role="status"></p>`;
  root.append(dialog);const $=id=>dialog.querySelector('#'+id);
  const status=text=>{$('simExperimentNotice').textContent=text;notice(text);};
  function refresh(){const e=getExchange();for(const f of MODEL_FIELDS)dialog.querySelector(`[data-model="${f.key}"]`).value=e.config.marketModel[f.key];$('simBackgroundLiquidity').value=String(e.config.marketModel.backgroundLiquidity);$('simNextDay').disabled=!e.sessionClosed;$('simExperimentStats').textContent=`${e.day+1}거래일 · ${e.sessionClosed?'장 마감':'장중'} · ${e.stepCount.toLocaleString()}틱 · 전체 체결 ${e.markets.reduce((s,m)=>s+m.totalTrades,0).toLocaleString()}건 · 수수료·이자 ${Math.round(e.markets.reduce((s,m)=>s+m.treasury,0)+e.interestTreasury).toLocaleString()}원 · 거시 예약 ${e.macroEvents.filter(v=>!v.applied).length}건`;}
  const attempt=fn=>{try{if(isDirty())throw new Error('편집 중인 설정을 먼저 적용하거나 취소하세요.');fn();refresh();}catch(error){status(error.message);}};
  button.addEventListener('click',()=>{pause();refresh();dialog.showModal();});$('simExperimentClose').addEventListener('click',()=>dialog.close());
  $('simModelForm').addEventListener('submit',event=>{event.preventDefault();attempt(()=>{const values=Object.fromEntries(MODEL_FIELDS.map(f=>[f.key,dialog.querySelector(`[data-model="${f.key}"]`).value]));values.backgroundLiquidity=$('simBackgroundLiquidity').value==='true';replaceExchange(new SecuritiesSimulation({...getExchange().initialConfig,marketModel:normalizeModel(values)}));status('변경한 시장 모형으로 새 실험을 시작했습니다.');});});
  $('simNextDay').addEventListener('click',()=>attempt(()=>{getExchange().nextSession();onChange();status('보유 자산을 유지하고 다음 거래일을 시작했습니다.');}));
  $('simExperimentSave').addEventListener('click',()=>attempt(()=>{localStorage.setItem(SAVE_KEY,JSON.stringify(getExchange().exportExperiment()));status('현재까지의 설정·주문·발표·진행 시점을 저장했습니다.');}));
  const restore=value=>{replaceExchange(SecuritiesSimulation.fromExperiment(value));status('저장한 조작을 재생해 같은 계좌·호가·가격으로 복원했습니다.');};
  $('simExperimentRestore').addEventListener('click',()=>attempt(()=>{const value=localStorage.getItem(SAVE_KEY);if(!value)throw new Error('저장한 실험이 없습니다.');restore(JSON.parse(value));}));
  $('simExperimentExport').addEventListener('click',()=>attempt(()=>download('market-experiment.json',JSON.stringify(getExchange().exportExperiment(),null,2),'application/json')));
  $('simTradeExport').addEventListener('click',()=>attempt(()=>download('market-trades.csv',getExchange().tradeCSV(),'text/csv;charset=utf-8')));
  $('simExperimentImport').addEventListener('click',()=>$('simExperimentFile').click());
  $('simExperimentFile').addEventListener('change',async()=>{const file=$('simExperimentFile').files[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('실험 JSON은 5MB 이하로 불러오세요.');const value=JSON.parse(await file.text());attempt(()=>restore(value));}catch(error){status(error.message);}finally{$('simExperimentFile').value='';}});
  $('simMacroEventForm').addEventListener('submit',event=>{event.preventDefault();attempt(()=>{const e=getExchange();e.scheduleMacro({...e.market().config.macro,...MACRO_PRESETS[$('simMacroEventPreset').value].values},Number($('simMacroEventDelay').value));status('초기화 없이 거시경제 변화가 예약되었습니다.');});});
  return ()=>{dialog.remove();button.remove();};
}
