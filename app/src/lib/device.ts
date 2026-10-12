// Settings for this device only (a phone vs. the kitchen tablet), kept in localStorage.
// Reads never throw: private mode or blocked storage just gives the default.
function read(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, v: string | null): void {
  try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch { /* ignore */ }
}

export type StartScreen = 'start' | 'calendar';
/** What the app opens on: the Home launcher, or the calendar (kitchen tablet). */
export const readStartScreen = (): StartScreen => (read('sb-start') === 'calendar' ? 'calendar' : 'start');
export const saveStartScreen = (v: StartScreen) => write('sb-start', v === 'start' ? null : v);

/** Hide my "Just me" to-dos on this device (a shared kitchen screen). */
export const readHidePrivate = (): boolean => read('sb-hide-private') === '1';
export const saveHidePrivate = (v: boolean) => write('sb-hide-private', v ? '1' : null);

export type CalendarView = 'week' | 'month';
export const readCalendarView = (): CalendarView => (read('sb-cal-view') === 'month' ? 'month' : 'week');
export const saveCalendarView = (v: CalendarView) => write('sb-cal-view', v === 'week' ? null : v);
