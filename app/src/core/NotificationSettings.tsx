import { useEffect, useState } from 'react';
import { currentSubscription, disablePush, enablePush, getSummaryTime, pushSupport, sendTestPush, setSummaryTime } from '../lib/push';
import { useToast } from '../ui/Toast';

/** Turn reminders on or off for this phone, and send a test. */
export function NotificationSettings() {
  const toast = useToast();
  const support = pushSupport();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = support === 'ok' && Notification.permission === 'denied';

  const [summary, setSummary] = useState<string | null>(null);   // 'HH:MM' or null = off
  const [summaryAt, setSummaryAt] = useState('07:30');

  useEffect(() => { void currentSubscription().then((s) => setOn(!!s)).catch(() => setOn(false)); }, []);
  useEffect(() => {
    if (!on) return;
    void getSummaryTime().then((t) => { setSummary(t); if (t) setSummaryAt(t); }).catch(() => { /* shown as off */ });
  }, [on]);

  async function saveSummary(time: string | null) {
    setError(null);
    try {
      await setSummaryTime(time);
      setSummary(time);
      toast(time ? `Morning summary at ${clock(time)} on this device` : 'Morning summary off');
    } catch (e) { setError((e as Error).message); }
  }

  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true); setError(null);
    try { await fn(); toast(msg); setOn(!!(await currentSubscription())); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="field">
      <span>Notifications</span>
      {support === 'unsupported' ? (
        <p className="soft small">This browser can’t show notifications. Try Chrome on Android, or the Home Screen app on iPhone.</p>
      ) : support === 'ios-needs-home-screen' ? (
        <p className="soft small">On iPhone and iPad, add Sunday Board to your Home Screen (Share → Add to Home Screen), open it from there, then turn notifications on here.</p>
      ) : blocked ? (
        <p className="soft small">Notifications are blocked for this site. Allow them in the browser’s site settings, then come back here.</p>
      ) : on ? (
        <div className="stack">
          <p className="small">On for this device. To-do reminders and prep reminders will pop up here.</p>
          <div className="summary-box stack">
            <label className="check-row" style={{ padding: 0 }}>
              <input type="checkbox" checked={!!summary} onChange={(e) => void saveSummary(e.target.checked ? summaryAt : null)} />
              <span className="grow">Morning summary
                <span className="meta" style={{ display: 'block' }}>Today’s meals and to-dos, once a day.</span></span>
            </label>
            {summary && (
              <label className="row">
                <span>Send at</span>
                <input className="input" type="time" style={{ width: 150 }} value={summaryAt} aria-label="Morning summary time"
                  onChange={(e) => setSummaryAt(e.target.value)} />
                {summaryAt && summaryAt !== summary && (
                  <button type="button" className="btn primary" onClick={() => void saveSummary(summaryAt)}>Save</button>
                )}
              </label>
            )}
          </div>
          <div className="row">
            <button className="btn grow" disabled={busy} onClick={() => void run(sendTestPush, 'Test sent. It should pop up in a few seconds.')}>Send a test</button>
            <button className="btn quiet grow" disabled={busy} onClick={() => void run(disablePush, 'Notifications off for this device')}>Turn off</button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <button className="btn primary wide" disabled={busy || on === null} onClick={() => void run(enablePush, 'Notifications on')}>
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
          <span className="hint">Reminders for to-dos and prep, on this device. Family to-dos go to everyone who turns this on; “Just me” ones only to you.</span>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

/** '07:30' → '7:30 AM' */
function clock(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
}
