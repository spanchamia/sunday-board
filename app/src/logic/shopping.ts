/** Which of a dish's ingredients to tick by default when adding it to the list. */
export interface IngredientChoice { itemId: string; name: string; staple: boolean; onList: boolean; checked: boolean }

/**
 * Fresh / as-needed ingredients are ticked; staples (spices, dals, oil) are not,
 * because you probably have them. Anything already on the list stays ticked: adding
 * it again only notes this dish as another reason.
 */
export function defaultChoices(ings: readonly { itemId: string; name: string; staple: boolean }[], onList: ReadonlySet<string>): IngredientChoice[] {
  return ings
    .map((i) => ({ ...i, onList: onList.has(i.itemId), checked: !i.staple || onList.has(i.itemId) }))
    .sort((a, b) => Number(a.staple) - Number(b.staple) || a.name.localeCompare(b.name));
}

/** "For Chole and Pav bhaji", "Added by hand", "For Chole, plus added by hand". */
export function reasonText(reasons: readonly { reason: string; dishName?: string | null }[]): string {
  const dishes = [...new Set(reasons.filter((r) => r.dishName).map((r) => r.dishName!))];
  const manual = reasons.some((r) => r.reason === 'manual');
  const restock = reasons.some((r) => r.reason === 'restock_due');
  const parts: string[] = [];
  if (dishes.length) parts.push(`For ${dishes.length > 2 ? `${dishes.slice(0, 2).join(', ')} and ${dishes.length - 2} more` : dishes.join(' and ')}`);
  if (restock) parts.push(parts.length ? 'due for restock' : 'Due for restock');
  if (manual) parts.push(parts.length ? 'added by hand' : 'Added by hand');
  return parts.join(', plus ');
}

// ---------------------------------------------------------------------------
// This week's shop: suggestions from planned meals and staples that are due.
// ---------------------------------------------------------------------------

export type SuggestReason =
  | { kind: 'planned_meal'; plannedMealId: string; dishId: string }
  | { kind: 'restock_due' };

export interface Suggestion {
  itemId: string;
  name: string;
  staple: boolean;
  reasons: SuggestReason[];
  dishIds: string[];        // for "For Chole and Poha"
  due?: { dueOn: string; lastBought: string; guessed: boolean };
  onList: boolean;          // already on the list: ticking only adds the reason
}

export interface SuggestInput {
  items: readonly { id: string; name: string; restock_mode: string; archived_at: string | null }[];
  planned: readonly { id: string; dish_id: string | null }[];     // meals in the coming week
  ingredientsOfDish: ReadonlyMap<string, readonly string[]>;        // dish id -> item ids
  due: readonly { itemId: string; dueOn: string; lastBought: string; guessed: boolean }[];
  /** open list rows: item id -> reasons already recorded */
  listed: ReadonlyMap<string, readonly { reason: string; planned_meal_id: string | null }[]>;
}

/**
 * One list of things to consider buying this week. Fresh (as-needed) ingredients of
 * planned meals always count; a staple only when it's also due (you probably have
 * cumin). Reasons already on the list aren't repeated, so a second review adds nothing.
 */
export function buildSuggestions(inp: SuggestInput): Suggestion[] {
  const items = new Map(inp.items.filter((i) => !i.archived_at).map((i) => [i.id, i]));
  const dueBy = new Map(inp.due.map((d) => [d.itemId, d]));
  const out = new Map<string, Suggestion>();
  const get = (itemId: string) => {
    const it = items.get(itemId)!;
    if (!out.has(itemId)) out.set(itemId, { itemId, name: it.name, staple: it.restock_mode === 'staple', reasons: [], dishIds: [], onList: inp.listed.has(itemId) });
    return out.get(itemId)!;
  };
  const has = (itemId: string, reason: string, pm: string | null = null) =>
    (inp.listed.get(itemId) ?? []).some((r) => r.reason === reason && (pm === null || r.planned_meal_id === pm));

  for (const pm of inp.planned) {
    if (!pm.dish_id) continue;
    for (const itemId of new Set(inp.ingredientsOfDish.get(pm.dish_id) ?? [])) {
      const it = items.get(itemId);
      if (!it) continue;
      if (it.restock_mode === 'staple' && !dueBy.has(itemId)) continue;
      if (has(itemId, 'planned_meal', pm.id)) continue;
      const s = get(itemId);
      s.reasons.push({ kind: 'planned_meal', plannedMealId: pm.id, dishId: pm.dish_id });
      if (!s.dishIds.includes(pm.dish_id)) s.dishIds.push(pm.dish_id);
    }
  }
  for (const d of inp.due) {
    if (!items.has(d.itemId) || has(d.itemId, 'restock_due')) continue;
    const s = get(d.itemId);
    s.reasons.push({ kind: 'restock_due' });
    s.due = { dueOn: d.dueOn, lastBought: d.lastBought, guessed: d.guessed };
  }
  return [...out.values()].sort((a, b) => Number(!!a.due && !a.dishIds.length) - Number(!!b.due && !b.dishIds.length) || a.name.localeCompare(b.name));
}

/**
 * Which store a list row belongs to: the one chosen on the row, else the item's
 * preferred store, else its only store, else none ("Any store").
 */
export function storeFor(entry: { item_id: string; store_id: string | null }, itemStores: readonly { item_id: string; store_id: string; preferred: boolean }[]): string | null {
  if (entry.store_id) return entry.store_id;
  const mine = itemStores.filter((s) => s.item_id === entry.item_id);
  return mine.find((s) => s.preferred)?.store_id ?? (mine.length === 1 ? mine[0]!.store_id : null);
}

/** "Extra", "Just a bit", "Extra, 2 kg", or the amount on its own. Empty for usual. */
export function amountText(e: { amount_hint: string; amount: string | null }): string {
  const hint = e.amount_hint === 'extra' ? 'Extra' : e.amount_hint === 'a_bit' ? 'Just a bit' : '';
  const amt = e.amount?.trim() ?? '';
  return [hint, amt].filter(Boolean).join(', ');
}
