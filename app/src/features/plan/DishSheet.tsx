import { useState, type FormEvent } from 'react';
import type { FamilyData } from '../../app/useFamily';
import type { PlanData, PlanIndex } from '../../app/usePlan';
import { archiveDish, saveDish, type DishDraft } from '../../commands/dishes';
import { addItem } from '../../commands/items';
import { explain } from '../../lib/supabase';
import type { Dish } from '../../lib/types';
import { norm, rankByName } from '../../logic/text';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { AddDishNeedsSheet } from '../list/AddDishNeedsSheet';

type Step = DishDraft['prepSteps'][number] & { key: string; amount: string; unit: 'hours' | 'days' };

/** Add or edit a dish: meal types, ingredients from My Home, prep steps, how often. */
export function DishSheet({ family, data, index, dish, initialName = '', initialMealTypeId = null, onClose, reload }: {
  family: FamilyData; data: PlanData; index: PlanIndex; dish: Dish | null;
  initialName?: string; initialMealTypeId?: string | null; onClose: () => void; reload: () => Promise<void>;
}) {
  const toast = useToast();
  const existingSteps = dish ? (index.stepsOfDish.get(dish.id) ?? []) : [];
  const [name, setName] = useState(dish?.name ?? initialName);
  const [mealTypeIds, setMealTypeIds] = useState<string[]>(dish ? (index.mealTypesOfDish.get(dish.id) ?? []) : initialMealTypeId ? [initialMealTypeId] : []);
  const [ingredients, setIngredients] = useState<{ itemId: string; amount: string | null }[]>(
    dish ? (index.ingredientsOfDish.get(dish.id) ?? []).map((i) => ({ itemId: i.item_id, amount: i.amount })) : []);
  const [steps, setSteps] = useState<Step[]>(existingSteps.map((s) => {
    const days = s.lead_minutes % 1440 === 0 && s.lead_minutes > 0;
    return { id: s.id, key: s.id, name: s.name, lead_minutes: s.lead_minutes, amount: String(days ? s.lead_minutes / 1440 : s.lead_minutes / 60), unit: days ? 'days' : 'hours' };
  }));
  const [weeks, setWeeks] = useState(dish?.make_every_days ? String(Math.round(dish.make_every_days / 7)) : '');
  const [weekdays, setWeekdays] = useState(dish?.weekdays_ok ?? true);
  const [weekends, setWeekends] = useState(dish?.weekends_ok ?? true);
  const [notes, setNotes] = useState(dish?.notes ?? '');
  const [ingQ, setIngQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraItems, setExtraItems] = useState(family.items);
  const [shop, setShop] = useState(false);

  const itemName = new Map(extraItems.map((i) => [i.id, i.name]));
  const chosen = new Set(ingredients.map((i) => i.itemId));
  const ingMatches = ingQ.trim() ? rankByName(extraItems.filter((i) => !chosen.has(i.id)), ingQ, (i) => i.name).slice(0, 6) : [];
  const ingExact = extraItems.some((i) => norm(i.name) === norm(ingQ));

  async function addNewItem() {
    try {
      const item = await addItem({ familyId: family.family.id, name: ingQ, categoryId: null, restockMode: null });
      setExtraItems([...extraItems, { ...item, mode: 'as_needed' }]);
      setIngredients([...ingredients, { itemId: item.id, amount: null }]);
      setIngQ('');
      toast(`${item.name} added to My Home (file it in a category later)`);
    } catch (e) { setError(explain(e as Error)); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Give the dish a name.'); return; }
    const w = weeks.trim() ? Number(weeks) : null;
    if (w !== null && (!Number.isFinite(w) || w < 1 || w > 104)) { setError('“Make about every” must be 1 to 104 weeks, or blank.'); return; }
    for (const s of steps) {
      const n = Number(s.amount);
      if (!s.name.trim()) { setError('Every prep step needs a name, like “Soak chana”.'); return; }
      if (!Number.isFinite(n) || n < 0 || (s.unit === 'days' ? n > 14 : n > 336)) { setError(`Check how long before “${s.name}” is (up to 14 days).`); return; }
    }
    if (!weekdays && !weekends) { setError('Choose weekdays, weekends, or both.'); return; }
    setBusy(true); setError(null);
    try {
      await saveDish(family.family.id, {
        id: dish?.id, name, notes, make_every_days: w ? w * 7 : null, weekdays_ok: weekdays, weekends_ok: weekends,
        mealTypeIds, ingredients,
        prepSteps: steps.map((s) => ({ id: s.id, name: s.name, lead_minutes: Math.round(Number(s.amount) * (s.unit === 'days' ? 1440 : 60)) })),
      }, existingSteps);
      await reload();
      toast(dish ? 'Saved' : `Added ${name.trim()}`);
      onClose();
    } catch (err) { setError(explain(err as Error)); setBusy(false); }
  }

  async function remove() {
    if (!dish || !window.confirm(`Remove ${dish.name}? Past plans keep it; it won’t be suggested again.`)) return;
    try { await archiveDish(dish.id); await reload(); toast(`Removed ${dish.name}`); onClose(); }
    catch (e) { setError(explain(e as Error)); }
  }

  const setStep = (key: string, patch: Partial<Step>) => setSteps(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  if (shop && dish) {
    return <AddDishNeedsSheet family={family} dishName={dish.name} itemIds={(index.ingredientsOfDish.get(dish.id) ?? []).map((i) => i.item_id)}
      reason={{ kind: 'dish', dishId: dish.id }} onClose={() => setShop(false)} />;
  }

  return (
    <Sheet title={dish ? dish.name : 'New dish'} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        {dish && (index.ingredientsOfDish.get(dish.id)?.length ?? 0) > 0 && (
          <button type="button" className="btn primary wide" onClick={() => setShop(true)}><Icon name="cart" />Add what it needs to the list</button>
        )}
        <label className="field"><span>Name</span>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} maxLength={80} autoFocus={!dish} />
        </label>

        <fieldset className="plain">
          <legend>Meals it’s for</legend>
          <div className="chips">
            {data.mealTypes.map((mt) => (
              <button key={mt.id} type="button" className="chip" aria-pressed={mealTypeIds.includes(mt.id)}
                onClick={() => setMealTypeIds(mealTypeIds.includes(mt.id) ? mealTypeIds.filter((x) => x !== mt.id) : [...mealTypeIds, mt.id])}>{mt.name}</button>
            ))}
          </div>
        </fieldset>

        <fieldset className="plain">
          <legend>Ingredients</legend>
          {ingredients.length > 0 && (
            <ul className="list panel">
              {ingredients.map((i) => (
                <li key={i.itemId} className="check-row">
                  <span className="grow">{itemName.get(i.itemId) ?? 'An item you removed'}</span>
                  <input className="input amount" aria-label={`Amount of ${itemName.get(i.itemId)}`} placeholder="Amount" value={i.amount ?? ''}
                    onChange={(e) => setIngredients(ingredients.map((x) => (x.itemId === i.itemId ? { ...x, amount: e.target.value } : x)))} maxLength={40} />
                  <button type="button" className="icon-btn" aria-label={`Remove ${itemName.get(i.itemId)}`}
                    onClick={() => setIngredients(ingredients.filter((x) => x.itemId !== i.itemId))}><Icon name="close" /></button>
                </li>
              ))}
            </ul>
          )}
          <input className="input" value={ingQ} onChange={(e) => setIngQ(e.target.value)} placeholder="Add an ingredient from My Home" style={{ marginTop: 8 }} />
          {ingQ.trim() && (
            <ul className="list panel" style={{ marginTop: 4 }}>
              {ingMatches.map((it) => (
                <li key={it.id}><button type="button" className="list-row" onClick={() => { setIngredients([...ingredients, { itemId: it.id, amount: null }]); setIngQ(''); }}>
                  <Icon name="plus" /><span className="grow">{it.name}</span></button></li>
              ))}
              {!ingExact && (
                <li><button type="button" className="list-row" onClick={() => void addNewItem()}><Icon name="plus" />
                  <span className="grow">Add “{ingQ.trim()}” to My Home</span></button></li>
              )}
            </ul>
          )}
          <span className="hint">Amounts are optional, e.g. “2 cups” or “1 bunch”.</span>
        </fieldset>

        <fieldset className="plain">
          <legend>Prep ahead</legend>
          {steps.map((s) => (
            <div key={s.key} className="step-row">
              <input className="input grow" aria-label="Prep step" placeholder="e.g. Soak chana" value={s.name} onChange={(e) => setStep(s.key, { name: e.target.value })} maxLength={80} />
              <input className="input amount" aria-label="How long before" inputMode="numeric" value={s.amount} onChange={(e) => setStep(s.key, { amount: e.target.value.replace(/[^\d.]/g, '') })} />
              <select className="input unit" aria-label="Hours or days" value={s.unit} onChange={(e) => setStep(s.key, { unit: e.target.value as Step['unit'] })}>
                <option value="hours">hours</option><option value="days">days</option>
              </select>
              <span className="before">before</span>
              <button type="button" className="icon-btn" aria-label={`Remove ${s.name || 'prep step'}`} onClick={() => setSteps(steps.filter((x) => x.key !== s.key))}><Icon name="close" /></button>
            </div>
          ))}
          <button type="button" className="btn quiet" onClick={() => setSteps([...steps, { key: crypto.randomUUID(), name: '', lead_minutes: 0, amount: '1', unit: 'days' }])}>
            <Icon name="plus" />Add a prep step</button>
          <span className="hint">When you plan this dish, each step becomes a reminder that many hours or days before the meal.</span>
        </fieldset>

        <label className="field"><span>Make about every … weeks</span>
          <input className="input" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value.replace(/\D/g, ''))} placeholder="Optional" />
          <span className="hint">Used for suggestions: it comes up again when it’s been a while.</span>
        </label>

        <fieldset className="plain">
          <legend>Good on</legend>
          <label className="check-row"><input type="checkbox" checked={weekdays} onChange={(e) => setWeekdays(e.target.checked)} />Weekdays</label>
          <label className="check-row"><input type="checkbox" checked={weekends} onChange={(e) => setWeekends(e.target.checked)} />Weekends</label>
        </fieldset>

        <label className="field"><span>Notes</span>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Optional: your family’s way of making it" />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Saving…' : dish ? 'Save' : 'Add dish'}</button>
        {dish && <button type="button" className="btn danger wide" onClick={() => void remove()}>Remove dish</button>}
      </form>
    </Sheet>
  );
}
