/*
 * LMX Sync v1.0 — особиста синхронізація закладок, лайків, історії та таймкодів між вашими пристроями Lampa.
 *
 * Як користуватись: Налаштування → LMX Sync → «Створити код». Код (16 цифр) покажуть на екрані: запишіть його.
 * На другому пристрої: «Ввести код» і той самий код — дані зіллються. Один код = один користувач; чужі дані без коду недоступні.
 *
 * Що синхронізується: списки «Подобається», «Закладки», «Дивлюсь», «Переглянуто», історія та прогрес перегляду (таймкоди) і ВСІ налаштування LMX Pack (тема, порядок рядів, кнопки тощо).
 * Що НЕ синхронізується: список плагінів і власні налаштування Lampa. Якщо у вас увімкнена вбудована синхронізація CUB — плагін нічого не робить.
 * Приватність: на сервер йдуть лише id фільмів/серіалів, їхні назви та постери, час перегляду й хеш вашого коду.
 * Це не зашифровано: власник сервера технічно може прочитати ці дані. Не вводьте код на чужих пристроях.
 * Навантаження: запити лише при запуску, після змін (із затримкою) і після повернення в застосунок — без постійного опитування.
 */
(function () {
    'use strict';
    if (window.__lmxSync) return;
    window.__lmxSync = true;

    var VERSION = '1.10';
    // Адреса вашого сервера (Cloudflare Worker). Можна змінити й у Налаштування → LMX Sync → «Адреса сервера»
    var DEFAULT_SERVER = 'https://lmx-sync.vladshkaraputa07.workers.dev';
    var CATS = ['like', 'wath', 'book', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown'];
    var CHUNK = 100;

    function safe(fn) { try { return fn(); } catch (e) { try { console.error('LMX Sync', e); } catch (x) {} } }
    function noty(t) { try { Lampa.Noty.show(t); } catch (e) {} }
    function sget(k, d) { try { return Lampa.Storage.get(k, d); } catch (e) { return d; } }
    function sset(k, v) { try { Lampa.Storage.set(k, v); } catch (e) {} }

    // ───────── SHA-256 (власна реалізація: на ТВ crypto.subtle недоступний на http-сторінках) ─────────
    var K256 = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    function utf8(str) {
        var out = [], i, c;
        str = unescape(encodeURIComponent(str));
        for (i = 0; i < str.length; i++) { c = str.charCodeAt(i); out.push(c); }
        return out;
    }
    function sha256(str) {
        var bytes = utf8(str), l = bytes.length, i, j;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);
        var hi = Math.floor(l * 8 / 4294967296), lo = (l * 8) >>> 0;
        bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
        var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64);
        function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
        for (i = 0; i < bytes.length; i += 64) {
            for (j = 0; j < 16; j++) w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
            for (j = 16; j < 64; j++) {
                var s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
                w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
            }
            var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
            for (j = 0; j < 64; j++) {
                var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K256[j] + w[j]) | 0;
                var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
                h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
        }
        return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
    }

    // ───────── Код користувача: 16 цифр (зручно вводити з пульта), 4×4 ─────────
    function genCode() {
        var out = '', arr, i = 0, n;
        try {
            arr = new Uint8Array(64);
            (window.crypto || window.msCrypto).getRandomValues(arr);
        } catch (e) { arr = null; }
        while (out.length < 16) {
            // байти ≥ 250 відкидаємо, щоб цифри були рівноймовірні
            n = arr && i < arr.length ? arr[i++] : Math.floor(Math.random() * 256);
            if (n < 250) out += String(n % 10);
        }
        return out;
    }
    function cleanCode(c) { return String(c == null ? '' : c).replace(/\D/g, ''); }
    function codeOk(c) { return /^\d{16}$/.test(cleanCode(c)); }
    function uidOf(code) { return sha256('lmx-sync:v1:' + cleanCode(code)); }
    function pretty(c) { return cleanCode(c).replace(/(\d{4})(?=\d)/g, '$1-'); }
    // Lampa.Storage сама перетворює значення з самих цифр на число (губляться ведучі нулі й точність) — тому зберігаємо з літерою попереду
    function saveCode(c) { sset('lmx_sync_code', 'c' + cleanCode(c)); }

    // ───────── Стан ─────────
    function code() { var c = cleanCode(sget('lmx_sync_code', '')); return c.length === 16 ? c : ''; }
    function server() { return String(sget('lmx_sync_server', '') || DEFAULT_SERVER || '').replace(/\/+$/, ''); }
    function getState() {
        var s = sget('lmx_sync_state', null);
        if (!s || typeof s !== 'object' || s.u !== uidOf(code())) s = { u: uidOf(code()), snap: {}, since: 0, tpush: 0, last: 0, ss: null, sts: {}, ft: {} };
        if (!s.snap) s.snap = {};
        if (!s.sts) s.sts = {};
        if (!s.ft) s.ft = {};
        return s;
    }
    function syncActive() {
        try { if (Lampa.Account && Lampa.Account.Permit && Lampa.Account.Permit.sync) return false; } catch (e) {}
        return true;
    }

    // ───────── Дані Lampa ─────────
    function favData() {
        var d = sget('favorite', {});
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
        if (!d || typeof d !== 'object') d = {};
        if (!Array.isArray(d.card)) d.card = [];
        CATS.forEach(function (c) { if (!Array.isArray(d[c])) d[c] = []; });
        return d;
    }
    function tlFile() { try { return Lampa.Timeline.filename(); } catch (e) { return 'file_view'; } }
    function tlData() {
        var d = sget(tlFile(), {});
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
        return d && typeof d === 'object' ? d : {};
    }
    var KEEP = ['id', 'title', 'name', 'original_title', 'original_name', 'poster_path', 'backdrop_path', 'release_date', 'first_air_date',
        'vote_average', 'vote_count', 'media_type', 'number_of_seasons', 'number_of_episodes', 'original_language', 'genre_ids', 'source', 'popularity'];
    function slim(c) {
        var o = {}, i;
        if (!c) return o;
        for (i = 0; i < KEEP.length; i++) if (typeof c[KEEP[i]] !== 'undefined') o[KEEP[i]] = c[KEEP[i]];
        if (!o.genre_ids && c.genres) o.genre_ids = c.genres.map(function (g) { return g && g.id; }).filter(Boolean);
        if (c.overview) o.overview = String(c.overview).slice(0, 220);
        return o;
    }
    function cardOf(d, id) {
        for (var i = 0; i < d.card.length; i++) if (d.card[i] && d.card[i].id == id) return d.card[i];
        return null;
    }
    function favKeys(d) {
        var cur = {};
        CATS.forEach(function (c) { d[c].forEach(function (id) { cur['f:' + c + ':' + id] = 1; }); });
        return cur;
    }
    // Налаштування LMX Pack: усі ключі lmx_*, крім службових і кешів
    var SKIP_RX = /^(lmx_sync|lmx_btn_known|lmx_live|lmx_ver|lmx_t_ver|lmx_anime_|lmx_dorama_kw|lmx_stats|lmx_cache|lmx_hist_cache)/;
    function settingNames() {
        var out = [], i, k;
        try { for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); if (k && /^lmx_/.test(k) && !SKIP_RX.test(k)) out.push(k); } } catch (e) {}
        return out;
    }
    function sjson(name) { var v = sget(name, null); try { return JSON.stringify(v); } catch (e) { return 'null'; } }
    var MAX_SV = 18000;
    var TKEEP = ['time', 'duration', 'percent', 'profile', 'card', 'season', 'episode'];
    function tlSlim(e) { var o = {}; TKEEP.forEach(function (k) { if (typeof e[k] !== 'undefined') o[k] = e[k]; }); return o; }

    // ───────── Ядро: збір змін, застосування чужих ─────────
    // Повертає { ops, snapNext (стан закладок на момент збору), tmark }
    // Штучний час «давно» для старих записів: зберігає порядок списку (позиція 0 — найновіше), але завжди старший за будь-який справжній перегляд
    var SYN_BASE = 1500000000000;
    function collect(st, now, o) {
        o = o || {};
        var d = favData(), cur = favKeys(d), ops = [], k, parts;
        var pos = {};
        if (o.synth || o.all) CATS.forEach(function (c) { d[c].forEach(function (id, i) { pos['f:' + c + ':' + id] = i; }); });
        function synT(key) { return SYN_BASE - (pos[key] || 0) * 1000; }
        var first0 = !st.ss;
        // Записи, що були на пристрої ДО першої синхронізації, мають t=0: вони не «молодші» за те, що вже є в акаунті, і не перебивають порядок.
        // Нове (додане після) має справжній час — за ним історія й списки впорядковуються між пристроями
        for (k in cur) if (!st.snap[k] || o.all) {
            parts = k.split(':');
            ops.push({ k: k, v: JSON.stringify(slim(cardOf(d, parts[2]))), t: (first0 || o.all) ? ((o.synth || o.all) ? synT(k) : 0) : now, d: 0 });
        }
        // повторний перегляд: Lampa піднімає картку на початок історії — це свіжа подія, оновлюємо її час, щоб вона піднялась і на інших пристроях
        var front = d.history.length ? d.history[0] : null;
        if (!first0 && front !== null && typeof st.hfront !== 'undefined' && front !== st.hfront && st.snap['f:history:' + front]) {
            ops.push({ k: 'f:history:' + front, v: JSON.stringify(slim(cardOf(d, front))), t: now, d: 0 });
        }
        var dels = [], snapN = 0;
        for (k in st.snap) { snapN++; if (!cur[k]) dels.push(k); }
        var susp = null;
        // Запобіжник: раптове зникнення більшості записів схоже на збій читання списків, а не на дії користувача — видалення не шлемо
        if (dels.length > 20 && dels.length > snapN * 0.5) susp = dels;
        else dels.forEach(function (dk) { ops.push({ k: dk, v: null, t: now, d: 1 }); });
        var first = !st.ss, ss = st.ss || {}, curS = {};
        // налаштування: при першому запуску на цьому пристрої (first) шлемо їх із t=0 — вони лише заповнюють порожнє на сервері й не затирають чужі
        settingNames().forEach(function (n) {
            var j = sjson(n);
            curS[n] = j;
            if (ss[n] !== j && j.length <= MAX_SV) ops.push({ k: 's:' + n, v: j, t: first ? 0 : now, d: 0 });
        });
        // Таймкоди: зміну визначаємо за вмістом (час/відсоток/тривалість), а не лише за полем updated — у деяких версіях Lampa його немає.
        // Власний час змін зберігаємо в записі (updated), щоб потім порівнювати свіжість між пристроями
        var tl = tlData(), h, e, u, sig, tsn = st.tsnap || {}, curT = {}, stamp = {}, firstT = !st.tsnap;
        for (h in tl) {
            e = tl[h];
            if (!e || typeof e !== 'object') continue;
            sig = [e.time, e.percent, e.duration].join('|');
            curT[h] = sig;
            if (tsn[h] === sig) continue;
            // свіжий час: власний updated Lampa, якщо він змінився з минулої синхронізації; інакше — зараз (і записуємо його в запис)
            if (firstT) u = e.updated || 1;
            else u = (e.updated && e.updated !== (st.tu || {})[h]) ? e.updated : now;
            if (u !== e.updated) stamp[h] = u;
            ops.push({ k: 't:' + h, v: JSON.stringify(tlSlim(e)), t: u, d: 0 });
        }
        return { ops: ops, cur: cur, curS: curS, curT: curT, stamp: stamp, first: first, tmark: now, front: front, susp: susp };
    }
    // Час останнього перегляду картки за таймкодами (file_view): це реальний час, однаковий на всіх пристроях. 0 — невідомо
    var wtEnd = 0;
    function watchTime(card, tl) {
        try {
            if (wtEnd && Date.now() > wtEnd) return 0; // бюджет часу: на слабких ТВ не гальмуємо інтерфейс
            if (!card || !Lampa.Utils || !Lampa.Utils.hash) return 0;
            var name = card.original_title || card.original_name || card.title || card.name || '';
            if (!name) return 0;
            var best = 0, v, h, sn, ep, u;
            function chk(hash) { v = tl[hash]; if (v && typeof v === 'object') { u = v.updated || 0; if (u > best) best = u; } }
            var isTv = card.media_type === 'tv' || !!card.name || !!card.first_air_date || !!card.number_of_seasons;
            if (!isTv) { chk(Lampa.Utils.hash(name)); return best; }
            var seasons = Math.min(25, Number(card.number_of_seasons) || 12), maxEp = card.number_of_episodes && seasons === 1 ? Math.min(80, card.number_of_episodes + 3) : 60;
            for (sn = 1; sn <= seasons; sn++) for (ep = 1; ep <= maxEp; ep++) chk(Lampa.Utils.hash([sn, sn > 10 ? ':' : '', ep, name].join('')));
            return best;
        } catch (e) { return 0; }
    }
    // Впорядкування історії: найновіше за переглядом зверху; без даних — лишається як є
    function sortHistory(fav, tl, ft) {
        wtEnd = Date.now() + 500;
        var arr = fav.history.map(function (id, i) {
            var t = ft['f:history:' + id] || 0, w = watchTime(cardOf(fav, id), tl); // w рахується лише в межах бюджету
            return { id: id, i: i, t: Math.max(t, w) };
        });
        arr.sort(function (a, b) { return (b.t - a.t) || (a.i - b.i); });
        var ord = arr.map(function (x) { return x.id; });
        if (ord.join(',') === fav.history.join(',')) return false;
        fav.history = ord;
        return true;
    }
    // Застосовує рядки з сервера. Повертає { favChanged, tlChanged }. snap — об'єкт стану, його теж оновлюємо
    function applyRows(rows, snap, ctx) {
        var fav = favData(), tl = tlData(), favCh = false, tlCh = false, i, r, p, cat, id, v, loc, setCh = [];
        ctx = ctx || { first: false, ss: {}, sts: {} };
        if (!ctx.ft) ctx.ft = {};
        if (!ctx.tsnap) ctx.tsnap = {};
        var sh;
        if (ctx.stamp) for (sh in ctx.stamp) if (tl[sh] && typeof tl[sh] === 'object') { tl[sh].updated = ctx.stamp[sh]; tlCh = true; }
        var catCh = {};
        for (i = 0; i < rows.length; i++) {
            r = rows[i];
            if (!r || typeof r.k !== 'string') continue;
            p = r.k.split(':');
            if (p[0] === 'f' && CATS.indexOf(p[1]) >= 0) {
                cat = p[1];
                id = /^\d+$/.test(p[2]) ? parseInt(p[2], 10) : p[2];
                if (r.d) {
                    var ix = fav[cat].indexOf(id);
                    if (ix >= 0) { fav[cat].splice(ix, 1); favCh = true; }
                    delete snap[r.k];
                    delete ctx.ft[r.k];
                    var still = CATS.some(function (c) { return fav[c].indexOf(id) >= 0; });
                    if (!still) {
                        for (var q = fav.card.length - 1; q >= 0; q--) if (fav.card[q] && fav.card[q].id == id) { fav.card.splice(q, 1); favCh = true; }
                    }
                } else {
                    // нові записи з іншого пристрою додаємо в кінець, а порядок виставляємо за часом нижче
                    if (fav[cat].indexOf(id) < 0) { fav[cat].push(id); favCh = true; }
                    if (r.t > (ctx.ft[r.k] || 0)) ctx.ft[r.k] = r.t;
                    catCh[cat] = 1;
                    snap[r.k] = 1;
                    if (!cardOf(fav, id) && r.v) {
                        try { v = JSON.parse(r.v); if (v && v.id) { fav.card.push(v); favCh = true; } } catch (e) {}
                    }
                }
            } else if (p[0] === 's' && !r.d && r.v) {
                var sn = p.slice(1).join(':');
                if (!/^lmx_/.test(sn) || SKIP_RX.test(sn)) continue;
                if (!(ctx.first || r.t > (ctx.sts[sn] || 0))) continue;
                if (sjson(sn) === r.v) { ctx.ss[sn] = r.v; ctx.sts[sn] = r.t; continue; }
                try { v = JSON.parse(r.v); } catch (e) { continue; }
                sset(sn, v);
                ctx.ss[sn] = r.v; ctx.sts[sn] = r.t;
                setCh.push(sn);
            } else if (p[0] === 't' && !r.d && r.v) {
                try { v = JSON.parse(r.v); } catch (e) { continue; }
                loc = tl[p[1]];
                var locOk = loc && typeof loc === 'object', locU = locOk ? (loc.updated || 0) : -1, doIt;
                // Правило: нема локального — беремо; чужий новіший — беремо; обидва «без часу» (t≤1) або однаковий час — перемагає той, хто досяг більшого прогресу.
                // Раніше будь-який чужий запис затирав локальний без поля updated — через це таймкоди «губились»
                var rp = Number(v.percent || 0), lp = locOk ? Number(loc.percent || 0) : 0;
                if (!locOk) doIt = true;
                else if (r.t <= 1) doIt = locU <= 1 && (ctx.first ? true : rp > lp);   // старий запис без часу: після першого підключення не перебиває існуюче; при першому підключенні сервер — еталон
                else if (locU <= 1) doIt = true;                         // локальний старий, а на сервері є справжній час — беремо серверний
                else if (r.t > locU) doIt = true;
                else if (r.t === locU) doIt = rp > lp;
                else doIt = false;
                if (doIt) {
                    var n = {};
                    TKEEP.forEach(function (k) { if (typeof v[k] !== 'undefined') n[k] = v[k]; });
                    n.updated = r.t;
                    tl[p[1]] = n;
                    ctx.tsnap[p[1]] = [n.time, n.percent, n.duration].join('|');
                    tlCh = true;
                }
            }
        }
        // порядок у списках: найновіше зверху (за часом додавання на будь-якому пристрої); записи з однаковим часом (зокрема старі, t=0) лишаються в своєму порядку
        if (ctx.fixHist) catCh.history = 1;
        Object.keys(catCh).forEach(function (cat) {
            if (cat === 'history') { if (sortHistory(fav, tl, ctx.ft)) favCh = true; return; }
            var arr = fav[cat].map(function (id, i) { return { id: id, i: i, t: ctx.ft['f:' + cat + ':' + id] || 0 }; });
            arr.sort(function (a, b) { return (b.t - a.t) || (a.i - b.i); });
            var ord = arr.map(function (x) { return x.id; });
            if (ord.join(',') !== fav[cat].join(',')) { fav[cat] = ord; favCh = true; }
        });
        return { fav: fav, tl: tl, favChanged: favCh, tlChanged: tlCh, settingsChanged: setCh };
    }

    // ───────── Мережа ─────────
    function post(path, body, ok, fail) {
        var url = server() + path, done = false;
        var t = setTimeout(function () { if (!done) { done = true; fail('Сервер не відповідає'); } }, 20000);
        try {
            var x = new XMLHttpRequest();
            x.open('POST', url, true);
            x.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8'); // без preflight
            x.onreadystatechange = function () {
                if (x.readyState !== 4 || done) return;
                done = true; clearTimeout(t);
                var j = null;
                try { j = JSON.parse(x.responseText); } catch (e) {}
                if (x.status === 200 && j && j.ok) ok(j);
                else fail(j && j.error === 'quota' ? 'Перевищено ліміт записів' : 'Помилка сервера (' + (x.status || 'мережа') + ')');
            };
            x.send(JSON.stringify(body));
        } catch (e) { done = true; clearTimeout(t); fail('Помилка запиту'); }
    }

    var busy = false, applying = false, timer = 0, retryN = 0;
    var status = { text: '', ok: true };
    function setStatus(t, ok) { status.text = t; status.ok = ok !== false; }

    // Годинник пристрою (особливо ТВ) може йти неправильно: раз на 6 годин питаємо в сервера час і виправляємо мітки змін
    function sync(manual, cb) {
        cb = cb || function () {};
        var st0 = getState();
        if (busy || !code() || !server() || !syncActive() || (st0.skewAt && Date.now() - st0.skewAt < 6 * 3600000)) return syncCore(manual, cb);
        busy = true;
        post('/api/sync', { u: st0.u, since: -1, ops: [] }, function (j) {
            busy = false;
            if (j && j.now) { st0.skew = j.now - Date.now(); st0.skewAt = Date.now(); sset('lmx_sync_state', st0); }
            syncCore(manual, cb);
        }, function () { busy = false; syncCore(manual, cb); });
    }
    function st0skew() { var x = getState(); return Number(x.skew) || 0; }
    function syncCore(manual, cb) {
        cb = cb || function () {};
        var s0 = getState();
        // Перше підключення пристрою: дивимось, чи є вже дані на сервері. Якщо є — сервер еталон (наші старі записи не перебивають його порядок);
        // якщо порожній — цей пристрій стає еталоном, і його порядок списків зберігається штучним «давнім» часом
        if (!busy && code() && server() && syncActive() && !s0.ss && !s0.chk) {
            busy = true;
            return post('/api/sync', { u: s0.u, since: 0, ops: [] }, function (j) {
                busy = false;
                s0.chk = 1; s0.empty = !(j.rows && j.rows.length);
                sset('lmx_sync_state', s0);
                syncRun(manual, cb);
            }, function (err) { busy = false; setStatus(err, false); if (manual) noty('Синхронізація: ' + err); cb(false); });
        }
        syncRun(manual, cb);
    }
    function syncRun(manual, cb) {
        if (busy) return cb(false);
        if (!code()) { if (manual) noty('Спочатку створіть або введіть код'); return cb(false); }
        if (!server()) { if (manual) noty('Не вказана адреса сервера'); setStatus('Немає адреси сервера', false); return cb(false); }
        if (!syncActive()) { if (manual) noty('Увімкнена синхронізація CUB — LMX Sync вимкнено'); return cb(false); }
        busy = true;
        var st = getState(), now = Date.now() + (st0skew()), col = collect(st, now, { synth: !!st.empty, all: !!st.refNext }), ops = col.ops, chunks = [], i;
        for (i = 0; i < ops.length; i += CHUNK) chunks.push(ops.slice(i, i + CHUNK));
        if (!chunks.length) chunks.push([]);
        var rows = [], n = 0, pushed = ops.length;
        function fin(err) {
            busy = false;
            if (err) { setStatus(err, false); if (manual) noty('Синхронізація: ' + err); return cb(false); }
            cb(true);
        }
        function step() {
            var last = n === chunks.length - 1;
            post('/api/sync', { u: st.u, since: last ? st.since : -1, ops: chunks[n] }, function (j) {
                if (last) rows = j.rows || [];
                if (!last) { n++; return step(); }
                // тягнемо решту, якщо відповідь була обрізана
                var maxSt = st.since, k;
                function more(j2) {
                    var rs = j2.rows || [];
                    if (j2 !== j) rows = rows.concat(rs);
                    for (k = 0; k < rs.length; k++) if (rs[k].st > maxSt) maxSt = rs[k].st;
                    if (j2.more) {
                        post('/api/sync', { u: st.u, since: maxSt, ops: [] }, more, fin);
                        return;
                    }
                    commit(maxSt, j.now || now);
                }
                more(j);
            }, fin);
        }
        function commit(maxSt, srvNow) {
            safe(function () {
                var snapNext = {}, k;
                for (k in col.cur) snapNext[k] = 1;
                if (col.susp) col.susp.forEach(function (sk) { snapNext[sk] = 1; });
                applying = true;
                var ctx = { first: col.first, ss: {}, sts: st.sts || {}, ft: st.ft || {}, fixHist: !st.hfix, stamp: col.stamp, tsnap: {} }, k2;
                for (k2 in col.curT) ctx.tsnap[k2] = col.curT[k2];
                for (k2 in col.curS) ctx.ss[k2] = col.curS[k2];
                // що ми щойно надіслали — вважаємо актуальним у цей момент
                ops.forEach(function (o) {
                    if (o.k.indexOf('s:') === 0) ctx.sts[o.k.slice(2)] = o.t;
                    else if (o.k.indexOf('f:') === 0) { if (o.d) delete ctx.ft[o.k]; else ctx.ft[o.k] = o.t; }
                });
                var res = applyRows(rows, snapNext, ctx);
                st.ss = ctx.ss; st.sts = ctx.sts; st.ft = ctx.ft; st.hfront = res.fav.history.length ? res.fav.history[0] : null; st.hfix = 1;
                if (res.favChanged) { sset('favorite', res.fav); try { Lampa.Favorite.read(); } catch (e) {} }
                if (res.tlChanged) { sset(tlFile(), res.tl); try { Lampa.Timeline.read(); } catch (e) {} }
                setTimeout(function () { applying = false; }, 1500);
                if (res.settingsChanged.length) settingsApplied(res.settingsChanged.length, manual || col.first);
                st.snap = snapNext;
                // запас у 10 с: запис, що сервер зберіг із трохи старішою міткою st (паралельні запити), не загубиться; повторне застосування безпечне
                st.since = Math.max(st.since, maxSt - 10000);
                st.tpush = col.tmark - 1;
                st.tsnap = ctx.tsnap;
                var tu = {}, th;
                for (th in res.tl) if (res.tl[th] && typeof res.tl[th] === 'object' && res.tl[th].updated) tu[th] = res.tl[th].updated;
                st.tu = tu;
                st.last = Date.now();
                if (st.refNext) delete st.refNext;
                st.chk = 1;
                sset('lmx_sync_state', st);
                var got = rows.length;
                setStatus('Синхронізовано ' + new Date().toLocaleTimeString().slice(0, 5) + ' (надіслано: ' + pushed + ', отримано: ' + got + ')', true);
                if (manual) noty('Синхронізовано. Надіслано: ' + pushed + ', отримано: ' + got);
            });
            fin();
        }
        step();
    }

    // Налаштування з іншого пристрою вже записані; вони подіють при наступному запуску Lampa. Жодних перезапусків і сповіщень у фоні
    function settingsApplied(n, force) {
        if (force) noty('Налаштування оновлено (' + n + '). Подіють при наступному запуску Lampa');
    }
    function schedule(ms) {
        if (!code()) return;
        clearTimeout(timer);
        timer = setTimeout(function () {
            safe(function () {
                var pl = false;
                try { pl = !!(Lampa.Player && Lampa.Player.opened && Lampa.Player.opened()); } catch (e) {}
                if (pl) return schedule(60000); // під час перегляду не чіпаємо дані
                sync(false, function (ok) { if (!ok && !busy && status.ok === false) { retryN++; if (retryN <= 3) schedule(120000 * retryN); } else if (ok) retryN = 0; });
            });
        }, ms);
    }

    // ───────── Налаштування ─────────
    function showCode(title) {
        var c = pretty(code());
        try {
            var enabled = Lampa.Controller.enabled().name;
            Lampa.Modal.open({
                title: title || 'Ваш код синхронізації',
                html: $('<div style="text-align:center;padding:1em 0"><div style="font-size:2em;font-weight:700;letter-spacing:.08em;word-break:break-all">' + c + '</div>' +
                    '<div style="margin-top:1.2em;opacity:.7;font-size:1.1em">Запишіть його. На іншому пристрої: Налаштування → LMX Sync → «Ввести код».<br>Код — це ключ до ваших даних: нікому його не давайте.</div></div>'),
                size: 'medium',
                onBack: function () { Lampa.Modal.close(); Lampa.Controller.toggle(enabled); }
            });
        } catch (e) { noty('Код: ' + c); }
    }
    function addSettings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;
        S.addComponent({
            component: 'lmx_sync', name: 'LMX Sync',
            icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        });
        function btn(name, title, desc, fn) {
            S.addParam({ component: 'lmx_sync', param: { name: 'lmx_sync_' + name, type: 'button' }, field: { name: title, description: desc }, onChange: function () { safe(fn); } });
        }
        btn('status', 'Стан', 'Натисніть, щоб побачити поточний стан', function () {
            noty(code() ? (status.text || 'Код є, синхронізація ще не запускалась') : 'Код не створено');
        });
        btn('create', 'Створити код', 'Новий особистий код для вашого облікового запису', function () {
            if (code()) { noty('Код уже є. Щоб створити новий — спочатку «Вийти (забути код)»'); return; }
            saveCode(genCode());
            sset('lmx_sync_state', '');
            showCode('Ваш код — запишіть його');
            setTimeout(function () { sync(true); }, 1500);
        });
        btn('enter', 'Ввести код', 'Підключити цей пристрій до вже створеного коду', function () {
            if (code()) { noty('Код уже є. Щоб ввести інший — спочатку «Вийти (забути код)»'); return; }
            if (!(Lampa.Input && Lampa.Input.edit)) return;
            Lampa.Input.edit({ title: 'Код синхронізації', value: '', free: true, nosave: true }, function (v) {
                if (!codeOk(v)) { noty('Невірний код: потрібно 16 цифр'); return; }
                saveCode(v);
                sset('lmx_sync_state', '');
                setTimeout(function () { sync(true); }, 800);
            });
        });
        btn('show', 'Показати мій код', 'Щоб ввести його на іншому пристрої', function () {
            if (!code()) { noty('Код не створено'); return; }
            showCode();
        });
        btn('fixhist', 'Виправити порядок історії', 'Впорядкувати історію за реальним часом перегляду (за таймкодами)', function () {
            var fav = favData(), tl = tlData(), ch;
            applying = true;
            ch = sortHistory(fav, tl, getState().ft || {});
            if (ch) { sset('favorite', fav); try { Lampa.Favorite.read(); } catch (e) {} }
            setTimeout(function () { applying = false; }, 1500);
            noty(ch ? 'Історію впорядковано за часом перегляду' : 'Порядок історії вже правильний');
        });
        btn('ref', 'Зробити цей пристрій еталоном', 'Порядок списків і історії з цього пристрою стане однаковим на всіх інших (новіші перегляди не зачіпаються)', function () {
            if (!code()) { noty('Код не створено'); return; }
            var st = getState(); st.refNext = 1; sset('lmx_sync_state', st);
            noty('Надсилаю порядок з цього пристрою…');
            sync(true);
        });
        btn('now', 'Синхронізувати зараз', 'Надіслати зміни й отримати чужі', function () { sync(true); });
        btn('reset', 'Вийти (забути код)', 'Цей пристрій перестане синхронізуватись. Дані на сервері та на пристрої лишаються', function () {
            sset('lmx_sync_code', '');
            sset('lmx_sync_state', '');
            setStatus('', true);
            noty('Код забуто. Синхронізацію вимкнено');
        });
        S.addParam({
            component: 'lmx_sync', param: { name: 'lmx_sync_server', type: 'input', values: '', default: DEFAULT_SERVER },
            field: { name: 'Адреса сервера', description: 'Налаштовується один раз; зазвичай уже вказана' }
        });
        S.addParam({ component: 'lmx_sync', param: { name: 'lmx_sync_v', type: 'title', default: '' }, field: { name: 'LMX Sync v' + VERSION + ' · дані не зашифровані, не діліться кодом' } });
    }

    // ───────── Запуск ─────────
    function start() {
        safe(addSettings);
        safe(function () {
            Lampa.Listener.follow('state:changed', function (e) {
                if (!e || applying || !code()) return;
                if (e.target === 'favorite' && e.reason !== 'read') schedule(20000);
                else if (e.target === 'timeline' && e.reason === 'update') schedule(60000);
            });
        });
        safe(function () {
            if (Lampa.Storage && Lampa.Storage.listener) Lampa.Storage.listener.follow('change', function (e) {
                if (e && !applying && code() && /^lmx_/.test(String(e.name || '')) && !SKIP_RX.test(String(e.name))) schedule(15000);
            });
        });
        safe(function () {
            if (Lampa.Player && Lampa.Player.listener) Lampa.Player.listener.follow('destroy', function () { schedule(4000); });
        });
        safe(function () {
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden && code() && Date.now() - (getState().last || 0) > 120000) schedule(2500);
            });
        });
        // раз на 20 хвилин, поки застосунок відкритий і видимий — щоб зміни з інших пристроїв підтягувались у фоні (1 легкий запит)
        safe(function () { setInterval(function () { if (!document.hidden && code() && Date.now() - (getState().last || 0) > 15 * 60000) schedule(1000); }, 5 * 60000); });
        // перша синхронізація після запуску: Lampa вже завантажила закладки й таймкоди
        schedule(6000);
    }
    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });

    // для тестів
    window.LMX_SYNC = { version: VERSION, sha256: sha256, genCode: genCode, codeOk: codeOk, uidOf: uidOf, collect: collect, applyRows: applyRows, slim: slim, pretty: pretty, settingNames: settingNames };
})();
