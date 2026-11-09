import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Kid, SchoolClass, SchoolException, SchoolTerm } from '../lib/types';

export interface SchoolData { kids: Kid[]; terms: SchoolTerm[]; classes: SchoolClass[]; exceptions: SchoolException[] }

/** Every kid's timetable in the family, kept in sync between devices. */
export function useSchool(familyId: string) {
  const [data, setData] = useState<SchoolData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<number | undefined>(undefined);
  const reload = useCallback(async () => {
    const [kids, terms, classes, exceptions] = await Promise.all([
      supabase.from('kids').select('*').eq('family_id', familyId).order('sort').order('name'),
      supabase.from('school_terms').select('*').eq('family_id', familyId),
      supabase.from('school_classes').select('*').eq('family_id', familyId).order('starts_at').limit(2000),
      supabase.from('school_exceptions').select('*').eq('family_id', familyId).order('from_date').limit(1000),
    ]);
    const err = [kids, terms, classes, exceptions].find((r) => r.error)?.error;
    if (err) { setError(err.message); return; }
    setError(null);
    setData({ kids: kids.data ?? [], terms: terms.data ?? [], classes: classes.data ?? [], exceptions: exceptions.data ?? [] });
  }, [familyId]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const soon = () => { window.clearTimeout(pending.current); pending.current = window.setTimeout(() => void reload(), 250); };
    const ch = supabase.channel(`school-${familyId}`);
    for (const table of ['kids', 'school_terms', 'school_classes', 'school_exceptions'] as const) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, soon);
    }
    ch.subscribe();
    const onShow = () => { if (document.visibilityState === 'visible') soon(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { void supabase.removeChannel(ch); document.removeEventListener('visibilitychange', onShow); };
  }, [familyId, reload]);
  return { data, error, reload };
}
