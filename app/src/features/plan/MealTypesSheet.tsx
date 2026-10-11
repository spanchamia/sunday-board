import { useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import type { PlanData } from '../../app/usePlan';
import { addMealType, deleteMealType, updateMealType } from '../../commands/meals';
import { explain } from '../../lib/supabase';
import type { MealType } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

/** The family's own meal types (School lunch, Dinner…), their order and usual time. */
export function MealTypesSheet({ family, data, onClose, reload }: { family: FamilyData; data: PlanData; onClose: () => void; reload: () => Promise<void> }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (f: () => Promise<unknown>, msg?: string) => {
    try { await f(); await reload(); if (msg) toast(msg); setError(null); } catch (e) { setError(explain(e as Error)); }
  };
  const swap = (a: MealType, b: MealType) => run(async () => { await updateMealType(a.id, { sort: b.sort }); await updateMealType(b.id, { sort: a.sort === b.sort ? a.sort + 1 : a.sort }); });
  const list = [...data.mealTypes].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

  return (
    <Sheet title="Meal types" onClose={onClose}>
      <div className="stack">
        <p className="soft small">The usual time sets when prep reminders are due: soaking “12 hours before” a 7 pm dinner reminds you at 7 am.</p>
        <ul className="list panel">
          {list.map((mt, i) => (
            <li key={mt.id} className="check-row">
              <input className="input grow" defaultValue={mt.name} aria-label="Name" maxLength={40}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== mt.name) void run(() => updateMealType(mt.id, { name: e.target.value }), 'Renamed'); }} />
              <input className="input time" type="time" defaultValue={mt.usual_time?.slice(0, 5) ?? ''} aria-label={`Usual time for ${mt.name}`}
                onBlur={(e) => { const v = e.target.value ? `${e.target.value}:00` : null; if (v !== mt.usual_time) void run(() => updateMealType(mt.id, { usual_time: v })); }} />
              <button type="button" className="icon-btn" disabled={i === 0} aria-label={`Move ${mt.name} up`} onClick={() => void swap(mt, list[i - 1]!)}><Icon name="back" className="up" /></button>
              <button type="button" className="icon-btn" aria-label={`Delete ${mt.name}`} onClick={() => {
                if (window.confirm(`Delete ${mt.name}? Meals planned as ${mt.name} are removed from the plan. Dishes stay.`)) void run(() => deleteMealType(mt.id), `Deleted ${mt.name}`);
              }}><Icon name="trash" /></button>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void run(() => addMealType(family.family.id, name, (list.at(-1)?.sort ?? 0) + 1, null), `Added ${name.trim()}`).then(() => setName('')); }}>
          <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="New meal type, e.g. School snack" maxLength={40} />
          <button className="btn primary">Add</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
