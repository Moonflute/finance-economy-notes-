const {chromium}=require('C:/Users/kek28/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const url=process.env.FIELDBOOK_URL||'http://127.0.0.1:8765';
const output='artifacts/simulation-layout';

(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const report=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/#simulation');
  await page.locator('#simPlay').waitFor();
  const view=async key=>{await page.locator(`[data-sim-tab="${key}"]`).click();await page.waitForTimeout(80);};
  const inspect=async name=>{
   await page.waitForTimeout(80);
   const state=await page.evaluate(()=>{
    const visible=e=>e.getClientRects().length&&getComputedStyle(e).display!=='none';
    const selectors=['[data-sim-view]:not([hidden])','.sim-terminal-body','.sim-chart','.sim-orderbook','.sim-results-scroll','#simIndividualPanel','#simParticipants','#simPopulationPanel','#simDistributionEditor','#simTrades','.sim-model-notes>div:first-of-type'];
    const clipped=[];
    for(const selector of selectors)for(const e of document.querySelectorAll(selector)){
     if(!visible(e))continue;
     if(e.scrollHeight>e.clientHeight+3||e.scrollWidth>e.clientWidth+3)clipped.push({selector,height:[e.clientHeight,e.scrollHeight],width:[e.clientWidth,e.scrollWidth]});
    }
    const outside=[...document.querySelectorAll('#simulationRoot button,#simulationRoot input,#simulationRoot select')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.top<0||r.left<0||r.bottom>innerHeight+1||r.right>innerWidth+1;}).map(e=>e.id||e.textContent.trim());
    return {viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],clipped,outside};
   });
   report.push({name,...state});
  };
  await page.evaluate(()=>{for(let i=0;i<15;i++)document.querySelector('#simStep').click();});
  await view('settings');
  await page.locator('[data-config-mode="population"]').click();
  await page.locator('#simPopulationCount').fill('100');
  await page.locator('#simConfig button[type="submit"]').click();
  await page.evaluate(()=>{for(let i=0;i<15;i++)document.querySelector('#simStep').click();});
  for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:320,height:640}]){
   await page.setViewportSize(viewport);
   await view('chart');await inspect('chart');
   assert((await page.locator('#simChart canvas').boundingBox()).height>=100,'chart retains a usable drawing area');
   if(viewport.width===1280)await page.screenshot({path:output+'/chart-desktop.png'});
   if(viewport.width===320)await page.screenshot({path:output+'/chart-mobile.png'});
   await view('participants');await inspect('participants');
   const first=await page.locator('#simResults th').first().innerText();
   await page.locator('[data-result-page="1"]').click();
   assert.notEqual(await page.locator('#simResults th').first().innerText(),first,'result pagination reaches other participants');
   await view('activity');await inspect('activity');
   if(viewport.width<=700){await page.locator('[data-activity="analysis"]').click();await inspect('analysis');await page.locator('[data-activity="trades"]').click();}
   await view('settings');
   await page.locator('[data-settings-base]').click();await inspect('settings-base');
   await page.locator('[data-config-mode="individual"]').click();await inspect('settings-individual');
   await page.locator('[data-config-mode="population"]').click();
   await page.locator('#simDistributionSelect').selectOption('onRise');
   await inspect('settings-distribution');
   if(viewport.width===1280)await page.screenshot({path:output+'/settings-desktop.png'});
   if(viewport.width===320)await page.screenshot({path:output+'/settings-mobile.png'});
   await view('rules');
   const ruleCount=await page.locator('.sim-model-notes>div:first-of-type>p').count();
   for(let i=0;i<ruleCount;i++){await inspect('rules-'+i);if(i<ruleCount-1)await page.locator('[data-rule-page="1"]').click();}
   for(let i=0;i<ruleCount-1;i++)await page.locator('[data-rule-page="-1"]').click();
  }
  fs.writeFileSync(output+'/verification.json',JSON.stringify({report,errors},null,2));
  const failures=report.filter(r=>r.document[0]>r.viewport[0]||r.document[1]>r.viewport[1]||r.clipped.length||r.outside.length);
  if(failures.length)console.log(JSON.stringify(failures,null,2));
  assert.equal(errors.length,0,errors.join('; '));
  assert.equal(failures.length,0,'every screen fits without scroll or clipped controls');
  console.log(`LAYOUT PASS: ${report.length} focused screen checks at four viewport sizes.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
