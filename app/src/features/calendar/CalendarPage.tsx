import { useEffect, useMemo, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { usePlan, type PlanData, type PlanIndex } from '../../app/usePlan';
import { useToday } from '../../app/useToday';
import { href } from '../../app/router';
import { readCalendarView, saveCalendarView, type CalendarView } from '../../lib/device';
import type { PlannedMeal, Task } from '../../lib/types';
import { addMonths, monthGrid, monthLabel, sameMonth, weekDays, weekdayNames } from '../../logic/calendar';
import { addDays, dayLabel, fromISODate, rangeLabel, timeLabel } from '../../logic/dates';
import { Icon } from '../../ui/Icon';
import { AddMealSheet } from '../plan/AddMealSheet';
import { PlannedMealSheet } from '../plan/PlannedMealSheet';
import { TaskRow } from '../plan/TaskRow';
import { TaskSheet } from '../todos/TaskSheet';
import { repeatLabel, repeatsBetween, type RepeatUnit } from '../../logic/repeat';

interface DayStuff { meals: PlannedMeal[]; prep: Task[]; todos: Task[]; repeats: Task[] }   // repeats: upcoming copies of repeating to-dos

/**
 * The family calendar: every day's meals, prep reminders and to-dos. Week view for
 * the kitchen tablet (each day in full), Month view for planning ahead. Tap a day in
 * the month to see it below; tick to-dos straight from here.
 */
export function CalendarPage({ family, viewParam }: { family: FamilyData; viewParam: string | null }) {
  const plan = usePlan(family.family.id);
  const t = useToday();
  const [view, setView] = useState<CalendarView>(viewParam === 'month' || viewParam === 'week' ? viewParam : readCalendarView);
  const [anchor, setAnchor] = useState<string | null>(null);   // null = follow today
  const [picked, setPicked] = useState<string | null>(null);
  const at = anchor ?? t;
  const selected = picked ?? t;

  useEffect(() => { if (viewParam === 'month' || viewParam === 'week') setView(viewParam); }, [viewParam]);
  useEffect(() => { saveCalendarView(view); }, [view]);

  const lastShown = view === 'week' ? addDays(weekDays(at)[0]!, 6) : monthGrid(at).at(-1)!.at(-1)!;
  const byDay = useMemo(() => {
    const m = new Map<string, DayStuff>();
    const get = (d: string) => { if (!m.has(d)) m.set(d, { meals: [], prep: [], todos: [], repeats: [] }); return m.get(d)!; };
    if (!plan.data) return m;
    const sortOf = new Map(plan.data.mealTypes.map((x) => [x.id, x.sort]));
    for (const p of plan.data.planned) get(p.date).meals.push(p);
    for (const k of plan.data.tasks) if (k.due_on) (k.planned_meal_id ? get(k.due_on).prep : get(k.due_on).todos).push(k);
    // Show where open repeating to-dos will come back (the real one appears when the current one is done).
    for (const k of plan.data.tasks) {
      if (k.done_at || !k.due_on || !k.repeat_unit || !k.repeat_every) continue;
      for (const d of repeatsBetween(k.due_on, { unit: k.repeat_unit as RepeatUnit, every: k.repeat_every }, lastShown)) get(d).repeats.push(k);
    }
    for (const s of m.values()) {
      s.meals.sort((a, b) => (sortOf.get(a.meal_type_id) ?? 0) - (sortOf.get(b.meal_type_id) ?? 0));
      const byTime = (a: Task, b: Task) => Number(!!a.done_at) - Number(!!b.done_at) || (a.due_time ?? '99').localeCompare(b.due_time ?? '99');
      s.prep.sort(byTime); s.todos.sort(byTime);
    }
    return m;
  }, [plan.data, lastShown]);

  const move = (n: number) => { setAnchor(view === 'week' ? addDays(at, n * 7) : addMonths(at, n)); setPicked(null); };
  const goToday = () => { setAnchor(null); setPicked(null); };
  const days = view === 'week' ? weekDays(at) : [];
  const grid = view === 'month' ? monthGrid(at) : [];
  const title = view === 'week' ? rangeLabel(days[0]!, days[6]!) : monthLabel(at);
  const showingToday = view === 'week' ? days.includes(t) : sameMonth(at, t);

  return (
    <div className="stack calendar">
      <div className="cal-head">
        <div className="row">
          <button className="icon-btn" onClick={() => move(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous month'}><Icon name="back" /></button>
          <h1 className="grow cal-title">{title}</h1>
          <button className="icon-btn" onClick={() => move(1)} aria-label={view === 'week' ? 'Next week' : 'Next month'}><Icon name="chev" /></button>
        </div>
        <div className="row cal-tools">
          <button className="btn" onClick={goToday} disabled={showingToday && picked === null}>Today</button>
          <div className="segmented grow" role="group" aria-label="Calendar view">
            <button aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</button>
            <button aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</button>
          </div>
        </div>
      </div>

      {plan.error && <p className="error">Couldn’t load the calendar: {plan.error}</p>}
      {!plan.data || !plan.index ? (!plan.error && <p className="soft">Loading…</p>) : view === 'week' ? (
        <div className="cal-week">
          {days.map((d) => (
            <DayPanel key={d} family={family} day={d} today={t} stuff={byDay.get(d)} data={plan.data!} index={plan.index!} reload={plan.reload} />
          ))}
        </div>
      ) : (
        <div className="cal-month-wrap">
          <div className="cal-month" role="grid" aria-label={monthLabel(at)}>
            <div className="cal-row cal-names" role="row">
              {weekdayNames().map((n) => <div key={n} role="columnheader">{n}</div>)}
            </div>
            {grid.map((week) => (
              <div key={week[0]} className="cal-row" role="row">
                {week.map((d) => (
                  <MonthCell key={d} day={d} today={t} inMonth={sameMonth(d, at)} selected={d === selected}
                    stuff={byDay.get(d)} index={plan.index!} onPick={() => setPicked(d)} />
                ))}
              </div>
            ))}
          </div>
          <DayPanel family={family} day={selected} today={t} stuff={byDay.get(selected)} data={plan.data} index={plan.index} reload={plan.reload} big />
        </div>
      )}
      <p className="soft small cal-foot">Plan meals and dishes in <a href={href('meals')}>Plan</a>. Add to-dos in <a href={href('todos')}>To-dos</a>.</p>
    </div>
  );
}

function MonthCell({ day, today, inMonth, selected, stuff, index, onPick }: {
  day: string; today: string; inMonth: boolean; selected: boolean; stuff: DayStuff | undefined; index: PlanIndex; onPick: () => void;
}) {
  const lines: { key: string; cls: string; text: string; done?: boolean }[] = [];
  for (const m of stuff?.meals ?? []) lines.push({ key: m.id, cls: 'cal-meal', text: (m.dish_id && index.dishById.get(m.dish_id)?.name) || 'Meal' });
  for (const k of stuff?.prep ?? []) lines.push({ key: k.id, cls: 'cal-prep', text: k.title, done: !!k.done_at });
  for (const k of stuff?.todos ?? []) lines.push({ key: k.id, cls: 'cal-todo', text: k.title, done: !!k.done_at });
  for (const k of stuff?.repeats ?? []) lines.push({ key: `r-${k.id}`, cls: 'cal-repeat', text: k.title });
  const shown = lines.slice(0, 4);
  const n = fromISODate(day).getDate();
  const name = fromISODate(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const summary = lines.length ? `, ${lines.length} ${lines.length === 1 ? 'thing' : 'things'}` : '';
  return (
    <button role="gridcell" aria-selected={selected} onClick={onPick} aria-label={`${name}${summary}`}
      className={`cal-cell${inMonth ? '' : ' out'}${day === today ? ' is-today' : ''}${selected ? ' picked' : ''}`}>
      <span className="cal-num">{n}</span>
      <span className="cal-lines" aria-hidden="true">
        {shown.map((l) => <span key={l.key} className={`cal-line ${l.cls}${l.done ? ' done' : ''}`}>{l.text}</span>)}
        {lines.length > shown.length && <span className="cal-more">+{lines.length - shown.length} more</span>}
      </span>
      <span className="cal-dots" aria-hidden="true">
        {lines.slice(0, 5).map((l) => <i key={l.key} className={l.cls} />)}
      </span>
    </button>
  );
}

/** One day in full: meals by meal type, prep reminders, to-dos. */
function DayPanel({ family, day, today, stuff, data, index, reload, big = false }: {
  family: FamilyData; day: string; today: string; stuff: DayStuff | undefined; data: PlanData; index: PlanIndex;
  reload: () => Promise<void>; big?: boolean;
}) {
  const [open, setOpen] = useState<PlannedMeal | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingTodo, setAddingTodo] = useState(false);
  const meals = stuff?.meals ?? [];
  const types = data.mealTypes.filter((mt) => meals.some((m) => m.meal_type_id === mt.id));
  const overdue = day === today ? data.tasks.filter((k) => !k.done_at && k.due_on && k.due_on < today) : [];
  const label = dayLabel(day, fromISODate(today));
  const weekday = fromISODate(day).toLocaleDateString(undefined, big ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', day: 'numeric' });
  const tasks = [...(stuff?.prep ?? []), ...(stuff?.todos ?? [])];
  const repeats = stuff?.repeats ?? [];
  const empty = !meals.length && !tasks.length && !overdue.length && !repeats.length;
  return (
    <section className={`day cal-day${day === today ? ' is-today' : ''}`} aria-label={`${label}, ${weekday}`}>
      <h2 className="day-h">
        {['Today', 'Tomorrow', 'Yesterday'].includes(label) ? <>{label} <span className="soft small">{weekday}</span></> : weekday}
      </h2>
      <div className="panel">
        {types.map((mt) => (
          <div key={mt.id} className="meal-row">
            <span className="meal-type">{mt.name}{mt.usual_time ? <span className="meal-time"> {timeLabel(mt.usual_time)}</span> : null}</span>
            <span className="grow dish-chips">
              {meals.filter((m) => m.meal_type_id === mt.id).map((m) => (
                <button key={m.id} className="dish-chip" onClick={() => setOpen(m)}>
                  {(m.dish_id && index.dishById.get(m.dish_id)?.name) || 'A dish you removed'}
                </button>
              ))}
            </span>
          </div>
        ))}
        {tasks.map((k) => <TaskRow key={k.id} task={k} data={data} index={index} reload={reload} family={family} />)}
        {repeats.map((k) => (
          <div key={`r-${k.id}`} className="check-row task-row repeat-row">
            <span aria-hidden="true" style={{ width: 22, textAlign: 'center' }}>↻</span>
            <span className="grow">{k.title}
              <span className="meta" style={{ display: 'block' }}>{repeatLabel({ unit: k.repeat_unit as RepeatUnit, every: k.repeat_every! })}. Appears once the earlier one is done</span></span>
          </div>
        ))}
        {overdue.length > 0 && <div className="cal-sub">Still to do from earlier</div>}
        {overdue.map((k) => <TaskRow key={k.id} task={k} data={data} index={index} reload={reload} showDay family={family} />)}
        {empty && <p className="soft small cal-empty">Nothing planned.</p>}
        <div className="add-rows">
          <button className="list-row add-row" onClick={() => setAdding(true)}><Icon name="plus" />Add a meal</button>
          <button className="list-row add-row" onClick={() => setAddingTodo(true)}><Icon name="plus" />Add a to-do</button>
        </div>
      </div>
      {addingTodo && <TaskSheet family={family} task={null} initialDate={day} onClose={() => setAddingTodo(false)} reload={reload} />}
      {adding && <AddMealSheet family={family} data={data} index={index} date={day} onClose={() => setAdding(false)} reload={reload} />}
      {open && <PlannedMealSheet family={family} data={data} index={index} planned={open} onClose={() => setOpen(null)} reload={reload} />}
    </section>
  );
}
