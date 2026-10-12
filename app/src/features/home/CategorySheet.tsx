import { useState, type FormEvent } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { href } from '../../app/router';
import { addCategory, deleteCategory, moveCategory, updateCategory } from '../../commands/categories';
import { followCategory } from '../../commands/items';
import { explain } from '../../lib/supabase';
import type { Category, RestockMode } from '../../lib/types';
import { descendantIds, governedItems } from '../../logic/tree';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { CategorySelect } from './CategorySelect';

/** Add a sub-category under `parent`, or edit `category` (rename, move, default, delete). */
export function CategorySheet({ data, category, parent, onClose, reload }: {
  data: FamilyData;
  category: Category | null;
  parent: Category | null;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [mode, setMode] = useState<RestockMode | null>((category?.default_restock_mode as RestockMode | null) ?? null);
  const [parentId, setParentId] = useState<string | null>(category?.parent_id ?? parent?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // After choosing Staples / As needed: items that still carry their own (old) setting.
  const [cleanup, setCleanup] = useState<{ same: string[]; differ: string[]; mode: RestockMode } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Enter a name.'); return; }
    setBusy(true); setError(null);
    try {
      if (category) {
        await updateCategory(category.id, { name, default_restock_mode: mode });
        if (parentId && parentId !== category.parent_id) await moveCategory(data.categories, category.id, parentId);
        if (mode) {
          const nodes = data.categories.map((c) => (c.id === category.id ? { ...c, default_restock_mode: mode } : c));
          const own = governedItems(nodes, category.id, data.items).filter((i) => i.restock_mode);
          const same = own.filter((i) => i.restock_mode === mode).map((i) => i.id);
          const differ = own.filter((i) => i.restock_mode !== mode).map((i) => i.id);
          if (same.length) await followCategory(same);   // already agree: just follow
          if (differ.length) { await reload(); setCleanup({ same, differ, mode }); setBusy(false); return; }
        }
        toast('Saved');
      } else if (parent) {
        await addCategory(data.family.id, parent.id, name, mode);
        toast(`Added ${name.trim()}`);
      }
      await reload();
      onClose();
    } catch (err) {
      setError(explain(err as Error));
      setBusy(false);
    }
  }

  async function remove() {
    if (!category) return;
    const inside = descendantIds(data.categories, category.id);
    const n = data.items.filter((i) => i.category_id && inside.has(i.category_id)).length;
    const msg = n
      ? `Delete ${category.name} and its sub-categories? The ${n} items in it stay in My Home, under “Not in a category yet”.`
      : `Delete ${category.name}?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteCategory(category.id);
      window.location.hash = href('home', category.parent_id);
      await reload();
      toast(`Deleted ${category.name}`);
      onClose();
    } catch (err) { setError(explain(err as Error)); }
  }

  async function finish(ids: string[], msg: string) {
    setBusy(true); setError(null);
    try { await followCategory(ids); await reload(); toast(msg); onClose(); }
    catch (err) { setError(explain(err as Error)); setBusy(false); }
  }

  if (cleanup && category) {
    const nm = name.trim();
    const want = cleanup.mode === 'staple' ? 'staples' : 'as needed';
    const other = cleanup.mode === 'staple' ? 'as needed' : 'staples';
    const total = cleanup.same.length + cleanup.differ.length;
    return (
      <Sheet title={`Items in ${nm}`} onClose={onClose}>
        <div className="stack">
          <p>Saved: {nm} items are now <strong>{want}</strong>.</p>
          <p>{cleanup.differ.length} {cleanup.differ.length === 1 ? 'item was' : 'items were'} set to <strong>{other}</strong> one by one
            (most came that way from TenBy12). Should they follow {nm} too?</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary wide" disabled={busy}
            onClick={() => void finish(cleanup.differ, `All ${total} items in ${nm} are ${want}`)}>
            Make all {total} {want}
          </button>
          <button className="btn wide" disabled={busy} onClick={() => { void reload(); toast('Saved'); onClose(); }}>
            Keep those {cleanup.differ.length} as exceptions
          </button>
          <p className="soft small">Either way, you can change any single item later in its own settings.</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={category ? `Edit ${category.name}` : `New category in ${parent?.name ?? 'My Home'}`} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <label className="field"><span>Name</span>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} autoFocus maxLength={60}
            placeholder="e.g. Pantry, Spices, Laundry" />
        </label>

        {category && (
          <CategorySelect label="Inside" categories={data.categories} value={parentId}
            exclude={descendantIds(data.categories, category.id)} onChange={setParentId} />
        )}

        <div className="field">
          <span id="cmode">Items here are</span>
          <div className="segmented" role="group" aria-labelledby="cmode">
            <button type="button" aria-pressed={mode === 'staple'} onClick={() => setMode('staple')}>Staples</button>
            <button type="button" aria-pressed={mode === 'as_needed'} onClick={() => setMode('as_needed')}>As needed</button>
            <button type="button" aria-pressed={mode === null} onClick={() => setMode(null)}>Either</button>
          </div>
          <span className="hint">Items here follow this unless set differently one by one.</span>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{category ? 'Save' : 'Add category'}</button>
        {category && <button type="button" className="btn danger wide" onClick={remove}>Delete category</button>}
      </form>
    </Sheet>
  );
}
