import { useState } from 'react';
import type { FamilyData } from '../app/useFamily';
import { newInviteCode } from '../commands/family';
import { explain, supabase } from '../lib/supabase';
import { href } from '../app/router';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { ThemeSwitch } from '../ui/ThemeSwitch';

export function FamilyPage({ data }: { data: FamilyData }) {
  const toast = useToast();
  const [code, setCode] = useState(data.family.invite_code);
  const isOwner = data.me.role === 'owner';

  async function share() {
    const text = `Join our family on Sunday Board: open ${window.location.origin}, sign in, choose “Join with a code” and enter ${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Join our family', text }); } catch { /* closed the share sheet */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast('Invite copied');
    }
  }

  async function freshCode() {
    try { setCode(await newInviteCode()); toast('New invite code made. The old one no longer works.'); }
    catch (e) { toast(explain(e as Error)); }
  }

  return (
    <div className="stack">
      <h1>{data.family.name}</h1>

      <section className="stack" aria-labelledby="members-h">
        <h2 id="members-h">Members</h2>
        <ul className="list panel">
          {data.members.map((m) => (
            <li key={m.user_id} className="list-row">
              <span className="grow">{m.display_name || 'Someone'}{m.user_id === data.me.user_id ? ' (you)' : ''}</span>
              {m.role === 'owner' && <span className="meta">Started the family</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" aria-labelledby="invite-h">
        <h2 id="invite-h">Invite someone</h2>
        <p className="soft small">They sign in with their own email, choose “Join with a code”, and enter:</p>
        <p className="code-input" style={{ fontWeight: 700 }} aria-label={`Invite code ${code.split('').join(' ')}`}>{code}</p>
        <div className="row">
          <button className="btn primary grow" onClick={share}><Icon name="share" />Share invite</button>
          {isOwner && <button className="btn" onClick={freshCode}>New code</button>}
        </div>
      </section>

      <section className="stack" aria-labelledby="stores-h">
        <h2 id="stores-h">Stores</h2>
        <ul className="list panel"><li>
          <a className="list-row" href={href('stores')} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name="store" /><span className="grow">Your stores</span>
            <span className="meta">{data.stores.length}</span><Icon name="chev" className="chev" />
          </a>
        </li></ul>
      </section>

      <section className="stack" aria-labelledby="device-h">
        <h2 id="device-h">This device</h2>
        <ThemeSwitch />
      </section>

      <button className="btn wide" onClick={() => void supabase.auth.signOut()}>Sign out</button>

    </div>
  );
}
