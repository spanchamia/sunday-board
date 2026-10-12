import { useEffect, useMemo, useRef, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { useList } from '../../app/useList';
import { addItem } from '../../commands/items';
import { addToList, checkout, haveIt, setInBag } from '../../commands/shopping';
import { explain } from '../../lib/supabase';
import type { Item, ListEntry } from '../../lib/types';
import { today } from '../../logic/dates';
import { dueStaples } from '../../logic/restock';
import { amountText, buildSuggestions, reasonText, storeFor } from '../../logic/shopping';
import { norm, rankByName } from '../../logic/text';
import { pathTo } from '../../logic/tree';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { EntrySheet } from './EntrySheet';
import { WeekShopSheet } from './WeekShopSheet';

type View = 'aisle' | 'store';
const VIEW_KEY = 'sb-list-view';
const readView = (): View => { try { return localStorage.getItem(VIEW_KEY) === 'store' ? 'store' : 'aisle'; } catch { return 'aisle'; } };

/**
 * The shopping list: one row per item, with why it's there. At home, prune it with
 * "Have it"; tap a row for amount and store. In the shop, tick things into the bag,
 * then "Done shopping" records every purchase at once (that teaches restock timing).
 */
export function ListPage({ family, reloadFamily }: { family: FamilyData; reloadFamily: () => Promise<void> }) {
  const toast = useToast();
  const { data, error, reload } = useList(family.family.id);
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>(readView);
  const [open, setOpen] = useState<ListEntry | null>(null);
  const [review, setReview] = useState(false);
  const [bagLocal, setBagLocal] = useState<Map<string, boolean>>(new Map());
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => new Map(family.items.map((i) => [i.id, i])), [family.items]);

  useEffect(() => { setBagLocal(new Map()); }, [data]);
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch { /* private mode */ } }, [view]);

  const inBag = (e: ListEntry) => bagLocal.get(e.id) ?? e.status === 'in_bag';
  const entries = data?.entries ?? [];
  const toBuy = entries.filter((e) => !inBag(e));
  const bag = entries.filter(inBag);

  const why = (e: ListEntry) => {
    if (!data) return '';
    const rs = data.reasons.filter((r) => r.entry_id === e.id).map((r) => ({
      reason: r.reason,
      dishName: r.dish_id ? data.dishName.get(r.dish_id) : r.planned_meal_id ? data.dishName.get(data.plannedDish.get(r.planned_meal_id) ?? '') : null,
    }));
    return reasonText(rs);
  };

  const suggestions = useMemo(() => {
    if (!data) return [];
    const listed = new Map<string, { reason: string; planned_meal_id: string | null }[]>();
    for (const e of data.entries) listed.set(e.item_id, data.reasons.filter((r) => r.entry_id === e.id));
    const live = family.items.filter((i) => !i.archived_at).map((i) => ({ ...i, restock_mode: i.mode }));
    return buildSuggestions({
      items: live, planned: data.week, ingredientsOfDish: data.ingredientsOfDish, listed,
      due: dueStaples(live, data.events, today()),
    });
  }, [data, family.items]);

  const storeName = (id: string | null) => (id ? family.stores.find((s) => s.id === id)?.name : null) ?? 'Any store';
  const catPath = (e: ListEntry) => pathTo(family.categories, items.get(e.item_id)?.category_id ?? null).slice(1).map((c) => c.name);
  const byName = (a: ListEntry, b: ListEntry) => (items.get(a.item_id)?.name ?? '').localeCompare(items.get(b.item_id)?.name ?? '');

  const groups = useMemo(() => {
    const m = new Map<string, { key: string; label: string; rows: ListEntry[] }>();
    for (const e of toBuy) {
      let key: string; let label: string;
      if (view === 'store') {
        const sid = storeFor(e, family.itemStores);
        const sort = sid ? family.stores.findIndex((s) => s.id === sid) : 9999;
        key = `${String(sort).padStart(4, '0')}`; label = storeName(sid);
      } else {
        const path = catPath(e);
        key = path.join('/') || 'zz-other'; label = path.at(-1) ?? 'Other';
      }
      if (!m.has(key)) m.set(key, { key, label, rows: [] });
      m.get(key)!.rows.push(e);
    }
    for (const g of m.values()) {
      g.rows.sort(view === 'store' ? (a, b) => catPath(a).join('/').localeCompare(catPath(b).join('/')) || byName(a, b) : byName);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [data, bagLocal, view, family]);

  const listed = new Set(entries.map((e) => e.item_id));
  const query = q.trim();
  const matches = query ? rankByName(family.items.filter((i) => !i.archived_at), query, (i) => i.name).slice(0, 6) : [];
  const exact = family.items.some((i) => !i.archived_at && norm(i.name) === norm(query));

  async function add(item: Item) {
    try {
      const r = await addToList(family.family.id, item.id, { kind: 'manual' });
      await reload(); setQ(''); input.current?.focus();
      toast(r === 'added' ? `Added ${item.name}` : `${item.name} is already on the list`);
    } catch (e) { toast(explain(e as Error)); }
  }
  async function addNew() {
    try {
      const item = await addItem({ familyId: family.family.id, name: query, categoryId: null, restockMode: null });
      await reloadFamily();
      await add(item);
    } catch (e) { toast(explain(e as Error)); }
  }
  async function toggleBag(e: ListEntry) {
    const next = !inBag(e);
    setBagLocal((m) => new Map(m).set(e.id, next));
    try { await setInBag(e.id, next); await reload(); }
    catch (err) { setBagLocal((m) => { const n = new Map(m); n.delete(e.id); return n; }); toast(explain(err as Error)); }
  }
  async function quickHave(e: ListEntry) {
    try { await haveIt(family.family.id, [e.item_id], [e.id]); await reload(); toast(`${items.get(e.item_id)?.name ?? 'Item'}: have it`); }
    catch (err) { toast(explain(err as Error)); }
  }
  async function done() {
    setBusy(true);
    try {
      await checkout(family.family.id, bag.map((entry) => ({ entry, storeId: storeFor(entry, family.itemStores) })));
      toast(`Recorded ${bag.length} bought. Nice shop!`);
      await Promise.all([reload(), reloadFamily()]);
    } catch (err) { toast(explain(err as Error)); }
    setBusy(false);
  }

  const rowView = (e: ListEntry, bagged: boolean) => {
    const it = items.get(e.item_id);
    const name = it?.name ?? 'An item you removed';
    const meta = [amountText(e), why(e)].filter(Boolean).join('. ');
    return (
      <div key={e.id} className={`check-row task-row${bagged ? ' in-bag' : ''}`}>
        <input type="checkbox" checked={bagged} onChange={() => void toggleBag(e)}
          aria-label={bagged ? `Take ${name} out of the bag` : `Put ${name} in the bag`} />
        <button className="row-main grow" onClick={() => setOpen(e)} aria-label={`${name}: amount, store, have it`}>
          <span className="name">{name}</span>
          {meta && <span className="meta" style={{ display: 'block' }}>{meta}</span>}
        </button>
        {!bagged && <button className="btn quiet small-btn" onClick={() => void quickHave(e)} aria-label={`Have ${name}`}>Have it</button>}
      </div>
    );
  };

  return (
    <div className="stack list-page">
      <div className="row"><h1 className="grow">Shopping list</h1>{data && <span className="soft">{toBuy.length} to buy</span>}</div>

      {data && suggestions.length > 0 && (
        <div className="notice row">
          <span className="grow"><strong>This week’s shop:</strong> {suggestions.length} {suggestions.length === 1 ? 'thing' : 'things'} to check from planned meals and staples running low.</span>
          <button className="btn primary" onClick={() => setReview(true)}>Review</button>
        </div>
      )}

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

      {entries.length > 0 && (
        <div className="segmented" role="group" aria-label="Group the list">
          <button aria-pressed={view === 'aisle'} onClick={() => setView('aisle')}>By aisle</button>
          <button aria-pressed={view === 'store'} onClick={() => setView('store')}>By store</button>
        </div>
      )}

      {error && <p className="error">Couldn’t load the list: {error}</p>}
      {!data ? (!error && <p className="soft">Loading…</p>) : entries.length === 0 ? (
        <p className="soft empty">The list is empty. Add things above, review this week’s shop, or add a dish’s needs from Plan → Dishes.</p>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.key} className="stack" aria-label={g.label}>
              <h2 className="small soft" style={{ marginBottom: -8 }}>{g.label}</h2>
              <div className="panel">{g.rows.map((e) => rowView(e, false))}</div>
            </section>
          ))}
          {toBuy.length === 0 && <p className="soft empty">Everything’s in the bag.</p>}
          {bag.length > 0 && (
            <section className="stack" aria-label="In the bag">
              <h2 className="small soft" style={{ marginBottom: -8 }}>In the bag ({bag.length})</h2>
              <div className="panel">{[...bag].sort(byName).map((e) => rowView(e, true))}</div>
            </section>
          )}
        </>
      )}

      {bag.length > 0 && (
        <div className="done-bar">
          <button className="btn primary wide" disabled={busy} onClick={() => void done()}>
            {busy ? 'Saving…' : `Done shopping: ${bag.length} bought`}
          </button>
        </div>
      )}

      {open && <EntrySheet family={family} entry={open} reason={why(open)} onClose={() => setOpen(null)} onChanged={() => void reload()} />}
      {review && data && (
        <WeekShopSheet family={family} suggestions={suggestions} dishName={data.dishName}
          onClose={() => setReview(false)} onDone={() => void reload()} />
      )}
    </div>
  );
}
