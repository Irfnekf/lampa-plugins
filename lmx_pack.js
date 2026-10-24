/*
 * LMX Pack v1.5 — надбудова для Lampa, що працює РАЗОМ з плагіном «Ліхтар» (не замінює його).
 *  1) Додаткові ряди на головній (TMDB + українське кіно та серіали)
 *  2) «Порядок головної»: один екран, де можна переставити й сховати ВСІ ряди (і Ліхтаря, і наші)
 *  3) Значок С3Е24, мітки «Нова серія» / «Сьогодні» / «Новинка», мітка Фільм/Серіал, рейтинг; стилі: Класичний, Скло, Мінімум
 *  4) Тривалість («1 год 45 хв») і статус із відліком («через 3 дні») всередині картки
 *  Усе налаштовується: Lampa → Налаштування → LMX Pack
 */
(function () {
    'use strict';

    // ===== Налаштування (Lampa.Storage) =====
    function getBool(name, def) {
        var v = Lampa.Storage.get(name, def ? 'true' : 'false');
        return v === true || v === 'true';
    }
    function getStr(name, def) {
        return String(Lampa.Storage.get(name, def));
    }
    function readJson(key) {
        var v = Lampa.Storage.get(key, '[]');
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } }
        return Array.isArray(v) ? v : [];
    }
    function safe(fn) {
        try { fn(); } catch (e) { console.error('LMX', e); }
    }

    var RGB = { green: '46,158,91', orange: '224,123,32', blue: '48,112,220', red: '192,57,43', purple: '130,80,200', gray: '110,110,120' };
    var COLORS = {};
    Object.keys(RGB).forEach(function (k) { COLORS[k] = 'rgba(' + RGB[k] + ',.94)'; });
    function rgba(name, a) { return 'rgba(' + (RGB[name] || RGB.orange) + ',' + a + ')'; }
    var COLOR_NAMES = { green: 'Зелений', orange: 'Помаранчевий', blue: 'Синій', red: 'Червоний', purple: 'Фіолетовий', gray: 'Сірий' };
    var SIZES = { s: 0.8, m: 0.95, l: 1.1, xl: 1.25 };
    var SIZE_NAMES = { s: 'Маленький', m: 'Середній', l: 'Великий', xl: 'Дуже великий' };
    var STYLE_NAMES = { classic: 'Класичний', glass: 'Скло', minimal: 'Мінімум' };

    // ===== НАШІ РЯДИ =====
    function uaUrl(kind) {
        var q = getStr('lmx_ua_mode', 'lang') === 'country' ? 'with_origin_country=UA' : 'with_original_language=uk';
        return 'discover/' + kind + '?' + q + '&sort_by=popularity.desc';
    }
    // index — лише запасне значення; реальний порядок задає екран «Порядок головної»
    var ROWS = [
        { name: 'LmxPopularMovies', title: 'Популярні фільми',    url: 'movie/popular',     index: 13 },
        { name: 'LmxNowPlaying',    title: 'Зараз у кінотеатрах', url: 'movie/now_playing', index: 14 },
        { name: 'LmxUpcoming',      title: 'Скоро вийдуть',       url: 'movie/upcoming',    index: 15 },
        { name: 'LmxTopMovies',     title: 'Найвищий рейтинг',    url: 'movie/top_rated',   index: 16 },
        { name: 'LmxPopularTv',     title: 'Популярні серіали',   url: 'tv/popular',        index: 17 },
        { name: 'LmxUaMovies',      title: 'Українське кіно',     url: function () { return uaUrl('movie'); }, index: 18 },
        { name: 'LmxUaTv',          title: 'Українські серіали',  url: function () { return uaUrl('tv'); },    index: 19 },
        { name: 'LmxHistory',      title: 'Історія перегляду',   custom: historyCall, index: 20 }
    ];

    // Ряди Ліхтаря (назви взято з його коду) — щоб екран порядку працював навіть якщо їх не вдалося перехопити
    var KNOWN = [
        { name: 'custom_hero_row',               title: 'Новинки прокату (банер)' },
        { name: 'custom_studio_row',             title: 'Стрімінги (логотипи)' },
        { name: 'custom_mood_row',               title: 'Кіно під настрій' },
        { name: 'service_row_netflix',           title: 'Сьогодні на Netflix' },
        { name: 'service_row_apple',             title: 'Сьогодні на Apple TV+' },
        { name: 'service_row_hbo',               title: 'Сьогодні на HBO / Max' },
        { name: 'service_row_amazon',            title: 'Сьогодні на Prime Video' },
        { name: 'service_row_disney',            title: 'Сьогодні на Disney+' },
        { name: 'service_row_paramount',         title: 'Сьогодні на Paramount+' },
        { name: 'service_row_sky_showtime',      title: 'Сьогодні на Sky Showtime' },
        { name: 'service_row_hulu',              title: 'Сьогодні на Hulu' },
        { name: 'service_row_syfy',              title: 'Сьогодні на Syfy' },
        { name: 'service_row_educational_and_reality', title: 'Сьогодні на Пізнавальне' }
    ];

    var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';

    // ===== ПОРЯДОК ВСІХ РЯДІВ ГОЛОВНОЇ =====
    var seen = {};          // ряди, які пройшли через ContentRows.add після встановлення перехоплення
    var diag = { patched: false, addCount: 0, lastTotal: 0, lastTagged: 0 };

    var stats = {};         // скільки карток повернув ряд під час останньої побудови головної

    function trackCalls(name, f) {
        var g = function () {
            var args = Array.prototype.slice.call(arguments);
            if (typeof args[0] === 'function') {
                var cb = args[0];
                args[0] = function (data) {
                    try { stats[name] = (data && data.results) ? data.results.length : 0; } catch (e) {}
                    return cb.apply(this, arguments);
                };
            }
            return f.apply(this, args);
        };
        for (var k in f) { try { g[k] = f[k]; } catch (e) {} }
        return g;
    }
    function rowStat(n) {
        if (stats[n] === undefined) return '';
        return stats[n] === 0 ? 'порожній (немає карток)' : stats[n] + ' карток';
    }

    function allRows() {
        var map = {}, list = [];
        function put(n, t, src) {
            if (!map[n]) { map[n] = { name: n, title: t, src: src }; list.push(n); }
        }
        KNOWN.forEach(function (k) { put(k.name, k.title, 'Ліхтар'); });
        ROWS.forEach(function (r) { put(r.name, r.title, 'LMX Pack'); });
        Object.keys(seen).forEach(function (n) { put(n, seen[n].title || n, 'Інший плагін'); });
        return { map: map, list: list };
    }
    function getOrder() {
        var a = allRows();
        var saved = readJson('lmx_order').filter(function (n) { return a.map[n]; });
        a.list.forEach(function (n) { if (saved.indexOf(n) < 0) saved.push(n); });
        return saved;
    }
    function getHidden() {
        return readJson('lmx_hidden');
    }
    function isHidden(name) {
        return getHidden().indexOf(name) >= 0;
    }
    function rankOf(name) {
        return getOrder().indexOf(name);
    }
    function emptyRowCall(name) {
        return function () {
            var f = function (cb) { cb({ results: [] }); };
            f.__lmx = name;
            return f;
        };
    }

    // Перехоплення: при реєстрації ряду задаємо йому наше місце, ховаємо за потреби і «мітимо» його call
    function adoptRow(row) {
        if (!row || !row.name) return;
        diag.addCount++;
        seen[row.name] = { title: row.title };
        var r = rankOf(row.name);
        if (r >= 0) row.index = r;
        var orig = row.call;
        if (typeof orig === 'function' && !orig.__lmxWrapped) {
            var wrapped = function () {
                if (isHidden(row.name)) return emptyRowCall(row.name)();
                var f = orig.apply(this, arguments);
                if (typeof f === 'function') f = trackCalls(row.name, f);
                if (f && (typeof f === 'function' || typeof f === 'object')) {
                    try { f.__lmx = row.name; } catch (e) {}
                }
                return f;
            };
            wrapped.__lmxWrapped = true;
            row.call = wrapped;
        }
    }

    function tagOf(item) {
        if (!item) return null;
        if (item.__lmx) return item.__lmx;
        if (item.call && item.call.__lmx) return item.call.__lmx;
        return null;
    }
    // Після побудови списку рядів головної — розставляємо за нашим порядком (незалежно від того, як Lampa трактує index)
    function reorderCalls(screen, calls) {
        if (screen !== 'main' || !Array.isArray(calls) || calls.length < 2) return;
        var order = getOrder();
        var tagged = 0;
        var boxed = calls.map(function (c, i) {
            var t = tagOf(c);
            var r = t ? order.indexOf(t) : -1;
            if (t) tagged++;
            return { c: c, i: i, key: r >= 0 ? r : 1000 + i };
        });
        diag.lastTotal = calls.length;
        diag.lastTagged = tagged;
        if (tagged < 2) return;
        boxed.sort(function (a, b) { return a.key - b.key || a.i - b.i; });
        calls.length = 0;
        boxed.forEach(function (b) { calls.push(b.c); });
    }

    function patchContentRows() {
        var CR = Lampa.ContentRows;
        if (!CR || CR.__lmxPatched) return;
        var origAdd = CR.add, origCall = CR.call;
        if (typeof origAdd !== 'function') return;
        try {
            CR.add = function (row) {
                safe(function () { adoptRow(row); });
                return origAdd.apply(this, arguments);
            };
            if (typeof origCall === 'function') {
                CR.call = function (screen, params, calls) {
                    var res = origCall.apply(this, arguments);
                    safe(function () { reorderCalls(screen, calls); });
                    return res;
                };
            }
            CR.__lmxPatched = true;
            diag.patched = true;
        } catch (e) { console.error('LMX patch', e); }
    }

    // ===== ЕКРАН «ПОРЯДОК ГОЛОВНОЇ» =====
    var lastPicked = null;

    function saveOrder(order) { Lampa.Storage.set('lmx_order', order); }
    function saveHidden(h) { Lampa.Storage.set('lmx_hidden', h); }
    function notifySaved() {
        if (Lampa.Noty) Lampa.Noty.show('Збережено. Поверніться на головну (або перезапустіть Lampa)');
    }

    function openOrderList() {
        if (!Lampa.Select || !Lampa.Select.show) return;
        var enabled = Lampa.Controller.enabled().name;
        var a = allRows();
        var order = getOrder();
        var hidden = getHidden();
        var items = order.map(function (n, i) {
            var info = a.map[n];
            return {
                title: (i + 1) + '. ' + info.title + (hidden.indexOf(n) >= 0 ? '  (сховано)' : ''),
                subtitle: info.src,
                name: n,
                selected: n === lastPicked
            };
        });
        items.push({ title: 'Скинути порядок і показати все', reset: true });
        Lampa.Select.show({
            title: 'Порядок головної',
            items: items,
            onBack: function () { Lampa.Controller.toggle(enabled); },
            onSelect: function (it) {
                if (it.reset) {
                    saveOrder([]); saveHidden([]); lastPicked = null;
                    notifySaved();
                    setTimeout(openOrderList, 60);
                    return;
                }
                lastPicked = it.name;
                setTimeout(function () { openRowMenu(it.name, enabled); }, 60);
            }
        });
    }

    function openRowMenu(name, enabled) {
        var a = allRows();
        var hidden = isHidden(name);
        Lampa.Select.show({
            title: a.map[name] ? a.map[name].title : name,
            items: [
                { title: 'Вгору', act: 'up' },
                { title: 'Вниз', act: 'down' },
                { title: 'На початок', act: 'top' },
                { title: 'В кінець', act: 'bottom' },
                { title: hidden ? 'Показувати' : 'Сховати', act: 'toggle' }
            ],
            onBack: function () { setTimeout(openOrderList, 60); },
            onSelect: function (it) {
                var order = getOrder();
                var i = order.indexOf(name);
                if (it.act === 'up' && i > 0) { order.splice(i, 1); order.splice(i - 1, 0, name); }
                if (it.act === 'down' && i < order.length - 1) { order.splice(i, 1); order.splice(i + 1, 0, name); }
                if (it.act === 'top') { order.splice(i, 1); order.unshift(name); }
                if (it.act === 'bottom') { order.splice(i, 1); order.push(name); }
                if (it.act === 'toggle') {
                    var h = getHidden();
                    var k = h.indexOf(name);
                    if (k >= 0) h.splice(k, 1); else h.push(name);
                    saveHidden(h);
                }
                saveOrder(order);
                notifySaved();
                setTimeout(openOrderList, 60);
            }
        });
    }

    var SVG_O = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">';
    var CHEV_UP = SVG_O + '<path d="M6 15l6-6 6 6"/></svg>';
    var CHEV_DOWN = SVG_O + '<path d="M6 9l6 6 6-6"/></svg>';
    var BOX_ON = SVG_O + '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12.5l3 3 5-6"/></svg>';
    var BOX_OFF = SVG_O + '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/></svg>';

    function openOrderModal() {
        if (!(Lampa.Modal && Lampa.Modal.open && window.$)) return openOrderList();
        var enabled = Lampa.Controller.enabled().name;
        var wrap = $('<div class="lmx-ord"></div>');
        var focusTarget = null;
        var lastFire = 0;

        function bind(btn, name, act) {
            btn.on('hover:enter click', function () {
                var now = Date.now();
                if (now - lastFire < 250) return;
                lastFire = now;
                apply(name, act);
            });
        }

        function build() {
            wrap.empty();
            var a = allRows(), order = getOrder(), hidden = getHidden(), want = null;
            order.forEach(function (n) {
                var info = a.map[n], off = hidden.indexOf(n) >= 0;
                var st = rowStat(n);
                var row = $('<div class="lmx-ord__row"></div>');
                var nm = $('<div class="lmx-ord__name"></div>');
                nm.append($('<span></span>').text(info.title));
                nm.append($('<span class="lmx-ord__sub"></span>').text(info.src + (st ? ' · ' + st : '')));
                row.append(nm);
                [['up', CHEV_UP], ['down', CHEV_DOWN], ['toggle', off ? BOX_OFF : BOX_ON]].forEach(function (b) {
                    var btn = $('<div class="lmx-ord__btn selector"></div>').html(b[1]);
                    if (b[0] === 'toggle' && off) btn.addClass('lmx-ord__off');
                    bind(btn, n, b[0]);
                    row.append(btn);
                    if (focusTarget && focusTarget.name === n && focusTarget.act === b[0]) want = btn[0];
                });
                wrap.append(row);
            });
            var reset = $('<div class="lmx-ord__reset selector">Скинути порядок і показати все</div>');
            bind(reset, null, 'reset');
            wrap.append(reset);
            return want;
        }

        function refresh() {
            var want = build();
            safe(function () {
                Lampa.Controller.collectionSet(wrap);
                if (want) Lampa.Controller.collectionFocus(want, wrap);
            });
        }

        function apply(name, act) {
            var order = getOrder(), i = order.indexOf(name);
            if (act === 'up' && i > 0) { order.splice(i, 1); order.splice(i - 1, 0, name); saveOrder(order); }
            else if (act === 'down' && i >= 0 && i < order.length - 1) { order.splice(i, 1); order.splice(i + 1, 0, name); saveOrder(order); }
            else if (act === 'toggle') {
                var h = getHidden(), k = h.indexOf(name);
                if (k >= 0) h.splice(k, 1); else h.push(name);
                saveHidden(h);
            } else if (act === 'reset') {
                saveOrder([]); saveHidden([]); name = null;
            }
            focusTarget = name ? { name: name, act: act } : null;
            refresh();
        }

        build();
        Lampa.Modal.open({
            title: 'Порядок головної',
            html: wrap,
            size: 'medium',
            mask: true,
            onBack: function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle(enabled);
                notifySaved();
            }
        });
    }

    function openDiagnostics() {
        if (!Lampa.Select || !Lampa.Select.show) return;
        var enabled = Lampa.Controller.enabled().name;
        var titles = [];
        var nodes = document.querySelectorAll('.items-line__title');
        for (var i = 0; i < nodes.length; i++) {
            var t = (nodes[i].textContent || '').trim();
            if (t) titles.push(t);
        }
        var items = [
            { title: 'Перехоплення рядів: ' + (diag.patched ? 'увімкнено' : 'НЕ вдалося') },
            { title: 'Рядів зареєстровано після запуску LMX: ' + diag.addCount },
            { title: 'Розпізнано при побудові головної: ' + diag.lastTagged + ' з ' + diag.lastTotal },
            { title: 'Зараз на головній (зверху вниз):' }
        ];
        titles.forEach(function (t, k) { items.push({ title: (k + 1) + '. ' + t }); });
        Lampa.Select.show({
            title: 'Діагностика рядів',
            items: items,
            onBack: function () { Lampa.Controller.toggle(enabled); },
            onSelect: function () { Lampa.Controller.toggle(enabled); }
        });
    }

    // ===== СТОРІНКА НАЛАШТУВАНЬ =====
    function addSettings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;

        S.addComponent({ component: 'lmx', name: 'LMX Pack', icon: ICON });

        function title(id, text) {
            S.addParam({ component: 'lmx', param: { name: id, type: 'title', default: '' }, field: { name: text } });
        }
        function button(id, name, desc, onChange) {
            S.addParam({ component: 'lmx', param: { name: id, type: 'button' }, field: { name: name, description: desc }, onChange: onChange });
        }
        function trigger(id, def, name, desc, onChange) {
            S.addParam({
                component: 'lmx',
                param: { name: id, type: 'trigger', default: def },
                field: { name: name, description: desc },
                onChange: onChange
            });
        }
        function select(id, values, def, name, desc, onChange) {
            S.addParam({
                component: 'lmx',
                param: { name: id, type: 'select', values: values, default: def },
                field: { name: name, description: desc },
                onChange: onChange
            });
        }
        var restart = function () { if (Lampa.Noty) Lampa.Noty.show('Перезапустіть Lampa, щоб застосувати'); };
        var restyle = function () { safe(applyStyle); };
        var rebuild = function () { safe(applyStyle); safe(resetCards); };

        // --- Ряди ---
        title('lmx_t_rows', 'Головна сторінка');
        button('lmx_order_btn', 'Порядок головної', 'Переставити й сховати всі ряди: і Ліхтаря, і наші', openOrderModal);

        // --- Вигляд ---
        title('lmx_t_cards', 'Вигляд карток');
        select('lmx_style', STYLE_NAMES, 'classic', 'Стиль значків',
            'Класичний — темні плашки. Скло — напівпрозорі плашки, кільце рейтингу, смужка статусу. Мінімум — без фону', rebuild);
        select('lmx_size', SIZE_NAMES, 'm', 'Розмір написів на постерах', 'Значки, рейтинг, мітки', restyle);

        // --- Додатково ---
        title('lmx_t_misc', 'Додатково');
        trigger('lmx_marks', true, 'Мітки «Нова серія», «Сьогодні», «Новинка»', 'У правому верхньому куті постера', rebuild);
        select('lmx_c_next', COLOR_NAMES, 'orange', 'Колір: наступна серія / нова серія', 'Фон напису про наступну чи нову серію', restyle);
        select('lmx_c_done', COLOR_NAMES, 'green', 'Колір: вийшов / завершено', 'Фон напису про вихід фільму чи завершення серіалу', restyle);
        select('lmx_c_soon', COLOR_NAMES, 'blue', 'Колір: очікується', 'Фон напису для ще не випущеного', restyle);
        select('lmx_ua_mode', {
            lang: 'Мова оригіналу — українська',
            country: 'Країна виробництва — Україна'
        }, 'lang', 'Що вважати «українським»',
            'Мова оригіналу точніша. Країна виробництва додає й російськомовні проєкти українського виробництва', restart);
        trigger('lmx_hide_year', true, 'Прибрати рік на постері', 'Рік під назвою залишається', rebuild);
        trigger('lmx_replace_rating', true, 'Свій стиль рейтингу замість рейтингу Ліхтаря', 'Колір за оцінкою: зелений — високий, червоний — низький', rebuild);
        trigger('lmx_info', true, 'Тривалість і статус усередині картки', 'Рядок над кнопкою «Дивитись»');
        button('lmx_diag_btn', 'Діагностика рядів', 'Показує, що бачить плагін, і поточний порядок на головній', openDiagnostics);
        trigger('lmx_debug', false, 'Режим налагодження', 'Показує підказку з кількістю знайдених карток');
    }

    // ===== РЯДИ НА ГОЛОВНІЙ (наші) =====
    var rowsStarted = false;

    // Ряд з історії перегляду самої Lampa (запасний варіант, якщо «Продовжити перегляд» не показується)
    function historyCall() {
        return function (call) {
            var list = [];
            try { list = Lampa.Favorite.get({ type: 'history' }) || []; } catch (e) {}
            list = list.filter(function (c) { return c && c.id; }).slice(0, 20);
            if (!list.length) return call();
            call({ title: 'Історія перегляду', results: list, source: 'tmdb' });
        };
    }

    function makeCall(row) {
        if (row.custom) return function () { return row.custom(); };
        return function () {
            return function (call) {
                var url = typeof row.url === 'function' ? row.url() : row.url;
                Lampa.Api.sources.tmdb.get(url, { page: 1 }, function (json) {
                    if (json && json.results && json.results.length) {
                        call({
                            title: row.title,
                            results: json.results,
                            url: url,
                            source: 'tmdb',
                            total_pages: json.total_pages || 1
                        });
                    } else {
                        call();
                    }
                }, function () {
                    call();
                });
            };
        };
    }

    function initRows() {
        if (rowsStarted) return;
        rowsStarted = true;
        if (!Lampa.ContentRows || !Lampa.ContentRows.add) return;
        ROWS.forEach(function (row) {
            Lampa.ContentRows.add({
                name: row.name,
                title: row.title,
                index: row.index,
                screen: ['main'],
                call: makeCall(row)
            });
        });
    }

    // ===== ДОПОМІЖНЕ ДЛЯ КАРТОК =====
    var MAX_PARALLEL = 4;
    var CACHE_MIN = 1440;
    var RE_YEAR = /^\s*(19|20)\d\d\s*$/;
    var RE_RATING = /^\s*\d{1,2}([.,]\d)?\s*$/;
    var RE_TYPE = /^\s*(Фільм|Фильм|Серіал|Сериал)\s*$/i;
    var RE_NATIVE_TV = /^\s*(TV|ТВ)\s*$/i;

    var mem = {};
    var queue = [];
    var active = 0;
    var found = 0, withData = 0, rendered = 0;
    var hiddenEls = [];

    function typeOf(d) {
        if (d.media_type === 'tv' || d.media_type === 'movie') return d.media_type;
        return (d.name || d.first_air_date || d.number_of_seasons) ? 'tv' : 'movie';
    }
    function fmtFull(s) {
        var p = String(s || '').split('-');
        return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : '';
    }
    function fmtShort(s) {
        var p = String(s || '').split('-');
        return p.length === 3 ? p[2] + '.' + p[1] : '';
    }
    function code(s, e) {
        return 'С' + s + 'Е' + e;
    }
    // 105 -> «1 год 45 хв», 45 -> «45 хв», 120 -> «2 год»
    function fmtDur(min) {
        min = Math.round(min);
        if (min < 60) return min + ' хв';
        var h = Math.floor(min / 60), m = min % 60;
        return h + ' год' + (m ? ' ' + m + ' хв' : '');
    }
    // скільки днів від сьогодні до дати (від’ємне — дата в минулому), null — дати немає
    function dayDiff(dateStr) {
        var p = String(dateStr || '').split('-');
        if (p.length !== 3) return null;
        var t = new Date();
        var a = new Date(t.getFullYear(), t.getMonth(), t.getDate());
        var b = new Date(+p[0], +p[1] - 1, +p[2]);
        if (isNaN(b.getTime())) return null;
        return Math.round((b - a) / 86400000);
    }
    function plural(n, one, few, many) {
        var a = n % 10, b = n % 100;
        if (a === 1 && b !== 11) return one;
        if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
        return many;
    }
    // «сьогодні» / «завтра» / «через 3 дні»
    function rel(dateStr) {
        var n = dayDiff(dateStr);
        if (n === null || n < 0 || n > 90) return fmtFull(dateStr);
        if (n === 0) return 'сьогодні';
        if (n === 1) return 'завтра';
        return 'через ' + n + ' ' + plural(n, 'день', 'дні', 'днів');
    }
    function ratingColor(v) {
        if (v >= 7.5) return 'rgba(46,158,91,.95)';
        if (v >= 6.5) return 'rgba(140,160,30,.95)';
        if (v >= 5.5) return 'rgba(224,123,32,.95)';
        return 'rgba(192,57,43,.95)';
    }

    // ===== Мітки =====
    function tvMark(j) {
        var n = j.next_episode_to_air ? dayDiff(j.next_episode_to_air.air_date) : null;
        var l = j.last_episode_to_air ? dayDiff(j.last_episode_to_air.air_date) : null;
        if (n === 0 || l === 0) return { t: 'Сьогодні', c: 'next' };
        if (l !== null && l < 0 && l >= -7) return { t: 'Нова серія', c: 'next' };
        return null;
    }
    function movieMark(d) {
        var n = dayDiff(d.release_date);
        if (n !== null && n <= 0 && n >= -30) return { t: 'Новинка', c: 'new' };
        return null;
    }
    function movieStripe(d) {
        var n = dayDiff(d.release_date);
        if (n === null) return null;
        return n <= 0 ? 'done' : 'soon';
    }
    function tvStripe(j) {
        var st = j.status;
        if (st === 'Returning Series') return 'next';
        if (st === 'Ended') return 'done';
        if (st === 'Canceled') return 'bad';
        return 'soon';
    }

    // ===== CSS =====
    function buildCss() {
        var st = getStr('lmx_style', 'classic');
        var fs = SIZES[getStr('lmx_size', 'm')] || SIZES.m;
        var cNext = COLORS[getStr('lmx_c_next', 'orange')] || COLORS.orange;
        var cDone = COLORS[getStr('lmx_c_done', 'green')] || COLORS.green;
        var cSoon = COLORS[getStr('lmx_c_soon', 'blue')] || COLORS.blue;
        var nNext = RGB[getStr('lmx_c_next', 'orange')] ? getStr('lmx_c_next', 'orange') : 'orange';

        var pill;
        if (st === 'glass') {
            pill = 'background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.38);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);';
        } else if (st === 'minimal') {
            pill = 'background:none;padding:.1em .2em;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.8);';
        } else {
            pill = 'background:rgba(0,0,0,.62);';
        }
        var ringBg = st === 'glass' ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.62)';
        function markCss(cls, nm) {
            var sel = '.lmx-pill.lmx-m-' + cls;
            if (st === 'glass') return sel + '{background:' + rgba(nm, 0.42) + ';border:1px solid ' + rgba(nm, 0.95) + '}';
            if (st === 'minimal') return sel + '{background:none;border:0;padding:.1em .2em;color:' + rgba(nm, 1) + '}';
            return sel + '{background:' + rgba(nm, 0.96) + '}';
        }

        return '' +
            '.lmx-box{position:absolute;left:.4em;top:.4em;z-index:3;pointer-events:none}' +
            '.lmx-tr{position:absolute;right:.4em;top:.4em;z-index:3;pointer-events:none}' +
            '.lmx-tr.lmx-low{top:2.6em}' +
            '.lmx-bl{position:absolute;left:.4em;bottom:.4em;z-index:3;pointer-events:none}' +
            '.lmx-br{position:absolute;right:.4em;bottom:.4em;z-index:3;pointer-events:none}' +
            '.lmx-pill{display:inline-block;font-size:' + fs + 'em;line-height:1;padding:.32em .6em;border-radius:.6em;color:#fff;font-weight:600;white-space:nowrap;' + pill + '}' +
            markCss('next', nNext) + markCss('new', 'purple') +
            '.lmx-ord__row{display:flex;align-items:center;padding:.45em .7em;border-radius:.5em}' +
            '.lmx-ord__row:nth-child(even){background:rgba(255,255,255,.06)}' +
            '.lmx-ord__name{flex:1;min-width:0;font-size:1.15em}' +
            '.lmx-ord__sub{display:block;font-size:.7em;opacity:.55;margin-top:.15em}' +
            '.lmx-ord__btn{display:flex;align-items:center;justify-content:center;width:2.6em;height:2.6em;margin-left:.3em;border-radius:.5em}' +
            '.lmx-ord__btn.focus{background:#fff;color:#000}' +
            '.lmx-ord__off{opacity:.5}' +
            '.lmx-ord__reset{margin-top:.8em;padding:.8em 1em;border-radius:.5em;text-align:center;background:rgba(255,255,255,.08)}' +
            '.lmx-ord__reset.focus{background:#fff;color:#000}' +
            '.lmx-ring{position:relative;display:inline-block;width:2.8em;height:2.8em;font-size:' + fs + 'em;border-radius:50%;background:' + ringBg + ';-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
            '.lmx-ring svg{position:absolute;left:0;top:0;width:100%;height:100%}' +
            '.lmx-ring span{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:.85em;font-weight:700;color:#fff}' +
            '.lmx-num{display:inline-block;font-size:' + (fs * 1.3).toFixed(2) + 'em;line-height:1;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.8)}' +
            '.lmx-stripe{position:absolute;left:0;right:0;bottom:0;height:.3em;z-index:3;pointer-events:none}' +
            '.lmx-st-next{background:' + cNext + '}' +
            '.lmx-st-done{background:' + cDone + '}' +
            '.lmx-st-soon{background:' + cSoon + '}' +
            '.lmx-st-bad{background:' + COLORS.red + '}' +
            '.lmx-info{display:flex;flex-wrap:wrap;gap:.5em;margin:.8em 0}' +
            '.lmx-ip{font-size:1.1em;line-height:1;padding:.45em .8em;border-radius:.6em;background:rgba(255,255,255,.12);color:#fff}' +
            '.lmx-ip.lmx-next{background:' + cNext + '}' +
            '.lmx-ip.lmx-done{background:' + cDone + '}' +
            '.lmx-ip.lmx-soon{background:' + cSoon + '}' +
            '.lmx-ip.lmx-bad{background:' + COLORS.red + '}';
    }
    function applyStyle() {
        var s = document.getElementById('lmx-css');
        if (!s) {
            s = document.createElement('style');
            s.id = 'lmx-css';
            document.head.appendChild(s);
        }
        s.textContent = buildCss();
    }

    // ===== Пошук даних картки (кілька способів, бо внутрішності Lampa/Ліхтаря мені недоступні) =====
    function looksLikeCard(o) {
        return !!(o && typeof o === 'object' && !o.nodeType &&
            (typeof o.id === 'number' || /^\d+$/.test(String(o.id || ''))) &&
            (o.title || o.name || o.original_title || o.original_name));
    }
    function getData(el) {
        if (looksLikeCard(el.card_data)) return el.card_data;
        var k;
        for (k in el) {
            try { if (looksLikeCard(el[k])) return el[k]; } catch (e) {}
        }
        if (window.$) {
            var dd = window.$(el).data();
            for (k in dd) { if (looksLikeCard(dd[k])) return dd[k]; }
        }
        return null;
    }

    function isOurs(n) {
        return !!(n.closest && n.closest('.lmx-box,.lmx-bl,.lmx-br,.lmx-tr'));
    }
    function findLeaf(view, re) {
        var all = view.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            if (n.children.length === 0 && n.offsetWidth > 0 && !isOurs(n) && re.test(n.textContent)) return n;
        }
        return null;
    }
    // елемент-«плашка» з фоном навколо тексту (щоб ховати плашку, а не лише текст)
    function pillOf(leaf, view) {
        var txt = leaf.textContent.trim(), el = leaf;
        while (el && el !== view) {
            var bg = window.getComputedStyle(el).backgroundColor;
            if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return el;
            var p = el.parentElement;
            if (!p || p === view || p.textContent.trim() !== txt) break;
            el = p;
        }
        return leaf;
    }
    function hideEl(el) {
        el.style.display = 'none';
        hiddenEls.push(el);
    }

    function hideLeaves(view, re) {
        var all = view.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            if (n.children.length === 0 && re.test(n.textContent) && !isOurs(n)) hideEl(pillOf(n, view));
        }
    }
    function hideYear(el) {
        var view = el.querySelector('.card__view');
        if (view) hideLeaves(view, RE_YEAR);
    }

    // ===== Малювання елементів на постері =====
    function addTo(view, cls, html) {
        var d = document.createElement('div');
        d.className = cls;
        d.innerHTML = html;
        view.appendChild(d);
        rendered++;
    }
    function ratingHtml(v) {
        var st = getStr('lmx_style', 'classic');
        var col = ratingColor(v);
        if (st === 'glass') {
            var C = 2 * Math.PI * 12;
            var len = Math.max(0.05, Math.min(1, v / 10)) * C;
            return '<span class="lmx-ring"><svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="3"/>' +
                '<circle cx="15" cy="15" r="12" fill="none" stroke="' + col + '" stroke-width="3" stroke-linecap="round" stroke-dasharray="' +
                len.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 15 15)"/></svg><span>' + v.toFixed(1) + '</span></span>';
        }
        if (st === 'minimal') return '<span class="lmx-num" style="color:' + col + '">' + v.toFixed(1) + '</span>';
        return '<span class="lmx-pill" style="background:' + col + '">' + v.toFixed(1) + '</span>';
    }
    function addMark(view, m) {
        if (!m || !getBool('lmx_marks', true) || view.querySelector('.lmx-tr')) return;
        var low = getBool('lmx_hide_year', true) ? '' : ' lmx-low';
        addTo(view, 'lmx-tr' + low, '<span class="lmx-pill lmx-mark lmx-m-' + m.c + '">' + m.t + '</span>');
    }
    function addStripe(view, kind) {
        if (!kind || getStr('lmx_style', 'classic') !== 'glass' || view.querySelector('.lmx-stripe')) return;
        addTo(view, 'lmx-stripe lmx-st-' + kind, '');
    }

    // Рейтинг, мітка Фільм/Серіал (лише якщо її немає), для фільмів ще мітка «Новинка» і смужка
    function extras(el, d, type) {
        var view = el.querySelector('.card__view');
        if (!view) return;
        var v = Number(d.vote_average) || 0;

        hideLeaves(view, RE_NATIVE_TV);

        if (v > 0 && !view.querySelector('.lmx-br')) {
            var ratingLeaf = findLeaf(view, RE_RATING);
            if (!ratingLeaf) {
                addTo(view, 'lmx-br', ratingHtml(v));
            } else if (getBool('lmx_replace_rating', true)) {
                hideEl(pillOf(ratingLeaf, view));
                addTo(view, 'lmx-br', ratingHtml(v));
            }
        }

        if (!findLeaf(view, RE_TYPE) && !view.querySelector('.lmx-bl')) {
            addTo(view, 'lmx-bl', '<span class="lmx-pill">' + (type === 'tv' ? 'Серіал' : 'Фільм') + '</span>');
        }

        if (type === 'movie') {
            addMark(view, movieMark(d));
            addStripe(view, movieStripe(d));
        }
    }

    // Серіали: значок С3Е24, мітки «Нова серія»/«Сьогодні», смужка статусу
    function renderTv(el, j) {
        var view = el.querySelector('.card__view');
        if (!view) return;
        if (!view.querySelector('.lmx-box') && j.number_of_seasons && j.number_of_episodes) {
            addTo(view, 'lmx-box', '<span class="lmx-pill">' + code(j.number_of_seasons, j.number_of_episodes) + '</span>');
        }
        addMark(view, tvMark(j));
        addStripe(view, tvStripe(j));
    }

    function load(id, cb) {
        var key = 'tv/' + id;
        if (mem[key]) return cb(mem[key]);
        Lampa.Api.sources.tmdb.get(key, {}, function (j) {
            mem[key] = j || {};
            cb(mem[key]);
        }, function () {
            cb(null);
        }, { life: CACHE_MIN });
    }

    function pump() {
        while (active < MAX_PARALLEL && queue.length) {
            (function (task) {
                active++;
                load(task.id, function (j) {
                    active--;
                    if (j) renderTv(task.el, j);
                    pump();
                });
            })(queue.shift());
        }
    }

    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            io.unobserve(e.target);
            if (e.target.__lmx) queue.push(e.target.__lmx);
        });
        pump();
    }, { rootMargin: '200px' }) : null;

    function scan() {
        var cards = document.querySelectorAll('.card:not([data-lmx])');
        cards.forEach(function (el) {
            el.setAttribute('data-lmx', '1');
            found++;

            if (getBool('lmx_hide_year', true)) {
                hideYear(el);
                setTimeout(function () { safe(function () { hideYear(el); }); }, 1500);
            }

            var d = getData(el);
            if (!d) return;
            withData++;
            var type = typeOf(d);

            // даємо Ліхтарю час намалювати свої значки, потім доповнюємо
            setTimeout(function () { safe(function () { extras(el, d, type); }); }, 1600);
            setTimeout(function () { safe(function () { extras(el, d, type); }); }, 4000);

            if (type === 'tv') {
                var task = { el: el, id: d.id };
                if (io) { el.__lmx = task; io.observe(el); }
                else { queue.push(task); }
            }
        });
        if (!io) pump();
        if (getBool('lmx_debug', false) && cards.length && Lampa.Noty) {
            Lampa.Noty.show('lmx: карток ' + found + ', з даними ' + withData + ', значків ' + rendered);
        }
    }

    var timer = null;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(function () { safe(scan); }, 300);
    }

    // після зміни стилю: прибрати наші елементи, показати сховане, перемалювати
    function resetCards() {
        hiddenEls.forEach(function (e) { e.style.display = ''; });
        hiddenEls = [];
        var mine = document.querySelectorAll('.lmx-box,.lmx-bl,.lmx-br,.lmx-tr,.lmx-stripe');
        for (var i = 0; i < mine.length; i++) mine[i].parentNode.removeChild(mine[i]);
        var cards = document.querySelectorAll('.card[data-lmx]');
        for (var k = 0; k < cards.length; k++) cards[k].removeAttribute('data-lmx');
        found = 0; withData = 0; rendered = 0;
        schedule();
    }

    // ===== Всередині картки фільму/серіалу: тривалість і статус =====
    function infoPills(m) {
        var p = [];
        var tv = typeOf(m) === 'tv';

        if (tv) {
            var rt = (m.episode_run_time && m.episode_run_time[0]) ||
                (m.last_episode_to_air && m.last_episode_to_air.runtime) || 0;
            if (rt) p.push({ t: fmtDur(rt) + '/серія' });

            var st = m.status;
            if (st === 'Ended') p.push({ t: 'Завершено', c: 'lmx-done' });
            else if (st === 'Canceled') p.push({ t: 'Скасовано', c: 'lmx-bad' });
            else if (st === 'Returning Series') {
                var n = m.next_episode_to_air;
                if (n && n.air_date) {
                    var d = dayDiff(n.air_date);
                    var extra = (d !== null && d > 1 ? fmtShort(n.air_date) + ', ' : '') + code(n.season_number, n.episode_number);
                    p.push({ t: 'Наступна серія: ' + rel(n.air_date) + ' (' + extra + ')', c: 'lmx-next' });
                } else {
                    p.push({ t: 'Виходить, дата наступної серії невідома', c: 'lmx-next' });
                }
            } else if (st === 'In Production' || st === 'Planned' || st === 'Pilot') {
                p.push({ t: 'Очікується', c: 'lmx-soon' });
            }
        } else {
            if (m.runtime) p.push({ t: fmtDur(m.runtime) });

            var ms = m.status;
            if (ms === 'Released') p.push({ t: 'Вийшов', c: 'lmx-done' });
            else if (ms === 'Canceled') p.push({ t: 'Скасовано', c: 'lmx-bad' });
            else if (ms) {
                var rd = '';
                if (m.release_date) {
                    var dd = dayDiff(m.release_date);
                    rd = ': ' + rel(m.release_date) + (dd !== null && dd > 1 && dd <= 90 ? ' (' + fmtFull(m.release_date) + ')' : '');
                }
                p.push({ t: 'Очікується' + rd, c: 'lmx-soon' });
            }
        }
        return p;
    }

    function onFull(e) {
        if (!e || (e.type !== 'complite' && e.type !== 'complete')) return;
        if (!getBool('lmx_info', true)) return;
        var m = e.data && e.data.movie;
        if (!m) return;
        var pills = infoPills(m);
        if (!pills.length) return;

        var r = e.object.activity.render();
        r.find('.lmx-info').remove();

        var html = '<div class="lmx-info">' + pills.map(function (x) {
            return '<div class="lmx-ip ' + (x.c || '') + '">' + x.t + '</div>';
        }).join('') + '</div>';

        var anchor = r.find('.full-start-new__buttons, .full-start__buttons').eq(0);
        if (anchor.length) anchor.before(html);
        else r.find('.full-start-new__right, .full-start__right').eq(0).append(html);
    }

    // ===== Запуск =====
    // Перехоплення ставимо одразу при завантаженні, щоб побачити ряди, які Ліхтар додасть пізніше
    safe(patchContentRows);

    function start() {
        safe(patchContentRows);
        safe(addSettings);
        safe(initRows);
        safe(function () {
            applyStyle();
            new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
            scan();
            Lampa.Listener.follow('full', function (e) { safe(function () { onFull(e); }); });
        });
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') start();
    });
})();
