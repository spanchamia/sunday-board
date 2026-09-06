const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport:{width:1400,height:1000} });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/store\.json|users\.json|board-|ERR_TUNNEL|404/.test(m.text())) errs.push(m.text()); });

  const leave = async () => {
    // one board on the device opens straight away — step back out to the gate
    if (await p.isVisible('#shell')){
      await p.click('#whoBox'); await p.waitForTimeout(350);
      await p.click('#sheetFoot .btn.solid'); await p.waitForTimeout(600);
    }
  };
  const signIn = async (name, email) => {
    await p.goto(URL); await p.waitForTimeout(800);
    await leave();
    if (await p.isVisible('#gatePick')) await p.click('#gateOther');
    await p.fill('#gName', name); if (email) await p.fill('#gEmail', email);
    await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])'); await p.waitForTimeout(400);
  };
  const addTask = async t => {
    await p.click('#nav button[data-v=tasks]'); await p.waitForTimeout(300);
    await p.fill('#tTitle', t); await p.click('#taskForm button[type=submit]'); await p.waitForTimeout(400);
  };
  const tasks = async () => {
    await p.click('#nav button[data-v=tasks]'); await p.waitForTimeout(350);
    return p.$$eval('#taskRows .row .name', e => e.map(x => x.textContent.trim()));
  };

  // 1. Shiv sets up a board
  await signIn('Shiv','shiv@example.com');
  await addTask('Shiv task one'); await addTask('Shiv task two');
  console.log('Shiv:', await tasks());

  // 2. someone else signs in — Shiv's board must be untouched
  await signIn('Priya','priya@example.com');
  console.log('Priya starts empty:', await tasks());
  await addTask('Priya task');
  console.log('Priya:', await tasks(), '| name in rail:', await p.textContent('#whoName'));

  // 3. Shiv comes back by name
  await signIn('Shiv');
  console.log('\nShiv again:', await tasks(), '| email kept:', await p.textContent('#whoMail'));

  // 4. and by a differently-typed name
  await signIn('  SHIV  ');
  console.log('"  SHIV  " is the same board:', await tasks());

  // 5. the picker lists both
  await p.goto(URL); await p.waitForTimeout(800);
  await leave();
  console.log('\npicker:', await p.$$eval('#whoList button .nm b', e => e.map(x=>x.textContent)));
  await p.click('#whoList button:has-text("Priya")'); await p.waitForSelector('#shell:not([hidden])'); await p.waitForTimeout(500);
  console.log('picked Priya ->', await tasks());

  // 6. switching from inside keeps both
  await p.click('#whoBox'); await p.waitForTimeout(400);
  await p.click('#sheetFoot .btn.solid'); await p.waitForTimeout(600);
  console.log('after Switch, back at the picker:', await p.$$eval('#whoList button .nm b', e=>e.map(x=>x.textContent)));
  await p.click('#whoList button:has-text("Shiv")'); await p.waitForSelector('#shell:not([hidden])'); await p.waitForTimeout(500);
  console.log('Shiv still has:', await tasks());

  // 7. a locked board is per-person too
  await p.goto(URL); await p.waitForTimeout(800);
  await leave();
  await p.click('#gateOther'); await p.waitForTimeout(200);
  await p.fill('#gName','Anu'); await p.click('#lockBox summary'); await p.waitForTimeout(200);
  await p.fill('#gPass','secret1'); await p.fill('#gPass2','secret1');
  await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])'); await p.waitForTimeout(400);
  await addTask('Anu secret');
  console.log('\nAnu:', await tasks());
  await p.goto(URL); await p.waitForTimeout(800);
  await leave();
  console.log('picker shows a lock:', await p.$$eval('#whoList button', e => e.map(x => x.textContent.replace(/\s+/g,' ').trim())));
  await p.click('#whoList button:has-text("Anu")'); await p.waitForTimeout(500);
  console.log('Anu asks for the passcode:', await p.textContent('#gateTitle'));
  await p.fill('#gUnlock','secret1'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])'); await p.waitForTimeout(500);
  console.log('unlocked ->', await tasks());

  // 8. Shiv is untouched by all of that
  await p.click('#whoBox'); await p.waitForTimeout(400);
  await p.click('#sheetFoot .btn.solid'); await p.waitForTimeout(600);
  await p.click('#whoList button:has-text("Shiv")'); await p.waitForSelector('#shell:not([hidden])'); await p.waitForTimeout(500);
  console.log('\nShiv, after everything:', await tasks());

  // 9. typing an existing name from the "someone else" form opens that board
  await p.click('#whoBox'); await p.waitForTimeout(400);
  await p.click('#sheetFoot .btn.solid'); await p.waitForTimeout(600);
  await p.click('#gateOther'); await p.fill('#gName','Priya'); await p.click('#gateGo');
  await p.waitForSelector('#shell:not([hidden])'); await p.waitForTimeout(500);
  console.log('typing "Priya" opened her board:', await tasks());

  // 10. what is actually on disk
  const keys = await p.evaluate(() => Object.keys(localStorage).sort());
  console.log('\nstorage keys:', keys);
  await p.screenshot({ path:'screenshots/user1.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
