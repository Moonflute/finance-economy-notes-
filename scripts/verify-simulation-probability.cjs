// Focused checks for individual action probabilities and their settlement effects.
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const source = fs.readFileSync('site/simulation-engine.js');
  const {MarketSimulation, DEFAULT_CONFIG, normalizeConfig, defaultPopulation} = await import('data:text/javascript;base64,'+source.toString('base64'));
  const copy = value => JSON.parse(JSON.stringify(value));
  const passed = [];
  const check = (condition, message) => {assert(condition, message); passed.push(message);};
  const config = copy(DEFAULT_CONFIG);
  config.companyNews=[]; // News has a separate probability and takes priority when accepted.
  config.participants.forEach(p => {p.onRise='sell';p.onFall='sell';p.riseProbability=80;p.fallProbability=80;});
  const context = {momentum:0.01, sentiment:0, tick:1, price:10000};

  const boundary = new MarketSimulation(config), agent = boundary.agents[0];
  boundary.random = () => 0.799999;
  check(boundary.decision(agent,context).executed,'a draw below 0.8 selects an 80% sell action');
  boundary.random = () => 0.8;
  const skipped = boundary.decision(agent,context);
  check(!skipped.executed && skipped.targetShares===agent.shares && skipped.label==='관망','a draw at 0.8 holds the position instead of selling');
  agent.traits.riseProbability=0; agent.traits.fallProbability=100;
  boundary.random = () => 0.5;
  check(!boundary.decision(agent,context).executed && boundary.decision(agent,{...context,momentum:-0.01}).executed,'rise and fall probabilities are independent, including exact 0% and 100%');
  agent.cash=-agent.shares*boundary.price;
  const forced=boundary.decision(agent,context);
  check(forced.forced && forced.targetShares===0,'zero execution probability cannot suppress a required collateral reduction');

  const frequency = new MarketSimulation(config);
  let selected=0;
  for(let i=0;i<2000;i++) if(frequency.decision(frequency.agents[0],context).executed)selected++;
  check(selected>=1540 && selected<=1660,'2,000 seeded decisions select the 80% action within three percentage points');

  const inactive=copy(config);
  inactive.participants.forEach(p=>{p.riseProbability=0;p.fallProbability=0;});
  const flat=new MarketSimulation(inactive);
  for(let i=0;i<30;i++){
    flat.step();
    assert(flat.last.decisions.every(d=>d.quantity===0 && d.executed===false));
  }
  check(flat.price===inactive.initialPrice && flat.totalVolume===0,'unselected actions submit no orders and create no fabricated trades');

  const first=new MarketSimulation(config), replay=new MarketSimulation(config), different=new MarketSimulation({...config,seed:43});
  // Use the normal mixed behavior configuration to exercise actual matching.
  const mixed=copy(DEFAULT_CONFIG);
  const market=new MarketSimulation(mixed), duplicate=new MarketSimulation(mixed);
  for(let i=0;i<240;i++){
    first.step();replay.step();different.step();market.step();duplicate.step();
    assert.deepEqual(first.last,replay.last);
    assert.deepEqual(market.last,duplicate.last);
    assert.equal(market.agents.reduce((s,a)=>s+a.cash,0),market.initialCash);
    assert.equal(market.agents.reduce((s,a)=>s+a.shares,0),market.totalShares);
  }
  check(JSON.stringify(first.candles)===JSON.stringify(replay.candles) && JSON.stringify(first.last.decisions)!==JSON.stringify(different.last.decisions),'same settings and seed replay decisions; changing the seed changes the draws');
  check(market.totalVolume>0 && JSON.stringify(market.candles)===JSON.stringify(duplicate.candles),'mixed probabilistic agents trade while conserving cash and shares');

  const legacy=copy(DEFAULT_CONFIG);
  legacy.participants.forEach(p=>{delete p.riseProbability;delete p.fallProbability;});
  check(normalizeConfig(legacy).participants.every(p=>p.riseProbability===100 && p.fallProbability===100),'older individual profiles without probability fields retain always-selected behavior');
  for(const value of [-1,101,'',NaN]){
    const invalid=copy(config); invalid.participants[0].riseProbability=value;
    assert.throws(()=>normalizeConfig(invalid));
  }
  passed.push('invalid probability values cannot enter the simulation');
  const population=defaultPopulation();population.enabled=true;
  const generated=normalizeConfig({...DEFAULT_CONFIG,population});
  check(generated.participants.every(p=>p.riseProbability===80 && p.fallProbability===80),'population proportions generate real per-person execution probabilities');
  const manual=copy(generated);delete manual.population;manual.participants[0].fallProbability=25;
  check(normalizeConfig(manual).participants[0].fallProbability===25 && manual.participants.slice(1).every(p=>p.fallProbability===80),'one generated participant can be changed without regenerating the others');

  fs.mkdirSync('artifacts/simulation-probability',{recursive:true});
  fs.writeFileSync('artifacts/simulation-probability/engine-verification.json',JSON.stringify({checks:passed.length,passed,sampled:{trials:2000,selected,percent:selected/20}},null,2));
  console.log(`PROBABILITY PASS: ${passed.length} checks; 80% sampled at ${selected/20}% over 2,000 decisions.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
