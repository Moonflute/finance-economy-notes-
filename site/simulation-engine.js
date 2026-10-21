// A browser-independent, seeded market. Add editable traits to PARTICIPANT_ATTRIBUTES,
// decisions to REACTIONS, and optional decisionModifiers without changing settlement.
export const PARTICIPANT_ATTRIBUTES = [
  {key:'wealth', label:'초기 재산', type:'number', unit:'만원', min:100, max:10000000, step:100, default:10000,
    groups:[{key:'small',label:'소액 자산가',note:'1인당 1,000만원',value:1000,max:4999},{key:'medium',label:'중간 자산가',note:'1인당 1억원',value:10000,min:5000,max:29999},{key:'large',label:'고액 자산가',note:'1인당 5억원',value:50000,min:30000}], distributionDefaults:[40,40,20]},
  {key:'risk', label:'위험감수', type:'range', unit:'%', min:0, max:100, step:1, default:50,
    groups:[{key:'averse',label:'위험 회피형',note:'위험감수 20 · 구간 0~33',value:20,max:33},{key:'neutral',label:'위험 중립형',note:'위험감수 50 · 구간 34~66',value:50,min:34,max:66},{key:'seeking',label:'위험 선호형',note:'위험감수 85 · 구간 67~100',value:85,min:67}], distributionDefaults:[30,40,30]},
  {key:'allocation', label:'초기 주식 비중', type:'range', unit:'%', min:0, max:100, step:1, default:50,
    groups:[{key:'cash',label:'현금 중심',note:'주식 20% · 구간 0~33%',value:20,max:33},{key:'balanced',label:'균형 배분',note:'주식 50% · 구간 34~66%',value:50,min:34,max:66},{key:'stocks',label:'주식 중심',note:'주식 80% · 구간 67~100%',value:80,min:67}], distributionDefaults:[25,50,25]},
  {key:'onRise', label:'상승할 때', type:'reaction', default:'buy', distributionDefaults:{buy:25,leverage:20,takeProfit:20,sell:5,short:10,rebalance:10,hold:10}},
  {key:'onFall', label:'하락할 때', type:'reaction', default:'buy', distributionDefaults:{buy:25,leverage:5,takeProfit:0,sell:30,short:15,rebalance:10,hold:15}},
  {key:'riseProbability', label:'상승 시 실행 확률', type:'number', unit:'%', min:0, max:100, step:1, default:100,
    groups:[{key:'low',label:'실행 확률 20%',value:20},{key:'half',label:'실행 확률 50%',value:50},{key:'high',label:'실행 확률 80%',value:80},{key:'always',label:'항상 실행',value:100}], distributionDefaults:[0,0,100,0]},
  {key:'fallProbability', label:'하락 시 실행 확률', type:'number', unit:'%', min:0, max:100, step:1, default:100,
    groups:[{key:'low',label:'실행 확률 20%',value:20},{key:'half',label:'실행 확률 50%',value:50},{key:'high',label:'실행 확률 80%',value:80},{key:'always',label:'항상 실행',value:100}], distributionDefaults:[0,0,100,0]},
  {key:'maxLeverage', label:'최대 레버리지', type:'number', unit:'배', min:1, max:3, step:0.1, default:2,
    groups:[{key:'one',label:'차입 없이 투자',note:'최대 1배',value:1,max:1.49},{key:'two',label:'2배까지 허용',note:'최대 2배',value:2,min:1.5,max:2.49},{key:'three',label:'3배까지 허용',note:'최대 3배',value:3,min:2.5}], distributionDefaults:[50,35,15]},
  {key:'newsStyle',label:'기업 소식 대응',type:'choice',default:'confirm',
    options:[{key:'anticipate',label:'선제 대응',note:'사전 기대와 발표 모두 반영'},{key:'confirm',label:'발표 확인',note:'확인된 발표만 반영'},{key:'contrarian',label:'반대 해석',note:'사전 기대·발표의 반대로 판단'},{key:'ignore',label:'소식 무시',note:'기존 가격 대응만 사용'}],distributionDefaults:[35,40,15,10]},
  {key:'newsProbability',label:'소식 반응 확률',type:'number',unit:'%',min:0,max:100,step:1,default:80,
    groups:[{key:'none',label:'반응 확률 0%',value:0},{key:'half',label:'반응 확률 50%',value:50},{key:'high',label:'반응 확률 80%',value:80},{key:'always',label:'항상 반응',value:100}],distributionDefaults:[10,20,50,20]},
  {key:'newsSensitivity',label:'소식 반응 강도',type:'number',unit:'%',min:0,max:200,step:1,default:100,
    groups:[{key:'weak',label:'약한 반응',note:'반응 강도 25%',value:25},{key:'normal',label:'보통 반응',note:'반응 강도 100%',value:100},{key:'strong',label:'강한 반응',note:'반응 강도 180%',value:180}],distributionDefaults:[25,50,25]},
  {key:'newsDelay',label:'소식 반응 지연',type:'number',unit:'초',min:0,max:600,step:10,default:30,
    groups:[{key:'immediate',label:'즉시 반응',value:0},{key:'normal',label:'30초 후 반응',value:30},{key:'slow',label:'2분 후 반응',value:120}],distributionDefaults:[25,50,25]},
  {key:'newsAccess',label:'내부정보 접근',type:'choice',default:'auto',options:[
    {key:'auto',label:'이슈 비율로 배정',note:'이슈별 사전 인지 비율에 따라 배정'},
    {key:'insider',label:'사전 인지자',note:'사전 인지를 켠 이슈의 실제 내용을 먼저 앎'},
    {key:'public',label:'공개 정보만',note:'내부정보를 받지 않음'}],distributionDefaults:[100,0,0]},
  {key:'volumeStyle',label:'거래량 대응',type:'choice',default:'follow',options:[
    {key:'follow',label:'급증 시 추종',note:'상승 급증은 매수, 하락 급증은 매도'},
    {key:'contrarian',label:'과열 때 역행',note:'상승 급증은 매도, 하락 급증은 매수'},
    {key:'reduce',label:'급증 시 보유 축소',note:'매수·공매도 포지션을 줄임'},
    {key:'cautious',label:'저거래량 때 관망',note:'거래량이 기준의 역수 이하이면 관망'},
    {key:'ignore',label:'거래량 무시',note:'기존 가격·기업 소식 대응만 사용'}],distributionDefaults:[35,20,20,15,10]},
  {key:'volumeProbability',label:'거래량 반응 확률',type:'number',unit:'%',min:0,max:100,step:1,default:70,
    groups:[{key:'none',label:'반응 확률 0%',value:0},{key:'half',label:'반응 확률 50%',value:50},{key:'high',label:'반응 확률 80%',value:80},{key:'always',label:'항상 반응',value:100}],distributionDefaults:[0,25,50,25]},
  {key:'volumeSensitivity',label:'거래량 반응 강도',type:'number',unit:'%',min:0,max:200,step:1,default:100,
    groups:[{key:'weak',label:'약한 반응',value:25},{key:'normal',label:'보통 반응',value:100},{key:'strong',label:'강한 반응',value:180}],distributionDefaults:[20,60,20]},
  {key:'volumeThreshold',label:'거래량 급증 기준',type:'number',unit:'배',min:1.2,max:5,step:0.1,default:2,
    groups:[{key:'early',label:'1.5배부터 반응',value:1.5},{key:'normal',label:'2배부터 반응',value:2},{key:'late',label:'3배부터 반응',value:3}],distributionDefaults:[25,50,25]},
  {key:'emotionStyle',label:'감정 대응',type:'choice',default:'follow',options:[
    {key:'follow',label:'공포 매도·탐욕 매수',note:'공포에는 패닉셀, 탐욕에는 추격 매수'},
    {key:'contrarian',label:'감정에 역행',note:'공포에는 매수, 탐욕에는 매도'},
    {key:'cautious',label:'공포 때 관망',note:'공포가 크면 기존 매매를 쉬고 관망'},
    {key:'ignore',label:'감정 매매 안 함',note:'감정을 느껴도 기존 판단으로 거래'}],distributionDefaults:[50,20,20,10]},
  {key:'emotionInitial',label:'평소 감정',type:'number',unit:'점',min:0,max:100,step:1,default:50,
    groups:[{key:'fearful',label:'공포 성향 · 20점',value:20,max:39},{key:'neutral',label:'중립 성향 · 50점',value:50,min:40,max:59},{key:'greedy',label:'탐욕 성향 · 80점',value:80,min:60}],distributionDefaults:[20,60,20]},
  {key:'emotionSensitivity',label:'감정 민감도',type:'number',unit:'%',min:0,max:200,step:1,default:100,
    groups:[{key:'low',label:'낮은 민감도',value:30},{key:'normal',label:'보통 민감도',value:100},{key:'high',label:'높은 민감도',value:180}],distributionDefaults:[25,50,25]},
  {key:'emotionRecovery',label:'감정 회복력',type:'number',unit:'%',min:0,max:100,step:1,default:20,
    groups:[{key:'slow',label:'느린 진정 · 5%',value:5},{key:'normal',label:'보통 진정 · 20%',value:20},{key:'fast',label:'빠른 진정 · 60%',value:60}],distributionDefaults:[25,50,25]},
  {key:'emotionProbability',label:'감정 반응 확률',type:'number',unit:'%',min:0,max:100,step:1,default:70,
    groups:[{key:'none',label:'반응 확률 0%',value:0},{key:'half',label:'반응 확률 50%',value:50},{key:'high',label:'반응 확률 80%',value:80},{key:'always',label:'항상 반응',value:100}],distributionDefaults:[10,25,50,15]},
  {key:'panicThreshold',label:'공포 반응 기준',type:'number',unit:'점 이하',min:0,max:49,step:1,default:25,
    groups:[{key:'patient',label:'15점 이하부터',value:15},{key:'normal',label:'25점 이하부터',value:25},{key:'early',label:'35점 이하부터',value:35}],distributionDefaults:[25,50,25]},
  {key:'greedThreshold',label:'탐욕 반응 기준',type:'number',unit:'점 이상',min:51,max:100,step:1,default:75,
    groups:[{key:'early',label:'65점 이상부터',value:65},{key:'normal',label:'75점 이상부터',value:75},{key:'patient',label:'85점 이상부터',value:85}],distributionDefaults:[25,50,25]}
];

export const REACTIONS = {
  buy: {label:'매수', riseLabel:'추격 매수', fallLabel:'저가 매수', noise:true, target:({risk,allocationWeight=1}) => (0.4 + risk * 0.55)*allocationWeight},
  leverage: {label:'레버리지 매수', noise:true, target:({risk, agent,allocationWeight=1}) => (1 + risk * (agent.traits.maxLeverage - 1))*allocationWeight},
  takeProfit: {label:'수익실현', target:({exposure, risk,allocationWeight=1}) => Math.max(0, exposure - (0.06 + risk * 0.18)*allocationWeight)},
  sell: {label:'보유 주식 축소', riseLabel:'보유 주식 축소', fallLabel:'손절 매도', target:({exposure}) => Math.max(0, exposure * 0.35)},
  short: {label:'하락 베팅 · 공매도', noise:true, target:({risk,allocationWeight=1}) => -(0.1 + risk * 0.65)*allocationWeight},
  rebalance: {label:'초기 비중 유지', target:({agent,allocationWeight=1}) => agent.traits.allocation / 100*allocationWeight},
  hold: {label:'관망 · 보유 유지', keepShares:true, target:({exposure}) => exposure}
};

export const COMPANY_FINANCIAL_FIELDS = [
  {key:'revenue',label:'연간 매출액',group:'income',unit:'억원',min:0,max:1000000,step:0.01,default:10},
  {key:'operatingProfit',label:'연간 영업이익',group:'income',unit:'억원',min:-1000000,max:1000000,step:0.01,default:1.2},
  {key:'netIncome',label:'연간 순이익',group:'income',unit:'억원',min:-1000000,max:1000000,step:0.01,default:0.8},
  {key:'assets',label:'자산총계',group:'balance',unit:'억원',min:0,max:1000000,step:0.01,default:6},
  {key:'liabilities',label:'부채총계',group:'balance',unit:'억원',min:0,max:1000000,step:0.01,default:2},
  {key:'referencePER',label:'참조 PER',group:'valuation',unit:'배',min:1,max:1000,step:0.1,default:10},
  {key:'priceInfluence',label:'재무정보 반영도',group:'valuation',unit:'%',min:0,max:100,step:1,default:0}
];
export const DEFAULT_FINANCIALS = Object.fromEntries(COMPANY_FINANCIAL_FIELDS.map(field=>[field.key,field.default]));

export const COMPANY_NEWS_FIELDS = [
  {key:'announceMinute',label:'발표 시점',group:'timing',unit:'시작 후 분',min:1,max:1440,step:1},
  {key:'leadMinutes',label:'사전 기대 공개',group:'timing',unit:'발표 전 분',min:0,max:1440,step:1},
  {key:'durationMinutes',label:'발표 후 관심 기간',group:'timing',unit:'분',min:1,max:120,step:1},
  {key:'expectedImpact',label:'발표 전 기대',group:'content',unit:'%',min:-30,max:30,step:1},
  {key:'actualImpact',label:'실제 발표 내용',group:'content',unit:'%',min:-30,max:30,step:1},
  {key:'insiderMode',label:'발표 전 내부정보',group:'information',type:'choice',default:'none',options:[{key:'none',label:'아무도 모름'},{key:'enabled',label:'일부 참여자 인지'}]},
  {key:'insiderLeadMinutes',label:'내부정보 전달',group:'information',unit:'발표 전 분',min:0,max:1440,step:1,default:1},
  {key:'insiderRatio',label:'자동 배정 비율',group:'information',unit:'%',min:0,max:100,step:1,default:20}
];
export const DEFAULT_COMPANY_NEWS = [
  {id:'earnings',title:'실적 개선 발표',announceMinute:5,leadMinutes:3,durationMinutes:10,expectedImpact:5,actualImpact:8},
  {id:'contract',title:'신규 계약 결과',announceMinute:12,leadMinutes:4,durationMinutes:10,expectedImpact:6,actualImpact:-7},
  {id:'production',title:'생산 차질 공시',announceMinute:20,leadMinutes:0,durationMinutes:8,expectedImpact:0,actualImpact:-6}
];
export const MAX_COMPANY_NEWS = 20;
export function normalizeCompanyNews(raw = []) {
  if(!Array.isArray(raw) || raw.length>MAX_COMPANY_NEWS)throw new Error(`기업 소식은 ${MAX_COMPANY_NEWS}개까지 설정할 수 있습니다.`);
  const ids=new Set();
  return raw.map((event,index)=>{
    if(!event || typeof event!=='object')throw new Error(`${index+1}번 기업 소식을 입력하세요.`);
    const id=String(event.id ?? `news-${index+1}`), title=String(event.title ?? '').trim();
    if(!/^[a-zA-Z0-9_-]{1,48}$/.test(id) || ids.has(id))throw new Error('기업 소식의 식별자가 중복되거나 올바르지 않습니다.');
    ids.add(id);
    if(!title || title.length>40)throw new Error(`${index+1}번 소식 제목을 1~40자로 입력하세요.`);
    const values=Object.fromEntries(COMPANY_NEWS_FIELDS.map(field=>{
      const value=event[field.key] ?? field.default, number=Number(value);
      if(field.type==='choice'){
        if(!field.options.some(option=>option.key===value))throw new Error(`${title}: ${field.label}을 선택하세요.`);
        return [field.key,value];
      }
      if(value==='' || !Number.isInteger(number) || number<field.min || number>field.max)throw new Error(`${title}: ${field.label}은 ${field.min}~${field.max}${field.unit} 범위의 정수로 입력하세요.`);
      return [field.key,number];
    }));
    if(values.leadMinutes>values.announceMinute)throw new Error(`${title}: 사전 기대는 시뮬레이션 시작 이후에 공개하도록 설정하세요.`);
    if(values.insiderLeadMinutes>values.announceMinute)throw new Error(`${title}: 내부정보 전달은 시뮬레이션 시작 이후로 설정하세요.`);
    return {id,title,...values};
  });
}

export const MAX_LIVE_ISSUES=30;
export function normalizeCompanyIssue(raw={}){
  const title=String(raw.title ?? '').trim();
  if(!title || title.length>40)throw new Error('이슈 제목은 1~40자로 입력하세요.');
  const result={title,insiderMode:raw.insiderMode ?? 'none'};
  if(!['none','enabled'].includes(result.insiderMode))throw new Error('발표 전 내부정보 공개 범위를 선택하세요.');
  for(const [key,label,min,max,fallback] of [['actualImpact','가치 변화',-30,30,8],['durationMinutes','관심 기간',1,120,10],['announceDelayMinutes','발표 대기',0,60,3],['insiderLeadMinutes','내부정보 전달',0,60,2],['insiderRatio','자동 배정 비율',0,100,20]]){
    const value=raw[key] ?? fallback,number=Number(value);
    if(value==='' || !Number.isInteger(number) || number<min || number>max)throw new Error(`${label}: ${min}~${max} 범위의 정수로 입력하세요.`);
    result[key]=number;
  }
  if(result.insiderMode==='enabled' && result.insiderLeadMinutes>result.announceDelayMinutes)throw new Error('내부정보 전달 시간은 발표 대기 시간 이내로 설정하세요.');
  return result;
}

// News draws have their own stable stream. Editing an unpublished outcome or
// adding a future event must not change any earlier opinion or market draw.
function newsDraw(seed,agentId,eventId,phase) {
  let state=seed>>>0;
  for(const char of `${agentId}:${eventId}:${phase}`)state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
  state=Math.imul(state^(state>>>16),0x21f0aaad);
  state=Math.imul(state^(state>>>15),0x735a2d97);
  return ((state^(state>>>15))>>>0)/4294967296;
}

export const MACRO_BASELINE = {gdpGrowth:2,inflation:2,policyRate:3};
export const MACRO_FIELDS = [
  {key:'gdpGrowth',label:'실질 GDP 성장률',unit:'%',min:-20,max:20,step:0.1,default:2},
  {key:'inflation',label:'소비자물가 상승률',unit:'%',min:-5,max:30,step:0.1,default:2},
  {key:'policyRate',label:'기준금리',unit:'%',min:-2,max:30,step:0.1,default:3},
  {key:'influence',label:'거시경제 반영도',unit:'%',min:0,max:100,step:1,default:100}
];
export const DEFAULT_MACRO = Object.fromEntries(MACRO_FIELDS.map(field=>[field.key,field.default]));
export const MACRO_PRESETS = {
  baseline:{label:'기준',values:{gdpGrowth:2,inflation:2,policyRate:3}},
  expansion:{label:'호황',values:{gdpGrowth:5,inflation:2.5,policyRate:3.5}},
  recession:{label:'침체',values:{gdpGrowth:-2,inflation:1,policyRate:2}},
  inflation:{label:'고물가',values:{gdpGrowth:-1,inflation:7,policyRate:6}}
};
export const COMPANY_CYCLE_TYPES = {
  cyclical:{label:'경기순환주',gdpSensitivity:1.8,inflationSensitivity:0.75,rateSensitivity:6},
  defensive:{label:'경기방어주',gdpSensitivity:0.35,inflationSensitivity:0.25,rateSensitivity:4},
  neutral:{label:'중립형',gdpSensitivity:1,inflationSensitivity:0.5,rateSensitivity:5}
};
export const COMPANY_EXPOSURE_FIELDS = [
  {key:'gdpSensitivity',label:'GDP 민감도',unit:'배',min:0,max:5,step:0.05},
  {key:'inflationSensitivity',label:'물가 비용 민감도',unit:'배',min:0,max:3,step:0.05},
  {key:'rateSensitivity',label:'금리 민감도',unit:'배',min:0,max:20,step:0.5}
];
export function normalizeMacro(raw = {}) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw new Error('거시경제 지표를 입력하세요.');
  return Object.fromEntries(MACRO_FIELDS.map(field=>{
    const value=raw[field.key] ?? field.default, number=Number(value);
    if(value==='' || !Number.isFinite(number) || number<field.min || number>field.max)throw new Error(`${field.label}: ${field.min}~${field.max}${field.unit} 범위로 입력하세요.`);
    return [field.key,number];
  }));
}
export function normalizeCompanyProfile(raw = {}) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw new Error('기업 유형을 설정하세요.');
  const cyclicality=raw.cyclicality ?? 'neutral';
  if(!Object.hasOwn(COMPANY_CYCLE_TYPES,cyclicality))throw new Error('경기순환주·경기방어주·중립형 중에서 선택하세요.');
  const preset=COMPANY_CYCLE_TYPES[cyclicality];
  return {cyclicality,...Object.fromEntries(COMPANY_EXPOSURE_FIELDS.map(field=>{
    const value=raw[field.key] ?? preset[field.key], number=Number(value);
    if(value==='' || !Number.isFinite(number) || number<field.min || number>field.max)throw new Error(`${field.label}: ${field.min}~${field.max}${field.unit} 범위로 입력하세요.`);
    return [field.key,number];
  }))};
}
export const DEFAULT_COMPANY_PROFILE = normalizeCompanyProfile();

export function normalizeFinancials(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('회사 재무정보를 입력하세요.');
  return Object.fromEntries(COMPANY_FINANCIAL_FIELDS.map(field=>{
    const value=raw[field.key] ?? field.default, number=Number(value);
    if(value==='' || !Number.isFinite(number) || number<field.min || number>field.max) throw new Error(`${field.label}: ${field.min}~${field.max}${field.unit} 범위로 입력하세요.`);
    return [field.key,number];
  }));
}

// Inputs use KRW 100 million; monetary metrics use KRW. Share supply is the
// modeled company's initial participant holdings, not a separate invented float.
export function calculateCompanyMetrics(financials, price, shares) {
  return companyMetricsFromValues(normalizeFinancials(financials),price,shares);
}
function companyMetricsFromValues(f, price, shares) {
  const unit=100000000;
  const revenue=f.revenue*unit, operatingProfit=f.operatingProfit*unit, netIncome=f.netIncome*unit;
  const assets=f.assets*unit, liabilities=f.liabilities*unit, equity=assets-liabilities;
  const hasShares=Number.isFinite(shares) && shares>0;
  const marketCap=hasShares && Number.isFinite(price) && price>0 ? price*shares : null;
  const eps=hasShares ? netIncome/shares : null, bps=hasShares ? equity/shares : null;
  return {revenue,operatingProfit,netIncome,assets,liabilities,equity,shares,marketCap,eps,bps,
    per:marketCap!==null && netIncome>0 ? marketCap/netIncome : null,
    pbr:marketCap!==null && equity>0 ? marketCap/equity : null,
    roe:equity>0 ? netIncome/equity*100 : null,
    operatingMargin:revenue>0 ? operatingProfit/revenue*100 : null,
    netMargin:revenue>0 ? netIncome/revenue*100 : null,
    debtRatio:equity>0 ? liabilities/equity*100 : null,
    equityRatio:assets>0 ? equity/assets*100 : null,
    referencePrice:hasShares ? (netIncome>0 ? eps*f.referencePER : Math.max(0,bps)) : null,
    priceInfluence:f.priceInfluence};
}

// A fixed annual scenario, not an intraday GDP process or a fitted forecasting
// model. Keep observed inputs separate from scenario-adjusted earnings.
export function calculateEconomicScenario(financials, macro, companyProfile, price, shares) {
  const f=normalizeFinancials(financials), m=normalizeMacro(macro), p=normalizeCompanyProfile(companyProfile);
  const weight=m.influence/100;
  const gdpGap=(m.gdpGrowth-MACRO_BASELINE.gdpGrowth)/100;
  const inflationGap=(m.inflation-MACRO_BASELINE.inflation)/100;
  const rateGap=(m.policyRate-MACRO_BASELINE.policyRate)/100;
  const revenueFactor=1+(clamp(1+p.gdpSensitivity*gdpGap,0.1,3)-1)*weight;
  const baseCost=Math.max(0,f.revenue-f.operatingProfit);
  // 70% of operating costs vary with sales in this simplified model.
  const contribution=Math.max(0,f.revenue-baseCost*0.7);
  const profitDelta=contribution*(revenueFactor-1)-baseCost*inflationGap*p.inflationSensitivity*weight;
  const rateFactor=1+(clamp(Math.exp(-p.rateSensitivity*rateGap),0.25,2)-1)*weight;
  const earningsScale=Math.max(Math.abs(f.netIncome),f.revenue*0.05,0.01);
  const valuationFactor=clamp(clamp(1+profitDelta/earningsScale,0.1,3)*rateFactor,0.1,3);
  const adjustedFinancials={...f,revenue:f.revenue*revenueFactor,operatingProfit:f.operatingProfit+profitDelta,netIncome:f.netIncome+profitDelta,referencePER:f.referencePER*rateFactor};
  return {macro:m,companyProfile:p,revenueFactor,profitDelta,rateFactor,valuationFactor,adjustedFinancials,
    adjustedMetrics:companyMetricsFromValues(adjustedFinancials,price,shares),
    phase:m.gdpGrowth<0?'GDP 감소':m.gdpGrowth>MACRO_BASELINE.gdpGrowth?'성장률 기준 상회':m.gdpGrowth<MACRO_BASELINE.gdpGrowth?'성장률 기준 하회':'기준 시나리오'};
}

export const DEFAULT_CONFIG = {
  company:'필드테크', initialPrice:10000, seed:42, financials:DEFAULT_FINANCIALS, macro:DEFAULT_MACRO, companyProfile:DEFAULT_COMPANY_PROFILE, companyNews:DEFAULT_COMPANY_NEWS,
  participants:[
    {name:'추세 추종자', wealth:15000, risk:85, allocation:45, onRise:'leverage', onFall:'sell', riseProbability:80, fallProbability:80, maxLeverage:2.5, newsStyle:'anticipate',newsProbability:90,newsSensitivity:130,newsDelay:0},
    {name:'가치 투자자', wealth:20000, risk:40, allocation:60, onRise:'takeProfit', onFall:'buy', riseProbability:80, fallProbability:90, maxLeverage:1, newsStyle:'confirm',newsProbability:90,newsSensitivity:80,newsDelay:30},
    {name:'단기 매매자', wealth:8000, risk:75, allocation:50, onRise:'buy', onFall:'short', riseProbability:70, fallProbability:70, maxLeverage:2, newsStyle:'anticipate',newsProbability:80,newsSensitivity:160,newsDelay:0},
    {name:'장기 보유자', wealth:25000, risk:20, allocation:70, onRise:'rebalance', onFall:'rebalance', riseProbability:100, fallProbability:100, maxLeverage:1, newsStyle:'confirm',newsProbability:60,newsSensitivity:30,newsDelay:120},
    {name:'역발상 투자자', wealth:10000, risk:60, allocation:40, onRise:'short', onFall:'buy', riseProbability:80, fallProbability:80, maxLeverage:1.5, newsStyle:'contrarian',newsProbability:80,newsSensitivity:100,newsDelay:10},
    {name:'현금 대기자', wealth:12000, risk:35, allocation:15, onRise:'buy', onFall:'hold', riseProbability:60, fallProbability:50, maxLeverage:1, newsStyle:'ignore',newsProbability:0,newsSensitivity:50,newsDelay:60}
  ]
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const copy = value => JSON.parse(JSON.stringify(value));
export const TICKS_PER_CANDLE = 6;
export const VOLUME_BASELINE_TICKS = 30;

// Compare disjoint, completed trading windows. An empty baseline never becomes
// an infinite spike; halted ticks are excluded by the caller.
export function calculateVolumeSignal(history){
  const recent=history.slice(-TICKS_PER_CANDLE),baseline=history.slice(-(TICKS_PER_CANDLE+VOLUME_BASELINE_TICKS),-TICKS_PER_CANDLE);
  const recentVolume=recent.reduce((sum,volume)=>sum+volume,0);
  const baselineVolume=baseline.length?baseline.reduce((sum,volume)=>sum+volume,0)/baseline.length*TICKS_PER_CANDLE:0;
  const samples=Math.min(history.length,TICKS_PER_CANDLE+VOLUME_BASELINE_TICKS);
  const ready=recent.length===TICKS_PER_CANDLE && baseline.length>=TICKS_PER_CANDLE && baselineVolume>0;
  const ratio=ready?recentVolume/baselineVolume:null;
  const phase=history.length<TICKS_PER_CANDLE*2?'warming':!ready?'noBaseline':ratio>=2?'burst':ratio<=0.5?'dry':'normal';
  return {recentVolume,baselineVolume,baselineTicks:baseline.length,recentTicks:recent.length,samples,ready,ratio,phase};
}

export function emotionBand(score){
  return score<=25?{key:'extremeFear',label:'극단적 공포'}:score<40?{key:'fear',label:'공포'}:score<60?{key:'neutral',label:'중립'}:score<75?{key:'greed',label:'탐욕'}:{key:'extremeGreed',label:'극단적 탐욕'};
}

// Emotion follows settled observations only. Everyone sees the previous crowd
// snapshot, avoiding participant iteration order affecting social contagion.
export function advanceEmotion(previous,traits,{momentum=0,tickReturn=0,drawdown=0,equityChange=0,crowd=50,volumeRatio=null,halted=false}={}){
  const baseline=traits.emotionInitial ?? 50,recovery=(traits.emotionRecovery ?? 20)/100*0.25;
  let impulse=0;
  if(!halted){
    const amplification=1+clamp((volumeRatio ?? 1)-1,0,2)*0.25;
    const loss=equityChange*(equityChange<0?240:150);
    impulse=clamp(((momentum*130+tickReturn*350+drawdown*40)*amplification+loss+(crowd-previous)*0.035)*(traits.emotionSensitivity ?? 100)/100,-15,15);
  }
  return clamp(previous+(baseline-previous)*recovery+impulse,0,100);
}
export const TICK_SECONDS = 10;
export const MAX_PARTICIPANTS = 100;
const newsStyleLabel = key => PARTICIPANT_ATTRIBUTES.find(attribute=>attribute.key==='newsStyle').options.find(option=>option.key===key)?.label || '발표 확인';

export function distributionGroups(attribute, reactions = REACTIONS) {
  if (attribute.type === 'reaction') return Object.entries(reactions).map(([key,reaction]) => ({key, value:key, label:(attribute.key === 'onRise' ? reaction.riseLabel : reaction.fallLabel) || reaction.label}));
  if (attribute.type === 'choice') return attribute.options.map(option=>({...option,value:option.key}));
  return attribute.groups || [{key:'default',label:`${attribute.default}${attribute.unit || ''}`,value:attribute.default}];
}

// Largest remainders keep integer headcounts exact, including small populations.
export function allocatePopulation(total, weights) {
  const sum = weights.reduce((s,n) => s+n,0);
  if (!Number.isInteger(total) || total < 0 || !weights.length || weights.some(n => !Number.isFinite(n) || n < 0) || sum <= 0) throw new Error('비율에 0 이상의 숫자를 입력하고 합계를 0보다 크게 설정하세요.');
  const quotas = weights.map(n => n/sum*total), counts = quotas.map(Math.floor);
  const order = quotas.map((n,i) => ({i,remainder:n-counts[i]})).sort((a,b) => b.remainder-a.remainder || a.i-b.i);
  for (let i=0, left=total-counts.reduce((s,n)=>s+n,0); i<left; i++) counts[order[i].i]++;
  return counts;
}

export function defaultPopulation(attributes = PARTICIPANT_ATTRIBUTES, reactions = REACTIONS) {
  const distributions = {};
  for (const attribute of attributes) {
    const groups = distributionGroups(attribute,reactions);
    distributions[attribute.key] = Object.fromEntries(groups.map((group,i) => [group.key,Array.isArray(attribute.distributionDefaults) ? attribute.distributionDefaults[i] || 0 : attribute.distributionDefaults?.[group.key] ?? (i === 0 && !attribute.distributionDefaults ? 100 : 0)]));
  }
  return {enabled:false,count:20,distributions};
}

export function normalizePopulation(raw, attributes = PARTICIPANT_ATTRIBUTES, reactions = REACTIONS) {
  const fallback = defaultPopulation(attributes,reactions), count = Number(raw?.count);
  if (!Number.isInteger(count) || count < 2 || count > MAX_PARTICIPANTS) throw new Error(`전체 참여자는 2~${MAX_PARTICIPANTS}명으로 설정하세요.`);
  const distributions = {};
  for (const attribute of attributes) {
    const groups = distributionGroups(attribute,reactions), values = raw.distributions?.[attribute.key] || fallback.distributions[attribute.key];
    distributions[attribute.key] = Object.fromEntries(groups.map(group => {
      const rawValue = values[group.key] ?? 0, value = Number(rawValue);
      if (rawValue === '' || !Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${attribute.label}: 비율은 0~100%로 입력하세요.`);
      return [group.key,value];
    }));
    const sum = Object.values(distributions[attribute.key]).reduce((s,n)=>s+n,0);
    if (Math.abs(sum-100) > 1e-8) throw new Error(`${attribute.label}: 비율 합계를 100%로 맞춰주세요. 현재 ${Number(sum.toFixed(2))}%입니다.`);
  }
  return {enabled:Boolean(raw.enabled),count,distributions};
}

export function generatePopulation(raw, seed, attributes = PARTICIPANT_ATTRIBUTES, reactions = REACTIONS) {
  const population = normalizePopulation(raw,attributes,reactions);
  const participants = Array.from({length:population.count},(_,i) => ({name:`참여자 ${String(i+1).padStart(2,'0')}`}));
  for (const attribute of attributes) {
    const groups = distributionGroups(attribute,reactions), counts = allocatePopulation(population.count,groups.map(g => population.distributions[attribute.key][g.key]));
    const values = groups.flatMap((g,i) => Array(counts[i]).fill(g.value));
    // Each attribute gets its own seeded shuffle, so adding another attribute
    // neither aligns every wealthy participant with high risk nor reshuffles old traits.
    let state = Number(seed) >>> 0;
    for (const char of attribute.key) state = Math.imul(state ^ char.charCodeAt(0),16777619) >>> 0;
    for (let i=values.length-1;i>0;i--) {
      state = (Math.imul(state,1664525)+1013904223) >>> 0;
      const j = Math.floor(state/4294967296*(i+1));
      [values[i],values[j]] = [values[j],values[i]];
    }
    participants.forEach((p,i) => {p[attribute.key] = values[i];});
  }
  return participants;
}

export function normalizeConfig(raw, attributes = PARTICIPANT_ATTRIBUTES, reactions = REACTIONS) {
  if (!raw) throw new Error('시장 설정을 입력하세요.');
  const company = String(raw.company ?? '').trim();
  if (!company || company.length > 24) throw new Error('회사 이름을 1~24자로 입력하세요.');
  const initialPrice = Number(raw.initialPrice), seed = Number(raw.seed);
  if (!Number.isInteger(initialPrice) || initialPrice < 100 || initialPrice > 1000000) throw new Error('시작 주가는 100~1,000,000원 사이의 정수로 입력하세요.');
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647) throw new Error('난수값은 1~2,147,483,647 사이의 정수로 입력하세요.');
  const population = raw.population?.enabled ? normalizePopulation(raw.population,attributes,reactions) : null;
  const rows = population ? generatePopulation(population,seed,attributes,reactions) : raw.participants;
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > MAX_PARTICIPANTS) throw new Error(`참여자는 2명부터 ${MAX_PARTICIPANTS}명까지 설정할 수 있습니다.`);
  const participants = rows.map((row, index) => {
    const name = String(row.name ?? '').trim();
    if (!name || name.length > 24) throw new Error(`${index + 1}번 참여자 이름을 1~24자로 입력하세요.`);
    const traits = {name};
    for (const attribute of attributes) {
      const value = row[attribute.key] ?? attribute.default;
      if (attribute.type === 'reaction') {
        if (!Object.hasOwn(reactions, value)) throw new Error(`${name}: 매매 대응을 선택하세요.`);
        traits[attribute.key] = value;
      } else if (attribute.type === 'choice') {
        if(!attribute.options.some(option=>option.key===value))throw new Error(`${name}: ${attribute.label}을 선택하세요.`);
        traits[attribute.key]=value;
      } else {
        const number = Number(value);
        if (value === '' || !Number.isFinite(number) || number < attribute.min || number > attribute.max) {
          throw new Error(`${name}: ${attribute.label}은 ${attribute.min}~${attribute.max}${attribute.unit || ''} 범위로 입력하세요.`);
        }
        if (attribute.key === 'wealth' && !Number.isSafeInteger(number * 10000)) throw new Error(`${name}: 재산은 원 단위로 계산 가능한 값을 입력하세요.`);
        traits[attribute.key] = number;
      }
    }
    return traits;
  });
  const financials=normalizeFinancials(raw.financials ?? {});
  const macro=normalizeMacro(raw.macro ?? {}), companyProfile=normalizeCompanyProfile(raw.companyProfile ?? {});
  const companyNews=normalizeCompanyNews(raw.companyNews ?? []);
  return {company, initialPrice, seed, financials, macro, companyProfile, companyNews, participants, ...(population ? {population} : {})};
}

export class MarketSimulation {
  constructor(config = DEFAULT_CONFIG, {attributes = PARTICIPANT_ATTRIBUTES, reactions = REACTIONS, decisionModifiers = [],allocationWeight=1} = {}) {
    this.config = normalizeConfig(copy(config), attributes, reactions);
    this.reactions = reactions;
    this.decisionModifiers = decisionModifiers;
    this.allocationWeight=allocationWeight;
    this.manualAgent=null;
    this.manualOrder=null;
    this.manualOrderSequence=0;
    this.randomState = this.config.seed >>> 0;
    this.tick = 0;
    this.price = this.config.initialPrice;
    this.high = this.price;
    this.low = this.price;
    this.peak = this.price;
    this.maxDrawdown = 0;
    this.totalVolume = 0;
    this.volumeHistory = [];
    this.totalTrades = 0;
    this.sentiment = 0;
    this.candles = [];
    this.prices = [this.price];
    this.trades = [];
    this.newsLog = [];
    this.orderBook = {bids:[], asks:[]};
    this.last = {volume:0, tradeCount:0, buyQuantity:0, sellQuantity:0, orders:[], decisions:[]};
    this.agents = this.config.participants.map((traits, index) => {
      const initialEquity = traits.wealth * 10000;
      const shares = Math.floor(initialEquity * traits.allocation / 100 * this.allocationWeight / this.price);
      return {id:`p${index + 1}`, traits, initialEquity, shares, cash:initialEquity - shares * this.price, lastAction:'시작 전', lastReason:'설정한 주식 비중으로 배분', lastFilled:0, marginCalls:0,emotion:traits.emotionInitial ?? 50,emotionLastEquity:initialEquity};
    });
    this.newsEvents=this.config.companyNews.map(event=>{
      const announceTick=event.announceMinute*TICKS_PER_CANDLE;
      return {...event,createdTick:0,source:'scheduled',announceTick,rumorTick:event.leadMinutes>0?announceTick-event.leadMinutes*TICKS_PER_CANDLE:null,endTick:announceTick+event.durationMinutes*TICKS_PER_CANDLE,insiderTick:event.insiderMode==='enabled' && event.insiderLeadMinutes>0?announceTick-event.insiderLeadMinutes*TICKS_PER_CANDLE:null};
    });
    this.insiderAssignments=new Map();this.liveIssueSequence=0;
    this.initialCash = this.agents.reduce((sum, a) => sum + a.cash, 0);
    this.totalShares = this.agents.reduce((sum, a) => sum + a.shares, 0);
    const metrics=calculateCompanyMetrics(this.config.financials,this.price,this.totalShares);
    this.referencePrice=metrics.referencePrice;
    const weight=this.config.financials.priceInfluence/100;
    this.baseValueAnchor=Math.max(1,this.config.initialPrice*(1-weight)+(this.referencePrice ?? this.config.initialPrice)*weight);
    this.economicScenario=calculateEconomicScenario(this.config.financials,this.config.macro,this.config.companyProfile,this.price,this.totalShares);
    this.valueAnchor=Math.max(1,this.baseValueAnchor*this.economicScenario.valuationFactor);
  }

  random() {
    this.randomState = (this.randomState + 0x6D2B79F5) >>> 0;
    let t = this.randomState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  equity(agent, price = this.price) { return agent.cash + agent.shares * price; }

  queueManualOrder(raw) {
    if(!this.manualAgent)throw new Error('내 계좌가 연결되지 않았습니다.');
    if(this.tradingHalted)throw new Error('거래 중단 중에는 새 주문을 접수하지 않습니다.');
    if(this.manualOrder && ['queued','open','partial'].includes(this.manualOrder.status))throw new Error('이 종목의 대기 주문을 먼저 취소하세요.');
    const quantity=Number(raw.quantity),type=raw.type,action=raw.action;
    if(!Number.isSafeInteger(quantity) || quantity<1)throw new Error('주문 수량은 정확히 계산할 수 있는 1주 이상의 정수로 입력하세요.');
    if(!['market','limit'].includes(type) || !['buy','sell','short'].includes(action))throw new Error('주문 종류와 매매 방향을 선택하세요.');
    const limit=type==='limit'?Number(raw.limit):this.price;
    if(!Number.isInteger(limit) || limit<1 || limit>1000000000)throw new Error('지정가는 1~1,000,000,000원 사이의 정수로 입력하세요.');
    const side=action==='buy'?'buy':'sell',allowShort=action==='short';
    const capacity=this.capacity(this.manualAgent,side,limit,{allowShort});
    if(quantity>capacity)throw new Error(`현재 조건의 주문 가능 수량은 최대 ${capacity.toLocaleString('ko-KR')}주입니다.`);
    this.manualOrder={id:`${this.assetId || 'stock'}-${++this.manualOrderSequence}`,assetId:this.assetId,action,side,type,limit:type==='limit'?limit:null,allowShort,quantity,remaining:quantity,filledQuantity:0,amount:0,status:'queued',createdTick:this.tick,beforePrice:this.price,afterPrice:this.price,lastFillTick:null,reaction:null};
    return this.manualOrder;
  }

  cancelManualOrder(reason='사용자 취소') {
    const order=this.manualOrder;
    if(!order || !['queued','open','partial'].includes(order.status))return false;
    order.status=order.filledQuantity?'partialCanceled':'canceled';order.reason=reason;
    this.orderBook={bids:this.orderBook.bids.filter(item=>item.manualRequest!==order),asks:this.orderBook.asks.filter(item=>item.manualRequest!==order)};
    return true;
  }

  triggerCompanyIssue(raw){
    const value=normalizeCompanyIssue(raw);
    if(this.newsEvents.filter(event=>event.source==='manual').length>=MAX_LIVE_ISSUES)throw new Error(`직접 발동 이슈는 종목당 실험 중 ${MAX_LIVE_ISSUES}개까지 등록할 수 있습니다.`);
    let id;do{id=`live-${++this.liveIssueSequence}`;}while(this.newsEvents.some(event=>event.id===id));
    const announceTick=this.tick+value.announceDelayMinutes*TICKS_PER_CANDLE;
    const event={...value,id,createdTick:this.tick,source:'manual',announceTick,rumorTick:null,expectedImpact:0,endTick:announceTick+value.durationMinutes*TICKS_PER_CANDLE,insiderTick:value.insiderMode==='enabled' && value.insiderLeadMinutes>0?announceTick-value.insiderLeadMinutes*TICKS_PER_CANDLE:null};
    this.newsEvents.push(event);
    if(announceTick===this.tick)this.logAnnouncement(event);
    return event;
  }
  logAnnouncement(event){
    this.newsLog.push({tick:this.tick,eventId:event.id,title:event.title,phase:'announced',impact:event.actualImpact});this.newsLog=this.newsLog.slice(-40);
  }
  announceCompanyIssue(id){
    const event=this.newsEvents.find(item=>item.id===id);
    if(!event || this.tick>=event.announceTick)throw new Error('아직 발표하지 않은 기업 이슈를 선택하세요.');
    event.announceTick=this.tick;event.endTick=this.tick+event.durationMinutes*TICKS_PER_CANDLE;
    if(event.rumorTick>this.tick)event.rumorTick=null;
    event.manuallyAnnounced=true;this.logAnnouncement(event);return event;
  }
  hasInsiderAccess(event,agent){
    if(event.insiderMode!=='enabled' || event.insiderTick===null)return false;
    if(agent.traits.newsAccess==='public')return false;
    if(agent.traits.newsAccess==='insider')return true;
    if(!this.insiderAssignments.has(event.id)){
      const automatic=this.agents.filter(person=>(person.traits.newsAccess ?? 'auto')==='auto').map(person=>({id:person.id,rank:newsDraw(this.config.seed,person.id,event.id,'insider-access')})).sort((a,b)=>a.rank-b.rank || (a.id<b.id?-1:1));
      this.insiderAssignments.set(event.id,new Set(automatic.slice(0,Math.round(automatic.length*event.insiderRatio/100)).map(person=>person.id)));
    }
    return this.insiderAssignments.get(event.id).has(agent.id);
  }
  informationFor(event,agent,tick=this.tick){
    const delay=Math.ceil((agent.traits.newsDelay ?? 30)/TICK_SECONDS);
    if(tick<event.createdTick)return {phase:'unknown',receivedTick:null};
    const expired=tick>=event.endTick;
    if(tick>=event.announceTick+delay)return {phase:expired?'expired':'announced',receivedPhase:'announced',receivedTick:event.announceTick+delay,impact:event.actualImpact,weight:Math.max(0,(event.endTick-tick)/(event.endTick-event.announceTick))};
    if(this.hasInsiderAccess(event,agent) && tick>=event.insiderTick+delay)return {phase:expired?'expired':'insider',receivedPhase:'insider',receivedTick:event.insiderTick+delay,impact:event.actualImpact,weight:1};
    if(event.rumorTick!==null && tick>=event.rumorTick+delay)return {phase:expired?'expired':'rumor',receivedPhase:'rumor',receivedTick:event.rumorTick+delay,impact:event.expectedImpact,weight:1};
    return {phase:expired?'expired':'unknown',receivedTick:null};
  }
  informationReport(id){
    const event=this.newsEvents.find(item=>item.id===id);if(!event)return [];
    return this.agents.map(agent=>({id:agent.id,name:agent.traits.name,access:agent.traits.newsAccess ?? 'auto',insider:this.hasInsiderAccess(event,agent),...this.informationFor(event,agent)}));
  }
  publicNews() {
    return this.newsEvents.map(event=>{
      const {announceTick,rumorTick,endTick,insiderTick}=event;
      const announced=this.tick>=announceTick, rumored=rumorTick!==null && this.tick>=rumorTick;
      const insiders=this.agents.filter(agent=>this.hasInsiderAccess(event,agent));
      const insiderInformed=insiders.filter(agent=>{const received=insiderTick+Math.ceil(agent.traits.newsDelay/TICK_SECONDS);return received<announceTick && this.tick>=received;}).length;
      return {id:event.id,title:event.title,announceTick,rumorTick,endTick,insiderTick,insiderCount:insiders.length,insiderInformed,source:event.source,
        phase:this.tick>=endTick?'expired':announced?'announced':rumored?'rumor':insiderInformed?'insider':'scheduled',
        expectedImpact:rumored?event.expectedImpact:null,actualImpact:announced?event.actualImpact:null,
        surprise:announced && rumored?event.actualImpact-event.expectedImpact:null};
    });
  }

  newsOpinion(agent, tick = this.tick) {
    const {newsStyle='confirm',newsProbability=80,newsSensitivity=100}=agent.traits;
    if(newsStyle==='ignore' || newsSensitivity===0)return {effect:0,details:[]};
    const details=[];
    for(const event of this.newsEvents){
      const {phase,impact,weight}=this.informationFor(event,agent,tick);
      if(['unknown','expired'].includes(phase) || (phase==='rumor' && newsStyle==='confirm'))continue;
      const draw=newsProbability>0 && newsProbability<100?newsDraw(this.config.seed,agent.id,event.id,phase):null;
      const accepted=newsProbability===100 || (draw!==null && draw<newsProbability/100);
      const effect=accepted?impact/100*newsSensitivity/100*weight*(newsStyle==='contrarian'?-1:1):0;
      details.push({eventId:event.id,title:event.title,phase,impact,probability:newsProbability,draw,accepted,effect});
    }
    return {effect:clamp(details.reduce((sum,item)=>sum+item.effect,0),-0.5,0.5),details};
  }

  capacity(agent, side, price) {
    const equity = Math.max(0, this.equity(agent, price));
    const maxLong = Math.floor(equity * agent.traits.maxLeverage / price);
    const credit = agent.initialEquity * (agent.traits.maxLeverage - 1);
    const cashCapacity = Math.floor((agent.cash + credit) / price);
    const maxShort = Math.floor(Math.min(equity,agent.initialEquity) * (0.1 + agent.traits.risk / 100 * 0.65) / price);
    // Closing a position remains possible after a margin breach. Opening new
    // positions requires both collateral and an initially agreed credit line.
    const closing = side === 'buy' ? Math.max(0,-agent.shares) : Math.max(0,agent.shares);
    const allowed = side === 'buy' ? Math.min(maxLong - agent.shares,cashCapacity) : agent.shares + maxShort;
    return Math.max(0,closing,allowed);
  }

  volumeSignal(){return calculateVolumeSignal(this.volumeHistory);}

  emotionSummary(){
    const score=this.agents.reduce((sum,agent)=>sum+agent.emotion,0)/this.agents.length;
    return {score,...emotionBand(score),fearCount:this.agents.filter(agent=>agent.emotion<=(agent.traits.panicThreshold ?? 25)).length,greedCount:this.agents.filter(agent=>agent.emotion>=(agent.traits.greedThreshold ?? 75)).length};
  }

  updateEmotions(context){
    const crowd=this.emotionSummary().score;
    const previousPrice=this.prices.at(-2) ?? this.price,recentPeak=Math.max(this.price,...this.prices.slice(-36));
    for(const agent of this.agents){
      const equity=this.equity(agent),equityChange=agent.emotionLastEquity>0?clamp(equity/agent.emotionLastEquity-1,-0.1,0.1):0;
      agent.emotion=advanceEmotion(agent.emotion,agent.traits,{momentum:context.momentum,tickReturn:this.price/previousPrice-1,drawdown:this.price/recentPeak-1,equityChange,crowd,volumeRatio:context.volumeSignal?.ratio,halted:context.halted});
      agent.emotionLastEquity=equity;
    }
  }

  emotionOpinion(agent){
    const style=agent.traits.emotionStyle ?? 'follow',sensitivity=(agent.traits.emotionSensitivity ?? 100)/100,score=agent.emotion ?? agent.traits.emotionInitial ?? 50;
    if(style==='ignore' || sensitivity===0)return null;
    const fear=agent.traits.panicThreshold ?? 25,greed=agent.traits.greedThreshold ?? 75;
    const phase=score<=fear?'fear':score>=greed?'greed':null;
    if(!phase || (style==='cautious' && phase!=='fear'))return null;
    const probability=agent.traits.emotionProbability ?? 70,draw=probability>0 && probability<100?this.random():null;
    const accepted=probability===100 || (draw!==null && draw<probability/100);
    const severity=phase==='fear'?(fear-score)/Math.max(1,fear):(score-greed)/Math.max(1,100-greed);
    const strength=(0.5+clamp(severity,0,1)*0.75)*sensitivity;
    const kind=style==='cautious' || (style==='follow' && phase==='fear' && agent.shares<=0)?'wait':style==='contrarian'?'contrarian':phase==='fear'?'panic':'fomo';
    const action=kind==='wait'?0:style==='contrarian'?(phase==='fear'?1:-1):phase==='fear'?-1:1;
    const label=kind==='panic'?'패닉셀':kind==='fomo'?'탐욕 · 추격 매수':kind==='wait'?'공포 · 관망':`${phase==='fear'?'공포':'탐욕'} 역행 ${action>0?'매수':'매도'}`;
    const reason=`개인 감정 ${score.toFixed(1)} · ${phase==='fear'?`공포 기준 ${fear} 이하`:`탐욕 기준 ${greed} 이상`} · ${label} ${probability}%${draw===null?'':` / 난수 ${(draw*100).toFixed(2)}%`}`;
    return {style,score,phase,probability,draw,accepted,strength,kind,action,label,reason};
  }

  volumeOpinion(agent,context){
    const observed=context.volumeSignal,style=agent.traits.volumeStyle ?? 'follow';
    const sensitivity=(agent.traits.volumeSensitivity ?? 100)/100,threshold=agent.traits.volumeThreshold ?? 2;
    if(!observed?.ready || style==='ignore' || sensitivity===0)return null;
    const phase=observed.ratio>=threshold?'burst':observed.ratio<=1/threshold?'dry':'normal';
    const direction=Math.sign(context.momentum);
    if(phase==='normal' || (style==='cautious'?phase!=='dry':phase!=='burst'))return null;
    if(['follow','contrarian'].includes(style) && !direction)return null;
    if(style==='reduce' && !agent.shares)return null;
    const probability=agent.traits.volumeProbability ?? 70;
    const draw=probability>0 && probability<100?this.random():null;
    const accepted=probability===100 || (draw!==null && draw<probability/100);
    const strength=sensitivity*clamp(phase==='burst'?observed.ratio/threshold:1/(Math.max(0.01,observed.ratio)*threshold),1,2);
    const action=style==='follow'?direction:style==='contrarian'?-direction:style==='reduce'?-Math.sign(agent.shares):0;
    const label=style==='cautious'?'거래위축 관망':style==='reduce'?'거래량 급증 · 보유 축소':`거래량 ${style==='contrarian'?'역행':'추종'} ${action>0?'매수':'매도'}`;
    const reason=`최근 1분 거래량 ${observed.ratio.toFixed(2)}배 · ${phase==='burst'?`급증 기준 ${threshold}배`:`위축 기준 ${(1/threshold).toFixed(2)}배 이하`} · ${label} ${probability}%${draw===null?'':` / 난수 ${(draw*100).toFixed(2)}%`}`;
    return {style,phase,ratio:observed.ratio,threshold,probability,draw,accepted,strength,action,label,reason};
  }

  decision(agent, context) {
    if(context.halted)return {targetShares:agent.shares,label:'거래 중단',reason:'서킷브레이커 · 거래 재개까지 주문·반대매매 체결 중단',signal:0};
    if(agent.manual && agent.unlimited)return {targetShares:agent.shares,label:'직접 주문 대기',reason:'자금 무제한 · 사용자가 제출한 주문만 처리합니다.',signal:0};
    const equity = this.equity(agent);
    const exposure = equity > 0 ? agent.shares * this.price / equity : 0;
    const risk = agent.traits.risk / 100;
    const rising = context.momentum >= 0;
    const key = rising ? agent.traits.onRise : agent.traits.onFall;
    const reaction = this.reactions[key];
    const localGross = Math.abs(agent.shares * this.price);
    const gross=this.grossExposure?this.grossExposure(agent):localGross;
    const margin = localGross > 0 && (equity <= 0 || gross > equity * agent.traits.maxLeverage * 1.12);
    if (margin) {
      const targetShares = equity <= 0 ? 0 : Math.trunc(Math.sign(agent.shares) * equity * 0.65 * this.allocationWeight / this.price);
      return {targetShares, label:'반대매매', reason:'차입·공매도 담보 한도 초과로 포지션 축소', forced:true, signal:0};
    }
    if (equity <= 0) return {targetShares:agent.shares, label:'거래 중단', reason:'순자산 소진', signal:0};
    if(agent.manual)return {targetShares:agent.shares,label:'직접 주문 대기',reason:'사용자가 제출한 주문만 처리합니다.',signal:0};
    const participation=context.participationFactor ?? 1;
    const participationDraw=participation>0 && participation<1?this.random():null;
    if(participation<1 && (participationDraw===null || participationDraw>=participation))return {targetShares:agent.shares,label:'안정 대기',reason:`${context.controlPhase==='sidecar'?'사이드카':'해제 후 회복'} · 판단 참여 ${Math.round(participation*100)}%${participationDraw===null?'':` / 난수 ${(participationDraw*100).toFixed(2)}%`} → 관망`,signal:0,participationDraw};
    const emotion=this.emotionOpinion(agent);
    if(emotion?.accepted){
      let target=emotion.kind==='wait'?exposure:emotion.kind==='panic'?Math.max(0,exposure)*(1-clamp(0.25+0.3*emotion.strength,0.25,0.85)):exposure+emotion.action*(0.1+risk*0.25)*emotion.strength*this.allocationWeight;
      for(const modify of this.decisionModifiers)target=modify({agent,context:{...context,emotion},target,risk,equity,exposure});
      if(!Number.isFinite(target))throw new Error('행동 규칙이 유효하지 않은 투자 비중을 반환했습니다.');
      target=clamp(target,-(0.1+risk*0.65),agent.traits.maxLeverage);
      const targetShares=emotion.kind==='wait' && !this.decisionModifiers.length?agent.shares:Math.trunc(target*equity/this.price);
      const privateSignal=emotion.kind==='wait'?0:(this.random()-0.5)*(0.008+risk*0.036);
      const signal=emotion.kind==='wait'?0:clamp(context.momentum*0.1+context.sentiment+privateSignal+emotion.action*0.008*emotion.strength,-0.06,0.06);
      return {targetShares,label:emotion.label,reason:`${emotion.reason} → ${emotion.label}`,signal,source:'emotion',emotion,orderScale:emotion.kind==='wait'?1:Math.min(2.5,1+0.65*emotion.strength),participationDraw};
    }
    const emotionPrefix=emotion?`${emotion.reason} → 미반응 · 기존 판단 / `:'';
    const news=this.newsOpinion(agent,context.tick);
    const newsReason=news.details.map(item=>`${item.title} · ${{rumor:'사전 기대',insider:'내부정보',announced:'발표'}[item.phase]} ${item.impact>0?'+':''}${item.impact}% · 반응 ${item.probability}%${item.draw===null?'':` / 난수 ${(item.draw*100).toFixed(2)}%`}${item.accepted?'':' → 미반응'}`).join(' / ');
    if(Math.abs(news.effect)>1e-10){
      const privateSignal=(this.random()-0.5)*(0.008+risk*0.036);
      const signal=clamp(context.momentum*0.18+Math.log(this.valueAnchor*(1+news.effect)/this.price)*0.08+context.sentiment+privateSignal+news.effect*0.18,-0.06,0.06);
      // News selects a portfolio target, not a repeated increment. Expected
      // good news can therefore lead to selling if the announcement disappoints.
      let target=(agent.traits.allocation/100+news.effect*(2+risk*4))*this.allocationWeight;
      for(const modify of this.decisionModifiers)target=modify({agent,context:{...context,news},target,risk,equity,exposure});
      if(!Number.isFinite(target))throw new Error('행동 규칙이 유효하지 않은 투자 비중을 반환했습니다.');
      target=clamp(target,-(0.1+risk*0.65),agent.traits.maxLeverage);
      const targetShares=Math.trunc(target*equity/this.price);
      const label=targetShares>agent.shares?'소식 매수':targetShares<agent.shares?'소식 매도':'소식 보유';
      return {targetShares,label,reason:`${emotionPrefix}${newsReason} · ${newsStyleLabel(agent.traits.newsStyle)} → ${label}`,signal,source:'news',news:news.details,newsEffect:news.effect,participationDraw,...(emotion?{emotion}:{})};
    }
    const volume=this.volumeOpinion(agent,context);
    if(volume?.accepted){
      let target=volume.style==='cautious'?exposure:volume.style==='reduce'?exposure*(1-clamp(0.2*volume.strength,0,0.75)):exposure+volume.action*(0.08+risk*0.2)*volume.strength*this.allocationWeight;
      for(const modify of this.decisionModifiers)target=modify({agent,context:{...context,volume},target,risk,equity,exposure});
      if(!Number.isFinite(target))throw new Error('행동 규칙이 유효하지 않은 투자 비중을 반환했습니다.');
      target=clamp(target,-(0.1+risk*0.65),agent.traits.maxLeverage);
      const targetShares=volume.style==='cautious' && !this.decisionModifiers.length?agent.shares:Math.trunc(target*equity/this.price);
      const privateSignal=volume.style==='cautious'?0:(this.random()-0.5)*(0.008+risk*0.036);
      const signal=volume.style==='cautious'?0:clamp(context.momentum*0.18+Math.log(this.valueAnchor/this.price)*0.08+context.sentiment+privateSignal+volume.action*0.002*volume.strength,-0.06,0.06);
      return {targetShares,label:volume.label,reason:`${emotionPrefix}${newsReason?newsReason+' · 기존 대응 / ':''}${volume.reason} → ${volume.label}`,signal,source:'volume',volume,orderScale:volume.style==='cautious'?1:Math.min(2.5,1+0.5*volume.strength),participationDraw,...(emotion?{emotion}:{})};
    }
    const label = (rising ? reaction.riseLabel : reaction.fallLabel) || reaction.label;
    const probability = (rising ? agent.traits.riseProbability : agent.traits.fallProbability) ?? 100;
    // Probabilities apply to voluntary decisions. Collateral reductions above
    // always run. Endpoint probabilities do not consume an unnecessary draw.
    const draw = probability > 0 && probability < 100 ? this.random() : null;
    const executed = probability === 100 || (draw !== null && draw < probability / 100);
    const trial = {action:key, probability, draw, executed,participationDraw,...(volume?{volume}:{}),...(emotion?{emotion}:{})};
    const reason = `${emotionPrefix}${newsReason?newsReason+' · 기존 대응 / ':''}${volume?volume.reason+' → 미반응 · 기존 대응 / ':''}최근 1분 ${rising ? '상승' : '하락'} ${(Math.abs(context.momentum) * 100).toFixed(2)}% · ${label} ${probability}%${draw === null ? '' : ` · 난수 ${(draw * 100).toFixed(2)}%`}`;
    if (!executed) return {targetShares:agent.shares, label:'관망', reason:reason+' → 관망', signal:0, ...trial,news:news.details};
    const privateSignal = (this.random() - 0.5) * (0.008 + risk * 0.036);
    const signal = clamp(context.momentum * 0.18 + Math.log(this.valueAnchor / this.price) * 0.08 + context.sentiment + privateSignal, -0.06, 0.06);
    let target = reaction.target({agent, risk, exposure, equity,allocationWeight:this.allocationWeight, ...context});
    // Opinion noise affects active decisions, but never creates an order for a hold rule.
    if (reaction.noise) target += signal * (1 + risk * 3)*this.allocationWeight;
    for (const modify of this.decisionModifiers) target = modify({agent, context, target, risk, equity, exposure});
    if (!Number.isFinite(target)) throw new Error('행동 규칙이 유효하지 않은 투자 비중을 반환했습니다.');
    target = clamp(target, -(0.1 + risk * 0.65), agent.traits.maxLeverage);
    const targetShares = reaction.keepShares && !this.decisionModifiers.length ? agent.shares : Math.trunc(target * equity / this.price);
    return {targetShares, label, reason:reason+` → ${label}`, signal, ...trial,news:news.details};
  }

  step({halted=false,participationFactor=1,controlPhase='normal'}={}) {
    this.tick++;
    for(const event of this.publicNews()){
      if(event.rumorTick===this.tick || (this.tick===1 && event.rumorTick===0))this.newsLog.push({tick:event.rumorTick,eventId:event.id,title:event.title,phase:'rumor',impact:event.expectedImpact});
      if(event.announceTick===this.tick)this.newsLog.push({tick:this.tick,eventId:event.id,title:event.title,phase:'announced',impact:event.actualImpact});
    }
    this.newsLog=this.newsLog.slice(-40);
    const open = this.price;
    const lookback = this.prices[Math.max(0, this.prices.length - TICKS_PER_CANDLE - 1)];
    this.sentiment = clamp(this.sentiment * 0.88 + (halted?0:(this.random() - 0.5) * 0.008), -0.025, 0.025);
    const context = {momentum:this.price / lookback - 1, valueGap:this.valueAnchor / this.price - 1, sentiment:this.sentiment, tick:this.tick, price:this.price, macro:this.config.macro,companyProfile:this.config.companyProfile,halted,participationFactor,controlPhase,volumeSignal:this.volumeSignal()};
    this.updateEmotions(context);
    context.emotion=this.emotionSummary();
    const orders = [], decisions = [];
    for (const agent of this.manualAgent?[...this.agents,this.manualAgent]:this.agents) {
      agent.lastFilled = 0;
      const decision = this.decision(agent, context);
      const activity=halted?0:decision.forced?1:participationFactor;
      agent.participationRate=activity*100;agent.heat=agent.traits.risk*activity;
      if(!halted && participationFactor<1 && !decision.forced && !agent.manual && decision.participationDraw!==undefined && decision.label!=='안정 대기')decision.reason=`${controlPhase==='sidecar'?'사이드카':'해제 후 회복'} · 판단 참여 ${Math.round(participationFactor*100)}% / 난수 ${(decision.participationDraw*100).toFixed(2)}% 통과 · ${decision.reason}`;
      agent.lastAction = decision.label;
      agent.lastReason = decision.reason;
      if (decision.forced) {agent.marginCalls++;if(agent.manual)this.cancelManualOrder('반대매매로 대기 주문 취소');}
      const difference = decision.targetShares - agent.shares;
      const side = difference > 0 ? 'buy' : 'sell';
      const orderScale=decision.orderScale ?? 1;
      const fraction = decision.forced ? 1 : Math.min(1,(0.16 + agent.traits.risk / 100 * 0.32)*activity*orderScale);
      const desired = Math.floor(Math.abs(difference) * fraction);
      const urgency = decision.forced ? 0.07 : (0.002 + agent.traits.risk / 100 * 0.004)*activity*Math.min(1.8,orderScale);
      const quote = Math.max(1, Math.round(open * (1 + decision.signal*activity + (side === 'buy' ? urgency : -urgency))));
      const quantity = Math.min(desired, this.capacity(agent, side, quote));
      decisions.push({agentId:agent.id, ...decision, quantity, side});
      if (quantity > 0) orders.push({agentId:agent.id, side, limit:quote, quantity, remaining:quantity, priority:this.random()});
    }
    const request=this.manualOrder;
    if(!halted && request && ['queued','open','partial'].includes(request.status)){
      orders.push({agentId:this.manualAgent.id,side:request.side,limit:request.type==='market'?(request.side==='buy'?Number.MAX_SAFE_INTEGER:1):request.limit,isMarket:request.type==='market',allowShort:request.allowShort,quantity:request.remaining,remaining:request.remaining,priority:-1,manualRequest:request});
    }
    const bids = orders.filter(o => o.side === 'buy').sort((a,b) => b.limit - a.limit || a.priority - b.priority);
    const asks = orders.filter(o => o.side === 'sell').sort((a,b) => a.limit - b.limit || a.priority - b.priority);
    const trades = [];
    let b = 0, s = 0;
    while (b < bids.length && s < asks.length) {
      const bid = bids[b], ask = asks[s];
      if (bid.limit < ask.limit) break;
      if(bid.agentId===ask.agentId)throw new Error('자기 주문끼리는 체결할 수 없습니다.');
      const price = bid.manualRequest?ask.limit:ask.manualRequest?bid.limit:Math.round((bid.limit + ask.limit) / 2);
      const buyer = bid.agentId===this.manualAgent?.id?this.manualAgent:this.agents.find(a => a.id === bid.agentId);
      const seller = ask.agentId===this.manualAgent?.id?this.manualAgent:this.agents.find(a => a.id === ask.agentId);
      const buyCapacity = this.capacity(buyer, 'buy', price,bid), sellCapacity = this.capacity(seller, 'sell', price,ask);
      const quantity = Math.min(bid.remaining, ask.remaining, buyCapacity, sellCapacity);
      if (quantity > 0) {
        const amount = quantity * price;
        if (![price,amount,buyer.cash-amount,seller.cash+amount].every(Number.isSafeInteger)) {
          throw new Error('금액의 계산 한도에 도달했습니다. 초기화 후 재산 규모를 줄여주세요.');
        }
        const priorBuyerShares=buyer.shares,priorSellerShares=seller.shares;
        buyer.cash -= amount; seller.cash += amount;
        buyer.shares += quantity; seller.shares -= quantity;
        buyer.lastFilled += quantity; seller.lastFilled -= quantity;
        bid.remaining -= quantity; ask.remaining -= quantity;
        this.price = price;
        if(buyer.manual)this.onManualFill?.({side:'buy',quantity,price,priorShares:priorBuyerShares});
        if(seller.manual)this.onManualFill?.({side:'sell',quantity,price,priorShares:priorSellerShares});
        for(const order of [bid,ask])if(order.manualRequest){
          const manual=order.manualRequest;
          manual.remaining-=quantity;manual.filledQuantity+=quantity;manual.amount+=amount;
          manual.lastFillTick=this.tick;manual.afterPrice=price;manual.reaction=null;
        }
        trades.push({tick:this.tick, price, quantity, buyer:buyer.id, seller:seller.id,...(bid.manualRequest||ask.manualRequest?{manualOrderId:(bid.manualRequest || ask.manualRequest).id}:{})});
      }
      if (buyCapacity <= quantity) bid.remaining = 0;
      if (sellCapacity <= quantity) ask.remaining = 0;
      if (!bid.remaining) b++;
      if (!ask.remaining) s++;
      if (quantity === 0 && buyCapacity > 0 && sellCapacity > 0) break;
    }
    if(!halted && request && ['queued','open','partial'].includes(request.status)){
      if(!request.remaining)request.status='filled';
      else if(request.type==='market'){
        request.status=request.filledQuantity?'partialCanceled':'unfilled';
        request.reason='시장가 잔량은 이 틱에서 취소됩니다.';
        const submitted=orders.find(order=>order.manualRequest===request);if(submitted)submitted.remaining=0;
      }else request.status=request.filledQuantity?'partial':'open';
      if(request.lastFillTick===this.tick)request.afterPrice=this.price;
    }
    const volume = trades.reduce((sum, trade) => sum + trade.quantity, 0);
    if(!halted){this.volumeHistory.push(volume);if(this.volumeHistory.length>TICKS_PER_CANDLE+VOLUME_BASELINE_TICKS)this.volumeHistory.shift();}
    this.totalVolume += volume;
    this.totalTrades += trades.length;
    const prices = [open, ...trades.map(trade => trade.price)];
    const high = Math.max(...prices), low = Math.min(...prices);
    const index = Math.floor((this.tick - 1) / TICKS_PER_CANDLE);
    let candle = this.candles.at(-1);
    if (!candle || candle.index !== index) {
      candle = {index, open, high, low, close:this.price, volume, trades:trades.length};
      this.candles.push(candle);
    } else {
      candle.high = Math.max(candle.high, high); candle.low = Math.min(candle.low, low);
      candle.close = this.price; candle.volume += volume; candle.trades += trades.length;
    }
    if (this.candles.length > 1200) this.candles.shift();
    this.prices.push(this.price);
    if (this.prices.length > 120) this.prices.shift();
    this.high = Math.max(this.high, high); this.low = Math.min(this.low, low);
    for (const price of prices) {
      this.peak = Math.max(this.peak, price);
      this.maxDrawdown = Math.max(this.maxDrawdown, 1 - price / this.peak);
    }
    this.trades = [...trades.reverse(), ...this.trades].slice(0, 40);
    this.orderBook = {bids:bids.filter(o => o.remaining > 0), asks:asks.filter(o => o.remaining > 0)};
    this.last = {volume, tradeCount:trades.length, orders, decisions, halted,participationFactor,controlPhase,volumeSignal:context.volumeSignal,buyQuantity:bids.reduce((sum,o) => sum + o.quantity, 0), sellQuantity:asks.reduce((sum,o) => sum + o.quantity, 0)};
    return this.last;
  }
}

export function aggregateCandles(candles, minutes = 1) {
  const result = [];
  for (const c of candles) {
    const index = Math.floor(c.index / minutes) * minutes;
    const last = result.at(-1);
    if (!last || last.index !== index) result.push({...c, index});
    else {
      last.high = Math.max(last.high, c.high); last.low = Math.min(last.low, c.low);
      last.close = c.close; last.volume += c.volume; last.trades += c.trades;
    }
  }
  return result;
}

export function marketTime(tick, seconds = true) {
  const elapsed = 9 * 3600 + tick * TICK_SECONDS;
  const day = Math.floor(elapsed / 86400);
  const time = [Math.floor(elapsed / 3600) % 24, Math.floor(elapsed / 60) % 60, elapsed % 60].map(n => String(n).padStart(2,'0'));
  return `${day ? `D+${day} ` : ''}${time.slice(0, seconds ? 3 : 2).join(':')}`;
}
