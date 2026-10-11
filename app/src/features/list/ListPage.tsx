import { useMemo, useRef, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { useList } from '../../app/useList';
import { addItem } from '../../commands/items';
import { addToList, markBought, removeFromList, undoBought } from '../../commands/shopping';
import { explain } from '../../lib/supabase';
import type { Item, ListEntry } from '../../lib/types';
import { reasonText } from '../../logic/shopping';
import { norm, rankByName } from '../../logic/text';
import { pathTo } from '../../logic/tree';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';

/**
 * The shopping list (basic version): one row per item with why it's there, grouped
 * by category. Tick = bought (recorded for restock learning). Step 3 adds Have it,
 * amounts, the split by store and restock suggestions.
 */
export function ListPage({ family, reloadFamily }: { family: FamilyData; reloadFamily: () => Promise<void> }) {
  const toast = useToast();
  const { data, error, reload } = useList(family.family.id);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [recent, setRecent] = useState<ListEntry | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const items = new Map(family.items.map((i) => [i.id, i]));

  const groups = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { label: string; rows: ListEntry[] }>();
    for (const e of data.entries) {
      const it = items.get(e.item_id);
      const path = pathTo(family.categories, it?.category_id ?? null).slice(1).map((c) => c.name);
      const label = path.at(-1) ?? 'Other';
      const key = path.join('/') || 'zz-other';
      if (!m.has(key)) m.set(key, { label, rows: [] });
      m.get(key)!.rows.push(e);
    }
    for (const g of m.values()) g.rows.sort((a, b) => (items.get(a.item_id)?.name ?? '').localeCompare(items.get(b.item_id)?.name ?? ''));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
  }, [data, family.categories, family.items]);

  const why = (e: ListEntry) => {
    if (!data) return '';
    const rs = data.reasons.filter((r) => r.entry_id === e.id).map((r) => ({
      reason: r.reason,
      dishName: r.dish_id ? data.dishName.get(r.dish_id) : r.planned_meal_id ? data.dishName.get(data.plannedDish.get(r.planned_meal_id) ?? '') : null,
    }));
    return reasonText(rs);
  };

  const listed = new Set(data?.entries.map((e) => e.item_id));
  const query = q.trim();
  const matches = query ? rankByName(family.items, query, (i) => i.name).slice(0, 6) : [];
  const exact = family.items.some((i) => norm(i.name) === norm(query));

  async function add(item: Item) {
    try {
      const r = await addToList(family.family.id, item.id, { kind: 'manual' });
      await reload(); setQ(''); input.current?.focus();
      toast(r === 'added' ? `Added ${item.name}` : `${item.name} is already on the list`);
    } catch (e) { toast(explain(e as Error)); }
  }
  async function addNew() {
    try {
      const item = await addItem({ familyId: family.family.id, name: query, categoryId: null, restockMode: 'as_needed' });
      await reloadFamily();
      await add(item);
    } catch (e) { toast(explain(e as Error)); }
  }
  async function bought(e: ListEntry) {
    setBusy(e.id);
    try { await markBought(family.family.id, e); setRecent(e); await reload(); }
    catch (err) { toast(explain(err as Error)); }
    setBusy(null);
  }
  async function undo() {
    if (!recent) return;
    try { await undoBought(recent); setRecent(null); await reload(); } catch (err) { toast(explain(err as Error)); }
  }
  async function remove(e: ListEntry) {
    try { await removeFromList(e.id); await reload(); toast(`Removed ${items.get(e.item_id)?.name ?? 'item'}`); }
    catch (err) { toast(explain(err as Error)); }
  }

  return (
    <div className="stack">
      <div className="row"><h1 className="grow">Shopping list</h1>{data && <span className="soft">{data.entries.length} to buy</span>}</div>
      <div className="finder-box" style={{ minHeight: 52 }}>
        <Icon name="plus" />
        <label className="sr-only" htmlFor="list-add">Add to the list</label>
        <input id="list-add" ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add to the list…" autoComplete="off"
          onKeyDown={(e) => { if (e.key === 'Enter' && query) { const m = matches[0]; if (m && norm(m.name) === norm(query)) void add(m); else if (!exact) void addNew(); } }} />
      </div>
      {query && (
        <ul className="list panel">
          {matches.map((i) => (
            <li key={i.id}><button className="list-row" onClick={() => void add(i)}>
              <span className="grow">{i.name}</span>{listed.has(i.id) && <span className="meta">On the list</span>}
            </button></li>
          ))}
          {!exact && <li><button className="list-row" onClick={() => void addNew()}><Icon name="plus" /><span className="grow">Add “{query}” as a new item</span></button></li>}
        </ul>
      )}
      {recent && (
        <div className="notice row">
          <span className="grow">Bought {items.get(recent.item_id)?.name}</span>
          <button className="btn quiet" onClick={() => void undo()}>Undo</button>
        </div>
      )}
      {error && <p className="error">Couldn’t load the list: {error}</p>}
      {!data ? (!error && <p className="soft">Loading…</p>) : data.entries.length === 0 ? (
        <p className="soft empty">The list is empty. Add things above, or from a dish in Plan → Dishes.</p>
      ) : groups.map((g) => (
        <section key={g.label} className="stack" aria-label={g.label}>
          <h2 className="small soft" style={{ marginBottom: -8 }}>{g.label}</h2>
          <div className="panel">
            {g.rows.map((e) => {
              const it = items.get(e.item_id);
              const reason = why(e);
              return (
                <div key={e.id} className="check-row task-row">
                  <input type="checkbox" disabled={busy === e.id} onChange={() => void bought(e)} aria-label={`Bought ${it?.name ?? 'item'}`} />
                  <span className="grow">{it?.name ?? 'An item you removed'}
                    {reason && <span className="meta" style={{ display: 'block' }}>{reason}</span>}</span>
                  <button className="icon-btn" onClick={() => void remove(e)} aria-label={`Remove ${it?.name ?? 'item'} from the list`}><Icon name="close" /></button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
