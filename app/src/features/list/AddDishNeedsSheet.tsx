import { useEffect, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { addToList, type Reason } from '../../commands/shopping';
import { explain, supabase } from '../../lib/supabase';
import { defaultChoices, type IngredientChoice } from '../../logic/shopping';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

/**
 * "Add what this dish needs to the list." Fresh items come ticked; staples don't
 * (you probably have them) but can be ticked. Already-listed items get this dish
 * noted as another reason.
 */
export function AddDishNeedsSheet({ family, dishName, itemIds, reason, onClose, onAdded }: {
  family: FamilyData; dishName: string; itemIds: readonly string[]; reason: Reason; onClose: () => void; onAdded?: () => void;
}) {
  const toast = useToast();
  const [choices, setChoices] = useState<IngredientChoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const byId = new Map(family.items.map((i) => [i.id, i]));
    const ings = itemIds.flatMap((id) => { const it = byId.get(id); return it ? [{ itemId: id, name: it.name, staple: it.restock_mode === 'staple' }] : []; });
    supabase.from('list_entries').select('item_id').eq('family_id', family.family.id).in('status', ['to_buy', 'in_bag']).then(({ data, error: e }) => {
      if (e) setError(explain(e));
      setChoices(defaultChoices(ings, new Set((data ?? []).map((r) => r.item_id))));
    });
  }, [family, itemIds]);

  async function add() {
    if (!choices) return;
    const picked = choices.filter((c) => c.checked);
    setBusy(true); setError(null);
    try {
      let added = 0;
      for (const c of picked) if ((await addToList(family.family.id, c.itemId, reason)) === 'added') added++;
      toast(added === picked.length ? `Added ${added} ${added === 1 ? 'item' : 'items'} for ${dishName}`
        : `Added ${added} for ${dishName}; ${picked.length - added} already on the list`);
      onAdded?.();
      onClose();
    } catch (e) { setError(explain(e as Error)); setBusy(false); }
  }

  const toggle = (id: string) => setChoices((cs) => cs?.map((c) => (c.itemId === id ? { ...c, checked: !c.checked } : c)) ?? null);
  const n = choices?.filter((c) => c.checked).length ?? 0;

  return (
    <Sheet title={`Shop for ${dishName}`} onClose={onClose}>
      <div className="stack">
        {!choices ? <p className="soft">Loading…</p> : choices.length === 0 ? (
          <p className="soft">This dish has no ingredients yet. Add them in Plan → Dishes.</p>
        ) : (
          <>
            <p className="soft small">Fresh things are ticked. Staples aren’t, since you probably have them: tick any you’re out of.</p>
            <div className="panel">
              {choices.map((c) => (
                <label key={c.itemId} className="check-row">
                  <input type="checkbox" checked={c.checked} onChange={() => toggle(c.itemId)} />
                  <span className="grow">{c.name}{c.onList && <span className="meta" style={{ display: 'block' }}>Already on the list</span>}</span>
                  {c.staple && <span className="staple">Staple</span>}
                </label>
              ))}
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary wide" disabled={busy || n === 0} onClick={() => void add()}>
              {busy ? 'Adding…' : `Add ${n} to the list`}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
