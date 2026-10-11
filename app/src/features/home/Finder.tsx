import { useEffect, useRef, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { addFromCatalog, searchCatalog } from '../../commands/catalog';
import { explain } from '../../lib/supabase';
import type { CatalogItem, Item } from '../../lib/types';
import { norm, rankByName } from '../../logic/text';
import { pathTo, rootOf } from '../../logic/tree';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';

/**
 * The "Add or find" bar. Typing shows, in order: things already in your home,
 * products from the catalogue (one tap files them in the right category), and
 * an option to add exactly what you typed.
 */
export function Finder({ data, onOpenItem, onNewItem, onSearchingChange, reload }: {
  data: FamilyData;
  onOpenItem: (i: Item) => void;
  onNewItem: (name: string) => void;
  onSearchingChange: (searching: boolean) => void;
  reload: () => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const query = q.trim();

  useEffect(() => { onSearchingChange(query.length > 0); }, [query, onSearchingChange]);

  useEffect(() => {
    if (query.length < 2) { setCatalog([]); return; }
    let live = true;
    const t = window.setTimeout(async () => {
      try { const rows = await searchCatalog(query, 12); if (live) { setCatalog(rows); setError(null); } }
      catch (e) { if (live) setError(explain(e as Error)); }
    }, 180);
    return () => { live = false; window.clearTimeout(t); };
  }, [query]);

  const mine = query ? rankByName(data.items, query, (i) => i.name).slice(0, 8) : [];
  const owned = new Set(data.items.map((i) => norm(i.name)));
  const fromCatalog = catalog.filter((c) => !owned.has(norm(c.name))).slice(0, 8);
  const exact = owned.has(norm(query)) || catalog.some((c) => norm(c.name) === norm(query) && owned.has(norm(c.name)));
  const root = rootOf(data.categories);

  async function add(c: CatalogItem) {
    if (!root) return;
    setBusyId(c.id);
    try {
      const item = await addFromCatalog({ familyId: data.family.id, homeId: root.id, categories: [...data.categories] }, c);
      await reload();
      toast(`Added ${item.name}${c.category_path.length ? ` to ${c.category_path.join(' › ')}` : ''}`);
      setQ('');
      input.current?.focus();
    } catch (e) {
      toast(explain(e as Error));
    } finally {
      setBusyId(null);
    }
  }

  const catPath = (c: CatalogItem) => c.category_path.join(' › ');

  return (
    <div className="finder">
      <div className="finder-box">
        <Icon name="search" />
        <label className="sr-only" htmlFor="finder">Add or find an item</label>
        <input id="finder" ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add or find…"
          autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQ('');
            if (e.key === 'Enter' && query) {
              const first = mine[0];
              if (first && norm(first.name) === norm(query)) onOpenItem(first);
              else if (fromCatalog[0]) void add(fromCatalog[0]);
              else onNewItem(query);
            }
          }} />
        {q && <button className="icon-btn" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="Clear"><Icon name="close" /></button>}
      </div>

      {query && (
        <div className="results" aria-live="polite">
          {mine.length > 0 && (
            <>
              <h3>In your home</h3>
              <ul className="list">
                {mine.map((i) => (
                  <li key={i.id}>
                    <button className="list-row" onClick={() => { onOpenItem(i); }}>
                      <span className="grow">{i.name}
                        <span className="meta" style={{ display: 'block' }}>
                          {pathTo(data.categories, i.category_id).slice(1).map((c) => c.name).join(' › ') || 'Not in a category'}
                        </span>
                      </span>
                      {i.restock_mode === 'staple' && <span className="staple">Staple</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {fromCatalog.length > 0 && (
            <>
              <h3>Tap to add to your home</h3>
              <ul className="list">
                {fromCatalog.map((c) => (
                  <li key={c.id}>
                    <button className="list-row" onClick={() => void add(c)} disabled={busyId !== null} aria-label={`Add ${c.name}`}>
                      <Icon name="plus" />
                      <span className="grow">{c.name}
                        <span className="meta" style={{ display: 'block' }}>{catPath(c)}{c.aliases.length ? `, also called ${c.aliases.slice(0, 2).join(', ')}` : ''}</span>
                      </span>
                      {c.restock_mode === 'staple' && <span className="staple">Staple</span>}
                      {busyId === c.id && <span className="meta">Adding…</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!exact && (
            <ul className="list" style={{ borderTop: mine.length || fromCatalog.length ? '1px solid var(--line)' : undefined }}>
              <li>
                <button className="list-row" onClick={() => onNewItem(query)}>
                  <Icon name="plus" />
                  <span className="grow">Add “{query}” as a new item</span>
                </button>
              </li>
            </ul>
          )}
          {error && <p className="error" style={{ padding: 'var(--s3) var(--s4)' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
