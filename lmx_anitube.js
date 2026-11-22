/*
 * LMX UA (файл lmx_anitube.js) — кнопка «LMX UA» на сторінці фільму чи серіалу: українська озвучка з кількох сайтів
 *  • Аніме: Anitube, AnimeON, Mikai, Unimay (FanVoxUA, Рідний Голос та ін.); фільми й серіали: Eneyida, UAFlix; дорами: BambooUA
 *  • Самостійний плагін: власний стандартний екран «Онлайн» з вибором джерела (його оформлює й автопідбором керує LMX Watch)
 *  • Пошук, сезони, озвучки й серії віддає LMX Worker; сайти й плеєри, що не пускають сервери чи працюють лише для України (Eneyida, HDVB UA, Ashdi, Tortuga), відкриває сам пристрій
 *
 *  Екран «Онлайн» узято з відкритого проєкту Lampac (https://github.com/immisterio/Lampac, ліцензія AGPL-3.0);
 *  тож і цей файл поширюється на умовах AGPL-3.0 з відкритим кодом.
 */
(function () {
    'use strict';
    if (window.__lmxAnitube4) return;
    window.__lmxAnitube4 = true;
    var VERSION = '5.22';
    // Назва в списку розширень Lampa (інакше там «Без назви»)
    try { if (window.Lampa && Lampa.Manifest) Lampa.Manifest.plugins = { type: 'other', version: String(VERSION), name: 'LMX UA', description: 'Українська озвучка: Anitube, AnimeON, Mikai, Unimay (аніме) та Eneyida, UAFlix (фільми й серіали), BambooUA (дорами)', author: 'Irfnekf' }; } catch (e) {}

    var DEFAULT_HOST = 'https://lmx-sync.vladshkaraputa07.workers.dev';
    var COMP = 'lmx_anitube_online';

    function safe(fn) { try { return fn(); } catch (e) { try { console.log('LMX UA', e); } catch (x) {} } }
    function host() { var s = ''; try { s = String(Lampa.Storage.get('lmx_sync_server', '') || ''); } catch (e) {} return (s || DEFAULT_HOST).replace(/\/+$/, ''); }
    function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    // ───────── сторінки плеєрів (Ashdi, Tortuga) — з самого пристрою ─────────
    function fixUrl(u) { u = String(u || '').trim(); if (u.indexOf('//') === 0) u = 'https:' + u; return u.replace('0yql3tj', 'oyql3tj'); }
    // Tortuga ховає дані плеєра: base64, перший байт — ключ, далі XOR (як у Lampac)
    function tortugaDecode(b64) {
        try {
            var s = String(b64 || '').replace(/[^A-Za-z0-9+\/=]/g, ''); while (s.length % 4) s += '=';
            var bin = atob(s), out = [], seed = bin.charCodeAt(0), i;
            for (i = 1; i < bin.length; i++) out.push(bin.charCodeAt(i) ^ ((seed + 7 * (i - 1) + 13) & 255));
            var str = ''; for (i = 0; i < out.length; i++) str += String.fromCharCode(out[i]);
            try { return decodeURIComponent(escape(str)); } catch (e) { return str; }
        } catch (e) { return ''; }
    }
    // файл плеєра: пряме посилання, список якостей, серіал (JSON) або закодовані дані Tortuga
    function playerData(page) {
        page = String(page || '');
        var m = page.match(/\bfile\s*:\s*'(\[\{[\s\S]*?\}\])'\s*,/) || page.match(/\bfile\s*:\s*"(\[\{[\s\S]*?\}\])"\s*,/);
        if (m) { try { return { serial: JSON.parse(m[1].replace(/,\s*([\]}])/g, '$1')), kind: 'ashdi' }; } catch (e) {} }
        m = page.match(/\bfile\s*:\s*"([A-Za-z0-9+\/]{24,}={0,2})"/);
        if (m && !/^https?:/i.test(m[1])) {
            var dec = tortugaDecode(m[1]);
            if (/^https?:/i.test(dec)) return { file: dec };
            if (/^\s*\[/.test(dec)) { try { return { serial: JSON.parse(dec.replace(/,\s*([\]}])/g, '$1')), kind: 'tortuga' }; } catch (e) {} }
        }
        var raw = (page.match(/\bfile\s*:\s*"([^"]+)"/) || page.match(/\bfile\s*:\s*'([^']+)'/) || page.match(/["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/) || [])[1];
        return raw ? { file: raw } : null;
    }
    function playFrom(raw) {
        var quality = {}, main = '';
        if (/^\s*\[/.test(raw)) {
            raw.split(',').forEach(function (part) { var q = part.match(/^\s*\[([^\]]+)\]\s*(\S+)/); if (q) quality[q[1]] = fixUrl(q[2]); });
            var ks = Object.keys(quality).sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10); });
            main = ks.length ? quality[ks[0]] : '';
        } else main = fixUrl(raw);
        return main ? { method: 'play', url: main, quality: Object.keys(quality).length ? quality : undefined } : null;
    }
    var tcache = {};
    function fetchText(url, ok, fail) {
        var hit = tcache[url];
        if (hit && Date.now() - hit.t < 20 * 60000) return ok(hit.d);
        var net, done = false;
        function end(f, a) { if (done) return; done = true; f(a); }
        try { net = new Lampa.Reguest(); net.timeout(12000); } catch (e) { return fail(); }
        setTimeout(function () { if (!done) { try { net.clear(); } catch (x) {} end(fail); } }, 13000);
        try {
            net['native'](url, function (t) { t = typeof t === 'string' ? t : ''; if (!t) return end(fail); tcache[url] = { t: Date.now(), d: t }; end(ok, t); }, function () { end(fail); }, false, { dataType: 'text' });
        } catch (e) { end(fail); }
    }

    // ── Eneyida (eneyida.tv): сайт не пускає сервери, тож пошук і сторінку тайтлу відкриває сам пристрій ──
    function nrm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[’'`ʼ]/g, '').replace(/[^a-z0-9а-яіїєґ]+/gi, ' ').replace(/\s+/g, ' ').trim(); }
    function tokEq(a, b) { if (a === b) return true; if (a.length < 3 || b.length < 3) return false; var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i >= Math.min(4, a.length, b.length); }
    function score(t, names) {
        var p = nrm(t), best = 0;
        if (!p) return 0;
        names.forEach(function (n) {
            if (!n) return;
            if (p === n) { best = 1; return; }
            var A = p.split(' '), B = n.split(' '), used = {}, inter = 0;
            B.forEach(function (w) { for (var k = 0; k < A.length; k++) if (!used[k] && tokEq(A[k], w)) { used[k] = 1; inter++; break; } });
            var j = inter / Math.max(A.length, B.length);
            if (j >= 0.6 && 0.6 + j * 0.3 > best) best = 0.6 + j * 0.3;
        });
        return best;
    }
    function eyFind(url, done) {
        var title = qget(url, 'title'), orig = qget(url, 'original_title'), year = parseInt(qget(url, 'year'), 10) || 0;
        var names = [nrm(title), nrm(orig)].filter(Boolean), qs = [title, orig].filter(function (q, i, a) { return q && /[0-9A-Za-zА-Яа-яІіЇїЄєҐґ]{2}/.test(q) && a.indexOf(q) === i; });
        var found = [], left = qs.length, reached = false;
        if (!left) return done(null);
        qs.forEach(function (q) {
            fetchText('https://eneyida.tv/index.php?do=search&subaction=search&story=' + encodeURIComponent(q), function (html) {
                reached = true;
                html.split(/<article\s/i).slice(1).forEach(function (row) {
                    var link = (row.match(/href="(https?:\/\/[^\/"]+\/\d+[^"]*\.html)"/) || [])[1];
                    if (!link || found.some(function (f) { return f.link === link; })) return;
                    var ua = (row.match(/id="short_title"[^>]*>([^<]+)</) || [])[1] || '';
                    var sub = row.match(/class="short_subtitle">(?:<a [^>]+>(\d{4})<\/a>)?([^<]*)<\/div>/);
                    var y = sub && sub[1] ? parseInt(sub[1], 10) : 0;
                    var sc = Math.max(score(ua, names), score(sub ? sub[2] : '', names));
                    if (year && y) sc += Math.abs(y - year) <= 1 ? 0.3 : -0.4;
                    if (sc >= 0.6) found.push({ link: link, sc: sc });
                });
                if (--left === 0) next();
            }, function () { if (--left === 0) next(); });
        });
        function next() {
            // сайт зовсім не відповів (браузер на комп'ютері блокує такі запити) — це не «немає тайтлу»
            if (!reached) return done(null, 'blocked');
            if (!found.length) return done(null);
            found.sort(function (a, b) { return b.sc - a.sc; });
            fetchText(found[0].link, function (page) {
                // плеєр: HDVB UA (серіал — /embed/, фільм — /vid/), Ashdi або Tortuga; адреса з ?tr=1 — трейлер, її пропускаємо
                var frames = [];
                page.replace(/<iframe[^>]+src="(https?:\/\/(?:hdvbua\.[a-z]+|ashdi\.vip|tortuga\.[a-z]+)\/[^"]+)"/gi, function (m, u) { if (!/[?&]tr=1\b/.test(u)) frames.push(u); return m; });
                done(frames.filter(function (u) { return /hdvbua\.[a-z]+\/(?:embed|embd)\//.test(u); })[0] || frames[0] || null);
            }, function () { done(null); });
        }
    }

    // ── UAKino (uakino.cx): сервер Oracle сайт не відкриває — шукає й розбирає сам пристрій; плеєр той самий HDVB UA, що й в Eneyida ──
    function ukFind(url, done) {
        var title = qget(url, 'title'), orig = qget(url, 'original_title'), year = parseInt(qget(url, 'year'), 10) || 0, serial = qget(url, 'serial') === '1';
        var names = [nrm(title), nrm(orig)].filter(Boolean), qs = [title, orig].filter(function (q, i, a) { return q && /[0-9A-Za-zА-Яа-яІіЇїЄєҐґ]{2}/.test(q) && a.indexOf(q) === i; });
        var found = [], left = qs.length, reached = false;
        if (!left) return done(null);
        qs.forEach(function (q) {
            fetchText('https://uakino.cx/index.php?do=search&subaction=search&search_start=0&full_search=0&story=' + encodeURIComponent(q), function (html) {
                reached = true;
                html.split(/<div class="item expand-link grid-items__item/).slice(1).forEach(function (row) {
                    var m = row.match(/<a class="item__title[^"]*" href="(https?:\/\/[^"]+\.html)">([^<]+)<\/a>/);
                    if (!m || found.some(function (f) { return f.link === m[1]; })) return;
                    var lab = (row.match(/class="item__label">([^<]*)</) || [])[1] || '';
                    if (/сезон|серія/i.test(lab) !== serial && lab) return;
                    var sc = score(m[2].replace(/&#0?39;/g, "'"), names);
                    if (sc >= 0.6) found.push({ link: m[1], sc: sc });
                });
                if (--left === 0) next();
            }, function () { if (--left === 0) next(); });
        });
        function next() {
            if (!reached) return done(null, 'blocked');
            if (!found.length) return done(null);
            found.sort(function (a, b) { return b.sc - a.sc; });
            var list = found.slice(0, 3), i = 0;
            (function tryNext() {
                if (i >= list.length) return done(null);
                fetchText(list[i++].link, function (page) {
                    var y = parseInt((page.match(/Рік виходу:<\/span>[\s\S]{0,120}?(\d{4})/) || [])[1] || '0', 10);
                    if (year && y && Math.abs(y - year) > 1) return tryNext();
                    var fr = (page.match(/<iframe[^>]+src="(https?:\/\/hdvbua\.[a-z]+\/(?:embed|embd|vid)\/[^"]+)"/i) || [])[1];
                    if (fr && !/[?&]tr=1\b/.test(fr)) done(fr); else tryNext();
                }, tryNext);
            })();
        }
    }

    // ── KinoUkr: офлайн-база kinoukr.com (назва → плеєр Ashdi/Tortuga), лежить поруч із плагіном на GitHub Pages; плеєр відкриває сам пристрій ──
    var kuDb = null, kuWait = null;
    function kuFind(url, done) {
        function go(db) {
            var title = qget(url, 'title'), orig = qget(url, 'original_title'), year = parseInt(qget(url, 'year'), 10) || 0;
            var n1 = nrm(title), n2 = nrm(orig), best = null, bs = -1;
            db.forEach(function (r) {
                var hit = (n2 && nrm(r[1]) === n2) || (n1 && nrm(r[0]) === n1);
                if (!hit) return;
                var sc = !year || !r[2] ? 1 : (r[2] === year ? 3 : Math.abs(r[2] - year) <= 1 ? 2 : -1);
                if (n2 && nrm(r[1]) === n2 && n1 && nrm(r[0]) === n1) sc += 0.5;
                if (sc > bs) { bs = sc; best = r; }
            });
            if (!best || bs < 0) return done(null);
            done(best[3] ? 'https://ashdi.vip/' + best[3] : 'https://tortuga.tw/' + best[4]);
        }
        if (kuDb) return go(kuDb);
        if (kuWait) return kuWait.push(go);
        kuWait = [go];
        fetchText(KU_DB, function (t) {
            try { kuDb = JSON.parse(t); } catch (e) { kuDb = []; }
            var w = kuWait; kuWait = null; w.forEach(function (f) { f(kuDb); });
        }, function () { var w = kuWait; kuWait = null; w.forEach(function (f) { f([]); }); });
    }
    var KU_DB = (function () {
        try { var sc = document.currentScript && document.currentScript.src; if (sc && /lmx_anitube\.js/.test(sc)) return sc.replace(/lmx_anitube\.js.*$/, 'kinoukr_db.json'); } catch (e) {}
        return 'https://irfnekf.github.io/lampa-plugins/kinoukr_db.json';
    })();

    // ── PidTor: торренти з jac.red, дивимось через TorrServer, указаний у налаштуваннях Lampa на цьому пристрої (сервер Oracle торренти не качає) ──
    var ptCache = {};
    function tsHost() {
        var u = '';
        try { u = String(Lampa.Storage.get(Lampa.Storage.get('torrserver_use_link', 'one') === 'two' ? 'torrserver_url_two' : 'torrserver_url', '') || ''); } catch (e) {}
        if (!u) try { u = String(Lampa.Storage.get('torrserver_url', '') || ''); } catch (e) {}
        u = u.trim().replace(/\/+$/, '');
        if (u && !/^https?:\/\//i.test(u)) u = 'http://' + u;
        return u;
    }
    function ptList(url, done) {
        var title = qget(url, 'title'), orig = qget(url, 'original_title'), year = qget(url, 'year'), serial = qget(url, 'serial') === '1';
        var mv = {}; try { mv = (Lampa.Activity.active() || {}).card || {}; } catch (e) {}
        var anime = mv.original_language === 'ja';
        var key = [title, orig, year, serial].join('|');
        if (ptCache[key]) return done(ptCache[key]);
        var q = 'https://jac.red/api/v2.0/indexers/all/results?title=' + encodeURIComponent(title) + '&title_original=' + encodeURIComponent(orig) + '&year=' + encodeURIComponent(year) + '&is_serial=' + (anime ? 5 : serial ? 2 : 1);
        fetchText(q, function (t) {
            var R = []; try { R = JSON.parse(t).Results || []; } catch (e) {}
            var seen = {}, list = [];
            R.forEach(function (r) {
                var inf = r.info || {}, m = String(r.MagnetUri || '').match(/btih:([a-z0-9]{32,40})/i);
                if (!m || (r.Seeders || 0) < 2) return;
                var h = m[1].toLowerCase(); if (seen[h]) return; seen[h] = 1;
                var qv = inf.quality || (/2160|4k/i.test(r.Title) ? 2160 : /1080/.test(r.Title) ? 1080 : /720/.test(r.Title) ? 720 : 0);
                if (qv && qv < 720) return;
                var voices = inf.voices || [], ua = /ukr/i.test(String(r.languages || '')) || voices.some(function (v) { return /укр|ukr/i.test(v); }) || /укр|ukr/i.test(r.Title);
                var gb = (r.Size || 0) / 1073741824;
                list.push({ h: h, q: qv, ua: ua, hdr: /hdr|dolby|dv/i.test(String(inf.videotype || '') + r.Title), gb: gb, sid: r.Seeders || 0, seasons: inf.seasons || [], voices: voices, name: r.Title,
                    sc: (ua ? 3 : 0) + (qv >= 2160 ? 2 : qv >= 1080 ? 1.5 : 1) + Math.min(r.Seeders || 0, 100) / 100 - (gb > 80 && !serial ? 0.5 : 0) });
            });
            list.sort(function (a, b) { return b.sc - a.sc; });
            ptCache[key] = list;
            done(list);
        }, function () { done(null); });
    }
    function ptFiles(ts, h, done) {
        var t0 = Date.now();
        (function poll() {
            fetchTextNc(ts + '/stream?link=' + h + '&stat', function (t) {
                var j = null; try { j = JSON.parse(t); } catch (e) {}
                var fs = j && j.file_stats;
                if (fs && fs.length) return done(fs.filter(function (f) { return /\.(mkv|mp4|avi|ts|m2ts|mov|webm)$/i.test(f.path || ''); }));
                if (Date.now() - t0 > 25000) return done(null);
                setTimeout(poll, 1500);
            }, function () { if (Date.now() - t0 > 25000) return done(null, 'ts'); setTimeout(poll, 2000); });
        })();
    }
    function fetchTextNc(url, ok, fail) {
        try { var net = new Lampa.Reguest(); net.timeout(15000); net['native'](url, function (t) { ok(typeof t === 'string' ? t : JSON.stringify(t)); }, fail, false, { dataType: 'text' }); } catch (e) { fail(); }
    }
    // Вигляд як у PidTor з Lampac: фільм — кожна роздача окремою карткою; серіал — сезон → картки роздач → серії
    function ptLabel(x) { return (x.q ? (x.q >= 2160 ? '2160p' : x.q + 'p') : '') + (x.hdr ? ' HDR' : '') + ' / ' + (x.gb >= 1 ? x.gb.toFixed(1) + ' ГБ' : Math.round(x.gb * 1024) + ' МБ') + ' / ↑' + x.sid; }
    function ptVoice(x) { return (x.ua ? '🇺🇦 ' : '') + (x.voices.length ? x.voices.slice(0, 6).join(', ') : 'Озвучка не вказана'); }
    function ptHtml(url, done) {
        var ts = tsHost();
        if (!ts) { try { Lampa.Noty.show('PidTor: вкажіть адресу TorrServer у Налаштування → TorrServer'); } catch (e) {} return done(emptyHtml('PidTor дивиться торренти через TorrServer — вкажіть його адресу в Налаштування → TorrServer')); }
        var serial = qget(url, 'serial') === '1', sP = parseInt(qget(url, 's'), 10) || 0, hP = qget(url, 'h');
        var base = url.replace(/[?&](s|h)=[^&]*/g, '');
        function item(cls, json, attrs, inner) { return '<div class="' + cls + ' selector"' + (attrs || '') + ' data-json="' + esc(JSON.stringify(json)) + '">' + inner + '</div>'; }
        if (hP) {
            // серії обраної роздачі
            return ptFiles(ts, hP, function (files, why) {
                if (!files || !files.length) return done(emptyHtml(why === 'ts' ? 'TorrServer за адресою ' + ts + ' не відповідає' : 'Ця роздача не завантажилась — поверніться й оберіть іншу'));
                files.sort(function (a, b) { return String(a.path).localeCompare(String(b.path), undefined, { numeric: true }); });
                var rows = files.map(function (f, i) {
                    var nm = String(f.path).split('/').pop(), m = nm.match(/s(\d{1,2})[ ._-]*e(\d{1,3})/i) || nm.match(/(\d{1,2})x(\d{1,3})/i);
                    return { f: f, nm: nm, s: m ? parseInt(m[1], 10) : 0, e: m ? parseInt(m[2], 10) : (parseInt((nm.match(/(?:^|[^\d])(\d{1,3})(?:[^\d]|$)/) || [])[1], 10) || i + 1) };
                });
                var inS = rows.filter(function (r) { return !r.s || !sP || r.s === sP; });
                if (inS.length) rows = inS;
                done(rows.map(function (r) {
                    var u = ts + '/stream/' + encodeURIComponent(r.nm) + '?link=' + hP + '&index=' + r.f.id + '&play';
                    return item('videos__item videos__movie', { method: 'play', url: u, title: 'Серія ' + r.e }, ' media="" s="' + (sP || r.s || 1) + '" e="' + r.e + '"', '<div class="videos__item-title">Серія ' + r.e + '</div>');
                }).join(''));
            });
        }
        ptList(url, function (list) {
            if (list === null) return done(emptyHtml('Торрент-пошук jac.red не відповів'));
            if (!list.length) return done(emptyHtml('Роздач не знайдено'));
            if (!serial) {
                return done(list.slice(0, 40).map(function (x) {
                    return item('videos__item videos__movie', { method: 'call', url: host() + '/lite/video?u=' + encodeURIComponent('pt:' + x.h), title: ptVoice(x), voice_name: ptLabel(x), maxquality: x.q ? (x.q >= 2160 ? '2160p' : x.q + 'p') : '' }, ' media=""', '<div class="videos__item-title">' + esc(ptVoice(x)) + '</div>');
                }).join(''));
            }
            if (!sP) {
                var ss = {}; list.forEach(function (x) { x.seasons.forEach(function (n) { ss[n] = 1; }); });
                var nums = Object.keys(ss).map(Number).filter(Boolean).sort(function (a, b) { return a - b; });
                if (!nums.length) nums = [1];
                return done(nums.map(function (n) { return item('videos__item videos__season', { method: 'link', url: base + '&s=' + n }, '', '<div class="videos__item-title videos__season-title">' + n + ' сезон</div>'); }).join(''));
            }
            var L = list.filter(function (x) { return !x.seasons.length || x.seasons.indexOf(sP) >= 0; });
            if (!L.length) return done(emptyHtml('Роздач для ' + sP + ' сезону не знайдено'));
            done(L.slice(0, 40).map(function (x) {
                return item('videos__item videos__season', { method: 'link', url: base + '&s=' + sP + '&h=' + x.h, similar: true, title: ptVoice(x), details: ptLabel(x) + (x.seasons.length > 1 ? ' / сезони ' + x.seasons[0] + '–' + x.seasons[x.seasons.length - 1] : ''), year: '' }, '', '<div class="videos__item-title">' + esc(ptVoice(x)) + '</div>');
            }).join(''));
        });
    }
    // запуск фільму з роздачі: беремо найбільший відеофайл
    function ptPlay(h, ok, fail) {
        var ts = tsHost();
        if (!ts) return fail();
        ptFiles(ts, h, function (files) {
            if (!files || !files.length) return fail();
            files.sort(function (a, b) { return (b.length || 0) - (a.length || 0); });
            var f = files[0], nm = String(f.path).split('/').pop();
            ok({ method: 'play', url: ts + '/stream/' + encodeURIComponent(nm) + '?link=' + h + '&index=' + f.id + '&play' });
        });
    }

    // Українські озвучки в змішаних джерелах (Phantom, Spectre, Aladin…) позначаємо 🇺🇦 — і в списку «Озвучка», і на картках фільму.
    // Якщо в джерелі всі озвучки українські (Eneyida, UAKino…), нічого не позначаємо, щоб не рябіло.
    var UA_RX = /укр|україн|ukr|\bua\b|(^|[^а-яіїєґ])уа([^а-яіїєґ]|$)|[іїєґ]/i, ORIG_RX = /оригін|оригинал|original|субтитр|subtit/i;
    function isUaName(t) { t = String(t || ''); return UA_RX.test(t) && !ORIG_RX.test(t); }
    function uaMark(html) {
        if (html.indexOf('🇺🇦') >= 0) return html;
        var btnRx = /<div class="videos__button[^"]*"[^>]*>([^<]+)<\/div>/g;
        var movRx = /<div class="videos__item videos__movie[^>]*>(?:(?!<div class="videos__item videos__movie)[\s\S])*?<div class="videos__item-title">([^<]+)<\/div><\/div>(?:\s*<!--[^>]*-->)?/g;
        function blocks(rx) { var out = [], m; rx.lastIndex = 0; while ((m = rx.exec(html))) out.push({ s: m.index, e: m.index + m[0].length, t: m[1], h: m[0] }); return out; }
        var B = blocks(btnRx), M = blocks(movRx);
        // картки фільму — це озвучки, лише якщо їх кілька й це не «Серія N»
        var movIsVoice = M.length > 1 && !M.some(function (x) { return /^\s*(серія|серия|episode|епізод)\s*\d/i.test(x.t); });
        var all = B.concat(movIsVoice ? M : []), ua = all.filter(function (x) { return isUaName(x.t); }).length;
        if (!ua || ua === all.length) return html;
        function flag(x) { return isUaName(x.t) ? x.h.replace('>' + x.t + '</div>', '>🇺🇦 ' + x.t + '</div>') : x.h; }
        // українські — на початок списку (порядок решти не змінюємо); переставляємо лише суцільний блок, інакше тільки позначаємо
        function apply(src, L) {
            if (!L.length) return src;
            var solid = L.every(function (x, i) { return !i || !src.slice(L[i - 1].e, x.s).trim(); });
            var hs = L.map(function (x) { return { ua: isUaName(x.t), h: flag(x) }; });
            if (solid) {
                var sorted = hs.filter(function (x) { return x.ua; }).concat(hs.filter(function (x) { return !x.ua; }));
                return src.slice(0, L[0].s) + sorted.map(function (x) { return x.h; }).join('') + src.slice(L[L.length - 1].e);
            }
            var out = '', pos = 0;
            L.forEach(function (x, i) { out += src.slice(pos, x.s) + hs[i].h; pos = x.e; });
            return out + src.slice(pos);
        }
        // спершу ті, що стоять далі в тексті, щоб не зсунути позиції
        var groups = [B, movIsVoice ? M : []].filter(function (g) { return g.length; }).sort(function (x, y) { return y[0].s - x[0].s; });
        groups.forEach(function (g) { html = apply(html, g); });
        return html;
    }

    // ── UAFlix (uafix.net): якщо сайт не пустив Worker — шукає й розбирає сам пристрій; відео — плеєр zetvideo з прямим m3u8 ──
    var UF = 'https://uafix.net';
    function ufVod(page) { var m = String(page || '').match(/(?:https?:)?\/\/zetvideo\.net\/vod\/\d+/i); return m ? ('https:' + m[0].replace(/^https?:/, '')) : ''; }
    function ufPlay(u, ok, fail) {
        // посилання на відео з плеєра zetvideo дістає Worker (його zetvideo пускає), а сторінку серії на uafix — пристрій (Worker сайт не пускає)
        function fromVod(vod) {
            var viaDevice = function () {
                fetchText(vod, function (h) { var m = (h.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/) || [])[1]; if (m) ok({ method: 'play', url: m }); else fail(); }, fail);
            };
            try {
                var net = new Lampa.Reguest(); net.timeout(10000);
                net.silent(host() + '/lite/ufv?u=' + encodeURIComponent(vod), function (j) {
                    try { if (typeof j === 'string') j = JSON.parse(j); } catch (e) { j = null; }
                    if (j && j.url) ok({ method: 'play', url: j.url }); else viaDevice();
                }, viaDevice);
            } catch (e) { viaDevice(); }
        }
        if (/^https:\/\/zetvideo\.net\//.test(u)) return fromVod(u);
        fetchText(u, function (pg) { var v = ufVod(pg); if (v) fromVod(v); else fail(); }, fail);
    }
    function ufItem(cls, json, attrs, inner) { return '<div class="' + cls + ' selector"' + (attrs || '') + ' data-json="' + esc(JSON.stringify(json)) + '">' + inner + '</div>'; }
    function ufPageHtml(url, page, html) {
        var serial = qget(url, 'serial') === '1', title = qget(url, 'title') || 'UAFlix';
        var call = function (u, t) { return host() + '/lite/ufv?u=' + encodeURIComponent(u) + '&t=' + encodeURIComponent(t); };
        if (!serial) {
            var vod = ufVod(html);
            return vod ? ufItem('videos__item videos__movie', { method: 'call', url: call(vod, title), title: title, voice_name: 'UAFlix' }, ' media=""', '<div class="videos__item-title">UAFlix</div>') : '';
        }
        var eps = {}, base = page.replace(/\/+$/, '');
        html.replace(/href="(https:\/\/uafix\.net\/[^"]+?\/season-(\d+)-episode-(\d+)\/?)"/g, function (m, link, sn, en) {
            if (link.indexOf(base + '/') !== 0) return m;
            (eps[+sn] || (eps[+sn] = {}))[+en] = link; return m;
        });
        var sns = Object.keys(eps).map(Number).sort(function (a, b) { return a - b; });
        if (!sns.length) return '';
        var s = parseInt(qget(url, 'ufs'), 10) || 0;
        var self = url.split('?')[0] + '?' + ['title', 'original_title', 'year', 'serial'].map(function (k) { return k + '=' + encodeURIComponent(qget(url, k)); }).join('&') + '&uf=' + encodeURIComponent(page);
        if (!s && sns.length > 1) return sns.map(function (n) { return ufItem('videos__item videos__season', { method: 'link', url: self + '&ufs=' + n }, '', '<div class="videos__item-title videos__season-title">' + n + ' сезон</div>'); }).join('');
        if (!eps[s]) s = sns[0];
        return Object.keys(eps[s]).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
            return ufItem('videos__item videos__movie', { method: 'call', url: call(eps[s][n], 'Серія ' + n), title: 'Серія ' + n, voice_name: 'UAFlix' }, ' media="" s="' + s + '" e="' + n + '"', '<div class="videos__item-title">Серія ' + n + '</div>');
        }).join('');
    }
    function ufDevice(url, done) {
        var page = qget(url, 'uf');
        if (page && page.indexOf(UF + '/') === 0) return fetchText(page, function (h) { done(ufPageHtml(url, page, h)); }, function () { done('', 'blocked'); });
        var title = qget(url, 'title'), orig = qget(url, 'original_title'), year = parseInt(qget(url, 'year'), 10) || 0, serial = qget(url, 'serial') === '1';
        var names = [nrm(title), nrm(orig)].filter(Boolean), qs = [title, orig].filter(function (q, i, a) { return q && /[0-9A-Za-zА-Яа-яІіЇїЄєҐґ]{2}/.test(q) && a.indexOf(q) === i; });
        var cand = [], left = qs.length, reached = false;
        if (!left) return done('');
        qs.forEach(function (q) {
            fetchText(UF + '/index.php?do=search&subaction=search&story=' + encodeURIComponent(q), function (res) {
                reached = true;
                res.replace(/<a class="sres-wrap[^"]*" href="(https:\/\/uafix\.net\/[^"]+)">[\s\S]*?<h2>([^<]+)<\/h2>/g, function (m, link, t) {
                    if (cand.some(function (c) { return c.link === link; })) return m;
                    if (/\/(films|serials)\//.test(link) && /\/serials\//.test(link) !== serial) return m;
                    var sc = 0; String(t).replace(/&#0?39;/g, "'").split(/\s+\/\s+/).forEach(function (x) { sc = Math.max(sc, score(x, names)); });
                    if (sc >= 0.6) cand.push({ link: link, sc: sc });
                    return m;
                });
                if (--left === 0) next();
            }, function () { if (--left === 0) next(); });
        });
        function next() {
            if (!reached) return done('', 'blocked');
            cand.sort(function (a, b) { return b.sc - a.sc; });
            var list = cand.slice(0, 3), i = 0;
            (function tryNext() {
                if (i >= list.length) return done('');
                var c = list[i++];
                fetchText(c.link, function (h) {
                    var y = parseInt((h.match(/Рік виходу:<\/span>[\s\S]{0,200}?(\d{4})/) || [])[1] || '0', 10);
                    if (year && y && Math.abs(y - year) > 1) return tryNext();
                    done(ufPageHtml(url, c.link, h));
                }, tryNext);
            })();
        }
    }
    function emptyHtml(t) { return '<div class="online-empty"><div class="online-empty__title">' + esc(t) + '</div></div>'; }

    var pcache = {};
    function fetchPage(url, ok, fail) {
        var hit = pcache[url];
        if (hit && Date.now() - hit.t < 20 * 60000) return ok(hit.d);
        var net, done = false;
        function end(f, a) { if (done) return; done = true; f(a); }
        try { net = new Lampa.Reguest(); net.timeout(12000); } catch (e) { return fail(); }
        setTimeout(function () { if (!done) { try { net.clear(); } catch (x) {} end(fail); } }, 13000);
        try {
            net['native'](url, function (page) {
                page = typeof page === 'string' ? page : '';
                if (page.indexOf('file') < 0) return end(fail);
                pcache[url] = { t: Date.now(), d: page }; end(ok, page);
            }, function () { end(fail); }, false, { dataType: 'text' });
        } catch (e) { end(fail); }
    }
    function direct(u, ok, fail) {
        if (/^https:\/\/(uafix\.net|zetvideo\.net)\//.test(u)) return ufPlay(u, ok, fail);
        if (/^pt:[a-z0-9]+$/i.test(u)) return ptPlay(u.slice(3), ok, fail);
        if (/\.m3u8(\?|$)/i.test(u)) return ok({ method: 'play', url: fixUrl(u) });
        // AnimeON: спершу питаємо Worker, яка сторінка плеєра в цієї серії, далі — як звичайно
        if (/^aoep:\d+$/.test(u)) {
            try {
                var net = new Lampa.Reguest(); net.timeout(10000);
                return net.silent(host() + '/lite/aoep?id=' + u.slice(5), function (j) {
                    try { if (typeof j === 'string') j = JSON.parse(j); } catch (e) { j = null; }
                    if (j && j.videoUrl) direct(j.videoUrl, ok, fail); else fail();
                }, function () { fail(); });
            } catch (e) { return fail(); }
        }
        fetchPage(u, function (page) { var d = playerData(page), r = d && d.file ? playFrom(d.file) : null; if (r) ok(r); else fail(); }, fail);
    }
    function qget(url, k) { var m = String(url || '').match(new RegExp('[?&]' + k + '=([^&]*)')); try { return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; } catch (e) { return ''; } }
    function playerOf(url) { return /\/lite\/(?:(?:anitube\/)?video|ufv)\?/.test(String(url || '')) ? qget(url, 'u') : ''; }

    // Серіал у плеєрі Ashdi/Tortuga: сезони → озвучки → серії, у тій самій розмітці, що віддають джерела онлайн-плагіна
    function serialModel(d) {
        var seasons = {};
        function sea(n) { return seasons[n] || (seasons[n] = { n: n, voices: {}, order: [] }); }
        function add(n, voice, e, url, sub) {
            if (!url) return;
            var S = sea(n), V = S.voices[voice] || (S.voices[voice] = (S.order.push(voice), { name: voice, eps: [] }));
            V.eps.push({ n: e, url: fixUrl(url) });
        }
        function num(t, def) { var m = String(t || '').match(/(\d+)\s*$/) || String(t || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : def; }
        if (d.kind === 'ashdi') {
            // буває «озвучки → сезони → серії» (Ashdi) і «сезони → озвучки → серії» (HDVB UA) — розрізняємо за назвами верхнього рівня
            var topSeason = d.serial.length && d.serial.every(function (x) { return /сезон|season/i.test(String(x && x.title || '')); });
            d.serial.forEach(function (v, vi) { (v.folder || []).forEach(function (s, si) { (s.folder || []).forEach(function (e, ei) {
                if (topSeason) add(num(v.title, vi + 1), s.title || 'Озвучка', num(e.title, ei + 1), e.file);
                else add(num(s.title, si + 1), v.title || 'Озвучка', num(e.title, ei + 1), e.file);
            }); }); });
        } else {
            d.serial.forEach(function (s, si) {
                var n = parseInt(s.season, 10) || num(s.title, si + 1);
                (s.folder || []).forEach(function (e, ei) {
                    var en = parseInt(e.number, 10) || num(e.title, ei + 1);
                    if (e.folder) e.folder.forEach(function (v) { add(n, v.title || 'Озвучка', en, v.file); });
                    else { var rx = /\{([^}]+)\}(https?:\/\/[^{\n\r\t"; ]+\.m3u8)/g, m; while ((m = rx.exec(e.file || ''))) add(n, m[1], en, m[2]); if (/^https?:/.test(e.file || '')) add(n, 'Озвучка', en, e.file); }
                });
            });
        }
        return Object.keys(seasons).map(function (k) { return seasons[k]; }).sort(function (a, b) { return a.n - b.n; });
    }
    function plHtml(page, plUrl) {
        var d = playerData(page);
        if (!d) return '';
        var base = plUrl.split('?')[0] + '?u=' + encodeURIComponent(qget(plUrl, 'u'));
        function item(cls, json, attrs, inner) { return '<div class="' + cls + ' selector"' + (attrs || '') + ' data-json="' + esc(JSON.stringify(json)) + '">' + inner + '</div>'; }
        if (d.file) {
            var r = playFrom(d.file);
            return r ? item('videos__item videos__movie', { method: 'play', url: r.url, quality: r.quality, title: 'Дивитись' }, ' media=""', '<div class="videos__item-title">Дивитись</div>') : '';
        }
        var seasons = serialModel(d);
        if (!seasons.length) return '';
        var s = parseInt(qget(plUrl, 's'), 10);
        if (!s) {
            if (seasons.length > 1) return seasons.map(function (x) { return item('videos__item videos__season', { method: 'link', url: base + '&s=' + x.n }, '', '<div class="videos__item-title videos__season-title">' + x.n + ' сезон</div>'); }).join('');
            s = seasons[0].n;
        }
        var S = seasons.filter(function (x) { return x.n === s; })[0] || seasons[0];
        var t = parseInt(qget(plUrl, 't'), 10) || 0; if (t >= S.order.length) t = 0;
        var btn = S.order.length > 1 ? S.order.map(function (name, i) { return '<div class="videos__button selector' + (i === t ? ' active' : '') + '" data-json="' + esc(JSON.stringify({ method: 'link', url: base + '&s=' + S.n + '&t=' + i })) + '">' + esc(name) + '</div>'; }).join('') : '';
        var V = S.voices[S.order[t]];
        return btn + V.eps.map(function (e) {
            return item('videos__item videos__movie', { method: 'play', url: e.url, title: 'Серія ' + e.n, voice_name: V.name }, ' media="" s="' + S.n + '" e="' + e.n + '"', '<div class="videos__item-title">Серія ' + e.n + '</div>');
        }).join('');
    }

    // ───────── оформлення ─────────
    // стилі екрана «Онлайн» додаємо лише якщо їх ще немає (інакше вони вже є від іншого онлайн-плагіна — не перебиваємо)
    function hasPrestigeCss() {
        try {
            var d = document.createElement('div'); d.className = 'online-prestige'; d.style.cssText = 'position:absolute;left:-9999px;top:0';
            document.body.appendChild(d);
            var r = getComputedStyle(d).borderTopLeftRadius; document.body.removeChild(d);
            return !!r && r !== '0px';
        } catch (e) { return false; }
    }
    function ensureCss() {
        if (!document.getElementById('lmxat-base-css') && !hasPrestigeCss() && window.__lmxatCss) safe(window.__lmxatCss);
    }

    // Наш екран: посилання на відео й серіали в плеєрах Ashdi/Tortuga розбираємо на пристрої, а не через Worker
    function hookCreate() {
        var C = Lampa.Component;
        if (!C || typeof C.create !== 'function' || C.__lmxAt4) return;
        var real = C.create;
        C.create = function (object) {
            var comp = real.apply(C, arguments);
            safe(function () {
                if (!comp || !(object && object.component === COMP) || typeof comp.getFileUrl !== 'function' || comp.__lmxAt4) return;
                comp.__lmxAt4 = 1;
                var realGet = comp.getFileUrl;
                comp.getFileUrl = function (file, call) {
                    var self = this, args = arguments, u = playerOf(file && file.url);
                    if (!u) return realGet.apply(self, args);
                    if (/^pt:/.test(u)) {
                        // торент: TorrServer спершу отримує список файлів (до ~25 с) — показуємо завантаження
                        var gone = false;
                        try { Lampa.Loading.start(function () { gone = true; Lampa.Loading.stop(); }); } catch (e) {}
                        return ptPlay(u.slice(3), function (r) {
                            try { Lampa.Loading.stop(); } catch (e) {}
                            if (!gone) call(Object.assign({}, r, { title: file.title, voice_name: file.voice_name }), {});
                        }, function () {
                            try { Lampa.Loading.stop(); } catch (e) {}
                            if (gone) return;
                            try { Lampa.Noty.show(tsHost() ? 'TorrServer не отримав файли цієї роздачі — оберіть іншу' : 'Вкажіть адресу TorrServer у Налаштування → TorrServer'); } catch (e) {}
                            call(false, {});
                        });
                    }
                    direct(u, function (r) {
                        var out = Object.assign({}, r, { title: file.title, voice_name: file.voice_name });
                        call(out, { quality: r.quality });
                    }, function () { realGet.apply(self, args); });
                };
                // UAFlix: Worker віддає заглушку-«сезон» UAFlix (сайт пускає лише пристрій) — одразу відкриваємо її, щоб у фільтрі «Сезон» не було «UAFlix»
                var realParse = comp.parse;
                if (typeof realParse === 'function') comp.parse = function (str) {
                    try {
                        var s0 = typeof str === 'string' ? str : '';
                        if (s0.indexOf('/lite/ufd?') >= 0 && (s0.match(/videos__item/g) || []).length === 1) {
                            var m0 = s0.match(/data-json="([^"]+)"/), j0 = m0 && JSON.parse(m0[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
                            if (j0 && j0.url) return comp.request(j0.url);
                        }
                    } catch (e) {}
                    try { if (typeof str === 'string') { arguments[0] = uaMark(str); } } catch (e) {}
                    return realParse.apply(this, arguments);
                };
                var realReq = comp.request;
                if (typeof realReq === 'function') comp.request = function (url) {
                    var self = this, args = arguments;
                    // запит, що приходить із запізненням (торенти, пошук на сайті), не має потрапити в список іншого джерела, обраного тим часом
                    var seq = comp.__lmxSeq = (comp.__lmxSeq || 0) + 1;
                    var live = function () { return comp.__lmxSeq === seq; };
                    if (/\/lite\/ey\?/.test(String(url || ''))) {
                        var serial = qget(url, 'serial') === '1';
                        eyFind(url, function (iframe, why) { if (!live()) return;
                            if (!iframe) return comp.parse(emptyHtml(why === 'blocked' ? 'Eneyida працює лише в застосунку Lampa (ТВ, телефон) — браузер на комп\u2019ютері її блокує' : 'На Eneyida цього тайтлу не знайдено'));
                            if (serial) return comp.request(host() + '/lite/pl?u=' + encodeURIComponent(iframe));
                            var t = qget(url, 'title') || 'Дивитись';
                            comp.parse('<div class="videos__item videos__movie selector" media="" data-json="' + esc(JSON.stringify({ method: 'call', url: host() + '/lite/video?u=' + encodeURIComponent(iframe) + '&t=Eneyida', title: t, voice_name: 'Eneyida' })) + '"><div class="videos__item-title">' + esc(t) + '</div></div>');
                        });
                        return;
                    }
                    var playFrame = function (iframe, label) {
                        if (qget(url, 'serial') === '1') return comp.request(host() + '/lite/pl?u=' + encodeURIComponent(iframe));
                        var t = qget(url, 'title') || 'Дивитись';
                        comp.parse('<div class="videos__item videos__movie selector" media="" data-json="' + esc(JSON.stringify({ method: 'call', url: host() + '/lite/video?u=' + encodeURIComponent(iframe) + '&t=' + encodeURIComponent(label), title: t, voice_name: label })) + '"><div class="videos__item-title">' + esc(t) + '</div></div>');
                    };
                    if (/\/lite\/uakino\?/.test(String(url || '')) && !/[?&]href=/.test(String(url))) {
                        ukFind(String(url), function (iframe, why) {
                            if (!live()) return;
                            if (!iframe) return comp.parse(emptyHtml(why === 'blocked' ? 'UAKino працює лише в застосунку Lampa (ТВ, телефон) — браузер на комп\u2019ютері його блокує' : 'На UAKino цього тайтлу не знайдено'));
                            playFrame(iframe, 'UAKino');
                        });
                        return;
                    }
                    if (/\/lite\/pidtor\?/.test(String(url || ''))) {
                        ptHtml(String(url), function (html) { if (live()) comp.parse(html); });
                        return;
                    }
                    if (/\/lite\/kinoukr\?/.test(String(url || ''))) {
                        kuFind(String(url), function (iframe) {
                            if (!live()) return;
                            if (!iframe) return comp.parse(emptyHtml('У KinoUkr цього тайтлу немає'));
                            playFrame(iframe, 'KinoUkr');
                        });
                        return;
                    }
                    if (/\/lite\/ufd\?/.test(String(url || ''))) {
                        ufDevice(String(url), function (html, why) {
                            comp.parse(html || emptyHtml(why === 'blocked' ? 'UAFlix працює лише в застосунку Lampa (ТВ, телефон) — браузер на комп\u2019ютері його блокує' : 'На UAFlix цього тайтлу не знайдено'));
                        });
                        return;
                    }
                    if (!/\/lite\/pl\?/.test(String(url || ''))) return realReq.apply(self, args);
                    fetchPage(qget(url, 'u'), function (page) {
                        var html = '';
                        try { html = plHtml(page, String(url)); } catch (e) {}
                        if (html) comp.parse(html); else realReq.apply(self, args);
                    }, function () { realReq.apply(self, args); });
                };
            });
            return comp;
        };
        C.__lmxAt4 = 1;
    }

    // англійська назва й альтернативні назви (латиницею чи українською) з TMDB — один запит, не довше 2,5 с
    function altNames(card, done) {
        if (card.lmx_alt || !card.id || (card.source && card.source !== 'tmdb')) return done();
        var fin = false, t = setTimeout(function () { if (!fin) { fin = true; done(); } }, 2500);
        try {
            // власний запит (спільний мережевий об'єкт Lampa для TMDB тут обривався) — через адресу TMDB з налаштувань Lampa (з її проксі)
            var net = new Lampa.Reguest(); net.timeout(2400);
            net.silent(Lampa.TMDB.api((card.name || card.first_air_date ? 'tv/' : 'movie/') + card.id + '?api_key=' + Lampa.TMDB.key() + '&language=en-US&append_to_response=alternative_titles'), function (j) {
                if (fin) return; fin = true; clearTimeout(t);
                var out = [];
                try {
                    if (j.name || j.title) out.push(j.name || j.title);
                    var alt = (j.alternative_titles && (j.alternative_titles.results || j.alternative_titles.titles)) || [];
                    alt.forEach(function (a) { if (a && a.title && /^(US|GB|UA|JP)$/.test(a.iso_3166_1 || '') && /[A-Za-zА-Яа-яІіЇїЄєҐґ]{2}/.test(a.title) && out.indexOf(a.title) < 0) out.push(a.title); });
                } catch (e) {}
                card.lmx_alt = out.slice(0, 6);
                done();
            }, function () { if (fin) return; fin = true; clearTimeout(t); done(); }, false, { dataType: 'json' });
        } catch (e) { if (!fin) { fin = true; clearTimeout(t); done(); } }
    }
    function open(card) {
        ensureCss();
        altNames(card, function () { push(card); });
    }
    function push(card) {
        Lampa.Activity.push({
            url: '', title: 'LMX UA', component: COMP, movie: card, page: 1,
            search: card.title || card.name, search_one: card.title || card.name, search_two: card.original_title || card.original_name, clarification: false
        });
    }

    // ───────── кнопка на сторінці (поруч з іншими кнопками «Онлайн») ─────────
    // Іконка: екран із кнопкою «грати», під ним — синьо-жовта підставка (українське онлайн)
    var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="3.5" width="19" height="13" rx="3" stroke="currentColor" stroke-width="1.9"/><path d="M10.2 7.4v5.2c0 .5.5.8.9.5l4-2.6c.4-.2.4-.8 0-1l-4-2.6c-.4-.3-.9 0-.9.5z" fill="currentColor"/><rect x="6" y="18.6" width="12" height="1.6" rx=".8" fill="#2f7cf6"/><rect x="6" y="20.6" width="12" height="1.6" rx=".8" fill="#ffd21f"/></svg>';
    function addButton(e) {
        var card = e.data && e.data.movie;
        if (!card || !card.id) return;
        var render = e.object && e.object.activity && e.object.activity.render();
        if (!render || !render.length || render.find('.lmxat--button').length) return;
        var btn = $('<div class="full-start__button selector view--online lmxat--button" data-subtitle="Українська озвучка · v' + VERSION + '">' + ICON + '<span>LMX UA</span></div>');
        btn.on('hover:enter', function () { safe(function () { open(card); }); });
        // як інші онлайн-плагіни: кнопка в прихованому .buttons--container, тож Lampa показує її в меню «Дивитись» (поруч з «Онлайн» і «Торренти»)
        var hid = render.find('.buttons--container').eq(0), tor = (hid.length ? hid : render).find('.view--torrent').last();
        if (tor.length) tor.after(btn);
        else if (hid.length) hid.append(btn);
        else {
            var row = render.find('.full-start-new__buttons, .full-start__buttons').eq(0), play = row.find('.button--play').eq(0);
            if (play.length) play.after(btn); else if (row.length) row.append(btn);
        }
    }

    function settings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;
        S.addComponent({ component: 'lmx_anitube', name: 'LMX UA', icon: ICON });
        S.addParam({ component: 'lmx_anitube', param: { name: 'lmx_anitube_v', type: 'title', default: '' }, field: { name: 'LMX UA v' + VERSION + ' · Anitube, AnimeON, Mikai, Unimay, Eneyida, UAFlix, BambooUA' } });
    }

  // ===== Стандартний екран «Онлайн» (із відкритого Lampac, immisterio/Lampac, AGPL-3.0), під власними назвами шаблонів, щоб не чіпати інші онлайн-плагіни =====
  function lmxatEmbed(LMXAT_HOST) {
  'use strict';

  var LAMPAC_VERSION = '1.9.2';
  var REQUEST_TIMEOUT = 10000;
  var BALANCER_TIMEOUT = 60000;

  var Defined = {
    api: 'lampac',
    localhost: LMXAT_HOST() + '/',
    apn: ''
  };

  var balansers_with_search = [];

  var unic_id = Lampa.Storage.get('lmxat_unic_id', '');
  if (!unic_id) {
    unic_id = Lampa.Utils.uid(8).toLowerCase();
    Lampa.Storage.set('lmxat_unic_id', unic_id);
  }


  function escapeHtml(text) {
    return $('<div></div>').text(text == null ? '' : text).html();
  }

  var hostTokens = {};
  function account(url) {
    url = url + '';
    if (url.indexOf('account_email=') == -1) {
      var email = Lampa.Storage.get('account_email');
      if (email) url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
    }
    if (url.indexOf('uid=') == -1) {
      var uid = Lampa.Storage.get('lmxat_unic_id', '');
      if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));
    }
    var hm = url.match(/^https?:\/\/([^\/?#]+)/i);
    if (hm) {
      var tm = url.match(/[?&]token=([^&#]+)/);
      if (tm) hostTokens[hm[1]] = tm[1];
      else if (hostTokens[hm[1]]) url = Lampa.Utils.addUrlComponent(url, 'token=' + hostTokens[hm[1]]);
    }
    if (url.indexOf('nws_id=') == -1) {
      var nws_id = Lampa.Storage.get('lmxat_nws_id', '');
      if (nws_id) url = Lampa.Utils.addUrlComponent(url, 'nws_id=' + encodeURIComponent(nws_id));
    }
    return url;
  }

  function addHeaders() {
    var aesgcmkey = Lampa.Storage.get('aesgcmkey', '');
    if (aesgcmkey) return { 'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '') };
    return {};
  }

  function formatEpisodeNumber(episodeNumber) {
    return (episodeNumber < 10 ? '0' : '') + episodeNumber;
  }

  var Network = Lampa.Reguest;

  function component(object) {
    // ── state & UI scaffold ──
    var comp = this;
    var network = new Network();
    network.timeout(BALANCER_TIMEOUT);
    // отдельный для long-poll lifeevents: reset()/network.clear() не обрывают опрос,
    // а его таймаут 3с не достаётся запросам к балансеру
    var life_network = new Network();
    var scroll = new Lampa.Scroll({
      mask: true,
      over: true
    });
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);
    var sources = {};
    var last;
    var source;
    var balanser;
    var initialized;
    var balanser_timer_tick = null;
    var images = [];
    var number_of_requests = 0;
    var number_of_requests_timer;
    var life_wait_timer;
    var life_start = 0;
    var life_pending = null; // ещё проверяются (с сервера); null — неизвестно (старый сервер / без life)
    var auto_pick = null;
    var filter_sources = {};
    var filter_translate = {
      season: Lampa.Lang.translate('torrent_serial_season'),
      voice: Lampa.Lang.translate('torrent_parser_voice'),
      source: Lampa.Lang.translate('settings_rest_source')
    };
    var filter_find = {
      season: [],
      voice: []
    };

    function stopBalanserTimer() {
      if (balanser_timer_tick) {
        Lampa.Timer.remove(balanser_timer_tick);
        balanser_timer_tick = null;
      }
    }

    // ── helpers ──
    if (balansers_with_search == undefined) {
      network.timeout(REQUEST_TIMEOUT);
      network.silent(
        account(Defined.localhost + 'lite/withsearch'),
        function (json) {
          balansers_with_search = json;
        },
        function () {
          balansers_with_search = [];
        }
      );
    }

    function balanserName(j) {
      var bals = j.balanser;
      var name = j.name.split(' ')[0];
      return (bals || name).toLowerCase();
    }

    // ── автовыбор балансера ──
    // Предпочтения пишутся только при запуске видео (updateBalanser): выбор тайтла + привычка.
    // Привычка — счёт с затуханием, +1 только когда тайтл впервые смотрят на этом балансере,
    // поэтому сериал на 500 серий не накручивает её; хранилище — пара на балансер.
    // балансер точно не придёт: не проверен и сервер не числит его среди проверяемых
    function absent(name) {
      return !sources[name] && life_pending !== null && life_pending.indexOf(name) < 0;
    }

    function filmChoice() {
      return Lampa.Storage.cache('lmxat_last_balanser', 3000, {})[object.movie.id];
    }

    function hasProgress(name) {
      var choice = comp.getChoice(name);
      return Lampa.Arrays.getKeys(choice.episodes_view || {}).length > 0;
    }

    function addHabit(name) {
      var habits = Lampa.Storage.get('lmxat_balanser_habits', '{}');
      for (var k in habits) {
        habits[k] *= 0.85;
        if (habits[k] < 0.05) delete habits[k];
      }
      habits[name] = (habits[name] || 0) + 1;
      Lampa.Storage.set('lmxat_balanser_habits', habits);
    }

    function getHabits() {
      var habits = Lampa.Storage.get('lmxat_balanser_habits', '{}');
      // перенос старого глобального выбора, чтобы любимый балансер не потерялся после обновления
      var legacy = '';   // LMX UA: власні звички, без чужого глобального вибору (інакше джерела інших плагінів впливали на наш вибір)
      if (legacy && !Lampa.Arrays.getKeys(habits).length) {
        habits[legacy] = 1;
        Lampa.Storage.set('lmxat_balanser_habits', habits);
      }
      return habits;
    }

    // самый привычный из уже проверенных рабочих; при равенстве — порядок сервера (приоритет).
    // Пока не прошла ~1с, ждём (false), если есть более привычный, ещё не проверенный балансер —
    // иначе побеждал бы просто самый быстрый из привычных. null — привычных среди рабочих нет
    function habitPick(final) {
      var habits = getHabits();
      var pick = null,
        score = 0;
      for (var i = 0; i < filter_sources.length; i++) {
        var k = filter_sources[i];
        if (sources[k].show && (habits[k] || 0) > score) {
          score = habits[k];
          pick = k;
        }
      }
      // ждём и когда рабочих привычных ещё нет вовсе (pick == null, score == 0)
      if (final || Date.now() - life_start >= 1000) return pick;
      for (var h in habits) {
        if (habits[h] > score && !sources[h] && !absent(h)) return false;
      }
      return pick;
    }

    // какой балансер запускать; null — ещё ждём. final — проверка закончена (ready/таймаут)
    function autoPick(json, final) {
      // лучший по приоритету известен, когда сервер прислал head (все приоритетнее проверены)
      var best = null;
      if (json.head || final) {
        for (var i = 0; i < filter_sources.length; i++) {
          if (sources[filter_sources[i]].show) {
            best = filter_sources[i];
            break;
          }
        }
      }

      // ручной выбор в фильтре — держим даже нерабочий (покажет свою ошибку)
      var custom = object.lmxat_custom_select;
      if (custom) return sources[custom] ? custom : final || absent(custom) ? best : null;

      // автопереключение после «не отвечает» — выбор тайтла не учитываем, иначе вернёмся к нему же
      var auto = object.lmxat_auto_select;
      if (auto) {
        if (sources[auto]) return sources[auto].show ? auto : best;
        return final || absent(auto) ? best : null;
      }

      // уже смотрели этот тайтл — продолжаем на том же балансере
      var film = filmChoice();
      if (film) {
        if (sources[film]) return sources[film].show ? film : best;
        // сериал с прогрессом ждём до таймаута проверки (своя озвучка и серии), остальное ~4.5с;
        // если его нет в списке этого тайтла — не ждём вовсе
        var limit = hasProgress(film) ? 10500 : 4500;
        if (!final && !absent(film) && Date.now() - life_start < limit) return null;
        return best;
      }

      var habit = habitPick(final);
      if (habit === false) return null; // ждём более привычного, лучшим по приоритету его не перебиваем
      return habit || best;
    }

    function clarificationSearchAdd(value) {
      var id = Lampa.Utils.hash(
        object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title
      );
      var all = Lampa.Storage.get('clarification_search', '{}');

      all[id] = value;

      Lampa.Storage.set('clarification_search', all);
    }

    function clarificationSearchDelete() {
      var id = Lampa.Utils.hash(
        object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title
      );
      var all = Lampa.Storage.get('clarification_search', '{}');

      delete all[id];

      Lampa.Storage.set('clarification_search', all);
    }

    function clarificationSearchGet() {
      var id = Lampa.Utils.hash(
        object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title
      );
      var all = Lampa.Storage.get('clarification_search', '{}');

      return all[id];
    }

    // ── init & filter ──
    this.initialize = function () {
      var _this = this;
      this.loading(true);
      filter.onSearch = function (value) {
        clarificationSearchAdd(value);

        Lampa.Activity.replace({
          search: value,
          clarification: true,
          similar: true
        });
      };
      filter.onBack = function () {
        _this.start();
      };
      filter
        .render()
        .find('.selector')
        .on('hover:enter', function () {
          stopBalanserTimer();
        });
      filter.render().find('.filter--search').appendTo(filter.render().find('.torrent-filter'));
      filter.onSelect = function (type, a, b) {
        if (type == 'filter') {
          if (a.reset) {
            clarificationSearchDelete();

            _this.replaceChoice({
              season: 0,
              voice: 0,
              voice_url: '',
              voice_name: ''
            });
            setTimeout(function () {
              Lampa.Select.close();
              Lampa.Activity.replace({
                clarification: 0,
                similar: 0
              });
            }, 10);
          } else {
            var url = filter_find[a.stype][b.index].url;
            var choice = _this.getChoice();
            if (a.stype == 'voice') {
              choice.voice_name = filter_find.voice[b.index].title;
              choice.voice_url = url;
            }
            choice[a.stype] = b.index;
            _this.saveChoice(choice);
            _this.reset();
            _this.request(url);
            setTimeout(Lampa.Select.close, 10);
          }
        } else if (type == 'sort') {
          Lampa.Select.close();
          object.lmxat_custom_select = a.source;
          _this.changeBalanser(a.source);
        }
      };
      if (filter.addButtonBack) filter.addButtonBack();
      filter.render().find('.filter--sort span').text(Lampa.Lang.translate('lmxat_balanser'));
      scroll.body().addClass('torrent-list');
      files.appendFiles(scroll.render());
      files.appendHead(filter.render());
      scroll.minus(files.render().find('.explorer__files-head'));
      scroll.body().append(Lampa.Template.get('lmxat_content_loading'));
      Lampa.Controller.enable('content');
      this.loading(false);
      if (object.balanser) {
        files.render().find('.filter--search').remove();
        sources = {};
        sources[object.balanser] = { name: object.balanser };
        balanser = object.balanser;
        filter_sources = [];

        network.timeout(BALANCER_TIMEOUT);
        return network['native'](
          account(object.url.replace('rjson=', 'nojson=')),
          this.parse.bind(this),
          function () {
            files.render().find('.torrent-filter').remove();
            _this.empty();
          },
          false,
          {
            dataType: 'text',
            headers: addHeaders()
          }
        );
      }
      this.externalids()
        .then(function () {
          return _this.createSource();
        })
        .then(function (json) {
          if (
            !balansers_with_search.find(function (b) {
              return balanser.slice(0, b.length) == b;
            })
          ) {
            filter.render().find('.filter--search').addClass('hide');
          }
          _this.search();
        })
      ['catch'](function (e) {
        _this.noConnectToServer(e);
      });
    };
    // ── RCH & external IDs ──
    this.rch = function (json, noreset) {
      var _this2 = this;
      // LMX UA: RCH не використовується — просто повторюємо запит
      if (!noreset) _this2.find();
      else noreset();
    };
    this.externalids = function () {
      return new Promise(function (resolve, reject) {
        if (!object.movie.imdb_id || !object.movie.kinopoisk_id) {
          var query = [];
          query.push('id=' + encodeURIComponent(object.movie.id));
          query.push('serial=' + (object.movie.name ? 1 : 0));
          if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
          if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));
          var url = Defined.localhost + 'externalids?' + query.join('&');
          network.timeout(REQUEST_TIMEOUT);
          network.silent(
            account(url),
            function (json) {
              for (var name in json) {
                object.movie[name] = json[name];
              }
              resolve();
            },
            function () {
              resolve();
            },
            false,
            {
              headers: addHeaders()
            }
          );
        } else resolve();
      });
    };
    // ── balanser ──
    // вызывается только при запуске видео
    this.updateBalanser = function (balanser_name) {
      var last_select_balanser = Lampa.Storage.cache('lmxat_last_balanser', 3000, {});
      if (last_select_balanser[object.movie.id] !== balanser_name) addHabit(balanser_name);
      last_select_balanser[object.movie.id] = balanser_name;
      Lampa.Storage.set('lmxat_last_balanser', last_select_balanser);
    };
    // смена в рамках этой карточки: в предпочтения не пишем, выбор переживает Activity.replace через object
    this.changeBalanser = function (balanser_name, auto) {
      if (auto) {
        object.lmxat_auto_select = balanser_name;
        delete object.lmxat_custom_select;
      } else delete object.lmxat_auto_select;
      var to = this.getChoice(balanser_name);
      var from = this.getChoice();
      if (from.voice_name) to.voice_name = from.voice_name;
      this.saveChoice(to, balanser_name);
      Lampa.Activity.replace();
    };
    this.requestParams = function (url) {
      var query = [];
      var card_source = object.movie.source || 'tmdb'; //Lampa.Storage.field('source')
      query.push('id=' + encodeURIComponent(object.movie.id));

      if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
      if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));
      if (object.movie.tmdb_id) query.push('tmdb_id=' + (object.movie.tmdb_id || ''));

      if (object.movie.keywords && object.movie.keywords.results) {
        for (var i = 0, a = object.movie.keywords.results; i < a.length; i++) {
          if (a[i].name == 'anime') {
            query.push('anime=1');
            break;
          }
        }
      }

      query.push(
        'title=' + encodeURIComponent(object.clarification ? object.search : object.movie.title || object.movie.name)
      );
      query.push('original_title=' + encodeURIComponent(object.movie.original_title || object.movie.original_name));
      query.push('serial=' + (object.movie.name ? 1 : 0));
      query.push('original_language=' + (object.movie.original_language || ''));
      // LMX UA: англійська й альтернативні назви з TMDB — сайти часто називають тайтл інакше, ніж український TMDB
      if (object.movie.lmx_alt && object.movie.lmx_alt.length) query.push('alt=' + encodeURIComponent(object.movie.lmx_alt.join('|')));
      query.push('year=' + ((object.movie.release_date || object.movie.first_air_date || '0000') + '').slice(0, 4));
      query.push('source=' + card_source);
      query.push('clarification=' + (object.clarification ? 1 : 0));
      query.push('similar=' + (object.similar ? true : false));
      query.push('rchtype=');   // LMX UA: без RCH (інші Lampac-плагіни задають window.rch — тут він не потрібен)
      if (Lampa.Storage.get('account_email', ''))
        query.push('cub_id=' + Lampa.Utils.hash(Lampa.Storage.get('account_email', '')));
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
    };
    // ── source & life events ──
    this.startSource = function (json) {
      var comp = this;
      // міст для LMX Watch: повна адреса будь-якого джерела цього тайтла (свій хост і токен), щоб фоново порівняти джерела, як у lampaua
      window.__lmxUaBridge = { t: Date.now(), urlFor: function (k) { var x = sources[k]; return x && x.url ? account(comp.requestParams(x.url)) : ''; }, fix: function (u) { return account(u); } };
      return new Promise(function (resolve, reject) {
        json.forEach(function (j) {
          var name = balanserName(j);
          sources[name] = {
            url: j.url,
            name: j.name,
            show: typeof j.show == 'undefined' ? true : j.show
          };
        });
        filter_sources = Lampa.Arrays.getKeys(sources);
        if (filter_sources.length) {
          // lifeSource уже выбрал (auto_pick); без life — список полный, решаем сразу
          balanser = auto_pick || autoPick({ head: true }, true);
          if (!sources[balanser]) balanser = filter_sources[0];
          source = sources[balanser].url;
          Lampa.Storage.set('lmxat_active_balanser', balanser);
          resolve(json);
        } else {
          reject();
        }
      });
    };
    this.lifeSource = function () {
      var _this3 = this;
      return new Promise(function (resolve, reject) {
        var url = _this3.requestParams(Defined.localhost + 'lifeevents?memkey=' + (_this3.memkey || ''));
        var red = false;
        var seen = 0;
        // сервер держит lifeevents до 1.5с (long-poll), поэтому лимит по времени, а не по числу запросов
        life_start = Date.now();
        var life_expired = function life_expired() {
          return Date.now() - life_start > 15000;
        };
        var fin = function fin(call) {
          var started = Date.now();
          life_network.timeout(3000);
          life_network.silent(
            account(url + '&seen=' + seen),
            function (json) {
              if (json.accsdb) return reject(json);
              life_pending = json.pending || null;
              var news = json.online.length > seen;
              seen = json.online.length;
              filter_sources = [];
              sources = {};
              json.online.forEach(function (j) {
                var name = balanserName(j);
                sources[name] = {
                  url: j.url,
                  name: j.name,
                  show: typeof j.show == 'undefined' ? true : j.show
                };
              });
              filter_sources = Lampa.Arrays.getKeys(sources);
              filter.set(
                'sort',
                filter_sources.map(function (e) {
                  return {
                    title: sources[e].name,
                    source: e,
                    selected: e == balanser,
                    ghost: !sources[e].show
                  };
                })
              );
              // до старта показываем, кого ждём, вместо undefined
              var waiting = object.lmxat_custom_select || object.lmxat_auto_select || filmChoice();
              if (waiting && absent(waiting)) waiting = null;
              filter.chosen('sort', [
                sources[balanser] ? sources[balanser].name : waiting ? waiting + ' …' : ''
              ]);
              var final = life_expired() || json.ready;
              if (final) filter.render().find('.lampac-balanser-loader').remove();
              if (!red) {
                var pick = autoPick(json, final);
                if (pick) {
                  red = true;
                  auto_pick = pick;
                  resolve(
                    json.online.filter(function (c) {
                      return c.show;
                    })
                  );
                } else if (final) {
                  return reject();
                }
              }
              if (!final) {
                // сервер держит запрос (long-poll); если ответил сразу без новостей — не долбим его чаще раза в секунду.
                // 500мс, а не меньше: WAF 10 rps на IP общий для lifeevents/externalids и для всех устройств за NAT
                life_wait_timer = setTimeout(fin, news || Date.now() - started >= 1000 ? 500 : 1000);
              }
            },
            function () {
              if (life_expired()) {
                reject();
              } else {
                life_wait_timer = setTimeout(fin, 1000);
              }
            },
            false,
            {
              headers: addHeaders()
            }
          );
        };
        fin();
      });
    };
    this.createSource = function () {
      var _this4 = this;
      return new Promise(function (resolve, reject) {
        var url = _this4.requestParams(Defined.localhost + 'lite/events?life=true');
        network.silent(
          account(url),
          function (json) {
            if (json.accsdb) return reject(json);
            if (json.life) {
              _this4.memkey = json.memkey;
              if (json.title) {
                if (object.movie.name) object.movie.name = json.title;
                if (object.movie.title) object.movie.title = json.title;
              }
              filter
                .render()
                .find('.filter--sort')
                .append(
                  '<span class="lampac-balanser-loader" style="width: 1.2em; height: 1.2em; margin-top: 0; background: url(./img/loader.svg) no-repeat 50% 50%; background-size: contain; margin-left: 0.5em"></span>'
                );
              _this4.lifeSource().then(_this4.startSource).then(resolve)['catch'](reject);
            } else {
              try {
                var mv = object.movie || {}, anime = mv.original_language === 'ja' && (mv.genres || []).some(function (g) { return g && g.id === 16; });
                if (Array.isArray(json) && json.length && !anime && !json.some(function (j) { return j && j.balanser === 'kinoukr'; }))
                  json.push({ name: 'KinoUkr', url: host() + '/lite/kinoukr', balanser: 'kinoukr', show: true });
                var ph = Array.isArray(json) && json.filter(function (j) { return j && /\/lite\/phantom\b/.test(String(j.url || '')); })[0];
                if (ph && !json.some(function (j) { return j && j.balanser === 'aladin'; }))
                  json.push({ name: 'Aladin', url: String(ph.url).replace('/lite/phantom', '/lite/aladin'), balanser: 'aladin', show: true });
                // HDVB — запасне російськомовне джерело для свіжих серіалів (Watch обирає його лише коли української озвучки ніде немає)
                if (ph && !json.some(function (j) { return j && j.balanser === 'hdvb'; }))
                  json.push({ name: 'HDVB', url: String(ph.url).replace('/lite/phantom', '/lite/hdvb'), balanser: 'hdvb', show: true });
                if (Array.isArray(json) && json.length && !json.some(function (j) { return j && j.balanser === 'pidtor'; }))
                  json.push({ name: 'PidTor', url: host() + '/lite/pidtor', balanser: 'pidtor', show: true });
              } catch (e) {}
              _this4.startSource(json).then(resolve)['catch'](reject);
            }
          },
          reject,
          false,
          {
            headers: addHeaders()
          }
        );
      });
    };
    /**
     * Подготовка
     */
    this.create = function () {
      return this.render();
    };
    // ── search & request ──
    /**
     * Начать поиск
     */
    this.search = function () {
      //this.loading(true)
      this.filter(
        {
          source: filter_sources
        },
        this.getChoice()
      );
      this.find();
    };
    this.find = function () {
      this.request(this.requestParams(source));
    };
    this.request = function (url) {
      number_of_requests++;
      if (number_of_requests < 10) {
        // общий network: externalids/withsearch/субтитры ставят ему REQUEST_TIMEOUT (10с) — балансеру нужен свой
        network.timeout(BALANCER_TIMEOUT);
        network['native'](account(url), this.parse.bind(this), this.doesNotAnswer.bind(this), false, {
          dataType: 'text',
          headers: addHeaders()
        });
        clearTimeout(number_of_requests_timer);
        number_of_requests_timer = setTimeout(function () {
          number_of_requests = 0;
        }, 4000);
      } else this.empty();
    };
    this.parseJsonDate = function (str, name) {
      try {
        var html = $('<div>' + str + '</div>');
        var elems = [];
        html.find(name).each(function () {
          var item = $(this);
          var data = JSON.parse(item.attr('data-json'));
          var season = item.attr('s');
          var episode = item.attr('e');
          var text = item.text();
          if (!object.movie.name) {
            if (text.match(/\d+p/i)) {
              if (!data.quality) {
                data.quality = {};
                data.quality[text] = data.url;
              }
              text = object.movie.title;
            }
            if (text == 'По умолчанию') {
              text = object.movie.title;
            }
          }
          if (episode) data.episode = parseInt(episode);
          if (season) data.season = parseInt(season);
          if (text) data.text = text;
          data.active = item.hasClass('active');
          elems.push(data);
        });
        return elems;
      } catch (e) {
        return [];
      }
    };
    // ── play / quality ──
    // Phantom/Spectre віддають 1440p/2160p у кодеку AV1 (буває й HEVC): пристрій, що його не декодує, показує «не вдалося декодувати».
    // Перед запуском читаємо заголовки високих якостей і прибираємо ті, що цей пристрій не відтворить
    function canCodec(c) {
      try {
        var t = 'video/mp4; codecs="' + c + '"';
        if (window.MediaSource && MediaSource.isTypeSupported && MediaSource.isTypeSupported(t)) return true;
        var v = document.createElement('video');
        return !!(v.canPlayType && v.canPlayType(t));
      } catch (e) { return true; }
    }
    function codecFilter(json, done) {
      var q = json && json.quality, keys = q && typeof q === 'object' ? Object.keys(q) : [];
      var hi = keys.filter(function (k) { return (parseInt(k, 10) || 0) > 1080 && typeof q[k] === 'string' && /\.m3u8/.test(q[k]); });
      if (!hi.length) return done();
      var left = hi.length, fin = false, bad = {};
      function end() {
        if (fin) return; fin = true;
        var drop = Object.keys(bad);
        if (drop.length && drop.length < keys.length) {
          var was = json.url;
          drop.forEach(function (k) { if (json.url === q[k]) json.url = ''; delete q[k]; });
          if (!json.url) {
            var best = Object.keys(q).sort(function (a, b) { return (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0); })[0];
            json.url = best ? q[best] : was;
          }
        }
        done();
      }
      setTimeout(end, 3000);
      hi.forEach(function (k) {
        fetchText(q[k], function (m3u) {
          var cs = (String(m3u).match(/CODECS="([^"]+)"/) || [])[1];
          if (cs) { var v = cs.split(',').filter(function (c) { return /^(av01|hev1|hvc1|dvh1|dvhe|vp09)/.test(c.trim()); })[0]; if (v && !canCodec(v.trim())) bad[k] = 1; }
          if (--left === 0) end();
        }, function () { if (--left === 0) end(); });
      });
    }
    this.getFileUrl = function (file, call, waiting_rch) {
      var _this = this;

      if (Lampa.Storage.field('player') !== 'inner' && file.stream && Lampa.Platform.is('apple')) {
        var newfile = Lampa.Arrays.clone(file);
        newfile.method = 'play';
        newfile.url = file.stream;
        call(newfile, {});
      } else if (file.method == 'play') call(file, {});
      else {
        Lampa.Loading.start(function () {
          Lampa.Loading.stop();
          Lampa.Controller.toggle('content');
          network.clear();
        });
        network.timeout(BALANCER_TIMEOUT);
        network['native'](
          account(file.url),
          function (json) {
            if (json.rch) {
              if (waiting_rch) {
                waiting_rch = false;
                Lampa.Loading.stop();
                call(false, {});
              } else {
                _this.rch(json, function () {
                  Lampa.Loading.stop();

                  _this.getFileUrl(file, call, true);
                });
              }
            } else {
              codecFilter(json, function () {
                Lampa.Loading.stop();
                call(json, json);
              });
            }
          },
          function () {
            Lampa.Loading.stop();
            call(false, {});
          },
          false,
          {
            headers: addHeaders()
          }
        );
      }
    };
    this.toPlayElement = function (file) {
      var play = {
        title: file.title,
        url: file.url,
        quality: file.qualitys,
        timeline: file.timeline,
        subtitles: file.subtitles,
        segments: file.segments,
        callback: file.mark,
        season: file.season,
        episode: file.episode,
        voice_name: file.voice_name,
        thumbnail: file.thumbnail
      };
      return play;
    };
    this.orUrlReserve = function (data) {
      if (data.url && typeof data.url == 'string' && data.url.indexOf(' or ') !== -1) {
        var urls = data.url.split(' or ');
        data.url = urls[0];
        data.url_reserve = urls[1];
      }
    };
    this.setDefaultQuality = function (data) {
      if (Lampa.Arrays.getKeys(data.quality).length) {
        for (var q in data.quality) {
          if (parseInt(q) == Lampa.Storage.field('video_quality_default')) {
            data.url = data.quality[q];
            this.orUrlReserve(data);
          }
          if (data.quality[q].indexOf(' or ') !== -1) data.quality[q] = data.quality[q].split(' or ')[0];
        }
      }
    };
    this.display = function (videos) {
      var _this5 = this;
      if (videos.length > 1 && videos.every(function (video) {
        return video.season > 0 && video.episode > 0;
      })) {
        videos = videos.slice().sort(function (a, b) {
          return a.season - b.season || a.episode - b.episode;
        });
      }
      this.draw(videos, {
        onEnter: function onEnter(item, html) {
          _this5.getFileUrl(
            item,
            function (json, json_call) {
              if (json && json.url) {
                var playlist = [];
                var first = _this5.toPlayElement(item);
                first.url = json.url;
                first.headers = json_call.headers || json.headers;
                first.quality = json_call.quality || item.qualitys;
                first.segments = json_call.segments || item.segments;
                first.hls_manifest_timeout = json_call.hls_manifest_timeout || json.hls_manifest_timeout;
                first.subtitles = json.subtitles;
                first.subtitles_call = json_call.subtitles_call || json.subtitles_call;
                if (json.vast && json.vast.url) {
                  first.vast_url = json.vast.url;
                  first.vast_msg = json.vast.msg;
                  first.vast_region = json.vast.region;
                  first.vast_platform = json.vast.platform;
                  first.vast_screen = json.vast.screen;
                }
                _this5.orUrlReserve(first);
                _this5.setDefaultQuality(first);
                if (item.season) {
                  videos.forEach(function (elem) {
                    var cell = _this5.toPlayElement(elem);
                    if (elem == item) cell.url = json.url;
                    else {
                      if (elem.method == 'call') {
                        if (Lampa.Storage.field('player') !== 'inner') {
                          cell.url = elem.stream;
                          delete cell.quality;
                        } else {
                          cell.url = function (call) {
                            _this5.getFileUrl(
                              elem,
                              function (stream, stream_json) {
                                if (stream.url) {
                                  cell.url = stream.url;
                                  cell.quality = stream_json.quality || elem.qualitys;
                                  cell.segments = stream_json.segments || elem.segments;
                                  cell.subtitles = stream.subtitles;
                                  _this5.orUrlReserve(cell);
                                  _this5.setDefaultQuality(cell);
                                  elem.mark();
                                } else {
                                  cell.url = '';
                                  Lampa.Noty.show(Lampa.Lang.translate('lmxat_nolink'));
                                }
                                call();
                              },
                              function () {
                                cell.url = '';
                                call();
                              }
                            );
                          };
                        }
                      } else {
                        cell.url = elem.url;
                      }
                    }
                    _this5.orUrlReserve(cell);
                    _this5.setDefaultQuality(cell);
                    playlist.push(cell);
                  }); //Lampa.Player.playlist(playlist)
                } else {
                  playlist.push(first);
                }
                if (playlist.length > 1) first.playlist = playlist;
                if (first.url) {
                  var element = first;
                  element.isonline = true;
                  Lampa.Player.play(element);
                  Lampa.Player.playlist(playlist);
                  if (element.subtitles_call) _this5.loadSubtitles(element.subtitles_call);
                  item.mark();
                  _this5.updateBalanser(balanser);
                } else {
                  Lampa.Noty.show(Lampa.Lang.translate('lmxat_nolink'));
                }
              } else Lampa.Noty.show(Lampa.Lang.translate('lmxat_nolink'));
            },
            true
          );
        },
        onContextMenu: function onContextMenu(item, html, data, call) {
          _this5.getFileUrl(
            item,
            function (stream) {
              call({
                file: stream.url,
                quality: item.qualitys
              });
            },
            true
          );
        }
      });
      this.filter(
        {
          season: filter_find.season.map(function (s) {
            return s.title;
          }),
          voice: filter_find.voice.map(function (b) {
            return b.title;
          })
        },
        this.getChoice()
      );
    };
    this.loadSubtitles = function (link) {
      network.timeout(REQUEST_TIMEOUT);
      network.silent(
        account(link),
        function (subs) {
          Lampa.Player.subtitles(subs);
        },
        function () { },
        false,
        {
          headers: addHeaders()
        }
      );
    };
    // ── parse response ──
    this.parse = function (str) {
      var json = Lampa.Arrays.decodeJson(str, {});
      if (Lampa.Arrays.isObject(str) && str.rch) json = str;
      if (json.rch) return this.rch(json);
      try {
        var items = this.parseJsonDate(str, '.videos__item');
        var buttons = this.parseJsonDate(str, '.videos__button');
        if (items.length == 1 && items[0].method == 'link' && !items[0].similar) {
          filter_find.season = items.map(function (s) {
            return {
              title: s.text,
              url: s.url
            };
          });
          this.replaceChoice({
            season: 0
          });
          this.request(items[0].url);
        } else {
          this.activity.loader(false);
          var videos = items.filter(function (v) {
            return v.method == 'play' || v.method == 'call';
          });
          var similar = items.filter(function (v) {
            return v.similar;
          });
          if (videos.length) {
            if (buttons.length) {
              filter_find.voice = buttons.map(function (b) {
                return {
                  title: b.text,
                  url: b.url
                };
              });
              var select_voice_url = this.getChoice(balanser).voice_url;
              var select_voice_name = this.getChoice(balanser).voice_name;
              var find_voice_url = buttons.find(function (v) {
                return v.url == select_voice_url;
              });
              var find_voice_name = buttons.find(function (v) {
                return v.text == select_voice_name;
              });
              var find_voice_active = buttons.find(function (v) {
                return v.active;
              }); ////console.log('b',buttons)
              ////console.log('u',find_voice_url)
              ////console.log('n',find_voice_name)
              ////console.log('a',find_voice_active)
              if (find_voice_url && !find_voice_url.active) {
                //console.log('Lampac', 'go to voice', find_voice_url);
                this.replaceChoice({
                  voice: buttons.indexOf(find_voice_url),
                  voice_name: find_voice_url.text
                });
                this.request(find_voice_url.url);
              } else if (find_voice_name && !find_voice_name.active) {
                //console.log('Lampac', 'go to voice', find_voice_name);
                this.replaceChoice({
                  voice: buttons.indexOf(find_voice_name),
                  voice_name: find_voice_name.text
                });
                this.request(find_voice_name.url);
              } else {
                if (find_voice_active) {
                  this.replaceChoice({
                    voice: buttons.indexOf(find_voice_active),
                    voice_name: find_voice_active.text
                  });
                }
                this.display(videos);
              }
            } else {
              this.replaceChoice({
                voice: 0,
                voice_url: '',
                voice_name: ''
              });
              this.display(videos);
            }
          } else if (items.length) {
            if (similar.length) {
              this.similars(similar);
              this.activity.loader(false);
            } else {
              //this.activity.loader(true)
              filter_find.season = items.map(function (s) {
                return {
                  title: s.text,
                  url: s.url
                };
              });
              var select_season = this.getChoice(balanser).season;
              var season = filter_find.season[select_season];
              if (!season) season = filter_find.season[0];
              //console.log('Lampac', 'go to season', season);
              this.request(season.url);
            }
          } else {
            this.doesNotAnswer(json);
          }
        }
      } catch (e) {
        //console.log('Lampac', 'error', e.stack);
        this.doesNotAnswer(e);
      }
    };
    this.similars = function (json) {
      var _this6 = this;
      scroll.clear();
      json.forEach(function (elem) {
        elem.title = elem.text;
        elem.info = '';
        var info = [];
        var year = (
          (elem.start_date || elem.year || object.movie.release_date || object.movie.first_air_date || '') + ''
        ).slice(0, 4);
        if (year) info.push(escapeHtml(year));
        if (elem.details) info.push(escapeHtml(elem.details));
        var name = elem.title || elem.text;
        elem.title = name;
        elem.time = elem.time || '';
        elem.info = info.join('<span class="online-prestige-split">●</span>');
        var item = Lampa.Template.get('lmxat_prestige_folder', {
          title: escapeHtml(name),
          time: elem.time,
          info: elem.info
        });
        if (elem.img) {
          var image = $('<img style="height: 7em; width: 7em; border-radius: 0.3em;"/>');
          item.find('.online-prestige__folder').empty().append(image);

          if (elem.img !== undefined) {
            if (elem.img.charAt(0) === '/') elem.img = Defined.localhost + elem.img.substring(1);
            if (elem.img.indexOf('/proxyimg') !== -1) elem.img = account(elem.img);
          }

          Lampa.Utils.imgLoad(image, elem.img);
        }
        item
          .on('hover:enter', function () {
            _this6.reset();
            _this6.request(elem.url);
          })
          .on('hover:focus', function (e) {
            last = e.target;
            scroll.update($(e.target), true);
          });
        scroll.append(item);
      });
      this.filter(
        {
          season: filter_find.season.map(function (s) {
            return s.title;
          }),
          voice: filter_find.voice.map(function (b) {
            return b.title;
          })
        },
        this.getChoice()
      );
      Lampa.Controller.enable('content');
    };
    // ── choice & storage ──
    this.getChoice = function (for_balanser) {
      var data = Lampa.Storage.cache('lmxat_choice_' + (for_balanser || balanser), 3000, {});
      var save = data[object.movie.id] || {};
      Lampa.Arrays.extend(save, {
        season: 0,
        voice: 0,
        voice_name: '',
        voice_id: 0,
        episodes_view: {},
        movie_view: ''
      });
      return save;
    };
    this.saveChoice = function (choice, for_balanser) {
      var data = Lampa.Storage.cache('lmxat_choice_' + (for_balanser || balanser), 3000, {});
      data[object.movie.id] = choice;
      Lampa.Storage.set('lmxat_choice_' + (for_balanser || balanser), data);
    };
    this.replaceChoice = function (choice, for_balanser) {
      var to = this.getChoice(for_balanser);
      Lampa.Arrays.extend(to, choice, true);
      this.saveChoice(to, for_balanser);
    };
    this.clearImages = function () {
      images.forEach(function (img) {
        img.onerror = function () { };
        img.onload = function () { };
        img.src = '';
      });
      images = [];
    };
    /**
     * Очистить список файлов
     */
    this.reset = function () {
      last = false;
      stopBalanserTimer();
      network.clear();
      this.clearImages();
      scroll.render().find('.empty').remove();
      scroll.clear();
      scroll.reset();
      scroll.body().append(Lampa.Template.get('lmxat_content_loading'));
    };
    /**
     * Загрузка
     */
    this.loading = function (status) {
      if (status) this.activity.loader(true);
      else {
        this.activity.loader(false);
        this.activity.toggle();
      }
    };
    // ── UI: filter, draw, errors ──
    /**
     * Построить фильтр
     */
    this.filter = function (filter_items, choice) {
      var _this7 = this;
      var select = [];
      var add = function add(type, title) {
        var need = _this7.getChoice();
        var items = filter_items[type];
        var subitems = [];
        var value = need[type];
        items.forEach(function (name, i) {
          subitems.push({
            title: name,
            selected: value == i,
            index: i
          });
        });
        select.push({
          title: title,
          subtitle: items[value],
          items: subitems,
          stype: type
        });
      };
      filter_items.source = filter_sources;
      select.push({
        title: Lampa.Lang.translate('torrent_parser_reset'),
        reset: true
      });
      this.saveChoice(choice);
      if (filter_items.voice && filter_items.voice.length) add('voice', Lampa.Lang.translate('torrent_parser_voice'));
      if (filter_items.season && filter_items.season.length)
        add('season', Lampa.Lang.translate('torrent_serial_season'));
      filter.set('filter', select);
      filter.set(
        'sort',
        filter_sources.map(function (e) {
          return {
            title: sources[e].name,
            source: e,
            selected: e == balanser,
            ghost: !sources[e].show
          };
        })
      );
      this.selected(filter_items);
    };
    /**
     * Показать что выбрано в фильтре
     */
    this.selected = function (filter_items) {
      var need = this.getChoice(),
        select = [];
      for (var i in need) {
        if (filter_items[i] && filter_items[i].length) {
          if (i == 'voice') {
            select.push(filter_translate[i] + ': ' + filter_items[i][need[i]]);
          } else if (i !== 'source') {
            if (filter_items.season.length >= 1) {
              select.push(filter_translate.season + ': ' + filter_items[i][need[i]]);
            }
          }
        }
      }
      filter.chosen('filter', select);
      filter.chosen('sort', [sources[balanser].name]);
    };
    this.getEpisodes = function (season, call) {
      var episodes = [];
      var tmdb_id = object.movie.id;
      if (['cub', 'tmdb'].indexOf(object.movie.source || 'tmdb') == -1) tmdb_id = object.movie.tmdb_id;
      if (typeof tmdb_id == 'number' && object.movie.name) {
        Lampa.Api.sources.tmdb.get(
          'tv/' + tmdb_id + '/season/' + season,
          {},
          function (data) {
            episodes = data.episodes || [];

            call(episodes);
          },
          function () {
            call(episodes);
          }
        );
      } else call(episodes);
    };
    this.watched = function (set) {
      var file_id = Lampa.Utils.hash(
        object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title
      );
      var watched = Lampa.Storage.cache('online_watched_last', 5000, {});
      if (set) {
        if (!watched[file_id]) watched[file_id] = {};
        Lampa.Arrays.extend(watched[file_id], set, true);
        Lampa.Storage.set('online_watched_last', watched);
        this.updateWatched();
      } else {
        return watched[file_id];
      }
    };
    this.updateWatched = function () {
      var watched = this.watched();
      var body = scroll.body().find('.online-prestige-watched .online-prestige-watched__body').empty();
      if (watched) {
        var line = [];
        if (watched.balanser_name) line.push(watched.balanser_name);
        if (watched.voice_name) line.push(watched.voice_name);
        if (watched.season) line.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + watched.season);
        if (watched.episode) line.push(Lampa.Lang.translate('torrent_serial_episode') + ' ' + watched.episode);
        line.forEach(function (n) {
          body.append('<span>' + escapeHtml(n) + '</span>');
        });
      } else body.append('<span>' + Lampa.Lang.translate('lmxat_no_watch_history') + '</span>');
    };
    /**
     * Отрисовка файлов
     */
    this.draw = function (items) {
      var _this8 = this;
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (!items.length) return this.empty();
      scroll.clear();
      if (!object.balanser) scroll.append(Lampa.Template.get('lmxat_prestige_watched', {}));
      this.updateWatched();
      this.getEpisodes(items[0].season, function (episodes) {
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var serial = object.movie.name ? true : false;
        var choice = _this8.getChoice();
        var fully = window.innerWidth > 480;
        var scroll_to_element = false;
        var scroll_to_mark = false;
        items.forEach(function (element, index) {
          var episode =
            serial && episodes.length && !params.similars
              ? episodes.find(function (e) {
                return e.episode_number == element.episode;
              })
              : false;
          var episode_num = element.episode || index + 1;
          var episode_last = choice.episodes_view[element.season];
          var voice_name =
            choice.voice_name ||
            (filter_find.voice[0] ? filter_find.voice[0].title : false) ||
            element.voice_name ||
            (serial ? 'Неизвестно' : element.text) ||
            'Неизвестно';
          if (element.quality) {
            element.qualitys = element.quality;
            element.quality = Lampa.Arrays.getKeys(element.quality)[0];
          }
          Lampa.Arrays.extend(element, {
            voice_name: voice_name,
            info: voice_name.length > 60 ? voice_name.substr(0, 60) + '...' : voice_name,
            quality: '',
            time: Lampa.Utils.secondsToTime((episode ? episode.runtime : object.movie.runtime) * 60, true)
          });
          var hash_timeline = Lampa.Utils.hash(
            element.season
              ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('')
              : object.movie.original_title
          );
          var hash_behold = Lampa.Utils.hash(
            element.season
              ? [
                element.season,
                element.season > 10 ? ':' : '',
                element.episode,
                object.movie.original_title,
                element.voice_name
              ].join('')
              : object.movie.original_title + element.voice_name
          );
          var data = {
            hash_timeline: hash_timeline,
            hash_behold: hash_behold
          };
          var info = [];
          if (element.season) {
            element.translate_episode_end = _this8.getLastEpisode(items);
            element.translate_voice = element.voice_name;
          }
          if (element.text && !episode) element.title = element.text;
          element.timeline = Lampa.Timeline.view(hash_timeline, Lampa.Timeline.link ? Lampa.Timeline.link(object.movie, element.season, element.episode) : null);
          if (episode) {
            element.title = episode.name;
            if (element.info.length < 30 && episode.vote_average)
              info.push(
                Lampa.Template.get(
                  'lmxat_prestige_rate',
                  {
                    rate: parseFloat(episode.vote_average + '').toFixed(1)
                  },
                  true
                )
              );
            if (episode.air_date && fully) info.push(escapeHtml(Lampa.Utils.parseTime(episode.air_date).full));
          } else if (object.movie.release_date && fully) {
            info.push(escapeHtml(Lampa.Utils.parseTime(object.movie.release_date).full));
          }
          if (!serial && object.movie.tagline && element.info.length < 30) info.push(escapeHtml(object.movie.tagline));
          if (element.info) info.push(escapeHtml(element.info));
          if (info.length)
            element.info = info
              .map(function (i) {
                return '<span>' + i + '</span>';
              })
              .join('<span class="online-prestige-split">●</span>');
          var html = Lampa.Template.get('lmxat_prestige_full', {
            title: escapeHtml(element.title),
            time: element.time,
            info: element.info,
            quality: escapeHtml(element.quality)
          });
          var loader = html.find('.online-prestige__loader');
          var image = html.find('.online-prestige__img');
          if (object.balanser) image.hide();
          if (!serial) {
            if (choice.movie_view == hash_behold) scroll_to_element = html;
          } else if (typeof episode_last !== 'undefined' && episode_last == episode_num) {
            scroll_to_element = html;
          }
          if (serial && !episode) {
            image.append(
              '<div class="online-prestige__episode-number">' +
              formatEpisodeNumber(element.episode || index + 1) +
              '</div>'
            );
            loader.remove();
          } else if (!serial && object.movie.backdrop_path == 'undefined') loader.remove();
          else {
            var img = html.find('img')[0];
            img.onerror = function () {
              img.src = './img/img_broken.svg';
            };
            img.onload = function () {
              image.addClass('online-prestige__img--loaded');
              loader.remove();
              if (serial)
                image.append(
                  '<div class="online-prestige__episode-number">' +
                  formatEpisodeNumber(element.episode || index + 1) +
                  '</div>'
                );
            };
            img.src = Lampa.TMDB.image('t/p/w300' + (episode ? episode.still_path : object.movie.backdrop_path));
            images.push(img);
            element.thumbnail = img.src;
          }
          html.find('.online-prestige__timeline').append(Lampa.Timeline.render(element.timeline));
          if (viewed.indexOf(hash_behold) !== -1) {
            scroll_to_mark = html;
            html
              .find('.online-prestige__img')
              .append('<div class="online-prestige__viewed">' + Lampa.Template.get('icon_viewed', {}, true) + '</div>');
          }
          element.mark = function () {
            viewed = Lampa.Storage.cache('online_view', 5000, []);
            if (viewed.indexOf(hash_behold) == -1) {
              viewed.push(hash_behold);
              Lampa.Storage.set('online_view', viewed);
              if (html.find('.online-prestige__viewed').length == 0) {
                html
                  .find('.online-prestige__img')
                  .append(
                    '<div class="online-prestige__viewed">' + Lampa.Template.get('icon_viewed', {}, true) + '</div>'
                  );
              }
            }
            choice = _this8.getChoice();
            if (!serial) {
              choice.movie_view = hash_behold;
            } else {
              choice.episodes_view[element.season] = episode_num;
            }
            _this8.saveChoice(choice);
            var voice_name_text = choice.voice_name || element.voice_name || element.title;
            if (voice_name_text.length > 30) voice_name_text = voice_name_text.slice(0, 30) + '...';
            _this8.watched({
              balanser: balanser,
              balanser_name: Lampa.Utils.capitalizeFirstLetter(
                sources[balanser] ? sources[balanser].name.split(' ')[0] : balanser
              ),
              voice_id: choice.voice_id,
              voice_name: voice_name_text,
              episode: element.episode,
              season: element.season
            });
          };
          element.unmark = function () {
            viewed = Lampa.Storage.cache('online_view', 5000, []);
            if (viewed.indexOf(hash_behold) !== -1) {
              Lampa.Arrays.remove(viewed, hash_behold);
              Lampa.Storage.set('online_view', viewed);
              Lampa.Storage.remove('online_view', hash_behold);
              html.find('.online-prestige__viewed').remove();
            }
          };
          element.timeclear = function () {
            element.timeline.percent = 0;
            element.timeline.time = 0;
            element.timeline.duration = 0;
            Lampa.Timeline.update(element.timeline);
          };
          html
            .on('hover:enter', function () {
              if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
              if (params.onEnter) params.onEnter(element, html, data);
            })
            .on('hover:focus', function (e) {
              last = e.target;
              if (params.onFocus) params.onFocus(element, html, data);
              scroll.update($(e.target), true);
            });
          if (params.onRender) params.onRender(element, html, data);
          _this8.contextMenu({
            html: html,
            element: element,
            onFile: function onFile(call) {
              if (params.onContextMenu) params.onContextMenu(element, html, data, call);
            },
            onClearAllMark: function onClearAllMark() {
              items.forEach(function (elem) {
                elem.unmark();
              });
            },
            onClearAllTime: function onClearAllTime() {
              items.forEach(function (elem) {
                elem.timeclear();
              });
            }
          });
          scroll.append(html);
        });
        if (serial && episodes.length > items.length && !params.similars) {
          var left = episodes.slice(items.length);
          left.forEach(function (episode) {
            var info = [];
            if (episode.vote_average)
              info.push(
                Lampa.Template.get(
                  'lmxat_prestige_rate',
                  {
                    rate: parseFloat(episode.vote_average + '').toFixed(1)
                  },
                  true
                )
              );
            if (episode.air_date) info.push(escapeHtml(Lampa.Utils.parseTime(episode.air_date).full));
            var air = new Date((episode.air_date + '').replace(/-/g, '/'));
            var now = Date.now();
            var day = Math.round((air.getTime() - now) / (24 * 60 * 60 * 1000));
            var txt = Lampa.Lang.translate('full_episode_days_left') + ': ' + day;
            var html = Lampa.Template.get('lmxat_prestige_full', {
              time: Lampa.Utils.secondsToTime((episode ? episode.runtime : object.movie.runtime) * 60, true),
              info: info.length
                ? info
                  .map(function (i) {
                    return '<span>' + i + '</span>';
                  })
                  .join('<span class="online-prestige-split">●</span>')
                : '',
              title: escapeHtml(episode.name),
              quality: escapeHtml(day > 0 ? txt : '')
            });
            var loader = html.find('.online-prestige__loader');
            var image = html.find('.online-prestige__img');
            var season = items[0] ? items[0].season : 1;
            html
              .find('.online-prestige__timeline')
              .append(
                Lampa.Timeline.render(
                  Lampa.Timeline.view(
                    Lampa.Utils.hash([season, season > 10 ? ':' : '', episode.episode_number, object.movie.original_title].join('')),
                    Lampa.Timeline.link ? Lampa.Timeline.link(object.movie, season, episode.episode_number) : null
                  )
                )
              );
            var img = html.find('img')[0];
            if (episode.still_path) {
              img.onerror = function () {
                img.src = './img/img_broken.svg';
              };
              img.onload = function () {
                image.addClass('online-prestige__img--loaded');
                loader.remove();
                image.append(
                  '<div class="online-prestige__episode-number">' +
                  formatEpisodeNumber(episode.episode_number) +
                  '</div>'
                );
              };
              img.src = Lampa.TMDB.image('t/p/w300' + episode.still_path);
              images.push(img);
            } else {
              loader.remove();
              image.append(
                '<div class="online-prestige__episode-number">' +
                formatEpisodeNumber(episode.episode_number) +
                '</div>'
              );
            }
            html.on('hover:focus', function (e) {
              last = e.target;
              scroll.update($(e.target), true);
            });
            html.css('opacity', '0.5');
            scroll.append(html);
          });
        }
        if (scroll_to_element) {
          last = scroll_to_element[0];
        } else if (scroll_to_mark) {
          last = scroll_to_mark[0];
        }
        Lampa.Controller.enable('content');
      });
    };
    /**
     * Меню
     */
    this.contextMenu = function (params) {
      params.html
        .on('hover:long', function () {
          function show(extra) {
            var enabled = Lampa.Controller.enabled().name;
            var menu = [];
            if (Lampa.Platform.is('webos')) {
              menu.push({
                title: Lampa.Lang.translate('player_lauch') + ' - Webos',
                player: 'webos'
              });
            }
            if (Lampa.Platform.is('android')) {
              menu.push({
                title: Lampa.Lang.translate('player_lauch') + ' - Android',
                player: 'android'
              });
            }
            menu.push({
              title: Lampa.Lang.translate('player_lauch') + ' - Lampa',
              player: 'lampa'
            });
            menu.push({
              title: Lampa.Lang.translate('lmxat_video'),
              separator: true
            });
            menu.push({
              title: Lampa.Lang.translate('torrent_parser_label_title'),
              mark: true
            });
            menu.push({
              title: Lampa.Lang.translate('torrent_parser_label_cancel_title'),
              unmark: true
            });
            menu.push({
              title: Lampa.Lang.translate('time_reset'),
              timeclear: true
            });
            if (extra) {
              menu.push({
                title: Lampa.Lang.translate('copy_link'),
                copylink: true
              });
            }
            if (window.lmxat_online_context_menu) window.lmxat_online_context_menu.push(menu, extra, params);
            menu.push({
              title: Lampa.Lang.translate('more'),
              separator: true
            });
            if (
              Lampa.Account.Permit.access &&
              params.element &&
              typeof params.element.season !== 'undefined' &&
              params.element.translate_voice
            ) {
              menu.push({
                title: Lampa.Lang.translate('lmxat_voice_subscribe'),
                subscribe: true
              });
            }
            menu.push({
              title: Lampa.Lang.translate('lmxat_clear_all_marks'),
              clearallmark: true
            });
            menu.push({
              title: Lampa.Lang.translate('lmxat_clear_all_timecodes'),
              timeclearall: true
            });
            Lampa.Select.show({
              title: Lampa.Lang.translate('title_action'),
              items: menu,
              onBack: function onBack() {
                Lampa.Controller.toggle(enabled);
              },
              onSelect: function onSelect(a) {
                if (a.mark) params.element.mark();
                if (a.unmark) params.element.unmark();
                if (a.timeclear) params.element.timeclear();
                if (a.clearallmark) params.onClearAllMark();
                if (a.timeclearall) params.onClearAllTime();
                if (window.lmxat_online_context_menu) window.lmxat_online_context_menu.onSelect(a, params);
                Lampa.Controller.toggle(enabled);
                if (a.player) {
                  Lampa.Player.runas(a.player);
                  params.html.trigger('hover:enter');
                }
                if (a.copylink) {
                  if (extra.quality) {
                    var qual = [];
                    for (var i in extra.quality) {
                      qual.push({
                        title: i,
                        file: extra.quality[i]
                      });
                    }
                    Lampa.Select.show({
                      title: Lampa.Lang.translate('settings_server_links'),
                      items: qual,
                      onBack: function onBack() {
                        Lampa.Controller.toggle(enabled);
                      },
                      onSelect: function onSelect(b) {
                        Lampa.Utils.copyTextToClipboard(
                          b.file,
                          function () {
                            Lampa.Noty.show(Lampa.Lang.translate('copy_secuses'));
                          },
                          function () {
                            Lampa.Noty.show(Lampa.Lang.translate('copy_error'));
                          }
                        );
                      }
                    });
                  } else {
                    Lampa.Utils.copyTextToClipboard(
                      extra.file,
                      function () {
                        Lampa.Noty.show(Lampa.Lang.translate('copy_secuses'));
                      },
                      function () {
                        Lampa.Noty.show(Lampa.Lang.translate('copy_error'));
                      }
                    );
                  }
                }
                if (a.subscribe) {
                  Lampa.Account.subscribeToTranslation(
                    {
                      card: object.movie,
                      season: params.element.season,
                      episode: params.element.translate_episode_end,
                      voice: params.element.translate_voice
                    },
                    function () {
                      Lampa.Noty.show(Lampa.Lang.translate('lmxat_voice_success'));
                    },
                    function () {
                      Lampa.Noty.show(Lampa.Lang.translate('lmxat_voice_error'));
                    }
                  );
                }
              }
            });
          }
          params.onFile(show);
        })
        .on('hover:focus', function () {
          if (Lampa.Helper) Lampa.Helper.show('online_file', Lampa.Lang.translate('helper_online_file'), params.html);
        });
    };
    /**
     * Показать пустой результат
     */
    this.empty = function () {
      var html = Lampa.Template.get('lmxat_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text(Lampa.Lang.translate('empty_title_two'));
      html.find('.online-empty__time').text(Lampa.Lang.translate('empty_text'));
      scroll.clear();
      scroll.append(html);
      this.loading(false);
    };
    this.noConnectToServer = function (er) {
      var html = Lampa.Template.get('lmxat_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text(Lampa.Lang.translate('title_error'));
      html
        .find('.online-empty__time')
        .text(
          er && er.accsdb
            ? er.msg
            : Lampa.Lang.translate('lmxat_does_not_answer_text').replace(
                '{balanser}',
                sources[balanser] ? sources[balanser].name : balanser
              )
        );
      scroll.clear();
      scroll.append(html);
      this.loading(false);
    };
    this.doesNotAnswer = function (er) {
      var _this9 = this;
      this.reset();
      // одне задане джерело (Anitube): перемикати нема на що — просте повідомлення без таймера й кнопок
      if (object.balanser) {
        var one = Lampa.Template.get('lmxat_does_not_answer', {});
        one.find('.online-empty__buttons').remove();
        one.find('.online-empty__title').text('На Anitube цього тайтлу не знайдено');
        one.find('.online-empty__time').text('Можливо, там він під іншою назвою або ще без озвучки');
        scroll.clear();
        scroll.append(one);
        this.loading(false);
        return;
      }
      var html = Lampa.Template.get('lmxat_does_not_answer', {
        balanser: balanser
      });
      if (er && er.accsdb) html.find('.online-empty__title').html(er.msg);

      // LMX UA: порожнє джерело — це «не знайдено», а не збій мережі: на наступне переходимо за 1 с, а не за 5
      var tic = er && er.accsdb ? 10 : 1;
      html.find('.cancel').on('hover:enter', function () {
        stopBalanserTimer();
      });
      html.find('.change').on('hover:enter', function () {
        stopBalanserTimer();
        filter.render().find('.filter--sort').trigger('hover:enter');
      });
      scroll.clear();
      scroll.append(html);
      this.loading(false);
      balanser_timer_tick = function balanserTimerTick() {
        tic--;
        html.find('.timeout').text(tic);
        if (tic == 0) {
          stopBalanserTimer();
          // следующий рабочий (нерабочие пропускаем); если рабочий только текущий — как раньше, по всем
          var keys = Lampa.Arrays.getKeys(sources).filter(function (k) {
            return sources[k].show || k == balanser;
          });
          if (keys.length < 2) keys = Lampa.Arrays.getKeys(sources);
          var indx = keys.indexOf(balanser);
          var next = keys[indx + 1];
          if (!next) next = keys[0];
          balanser = next;
          if (Lampa.Activity.active().activity == _this9.activity) _this9.changeBalanser(balanser, true);
        }
      };
      Lampa.Timer.add(1000, balanser_timer_tick);
    };
    this.getLastEpisode = function (items) {
      var last_episode = 0;
      items.forEach(function (e) {
        if (typeof e.episode !== 'undefined') last_episode = Math.max(last_episode, parseInt(e.episode));
      });
      return last_episode;
    };
    // ── activity lifecycle ──
    this.background = function () {
      Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(object.movie));
    };
    /**
     * Начать навигацию по файлам
     */
    this.start = function () {
      if (Lampa.Activity.active().activity !== this.activity) return;
      if (!initialized) {
        initialized = true;
        this.initialize();
      }
      this.background();
      Lampa.Controller.add('content', {
        toggle: function toggle() {
          Lampa.Controller.collectionSet(scroll.render(), files.render());
          Lampa.Controller.collectionFocus(last || false, scroll.render());
        },
        gone: function gone() {
          stopBalanserTimer();
        },
        up: function up() {
          if (Navigator.canmove('up')) {
            Navigator.move('up');
          } else Lampa.Controller.toggle('head');
        },
        down: function down() {
          Navigator.move('down');
        },
        right: function right() {
          if (Navigator.canmove('right')) Navigator.move('right');
          else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
        },
        left: function left() {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        back: this.back.bind(this)
      });
      Lampa.Controller.toggle('content');
    };
    this.render = function () {
      return files.render();
    };
    this.back = function () {
      Lampa.Activity.backward();
    };
    function suspendActivity() {
      stopBalanserTimer();
      clearTimeout(life_wait_timer);
      clearTimeout(number_of_requests_timer);
      network.clear();
      life_network.clear();
    }

    this.pause = function () {
      suspendActivity();
    };
    this.stop = function () {
      suspendActivity();
    };
    this.destroy = function () {
      suspendActivity();
      this.clearImages();
      files.destroy();
      scroll.destroy();
      if (filter && typeof filter.destroy === 'function') filter.destroy();
    };
  }

  function startPlugin() {
    Lampa.Lang.add({
      lmxat_watch: {
        //
        ru: 'Смотреть онлайн',
        en: 'Watch online',
        uk: 'Дивитися онлайн',
        zh: '在线观看'
      },
      lmxat_video: {
        //
        ru: 'Видео',
        en: 'Video',
        uk: 'Відео',
        zh: '视频'
      },
      lmxat_no_watch_history: {
        ru: 'Нет истории просмотра',
        en: 'No browsing history',
        uk: 'Немає історії перегляду',
        zh: '没有浏览历史'
      },
      lmxat_nolink: {
        ru: 'Не удалось извлечь ссылку',
        uk: 'Неможливо отримати посилання',
        en: 'Failed to fetch link',
        zh: '获取链接失败'
      },
      lmxat_balanser: {
        //
        ru: 'Источник',
        uk: 'Джерело',
        en: 'Source',
        zh: '来源'
      },
      helper_online_file: {
        //
        ru: 'Удерживайте клавишу "ОК" для вызова контекстного меню',
        uk: 'Утримуйте клавішу "ОК" для виклику контекстного меню',
        en: 'Hold the "OK" key to bring up the context menu',
        zh: '按住“确定”键调出上下文菜单'
      },
      title_online: {
        //
        ru: 'Онлайн',
        uk: 'Онлайн',
        en: 'Online',
        zh: '在线的'
      },
      lmxat_voice_subscribe: {
        //
        ru: 'Подписаться на перевод',
        uk: 'Підписатися на переклад',
        en: 'Subscribe to translation',
        zh: '订阅翻译'
      },
      lmxat_voice_success: {
        //
        ru: 'Вы успешно подписались',
        uk: 'Ви успішно підписалися',
        en: 'You have successfully subscribed',
        zh: '您已成功订阅'
      },
      lmxat_voice_error: {
        //
        ru: 'Возникла ошибка',
        uk: 'Виникла помилка',
        en: 'An error has occurred',
        zh: '发生了错误'
      },
      lmxat_clear_all_marks: {
        //
        ru: 'Очистить все метки',
        uk: 'Очистити всі мітки',
        en: 'Clear all labels',
        zh: '清除所有标签'
      },
      lmxat_clear_all_timecodes: {
        //
        ru: 'Очистить все тайм-коды',
        uk: 'Очистити всі тайм-коди',
        en: 'Clear all timecodes',
        zh: '清除所有时间代码'
      },
      lmxat_change_balanser: {
        //
        ru: 'Изменить балансер',
        uk: 'Змінити балансер',
        en: 'Change balancer',
        zh: '更改平衡器'
      },
      lmxat_balanser_dont_work: {
        //
        ru: 'Поиск на ({balanser}) не дал результатов',
        uk: 'Пошук на ({balanser}) не дав результатів',
        en: 'Search on ({balanser}) did not return any results',
        zh: '搜索 ({balanser}) 未返回任何结果'
      },
      lmxat_balanser_timeout: {
        //
        ru: 'Источник будет переключен автоматически через <span class="timeout">10</span> секунд.',
        uk: 'Джерело буде автоматично переключено через <span class="timeout">10</span> секунд.',
        en: 'The source will be switched automatically after <span class="timeout">10</span> seconds.',
        zh: '平衡器将在<span class="timeout">10</span>秒内自动切换。'
      },
      lmxat_does_not_answer_text: {
        ru: 'Поиск на ({balanser}) не дал результатов',
        uk: 'Пошук на ({balanser}) не дав результатів',
        en: 'Search on ({balanser}) did not return any results',
        zh: '搜索 ({balanser}) 未返回任何结果'
      }
    });
    // ── UI assets: CSS + Lampa templates ──
    function lampacCssHtml() {
      return [
        '<style>',
        '@charset \'UTF-8\';',
        '/* ── prestige card ── */',
        '.online-prestige {',
        '  position: relative;',
        '  -webkit-border-radius: 0.3em;',
        '  border-radius: 0.3em;',
        '  background-color: rgba(0, 0, 0, 0.3);',
        '  display: -webkit-box;',
        '  display: -webkit-flex;',
        '  display: -moz-box;',
        '  display: -ms-flexbox;',
        '  display: flex;',
        '}',
        '.online-prestige__body {',
        '  padding: 1.2em;',
        '  line-height: 1.3;',
        '  -webkit-box-flex: 1;',
        '  -webkit-flex-grow: 1;',
        '  -moz-box-flex: 1;',
        '  -ms-flex-positive: 1;',
        '  flex-grow: 1;',
        '  position: relative;',
        '}',
        '@media screen and (max-width: 480px) {',
        '  .online-prestige__body {',
        '    padding: 0.8em 1.2em;',
        '  }',
        '}',
        '.online-prestige__img {',
        '  position: relative;',
        '  width: 13em;',
        '  -webkit-flex-shrink: 0;',
        '  -ms-flex-negative: 0;',
        '  flex-shrink: 0;',
        '  min-height: 8.2em;',
        '}',
        '.online-prestige__img > img {',
        '  position: absolute;',
        '  top: 0;',
        '  left: 0;',
        '  width: 100%;',
        '  height: 100%;',
        '  -o-object-fit: cover;',
        '  object-fit: cover;',
        '  -webkit-border-radius: 0.3em;',
        '  border-radius: 0.3em;',
        '  opacity: 0;',
        '  -webkit-transition: opacity 0.3s;',
        '  -o-transition: opacity 0.3s;',
        '  -moz-transition: opacity 0.3s;',
        '  transition: opacity 0.3s;',
        '}',
        '.online-prestige__img--loaded > img {',
        '  opacity: 1;',
        '}',
        '@media screen and (max-width: 480px) {',
        '  .online-prestige__img {',
        '    width: 7em;',
        '    min-height: 6em;',
        '  }',
        '}',
        '.online-prestige__folder {',
        '  padding: 1em;',
        '  -webkit-flex-shrink: 0;',
        '  -ms-flex-negative: 0;',
        '  flex-shrink: 0;',
        '}',
        '.online-prestige__folder > svg {',
        '  width: 4.4em !important;',
        '  height: 4.4em !important;',
        '}',
        '.online-prestige__viewed {',
        '  position: absolute;',
        '  top: 1em;',
        '  left: 1em;',
        '  background: rgba(0, 0, 0, 0.45);',
        '  -webkit-border-radius: 100%;',
        '  border-radius: 100%;',
        '  padding: 0.25em;',
        '  font-size: 0.76em;',
        '}',
        '.online-prestige__viewed > svg {',
        '  width: 1.5em !important;',
        '  height: 1.5em !important;',
        '}',
        '.online-prestige__episode-number {',
        '  position: absolute;',
        '  top: 0;',
        '  left: 0;',
        '  right: 0;',
        '  bottom: 0;',
        '  display: -webkit-box;',
        '  display: -webkit-flex;',
        '  display: -moz-box;',
        '  display: -ms-flexbox;',
        '  display: flex;',
        '  -webkit-box-align: center;',
        '  -webkit-align-items: center;',
        '  -moz-box-align: center;',
        '  -ms-flex-align: center;',
        '  align-items: center;',
        '  -webkit-box-pack: center;',
        '  -webkit-justify-content: center;',
        '  -moz-box-pack: center;',
        '  -ms-flex-pack: center;',
        '  justify-content: center;',
        '  font-size: 2em;',
        '}',
        '.online-prestige__loader {',
        '  position: absolute;',
        '  top: 50%;',
        '  left: 50%;',
        '  width: 2em;',
        '  height: 2em;',
        '  margin-left: -1em;',
        '  margin-top: -1em;',
        '  background: url(./img/loader.svg) no-repeat center center;',
        '  -webkit-background-size: contain;',
        '  -o-background-size: contain;',
        '  background-size: contain;',
        '}',
        '.online-prestige__head,',
        '.online-prestige__footer {',
        '  display: -webkit-box;',
        '  display: -webkit-flex;',
        '  display: -moz-box;',
        '  display: -ms-flexbox;',
        '  display: flex;',
        '  -webkit-box-pack: justify;',
        '  -webkit-justify-content: space-between;',
        '  -moz-box-pack: justify;',
        '  -ms-flex-pack: justify;',
        '  justify-content: space-between;',
        '  -webkit-box-align: center;',
        '  -webkit-align-items: center;',
        '  -moz-box-align: center;',
        '  -ms-flex-align: center;',
        '  align-items: center;',
        '}',
        '.online-prestige__timeline {',
        '  margin: 0.8em 0;',
        '}',
        '.online-prestige__timeline > .time-line {',
        '  display: block !important;',
        '}',
        '.online-prestige__title {',
        '  font-size: 1.7em;',
        '  overflow: hidden;',
        '  -o-text-overflow: ellipsis;',
        '  text-overflow: ellipsis;',
        '  display: -webkit-box;',
        '  -webkit-line-clamp: 1;',
        '  line-clamp: 1;',
        '  -webkit-box-orient: vertical;',
        '}',
        '@media screen and (max-width: 480px) {',
        '  .online-prestige__title {',
        '    font-size: 1.4em;',
        '  }',
        '}',
        '.online-prestige__time {',
        '  padding-left: 2em;',
        '}',
        '.online-prestige__info {',
        '  display: -webkit-box;',
        '  display: -webkit-flex;',
        '  display: -moz-box;',
        '  display: -ms-flexbox;',
        '  display: flex;',
        '  -webkit-box-align: center;',
        '  -webkit-align-items: center;',
        '  -moz-box-align: center;',
        '  -ms-flex-align: center;',
        '  align-items: center;',
        '}',
        '.online-prestige__info > * {',
        '  overflow: hidden;',
        '  -o-text-overflow: ellipsis;',
        '  text-overflow: ellipsis;',
        '  display: -webkit-box;',
        '  -webkit-line-clamp: 1;',
        '  line-clamp: 1;',
        '  -webkit-box-orient: vertical;',
        '}',
        '.online-prestige__quality {',
        '  padding-left: 1em;',
        '  white-space: nowrap;',
        '}',
        '.online-prestige__scan-file {',
        '  position: absolute;',
        '  bottom: 0;',
        '  left: 0;',
        '  right: 0;',
        '}',
        '.online-prestige__scan-file .broadcast__scan {',
        '  margin: 0;',
        '}',
        '.online-prestige .online-prestige-split {',
        '  font-size: 0.8em;',
        '  margin: 0 1em;',
        '  -webkit-flex-shrink: 0;',
        '  -ms-flex-negative: 0;',
        '  flex-shrink: 0;',
        '}',
        '.online-prestige.focus::after {',
        '  content: \'\';',
        '  position: absolute;',
        '  top: -0.6em;',
        '  left: -0.6em;',
        '  right: -0.6em;',
        '  bottom: -0.6em;',
        '  -webkit-border-radius: 0.7em;',
        '  border-radius: 0.7em;',
        '  border: solid 0.3em #fff;',
        '  z-index: -1;',
        '  pointer-events: none;',
        '}',
        '.online-prestige + .online-prestige {',
        '  margin-top: 1.5em;',
        '}',
        '.online-prestige--folder .online-prestige__footer {',
        '  margin-top: 0.8em;',
        '}',
        '/* ── watched row ── */',
        '.online-prestige-watched {',
        '  padding: 1em;',
        '}',
        '.online-prestige-watched__icon > svg {',
        '  width: 1.5em;',
        '  height: 1.5em;',
        '}',
        '.online-prestige-watched__body {',
        '  padding-left: 1em;',
        '  padding-top: 0.1em;',
        '  display: -webkit-box;',
        '  display: -webkit-flex;',
        '  display: -moz-box;',
        '  display: -ms-flexbox;',
        '  display: flex;',
        '  -webkit-flex-wrap: wrap;',
        '  -ms-flex-wrap: wrap;',
        '  flex-wrap: wrap;',
        '}',
        '.online-prestige-watched__body > span + span::before {',
        '  content: \' ● \';',
        '  vertical-align: top;',
        '  display: inline-block;',
        '  margin: 0 0.5em;',
        '}',
        '/* ── rate badge ── */',
        '.online-prestige-rate {',
        '  display: -webkit-inline-box;',
        '  display: -webkit-inline-flex;',
        '  display: -moz-inline-box;',
        '  display: -ms-inline-flexbox;',
        '  display: inline-flex;',
        '  -webkit-box-align: center;',
        '  -webkit-align-items: center;',
        '  -moz-box-align: center;',
        '  -ms-flex-align: center;',
        '  align-items: center;',
        '}',
        '.online-prestige-rate > svg {',
        '  width: 1.3em !important;',
        '  height: 1.3em !important;',
        '}',
        '.online-prestige-rate > span {',
        '  font-weight: 600;',
        '  font-size: 1.1em;',
        '  padding-left: 0.7em;',
        '}',
        '/* ── empty / error ── */',
        '.online-empty {',
        '  line-height: 1.4;',
        '}',
        '.online-empty__title {',
        '  font-size: 1.8em;',
        '  margin-bottom: 0.3em;',
        '}',
        '.online-empty__time {',
        '  font-size: 1.2em;',
        '  font-weight: 300;',
        '  margin-bottom: 1.6em;',
        '}',
        '.online-empty__buttons {',
        '  display: -webkit-box;',
        '  display: -webkit-flex;',
        '  display: -moz-box;',
        '  display: -ms-flexbox;',
        '  display: flex;',
        '}',
        '.online-empty__buttons > * + * {',
        '  margin-left: 1em;',
        '}',
        '.online-empty__button {',
        '  background: rgba(0, 0, 0, 0.3);',
        '  font-size: 1.2em;',
        '  padding: 0.5em 1.2em;',
        '  -webkit-border-radius: 0.2em;',
        '  border-radius: 0.2em;',
        '  margin-bottom: 2.4em;',
        '}',
        '.online-empty__button.focus {',
        '  background: #fff;',
        '  color: black;',
        '}',
        '.online-empty__templates .online-empty-template:nth-child(2) {',
        '  opacity: 0.5;',
        '}',
        '.online-empty__templates .online-empty-template:nth-child(3) {',
        '  opacity: 0.2;',
        '}',
        '.online-empty-template {',
        '  background-color: rgba(255, 255, 255, 0.3);',
        '  padding: 1em;',
        '  display: -webkit-box;',
        '  display: -webkit-flex;',
        '  display: -moz-box;',
        '  display: -ms-flexbox;',
        '  display: flex;',
        '  -webkit-box-align: center;',
        '  -webkit-align-items: center;',
        '  -moz-box-align: center;',
        '  -ms-flex-align: center;',
        '  align-items: center;',
        '  -webkit-border-radius: 0.3em;',
        '  border-radius: 0.3em;',
        '}',
        '.online-empty-template > * {',
        '  background: rgba(0, 0, 0, 0.3);',
        '  -webkit-border-radius: 0.3em;',
        '  border-radius: 0.3em;',
        '}',
        '.online-empty-template__ico {',
        '  width: 4em;',
        '  height: 4em;',
        '  margin-right: 2.4em;',
        '}',
        '.online-empty-template__body {',
        '  height: 1.7em;',
        '  width: 70%;',
        '}',
        '.online-empty-template + .online-empty-template {',
        '  margin-top: 1em;',
        '}',
        '</style>'
      ].join('\n');
    }

    var LAMPAC_TEMPLATE_PRESTIGE_FULL = [
      '<div class="online-prestige online-prestige--full selector">',
      '  <div class="online-prestige__img">',
      '    <img alt="">',
      '    <div class="online-prestige__loader"></div>',
      '  </div>',
      '  <div class="online-prestige__body">',
      '    <div class="online-prestige__head">',
      '      <div class="online-prestige__title">{title}</div>',
      '      <div class="online-prestige__time">{time}</div>',
      '    </div>',
      '    <div class="online-prestige__timeline"></div>',
      '    <div class="online-prestige__footer">',
      '      <div class="online-prestige__info">{info}</div>',
      '      <div class="online-prestige__quality">{quality}</div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    var LAMPAC_TEMPLATE_CONTENT_LOADING = [
      '<div class="online-empty">',
      '  <div class="broadcast__scan"><div></div></div>',
      '  <div class="online-empty__templates">',
      '    <div class="online-empty-template selector">',
      '      <div class="online-empty-template__ico"></div>',
      '      <div class="online-empty-template__body"></div>',
      '    </div>',
      '    <div class="online-empty-template">',
      '      <div class="online-empty-template__ico"></div>',
      '      <div class="online-empty-template__body"></div>',
      '    </div>',
      '    <div class="online-empty-template">',
      '      <div class="online-empty-template__ico"></div>',
      '      <div class="online-empty-template__body"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    var LAMPAC_TEMPLATE_DOES_NOT_ANSWER = [
      '<div class="online-empty">',
      '  <div class="online-empty__title">',
      '    #{lmxat_balanser_dont_work}',
      '  </div>',
      '  <div class="online-empty__time">',
      '    #{lmxat_balanser_timeout}',
      '  </div>',
      '  <div class="online-empty__buttons">',
      '    <div class="online-empty__button selector cancel">#{cancel}</div>',
      '    <div class="online-empty__button selector change">#{lmxat_change_balanser}</div>',
      '  </div>',
      '  <div class="online-empty__templates">',
      '    <div class="online-empty-template">',
      '      <div class="online-empty-template__ico"></div>',
      '      <div class="online-empty-template__body"></div>',
      '    </div>',
      '    <div class="online-empty-template">',
      '      <div class="online-empty-template__ico"></div>',
      '      <div class="online-empty-template__body"></div>',
      '    </div>',
      '    <div class="online-empty-template">',
      '      <div class="online-empty-template__ico"></div>',
      '      <div class="online-empty-template__body"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    var LAMPAC_TEMPLATE_PRESTIGE_RATE = [
      '<div class="online-prestige-rate">',
      '  <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '    <path d="M8.39409 0.192139L10.99 5.30994L16.7882 6.20387L12.5475 10.4277L13.5819 15.9311L8.39409 13.2425L3.20626 15.9311L4.24065 10.4277L0 6.20387L5.79819 5.30994L8.39409 0.192139Z" fill="#fff"></path>',
      '  </svg>',
      '  <span>{rate}</span>',
      '</div>'
    ].join('\n');

    var LAMPAC_TEMPLATE_PRESTIGE_FOLDER = [
      '<div class="online-prestige online-prestige--folder selector">',
      '  <div class="online-prestige__folder">',
      '    <svg viewBox="0 0 128 112" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '      <rect y="20" width="128" height="92" rx="13" fill="white"></rect>',
      '      <path d="M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z" fill="white" fill-opacity="0.23"></path>',
      '      <rect x="11" y="8" width="106" height="76" rx="13" fill="white" fill-opacity="0.51"></rect>',
      '    </svg>',
      '  </div>',
      '  <div class="online-prestige__body">',
      '    <div class="online-prestige__head">',
      '      <div class="online-prestige__title">{title}</div>',
      '      <div class="online-prestige__time">{time}</div>',
      '    </div>',
      '    <div class="online-prestige__footer">',
      '      <div class="online-prestige__info">{info}</div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    var LAMPAC_TEMPLATE_PRESTIGE_WATCHED = [
      '<div class="online-prestige online-prestige-watched selector">',
      '  <div class="online-prestige-watched__icon">',
      '    <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '      <circle cx="10.5" cy="10.5" r="9" stroke="currentColor" stroke-width="3"/>',
      '      <path d="M14.8477 10.5628L8.20312 14.399L8.20313 6.72656L14.8477 10.5628Z" fill="currentColor"/>',
      '    </svg>',
      '  </div>',
      '  <div class="online-prestige-watched__body"></div>',
      '</div>'
    ].join('\n');

    Lampa.Template.add('lmxat_css', lampacCssHtml());
    window.__lmxatCss = function () { if (!document.getElementById('lmxat-base-css')) { var st = $(Lampa.Template.get('lmxat_css', {}, true)); st.attr('id', 'lmxat-base-css'); $('body').append(st); } };

    function resetTemplates() {
      Lampa.Template.add('lmxat_prestige_full', LAMPAC_TEMPLATE_PRESTIGE_FULL);
      Lampa.Template.add('lmxat_content_loading', LAMPAC_TEMPLATE_CONTENT_LOADING);
      Lampa.Template.add('lmxat_does_not_answer', LAMPAC_TEMPLATE_DOES_NOT_ANSWER);
      Lampa.Template.add('lmxat_prestige_rate', LAMPAC_TEMPLATE_PRESTIGE_RATE);
      Lampa.Template.add('lmxat_prestige_folder', LAMPAC_TEMPLATE_PRESTIGE_FOLDER);
      Lampa.Template.add('lmxat_prestige_watched', LAMPAC_TEMPLATE_PRESTIGE_WATCHED);
    }

    resetTemplates();
    Lampa.Component.add('lmx_anitube_online', component);
  }
  startPlugin();
}

    function start() {
        if (window.__lmxAnitubeOn4) return;
        window.__lmxAnitubeOn4 = true;
        safe(function () { lmxatEmbed(host); });
        safe(hookCreate);
        Lampa.Listener.follow('full', function (e) { if (e.type === 'complite') safe(function () { addButton(e); }); });
        safe(settings);
    }
    if (window.Lampa && Lampa.Component && Lampa.Listener && Lampa.Explorer && Lampa.Filter) start();
    else { var n = 0, iv = setInterval(function () { if (window.Lampa && Lampa.Component && Lampa.Listener && Lampa.Explorer && Lampa.Filter) { clearInterval(iv); start(); } else if (++n > 300) clearInterval(iv); }, 100); }
})();
