/*
 * LMX Source v1.0 — кнопка «Онлайн» на сторінці фільму для ВЛАСНОГО джерела (свій сервер, Jellyfin-міст, власні файли)
 *
 * Плагін не містить жодних джерел і нічого не парсить: він лише звертається до адреси, яку ви вкажете в
 * Налаштування → LMX Source, і показує те, що сервер поверне. Підключати можна лише те, на що у вас є право.
 *
 * ───────────── ЯК ПІДКЛЮЧИТИ СВОЄ ДЖЕРЕЛО ─────────────
 *  1. Налаштування → LMX Source → «Адреса сервера» (напр. https://media.example.com) і, за потреби, «Ключ API».
 *  2. Сервер віддає JSON за двома адресами (шляхи можна змінити в налаштуваннях; {id} — ID TMDB):
 *
 *     GET  {host}/api/v1/movie/{id}
 *          → { "streams": [ STREAM, STREAM, ... ] }
 *
 *     GET  {host}/api/v1/tv/{id}/season/{season}
 *          → { "episodes": [ { "number": 1, "title": "Назва", "streams": [ STREAM, ... ] }, ... ] }
 *
 *     STREAM = {
 *        "name":     "Назва джерела",                  // необов'язково
 *        "voice":    "Дубляж UA",                      // озвучка, необов'язково
 *        "quality":  "1080p"  |  {"1080p": url, "720p": url},   // необов'язково
 *        "url":      "https://.../video.m3u8 або .mp4",         // обов'язково (якщо немає quality-об'єкта)
 *        "subtitles":[ { "label": "Українська", "url": "https://.../ua.vtt" } ]   // необов'язково
 *     }
 *
 *     Ключ API передається заголовком (назву заголовка можна змінити), у адресу він не потрапляє.
 *     Сервер має дозволяти CORS для адреси, з якої відкрито Lampa (Access-Control-Allow-Origin і Allow-Headers для заголовка ключа).
 *
 *  3. Інший формат відповіді? Не міняйте сервер — задайте адаптер (у цьому файлі нижче, ADAPTER, або з іншого плагіну):
 *        window.LMX_SOURCE_ADAPTER = {
 *            movie: function (response, ctx) { return { streams: [ ... ] }; },
 *            tv:    function (response, ctx) { return { episodes: [ ... ] }; }
 *        };
 *     ctx = { id, type, season, card }.
 *
 *  Режим «Демо» (Налаштування) підставляє два тестові потоки, щоб перевірити вигляд кнопки, вибору й плеєра без сервера.
 */
(function () {
    'use strict';
    if (window.__lmx_source) return;
    window.__lmx_source = true;

    var VERSION = '1.0';
    var LABEL = 'Мій сервер';
    var PREFIX = 'lmxsrc_';
    var CACHE_MS = 10 * 60 * 1000;

    // Адаптер відповіді сервера. Залиште null, якщо сервер віддає формат із шапки файлу.
    var ADAPTER = null;

    var DEMO_STREAMS = [
        { name: 'Демо · HLS', voice: 'Big Buck Bunny', quality: 'HLS', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
        { name: 'Демо · MP4', voice: 'Big Buck Bunny', quality: { '720p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }, url: '' }
    ];

    // ───────── допоміжне ─────────
    function safe(fn) { try { return fn(); } catch (e) { try { console.log('[LMX Source]', e); } catch (e2) {} } }
    function st(key, def) { var v = Lampa.Storage.get(PREFIX + key, def); return v === undefined || v === null ? def : v; }
    function stSet(key, v) { Lampa.Storage.set(PREFIX + key, v); }
    function flag(key, def) { var v = st(key, def); return v === true || v === 'true'; }
    function noty(t) { try { Lampa.Noty.show(t); } catch (e) {} }

    function cfg() {
        var host = String(st('host', '') || '').trim().replace(/\/+$/, '');
        if (host && !/^https?:\/\//i.test(host)) host = 'https://' + host;
        return {
            host: host,
            key: String(st('key', '') || '').trim(),
            header: String(st('header', 'x-api-key') || 'x-api-key').trim(),
            moviePath: String(st('movie_path', '/api/v1/movie/{id}') || '/api/v1/movie/{id}').trim(),
            tvPath: String(st('tv_path', '/api/v1/tv/{id}/season/{season}') || '/api/v1/tv/{id}/season/{season}').trim(),
            demo: flag('demo', false)
        };
    }

    function buildUrl(c, tpl, vars) {
        var p = tpl.replace(/\{(\w+)\}/g, function (m, k) { return encodeURIComponent(vars[k] === undefined ? '' : vars[k]); });
        if (!/^\//.test(p)) p = '/' + p;
        return c.host + p;
    }

    var cache = {};
    function request(url, c, ok, fail) {
        var hit = cache[url];
        if (hit && Date.now() - hit.t < CACHE_MS) return ok(hit.d);
        var done = false, ctl = null, timer;
        function end(f, a) { if (done) return; done = true; clearTimeout(timer); f(a); }
        var headers = { 'Accept': 'application/json' };
        if (c.key && c.header) headers[c.header] = c.key;
        try { ctl = new AbortController(); } catch (e) {}
        timer = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} end(fail, 'Сервер не відповів вчасно'); }, 20000);
        fetch(url, { headers: headers, signal: ctl ? ctl.signal : undefined })
            .then(function (r) {
                if (r.status === 401 || r.status === 403) throw new Error('Сервер відхилив ключ API (' + r.status + ')');
                if (r.status === 404) throw new Error('Нічого не знайдено на сервері (404)');
                if (!r.ok) throw new Error('Помилка сервера ' + r.status);
                return r.json();
            })
            .then(function (j) { cache[url] = { t: Date.now(), d: j }; end(ok, j); })
            .catch(function (e) { end(fail, (e && e.message) || 'Не вдалося підключитись до сервера (перевірте адресу й CORS)'); });
    }

    // ───────── нормалізація відповіді ─────────
    function toStream(s) {
        if (!s || typeof s !== 'object') return null;
        var url = s.url || s.file || s.src || s.stream || '';
        var q = s.quality, qualities = null, label = '';
        if (s.qualities && typeof s.qualities === 'object') q = s.qualities;
        if (q && typeof q === 'object') {
            qualities = {};
            Object.keys(q).forEach(function (k) { if (q[k]) qualities[k] = String(q[k]); });
            var ks = Object.keys(qualities);
            if (!ks.length) qualities = null;
            else { if (!url) url = qualities[ks[0]]; label = ks.join(' / '); }
        } else if (q) label = String(q);
        if (!url) return null;
        var subs = [];
        (s.subtitles || s.subs || []).forEach(function (x) {
            if (!x) return;
            var u = x.url || x.file || x.src;
            if (u) subs.push({ label: x.label || x.name || x.lang || 'Субтитри', url: String(u) });
        });
        return {
            name: String(s.name || s.title || s.provider || ''),
            voice: String(s.voice || s.translation || s.dub || ''),
            quality: label,
            qualities: qualities,
            url: String(url),
            subtitles: subs
        };
    }
    function toStreams(list) {
        var out = [];
        (Array.isArray(list) ? list : []).forEach(function (s) { var n = toStream(s); if (n) out.push(n); });
        return out;
    }
    function normMovie(resp, ctx) {
        var ad = window.LMX_SOURCE_ADAPTER || ADAPTER;
        if (ad && ad.movie) resp = safe(function () { return ad.movie(resp, ctx); }) || resp;
        var list = resp && (resp.streams || resp.sources || resp.items || (Array.isArray(resp) ? resp : null));
        return { streams: toStreams(list) };
    }
    function normTv(resp, ctx) {
        var ad = window.LMX_SOURCE_ADAPTER || ADAPTER;
        if (ad && ad.tv) resp = safe(function () { return ad.tv(resp, ctx); }) || resp;
        var list = resp && (resp.episodes || resp.items || (Array.isArray(resp) ? resp : null)) || [];
        var out = [];
        list.forEach(function (e, i) {
            if (!e) return;
            var streams = toStreams(e.streams || e.sources || (e.url || e.file ? [e] : []));
            if (!streams.length) return;
            out.push({ number: Number(e.number || e.episode || e.episode_number || i + 1), title: String(e.title || e.name || ''), streams: streams });
        });
        out.sort(function (a, b) { return a.number - b.number; });
        return { episodes: out };
    }

    // ───────── прогрес перегляду (сумісний з іншими плагінами й самою Lampa) ─────────
    function baseName(card) { return card.original_title || card.original_name || card.title || card.name || ''; }
    function hashMovie(card) { return Lampa.Utils.hash(baseName(card)); }
    function hashEpisode(card, s, e) { return Lampa.Utils.hash([s, s > 10 ? ':' : '', e, baseName(card)].join('')); }
    function timelineOf(hash) { return safe(function () { return Lampa.Timeline.view(hash); }) || { hash: hash, percent: 0, time: 0, duration: 0 }; }

    // ───────── вибір і програвання ─────────
    var CHOICE_KEY = 'choice';
    function getChoice(id) { var o = st(CHOICE_KEY, {}); return (o && o[id]) || {}; }
    function setChoice(id, patch) {
        var o = st(CHOICE_KEY, {}) || {};
        o[id] = Object.assign({}, o[id] || {}, patch);
        var keys = Object.keys(o);
        if (keys.length > 200) delete o[keys[0]];
        stSet(CHOICE_KEY, o);
    }
    function streamTitle(s) { return s.voice || s.name || 'Потік'; }
    function streamSub(s) { return [s.voice && s.name ? s.name : '', s.quality].filter(Boolean).join(' · '); }

    function pickStream(streams, pref) {
        if (!streams.length) return null;
        if (pref) for (var i = 0; i < streams.length; i++) if (streamTitle(streams[i]) === pref) return streams[i];
        return streams[0];
    }

    function playItem(card, s, title, hash, extra) {
        var item = {
            title: title,
            url: s.url,
            subtitles: s.subtitles.length ? s.subtitles : undefined,
            timeline: timelineOf(hash)
        };
        if (s.qualities) item.quality = s.qualities;
        if (extra) for (var k in extra) item[k] = extra[k];
        return item;
    }

    function playMovie(card, s) {
        safe(function () { Lampa.Favorite.add('history', card, 100); });
        var item = playItem(card, s, card.title || card.name || '', hashMovie(card));
        Lampa.Player.play(item);
        Lampa.Player.playlist([item]);
    }

    function playEpisodes(card, season, eps, start) {
        var id = card.id, pref = getChoice(id).voice;
        var list = eps.map(function (ep) {
            var s = pickStream(ep.streams, pref);
            var t = 'S' + season + ' · E' + ep.number + (ep.title ? ' — ' + ep.title : '');
            return playItem(card, s, t, hashEpisode(card, season, ep.number), { season: season, episode: ep.number });
        });
        safe(function () { Lampa.Favorite.add('history', card, 100); });
        var first = list.filter(function (x) { return x.episode === start.number; })[0] || list[0];
        Lampa.Player.play(first);
        Lampa.Player.playlist(list);
    }

    function back() { try { Lampa.Controller.toggle('content'); } catch (e) {} }

    function chooseStream(streams, id, done) {
        if (streams.length === 1) return done(streams[0]);
        var pref = getChoice(id).voice;
        Lampa.Select.show({
            title: 'Озвучка / джерело',
            items: streams.map(function (s, i) { return { title: streamTitle(s), subtitle: streamSub(s), index: i, selected: streamTitle(s) === pref }; }),
            onSelect: function (a) { var s = streams[a.index]; setChoice(id, { voice: streamTitle(s) }); done(s); },
            onBack: back
        });
    }

    // ───────── завантаження з сервера (або демо) ─────────
    function loadMovie(card, ok, fail) {
        var c = cfg(), ctx = { id: card.id, type: 'movie', card: card };
        if (c.demo) return ok({ streams: toStreams(DEMO_STREAMS) });
        if (!c.host) return fail('Вкажіть адресу сервера: Налаштування → LMX Source');
        request(buildUrl(c, c.moviePath, { id: card.id, type: 'movie' }), c, function (j) { ok(normMovie(j, ctx)); }, fail);
    }
    function loadSeason(card, season, ok, fail) {
        var c = cfg(), ctx = { id: card.id, type: 'tv', season: season, card: card };
        if (c.demo) {
            var eps = [];
            for (var i = 1; i <= 3; i++) eps.push({ number: i, title: 'Демо-серія ' + i, streams: toStreams(DEMO_STREAMS) });
            return ok({ episodes: eps });
        }
        if (!c.host) return fail('Вкажіть адресу сервера: Налаштування → LMX Source');
        request(buildUrl(c, c.tvPath, { id: card.id, season: season, type: 'tv' }), c, function (j) { ok(normTv(j, ctx)); }, fail);
    }

    function openMovie(card) {
        Lampa.Loading.start(function () {});
        loadMovie(card, function (r) {
            Lampa.Loading.stop();
            if (!r.streams.length) return noty('На сервері немає потоків для цього фільму');
            chooseStream(r.streams, card.id, function (s) { playMovie(card, s); });
        }, function (msg) { Lampa.Loading.stop(); noty(msg); });
    }

    function seasonList(card) {
        var out = [];
        (card.seasons || []).forEach(function (s) { if (s && s.season_number > 0) out.push(s.season_number); });
        if (!out.length) { var n = Number(card.number_of_seasons) || 1; for (var i = 1; i <= n; i++) out.push(i); }
        return out;
    }

    function openSeason(card, season) {
        Lampa.Loading.start(function () {});
        loadSeason(card, season, function (r) {
            Lampa.Loading.stop();
            if (!r.episodes.length) return noty('На сервері немає серій для сезону ' + season);
            var last = getChoice(card.id);
            var items = r.episodes.map(function (ep) {
                var tl = timelineOf(hashEpisode(card, season, ep.number));
                var sub = tl.percent ? tl.percent + '% переглянуто' : '';
                return { title: 'Серія ' + ep.number + (ep.title ? ' — ' + ep.title : ''), subtitle: sub, number: ep.number, selected: last.season === season && last.episode === ep.number };
            });
            Lampa.Select.show({
                title: 'Сезон ' + season,
                items: items,
                onSelect: function (a) {
                    var ep = r.episodes.filter(function (x) { return x.number === a.number; })[0];
                    setChoice(card.id, { season: season, episode: ep.number });
                    if (ep.streams.length > 1 && !getChoice(card.id).voice) {
                        chooseStream(ep.streams, card.id, function () { playEpisodes(card, season, r.episodes, ep); });
                    } else playEpisodes(card, season, r.episodes, ep);
                },
                onBack: function () { openTv(card, true); }
            });
        }, function (msg) { Lampa.Loading.stop(); noty(msg); });
    }

    function openTv(card, forceList) {
        var seasons = seasonList(card);
        if (seasons.length === 1 && !forceList) return openSeason(card, seasons[0]);
        var last = getChoice(card.id);
        Lampa.Select.show({
            title: 'Сезон',
            items: seasons.map(function (n) { return { title: 'Сезон ' + n, number: n, selected: last.season === n }; }),
            onSelect: function (a) { openSeason(card, a.number); },
            onBack: back
        });
    }

    function open(card) {
        if (!card || !card.id) return;
        if (card.name && !card.title || card.number_of_seasons || card.media_type === 'tv') openTv(card);
        else openMovie(card);
    }

    // ───────── кнопка на сторінці фільму ─────────
    var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor"/></svg>';
    function addButton(e) {
        if (!flag('btn', true)) return;
        var render = e.object && e.object.activity && e.object.activity.render();
        if (!render || !render.length) return;
        if (render.find('.view--lmxsrc').length) return;
        var card = e.data && e.data.movie;
        if (!card) return;
        var box = render.find('.full-start-new__buttons, .full-start__buttons').eq(0);
        if (!box.length) return;
        var btn = $('<div class="full-start__button selector view--lmxsrc">' + ICON + '<span>' + (cfg().demo ? 'Демо' : LABEL) + '</span></div>');
        btn.on('hover:enter', function () { safe(function () { open(card); }); });
        var anchor = box.find('.view--torrent, .view--online').first();
        if (anchor.length) anchor.before(btn); else box.append(btn);
    }

    // ───────── налаштування ─────────
    function testConnection() {
        var c = cfg();
        if (c.demo) return noty('Увімкнено демо-режим: сервер не використовується');
        if (!c.host) return noty('Спочатку вкажіть адресу сервера');
        var url = buildUrl(c, c.moviePath, { id: 603, type: 'movie' });
        delete cache[url];
        noty('Перевіряю: ' + c.host);
        request(url, c, function (j) {
            var r = normMovie(j, { id: 603, type: 'movie' });
            noty('Сервер відповів. Потоків для тестового фільму: ' + r.streams.length);
        }, function (m) { noty(m); });
    }
    function addSettings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;
        S.addComponent({
            component: 'lmx_source', name: 'LMX Source',
            icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor"/></svg>'
        });
        function p(name, type, def, title, desc, extra) {
            var o = { component: 'lmx_source', param: { name: PREFIX + name, type: type, default: def }, field: { name: title, description: desc } };
            if (extra) for (var k in extra) o[k] = extra[k];
            S.addParam(o);
        }
        p('btn', 'trigger', true, 'Кнопка на сторінці фільму', 'Показувати кнопку «' + LABEL + '»');
        p('demo', 'trigger', false, 'Демо-режим', 'Тестові потоки без сервера, щоб перевірити вигляд і плеєр', { onChange: function () { cache = {}; } });
        p('host', 'input', '', 'Адреса сервера', 'Напр. https://media.example.com', { onChange: function () { cache = {}; } });
        p('key', 'input', '', 'Ключ API', 'Необов’язково; передається заголовком, не в адресі', { onChange: function () { cache = {}; } });
        p('header', 'input', 'x-api-key', 'Назва заголовка ключа', 'За замовчуванням x-api-key');
        p('movie_path', 'input', '/api/v1/movie/{id}', 'Шлях для фільмів', '{id} — ID TMDB', { onChange: function () { cache = {}; } });
        p('tv_path', 'input', '/api/v1/tv/{id}/season/{season}', 'Шлях для серіалів', '{id} — ID TMDB, {season} — номер сезону', { onChange: function () { cache = {}; } });
        S.addParam({
            component: 'lmx_source', param: { name: PREFIX + 'test', type: 'button' },
            field: { name: 'Перевірити з’єднання', description: 'Запит до сервера для тестового фільму' },
            onChange: function () { safe(testConnection); }
        });
    }

    // ───────── запуск ─────────
    function start() {
        safe(addSettings);
        Lampa.Listener.follow('full', function (e) { if (e.type === 'complite' || e.type === 'complete') safe(function () { addButton(e); }); });
    }
    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') start(); });

    // для налагодження й тестів
    window.LMX_SOURCE = { version: VERSION, cfg: cfg, normMovie: normMovie, normTv: normTv, buildUrl: buildUrl, open: open };
})();
