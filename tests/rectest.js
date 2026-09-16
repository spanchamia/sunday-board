const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs=[];
  const c = await b.newContext({ viewport:{width:1440,height:1000} });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
  p.on('console', m => { if (m.type()==='error' && !/store\.json|ERR_TUNNEL|404/.test(m.text())) errs.push(m.text()); });
  await p.goto((process.env.BASE_URL || 'http://localhost:8099/')); await p.waitForTimeout(700);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');

  // build four dishes
  await p.click('#nav button[data-v=pantry]'); await p.waitForTimeout(400);
  await p.click('#newFoodBtn'); await p.waitForTimeout(400);
  console.log('cold-start ingredient reco:', (await p.$$eval('#ingReco .chiprow button', b=>b.slice(0,6).map(x=>x.textContent))).join(' · '));
  console.log('reco label:', await p.textContent('#ingReco .recolabel'));

  const lib = async t => { await p.fill('#ingSearch', t); await p.waitForTimeout(280); await p.$eval('#ingResults .pick .plus', e=>e.click()); await p.waitForTimeout(180); };
  const food = async (n, terms) => {
    await p.click('#newFoodBtn'); await p.waitForTimeout(250);
    await p.fill('#fName', n);
    for (const t of terms) await lib(t);
    await p.click('#fSave'); await p.waitForTimeout(350);
  };
  await food('Dal tadka', ['toor dal','ghee','onion']);
  await food('Palak paneer', ['spinach','paneer','onion']);
  await food('Poha', ['poha','peanut','onion']);
  await food('Rajma', ['rajma','onion','tomato']);

  await p.click('#newFoodBtn'); await p.waitForTimeout(500);
  console.log('\nafter 4 dishes — reco label:', await p.textContent('#ingReco .recolabel'));
  console.log('reco:', (await p.$$eval('#ingReco .chiprow button', b=>b.map(x=>x.textContent))).join(' · '));
  await p.click('#ingReco .chiprow button'); await p.waitForTimeout(400);
  console.log('clicking one puts it in the recipe:', await p.$$eval('#ingBox .ingitem input', i=>i.slice(0,1).map(x=>x.value)));
  await p.click('#fCancel'); await p.waitForTimeout(300);

  // plan some meals in the past so "cook again" has history
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sundayboard.board.'))));
    const s = raw.state || raw;
    const iso = n => { const d = new Date(); d.setDate(d.getDate()-n);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    const id = n => (s.foods.find(f => f.name === n) || {}).id;
    s.meals = [
      { id:'m1', date:iso(3),  slot:'dinner', foodId:id('Dal tadka') },
      { id:'m2', date:iso(10), slot:'dinner', foodId:id('Dal tadka') },
      { id:'m3', date:iso(17), slot:'lunch',  foodId:id('Dal tadka') },
      { id:'m4', date:iso(5),  slot:'lunch',  foodId:id('Poha') },
      { id:'m5', date:iso(12), slot:'lunch',  foodId:id('Poha') },
      { id:'m6', date:iso(40), slot:'dinner', foodId:id('Rajma') }
    ];
    localStorage.setItem(Object.keys(localStorage).find(k => k.startsWith('sundayboard.board.')), JSON.stringify(raw));
  });
  await p.reload(); await p.waitForTimeout(1000);
  await p.click('#nav button[data-v=week]'); await p.waitForTimeout(600);
  console.log('\ndish reco shown:', !(await p.$eval('#dishReco', e=>e.hidden)));
  console.log('label:', await p.textContent('#dishReco .recolabel'));
  console.log('dishes:', (await p.$$eval('#dishReco .chiprow button', b=>b.map(x=>x.textContent))).join(' · '));
  await p.click('#dishReco .chiprow button'); await p.waitForTimeout(400);
  console.log('after clicking one — hint:', await p.textContent('#weekHint'));
  console.log('that dish is held:', await p.$$eval('.dish.held b', b=>b.map(x=>x.textContent)));
  const slot = await p.$('.slot');
  if (slot){ await slot.click(); await p.waitForTimeout(500); }
  console.log('placed:', (await p.$$eval('.served', s=>s.map(x=>x.textContent.replace(/\s+/g,' ').trim()))).slice(0,3));

  // shopping recommendations reflect what has been bought
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(700);
  console.log('\nsupply reco label:', await p.textContent('#libReco .recolabel'));
  await p.click('#libReco .chiprow button'); await p.waitForTimeout(400);
  await p.click('#libReco .chiprow button'); await p.waitForTimeout(400);
  await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(400);
  console.log('cart:', await p.$$eval('#cartList .gitem .gname', n=>n.map(x=>x.textContent)));
  await p.reload(); await p.waitForTimeout(1000);
  await p.click('#nav button[data-v=shop]'); await p.waitForTimeout(400);
  await p.click('#cartList .gitem .gbtn'); await p.waitForTimeout(300);
  await p.click('#cartList .gitem .gbtn'); await p.waitForTimeout(400);
  await p.click('#nav button[data-v=lib]'); await p.waitForTimeout(700);
  console.log('after buying and clearing them — reco label:', await p.textContent('#libReco .recolabel'));
  console.log('reco now:', (await p.$$eval('#libReco .chiprow button', b=>b.slice(0,4).map(x=>x.textContent))).join(' · '));

  await p.screenshot({ path:'screenshots/rec1.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
