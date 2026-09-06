const BASE = process.env.BASE_URL || 'http://localhost:8099/';
const { chromium } = require('playwright');
const URL = BASE;

(async () => {
  const browser = await chromium.launch();
  const errs = [];
  const ctx = await browser.newContext({ viewport:{width:1360,height:900} });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
  page.on('console', m => { if (m.type()==='error' && !/store\.json|ERR_TUNNEL/.test(m.text())) errs.push(m.text()); });

  // ── 1. first visit shows the gate
  await page.goto(URL); await page.waitForTimeout(700);
  console.log('1. gate visible:', await page.isVisible('#gate'), '| board hidden:', !(await page.isVisible('#shell')));
  console.log('   crypto available:', await page.evaluate(() => !!(window.crypto && crypto.subtle && crypto.subtle.deriveKey)));
  await page.screenshot({ path:'screenshots/g1-signin.png' });

  // ── 2. validation
  await page.click('#gateGo'); await page.waitForTimeout(200);
  console.log('2. empty name blocked:', await page.textContent('#gateErr'));
  await page.fill('#gName','Shiv'); await page.fill('#gEmail','not-an-email');
  await page.click('#gateGo'); await page.waitForTimeout(200);
  console.log('   bad email blocked:', await page.textContent('#gateErr'));

  // ── 3. sign in WITH a passcode
  await page.fill('#gEmail','sganapathy85@gmail.com');
  await page.click('#lockBox summary'); await page.waitForTimeout(200);
  await page.fill('#gPass','taco'); await page.fill('#gPass2','tako');
  await page.click('#gateGo'); await page.waitForTimeout(250);
  console.log('3. mismatch blocked:', await page.textContent('#gateErr'));
  await page.fill('#gPass2','taco');
  await page.click('#gateGo'); await page.waitForTimeout(900);
  console.log('   signed in — board visible:', await page.isVisible('#shell'),
              '| name:', await page.textContent('#whoName'),
              '| email:', await page.textContent('#whoMail'),
              '| button:', await page.textContent('#lockBtn'));
  await page.screenshot({ path:'screenshots/g2-board.png' });

  // ── 4. add data, confirm it is encrypted at rest
  await page.click('#nav button[data-v=tasks]');
  await page.fill('#tTitle','Finish history essay');
  await page.click('#taskForm button[type=submit]');
  await page.waitForTimeout(800);
  const raw = await page.evaluate(() => localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sundayboard.board.'))));
  console.log('4. stored bytes:', raw.length,
              '| looks encrypted:', /"enc":1/.test(raw),
              '| leaks the task text:', /history essay/.test(raw),
              '| leaks the email:', /sganapathy85/.test(raw));

  // ── 5. reload -> unlock screen, wrong then right passcode
  await page.reload(); await page.waitForTimeout(800);
  console.log('5. locked on return:', await page.isVisible('#gate'), '|', await page.textContent('#gateTitle'));
  await page.screenshot({ path:'screenshots/g3-unlock.png' });
  await page.fill('#gUnlock','wrong'); await page.click('#gateGo'); await page.waitForTimeout(700);
  console.log('   wrong passcode:', await page.textContent('#gateErr'), '| still locked:', await page.isVisible('#gate'));
  await page.fill('#gUnlock','taco'); await page.click('#gateGo'); await page.waitForTimeout(900);
  console.log('   right passcode -> board:', await page.isVisible('#shell'));
  await page.click('#nav button[data-v=tasks]'); await page.waitForTimeout(300);
  console.log('   task survived:', (await page.textContent('#taskRows')).includes('history essay'));

  // ── 6. Lock board
  await page.click('#lockBtn'); await page.waitForTimeout(1200);
  console.log('6. lock button re-locks:', await page.isVisible('#gate'));

  // ── 7. a second, passcode-free board in a clean profile
  const ctx2 = await browser.newContext({ viewport:{width:1360,height:900} });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errs.push('PAGEERROR2: '+e.message));
  await p2.goto(URL); await p2.waitForTimeout(600);
  await p2.fill('#gName','Shiv'); await p2.fill('#gEmail','shiv@example.com');
  await p2.click('#gateGo'); await p2.waitForTimeout(800);
  console.log('7. no-passcode sign-in:', await p2.isVisible('#shell'), '| button:', await p2.textContent('#lockBtn'));
  const raw2 = await p2.evaluate(() => localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sundayboard.board.'))));
  console.log('   stored plain (expected):', !/"enc":1/.test(raw2));
  await p2.reload(); await p2.waitForTimeout(800);
  console.log('   reload goes straight in:', await p2.isVisible('#shell'), '| gate hidden:', !(await p2.isVisible('#gate')));

  // add a passcode later
  await p2.click('#lockBtn'); await p2.waitForTimeout(400);
  await p2.fill('#np1','1234'); await p2.fill('#np2','1234');
  await p2.click('#sheetFoot .btn.solid'); await p2.waitForTimeout(1000);
  const raw3 = await p2.evaluate(() => localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sundayboard.board.'))));
  console.log('   passcode added later -> encrypted:', /"enc":1/.test(raw3), '| button:', await p2.textContent('#lockBtn'));

  // mobile + dark look
  const m = await browser.newContext({ viewport:{width:390,height:844} });
  const mp = await m.newPage(); await mp.goto(URL); await mp.waitForTimeout(600);
  await mp.screenshot({ path:'screenshots/g4-mobile.png' });
  const d = await browser.newContext({ colorScheme:'dark', viewport:{width:1360,height:900} });
  const dp = await d.newPage(); await dp.goto(URL); await dp.waitForTimeout(600);
  await dp.click('#lockBox summary'); await dp.waitForTimeout(200);
  await dp.screenshot({ path:'screenshots/g5-dark.png' });

  console.log('ERRORS:', errs.length ? errs : 'none');
  await browser.close();
})();
