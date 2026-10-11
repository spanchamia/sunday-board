import { useEffect, useState } from 'react';

// Hash routes keep hosting simple (no server rewrites) and work offline:
//   #/home            My Home top
//   #/home/<categoryId>
//   #/list  #/meals  #/family
export interface Route { tab: 'home' | 'list' | 'meals' | 'family'; id: string | null }

export function parseHash(hash: string): Route {
  const [tab, id] = hash.replace(/^#\/?/, '').split('/');
  const tabs = ['home', 'list', 'meals', 'family'] as const;
  const t = (tabs as readonly string[]).includes(tab ?? '') ? (tab as Route['tab']) : 'home';
  return { tab: t, id: id ? decodeURIComponent(id) : null };
}

export const href = (tab: Route['tab'], id?: string | null) => `#/${tab}${id ? `/${encodeURIComponent(id)}` : ''}`;

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
