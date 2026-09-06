const BASE = process.env.BASE_URL || 'http://localhost:8099/';
const { chromium } = require('playwright');
const URL = BASE;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1440,height:1000} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
  page.on('console', m => { if (m.type()==='error' && !/store\.json|ERR_TUNNEL/.test(m.text())) errs.push(m.text()); });

  const t0 = Date.now();
  await page.goto(URL); await page.waitForTimeout(600);
  await page.fill('#gName','Shiv'); await page.click('#gateGo');
  await page.waitForSelector('#shell:not([hidden])');
  console.log('boot + sign-in ms:', Date.now()-t0);

  await page.click('#nav button[data-v=pantry]'); await page.waitForTimeout(500);
  await page.click('#newFoodBtn'); await page.waitForTimeout(300);
  console.log('library count label:', await page.textContent('#libCount'));
  const cuisines = await page.$$eval('#fCuisine option', o => o.map(x => x.textContent));
  console.log('cuisine options:', cuisines.length, '->', cuisines.slice(0,8).join(' | '));
  const groups = await page.$$eval('#fGroup option', o => o.map(x => x.textContent));
  console.log('category options:', groups.join(' | '));
  await page.screenshot({ path:'screenshots/y1-library.png' });

  // browse Italian
  await page.selectOption('#fCuisine','it'); await page.waitForTimeout(350);
  console.log('\nItalian:', (await page.$$eval('#ingResults .pick b', b=>b.map(x=>x.textContent))).slice(0,8).join(' · '));
  await page.selectOption('#fCuisine','mx'); await page.waitForTimeout(350);
  console.log('Mexican:', (await page.$$eval('#ingResults .pick b', b=>b.map(x=>x.textContent))).slice(0,8).join(' · '));
  await page.selectOption('#fCuisine','jp'); await page.waitForTimeout(350);
  console.log('Japanese:', (await page.$$eval('#ingResults .pick b', b=>b.map(x=>x.textContent))).slice(0,8).join(' · '));
  await page.screenshot({ path:'screenshots/y2-japanese.png' });

  // category filter
  await page.selectOption('#fCuisine',''); await page.selectOption('#fGroup','Fish');
  await page.waitForTimeout(350);
  console.log('Fish shelf:', (await page.$$eval('#ingResults .pick b', b=>b.map(x=>x.textContent))).slice(0,6).join(' · '));
  await page.selectOption('#fGroup','');

  // search finds cooked forms, raw first
  await page.fill('#ingSearch','potato'); await page.waitForTimeout(400);
  console.log('\nsearch "potato":', (await page.$$eval('#ingResults .pick b', b=>b.map(x=>x.textContent))).slice(0,7).join(' · '));
  await page.fill('#ingSearch','grilled chicken'); await page.waitForTimeout(400);
  console.log('search "grilled chicken":', (await page.$$eval('#ingResults .pick b', b=>b.map(x=>x.textContent))).slice(0,4).join(' · '));

  // THE FACT SHEET
  await page.fill('#ingSearch','paneer'); await page.waitForTimeout(400);
  await page.click('#ingResults .pick');
  await page.waitForSelector('#scrim:not([hidden])');
  await page.waitForTimeout(400);
  await page.screenshot({ path:'screenshots/y3-factsheet.png' });
  const facts = await page.textContent('#sheetBody');
  console.log('\n--- PANEER FACT SHEET ---');
  console.log(facts.replace(/\s+/g,' ').slice(0,420));
  const nutRows = await page.$$('#sheetBody .factsheet .fr');
  console.log('nutrient rows shown:', nutRows.length - 1);

  // add straight from the fact sheet
  await page.click('#sheetFoot .btn.solid'); await page.waitForTimeout(400);
  console.log('rows in recipe after "Add to recipe":', (await page.$$('#ingBox .ingitem')).length);

  // a cooked form's fact sheet carries the explanation
  await page.fill('#ingSearch','toor dal'); await page.waitForTimeout(400);
  const names = await page.$$eval('#ingResults .pick b', b=>b.map(x=>x.textContent));
  const bi = names.findIndex(n => /boiled/.test(n));
  await (await page.$$('#ingResults .pick'))[bi].click();
  await page.waitForTimeout(400);
  await page.screenshot({ path:'screenshots/y4-cooked.png' });
  console.log('\ncooked-form note:', (await page.textContent('.derivednote')).replace(/\s+/g,' ').slice(0,180));
  await page.click('#sheetX');

  // build a real recipe and check the recipe card
  await page.click('#newFoodBtn'); await page.waitForTimeout(250);
  await page.fill('#ingSearch','toor dal'); await page.waitForTimeout(350);
  await page.click('#ingResults .pick .plus'); await page.waitForTimeout(300);
  await page.fill('#ingSearch','spinach'); await page.waitForTimeout(350);
  await page.click('#ingResults .pick .plus'); await page.waitForTimeout(300);
  await page.fill('#ingSearch','ghee'); await page.waitForTimeout(350);
  await page.click('#ingResults .pick .plus'); await page.waitForTimeout(300);
  await page.fill('#fName','Dal palak');
  await page.click('#fSave'); await page.waitForTimeout(600);
  await page.click('#foodRows .row .name'); await page.waitForTimeout(400);
  await page.screenshot({ path:'screenshots/y5-recipe-nutrition.png' });
  console.log('\n--- RECIPE CARD ---');
  console.log((await page.textContent('#sheetBody')).replace(/\s+/g,' ').slice(0,340));
  await page.click('#sheetX');

  // mobile + dark
  const m = await browser.newContext({ viewport:{width:390,height:844} });
  const mp = await m.newPage(); await mp.goto(URL); await mp.waitForTimeout(600);
  await mp.fill('#gName','Shiv'); await mp.click('#gateGo'); await mp.waitForTimeout(600);
  await mp.click('#nav button[data-v=pantry]'); await mp.waitForTimeout(600);
  await mp.click('#newFoodBtn'); await mp.waitForTimeout(300);
  await mp.screenshot({ path:'screenshots/y6-mobile.png' });
  const d = await browser.newContext({ colorScheme:'dark', viewport:{width:1440,height:1000} });
  const dp = await d.newPage(); await dp.goto(URL); await dp.waitForTimeout(600);
  await dp.fill('#gName','Shiv'); await dp.click('#gateGo'); await dp.waitForTimeout(600);
  await dp.click('#nav button[data-v=pantry]'); await dp.waitForTimeout(500);
  await dp.click('#newFoodBtn'); await dp.waitForTimeout(300);
  await dp.fill('#ingSearch','kimchi'); await dp.waitForTimeout(400);
  await dp.click('#ingResults .pick'); await dp.waitForTimeout(400);
  await dp.screenshot({ path:'screenshots/y7-dark.png' });

  console.log('\nERRORS:', errs.length ? errs : 'none');
  await browser.close();
})();
