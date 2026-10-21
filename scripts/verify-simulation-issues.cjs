const verifyLedger=require('./simulation-test-ledger.cjs');
// Focused checks for live company issues and asymmetric information access.
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
  const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64'),copy=value=>JSON.parse(JSON.stringify(value));
  const engineUrl=url(fs.readFileSync('site/simulation-engine.js','utf8')),controlsUrl=url(fs.readFileSync('site/simulation-controls.js','utf8'));
  const engine=await import(engineUrl),{MarketSimulation,DEFAULT_CONFIG,normalizeConfig,normalizeCompanyIssue,normalizeCompanyNews,defaultPopulation,generatePopulation}=engine;
  const rosterUrl='data:text/javascript;base64,'+Buffer.from(fs.readFileSync('site/simulation-roster.js','utf8').replace("'./simulation-engine.js'",JSON.stringify(engineUrl))).toString('base64');
  const exchangeSource=fs.readFileSync('site/simulation-exchange.js','utf8').replace("'./simulation-engine.js'",JSON.stringify(engineUrl)).replace("'./simulation-controls.js'",JSON.stringify(controlsUrl)).replace("'./simulation-roster.js'",JSON.stringify(rosterUrl));
  const {SecuritiesSimulation,DEFAULT_EXCHANGE_CONFIG}=await import('../site/simulation-exchange.js');
  const passed=[],check=(condition,label)=>{assert(condition,label);passed.push(label);};
  const fixture=()=>({...copy(DEFAULT_CONFIG),companyNews:[],participants:[['confirm','insider'],['confirm','public'],['anticipate','public'],['contrarian','insider'],['ignore','insider'],['confirm','auto']].map(([newsStyle,newsAccess],i)=>({name:`참여자 ${i+1}`,wealth:1000,risk:50,allocation:50,maxLeverage:2,onRise:'hold',onFall:'hold',riseProbability:100,fallProbability:100,newsStyle,newsAccess,newsProbability:100,newsSensitivity:100,newsDelay:0}))});
  const issue={title:'공급 계약 체결',actualImpact:12,durationMinutes:10,announceDelayMinutes:2,insiderMode:'enabled',insiderLeadMinutes:2,insiderRatio:0};
  const legacy=fixture();legacy.participants.forEach(person=>delete person.newsAccess);legacy.companyNews=[{id:'legacy',title:'예정 발표',announceMinute:5,leadMinutes:2,durationMinutes:10,expectedImpact:6,actualImpact:-8}];
  const normalized=normalizeConfig(legacy);
  check(normalized.participants.every(person=>person.newsAccess==='auto') && normalized.companyNews[0].insiderMode==='none','legacy settings preserve public-information behavior and gain explicit access defaults');
  for(const patch of [{title:''},{actualImpact:31},{announceDelayMinutes:-1},{insiderLeadMinutes:3},{insiderRatio:101},{insiderMode:'invalid'}])assert.throws(()=>normalizeCompanyIssue({...issue,...patch}));
  assert.throws(()=>normalizeCompanyNews([{...legacy.companyNews[0],insiderMode:'enabled',insiderLeadMinutes:6}]));
  passed.push('live and scheduled issues reject invalid effects, disclosure modes and information times');

  const clocked=new MarketSimulation(fixture());for(let i=0;i<7;i++)clocked.step();
  const before={tick:clocked.tick,price:clocked.price,random:clocked.randomState,cash:clocked.agents.map(a=>a.cash),shares:clocked.agents.map(a=>a.shares),config:JSON.stringify(clocked.config),candles:JSON.stringify(clocked.candles)};
  const clockedIssue=clocked.triggerCompanyIssue({...issue,insiderLeadMinutes:1});
  check(clockedIssue.announceTick===19 && clockedIssue.insiderTick===13 && clocked.tick===before.tick && clocked.randomState===before.random && clocked.price===before.price && JSON.stringify(clocked.config)===before.config && JSON.stringify(clocked.candles)===before.candles,'injection uses the current ten-second clock without resetting prices, candles, seed or saved scenario');
  assert.deepEqual(clocked.agents.map(a=>a.cash),before.cash);assert.deepEqual(clocked.agents.map(a=>a.shares),before.shares);
  check(clocked.newsOpinion(clocked.agents[0],12).details.length===0 && clocked.newsOpinion(clocked.agents[0],13).effect===0.12 && clocked.newsOpinion(clocked.agents[1],13).effect===0,'only authorized participants read the actual outcome at its private delivery boundary');
  clocked.tick=13;
  check(clocked.publicNews()[0].actualImpact===null && clocked.publicNews()[0].phase==='insider' && clocked.publicNews()[0].insiderInformed===3,'public reports keep the actual outcome hidden while reporting private awareness separately');
  const delayed={...clocked.agents[0],traits:{...clocked.agents[0].traits,newsDelay:30}};
  check(clocked.newsOpinion(delayed,15).effect===0 && clocked.newsOpinion(delayed,16).effect===0.12,'individual response delay also applies to private information');
  const trading=new MarketSimulation(fixture());trading.triggerCompanyIssue(issue);trading.step();
  check(trading.last.decisions[0].source==='news' && trading.last.decisions[0].news[0].phase==='insider' && trading.last.decisions[1].targetShares===trading.agents[1].shares && trading.last.decisions[3].newsEffect<0 && trading.totalTrades>0,'insider knowledge produces real matching orders while public-only holders wait and contrarians invert it');
  check(trading.informationReport(trading.newsEvents[0].id)[4].phase==='insider' && trading.last.decisions[4].source!== 'news','knowing an outcome and choosing to trade are separate, including news-ignore participants');
  const ended=trading.newsEvents[0].endTick,remembered=trading.informationFor(trading.newsEvents[0],trading.agents[1],ended);
  check(remembered.phase==='expired' && remembered.receivedPhase==='announced' && remembered.receivedTick!==null && trading.newsOpinion(trading.agents[1],ended).effect===0,'attention expiry stops news orders without claiming that a received outcome was forgotten');
  const none=new MarketSimulation(fixture());none.triggerCompanyIssue({...issue,insiderMode:'none'});
  check(none.agents.every(agent=>none.newsOpinion(agent,1).details.length===0) && none.publicNews()[0].insiderCount===0,'nobody-knows mode overrides even explicitly assigned insiders');

  const allAuto=fixture();allAuto.participants=Array.from({length:10},(_,i)=>({...allAuto.participants[0],name:`자동 ${i}`,newsAccess:'auto'}));
  const automatic=new MarketSimulation(allAuto),automaticCopy=new MarketSimulation(allAuto);
  automatic.triggerCompanyIssue({...issue,insiderRatio:30});automaticCopy.triggerCompanyIssue({...issue,insiderRatio:30,actualImpact:-12});
  const ids=market=>market.informationReport(market.newsEvents[0].id).filter(person=>person.insider).map(person=>person.id);
  check(ids(automatic).length===3 && JSON.stringify(ids(automatic))===JSON.stringify(ids(automaticCopy)),'ratio assignment uses exact rounded counts and a stable selection independent of the outcome');
  const probabilityAgent={...trading.agents[0],traits:{...trading.agents[0].traits,newsProbability:80}};
  const phase1=trading.newsOpinion(probabilityAgent,1).details[0],phase2=trading.newsOpinion(probabilityAgent,5).details[0];
  check(phase1.draw===phase2.draw && phase1.phase==='insider' && trading.newsOpinion({...probabilityAgent,traits:{...probabilityAgent.traits,newsProbability:0}},1).effect===0,'private phases retain seeded probability draws and honor zero response probability');

  const publicConfig=fixture();publicConfig.participants.forEach(person=>person.newsAccess='public');
  const left=new MarketSimulation(publicConfig),right=new MarketSimulation(publicConfig);
  left.triggerCompanyIssue(issue);right.triggerCompanyIssue({...issue,actualImpact:-20});
  for(let tick=1;tick<12;tick++){left.step();right.step();assert.deepEqual(left.last,right.last);assert.equal(left.randomState,right.randomState);}
  check(left.price===right.price && left.publicNews()[0].actualImpact===null,'unaware participants never receive future outcomes through decisions, noise or public output');
  const immediate=new MarketSimulation(fixture());immediate.triggerCompanyIssue({...issue,announceDelayMinutes:0,insiderMode:'none'});
  check(immediate.publicNews()[0].actualImpact===12 && immediate.newsLog[0].tick===0 && immediate.newsOpinion(immediate.agents[1],0).effect===0.12,'zero-delay issues publish immediately at the current clock without losing their announcement log');
  const early=new MarketSimulation(fixture()),pending=early.triggerCompanyIssue({...issue,insiderLeadMinutes:1});early.step();early.announceCompanyIssue(pending.id);
  check(early.tick===1 && early.publicNews()[0].announceTick===1 && early.publicNews()[0].actualImpact===12 && early.newsLog.at(-1).tick===1,'an existing pending issue can be announced now without restarting the simulation');
  assert.throws(()=>early.announceCompanyIssue(pending.id));
  const noOrdersConfig=fixture();noOrdersConfig.participants.forEach(person=>person.newsStyle='ignore');
  const noOrders=new MarketSimulation(noOrdersConfig);noOrders.triggerCompanyIssue({...issue,announceDelayMinutes:0,insiderMode:'none'});noOrders.step();
  check(noOrders.price===10000 && noOrders.totalVolume===0,'publishing news never manufactures a price change or volume without counterpart orders');
  const population=defaultPopulation();population.enabled=true;population.distributions.newsAccess={auto:50,insider:25,public:25};
  const people=generatePopulation(population,42),restored=normalizeConfig(JSON.parse(JSON.stringify({...fixture(),population})));
  check(people.filter(p=>p.newsAccess==='insider').length===5 && people.filter(p=>p.newsAccess==='public').length===5 && restored.participants.every(p=>['auto','insider','public'].includes(p.newsAccess)),'individual access policies support population proportions and saved-configuration normalization');

  const exchangeConfig={...copy(DEFAULT_EXCHANGE_CONFIG),...fixture(),additionalCompanies:[]};exchangeConfig.marketControls.circuitBreaker.durationMinutes=1;exchangeConfig.marketControls.recoveryMinutes=1;
  const a=new SecuritiesSimulation(exchangeConfig),b=new SecuritiesSimulation(exchangeConfig);
  for(const exchange of [a,b]){
    exchange.triggerControl('breaker');exchange.triggerCompanyIssue('primary',{...issue,announceDelayMinutes:0,insiderMode:'none'});
    for(let tick=0;tick<78;tick++){
      exchange.step();verifyLedger(exchange);
      assert.equal(exchange.market().allAgents().reduce((sum,person)=>sum+person.shares,0),exchange.market().totalShares);
      if(tick<6)assert.equal(exchange.market().totalVolume,0);
    }
  }
  check(a.market().totalTrades>0 && JSON.stringify(a.market().last)===JSON.stringify(b.market().last) && JSON.stringify(a.market().candles)===JSON.stringify(b.market().candles),'issues remain public during trading halts, resume real trading, conserve assets and replay with identical actions');
  const limits=new MarketSimulation(fixture());for(let i=0;i<engine.MAX_LIVE_ISSUES;i++)limits.triggerCompanyIssue({...issue,insiderMode:'none'});
  assert.throws(()=>limits.triggerCompanyIssue(issue));passed.push('live issue history is bounded without erasing scheduled or earlier events');
  fs.mkdirSync('artifacts/simulation-issues',{recursive:true});fs.writeFileSync('artifacts/simulation-issues/engine-verification.json',JSON.stringify({checks:passed.length,passed,example:{public:trading.publicNews(),information:trading.informationReport(trading.newsEvents[0].id),trades:trading.totalTrades}},null,2));
  console.log(`${passed.length} focused live-issue checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
