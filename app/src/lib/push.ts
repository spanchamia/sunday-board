// Phone notifications for this device (Web Push). The `push` Edge Function holds the
// signing keys and sends reminders; this file asks permission, subscribes the device
// and saves its push address for the family.
import { supabase } from './supabase';

export type PushSupport = 'ok' | 'ios-needs-home-screen' | 'unsupported';

export function pushSupport(): PushSupport {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (ios && !standalone) return 'ios-needs-home-screen';
  return has ? 'ok' : 'unsupported';
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ?? navigator.serviceWorker.register('/sw.js');
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function keyBytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function publicKey(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('push', { body: { action: 'public-key' } });
  if (error || !data?.publicKey) throw new Error('Couldn’t reach the notification service. Try again in a moment.');
  return data.publicKey as string;
}

async function save(sub: PushSubscription, replaces: string | null = null): Promise<void> {
  const j = sub.toJSON();
  const saved = await supabase.rpc('save_push_device', {
    p_endpoint: j.endpoint!, p_p256dh: j.keys!.p256dh!, p_auth: j.keys!.auth!,
    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...(replaces ? { p_replaces: replaces } : {}),
  });
  if (saved.error) throw saved.error;
}

/** Ask permission, subscribe this device and save it. Throws a readable message if it can't. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications weren’t allowed. You can allow them in this browser’s site settings.');
  const key = await publicKey();
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource });
  await save(sub);
}

/**
 * Keep this device's notifications working. Push services (Google, Apple) sometimes
 * retire a phone's address; the server then marks it gone. When the app opens, check
 * the server still has a live address for this device, and if not, get a fresh one
 * (settings such as the morning summary carry over). Quiet: never asks or shows anything.
 */
export async function syncPush(): Promise<'ok' | 'renewed' | 'off'> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return 'off';
  const sub = await currentSubscription();
  if (!sub) return 'off';
  const { data, error } = await supabase.from('push_subscriptions').select('gone_at').eq('endpoint', sub.endpoint).maybeSingle();
  if (error) return 'ok';                       // can't tell (offline): try again next time
  if (data && !data.gone_at) return 'ok';
  const old = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  const reg = await registration();
  const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(await publicKey()) as BufferSource });
  await save(fresh, old);
  return 'renewed';
}

let lastSync = 0;
/** syncPush at most every 10 minutes (called when the app opens or comes back to the front). */
export function syncPushSoon(): void {
  if (Date.now() - lastSync < 10 * 60_000) return;
  lastSync = Date.now();
  void syncPush().catch(() => { lastSync = 0; });
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** This device's morning summary time ('HH:MM'), or null when it's off. */
export async function getSummaryTime(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const { data } = await supabase.from('push_subscriptions').select('summary_time').eq('endpoint', sub.endpoint).maybeSingle();
  return data?.summary_time?.slice(0, 5) ?? null;
}

/** Turn this device's morning summary on at a time ('HH:MM'), or off (null). */
export async function setSummaryTime(time: string | null): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Turn notifications on first.');
  const { error } = await supabase.rpc('set_push_summary', { p_endpoint: sub.endpoint, p_time: time ? `${time}:00` : null });
  if (error) throw error;
}

export async function sendTestPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Turn notifications on first.');
  const { data, error } = await supabase.functions.invoke('push', { body: { action: 'test', endpoint: sub.endpoint } });
  if (error || !data?.ok) throw new Error('The test didn’t go through. Try turning notifications off and on again.');
}
