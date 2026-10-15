// Sunday Board push notifications (Supabase Edge Function, Deno).
//   POST {action:"tick"}        every minute from pg_cron: send due reminders and morning summaries
//   POST {action:"public-key"}  the public push key phones subscribe with
//   POST {action:"test", endpoint}  (signed in) send a test to this device
// Deployed with verify_jwt = false: "tick" and "public-key" reveal nothing and only
// ever send reminders that are genuinely due; "test" checks the caller's sign-in.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

let keysReady: Promise<{ public_key: string; private_key: string }> | null = null;
function keys() {
  keysReady ??= (async () => {
    let { data, error } = await db.rpc('push_keys');
    if (error) throw error;
    if (!data?.length) {
      const g = webpush.generateVAPIDKeys();
      const init = await db.rpc('push_keys_init', { p_public: g.publicKey, p_private: g.privateKey });
      if (init.error) throw init.error;
      ({ data, error } = await db.rpc('push_keys'));
      if (error) throw error;
    }
    const k = data![0] as { public_key: string; private_key: string };
    webpush.setVapidDetails('https://sunday-board.pages.dev', k.public_key, k.private_key);
    return k;
  })();
  keysReady.catch(() => { keysReady = null; });
  return keysReady;
}

interface Sub { endpoint: string; p256dh: string; auth: string; user_id: string }
async function send(sub: Sub, payload: Record<string, unknown>): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); // phone unsubscribed
    else console.error('push failed', code, (e as Error).message);
    return false;
  }
}

/** "Today at 6:00 PM", "Tomorrow", "Friday, Oct 16 at 9:00 AM" in the family's time zone. */
function whenText(dueOn: string, dueTime: string | null, tz: string): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const d = new Date(`${dueOn}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow'
    : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (!dueTime) return day;
  const [h, m] = dueTime.split(':').map(Number);
  const time = `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
  return `${day} at ${time}`;
}

async function tick() {
  const { data: due, error } = await db.rpc('push_due_reminders');
  if (error) throw error;
  let sent = 0;
  for (const r of (due ?? []) as Array<{ task_id: string; minutes_before: number; family_id: string; title: string;
    visibility: string; owner_id: string; due_on: string; due_time: string | null; is_prep: boolean; timezone: string }>) {
    // Claim it first so two runs can't both send it.
    const claim = await db.from('reminders_sent').insert({ task_id: r.task_id, minutes_before: r.minutes_before }).select('task_id');
    if (claim.error || !claim.data?.length) continue;
    let q = db.from('push_subscriptions').select('endpoint, p256dh, auth, user_id').eq('family_id', r.family_id);
    if (r.visibility === 'private') q = q.eq('user_id', r.owner_id);
    const { data: subs } = await q;
    if (!subs?.length) continue;
    await keys();
    const payload = {
      title: r.is_prep ? `Prep: ${r.title}` : r.title,
      body: r.minutes_before === 0 ? `Now: ${whenText(r.due_on, r.due_time, r.timezone)}` : whenText(r.due_on, r.due_time, r.timezone),
      tag: `${r.task_id}-${r.minutes_before}`,
      url: '/#/todos',
    };
    for (const s of subs as Sub[]) if (await send(s, payload)) sent++;
  }
  // Morning summaries: the database picks the devices due now, marks them sent for
  // today, and writes the text (today's meals, to-dos, overdue).
  const { data: summaries, error: e2 } = await db.rpc('push_claim_summaries');
  if (e2) throw e2;
  if (summaries?.length) await keys();
  for (const m of (summaries ?? []) as Array<{ endpoint: string; p256dh: string; auth: string; title: string; body: string }>) {
    if (await send({ endpoint: m.endpoint, p256dh: m.p256dh, auth: m.auth, user_id: '' },
      { title: m.title, body: m.body, tag: 'morning-summary', url: '/#/calendar' })) sent++;
  }
  return { due: due?.length ?? 0, summaries: summaries?.length ?? 0, sent };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'public-key') return json({ publicKey: (await keys()).public_key });
    if (body.action === 'test') {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      const { data: { user } } = await db.auth.getUser(token);
      if (!user) return json({ error: 'Sign in first' }, 401);
      const { data: sub } = await db.from('push_subscriptions').select('endpoint, p256dh, auth, user_id')
        .eq('endpoint', String(body.endpoint ?? '')).eq('user_id', user.id).maybeSingle();
      if (!sub) return json({ error: 'This device is not set up for notifications' }, 404);
      await keys();
      const ok = await send(sub as Sub, { title: 'Sunday Board', body: 'Notifications are working on this device.', tag: 'test', url: '/#/family' });
      return json({ ok });
    }
    return json(await tick());
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
