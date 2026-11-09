import { useEffect, useMemo, useState } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { useSchool, type SchoolData } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { href } from '../../app/router';
import { readSchoolKid, saveSchoolKid } from '../../lib/device';
import type { Kid, SchoolClass, SchoolException, SchoolTerm } from '../../lib/types';
import { addDays, dayLabel, fromISODate, rangeLabel, timeLabel } from '../../logic/dates';
import { dayPlan, type DayPlan, schoolWeekStart, shownWeekdays, WEEKDAY_NAMES } from '../../logic/school';
import { Icon } from '../../ui/Icon';
import { ExceptionSheet, KidSheet, TermSheet } from './SchoolSheets';
import { TimetableEditor } from './TimetableEditor';

/**
 * Kids' school timetables: one weekly table per kid, the same every week, plus
 * exceptions (field trip, no school). Everyone in the family can see and edit them.
 * Kept apart from the family calendar on purpose.
 */
export function SchoolPage({ family, kidId, sub }: { family: FamilyData; kidId: string | null; sub: string | null }) {
  const familyId = family.family.id;
  const { data, error, reload } = useSchool(familyId);
  const [addingKid, setAddingKid] = useState(false);
  const [editingKid, setEditingKid] = useState<Kid | null>(null);

  const kid = data ? data.kids.find((k) => k.id === kidId) ?? data.kids.find((k) => k.id === readSchoolKid()) ?? data.kids[0] ?? null : null;
  useEffect(() => { if (kid) saveSchoolKid(kid.id); }, [kid]);
  const term = kid && data ? data.terms.find((t) => t.kid_id === kid.id) ?? null : null;

  if (error) return <div className="stack"><h1>School</h1><p className="error">Couldn’t load the timetables: {error}</p></div>;
  if (!data) return <div className="stack"><h1>School</h1><p className="soft">Loading…</p></div>;

  return (
    <div className="stack school">
      <h1>School</h1>
      {data.kids.length === 0 ? (
        <div className="notice stack">
          <p style={{ margin: 0 }}>Add each kid here, then fill in their weekly timetable once. It stays the same every week; add exceptions like a field trip when they come up.</p>
          <button className="btn primary" onClick={() => setAddingKid(true)}><Icon name="plus" /> Add a kid</button>
        </div>
      ) : (
        <div className="chips" role="group" aria-label="Kids">
          {data.kids.map((k) => (
            <a key={k.id} className="chip" href={href('school', k.id)} aria-pressed={k.id === kid?.id}
              aria-current={k.id === kid?.id ? 'page' : undefined}>{k.name}</a>
          ))}
          <button className="chip add" onClick={() => setAddingKid(true)}>+ Add a kid</button>
        </div>
      )}

      {kid && !term && (
        <div className="panel school-empty">
          <p style={{ margin: 0 }}><strong>{kid.name}</strong> doesn’t have a timetable yet.</p>
          <TermStart familyId={familyId} kid={kid} reload={reload} />
          <button className="link-btn small" onClick={() => setEditingKid(kid)}>Rename or remove {kid.name}</button>
        </div>
      )}

      {kid && term && sub === 'edit' && <TimetableEditor familyId={familyId} kid={kid} term={term} data={data} reload={reload} />}
      {kid && term && sub !== 'edit' && <WeekView familyId={familyId} kid={kid} term={term} data={data} reload={reload} onEditKid={() => setEditingKid(kid)} />}

      {addingKid && <KidSheet familyId={familyId} kid={null} count={data.kids.length} onClose={() => setAddingKid(false)}
        onDone={async (k) => { await reload(); if (k) window.location.hash = href('school', k.id); }} />}
      {editingKid && <KidSheet familyId={familyId} kid={editingKid} count={data.kids.length} onClose={() => setEditingKid(null)}
        onDone={async () => { await reload(); }} />}
    </div>
  );
}

function TermStart({ familyId, kid, reload }: { familyId: string; kid: Kid; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>Set up {kid.name}’s timetable</button>
      {open && <TermSheet familyId={familyId} kid={kid} term={null} fresh onClose={() => setOpen(false)}
        onDone={async () => { await reload(); window.location.hash = href('school', kid.id, 'edit'); }} />}
    </>
  );
}

function WeekView({ familyId, kid, term, data, reload, onEditKid }: {
  familyId: string; kid: Kid; term: SchoolTerm; data: SchoolData; reload: () => Promise<void>; onEditKid: () => void;
}) {
  const t = useToday();
  const [anchor, setAnchor] = useState<string | null>(null);
  const [exception, setException] = useState<SchoolException | 'new' | null>(null);
  const [termSheet, setTermSheet] = useState<'dates' | 'new' | null>(null);
  const [more, setMore] = useState(false);
  const monday = schoolWeekStart(anchor ?? t);
  const classes = useMemo(() => data.classes.filter((c) => c.term_id === term.id), [data.classes, term.id]);
  const exceptions = useMemo(() => data.exceptions.filter((x) => x.term_id === term.id), [data.exceptions, term.id]);
  const weekdays = shownWeekdays(classes);
  const days = weekdays.map((wd) => addDays(monday, wd - 1));
  const coming = exceptions.filter((x) => x.to_date >= t).sort((a, b) => a.from_date.localeCompare(b.from_date));
  const thisWeek = days.includes(t);
  const dates = [term.starts_on && `from ${dayLabel(term.starts_on)}`, term.ends_on && `to ${dayLabel(term.ends_on)}`].filter(Boolean).join(' ');

  return (
    <>
      <div className="school-head">
        <div className="grow">
          <h2 style={{ margin: 0 }}>{kid.name} · {term.name}</h2>
          {dates && <p className="soft small" style={{ margin: 0 }}>{dates.charAt(0).toUpperCase() + dates.slice(1)}</p>}
        </div>
        <a className="btn" href={href('school', kid.id, 'edit')}>Edit timetable</a>
        <button className="btn" onClick={() => setException('new')}>Add an exception</button>
        <button className="btn" aria-expanded={more} onClick={() => setMore((m) => !m)}>More</button>
      </div>
      {more && (
        <div className="row school-more">
          <button className="btn" onClick={() => setTermSheet('dates')}>Semester name and dates</button>
          <button className="btn" onClick={() => setTermSheet('new')}>New semester</button>
          <button className="btn" onClick={onEditKid}>Rename or remove {kid.name}</button>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="notice stack">
          <p style={{ margin: 0 }}>No classes yet. Fill in one day, then copy it to the other days and change what’s different.</p>
          <a className="btn primary" href={href('school', kid.id, 'edit')}>Fill in the timetable</a>
        </div>
      ) : (
        <>
          <div className="row">
            <button className="icon-btn" onClick={() => setAnchor(addDays(monday, -7))} aria-label="Previous week"><Icon name="back" /></button>
            <h3 className="grow cal-title" style={{ fontSize: 18, margin: 0 }}>{thisWeek ? 'This week' : `Week of ${rangeLabel(days[0]!, days.at(-1)!)}`}</h3>
            <button className="icon-btn" onClick={() => setAnchor(addDays(monday, 7))} aria-label="Next week"><Icon name="chev" /></button>
          </div>
          {!thisWeek && <button className="btn" style={{ alignSelf: 'center' }} onClick={() => setAnchor(null)}>Back to this week</button>}
          <div className="school-week" style={{ ['--days' as string]: days.length }}>
            {days.map((d) => <SchoolDay key={d} date={d} today={t} plan={dayPlan(d, term, classes, exceptions)} onException={setException} />)}
          </div>
        </>
      )}

      <section className="stack" aria-label="Coming up">
        <h3 className="small soft" style={{ margin: 0 }}>Exceptions coming up</h3>
        <div className="panel">
          {coming.length === 0 && <p className="soft small cal-empty" style={{ paddingBottom: 'var(--s3)' }}>None. Add field trips, days off and early pickups here.</p>}
          {coming.map((x) => (
            <button key={x.id} className="list-row" onClick={() => setException(x)}>
              <span className="grow">{x.title}
                <span className="meta" style={{ display: 'block' }}>
                  {x.from_date === x.to_date ? dayLabel(x.from_date) : `${dayLabel(x.from_date)} to ${dayLabel(x.to_date)}`}
                  {x.replaces_classes ? ', no usual classes' : ''}{x.note ? `. ${x.note}` : ''}
                </span>
              </span>
              <Icon name="chev" className="chev" />
            </button>
          ))}
          <button className="list-row add-row" onClick={() => setException('new')}><Icon name="plus" />Add an exception</button>
        </div>
      </section>

      {exception && <ExceptionSheet familyId={familyId} termId={term.id} kidName={kid.name}
        exception={exception === 'new' ? null : exception} initialDate={thisWeek ? t : monday}
        onClose={() => setException(null)} onDone={reload} />}
      {termSheet && <TermSheet familyId={familyId} kid={kid} term={term} fresh={termSheet === 'new'} onClose={() => setTermSheet(null)}
        onDone={async () => { await reload(); setMore(false); if (termSheet === 'new') window.location.hash = href('school', kid.id, 'edit'); }} />}
    </>
  );
}

function SchoolDay({ date, today, plan, onException }: {
  date: string; today: string; plan: DayPlan<SchoolClass, SchoolException>;
  onException: (x: SchoolException) => void;
}) {
  const label = dayLabel(date, fromISODate(today));
  const weekday = fromISODate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  const name = WEEKDAY_NAMES[((fromISODate(date).getDay() + 6) % 7)];
  return (
    <section className={`day cal-day school-day${date === today ? ' is-today' : ''}`} aria-label={`${name}, ${fromISODate(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`}>
      <h3 className="day-h">{label === 'Today' ? <>Today <span className="soft small">{weekday}</span></> : weekday}</h3>
      <div className="panel">
        {plan.off && (
          <button className="school-off" onClick={() => onException(plan.off!)}>
            <strong>{plan.off.title}</strong>{plan.off.note && <span className="meta" style={{ display: 'block' }}>{plan.off.note}</span>}
          </button>
        )}
        {plan.notes.map((x) => (
          <button key={x.id} className="school-note" onClick={() => onException(x)}>
            <strong>{x.title}</strong>{x.note ? `: ${x.note}` : ''}
          </button>
        ))}
        {plan.classes.map((c) => (
          <div key={c.id} className="class-row">
            <span className="class-time">{timeLabel(c.starts_at)}<span className="soft"> – {timeLabel(c.ends_at)}</span></span>
            <span className="grow class-title">{c.title}
              {(c.room || c.teacher) && <span className="meta" style={{ display: 'block' }}>{[c.room, c.teacher].filter(Boolean).join(' · ')}</span>}
            </span>
          </div>
        ))}
        {!plan.inTerm && <p className="soft small cal-empty" style={{ paddingBottom: 'var(--s3)' }}>Outside the semester.</p>}
        {plan.inTerm && !plan.off && !plan.classes.length && <p className="soft small cal-empty" style={{ paddingBottom: 'var(--s3)' }}>No classes.</p>}
      </div>
    </section>
  );
}
