import { norm } from './text';

/** The fields of a category the tree logic needs. */
export interface Node {
  id: string;
  parent_id: string | null;
  name: string;
  sort: number;
  default_restock_mode?: string | null;
}

const bySortThenName = (a: Node, b: Node) => a.sort - b.sort || a.name.localeCompare(b.name);

/** The family's top category ("My Home"): the first category without a parent. */
export function rootOf<T extends Node>(nodes: readonly T[]): T | undefined {
  return [...nodes].filter((n) => !n.parent_id).sort(bySortThenName)[0];
}

export function childrenOf<T extends Node>(nodes: readonly T[], parentId: string | null): T[] {
  return nodes.filter((n) => n.parent_id === parentId).sort(bySortThenName);
}

/** From the top down to (and including) the given category. Stops safely on bad data. */
export function pathTo<T extends Node>(nodes: readonly T[], id: string | null): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: T[] = [];
  const seen = new Set<string>();
  let cur = id ? byId.get(id) : undefined;
  while (cur && !seen.has(cur.id)) {
    path.unshift(cur);
    seen.add(cur.id);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

/** The category and everything under it. */
export function descendantIds(nodes: readonly Node[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) {
      if (n.parent_id && out.has(n.parent_id) && !out.has(n.id)) { out.add(n.id); grew = true; }
    }
  }
  return out;
}

/** Restock mode suggested by the nearest category (walking up) that sets one. */
export function inheritedRestockMode(nodes: readonly Node[], id: string | null): 'staple' | 'as_needed' | null {
  for (const n of pathTo(nodes, id).reverse()) {
    if (n.default_restock_mode === 'staple' || n.default_restock_mode === 'as_needed') return n.default_restock_mode;
  }
  return null;
}

/**
 * Walk a list of names down from `startId`, matching existing categories by name
 * (ignoring case). Returns the deepest existing match and the names still to create.
 *   planPath(nodes, home, ['Kitchen', 'Spices']) -> { at: Kitchen, missing: ['Spices'] }
 */
export function planPath<T extends Node>(nodes: readonly T[], startId: string, names: readonly string[]): { atId: string; missing: string[] } {
  let atId = startId;
  for (let i = 0; i < names.length; i++) {
    const want = norm(names[i] ?? '');
    const next = childrenOf(nodes, atId).find((c) => norm(c.name) === want);
    if (!next) return { atId, missing: names.slice(i) as string[] };
    atId = next.id;
  }
  return { atId, missing: [] };
}

/** Can `id` be moved under `newParentId` without creating a loop? */
export function canMoveUnder(nodes: readonly Node[], id: string, newParentId: string): boolean {
  return !descendantIds(nodes, id).has(newParentId);
}
