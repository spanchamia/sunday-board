import { useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { addToList, haveIt } from '../../commands/shopping';
import { explain } from '../../lib/supabase';
import { today } from '../../logic/dates';
import { sinceLabel } from '../../logic/restock';
import type { Suggestion } from '../../logic/shopping';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

/**
 * This week's shop, in one review: fresh ingredients for the meals planned in the
 * coming week, and staples that are probably running low. Everything starts ticked;
 * untick what you have. Unticked staples are remembered as "Have it", so they don't
 * come straight back next time.
 */
export function WeekShopSheet({ family, suggestions, dishName, onClose, onDone }: {
  family: FamilyData; suggestions: readonly Suggestion[]; dishName: ReadonlyMap<string, string>;
  onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = today();

  const meals = suggestions.filter((s) => s.dishIds.length);
  const low = suggestions.filter((s) => !s.dishIds.length);
  const toggle = (id: string) => setOff((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picked = suggestions.filter((s) => !off.has(s.itemId));
  const skippedStaples = suggestions.filter((s) => off.has(s.itemId) && s.due);

  async function save() {
    setBusy(true); setError(null);
    try {
      for (const s of picked) {
        for (const r of s.reasons) {
          await addToList(family.family.id, s.itemId, r.kind === 'planned_meal'
            ? { kind: 'planned_meal', plannedMealId: r.plannedMealId, dishId: r.dishId } : { kind: 'restock_due' });
        }
      }
      await haveIt(family.family.id, skippedStaples.map((s) => s.itemId));
      toast(`Added ${picked.length} to the list${skippedStaples.length ? `; ${skippedStaples.length} marked “Have it”` : ''}`);
      onDone();
      onClose();
    } catch (e) { setError(explain(e as Error)); setBusy(false); }
  }

  const row = (s: Suggestion) => {
    const dishes = s.dishIds.map((d) => dishName.get(d)).filter(Boolean);
    const why = [
      dishes.length ? `For ${dishes.join(' and ')}` : '',
      s.due ? `last bought ${sinceLabel(s.due.lastBought, t)}${s.due.guessed ? ' (first guess)' : ''}` : '',
    ].filter(Boolean).join(', ');
    return (
      <label key={s.itemId} className="check-row">
        <input type="checkbox" checked={!off.has(s.itemId)} onChange={() => toggle(s.itemId)} />
        <span className="grow">{s.name}
          <span className="meta" style={{ display: 'block' }}>{why.charAt(0).toUpperCase() + why.slice(1)}{s.onList ? '. Already on the list' : ''}</span>
        </span>
        {s.staple && <span className="staple">Staple</span>}
      </label>
    );
  };

  return (
    <Sheet title="This week’s shop" onClose={onClose}>
      <div className="stack">
        {suggestions.length === 0 ? (
          <p className="soft">Nothing new to suggest. Plan some meals for the week, or check back when staples run low.</p>
        ) : (
          <>
            <p className="soft small">Untick anything you already have. Unticked staples count as “Have it”, so they won’t come back for a while.</p>
            {meals.length > 0 && (
              <section className="stack" aria-label="For this week’s meals">
                <h3 className="small soft">For this week’s meals</h3>
                <div className="panel">{meals.map(row)}</div>
              </section>
            )}
            {low.length > 0 && (
              <section className="stack" aria-label="Staples running low">
                <h3 className="small soft">Staples running low</h3>
                <div className="panel">{low.map(row)}</div>
              </section>
            )}
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary wide" disabled={busy || (picked.length === 0 && skippedStaples.length === 0)} onClick={() => void save()}>
              {busy ? 'Saving…' : picked.length ? `Add ${picked.length} to the list` : 'Mark all as “Have it”'}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
