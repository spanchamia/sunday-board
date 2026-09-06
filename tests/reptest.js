const { chromium } = require('playwright');
const URL = process.env.BASE_URL || (process.env.BASE_URL || 'http://localhost:8099/');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const c = await b.newContext({ viewport:{width:1400,height:1000} });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
  p.on('console', m => { if (m.type()==='error' && !/store\.json|ERR_TUNNEL|404/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(700);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');
  await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(400);

  await p.click('#repBtn'); await p.waitForTimeout(400);
  console.log('panel opens:', !(await p.$eval('#repeatPanel', e=>e.hidden)));

  const todayDow = await p.evaluate(() => new Date().getDay());
  const NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  console.log('today is', NAMES[todayDow]);

  // 1. weekly on today -> should land in the cart right away
  await p.fill('#rpName','Cilantro'); await p.fill('#rpAmt','1 bunch');
  await p.selectOption('#rpEvery','week'); await p.selectOption('#rpDay', String(todayDow));
  await p.click('#rpSave'); await p.waitForTimeout(500);
  console.log('cart:', await p.$$eval('#cartList .gitem .gname', n=>n.map(x=>x.textContent)));
  console.log('repeat rows:', await p.$$eval('.repeatrow', r=>r.map(x=>x.textContent.replace(/\s+/g,' ').trim())));

  // 2. weekly on a different day -> waits
  const other = (todayDow + 3) % 7;
  await p.fill('#rpName','Bin bags'); await p.selectOption('#rpEvery','week');
  await p.selectOption('#rpDay', String(other)); await p.click('#rpSave'); await p.waitForTimeout(450);
  console.log('cart after a future-day repeat:', await p.$$eval('#cartList .gitem .gname', n=>n.map(x=>x.textContent)));

  // 3. monthly
  await p.fill('#rpName','Toothpaste'); await p.selectOption('#rpEvery','month');
  await p.selectOption('#rpDom','15'); await p.click('#rpSave'); await p.waitForTimeout(450);
  console.log('\nall repeats:', await p.$$eval('.repeatrow', r=>r.map(x=>x.textContent.replace(/\s+/g,' ').trim())));
  console.log('count label:', await p.textContent('#repCount'));

  // 4. it should not double up on a second visit the same day
  await p.reload(); await p.waitForTimeout(1000);
  await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(400);
  console.log('\nafter reload — cart:', await p.$$eval('#cartList .gitem .gname', n=>n.map(x=>x.textContent)));

  // 5. take it out of the cart; it must not come straight back
  await p.click('#cartList .gitem .gbtn'); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(1000);
  await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(400);
  console.log('after removing it and reloading — cart:', await p.$$eval('#cartList .gitem .gname', n=>n.map(x=>x.textContent)));

  // 6. wind the clock back a week and it returns
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sundayboard.board.'))));
    const s = raw.state || raw;
    const r = s.repeats.find(x => x.name === 'Cilantro');
    const d = new Date(); d.setDate(d.getDate() - 8);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    r.last = iso; r.from = iso;
    localStorage.setItem(Object.keys(localStorage).find(k => k.startsWith('sundayboard.board.')), JSON.stringify(raw));
  });
  await p.reload(); await p.waitForTimeout(1000);
  await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(400);
  console.log('after a week passes — cart:', await p.$$eval('#cartList .gitem .gname', n=>n.map(x=>x.textContent)));

  // 7. the row's own repeat button
  await p.click('#repBtn'); await p.waitForTimeout(300);
  await p.click('#cartList .gitem .rbtn'); await p.waitForTimeout(450);
  console.log('row ↻ prefills the form with:', await p.inputValue('#rpName'));

  // 8. stop repeating
  await p.click('.repeatrow .rx'); await p.waitForTimeout(400);
  console.log('after stopping one:', await p.$$eval('.repeatrow .rname', r=>r.map(x=>x.textContent.trim())));

  await p.screenshot({ path:'screenshots/r1-repeats.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
