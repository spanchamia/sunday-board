import { FamilyPage } from '../core/FamilyPage';
import { FamilySetup } from '../core/FamilySetup';
import { SignIn } from '../core/SignIn';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { HomePage } from '../features/home/HomePage';
import { PlanPage, type PlanView } from '../features/plan/PlanPage';
import { ListPage } from '../features/list/ListPage';
import { StartPage } from '../features/start/StartPage';
import { StoresPage } from '../features/stores/StoresPage';
import { TodosPage } from '../features/todos/TodosPage';
import { Icon } from '../ui/Icon';
import { href, useRoute, type Route } from './router';
import { useBadges, type Badges } from './useBadges';
import { useEffect } from 'react';
import { syncPushSoon } from '../lib/push';
import { useFamily, type FamilyData } from './useFamily';
import { useSession } from './useSession';

export function App() {
  const session = useSession();
  if (session === undefined) return <Splash />;
  if (!session) return <SignIn />;
  return <SignedIn userId={session.user.id} email={session.user.email ?? ''} />;
}

function SignedIn({ userId, email }: { userId: string; email: string }) {
  const { state, reload } = useFamily(userId);
  const route = useRoute();
  const familyId = state.status === 'ready' ? state.data.family.id : null;
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'error') return (
    <main className="center-page"><div className="narrow stack">
      <h1>Couldn’t load your family</h1><p className="error">{state.message}</p>
      <button className="btn primary wide" onClick={() => void reload()}>Try again</button>
    </div></main>
  );
  if (state.status === 'no-family') return <FamilySetup email={email} onDone={() => void reload()} />;
  return <Ready data={state.data} reload={reload} route={route} key={familyId} />;
}

function Ready({ data, reload, route }: { data: FamilyData; reload: () => Promise<void>; route: Route }) {
  const badges = useBadges(data.family.id);
  // Keep this device's notification address fresh (renewed quietly if the push service retired it).
  useEffect(() => {
    syncPushSoon();
    const onShow = () => { if (document.visibilityState === 'visible') syncPushSoon(); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);
  return (
    <div className="app">
      <main className={`page${route.tab === 'calendar' ? ' wide' : ''}`}>
        {route.tab === 'start' && <StartPage data={data} badges={badges} />}
        {route.tab === 'home' && <HomePage data={data} reload={reload} categoryId={route.id} />}
        {route.tab === 'list' && <ListPage family={data} reloadFamily={reload} />}
        {route.tab === 'meals' && <PlanPage family={data} view={(route.id === 'dishes' ? 'dishes' : 'week') as PlanView} />}
        {route.tab === 'calendar' && <CalendarPage family={data} viewParam={route.id} />}
        {route.tab === 'todos' && <TodosPage family={data} />}
        {route.tab === 'stores' && <StoresPage data={data} reload={reload} />}
        {route.tab === 'family' && <FamilyPage data={data} />}
      </main>
      <TabBar current={route.tab} badges={badges} />
    </div>
  );
}

function TabBar({ current, badges }: { current: Route['tab']; badges: Badges | null }) {
  const tabs: { tab: Route['tab']; label: string; icon: string; badge?: number }[] = [
    { tab: 'start', label: 'Home', icon: 'home' },
    { tab: 'list', label: 'List', icon: 'list' },
    { tab: 'meals', label: 'Plan', icon: 'calendar' },
    { tab: 'todos', label: 'To-dos', icon: 'todos', badge: badges?.todosDue },
    { tab: 'family', label: 'Family', icon: 'family' },
  ];
  // My Home and Stores are reached from the launcher, so they light up Home.
  const lit = current === 'home' || current === 'stores' ? 'start' : current === 'calendar' ? 'meals' : current;
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <a key={t.tab} href={href(t.tab)} aria-current={lit === t.tab ? 'page' : undefined}>
          <Icon name={t.icon} />{t.label}
          {!!t.badge && <span className="tab-badge" aria-label={`${t.badge} due`}>{t.badge}</span>}
        </a>
      ))}
    </nav>
  );
}

function Splash() {
  return <main className="center-page" aria-busy="true"><img src="/icons/icon-192.png" alt="Sunday Board is loading" width="72" height="72" style={{ borderRadius: 16 }} /></main>;
}
