import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayLabel, daysBetween, isWeekend, rangeLabel } from '../../src/logic/dates.ts';
import { leadLabel, prepDue } from '../../src/logic/prep.ts';
import { suggestDishes, type DishFacts } from '../../src/logic/suggest.ts';

test('dates: add, difference across months and DST, weekend', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-10-30', '2026-11-03'), 4); // across US DST end (Nov 1)
  assert.equal(isWeekend('2026-10-10'), true);  // Saturday
  assert.equal(isWeekend('2026-10-12'), false); // Monday
  const now = new Date(2026, 9, 10, 9);
  assert.equal(dayLabel('2026-10-10', now), 'Today');
  assert.equal(dayLabel('2026-10-11', now), 'Tomorrow');
  assert.match(rangeLabel('2026-10-29', '2026-11-04'), /29 – .*4/);
});

test('prep due: lead time before the meal, crossing days', () => {
  // Idli for Sunday breakfast at 08:00: soak 2 days before, grind 1 day before
  assert.deepEqual(prepDue('2026-10-11', '08:00:00', 2 * 1440), { due_on: '2026-10-09', due_time: '08:00:00' });
  assert.deepEqual(prepDue('2026-10-11', '08:00:00', 1440), { due_on: '2026-10-10', due_time: '08:00:00' });
  // Chole for dinner at 19:00: soak 12 hours before -> 07:00 same day
  assert.deepEqual(prepDue('2026-10-14', '19:00:00', 720), { due_on: '2026-10-14', due_time: '07:00:00' });
  // No usual time: noon
  assert.deepEqual(prepDue('2026-10-14', null, 240), { due_on: '2026-10-14', due_time: '08:00:00' });
});

test('lead labels read naturally', () => {
  assert.equal(leadLabel(2880), '2 days before');
  assert.equal(leadLabel(1440), '1 day before');
  assert.equal(leadLabel(720), '12 hours before');
  assert.equal(leadLabel(0), 'At the meal');
});

const dish = (id: string, o: Partial<DishFacts> = {}): DishFacts =>
  ({ id, name: id, make_every_days: null, weekdays_ok: true, weekends_ok: true, mealTypeIds: ['dinner'], ...o });

test('suggestions: due dishes first, recent ones skipped, weekend rule, meal type', () => {
  const dishes = [
    dish('dal', { make_every_days: 7 }),                 // last 10 days ago -> due
    dish('pavbhaji', { make_every_days: 21, weekdays_ok: false }), // weekends only
    dish('pasta', { make_every_days: 14 }),              // made 3 days ago -> skip
    dish('biryani'),                                     // no rhythm, 60 days ago -> long gap
    dish('poha', { mealTypeIds: ['breakfast'], make_every_days: 7 }),
    dish('new', { make_every_days: 14 }),                // never planned
  ];
  const last = new Map([['dal', '2026-10-02'], ['pavbhaji', '2026-09-01'], ['pasta', '2026-10-09'], ['biryani', '2026-08-13'], ['poha', '2026-09-01']]);
  const weekday = suggestDishes(dishes, last, new Set(), '2026-10-12', 'dinner');
  assert.deepEqual(weekday.map((s) => s.dishId), ['dal', 'new', 'biryani']);
  assert.equal(weekday[0]?.reason, 'Usually every week, last made 10 days ago');
  assert.equal(weekday[2]?.reason, 'Not made in 2 months');
  const weekend = suggestDishes(dishes, last, new Set(['dal']), '2026-10-11', 'dinner');
  assert.deepEqual(weekend.map((s) => s.dishId), ['pavbhaji', 'new', 'biryani']);
});
