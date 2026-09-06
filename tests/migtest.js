const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport:{width:1400,height:1000} })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  // a board written by the old single-key version
  await p.goto(URL); await p.waitForTimeout(500);
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('sundayboard.v1', JSON.stringify({
      v:1, updatedAt: Date.now(),
      profile:{ name:'Shiv', email:'shiv@example.com', createdAt: Date.now() },
      tasks:[{ id:'t1', title:'Old task from before', done:false, notes:'' }],
      events:[], foods:[], meals:[], cart:[], alerts:[], fired:{}, targets:{}, desktop:false
    }));
  });
  await p.goto(URL); await p.waitForTimeout(1000);
  console.log('opens straight into the old board:', await p.isVisible('#shell'));
  console.log('name:', await p.textContent('#whoName'));
  await p.click('#nav button[data-v=tasks]'); await p.waitForTimeout(400);
  console.log('the old task survived:', await p.$$eval('#taskRows .row .name', e=>e.map(x=>x.textContent.trim())));
  console.log('storage now:', await p.evaluate(() => Object.keys(localStorage).sort()));

  // and a locked one
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('sundayboard.v1', JSON.stringify({
      enc:1, updatedAt: Date.now(), who:'Meera', salt:'AAAA', iv:'AAAA', ct:'AAAA'
    }));
  });
  await p.goto(URL); await p.waitForTimeout(1000);
  console.log('\nlocked legacy board asks to unlock:', await p.textContent('#gateTitle'));
  console.log('storage now:', await p.evaluate(() => Object.keys(localStorage).sort()));
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
