const {chromium} = require('C:/Users/kek28/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const data = JSON.parse(fs.readFileSync('content/fieldbook.json', 'utf8').replace(/^\uFEFF/, ''));
const url = process.env.FIELDBOOK_URL || 'http://127.0.0.1:8765';
const output = 'artifacts/reference-v2';
const errors = [], checks = [];
const ok = (condition, name) => { assert(condition, name); checks.push(name); };
fs.mkdirSync(output, {recursive:true});

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
    const legacy = {bookmarks:['duration'], notes:{duration:'기존 메모 보존'}, memory:{duration:'known'}, last:'gdp'};
    await context.addInitScript(value => {
      if (!localStorage.getItem('fieldbook-personal-v1')) localStorage.setItem('fieldbook-personal-v1', JSON.stringify(value));
    }, legacy);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('.subject-home').waitFor();
    const go = async (hash, selector) => {
      await page.evaluate(value => { location.hash = value; }, hash);
      if (selector) await page.locator(selector).waitFor();
    };
    ok(await page.locator('#main .collection-tile').count() === 4, 'home contains four fields');
    ok(await page.locator('#main .concept-card, .home-hero, .overview-strip, .home-bottom').count() === 0, 'home has no recommendations, hero or progress');
    ok(!/복습|리마인드|기억남|다시 보기/.test(await page.locator('#sidebar').innerText()), 'navigation has no study prompts');
    ok(await page.locator('#main').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight), 'desktop home fits one screen');
    await page.screenshot({path:output+'/home-desktop.png',fullPage:true});

    await page.keyboard.press('Control+k');
    ok(await page.locator('[data-search-result]').count() === 0, 'empty search has no recommended concepts');
    const query = data.concepts.find(concept => concept.id === 'duration').body[1].slice(0,18);
    await page.locator('#globalSearch').fill(query);
    await page.locator('[data-search-result][href="#concept/duration"]').click();
    await page.locator('.reading-page').waitFor();
    ok(!await page.locator('#searchDialog').evaluate(element => element.open), 'search closes after selecting full-text result');

    for (const concept of data.concepts) {
      await go('#concept/'+concept.id);
      await page.waitForFunction(title => document.querySelector('.concept-heading h1')?.textContent === title, concept.title);
      assert.deepEqual(await page.locator('.concept-article .prose > p').allTextContents(), concept.body);
      assert.equal(await page.locator('.prose details, #personalNote, [data-memory]').count(), 0);
      ok(await page.locator('.prose > p').last().isVisible(), 'full article visible: '+concept.id);
    }
    const afterReading = await page.evaluate(() => JSON.parse(localStorage.getItem('fieldbook-personal-v1')));
    assert.deepEqual(afterReading, legacy);
    checks.push('reading does not write completion, history or legacy personal data');

    await go('#concept/duration', '[data-bookmark="duration"]');
    ok(await page.locator('[data-bookmark="duration"]').getAttribute('aria-pressed') === 'true', 'existing bookmark retained');
    await page.screenshot({path:output+'/article-desktop.png',fullPage:true});
    await page.locator('[data-bookmark="duration"]').click();
    await page.reload();
    await page.locator('[data-bookmark="duration"]').waitFor();
    ok(await page.locator('[data-bookmark="duration"]').getAttribute('aria-pressed') === 'false', 'bookmark removal persists');
    await page.locator('[data-bookmark="duration"]').click();
    const afterBookmark = await page.evaluate(() => JSON.parse(localStorage.getItem('fieldbook-personal-v1')));
    assert.deepEqual(afterBookmark, legacy);
    checks.push('bookmark updates preserve existing unrelated records');
    await go('#bookmarks', '#conceptGrid');
    ok(await page.locator('.concept-card').count() === 1, 'bookmark list filters saved concepts');
    await page.locator('[data-bookmark="duration"]').click();
    ok(await page.locator('.empty-state').isVisible(), 'removing final bookmark shows empty list');

    await go('#library', '#librarySearch');
    await page.locator('#librarySearch').fill(query);
    ok(await page.locator('.card-main[href="#concept/duration"]').isVisible(), 'library searches the expanded article');
    await page.locator('#librarySearch').fill('검색결과없음_xyz');
    ok(await page.locator('.empty-state').isVisible(), 'no-result state');
    await go('#home','.subject-home');
    await page.locator('.collection-tile[href="#library/finance"]').click();
    await page.locator('#conceptGrid').waitFor();
    ok(await page.locator('.concept-card').count() === data.concepts.filter(concept => concept.field === 'finance').length, 'field tile opens its entire subject');
    await go('#review','#librarySearch');
    await page.waitForURL('**/#library');
    ok(await page.locator('[data-memory], #reviewStage, #memoryFilter').count() === 0, 'old review route opens dictionary without tracking');
    await go('#01_economics','#librarySearch');
    await page.waitForURL('**/#library/economics');
    ok(await page.locator('.concept-card').count() === 24, 'old chapter links remain usable');
    await go('#concept/missing');
    await page.getByRole('heading',{name:'개념을 찾지 못했습니다.'}).waitFor();
    checks.push('missing concept has a recovery link');

    for (const id of ['bond','portfolio','compound','dcf','macro','buffer']) {
      await go('#lab/'+id,'#activeLab');
      await page.waitForFunction(value => document.querySelector('[data-reset-lab]')?.dataset.resetLab === value, id);
      ok(!/NaN|Infinity/.test(await page.locator('#labResults').innerText()), 'interactive calculation mounts: '+id);
      const input = page.locator('input[type="range"]').first();
      if (await input.count()) {
        await input.evaluate(element => {element.value=element.max; element.dispatchEvent(new Event('input',{bubbles:true}));});
        assert(!/NaN|Infinity/.test(await page.locator('#labResults').innerText()));
        await page.locator('[data-reset-lab]').click();
      }
    }
    const math = await page.evaluate(async () => {
      const module = await import('./labs.js');
      return {par:module.bondPrice(100,.05,5,.05), risk:module.portfolioRisk(.5,20,20,0), invalid:module.dcfValue(100,.06,.03,.03)};
    });
    ok(Math.abs(math.par-100)<1e-8 && Math.abs(math.risk-Math.sqrt(200))<1e-8 && math.invalid===null, 'bond, diversification and DCF domain calculations');

    await page.route(/api\.(frankfurter\.dev|upbit\.com)\//, request => request.fulfill({json:request.request().url().includes('upbit') ? [
      {market:'KRW-BTC',trade_price:100000000,timestamp:Date.now(),signed_change_rate:.02},
      {market:'KRW-ETH',trade_price:4000000,timestamp:Date.now(),signed_change_rate:-.01}
    ] : [{date:new Date().toISOString().slice(0,10),base:'USD',quote:'KRW',rate:1375}]}));
    await go('#markets','#marketRoot');
    await page.locator('#refreshMarkets:not(:disabled)').waitFor();
    ok((await page.locator('#fxPrice').innerText()).includes('1,375'), 'market page still loads data through its navigation');
    await go('#home','.subject-home');
    ok(await page.locator('#marketRoot').count()===0,'market page unmounts when leaving');

    await page.setViewportSize({width:390,height:844});
    ok(await page.locator('#sidebar').evaluate(element => element.inert), 'mobile closed menu is inert');
    await page.mouse.move(0,0);
    await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'));
    await page.screenshot({path:output+'/home-mobile.png',fullPage:true});
    await page.locator('[data-menu]').click();
    ok(await page.locator('#sidebar').evaluate(element => !element.inert), 'mobile menu opens');
    await page.keyboard.press('Escape');
    ok(await page.locator('[data-menu]').getAttribute('aria-expanded')==='false','escape closes mobile menu');
    await go('#concept/duration','[data-bookmark="duration"]');
    await page.screenshot({path:output+'/article-mobile.png',fullPage:true});
    for (const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      for (const hash of ['#home','#library','#library/finance','#concept/duration','#concept/inheritance-tax','#bookmarks','#lab','#lab/bond','#lab/dcf','#lab/macro','#lab/buffer']) {
        await go(hash);
        await page.waitForTimeout(80);
        ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1), 'no horizontal overflow '+width+' '+hash);
      }
    }
    await page.goto(url+'/finance-guide-print.html');
    ok(await page.locator('.print-concept').count()===data.concepts.length, 'print includes every concept');
    const printed = await page.locator('body').innerText();
    ok(data.concepts.every(concept => concept.body.every(paragraph => printed.includes(paragraph))), 'print uses the complete expanded manuscript');
    ok(!/리마인드|다시 꺼내 보는/.test(await page.locator('.print-cover').innerText()), 'print cover uses neutral wording');

    const blocked = await browser.newContext();
    await blocked.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw Error('Storage blocked');}}));
    const blockedPage=await blocked.newPage();
    blockedPage.on('pageerror',error=>errors.push(error.message));
    await blockedPage.goto(url+'/#concept/duration');
    await blockedPage.locator('[data-bookmark="duration"]').click();
    ok(await blockedPage.locator('[data-bookmark="duration"]').getAttribute('aria-pressed')==='true', 'bookmark remains usable with blocked storage');
    ok((await blockedPage.locator('#toast').innerText()).includes('저장이 제한'),'blocked storage is described accurately');
    await blocked.close();
    ok(errors.length===0,'no browser errors');
    fs.writeFileSync(output+'/verification.json',JSON.stringify({at:new Date().toISOString(),checks:checks.length,passed:checks,errors},null,2));
    console.log('PASS',checks.length,'checks');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
