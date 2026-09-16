const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport:{width:1440,height:1100} })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/store|users|board-|TUNNEL|404|font/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(900);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');

  const mineCounts = async () => {
    await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(500);
    if (!(await p.$('.shelflist .shelf.d1:has-text("Added by you")')))
      { await p.click('.shelflist .shelf.d0:has-text("Mine")'); await p.waitForTimeout(500); }
    return p.$$eval('.shelflist .shelf.d1', e => e
      .filter(x => /buy often|dishes|repeat|Added by you/.test(x.textContent))
      .map(x => x.querySelector('.lbl').textContent + ': ' + x.querySelector('i').textContent));
  };
  console.log('Mine at the start:', await mineCounts());

  // buy a few things more than once
  const buy = async (term, times) => {
    await p.fill('#libSearch', term); await p.waitForTimeout(400);
    for (let i = 0; i < times; i++){
      await p.$eval('#libRows .pick .acts .plus:last-child', e => e.click()); await p.waitForTimeout(300);
      await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(350);
      await p.click('#cartList .gitem .gbtn'); await p.waitForTimeout(300);
      await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(350);
      await p.fill('#libSearch', term); await p.waitForTimeout(350);
    }
  };
  await buy('Bin bag, 30 L', 2);
  await buy('Onion', 3);
  await p.fill('#libSearch',''); await p.waitForTimeout(400);
  console.log('after buying twice:', await mineCounts());
  await p.click('.shelflist .shelf.d1:has-text("buy often")'); await p.waitForTimeout(600);
  console.log('  Things you buy often ->', await p.$$eval('#libRows .pick b', e=>e.map(x=>x.textContent.trim())));

  // build a dish
  await p.click('#nav button[data-v=pantry]'); await p.waitForTimeout(400);
  await p.click('#newFoodBtn'); await p.waitForTimeout(400);
  await p.fill('#fName','Dal tadka');
  for (const t of ['toor dal','ghee','onion']){
    await p.fill('#ingSearch', t); await p.waitForTimeout(300);
    await p.$eval('#ingResults .pick .plus', e=>e.click()); await p.waitForTimeout(200);
  }
  await p.click('#fSave'); await p.waitForTimeout(500);
  console.log('\nafter a dish:', await mineCounts());
  await p.click('.shelflist .shelf.d1:has-text("In your dishes")'); await p.waitForTimeout(600);
  console.log('  In your dishes ->', await p.$$eval('#libRows .pick b', e=>e.map(x=>x.textContent.trim())));

  // put something on a repeat
  await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(400);
  await p.click('#repBtn'); await p.waitForTimeout(400);
  await p.fill('#rpName','Cilantro'); await p.fill('#rpAmt','1 bunch');
  await p.click('#rpSave'); await p.waitForTimeout(500);
  console.log('\nafter a repeat:', await mineCounts());
  await p.click('.shelflist .shelf.d1:has-text("On repeat")'); await p.waitForTimeout(600);
  console.log('  On repeat ->', await p.$$eval('#libRows .pick b', e=>e.map(x=>x.textContent.trim())));

  // something you typed in
  await p.click('#addHere'); await p.waitForTimeout(350);
  await p.fill('#myName',"Amma's pickle masala");
  await p.click('#mineForm button[type=submit]'); await p.waitForTimeout(600);
  console.log('\nafter adding your own:', await mineCounts());

  // it all survives a reload
  await p.reload(); await p.waitForTimeout(1100);
  console.log('\nafter reload:', await mineCounts());
  await p.click('.shelflist .shelf.d0:has-text("Mine")'); await p.waitForTimeout(700);
  console.log('Mine total:', await p.textContent('#libTally'));
  await p.screenshot({ path:'screenshots/mine1.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
