// Focused checks for fixed annual macro scenarios and company-specific exposure.
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
  const source=fs.readFileSync('site/simulation-engine.js');
  const {MarketSimulation,DEFAULT_CONFIG,DEFAULT_FINANCIALS,DEFAULT_MACRO,DEFAULT_COMPANY_PROFILE,COMPANY_CYCLE_TYPES,calculateEconomicScenario,normalizeConfig,normalizeMacro,normalizeCompanyProfile}=await import('data:text/javascript;base64,'+source.toString('base64'));
  const copy=value=>JSON.parse(JSON.stringify(value)), passed=[];
  const check=(condition,message)=>{assert(condition,message);passed.push(message);};
  const scenario=(cyclicality,patch={})=>calculateEconomicScenario(DEFAULT_FINANCIALS,{...DEFAULT_MACRO,...patch},{cyclicality},10000,46050);
  const cyclical=scenario('cyclical',{gdpGrowth:5}), defensive=scenario('defensive',{gdpGrowth:5});
  check(cyclical.revenueFactor>defensive.revenueFactor && defensive.revenueFactor>1 && cyclical.profitDelta>defensive.profitDelta,'an identical GDP expansion has a stronger effect on cyclical company sales and earnings');
  const cyclicalDown=scenario('cyclical',{gdpGrowth:-2}), defensiveDown=scenario('defensive',{gdpGrowth:-2});
  check(cyclicalDown.profitDelta<defensiveDown.profitDelta && defensiveDown.profitDelta<0 && defensiveDown.revenueFactor<1,'defensive companies have smaller recession losses rather than guaranteed inverse gains');
  const inflated=scenario('cyclical',{inflation:7}), cooled=scenario('defensive',{inflation:7});
  check(inflated.profitDelta<cooled.profitDelta && cooled.profitDelta<0 && inflated.revenueFactor===1,'inflation affects modeled costs through the configured company sensitivity');
  const rates=scenario('cyclical',{policyRate:6});
  check(rates.profitDelta===0 && rates.rateFactor<1 && rates.adjustedFinancials.referencePER<DEFAULT_FINANCIALS.referencePER,'policy rates adjust the reference multiple without inventing interest payments');
  for(const type of Object.keys(COMPANY_CYCLE_TYPES)){
    const neutral=scenario(type);
    assert.equal(neutral.valuationFactor,1);
    assert.deepEqual(neutral.adjustedFinancials,DEFAULT_FINANCIALS);
  }
  passed.push('neutral macro conditions preserve financial inputs and the original quote basis for all company types');
  const disabled=scenario('cyclical',{gdpGrowth:-8,inflation:15,policyRate:10,influence:0});
  check(disabled.valuationFactor===1 && disabled.profitDelta===0 && disabled.revenueFactor===1,'0% macro influence disables all scenario effects');
  const manual=calculateEconomicScenario(DEFAULT_FINANCIALS,{...DEFAULT_MACRO,gdpGrowth:5},{cyclicality:'cyclical',gdpSensitivity:0},10000,46050);
  check(manual.revenueFactor===1 && manual.profitDelta===0,'individual company sensitivities override the selected type preset');
  const legacy=copy(DEFAULT_CONFIG);delete legacy.macro;delete legacy.companyProfile;
  const normalized=normalizeConfig(legacy);
  check(JSON.stringify(normalized.macro)===JSON.stringify(DEFAULT_MACRO) && JSON.stringify(normalized.companyProfile)===JSON.stringify(DEFAULT_COMPANY_PROFILE),'older configurations receive neutral macro settings and company profiles');
  for(const patch of [{gdpGrowth:''},{gdpGrowth:21},{inflation:31},{policyRate:-3},{influence:NaN}])assert.throws(()=>normalizeMacro(patch));
  for(const patch of [{cyclicality:'invalid'},{gdpSensitivity:-1},{rateSensitivity:21},{inflationSensitivity:''}])assert.throws(()=>normalizeCompanyProfile(patch));
  passed.push('invalid macro indicators, company types and exposure values are rejected');

  const make=(type,macro)=>({...copy(DEFAULT_CONFIG),companyNews:[],companyProfile:{cyclicality:type},macro:{...DEFAULT_MACRO,...macro}});
  const active=new MarketSimulation(make('cyclical',{gdpGrowth:5})), replay=new MarketSimulation(make('cyclical',{gdpGrowth:5}));
  const other=new MarketSimulation(make('defensive',{gdpGrowth:5}));
  const scenarioSnapshot=copy(active.economicScenario), initialCash=active.initialCash, initialShares=active.totalShares;
  let differentOrders=false;
  for(let i=0;i<120;i++){
    active.step();replay.step();other.step();
    assert.deepEqual(active.last,replay.last);
    assert.equal(active.agents.reduce((sum,p)=>sum+p.cash,0),initialCash);
    assert.equal(active.agents.reduce((sum,p)=>sum+p.shares,0),initialShares);
    if(JSON.stringify(active.last.orders)!==JSON.stringify(other.last.orders))differentOrders=true;
  }
  check(differentOrders && active.totalVolume>0 && JSON.stringify(active.candles)===JSON.stringify(replay.candles),'company exposure changes actual orders while keeping seeded replay and settlement conservation');
  check(JSON.stringify(active.economicScenario)===JSON.stringify(scenarioSnapshot) && JSON.stringify(active.config.financials)===JSON.stringify(DEFAULT_FINANCIALS),'annual GDP impacts are not compounded every intraday tick and do not overwrite recorded company accounts');
  const holding=make('cyclical',{gdpGrowth:10,inflation:8,policyRate:8});
  holding.participants.forEach(p=>{p.onRise='hold';p.onFall='hold';});
  const flat=new MarketSimulation(holding);for(let i=0;i<30;i++)flat.step();
  check(flat.price===holding.initialPrice && flat.totalVolume===0,'macro conditions alone cannot move the stock price without matched orders');
  const extreme=calculateEconomicScenario({...DEFAULT_FINANCIALS,revenue:0,operatingProfit:-1,netIncome:0,assets:0,liabilities:1},{gdpGrowth:-20,inflation:30,policyRate:-2,influence:100},{cyclicality:'cyclical',gdpSensitivity:5,inflationSensitivity:3,rateSensitivity:20},10000,0);
  check(Object.values(extreme.adjustedMetrics).every(value=>typeof value!=='number'||Number.isFinite(value)) && extreme.valuationFactor>=0.1 && extreme.valuationFactor<=3,'extreme scenarios, losses and zero share supply remain finite and bounded');
  fs.mkdirSync('artifacts/simulation-macro',{recursive:true});
  fs.writeFileSync('artifacts/simulation-macro/engine-verification.json',JSON.stringify({checks:passed.length,passed,examples:{cyclical:cyclical.adjustedFinancials,defensive:defensive.adjustedFinancials,cyclicalRecession:cyclicalDown.adjustedFinancials,defensiveRecession:defensiveDown.adjustedFinancials}},null,2));
  console.log(`MACRO PASS: ${passed.length} focused checks.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
