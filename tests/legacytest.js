const BASE = process.env.BASE_URL || 'http://localhost:8099/';
const { chromium } = require('playwright');
(async () => {
  const now = Date.now();
  // a board as it exists TODAY: reminders already fired, no `ref` on them,
  // and the tasks/events/meals they referred to are already deleted.
  const seed = {
    v:1, updatedAt:now, profile:{name:'Shiv',email:'s@e.com'}, targets:{},
    events:[{ id:'e9', title:'Soccer practice', notes:'', startAt: now + 5*864e5 }],
    tasks:[{ id:'t9', title:'Still here', notes:'', dueAt:null, done:false }],
    foods:[], meals:[], fired:{}, desktop:false,
    alerts:[
      { id:'a1', firedAt:now-3600e3, read:false, kind:'task',   lead:'Tomorrow', title:'Finish history essay', sub:'' },
      { id:'a2', firedAt:now-3600e3, read:false, kind:'task',   lead:'Tomorrow', title:'Still here',           sub:'' },
      { id:'a3', firedAt:now-3600e3, read:false, kind:'event',  lead:'Tomorrow', title:'Dentist appointment',  sub:'' },
      { id:'a4', firedAt:now-3600e3, read:false, kind:'event',  lead:'Tomorrow', title:'Soccer practice',      sub:'' },
      { id:'a5', firedAt:now-3600e3, read:false, kind:'meal',   lead:'Tomorrow', title:'Dinner: Chicken tacos',sub:'' },
      { id:'a6', firedAt:now-3600e3, read:false, kind:'weekly', lead:'This week',title:'3 meals planned',      sub:'' }
    ]
  };
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:1400,height:950} });
  await ctx.addInitScript(v => { try { if(!localStorage.getItem('sundayboard.v1')) localStorage.setItem('sundayboard.v1', v); } catch {} }, JSON.stringify(seed));
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  console.log('badge (6 seeded, 3 should survive):', await p.textContent('#bellCount'));
  await p.click('#bellBtn'); await p.waitForTimeout(400);
  console.log('feed kept:', await p.$$eval('.feed .item .head', e => e.map(x => x.textContent)));
  await p.click('#sheetX');
  // and the cleanup is saved, not just cosmetic
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sundayboard.board.')))).alerts.map(a => a.title));
  console.log('persisted:', kept);
  await b.close();
})();
