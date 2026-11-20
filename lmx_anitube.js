/*
 * LMX Anitube — кнопка «Anitube» на сторінці аніме: перегляд з anitube.in.ua з українською озвучкою (FanVoxUA, Рідний Голос та ін.)
 *  • Кнопка з’являється лише на аніме (жанр «Анімація», японське чи китайське походження)
 *  • Екран — стандартний екран «Онлайн» вашого онлайн-плагіна (lampaua тощо), тож його оформлює LMX Watch: сезони, озвучки, серії, прогрес
 *  • Пошук, сезони, озвучки й серії віддає LMX Worker; посилання на відео бере сам пристрій (плеєр Ashdi працює лише для України)
 */
(function () {
    'use strict';
    if (window.__lmxAnitube3) return;
    window.__lmxAnitube3 = true;
    var VERSION = '3.2';
    // Назва в списку розширень Lampa (інакше там «Без назви»)
    try { if (window.Lampa && Lampa.Manifest) Lampa.Manifest.plugins = { type: 'other', version: String(VERSION), name: 'LMX Anitube', description: 'Кнопка Anitube на сторінці аніме: українська озвучка з anitube.in.ua', author: 'Irfnekf' }; } catch (e) {}

    var DEFAULT_HOST = 'https://lmx-sync.vladshkaraputa07.workers.dev';
    var KEY = 'anitube';

    function safe(fn) { try { return fn(); } catch (e) { try { console.log('LMX Anitube', e); } catch (x) {} } }
    function noty(t) { try { Lampa.Noty.show(t); } catch (e) {} }
    function host() { var s = ''; try { s = String(Lampa.Storage.get('lmx_sync_server', '') || ''); } catch (e) {} return (s || DEFAULT_HOST).replace(/\/+$/, ''); }

    function isAnime(c) {
        try {
            if (!c) return false;
            var gen = (c.genres || []).some(function (g) { return g && (g.id === 16 || /анімац|animation|аніме/i.test(String(g.name || ''))); }) || (c.genre_ids || []).indexOf(16) >= 0;
            var asia = /^(ja|zh)$/.test(String(c.original_language || '')) || (c.origin_country || []).some(function (x) { return x === 'JP' || x === 'CN'; });
            return gen && asia;
        } catch (e) { return false; }
    }
    // Lampa дописує серіалам і поле title, тож серіал впізнаємо за ознаками TMDB-серіалу
    function isSerial(c) { return !!(c && (c.number_of_seasons || c.first_air_date || c.original_name || (c.seasons && c.seasons.length) || c.media_type === 'tv')); }

    // ───────── чий екран «Онлайн» використовувати ─────────
    // Запам'ятовуємо компоненти онлайн-плагінів (екрани з вибором джерела), що відкривались на цьому пристрої: вони вміють відкрити одне задане джерело
    var HOSTS_KEY = 'lmx_anitube_hosts';
    function hostsGet() { var a = null; try { a = Lampa.Storage.get(HOSTS_KEY, []); } catch (e) {} return Array.isArray(a) ? a : []; }
    function hostsNote(name) {
        if (!name || name === 'torrents') return;
        var a = hostsGet();
        if (a[0] === name) return;
        a = a.filter(function (x) { return x !== name; });
        a.unshift(name);
        try { Lampa.Storage.set(HOSTS_KEY, a.slice(0, 6)); } catch (e) {}
    }
    function hostComponent() {
        var list = hostsGet().slice(), i;
        // 'lampac' — це й плагін з lam.maxvol.pro, що скоро перестане працювати: інші знайдені — першими
        list.sort(function (a, b) { return (a === 'lampac' ? 1 : 0) - (b === 'lampac' ? 1 : 0); });
        for (i = 0; i < list.length; i++) if (isOnlineComp(list[i])) return list[i];
        if (isOnlineComp('lampac')) return 'lampac';
        return '';
    }

    // ───────── посилання на відео — з самого пристрою ─────────
    function parsePlayer(page) {
        page = String(page || '');
        var raw = (page.match(/\bfile\s*:\s*"([^"]+)"/) || page.match(/\bfile\s*:\s*'([^']+)'/) || page.match(/["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/) || [])[1];
        if (!raw) return null;
        var fix = function (u) { u = String(u).trim(); return u.indexOf('//') === 0 ? 'https:' + u : u; }, quality = {}, main = '';
        if (/^\s*\[/.test(raw)) {
            raw.split(',').forEach(function (part) { var q = part.match(/^\s*\[([^\]]+)\]\s*(\S+)/); if (q) quality[q[1]] = fix(q[2]); });
            var ks = Object.keys(quality).sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10); });
            main = ks.length ? quality[ks[0]] : '';
        } else main = fix(raw);
        return main ? { method: 'play', url: main, quality: Object.keys(quality).length ? quality : undefined } : null;
    }
    var vcache = {};
    function direct(file, ok, fail) {
        var hit = vcache[file];
        if (hit && Date.now() - hit.t < 20 * 60000) return ok(hit.d);
        var net, done = false;
        function end(f, a) { if (done) return; done = true; f(a); }
        try { net = new Lampa.Reguest(); net.timeout(12000); } catch (e) { return fail(); }
        setTimeout(function () { if (!done) { try { net.clear(); } catch (x) {} end(fail); } }, 13000);
        try {
            net['native'](file, function (page) {
                var r = parsePlayer(typeof page === 'string' ? page : '');
                if (r) { vcache[file] = { t: Date.now(), d: r }; end(ok, r); } else end(fail);
            }, function () { end(fail); }, false, { dataType: 'text' });
        } catch (e) { end(fail); }
    }
    function addCss() {
        if (document.getElementById('lmxat-css')) return;
        var st = document.createElement('style'); st.id = 'lmxat-css';
        st.textContent = '.lmxat-act .online-prestige__img{display:block !important}';
        document.head.appendChild(st);
    }
    function playerOf(url) { var m = String(url || '').match(/\/lite\/anitube\/video\?u=([^&]+)/); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } }

    // Екран онлайн-плагіна, відкритий нашою кнопкою: посилання на серії розбираємо на пристрої, а не через Worker
    function hookCreate() {
        var C = Lampa.Component;
        if (!C || typeof C.create !== 'function' || C.__lmxAt3) return;
        var real = C.create;
        C.create = function (object) {
            var comp = real.apply(C, arguments);
            safe(function () {
                if (!comp || typeof comp.changeBalanser !== 'function') return;
                if (!(object && object.balanser === KEY)) { hostsNote(object && object.component); return; }
                if (typeof comp.getFileUrl !== 'function' || comp.__lmxAt3) return;
                comp.__lmxAt3 = 1;
                // екран з одним заданим джерелом онлайн-плагін малює без кадрів серій (ховає їх) — повертаємо кадри, як на звичайному «Онлайн»
                safe(function () { addCss(); var r = comp.render && comp.render(); if (r && r.addClass) r.addClass('lmxat-act'); });
                var realGet = comp.getFileUrl;
                comp.getFileUrl = function (file, call) {
                    var self = this, args = arguments, u = playerOf(file && file.url);
                    if (!u) return realGet.apply(self, args);
                    direct(u, function (r) {
                        var out = Object.assign({}, r, { title: file.title, voice_name: file.voice_name });
                        call(out, { quality: r.quality });
                    }, function () { realGet.apply(self, args); });
                };
            });
            return comp;
        };
        C.__lmxAt3 = 1;
    }

    function liteUrl(card) {
        var q = ['id=' + encodeURIComponent(card.id || ''), 'title=' + encodeURIComponent(card.title || card.name || ''),
            'original_title=' + encodeURIComponent(card.original_title || card.original_name || ''),
            'year=' + String(card.release_date || card.first_air_date || '').slice(0, 4), 'serial=' + (isSerial(card) ? 1 : 0)];
        return host() + '/lite/anitube?' + q.join('&');
    }
    // екран онлайн-плагіна з вибором джерела (Lampac-подібний) — лише такий уміє відкрити одне задане джерело
    function isOnlineComp(name) { try { var f = Lampa.Component.get(name); return !!f && String(f).indexOf('changeBalanser') >= 0; } catch (e) { return false; } }
    // Ще не знаємо, який онлайн-плагін тут стоїть: тихо «натискаємо» його кнопку «Онлайн» на цій сторінці й забираємо назву екрана,
    // нічого не відкриваючи (перехоплюємо відкриття на мить)
    function learnFromButtons(render) {
        var found = '';
        if (!render || !render.length) return '';
        render.find('.view--online').not('.lmxat--button').each(function () {
            if (found) return;
            var A = Lampa.Activity, realPush = A.push, got = null, btn = $(this);
            A.push = function (o) { got = o; };
            try { btn.trigger('hover:enter'); } catch (e) {} finally { A.push = realPush; }
            if (got && got.component && got.component !== 'torrents' && isOnlineComp(got.component)) found = got.component;
        });
        if (found) hostsNote(found);
        return found;
    }
    function open(card, render) {
        var comp = hostComponent() || learnFromButtons(render);
        if (!comp) return noty('Не знайдено онлайн-плагін (lampaua тощо): Anitube відкривається на його екрані');
        Lampa.Activity.push({
            url: liteUrl(card), title: 'Anitube', component: comp, movie: card, page: 1,
            balanser: KEY, search: card.title || card.name, search_one: card.title || card.name, search_two: card.original_title || card.original_name, clarification: false
        });
    }

    // ───────── кнопка на сторінці аніме (поруч з іншими кнопками «Онлайн») ─────────
    var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.8c1.6 2.3 4.4 2.8 6.3 1.6-.1 2.8 1.7 5 4.1 5.6-2 1.6-2.7 4.4-1.4 6.7-2.8-.4-5.2 1.2-5.9 3.8-1.6-2.3-4.5-3-6.9-1.7.5-2.8-1.1-5.3-3.7-6.1 2.2-1.4 3-4.2 1.9-6.6 2.6.6 5-.5 5.6-3.3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.3" fill="currentColor"/></svg>';
    function addButton(e) {
        var card = e.data && e.data.movie;
        if (!isAnime(card)) return;
        var render = e.object && e.object.activity && e.object.activity.render();
        if (!render || !render.length || render.find('.lmxat--button').length) return;
        var btn = $('<div class="full-start__button selector view--online lmxat--button" data-subtitle="Anitube · LMX">' + ICON + '<span>Anitube</span></div>');
        btn.on('hover:enter', function () { safe(function () { open(card, render); }); });
        var tor = render.find('.view--torrent').last();
        if (tor.length) tor.after(btn);
        else { var box = render.find('.buttons--container, .full-start-new__buttons, .full-start__buttons').eq(0); if (box.length) box.append(btn); }
    }

    function settings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;
        S.addComponent({ component: 'lmx_anitube', name: 'LMX Anitube', icon: ICON });
        S.addParam({ component: 'lmx_anitube', param: { name: 'lmx_anitube_v', type: 'title', default: '' }, field: { name: 'LMX Anitube v' + VERSION + ' · кнопка з’являється лише на аніме' } });
    }
    function start() {
        if (window.__lmxAnitubeOn3) return;
        window.__lmxAnitubeOn3 = true;
        safe(hookCreate);
        Lampa.Listener.follow('full', function (e) { if (e.type === 'complite') safe(function () { addButton(e); }); });
        safe(settings);
    }
    if (window.Lampa && Lampa.Component && Lampa.Listener) start();
    else { var n = 0, iv = setInterval(function () { if (window.Lampa && Lampa.Component && Lampa.Listener) { clearInterval(iv); start(); } else if (++n > 300) clearInterval(iv); }, 100); }
})();
