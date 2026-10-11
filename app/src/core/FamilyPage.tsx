import { useState, type FormEvent } from 'react';
import type { FamilyData } from '../app/useFamily';
import { newInviteCode } from '../commands/family';
import { addStore, deleteStore, renameStore } from '../commands/stores';
import { explain, supabase } from '../lib/supabase';
import type { Store } from '../lib/types';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { ThemeSwitch } from '../ui/ThemeSwitch';

export function FamilyPage({ data, reload }: { data: FamilyData; reload: () => Promise<void> }) {
  const toast = useToast();
  const [code, setCode] = useState(data.family.invite_code);
  const [editingStore, setEditingStore] = useState<Store | 'new' | null>(null);
  const isOwner = data.me.role === 'owner';

  async function share() {
    const text = `Join our family on Sunday Board: open ${window.location.origin}, sign in, choose “Join with a code” and enter ${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Join our family', text }); } catch { /* closed the share sheet */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast('Invite copied');
    }
  }

  async function freshCode() {
    try { setCode(await newInviteCode()); toast('New invite code made. The old one no longer works.'); }
    catch (e) { toast(explain(e as Error)); }
  }

  return (
    <div className="stack">
      <h1>{data.family.name}</h1>

      <section className="stack" aria-labelledby="members-h">
        <h2 id="members-h">Members</h2>
        <ul className="list panel">
          {data.members.map((m) => (
            <li key={m.user_id} className="list-row">
              <span className="grow">{m.display_name || 'Someone'}{m.user_id === data.me.user_id ? ' (you)' : ''}</span>
              {m.role === 'owner' && <span className="meta">Started the family</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" aria-labelledby="invite-h">
        <h2 id="invite-h">Invite someone</h2>
        <p className="soft small">They sign in with their own email, choose “Join with a code”, and enter:</p>
        <p className="code-input" style={{ fontWeight: 700 }} aria-label={`Invite code ${code.split('').join(' ')}`}>{code}</p>
        <div className="row">
          <button className="btn primary grow" onClick={share}><Icon name="share" />Share invite</button>
          {isOwner && <button className="btn" onClick={freshCode}>New code</button>}
        </div>
      </section>

      <section className="stack" aria-labelledby="stores-h">
        <div className="row"><h2 id="stores-h" className="grow">Stores</h2>
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

      <section className="stack" aria-labelledby="device-h">
        <h2 id="device-h">This device</h2>
        <ThemeSwitch />
      </section>

      <button className="btn wide" onClick={() => void supabase.auth.signOut()}>Sign out</button>

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
