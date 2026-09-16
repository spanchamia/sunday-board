const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport:{width:1440,height:1100} })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/store|users|board-|TUNNEL|404/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(800);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(800);

  const shelf = name => p.click(`.shelflist .shelf:has-text("${name}")`);
  const labels = () => p.$$eval('.shelflist .shelf .lbl', e => e.map(x => x.textContent));

  // the path the user described
  await shelf('Ingredients'); await p.waitForTimeout(500);
  console.log('Ingredients opens into:', (await labels()).slice(3, 9).join(' | '));
  console.log('crumbs:', (await p.textContent('#libCrumbs')).replace(/\s+/g,' ').trim());
  await shelf('Vegetables'); await p.waitForTimeout(500);
  console.log('\nVegetables opens into:', (await p.$$eval('.shelflist .shelf.d4 .lbl', e=>e.map(x=>x.textContent))).slice(0,8).join(' | '));
  await shelf('Leaves & greens'); await p.waitForTimeout(500);
  console.log('crumbs:', (await p.textContent('#libCrumbs')).replace(/\s+/g,' ').trim());
  console.log('tally:', await p.textContent('#libTally'));
  console.log('rows:', (await p.$$eval('#libRows .pick b', e=>e.slice(0,5).map(x=>x.textContent.trim()))).join(' · '));

  // a branch previews its children
  await p.click('#libCrumbs a:has-text("Kitchen supplies")'); await p.waitForTimeout(600);
  console.log('\nKitchen supplies previews:', (await p.$$eval('#libRows .shelfhead', e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()))).join(' | '));

  // cart / dish / repeat still work from a shelf
  await shelf('Cookware'); await p.waitForTimeout(500);
  await p.$eval('#libRows .pick .acts .plus:last-child', e=>e.click()); await p.waitForTimeout(400);
  console.log('\ncart badge after +:', await p.textContent('#cartCount'));

  // your own shelf, inside a built-in one
  await p.click('#newShelfBtn'); await p.waitForTimeout(400);
  await p.fill('#nsName','Amma\'s shelf');
  await p.selectOption('#nsParent','house/kitchen'); await p.waitForTimeout(150);
  await p.click('#sheetFoot .btn.solid'); await p.waitForTimeout(600);
  console.log('\nnew shelf lands at:', (await p.textContent('#libCrumbs')).replace(/\s+/g,' ').trim());

  // a sub-shelf inside your own shelf
  await p.click('#newShelfBtn'); await p.waitForTimeout(400);
  await p.fill('#nsName','Pickles');
  await p.selectOption('#nsParent',"house/kitchen/amma-s-shelf"); await p.waitForTimeout(150);
  await p.click('#sheetFoot .btn.solid'); await p.waitForTimeout(600);
  console.log('sub-shelf lands at:', (await p.textContent('#libCrumbs')).replace(/\s+/g,' ').trim());

  // your own ingredient, on the shelf you are standing on
  await p.click('#addHere'); await p.waitForTimeout(350);
  await p.fill('#myName','Amma\'s mango pickle'); await p.fill('#myAmt','1 jar');
  await p.click('#mineForm button[type=submit]'); await p.waitForTimeout(600);
  console.log('\non the Pickles shelf:', await p.$$eval('#libRows .pick b', e=>e.map(x=>x.textContent.trim())));
  console.log('Kitchen count now includes it:',
    await p.$eval('.shelflist .shelf:has-text("Kitchen supplies") i', e=>e.textContent));

  // and it is usable as an ingredient in a dish
  await p.click('#nav button[data-v=pantry]'); await p.waitForTimeout(400);
  await p.click('#newFoodBtn'); await p.waitForTimeout(500);
  await p.fill('#ingSearch','mango pickle'); await p.waitForTimeout(450);
  console.log('in the recipe library:', await p.$$eval('#ingResults .pick.mineown b', e=>e.map(x=>x.textContent)));
  await p.click('#fCancel'); await p.waitForTimeout(250);

  // search spans every shelf
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(500);
  await p.fill('#libSearch','agarbatti'); await p.waitForTimeout(450);
  console.log('\nsearch "agarbatti":', (await p.$$eval('#libRows .pick b', e=>e.slice(0,4).map(x=>x.textContent.trim()))).join(' · '));
  await p.fill('#libSearch','pickle'); await p.waitForTimeout(450);
  console.log('search "pickle" finds yours too:', (await p.$$eval('#libRows .pick b', e=>e.slice(0,5).map(x=>x.textContent.trim()))).join(' · '));
  await p.fill('#libSearch',''); await p.waitForTimeout(400);

  // it all survives a reload
  await p.reload(); await p.waitForTimeout(1100);
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(800);
  await p.click('.shelflist .shelf:has-text("House supplies")'); await p.waitForTimeout(300);
  await shelf('Kitchen supplies'); await p.waitForTimeout(400);
  console.log('\nafter reload, kitchen holds:', (await p.$$eval('.shelflist .shelf.d2 .lbl', e=>e.map(x=>x.textContent))).join(' | '));
  await p.screenshot({ path:'screenshots/tree1.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
