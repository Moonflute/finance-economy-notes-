// Focused acceptance checks for finite and unlimited player funding.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/kek28/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve('dist'),output='artifacts/simulation-unlimited';
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
(async()=>{
  const engineUrl=dataUrl(fs.readFileSync('site/simulation-engine.js','utf8'));
  const controlsUrl=dataUrl(fs.readFileSync('site/simulation-controls.js','utf8'));
  const rosterUrl=dataUrl(fs.readFileSync('site/simulation-roster.js','utf8').replace("'./simulation-engine.js'",JSON.stringify(engineUrl)));
  const exchangeUrl=dataUrl(fs.readFileSync('site/simulation-exchange.js','utf8').replace("'./simulation-engine.js'",JSON.stringify(engineUrl)).replace("'./simulation-controls.js'",JSON.stringify(controlsUrl)).replace("'./simulation-roster.js'",JSON.stringify(rosterUrl)));
  const {DEFAULT_EXCHANGE_CONFIG}=await import('../site/simulation-exchange.js');
  const fixture=JSON.parse(JSON.stringify(DEFAULT_EXCHANGE_CONFIG));
  fixture.companyNews=[];fixture.additionalCompanies.forEach(company=>{company.companyNews=[]});
  fixture.marketControls.sidecar.enabled=false;fixture.marketControls.circuitBreaker.enabled=false;
  fixture.participants=[40,70,90].map((risk,index)=>({name:`거래자 ${index+1}`,wealth:500000,risk,allocation:60,maxLeverage:1,onRise:'sell',onFall:'sell',riseProbability:100,fallProbability:100,newsStyle:'ignore',volumeStyle:'ignore',emotionStyle:'ignore'}));
  const server=http.createServer((request,response)=>{
    const relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\/finance-economy-notes-\//,'');
    const file=path.resolve(root,relative || 'index.html');
    if(!file.startsWith(root+path.sep) || !fs.existsSync(file)){response.writeHead(404).end();return;}
    const type={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)] || 'application/octet-stream';
    response.writeHead(200,{'Content-Type':type});fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true,channel:'msedge'});
    const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'}),errors=[],passed=[];
    const check=(condition,message)=>{assert(condition,message);passed.push(message)};
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(config=>{
      if(!localStorage.getItem('fieldbook-simulation-config-v1'))localStorage.setItem('fieldbook-simulation-config-v1',JSON.stringify(config));
    },fixture);
    const base=`http://127.0.0.1:${server.address().port}/finance-economy-notes-/`;
    const settings=async()=>{await page.locator('[data-sim-tab="settings"]').click();await page.locator('[data-settings-base]').click()};
    const apply=async unlimited=>{
      await page.locator('#simConfig button[type="submit"]').click();
      await page.waitForFunction(value=>JSON.parse(localStorage.getItem('fieldbook-simulation-config-v1')).player.unlimited===value,unlimited);
      check(await page.locator('#simConfigError').innerText()==='','funding settings apply without errors');
    };
    const trading=async()=>{await page.locator('[data-sim-tab="chart"]').click();if(!await page.locator('.sim-trading-ticket').isVisible())await page.locator('.sim-manual-toggle').click()};
    await page.goto(base+'#simulation');await page.locator('#simPlay').waitFor();await settings();
    check(await page.locator('#simPlayerWealth').getAttribute('max')===null,'player funding input has no business maximum');
    await page.locator('#simPlayerWealth').fill('100000000');await apply(false);
    check(await page.evaluate(()=>JSON.parse(localStorage.getItem('fieldbook-simulation-config-v1')).player.wealth)===100000000,'one trillion KRW is accepted and saved as a finite budget');
    fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:output+'/funds-desktop.png'});
    await page.locator('#simPlayerFundsMode').selectOption('unlimited');
    check(!await page.locator('#simPlayerWealth').isVisible() && await page.locator('#simPlayerWealth').isDisabled(),'unlimited mode replaces the finite amount input');
    await apply(true);await trading();
    check((await page.locator('#simPlayerCash').innerText()).includes('무제한'),'unlimited buying power is visible in the order panel');
    check(await page.locator('#simOrderQuantity').getAttribute('max')===null && !await page.locator('[data-order-max]').isVisible(),'order quantities have no former ten-million-share cap or misleading infinite maximum button');
    check(await page.locator('#simOrderLeverage').isDisabled(),'unlimited funding does not offer an ineffective leverage control');
    await page.locator('#simOrderQuantity').fill('10000001');await page.locator('#simSubmitOrder').click();
    check(await page.locator('#simOrderError').innerText()==='' && /부분 체결/.test(await page.locator('#simManualOrderStatus').innerText()),'an order above ten million shares actually fills against available counterparties');
    await page.locator('[data-trading-view="account"]').click();
    check((await page.locator('#simPlayerMetrics').innerText()).includes('∞') && !/NaN|Infinity|undefined/.test(await page.locator('#simPlayerMetrics').innerText()),'unlimited cash and net assets display correctly alongside numeric profit');
    await page.reload();await page.locator('#simPlay').waitFor();await trading();
    check((await page.locator('#simPlayerCash').innerText()).includes('무제한'),'unlimited funding survives reload');
    await settings();await page.locator('#simPlayerFundsMode').selectOption('finite');
    check(await page.locator('#simPlayerWealth').inputValue()==='100000000','switching modes retains the last finite budget');
    await page.locator('#simDiscard').click();
    check(await page.locator('#simPlayerFundsMode').inputValue()==='unlimited','canceling a draft restores the active unlimited mode');
    await page.locator('#simPlayerFundsMode').selectOption('finite');await page.locator('#simPlayerWealth').fill('10000');await apply(false);await trading();
    check(!(await page.locator('#simPlayerCash').innerText()).includes('무제한') && await page.locator('#simOrderLeverage').isEnabled(),'switching back restores the finite account and leverage controls');
    await page.setViewportSize({width:320,height:640});await settings();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'finite funding settings fit a 320px viewport');
    await page.locator('#simPlayerFundsMode').selectOption('unlimited');await apply(true);await trading();
    await page.screenshot({path:output+'/funds-mobile.png'});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'unlimited trading fits a 320px viewport');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(output+'/browser-verification.json',JSON.stringify({checks:passed.length,passed,runtimeErrors:errors},null,2));
    console.log(`UNLIMITED BROWSER PASS: ${passed.length} checks.`);
  }finally{
    if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
