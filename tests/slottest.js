const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport:{width:1440,height:1000} })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/store\.json|ERR_TUNNEL|404/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(700);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');

  await p.click('#nav button[data-v=pantry]'); await p.waitForTimeout(400);
  const lib = async t => { await p.fill('#ingSearch', t); await p.waitForTimeout(260);
    await p.$eval('#ingResults .pick .plus', e=>e.click()); await p.waitForTimeout(160); };
  const food = async (name, slots, terms) => {
    await p.click('#newFoodBtn'); await p.waitForTimeout(280);
    await p.fill('#fName', name);
    for (const s of slots) await p.check(`#fSlots input[value=${s}]`);
    for (const t of terms) await lib(t);
    await p.click('#fSave'); await p.waitForTimeout(380);
  };
  await food('Poha', ['breakfast'], ['poha','onion']);
  await food('Masala dosa', ['breakfast','dinner'], ['rice','potato']);
  await food('Dal tadka', ['lunch','dinner'], ['toor dal','ghee']);
  await food('Rajma chawal', ['lunch'], ['rajma','basmati']);
  await food('Bhel puri', ['snack'], ['peanut','onion']);
  await food('Khichdi', [], ['moong dal','rice']);

  console.log('cards show their meals:',
    (await p.$$eval('#foodRows .row', r => r.map(x => (x.querySelector('.name').textContent.trim()) + ' → ' +
      [...x.querySelectorAll('.slots span')].map(s=>s.textContent).join('/')))).join(' | '));

  await p.click('#nav button[data-v=week]'); await p.waitForTimeout(600);
  console.log('\nchips:', (await p.$$eval('#slotChips button', b=>b.map(x=>x.textContent))).join(' | '));
  console.log('all foods:', (await p.$$eval('#pantryList .dish b', b=>b.map(x=>x.textContent))).join(' · '));

  for (const s of ['breakfast','lunch','dinner','snack']){
    await p.click(`#slotChips button[data-s=${s}]`); await p.waitForTimeout(350);
    console.log(`  ${s}:`, (await p.$$eval('#pantryList .dish b', b=>b.map(x=>x.textContent))).join(' · '),
      '| tally:', await p.textContent('#pantryTally'));
  }
  await p.click('#slotChips button[data-s=""]'); await p.waitForTimeout(300);

  // search
  await p.fill('#pantrySearch','dal'); await p.waitForTimeout(400);
  console.log('\nsearch "dal":', (await p.$$eval('#pantryList .dish b', b=>b.map(x=>x.textContent))).join(' · '));
  await p.fill('#pantrySearch','potato'); await p.waitForTimeout(400);
  console.log('search "potato" (an ingredient):', (await p.$$eval('#pantryList .dish b', b=>b.map(x=>x.textContent))).join(' · '));
  await p.fill('#pantrySearch','zzz'); await p.waitForTimeout(400);
  console.log('search "zzz":', await p.textContent('#pantryList .empty'));

  // search + filter together
  await p.fill('#pantrySearch','a'); await p.click('#slotChips button[data-s=breakfast]'); await p.waitForTimeout(400);
  console.log('search "a" + breakfast:', (await p.$$eval('#pantryList .dish b', b=>b.map(x=>x.textContent))).join(' · '));
  await p.fill('#pantrySearch',''); await p.click('#slotChips button[data-s=""]'); await p.waitForTimeout(350);

  // editing keeps the meals
  await p.click('#nav button[data-v=pantry]'); await p.waitForTimeout(400);
  await p.click('#foodRows .row [data-a=edit]'); await p.waitForTimeout(500);
  console.log('\nediting a dish shows its meals:',
    await p.$$eval('#fSlots input:checked', i=>i.map(x=>x.value)), 'for', await p.inputValue('#fName'));
  await p.check('#fSlots input[value=snack]'); await p.click('#fSave'); await p.waitForTimeout(500);

  await p.reload(); await p.waitForTimeout(1000);
  await p.click('#nav button[data-v=week]'); await p.waitForTimeout(500);
  await p.click('#slotChips button[data-s=snack]'); await p.waitForTimeout(400);
  console.log('after reload — snack:', (await p.$$eval('#pantryList .dish b', b=>b.map(x=>x.textContent))).join(' · '));

  // still draggable
  await p.click('#slotChips button[data-s=breakfast]'); await p.waitForTimeout(350);
  await p.click('#pantryList .dish'); await p.waitForTimeout(300);
  const slot = await p.$('.slot');
  if (slot){ await slot.click(); await p.waitForTimeout(500); }
  console.log('placed on the board:', (await p.$$eval('.served', s=>s.map(x=>x.textContent.replace(/\s+/g,' ').trim()))).slice(0,2));

  await p.screenshot({ path:'screenshots/slot1.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
