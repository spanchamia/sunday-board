import { createClient } from '@supabase/supabase-js';
import type { Database } from './db.types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

/** Turn a Supabase error into a sentence a person can act on. */
export function explain(error: { message?: string } | null | undefined): string {
  const m = error?.message ?? 'Something went wrong.';
  if (/duplicate key|items_family_name|already exists/i.test(m)) return 'You already have something with that name.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No connection. Check your signal and try again.';
  if (/rate limit/i.test(m)) return 'Too many tries. Wait a minute, then try again.';
  if (/Token has expired|otp_expired|invalid.*otp/i.test(m)) return 'That code has expired or is wrong. Send a new one.';
  // New sign-ups are switched off in Supabase: only invited people can get in.
  if (/signups? not allowed|signup.*disabled/i.test(m)) return 'This email hasn’t been invited yet. Ask whoever runs your family’s Sunday Board to invite you.';
  return m;
}
