/*
 * LMX Sync — сервер синхронізації для плагіна lmx_sync.js (Cloudflare Workers + D1).
 * Зберігає записи (закладки/лайки/історія/таймкоди/налаштування) окремо для кожного користувача за хешем його особистого коду.
 * Сервер нічого не знає про користувача, окрім хеша коду; доступ — лише за знанням коду. Злиття: перемагає запис із пізнішим t.
 */
const MAX_BODY = 1000000;      // байт у запиті
const MAX_OPS = 500;           // записів за один запит
const MAX_ROWS = 12000;        // записів на одного користувача
const MAX_V = 20000;           // символів у значенні
const PULL_LIMIT = 1000;       // записів у відповіді
const KEY_RE = /^[fts]:[A-Za-z0-9:_.-]{1,80}$/;
const UID_RE = /^[a-f0-9]{64}$/;
const DAY = 86400000;
const MAX_BACKUP = 6000000;    // символів у файлі резервної копії (Telegram приймає до 50 МБ)
const BACKUP_GAP = 60000;      // не частіше однієї копії на хвилину

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS) });
}

export async function handleSync(body, env, nowMs) {
  const now = nowMs || Date.now();
  if (!body || typeof body !== 'object') return [{ ok: 0, error: 'bad_request' }, 400];
  const u = body.u;
  if (typeof u !== 'string' || !UID_RE.test(u)) return [{ ok: 0, error: 'bad_user' }, 400];
  const ops = Array.isArray(body.ops) ? body.ops : [];
  if (ops.length > MAX_OPS) return [{ ok: 0, error: 'too_many_ops' }, 413];
  const since = Number(body.since);
  const pull = isFinite(since) && since >= 0;

  // перевірка записів
  const clean = [];
  for (const o of ops) {
    if (!o || typeof o.k !== 'string' || !KEY_RE.test(o.k)) return [{ ok: 0, error: 'bad_key' }, 400];
    const d = o.d ? 1 : 0;
    const v = d ? null : (typeof o.v === 'string' ? o.v : null);
    if (!d && (v === null || v.length > MAX_V)) return [{ ok: 0, error: 'bad_value' }, 400];
    let t = Math.floor(Number(o.t));
    if (!isFinite(t) || t < 0) t = 0;
    if (t > now + 300000) t = now + 300000; // годинник пристрою не має «перегнати» сервер більш ніж на 5 хв
    clean.push([u, o.k, v, t, d, now]);
  }

  if (clean.length) {
    const cnt = await env.DB.prepare('SELECT COUNT(*) AS c FROM kv WHERE u = ?').bind(u).first();
    if (cnt && cnt.c >= MAX_ROWS) return [{ ok: 0, error: 'quota' }, 413];
    const st = env.DB.prepare(
      'INSERT INTO kv (u, k, v, t, d, st) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(u, k) DO UPDATE SET v = excluded.v, t = excluded.t, d = excluded.d, st = excluded.st WHERE excluded.t > kv.t'
    );
    await env.DB.batch(clean.map((r) => st.bind(...r)));
  }

  let rows = [], more = false;
  if (pull) {
    const res = await env.DB.prepare('SELECT k, v, t, d, st FROM kv WHERE u = ? AND st > ? ORDER BY st ASC LIMIT ?').bind(u, since, PULL_LIMIT + 1).all();
    rows = (res && res.results) || [];
    if (rows.length > PULL_LIMIT) { more = true; rows = rows.slice(0, PULL_LIMIT); }
  }
  return [{ ok: 1, now, rows, more }, 200];
}


// ───────── Telegram-бот: видає й нагадує код синхронізації ─────────
// Потрібні змінні Worker: BOT_TOKEN (токен від BotFather), TG_SECRET (довільний секрет вебхука), необов'язково TG_MAX_USERS (за замовчуванням 100)
function genCode() {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length && out.length < 16; i++) if (arr[i] < 250) out += String(arr[i] % 10);
  return out.length === 16 ? out : genCode();
}
const pretty = (c) => c.replace(/(\d{4})(?=\d)/g, '$1-');
async function tgSend(env, chat, text) {
  await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' })
  });
}
export async function handleTg(update, env) {
  const m = update && update.message;
  if (!m || !m.chat || m.chat.type !== 'private' || typeof m.text !== 'string') return;
  const id = String(m.from && m.from.id || m.chat.id);
  const cmd = m.text.trim().split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
  let row = await env.DB.prepare('SELECT code FROM tg WHERE id = ?').bind(id).first();
  if (cmd === '/start' || cmd === '/code' || cmd === '/key') {
    if (!row) {
      const max = Number(env.TG_MAX_USERS || 100);
      const cnt = await env.DB.prepare('SELECT COUNT(*) AS c FROM tg').first();
      if (cnt && cnt.c >= max) { await tgSend(env, m.chat.id, 'Вибачте, зараз нові користувачі не приймаються.'); return; }
      const code = genCode();
      await env.DB.prepare('INSERT OR IGNORE INTO tg (id, code, created) VALUES (?, ?, ?)').bind(id, code, Date.now()).run();
      row = await env.DB.prepare('SELECT code FROM tg WHERE id = ?').bind(id).first();
    }
    await tgSend(env, m.chat.id,
      'Ваш код синхронізації LMX:\n\n<code>' + pretty(row.code) + '</code>\n\n' +
      'Lampa → Налаштування → LMX Sync → «Ввести код» (на кожному пристрої один і той самий код). ' +
      'Якщо забудете — напишіть мені /code, і я надішлю його знову. Нікому цей код не показуйте.');
  } else {
    await tgSend(env, m.chat.id, 'Команди: /code — показати ваш код синхронізації. Резервні копії закладок і таймкодів плагін надсилає сюди сам файлом; відновити їх можна в Lampa → LMX Sync → «Відновити з Telegram».');
  }
}

// ───────── Резервні копії в Telegram ─────────
// Копію приймаємо від плагіна й шлемо файлом у чат власника коду (бот знає його за кодом, виданим /start). Самі дані на сервері не зберігаються:
// у базі лишається лише file_id останнього файлу (запис k='b:tg'), щоб плагін міг попросити копію назад
async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function tgOwner(u, env) {
  const rs = await env.DB.prepare('SELECT id, code FROM tg').all();
  for (const r of ((rs && rs.results) || [])) if (await sha256hex('lmx-sync:v1:' + r.code) === u) return r;
  return null;
}
export async function handleBackup(body, env, nowMs, fetchFn) {
  const now = nowMs || Date.now();
  const f = fetchFn || fetch;
  if (!body || typeof body !== 'object' || typeof body.u !== 'string' || !UID_RE.test(body.u)) return [{ ok: 0, error: 'bad_user' }, 400];
  if (!env.BOT_TOKEN) return [{ ok: 0, error: 'no_bot' }, 503];
  const me = await tgOwner(body.u, env);
  if (!me) return [{ ok: 0, error: 'no_bot' }, 404];
  const row = await env.DB.prepare("SELECT v FROM kv WHERE u = ? AND k = 'b:tg'").bind(body.u).first();
  let meta = null;
  try { meta = row && row.v ? JSON.parse(row.v) : null; } catch (e) { meta = null; }
  const api = 'https://api.telegram.org/bot' + env.BOT_TOKEN;
  if (body.op === 'get') {
    if (!meta || !meta.id) return [{ ok: 0, error: 'no_backup' }, 404];
    const gf = await (await f(api + '/getFile?file_id=' + encodeURIComponent(meta.id))).json();
    if (!gf || !gf.ok || !gf.result || !gf.result.file_path) return [{ ok: 0, error: 'tg' }, 502];
    const file = await f('https://api.telegram.org/file/bot' + env.BOT_TOKEN + '/' + gf.result.file_path);
    if (!file.ok) return [{ ok: 0, error: 'tg' }, 502];
    return [{ ok: 1, data: await file.text(), t: meta.t, name: meta.name }, 200];
  }
  const data = body.data;
  if (typeof data !== 'string' || data.length < 2) return [{ ok: 0, error: 'bad_value' }, 400];
  if (data.length > MAX_BACKUP) return [{ ok: 0, error: 'too_large' }, 413];
  if (meta && meta.t && now - meta.t < BACKUP_GAP) return [{ ok: 0, error: 'too_often' }, 429];
  const d = new Date(now);
  const stamp = d.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const name = 'lmx-backup-' + stamp + '.json';
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 60).replace(/[<>&]/g, '') : '';
  const fd = new FormData();
  fd.append('chat_id', me.id);
  fd.append('caption', 'Резервна копія LMX Sync' + (reason ? ' (' + reason + ')' : ''));
  fd.append('document', new Blob([data], { type: 'application/json' }), name);
  const res = await (await f(api + '/sendDocument', { method: 'POST', body: fd })).json();
  if (!res || !res.ok || !res.result || !res.result.document) return [{ ok: 0, error: 'tg' }, 502];
  const info = JSON.stringify({ id: res.result.document.file_id, t: now, name, size: data.length });
  await env.DB.prepare(
    "INSERT INTO kv (u, k, v, t, d, st) VALUES (?, 'b:tg', ?, ?, 0, ?) ON CONFLICT(u, k) DO UPDATE SET v = excluded.v, t = excluded.t, d = 0, st = excluded.st"
  ).bind(body.u, info, now, now).run();
  return [{ ok: 1, t: now, size: data.length }, 200];
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/tg') {
      if (!env.BOT_TOKEN || !env.TG_SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== env.TG_SECRET) return json({ ok: 0, error: 'forbidden' }, 403);
      try { await handleTg(await req.json(), env); } catch (e) {}
      return json({ ok: 1 });
    }
    if (req.method === 'POST' && url.pathname === '/api/backup') {
      const blen = Number(req.headers.get('content-length') || 0);
      if (blen > MAX_BACKUP + 2000) return json({ ok: 0, error: 'too_large' }, 413);
      let bb;
      try { bb = JSON.parse(await req.text()); } catch (e) { return json({ ok: 0, error: 'bad_json' }, 400); }
      try { const [o, st] = await handleBackup(bb, env); return json(o, st); } catch (e) { return json({ ok: 0, error: 'server' }, 500); }
    }
    if (req.method === 'GET') return json({ ok: 1, service: 'lmx-sync' });
    if (req.method !== 'POST' || url.pathname !== '/api/sync') return json({ ok: 0, error: 'not_found' }, 404);
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_BODY) return json({ ok: 0, error: 'too_large' }, 413);
    let body;
    try {
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ ok: 0, error: 'too_large' }, 413);
      body = JSON.parse(text);
    } catch (e) { return json({ ok: 0, error: 'bad_json' }, 400); }
    try {
      const [out, status] = await handleSync(body, env);
      return json(out, status);
    } catch (e) { return json({ ok: 0, error: 'server' }, 500); }
  },

  // щоденне прибирання: видалені записи старші 90 днів і користувачі, які не заходили пів року
  async scheduled(event, env) {
    const now = Date.now();
    await env.DB.prepare('DELETE FROM kv WHERE d = 1 AND t < ?').bind(now - 90 * DAY).run();
    await env.DB.prepare('DELETE FROM kv WHERE u IN (SELECT u FROM kv GROUP BY u HAVING MAX(st) < ?)').bind(now - 180 * DAY).run();
  }
};
