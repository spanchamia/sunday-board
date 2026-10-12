import type { FamilyData } from '../../app/useFamily';
import { usePlan } from '../../app/usePlan';
import { TodosView } from '../plan/TodosView';

/** To-dos on their own tab: the family's (and your private) to-dos, prep reminders included. */
export function TodosPage({ family }: { family: FamilyData }) {
  const plan = usePlan(family.family.id);
  return (
    <div className="stack">
      {plan.error && (
        <div className="notice stack">
          <p className="error">Couldn’t load your to-dos: {plan.error}</p>
          <button className="btn" onClick={() => void plan.reload()}>Try again</button>
        </div>
      )}
      {!plan.data || !plan.index ? (!plan.error && <p className="soft">Loading…</p>)
        : <TodosView family={family} data={plan.data} index={plan.index} reload={plan.reload} />}
    </div>
  );
}
