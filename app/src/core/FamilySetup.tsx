import { useState, type FormEvent } from 'react';
import { createFamily, joinFamily } from '../commands/family';
import { explain, supabase } from '../lib/supabase';

/** First sign-in: start a family, or join one with an invite code. */
export function FamilySetup({ email, onDone }: { email: string; onDone: () => void }) {
  const [mode, setMode] = useState<'start' | 'join'>('start');
  const [familyName, setFamilyName] = useState('');
  const [code, setCode] = useState('');
  const [myName, setMyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!myName.trim()) { setError('Enter your first name, so your family knows who added what.'); return; }
    if (mode === 'start' && !familyName.trim()) { setError('Give your family a name, like “The Patels”.'); return; }
    if (mode === 'join' && code.trim().length < 6) { setError('Enter the 8-letter invite code from your family member.'); return; }
    setBusy(true); setError(null);
    try {
      if (mode === 'start') await createFamily(familyName, myName); else await joinFamily(code, myName);
      onDone();
    } catch (err) {
      setError(explain(err as Error));
      setBusy(false);
    }
  }

  return (
    <main className="center-page">
      <form className="narrow stack" onSubmit={submit} noValidate>
        <h1>Set up your family</h1>
        <p className="soft">Signed in as {email}. Everything you add is shared with your family members.</p>
        <div className="segmented" role="group" aria-label="Start or join">
          <button type="button" aria-pressed={mode === 'start'} onClick={() => { setMode('start'); setError(null); }}>Start a family</button>
          <button type="button" aria-pressed={mode === 'join'} onClick={() => { setMode('join'); setError(null); }}>Join with a code</button>
        </div>
        {mode === 'start' ? (
          <label className="field">
            <span>Family name</span>
            <input className="input" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="The Patels" maxLength={80} />
          </label>
        ) : (
          <label className="field">
            <span>Invite code</span>
            <input className="input code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" />
            <span className="hint">Ask a family member: it’s on their Family page.</span>
          </label>
        )}
        <label className="field">
          <span>Your first name</span>
          <input className="input" value={myName} onChange={(e) => setMyName(e.target.value)} autoComplete="given-name" maxLength={60} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'One moment…' : mode === 'start' ? 'Start our family' : 'Join family'}</button>
        <button type="button" className="btn quiet wide" onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </form>
    </main>
  );
}
