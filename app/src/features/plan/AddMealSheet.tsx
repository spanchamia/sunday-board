import { useMemo, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import type { PlanData, PlanIndex } from '../../app/usePlan';
import { saveDish } from '../../commands/dishes';
import { planMeal } from '../../commands/meals';
import { explain } from '../../lib/supabase';
import type { Dish } from '../../lib/types';
import { dayLabel } from '../../logic/dates';
import { suggestDishes, type DishFacts } from '../../logic/suggest';
import { norm, rankByName } from '../../logic/text';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

/** Pick a meal type and a dish for one day. Suggestions come from the family's own history. */
export function AddMealSheet({ family, data, index, date, onClose, reload }: {
  family: FamilyData; data: PlanData; index: PlanIndex; date: string; onClose: () => void; reload: () => Promise<void>;
}) {
  const toast = useToast();
  const plannedToday = data.planned.filter((p) => p.date === date);
  const firstFree = data.mealTypes.find((mt) => !plannedToday.some((p) => p.meal_type_id === mt.id)) ?? data.mealTypes[0];
  const [mealTypeId, setMealTypeId] = useState(firstFree?.id ?? '');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const mealType = index.mealTypeById.get(mealTypeId);

  const facts: DishFacts[] = useMemo(() => data.dishes.map((d) => ({
    id: d.id, name: d.name, make_every_days: d.make_every_days, weekdays_ok: d.weekdays_ok, weekends_ok: d.weekends_ok,
    mealTypeIds: index.mealTypesOfDish.get(d.id) ?? [],
  })), [data.dishes, index]);

  const suggestions = useMemo(() => {
    const last = new Map<string, string>();
    for (const p of data.planned) if (p.dish_id && p.date <= date && (last.get(p.dish_id) ?? '') < p.date) last.set(p.dish_id, p.date);
    const week = new Set(data.planned.filter((p) => p.dish_id && Math.abs(Date.parse(p.date) - Date.parse(date)) < 4 * 86400000).map((p) => p.dish_id!));
    return mealTypeId ? suggestDishes(facts, last, week, date, mealTypeId) : [];
  }, [facts, data.planned, date, mealTypeId]);

  const forType = data.dishes.filter((d) => (index.mealTypesOfDish.get(d.id) ?? []).includes(mealTypeId));
  const others = data.dishes.filter((d) => !forType.includes(d));
  const query = q.trim();
  const matches = query ? rankByName(data.dishes, query, (d) => d.name).slice(0, 12) : [];
  const exact = data.dishes.some((d) => norm(d.name) === norm(query));

  async function plan(dish: Dish) {
    if (!mealType) return;
    setBusy(true);
    try {
      const { reminders } = await planMeal(family.family.id, date, mealType, dish, index.stepsOfDish.get(dish.id) ?? []);
      await reload();
      toast(`${dish.name} planned for ${dayLabel(date)}, ${mealType.name.toLowerCase()}${reminders ? `. ${reminders} prep ${reminders === 1 ? 'reminder' : 'reminders'} added.` : ''}`);
      onClose();
    } catch (e) { toast(explain(e as Error)); setBusy(false); }
  }

  async function createAndPlan() {
    if (!mealType || !query) return;
    setBusy(true);
    try {
      const dish = await saveDish(family.family.id, {
        name: query, notes: '', make_every_days: null, weekdays_ok: true, weekends_ok: true,
        mealTypeIds: [mealType.id], ingredients: [], prepSteps: [],
      });
      await plan(dish);
      toast(`${dish.name} added and planned. Add its ingredients under Dishes.`);
    } catch (e) { toast(explain(e as Error)); setBusy(false); }
  }

  const row = (d: Dish, reason?: string) => (
    <li key={d.id}>
      <button className="list-row" disabled={busy} onClick={() => void plan(d)}>
        <span className="grow">{d.name}{reason && <span className="meta" style={{ display: 'block' }}>{reason}</span>}</span>
        {(index.stepsOfDish.get(d.id)?.length ?? 0) > 0 && <span className="meta">Has prep</span>}
      </button>
    </li>
  );

  if (!data.mealTypes.length) {
    return (
      <Sheet title="Add a meal" onClose={onClose}>
        <p>Add your meal types first (for example Breakfast, School lunch, Dinner): Plan → Dishes → Meal types.</p>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Add to ${dayLabel(date)}`} onClose={onClose}>
      <div className="stack">
        <div className="chips" role="group" aria-label="Meal">
          {data.mealTypes.map((mt) => (
            <button key={mt.id} type="button" className="chip" aria-pressed={mt.id === mealTypeId} onClick={() => setMealTypeId(mt.id)}>{mt.name}</button>
          ))}
        </div>
        <label className="sr-only" htmlFor="dish-q">Find a dish</label>
        <input id="dish-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a dish or type a new one" autoComplete="off" />

        {query ? (
          <ul className="list panel">
            {matches.map((d) => row(d))}
            {!exact && (
              <li><button className="list-row" disabled={busy} onClick={() => void createAndPlan()}><Icon name="plus" />
                <span className="grow">New dish “{query}”</span></button></li>
            )}
          </ul>
        ) : (
          <>
            {suggestions.length > 0 && (
              <section className="stack" aria-labelledby="sugg-h">
                <h2 id="sugg-h" className="small">Suggested</h2>
                <ul className="list panel">{suggestions.map((s) => row(index.dishById.get(s.dishId)!, s.reason))}</ul>
              </section>
            )}
            <section className="stack" aria-labelledby="type-h">
              <h2 id="type-h" className="small">{mealType?.name} dishes</h2>
              {forType.length ? <ul className="list panel">{forType.map((d) => row(d))}</ul>
                : <p className="soft small">No dishes marked for {mealType?.name.toLowerCase()} yet. Search above, or show all dishes.</p>}
            </section>
            {others.length > 0 && (showAll
              ? <section className="stack" aria-labelledby="other-h"><h2 id="other-h" className="small">Other dishes</h2><ul className="list panel">{others.map((d) => row(d))}</ul></section>
              : <button className="btn quiet" onClick={() => setShowAll(true)}>Show all {data.dishes.length} dishes</button>)}
          </>
        )}
      </div>
    </Sheet>
  );
}

