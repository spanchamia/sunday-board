import { useMemo, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import type { PlanData, PlanIndex } from '../../app/usePlan';
import type { PlannedMeal } from '../../lib/types';
import { addDays, dayLabel, fromISODate, rangeLabel, today } from '../../logic/dates';
import { Icon } from '../../ui/Icon';
import { AddMealSheet } from './AddMealSheet';
import { PlannedMealSheet } from './PlannedMealSheet';
import { TaskRow } from './TaskRow';

/** Seven days from today (or the week you page to): meals by meal type, and the day's to-dos. */
export function WeekView({ family, data, index, reload }: { family: FamilyData; data: PlanData; index: PlanIndex; reload: () => Promise<void> }) {
  const [offset, setOffset] = useState(0);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [open, setOpen] = useState<PlannedMeal | null>(null);
  const start = addDays(today(), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = days[6]!;

  const byDay = useMemo(() => {
    const m = new Map<string, PlannedMeal[]>();
    for (const p of data.planned) if (p.date >= start && p.date <= end) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return m;
  }, [data.planned, start, end]);

  const overdue = offset === 0 ? data.tasks.filter((t) => !t.done_at && t.due_on && t.due_on < start) : [];
  const tasksOn = (d: string) => data.tasks.filter((t) => t.due_on === d)
    .sort((a, b) => Number(!!a.done_at) - Number(!!b.done_at) || (a.due_time ?? '').localeCompare(b.due_time ?? ''));

  return (
    <div className="stack">
      <div className="row">
        <button className="icon-btn" onClick={() => setOffset(offset - 1)} aria-label="Previous week"><Icon name="back" /></button>
        <h1 className="grow" style={{ textAlign: 'center' }}>{offset === 0 ? 'Next 7 days' : rangeLabel(start, end)}</h1>
        <button className="icon-btn" onClick={() => setOffset(offset + 1)} aria-label="Next week"><Icon name="chev" /></button>
      </div>
      {offset !== 0 && <button className="btn quiet" onClick={() => setOffset(0)}>Back to today</button>}

      {overdue.length > 0 && (
        <section aria-labelledby="overdue-h" className="stack">
          <h2 id="overdue-h">Still to do</h2>
          <div className="panel">{overdue.map((t) => <TaskRow key={t.id} task={t} data={data} index={index} reload={reload} showDay />)}</div>
        </section>
      )}

      {days.map((d) => {
        const meals = byDay.get(d) ?? [];
        const tasks = tasksOn(d);
        const types = data.mealTypes.filter((mt) => meals.some((m) => m.meal_type_id === mt.id));
        const weekday = fromISODate(d).toLocaleDateString(undefined, { weekday: 'long' });
        const label = dayLabel(d);
        return (
          <section key={d} aria-label={`${weekday} ${d}`} className="day">
            <h2 className="day-h">{label}{label === 'Today' || label === 'Tomorrow' ? <span className="soft small"> {weekday}</span> : null}</h2>
            <div className="panel">
              {types.map((mt) => (
                <div key={mt.id} className="meal-row">
                  <span className="meal-type">{mt.name}</span>
                  <span className="grow dish-chips">
                    {meals.filter((m) => m.meal_type_id === mt.id).map((m) => (
                      <button key={m.id} className="dish-chip" onClick={() => setOpen(m)}>
                        {(m.dish_id && index.dishById.get(m.dish_id)?.name) || 'A dish you removed'}
                      </button>
                    ))}
                  </span>
                </div>
              ))}
              {tasks.map((t) => <TaskRow key={t.id} task={t} data={data} index={index} reload={reload} />)}
              <button className="list-row add-row" onClick={() => setAddFor(d)}><Icon name="plus" />Add a meal</button>
            </div>
          </section>
        );
      })}

      {addFor && <AddMealSheet family={family} data={data} index={index} date={addFor} onClose={() => setAddFor(null)} reload={reload} />}
      {open && <PlannedMealSheet family={family} data={data} index={index} planned={open} onClose={() => setOpen(null)} reload={reload} />}
    </div>
  );
}
