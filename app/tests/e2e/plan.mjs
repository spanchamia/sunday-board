// Signed-in walkthrough of My Home and the Plan tab against a fake database.
// Run after `npm run build`:  TZ=America/Los_Angeles node tests/e2e/plan.mjs
// SCREENS=1 saves screenshots to tests/e2e/screens/.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { installFake, sessionStorageEntry, USER } from './fake-supabase.mjs';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const F = 'f0000000-0000-4000-8000-000000000001';
const db = () => ({
  family_members: [{ user_id: USER.id, family_id: F, role: 'owner', display_name: 'Smidth', joined_at: '2026-10-10' }],
  families: [{ id: F, name: 'Panchamia', invite_code: 'ABCD1234', created_at: '2026-10-10' }],
  categories: [
    { id: 'c-home', family_id: F, parent_id: null, name: 'My Home', sort: 0 },
    { id: 'c-kit', family_id: F, parent_id: 'c-home', name: 'Kitchen', sort: 0 },
    { id: 'c-veg', family_id: F, parent_id: 'c-kit', name: 'Vegetables', sort: 0, default_restock_mode: 'as_needed' },
    { id: 'c-pan', family_id: F, parent_id: 'c-kit', name: 'Pantry', sort: 1, default_restock_mode: 'staple' },
  ],
  items: [
    { id: 'i-onion', family_id: F, category_id: 'c-veg', name: 'Onions', restock_mode: 'staple', restock_every_days: 7, archived_at: null },
    { id: 'i-tom', family_id: F, category_id: 'c-veg', name: 'Tomatoes', restock_mode: 'as_needed', archived_at: null },
    { id: 'i-chana', family_id: F, category_id: 'c-pan', name: 'Garbanzo beans', restock_mode: 'staple', restock_every_days: 182, archived_at: null },
    { id: 'i-rice', family_id: F, category_id: 'c-pan', name: 'Idli rice', restock_mode: 'staple', archived_at: null },
  ],
  stores: [{ id: 's-1', family_id: F, name: 'Costco', sort: 0 }],
  item_stores: [],
  meal_types: [
    { id: 'm-b', family_id: F, name: 'Breakfast', sort: 0, usual_time: '08:00:00' },
    { id: 'm-d', family_id: F, name: 'Dinner', sort: 1, usual_time: '19:00:00' },
  ],
  dishes: [
    { id: 'd-chole', family_id: F, name: 'Chole', notes: '', make_every_days: 14, weekdays_ok: true, weekends_ok: true, archived_at: null },
    { id: 'd-idli', family_id: F, name: 'Idli Sambhar', notes: '', make_every_days: 21, weekdays_ok: true, weekends_ok: true, archived_at: null },
    { id: 'd-dal', family_id: F, name: 'Dal rice', notes: '', make_every_days: null, weekdays_ok: true, weekends_ok: true, archived_at: null },
  ],
  dish_meal_types: [
    { dish_id: 'd-chole', meal_type_id: 'm-d', family_id: F },
    { dish_id: 'd-idli', meal_type_id: 'm-b', family_id: F },
    { dish_id: 'd-dal', meal_type_id: 'm-d', family_id: F },
  ],
  dish_ingredients: [
    { dish_id: 'd-chole', item_id: 'i-chana', family_id: F, amount: '2 cups' },
    { dish_id: 'd-chole', item_id: 'i-onion', family_id: F, amount: null },
    { dish_id: 'd-idli', item_id: 'i-rice', family_id: F, amount: null },
  ],
  dish_prep_steps: [
    { id: 'p-soak', dish_id: 'd-chole', family_id: F, name: 'Soak garbanzo beans', lead_minutes: 720, sort: 0 },
    { id: 'p-isoak', dish_id: 'd-idli', family_id: F, name: 'Soak idli rice', lead_minutes: 2880, sort: 0 },
    { id: 'p-grind', dish_id: 'd-idli', family_id: F, name: 'Grind batter', lead_minutes: 1440, sort: 1 },
  ],
  planned_meals: [
    { id: 'pm-1', family_id: F, date: day(0), meal_type_id: 'm-d', dish_id: 'd-dal', item_id: null },
    { id: 'pm-old', family_id: F, date: day(-30), meal_type_id: 'm-d', dish_id: 'd-chole', item_id: null },
  ],
  tasks: [
    { id: 't-mine', family_id: F, title: 'Call plumber', due_on: day(0), due_time: null, done_at: null, visibility: 'private', owner_id: USER.id, planned_meal_id: null, prep_step_id: null },
  ],
});

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const b = await readFile(join('dist', path === '/' ? 'index.html' : path)); res.writeHead(200, { 'content-type': types[extname(path)] ?? 'text/html' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures++; };
const shot = async (page, name) => { if (process.env.SCREENS) { await mkdir('tests/e2e/screens', { recursive: true }); await page.screenshot({ path: `tests/e2e/screens/${name}.png`, fullPage: true }); } };

async function open(scheme = 'light') {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme, timezoneId: 'America/Los_Angeles' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const s = sessionStorageEntry();
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [s.key, s.value]);
  const data = db();
  const writes = await installFake(page, data);
  return { page, data, writes, errors };
}

// 1. My Home renders the family's categories and items
{
  const { page, errors } = await open();
  await page.goto(`${base}/#/home`);
  await page.getByRole('heading', { name: 'My Home' }).waitFor();
  check(await page.getByRole('link', { name: /Kitchen/ }).isVisible(), 'My Home shows the Kitchen category');
  await page.getByRole('link', { name: /Kitchen/ }).click();
  await page.getByRole('link', { name: /Vegetables/ }).click();
  await page.getByRole('heading', { name: 'Vegetables' }).waitFor();
  check(await page.getByRole('button', { name: /^Onions/ }).isVisible(), 'Vegetables lists Onions');
  check(await page.getByText('Staple').first().isVisible(), 'Onions is marked as a staple');
  await shot(page, 'home-vegetables');
  check(errors.length === 0, `My Home: no script errors ${errors.join('; ')}`);
  await page.close();
}

// 2. Week view, planning a dish with prep, moving it, removing it
for (const scheme of ['light', 'dark']) {
  const { page, data, writes, errors } = await open(scheme);
  await page.goto(`${base}/#/meals`);
  await page.getByRole('heading', { name: 'Next 7 days' }).waitFor();
  check(await page.getByRole('button', { name: 'Dal rice' }).isVisible(), `${scheme}: today shows Dal rice for dinner`);
  check(await page.getByText('Call plumber').isVisible(), `${scheme}: today shows the to-do`);
  await shot(page, `week-${scheme}`);
  if (scheme === 'dark') { check(errors.length === 0, 'dark: no script errors'); await page.close(); continue; }

  // Plan Chole for dinner in 3 days: prep reminder should be due 07:00 that day (12h before 19:00)
  const target = day(3);
  await page.locator(`section[aria-label$="${target}"]`).getByRole('button', { name: 'Add a meal' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Dinner', exact: true }).click();
  check(await sheet.getByText('Usually every 2 weeks, last made').isVisible(), 'Chole is suggested (due by its 2-week rhythm)');
  await shot(page, 'add-meal');
  await sheet.getByRole('button', { name: /^Chole/ }).first().click();
  await page.getByRole('status').filter({ hasText: 'Chole planned' }).waitFor();
  const pm = writes.find((w) => w.table === 'planned_meals' && w.method === 'POST')?.rows[0];
  check(pm?.date === target && pm?.meal_type_id === 'm-d' && pm?.dish_id === 'd-chole', 'planned meal saved for the right day and meal');
  const reminder = writes.find((w) => w.table === 'tasks' && w.method === 'POST')?.rows[0];
  check(reminder?.title === 'Soak garbanzo beans' && reminder?.due_on === target && reminder?.due_time === '07:00:00' && reminder?.planned_meal_id === pm?.id,
    `prep reminder due 07:00 on ${target}, linked to the meal (got ${reminder?.due_on} ${reminder?.due_time})`);
  check(await page.getByText('Soak garbanzo beans').isVisible(), 'reminder shows in the week');

  // Move it to the next day: reminder moves too
  await page.locator(`section[aria-label$="${target}"]`).getByRole('button', { name: 'Chole' }).click();
  await page.getByRole('dialog').getByText('Garbanzo beans, Onions').waitFor();
  check(await page.getByRole('dialog').getByText('Garbanzo beans, Onions').isVisible(), 'planned dish lists what it needs');
  await shot(page, 'planned-meal');
  await page.getByRole('dialog').locator('input[type="date"]').fill(day(4));
  await page.getByRole('dialog').getByRole('button', { name: 'Move', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Moved' }).waitFor();
  const movedTask = data.tasks.find((t) => t.planned_meal_id === pm.id);
  check(data.planned_meals.find((p) => p.id === pm.id)?.date === day(4) && movedTask?.due_on === day(4), 'moving the meal moves its prep reminder');

  // Take it off the plan
  await page.locator(`section[aria-label$="${day(4)}"]`).getByRole('button', { name: 'Chole' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Take off the plan' }).click();
  await page.getByRole('status').filter({ hasText: 'taken off the plan' }).waitFor();
  check(!data.planned_meals.some((p) => p.id === pm.id), 'taking it off the plan deletes the planned meal');
  check(errors.length === 0, `week: no script errors ${errors.join('; ')}`);
  await page.close();
}

// 3. Dishes: open Chole, check prep step shown, add an ingredient, save
{
  const { page, writes, errors } = await open();
  await page.goto(`${base}/#/meals/dishes`);
  await page.getByRole('heading', { name: 'Dishes' }).waitFor();
  check(await page.getByText('2 ingredients, 1 prep step').isVisible(), 'dish list summarises Chole');
  await page.getByRole('button', { name: /^Chole/ }).click();
  const sheet = page.getByRole('dialog');
  check(await sheet.getByLabel('Prep step').inputValue() === 'Soak garbanzo beans', 'prep step shown');
  check(await sheet.getByLabel('Hours or days').inputValue() === 'hours' && await sheet.getByLabel('How long before').inputValue() === '12', '12 hours before');
  await sheet.getByPlaceholder('Add an ingredient from My Home').fill('tom');
  await sheet.getByRole('button', { name: 'Tomatoes' }).click();
  await shot(page, 'dish-sheet');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('status').filter({ hasText: 'Saved' }).waitFor();
  const ing = writes.filter((w) => w.table === 'dish_ingredients' && w.method === 'POST').at(-1)?.rows.map((r) => r.item_id).sort();
  check(JSON.stringify(ing) === JSON.stringify(['i-chana', 'i-onion', 'i-tom']), `ingredients saved with Tomatoes added (${ing})`);
  const stepUpdate = writes.find((w) => w.table === 'dish_prep_steps' && w.method === 'PATCH');
  check(stepUpdate?.patch?.lead_minutes === 720, 'existing prep step kept (updated, not recreated)');
  check(errors.length === 0, `dishes: no script errors ${errors.join('; ')}`);
  await page.close();
}

// 4. To-dos: add a private one
{
  const { page, writes, errors } = await open();
  await page.goto(`${base}/#/meals/todos`);
  await page.getByRole('heading', { name: 'To-dos' }).waitFor();
  await page.getByLabel('New to-do').fill('Renew passport');
  await page.getByLabel('Just me').check();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'visible only to you' }).waitFor();
  const t = writes.find((w) => w.table === 'tasks' && w.method === 'POST')?.rows[0];
  check(t?.title === 'Renew passport' && t?.visibility === 'private' && t?.due_on === day(0), 'private to-do saved for today');
  await shot(page, 'todos');
  check(errors.length === 0, `to-dos: no script errors ${errors.join('; ')}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'to-dos: no sideways scrolling');
  await page.close();
}

await browser.close();
server.close();
if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
