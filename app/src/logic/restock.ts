// Restock rhythm: how often a staple runs out, learned from when it was bought.
// All pure functions on 'YYYY-MM-DD' dates, so they are easy to test.
import { addDays, daysBetween } from './dates';

export interface ItemEventLite { item_id: string; kind: string; happened_on: string }
export interface ItemLite {
  id: string; name: string; restock_mode: string;
  restock_every_days: number | null; learned_every_days: number | null;
}

/** Guess for a staple bought only once: check again after about two months. */
export const FIRST_GUESS_DAYS = 60;
/** Purchases closer than this count as the same trip (bought twice that week). */
const SAME_TRIP_DAYS = 3;
const MIN_EVERY = 3;
const MAX_EVERY = 365;

const clamp = (n: number) => Math.min(MAX_EVERY, Math.max(MIN_EVERY, Math.round(n)));

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Learned gap in days between purchases: the median of the last six gaps (median,
 * so one odd month doesn't throw it off). A "Have it" long after the last purchase
 * proves the item lasts at least that long, so it can stretch the rhythm.
 * Returns null until there are two separate purchases.
 */
export function learnEvery(events: readonly ItemEventLite[]): number | null {
  const bought = [...new Set(events.filter((e) => e.kind === 'bought').map((e) => e.happened_on))].sort();
  const gaps: number[] = [];
  for (let i = 1; i < bought.length; i++) {
    const g = daysBetween(bought[i - 1]!, bought[i]!);
    if (g >= SAME_TRIP_DAYS) gaps.push(g);
  }
  if (!gaps.length) return null;
  let every = median(gaps.slice(-6));
  const last = bought.at(-1)!;
  const haveIts = events.filter((e) => e.kind === 'have_it' && e.happened_on > last).map((e) => e.happened_on).sort();
  if (haveIts.length) every = Math.max(every, daysBetween(last, haveIts.at(-1)!));
  return clamp(every);
}

export interface Due {
  itemId: string;
  dueOn: string;        // when it's likely to run out
  every: number;        // the rhythm used
  guessed: boolean;     // true when based on a single purchase
  lastBought: string;
}

/**
 * When a staple is next due. Rhythm: the one set by hand, else learned, else a first
 * guess. Due = last purchase + rhythm; after a "Have it", check again in half the
 * rhythm (at least a week). Items never bought, or not staples, are never due.
 */
export function dueDate(item: ItemLite, events: readonly ItemEventLite[]): Due | null {
  if (item.restock_mode !== 'staple') return null;
  const mine = events.filter((e) => e.item_id === item.id);
  const lastBought = mine.filter((e) => e.kind === 'bought').map((e) => e.happened_on).sort().at(-1);
  if (!lastBought) return null;
  const learned = learnEvery(mine) ?? item.learned_every_days;
  const every = item.restock_every_days ?? learned ?? FIRST_GUESS_DAYS;
  const guessed = !item.restock_every_days && !learned;
  let dueOn = addDays(lastBought, every);
  const lastHave = mine.filter((e) => e.kind === 'have_it' && e.happened_on >= lastBought).map((e) => e.happened_on).sort().at(-1);
  if (lastHave) {
    const recheck = addDays(lastHave, Math.max(7, Math.round(every / 2)));
    if (recheck > dueOn) dueOn = recheck;
  }
  return { itemId: item.id, dueOn, every, guessed, lastBought };
}

/** Staples due within `aheadDays` of today (the coming shop), soonest first. */
export function dueStaples(items: readonly ItemLite[], events: readonly ItemEventLite[], todayIso: string, aheadDays = 3): Due[] {
  const byItem = new Map<string, ItemEventLite[]>();
  for (const e of events) byItem.set(e.item_id, [...(byItem.get(e.item_id) ?? []), e]);
  const horizon = addDays(todayIso, aheadDays);
  return items
    .flatMap((i) => { const d = dueDate(i, byItem.get(i.id) ?? []); return d && d.dueOn <= horizon ? [d] : []; })
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/** "Every 2 weeks", "Every 10 days", "Every 3 months". */
export function everyLabel(days: number): string {
  if (days % 7 === 0 && days <= 56) return days === 7 ? 'Every week' : `Every ${days / 7} weeks`;
  if (days >= 60) { const m = Math.round(days / 30); return m === 1 ? 'Every month' : `Every ${m} months`; }
  return `Every ${days} days`;
}

/** "Last bought 3 weeks ago" etc. */
export function sinceLabel(fromIso: string, todayIso: string): string {
  const d = daysBetween(fromIso, todayIso);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}
