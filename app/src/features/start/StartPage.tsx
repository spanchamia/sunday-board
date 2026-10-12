import type { Badges } from '../../app/useBadges';
import type { FamilyData } from '../../app/useFamily';
import { href } from '../../app/router';
import { childrenOf, descendantIds, rootOf } from '../../logic/tree';
import { Icon } from '../../ui/Icon';
import { TileIcon } from '../../ui/TileIcon';

interface Tile { key: string; label: string; icon: string; to: string; sub?: string; badge?: { n: number; kind: 'count' | 'alert'; label: string } }

/** The launcher: a big tile for each part of the app, with what needs attention. */
export function StartPage({ data, badges }: { data: FamilyData; badges: Badges | null }) {
  const root = rootOf(data.categories);
  const kitchen = root ? childrenOf(data.categories, root.id).find((c) => c.name.trim().toLowerCase() === 'kitchen') : undefined;
  const inKitchen = kitchen ? descendantIds(data.categories, kitchen.id) : new Set<string>();
  const kitchenItems = data.items.filter((i) => i.category_id && inKitchen.has(i.category_id)).length;
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const tiles: Tile[] = [
    ...(kitchen ? [{ key: 'kitchen', label: 'Kitchen', icon: 'kitchen', to: href('home', kitchen.id), sub: plural(kitchenItems, 'item') }] : []),
    { key: 'dishes', label: 'Dishes', icon: 'dishes', to: href('meals', 'dishes') },
    { key: 'plan', label: 'Meal plan', icon: 'plan', to: href('meals'),
      sub: badges ? (badges.todayMeals.length ? `Today: ${badges.todayMeals.join(', ')}` : 'Nothing planned today') : undefined },
    { key: 'list', label: 'Shopping list', icon: 'list', to: href('list'),
      sub: badges ? (badges.toBuy ? `${badges.toBuy} to buy` : 'All bought') : undefined,
      badge: badges?.toBuy ? { n: badges.toBuy, kind: 'count', label: `${badges.toBuy} to buy` } : undefined },
    { key: 'stores', label: 'Stores', icon: 'stores', to: href('stores'), sub: plural(data.stores.length, 'store') },
    { key: 'home', label: 'My Home', icon: 'home', to: href('home'), sub: plural(data.items.length, 'item') },
    { key: 'todos', label: 'To-dos', icon: 'todos', to: href('todos'),
      sub: badges ? (badges.todosDue ? `${badges.todosDue} due` : 'Nothing due') : undefined,
      badge: badges?.todosDue ? { n: badges.todosDue, kind: 'alert', label: `${badges.todosDue} due` } : undefined },
  ];

  return (
    <div className="stack">
      <div>
        <h1>{data.family.name}</h1>
        <p className="soft">{date}</p>
      </div>
      <ul className="tiles" aria-label="Sections">
        {tiles.map((t) => (
          <li key={t.key}>
            <a className="tile" href={t.to} aria-label={[t.label, t.sub].filter(Boolean).join(': ')}>
              {t.badge && (
                <span className={`tile-badge ${t.badge.kind}`} aria-hidden="true">
                  {t.badge.kind === 'alert' && <Icon name="bell" />}{t.badge.n}
                </span>
              )}
              <TileIcon name={t.icon} />
              <span className="tile-label">{t.label}</span>
              {t.sub && <span className="tile-sub">{t.sub}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
