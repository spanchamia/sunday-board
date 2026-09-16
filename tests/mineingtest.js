const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport:{width:1440,height:1100} })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/store|users|board-|TUNNEL|404|font/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(900);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');
  await p.click('#nav button[data-v=pantry]'); await p.waitForTimeout(400);
  await p.click('#newFoodBtn'); await p.waitForTimeout(500);

  console.log('tabs:', await p.$$eval('#ingTabs .tab', t=>t.map(x=>x.textContent)));
  await p.click('#ingTabs .tab[data-t=mine]'); await p.waitForTimeout(400);
  console.log('Mine on a fresh board:', (await p.textContent('#ingResults .none')).trim());
  await p.click('#ingTabs .tab[data-t=all]'); await p.waitForTimeout(300);

  // cook a few things so there is a history
  const lib = async t => { await p.fill('#ingSearch', t); await p.waitForTimeout(280);
    await p.$eval('#ingResults .pick .plus', e=>e.click()); await p.waitForTimeout(180); };
  const food = async (n, terms) => {
    await p.click('#newFoodBtn'); await p.waitForTimeout(280);
    await p.fill('#fName', n);
    for (const t of terms) await lib(t);
    await p.click('#fSave'); await p.waitForTimeout(400);
  };
  await food('Dal tadka',    ['toor dal','ghee','onion']);
  await food('Rajma',        ['rajma','onion','tomato']);
  await food('Palak paneer', ['spinach','paneer','onion']);

  await p.click('#newFoodBtn'); await p.waitForTimeout(400);
  await p.click('#ingTabs .tab[data-t=mine]'); await p.waitForTimeout(500);
  console.log('\ncount label:', await p.textContent('#libCount'));
  console.log('Mine, most used first:', (await p.$$eval('#ingResults .pick b', e=>e.map(x=>x.textContent.trim()))).join(' · '));
  console.log('note shown:', !(await p.$eval('#mineNote', e=>e.hidden)),
    '| chips hidden:', await p.$eval('#ingChips', e=>e.hidden),
    '| filters hidden:', await p.$eval('.library .filters', e=>e.hidden));

  // + adds it
  await p.$eval('#ingResults .pick .plus', e=>e.click()); await p.waitForTimeout(400);
  console.log('\nafter + :', await p.$$eval('#ingBox .ingitem .i-name', i=>i.map(x=>x.value)));

  // drag one in
  const src = (await p.$$('#ingResults .pick'))[1];
  const from = await src.boundingBox();
  const zone = await (await p.$('#ingBox')).boundingBox();
  await p.mouse.move(from.x+from.width/2, from.y+from.height/2); await p.mouse.down();
  await p.mouse.move(zone.x+zone.width/2, zone.y+zone.height/2, {steps:14}); await p.mouse.up();
  await p.waitForTimeout(500);
  console.log('after dragging one in:', await p.$$eval('#ingBox .ingitem .i-name', i=>i.map(x=>x.value)));

  // search inside Mine
  await p.fill('#ingSearch','onion'); await p.waitForTimeout(400);
  console.log('\nsearch "onion" inside Mine:', await p.$$eval('#ingResults .pick b', e=>e.map(x=>x.textContent.trim())));
  await p.fill('#ingSearch',''); await p.waitForTimeout(350);

  // something you typed yourself shows up and drags too
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(700);
  await p.click('#addHere'); await p.waitForTimeout(350);
  await p.fill('#myName',"Amma's pickle masala");
  await p.click('#mineForm button[type=submit]'); await p.waitForTimeout(500);
  await p.click('#nav button[data-v=pantry]'); await p.waitForTimeout(400);
  await p.click('#newFoodBtn'); await p.waitForTimeout(400);
  await p.click('#ingTabs .tab[data-t=mine]'); await p.waitForTimeout(500);
  console.log('your own thing is in Mine:', (await p.$$eval('#ingResults .pick b', e=>e.map(x=>x.textContent.trim()))).includes("Amma's pickle masala"));
  const own = await p.$('#ingResults .pick.mineown');
  const ob = await own.boundingBox();
  const z2 = await (await p.$('#ingBox')).boundingBox();
  await p.mouse.move(ob.x+ob.width/2, ob.y+ob.height/2); await p.mouse.down();
  await p.mouse.move(z2.x+z2.width/2, z2.y+20, {steps:14}); await p.mouse.up();
  await p.waitForTimeout(500);
  console.log('dragged yours into the recipe:', await p.$$eval('#ingBox .ingitem .i-name', i=>i.map(x=>x.value)));

  // the Library's Mine section still lines up
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(700);
  await p.click('.shelflist .shelf.d0:has-text("Mine")'); await p.waitForTimeout(700);
  console.log('\nLibrary → Mine:', await p.textContent('#libTally'));
  console.log('  shelves:', await p.$$eval('.shelflist .shelf.d1', e=>e
    .filter(x=>/buy often|dishes|repeat|Added by you/.test(x.textContent))
    .map(x=>x.querySelector('.lbl').textContent+': '+x.querySelector('i').textContent)));

  await p.screenshot({ path:'screenshots/mineing.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
