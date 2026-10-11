import { useMemo, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { href } from '../../app/router';
import type { Category, Item } from '../../lib/types';
import { childrenOf, descendantIds, pathTo, rootOf } from '../../logic/tree';
import { Icon } from '../../ui/Icon';
import { CategorySheet } from './CategorySheet';
import { Finder } from './Finder';
import { ItemSheet } from './ItemSheet';
import { StarterPacks } from './StarterPacks';

export function HomePage({ data, reload, categoryId }: { data: FamilyData; reload: () => Promise<void>; categoryId: string | null }) {
  const root = rootOf(data.categories);
  const current = data.categories.find((c) => c.id === categoryId) ?? root;
  const [openItem, setOpenItem] = useState<Item | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [categorySheet, setCategorySheet] = useState<'new' | 'edit' | null>(null);
  const [showPacks, setShowPacks] = useState(false);
  const [searching, setSearching] = useState(false);

  // How many items sit in each category, counting everything beneath it.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data.categories) {
      const ids = descendantIds(data.categories, c.id);
      m.set(c.id, data.items.filter((i) => i.category_id && ids.has(i.category_id)).length);
    }
    return m;
  }, [data.categories, data.items]);

  if (!root || !current) return <p className="error">Your My Home category is missing. Reload the app.</p>;

  const path = pathTo(data.categories, current.id);
  const subs = childrenOf(data.categories, current.id);
  const here = data.items.filter((i) => i.category_id === current.id);
  const unfiled = current.id === root.id
    ? data.items.filter((i) => !i.category_id || !data.categories.some((c) => c.id === i.category_id))
    : [];
  const isEmptyHome = data.items.length === 0;

  return (
    <>
      <Finder data={data} onOpenItem={setOpenItem} onNewItem={setNewName}
        onSearchingChange={setSearching} reload={reload} />

      {!searching && (
        <div className="stack" style={{ marginTop: 'var(--s4)' }}>
          {path.length > 1 && (
            <nav className="crumbs" aria-label="Where you are">
              {path.slice(0, -1).map((c) => (
                <span key={c.id} className="row" style={{ gap: 2 }}>
                  <a href={href('home', c.id === root.id ? null : c.id)}>{c.name}</a><span className="sep" aria-hidden>›</span>
                </span>
              ))}
            </nav>
          )}
          <div className="row">
            <h1 className="grow">{current.name}</h1>
            {current.id !== root.id && (
              <button className="icon-btn" onClick={() => setCategorySheet('edit')} aria-label={`Edit ${current.name}`}><Icon name="more" /></button>
            )}
          </div>

          {isEmptyHome && current.id === root.id && (
            <div className="notice stack">
              <p><strong>Fill your home in a few taps.</strong> Pick starter sets like “Indian kitchen basics”, then untick anything you don’t buy.</p>
              <button className="btn primary" onClick={() => setShowPacks(true)}>Choose starter sets</button>
            </div>
          )}

          <ul className="chips" aria-label="Categories" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {subs.map((c) => (
              <li key={c.id}>
                <a className="chip" href={href('home', c.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {c.name}<span className="count">{counts.get(c.id) ?? 0}</span>
                </a>
              </li>
            ))}
            <li><button className="chip add" onClick={() => setCategorySheet('new')}><Icon name="plus" />Category</button></li>
          </ul>

          <ItemList items={here} onOpen={setOpenItem} emptyText={subs.length ? null : `Nothing in ${current.name} yet. Use the bar above to add things.`} />

          {unfiled.length > 0 && (
            <section className="stack" aria-labelledby="unfiled-h">
              <h2 id="unfiled-h">Not in a category yet</h2>
              <ItemList items={unfiled} onOpen={setOpenItem} emptyText={null} />
            </section>
          )}

          {!isEmptyHome && current.id === root.id && (
            <button className="btn quiet" onClick={() => setShowPacks(true)}>Add from starter sets</button>
          )}
        </div>
      )}

      {openItem && <ItemSheet data={data} item={openItem} onClose={() => setOpenItem(null)} reload={reload} />}
      {newName !== null && (
        <ItemSheet data={data} item={null} initialName={newName} initialCategoryId={current.id}
          onClose={() => setNewName(null)} reload={reload} />
      )}
      {categorySheet && (
        <CategorySheet data={data} category={categorySheet === 'edit' ? current : null} parent={categorySheet === 'new' ? current : null}
          onClose={() => setCategorySheet(null)} reload={reload} />
      )}
      {showPacks && <StarterPacks data={data} onClose={() => setShowPacks(false)} reload={reload} />}
    </>
  );
}

export function ItemList({ items, onOpen, emptyText }: { items: Item[]; onOpen: (i: Item) => void; emptyText: string | null }) {
  if (!items.length) return emptyText ? <p className="soft empty">{emptyText}</p> : null;
  return (
    <ul className="list panel">
      {items.map((i) => (
        <li key={i.id}>
          <button className="list-row" onClick={() => onOpen(i)}>
            <span className="grow">
              {i.name}
              {i.usual_amount && <span className="meta" style={{ display: 'block' }}>Usually {i.usual_amount}</span>}
            </span>
            {i.restock_mode === 'staple' && <span className="staple">Staple</span>}
            <Icon name="chev" className="chev" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export type { Category };
