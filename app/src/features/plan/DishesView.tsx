import { useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import type { PlanData, PlanIndex } from '../../app/usePlan';
import type { Dish } from '../../lib/types';
import { rankByName } from '../../logic/text';
import { Icon } from '../../ui/Icon';
import { DishSheet } from './DishSheet';
import { MealTypesSheet } from './MealTypesSheet';

/** All the family's dishes, filterable by meal type and searchable. */
export function DishesView({ family, data, index, reload }: { family: FamilyData; data: PlanData; index: PlanIndex; reload: () => Promise<void> }) {
  const [q, setQ] = useState('');
  const [mealTypeId, setMealTypeId] = useState<string | null>(null);
  const [open, setOpen] = useState<Dish | 'new' | null>(null);
  const [types, setTypes] = useState(false);

  let list = mealTypeId ? data.dishes.filter((d) => (index.mealTypesOfDish.get(d.id) ?? []).includes(mealTypeId)) : data.dishes;
  if (q.trim()) list = rankByName(list, q, (d) => d.name);

  const summary = (d: Dish) => {
    const n = index.ingredientsOfDish.get(d.id)?.length ?? 0;
    const p = index.stepsOfDish.get(d.id)?.length ?? 0;
    const parts = [n ? `${n} ${n === 1 ? 'ingredient' : 'ingredients'}` : 'No ingredients yet'];
    if (p) parts.push(`${p} prep ${p === 1 ? 'step' : 'steps'}`);
    return parts.join(', ');
  };

  return (
    <div className="stack">
      <div className="row">
        <h1 className="grow">Dishes</h1>
        <button className="btn" onClick={() => setTypes(true)}>Meal types</button>
        <button className="btn primary" onClick={() => setOpen('new')}><Icon name="plus" />New</button>
      </div>
      <label className="sr-only" htmlFor="dish-search">Find a dish</label>
      <input id="dish-search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find among ${data.dishes.length} dishes`} />
      <div className="chips" role="group" aria-label="Filter by meal">
        <button className="chip" aria-pressed={mealTypeId === null} onClick={() => setMealTypeId(null)}>All</button>
        {data.mealTypes.map((mt) => (
          <button key={mt.id} className="chip" aria-pressed={mealTypeId === mt.id} onClick={() => setMealTypeId(mt.id)}>{mt.name}</button>
        ))}
      </div>
      {list.length ? (
        <ul className="list panel">
          {list.map((d) => (
            <li key={d.id}>
              <button className="list-row" onClick={() => setOpen(d)}>
                <span className="grow">{d.name}<span className="meta" style={{ display: 'block' }}>{summary(d)}</span></span>
                <Icon name="chev" className="chev" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="soft empty">{q ? `No dish matches “${q}”.` : 'No dishes here yet.'}</p>}

      {open && <DishSheet family={family} data={data} index={index} dish={open === 'new' ? null : open}
        initialName={open === 'new' ? q.trim() : ''} initialMealTypeId={mealTypeId} onClose={() => setOpen(null)} reload={reload} />}
      {types && <MealTypesSheet family={family} data={data} onClose={() => setTypes(false)} reload={reload} />}
    </div>
  );
}
