import type { FamilyData } from '../../app/useFamily';
import { href } from '../../app/router';
import { usePlan } from '../../app/usePlan';
import { DishesView } from './DishesView';
import { WeekView } from './WeekView';

export type PlanView = 'week' | 'dishes';

/** The Plan tab: the week's meals and prep, and the family's dishes. */
export function PlanPage({ family, view }: { family: FamilyData; view: PlanView }) {
  const plan = usePlan(family.family.id);
  const views: { v: PlanView; label: string }[] = [
    { v: 'week', label: 'Week' }, { v: 'dishes', label: 'Dishes' },
  ];
  return (
    <div className="stack">
      <nav className="segmented" aria-label="Plan views">
        {views.map((x) => (
          <a key={x.v} href={href('meals', x.v === 'week' ? null : x.v)} aria-current={view === x.v ? 'page' : undefined}
            className="seg-link">{x.label}</a>
        ))}
      </nav>
      {plan.error && (
        <div className="notice stack">
          <p className="error">Couldn’t load your plan: {plan.error}</p>
          <button className="btn" onClick={() => void plan.reload()}>Try again</button>
        </div>
      )}
      {!plan.data || !plan.index ? (!plan.error && <p className="soft">Loading…</p>) : (
        <>
          {view === 'week' && <WeekView family={family} data={plan.data} index={plan.index} reload={plan.reload} />}
          {view === 'dishes' && <DishesView family={family} data={plan.data} index={plan.index} reload={plan.reload} />}
        </>
      )}
    </div>
  );
}
