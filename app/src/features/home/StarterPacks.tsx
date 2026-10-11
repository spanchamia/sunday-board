import { useEffect, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { addManyFromCatalog, listStarterPacks, starterPackItems } from '../../commands/catalog';
import { explain } from '../../lib/supabase';
import type { CatalogItem, StarterPack } from '../../lib/types';
import { norm } from '../../logic/text';
import { rootOf } from '../../logic/tree';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

/** Pick a starter set, untick what you don't buy, add the rest in one go. */
export function StarterPacks({ data, onClose, reload }: { data: FamilyData; onClose: () => void; reload: () => Promise<void> }) {
  const toast = useToast();
  const [packs, setPacks] = useState<StarterPack[] | null>(null);
  const [pack, setPack] = useState<StarterPack | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owned = new Set(data.items.map((i) => norm(i.name)));

  useEffect(() => { listStarterPacks().then(setPacks, (e) => setError(explain(e))); }, []);

  async function open(p: StarterPack) {
    setPack(p); setItems([]); setError(null);
    try {
      const rows = (await starterPackItems(p.id)).sort((a, b) => a.category_path.join('/').localeCompare(b.category_path.join('/')) || a.name.localeCompare(b.name));
      setItems(rows);
      setChosen(new Set(rows.filter((r) => !owned.has(norm(r.name))).map((r) => r.id)));
    } catch (e) { setError(explain(e as Error)); }
  }

  async function addChosen() {
    const root = rootOf(data.categories);
    if (!root) return;
    setBusy(true); setError(null);
    try {
      const picked = items.filter((i) => chosen.has(i.id));
      const { added } = await addManyFromCatalog({ familyId: data.family.id, homeId: root.id, categories: [...data.categories] }, picked, data.items);
      await reload();
      toast(`Added ${added} ${added === 1 ? 'item' : 'items'}`);
      setPack(null);
    } catch (e) { setError(explain(e as Error)); }
    setBusy(false);
  }

  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Group the pack's products under their category, so the list scans like a shop.
  const groups = new Map<string, CatalogItem[]>();
  for (const i of items) { const k = i.category_path.join(' › '); groups.set(k, [...(groups.get(k) ?? []), i]); }

  return (
    <Sheet title={pack ? pack.name : 'Starter sets'} onClose={onClose}
      actions={pack ? <button className="btn quiet" onClick={() => setPack(null)}>All sets</button> : undefined}>
      {error && <p className="error" role="alert">{error}</p>}
      {!pack && (
        packs === null ? <p className="soft">Loading…</p> : (
          <ul className="list panel">
            {packs.map((p) => (
              <li key={p.id}>
                <button className="list-row" onClick={() => void open(p)}>
                  <span className="grow">{p.name}<span className="meta" style={{ display: 'block' }}>{p.description}</span></span>
                  <Icon name="chev" className="chev" />
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {pack && (
        <div className="stack">
          <p className="soft small">Untick anything your family doesn’t buy. Everything is filed into the right category for you.</p>
          {items.length === 0 && !error && <p className="soft">Loading…</p>}
          {[...groups.entries()].map(([group, rows]) => (
            <section key={group}>
              <h2 style={{ fontSize: 15, margin: '8px 0 4px' }} className="soft">{group}</h2>
              <div className="panel">
                {rows.map((r) => {
                  const have = owned.has(norm(r.name));
                  return (
                    <label key={r.id} className="check-row">
                      <input type="checkbox" checked={have || chosen.has(r.id)} disabled={have} onChange={() => toggle(r.id)} />
                      <span className="grow">{r.name}{have && <span className="meta"> (already in your home)</span>}</span>
                      {r.restock_mode === 'staple' && <span className="staple">Staple</span>}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
          {items.length > 0 && (
            <button className="btn primary wide" disabled={busy || chosen.size === 0} onClick={() => void addChosen()}
              style={{ position: 'sticky', bottom: 0 }}>
              {busy ? 'Adding…' : `Add ${chosen.size} ${chosen.size === 1 ? 'item' : 'items'}`}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
