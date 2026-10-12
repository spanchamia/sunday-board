import { useState, type FormEvent } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { addItem, archiveItem, setItemStores, updateItem } from '../../commands/items';
import { explain } from '../../lib/supabase';
import type { Item, RestockMode } from '../../lib/types';
import { inheritedRestockMode } from '../../logic/tree';
import { everyLabel } from '../../logic/restock';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { CategorySelect } from './CategorySelect';

/** Add a new item (item = null) or edit an existing one. */
export function ItemSheet({ data, item, initialName = '', initialCategoryId = null, onClose, reload }: {
  data: FamilyData;
  item: Item | null;
  initialName?: string;
  initialCategoryId?: string | null;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const toast = useToast();
  const startCategory = item ? item.category_id : initialCategoryId;
  const [name, setName] = useState(item?.name ?? initialName);
  const [categoryId, setCategoryId] = useState<string | null>(startCategory);
  const [mode, setMode] = useState<RestockMode>(
    (item?.restock_mode as RestockMode | undefined) ?? inheritedRestockMode(data.categories, startCategory) ?? 'as_needed');
  const [weeks, setWeeks] = useState(item?.restock_every_days ? String(Math.round(item.restock_every_days / 7)) : '');
  const [usual, setUsual] = useState(item?.usual_amount ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [storeIds, setStoreIds] = useState<string[]>(
    item ? data.itemStores.filter((s) => s.item_id === item.id).map((s) => s.store_id) : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Enter a name.'); return; }
    const w = weeks.trim() ? Number(weeks) : null;
    if (w !== null && (!Number.isFinite(w) || w < 1 || w > 104)) { setError('Weeks must be a number from 1 to 104, or blank.'); return; }
    setBusy(true); setError(null);
    try {
      const restockEveryDays = mode === 'staple' && w ? Math.round(w * 7) : null;
      let id = item?.id;
      if (item) {
        await updateItem(item.id, {
          name, category_id: categoryId, restock_mode: mode, restock_every_days: restockEveryDays,
          usual_amount: usual.trim() || null, notes: notes.trim(),
        });
      } else {
        const created = await addItem({ familyId: data.family.id, name, categoryId, restockMode: mode, restockEveryDays, usualAmount: usual });
        id = created.id;
        if (notes.trim()) await updateItem(created.id, { notes: notes.trim() });
      }
      await setItemStores(data.family.id, id!, storeIds);
      await reload();
      toast(item ? 'Saved' : `Added ${name.trim()}`);
      onClose();
    } catch (err) {
      setError(explain(err as Error));
      setBusy(false);
    }
  }

  async function remove() {
    if (!item || !window.confirm(`Remove ${item.name} from My Home? Its purchase history is kept.`)) return;
    try { await archiveItem(item.id); await reload(); toast(`Removed ${item.name}`); onClose(); }
    catch (err) { setError(explain(err as Error)); }
  }

  const toggleStore = (id: string) => setStoreIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Sheet title={item ? item.name : 'New item'} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <label className="field"><span>Name</span>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} maxLength={80} autoFocus={!item} />
        </label>

        <CategorySelect categories={data.categories} value={categoryId} onChange={(id) => {
          setCategoryId(id);
          if (!item) setMode(inheritedRestockMode(data.categories, id) ?? mode);
        }} />

        <div className="field">
          <span id="mode-label">How you buy it</span>
          <div className="segmented" role="group" aria-labelledby="mode-label">
            <button type="button" aria-pressed={mode === 'staple'} onClick={() => setMode('staple')}>Staple</button>
            <button type="button" aria-pressed={mode === 'as_needed'} onClick={() => setMode('as_needed')}>As needed</button>
          </div>
          <span className="hint">
            {mode === 'staple'
              ? 'Restocked on a rhythm, like spices, rice or detergent. It comes back on the list when it’s due.'
              : 'Bought for a reason, like vegetables for a planned dish. Added when a meal or you need it.'}
          </span>
        </div>

        {mode === 'staple' && (
          <label className="field"><span>Buy about every … weeks</span>
            <input className="input" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value.replace(/[^\d]/g, ''))} placeholder="Leave blank to let the app learn" />
            <span className="hint">{item?.learned_every_days
              ? `Optional. From what you’ve bought: ${everyLabel(item.learned_every_days).toLowerCase()}. Leave blank to use that.`
              : 'Optional. Leave blank and the app learns it from what you buy.'}</span>
          </label>
        )}

        <label className="field"><span>Usual amount</span>
          <input className="input" value={usual} onChange={(e) => setUsual(e.target.value)} placeholder="Optional, e.g. 6 or 2 bags" maxLength={40} />
        </label>

        {data.stores.length > 0 && (
          <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Where you buy it</legend>
            <div className="panel">
              {data.stores.map((s) => (
                <label key={s.id} className="check-row">
                  <input type="checkbox" checked={storeIds.includes(s.id)} onChange={() => toggleStore(s.id)} />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="field"><span>Notes</span>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Optional, e.g. the green bag brand" />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Saving…' : item ? 'Save' : 'Add item'}</button>
        {item && <button type="button" className="btn danger wide" onClick={remove}>Remove from My Home</button>}
      </form>
    </Sheet>
  );
}
