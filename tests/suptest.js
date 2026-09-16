/* The supply shelves: searching 5,053 things and getting them into the cart. */
const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const p = await (await b.newContext({ viewport:{width:1440,height:1000} })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/store\.json|ERR_TUNNEL|404/.test(m.text())) errs.push(m.text()); });

  await p.goto(URL); await p.waitForTimeout(700);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(700);

  console.log('shelves:', await p.textContent('#shelfCount'));
  console.log('top level:', (await p.$$eval('.shelflist .shelf.d0 .lbl', a=>a.map(x=>x.textContent))).join(' | '));

  const search = async q => { await p.fill('#libSearch', q); await p.waitForTimeout(320);
    return p.$$eval('#libRows .pick b', b => b.slice(0,6).map(x=>x.textContent.trim())); };
  for (const q of ['bin bag','AA battery','agarbatti','toilet roll','drill bit','pressure cooker']){
    console.log(`  "${q}" ->`, (await search(q)).join(' · '));
  }
  console.log('  "asdfgh" ->', (await search('asdfgh')).join(' · ') || 'no matches (empty state shown)');

  await p.fill('#libSearch',''); await p.waitForTimeout(300);
  await p.click('.shelflist .shelf:has-text("People & occasions")'); await p.waitForTimeout(400);
  await p.click('.shelflist .shelf:has-text("Pooja & festival")'); await p.waitForTimeout(400);
  console.log('\nPooja & festival:', await p.textContent('#libTally'), '—',
    (await p.$$eval('#libRows .pick b', b=>b.slice(0,6).map(x=>x.textContent.trim()))).join(' · '));

  await p.fill('#libSearch','bin bag'); await p.waitForTimeout(350);
  await p.$eval('#libRows .pick .acts .plus:last-child', e => e.click()); await p.waitForTimeout(400);
  console.log('\nafter + :', await p.$$eval('#libRows .pick', r => r.filter(x=>x.classList.contains('insup')).map(x=>x.querySelector('b').textContent.trim())));
  console.log('cart badge:', await p.textContent('#cartCount'));

  await p.fill('#libSearch','AA alkaline'); await p.waitForTimeout(350);
  await p.$eval('#libRows .pick .acts .plus:last-child', e => e.click()); await p.waitForTimeout(400);
  await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(400);
  let cart = await p.$$eval('#cartList .gitem .gname', n => n.map(x=>x.textContent));
  console.log('cart:', cart);

  await p.click('#cartList .gitem input'); await p.waitForTimeout(300);
  console.log('tally:', await p.textContent('#cartTally'));
  await p.reload(); await p.waitForTimeout(1000);
  await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(400);
  console.log('after reload:', await p.$$eval('#cartList .gitem .gname', n=>n.map(x=>x.textContent)),
    '| badge:', await p.textContent('#cartCount'));
  await p.click('#cartList .gitem .gbtn'); await p.waitForTimeout(350);
  console.log('after removing one:', await p.$$eval('#cartList .gitem .gname', n=>n.map(x=>x.textContent)));

  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(400);
  await p.screenshot({ path:'screenshots/s1-supplies.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
