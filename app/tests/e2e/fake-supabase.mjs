// A tiny in-memory stand-in for Supabase's REST API, for browser tests of signed-in
// screens without touching the real database. Supports what the app uses: select with
// eq/is/gte/in filters, single/maybeSingle, insert/update/delete with returned rows,
// and the search_catalog RPC. Realtime and auth network calls are simply blocked.
import { randomUUID } from 'node:crypto';

export const PROJECT = 'https://ecgskwekeitfqtjvprao.supabase.co';
export const USER = { id: '00000000-0000-4000-8000-0000000000aa', email: 'test@example.com' };

/** Fake signed-in session, in the shape supabase-js keeps in localStorage. */
export function sessionStorageEntry() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', exp })}.sig`;
  return {
    key: 'sb-ecgskwekeitfqtjvprao-auth-token',
    value: JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: USER.id, email: USER.email, aud: 'authenticated', role: 'authenticated' } }),
  };
}

// Column defaults the real database fills in (only those the app relies on).
const DEFAULTS = {
  list_entries: { status: 'to_buy', amount_hint: 'usual', amount: null, store_id: null, closed_at: null },
  tasks: { done_at: null, visibility: 'family', due_time: null, planned_meal_id: null, prep_step_id: null, repeat_unit: null, repeat_every: null, series_id: null, remind_before: [] },
  items: { archived_at: null, restock_mode: null, restock_every_days: null, learned_every_days: null, usual_amount: null, notes: '' },
  dishes: { archived_at: null, notes: '' },
  item_events: { happened_on: new Date().toLocaleDateString('en-CA') },
};

function matches(row, params) {
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'or', 'on_conflict', 'columns'].includes(k)) continue;
    const [op, ...rest] = v.split('.');
    const val = rest.join('.');
    const cell = row[k];
    if (op === 'eq' && String(cell) !== val) return false;
    if (op === 'is' && val === 'null' && cell != null) return false;
    if (op === 'gte' && !(String(cell) >= val)) return false;
    if (op === 'lte' && !(String(cell) <= val)) return false;
    if (op === 'gt' && !(cell != null && String(cell) > val)) return false;
    if (op === 'lt' && !(cell != null && String(cell) < val)) return false;
    if (op === 'neq' && String(cell) === val) return false;
    if (op === 'in' && !val.replace(/[()"]/g, '').split(',').includes(String(cell))) return false;
  }
  return true;
}

/** Install the fake on a Playwright page. Returns the db and a log of writes. */
export async function installFake(page, db) {
  const writes = [];
  await page.route(/supabase\.co\/(realtime|auth)\//, (r) => r.abort());
  await page.route(`${PROJECT}/rest/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.replace('/rest/v1/', '');
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (table.startsWith('rpc/')) return json(200, []);
    db[table] ??= [];
    const method = req.method();
    if (method === 'HEAD') {
      // count-only requests ({ count: 'exact', head: true })
      const n = db[table].filter((r) => matches(r, params)).length;
      return route.fulfill({ status: 200, headers: { 'content-range': `*/${n}`, 'access-control-expose-headers': 'content-range' }, body: '' });
    }
    if (method === 'GET') {
      let rows = db[table].filter((r) => matches(r, params));
      // embedded select like catalog_items(*) is not needed by these tests
      if (wantsObject) return rows.length ? json(200, rows[0]) : json(406, { code: 'PGRST116', message: 'no rows' });
      return json(200, rows);
    }
    if (method === 'POST') {
      const body = JSON.parse(req.postData() ?? '[]');
      const list = (Array.isArray(body) ? body : [body]).map((r) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...DEFAULTS[table], ...r }));
      db[table].push(...list);
      writes.push({ method, table, rows: list });
      return wantsObject ? json(201, list[0]) : json(201, list);
    }
    if (method === 'PATCH') {
      const patch = JSON.parse(req.postData() ?? '{}');
      const hit = db[table].filter((r) => matches(r, params));
      hit.forEach((r) => Object.assign(r, patch));
      writes.push({ method, table, patch, count: hit.length });
      return wantsObject ? json(200, hit[0] ?? null) : json(200, hit);
    }
    if (method === 'DELETE') {
      const keep = db[table].filter((r) => !matches(r, params));
      writes.push({ method, table, count: db[table].length - keep.length });
      db[table] = keep;
      return json(200, []);
    }
    return json(405, {});
  });
  return writes;
}
