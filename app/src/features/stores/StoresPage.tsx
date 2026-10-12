import { useState, type FormEvent } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { addStore, deleteStore, renameStore } from '../../commands/stores';
import { explain } from '../../lib/supabase';
import type { Store } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

/** The places the family shops. Items can say which store they come from. */
export function StoresPage({ data, reload }: { data: FamilyData; reload: () => Promise<void> }) {
  const [editingStore, setEditingStore] = useState<Store | 'new' | null>(null);
  return (
    <div className="stack">
      <section className="stack" aria-labelledby="stores-h">
        <div className="row"><h1 id="stores-h" className="grow">Stores</h1>
          <button className="btn quiet" onClick={() => setEditingStore('new')}><Icon name="plus" />Add store</button>
        </div>
        {data.stores.length === 0 ? (
          <p className="soft small">Add the places you shop (Costco, Indian store…). Items can then say where you buy them.</p>
        ) : (
          <ul className="list panel">
            {data.stores.map((s) => {
              const count = data.itemStores.filter((x) => x.store_id === s.id).length;
              return (
                <li key={s.id}>
                  <button className="list-row" onClick={() => setEditingStore(s)}>
                    <Icon name="store" />
                    <span className="grow">{s.name}</span>
                    <span className="meta">{count} {count === 1 ? 'item' : 'items'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editingStore && (
        <StoreSheet store={editingStore === 'new' ? null : editingStore} familyId={data.family.id}
          nextSort={data.stores.length} onClose={() => setEditingStore(null)} onSaved={reload} />
      )}
    </div>
  );
}

function StoreSheet({ store, familyId, nextSort, onClose, onSaved }: {
  store: Store | null; familyId: string; nextSort: number; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(store?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Enter the store’s name.'); return; }
    try {
      if (store) await renameStore(store.id, name); else await addStore(familyId, name, nextSort);
      await onSaved(); toast(store ? 'Store renamed' : `Added ${name.trim()}`); onClose();
    } catch (err) { setError(explain(err as Error)); }
  }

  async function remove() {
    if (!store || !window.confirm(`Delete ${store.name}? Items stay; they just won’t list this store.`)) return;
    try { await deleteStore(store.id); await onSaved(); toast(`Deleted ${store.name}`); onClose(); }
    catch (err) { setError(explain(err as Error)); }
  }

  return (
    <Sheet title={store ? 'Edit store' : 'Add store'} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <label className="field"><span>Name</span>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} autoFocus maxLength={60} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide">{store ? 'Save' : 'Add store'}</button>
        {store && <button type="button" className="btn danger wide" onClick={remove}>Delete store</button>}
      </form>
    </Sheet>
  );
}
