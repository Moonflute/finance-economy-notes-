import {mountExperiments} from './simulation-experiments.js';
import {PARTICIPANT_ATTRIBUTES, REACTIONS, marketTime, TICKS_PER_CANDLE, MAX_PARTICIPANTS, defaultPopulation, distributionGroups, allocatePopulation, COMPANY_FINANCIAL_FIELDS, DEFAULT_FINANCIALS, calculateCompanyMetrics, MACRO_FIELDS, DEFAULT_MACRO, MACRO_BASELINE, MACRO_PRESETS, COMPANY_CYCLE_TYPES, COMPANY_EXPOSURE_FIELDS, DEFAULT_COMPANY_PROFILE, COMPANY_NEWS_FIELDS, DEFAULT_COMPANY_NEWS, MAX_COMPANY_NEWS} from './simulation-engine.js';
import {SecuritiesSimulation,DEFAULT_EXCHANGE_CONFIG as DEFAULT_CONFIG,normalizeExchangeConfig as normalizeConfig} from './simulation-exchange.js';
import {TradingPanel} from './simulation-trading.js';
import {SimulationChart} from './simulation-chart.js';
import {DEFAULT_MARKET_CONTROLS,MARKET_CONTROL_SECTIONS} from './simulation-controls.js';
import {IssuePanel} from './simulation-issues.js';
import {ParticipantSheet} from './simulation-participants.js';
import {rosterPlanFromPopulation} from './simulation-roster.js';
import {HELP_SECTIONS,helpTopic} from './simulation-help.js';
import {generatePopulation,emotionBand} from './simulation-engine.js';

const STORAGE_KEY = 'fieldbook-simulation-config-v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, digits = 0) => new Intl.NumberFormat('ko-KR', {maximumFractionDigits:digits}).format(n);
const signed = (n, digits = 2) => `${n > 0 ? '+' : ''}${fmt(n,digits)}`;
const clone = value => JSON.parse(JSON.stringify(value));
const colors = ['#a5aeba','#718096','#3182f6','#64748b','#8c97a6','#bdc5cf'];
const financialSections = {income:'실적',balance:'재무상태',valuation:'투자지표',cycle:'경기 영향'};
const companySections = {...financialSections,news:'기업 소식'};
const newsPhaseLabels = {scheduled:'발표 대기',insider:'일부 사전 인지',rumor:'사전 기대 공개',announced:'발표됨',expired:'관심 기간 종료'};
const financialMetricFields = {
  income:[['revenue','매출액','amount'],['operatingProfit','영업이익','amount'],['netIncome','순이익','amount'],['operatingMargin','영업이익률','percent'],['netMargin','순이익률','percent']],
  balance:[['assets','자산총계','amount'],['liabilities','부채총계','amount'],['equity','자본총계','amount'],['debtRatio','부채비율','percent'],['equityRatio','자기자본비율','percent']],
  valuation:[['marketCap','시가총액','amount'],['per','PER','multiple'],['pbr','PBR','multiple'],['eps','EPS · 주당순이익','price'],['bps','BPS · 주당순자산','price'],['roe','ROE · 기말 자본 기준','percent']],
  cycle:[['estimatedRevenue','추정 매출액','amount'],['estimatedOperatingProfit','추정 영업이익','amount'],['estimatedNetIncome','추정 순이익','amount'],['revenueChange','매출 변화','percent'],['netIncomeDelta','순이익 변화','amount'],['valuationChange','판단 기준 변화','percent']]
};
let session;

function ensureSession() {
  if (session) return;
  let config = normalizeConfig(clone(DEFAULT_CONFIG));
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored) config = normalizeConfig(stored);
  } catch {}
  session = {exchange:new SecuritiesSimulation(config),securityId:'primary',draft:{...clone(config),population:clone(config.population || defaultPopulation())}, dirty:false, speed:1, distributionAttribute:'risk', distributionPage:0, distributionPageSize:3, view:'chart', settingsSection:config.population?.enabled ? 'population' : 'individual', resultPage:0, resultPageSize:4, tradePage:0, tradePageSize:5, rulePage:0, financialView:'income', financeSection:'income', newsPage:0,newsEditPage:0,newsEditSection:'timing',trading:{show:false,view:'order',action:'buy',type:'market',quantity:'100',limits:{},positionPage:0,reactionPage:0}};
  Object.defineProperty(session,'market',{get:()=>session.exchange.market(session.securityId)});
}

function draftCompany(){return session.securityId==='primary'?session.draft:session.draft.additionalCompanies.find(company=>company.id===session.securityId);}

function controlEditorMarkup(){
  const key=session.controlEditSection || 'sidecar',section=MARKET_CONTROL_SECTIONS[key],values=session.draft.marketControls || DEFAULT_MARKET_CONTROLS;
  return `<label class="sim-control-section"><span class="sr-only">시장 안정 설정 항목</span><select id="simControlSection">${Object.entries(MARKET_CONTROL_SECTIONS).map(([id,item])=>`<option value="${id}" ${id===key?'selected':''}>${item.label}</option>`).join('')}</select></label><div class="sim-control-fields">${section.fields.map(field=>{
    const value=field.path.split('.').reduce((object,part)=>object?.[part],values),id='sim-control-'+field.path.replaceAll('.','-');
    return `<label class="sim-field" for="${id}"><span>${field.label}${field.unit?`<small>${field.unit}</small>`:''}</span>${field.type==='enabled'?`<select id="${id}" data-market-control="${field.path}"><option value="true" ${String(value)==='true'?'selected':''}>사용</option><option value="false" ${String(value)==='false'?'selected':''}>사용 안 함</option></select>`:`<input id="${id}" type="number" data-market-control="${field.path}" min="${field.min}" max="${field.max}" step="${field.step}" value="${esc(value)}" required>`}</label>`;
  }).join('')}</div><p class="sim-finance-hint">${section.note}</p>`;
}

function newsEditorMarkup() {
  const events=draftCompany().companyNews || [];
  session.newsEditPage=Math.max(0,Math.min(session.newsEditPage,events.length-1));
  const event=events[session.newsEditPage];
  const toolbar=`<div class="sim-news-editor-toolbar">${event?`<label><span class="sr-only">편집할 기업 소식</span><select id="simNewsEditSelect">${events.map((item,i)=>`<option value="${i}" ${i===session.newsEditPage?'selected':''}>${i+1}. ${esc(item.title)}</option>`).join('')}</select></label>`:'<span>등록된 기업 소식 없음</span>'}<button type="button" class="sim-subtle-button" data-add-news ${events.length>=MAX_COMPANY_NEWS?'disabled':''}>+ 소식 추가</button>${event?'<button type="button" class="sim-subtle-button" data-remove-news>삭제</button>':''}</div>`;
  if(!event)return `${toolbar}<div class="sim-news-empty"><p>발표 일정과 호재·악재를 설정할 수 있습니다.</p><button type="button" class="button secondary" data-news-examples>예시 소식 3개 불러오기</button></div>`;
  const fields=COMPANY_NEWS_FIELDS.filter(field=>field.group===session.newsEditSection);
  return `${toolbar}<div class="sim-finance-config-tabs" role="group" aria-label="기업 소식 설정 항목">${[['timing','일정'],['content','내용'],['information','사전 인지']].map(([key,label])=>`<button type="button" data-news-edit-section="${key}" aria-pressed="${session.newsEditSection===key}">${label}</button>`).join('')}</div><div class="sim-news-fields">${session.newsEditSection==='content'?`<label class="sim-field sim-news-title-field" for="sim-news-title"><span>소식 제목</span><input id="sim-news-title" data-news-field="title" value="${esc(event.title)}" maxlength="40" required></label>`:''}${fields.map(field=>`<label class="sim-field" for="sim-news-${field.key}"><span>${field.label}${field.unit?`<small>${field.unit}</small>`:''}</span>${field.type==='choice'?`<select id="sim-news-${field.key}" data-news-field="${field.key}">${field.options.map(option=>`<option value="${option.key}" ${(event[field.key] ?? field.default)===option.key?'selected':''}>${option.label}</option>`).join('')}</select>`:`<input id="sim-news-${field.key}" data-news-field="${field.key}" type="number" min="${field.min}" max="${['leadMinutes','insiderLeadMinutes'].includes(field.key)?Math.min(field.max,Number(event.announceMinute)||field.max):field.max}" step="${field.step}" value="${esc(event[field.key] ?? field.default)}" required>`}</label>`).join('')}</div><p class="sim-finance-hint">${{timing:'사전 기대 0분은 소문 없이 발표합니다. 발표 후에는 관심 기간 동안 영향이 줄어듭니다.',content:'양수는 호재, 음수는 악재입니다. 수치는 참여자가 해석하는 가치 변화율이며 주가를 강제로 바꾸지 않습니다.',information:'개인의 ‘사전 인지자 / 공개 정보만’을 우선하고, 나머지는 비율로 배정합니다. 내부정보에도 개인별 반응 지연·확률을 적용합니다. ‘아무도 모름’은 사전 인지를 끕니다.'}[session.newsEditSection]}</p>`;
}

function financialEditorMarkup() {
  const values={...DEFAULT_FINANCIALS,...draftCompany().financials};
  const hint={income:'연간 실적을 억원 단위로 입력합니다. 손실은 음수로 입력할 수 있습니다.',balance:'자본총계는 자산총계에서 부채총계를 뺀 값으로 계산합니다.',valuation:'현재 재무 참조 주가의 반영 비중입니다. 거시경제 영향은 별도 반영합니다. 실제 주가는 주문 체결로 결정됩니다.',cycle:'유형을 선택하면 기본 민감도를 적용합니다. 수치는 모형의 가정이며 각각 수정할 수 있습니다.'}[session.financeSection];
  const profile={...DEFAULT_COMPANY_PROFILE,...draftCompany().companyProfile};
  const controls=session.financeSection==='cycle'
    ? `<label class="sim-field" for="sim-company-cyclicality"><span>기업 유형</span><select id="sim-company-cyclicality" data-company-field="cyclicality">${Object.entries(COMPANY_CYCLE_TYPES).map(([key,type])=>`<option value="${key}" ${profile.cyclicality===key?'selected':''}>${type.label}</option>`).join('')}</select></label>${COMPANY_EXPOSURE_FIELDS.map(field=>`<label class="sim-field" for="sim-company-${field.key}"><span>${field.label}<small>${field.unit}</small></span><input id="sim-company-${field.key}" data-company-field="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${esc(profile[field.key])}" required></label>`).join('')}`
    : COMPANY_FINANCIAL_FIELDS.filter(field=>field.group===session.financeSection).map(field=>`<label class="sim-field" for="sim-financial-${field.key}"><span>${field.label}<small>${field.unit}</small></span><input id="sim-financial-${field.key}" data-financial-field="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${esc(values[field.key])}" required></label>`).join('');
  return `<div class="sim-finance-config-tabs" role="group" aria-label="회사 재무 설정 항목">${Object.entries(financialSections).map(([key,label])=>`<button type="button" data-finance-section="${key}" aria-pressed="${session.financeSection===key}">${key==='valuation'?'판단 기준':key==='cycle'?'기업 유형':label}</button>`).join('')}</div><div class="sim-finance-fields">${controls}</div><p class="sim-finance-hint">${hint}</p>`;
}

function macroConfigMarkup() {
  const values={...DEFAULT_MACRO,...session.draft.macro};
  return `<div class="sim-macro-presets" role="group" aria-label="거시경제 시나리오">${Object.entries(MACRO_PRESETS).map(([key,preset])=>`<button type="button" data-macro-preset="${key}" aria-pressed="${Object.entries(preset.values).every(([field,value])=>Number(values[field])===value)}">${preset.label}</button>`).join('')}</div><div class="sim-macro-fields">${MACRO_FIELDS.map(field=>`<label class="sim-field" for="sim-macro-${field.key}"><span>${field.label}<small>${field.unit}</small></span><input id="sim-macro-${field.key}" data-macro-field="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${esc(values[field.key])}" required></label>`).join('')}</div><p class="sim-finance-hint">초기 연간 시나리오입니다. 실험실에서 실행 중 변화를 예약할 수 있습니다. 중립 기준은 GDP ${MACRO_BASELINE.gdpGrowth}%, 물가 ${MACRO_BASELINE.inflation}%, 금리 ${MACRO_BASELINE.policyRate}%입니다. 반영도 0%는 경기 영향을 제외합니다.</p>`;
}

function financialMetricText(key,value,unit,metrics) {
  if(value===null){
    if(['marketCap','per','pbr','eps','bps'].includes(key) && metrics.shares<=0)return '주식 없음';
    if(key==='per')return metrics.netIncome<0?'적자':'순이익 0';
    if(['pbr','roe','debtRatio'].includes(key))return metrics.equity<0?'자본잠식':'자본 0';
    if(['operatingMargin','netMargin'].includes(key))return '매출 0';
    return '—';
  }
  return fmt(unit==='amount'?value/100000000:value,2)+{amount:'억원',price:'원',multiple:'배',percent:'%'}[unit];
}

function distributionRows() {
  const attribute = PARTICIPANT_ATTRIBUTES.find(a => a.key === session.distributionAttribute);
  const start = session.distributionPage * session.distributionPageSize;
  return distributionGroups(attribute).slice(start,start+session.distributionPageSize).map((group,offset) => {
    const index = start+offset;
    const value = session.draft.population.distributions[attribute.key]?.[group.key] ?? 0, id = `sim-ratio-${attribute.key}-${group.key}`;
    return `<div class="sim-distribution-row" style="--participant:${colors[index % colors.length]}"><label for="${id}"><strong>${esc(group.label)}</strong>${group.note ? `<small>${esc(group.note)}</small>` : ''}</label><input type="range" min="0" max="100" step="1" value="${esc(value)}" data-population-range="${group.key}" aria-label="${esc(group.label)} 비율 슬라이더"><div class="sim-percent-input"><input id="${id}" type="number" min="0" max="100" step="1" value="${esc(value)}" data-population-number="${group.key}" required aria-label="${esc(group.label)} 비율"><span>%</span></div><output data-population-headcount="${group.key}"></output></div>`;
  }).join('');
}

function populationMarkup() {
  const ordered = ['risk','wealth','onRise','onFall','allocation','maxLeverage'];
  const attributes = [...PARTICIPANT_ATTRIBUTES].sort((a,b) => (ordered.indexOf(a.key)<0 ? 99 : ordered.indexOf(a.key))-(ordered.indexOf(b.key)<0 ? 99 : ordered.indexOf(b.key)));
  return `<fieldset id="simPopulationPanel" class="sim-population-panel"><div class="sim-population-heading"><div><h3>속성별 참여자 비율</h3><p>각 속성의 합계를 100%로 맞추세요. 비율은 참여 인원 기준입니다.</p></div><label for="simPopulationCount">전체 참여자<input id="simPopulationCount" type="number" min="2" max="${MAX_PARTICIPANTS}" step="1" value="${esc(session.draft.population.count)}" required><span>명</span></label></div><div class="sim-distribution-tabs" role="group" aria-label="비율을 설정할 속성">${attributes.map(a => `<button type="button" data-distribution-tab="${a.key}" aria-pressed="${session.distributionAttribute === a.key}">${a.label}<span data-distribution-check="${a.key}"></span></button>`).join('')}</div><div class="sim-distribution-preview" id="simDistributionPreview" aria-label="설정한 비율"></div><div id="simDistributionEditor">${distributionRows()}</div><div class="sim-distribution-footer"><span id="simDistributionTotal"></span><button type="button" class="sim-subtle-button" id="simNormalizeDistribution">합계 100%로 맞추기</button></div><p id="simPopulationRounding" class="sim-population-hint"></p><p class="sim-population-hint">각 속성은 독립적으로 배분해 조합합니다. 재산과 위험감수 성향 등이 같은 순서로 묶이지 않도록 섞습니다. 설정을 적용하면 참여자가 생성되며, 이후 ‘참여자별 설정’에서 수정할 수 있습니다.</p></fieldset>`;
}

export function simulationMarkup() {
  ensureSession();
  return `<section id="simulationRoot" class="sim-root" aria-label="증권시장 시뮬레이션">
    <header class="sim-heading"><div><h1>증권시장 시뮬레이션</h1></div><span class="sim-mode-badge">가상 시장 · 기업 1개</span></header>
    <div class="sim-controlbar"><div class="sim-play-controls"><button class="button primary" type="button" id="simPlay">▶ 시뮬레이션 시작</button><button class="button secondary" type="button" id="simStep">1분 진행</button><button class="sim-subtle-button" type="button" id="simReset" title="적용된 설정과 같은 난수값으로 다시 시작">초기화</button></div><div class="sim-speed"><label for="simSpeed">재생 속도</label><select id="simSpeed">${[0.5,1,4,8].map(n => `<option value="${n}" ${session.speed === n ? 'selected' : ''}>${n}×</option>`).join('')}</select><span id="simRunStatus" class="sim-run-status">시작 전</span></div></div>
    <div id="simNotice" class="sim-notice" role="status">참여자 설정 후 시작하세요. 현재 설정으로 바로 실행할 수도 있습니다.</div>
    <div id="simViewTabs" class="sim-view-tabs" role="tablist" aria-label="시뮬레이션 화면">${[['chart','차트'],['macro','거시경제'],['company','기업 정보'],['participants','참여자'],['activity','체결·분석'],['settings','시장 설정'],['rules','속성·규칙']].map(([key,label]) => `<button type="button" role="tab" id="simView-${key}" data-sim-tab="${key}" aria-controls="simPanel-${key}" aria-selected="${session.view === key}" tabindex="${session.view === key ? 0 : -1}">${label}</button>`).join('')}</div>
    <div class="sim-terminal">
      <div class="sim-quote"><div class="sim-company"><span class="sim-ticker">F</span><div><h2 id="simCompany"></h2><span>FLD · 가상 종목</span></div></div><div class="sim-quote-price"><strong id="simPrice"></strong><span id="simChange"></span></div><div class="sim-clock"><span>시뮬레이션 시간</span><strong id="simClock">09:00:00</strong><small>1틱 = 가상 10초</small></div></div>
      <div class="sim-terminal-body"><div id="simChart" class="sim-chart"><div class="sim-chart-toolbar"><div class="sim-periods" role="group" aria-label="캔들 주기"><button type="button" data-chart="period" data-period="1" aria-pressed="true">1분</button><button type="button" data-chart="period" data-period="5" aria-pressed="false">5분</button></div><span>캔들 · 거래량</span><div class="sim-chart-actions"><button type="button" data-chart="out" aria-label="차트 축소">−</button><button type="button" data-chart="in" aria-label="차트 확대">+</button><button type="button" data-chart="latest">최근으로 →</button></div></div><div class="sim-ohlc" data-chart-ohlc></div><canvas role="img" tabindex="0" aria-describedby="simChartHelp"></canvas><p id="simChartHelp" class="sim-chart-help">휠로 확대 · 드래그로 이동 · 방향키 이동 / + − 확대 · <span>상승 <i class="sim-up-dot"></i> 하락 <i class="sim-down-dot"></i></span></p></div><aside class="sim-orderbook" aria-label="잔여 호가"><div class="sim-panel-title"><h3>호가</h3><span>가격·시간 우선</span></div><div class="sim-book-labels"><span>가격 (원)</span><span>수량 (주)</span></div><div id="simAsks" class="sim-book-side"></div><div class="sim-book-mid" id="simBookPrice"></div><div id="simBids" class="sim-book-side"></div><div class="sim-book-summary" id="simBookSummary"></div><p>미체결 지정가는 취소·만료까지 유지됩니다.</p></aside></div>
      <div class="sim-metrics"><div><span>시작가 대비</span><strong id="simReturn">0.00%</strong></div><div><span>체결 거래량</span><strong id="simVolume">0주</strong></div><div><span>최대 낙폭</span><strong id="simDrawdown">0.00%</strong></div><div><span>고가 / 저가</span><strong id="simHighLow"></strong></div></div>
    </div>
    <section class="sim-financial-panel"><div class="sim-section-heading"><div><h2 id="simFinancialCompany"></h2><span class="sim-financial-period">연간 실적 · 가상 입력값</span></div><button type="button" class="sim-subtle-button" data-open-financial-settings>재무정보 수정</button></div><div class="sim-financial-tabs" role="group" aria-label="기업 정보 항목">${Object.entries(companySections).map(([key,label])=>`<button type="button" data-financial-view="${key}" aria-pressed="${session.financialView===key}">${label}</button>`).join('')}</div><div id="simCompanyMetrics" class="sim-financial-grid"></div><div class="sim-financial-basis"><div><span>모형 주식 수</span><strong id="simFinancialShares"></strong></div><div><span>재무 참조 주가</span><strong id="simFinancialReference"></strong></div><div><span>재무정보 반영도</span><strong id="simFinancialInfluence"></strong></div></div><p class="sim-financial-note" id="simFinancialNote"></p><div id="simNewsReport" class="sim-news-report" hidden><div class="sim-news-report-toolbar"><label for="simNewsSelect"><span class="sr-only">확인할 기업 소식</span><select id="simNewsSelect"></select></label><time id="simNewsClock"></time></div><div id="simNewsDetail"></div></div></section>
    <section class="sim-results"><div class="sim-section-heading"><div><h2>참여자 현황</h2></div><span id="simResultCount"></span></div><div id="simComposition" class="sim-composition"></div><div class="sim-results-scroll" tabindex="0" role="region" aria-label="참여자별 자산과 매매 결과 표"><table class="sim-results-table"><caption class="sr-only">참여자별 순자산, 수익률, 주식 보유량, 현금, 차입금과 최근 행동</caption><thead><tr><th scope="col">참여자</th><th scope="col">순자산 <small>만원</small></th><th scope="col">수익률</th><th scope="col">보유 <small>주</small></th><th scope="col">현금 / 차입 <small>만원</small></th><th scope="col">최근 행동</th></tr></thead><tbody id="simResults"></tbody></table></div></section>
    <div class="sim-bottom-grid"><section class="sim-trade-panel"><div class="sim-panel-title"><h2>최근 체결</h2><span id="simTradeCount">0건</span></div><div id="simTrades" class="sim-trades"></div></section><section class="sim-reading-panel"><h2>시장 요약</h2><p id="simExplanation"></p><div class="sim-order-pressure"><span>매수 주문 <b id="simBuyQuantity">0주</b></span><span>매도 주문 <b id="simSellQuantity">0주</b></span><div><i id="simPressureBar"></i></div></div><small>주문량에는 미체결 주문도 포함됩니다. 실제 거래량은 매수·매도 체결 수량을 한 번씩 셉니다.</small></section></div>
    <section class="sim-macro-panel"><div class="sim-section-heading"><div><h2>거시경제</h2><span class="sim-financial-period" id="simMacroPhase"></span></div><div class="sim-macro-actions"><button type="button" class="sim-subtle-button" data-open-macro-settings>지표 설정</button><button type="button" class="sim-subtle-button" data-open-company-profile>기업 유형</button></div></div><div id="simMacroMetrics" class="sim-financial-grid"></div><div class="sim-financial-basis"><div><span>추정 매출액</span><strong id="simMacroRevenue"></strong></div><div><span>추정 순이익</span><strong id="simMacroIncome"></strong></div><div><span>조정 참조 PER</span><strong id="simMacroPER"></strong></div></div><p class="sim-financial-note">현재 회사의 민감도를 적용한 연간 추정값입니다. 실제 주가는 참여자의 주문 체결로 결정됩니다.</p></section>
    <form id="simConfig" class="sim-config-panel">
      <div class="sim-section-heading"><div><h2>시장 설정</h2></div><button class="sim-subtle-button" type="button" id="simDefaults">기본 구성 불러오기</button></div>
      <p class="sim-config-hint">설정을 바꾼 뒤 적용하면 새 실험을 시작합니다. 같은 설정과 난수값은 같은 결과를 만듭니다.</p>
      <div class="sim-market-fields"><label class="sim-field" for="simCompanyInput"><span>회사 이름</span><input id="simCompanyInput" value="${esc(session.draft.company)}" maxlength="24" required></label><label class="sim-field" for="simInitialPrice"><span>시작 주가 <small>원</small></span><input id="simInitialPrice" type="number" min="100" max="1000000" step="1" value="${esc(session.draft.initialPrice)}" required></label><label class="sim-field" for="simSeed"><span>난수값 <small>동일 실험 재현</small></span><input id="simSeed" type="number" min="1" max="2147483647" step="1" value="${esc(session.draft.seed)}" required></label></div>
      <div class="sim-config-modes" role="group" aria-label="시장 설정 항목"><button type="button" data-settings-base>시장 기본</button><button type="button" data-settings-financials>회사 재무</button><button type="button" data-settings-macro>거시경제</button><button type="button" data-settings-news>기업 소식</button><button type="button" data-settings-stability>시장 안정</button><button type="button" data-config-mode="individual">참여자별 설정</button><button type="button" data-config-mode="population">속성별 비율</button></div>
      <fieldset id="simStabilityConfig" class="sim-financial-config"><legend class="sr-only">시장 안정장치 설정</legend><div id="simControlEditor">${controlEditorMarkup()}</div></fieldset>
      <fieldset id="simFinancialConfig" class="sim-financial-config"><legend class="sr-only">회사 재무정보</legend><div id="simFinancialEditor">${financialEditorMarkup()}</div></fieldset>
      <fieldset id="simMacroConfig" class="sim-financial-config"><legend class="sr-only">거시경제 설정</legend><div id="simMacroEditor">${macroConfigMarkup()}</div></fieldset>
      <fieldset id="simNewsConfig" class="sim-financial-config"><legend class="sr-only">기업 소식 설정</legend><div id="simNewsEditor">${newsEditorMarkup()}</div></fieldset>
      ${populationMarkup()}
      <fieldset id="simIndividualPanel" class="sim-individual-panel"><legend class="sr-only">참여자 속성 편집표</legend><div id="simParticipants" class="sim-participants"></div><div id="simParticipantPager" class="sim-participant-pager"></div></fieldset>
      <div class="sim-config-footer"><button class="button secondary" type="button" id="simAddParticipant">+ 참여자 추가</button><div><span id="simDirtyLabel">현재 설정 적용됨</span><button class="sim-subtle-button" type="button" id="simDiscard" hidden>변경 취소</button><button class="button primary" type="submit">설정 적용 · 새로 시작</button></div></div><p id="simConfigError" class="sim-config-error" role="alert"></p>
    </form>
    <section class="sim-model-notes"></section>
  </section>`;
}

export function mountSimulation(root) {
  const $ = selector => root.querySelector(selector);
  const abort = new AbortController(), options = {signal:abort.signal};
  let timer = null, running = false, disposed = false, layoutFrame = 0, bookDepth = 5,trading=null,issues=null,participantSheet=null;
  session.emotionPage ||= 0;session.emotionPageSize ||= 4;
  const securitySelect=document.createElement('select');securitySelect.id='simSecuritySelect';securitySelect.setAttribute('aria-label','거래·설정할 종목');
  securitySelect.innerHTML=session.exchange.markets.map(market=>`<option value="${market.assetId}" ${market.assetId===session.securityId?'selected':''}>${esc(market.config.company)}</option>`).join('');
  $('.sim-speed').prepend(securitySelect);
  const noticeRow=document.createElement('div');noticeRow.className='sim-notice-row';
  $('#simNotice').before(noticeRow);noticeRow.append($('#simNotice'));
  const controlBadge=document.createElement('button');controlBadge.type='button';controlBadge.id='simControlBadge';controlBadge.className='sim-control-badge';controlBadge.setAttribute('aria-label','시장 안정 상태 보기');noticeRow.append(controlBadge);
  $('.sim-orderbook>p').textContent='미체결 지정가는 취소·만료까지 유지합니다.';
  const playerField=document.createElement('div');playerField.className='sim-field sim-player-funds-field';
  playerField.innerHTML=`<span><label for="simPlayerWealth">내 초기 자금</label><small>만원 · 전 종목 공통</small></span><div class="sim-player-funds-inputs"><select id="simPlayerFundsMode" aria-label="내 자금 설정 방식"><option value="finite">금액 입력</option><option value="unlimited">무제한 ∞</option></select><input id="simPlayerWealth" type="number" min="100" step="any" value="${session.draft.player.wealth}" required></div>`;
  $('.sim-market-fields').append(playerField);
  const notes = $('.sim-model-notes');
  notes.innerHTML = `<h2>속성·작동 안내</h2><div class="sim-guide-selectors"><label for="simGuideSection"><span>분류</span><select id="simGuideSection">${HELP_SECTIONS.map(section=>`<option value="${section.key}">${esc(section.label)}</option>`).join('')}</select></label><label for="simGuideTopic"><span>항목</span><select id="simGuideTopic"></select></label></div><article id="simGuideContent" class="sim-guide-content" aria-live="polite"></article>`;
  const addPager = (parent,id) => {const el=document.createElement('div'); el.id=id; el.className='sim-page-controls'; parent.append(el); return el;};
  addPager($('.sim-results'),'simResultPager');
  addPager($('.sim-trade-panel'),'simTradePager');
  addPager(notes,'simRulePager');
  const distributionPager = document.createElement('div');
  distributionPager.id = 'simDistributionPager'; distributionPager.className = 'sim-page-controls';
  $('#simDistributionEditor').after(distributionPager);
  const distributionSelect = document.createElement('label');
  distributionSelect.className = 'sim-distribution-select';
  distributionSelect.innerHTML = `<span>설정할 속성</span><select id="simDistributionSelect">${PARTICIPANT_ATTRIBUTES.map(a => `<option value="${a.key}">${a.label}</option>`).join('')}</select>`;
  $('.sim-distribution-tabs').after(distributionSelect);
  const extraPopulationHint = $('#simPopulationPanel').querySelector('.sim-population-hint:last-child');
  if (extraPopulationHint !== $('#simPopulationRounding')) extraPopulationHint.remove();
  $('.sim-config-modes').after($('.sim-market-fields'));
  const activityTabs = document.createElement('div'); activityTabs.className='sim-activity-tabs'; activityTabs.setAttribute('role','group'); activityTabs.setAttribute('aria-label','체결과 시장 해석');
  const volumeHint=document.createElement('small');volumeHint.id='simVolumeSignal';$('#simVolume').after(volumeHint);
  const volumeDetail=document.createElement('div');volumeDetail.id='simVolumeDetail';volumeDetail.className='sim-volume-detail';
  $('.sim-reading-panel h2').after(volumeDetail);
  activityTabs.innerHTML='<button type="button" data-activity="trades">체결 내역</button><button type="button" data-activity="analysis">시장 해석</button><button type="button" data-activity="emotion">시장 심리</button><button type="button" data-activity="stability">시장 안정</button>';
  $('.sim-bottom-grid').prepend(activityTabs);
  $('.sim-bottom-grid').dataset.activity='trades';
  const controlPanel=document.createElement('section');controlPanel.className='sim-stability-panel';
  controlPanel.innerHTML='<div class="sim-stability-heading"><h2>시장 안정</h2><button type="button" class="sim-subtle-button" data-open-stability-settings>발동 기준 설정</button></div><div id="simControlMetrics" class="sim-control-metrics"></div><div id="simControlSummary" class="sim-control-summary"></div><div class="sim-control-tests"><button type="button" data-test-control="sidecar">사이드카 시험</button><button type="button" data-test-control="breaker">서킷브레이커 시험</button></div><div class="sim-control-history-heading"><h3>발동·해제 기록</h3><span id="simControlEventCount"></span></div><div id="simControlEvents" class="sim-control-events"></div><div id="simControlEventPager" class="sim-page-controls"></div><p class="sim-control-model-note">전체 종목 등가중 지수 · 조절 가능한 모형입니다. 실제 거래소 규칙과 다릅니다.</p>';
  $('.sim-bottom-grid').append(controlPanel);
  const emotionPanel=document.createElement('section');emotionPanel.className='sim-emotion-panel';
  emotionPanel.innerHTML='<div class="sim-emotion-heading"><h2>시장 심리</h2><span>참여자 평균 · 모형</span></div><div class="sim-emotion-overview"><div class="sim-emotion-score"><strong id="simEmotionScore">50</strong><span id="simEmotionBand">중립</span></div><div class="sim-emotion-gauge"><div role="meter" aria-label="시장 공포·탐욕" aria-valuemin="0" aria-valuemax="100" id="simEmotionMeter"><i id="simEmotionMarker"></i></div><div><span>0 공포</span><span>50 중립</span><span>100 탐욕</span></div></div></div><div id="simEmotionStats" class="sim-emotion-stats"></div><div class="sim-emotion-people-heading"><span>참여자 · 설정</span><span>현재 감정</span><span>최근 행동</span></div><div id="simEmotionPeople" class="sim-emotion-people"></div><div id="simEmotionPager" class="sim-page-controls"></div><p id="simEmotionSummary" class="sim-emotion-note"></p>';
  $('.sim-bottom-grid').append(emotionPanel);
  const emotionBadge=document.createElement('button');emotionBadge.type='button';emotionBadge.id='simEmotionBadge';emotionBadge.setAttribute('aria-label','시장 공포·탐욕 상세 보기');$('#simReturn').after(emotionBadge);
  const panels = {chart:$('.sim-terminal'),macro:$('.sim-macro-panel'),company:$('.sim-financial-panel'),participants:$('.sim-results'),activity:$('.sim-bottom-grid'),settings:$('#simConfig'),rules:notes};
  for (const [key,panel] of Object.entries(panels)) {
    panel.dataset.simView=key;
    if (key !== 'settings') panel.id=`simPanel-${key}`;
    panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby',`simView-${key}`);
    $(`[data-sim-tab="${key}"]`).setAttribute('aria-controls',panel.id);
  }
  const chart = new SimulationChart($('#simChart'), () => session.market);
  const notice = message => {$('#simNotice').textContent = message; $('#simNotice').title=message; scheduleLayout();};
  const pagerMarkup = (action,page,total,size,unit='명') => `<button type="button" class="sim-subtle-button" ${action}="-1" ${page<=0 ? 'disabled' : ''} aria-label="이전 페이지">← 이전</button><span>${total ? page*size+1 : 0}~${Math.min((page+1)*size,total)} / ${total}${unit}</span><button type="button" class="sim-subtle-button" ${action}="1" ${page>=Math.ceil(total/size)-1 ? 'disabled' : ''} aria-label="다음 페이지">다음 →</button>`;
  function showView(key) {
    session.view=key;
    if(key!=='settings')participantSheet?.closeHelp();
    for (const [name,panel] of Object.entries(panels)) panel.hidden=name!==key;
    root.querySelectorAll('[data-sim-tab]').forEach(button => {const active=button.dataset.simTab===key;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    chart.render(); scheduleLayout();
  }
  function showStability(){
    showActivity('stability');
  }
  function showActivity(section){
    $('.sim-bottom-grid').dataset.activity=section;
    activityTabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.activity===section)));
    showView('activity');
  }
  function renderRules() {
    const section=HELP_SECTIONS.find(item=>item.key===session.guideSection) || HELP_SECTIONS[0];
    const entry=section.topics.find(item=>item.key===session.guideTopic) || section.topics[0];
    session.guideSection=section.key;session.guideTopic=entry.key;
    session.rulePage=Math.max(0,Math.min(session.rulePage,entry.pages.length-1));
    $('#simGuideSection').value=section.key;
    $('#simGuideTopic').innerHTML=section.topics.map(item=>`<option value="${item.key}" ${item.key===entry.key?'selected':''}>${esc(item.label)}</option>`).join('');
    $('#simGuideContent').innerHTML=`<h3>${esc(entry.label)}</h3>${entry.facts?`<div class="sim-guide-facts">${esc(entry.facts)}</div>`:''}<p>${esc(entry.pages[session.rulePage])}</p>`;
    $('#simRulePager').innerHTML=`<button type="button" class="sim-subtle-button" data-rule-page="-1" aria-label="이전 설명" ${session.rulePage===0?'disabled':''}>← 이전</button><span>설명 ${session.rulePage+1} / ${entry.pages.length}</span><button type="button" class="sim-subtle-button" data-rule-page="1" aria-label="다음 설명" ${session.rulePage===entry.pages.length-1?'disabled':''}>다음 →</button>`;
    scheduleLayout();
  }
  function openGuide(key) {
    const entry=helpTopic(key);
    if(!entry)return;
    session.guideSection=entry.section.key;session.guideTopic=key;session.rulePage=0;
    renderRules();showView('rules');$('#simGuideTopic').focus();
  }
  notes.addEventListener('change',event=>{
    if(event.target.id==='simGuideSection'){session.guideSection=event.target.value;session.guideTopic=null;}
    else if(event.target.id==='simGuideTopic')session.guideTopic=event.target.value;
    else return;
    session.rulePage=0;renderRules();
  },options);
  function scheduleLayout() {
    if (disposed || layoutFrame) return;
    layoutFrame=requestAnimationFrame(()=>{layoutFrame=0; fitLayout();});
  }
  function fitLayout() {
    if (disposed) return;
    let repaint=false;
    if (session.view==='chart') {
      const book=$('.sim-orderbook');
      if(book.getClientRects().length){
        const style=getComputedStyle(book);
        let fixed=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
        for(const child of book.children){
          if(['simAsks','simBids'].includes(child.id)||!child.getClientRects().length)continue;
          const css=getComputedStyle(child);fixed+=child.getBoundingClientRect().height+parseFloat(css.marginTop)+parseFloat(css.marginBottom);
        }
        const rowHeight=$('.sim-book-row')?.getBoundingClientRect().height||26;
        const depth=Math.max(1,Math.min(5,Math.floor((book.clientHeight-fixed)/(rowHeight*2))));
        if (depth!==bookDepth) {bookDepth=depth;repaint=true;}
      }
    }
    if (session.view==='participants') {
      const table=$('.sim-results-scroll');
      // Reserve room for the full two-line reason. Measuring only the first
      // participant made page size oscillate when the next page had taller rows,
      // sometimes moving the user straight back to the first page.
      const rowHeight=Math.max(110,...[...root.querySelectorAll('#simResults tr')].map(row=>row.getBoundingClientRect().height));
      const header=$('.sim-results-table thead').getBoundingClientRect().height;
      const size=innerWidth<=700 ? 1 : Math.max(1,Math.min(12,Math.floor((table.clientHeight-header)/rowHeight)));
      if (size!==session.resultPageSize) {session.resultPage=Math.floor(session.resultPage*session.resultPageSize/size); session.resultPageSize=size; repaint=true;}
    }
    if (session.view==='activity') {
      const rowHeight=Math.max(46,...[...root.querySelectorAll('.sim-trade')].map(e=>e.getBoundingClientRect().height));
      const size=Math.max(1,Math.min(7,Math.floor($('#simTrades').clientHeight/rowHeight)));
      if (size!==session.tradePageSize) {session.tradePageSize=size;session.tradePage=0;repaint=true;}
      if($('.sim-bottom-grid').dataset.activity==='emotion'){
        const people=$('#simEmotionPeople'),height=Math.max(44,...[...people.children].map(row=>row.getBoundingClientRect().height));
        const count=Math.max(1,Math.min(12,Math.floor(people.clientHeight/height)));
        if(count!==session.emotionPageSize){session.emotionPage=Math.floor(session.emotionPage*session.emotionPageSize/count);session.emotionPageSize=count;repaint=true;}
      }
    }
    if (session.view==='settings') {
      if (session.settingsSection==='individual') {
        participantSheet?.fit();
      } else if (session.settingsSection==='population') {
        const row=$('.sim-distribution-row'), editor=$('#simDistributionEditor');
        const size=Math.max(1,Math.min(7,Math.floor(editor.clientHeight/(row?.getBoundingClientRect().height || 66))));
        if (size!==session.distributionPageSize) {
          session.draft=readDraft(); session.distributionPage=Math.floor(session.distributionPage*session.distributionPageSize/size); session.distributionPageSize=size;
          paintDistribution();
        }
      }
    }
    if (repaint) paint();
  }
  const setControlState = () => {
    $('#simPlay').textContent = running ? '일시정지' : session.market.tick ? '이어서 실행' : '시뮬레이션 시작';
    $('#simPlay').disabled = session.dirty || session.exchange.sessionClosed;
    $('#simStep').disabled = running || session.dirty || session.exchange.sessionClosed;
    $('#simReset').disabled = session.dirty;
    $('#simRunStatus').textContent = session.dirty ? '설정 변경됨' : session.exchange.sessionClosed ? '장 마감 · 실험실 → 다음 거래일' : running ? '실행 중' : session.market.tick ? '일시정지' : '시작 전';
    $('#simRunStatus').classList.toggle('is-running',running);
    $('#simDirtyLabel').textContent = session.dirty ? '변경한 설정을 적용하세요' : '현재 설정 적용됨';
    $('#simDiscard').hidden = !session.dirty;
    const byRatio = Boolean(session.draft.population?.enabled);
    $('#simAddParticipant').disabled = session.draft.participants.length >= MAX_PARTICIPANTS;
    $('#simAddParticipant').hidden = byRatio || session.settingsSection!=='individual';
    $('#simPopulationPanel').hidden = !byRatio || session.settingsSection!=='population';
    $('#simPopulationPanel').disabled = !byRatio;
    $('#simIndividualPanel').hidden = byRatio || session.settingsSection!=='individual';
    $('#simIndividualPanel').disabled = byRatio;
    $('.sim-market-fields').hidden=session.settingsSection!=='base';
    $('#simFinancialConfig').hidden=session.settingsSection!=='financials';
    $('#simMacroConfig').hidden=session.settingsSection!=='macro';
    $('#simNewsConfig').hidden=session.settingsSection!=='news';
    $('#simStabilityConfig').hidden=session.settingsSection!=='stability';
    $('#simConfig').dataset.settingsSection=session.settingsSection;
    if(session.settingsSection!=='individual')participantSheet?.closeHelp();
    $('[data-settings-base]').setAttribute('aria-pressed',String(session.settingsSection==='base'));
    $('[data-settings-financials]').setAttribute('aria-pressed',String(session.settingsSection==='financials'));
    $('[data-settings-macro]').setAttribute('aria-pressed',String(session.settingsSection==='macro'));
    $('[data-settings-news]').setAttribute('aria-pressed',String(session.settingsSection==='news'));
    $('[data-settings-stability]').setAttribute('aria-pressed',String(session.settingsSection==='stability'));
    root.querySelectorAll('[data-config-mode]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.configMode===session.settingsSection)));
    paintControls();trading?.paint();issues?.paint();
  };
  const pause = () => {clearInterval(timer); timer = null; running = false; setControlState();};
  const safeStep = (count = 1) => {
    try {
      const previousNews=session.market.newsLog.at(-1);
      const previousControl=session.exchange.controls.events.at(-1);
      for (let i = 0; i < count; i++) session.exchange.step();
      if(session.exchange.sessionClosed)pause();
      paint();
      setControlState();
      const latest=session.market.newsLog.at(-1);
      const latestControl=session.exchange.controls.events.at(-1);
      if(latestControl && latestControl!==previousControl)notice(`${marketTime(latestControl.tick)} · ${latestControl.label}`);
      else if(latest && latest!==previousNews)notice(`${marketTime(latest.tick)} · ${latest.title} · ${latest.phase==='rumor'?'사전 기대 공개':'발표'} ${signed(latest.impact,0)}%`);
      return true;
    } catch (error) {pause(); notice(`실행을 중단했습니다. ${error.message}`); return false;}
  };
  const start = () => {
    if (disposed || session.dirty || session.exchange.sessionClosed) return;
    running = true;
    timer = setInterval(() => safeStep(), 500 / session.speed);
    setControlState();
    notice('시뮬레이션 실행 중입니다. 체결되는 주문에 따라 캔들과 거래량이 갱신됩니다.');
  };
  const formatMoney = amount => fmt(amount / 10000,1);
  const directionClass = value => value > 0.000001 ? 'sim-positive' : value < -0.000001 ? 'sim-negative' : '';
  function paintFinancials() {
    const market=session.market, metrics=calculateCompanyMetrics(market.config.financials,market.price,market.totalShares);
    const scenario=market.economicScenario, projected=scenario.adjustedMetrics;
    Object.assign(metrics,{estimatedRevenue:projected.revenue,estimatedOperatingProfit:projected.operatingProfit,estimatedNetIncome:projected.netIncome,revenueChange:(scenario.revenueFactor-1)*100,netIncomeDelta:scenario.profitDelta*100000000,valuationChange:(market.valueAnchor/market.baseValueAnchor-1)*100});
    $('#simFinancialCompany').textContent=market.config.company;
    const isNews=session.financialView==='news';
    $('.sim-financial-panel .sim-financial-period').textContent=isNews?'기업 소식 · 가상 시나리오':`연간 · ${COMPANY_CYCLE_TYPES[market.config.companyProfile.cyclicality].label} · 가상 입력값`;
    $('[data-open-financial-settings]').textContent=isNews?'소식 설정':'재무정보 수정';
    $('#simCompanyMetrics').hidden=isNews;
    $('.sim-financial-panel .sim-financial-basis').hidden=isNews;
    $('#simFinancialNote').hidden=isNews;
    $('#simNewsReport').hidden=!isNews;
    $('#simCompanyMetrics').innerHTML=(financialMetricFields[session.financialView] || []).map(([key,label,unit])=>`<div data-company-metric="${key}"><span>${label}</span><strong class="${metrics[key]===null?'is-unavailable':metrics[key]<0?'sim-negative':''}">${financialMetricText(key,metrics[key],unit,metrics)}</strong></div>`).join('');
    root.querySelectorAll('[data-financial-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.financialView===session.financialView)));
    $('#simFinancialShares').textContent=fmt(market.totalShares)+'주';
    const cycle=session.financialView==='cycle', reference=cycle?projected.referencePrice:metrics.referencePrice;
    $('#simFinancialReference').previousElementSibling.textContent=cycle?'경기 반영 참조 주가':'재무 참조 주가';
    $('#simFinancialReference').textContent=reference===null?'계산 불가':fmt(reference,2)+'원';
    $('#simFinancialInfluence').previousElementSibling.textContent=cycle?'거시경제 반영도':'재무정보 반영도';
    $('#simFinancialInfluence').textContent=fmt(cycle?market.config.macro.influence:metrics.priceInfluence)+'%';
    $('#simFinancialNote').textContent={income:'연간 입력값은 실행 중 고정됩니다. 회사의 이익은 참여자 현금에 자동 지급되지 않습니다.',balance:'자본 = 자산 − 부채. 부채비율은 부채 ÷ 자본, 자기자본비율은 자본 ÷ 자산입니다.',valuation:'발행주식 수는 참여자 수·재산과 독립입니다. 참조 주가는 입력한 PER·이익을 사용한 모형의 가정입니다.',cycle:'현재 경제지표와 회사 민감도를 반영한 연간 추정값입니다. 입력 실적과 참여자 현금은 바꾸지 않습니다.'}[session.financialView] || '';
    paintNews();
    const m=market.config.macro;
    $('#simMacroPhase').textContent=(m.influence===0?'영향 제외':scenario.phase)+' · 현재 연간 시나리오';
    const macroItems=[['gdpGrowth','실질 GDP 성장률',fmt(m.gdpGrowth,1)+'%'],['inflation','소비자물가 상승률',fmt(m.inflation,1)+'%'],['policyRate','기준금리',fmt(m.policyRate,1)+'%'],['cyclicality','기업 유형',COMPANY_CYCLE_TYPES[market.config.companyProfile.cyclicality].label],['revenueChange','추정 매출 변화',signed(metrics.revenueChange)+'%'],['profitDelta','추정 순이익 변화',signed(scenario.profitDelta)+'억원']];
    $('#simMacroMetrics').innerHTML=macroItems.map(([key,label,value])=>`<div data-macro-metric="${key}"><span>${label}</span><strong>${esc(value)}</strong></div>`).join('');
    $('#simMacroRevenue').textContent=fmt(projected.revenue/100000000,2)+'억원';
    $('#simMacroIncome').textContent=fmt(projected.netIncome/100000000,2)+'억원';
    $('#simMacroPER').textContent=fmt(scenario.adjustedFinancials.referencePER,2)+'배';
  }
  function paintNews() {
    const market=session.market,events=market.publicNews(),select=$('#simNewsSelect');
    session.newsPage=Math.max(0,Math.min(session.newsPage,events.length-1));
    const signature=JSON.stringify(events.map(event=>[event.id,event.title,event.announceTick]));
    if(select.dataset.signature!==signature){
      select.innerHTML=events.map((event,i)=>`<option value="${i}">${marketTime(event.announceTick,false)} · ${esc(event.title)}</option>`).join('');
      select.dataset.signature=signature;
    }
    select.value=String(session.newsPage);select.parentElement.hidden=!events.length;
    $('#simNewsClock').textContent=marketTime(market.tick);
    const event=events[session.newsPage];
    if(!event){$('#simNewsDetail').innerHTML='<div class="sim-news-empty"><p>등록된 기업 소식이 없습니다.</p><button type="button" class="button secondary" data-open-news-settings>소식 등록</button></div>';return;}
    const responses=market.last.decisions.flatMap(decision=>(decision.news || []).filter(item=>item.eventId===event.id));
    const reacting=responses.filter(item=>Math.abs(item.effect)>1e-10);
    const rumorCount=reacting.filter(item=>item.phase==='rumor').length, announcementCount=reacting.filter(item=>item.phase==='announced').length;
    const phase=event.phase==='announced'?`${event.actualImpact>0?'호재':event.actualImpact<0?'악재':'중립'} 발표`:newsPhaseLabels[event.phase];
    const values=[['사전 기대',event.expectedImpact===null?(event.rumorTick===null?'없음':'공개 전'):signed(event.expectedImpact,0)+'%'],['실제 발표',event.actualImpact===null?'발표 전':signed(event.actualImpact,0)+'%'],['기대 대비',event.surprise===null?'—':signed(event.surprise,0)+'%p'],['소식 반영',`${reacting.length} / ${market.agents.length}명`]];
    $('#simNewsDetail').innerHTML=`<div class="sim-news-headline"><h3>${esc(event.title)}</h3><span class="sim-news-phase">${phase}</span></div><p class="sim-news-schedule">${event.source==='manual'?'직접 발동 · ':''}${event.rumorTick===null?'사전 기대 없음':`기대 ${marketTime(event.rumorTick,false)}`} · 발표 ${marketTime(event.announceTick,false)} · 관심 ${marketTime(event.endTick,false)}까지</p><div class="sim-news-metrics">${values.map(([label,value])=>`<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('')}</div><p class="sim-news-response">사전 인지 ${event.insiderInformed}명 · 기대 반영 ${rumorCount}명 · 발표 반영 ${announcementCount}명</p><p class="sim-financial-note">사전 인지자는 실제 내용으로, 나머지는 공개 정보로 판단합니다. 개인별 지연·확률·성향을 적용합니다.</p>`;
  }
  function bookRows(rows, side) {
    const levels = new Map();
    for (const order of rows) levels.set(order.limit,(levels.get(order.limit) || 0) + order.remaining);
    let list = [...levels].sort((a,b) => side === 'ask' ? a[0]-b[0] : b[0]-a[0]).slice(0,bookDepth);
    if (side === 'ask') list.reverse();
    const max = Math.max(1,...list.map(([,quantity]) => quantity));
    const empty = Array.from({length:bookDepth-list.length},() => '<div class="sim-book-row sim-book-empty"><span>—</span><span>—</span></div>').join('');
    const markup = list.map(([price,quantity]) => `<div class="sim-book-row sim-book-${side}"><i style="width:${quantity/max*100}%"></i><span>${fmt(price)}</span><span>${fmt(quantity)}</span></div>`).join('');
    return side === 'ask' ? empty+markup : markup+empty;
  }
  function paintControls(){
    const control=session.exchange.controls,state=control.snapshot(),config=control.config;
    const remaining=ticks=>`${String(Math.floor(ticks*10/60)).padStart(2,'0')}:${String(ticks*10%60).padStart(2,'0')}`;
    const phaseLabel=session.exchange.sessionClosed?'장 마감':{closed:'당일 종료',auction:'재개 단일가',normal:'정상 거래',sidecar:'사이드카',halted:`거래 중단 ${state.breakerStage}단계`,recovering:'참여 회복'}[state.phase];
    controlBadge.textContent=phaseLabel+(state.remainingTicks?' '+remaining(state.remainingTicks):'');
    controlBadge.dataset.phase=state.phase;controlBadge.title='체결·분석 → 시장 안정';
    const averageRisk=session.exchange.accounts.reduce((sum,account)=>sum+account.traits.risk,0)/session.exchange.accounts.length;
    const metrics=[['시장 지수',fmt(state.index,2),`${signed(state.change)}% · 전일 대비`],['판단 참여',fmt(state.participation*100,1)+'%','개인 거래 · 사이드카 중 유지'],['평균 주문 열기',fmt(averageRisk*state.participation,1),'위험감수 × 참여 비율']];
    $('#simControlMetrics').innerHTML=metrics.map(([label,value,note])=>`<div><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
    const sidecarText=!config.sidecar.enabled?'사용 안 함':state.sidecar?`프로그램 ${state.programSide==='buy'?'매수':'매도'} 제한 · ${remaining(state.sidecarRemaining)}`:state.cooldownRemaining?'오늘 발동 완료':`전일 대비 ±${config.sidecar.threshold}% · ${config.sidecar.windowMinutes}분 유지`;
    const breakerText=!config.circuitBreaker.enabled?'사용 안 함':state.closed?'3단계 · 당일 종료':state.auction?'재개 단일가 주문 수집':state.halted?`${state.breakerStage}단계 · ${remaining(state.remainingTicks)} 후 10분 단일가`:`다음 ${state.breakerStage+1}단계 −${config.circuitBreaker.thresholds[state.breakerStage]}% · ${config.circuitBreaker.durationMinutes}분 중단`;
    $('#simControlSummary').innerHTML=`<div><strong>사이드카</strong><span>${sidecarText}</span></div><div><strong>서킷브레이커</strong><span>${breakerText}</span></div>`;
    $('[data-test-control="sidecar"]').disabled=session.dirty || session.exchange.sessionClosed || state.halted || state.sidecar || state.cooldownRemaining>0 || !config.sidecar.enabled;
    $('[data-test-control="breaker"]').disabled=session.dirty || session.exchange.sessionClosed || state.halted || state.breakerStage>=3 || !config.circuitBreaker.enabled;
    const events=[...state.events].reverse(),size=2;
    session.controlEventPage=Math.max(0,Math.min(session.controlEventPage || 0,Math.ceil(events.length/size)-1));
    $('#simControlEventCount').textContent=`최근 ${events.length}건`;
    $('#simControlEvents').innerHTML=events.length?events.slice(session.controlEventPage*size,session.controlEventPage*size+size).map(event=>`<div><time>${marketTime(event.tick)}</time><span>${esc(event.label)}<small>지수 ${fmt(event.index,2)}${event.manual?' · 시험 발동':event.change!==undefined?' · '+signed(event.change)+'%':''}</small></span></div>`).join(''):'<p>아직 발동한 안정장치가 없습니다.</p>';
    $('#simControlEventPager').innerHTML=pagerMarkup('data-control-event-page',session.controlEventPage,events.length,size,'건');
  }
  function paintEmotions(m){
    const emotion=m.emotionSummary(),score=fmt(emotion.score,1),responses=m.last.decisions.filter(decision=>decision.emotion?.accepted),orders=responses.filter(decision=>decision.quantity>0);
    emotionPanel.dataset.phase=emotion.key;
    $('#simEmotionBadge').textContent=`심리 ${fmt(emotion.score)} · ${emotion.label.replace('극단적 ','')}`;
    $('#simEmotionBadge').title=`공포·탐욕 ${score}/100 · ${emotion.label} · 참여자 평균`;
    $('#simEmotionBadge').dataset.phase=emotion.key;
    $('#simEmotionScore').textContent=score;$('#simEmotionBand').textContent=emotion.label;
    $('#simEmotionMeter').setAttribute('aria-valuenow',String(emotion.score));$('#simEmotionMeter').setAttribute('aria-valuetext',`${score}점 · ${emotion.label}`);$('#simEmotionMarker').style.left=emotion.score+'%';
    $('#simEmotionStats').innerHTML=`<div><span>공포 기준 도달</span><strong>${emotion.fearCount}<small>명</small></strong></div><div><span>탐욕 기준 도달</span><strong>${emotion.greedCount}<small>명</small></strong></div><div><span>직전 감정 주문</span><strong>${orders.length}<small>명</small></strong></div>`;
    session.emotionPage=Math.max(0,Math.min(session.emotionPage,Math.ceil(m.agents.length/session.emotionPageSize)-1));
    const start=session.emotionPage*session.emotionPageSize;
    $('#simEmotionPeople').innerHTML=m.agents.slice(start,start+session.emotionPageSize).map((agent,offset)=>{
      const band=emotionBand(agent.emotion);
      return `<div class="sim-emotion-person" data-emotion-person="${start+offset}"><button type="button" data-edit-participant="${start+offset}" data-edit-trait="emotionInitial" title="${esc(agent.traits.name)} 감정 설정">${esc(agent.traits.name)}</button><span title="${band.label} · 공포 ${agent.traits.panicThreshold} 이하 / 탐욕 ${agent.traits.greedThreshold} 이상"><strong>${fmt(agent.emotion,1)}</strong><small>${band.label.replace('극단적 ','')}</small></span><span title="${esc(agent.lastReason)}">${esc(agent.lastAction)}</span></div>`;
    }).join('');
    $('#simEmotionPager').innerHTML=pagerMarkup('data-emotion-page',session.emotionPage,m.agents.length,session.emotionPageSize);
    $('#simEmotionSummary').textContent=`직전 틱 패닉셀 ${orders.filter(decision=>decision.emotion.kind==='panic').length}명 · 추격 매수 ${orders.filter(decision=>decision.emotion.kind==='fomo').length}명${m.last.halted?' · 거래 중단 중 진정':''}`;
  }
  function paint() {
    const m = session.market, change = m.price / m.config.initialPrice - 1,controlState=session.exchange.controls.snapshot();
    const securitySignature=JSON.stringify(session.exchange.markets.map(market=>[market.assetId,market.config.company]));
    if(securitySelect.dataset.signature!==securitySignature){securitySelect.innerHTML=session.exchange.markets.map(market=>`<option value="${market.assetId}">${esc(market.config.company)}</option>`).join('');securitySelect.dataset.signature=securitySignature;}
    securitySelect.value=session.securityId;
    $('#simCompany').textContent = m.config.company;
    $('.sim-mode-badge').textContent=`가상 시장 · ${session.exchange.markets.length}종목`;
    $('.sim-ticker').textContent=m.ticker[0];
    $('.sim-company>div>span').textContent=`${m.ticker} · ${COMPANY_CYCLE_TYPES[m.config.companyProfile.cyclicality].label}`;
    $('#simPrice').textContent = fmt(m.price) + '원';
    $('#simPrice').className = directionClass(change);
    $('#simChange').textContent = `${signed(m.price-m.config.initialPrice,0)}원 (${signed(change*100)}%)`;
    $('#simChange').className = directionClass(change);
    $('#simClock').textContent = m.tick===session.exchange.day*2340&&session.exchange.day?`D+${session.exchange.day} 09:00:00`:marketTime(m.tick);
    $('#simReturn').textContent = signed(change*100)+'%';
    $('#simReturn').className = directionClass(change);
    $('#simVolume').textContent = fmt(m.totalVolume)+'주';
    const volume=m.volumeSignal(),volumeResponses=m.last.decisions.filter(decision=>decision.volume?.accepted),volumeOrders=volumeResponses.filter(decision=>decision.quantity>0);
    const volumePhase=controlState.halted?'거래 중단':{warming:'기준 수집 중',noBaseline:'비교 거래 없음',burst:'거래량 급증',dry:'거래 위축',normal:'보통 거래량'}[volume.phase];
    $('#simVolumeSignal').textContent=controlState.halted?'거래 중단':volume.ready?`평소 ${fmt(volume.ratio,1)}배`:volumePhase;
    $('#simVolumeSignal').title=`최근 1분 ${fmt(volume.recentVolume)}주 / 직전 ${fmt(volume.baselineTicks/6,1)}분의 1분 평균 ${fmt(volume.baselineVolume,1)}주 · 다음 틱 판단 기준`;
    $('#simVolumeDetail').dataset.phase=controlState.halted?'halted':volume.phase;
    $('#simVolumeDetail').title=`직전 ${fmt(volume.baselineTicks/6,1)}분의 1분 평균과 최근 1분 체결량을 비교합니다. 중단 시간은 제외합니다.`;
    $('#simVolumeDetail').innerHTML=`<div class="sim-volume-heading"><strong>거래량</strong><span>${volumePhase}</span></div><div class="sim-volume-metrics"><div><span>최근 1분 체결</span><strong>${fmt(volume.recentVolume)}<small>주</small></strong></div><div><span>평소 1분 평균</span><strong>${volume.baselineTicks>=6?fmt(volume.baselineVolume,1):'—'}<small>주</small></strong></div><div><span>평균 대비</span><strong>${volume.ready?fmt(volume.ratio,2)+'배':'—'}</strong></div><div><span>직전 틱 반응</span><strong>${volumeResponses.length}<small>명 · ${volumeOrders.length}명 주문</small></strong></div></div><p>확정 체결 기준 · 다음 틱 판단에 반영</p>`;
    $('#simDrawdown').textContent = (m.maxDrawdown ? '−' : '')+fmt(m.maxDrawdown*100,2)+'%';
    $('#simHighLow').textContent = `${fmt(m.high)} / ${fmt(m.low)}원`;
    paintEmotions(m);paintFinancials();
    $('#simResultCount').textContent = `${m.agents.length}명 · 순자산은 전체 종목 합산`;
    $('.sim-results-scroll').classList.toggle('is-large',m.agents.length > 10);
    const riskGroups = distributionGroups(PARTICIPANT_ATTRIBUTES.find(a => a.key === 'risk'));
    $('#simComposition').innerHTML = '<span>위험감수 구성 <small>인원 기준</small></span>'+riskGroups.map((group,index) => {
      const count = m.agents.filter(a => a.traits.risk >= (group.min ?? 0) && a.traits.risk <= (group.max ?? 100)).length;
      return `<span data-risk-composition="${group.key}" style="--participant:${colors[index]}"><i></i>${esc(group.label)} <b>${count}명 · ${fmt(count/m.agents.length*100,1)}%</b></span>`;
    }).join('');
    session.resultPage=Math.min(session.resultPage,Math.max(0,Math.ceil(m.agents.length/session.resultPageSize)-1));
    const resultStart=session.resultPage*session.resultPageSize;
    $('#simResults').innerHTML = m.agents.slice(resultStart,resultStart+session.resultPageSize).map((a,offset) => {
      const index=resultStart+offset;
      const equity = m.equity(a), profit = equity/a.initialEquity-1;
      return `<tr><th scope="row"><span class="sim-result-name"><button type="button" class="sim-edit-participant" data-edit-participant="${index}" aria-label="${esc(a.traits.name)} 설정"><span>${esc(a.traits.name)}</span><small>설정</small></button></span><small>위험감수 ${a.traits.risk}% · 열기 ${fmt(a.traits.risk*controlState.participation,1)}</small></th><td>${formatMoney(equity)}</td><td class="${directionClass(profit)}">${signed(profit*100)}%</td><td>${fmt(a.shares)}${a.shares < 0 ? '<small>공매도</small>' : ''}</td><td>${formatMoney(Math.max(0,a.cash))}<small>${a.cash < 0 ? '차입 '+formatMoney(-a.cash) : '차입 0'}</small></td><td><span>${esc(a.lastAction)}</span><small>${a.lastFilled ? (a.lastFilled > 0 ? '매수 ' : '매도 ')+fmt(Math.abs(a.lastFilled))+'주 체결' : m.tick ? '이번 틱 체결 없음' : '주문 대기'}</small><span class="sim-decision-reason" title="${esc(a.lastReason)}">${esc(a.lastReason)}</span></td></tr>`;
    }).join('');
    $('#simResultPager').innerHTML=pagerMarkup('data-result-page',session.resultPage,m.agents.length,session.resultPageSize);
    $('#simAsks').innerHTML = bookRows(m.orderBook.asks,'ask');
    $('#simBids').innerHTML = bookRows(m.orderBook.bids,'bid');
    $('#simBookPrice').textContent = fmt(m.price)+'원';
    $('#simBookPrice').className = 'sim-book-mid '+directionClass(change);
    $('#simBookSummary').textContent = session.exchange.sessionClosed?'장 마감':m.viUntil>m.tick?'단일가 주문 수집':session.exchange.controls.snapshot().halted?'서킷브레이커 · 거래 중단':`이번 틱 체결 ${fmt(m.last.volume)}주`;
    $('#simTradeCount').textContent = `누적 ${fmt(m.totalTrades)}건`;
    const names = {...Object.fromEntries([...m.agents,...m.background].map(a => [a.id,a.traits.name])),player:'나'};
    session.tradePage=Math.min(session.tradePage,Math.max(0,Math.ceil(m.trades.length/session.tradePageSize)-1));
    const tradeStart=session.tradePage*session.tradePageSize;
    $('#simTrades').innerHTML = m.trades.length ? m.trades.slice(tradeStart,tradeStart+session.tradePageSize).map(trade => `<div class="sim-trade"><time>${marketTime(trade.tick)}</time><div><strong>${fmt(trade.price)}원</strong><span>${fmt(trade.quantity)}주</span></div><small><span>${esc(names[trade.buyer])} 매수</span><span>${esc(names[trade.seller])} 매도</span></small></div>`).join('') : '<div class="sim-empty-trades">아직 체결된 거래가 없습니다.<br>매수·매도 호가가 만나면 여기에 표시됩니다.</div>';
    $('#simTradePager').innerHTML=pagerMarkup('data-trade-page',session.tradePage,m.trades.length,session.tradePageSize,'건');
    $('#simBuyQuantity').textContent = fmt(m.last.buyQuantity)+'주';
    $('#simSellQuantity').textContent = fmt(m.last.sellQuantity)+'주';
    const total = m.last.buyQuantity+m.last.sellQuantity;
    $('#simPressureBar').style.width = (total ? m.last.buyQuantity/total*100 : 50)+'%';
    const forced = m.last.decisions.filter(d => d.forced);
    $('#simExplanation').textContent = !m.tick ? '시작하면 각 참여자가 자신의 성향에 맞는 주문을 냅니다. 매수·매도 호가가 만나는 가격에서 거래가 체결됩니다.' : !m.last.tradeCount ? `이번 틱은 체결이 없어 ${fmt(m.price)}원을 유지했습니다. ${total ? '매수·매도 호가가 맞지 않거나 상대 주문이 부족합니다.' : '참여자들이 보유 상태를 유지하거나 주문 여력이 없습니다.'}` : `이번 틱에 ${fmt(m.last.tradeCount)}건, ${fmt(m.last.volume)}주가 체결됐습니다. 마지막 체결 가격은 ${fmt(m.price)}원이며 시작가보다 ${fmt(Math.abs(change*100),2)}% ${change >= 0 ? '높습니다' : '낮습니다'}.${forced.length ? ` 담보 한도에 도달한 ${forced.length}명이 포지션 축소 주문을 냈습니다.` : ''}`;
    if(m.last.halted)$('#simExplanation').textContent=controlState.halted?'서킷브레이커 발동으로 모든 체결을 중단했습니다. 시간과 기업 발표는 진행하며 기존 지정가 주문은 유지합니다. 가상 시간을 진행하면 거래가 재개됩니다.':'이번 틱까지 서킷브레이커로 체결이 중단됐습니다. 현재 거래가 재개됐으며, 다음 틱부터 회복 중인 참여 비율로 주문을 처리합니다.';
    paintControls();trading?.paint();issues?.paint();chart.render();
  }
  function syncPlayerFundsMode() {
    const unlimited=$('#simPlayerFundsMode').value==='unlimited';
    playerField.dataset.unlimited=String(unlimited);
    $('#simPlayerWealth').hidden=unlimited;
    $('#simPlayerWealth').disabled=unlimited;
    $('#simPlayerWealth').required=!unlimited;
  }
  function readDraft() {
    const participants = clone(session.draft.participants);
    const population = clone(session.draft.population || defaultPopulation());
    population.count = $('#simPopulationCount').value;
    for (const input of root.querySelectorAll('[data-population-number]')) population.distributions[session.distributionAttribute][input.dataset.populationNumber] = input.value;
    const selectedCompany=draftCompany();
    const financials={...DEFAULT_FINANCIALS,...selectedCompany.financials};
    for(const input of root.querySelectorAll('[data-financial-field]'))financials[input.dataset.financialField]=input.value;
    const macro={...DEFAULT_MACRO,...session.draft.macro}, companyProfile={...DEFAULT_COMPANY_PROFILE,...selectedCompany.companyProfile};
    for(const input of root.querySelectorAll('[data-macro-field]'))macro[input.dataset.macroField]=input.value;
    for(const input of root.querySelectorAll('[data-company-field]'))companyProfile[input.dataset.companyField]=input.value;
    const companyNews=clone(selectedCompany.companyNews || []);
    if(companyNews[session.newsEditPage])for(const input of root.querySelectorAll('[data-news-field]'))companyNews[session.newsEditPage][input.dataset.newsField]=input.value;
    const values={company:$('#simCompanyInput').value,initialPrice:$('#simInitialPrice').value,financials,companyProfile,companyNews};
    const marketControls=clone(session.draft.marketControls || DEFAULT_MARKET_CONTROLS);
    for(const input of root.querySelectorAll('[data-market-control]')){
      const keys=input.dataset.marketControl.split('.'),target=keys.slice(0,-1).reduce((object,key)=>object[key],marketControls);target[keys.at(-1)]=input.value;
    }
    const next={...session.draft,seed:$('#simSeed').value,macro,participants,population,marketControls,player:{...session.draft.player,wealth:$('#simPlayerWealth').value,unlimited:$('#simPlayerFundsMode').value==='unlimited'}};
    if(session.securityId==='primary')Object.assign(next,values);
    else next.additionalCompanies=next.additionalCompanies.map(company=>company.id===session.securityId?{...company,...values}:company);
    return next;
  }
  function markDirty() {
    session.draft = readDraft(); session.dirty = true;
    pause();
    notice('설정이 변경되어 일시정지했습니다. ‘설정 적용 · 새로 시작’을 누르면 변경한 조건으로 시작합니다.');
  }
  function paintDraft(clearError=true) {
    session.draft.population ||= defaultPopulation();
    session.draft.additionalCompanies ||= clone(session.exchange.config.additionalCompanies);
    session.draft.player ||= clone(session.exchange.config.player);
    session.draft.marketControls ||= clone(session.exchange.config.marketControls);
    if(!draftCompany())session.securityId='primary';
    draftCompany().companyNews ||= [];
    if (!['base','financials','macro','news','stability'].includes(session.settingsSection)) session.settingsSection=session.draft.population.enabled?'population':'individual';
    $('#simCompanyInput').value = draftCompany().company;
    $('#simInitialPrice').value = draftCompany().initialPrice;
    $('#simSeed').value = session.draft.seed;
    $('#simPlayerWealth').value=session.draft.player.wealth;
    $('#simPlayerFundsMode').value=session.draft.player.unlimited?'unlimited':'finite';
    syncPlayerFundsMode();
    $('#simFinancialEditor').innerHTML=financialEditorMarkup();
    $('#simMacroEditor').innerHTML=macroConfigMarkup();
    $('#simNewsEditor').innerHTML=newsEditorMarkup();
    $('#simControlEditor').innerHTML=controlEditorMarkup();
    participantSheet?.refresh();
    $('#simPopulationCount').value = session.draft.population.count;
    paintDistribution();
    root.querySelectorAll('[data-distribution-tab]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.distributionTab === session.distributionAttribute)));
    if (clearError) $('#simConfigError').textContent = '';
    setControlState();
    scheduleLayout();
  }
  function paintDistribution() {
    const attribute=PARTICIPANT_ATTRIBUTES.find(a=>a.key===session.distributionAttribute), total=distributionGroups(attribute).length;
    session.distributionPage=Math.max(0,Math.min(session.distributionPage,Math.ceil(total/session.distributionPageSize)-1));
    $('#simDistributionEditor').innerHTML=distributionRows();
    $('#simDistributionSelect').value=session.distributionAttribute;
    $('#simDistributionPager').innerHTML=pagerMarkup('data-distribution-page',session.distributionPage,total,session.distributionPageSize,'항목');
    paintPopulationFeedback();
  }
  function selectDistribution(key) {
    session.draft=readDraft(); session.distributionAttribute=key; session.distributionPage=0;
    root.querySelectorAll('[data-distribution-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.distributionTab===key)));
    paintDistribution(); scheduleLayout();
  }
  function paintPopulationFeedback() {
    const population = session.draft.population, count = Number(population.count);
    const attribute = PARTICIPANT_ATTRIBUTES.find(a => a.key === session.distributionAttribute), groups = distributionGroups(attribute);
    const weights = groups.map(g => Number(population.distributions[attribute.key]?.[g.key] ?? 0));
    const sum = weights.reduce((s,n)=>s+n,0), valid = weights.every(n=>Number.isFinite(n) && n>=0 && n<=100) && Math.abs(sum-100)<1e-8;
    const countValid = Number.isInteger(count) && count >= 2 && count <= MAX_PARTICIPANTS;
    const counts = valid && countValid ? allocatePopulation(count,weights) : null;
    $('#simDistributionTotal').textContent = valid ? '합계 100% ✓' : `합계 ${Number.isFinite(sum) ? fmt(sum,2) : '—'}% · 100%로 맞춰주세요`;
    $('#simDistributionTotal').classList.toggle('is-invalid',!valid);
    $('#simDistributionPreview').innerHTML = groups.map((g,i) => `<span style="width:${sum>0 && Number.isFinite(sum) ? Math.max(0,weights[i])/sum*100 : 0}%;background:${colors[i%colors.length]}" title="${esc(g.label)} ${fmt(weights[i],1)}%"></span>`).join('');
    groups.forEach((g,i) => {const output=root.querySelector(`[data-population-headcount="${g.key}"]`);if(output)output.textContent = counts ? `${counts[i]}명 · ${fmt(counts[i]/count*100,1)}%` : '인원 확인';});
    $('#simPopulationRounding').textContent = !countValid ? `전체 참여자를 2~${MAX_PARTICIPANTS}명으로 설정하세요.` : !valid ? '각 속성의 합계를 100%로 맞추세요.' : '정수 인원으로 배분하므로 실제 비율은 입력값과 다를 수 있습니다.';
    for (const item of PARTICIPANT_ATTRIBUTES) {
      const values = distributionGroups(item).map(g=>Number(population.distributions[item.key]?.[g.key] ?? 0));
      const correct = values.every(n=>Number.isFinite(n) && n>=0 && n<=100) && Math.abs(values.reduce((s,n)=>s+n,0)-100)<1e-8;
      const marker = root.querySelector(`[data-distribution-check="${item.key}"]`);
      marker.textContent = correct ? '' : '!';
      marker.parentElement.classList.toggle('is-invalid',!correct);
    }
  }
  $('#simPlay').addEventListener('click', () => {if (running) {pause(); notice('일시정지했습니다. 설정과 결과를 살펴보세요.');} else start();}, options);
  $('#simStep').addEventListener('click', () => {const previous=session.market.newsLog.at(-1),control=session.exchange.controls.events.at(-1);if (safeStep(TICKS_PER_CANDLE) && previous===session.market.newsLog.at(-1) && control===session.exchange.controls.events.at(-1)) notice('가상 시간 1분을 진행했습니다.');}, options);
  $('#simSpeed').addEventListener('change', () => {session.speed = Number($('#simSpeed').value); if (running) {pause(); start();}}, options);
  $('#simReset').addEventListener('click', () => {
    pause(); session.exchange = new SecuritiesSimulation(session.exchange.config); chart.reset(); paint(); setControlState();
    notice('동일한 설정과 난수값으로 실험을 초기화했습니다.');
  }, options);
  $('#simConfig').addEventListener('input', event => {
    const input = event.target;
    if(input.closest('[data-participant-sheet]'))return;
    if(['simDistributionSelect','simNewsEditSelect','simControlSection','simPlayerFundsMode'].includes(input.id) || input.dataset.companyField==='cyclicality')return;
    if (input.hasAttribute('data-population-range')) root.querySelector(`[data-population-number="${input.dataset.populationRange}"]`).value = input.value;
    else if (input.hasAttribute('data-population-number')) root.querySelector(`[data-population-range="${input.dataset.populationNumber}"]`).value = input.value;
    else if (input.type === 'range') input.closest('label').querySelector('output').textContent = input.value+'%';
    markDirty();
    if(input.dataset.newsField==='announceMinute'){
      for(const lead of root.querySelectorAll('[data-news-field="leadMinutes"],[data-news-field="insiderLeadMinutes"]'))lead.max=String(Math.min(1440,Number(input.value)||1440));
    }
    if(input.hasAttribute('data-macro-field'))root.querySelectorAll('[data-macro-preset]').forEach(button=>button.setAttribute('aria-pressed',String(Object.entries(MACRO_PRESETS[button.dataset.macroPreset].values).every(([key,value])=>Number(session.draft.macro[key])===value))));
    if (input.closest('#simPopulationPanel')) paintPopulationFeedback();
  }, options);
  $('#simConfig').addEventListener('change', event => {
    if(event.target.closest('[data-participant-sheet]'))return;
    if(event.target.id==='simPlayerFundsMode'){markDirty();syncPlayerFundsMode();scheduleLayout();return;}
    if(event.target.id==='simControlSection'){session.draft=readDraft();session.controlEditSection=event.target.value;$('#simControlEditor').innerHTML=controlEditorMarkup();scheduleLayout();return;}
    if (event.target.id==='simDistributionSelect') {selectDistribution(event.target.value);return;}
    if(event.target.id==='simNewsEditSelect'){session.draft=readDraft();session.newsEditPage=Number(event.target.value);$('#simNewsEditor').innerHTML=newsEditorMarkup();scheduleLayout();return;}
    if(event.target.dataset.companyField==='cyclicality'){
      const type=event.target.value, preset=COMPANY_CYCLE_TYPES[type];
      if(!preset)return;
      markDirty();draftCompany().companyProfile={cyclicality:type,...Object.fromEntries(COMPANY_EXPOSURE_FIELDS.map(field=>[field.key,preset[field.key]]))};
      $('#simFinancialEditor').innerHTML=financialEditorMarkup();
      notice(`${preset.label} 기본 민감도를 불러왔습니다. 수정 후 설정을 적용하세요.`);return;
    }
    if (event.target.matches('select')) markDirty();
  }, options);
  $('#simConfig').addEventListener('click', event => {
    const newsSection=event.target.closest('[data-news-edit-section]');
    if(newsSection){session.draft=readDraft();session.newsEditSection=newsSection.dataset.newsEditSection;$('#simNewsEditor').innerHTML=newsEditorMarkup();scheduleLayout();return;}
    if(event.target.closest('[data-add-news]')){
      if((draftCompany().companyNews || []).length>=MAX_COMPANY_NEWS)return;
      markDirty();
      const events=draftCompany().companyNews, ids=new Set(events.map(item=>item.id));
      let index=1;while(ids.has(`news-${index}`))index++;
      const announceMinute=Math.min(1440,Math.max(0,...events.map(item=>Number(item.announceMinute)||0))+5);
      events.push({id:`news-${index}`,title:`기업 소식 ${index}`,announceMinute,leadMinutes:Math.min(2,announceMinute),durationMinutes:10,expectedImpact:4,actualImpact:6});
      session.newsEditPage=events.length-1;session.newsEditSection='content';paintDraft(false);return;
    }
    if(event.target.closest('[data-remove-news]')){
      markDirty();draftCompany().companyNews.splice(session.newsEditPage,1);paintDraft(false);return;
    }
    if(event.target.closest('[data-news-examples]')){
      markDirty();draftCompany().companyNews=clone(DEFAULT_COMPANY_NEWS);session.newsEditPage=0;paintDraft(false);return;
    }
    const preset=event.target.closest('[data-macro-preset]');
    if(preset){markDirty();session.draft.macro={...session.draft.macro,...MACRO_PRESETS[preset.dataset.macroPreset].values};paintDraft(false);notice('경제지표를 불러왔습니다. 설정을 적용하면 새로 시작합니다.');return;}
    const financeSection=event.target.closest('[data-finance-section]');
    if(financeSection){session.draft=readDraft();session.financeSection=financeSection.dataset.financeSection;$('#simFinancialEditor').innerHTML=financialEditorMarkup();scheduleLayout();return;}
    if (event.target.closest('[data-settings-base]')) {session.draft=readDraft();session.settingsSection='base';setControlState();scheduleLayout();return;}
    if (event.target.closest('[data-settings-financials]')) {session.draft=readDraft();session.settingsSection='financials';setControlState();scheduleLayout();return;}
    if (event.target.closest('[data-settings-macro]')) {session.draft=readDraft();session.settingsSection='macro';setControlState();scheduleLayout();return;}
    if (event.target.closest('[data-settings-news]')) {session.draft=readDraft();session.settingsSection='news';setControlState();scheduleLayout();return;}
    if (event.target.closest('[data-settings-stability]')) {session.draft=readDraft();session.settingsSection='stability';setControlState();scheduleLayout();return;}
    const mode = event.target.closest('[data-config-mode]');
    if (mode) {
      const enabled = mode.dataset.configMode === 'population';
      if (enabled === session.draft.population.enabled) {session.settingsSection=mode.dataset.configMode;setControlState();scheduleLayout();return;}
      markDirty();
      if(!enabled){
        try{
          session.draft.participants=generatePopulation(session.draft.population,session.draft.seed);
          session.draft.participantPlan=rosterPlanFromPopulation(session.draft.population);
        }catch(error){$('#simConfigError').textContent=error.message;return;}
      }
      session.draft.population.enabled = enabled; session.settingsSection=mode.dataset.configMode; paintDraft();
      notice(enabled ? '속성별 비율을 설정한 뒤 ‘설정 적용 · 새로 시작’을 누르세요.' : '참여자별 설정으로 전환했습니다. 개별 수정한 구성은 적용 후 반영됩니다.');
      return;
    }
    const tab = event.target.closest('[data-distribution-tab]');
    if (tab) {
      selectDistribution(tab.dataset.distributionTab); return;
    }
  }, options);
  $('#simAddParticipant').addEventListener('click', () => {
    participantSheet.add();
  }, options);
  $('#simDefaults').addEventListener('click', () => {
    pause(); session.draft = clone(DEFAULT_CONFIG); session.dirty = true; paintDraft();
    notice('기본 구성을 불러왔습니다. 설정을 적용하면 새 실험을 시작합니다.');
  }, options);
  $('#simDiscard').addEventListener('click', () => {
    session.draft = clone(session.exchange.config); session.dirty = false; paintDraft();
    notice('변경을 취소했습니다. 기존 실험을 이어서 실행할 수 있습니다.');
  }, options);
  $('#simNormalizeDistribution').addEventListener('click', () => {
    try {
      session.draft = readDraft();
      const attribute = PARTICIPANT_ATTRIBUTES.find(a=>a.key===session.distributionAttribute), groups = distributionGroups(attribute);
      const weights = groups.map(g => Number(session.draft.population.distributions[attribute.key][g.key]));
      const normalized = allocatePopulation(100,weights);
      groups.forEach((g,i) => {session.draft.population.distributions[attribute.key][g.key] = normalized[i];});
      session.dirty = true; pause(); paintDraft();
      notice(`${attribute.label} 비율을 입력값의 비중에 맞춰 합계 100%로 조정했습니다.`);
    } catch (error) {$('#simConfigError').textContent = error.message;}
  }, options);
  $('#simConfig').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const draft=readDraft();
      if(!draft.population.enabled)Object.assign(draft,participantSheet.prepare());
      const config = normalizeConfig(draft);
      pause(); session.exchange = new SecuritiesSimulation(config); session.draft = clone(config); session.dirty = false;
      session.resultPage=0; session.tradePage=0;
      let saved = true;
      try {localStorage.setItem(STORAGE_KEY,JSON.stringify(config));} catch {saved = false;}
      paintDraft(); chart.reset(); paint(); setControlState();
      notice(`${config.population ? `비율에 따라 ${config.participants.length}명의 참여자를 만들고 ` : ''}설정을 적용했습니다. 시작 버튼을 누르세요.${saved ? ' 설정은 이 브라우저에 저장됩니다.' : ' 브라우저 저장이 제한되어 현재 화면에서만 유지됩니다.'}`);
    } catch (error) {$('#simConfigError').textContent = error.message;}
  }, options);
  $('#simConfig').addEventListener('invalid',event=>{
    if(event.target.closest('.sim-market-fields'))session.settingsSection='base';
    else if(event.target.closest('#simFinancialConfig'))session.settingsSection='financials';
    else if(event.target.closest('#simMacroConfig'))session.settingsSection='macro';
    else if(event.target.closest('#simNewsConfig'))session.settingsSection='news';
    else if(event.target.closest('#simStabilityConfig'))session.settingsSection='stability';
    else if(event.target.closest('#simPopulationPanel'))session.settingsSection='population';
    else session.settingsSection='individual';
    showView('settings');setControlState();
  },{...options,capture:true});
  root.addEventListener('click',event=>{
    if(event.target.closest('#simEmotionBadge')){showActivity('emotion');return;}
    if(event.target.closest('#simControlBadge')){showStability();return;}
    if(event.target.closest('[data-open-stability-settings]')){session.draft=readDraft();session.settingsSection='stability';showView('settings');setControlState();scheduleLayout();return;}
    const testControl=event.target.closest('[data-test-control]');
    if(testControl){
      if(session.dirty)return;
      try{session.exchange.triggerControl(testControl.dataset.testControl);session.controlEventPage=0;paint();setControlState();notice('안정장치를 시험 발동했습니다. 가상 시간을 진행하면 참여자 반응과 해제를 확인할 수 있습니다.');}
      catch(error){notice(error.message);}return;
    }
    const controlEventPage=event.target.closest('[data-control-event-page]');
    if(controlEventPage){session.controlEventPage+=Number(controlEventPage.dataset.controlEventPage);paintControls();return;}
    const tab=event.target.closest('[data-sim-tab]');
    if(tab){showView(tab.dataset.simTab);return;}
    if(event.target.closest('[data-open-macro-settings]')){session.draft=readDraft();session.settingsSection='macro';showView('settings');setControlState();return;}
    if(event.target.closest('[data-open-company-profile]')){session.draft=readDraft();session.settingsSection='financials';session.financeSection='cycle';$('#simFinancialEditor').innerHTML=financialEditorMarkup();showView('settings');setControlState();return;}
    const financialView=event.target.closest('[data-financial-view]');
    if(financialView){session.financialView=financialView.dataset.financialView;paintFinancials();return;}
    if(event.target.closest('[data-open-financial-settings]')){
      session.draft=readDraft();session.settingsSection=session.financialView==='news'?'news':'financials';showView('settings');setControlState();return;
    }
    if(event.target.closest('[data-open-news-settings]')){session.draft=readDraft();session.settingsSection='news';showView('settings');setControlState();return;}
    const edit=event.target.closest('[data-edit-participant]');
    if(edit){
      pause();
      if(session.dirty){showView('settings');notice('적용하지 않은 설정이 있습니다. 먼저 적용하거나 변경 취소하세요.');return;}
      const index=Number(edit.dataset.editParticipant);
      session.draft=readDraft();
      if(session.draft.population.enabled){
        session.draft.participants=clone(session.exchange.config.participants);
        session.draft.participantPlan=rosterPlanFromPopulation(session.draft.population);
        session.draft.population.enabled=false;
        session.dirty=true;
      }
      session.settingsSection='individual';
      const trait=edit.dataset.editTrait || 'onRise';
      paintDraft(false);showView('settings');participantSheet.fit();participantSheet.reveal(index,trait,trait==='emotionInitial'?'emotion':'all');
      notice(`${session.draft.participants[index].name} 설정입니다. 변경 후 설정을 적용하면 새로 시작합니다.`);
      return;
    }
    const activity=event.target.closest('button[data-activity]');
    if(activity){showActivity(activity.dataset.activity);return;}
    const emotionPage=event.target.closest('[data-emotion-page]');
    if(emotionPage){session.emotionPage+=Number(emotionPage.dataset.emotionPage);paintEmotions(session.market);return;}
    const distributionPage=event.target.closest('[data-distribution-page]');
    if(distributionPage){session.draft=readDraft();session.distributionPage+=Number(distributionPage.dataset.distributionPage);paintDistribution();return;}
    const result=event.target.closest('[data-result-page]');
    if(result){session.resultPage+=Number(result.dataset.resultPage);paint();scheduleLayout();return;}
    const trade=event.target.closest('[data-trade-page]');
    if(trade){session.tradePage+=Number(trade.dataset.tradePage);paint();scheduleLayout();return;}
    const rule=event.target.closest('[data-rule-page]');
    if(rule){session.rulePage+=Number(rule.dataset.rulePage);renderRules();}
  },options);
  $('#simNewsSelect').addEventListener('change',event=>{session.newsPage=Number(event.target.value);paintNews();issues?.paint();},options);
  securitySelect.addEventListener('change',()=>{
    session.draft=readDraft();session.securityId=securitySelect.value;
    session.newsPage=0;session.newsEditPage=0;session.tradePage=0;
    paintDraft(false);chart.reset();paint();scheduleLayout();
  },options);
  $('#simViewTabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const tabs=[...root.querySelectorAll('[data-sim-tab]')],current=tabs.indexOf(document.activeElement);
    const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    showView(tabs[index].dataset.simTab);tabs[index].focus();
  },options);
  document.addEventListener('visibilitychange', () => {if (document.hidden && running) {pause(); notice('화면이 보이지 않아 일시정지했습니다. 이어서 실행할 수 있습니다.');}}, options);
  const layoutObserver=new ResizeObserver(scheduleLayout);
  for(const element of [root,...Object.values(panels),$('#simIndividualPanel'),$('#simDistributionEditor'),$('.sim-results-scroll'),$('#simTrades'),$('#simEmotionPeople')])layoutObserver.observe(element);
  window.addEventListener('resize',scheduleLayout,options);
  activityTabs.querySelector('button').setAttribute('aria-pressed','true');
  trading=new TradingPanel(root,{state:session.trading,getContext:()=>({exchange:session.exchange,market:session.market,dirty:session.dirty,running}),advance:()=>safeStep(1),onNotice:notice,onLayout:()=>{chart.render();scheduleLayout();},onLeverage:value=>{session.draft.player.leverage=value;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(session.exchange.config));}catch{}paint();},onShowParticipants:()=>showView('participants'),onMarketChange:paint});
  session.issues ||= {view:'report',section:'content',drafts:{},participantPage:0};
  issues=new IssuePanel(root,{state:session.issues,getContext:()=>({exchange:session.exchange,market:session.market,dirty:session.dirty,running,eventId:session.market.publicNews()[session.newsPage]?.id}),advance:()=>safeStep(1),onNotice:notice,onLayout:scheduleLayout,onOpen:()=>{session.financialView='news';paintFinancials();issues.paint();showView('company');},onSelected:id=>{session.newsPage=session.market.publicNews().findIndex(event=>event.id===id);paint();}});
  participantSheet=new ParticipantSheet($('#simParticipants'),$('#simParticipantPager'),{getDraft:()=>session.draft,onChange:patch=>{session.draft={...readDraft(),...patch};session.dirty=true;pause();$('#simConfigError').textContent='';},onLayout:scheduleLayout,onHelp:openGuide});
  const destroyExperiments=mountExperiments(root,{getExchange:()=>session.exchange,isDirty:()=>session.dirty,pause,notice,onChange:()=>{paint();setControlState();},replaceExchange:exchange=>{session.exchange=exchange;session.securityId='primary';session.draft={...clone(exchange.config),population:clone(exchange.config.population || defaultPopulation())};session.dirty=false;session.newsPage=0;session.tradePage=0;chart.reset();paintDraft();paint();setControlState();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(exchange.config));}catch{}}});
  paintDraft(); paint(); renderRules(); setControlState(); showView(session.view);
  if (session.dirty) notice('적용하지 않은 설정이 있습니다. 설정을 적용하거나 변경 취소를 눌러주세요.');
  return () => {disposed = true; pause(); destroyExperiments(); abort.abort(); trading.destroy();issues.destroy();participantSheet.destroy();chart.destroy(); layoutObserver.disconnect();cancelAnimationFrame(layoutFrame);};
}
