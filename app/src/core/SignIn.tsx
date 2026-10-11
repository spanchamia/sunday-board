import { useState, type FormEvent } from 'react';
import { explain, supabase } from '../lib/supabase';
import { GOOGLE_SIGN_IN_ENABLED } from '../lib/config';

/** Sign in with an emailed code (or the link in the same email), or with Google. */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(addr)) { setError('Enter your email address, like name@example.com.'); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setError(explain(error)); else setSentTo(addr);
  }

  async function checkCode(e: FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) { setError('Enter the code from the email.'); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: sentTo!, token, type: 'email' });
    setBusy(false);
    if (error) setError(explain(error));
  }

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setError(explain(error));
  }

  return (
    <main className="center-page">
      <div className="narrow stack">
        <img src="/icons/icon-192.png" alt="" width="64" height="64" style={{ borderRadius: 14 }} />
        <h1>Sunday Board</h1>
        <p className="soft">Your family’s items, meals and shopping, shared between your phones.</p>

        {!sentTo ? (
          <form className="stack" onSubmit={sendCode} noValidate>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" inputMode="email" autoComplete="email" autoFocus
                value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="name@example.com" />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary wide" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in code'}</button>
            {GOOGLE_SIGN_IN_ENABLED && (
              <button type="button" className="btn wide" onClick={google}>Continue with Google</button>
            )}
          </form>
        ) : (
          <form className="stack" onSubmit={checkCode} noValidate>
            <p>We sent an email to <strong>{sentTo}</strong>. Tap the sign-in link in it, on this device and in this browser. If the email shows a code instead, type it here.</p>
            <label className="field">
              <span>Code</span>
              <input className="input code-input" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={10}
                value={code} onChange={(e) => { setCode(e.target.value); setError(null); }} />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary wide" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button type="button" className="btn quiet wide" onClick={() => { setSentTo(null); setCode(''); setError(null); }}>
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
