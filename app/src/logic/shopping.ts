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
