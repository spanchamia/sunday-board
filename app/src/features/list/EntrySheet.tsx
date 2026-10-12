import { useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { haveIt, removeFromList, updateEntry } from '../../commands/shopping';
import { explain } from '../../lib/supabase';
import type { ListEntry } from '../../lib/types';
import { storeFor } from '../../logic/shopping';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

const HINTS = [
  { v: 'usual', label: 'Usual' },
  { v: 'extra', label: 'Extra' },
  { v: 'a_bit', label: 'Just a bit' },
] as const;

/** One row of the list: how much (optional), which store, Have it, or remove. */
export function EntrySheet({ family, entry, reason, onClose, onChanged }: {
  family: FamilyData; entry: ListEntry; reason: string; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const item = family.items.find((i) => i.id === entry.item_id);
  const name = item?.name ?? 'Item';
  const [hint, setHint] = useState(entry.amount_hint as 'usual' | 'extra' | 'a_bit');
  const [amount, setAmount] = useState(entry.amount ?? '');
  const usualStore = storeFor({ item_id: entry.item_id, store_id: null }, family.itemStores);
  const [store, setStore] = useState(entry.store_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>, msg?: string) {
    setBusy(true); setError(null);
    try { await fn(); if (msg) toast(msg); onChanged(); onClose(); }
    catch (e) { setError(explain(e as Error)); setBusy(false); }
  }
  const save = () => run(() => updateEntry(entry.id, { amount_hint: hint, amount, store_id: store || null }));

  return (
    <Sheet title={name} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {reason && <p className="soft small">{reason}</p>}
        <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--s1)', padding: 0 }}>How much</legend>
          <div className="segmented">
            {HINTS.map((h) => (
              <button key={h.v} type="button" aria-pressed={hint === h.v} onClick={() => setHint(h.v)}>{h.label}</button>
            ))}
          </div>
        </fieldset>
        <label className="field"><span>Amount (optional)</span>
          <input className="input" value={amount} maxLength={40} onChange={(e) => setAmount(e.target.value)}
            placeholder={item?.usual_amount ? `Usually ${item.usual_amount}` : 'e.g. 2 kg, 1 big bag'} />
        </label>
        <label className="field"><span>Store</span>
          <select className="input" value={store} onChange={(e) => setStore(e.target.value)}>
            <option value="">{usualStore ? `Usual store (${family.stores.find((s) => s.id === usualStore)?.name ?? '?'})` : 'Any store'}</option>
            {family.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" type="submit" disabled={busy}>Save</button>
        <div className="row">
          <button type="button" className="btn grow" disabled={busy}
            onClick={() => void run(() => haveIt(family.family.id, [entry.item_id], [entry.id]), `${name}: have it`)}>Have it</button>
          <button type="button" className="btn quiet grow" disabled={busy}
            onClick={() => void run(() => removeFromList(entry.id), `Removed ${name}`)}>Remove from list</button>
        </div>
        <p className="soft small">“Have it” takes it off the list and tells the app you still have some, so it won’t suggest it again too soon.</p>
      </form>
    </Sheet>
  );
}
