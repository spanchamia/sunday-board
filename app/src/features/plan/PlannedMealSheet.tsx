import { useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import type { PlanData, PlanIndex } from '../../app/usePlan';
import { movePlannedMeal, removePlannedMeal } from '../../commands/meals';
import { explain } from '../../lib/supabase';
import type { PlannedMeal } from '../../lib/types';
import { dayLabel } from '../../logic/dates';
import { leadLabel } from '../../logic/prep';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { DishSheet } from './DishSheet';
import { TaskRow } from './TaskRow';

/** One planned dish: what it needs, its prep reminders, move it or take it off the plan. */
export function PlannedMealSheet({ family, data, index, planned, onClose, reload }: {
  family: FamilyData; data: PlanData; index: PlanIndex; planned: PlannedMeal; onClose: () => void; reload: () => Promise<void>;
}) {
  const toast = useToast();
  const dish = planned.dish_id ? index.dishById.get(planned.dish_id) : undefined;
  const [date, setDate] = useState(planned.date);
  const [mealTypeId, setMealTypeId] = useState(planned.meal_type_id);
  const [editDish, setEditDish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemName = new Map(family.items.map((i) => [i.id, i.name]));
  const ingredients = dish ? (index.ingredientsOfDish.get(dish.id) ?? []) : [];
  const steps = dish ? (index.stepsOfDish.get(dish.id) ?? []) : [];
  const reminders = data.tasks.filter((t) => t.planned_meal_id === planned.id);
  const changed = date !== planned.date || mealTypeId !== planned.meal_type_id;
  const mealType = index.mealTypeById.get(planned.meal_type_id);

  async function move() {
    const mt = index.mealTypeById.get(mealTypeId);
    if (!mt || !date) return;
    try {
      await movePlannedMeal(planned, date, mt, index.stepById);
      await reload();
      toast(`Moved to ${dayLabel(date)} ${mt.name.toLowerCase()}${reminders.length ? '. Prep reminders moved too.' : ''}`);
      onClose();
    } catch (e) { setError(explain(e as Error)); }
  }

  async function remove() {
    try { await removePlannedMeal(planned.id); await reload(); toast(`${dish?.name ?? 'Dish'} taken off the plan`); onClose(); }
    catch (e) { setError(explain(e as Error)); }
  }

  if (editDish && dish) {
    return <DishSheet family={family} data={data} index={index} dish={dish} onClose={() => setEditDish(false)} reload={reload} />;
  }

  return (
    <Sheet title={dish?.name ?? 'Planned dish'} onClose={onClose}>
      <div className="stack">
        <p className="soft">{dayLabel(planned.date)}, {mealType?.name.toLowerCase()}</p>

        <section className="stack" aria-labelledby="ing-h">
          <h2 id="ing-h" className="small">What it needs</h2>
          {ingredients.length ? (
            <p>{ingredients.map((i) => itemName.get(i.item_id) ?? 'An item you removed').sort().join(', ')}</p>
          ) : <p className="soft small">No ingredients yet.</p>}
        </section>

        {(reminders.length > 0 || steps.length > 0) && (
          <section className="stack" aria-labelledby="prep-h">
            <h2 id="prep-h" className="small">Prep</h2>
            {reminders.length ? (
              <div className="panel">{reminders.map((t) => <TaskRow key={t.id} task={t} data={data} index={index} reload={reload} showDay />)}</div>
            ) : (
              <p className="soft small">This dish has prep steps ({steps.map((s) => `${s.name}, ${leadLabel(s.lead_minutes)}`).join('; ')}), but this plan was made before reminders existed.</p>
            )}
          </section>
        )}

        <button className="btn" onClick={() => setEditDish(true)} disabled={!dish}>Edit dish</button>

        <section className="stack" aria-labelledby="move-h">
          <h2 id="move-h" className="small">Move</h2>
          <div className="row">
            <label className="field grow"><span className="sr-only">Day</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="field grow"><span className="sr-only">Meal</span>
              <select className="input" value={mealTypeId} onChange={(e) => setMealTypeId(e.target.value)}>
                {data.mealTypes.map((mt) => <option key={mt.id} value={mt.id}>{mt.name}</option>)}
              </select></label>
          </div>
          <button className="btn primary wide" disabled={!changed} onClick={() => void move()}>Move</button>
        </section>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn danger wide" onClick={() => void remove()}>Take off the plan</button>
      </div>
    </Sheet>
  );
}
