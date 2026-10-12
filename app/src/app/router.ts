import { useEffect, useState } from 'react';
import { readStartScreen } from '../lib/device';

// Hash routes keep hosting simple (no server rewrites) and work offline:
//   #/  (or #/start)   the launcher: big tiles for every part of the app
//   #/home             My Home top;  #/home/<categoryId>
//   #/list  #/meals[/dishes]  #/calendar[/week|/month]  #/todos  #/stores  #/family
// An empty hash opens this device's chosen start screen (launcher or calendar).
export interface Route { tab: 'start' | 'home' | 'list' | 'meals' | 'calendar' | 'todos' | 'stores' | 'family'; id: string | null }

export function parseHash(hash: string, startScreen: Route['tab'] = 'start'): Route {
  const [tab, id] = hash.replace(/^#\/?/, '').split('/');
  if (!tab) return { tab: startScreen, id: null };
  // Old links to the to-dos inside Plan still work.
  if (tab === 'meals' && id === 'todos') return { tab: 'todos', id: null };
  const tabs = ['start', 'home', 'list', 'meals', 'calendar', 'todos', 'stores', 'family'] as const;
  const t = (tabs as readonly string[]).includes(tab ?? '') ? (tab as Route['tab']) : 'start';
  return { tab: t, id: id ? decodeURIComponent(id) : null };
}

export const href = (tab: Route['tab'], id?: string | null) => `#/${tab}${id ? `/${encodeURIComponent(id)}` : ''}`;

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash, readStartScreen()));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash, readStartScreen()));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
