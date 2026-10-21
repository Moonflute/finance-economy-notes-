// Focused checks for intervention timing, probabilistic cooling and settlement.
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
  const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64'),copy=value=>JSON.parse(JSON.stringify(value));
  const engineUrl=url(fs.readFileSync('site/simulation-engine.js','utf8')),controlsUrl=url(fs.readFileSync('site/simulation-controls.js','utf8'));
  const rosterUrl='data:text/javascript;base64,'+Buffer.from(fs.readFileSync('site/simulation-roster.js','utf8').replace("'./simulation-engine.js'",JSON.stringify(engineUrl))).toString('base64');
  const exchangeSource=fs.readFileSync('site/simulation-exchange.js','utf8').replace("'./simulation-engine.js'",JSON.stringify(engineUrl)).replace("'./simulation-controls.js'",JSON.stringify(controlsUrl)).replace("'./simulation-roster.js'",JSON.stringify(rosterUrl));
  const {MarketSimulation}=await import(engineUrl),{MarketControls,DEFAULT_MARKET_CONTROLS,normalizeMarketControls}=await import(controlsUrl);
  const {SecuritiesSimulation,DEFAULT_EXCHANGE_CONFIG,normalizeExchangeConfig}=await import(url(exchangeSource));
  const passed=[],check=(value,message)=>{assert(value,message);passed.push(message);};
  const controls=patch=>({...copy(DEFAULT_MARKET_CONTROLS),...patch});
  const make=()=>{
    const config=copy(DEFAULT_EXCHANGE_CONFIG);config.population=undefined;config.companyNews=[];
    config.additionalCompanies.forEach(company=>company.companyNews=[]);
    config.participants=[30,70,90].map((risk,i)=>({name:`거래자 ${i+1}`,wealth:1000,risk,allocation:60,maxLeverage:1,onRise:'sell',onFall:'sell',riseProbability:80,fallProbability:80,newsStyle:'ignore'}));
    config.marketControls.sidecar.durationMinutes=1;config.marketControls.circuitBreaker.durationMinutes=1;config.marketControls.recoveryMinutes=1;
    return config;
  };
  const conserved=exchange=>{
    assert.equal([...exchange.accounts,exchange.player].reduce((sum,a)=>sum+a.cash,0),exchange.initialCash);
    for(const market of exchange.markets)assert.equal([...market.agents,market.manualAgent].reduce((sum,a)=>sum+a.shares,0),market.totalShares);
  };
  const legacy=make();delete legacy.marketControls;
  check(normalizeExchangeConfig(legacy).marketControls.sidecar.participation===15,'legacy saved settings gain validated intervention defaults');
  for(const patch of [{circuitBreaker:{thresholds:[8,8,20]}},{sidecar:{participation:-1}},{sidecar:{durationMinutes:0}},{recoveryMinutes:1.5}])assert.throws(()=>normalizeMarketControls({...copy(DEFAULT_MARKET_CONTROLS),...patch}));
  passed.push('invalid thresholds, participation, durations and noninteger clocks are rejected');

  const automaticConfig=make();automaticConfig.marketControls.sidecar.threshold=0.1;automaticConfig.marketControls.circuitBreaker.enabled=false;automaticConfig.participants.forEach(participant=>{participant.riseProbability=100;participant.fallProbability=100;});
  const automatic=new SecuritiesSimulation(automaticConfig);automatic.markets.forEach(market=>{market.random=()=>0.99;});
  automatic.submitOrder('primary',{action:'buy',type:'market',quantity:1000});automatic.step();conserved(automatic);
  check(automatic.market().manualOrder.filledQuantity>0 && automatic.controls.snapshot().phase==='sidecar' && Math.abs(automatic.controls.index-100*automatic.markets.reduce((sum,market)=>sum+market.price/market.config.initialPrice,0)/automatic.markets.length)<1e-12,'actual executions update the equal-weight exchange index and automatically trigger sidecar');

  const noBreaker=controls({circuitBreaker:{...DEFAULT_MARKET_CONTROLS.circuitBreaker,enabled:false}});
  for(const index of [105,95]){const c=new MarketControls(noBreaker);c.observe(1,index);assert.equal(c.snapshot().phase,'sidecar');}
  const below=new MarketControls(noBreaker);below.observe(1,104.99);
  check(below.snapshot().phase==='normal','sidecar triggers inclusively for rises and falls, but not below its threshold');
  const oldMove=new MarketControls(noBreaker);oldMove.history=[{tick:0,index:100},{tick:6,index:105}];oldMove.observe(12,105);
  check(oldMove.snapshot().phase==='normal','sidecar uses the rolling window rather than the cumulative start-to-current move');
  const cooling=new MarketControls(controls({sidecar:{...noBreaker.sidecar,durationMinutes:1,cooldownMinutes:1},circuitBreaker:noBreaker.circuitBreaker,recoveryMinutes:1}));
  cooling.observe(1,105);
  check(cooling.snapshot().participation===0.15 && cooling.snapshot().remainingTicks===6,'sidecar immediately schedules one full configured duration at 15 percent participation');
  cooling.observe(6,105);assert.equal(cooling.snapshot().phase,'sidecar');cooling.observe(7,105);
  check(cooling.snapshot().phase==='recovering' && cooling.snapshot().participation===0.15 && cooling.snapshot().cooldownRemaining===6,'sidecar expires at the boundary and retains a separate reactivation cooldown');
  assert.throws(()=>cooling.trigger('sidecar'));cooling.observe(10,105);
  check(Math.abs(cooling.snapshot().participation-0.575)<1e-12,'post-sidecar participation recovers gradually instead of jumping to full heat');
  cooling.observe(13,105);cooling.trigger('sidecar');
  check(cooling.snapshot().phase==='sidecar','sidecar can reactivate after its cooldown ends');

  const stages=new MarketControls(controls({circuitBreaker:{...DEFAULT_MARKET_CONTROLS.circuitBreaker,durationMinutes:1},recoveryMinutes:0}));
  stages.observe(1,92);check(stages.snapshot().halted && stages.breakerStage===1 && !stages.snapshot().sidecar,'circuit breaker wins when a fall also crosses the sidecar threshold');
  stages.observe(7,92,{halted:true});stages.observe(8,92);
  check(!stages.snapshot().halted && stages.events.filter(e=>e.type==='breaker').length===1,'a completed stage does not repeatedly halt at the same index level');
  stages.observe(9,84);assert.equal(stages.breakerStage,2);stages.observe(15,84,{halted:true});stages.observe(16,79);
  const gap=new MarketControls(DEFAULT_MARKET_CONTROLS);gap.observe(1,79);
  check(stages.breakerStage===3 && gap.breakerStage===3,'successive deeper declines advance stages, and a gap can trigger the highest stage directly');
  const overlap=new MarketControls(controls({sidecar:{...noBreaker.sidecar,durationMinutes:1,cooldownMinutes:0},recoveryMinutes:1}));
  overlap.trigger('sidecar');overlap.observe(6,100);overlap.observe(9,100);overlap.trigger('sidecar');overlap.observe(12,100);
  check(overlap.snapshot().phase==='sidecar' && !overlap.events.some(event=>event.type==='recovered'),'an overlapping intervention never reports full recovery while cooling is still active');

  const config=make();config.companyNews=[{id:'during-halt',title:'중단 중 발표',announceMinute:1,leadMinutes:0,durationMinutes:5,expectedImpact:0,actualImpact:5}];
  const exchange=new SecuritiesSimulation(config);
  exchange.submitOrder('primary',{action:'buy',type:'limit',quantity:10,limit:100});
  exchange.submitOrder('daily',{action:'buy',type:'limit',quantity:10,limit:100});
  const accountsBefore=JSON.stringify([...exchange.accounts,exchange.player]),prices=exchange.markets.map(m=>m.price),reserved=exchange.reservations();
  exchange.triggerControl('breaker');assert.throws(()=>exchange.submitOrder('prime',{action:'buy',type:'market',quantity:1}));
  check(exchange.maxOrderQuantity('prime','buy')===0 && exchange.markets.every(m=>!m.orderBook.bids.length && !m.orderBook.asks.length),'halt blocks new player orders and clears all displayed books');
  for(let i=0;i<6;i++){exchange.step();conserved(exchange);}
  check(exchange.tick===6 && JSON.stringify([...exchange.accounts,exchange.player])===accountsBefore && exchange.markets.every((m,i)=>m.price===prices[i] && m.totalVolume===0 && m.last.decisions.every(d=>d.label==='거래 중단')),'all securities, cash, shares and margin executions freeze for six ten-second ticks');
  check(exchange.market().newsLog.some(event=>event.phase==='announced') && exchange.markets.every(m=>m.candles[0].volume===0 && m.candles[0].open===m.candles[0].close),'halted ticks still advance announcements and record flat zero-volume candles');
  check(exchange.market().manualOrder.status==='queued' && JSON.stringify(exchange.reservations())===JSON.stringify(reserved),'pending limits and their cross-stock collateral reservations survive a halt');
  check(exchange.controls.snapshot().phase==='recovering' && exchange.controls.snapshot().participation===0.25,'breaker resumes at 25 percent participation after exactly its configured halt');
  const canceling=new SecuritiesSimulation(make());canceling.submitOrder('primary',{action:'buy',type:'limit',quantity:1,limit:100});canceling.triggerControl('breaker');
  check(canceling.cancelOrder('primary') && canceling.market().manualOrder.status==='canceled','pending order cancellation remains available during a circuit breaker');
  exchange.cancelOrder('primary');exchange.cancelOrder('daily');exchange.submitOrder('prime',{action:'buy',type:'market',quantity:10});
  for(let i=0;i<7;i++){exchange.step();conserved(exchange);}
  check(exchange.controls.snapshot().phase==='normal' && exchange.controls.events.some(event=>event.type==='resume'),'trading resumes and its recovery completes with an event history');

  const isolated=new MarketSimulation({...make(),participants:make().participants.map(p=>({...p,onRise:'buy',onFall:'buy'}))});
  const context={momentum:0,valueGap:0,sentiment:0,tick:1,participationFactor:0.15,controlPhase:'sidecar'};let accepted=0;
  for(let i=0;i<2000;i++)if(isolated.decision(isolated.agents[0],context).executed)accepted++;
  check(accepted/2000>0.09 && accepted/2000<0.15,`80 percent behavior at 15 percent participation is probabilistic (observed ${accepted/20} percent)`);
  const noActivity=new MarketSimulation({...make(),companyNews:config.companyNews});
  noActivity.tick=6;noActivity.agents.forEach(agent=>Object.assign(agent.traits,{newsStyle:'confirm',newsProbability:100,newsDelay:0}));
  noActivity.step({participationFactor:0,controlPhase:'sidecar'});
  check(noActivity.last.orders.length===0 && noActivity.agents.every(a=>a.heat===0 && a.lastAction==='안정 대기'),'zero participation suppresses ordinary and accepted-news orders without creating trades');
  const normal=new MarketSimulation(make()),half=new MarketSimulation(make());normal.random=half.random=()=>0;
  normal.step();half.step({participationFactor:0.5,controlPhase:'sidecar'});
  check(half.last.orders.every((order,i)=>order.quantity<=normal.last.orders[i].quantity/2) && half.agents.every(a=>a.heat===a.traits.risk/2),'cooling reduces order quantity and each participant heat even when the participation draw succeeds');
  const margin=half.agents[0];margin.shares=10000;margin.cash=-95000000;
  check(half.decision(margin,{...context,participationFactor:0}).forced && !half.decision(margin,{...context,halted:true}).forced,'sidecar does not suppress mandatory margin reductions, but a full halt does');
  const playerDuringSidecar=new SecuritiesSimulation(make());playerDuringSidecar.config.marketControls.sidecar.participation=0;playerDuringSidecar.controls.config.sidecar.participation=0;playerDuringSidecar.triggerControl('sidecar');
  playerDuringSidecar.submitOrder('primary',{action:'buy',type:'market',quantity:1});playerDuringSidecar.step();
  check(playerDuringSidecar.market().last.orders.some(order=>order.agentId==='player'),'sidecar leaves direct player orders available');
  const left=new SecuritiesSimulation(make()),right=new SecuritiesSimulation(make());
  for(const market of [left,right]){market.triggerControl('sidecar');for(let tick=0;tick<16;tick++){market.step();conserved(market);}market.triggerControl('breaker');for(let tick=0;tick<15;tick++){market.step();conserved(market);}}
  check(JSON.stringify(left.markets.map(m=>[m.prices,m.trades,m.last]))===JSON.stringify(right.markets.map(m=>[m.prices,m.trades,m.last])) && JSON.stringify(left.controls.events)===JSON.stringify(right.controls.events),'identical seeds and intervention actions replay deterministically with conserved settlement');
  fs.mkdirSync('artifacts/simulation-controls',{recursive:true});fs.writeFileSync('artifacts/simulation-controls/engine-verification.json',JSON.stringify({checks:passed.length,passed,probabilitySample:{draws:2000,accepted},events:exchange.controls.events},null,2));
  console.log(`${passed.length} focused market-control checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
