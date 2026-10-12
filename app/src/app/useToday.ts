import { useEffect, useState } from 'react';
import { today } from '../logic/dates';

/** Today's date, which rolls over at midnight (for a screen left on all day). */
export function useToday(): string {
  const [t, setT] = useState(today);
  useEffect(() => {
    const id = window.setInterval(() => setT((old) => (today() === old ? old : today())), 60_000);
    const onShow = () => { if (document.visibilityState === 'visible') setT(today()); };
    document.addEventListener('visibilitychange', onShow);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onShow); };
  }, []);
  return t;
}
