// Focused checks for scheduled company news and individual information access.
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
  const source=fs.readFileSync('site/simulation-engine.js');
  const {MarketSimulation,DEFAULT_CONFIG,PARTICIPANT_ATTRIBUTES,normalizeConfig,normalizeCompanyNews,defaultPopulation,generatePopulation}=await import('data:text/javascript;base64,'+source.toString('base64'));
  const copy=value=>JSON.parse(JSON.stringify(value)),passed=[];
  const check=(condition,message)=>{assert(condition,message);passed.push(message);};
  const event={id:'result',title:'실적 발표',announceMinute:5,leadMinutes:3,durationMinutes:10,expectedImpact:6,actualImpact:-8};
  const base=()=>({...copy(DEFAULT_CONFIG),companyNews:[copy(event)],participants:['anticipate','confirm','contrarian','ignore','anticipate','confirm'].map((style,i)=>({name:`참여자 ${i+1}`,wealth:1000,risk:50,allocation:50,maxLeverage:2,onRise:'hold',onFall:'hold',riseProbability:100,fallProbability:100,newsStyle:style,newsProbability:100,newsSensitivity:100,newsDelay:i===4?120:0}))});
  const legacy=copy(DEFAULT_CONFIG);delete legacy.companyNews;
  legacy.participants.forEach(person=>PARTICIPANT_ATTRIBUTES.filter(a=>a.key.startsWith('news')).forEach(a=>delete person[a.key]));
  const normalized=normalizeConfig(legacy);
  check(normalized.companyNews.length===0 && normalized.participants.every(p=>p.newsStyle==='confirm' && p.newsProbability===80 && p.newsDelay===30),'older saved configurations retain their scenario and receive default news traits');
  for(const patch of [{title:''},{announceMinute:0},{leadMinutes:6},{durationMinutes:0},{actualImpact:31},{expectedImpact:NaN},{id:'bad id'}])assert.throws(()=>normalizeCompanyNews([{...event,...patch}]));
  assert.throws(()=>normalizeCompanyNews([event,event]));
  assert.throws(()=>normalizeConfig({...base(),participants:[{...base().participants[0],newsStyle:'invalid'},base().participants[1]]}));
  passed.push('invalid news times, effects, identifiers and participant styles are rejected');

  const market=new MarketSimulation(base()),a=market.agents;
  check(market.newsOpinion(a[0],11).details.length===0 && market.newsOpinion(a[0],12).effect===0.06 && market.newsOpinion(a[1],12).effect===0,'anticipators use the public expectation while confirmation traders wait for the announcement');
  check(market.newsOpinion(a[2],12).effect===-0.06 && market.newsOpinion(a[3],30).effect===0,'contrarians invert the received information and ignore style leaves price rules in control');
  check(market.newsOpinion(a[4],12).effect===0 && market.newsOpinion(a[4],24).effect===0.06 && market.newsOpinion(a[4],41).details[0].phase==='rumor' && market.newsOpinion(a[4],42).details[0].phase==='announced','reaction delays retain the old expectation until the actual announcement is received');
  const strong={...a[0],traits:{...a[0].traits,newsSensitivity:200}};
  check(market.newsOpinion(strong,12).effect===0.12 && market.newsOpinion({...a[0],traits:{...a[0].traits,newsSensitivity:0}},12).effect===0,'reaction strength scales the opinion and 0% disables news influence');
  check(market.newsOpinion(a[0],30).effect===-0.08 && Math.abs(market.newsOpinion(a[0],60).effect)<0.08 && market.newsOpinion(a[0],90).details.length===0,'the actual result replaces the expectation and fades over the configured attention period');

  const different=base();different.companyNews[0].actualImpact=25;
  const left=new MarketSimulation(base()),right=new MarketSimulation(different);
  const future=base();future.companyNews.push({...event,id:'future',announceMinute:20,leadMinutes:0,actualImpact:30});
  const added=new MarketSimulation(future);
  for(let tick=1;tick<30;tick++){
    left.step();right.step();added.step();
    assert.deepEqual(left.last,right.last);assert.deepEqual(left.last,added.last);
    assert.equal(left.price,right.price);assert.equal(left.publicNews()[0].actualImpact,null);
  }
  passed.push('unpublished outcomes and future events cannot change earlier decisions, random draws or prices');
  left.step();right.step();
  check(JSON.stringify(left.last.orders)!==JSON.stringify(right.last.orders) && left.publicNews()[0].surprise===-14 && left.newsLog.at(-1).impact===-8,'announcement outcomes enter actual orders and the public report only at the scheduled time');

  const trial={...a[0],traits:{...a[0].traits,newsProbability:80}};
  const first=market.newsOpinion(trial,12).details[0],later=market.newsOpinion(trial,20).details[0],announced=market.newsOpinion(trial,30).details[0];
  check(first.draw===later.draw && first.accepted===later.accepted && first.draw!==announced.draw,'each received news phase draws once, with a separate stable draw for the announcement');
  const noResponse={...a[0],traits:{...a[0].traits,newsProbability:0}};
  check(market.newsOpinion(noResponse,12).effect===0 && !market.newsOpinion(noResponse,12).details[0].accepted && market.newsOpinion(a[0],12).details[0].accepted,'0% never reacts and 100% always reacts');

  const context={tick:12,momentum:0,sentiment:0};
  check(market.decision(a[0],context).source==='news' && market.decision(a[1],context).targetShares===a[1].shares,'accepted news can override ordinary holding rules while confirmation traders keep holding');
  const marginAgent={...a[0],shares:10000,cash:-99000000,traits:{...a[0].traits,newsProbability:0}};
  check(market.decision(marginAgent,context).forced,'collateral liquidation takes priority over all news styles and probabilities');

  const silent=base();silent.participants.forEach(p=>p.newsStyle='ignore');
  const idle=new MarketSimulation(silent),without=new MarketSimulation({...silent,companyNews:[]});
  for(let i=0;i<35;i++){idle.step();without.step();assert.deepEqual(idle.last,without.last);}
  check(idle.price===silent.initialPrice && idle.totalVolume===0,'company announcements cannot force price changes without matched participant orders');
  const active=new MarketSimulation(base()),replay=new MarketSimulation(base());
  for(let i=0;i<100;i++){
    active.step();replay.step();assert.deepEqual(active.last,replay.last);
    assert.equal(active.agents.reduce((sum,p)=>sum+p.cash,0),active.initialCash);
    assert.equal(active.agents.reduce((sum,p)=>sum+p.shares,0),active.totalShares);
  }
  check(active.totalTrades>0 && JSON.stringify(active.candles)===JSON.stringify(replay.candles) && JSON.stringify(active.config.financials)===JSON.stringify(DEFAULT_CONFIG.financials),'news trades preserve cash, shares, recorded financials and seeded replay');
  const population=defaultPopulation();population.enabled=true;
  const generated=generatePopulation(population,42);
  const restored=normalizeConfig(JSON.parse(JSON.stringify({...base(),population})));
  check(generated.filter(p=>p.newsStyle==='anticipate').length===7 && generated.filter(p=>p.newsStyle==='confirm').length===8 && restored.companyNews[0].actualImpact===-8 && restored.participants.every(p=>Number.isFinite(p.newsDelay)),'news response styles, strengths, probabilities and delays support population ratios and saved configurations');
  fs.mkdirSync('artifacts/simulation-news',{recursive:true});
  fs.writeFileSync('artifacts/simulation-news/engine-verification.json',JSON.stringify({checks:passed.length,passed,example:{news:active.publicNews(),trades:active.totalTrades,price:active.price}},null,2));
  console.log(`NEWS PASS: ${passed.length} focused checks.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
