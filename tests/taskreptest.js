const { chromium } = require('playwright');
const URL = process.env.BASE_URL || 'http://localhost:8099/';
const iso = n => { const d = new Date(); d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport:{width:1400,height:1000} })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/store|users|board-|ERR_TUNNEL|404/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(700);
  await p.fill('#gName','Shiv'); await p.click('#gateGo'); await p.waitForSelector('#shell:not([hidden])');
  await p.click('#nav button[data-v=tasks]'); await p.waitForTimeout(400);

  console.log('options:', (await p.$$eval('#tRepeat option', o=>o.map(x=>x.textContent))).join(' | '));

  const add = async (title, date, kind, days) => {
    await p.fill('#tTitle', title);
    await p.fill('#tDate', date);
    await p.selectOption('#tRepeat', kind);
    if (kind === 'custom'){ await p.waitForTimeout(150);
      for (const d of days) await p.click(`#tDays button[data-d="${d}"]`); }
    await p.click('#taskForm button[type=submit]'); await p.waitForTimeout(400);
  };

  // find the next Monday
  const today = new Date();
  const toMon = (8 - today.getDay()) % 7 || 7;
  await add('Bins out', iso(toMon), 'weekly');
  await add('Stand-up notes', iso(1), 'weekdays');
  await add('Long run', iso(1), 'weekends');
  await add('Water the plants', iso(0), 'daily');
  await add('Gym', iso(1), 'custom', [2,5]);
  await add('Rent', iso(2), 'monthly');
  await add('Payday check', iso(3), 'fortnightly');
  await add('One-off errand', iso(1), 'none');

  const rows = () => p.$$eval('#taskRows .row', r => r.map(x => ({
    name: x.querySelector('.name').childNodes[0].textContent.trim(),
    rep: (x.querySelector('.rep-tag') || {}).textContent || '',
    due: (x.querySelector('.pill') || {}).textContent || ''
  })));
  console.log('\ntasks:');
  for (const r of await rows()) console.log(`  ${r.name.padEnd(18)} ${r.rep.padEnd(22)} ${r.due}`);

  // tick the daily one — it should roll to tomorrow, not disappear
  const tickByName = async name => {
    const els = await p.$$('#taskRows .row');
    for (const el of els){
      const n = await el.$eval('.name', e => e.childNodes[0].textContent.trim());
      if (n === name){ await el.$eval('input[type=checkbox]', c => c.click()); await p.waitForTimeout(500); return true; }
    }
    return false;
  };
  await tickByName('Water the plants');
  let r = (await rows()).find(x => x.name === 'Water the plants');
  console.log('\nafter ticking the daily one:', r ? `${r.due} · ${r.rep}` : 'GONE');

  await tickByName('Water the plants');
  r = (await rows()).find(x => x.name === 'Water the plants');
  console.log('ticked twice:', r ? r.due : 'GONE');

  // the weekday one should skip the weekend
  await tickByName('Stand-up notes');
  r = (await rows()).find(x => x.name === 'Stand-up notes');
  const dayOf = txt => { const m = txt.match(/^\w+/); return m ? m[0] : txt; };
  console.log('weekday task rolled to:', dayOf(r.due), '(never Sat or Sun)');

  // a plain task still just goes Done
  await tickByName('One-off errand');
  await p.click('#tFilter button[data-f=done]'); await p.waitForTimeout(350);
  console.log('\ndone list:', (await rows()).map(x=>x.name));
  await p.click('#tFilter button[data-f=open]'); await p.waitForTimeout(350);

  // the count shows up
  console.log('counts:', (await p.$$eval('#taskRows .row', r => r.map(x =>
    x.querySelector('.name').childNodes[0].textContent.trim() + ' ' +
    [...x.querySelectorAll('.pill')].map(p=>p.textContent).filter(t=>/done/.test(t)).join('')
  ))).filter(t => /done/.test(t)));

  // editing keeps the schedule and can change it
  const els = await p.$$('#taskRows .row');
  for (const el of els){
    const n = await el.$eval('.name', e => e.childNodes[0].textContent.trim());
    if (n === 'Gym'){ await el.$eval('[data-a=edit]', b => b.click()); break; }
  }
  await p.waitForTimeout(500);
  console.log('\nedit sheet shows:', await p.inputValue('#sRepeat'),
    '| days on:', await p.$$eval('#sDays button.on', b=>b.map(x=>x.dataset.d)));
  await p.selectOption('#sRepeat','weekdays'); await p.waitForTimeout(200);
  await p.click('#sheetFoot .btn.solid'); await p.waitForTimeout(500);
  console.log('after changing it:', (await rows()).find(x=>x.name==='Gym').rep);

  // the calendar shows the ones still to come
  await p.click('#nav button[data-v=month]'); await p.waitForTimeout(600);
  const chips = await p.$$eval('.month .ent', e => e.map(x => x.textContent.replace(/\s+/g,' ').trim()));
  console.log('\ncalendar entries this month:', chips.length);
  console.log('"Bins out" appears', chips.filter(c => /Bins out/.test(c)).length, 'times');
  console.log('"Stand-up notes" appears', chips.filter(c => /Stand-up/.test(c)).length, 'times');

  // reload keeps it all
  await p.reload(); await p.waitForTimeout(1000);
  await p.click('#nav button[data-v=tasks]'); await p.waitForTimeout(400);
  console.log('\nafter reload:');
  for (const x of await rows()) console.log(`  ${x.name.padEnd(18)} ${x.rep}`);

  await p.screenshot({ path:'screenshots/trep1.png' });
  console.log('\nERRORS:', errs.length ? errs : 'none');
  await b.close();
})();
