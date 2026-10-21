// Financial inputs, ratios and their optional effect on modeled orders only.
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
  const source=fs.readFileSync('site/simulation-engine.js');
  const {MarketSimulation,DEFAULT_CONFIG,DEFAULT_FINANCIALS,normalizeConfig,normalizeFinancials,calculateCompanyMetrics}=await import('data:text/javascript;base64,'+source.toString('base64'));
  const copy=value=>JSON.parse(JSON.stringify(value));
  const passed=[];
  const check=(condition,message)=>{assert(condition,message);passed.push(message);};
  const metrics=calculateCompanyMetrics(DEFAULT_FINANCIALS,10000,100000);
  check(metrics.revenue===1000000000 && metrics.operatingProfit===120000000 && metrics.netIncome===80000000 && metrics.equity===400000000,'financial input units convert from KRW 100 million and reconcile assets minus liabilities');
  check(metrics.marketCap===1000000000 && metrics.eps===800 && metrics.bps===4000 && metrics.per===12.5 && metrics.pbr===2.5,'market capitalization, EPS, BPS, PER and PBR use the same modeled share supply');
  check(metrics.operatingMargin===12 && metrics.netMargin===8 && metrics.roe===20 && metrics.debtRatio===50,'profitability, end-equity ROE and debt-to-equity ratios use the stated denominators');
  const repriced=calculateCompanyMetrics(DEFAULT_FINANCIALS,20000,100000);
  check(repriced.marketCap===metrics.marketCap*2 && repriced.per===metrics.per*2 && repriced.pbr===metrics.pbr*2 && repriced.eps===metrics.eps,'live price changes valuation ratios without changing annual accounts');
  const loss=calculateCompanyMetrics({...DEFAULT_FINANCIALS,netIncome:-1},10000,100000);
  const impaired=calculateCompanyMetrics({...DEFAULT_FINANCIALS,assets:1,liabilities:2,netIncome:-1},10000,100000);
  check(loss.per===null && loss.eps===-1000 && loss.roe===-25 && loss.referencePrice===4000 && impaired.pbr===null && impaired.roe===null && impaired.debtRatio===null && impaired.referencePrice===0,'losses and negative equity have explicit unavailable ratios and a defined reference-price fallback');
  const noShares=calculateCompanyMetrics(DEFAULT_FINANCIALS,10000,0);
  const empty=calculateCompanyMetrics({...DEFAULT_FINANCIALS,revenue:0,assets:0,liabilities:0,netIncome:0},10000,0);
  check(noShares.marketCap===null && noShares.eps===null && noShares.referencePrice===null && Object.values(empty).every(value=>typeof value!=='number'||Number.isFinite(value)),'zero sales, equity or share supply never create NaN or Infinity');
  const legacy=copy(DEFAULT_CONFIG);delete legacy.financials;
  check(JSON.stringify(normalizeConfig(legacy).financials)===JSON.stringify(DEFAULT_FINANCIALS),'existing saved configurations receive complete default financial inputs');
  for(const patch of [{revenue:-1},{assets:-1},{liabilities:''},{netIncome:NaN},{referencePER:0},{priceInfluence:101}])assert.throws(()=>normalizeFinancials({...DEFAULT_FINANCIALS,...patch}));
  passed.push('invalid financial values and influence weights are rejected');

  const make=(netIncome,priceInfluence)=>({...copy(DEFAULT_CONFIG),companyNews:[],financials:{...DEFAULT_FINANCIALS,netIncome,priceInfluence}});
  const neutralA=new MarketSimulation(make(0.2,0)), neutralB=new MarketSimulation(make(4,0));
  const active=new MarketSimulation(make(4,100)), replay=new MarketSimulation(make(4,100));
  const initialCash=active.initialCash, initialShares=active.totalShares;
  let changedQuotes=false;
  for(let i=0;i<120;i++){
    neutralA.step();neutralB.step();active.step();replay.step();
    assert.deepEqual(neutralA.last,neutralB.last);
    assert.deepEqual(active.last,replay.last);
    assert.equal(active.agents.reduce((sum,p)=>sum+p.cash,0),initialCash);
    assert.equal(active.agents.reduce((sum,p)=>sum+p.shares,0),initialShares);
    if(JSON.stringify(neutralA.last.orders)!==JSON.stringify(active.last.orders))changedQuotes=true;
  }
  check(JSON.stringify(neutralA.candles)===JSON.stringify(neutralB.candles),'0% financial influence preserves trading behavior when financial inputs change');
  check(changedQuotes && active.referencePrice>active.config.initialPrice && active.valueAnchor===active.referencePrice && active.totalVolume>0,'enabled financial influence changes actual orders rather than forcing the market price');
  check(JSON.stringify(active.candles)===JSON.stringify(replay.candles),'financial influence preserves seeded replay and cash/share conservation');

  const holding=make(4,100);holding.participants.forEach(p=>{p.onRise='hold';p.onFall='hold';});
  const held=new MarketSimulation(holding);for(let i=0;i<30;i++)held.step();
  check(held.price===holding.initialPrice && held.totalVolume===0 && held.agents.reduce((sum,p)=>sum+p.cash,0)===held.initialCash,'annual company profits do not create trades, cash transfers or price moves in an all-hold market');
  fs.mkdirSync('artifacts/simulation-financials',{recursive:true});
  fs.writeFileSync('artifacts/simulation-financials/engine-verification.json',JSON.stringify({checks:passed.length,passed,example:metrics},null,2));
  console.log(`FINANCIALS PASS: ${passed.length} focused checks.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
