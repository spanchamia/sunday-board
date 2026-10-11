/** Lowercase, strip accents, collapse spaces: "  Jalapeño  Peppers" -> "jalapeno peppers". */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Tidy what a person typed into an item or category name. */
export function cleanName(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * How well a name matches a query (0 = no match). Exact beats prefix beats
 * word-start beats anywhere-in-the-name, so "on" ranks Onions above Lemons.
 */
export function matchScore(name: string, query: string, aliases: readonly string[] = []): number {
  const q = norm(query);
  if (!q) return 0;
  let best = 0;
  for (const [i, candidate] of [name, ...aliases].entries()) {
    const n = norm(candidate);
    const penalty = i === 0 ? 0 : 5; // a match on another name ranks just below the same match on the main name
    let s = 0;
    if (n === q) s = 100;
    else if (n.startsWith(q)) s = 80;
    else if (n.split(/[\s,/()-]+/).some((w) => w.startsWith(q))) s = 60;
    else if (n.includes(q)) s = 40;
    if (s) best = Math.max(best, s - penalty);
  }
  return best;
}

/** Items matching a query, best first; ties broken by shorter name, then alphabetically. */
export function rankByName<T>(rows: readonly T[], query: string, nameOf: (r: T) => string, aliasesOf?: (r: T) => readonly string[]): T[] {
  return rows
    .map((r) => ({ r, s: matchScore(nameOf(r), query, aliasesOf?.(r)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || nameOf(a.r).length - nameOf(b.r).length || nameOf(a.r).localeCompare(nameOf(b.r)))
    .map((x) => x.r);
}
