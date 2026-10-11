import { FamilyPage } from '../core/FamilyPage';
import { FamilySetup } from '../core/FamilySetup';
import { SignIn } from '../core/SignIn';
import { HomePage } from '../features/home/HomePage';
import { ComingSoon } from '../features/ComingSoon';
import { PlanPage, type PlanView } from '../features/plan/PlanPage';
import { Icon } from '../ui/Icon';
import { href, useRoute, type Route } from './router';
import { useFamily } from './useFamily';
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
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'error') return (
    <main className="center-page"><div className="narrow stack">
      <h1>Couldn’t load your family</h1><p className="error">{state.message}</p>
      <button className="btn primary wide" onClick={() => void reload()}>Try again</button>
    </div></main>
  );
  if (state.status === 'no-family') return <FamilySetup email={email} onDone={() => void reload()} />;
  const { data } = state;
  return (
    <div className="app">
      <main className="page">
        {route.tab === 'home' && <HomePage data={data} reload={reload} categoryId={route.id} />}
        {route.tab === 'list' && <ComingSoon title="Shopping list" text="The weekend shopping list arrives in build step 3: one list with reasons, “Have it”, and a split by store." />}
        {route.tab === 'meals' && <PlanPage family={data} view={(['dishes', 'todos'].includes(route.id ?? '') ? route.id : 'week') as PlanView} />}
        {route.tab === 'family' && <FamilyPage data={data} reload={reload} />}
      </main>
      <TabBar current={route.tab} />
    </div>
  );
}

function TabBar({ current }: { current: Route['tab'] }) {
  const tabs: { tab: Route['tab']; label: string; icon: string }[] = [
    { tab: 'home', label: 'My Home', icon: 'home' },
    { tab: 'list', label: 'List', icon: 'list' },
    { tab: 'meals', label: 'Plan', icon: 'calendar' },
    { tab: 'family', label: 'Family', icon: 'family' },
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <a key={t.tab} href={href(t.tab)} aria-current={current === t.tab ? 'page' : undefined}>
          <Icon name={t.icon} />{t.label}
        </a>
      ))}
    </nav>
  );
}

function Splash() {
  return <main className="center-page" aria-busy="true"><img src="/icons/icon-192.png" alt="Sunday Board is loading" width="72" height="72" style={{ borderRadius: 16 }} /></main>;
}
