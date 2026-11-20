/*
 * LMX Anitube — джерело «Anitube» (аніме з українською озвучкою з anitube.in.ua) у списку джерел онлайн-плагіна Lampa
 *  • Додається лише на картках аніме (жанр «Анімація», японське чи китайське походження); на фільмах і серіалах список джерел не змінюється
 *  • Сезони, озвучки (FanVoxUA, Рідний Голос тощо) і серії віддає LMX Worker; плеєр Ashdi/Tortuga розбирається до прямого відео
 *  • Разом із LMX Watch: Watch бачить Anitube у фоновій перевірці й автопідборі джерела
 */
(function () {
    'use strict';
    if (window.__lmxAnitube) return;
    var VERSION = '1.0';
    // Адреса LMX Worker; якщо в LMX Sync вказано свій сервер — беремо його
    var DEFAULT_HOST = 'https://lmx-sync.vladshkaraputa07.workers.dev';
    var KEY = 'anitube';
    // Назва в списку розширень Lampa (інакше там «Без назви»)
    try { if (window.Lampa && Lampa.Manifest) Lampa.Manifest.plugins = { type: 'other', version: String(VERSION), name: 'LMX Anitube', description: 'Джерело Anitube: аніме з українською озвучкою', author: 'Irfnekf' }; } catch (e) {}

    function host() { var s = ''; try { s = String(Lampa.Storage.get('lmx_sync_server', '') || ''); } catch (e) {} return (s || DEFAULT_HOST).replace(/\/+$/, ''); }
    // місток для LMX Watch: за ним Watch знає, куди звертатись за Anitube під час фонової перевірки джерел
    window.__lmxAnitube = { key: KEY, version: VERSION, host: host, urlFor: function (learned) { var q = String(learned || ''), i = q.indexOf('?'); return host() + '/lite/anitube' + (i >= 0 ? q.slice(i) : ''); } };

    function isAnime(c) {
        try {
            if (!c) return false;
            var gen = (c.genres || []).some(function (g) { return g && (g.id === 16 || /анімац|animation|аніме/i.test(String(g.name || ''))); }) || (c.genre_ids || []).indexOf(16) >= 0;
            var asia = /^(ja|zh)$/.test(String(c.original_language || '')) || (c.origin_country || []).some(function (x) { return x === 'JP' || x === 'CN'; });
            return gen && asia;
        } catch (e) { return false; }
    }
    function addSource(list) {
        if (!Array.isArray(list)) return list;
        var has = list.some(function (j) { return j && (String(j.balanser || '').toLowerCase() === KEY || /^anitube\b/i.test(String(j.name || ''))); });
        return has ? list : list.concat([{ name: 'Anitube', url: host() + '/lite/anitube', balanser: KEY, show: true }]);
    }
    // Онлайн-плагін (lampaua та інші на тій самій основі) збирає список джерел у startSource — дописуємо туди Anitube
    function hook() {
        var C = Lampa.Component;
        if (!C || typeof C.create !== 'function' || C.__lmxAt) return;
        var real = C.create;
        C.create = function (object) {
            var comp = real.apply(C, arguments);
            try {
                if (comp && typeof comp.startSource === 'function' && typeof comp.changeBalanser === 'function' && !comp.__lmxAt &&
                    !(object && object.component === 'torrents') && isAnime(object && (object.movie || object.card))) {
                    comp.__lmxAt = 1;
                    var realSS = comp.startSource;
                    comp.startSource = function (json) {
                        var a = arguments;
                        try { if (Array.isArray(json)) { a = [].slice.call(arguments); a[0] = addSource(json); } } catch (e) {}
                        return realSS.apply(this, a);
                    };
                }
            } catch (e) {}
            return comp;
        };
        C.__lmxAt = 1;
    }
    function settings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;
        S.addComponent({
            component: 'lmx_anitube', name: 'LMX Anitube',
            icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3c1.7 2.2 4.6 2.6 6.4 1.3-.2 2.8 1.6 5 4 5.6-2.1 1.5-2.8 4.3-1.6 6.6-2.7-.5-5.2 1-6 3.5-1.5-2.3-4.4-3.1-6.8-1.9.6-2.7-.9-5.2-3.4-6.1C6.8 10.8 7.7 8 6.6 5.6 9 6.3 11.4 5.3 12 3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>'
        });
        S.addParam({ component: 'lmx_anitube', param: { name: 'lmx_anitube_v', type: 'title', default: '' }, field: { name: 'LMX Anitube v' + VERSION + ' · джерело з’являється лише на аніме' } });
    }
    function start() {
        if (window.__lmxAnitubeOn) return;
        window.__lmxAnitubeOn = true;
        try { hook(); } catch (e) {}
        try { settings(); } catch (e) {}
    }
    if (window.Lampa && Lampa.Component && Lampa.SettingsApi) start();
    else if (window.Lampa && Lampa.Listener) Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
    else { var n = 0, iv = setInterval(function () { if (window.Lampa && Lampa.Component) { clearInterval(iv); start(); } else if (++n > 200) clearInterval(iv); }, 100); }
})();
