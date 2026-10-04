const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport:{width:1440,height:1100} })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/store|users|board-|TUNNEL|404|font/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(900);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(1000);

  const mineShelves = async () => {
    if (!(await p.$('.shelflist .shelf.d1'))) { await p.click('.shelflist .shelf.d0:has-text("Mine")'); await p.waitForTimeout(500); }
    // only the rows that actually sit under Mine
    return p.$$eval('.shelflist .shelf', e => e
      .filter(x => (x.dataset.id || '').startsWith('mine/'))
      .map(x => x.querySelector('.lbl').textContent + ': ' + x.querySelector('i').textContent));
  };
  console.log('Mine at the start:'); (await mineShelves()).forEach(l => console.log('  ' + l));

  // 1. the star keeps one thing
  await p.fill('#libSearch','agarbatti'); await p.waitForTimeout(500);
  console.log('\nstar before:', await p.$eval('#libRows .pick .keep', e => e.textContent.trim()));
  await p.$eval('#libRows .pick .keep', e => e.click()); await p.waitForTimeout(500);
  console.log('star after :', await p.$eval('#libRows .pick .keep', e => e.textContent.trim()));
  await p.fill('#libSearch',''); await p.waitForTimeout(500);
  console.log('Mine now:'); (await mineShelves()).forEach(l => console.log('  ' + l));
  await p.click('.shelflist .shelf[data-id="mine/kept"]'); await p.waitForTimeout(600);
  console.log('  Kept by you ->', await p.$$eval('#libRows .pick b', e => e.map(x => x.textContent.trim())));

  // 2. carting something brings its shelf along
  await p.fill('#libSearch','bin bag, 30'); await p.waitForTimeout(500);
  await p.$eval('#libRows .pick .acts .plus:last-child', e => e.click()); await p.waitForTimeout(700);
  await p.fill('#libSearch',''); await p.waitForTimeout(600);
  console.log('\nafter carting a bin bag:'); (await mineShelves()).forEach(l => console.log('  ' + l));

  await p.fill('#libSearch','paneer'); await p.waitForTimeout(500);
  await p.$eval('#libRows .pick .acts .plus:last-child', e => e.click()); await p.waitForTimeout(700);
  await p.fill('#libSearch',''); await p.waitForTimeout(600);
  console.log('\nafter carting paneer too:'); (await mineShelves()).forEach(l => console.log('  ' + l));

  // 3. the alias really shows that shelf
  await p.click('.shelflist .shelf[data-id^="mine/from"]:has-text("Cleaning")'); await p.waitForTimeout(700);
  console.log('\nMine → Cleaning:', await p.textContent('#libTally'),
    '|', (await p.$$eval('#libRows .pick b', e => e.slice(0,4).map(x => x.textContent.trim()))).join(' · '));

  // 4. carting the same shelf twice does not duplicate it
  await p.fill('#libSearch','bin bag, 50'); await p.waitForTimeout(500);
  await p.$eval('#libRows .pick .acts .plus:last-child', e => e.click()); await p.waitForTimeout(700);
  await p.fill('#libSearch',''); await p.waitForTimeout(600);
  const after = await mineShelves();
  console.log('\nno duplicate shelf:', after.filter(l => /Cleaning/.test(l)).length === 1, '|', after.length, 'shelves under Mine');

  // 5. it all survives a reload
  await p.reload(); await p.waitForTimeout(1200);
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(900);
  console.log('\nafter reload:'); (await mineShelves()).forEach(l => console.log('  ' + l));

  // 6. and you can take a shelf back off
  await p.click('.shelflist .shelf[data-id^="mine/from"]:has-text("Cleaning") .drop'); await p.waitForTimeout(700);
  console.log('\nafter dropping Cleaning:'); (await mineShelves()).forEach(l => console.log('  ' + l));

  // 7. kept things lead the recipe builder's Mine tab
  await p.click('#nav button[data-v=pantry]'); await p.waitForTimeout(400);
  await p.click('#newFoodBtn'); await p.waitForTimeout(400);
  await p.click('#ingTabs .tab[data-t=mine]'); await p.waitForTimeout(600);
  console.log('\nbuilder Mine tab:', await p.$$eval('#ingResults .pick b', e => e.slice(0,4).map(x => x.textContent.trim())));

  await p.screenshot({ path:'screenshots/keep.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
