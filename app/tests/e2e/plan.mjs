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
    { id: 'i-lemon', family_id: F, category_id: 'c-veg', name: 'Lemons', restock_mode: 'as_needed', archived_at: null },
  ],
  list_entries: [{ id: 'le-onion', family_id: F, item_id: 'i-onion', status: 'to_buy', amount_hint: 'usual', store_id: null, added_at: '2026-10-09' }],
  list_entry_reasons: [{ id: 'lr-1', entry_id: 'le-onion', family_id: F, reason: 'manual', dish_id: null, planned_meal_id: null }],
  item_events: [],
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
    { dish_id: 'd-chole', item_id: 'i-lemon', family_id: F, amount: null },
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
  await page.getByRole('dialog').getByText('Garbanzo beans, Lemons, Onions').waitFor();
  check(await page.getByRole('dialog').getByText('Garbanzo beans, Lemons, Onions').isVisible(), 'planned dish lists what it needs');
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
  check(await page.getByText('3 ingredients, 1 prep step').isVisible(), 'dish list summarises Chole');
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
  check(JSON.stringify(ing) === JSON.stringify(['i-chana', 'i-lemon', 'i-onion', 'i-tom']), `ingredients saved with Tomatoes added (${ing})`);
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

// 5. Shop for a dish straight from Dishes, then tick it off on the List tab
{
  const { page, data, writes, errors } = await open();
  await page.goto(`${base}/#/meals/dishes`);
  await page.getByRole('button', { name: 'Add what Chole needs to the list' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByText('Garbanzo beans').waitFor();
  const ticked = async (name) => sheet.locator('label', { hasText: name }).locator('input').isChecked();
  check(await ticked('Lemons') && await ticked('Onions') && !(await ticked('Garbanzo beans')),
    'fresh Lemons ticked, Onions ticked (already listed), staple Garbanzo beans not');
  check(await sheet.getByText('Already on the list').isVisible(), 'Onions shows it is already on the list');
  await shot(page, 'shop-for-dish');
  await sheet.getByRole('button', { name: 'Add 2 to the list' }).click();
  await page.getByRole('status').filter({ hasText: 'for Chole' }).waitFor();
  const newEntries = writes.filter((w) => w.table === 'list_entries' && w.method === 'POST').flatMap((w) => w.rows);
  check(newEntries.length === 1 && newEntries[0].item_id === 'i-lemon', 'one new row (Lemons); Onions not duplicated');
  const reasons = writes.filter((w) => w.table === 'list_entry_reasons' && w.method === 'POST').flatMap((w) => w.rows);
  check(reasons.length === 2 && reasons.every((r) => r.reason === 'dish' && r.dish_id === 'd-chole'), 'both rows note “for Chole”');

  await page.getByRole('link', { name: 'List' }).click();
  await page.getByRole('heading', { name: 'Shopping list' }).waitFor();
  await page.getByText('Lemons').waitFor();
  check(await page.getByText('For Chole, plus added by hand').isVisible(), 'Onions shows both reasons');
  await shot(page, 'list');
  await page.getByLabel('Put Lemons in the bag').click();
  await page.getByText('In the bag (1)').waitFor();
  const entry = data.list_entries.find((e) => e.item_id === 'i-lemon');
  check(entry?.status === 'in_bag' && !data.item_events.length, 'ticking puts it in the bag, nothing recorded yet');
  await page.getByLabel('Take Lemons out of the bag').click();
  await page.getByLabel('Put Lemons in the bag').waitFor();
  check(entry?.status === 'to_buy', 'unticking takes it back out');
  await page.getByLabel('Put Lemons in the bag').click();
  await page.getByRole('button', { name: 'Done shopping: 1 bought' }).click();
  await page.getByRole('status').filter({ hasText: 'Recorded 1 bought' }).waitFor();
  check(entry?.status === 'bought' && data.item_events.some((e) => e.item_id === 'i-lemon' && e.kind === 'bought'), 'Done shopping records the purchase');
  check(await page.getByText(/In the bag/).waitFor({ state: 'hidden', timeout: 5000 }).then(() => true, () => false), 'bag is empty afterwards');
  check(errors.length === 0, `list: no script errors ${errors.join('; ')}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'list: no sideways scrolling');
  await page.close();
}

// 6. This week's shop: planned meals + staples running low, amounts, stores, Have it
{
  const { page, data, writes, errors } = await open();
  data.item_events.push(
    { id: 'e1', family_id: F, item_id: 'i-rice', kind: 'bought', happened_on: day(-70) },
    { id: 'e2', family_id: F, item_id: 'i-rice', kind: 'bought', happened_on: day(-40) },
    { id: 'e3', family_id: F, item_id: 'i-chana', kind: 'bought', happened_on: day(-200) },
  );
  data.planned_meals.push({ id: 'pm-week', family_id: F, date: day(2), meal_type_id: 'm-d', dish_id: 'd-chole', item_id: null });
  data.item_stores.push({ item_id: 'i-lemon', store_id: 's-1', family_id: F, preferred: true });
  await page.goto(`${base}/#/list`);
  await page.getByText('3 things to check').waitFor();
  check(true, 'banner offers 3 things for this week (Lemons, Garbanzo beans, Idli rice)');
  await page.getByRole('button', { name: 'Review' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByText('Staples running low').waitFor();
  check(await sheet.getByRole('region', { name: 'For this week’s meals' }).getByText('Lemons').isVisible(), 'Lemons suggested for this week’s Chole');
  check(await sheet.getByText('For Chole, last bought').isVisible(), 'Garbanzo beans: for Chole and due');
  check(!(await sheet.getByText('Onions').isVisible()), 'Onions (staple, not due) is not suggested');
  check(await sheet.getByRole('region', { name: 'Staples running low' }).getByText('Idli rice').isVisible(), 'Idli rice suggested as running low');
  await shot(page, 'week-shop');
  await sheet.locator('label', { hasText: 'Idli rice' }).locator('input').uncheck();
  await sheet.getByRole('button', { name: 'Add 2 to the list' }).click();
  await page.getByRole('status').filter({ hasText: '1 marked “Have it”' }).waitFor();
  const reasons = writes.filter((w) => w.table === 'list_entry_reasons' && w.method === 'POST').flatMap((w) => w.rows);
  check(reasons.some((r) => r.reason === 'planned_meal' && r.planned_meal_id === 'pm-week' && r.dish_id === 'd-chole' && data.list_entries.find((e) => e.id === r.entry_id)?.item_id === 'i-lemon'),
    'Lemons listed for the planned Chole');
  check(reasons.some((r) => r.reason === 'restock_due' && data.list_entries.find((e) => e.id === r.entry_id)?.item_id === 'i-chana'), 'Garbanzo beans listed as due');
  check(data.item_events.some((e) => e.item_id === 'i-rice' && e.kind === 'have_it'), 'unticked staple remembered as Have it');
  check(!data.list_entries.some((e) => e.item_id === 'i-rice'), 'Idli rice not added');
  await page.getByText('3 to buy').waitFor();
  check(!(await page.getByRole('button', { name: 'Review' }).isVisible()), 'nothing left to review');

  await page.getByRole('button', { name: 'Lemons: amount, store, have it' }).click();
  await sheet.getByRole('button', { name: 'Extra' }).click();
  await sheet.getByLabel('Amount (optional)').fill('6');
  check(await sheet.getByLabel('Store').locator('option').first().textContent() === 'Usual store (Costco)', 'store picker names the usual store');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Extra, 6').waitFor();
  const le = data.list_entries.find((e) => e.item_id === 'i-lemon' && e.status === 'to_buy');
  check(le?.amount_hint === 'extra' && le?.amount === '6', 'amount saved on the row');

  await page.getByRole('button', { name: 'By store' }).click();
  check(await page.getByRole('region', { name: 'Costco' }).getByText('Lemons').isVisible(), 'by store: Lemons under Costco (its usual store)');
  check(await page.getByRole('region', { name: 'Any store' }).getByText('Onions').isVisible(), 'by store: Onions under Any store');
  await shot(page, 'list-by-store');

  await page.getByRole('button', { name: 'Have Onions' }).click();
  await page.getByText('2 to buy').waitFor();
  check(data.list_entries.find((e) => e.id === 'le-onion')?.status === 'removed' && data.item_events.some((e) => e.item_id === 'i-onion' && e.kind === 'have_it'),
    'Have it takes Onions off and remembers');

  await page.getByLabel('Put Lemons in the bag').click();
  await page.getByRole('button', { name: 'Done shopping: 1 bought' }).click();
  await page.getByRole('status').filter({ hasText: 'Recorded 1 bought' }).waitFor();
  check(data.item_events.some((e) => e.item_id === 'i-lemon' && e.kind === 'bought' && e.store_id === 's-1'), 'purchase recorded at Costco');
  check(errors.length === 0, `week shop: no script errors ${errors.join('; ')}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'week shop: no sideways scrolling');
  await page.close();
}

// 7. A whole category as staples, with exceptions
{
  const { page, data, writes, errors } = await open();
  data.categories.push({ id: 'c-sp', family_id: F, parent_id: 'c-kit', name: 'Spices', sort: 2, default_restock_mode: null });
  data.items.push(
    { id: 'i-cumin', family_id: F, category_id: 'c-sp', name: 'Cumin', restock_mode: 'staple', archived_at: null },
    { id: 'i-hing', family_id: F, category_id: 'c-sp', name: 'Hing', restock_mode: 'as_needed', archived_at: null },
    { id: 'i-methi', family_id: F, category_id: 'c-sp', name: 'Kasuri methi', restock_mode: 'as_needed', archived_at: null },
  );
  await page.goto(`${base}/#/home/c-sp`);
  await page.getByRole('heading', { name: 'Spices' }).waitFor();
  check(await page.locator('.staple').count() === 1, 'before: only Cumin shows as a staple');
  await page.getByRole('button', { name: 'Edit Spices' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Staples' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await sheet.getByText('2 items were set to').waitFor();
  check(data.categories.find((c) => c.id === 'c-sp')?.default_restock_mode === 'staple', 'Spices saved as staples');
  check(data.items.find((i) => i.id === 'i-cumin')?.restock_mode === null, 'Cumin (already a staple) now just follows Spices');
  await shot(page, 'category-cleanup');
  await sheet.getByRole('button', { name: 'Make all 3 staples' }).click();
  await page.getByRole('status').filter({ hasText: 'All 3 items in Spices are staples' }).waitFor();
  check(data.items.filter((i) => i.category_id === 'c-sp').every((i) => i.restock_mode === null), 'all three follow Spices');
  await page.waitForFunction(() => document.querySelectorAll('.staple').length === 3);
  check(true, 'all three show as staples');

  await page.getByRole('button', { name: /^Kasuri methi/ }).click();
  check(await sheet.getByRole('button', { name: 'Like category' }).getAttribute('aria-pressed') === 'true', 'item editor: Like category is chosen');
  check(await sheet.getByText('A staple, like everything in Spices.').isVisible(), 'item editor explains where it comes from');
  await sheet.getByRole('button', { name: 'As needed' }).click();
  check(await sheet.getByText('An exception: Spices items are usually staples.').isVisible(), 'choosing As needed is shown as an exception');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('status').filter({ hasText: 'Saved' }).waitFor();
  check(data.items.find((i) => i.id === 'i-methi')?.restock_mode === 'as_needed', 'Kasuri methi saved as an exception');
  await page.waitForFunction(() => document.querySelectorAll('.staple').length === 2);
  check(true, 'Kasuri methi no longer shows as a staple');
  check(errors.length === 0, `categories: no script errors ${errors.join('; ')}`);
  await page.close();
}

// 8. The launcher (Home tab): tiles with counts, the to-dos badge, and new tabs
{
  const { page, errors } = await open();
  await page.goto(`${base}/`);
  await page.getByRole('heading', { name: 'Panchamia' }).waitFor();
  const tile = (name) => page.getByRole('link', { name });
  check(await tile('Kitchen: 5 items').isVisible(), 'Kitchen tile counts its items');
  await tile(/^Shopping list: 1 to buy/).waitFor();
  check(true, 'Shopping list tile shows 1 to buy');
  check(await tile('Meal plan: Today: Dal rice').isVisible(), 'Meal plan tile shows today’s dish');
  check(await tile('To-dos: 1 due').isVisible(), 'To-dos tile shows what is due');
  check(await page.locator('.tabbar .tab-badge').textContent() === '1', 'To-dos tab shows a badge');
  check(await page.getByRole('link', { name: 'Home', exact: true }).getAttribute('aria-current') === 'page', 'Home tab is lit');
  await shot(page, 'launcher');
  await tile(/^Stores/).click();
  await page.getByRole('heading', { name: 'Stores' }).waitFor();
  check(await page.getByRole('button', { name: /Costco/ }).isVisible(), 'Stores page lists Costco');
  await page.locator('.tabbar').getByRole('link', { name: /To-dos/ }).click();
  await page.getByRole('heading', { name: 'To-dos' }).waitFor();
  check(await page.getByText('Call plumber').isVisible(), 'To-dos tab shows the to-do');
  await page.goto(`${base}/#/meals`);
  check(!(await page.getByRole('link', { name: 'To-dos', exact: true }).first().evaluate((a) => !!a.closest('.segmented')).catch(() => false)), 'Plan no longer has a To-dos view');
  check(errors.length === 0, `launcher: no script errors ${errors.join('; ')}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'launcher: no sideways scrolling');
  await page.close();
}

// 9. Calendar: kitchen tablet week view, month view, phone, and this-device settings
{
  const { page, data, writes, errors } = await open();
  data.tasks.push({ id: 't-prep', family_id: F, title: 'Soak dal', due_on: day(0), due_time: '17:00:00', done_at: null,
    visibility: 'family', owner_id: USER.id, planned_meal_id: 'pm-1', prep_step_id: null });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${base}/#/calendar`);
  const todayCol = page.getByRole('region', { name: /^Today,/ });
  await todayCol.getByRole('button', { name: 'Dal rice' }).waitFor();
  check(await todayCol.getByText('Soak dal').isVisible() && await todayCol.getByText('Call plumber').isVisible(), 'week: today shows the dish, prep reminder and to-do');
  const boxes = await page.locator('.cal-day').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  check(boxes.length === 7 && boxes.every((y) => y === boxes[0]), 'tablet week: 7 days side by side');
  await shot(page, 'calendar-week-tablet');
  await todayCol.getByLabel('Call plumber', { exact: true }).click();
  await todayCol.getByLabel('Call plumber, done').waitFor();
  check(writes.some((w) => w.table === 'tasks' && w.method === 'PATCH' && w.patch.done_at), 'ticking a to-do on the calendar marks it done');

  await page.getByRole('button', { name: 'Month' }).click();
  await page.locator('.cal-cell.is-today .cal-line', { hasText: 'Dal rice' }).waitFor();
  check(true, 'month: today’s cell lists Dal rice');
  check(await page.getByRole('region', { name: /^Today,/ }).getByText('Soak dal').isVisible(), 'month: the picked day (today) is shown in full below');
  await shot(page, 'calendar-month-tablet');
  const later = page.locator('.cal-cell:not(.out)').last();
  await later.click();
  check(await later.getAttribute('aria-selected') === 'true', 'tapping a day picks it');
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: 'Today' }).click();
  await page.locator('.cal-cell.is-today').waitFor();
  check(true, 'Today brings the month back');

  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.locator('.cal-cell.is-today .cal-dots i').first().isVisible(), 'phone month: days show dots');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'phone calendar: no sideways scrolling');
  await shot(page, 'calendar-month-phone');

  await page.goto(`${base}/#/family`);
  await page.getByRole('group', { name: 'Opens on' }).getByRole('button', { name: 'Calendar' }).click();
  await page.getByLabel(/Hide my “Just me” to-dos/).check();
  await page.goto(`${base}/`);
  await page.reload();
  await page.locator('.cal-title').waitFor();
  check(await page.getByRole('button', { name: 'Week' }).isVisible(), 'this device now opens on the calendar');
  await page.getByRole('button', { name: 'Week' }).click();
  await page.getByRole('region', { name: /^Today,/ }).getByRole('button', { name: 'Dal rice' }).waitFor();
  check(!(await page.getByText('Call plumber').isVisible()), '“Just me” to-dos hidden on this device');
  await page.locator('.tabbar').getByRole('link', { name: 'Home' }).click();
  await page.getByRole('heading', { name: 'Panchamia' }).waitFor();
  check(await page.getByRole('link', { name: /^Calendar/ }).isVisible(), 'Home tab still reaches the launcher, with a Calendar tile');
  check(errors.length === 0, `calendar: no script errors ${errors.join('; ')}`);
  await page.close();
}

await browser.close();
server.close();
if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
