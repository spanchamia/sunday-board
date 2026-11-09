import { useMemo, useState } from 'react';
import type { SchoolData } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { href } from '../../app/router';
import type { Kid, SchoolClass, SchoolTerm } from '../../lib/types';
import { timeLabel } from '../../logic/dates';
import { isoWeekday, overlaps, WEEKDAY_NAMES } from '../../logic/school';
import { Icon } from '../../ui/Icon';
import { ClassSheet, CopyDaySheet } from './SchoolSheets';

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Fill in the weekly table, one day at a time. The quick way: enter Monday,
 * "Copy Monday to…" the other days, then change what's different.
 */
export function TimetableEditor({ familyId, kid, term, data, reload }: {
  familyId: string; kid: Kid; term: SchoolTerm; data: SchoolData; reload: () => Promise<void>;
}) {
  const t = useToday();
  const [day, setDay] = useState(() => Math.min(isoWeekday(t), 5));
  const [open, setOpen] = useState<SchoolClass | 'new' | null>(null);
  const [copying, setCopying] = useState(false);
  const classes = useMemo(() => data.classes.filter((c) => c.term_id === term.id), [data.classes, term.id]);
  const todays = classes.filter((c) => c.weekday === day).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const clash = new Set(overlaps(todays).flat());
  const count = (d: number) => classes.filter((c) => c.weekday === d).length;
  const usedDays = ALL_DAYS.filter((d) => d <= 5 || count(d) > 0);

  return (
    <>
      <div className="school-head">
        <div className="grow">
          <h2 style={{ margin: 0 }}>{kid.name}’s timetable</h2>
          <p className="soft small" style={{ margin: 0 }}>{term.name}. The same every week.</p>
        </div>
        <a className="btn primary" href={href('school', kid.id)}>Done</a>
      </div>

      <div className="segmented school-days" role="group" aria-label="Day">
        {ALL_DAYS.map((d) => (
          <button key={d} aria-pressed={d === day} onClick={() => setDay(d)} aria-label={`${WEEKDAY_NAMES[d - 1]}, ${count(d)} ${count(d) === 1 ? 'class' : 'classes'}`}>
            {WEEKDAY_NAMES[d - 1]!.slice(0, 3)}<span className="day-count" aria-hidden="true">{count(d) || '–'}</span>
          </button>
        ))}
      </div>

      <section className="stack" aria-label={WEEKDAY_NAMES[day - 1]}>
        <h3 style={{ margin: 0 }}>{WEEKDAY_NAMES[day - 1]}</h3>
        <div className="panel">
          {todays.length === 0 && <p className="soft small cal-empty" style={{ paddingBottom: 'var(--s3)' }}>No classes on {WEEKDAY_NAMES[day - 1]}.</p>}
          {todays.map((c) => (
            <button key={c.id} className="list-row class-row" onClick={() => setOpen(c)}>
              <span className="class-time">{timeLabel(c.starts_at)}<span className="soft"> – {timeLabel(c.ends_at)}</span></span>
              <span className="grow class-title">{c.title}
                {(c.room || c.teacher) && <span className="meta" style={{ display: 'block' }}>{[c.room, c.teacher].filter(Boolean).join(' · ')}</span>}
                {clash.has(c.id) && <span className="meta warn" style={{ display: 'block' }}>Overlaps another class</span>}
              </span>
              <Icon name="chev" className="chev" />
            </button>
          ))}
          <div className="add-rows">
            <button className="list-row add-row" onClick={() => setOpen('new')}><Icon name="plus" />Add a class</button>
            {todays.length > 0 && <button className="list-row add-row" onClick={() => setCopying(true)}><Icon name="share" />Copy {WEEKDAY_NAMES[day - 1]} to…</button>}
          </div>
        </div>
      </section>

      {open && <ClassSheet familyId={familyId} termId={term.id} weekday={day} klass={open === 'new' ? null : open}
        startAt={todays.at(-1)?.ends_at.slice(0, 5)} onClose={() => setOpen(null)} onDone={reload} />}
      {copying && <CopyDaySheet familyId={familyId} termId={term.id} classes={classes} from={day} days={usedDays}
        onClose={() => setCopying(false)} onDone={reload} />}
    </>
  );
}
