// Focused checks for the read-only character view. No browser or full-day study.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const {SecuritiesSimulation:S,DEFAULT_EXCHANGE_CONFIG:D}=await import('../site/simulation-exchange.js');
  const {THOUGHTS,thoughtFor,characterReaction:reaction,characterFrame:frame,characterLayout:layout,ThoughtDirector}=await import('../site/simulation-character-state.js');
  const {characterSVG}=await import('../site/simulation-characters.js');
  const {defaultRosterPlan,generateRoster}=await import('../site/simulation-roster.js');
  const passed=[],check=(name,fn)=>{fn();passed.push(name);};
  const copy=value=>JSON.parse(JSON.stringify(value));
  const person=(patch={})=>({id:'p1',traits:{name:'관찰자',risk:70,panicThreshold:25,greedThreshold:75},emotion:50,shares:100,lastFilled:0,...patch});
  const context={tick:20,closed:false,halted:false,auction:false,thin:false};
  const state=s=>JSON.stringify({accounts:s.accounts,player:s.player,actions:s.actions,controls:s.controls.snapshot(),stepCount:s.stepCount,markets:s.markets.map(m=>({prices:m.prices,book:m.book,trades:m.tradeArchive,agents:m.agents,background:m.background,randomState:m.randomState,sequence:m.sequence,newsAssignments:m.newsAssignments,newsRolls:m.newsRolls,newsLog:m.newsLog,newsEvents:m.newsEvents,last:m.last,treasury:m.treasury}))});

  check('Orders and actual net fills remain distinct, including shorts and cover',()=>{
    assert.equal(reaction(person(),{side:'buy',quantity:20},context).kind,'buyOrder');
    assert.equal(reaction(person({shares:120,lastFilled:20}),{side:'buy',quantity:20},context).kind,'bought');
    assert.equal(reaction(person(),{side:'sell',quantity:20},context).kind,'sellOrder');
    assert.equal(reaction(person({shares:80,lastFilled:-20}),{},context).kind,'sold');
    assert.equal(reaction(person({shares:-20,lastFilled:-30}),{},context).kind,'shorted');
    assert.equal(reaction(person({shares:0,lastFilled:20}),{},context).kind,'covered');
  });
  check('Halt, close, auction and protection override ordinary mood',()=>{
    const a=person({emotion:90}),d={source:'emotion',emotion:{accepted:true,kind:'fomo'}};
    assert.equal(reaction(a,d,{...context,halted:true}).kind,'halted');
    assert.equal(reaction(a,d,{...context,closed:true}).kind,'closed');
    assert.equal(reaction(a,d,{...context,auction:true}).kind,'auction');
    assert.equal(reaction(a,{...d,forced:true},context).kind,'margin');
    for(const kind of ['stopLoss','takeProfit','trailingStop'])assert.equal(reaction(a,{riskExit:true,riskTrigger:{kind}},context).kind,kind);
    assert.equal(reaction(person({shares:-5}),{riskExit:true,riskTrigger:{kind:'trailingStop'}},context).kind,'shortTrail');
    assert.equal(reaction(a,{cooldown:true},context).kind,'cooldown');
  });
  check('Fear alone is not a panic sell; accepted emotion actions retain direction',()=>{
    assert.equal(reaction(person({emotion:10}),{},context).kind,'fear');
    const d={source:'emotion',emotion:{accepted:true,kind:'panic'}};
    assert.equal(reaction(person({emotion:10}),d,context).kind,'panic');
    assert.equal(reaction(person(),{...d,emotion:{accepted:false,kind:'panic'}},context).kind,'hold');
    for(const [action,kind] of [[1,'contrarianBuy'],[-1,'contrarianSell']])assert.equal(reaction(person(),{source:'emotion',emotion:{accepted:true,kind:'contrarian',action}},context).kind,kind);
  });
  check('Private-news lines require the participant’s recorded accepted information',()=>{
    const d={source:'news',side:'sell',quantity:10,news:[{phase:'insider',accepted:true,effect:-.1}]};
    assert.equal(reaction(person(),d,context).kind,'insider');
    assert.equal(reaction(person(),{...d,news:[{phase:'rumor',accepted:true,effect:-.1}]},context).kind,'rumor');
    assert.equal(reaction(person(),{...d,news:[{phase:'insider',accepted:false,effect:0}]},context).kind,'newsSell');
    assert.equal(reaction(person(),{news:d.news},context).kind,'hold');
  });
  check('Volume bursts without an order do not claim low volume or a fill',()=>{
    assert.equal(reaction(person(),{source:'volume',volume:{style:'reduce'}},context).kind,'volumeObserve');
    assert.equal(reaction(person(),{source:'volume',volume:{style:'cautious'}},context).kind,'volumeWait');
    assert.equal(reaction(person(),{source:'volume',side:'buy',quantity:5},context).kind,'volumeBuy');
  });
  check('Prewritten dialogue varies deterministically without immediate repetition',()=>{
    for(const [kind,lines] of Object.entries(THOUGHTS)){
      assert(lines.length>=4);assert.equal(new Set(lines).size,lines.length);
      const first=thoughtFor(kind,42,'p1',0);
      assert.equal(first,thoughtFor(kind,42,'p1',0));assert(lines.includes(first));
      assert.notEqual(first,thoughtFor(kind,42,'p1',0,first));
    }
    assert.equal(characterSVG(42,'p1'),characterSVG(42,'p1'));
    assert.notEqual(characterSVG(42,'p1'),characterSVG(42,'p2'));
  });
  check('Speech stays readable, freezes while paused, and respects a smaller limit',()=>{
    const people=Array.from({length:6},(_,i)=>({...reaction(person(),{},context),id:'p'+i})),director=new ThoughtDirector();
    director.update(people,42,0);const [id,first]=[...director.visible][0];
    for(let i=0;i<15;i++)director.update(people,42,.2);
    assert.equal(director.visible.get(id).text,first.text);assert.equal(director.visible.size,2);
    const frozen=JSON.stringify([...director.visible]),time=director.time;
    for(let i=0;i<20;i++)director.update(people,42,1,{running:false});
    assert.equal(director.time,time);assert.equal(JSON.stringify([...director.visible]),frozen);
    assert.equal(director.update(people,42,0,{limit:1}).size,1);
    const heard=new Set();
    for(let i=0;i<150;i++){director.update(people,42,.2);for(const id of director.visible.keys())heard.add(id);assert(director.visible.size<=2);}
    assert.equal(heard.size,people.length);
  });
  check('Changing the visible page removes other participants’ speech',()=>{
    const d=new ThoughtDirector(),p=reaction(person(),{},context);d.update([p],42,0);
    d.update([{...p,id:'p2'}],42,0);assert(!d.visible.has('p1'));
    d.reset();assert.equal(d.time,0);assert.equal(d.visible.size,0);
  });
  check('All 100 participants remain reachable at desktop and narrow viewport sizes',()=>{
    for(const [width,height] of [[1000,500],[800,350],[290,220],[260,140],[0,0]]){
      const l=layout(width,height,100);assert(l.size>=1&&l.size<=12);assert(l.columns>=1&&l.rows>=1);
      const ids=Array.from({length:100},(_,i)=>i),pages=[];
      for(let start=0;start<ids.length;start+=l.size)pages.push(...ids.slice(start,start+l.size));
      assert.deepEqual(pages,ids);
    }
    assert.equal(layout(290,220,6).columns,2);
    const config=copy(D);config.population={...config.population,enabled:false};config.participants=generateRoster(defaultRosterPlan(100),42);
    const s=new S(config),f=frame(s,s.market());assert.equal(f.people.length,100);assert.equal(new Set(f.people.map(p=>p.id)).size,100);
  });
  check('Observation reads no future news and mutates no live market state',()=>{
    const s=new S(copy(D)),m=s.market();s.step();const before=state(s),original=frame(s,m);
    for(const name of ['random','newsOpinion','decision','informationFor'])m[name]=()=>{throw Error('Observer invoked '+name);};
    for(let i=0;i<10;i++)assert.deepEqual(frame(s,m),original);
    assert.equal(state(s),before);
    m.newsEvents.push({id:'hidden',title:'아직 공개 안 된 테스트',actualImpact:-99,announceTick:999});
    assert.deepEqual(frame(s,m),original);
  });
  check('Showing characters repeatedly leaves the seeded multi-stock trajectory identical',()=>{
    const watched=new S(copy(D)),unwatched=new S(copy(D)),director=new ThoughtDirector();
    for(let tick=0;tick<60;tick++){
      watched.step();unwatched.step();
      for(const m of watched.markets){const f=frame(watched,m);director.update(f.people,f.seed,.5);frame(watched,m);}
    }
    assert.equal(state(watched),state(unwatched));
    assert(watched.markets.every(m=>frame(watched,m).people.length===watched.accounts.length));
  });
  const result={passed:passed.length,checks:passed,dialogueSituations:Object.keys(THOUGHTS).length,dialogueLines:Object.values(THOUGHTS).flat().length,browser:'Not run: local browser access unavailable for this chat.'};
  const dir=path.resolve(__dirname,'../artifacts/market-characters-20261112');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
