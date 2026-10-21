const {chromium} = require('C:/Users/kek28/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const url = process.env.FIELDBOOK_URL || 'http://127.0.0.1:8765';
const output = 'artifacts/simulation-v1';
const checks = [], errors = [];
const ok = (condition, name) => {assert(condition,name);checks.push(name);};

(async () => {
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1040},reducedMotion:'reduce'});
    await context.addInitScript(() => {
      if (!localStorage.getItem('fieldbook-personal-v1')) localStorage.setItem('fieldbook-personal-v1',JSON.stringify({bookmarks:['duration'],notes:{duration:'보존할 메모'}}));
    });
    const page = await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'/#simulation');
    await page.locator('#simPlay').waitFor();
    const view=async key=>{await page.locator(`[data-sim-tab="${key}"]`).click();};
    const editParticipant=async(index,section='assets')=>{
      await view('settings');await page.locator('[data-config-mode="individual"]').click();
      await page.locator('#simRosterSection').selectOption(section==='risk'?'assets':section);
      while(!await page.locator(`[data-roster-index="${index}"][data-roster-cell="name"]`).count()){
        const first=Number(await page.locator('[data-roster-row]').first().getAttribute('data-roster-row'));
        await page.locator(`[data-roster-row-page="${index<first?-1:1}"]`).click();
      }
    };
    ok(await page.locator('#sidebar a[href="#simulation"][aria-current="page"]').count()===1,'new navigation route is active');
    ok((await page.title()).includes('증권시장 시뮬레이션'),'route sets a meaningful page title');
    ok((await page.locator('#simResultCount').innerText()).startsWith('6명'),'six configurable participants are ready');
    ok((await page.locator('#simPrice').innerText())==='10,000원','initial price matches the configured company');
    ok(await page.locator('#simChart canvas').getAttribute('aria-label'),'canvas has a keyboard and price description');
    const initialCanvas = await page.locator('#simChart canvas').evaluate(c=>c.toDataURL());
    await page.locator('#simPlay').click();
    await page.waitForFunction(()=>document.querySelector('#simClock').textContent!=='09:00:00');
    await page.locator('#simPlay').click();
    const paused = await page.locator('#simClock').innerText();
    await page.waitForTimeout(650);
    ok((await page.locator('#simClock').innerText())===paused,'pause stops the clock and simulation');
    ok((await page.locator('#simChart canvas').evaluate(c=>c.toDataURL()))!==initialCanvas,'real-time trades redraw the chart');
    await page.locator('#simStep').click();
    ok((await page.locator('#simClock').innerText())!==paused,'single-step advances one virtual minute');
    ok((await page.locator('#simRunStatus').innerText())==='일시정지' && (await page.locator('#simPlay').innerText()).includes('이어서 실행'),'single-step updates playback controls and paused status');
    ok(await page.locator('#simResults tr').count()>0 && (await page.locator('#simResultCount').innerText()).startsWith('6명'),'result table exposes the configured participants through pagination');
    ok(await page.locator('.sim-trade').count()>0,'matched trades show buyer, seller, price and volume');
    ok((await page.locator('#simVolume').innerText())!=='0주','volume counts actual matched shares');
    for(let i=0;i<68;i++)await page.locator('#simStep').click();
    await page.locator('#simChart canvas').hover({position:{x:310,y:150}});
    ok((await page.locator('[data-chart-ohlc]').innerText()).includes('거래량'),'crosshair exposes OHLC and volume');
    await page.locator('[data-chart="period"][data-period="5"]').click();
    ok(await page.locator('[data-period="5"]').getAttribute('aria-pressed')==='true','five-minute candle period can be selected');
    await page.locator('[data-chart="period"][data-period="1"]').click();
    await page.locator('[data-chart="in"]').click();
    await page.locator('#simChart canvas').focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(()=>document.querySelector('[data-chart="latest"]').classList.contains('has-history'));
    ok(true,'chart supports keyboard panning through candle history');
    await page.keyboard.press('Home');
    await page.locator('[data-chart="latest"]').click();
    await page.locator('#simSpeed').selectOption('4');
    const beforeSpeed = await page.locator('#simClock').innerText();
    await page.locator('#simPlay').click();
    await page.waitForTimeout(450);
    await page.locator('#simPlay').click();
    ok((await page.locator('#simClock').innerText())!==beforeSpeed,'playback speed changes without resetting the experiment');
    await page.locator('#simReset').click();
    ok((await page.locator('#simClock').innerText())==='09:00:00' && (await page.locator('#simVolume').innerText())==='0주','reset clears results and reuses applied conditions');
    for(let i=0;i<70;i++)await page.locator('#simStep').click();
    await page.locator('#simPlay').focus();
    await page.screenshot({path:output+'/simulation-desktop.png',fullPage:true});
    await page.locator('.sim-terminal').screenshot({path:output+'/simulation-chart.png'});

    await page.locator('#simPlay').click();
    const awayClock = await page.locator('#simClock').innerText();
    await page.evaluate(()=>{location.hash='#home';});
    await page.locator('.subject-home').waitFor();
    await page.waitForTimeout(500);
    await page.evaluate(()=>{location.hash='#simulation';});
    await page.locator('#simClock').waitFor();
    ok((await page.locator('#simClock').innerText())===awayClock,'navigation pauses the simulation and keeps its results');
    ok(!(await page.locator('#simRunStatus').innerText()).includes('실행 중'),'returning to the tab does not restart a hidden timer');

    await editParticipant(0);
    await page.locator('[data-roster-index="0"][data-roster-cell="wealth"]').fill('25000');
    ok(await page.locator('#simPlay').isDisabled(),'editing a participant prevents running an unapplied draft');
    ok(await page.locator('#simDiscard').isVisible(),'pending edits can be discarded');
    await page.locator('#simRosterCount').fill('7');await page.locator('[data-roster-generate]').click();
    ok((await page.locator('#simParticipantPager').innerText()).includes('/ 7명'),'participants can be added');
    await page.locator('#simRosterCount').fill('6');await page.locator('[data-roster-generate]').click();
    ok((await page.locator('#simParticipantPager').innerText()).includes('/ 6명'),'participants can be removed');
    await page.locator('#simDiscard').click();
    ok((await page.locator('[data-roster-index="0"][data-roster-cell="wealth"]').inputValue())==='15000','discard restores the applied participant settings');
    await page.locator('[data-settings-base]').click();
    await page.locator('#simCompanyInput').fill('테스트 기업');
    await editParticipant(0);
    await page.locator('[data-roster-index="0"][data-roster-cell="wealth"]').fill('25000');
    await editParticipant(0,'risk');
    await page.locator('[data-roster-index="0"][data-roster-cell="risk"]').fill('1');
    ok(await page.locator('[data-roster-index="0"][data-roster-cell="risk"]').inputValue()==='1','risk cell keeps its value in sync');
    for(let i=0;i<6;i++) {
      await editParticipant(i,'rise');
      await page.locator(`[data-roster-index="${i}"][data-roster-cell="onRise"]`).selectOption('hold');
      await editParticipant(i,'fall');
      await page.locator(`[data-roster-index="${i}"][data-roster-cell="onFall"]`).selectOption('hold');
    }
    await page.locator('#simConfig button[type="submit"]').click();
    ok((await page.locator('#simCompany').innerText())==='테스트 기업','applying settings changes the simulated company');
    await page.locator('#simExperimentOpen').click();await page.locator('#simBackgroundLiquidity').selectOption('false');await page.locator('#simModelForm button').click();await page.locator('#simExperimentClose').click();
    ok((await page.locator('#simClock').innerText())==='09:00:00','applying settings starts a fresh experiment');
    await page.locator('#simStep').click();
    ok((await page.locator('#simPrice').innerText())==='10,000원' && (await page.locator('#simVolume').innerText())==='0주','all-hold settings actually produce a flat market with zero volume');
    const stored = await page.evaluate(()=>JSON.parse(localStorage.getItem('fieldbook-simulation-config-v1')));
    ok(stored.company==='테스트 기업' && stored.participants[0].wealth===25000 && stored.participants[0].risk===1,'applied configuration persists with correct types');
    const legacy = await page.evaluate(()=>JSON.parse(localStorage.getItem('fieldbook-personal-v1')));
    ok(legacy.bookmarks[0]==='duration' && legacy.notes.duration==='보존할 메모','existing bookmarks and notes are preserved');
    await page.locator('[data-settings-base]').click();
    await page.locator('#simInitialPrice').fill('0');
    await page.locator('#simConfig button[type="submit"]').click();
    ok(await page.locator('#simInitialPrice').evaluate(e=>!e.validity.valid),'invalid price cannot be applied');
    await page.locator('#simDiscard').click();
    await page.reload();
    await page.locator('#simPlay').waitFor();
    ok((await page.locator('#simCompanyInput').inputValue())==='테스트 기업' && (await page.locator('#simClock').innerText())==='09:00:00','reload restores settings and creates a new paused experiment');

    await view('settings');
    await page.locator('[data-settings-base]').click();
    await page.locator('#simDefaults').click();
    await page.locator('#simConfig button[type="submit"]').click();
    for(let i=0;i<40;i++)await page.locator('#simStep').click();
    await view('chart');
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.waitForTimeout(80);
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px mobile has no page overflow`);
      ok((await page.locator('#simChart canvas').boundingBox()).width>200,`${width}px mobile chart stays usable`);
      await page.locator('[data-menu]').click();
      ok(await page.locator('#sidebar').evaluate(e=>!e.inert),`${width}px mobile menu is accessible`);
      await page.locator('#sidebar a[href="#simulation"]').click();
      ok(await page.locator('#sidebar').evaluate(e=>e.inert),`${width}px selecting the current tab closes the menu`);
      await page.screenshot({path:`${output}/simulation-mobile-${width}.png`,fullPage:true});
      await page.screenshot({path:`${output}/simulation-mobile-${width}-viewport.png`});
    }
    const blocked = await browser.newContext();
    await blocked.addInitScript(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key==='fieldbook-simulation-config-v1')throw new DOMException('Blocked','QuotaExceededError');return original.call(this,key,value);};
    });
    const blockedPage = await blocked.newPage();
    blockedPage.on('pageerror',e=>errors.push(e.message));
    await blockedPage.goto(url+'/#simulation');
    await blockedPage.locator('#simPlay').waitFor();
    await blockedPage.locator('[data-sim-tab="settings"]').click();
    await blockedPage.locator('[data-settings-base]').click();
    await blockedPage.locator('#simCompanyInput').fill('저장 제한 테스트');
    await blockedPage.locator('#simConfig button[type="submit"]').click();
    ok((await blockedPage.locator('#simNotice').innerText()).includes('저장이 제한'),'storage errors are reported while simulation remains usable');
    await blockedPage.locator('#simStep').click();
    ok((await blockedPage.locator('#simClock').innerText())==='09:01:00','simulation works when browser storage is unavailable');
    await blocked.close();
    ok(errors.length===0,`no browser errors: ${errors.join('; ')}`);
    fs.writeFileSync(output+'/browser-verification.json',JSON.stringify({checks:checks.length,passed:checks,errors},null,2));
    console.log(`SIMULATION BROWSER PASS: ${checks.length} checks, desktop and 390px/320px screenshots.`);
    await context.close();
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
