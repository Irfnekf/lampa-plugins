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
  } else if (cmd === '/notify') {
    if (!row) { await tgSend(env, m.chat.id, 'Спершу напишіть /start — я видам код синхронізації, і сповіщення почнуть працювати.'); return; }
    await ntfEnsure(env);
    const arg = (m.text.trim().split(/\s+/)[1] || '').toLowerCase();
    const u = await sha256hex('lmx-sync:v1:' + row.code);
    if (arg === 'off') {
      await env.DB.prepare('INSERT OR REPLACE INTO ntf (u, k, t, v) VALUES (?, ?, ?, ?)').bind(u, 'off', Date.now(), '1').run();
      await tgSend(env, m.chat.id, 'Сповіщення про нові серії й частини франшиз вимкнено. Увімкнути: /notify on');
    } else if (arg === 'on') {
      await env.DB.prepare('DELETE FROM ntf WHERE u = ? AND k = ?').bind(u, 'off').run();
      await tgSend(env, m.chat.id, 'Сповіщення увімкнено: надішлю, коли вийде нова серія серіалу з вашої історії чи нова частина франшизи, яку ви вже дивились. Вимкнути: /notify off');
    } else {
      const off = await env.DB.prepare('SELECT 1 AS x FROM ntf WHERE u = ? AND k = ?').bind(u, 'off').first();
      await tgSend(env, m.chat.id, 'Сповіщення про нові серії й частини франшиз зараз ' + (off ? 'вимкнено. Увімкнути: /notify on' : 'увімкнено. Вимкнути: /notify off'));
    }
  } else {
    await tgSend(env, m.chat.id, 'Команди: /code — показати ваш код синхронізації; /notify on|off — сповіщення про нові серії й частини франшиз. Резервні копії закладок і таймкодів плагін надсилає сюди сам файлом; відновити їх можна в Lampa → LMX Sync → «Відновити з Telegram».');
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

// ───────── Сповіщення про нові серії й нові частини франшиз ─────────
// Потрібна змінна Worker TMDB_KEY (ключ API v3 або токен v4 з themoviedb.org); без неї сповіщення просто не працюють.
// Раз на кілька годин (cron) беремо серіали й фільми з історії кожного користувача бота, питаємо TMDB і шлемо в його чат.
// Безкоштовний тариф Cloudflare дозволяє лише ~50 зовнішніх запитів за запуск, тому за запуск перевіряємо обмежену кількість
// назв — тих, що не перевірялись найдовше, так що черга рухається по колу.
const NTF_CATS = ['look', 'like', 'book', 'wath'];   // ті самі списки, що й у дзвіночку Lampa (історія не враховується)
const NTF_RECENT = 3 * DAY;        // про вихід серії сповіщаємо, якщо вона вийшла не раніше ніж 3 доби тому
const NTF_COL_BACK = 30 * DAY;     // про частину франшизи — якщо вона вийшла не раніше ніж 30 діб тому або ще попереду
const NTF_COL_AHEAD = 365 * DAY;

let ntfReady = false;
async function ntfEnsure(env) {
  if (ntfReady) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ntf (u TEXT NOT NULL, k TEXT NOT NULL, t INTEGER NOT NULL, v TEXT, PRIMARY KEY (u, k))').run();
  ntfReady = true;
}
function ymd(ms) { return new Date(ms).toISOString().slice(0, 10); }
function dayMs(s) { const t = Date.parse(String(s || '') + 'T00:00:00Z'); return isFinite(t) ? t : 0; }
function ruDate(s) { const p = String(s || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : ''; }
function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
export function ntfIsTv(c) { return !!c && (c.media_type === 'tv' || (!c.media_type && (c.name || c.first_air_date) && !c.title)); }

// Що написати про серіал (info — відповідь TMDB /tv/{id}); повертає [{key, text}]
export function ntfPlanTv(card, info, now, sent) {
  const out = [];
  if (!info || typeof info !== 'object') return out;
  const name = esc(info.name || card.name || card.original_name || '');
  const last = info.last_episode_to_air, next = info.next_episode_to_air;
  if (last && last.air_date) {
    const at = dayMs(last.air_date);
    const key = 'ep:' + card.id + ':' + last.season_number + ':' + last.episode_number;
    if (at && now - at <= NTF_RECENT && at <= now + DAY && !sent[key]) {
      out.push({ key, text: '🆕 <b>' + name + '</b>\nНова серія: S' + last.season_number + 'E' + last.episode_number + (last.name ? ' «' + esc(last.name) + '»' : '') + '\nВийшла ' + ruDate(last.air_date) });
    }
  }
  if (next && next.air_date && next.episode_number === 1) {
    const at = dayMs(next.air_date);
    const key = 'season:' + card.id + ':' + next.season_number;
    if (at && at >= now - DAY && at <= now + NTF_COL_AHEAD && !sent[key]) {
      out.push({ key, text: '📅 <b>' + name + '</b>\nСезон ' + next.season_number + ' стартує ' + ruDate(next.air_date) });
    }
  }
  return out;
}

// Нові частини франшизи (col — відповідь TMDB /collection/{id}, known — id фільмів, які користувач уже має в списках)
export function ntfPlanCol(col, known, now, sent) {
  const out = [];
  if (!col || !Array.isArray(col.parts)) return out;
  for (const p of col.parts) {
    if (!p || !p.id || known[p.id] || !p.release_date) continue;
    const at = dayMs(p.release_date), key = 'col:' + p.id;
    if (!at || at < now - NTF_COL_BACK || at > now + NTF_COL_AHEAD || sent[key]) continue;
    const future = at > now;
    out.push({ key, poster: p.poster_path || '', text: '🎬 <b>' + esc(p.title || p.original_title || '') + '</b>\nНова частина франшизи «' + esc(col.name || '') + '»\n' + (future ? 'Вихід: ' : 'Вийшов: ') + ruDate(p.release_date) });
  }
  return out;
}

async function tmdbGet(env, path, f) {
  const key = String(env.TMDB_KEY || '');
  const bearer = key.length > 40;
  const url = 'https://api.themoviedb.org/3' + path + (path.indexOf('?') < 0 ? '?' : '&') + 'language=uk-UA' + (bearer ? '' : '&api_key=' + encodeURIComponent(key));
  const r = await f(url, bearer ? { headers: { Authorization: 'Bearer ' + key } } : undefined);
  if (!r.ok) throw new Error('tmdb ' + r.status);
  return r.json();
}
async function tgPhoto(env, chat, photoPath, text, f) {
  const base = 'https://api.telegram.org/bot' + env.BOT_TOKEN;
  if (photoPath) {
    const r = await f(base + '/sendPhoto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, photo: 'https://image.tmdb.org/t/p/w500' + photoPath, caption: text, parse_mode: 'HTML' }) });
    if (r.ok) return;
  }
  await f(base + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' }) });
}

export async function runNotify(env, nowMs, fetchFn) {
  if (!env.TMDB_KEY || !env.BOT_TOKEN) return { skipped: 1 };
  const now = nowMs || Date.now(), f = fetchFn || fetch;
  let budget = Number(env.NTF_BUDGET || 22);
  await ntfEnsure(env);
  const users = ((await env.DB.prepare('SELECT id, code FROM tg').all()).results) || [];
  // список «що перевіряти» по всіх користувачах: найдавніше перевірені — першими
  const jobs = [];
  for (const us of users) {
    const u = await sha256hex('lmx-sync:v1:' + us.code);
    const off = await env.DB.prepare('SELECT 1 AS x FROM ntf WHERE u = ? AND k = ?').bind(u, 'off').first();
    if (off) continue;
    const rows = ((await env.DB.prepare("SELECT k, v FROM kv WHERE u = ? AND d = 0 AND (k LIKE 'f:look:%' OR k LIKE 'f:like:%' OR k LIKE 'f:book:%' OR k LIKE 'f:wath:%') LIMIT 600").bind(u).all()).results) || [];
    const known = {}, cards = {};
    for (const r of rows) {
      let c; try { c = JSON.parse(r.v); } catch (e) { continue; }
      if (!c || !c.id) continue;
      known[c.id] = 1;
      if (!cards[c.id]) cards[c.id] = c;
    }
    const chk = ((await env.DB.prepare("SELECT k, t FROM ntf WHERE u = ? AND k LIKE 'chk:%'").bind(u).all()).results) || {};
    const lastChk = {};
    for (const r of (Array.isArray(chk) ? chk : [])) lastChk[r.k] = r.t;
    const sentRows = ((await env.DB.prepare("SELECT k FROM ntf WHERE u = ? AND (k LIKE 'ep:%' OR k LIKE 'season:%' OR k LIKE 'col:%')").bind(u).all()).results) || [];
    const sent = {}; for (const r of sentRows) sent[r.k] = 1;
    for (const id of Object.keys(cards)) jobs.push({ u, chat: us.id, card: cards[id], known, sent, last: lastChk['chk:' + id] || 0 });
  }
  jobs.sort((a, b) => a.last - b.last);
  let sentN = 0, checked = 0;
  for (const j of jobs) {
    if (budget <= 0) break;
    const c = j.card;
    try {
      let plan = [];
      if (ntfIsTv(c)) {
        budget -= 1;
        plan = ntfPlanTv(c, await tmdbGet(env, '/tv/' + c.id, f), now, j.sent);
      } else {
        // фільм: франшиза (id колекції запам'ятовуємо, щоб не питати двічі)
        const cacheKey = 'cid:' + c.id;
        let row = await env.DB.prepare('SELECT v FROM ntf WHERE u = ? AND k = ?').bind(j.u, cacheKey).first();
        if (!row) {
          budget -= 1;
          const info = await tmdbGet(env, '/movie/' + c.id, f);
          const cid = info && info.belongs_to_collection ? String(info.belongs_to_collection.id) : '0';
          await env.DB.prepare('INSERT OR REPLACE INTO ntf (u, k, t, v) VALUES (?, ?, ?, ?)').bind(j.u, cacheKey, now, cid).run();
          row = { v: cid };
        }
        if (row.v && row.v !== '0') {
          if (budget <= 0) continue;
          budget -= 1;
          plan = ntfPlanCol(await tmdbGet(env, '/collection/' + row.v, f), j.known, now, j.sent);
        }
      }
      for (const n of plan) {
        if (j.sent[n.key]) continue;
        j.sent[n.key] = 1;
        await env.DB.prepare('INSERT OR IGNORE INTO ntf (u, k, t, v) VALUES (?, ?, ?, NULL)').bind(j.u, n.key, now).run();
        await tgPhoto(env, j.chat, n.poster || c.poster_path || '', n.text, f);
        sentN++;
      }
      await env.DB.prepare('INSERT OR REPLACE INTO ntf (u, k, t, v) VALUES (?, ?, ?, NULL)').bind(j.u, 'chk:' + c.id, now).run();
      checked++;
    } catch (e) { /* одна назва не має зупиняти решту */ }
  }
  return { jobs: jobs.length, checked, sent: sentN };
}

// ───────── Anitube: джерело для LMX Watch (аніме з українською озвучкою з anitube.in.ua) ─────────
// Відповідає у форматі «lite» (як джерела онлайн-плагінів Lampa): сезони, кнопки озвучок, серії. Плеєр Ashdi/Tortuga розбираємо до прямого m3u8.
// Працює лише з anitube.in.ua та відомими плеєрами — це не відкритий проксі.
const AT_BASE = 'https://anitube.in.ua';
const AT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const AT_PLAYER_HOST = /(^|\.)(ashdi\.vip|tortuga\.(wtf|tw|lol))$/i;
const AT_PLAYER_RANK = [/ashdi/i, /tortuga/i];

function atEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function atHtml(body) { return new Response(body, { headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, CORS) }); }
function atDecode(s) {
  return String(s || '').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}
function atNorm(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[’'`ʼ]/g, '')
    .replace(/\(?\s*(\d+)\s*(сезон|season|частина|part)\s*\)?/gi, ' ').replace(/\(?\s*(сезон|season|частина|part)\s*(\d+)\s*\)?/gi, ' ')
    .replace(/[^a-z0-9а-яіїєґ]+/gi, ' ').replace(/\s+/g, ' ').trim();
}
function atSeasonOf(t) {
  const m = String(t || '').match(/(\d+)\s*(?:-?й\s*)?(?:сезон|season)/i) || String(t || '').match(/(?:сезон|season)\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 1;
}
function atIsExtra(t) { return /(фільм|movie|ova|ona|спешл|special|спецвипуск|рекап|recap)/i.test(String(t || '')); }

// запит до anitube з кешем Cloudflare (щоб не смикати сайт на кожне відкриття)
async function atFetch(url, opt, ttl, ctx) {
  opt = opt || {};
  const cache = caches.default;
  const key = new Request('https://at-cache.local/' + encodeURIComponent((opt.method || 'GET') + ' ' + url + ' ' + (opt.body || '')));
  if (ttl) { const hit = await cache.match(key); if (hit) return hit.text(); }
  const headers = Object.assign({ 'User-Agent': AT_UA, 'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.5', 'Referer': AT_BASE + '/' }, opt.headers || {});
  const r = await fetch(url, { method: opt.method || 'GET', headers, body: opt.body, redirect: 'follow' });
  const text = await r.text();
  if (!r.ok) throw new Error('http ' + r.status);
  if (ttl && text) {
    const put = cache.put(key, new Response(text, { headers: { 'Cache-Control': 'max-age=' + ttl } }));
    if (ctx && ctx.waitUntil) ctx.waitUntil(put); else await put;
  }
  return text;
}

async function atSearch(q, ctx) {
  // японські ієрогліфи й знаки на зразок «－» пошук anitube не розуміє — лишаємо літери й цифри
  q = String(q || '').replace(/[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/g, ' ').replace(/[^0-9A-Za-z\u0400-\u04ff!?' -]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q || q.length < 2) return [];
  const body = new URLSearchParams({ do: 'search', subaction: 'search', search_start: '1', full_search: '0', result_from: '1', story: q }).toString();
  const html = await atFetch(AT_BASE + '/index.php?do=search', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 1800, ctx);
  const out = [];
  html.split(/<article\b/i).slice(1).forEach((chunk) => {
    const a = chunk.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a) return;
    const href = a[1].indexOf('http') === 0 ? a[1] : AT_BASE + a[1];
    if (!/anitube\.in\.ua\/\d+-/.test(href)) return;
    const title = atDecode(a[2].replace(/<[^>]+>/g, ''));
    const y = chunk.match(/Рік випуску[^:]*:[\s\S]{0,300}?(\d{4})/i);
    const kind = (chunk.match(/class="(ukr|sub|dubsub)"/i) || [])[1] || '';
    out.push({ href, title, year: y ? parseInt(y[1], 10) : 0, kind });
  });
  return out;
}

// схожість назви результату з назвами картки: точний збіг, входження або спільні слова (з урахуванням закінчень: «темний/темна», «бог/богиня»)
function atTokEq(a, b) {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= Math.min(4, a.length, b.length);
}
function atScore(title, names, href) {
  const parts = String(title).split(/\s+\/\s+|\s*\|\s*/).map(atNorm).filter(Boolean);
  // латинська назва часто є лише в адресі сторінки: /2977-virodok-bastard-bastard.html
  const slug = (String(href || '').match(/\/\d+-([a-z0-9-]+)\.html/i) || [])[1];
  if (slug) parts.push(slug.replace(/-/g, ' '));
  let best = 0;
  names.forEach((n) => {
    if (!n) return;
    parts.forEach((p) => {
      let s = 0;
      if (p === n) s = 1;
      else if ((p.indexOf(n) === 0 || n.indexOf(p) === 0) && Math.min(p.length, n.length) / Math.max(p.length, n.length) > 0.55) s = 0.85;
      else {
        const A = p.split(' ').filter((w) => w.length > 1), B = n.split(' ').filter((w) => w.length > 1);
        if (!A.length || !B.length) return;
        const used = {};
        let inter = 0;
        B.forEach((w) => { for (let k = 0; k < A.length; k++) if (!used[k] && atTokEq(A[k], w)) { used[k] = 1; inter++; break; } });
        const j = inter / Math.max(A.length, B.length), cover = inter / B.length;
        if (j >= 0.6) s = 0.6 + j * 0.2;
        // назва картки цілком є в назві чи адресі сторінки (адреса буває довшою: «virodok bastard bastard»)
        // (одне коротке слово-псевдонім — лише точний збіг: «TenSura» ≠ «Tensei» з «Mushoku Tensei», інакше Slime відкривав «Реінкарнацію безробітного»)
        else if (cover === 1 && B.join('').length >= 5 && (B.length > 1 || A.indexOf(B[0]) >= 0)) s = 0.7;
        // назва на сайті може бути зовсім іншим перекладом («Фрірен: після кінця пригоди» / «Фрірен, що проводжає в останню путь»):
        // збіг першого слова (від 4 літер) — слабка ознака; рік і сезон далі відсіють зайве
        else if (A[0] && B[0] && B[0].length >= 4 && atTokEq(A[0], B[0])) s = 0.62;
      }
      if (s > best) best = s;
    });
  });
  return best;
}

// додаткові назви з TMDB (англійська й альтернативні), якщо у Worker є ключ TMDB_KEY
async function atTmdbNames(env, id, serial, ctx) {
  if (!env || !env.TMDB_KEY || !/^\d+$/.test(String(id || ''))) return [];
  const kind = serial ? 'tv' : 'movie';
  try {
    const txt = await atFetch('https://api.themoviedb.org/3/' + kind + '/' + id + '?api_key=' + env.TMDB_KEY + '&language=en-US&append_to_response=alternative_titles', { headers: { Referer: '' } }, 86400, ctx);
    const j = JSON.parse(txt), out = [];
    if (j.name || j.title) out.push(j.name || j.title);
    const alt = (j.alternative_titles && (j.alternative_titles.results || j.alternative_titles.titles)) || [];
    alt.forEach((a) => { if (a && a.title && /^(US|GB|UA|JP)$/.test(a.iso_3166_1 || '') && /[a-zа-яіїєґ]/i.test(a.title)) out.push(a.title); });
    return out.slice(0, 4);
  } catch (e) { return []; }
}

// «ВАН ПІС (ЄДИНИЙ СКАРБ)» — дві назви в одній: додаємо й частину до дужок, і ту, що в дужках (інакше довга назва не збігалася з жодним результатом)
function atSplitNames(list) {
  const out = [];
  list.forEach((n) => {
    n = String(n || '').trim();
    if (!n) return;
    out.push(n);
    const m = n.match(/^(.*?)\s*[(\[]([^)\]]+)[)\]]\s*$/);
    if (m) { if (m[1].trim()) out.push(m[1].trim()); if (m[2].trim()) out.push(m[2].trim()); }
  });
  return out;
}
async function atFind(p, env, ctx) {
  const serial = p.serial === '1';
  const alt = String(p.alt || '').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 6).sort((a, b) => (/[\u0400-\u04ff]/.test(b) ? 1 : 0) - (/[\u0400-\u04ff]/.test(a) ? 1 : 0));
  const names = atSplitNames([p.title, p.original_title].concat(alt, alt.length ? [] : await atTmdbNames(env, p.id, serial, ctx)));
  const uniq = [];
  names.forEach((n) => { n = String(n || '').trim(); if (n && uniq.indexOf(n) < 0 && /[0-9A-Za-z\u0400-\u04ff]{2}/.test(n)) uniq.push(n); });
  const normNames = uniq.map(atNorm);
  const seen = {}, found = [];
  const lists = await Promise.all(uaQueries(uniq).map((q) => atSearch(q, ctx).catch(() => [])));
  lists.forEach((l) => l.forEach((r) => { if (!seen[r.href]) { seen[r.href] = 1; found.push(r); } }));
  const year = parseInt(p.year, 10) || 0;
  const good = found.map((r) => Object.assign(r, { score: atScore(r.title, normNames, r.href) })).filter((r) => r.score >= 0.6)
    // серіал: старіші за картку тайтли з такою ж назвою (давня OVA 1992 року при серіалі 2022-го) — не його сезони
    .filter((r) => !serial || !year || !r.year || r.year >= year - 1);
  if (!serial) {
    good.forEach((r) => { if (year && r.year && Math.abs(r.year - year) <= 1) r.score += 0.3; if (atIsExtra(r.title)) r.score += 0.1; });
    good.sort((a, b) => b.score - a.score);
    return { film: good[0] || null };
  }
  const seasons = {};
  good.filter((r) => !atIsExtra(r.title)).forEach((r) => {
    const s = atSeasonOf(r.title), cur = seasons[s];
    if (!cur || r.score > cur.score) seasons[s] = r;
  });
  return { seasons };
}

// розбір списку серій anitube: дерево «тип → студія → плеєр → серії» з playlists.php або старий RalodePlayer
function atPlayerName(labels, file) {
  for (let i = 0; i < labels.length; i++) if (/ashdi|tortuga|moon|monstro|mp4|sibnet|kodik|csst|плеєр|player/i.test(labels[i])) return labels[i];
  try { return new URL(file.indexOf('//') === 0 ? 'https:' + file : file).hostname; } catch (e) { return ''; }
}
function atFileUrl(f) { f = atDecode(f); return f.indexOf('//') === 0 ? 'https:' + f : f; }
function atPlayable(file) { try { return AT_PLAYER_HOST.test(new URL(file).hostname); } catch (e) { return false; } }
function atEpNum(name, idx) { const m = String(name || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : idx + 1; }

function atParseTree(html) {
  const labels = {}, eps = [];
  const re = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1], text = atDecode(m[2].replace(/<[^>]+>/g, ''));
    const id = (attrs.match(/data-id="([^"]+)"/) || [])[1];
    if (!id) continue;
    const file = (attrs.match(/data-file="([^"]+)"/) || [])[1];
    if (file) eps.push({ id, file: atFileUrl(file), name: text }); else labels[id] = text;
  }
  const voices = {};
  eps.forEach((e, i) => {
    const parts = e.id.split('_'), path = [];
    for (let k = 2; k <= parts.length; k++) { const l = labels[parts.slice(0, k).join('_')]; if (l) path.push(l); }
    const sub = path.some((l) => /субтитр/i.test(l));
    const player = atPlayerName(path, e.file);
    const vname = path.filter((l) => l !== player && !/^(озвуч(ення|ування)|субтитри|дубляж|багатоголос\S*)$/i.test(l)).join(' ') || (sub ? 'Субтитри' : 'Озвучення');
    const key = (sub ? 'sub:' : 'dub:') + vname;
    const v = voices[key] || (voices[key] = { name: sub ? vname + ' (субтитри)' : vname, sub, players: {} });
    (v.players[player] || (v.players[player] = [])).push({ n: atEpNum(e.name, i), name: e.name, file: e.file });
  });
  return voices;
}
function atParseRalode(page) {
  const m = page.match(/RalodePlayer\.init\(([\s\S]*?)\);\s*(?:<\/script>|\n)/);
  if (!m) return {};
  let args;
  try { args = JSON.parse('[' + m[1] + ']'); } catch (e) { return {}; }
  const voices = {};
  (args[0] || []).forEach((label, p) => {
    const list = (args[1] && args[1][p]) || [];
    const name = atDecode(String(label));
    const sub = /субтитр/i.test(name);
    const key = (sub ? 'sub:' : 'dub:') + name;
    const v = voices[key] || (voices[key] = { name, sub, players: {} });
    list.forEach((it, i) => {
      const src = (String(it.code || '').match(/src=["']([^"']+)["']/) || [])[1];
      if (!src) return;
      const file = atFileUrl(src), pl = atPlayerName([], file);
      (v.players[pl] || (v.players[pl] = [])).push({ n: atEpNum(it.name, i), name: atDecode(it.name), file });
    });
  });
  return voices;
}
// для кожної озвучки — один плеєр, який ми вміємо програти (Ashdi, далі Tortuga); озвучки без такого плеєра пропускаємо
function atPickVoices(voices) {
  const out = [];
  Object.keys(voices).forEach((k) => {
    const v = voices[k], names = Object.keys(v.players);
    let best = null, bestRank = 99;
    names.forEach((pn) => {
      const list = v.players[pn].filter((e) => atPlayable(e.file));
      if (!list.length) return;
      let r = AT_PLAYER_RANK.findIndex((rx) => rx.test(pn) || rx.test(list[0].file));
      if (r < 0) r = 50;
      if (r < bestRank || (r === bestRank && list.length > best.length)) { best = list; bestRank = r; }
    });
    if (!best) return;
    const byN = {};
    best.forEach((e) => { if (!byN[e.n]) byN[e.n] = e; });
    out.push({ name: v.name, sub: v.sub, eps: Object.keys(byN).map((n) => byN[n]).sort((a, b) => a.n - b.n) });
  });
  out.sort((a, b) => (a.sub ? 1 : 0) - (b.sub ? 1 : 0));
  return out;
}
async function atVoicesFor(href, ctx) {
  const page = await atFetch(href, {}, 1800, ctx);
  const newsId = (href.match(/\/(\d+)-/) || [])[1];
  const hash = (page.match(/dle_login_hash\s*=\s*['"]([^'"]*)['"]/) || [])[1] || '';
  let voices = {};
  if (newsId) {
    try {
      const txt = await atFetch(AT_BASE + '/engine/ajax/playlists.php?news_id=' + newsId + '&xfield=playlist&user_hash=' + encodeURIComponent(hash),
        { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/javascript, */*; q=0.01', 'Referer': href } }, 900, ctx);
      const j = JSON.parse(txt);
      if (j && j.success && j.response) voices = atParseTree(String(j.response));
    } catch (e) {}
  }
  if (!Object.keys(voices).length) voices = atParseRalode(page);
  return atPickVoices(voices);
}

function atItem(cls, json, attrs, inner) {
  return '<div class="' + cls + ' selector"' + (attrs || '') + ' data-json="' + atEsc(JSON.stringify(json)) + '">' + inner + '</div>';
}

async function handleAnitube(url, env, ctx) {
  const self = url.origin + '/lite/anitube';
  if (url.pathname === '/lite/anitube/video') {
    const u = url.searchParams.get('u') || '';
    if (!atPlayable(u)) return json({ error: 'bad_player' }, 400);
    try {
      const page = await atFetch(u, { headers: { Referer: AT_BASE + '/' } }, 0, ctx);
      const raw = (page.match(/\bfile\s*:\s*"([^"]+)"/) || page.match(/\bfile\s*:\s*'([^']+)'/) || page.match(/["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/) || [])[1];
      // діагностика: що віддав плеєр, якщо посилання на відео не знайшли (заголовок сторінки й розмір)
      if (!raw) return json({ error: 'no_file', len: page.length, title: ((page.match(/<title[^>]*>([^<]*)/i) || [])[1] || '').slice(0, 80), head: page.replace(/\s+/g, ' ').slice(0, 200) }, 404);
      const fix = (s) => (s.indexOf('//') === 0 ? 'https:' + s : s).trim();
      const quality = {};
      let main = '';
      if (/^\s*\[/.test(raw)) {
        raw.split(',').forEach((part) => { const q = part.match(/^\s*\[([^\]]+)\]\s*(\S+)/); if (q) quality[q[1]] = fix(q[2]); });
        const ks = Object.keys(quality).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
        main = ks.length ? quality[ks[0]] : '';
      } else main = fix(raw);
      if (!main) return json({ error: 'no_file' }, 404);
      return json({ method: 'play', url: main, quality: Object.keys(quality).length ? quality : undefined, title: url.searchParams.get('t') || '' });
    } catch (e) { return json({ error: 'player_unreachable' }, 502); }
  }

  const p = {};
  ['id', 'title', 'original_title', 'year', 'serial', 'alt'].forEach((k) => { p[k] = url.searchParams.get(k) || ''; });
  const keep = new URLSearchParams();
  ['id', 'title', 'original_title', 'year', 'serial'].forEach((k) => { if (p[k]) keep.set(k, p[k]); });
  const link = (extra) => { const q = new URLSearchParams(keep); Object.keys(extra).forEach((k) => q.set(k, extra[k])); return self + '?' + q.toString(); };
  const serial = p.serial === '1';
  // JSON для плагіна LMX Anitube (власна кнопка й екран): fmt=json → сезони/фільм; fmt=json&ath=… → озвучки й серії
  if (url.searchParams.get('fmt') === 'json') {
    try {
      const ath = url.searchParams.get('ath') || '';
      if (ath) {
        if (!/^https:\/\/anitube\.in\.ua\/\d+-/.test(ath)) return json({ error: 'bad_href' }, 400);
        const voices = await atVoicesFor(ath, ctx);
        return json({ voices: voices.map((v) => ({ name: v.name, sub: v.sub, eps: v.eps.map((e) => ({ n: e.n, file: e.file })) })) });
      }
      const f = await atFind(p, env, ctx);
      if (!serial) return json({ film: f.film ? { href: f.film.href, title: f.film.title } : null });
      return json({ seasons: Object.keys(f.seasons).map(Number).sort((a, b) => a - b).map((n) => ({ n, href: f.seasons[n].href, title: f.seasons[n].title })) });
    } catch (e) { return json({ error: 'unavailable' }, 502); }
  }
  try {
    let href = url.searchParams.get('ath') || '';
    let season = parseInt(url.searchParams.get('ats') || '0', 10) || 0;
    if (href && !/^https:\/\/anitube\.in\.ua\/\d+-/.test(href)) href = '';
    if (!href) {
      const f = await atFind(p, env, ctx);
      if (!serial) {
        if (!f.film) return atHtml('<div class="online-empty">Нічого не знайдено на Anitube</div>');
        href = f.film.href;
      } else {
        const ss = Object.keys(f.seasons).map(Number).sort((a, b) => a - b);
        if (!ss.length) return atHtml('<div class="online-empty">Нічого не знайдено на Anitube</div>');
        if (ss.length > 1) {
          return atHtml(ss.map((s) => atItem('videos__item videos__season', { method: 'link', url: link({ ath: f.seasons[s].href, ats: String(s) }) }, '',
            '<div class="videos__season-layers"></div><div class="videos__item-imgbox videos__season-imgbox"><div class="videos__item-title videos__season-title">' + s + ' сезон</div></div>')).join(''));
        }
        season = ss[0];
        href = f.seasons[ss[0]].href;
      }
    }
    if (!season) season = serial ? 1 : 0;
    const voices = await atVoicesFor(href, ctx);
    if (!voices.length) return atHtml('<div class="online-empty">Нічого не знайдено на Anitube (немає серій у підтримуваному плеєрі)</div>');
    const want = url.searchParams.get('atv');
    let vi = want == null ? 0 : Math.max(0, Math.min(voices.length - 1, parseInt(want, 10) || 0));
    const callUrl = (e, v) => url.origin + '/lite/anitube/video?u=' + encodeURIComponent(e.file) + '&t=' + encodeURIComponent(v.name);
    if (!serial) {
      return atHtml(voices.map((v) => atItem('videos__item videos__movie', { method: 'call', url: callUrl(v.eps[0], v), title: v.name, voice_name: v.name }, ' media=""',
        '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">' + atEsc(v.name) + '</div>')).join(''));
    }
    const buttons = voices.length > 1 ? voices.map((v, i) => '<div class="videos__button selector' + (i === vi ? ' active' : '') + '" data-json="' +
      atEsc(JSON.stringify({ method: 'link', url: link({ ath: href, ats: String(season), atv: String(i) }) })) + '">' + atEsc(v.name) + '</div>').join('') : '';
    const v = voices[vi];
    const eps = v.eps.map((e) => atItem('videos__item videos__movie', { method: 'call', url: callUrl(e, v), title: 'Серія ' + e.n, voice_name: v.name }, ' media="" s="' + season + '" e="' + e.n + '"',
      '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">Серія ' + e.n + '</div>')).join('');
    return atHtml(buttons + eps);
  } catch (e) {
    return atHtml('<div class="online-empty">Anitube зараз недоступний</div>');
  }
}

// ───────── LMX UA: кілька українських джерел в одному екрані «Онлайн» (Anitube, AnimeON, Mikai — аніме; Eneyida — фільми й серіали) ─────────
// Екран (стандартний «Онлайн» з LMX Anitube) питає /lite/events — список джерел, потім /lite/<джерело> — сезони, озвучки, серії.
// Плеєри Ashdi/Tortuga показують відео лише для України, тож сторінку плеєра розбирає сам пристрій: такі посилання ведуть на /lite/video і /lite/pl.
const UA_SOURCES = {
  anitube: { name: 'Anitube', anime: true },
  animeon: { name: 'AnimeON', anime: true },
  mikai: { name: 'Mikai', anime: true },
  eneyida: { name: 'Eneyida', anime: false },
  bamboo: { name: 'BambooUA', anime: false, asia: true },
  unimay: { name: 'Unimay', anime: true },
  uafix: { name: 'UAFlix', anime: false }
};
// дорами (BambooUA): лише азійські мови оригіналу
function uaIsAsia(p) { return /^(ko|zh|cn|th|vi|tl|ja|id|ms|tw)$/.test(p.original_language || ''); }
function uaIsAnime(p) { return p.anime === '1' || /^(ja|zh)$/.test(p.original_language || ''); }
function uaParams(url) {
  const p = {};
  ['id', 'title', 'original_title', 'year', 'serial', 'original_language', 'anime', 'imdb_id', 'alt'].forEach((k) => { p[k] = url.searchParams.get(k) || ''; });
  return p;
}
// що шукати на сайтах: повні назви, а для довгих — ще й коротка частина (до двокрапки чи перше слово): пошук сайтів на DLE не знаходить довгих чужих перекладів
function uaQueries(names) {
  const out = [];
  const low = [];
  const push = (q) => { q = String(q || '').replace(/[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/g, ' ').replace(/\s+/g, ' ').trim(); if (q.length >= 2 && low.indexOf(q.toLowerCase()) < 0) { low.push(q.toLowerCase()); out.push(q); } };
  names.forEach(push);
  names.slice(0, 1).concat(names.filter((n) => /[A-Za-z]/.test(n)).slice(0, 1)).forEach((n) => {
    const head = String(n || '').split(/[:,.(—–-]/)[0].trim();
    if (head && head !== n) push(head);
    const w = head.split(/\s+/)[0];
    if (w && w.length >= 4 && w !== head) push(w);
  });
  return out.slice(0, 6);
}
async function uaNames(p, env, ctx) {
  const alt = String(p.alt || '').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 6).sort((a, b) => (/[\u0400-\u04ff]/.test(b) ? 1 : 0) - (/[\u0400-\u04ff]/.test(a) ? 1 : 0));
  const names = atSplitNames([p.title, p.original_title].concat(alt, alt.length ? [] : await atTmdbNames(env, p.id, p.serial === '1', ctx)));
  const uniq = [];
  names.forEach((n) => { n = String(n || '').trim(); if (n && uniq.indexOf(n) < 0 && /[0-9A-Za-zЀ-ӿ]{2}/.test(n)) uniq.push(n); });
  return uniq;
}
function uaLink(self, p, extra) {
  const q = new URLSearchParams();
  ['id', 'title', 'original_title', 'year', 'serial'].forEach((k) => { if (p[k]) q.set(k, p[k]); });
  Object.keys(extra).forEach((k) => q.set(k, extra[k]));
  return self + '?' + q.toString();
}
function uaEmpty(name) { return atHtml('<div class="online-empty">Нічого не знайдено на ' + atEsc(name) + '</div>'); }
function uaSeasons(list, mk) {
  return atHtml(list.map((s) => atItem('videos__item videos__season', { method: 'link', url: mk(s) }, '',
    '<div class="videos__season-layers"></div><div class="videos__item-imgbox videos__season-imgbox"><div class="videos__item-title videos__season-title">' + s.n + ' сезон</div></div>')).join(''));
}
// voices: [{ name, eps: [{ n, file }] }] → кнопки озвучок + серії (відео — через /lite/video, його розбере пристрій)
function uaEpisodes(origin, self, p, voices, vi, season, extra, serial) {
  if (!voices.length) return null;
  vi = Math.max(0, Math.min(voices.length - 1, vi || 0));
  const callUrl = (e, v) => origin + '/lite/video?u=' + encodeURIComponent(e.file) + '&t=' + encodeURIComponent(v.name);
  if (!serial) {
    return atHtml(voices.map((v) => atItem('videos__item videos__movie', { method: 'call', url: callUrl(v.eps[0], v), title: v.name, voice_name: v.name }, ' media=""',
      '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">' + atEsc(v.name) + '</div>')).join(''));
  }
  const buttons = voices.length > 1 ? voices.map((v, i) => '<div class="videos__button selector' + (i === vi ? ' active' : '') + '" data-json="' +
    atEsc(JSON.stringify({ method: 'link', url: uaLink(self, p, Object.assign({}, extra, { atv: String(i) })) })) + '">' + atEsc(v.name) + '</div>').join('') : '';
  const v = voices[vi];
  return atHtml(buttons + v.eps.map((e) => atItem('videos__item videos__movie', { method: 'call', url: callUrl(e, v), title: 'Серія ' + e.n, voice_name: v.name }, ' media="" s="' + season + '" e="' + e.n + '"',
    '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">Серія ' + e.n + '</div>')).join(''));
}
async function uaJson(url, ctx, ttl, headers) { return JSON.parse(await atFetch(url, { headers: Object.assign({ Accept: 'application/json', Referer: '' }, headers || {}) }, ttl, ctx)); }

// ── AnimeON (https://animeon.club): відкритий API; кожен сезон — окремий тайтл ──
async function uaAnimeon(url, env, ctx) {
  const self = url.origin + '/lite/animeon', p = uaParams(url), serial = p.serial === '1';
  const aid = parseInt(url.searchParams.get('aid') || '0', 10) || 0;
  if (!aid) {
    const names = await uaNames(p, env, ctx), norm = names.map(atNorm), year = parseInt(p.year, 10) || 0;
    const seen = {}, found = [];
    const lists = await Promise.all(uaQueries(names).map((q) => uaJson('https://animeon.club/api/anime/search?text=' + encodeURIComponent(q), ctx, 1800).catch(() => null)));
    lists.forEach((j) => ((j && j.result) || []).forEach((r) => { if (r && r.id && !seen[r.id]) { seen[r.id] = 1; found.push(r); } }));
    const good = found.map((r) => {
      let sc = Math.max(atScore(r.titleUa || '', norm), atScore(r.titleEn || '', norm));
      // той самий IMDb — точно наш тайтл (назва «Ван Піс» однакова в оригіналу 1999 р. і в рімейку 2027 р.)
      if (p.imdb_id && r.imdbId && r.imdbId === p.imdb_id) sc = 2;
      return { id: r.id, n: r.season || atSeasonOf(r.titleUa || r.titleEn || ''), y: parseInt(String(r.releaseDate || '').slice(0, 4), 10) || 0, sc };
    }).filter((r) => r.sc >= 0.6 && (!serial || !year || !r.y || r.y >= year - 1));
    if (!good.length) return uaEmpty('AnimeON');
    if (!serial) { good.sort((a, b) => (b.sc + (year && Math.abs(b.y - year) <= 1 ? 0.3 : 0)) - (a.sc + (year && Math.abs(a.y - year) <= 1 ? 0.3 : 0))); return uaAnimeonTitle(url, p, good[0].id, 0, ctx); }
    const bySeason = {};
    // однакова схожість — беремо ближчий за роком до картки
    const yd = (r) => (year && r.y ? Math.abs(r.y - year) : 99);
    good.forEach((r) => { const n = r.n || 1, c = bySeason[n]; if (!c || r.sc > c.sc || (r.sc === c.sc && yd(r) < yd(c))) bySeason[n] = r; });
    const ss = Object.keys(bySeason).map(Number).sort((a, b) => a - b);
    if (ss.length > 1) return uaSeasons(ss.map((n) => ({ n, id: bySeason[n].id })), (s) => uaLink(self, p, { aid: String(s.id), ats: String(s.n) }));
    return uaAnimeonTitle(url, p, bySeason[ss[0]].id, ss[0], ctx);
  }
  return uaAnimeonTitle(url, p, aid, parseInt(url.searchParams.get('ats') || '1', 10) || 1, ctx);
}
async function uaAnimeonTitle(url, p, aid, season, ctx) {
  const self = url.origin + '/lite/animeon', serial = p.serial === '1';
  const tr = await uaJson('https://animeon.club/api/player/' + aid + '/translations', ctx, 1800).catch(() => null);
  const opts = [];
  ((tr && tr.translations) || []).forEach((node) => {
    const t = node && node.translation, pl = ((node && node.player) || []).filter((x) => x && /ashdi/i.test(x.name || ''))[0];
    if (t && t.id && pl && pl.id) opts.push({ name: t.name || 'Ashdi', tid: t.id, pid: pl.id });
  });
  if (!opts.length) return uaEmpty('AnimeON');
  const want = parseInt(url.searchParams.get('atv') || '0', 10) || 0;
  // серії потрібні для обраної озвучки, а для фільму — для кожної (у фільмі озвучки — це пункти списку)
  const need = serial ? [Math.max(0, Math.min(opts.length - 1, want))] : opts.map((o, i) => i);
  const voices = opts.map((o) => ({ name: o.name, eps: [] }));
  await Promise.all(need.map(async (i) => {
    const o = opts[i];
    const j = await uaJson('https://animeon.club/api/player/' + aid + '/episodes?take=500&skip=-1&playerId=' + o.pid + '&translationId=' + o.tid, ctx, 1200).catch(() => null);
    // посилання на відео AnimeON віддає окремим запитом на кожну серію (/api/player/<id серії>/episode) — робимо його, лише коли серію вмикають
    ((j && j.episodes) || []).forEach((e, k) => { if (e && (e.fileUrl || e.id)) voices[i].eps.push({ n: e.episode || k + 1, file: e.fileUrl || ('aoep:' + e.id) }); });
    voices[i].eps.sort((a, b) => a.n - b.n);
  }));
  const usable = serial ? voices : voices.filter((v) => v.eps.length);
  if (serial && !voices[need[0]].eps.length) return uaEmpty('AnimeON');
  if (!usable.length) return uaEmpty('AnimeON');
  return uaEpisodes(url.origin, self, p, usable, serial ? need[0] : 0, season || 1, { aid: String(aid), ats: String(season || 1) }, serial);
}

// ── Mikai (https://mikai.me): API з командами озвучки; беремо плеєр ASHDI ──
async function uaMikai(url, env, ctx) {
  const self = url.origin + '/lite/mikai', p = uaParams(url), serial = p.serial === '1';
  let aid = parseInt(url.searchParams.get('aid') || '0', 10) || 0, season = parseInt(url.searchParams.get('ats') || '0', 10) || 0;
  const nameOf = (r) => { const n = (r && r.details && r.details.names) || {}; return [n.name, n.nameEnglish, n.nameNative, r && r.slug].filter(Boolean); };
  const seasonOf = (r) => { for (const s of nameOf(r)) { const m = String(s).match(/(?:^|\D)(\d{1,2})\s*[- ]?(?:сезон|sezon|season)/i); if (m) return parseInt(m[1], 10); } return 1; };
  if (!aid) {
    const names = await uaNames(p, env, ctx), norm = names.map(atNorm), year = parseInt(p.year, 10) || 0;
    const seen = {}, found = [];
    const lists = await Promise.all(uaQueries(names).map((q) => uaJson('https://api.mikai.me/v1/anime/search?page=1&limit=24&sort=year&order=desc&name=' + encodeURIComponent(q), ctx, 1800).catch(() => null)));
    lists.forEach((j) => ((j && j.result) || []).forEach((r) => { if (r && r.id && !seen[r.id]) { seen[r.id] = 1; found.push(r); } }));
    const good = found.map((r) => ({ id: r.id, y: r.year || 0, n: seasonOf(r), sc: Math.max.apply(null, [0].concat(nameOf(r).map((s) => atScore(String(s).replace(/-/g, ' '), norm)))) }))
      .filter((r) => r.sc >= 0.6 && (!serial || !year || !r.y || r.y >= year - 1));
    if (!good.length) return uaEmpty('Mikai');
    if (!serial) { good.sort((a, b) => b.sc - a.sc); aid = good[0].id; season = 0; }
    else {
      const bySeason = {};
      good.forEach((r) => { if (!bySeason[r.n] || r.sc > bySeason[r.n].sc) bySeason[r.n] = r; });
      const ss = Object.keys(bySeason).map(Number).sort((a, b) => a - b);
      if (ss.length > 1) return uaSeasons(ss.map((n) => ({ n, id: bySeason[n].id })), (s) => uaLink(self, p, { aid: String(s.id), ats: String(s.n) }));
      aid = bySeason[ss[0]].id; season = ss[0];
    }
  }
  const j = await uaJson('https://api.mikai.me/v1/anime/' + aid, ctx, 1800).catch(() => null);
  const players = (j && j.result && j.result.players) || [];
  const voices = [];
  players.forEach((pl) => {
    // плеєр серій: Ashdi, а якщо озвучки там немає — Tortuga (обидва відкриті, LMX UA їх розбирає). Moon і Fenix віддають відео лише своєму плеєру — їх не беремо
    const provs = ((pl && pl.providers) || []).filter((x) => x && (x.episodes || []).some((e) => e && e.playLink));
    const prov = provs.filter((x) => /ashdi/i.test(x.name || ''))[0] || provs.filter((x) => /tortuga/i.test(x.name || ''))[0];
    const eps = ((prov && prov.episodes) || []).filter((e) => e && e.playLink).map((e, k) => ({ n: e.number || k + 1, file: e.playLink })).sort((a, b) => a.n - b.n);
    if (eps.length) voices.push({ name: (pl.team && pl.team.name) || 'Mikai', eps });
  });
  if (!voices.length) return uaEmpty('Mikai');
  return uaEpisodes(url.origin, self, p, voices, parseInt(url.searchParams.get('atv') || '0', 10) || 0, season || 1, { aid: String(aid), ats: String(season || 1) }, serial);
}

// ── Eneyida (https://eneyida.tv): сайт на DLE; плеєр на сторінці — HDVB UA (зараз основний), Ashdi або Tortuga ──
// Пошук і плеєр HDVB розбираємо тут, у Worker (тоді працює й у браузері); якщо сайт чи плеєр не пустили Worker —
// віддаємо посилання, яке відкриє сам пристрій (/lite/ey — пошук, /lite/pl — плеєр); Ashdi і Tortuga — лише для України, їх завжди пристрій
function uaPlNum(t, def) { const m = String(t || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : def; }
// дані плеєра у вигляді «сезони → озвучки → серії»; буває і «озвучки → сезони → серії» — розрізняємо за назвами верхнього рівня
function uaPlModel(list) {
  const seasons = {};
  const add = (sn, voice, en, file) => {
    if (!file) return;
    const S = seasons[sn] || (seasons[sn] = { n: sn, order: [], voices: {} });
    const V = S.voices[voice] || (S.voices[voice] = (S.order.push(voice), { name: voice, eps: [] }));
    V.eps.push({ n: en, url: String(file).replace('0yql3tj', 'oyql3tj') });
  };
  const topIsSeason = list.length && list.every((x) => /сезон|season/i.test(String(x && x.title || '')));
  list.forEach((a, ai) => (a.folder || []).forEach((b, bi) => (b.folder || []).forEach((e, ei) => {
    if (topIsSeason) add(uaPlNum(a.title, ai + 1), b.title || 'Озвучка', uaPlNum(e.title, ei + 1), e.file);
    else add(uaPlNum(b.title, bi + 1), a.title || 'Озвучка', uaPlNum(e.title, ei + 1), e.file);
  })));
  return Object.keys(seasons).map((k) => seasons[k]).sort((x, y) => x.n - y.n);
}
function uaPlHtml(seasons, link, s, t) {
  if (!seasons.length) return '';
  if (!s) {
    if (seasons.length > 1) return seasons.map((x) => atItem('videos__item videos__season', { method: 'link', url: link({ ats: String(x.n) }) }, '',
      '<div class="videos__season-layers"></div><div class="videos__item-imgbox videos__season-imgbox"><div class="videos__item-title videos__season-title">' + x.n + ' сезон</div></div>')).join('');
    s = seasons[0].n;
  }
  const S = seasons.filter((x) => x.n === s)[0] || seasons[0];
  if (t >= S.order.length) t = 0;
  const btn = S.order.length > 1 ? S.order.map((name, i) => '<div class="videos__button selector' + (i === t ? ' active' : '') + '" data-json="' +
    atEsc(JSON.stringify({ method: 'link', url: link({ ats: String(S.n), atv: String(i) }) })) + '">' + atEsc(name) + '</div>').join('') : '';
  const V = S.voices[S.order[t]];
  return btn + V.eps.map((e) => atItem('videos__item videos__movie', { method: 'play', url: e.url, title: 'Серія ' + e.n, voice_name: V.name }, ' media="" s="' + S.n + '" e="' + e.n + '"',
    '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">Серія ' + e.n + '</div>')).join('');
}
async function uaEneyida(url, env, ctx) {
  const self = url.origin + '/lite/eneyida', p = uaParams(url), serial = p.serial === '1', year = parseInt(p.year, 10) || 0;
  const devQ = new URLSearchParams(); ['title', 'original_title', 'year', 'serial'].forEach((k) => { if (p[k]) devQ.set(k, p[k]); });
  const toDevice = (path, extra) => atHtml(atItem('videos__item videos__season', { method: 'link', url: url.origin + path + (extra || devQ.toString()) }, '',
    '<div class="videos__item-imgbox videos__season-imgbox"><div class="videos__item-title videos__season-title">Eneyida</div></div>'));
  let iframe = url.searchParams.get('eyf') || '';
  if (iframe && !/^https:\/\/(hdvbua\.[a-z]+|ashdi\.vip|tortuga\.[a-z]+)\//.test(iframe)) iframe = '';
  if (!iframe) {
    const names = await uaNames(p, env, ctx), norm = names.map(atNorm);
    const found = [], seen = {};
    let reached = false;
    for (const q0 of uaQueries(names)) {
      const q = String(q0).replace(/[　-ヿ㐀-鿿＀-￯]/g, ' ').trim();
      if (q.length < 2) continue;
      let html = '';
      try { html = await atFetch('https://eneyida.tv/index.php?do=search&subaction=search&story=' + encodeURIComponent(q), { headers: { Referer: 'https://eneyida.tv/' } }, 1800, ctx); reached = true; } catch (e) { continue; }
      html.split(/<article\s/i).slice(1).forEach((row) => {
        const link = (row.match(/href="(https?:\/\/[^\/"]+\/\d+[^"]*\.html)"/) || [])[1];
        if (!link || seen[link]) return;
        seen[link] = 1;
        const ua = atDecode((row.match(/id="short_title"[^>]*>([^<]+)</) || [])[1] || '');
        const sub = row.match(/class="short_subtitle">(?:<a [^>]+>(\d{4})<\/a>)?([^<]*)<\/div>/);
        const y = sub && sub[1] ? parseInt(sub[1], 10) : 0;
        let sc = Math.max(atScore(ua, norm), atScore(atDecode(sub ? sub[2] : '').replace(/[•·]/g, ' '), norm));
        if (sc < 0.6) return;
        if (year && y) sc += Math.abs(y - year) <= 1 ? 0.3 : -0.4;
        if (sc >= 0.6) found.push({ link, sc });
      });
      if (found.length) break;
    }
    if (!reached) return toDevice('/lite/ey?');
    if (!found.length) return uaEmpty('Eneyida');
    found.sort((a, b) => b.sc - a.sc);
    let page = '';
    try { page = await atFetch(found[0].link, { headers: { Referer: 'https://eneyida.tv/' } }, 1800, ctx); } catch (e) { return toDevice('/lite/ey?'); }
    // плеєр: серіал — hdvbua …/embed/ (або embd), фільм — hdvbua …/vid/; адреса з ?tr=1 — трейлер, її пропускаємо
    const frames = [];
    page.replace(/<iframe[^>]+src="(https?:\/\/(?:hdvbua\.[a-z]+|ashdi\.vip|tortuga\.[a-z]+)\/[^"]+)"/gi, (m, u) => { if (!/[?&]tr=1\b/.test(u)) frames.push(u); return m; });
    iframe = frames.filter((u) => /hdvbua\.[a-z]+\/(?:embed|embd)\//.test(u))[0] || frames[0] || '';
    if (!iframe) return uaEmpty('Eneyida');
  }
  // Ashdi і Tortuga — лише для України: їх відкриває пристрій
  if (!/hdvbua\./.test(iframe)) return toDevice('/lite/pl?u=', encodeURIComponent(iframe));
  let pl = '';
  try { pl = await atFetch(iframe, { headers: { Referer: 'https://eneyida.tv/' } }, 1800, ctx); } catch (e) { pl = ''; }
  const mSer = pl.match(/\bfile\s*:\s*'(\[\{[\s\S]*?\}\])'\s*,/);
  const mMov = pl.match(/\bfile\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
  if (!mSer && !mMov) return toDevice('/lite/pl?u=', encodeURIComponent(iframe));
  if (mMov && !mSer) {
    return atHtml(atItem('videos__item videos__movie', { method: 'play', url: mMov[1], title: p.title || 'Eneyida', voice_name: 'Eneyida' }, ' media=""',
      '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">' + atEsc(p.title || 'Дивитись') + '</div>'));
  }
  let list = [];
  try { list = JSON.parse(mSer[1].replace(/,\s*([\]}])/g, '$1')); } catch (e) { return toDevice('/lite/pl?u=', encodeURIComponent(iframe)); }
  const seasons = uaPlModel(list);
  const link = (extra) => uaLink(self, p, Object.assign({ eyf: iframe }, extra));
  const html = uaPlHtml(seasons, link, parseInt(url.searchParams.get('ats') || '0', 10) || 0, parseInt(url.searchParams.get('atv') || '0', 10) || 0);
  return html ? atHtml(html) : uaEmpty('Eneyida');
}

// ── BambooUA (https://bambooua.com): дорами українською (озвучка й субтитри). Сайт на DLE; у пошуку лише українська назва,
// тож кандидатів перевіряємо на сторінці («Оригінальна назва», рік). Плеєр — список «озвучка → серії» з прямими m3u8.
const BB = 'https://bambooua.com';
function bbVoices(pl) {
  // дубляж/озвучка — першими, субтитри — після
  const sub = (v) => /субтит/i.test(v.name) ? 1 : 0;
  return pl.sort((a, b) => sub(a) - sub(b));
}
async function uaBamboo(url, env, ctx) {
  const self = url.origin + '/lite/bamboo', p = uaParams(url), year = parseInt(p.year, 10) || 0;
  let page = url.searchParams.get('bbf') || '';
  if (page && page.indexOf(BB + '/') !== 0) page = '';
  let html = '';
  if (!page) {
    const names = await uaNames(p, env, ctx), norm = names.map(atNorm);
    const cand = [], seen = {};
    for (const q of uaQueries(names)) {
      let res = '';
      try { res = await atFetch(BB + '/index.php?do=search&subaction=search&story=' + encodeURIComponent(q), { headers: { Referer: BB + '/' } }, 1800, ctx); } catch (e) { continue; }
      res.split(/<article\s/i).slice(1).forEach((row) => {
        const link = (row.match(/href="(https?:\/\/bambooua\.com\/(?!blog\/)[^"]+\.html)"/) || [])[1];
        if (!link || seen[link]) return;
        seen[link] = 1;
        const t = atDecode((row.match(/<h2[^>]*>([^<]+)<\/h2>/) || [])[1] || '');
        cand.push({ link, sc: atScore(t, norm, link) });   // латинська назва часто є в адресі: /cinema/506-ditto.html
      });
      if (cand.some((c) => c.sc >= 0.8)) break;
    }
    if (!cand.length) return uaEmpty('BambooUA');
    cand.sort((a, b) => b.sc - a.sc);
    let best = null;
    for (const c of cand.slice(0, 4)) {
      let h = '';
      try { h = await atFetch(c.link, { headers: { Referer: BB + '/' } }, 1800, ctx); } catch (e) { continue; }
      const orig = atDecode((h.match(/Оригінальна назва:<\/span>\s*<span[^>]*>([^<]+)/) || [])[1] || '');
      const y = parseInt((h.match(/xfsearch\/year\/(\d{4})/) || [])[1] || '0', 10);
      let sc = c.sc;
      orig.split(/[\/|]/).forEach((o) => { sc = Math.max(sc, atScore(o.trim(), norm)); });
      if (year && y) sc += Math.abs(y - year) <= 1 ? 0.3 : -0.5;
      if (sc >= 0.6 && (!best || sc > best.sc)) best = { link: c.link, sc, h };
    }
    if (!best) return uaEmpty('BambooUA');
    page = best.link; html = best.h;
  }
  if (!html) { try { html = await atFetch(page, { headers: { Referer: BB + '/' } }, 1800, ctx); } catch (e) { return uaEmpty('BambooUA'); } }
  const m = html.match(/const playlist = (\[[\s\S]*?\]);\s*\n/);
  let pl = [];
  try { pl = JSON.parse(m[1]); } catch (e) { return uaEmpty('BambooUA'); }
  const sn = parseInt((((html.match(/<title>([^<]+)<\/title>/) || [])[1] || '').match(/(\d{1,2})\s*сезон/i) || [])[1] || '1', 10);
  const voices = bbVoices(pl.map((v, i) => ({ name: String(v.title || ('Варіант ' + (i + 1))), folder: v.folder, file: v.file })));
  if (!voices.some((v) => Array.isArray(v.folder))) {
    const mv = voices.filter((v) => v.file);
    if (!mv.length) return uaEmpty('BambooUA');
    return atHtml(mv.map((v) => atItem('videos__item videos__movie', { method: 'play', url: v.file, title: p.title || v.name, voice_name: v.name }, ' media=""',
      '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">' + atEsc(v.name) + '</div>')).join(''));
  }
  const S = { n: sn, order: [], voices: {} };
  voices.forEach((v) => {
    const eps = (v.folder || []).filter((e) => e && e.file).map((e, i) => ({ n: uaPlNum(e.title, i + 1), url: e.file }));
    if (!eps.length || S.voices[v.name]) return;
    S.order.push(v.name); S.voices[v.name] = { name: v.name, eps };
  });
  if (!S.order.length) return uaEmpty('BambooUA');
  const link = (extra) => uaLink(self, p, Object.assign({ bbf: page }, extra));
  return atHtml(uaPlHtml([S], link, sn, parseInt(url.searchParams.get('atv') || '0', 10) || 0));
}

// ── Unimay (https://unimay.media): студія озвучення аніме з відкритим API. Каталог невеликий (кілька десятків релізів),
// тож беремо весь список і шукаємо в ньому самі; сезони серіалу — окремі релізи (jobless-reincarnation, jobless-reincarnation-2)
const UM = 'https://api.unimay.media/v1';
async function umList(ctx) {
  let all = [];
  for (let pg = 0; pg < 10; pg++) {
    const j = await uaJson(UM + '/release/search?page=' + pg + '&page_size=12', ctx, 43200);
    const c = (j && j.content) || [];
    all = all.concat(c);
    if (c.length < 12) break;
  }
  return all;
}
// номер сезону — з кінця назви чи коду релізу («… 2», jobless-reincarnation-2), інакше за порядком
function umSeason(f, i) { const m = String(f.name).match(/\s(\d{1,2})$/) || String(f.code).match(/-(\d{1,2})$/); return m ? parseInt(m[1], 10) : i + 1; }
async function uaUnimay(url, env, ctx) {
  const self = url.origin + '/lite/unimay', p = uaParams(url), serial = p.serial === '1', year = parseInt(p.year, 10) || 0;
  let code = String(url.searchParams.get('umc') || '').replace(/[^a-z0-9-]/g, '');
  if (!code) {
    const names = (await uaNames(p, env, ctx)).map(atNorm);
    const list = await umList(ctx);
    const found = [];
    list.forEach((r) => {
      if (!r || !r.code || r.adult) return;
      if ((r.type === 'Фільм') === serial) return;
      const n = r.names || {};
      let sc = 0;
      [n.ukr, n.eng, n.romaji, String(r.code).replace(/-\d+$/, '').replace(/-/g, ' ')].forEach((t) => { if (t) sc = Math.max(sc, atScore(t, names)); });
      if (sc < 0.6) return;
      if (year && r.year) {
        if (!serial && Math.abs(r.year - year) > 1) return;
        if (serial && r.year < year - 1) return;
      }
      found.push({ code: r.code, name: n.ukr || n.eng || r.code, year: r.year || 0, sc });
    });
    if (!found.length) return uaEmpty('Unimay');
    if (!serial) { found.sort((a, b) => b.sc - a.sc); code = found[0].code; }
    else if (found.length === 1) code = found[0].code;
    else {
      // кілька релізів одного серіалу (сезони, арки) — показуємо їх як сезони, за роком
      found.sort((a, b) => (a.year - b.year) || a.code.localeCompare(b.code));
      return atHtml(found.map((f, i) => atItem('videos__item videos__season', { method: 'link', url: uaLink(self, p, { umc: f.code, ums: String(umSeason(f, i)) }) }, '',
        '<div class="videos__season-layers"></div><div class="videos__item-imgbox videos__season-imgbox"><div class="videos__item-title videos__season-title">' + atEsc(f.name) + '</div></div>')).join(''));
    }
  }
  const r = await uaJson(UM + '/release?code=' + encodeURIComponent(code), ctx, 3600).catch(() => null);
  const eps = ((r && r.playlist) || []).filter((e) => e && !e.premium && e.hls && (e.hls.master || (e.hls.qualities && (e.hls.qualities.fhd || e.hls.qualities.hd))));
  if (!eps.length) return uaEmpty('Unimay');
  const file = (e) => e.hls.master || e.hls.qualities.fhd || e.hls.qualities.hd;
  if (!serial) {
    return atHtml(atItem('videos__item videos__movie', { method: 'play', url: file(eps[0]), title: p.title || 'Unimay', voice_name: 'Unimay' }, ' media=""',
      '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">Unimay</div>'));
  }
  const sn = parseInt(url.searchParams.get('ums') || '1', 10) || 1;
  return atHtml(eps.map((e, i) => {
    const n = parseInt(e.number, 10) || i + 1;
    return atItem('videos__item videos__movie', { method: 'play', url: file(e), title: 'Серія ' + n + (e.title ? ' · ' + e.title : ''), voice_name: 'Unimay' }, ' media="" s="' + sn + '" e="' + n + '"',
      '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">Серія ' + n + '</div>');
  }).join(''));
}

// ── UAFlix (https://uafix.net): фільми й серіали з власною українською озвучкою. Сайт на DLE, плеєр — zetvideo.net/vod/ID
// (усередині прямий m3u8). Серія серіалу — окрема сторінка, її плеєр розбираємо лише коли серію відкривають (/lite/ufv).
const UF = 'https://uafix.net';
async function ufM3u8(vod, ctx) {
  const h = await atFetch(vod, { headers: { Referer: UF + '/' } }, 3600, ctx);
  return (h.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/) || [])[1] || '';
}
function ufVod(page) { return (page.match(/<iframe[^>]+src=["'](https:\/\/zetvideo\.net\/vod\/\d+)["']/i) || [])[1] || ''; }
async function uaUafixPlay(url, ctx) {
  const u = url.searchParams.get('u') || '';
  if (!/^https:\/\/(uafix\.net|zetvideo\.net)\//.test(u)) return json({ error: 'bad_url' }, 400);
  let vod = /zetvideo\.net/.test(u) ? u : '';
  if (!vod) { const pg = await atFetch(u, { headers: { Referer: UF + '/' } }, 1800, ctx).catch(() => ''); vod = ufVod(pg); }
  const m = vod ? await ufM3u8(vod, ctx).catch(() => '') : '';
  return m ? json({ method: 'play', url: m, title: url.searchParams.get('t') || '' }) : json({ error: 'no_file' }, 404);
}
function ufToDevice(url, p) {
  const q = new URLSearchParams(); ['title', 'original_title', 'year', 'serial', 'alt'].forEach((k) => { if (p[k]) q.set(k, p[k]); });
  return atHtml(atItem('videos__item videos__season', { method: 'link', url: url.origin + '/lite/ufd?' + q.toString() }, '',
    '<div class="videos__item-imgbox videos__season-imgbox"><div class="videos__item-title videos__season-title">UAFlix</div></div>'));
}
async function uaUafix(url, env, ctx) {
  const self = url.origin + '/lite/uafix', p = uaParams(url), serial = p.serial === '1', year = parseInt(p.year, 10) || 0;
  let page = url.searchParams.get('uf') || '', html = '';
  if (page && page.indexOf(UF + '/') !== 0) page = '';
  if (!page) {
    const names = await uaNames(p, env, ctx), norm = names.map(atNorm);
    const cand = [], seen = {};
    let reached = false, why = '';
    for (const q of uaQueries(names)) {
      let res = '';
      try { res = await atFetch(UF + '/index.php?do=search&subaction=search&story=' + encodeURIComponent(q), { headers: { Referer: UF + '/' } }, 1800, ctx); reached = true; } catch (e) { why = String(e && e.message || e); continue; }
      res.replace(/<a class="sres-wrap[^"]*" href="(https:\/\/uafix\.net\/[^"]+)">[\s\S]*?<h2>([^<]+)<\/h2>/g, (m, link, t) => {
        if (seen[link]) return m;
        seen[link] = 1;
        const isSer = /\/serials\//.test(link);
        if (isSer !== serial && /\/(films|serials)\//.test(link)) return m;
        const sc = atScore(atDecode(t), norm, link);
        if (sc >= 0.6) cand.push({ link, sc });
        return m;
      });
      if (cand.some((c) => c.sc >= 0.85)) break;
    }
    if (url.searchParams.get('diag')) return json({ reached, why, cand });
    // сайт не пустив Worker — пошук робить сам пристрій (/lite/ufd)
    if (!reached) return ufToDevice(url, p);
    if (!cand.length) return uaEmpty('UAFlix');
    cand.sort((a, b) => b.sc - a.sc);
    let best = null;
    for (const c of cand.slice(0, 3)) {
      let h = '';
      try { h = await atFetch(c.link, { headers: { Referer: UF + '/' } }, 1800, ctx); } catch (e) { continue; }
      const y = parseInt((h.match(/Рік виходу:<\/span>[\s\S]{0,200}?(\d{4})/) || [])[1] || '0', 10);
      let sc = c.sc;
      if (year && y) { if (Math.abs(y - year) > 1) continue; sc += 0.3; }
      if (!best || sc > best.sc) best = { link: c.link, sc, h };
    }
    if (!best) return uaEmpty('UAFlix');
    page = best.link; html = best.h;
  }
  if (!html) { try { html = await atFetch(page, { headers: { Referer: UF + '/' } }, 1800, ctx); } catch (e) { return uaEmpty('UAFlix'); } }
  const callUrl = (u, t) => url.origin + '/lite/ufv?u=' + encodeURIComponent(u) + '&t=' + encodeURIComponent(t);
  if (!serial) {
    const vod = ufVod(html);
    if (!vod) return uaEmpty('UAFlix');
    const m = await ufM3u8(vod, ctx).catch(() => '');
    const it = m ? { method: 'play', url: m, title: p.title || 'UAFlix', voice_name: 'UAFlix' } : { method: 'call', url: callUrl(vod, p.title || ''), title: p.title || 'UAFlix', voice_name: 'UAFlix' };
    return atHtml(atItem('videos__item videos__movie', it, ' media=""', '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">UAFlix</div>'));
  }
  // серії: …/season-02-episode-10/
  const eps = {}, base = page.replace(/\/+$/, '');
  html.replace(/href="(https:\/\/uafix\.net\/[^"]+?\/season-(\d+)-episode-(\d+)\/?)"/g, (m, link, sn, en) => {
    if (link.indexOf(base + '/') !== 0) return m;
    sn = parseInt(sn, 10); en = parseInt(en, 10);
    (eps[sn] || (eps[sn] = {}))[en] = link;
    return m;
  });
  const sns = Object.keys(eps).map(Number).sort((a, b) => a - b);
  if (!sns.length) return uaEmpty('UAFlix');
  let s = parseInt(url.searchParams.get('ufs') || '0', 10) || 0;
  if (!s && sns.length > 1) {
    return atHtml(sns.map((n) => atItem('videos__item videos__season', { method: 'link', url: uaLink(self, p, { uf: page, ufs: String(n) }) }, '',
      '<div class="videos__season-layers"></div><div class="videos__item-imgbox videos__season-imgbox"><div class="videos__item-title videos__season-title">' + n + ' сезон</div></div>')).join(''));
  }
  if (!eps[s]) s = sns[0];
  const list = Object.keys(eps[s]).map(Number).sort((a, b) => a - b);
  return atHtml(list.map((n) => atItem('videos__item videos__movie', { method: 'call', url: callUrl(eps[s][n], 'Серія ' + n), title: 'Серія ' + n, voice_name: 'UAFlix' }, ' media="" s="' + s + '" e="' + n + '"',
    '<div class="videos__item-imgbox videos__movie-imgbox"></div><div class="videos__item-title">Серія ' + n + '</div>')).join(''));
}

// Джерела з власного сервера Lampac (Oracle Cloud, Always Free): там є Chromium, тож працюють Phantom/Spectre (4K), UAKino.
// Moon прибрано: пошук Moon у Lampac не працює (відповідає «search», ймовірно потрібен ключ MoonAnime) — повернемо, коли буде робочий спосіб.
// Адреса й ключ доступу — у змінній Worker LMX_ORACLE ("https://host|ключ"), не в коді (репозиторій публічний)
const ORA_SOURCES = [
  { k: 'phantom', name: 'Phantom 4K' },
  { k: 'spectre', name: 'Spectre' },
  { k: 'uakino', name: 'UAKino' }
];
function uaEvents(url, env) {
  const p = uaParams(url), anime = uaIsAnime(p);
  const list = Object.keys(UA_SOURCES).filter((k) => (!UA_SOURCES[k].anime || anime) && (!UA_SOURCES[k].asia || uaIsAsia(p))).map((k) => ({ name: UA_SOURCES[k].name, url: url.origin + '/lite/' + k, balanser: k, show: true }));
  const ora = String((env && env.LMX_ORACLE) || '').split('|');
  if (/^https:\/\/[a-z0-9.-]+$/i.test(ora[0] || '') && ora[1]) {
    ORA_SOURCES.filter((o) => !o.anime || anime).forEach((o) => {
      list.push({ name: o.name, url: ora[0] + '/lite/' + o.k + '?token=' + encodeURIComponent(ora[1]), balanser: o.k, show: true });
    });
  }
  return json(list);
}
async function handleUa(url, env, ctx) {
  const path = url.pathname;
  try {
    if (path === '/lite/events') return uaEvents(url, env);
    if (path === '/lite/withsearch') return json([]);
    if (path === '/externalids') return json({});
    if (path === '/lite/video') {
      // запасний шлях: пристрій не зміг сам — пробуємо з Worker (для плеєрів без обмеження за країною)
      const u = url.searchParams.get('u') || '';
      if (/\.m3u8(\?|$)/i.test(u)) return json({ method: 'play', url: u });
      if (/^aoep:\d+$/.test(u)) {
        const j = await uaJson('https://animeon.club/api/player/' + u.slice(5) + '/episode', ctx, 3600).catch(() => null);
        if (!j || !j.videoUrl) return json({ error: 'no_file' }, 404);
        url.searchParams.set('u', j.videoUrl);
      }
      url.pathname = '/lite/anitube/video';
      return handleAnitube(url, env, ctx);
    }
    if (path === '/lite/aoep') {
      const id = String(url.searchParams.get('id') || '').replace(/\D/g, '');
      if (!id) return json({ error: 'bad_id' }, 400);
      const j = await uaJson('https://animeon.club/api/player/' + id + '/episode', ctx, 3600).catch(() => null);
      return j && j.videoUrl ? json({ videoUrl: j.videoUrl }) : json({ error: 'no_file' }, 404);
    }
    if (path === '/lite/pl') return atHtml('<div class="online-empty">Плеєр відкривається лише на пристрої з України</div>');
    if (path === '/lite/animeon') return await uaAnimeon(url, env, ctx);
    if (path === '/lite/mikai') return await uaMikai(url, env, ctx);
    if (path === '/lite/eneyida') return await uaEneyida(url, env, ctx);
    if (path === '/lite/bamboo') return await uaBamboo(url, env, ctx);
    if (path === '/lite/unimay') return await uaUnimay(url, env, ctx);
    if (path === '/lite/uafix') return await uaUafix(url, env, ctx);
    if (path === '/lite/ufv') return await uaUafixPlay(url, ctx);
    if (path === '/lite/ufd') return atHtml('<div class="online-empty">UAFlix відкривається лише на пристрої</div>');
    if (path === '/lite/ey') return atHtml('<div class="online-empty">Eneyida відкривається лише на пристрої</div>');
  } catch (e) {
    return atHtml('<div class="online-empty">Джерело зараз недоступне</div>');
  }
  return null;
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (req.method === 'GET' && (url.pathname === '/lite/anitube' || url.pathname === '/lite/anitube/video')) return handleAnitube(url, env, ctx);
    if (req.method === 'GET' && /^\/(lite\/(events|withsearch|video|pl|ey|aoep|animeon|mikai|eneyida|bamboo|unimay|uafix|ufv|ufd)|externalids)$/.test(url.pathname)) { const r = await handleUa(url, env, ctx); if (r) return r; }
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
    if (event && event.cron && event.cron !== '17 3 * * *') { try { await runNotify(env, now); } catch (e) {} return; }
    try { await ntfEnsure(env); await env.DB.prepare('DELETE FROM ntf WHERE t < ? AND k NOT IN (\'off\')').bind(now - 400 * DAY).run(); } catch (e) {}
    await env.DB.prepare('DELETE FROM kv WHERE d = 1 AND t < ?').bind(now - 90 * DAY).run();
    await env.DB.prepare('DELETE FROM kv WHERE u IN (SELECT u FROM kv GROUP BY u HAVING MAX(st) < ?)').bind(now - 180 * DAY).run();
  }
};
