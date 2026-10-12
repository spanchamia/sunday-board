import { supabase } from '../lib/supabase';
import type { ListEntry } from '../lib/types';
import { learnEvery } from '../logic/restock';
import { today } from '../logic/dates';

export type Reason =
  | { kind: 'manual' }
  | { kind: 'dish'; dishId: string }
  | { kind: 'planned_meal'; plannedMealId: string; dishId?: string }
  | { kind: 'restock_due' };

const OPEN = ['to_buy', 'in_bag'];

/**
 * Put an item on the shopping list with a reason. If it's already on the list, the
 * reason is added to the same row (one row per item). Returns whether it was new.
 */
export async function addToList(familyId: string, itemId: string, reason: Reason): Promise<'added' | 'already'> {
  let status: 'added' | 'already' = 'already';
  const found = await supabase.from('list_entries').select('id').eq('item_id', itemId).in('status', OPEN).maybeSingle();
  if (found.error) throw found.error;
  let entryId = found.data?.id;
  if (!entryId) {
    const ins = await supabase.from('list_entries').insert({ family_id: familyId, item_id: itemId }).select('id').single();
    if (ins.error) {
      // Another phone added it at the same moment: use that row.
      const again = await supabase.from('list_entries').select('id').eq('item_id', itemId).in('status', OPEN).maybeSingle();
      if (again.error || !again.data) throw ins.error;
      entryId = again.data.id;
    } else {
      entryId = ins.data.id;
      status = 'added';
    }
  }
  const r = await supabase.from('list_entry_reasons').insert({
    entry_id: entryId, family_id: familyId,
    reason: reason.kind,
    dish_id: reason.kind === 'dish' ? reason.dishId : reason.kind === 'planned_meal' ? reason.dishId ?? null : null,
    planned_meal_id: reason.kind === 'planned_meal' ? reason.plannedMealId : null,
  });
  if (r.error) throw r.error;
  return status;
}

/** Tick in the shop: into the bag (or back out). Nothing is recorded until "Done shopping". */
export async function setInBag(entryId: string, inBag: boolean): Promise<void> {
  const u = await supabase.from('list_entries').update({ status: inBag ? 'in_bag' : 'to_buy' }).eq('id', entryId);
  if (u.error) throw u.error;
}

/**
 * Done shopping: everything in the bag becomes bought, and each purchase is recorded
 * (with its store) so the app learns how often things run out.
 */
export async function checkout(familyId: string, bag: readonly { entry: ListEntry; storeId: string | null }[]): Promise<void> {
  if (!bag.length) return;
  const u = await supabase.from('list_entries').update({ status: 'bought', closed_at: new Date().toISOString() })
    .in('id', bag.map((b) => b.entry.id)).eq('status', 'in_bag');
  if (u.error) throw u.error;
  const e = await supabase.from('item_events').insert(bag.map((b) => ({ family_id: familyId, item_id: b.entry.item_id, kind: 'bought', store_id: b.storeId, happened_on: today() })));
  if (e.error) throw e.error;
  await relearn(bag.map((b) => b.entry.item_id));
}

/**
 * Have it: we don't need to buy it now. Takes it off the list (if it's there) and
 * remembers, so a staple isn't suggested again for a while.
 */
export async function haveIt(familyId: string, itemIds: readonly string[], entryIds: readonly string[] = []): Promise<void> {
  if (entryIds.length) {
    const u = await supabase.from('list_entries').update({ status: 'removed', closed_at: new Date().toISOString() }).in('id', [...entryIds]);
    if (u.error) throw u.error;
  }
  if (!itemIds.length) return;
  const e = await supabase.from('item_events').insert(itemIds.map((id) => ({ family_id: familyId, item_id: id, kind: 'have_it', happened_on: today() })));
  if (e.error) throw e.error;
  await relearn(itemIds);
}

/** Change how much, or where, for one row. */
export async function updateEntry(entryId: string, patch: { amount_hint?: 'usual' | 'extra' | 'a_bit'; amount?: string | null; store_id?: string | null }): Promise<void> {
  const clean = { ...patch, ...(patch.amount !== undefined ? { amount: patch.amount?.trim() || null } : {}) };
  const u = await supabase.from('list_entries').update(clean).eq('id', entryId);
  if (u.error) throw u.error;
}

/** Re-learn the restock rhythm for these items from their history and save it. */
export async function relearn(itemIds: readonly string[]): Promise<void> {
  const ids = [...new Set(itemIds)];
  if (!ids.length) return;
  const ev = await supabase.from('item_events').select('item_id, kind, happened_on').in('item_id', ids).order('happened_on').limit(5000);
  if (ev.error) throw ev.error;
  const items = await supabase.from('items').select('id, learned_every_days').in('id', ids);
  if (items.error) throw items.error;
  for (const it of items.data ?? []) {
    const every = learnEvery((ev.data ?? []).filter((e) => e.item_id === it.id));
    if (every !== null && every !== it.learned_every_days) {
      const u = await supabase.from('items').update({ learned_every_days: every }).eq('id', it.id);
      if (u.error) throw u.error;
    }
  }
}

/** Take a row off the list without recording a purchase. */
export async function removeFromList(entryId: string): Promise<void> {
  const u = await supabase.from('list_entries').update({ status: 'removed', closed_at: new Date().toISOString() }).eq('id', entryId);
  if (u.error) throw u.error;
}
