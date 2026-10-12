import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueDate, dueStaples, everyLabel, FIRST_GUESS_DAYS, learnEvery, sinceLabel } from '../../src/logic/restock.ts';
import { amountText, buildSuggestions, storeFor } from '../../src/logic/shopping.ts';

const ev = (item_id: string, kind: string, happened_on: string) => ({ item_id, kind, happened_on });
const staple = (id: string, extra: Partial<{ restock_every_days: number; learned_every_days: number }> = {}) =>
  ({ id, name: id, restock_mode: 'staple', restock_every_days: null, learned_every_days: null, ...extra });

test('learnEvery: median gap, same-trip purchases merged, needs two purchases', () => {
  assert.equal(learnEvery([ev('a', 'bought', '2026-01-01')]), null);
  assert.equal(learnEvery([ev('a', 'bought', '2026-01-01'), ev('a', 'bought', '2026-01-29')]), 28);
  // gaps 28, 1 (same trip, ignored), 35, 90 (odd one) -> median of 28, 35, 90 = 35
  assert.equal(learnEvery(['2026-01-01', '2026-01-29', '2026-01-30', '2026-03-06', '2026-06-04'].map((d) => ev('a', 'bought', d))), 35);
  // "Have it" 50 days after the last purchase stretches a 28-day rhythm
  assert.equal(learnEvery([ev('a', 'bought', '2026-01-01'), ev('a', 'bought', '2026-01-29'), ev('a', 'have_it', '2026-03-20')]), 50);
});

test('dueDate: set rhythm wins, learned next, then a first guess; Have it pushes out', () => {
  const two = [ev('a', 'bought', '2026-08-01'), ev('a', 'bought', '2026-08-29')];
  assert.equal(dueDate(staple('a'), two)?.dueOn, '2026-09-26');
  assert.equal(dueDate(staple('a', { restock_every_days: 14 }), two)?.dueOn, '2026-09-12');
  const once = dueDate(staple('a'), [ev('a', 'bought', '2026-08-01')]);
  assert.equal(once?.every, FIRST_GUESS_DAYS);
  assert.equal(once?.guessed, true);
  // Have it on 10-01 (33 days after buying) stretches the rhythm to 33 -> check again 17 days later
  assert.equal(dueDate(staple('a'), [...two, ev('a', 'have_it', '2026-10-01')])?.dueOn, '2026-10-18');
  assert.equal(dueDate({ ...staple('a'), restock_mode: 'as_needed' }, two), null);
  assert.equal(dueDate(staple('a'), []), null);
});

test('dueStaples: only those due by the coming shop', () => {
  const items = [staple('rice', { restock_every_days: 30 }), staple('salt', { restock_every_days: 300 })];
  const events = [ev('rice', 'bought', '2026-09-10'), ev('salt', 'bought', '2026-09-10')];
  assert.deepEqual(dueStaples(items, events, '2026-10-08').map((d) => d.itemId), ['rice']);
  assert.deepEqual(dueStaples(items, events, '2026-10-05').map((d) => d.itemId), []);
});

test('labels', () => {
  assert.equal(everyLabel(7), 'Every week');
  assert.equal(everyLabel(21), 'Every 3 weeks');
  assert.equal(everyLabel(10), 'Every 10 days');
  assert.equal(everyLabel(90), 'Every 3 months');
  assert.equal(sinceLabel('2026-09-10', '2026-10-08'), '4 weeks ago');
  assert.equal(amountText({ amount_hint: 'usual', amount: null }), '');
  assert.equal(amountText({ amount_hint: 'extra', amount: '2 kg' }), 'Extra, 2 kg');
  assert.equal(amountText({ amount_hint: 'a_bit', amount: ' ' }), 'Just a bit');
});

test('buildSuggestions: fresh for planned meals, staples only when due, no repeats', () => {
  const items = [
    { id: 'okra', name: 'Okra', restock_mode: 'as_needed', archived_at: null },
    { id: 'cumin', name: 'Cumin', restock_mode: 'staple', archived_at: null },
    { id: 'rice', name: 'Rice', restock_mode: 'staple', archived_at: null },
    { id: 'old', name: 'Old', restock_mode: 'as_needed', archived_at: '2026-01-01' },
  ];
  const base = {
    items,
    planned: [{ id: 'pm1', dish_id: 'bhindi' }, { id: 'pm2', dish_id: 'bhindi' }],
    ingredientsOfDish: new Map([['bhindi', ['okra', 'cumin', 'rice', 'old']]]),
    due: [{ itemId: 'rice', dueOn: '2026-10-10', lastBought: '2026-09-01', guessed: false }],
    listed: new Map(),
  };
  const s = buildSuggestions(base);
  assert.deepEqual(s.map((x) => x.itemId), ['okra', 'rice']);           // cumin not due, archived skipped
  assert.equal(s[0]!.reasons.length, 2);                                  // two planned meals
  assert.deepEqual(s[0]!.dishIds, ['bhindi']);
  assert.deepEqual(s[1]!.reasons.map((r) => r.kind), ['planned_meal', 'planned_meal', 'restock_due']);
  // Once on the list with those reasons, nothing new is suggested.
  const listed = new Map([
    ['okra', [{ reason: 'planned_meal', planned_meal_id: 'pm1' }, { reason: 'planned_meal', planned_meal_id: 'pm2' }]],
    ['rice', [{ reason: 'planned_meal', planned_meal_id: 'pm1' }, { reason: 'planned_meal', planned_meal_id: 'pm2' }, { reason: 'restock_due', planned_meal_id: null }]],
  ]);
  assert.deepEqual(buildSuggestions({ ...base, listed }), []);
  // A newly planned meal adds just its reason to the listed row.
  const again = buildSuggestions({ ...base, listed, planned: [...base.planned, { id: 'pm3', dish_id: 'bhindi' }] });
  assert.deepEqual(again.map((x) => [x.itemId, x.onList, x.reasons.length]), [['okra', true, 1], ['rice', true, 1]]);
});

test('storeFor: chosen, preferred, only store, else any', () => {
  const links = [
    { item_id: 'a', store_id: 'costco', preferred: false }, { item_id: 'a', store_id: 'patel', preferred: true },
    { item_id: 'b', store_id: 'costco', preferred: false },
    { item_id: 'c', store_id: 'costco', preferred: false }, { item_id: 'c', store_id: 'patel', preferred: false },
  ];
  assert.equal(storeFor({ item_id: 'a', store_id: 'tj' }, links), 'tj');
  assert.equal(storeFor({ item_id: 'a', store_id: null }, links), 'patel');
  assert.equal(storeFor({ item_id: 'b', store_id: null }, links), 'costco');
  assert.equal(storeFor({ item_id: 'c', store_id: null }, links), null);
  assert.equal(storeFor({ item_id: 'z', store_id: null }, links), null);
});

import { effectiveRestockMode, governedItems } from '../../src/logic/tree.ts';

test('items follow the nearest category setting unless they have their own', () => {
  const cats = [
    { id: 'home', parent_id: null, name: 'My Home', sort: 0, default_restock_mode: null },
    { id: 'kit', parent_id: 'home', name: 'Kitchen', sort: 0, default_restock_mode: null },
    { id: 'sp', parent_id: 'kit', name: 'Spices', sort: 0, default_restock_mode: 'staple' },
    { id: 'whole', parent_id: 'sp', name: 'Whole spices', sort: 0, default_restock_mode: null },
    { id: 'fresh', parent_id: 'sp', name: 'Fresh herbs', sort: 1, default_restock_mode: 'as_needed' },
  ];
  assert.equal(effectiveRestockMode(cats, { restock_mode: null, category_id: 'whole' }), 'staple');
  assert.equal(effectiveRestockMode(cats, { restock_mode: 'as_needed', category_id: 'whole' }), 'as_needed');
  assert.equal(effectiveRestockMode(cats, { restock_mode: null, category_id: 'fresh' }), 'as_needed');
  assert.equal(effectiveRestockMode(cats, { restock_mode: null, category_id: 'kit' }), 'as_needed');
  assert.equal(effectiveRestockMode(cats, { restock_mode: null, category_id: null }), 'as_needed');
  const items = [
    { id: 'cumin', category_id: 'sp' }, { id: 'cloves', category_id: 'whole' },
    { id: 'mint', category_id: 'fresh' }, { id: 'rice', category_id: 'kit' }, { id: 'x', category_id: null },
  ];
  assert.deepEqual(governedItems(cats, 'sp', items).map((i) => i.id), ['cumin', 'cloves']);
  assert.deepEqual(governedItems(cats, 'kit', items).map((i) => i.id), ['rice']);
});

import { addMonths, monthGrid, weekDays, weekStart } from '../../src/logic/calendar.ts';

test('calendar: weeks start Sunday, months cover whole weeks, month maths clamps', () => {
  assert.equal(weekStart('2026-10-14'), '2026-10-11');
  assert.equal(weekStart('2026-10-11'), '2026-10-11');
  assert.deepEqual(weekDays('2026-10-31'), ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
  const oct = monthGrid('2026-10-11');
  assert.equal(oct.length, 5);
  assert.equal(oct[0]![0], '2026-09-27');
  assert.equal(oct.at(-1)!.at(-1), '2026-10-31');
  assert.equal(monthGrid('2026-11-05').length, 5);      // Nov 1 2026 is a Sunday
  assert.equal(monthGrid('2026-08-01').length, 6);      // Aug 2026 spans 6 rows
  assert.equal(addMonths('2027-01-31', 1), '2027-02-28');
  assert.equal(addMonths('2026-10-11', -1), '2026-09-11');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
});
