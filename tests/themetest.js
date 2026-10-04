const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  // the browser itself prefers dark, so "Auto" should land dark
  const c = await b.newContext({ viewport:{width:1440,height:1000}, colorScheme:'dark' });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await p.goto(URL); await p.waitForTimeout(900);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');

  const look = async () => p.evaluate(() => ({
    attr: document.documentElement.dataset.theme || '(none)',
    paper: getComputedStyle(document.body).backgroundColor,
    ink: getComputedStyle(document.body).color,
    on: [...document.querySelectorAll('#themeSeg button')].find(b => b.classList.contains('on'))?.textContent
  }));
  console.log('on arrival (system = dark):', await look());

  await p.click('#themeSeg button[data-t=light]'); await p.waitForTimeout(400);
  console.log('after Light :', await look());
  await p.screenshot({ path:'screenshots/theme-light.png' });

  await p.click('#themeSeg button[data-t=dark]'); await p.waitForTimeout(400);
  console.log('after Dark  :', await look());
  await p.screenshot({ path:'screenshots/theme-dark.png' });

  await p.click('#themeSeg button[data-t=""]'); await p.waitForTimeout(400);
  console.log('after Auto  :', await look());

  // the choice sticks
  await p.click('#themeSeg button[data-t=light]'); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(1100);
  console.log('\nafter reload:', await look());

  // and it is there on the sign-in screen too, before a board is open
  const c2 = await b.newContext({ viewport:{width:1440,height:1000}, colorScheme:'dark' });
  const p2 = await c2.newPage();
  await p2.goto(URL); await p2.waitForTimeout(700);
  await p2.evaluate(() => localStorage.setItem('sundayboard.theme','light'));
  await p2.reload(); await p2.waitForTimeout(900);
  console.log('gate honours the saved theme:', await p2.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    paper: getComputedStyle(document.body).backgroundColor
  })));

  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
