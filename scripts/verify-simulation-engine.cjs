const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const source = fs.readFileSync('site/simulation-engine.js');
  const {MarketSimulation,DEFAULT_CONFIG:DEFAULT_WITH_NEWS,PARTICIPANT_ATTRIBUTES,REACTIONS,aggregateCandles,normalizeConfig} = await import('data:text/javascript;base64,'+source.toString('base64'));
  const DEFAULT_CONFIG={...DEFAULT_WITH_NEWS,companyNews:[]}; // Isolate the original price-response rules.
  const clone = value => JSON.parse(JSON.stringify(value));
  const checks = [];
  const check = (condition,name) => {assert(condition,name); checks.push(name);};
  const a = new MarketSimulation(), b = new MarketSimulation();
  for (let i=0;i<1800;i++) {a.step(); b.step();}
  assert.deepEqual(a,b);
  checks.push('same seed reproduces every decision, trade and candle');
  check(a.totalVolume>0 && a.candles.length===300,'default market trades and produces actual minute candles');
  const c = new MarketSimulation({...DEFAULT_CONFIG,seed:123});
  for (let i=0;i<1800;i++) c.step();
  check(JSON.stringify(a.candles)!==JSON.stringify(c.candles),'different seeds produce different price paths');

  for (const seed of [1,42,123,999]) {
    const market = new MarketSimulation({...DEFAULT_CONFIG,seed});
    let volume = 0, peak = market.price, drawdown = 0;
    for (let tick=0;tick<7200;tick++) {
      const before = market.price, result = market.step();
      assert(Number.isSafeInteger(market.price) && market.price>0);
      assert.equal(market.agents.reduce((sum,p)=>sum+p.shares,0),market.totalShares,'stock settlement conserves shares');
      assert.equal(market.agents.reduce((sum,p)=>sum+p.cash,0),market.initialCash,'stock settlement conserves net cash');
      assert.equal(market.agents.reduce((sum,p)=>sum+market.equity(p),0),market.initialCash+market.totalShares*market.price,'aggregate marked equity reconciles');
      const last = market.candles.at(-1);
      assert(last.high>=Math.max(last.open,last.close) && last.low<=Math.min(last.open,last.close));
      assert(last.low>0 && last.volume>=0);
      if (!result.tradeCount) assert.equal(market.price,before,'no matched orders means no price change');
      volume += result.volume;
      // Trades are retained newest first. Rebuild the chronological maximum drawdown.
      for (const trade of market.trades.filter(t=>t.tick===market.tick).reverse()) {
        peak=Math.max(peak,trade.price); drawdown=Math.max(drawdown,1-trade.price/peak);
        assert(trade.buyer!==trade.seller);
        assert(Number.isSafeInteger(trade.quantity) && trade.quantity>0);
      }
    }
    assert.equal(market.totalVolume,volume);
    assert(Math.abs(market.maxDrawdown-drawdown)<1e-12);
    assert.equal(market.candles.reduce((sum,row)=>sum+row.volume,0),volume);
    check(market.candles.length===1200 && market.trades.length<=40,`seed ${seed}: 7,200 ticks conserve cash/shares, reconcile equity, OHLC, volume and drawdown`);
    market.step();
    check(market.candles.length===1200,`seed ${seed}: chart history remains bounded`);
  }
  const holdConfig=clone(DEFAULT_CONFIG);
  holdConfig.participants.forEach(p=>{p.onRise='hold';p.onFall='hold';});
  const hold=new MarketSimulation(holdConfig);
  for(let i=0;i<600;i++)hold.step();
  check(hold.price===holdConfig.initialPrice && hold.totalVolume===0,'all-hold market stays flat with zero fabricated volume');
  const onlyBuy=clone(DEFAULT_CONFIG);
  onlyBuy.participants.forEach(p=>{p.allocation=0;p.onRise='buy';p.onFall='buy';});
  const illiquid=new MarketSimulation(onlyBuy);
  for(let i=0;i<120;i++)illiquid.step();
  check(illiquid.totalVolume===0 && illiquid.price===onlyBuy.initialPrice,'one-sided orders cannot create trades without a seller');
  const grouped=aggregateCandles(a.candles,5);
  check(grouped.length===60 && grouped[0].open===a.candles[0].open && grouped[0].close===a.candles[4].close,'five-minute candles preserve open and close');
  check(grouped.reduce((sum,row)=>sum+row.volume,0)===a.totalVolume,'five-minute aggregation preserves volume');
  const lowRisk=clone(DEFAULT_CONFIG), highRisk=clone(DEFAULT_CONFIG);
  lowRisk.participants[0].riseProbability=100; highRisk.participants[0].riseProbability=100;
  lowRisk.participants[0].risk=0; highRisk.participants[0].risk=100;
  const low=new MarketSimulation(lowRisk), high=new MarketSimulation(highRisk);
  low.step(); high.step();
  check(high.last.decisions[0].quantity>low.last.decisions[0].quantity,'risk tolerance affects actual order size');
  const changed=clone(DEFAULT_CONFIG);changed.participants[0].onRise='hold';
  const changedMarket=new MarketSimulation(changed);changedMarket.step();
  check(changedMarket.last.decisions[0].quantity===0,'changing the rise response changes actual orders');
  const larger=clone(DEFAULT_CONFIG);larger.participants[0].wealth*=2;
  larger.participants[0].riseProbability=100;
  const rich=new MarketSimulation(larger);rich.step();
  const regularConfig=clone(DEFAULT_CONFIG);regularConfig.participants[0].riseProbability=100;
  const regular=new MarketSimulation(regularConfig);regular.step();
  check(rich.last.decisions[0].quantity>regular.last.decisions[0].quantity,'wealth affects buying power');
  const extendedAttributes=[...PARTICIPANT_ATTRIBUTES,{key:'conviction',label:'확신',type:'number',min:0,max:1,default:0.25}];
  const extendedReactions={...REACTIONS,custom:{label:'확신에 따른 비중',target:({agent})=>agent.traits.conviction}};
  const extendedConfig=clone(DEFAULT_CONFIG);extendedConfig.participants[0].onRise='custom';
  extendedConfig.participants[0].riseProbability=100;
  const extended=new MarketSimulation(extendedConfig,{attributes:extendedAttributes,reactions:extendedReactions,decisionModifiers:[({target,agent})=>agent.id==='p1'?target+0.1:target]});
  extended.step();
  check(extended.agents[0].traits.conviction===0.25 && extended.last.decisions[0].targetShares===5250,'new attributes, behaviors and decision modifiers work without changing settlement');
  const huge=clone(DEFAULT_CONFIG);huge.participants.forEach(p=>{p.wealth=10000000;});
  const large=new MarketSimulation(huge);for(let i=0;i<1200;i++)large.step();
  check(large.agents.every(p=>Number.isSafeInteger(p.cash)),'largest supported starting fortunes remain numerically safe');
  for(const mutation of [x=>x.participants=[],x=>x.initialPrice=0,x=>x.seed=NaN,x=>x.participants[0].risk=101,x=>x.participants[0].wealth='',x=>x.participants[0].onRise='unknown',x=>x.company='']) {
    const invalid=clone(DEFAULT_CONFIG);mutation(invalid);assert.throws(()=>normalizeConfig(invalid));
  }
  checks.push('invalid participants, price, seed, risk, wealth, behavior and company are rejected');
  fs.mkdirSync('artifacts/simulation-v1',{recursive:true});
  fs.writeFileSync('artifacts/simulation-v1/engine-verification.json',JSON.stringify({checks:checks.length,passed:checks},null,2));
  console.log(`SIMULATION ENGINE PASS: ${checks.length} checks; 4 seeds × 7,200 ticks plus edge cases.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
