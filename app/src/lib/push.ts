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

/** Ask permission, subscribe this device and save it. Throws a readable message if it can't. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications weren’t allowed. You can allow them in this browser’s site settings.');
  const { data, error } = await supabase.functions.invoke('push', { body: { action: 'public-key' } });
  if (error || !data?.publicKey) throw new Error('Couldn’t reach the notification service. Try again in a moment.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.publicKey) as BufferSource });
  const j = sub.toJSON();
  const saved = await supabase.rpc('save_push_subscription', {
    p_endpoint: j.endpoint!, p_p256dh: j.keys!.p256dh!, p_auth: j.keys!.auth!,
    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (saved.error) throw saved.error;
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Turn notifications on first.');
  const { data, error } = await supabase.functions.invoke('push', { body: { action: 'test', endpoint: sub.endpoint } });
  if (error || !data?.ok) throw new Error('The test didn’t go through. Try turning notifications off and on again.');
}
