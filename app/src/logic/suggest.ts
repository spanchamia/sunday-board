import { daysBetween, isWeekend } from './dates';

export interface DishFacts {
  id: string;
  name: string;
  make_every_days: number | null;
  weekdays_ok: boolean;
  weekends_ok: boolean;
  mealTypeIds: readonly string[];
}

export interface Suggestion { dishId: string; reason: string; score: number }

/**
 * Dishes worth cooking on `date` for `mealTypeId`, best first. Uses only the family's
 * own data: which meal types a dish suits, weekday/weekend preference, how often they
 * like it, and when it was last planned. Dishes already planned that week are skipped.
 *   - due: "Usually every 2 weeks, last made 3 weeks ago"
 *   - long gap: "Not made in 2 months"
 */
export function suggestDishes(
  dishes: readonly DishFacts[],
  lastPlanned: ReadonlyMap<string, string>, // dishId -> last date planned (on or before `date`)
  plannedThisWeek: ReadonlySet<string>,
  date: string,
  mealTypeId: string,
  limit = 5,
): Suggestion[] {
  const weekend = isWeekend(date);
  const out: Suggestion[] = [];
  for (const d of dishes) {
    if (d.mealTypeIds.length && !d.mealTypeIds.includes(mealTypeId)) continue;
    if (weekend ? !d.weekends_ok : !d.weekdays_ok) continue;
    if (plannedThisWeek.has(d.id)) continue;
    const last = lastPlanned.get(d.id);
    const gap = last ? daysBetween(last, date) : null;
    let score = 0;
    let reason = '';
    if (d.make_every_days && gap !== null) {
      const ratio = gap / d.make_every_days;
      if (ratio < 0.8) continue; // made recently enough
      score = 50 + Math.min(ratio, 4) * 10;
      reason = `Usually every ${every(d.make_every_days)}, last made ${ago(gap)}`;
    } else if (d.make_every_days && gap === null) {
      score = 45;
      reason = `Usually every ${every(d.make_every_days)}`;
    } else if (gap !== null && gap >= 28) {
      score = 30 + Math.min(gap / 7, 20);
      reason = `Not made in ${ago(gap, false)}`;
    } else {
      continue;
    }
    if (d.mealTypeIds.includes(mealTypeId)) score += 5;
    out.push({ dishId: d.id, reason, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

function every(days: number): string {
  if (days % 7 === 0) { const w = days / 7; return w === 1 ? 'week' : `${w} weeks`; }
  return days === 1 ? 'day' : `${days} days`;
}

function ago(days: number, suffix = true): string {
  const s = suffix ? ' ago' : '';
  if (days < 14) return `${days} days${s}`;
  if (days < 60) return `${Math.round(days / 7)} weeks${s}`;
  return `${Math.round(days / 30)} months${s}`;
}
