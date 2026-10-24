/*
 * LMX Pack v2.9 — збірка для Lampa: власна головна, сторінки стрімінгів, стилі карток
 *  1) Ряди на головній: банер, стрімінги, підбірки під настрій, TMDB та українське кіно й серіали
 *  2) «Порядок головної»: переставити й сховати будь-який ряд
 *  3) Значок С3Е24, мітки «Нова серія» / «Сьогодні» / «Новинка», рейтинг; стилі: Класичний, Скло, Мінімум, Кіно
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
    var STYLE_NAMES = { classic: 'Класичний', glass: 'Скло', minimal: 'Мінімум', cinema: 'Кіно (напис на постері)' };

    // ===== НАШІ РЯДИ =====
    function dayStr(offset) {
        var d = new Date(Date.now() + offset * 86400000);
        var m = d.getMonth() + 1, dd = d.getDate();
        return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
    }
    function market() { return getBool('lmx_market', true); }
    var WATCH = 'watch_region=UA&with_watch_monetization_types=flatrate%7Cfree%7Cads%7Crent%7Cbuy';
    // Українські: країна виробництва включає Україну (співпродакшн теж), сортування за популярністю, як у звичайних популярних
    function uaUrls(kind) {
        return ['discover/' + kind + '?with_origin_country=UA&sort_by=popularity.desc'];
    }
    // Для українського ринку: те, що доступне в Україні; без ринку — як було
    function mkt(url, kind) {
        if (!market()) return [url];
        if (kind === 'movie') return [url + (url.indexOf('?') < 0 ? '?' : '&') + 'region=UA'];
        if (kind === 'tv') {
            return ['discover/tv?sort_by=popularity.desc&' + WATCH + '&air_date.gte=' + dayStr(-60) + '&air_date.lte=' + dayStr(30), url];
        }
        return [url];
    }
    // index — лише запасне значення; реальний порядок задає екран «Порядок головної»
    var ROWS = [
        { name: 'LmxPopularMovies', title: 'Популярні фільми',    urls: function () { return mkt('movie/popular', 'movie'); },     index: 13 },
        { name: 'LmxNowPlaying',    title: 'Зараз у кінотеатрах', urls: function () { return mkt('movie/now_playing', 'movie'); }, index: 14 },
        { name: 'LmxUpcoming',      title: 'Скоро вийдуть',       urls: function () { return mkt('movie/upcoming', 'movie'); },    index: 15 },
        { name: 'LmxTopMovies',     title: 'Найвищий рейтинг',    urls: function () { return mkt('movie/top_rated', 'movie'); },   index: 16 },
        { name: 'LmxPopularTv',     title: 'Популярні серіали',   urls: function () { return mkt('tv/popular', 'tv'); },           index: 17 },
        { name: 'LmxUaMovies',      title: 'Українське кіно',     urls: function () { return uaUrls('movie'); }, ua: true, index: 18 },
        { name: 'LmxUaTv',          title: 'Українські серіали',  urls: function () { return uaUrls('tv'); },    ua: true, index: 19 },
        { name: 'LmxHistory',      title: 'Історія перегляду',   custom: historyCall, index: 20 }
    ];

    // Стрімінги (id провайдерів TMDB) і підбірки «під настрій»
    var SERVICES = [
        ['netflix', 'Netflix', 8], ['apple', 'Apple TV+', 350], ['hbo', 'HBO / Max', 1899],
        ['amazon', 'Prime Video', 119], ['disney', 'Disney+', 337], ['paramount', 'Paramount+', 531],
        ['sky', 'SkyShowtime', 1773]
    ];
    var MOODS = [
        ['relax', 'Розслабитись', '35%7C10751'],
        ['think', 'Подумати', '9648%7C878'],
        ['adrenaline', 'Адреналін', '28%7C53'],
        ['romance', 'Романтика', '10749'],
        ['scary', 'Моторошно', '27'],
        ['friends', 'З друзями', '12%7C35']
    ];
    ROWS.unshift(
        { name: 'LmxHero', title: 'Банер', gate: 'lmx_hero', index: -2, custom: function () { return heroCall(this); } },
        { name: 'LmxStudios', title: 'Стрімінги', gate: 'lmx_studios', index: -1, custom: function () { return studioCall(this); } }
    );
    var n0 = 30;
    SERVICES.forEach(function (x) {
        ROWS.push({ name: 'LmxSvc_' + x[0], title: 'Сьогодні на ' + x[1], gate: 'lmx_services', index: n0++,
            custom: function () { return serviceCall(this, x[0]); } });
    });
    MOODS.forEach(function (x) {
        ROWS.push({ name: 'LmxMood_' + x[0], title: 'Під настрій: ' + x[1], gate: 'lmx_moods', index: n0++,
            urls: function () { return ['discover/movie?with_genres=' + x[2] + '&vote_count.gte=300&sort_by=popularity.desc' + (market() ? '&region=UA' : '')]; } });
    });

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
                    try {
                        stats[name] = (data && data.results) ? data.results.length : 0;
                        if (stats[name] > 0) {
                            var lv = readJson('lmx_live');
                            if (lv.indexOf(name) < 0) { lv.push(name); Lampa.Storage.set('lmx_live', lv); }
                        }
                    } catch (e) {}
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

    // Порядок за замовчуванням (поки користувач не змінив його сам)
    var DEFAULT_ORDER = ['LmxHero', 'LmxStudios', 'LmxPopularMovies', 'LmxSvc_hbo', 'LmxPopularTv', 'LmxSvc_apple', 'LmxNowPlaying',
        'LmxSvc_netflix', 'LmxSvc_amazon', 'LmxUaMovies', 'LmxUaTv', 'LmxSvc_disney', 'LmxSvc_paramount', 'LmxTopMovies', 'LmxUpcoming',
        'LmxMood_relax', 'LmxMood_adrenaline', 'LmxMood_think', 'LmxMood_romance', 'LmxMood_friends', 'LmxMood_scary', 'LmxSvc_sky', 'LmxHistory'];

    function allRows() {
        var map = {}, list = [];
        function put(n, t, src) {
            if (!map[n]) { map[n] = { name: n, title: t, src: src }; list.push(n); }
        }
        ROWS.forEach(function (r) { if (!r.gate || getBool(r.gate, true)) put(r.name, r.title, 'LMX Pack'); });
        // Чужі ряди (стандартні й від інших плагінів) показуємо лише якщо їх не сховано глобально і вони реально давали картки
        if (!getBool('lmx_only_mine', true)) {
            var live = readJson('lmx_live');
            Object.keys(seen).forEach(function (n) {
                if ((stats[n] || 0) > 0 || live.indexOf(n) >= 0) put(n, seen[n].title || n, 'Інше');
            });
        }
        var rank = function (n) { var i = DEFAULT_ORDER.indexOf(n); return i < 0 ? 999 : i; };
        list = list.map(function (n, i) { return { n: n, i: i }; }).sort(function (x, y) { return rank(x.n) - rank(y.n) || x.i - y.i; }).map(function (x) { return x.n; });
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
        if (getBool('lmx_only_mine', true) && tagged > 0) {
            var ours = {};
            ROWS.forEach(function (r) { ours[r.name] = 1; });
            var mine = boxed.filter(function (b) { return ours[tagOf(b.c)]; });
            if (mine.length) { boxed = mine; tagged = mine.length; }
        }
        if (tagged < 2 && boxed.length === calls.length) return;
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
        if (getBool('lmx_order_classic', false) || !(Lampa.Modal && Lampa.Modal.open && window.$)) return openOrderList();
        var enabled = Lampa.Controller.enabled().name;
        var wrap = $('<div class="lmx-ord"></div>');
        var rowEls = {};
        var lastFire = 0;

        // Не перебудовуємо список і не чіпаємо колекцію контролера — лише пересуваємо рядки на місці,
        // щоб прокрутка вікна (її веде сама Lampa) не ламалась.
        function followFocus(el) {
            safe(function () {
                if (window.Navigator && Navigator.focus) Navigator.focus(el);
                else $(el).trigger('hover:focus');
            });
        }

        function bind(btn, name, act) {
            btn.on('hover:enter click', function () {
                var now = Date.now();
                if (now - lastFire < 250) return;
                lastFire = now;
                apply(name, act, this);
            });
        }

        function mkRow(n, a, hidden) {
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
            });
            rowEls[n] = row;
            return row;
        }

        function buildAll() {
            wrap.empty();
            rowEls = {};
            var a = allRows(), hidden = getHidden();
            getOrder().forEach(function (n) { wrap.append(mkRow(n, a, hidden)); });
            var reset = $('<div class="lmx-ord__reset selector">Скинути порядок і показати все</div>');
            bind(reset, null, 'reset');
            wrap.append(reset);
        }

        function apply(name, act, btnEl) {
            var order = getOrder(), i = order.indexOf(name);
            if (act === 'up' && i > 0) {
                order.splice(i, 1); order.splice(i - 1, 0, name); saveOrder(order);
                rowEls[name].insertBefore(rowEls[order[i]]);
                followFocus(btnEl);
            } else if (act === 'down' && i >= 0 && i < order.length - 1) {
                order.splice(i, 1); order.splice(i + 1, 0, name); saveOrder(order);
                rowEls[name].insertAfter(rowEls[order[i]]);
                followFocus(btnEl);
            } else if (act === 'toggle') {
                var h = getHidden(), k = h.indexOf(name);
                if (k >= 0) h.splice(k, 1); else h.push(name);
                saveHidden(h);
                var off = h.indexOf(name) >= 0;
                rowEls[name].find('.lmx-ord__btn').eq(2).html(off ? BOX_OFF : BOX_ON).toggleClass('lmx-ord__off', off);
            } else if (act === 'reset') {
                saveOrder([]); saveHidden([]);
                buildAll();
                var first = wrap.find('.lmx-ord__btn')[0];
                if (first) followFocus(first);
            }
        }

        buildAll();
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
        title('lmx_t_ver', 'Версія ' + VERSION);
        title('lmx_t_rows', 'Головна сторінка');
        button('lmx_order_btn', 'Порядок головної', 'Переставити й сховати ряди головної', openOrderModal);

        // --- Ряди ---
        title('lmx_t_lk', 'Ряди LMX');
        trigger('lmx_only_mine', true, 'Лише підбірки LMX на головній', 'Ховає стандартні ряди Lampa та ряди інших плагінів', null);
        trigger('lmx_hero', true, 'Банер зверху головної', 'Широкі картки з фоном фільму', restart);
        select('lmx_hero_src', { mix: 'У тренді (фільми й серіали)', cinema: 'Зараз у кінотеатрах', fresh: 'Нове й найкраще' }, 'mix', 'Що показувати у банері', 'Відбираються картки з описом і гідним рейтингом', restart);
        trigger('lmx_studios', true, 'Ряд стрімінгів з логотипами', 'Плитки Netflix, HBO та інших — відкривають підбірку сервісу', restart);
        trigger('lmx_services', true, 'Ряди стрімінгів (Netflix, HBO та ін.)', 'Netflix, HBO, Disney+ та інші', restart);
        trigger('lmx_moods', true, 'Підбірки «Під настрій»', 'Шість рядів за жанрами; в порядку головної їх можна сховати окремо', restart);

        // --- Вигляд ---
        title('lmx_t_cards', 'Вигляд карток');
        select('lmx_style', STYLE_NAMES, 'classic', 'Стиль значків',
            'Класичний — темні плашки. Скло — напівпрозорі плашки, кільце рейтингу, смужка статусу. Мінімум — без фону', rebuild);
        select('lmx_card_size', { m: 'Стандартні', l: 'Трохи більші', xl: 'Великі' }, 'm', 'Розмір карток', 'Ширина постерів у рядах головної', restyle);
        select('lmx_size', SIZE_NAMES, 'm', 'Розмір написів на постерах', 'Значки, рейтинг, мітки', restyle);

        // --- Додатково ---
        title('lmx_t_misc', 'Додатково');
        trigger('lmx_marks', true, 'Мітки «Нова серія», «Сьогодні», «Новинка», «Скоро»', 'У правому верхньому куті постера', rebuild);
        select('lmx_c_next', COLOR_NAMES, 'orange', 'Колір: наступна серія / нова серія', 'Фон напису про наступну чи нову серію', restyle);
        select('lmx_c_done', COLOR_NAMES, 'green', 'Колір: вийшов / завершено', 'Фон напису про вихід фільму чи завершення серіалу', restyle);
        select('lmx_c_soon', COLOR_NAMES, 'blue', 'Колір: очікується', 'Фон напису для ще не випущеного', restyle);
        trigger('lmx_market', true, 'Підбірки для українського ринку', 'Лише те, що доступне в Україні, і з описом українською/вашою мовою. Без цього — світова добірка', restart);
        select('lmx_min_rating', { '0': 'Не ховати', '3': 'Ховати з оцінкою 1–2', '4': 'Ховати нижче 4', '5': 'Ховати нижче 5' }, '3', 'Ховати слабкі фільми й серіали', 'У наших рядах', restart);
        trigger('lmx_hide_year', true, 'Прибрати рік на постері', 'Рік під назвою залишається', rebuild);
        trigger('lmx_replace_rating', true, 'Свій стиль рейтингу замість стандартного', 'Колір за оцінкою: зелений — високий, червоний — низький', rebuild);
        trigger('lmx_full', true, 'Сторінка фільму в кіно-стилі', 'Фон на весь екран, великий заголовок, скляні кнопки', restyle);
        trigger('lmx_btn_compact', true, 'Компактні кнопки на сторінці фільму', 'Підписи лише в перших трьох і в обраної кнопки', restyle);
        trigger('lmx_full_poster', true, 'Ховати постер на сторінці фільму', 'Лишається лише фон, як у кіно', restyle);
        trigger('lmx_info', true, 'Тривалість і статус усередині картки', 'Рядок над кнопкою «Дивитись»');
        trigger('lmx_order_classic', false, 'Простий список замість вікна порядку', 'Якщо вікно з кнопками ▲ ▼ погано прокручується — буде звичайний список Lampa');
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

    // Прибираємо слабкі (1–2 з 10) та «не перекладені» (без опису) картки
    function cleanResults(list, skipText) {
        var min = parseInt(getStr('lmx_min_rating', '3'), 10) || 0;
        var strict = market();
        return (list || []).filter(function (c) {
            if (!c) return false;
            if (min && c.vote_count > 2 && c.vote_average > 0 && c.vote_average < min) return false;
            if (strict && !skipText && !(c.overview && String(c.overview).trim())) return false;
            return true;
        });
    }

    // ===== Сторінки стрімінгів: як окремий «сайт» сервісу з десятком підбірок =====
    function prov(id) { return 'with_watch_providers=' + id + '&watch_region=UA&with_watch_monetization_types=flatrate'; }
    var PIPE = '%7C';
    // mf — фільтр для фільмів, tf — для серіалів (мережі/студії точніші за «доступно в регіоні»)
    var SVC = {
        hbo: { mf: 'with_companies=174' + PIPE + '49', tf: 'with_networks=49' + PIPE + '3186', extra: [
            { t: 'Max Originals', k: 'tv', q: 'with_networks=3186&sort_by=popularity.desc' },
            { t: 'Блокбастери Warner Bros.', k: 'movie', q: 'with_companies=174&sort_by=revenue.desc&vote_count.gte=1000' },
            { t: 'Епічні світи (фентезі)', k: 'tv', q: 'with_networks=49' + PIPE + '3186&with_genres=10765&sort_by=popularity.desc' },
            { t: 'Преміальні драми', k: 'tv', q: 'with_networks=49&with_genres=18&without_genres=10765&sort_by=popularity.desc' },
            { t: 'Доросла анімація', k: 'tv', q: 'with_networks=3186' + PIPE + '80&with_genres=16&sort_by=popularity.desc' },
            { t: 'Всесвіт DC', k: 'movie', q: 'with_companies=174&with_keywords=9715&sort_by=release_date.desc&release_date.lte={today}' }
        ] },
        netflix: { mf: prov(8), tf: 'with_networks=213', extra: [
            { t: 'Фантастика й фентезі', k: 'tv', q: 'with_networks=213&with_genres=10765&sort_by=popularity.desc' },
            { t: 'Кримінал і трилери', k: 'tv', q: 'with_networks=213&with_genres=80' + PIPE + '9648&sort_by=popularity.desc' },
            { t: 'Комедії', k: 'tv', q: 'with_networks=213&with_genres=35&sort_by=popularity.desc' },
            { t: 'Аніме й анімація', k: 'tv', q: 'with_networks=213&with_genres=16&sort_by=popularity.desc' },
            { t: 'Документальні', k: 'tv', q: 'with_networks=213&with_genres=99&sort_by=popularity.desc' }
        ] },
        apple: { mf: prov(350), tf: 'with_networks=2552', extra: [
            { t: 'Фантастика', k: 'tv', q: 'with_networks=2552&with_genres=10765&sort_by=popularity.desc' },
            { t: 'Комедії та feel-good', k: 'tv', q: 'with_networks=2552&with_genres=35&sort_by=popularity.desc' },
            { t: 'Трилери та детективи', k: 'tv', q: 'with_networks=2552&with_genres=9648' + PIPE + '80&sort_by=popularity.desc' },
            { t: 'Драми', k: 'tv', q: 'with_networks=2552&with_genres=18&sort_by=popularity.desc' }
        ] },
        amazon: { mf: prov(119), tf: 'with_networks=1024', extra: [
            { t: 'Фантастика й фентезі', k: 'tv', q: 'with_networks=1024&with_genres=10765&sort_by=popularity.desc' },
            { t: 'Бойовики й трилери', k: 'tv', q: 'with_networks=1024&with_genres=10759' + PIPE + '80&sort_by=popularity.desc' },
            { t: 'Комедії', k: 'tv', q: 'with_networks=1024&with_genres=35&sort_by=popularity.desc' },
            { t: 'Драми', k: 'tv', q: 'with_networks=1024&with_genres=18&sort_by=popularity.desc' }
        ] },
        disney: { mf: 'with_companies=2' + PIPE + '3' + PIPE + '420' + PIPE + '1', tf: 'with_networks=2739', extra: [
            { t: 'Marvel', k: 'movie', q: 'with_companies=420&sort_by=popularity.desc' },
            { t: 'Зоряні війни', k: 'movie', q: 'with_companies=1&sort_by=popularity.desc' },
            { t: 'Pixar', k: 'movie', q: 'with_companies=3&sort_by=popularity.desc' },
            { t: 'Серіали Marvel і Зоряних війн', k: 'tv', q: 'with_networks=2739&with_genres=10765&sort_by=popularity.desc' },
            { t: 'Анімація', k: 'tv', q: 'with_networks=2739&with_genres=16&sort_by=popularity.desc' }
        ] },
        paramount: { mf: 'with_companies=4', tf: 'with_networks=4330', extra: [
            { t: 'Paramount Pictures', k: 'movie', q: 'with_companies=4&sort_by=popularity.desc' },
            { t: 'Фантастика й фентезі', k: 'tv', q: 'with_networks=4330&with_genres=10765&sort_by=popularity.desc' },
            { t: 'Драми', k: 'tv', q: 'with_networks=4330&with_genres=18&sort_by=popularity.desc' },
            { t: 'Реаліті', k: 'tv', q: 'with_networks=4330&with_genres=10764&sort_by=popularity.desc' }
        ] },
        sky: { mf: prov(1773), tf: prov(1773), extra: [
            { t: 'Драми', k: 'tv', q: prov(1773) + '&with_genres=18&sort_by=popularity.desc' },
            { t: 'Комедії', k: 'tv', q: prov(1773) + '&with_genres=35&sort_by=popularity.desc' },
            { t: 'Фантастика й фентезі', k: 'tv', q: prov(1773) + '&with_genres=10765&sort_by=popularity.desc' }
        ] }
    };
    function svcCats(key) {
        var c = SVC[key], today = dayStr(0), out = [];
        if (!c) return out;
        out.push({ t: 'Нові фільми', k: 'movie', q: c.mf + '&sort_by=primary_release_date.desc&primary_release_date.lte=' + today + '&vote_count.gte=10' });
        out.push({ t: 'Нові серіали', k: 'tv', q: c.tf + '&sort_by=first_air_date.desc&first_air_date.lte=' + today + '&vote_count.gte=5' });
        out.push({ t: 'Головні хіти', k: 'tv', q: c.tf + '&sort_by=popularity.desc' });
        out.push({ t: 'Популярні фільми', k: 'movie', q: c.mf + '&sort_by=popularity.desc&vote_count.gte=50' });
        c.extra.forEach(function (e) { out.push(e); });
        out.push({ t: 'Золота колекція (найвищий рейтинг)', k: 'tv', q: c.tf + '&sort_by=vote_average.desc&vote_average.gte=7.8&vote_count.gte=300' });
        return out.map(function (e) {
            return { title: e.t, url: 'discover/' + e.k + '?' + e.q.replace('{today}', today), kind: e.k };
        });
    }

    // Ряд на головній: свіжі фільми й серіали сервісу разом, від найновіших
    function serviceCall(row, key) {
        return function (call) {
            var cats = svcCats(key), pick = [cats[0], cats[1]];
            var got = [null, null], left = 2;
            function fin() {
                if (--left > 0) return;
                var all = [];
                [0, 1].forEach(function (i) {
                    (got[i] || []).forEach(function (c) { c.media_type = pick[i].kind; all.push(c); });
                });
                all.sort(function (a, b) {
                    return String(b.release_date || b.first_air_date || '').localeCompare(String(a.release_date || a.first_air_date || ''));
                });
                all = all.slice(0, 20);
                if (!all.length) return call();
                call({ title: row.title, results: all, url: pick[1].url, source: 'tmdb', page: 1, more: true, total_pages: 2 });
            }
            pick.forEach(function (cat, i) {
                Lampa.Api.sources.tmdb.get(cat.url, { page: 1 }, function (j) {
                    got[i] = cleanResults(j && j.results, true).filter(function (c) { return c.poster_path; });
                    fin();
                }, function () { got[i] = []; fin(); });
            });
        };
    }

    // Окрема сторінка сервісу (компонент Lampa)
    var svcRegistered = false;
    function registerServicePage() {
        if (svcRegistered || !Lampa.Component || !Lampa.Component.add || !Lampa.InteractionMain) return;
        svcRegistered = true;
        Lampa.Component.add('lmx_service', function (object) {
            var comp = new Lampa.InteractionMain(object);
            comp.create = function () {
                var self = this;
                this.activity.loader(true);
                var cats = svcCats(object.service_id), res = new Array(cats.length), left = cats.length;
                function fin() {
                    if (--left > 0) return;
                    var data = [];
                    cats.forEach(function (c, i) {
                        if (res[i] && res[i].length) {
                            data.push({ title: c.title, results: res[i], url: c.url, source: 'tmdb', page: 1, total_pages: 5 });
                        }
                    });
                    self.activity.loader(false);
                    if (!data.length) self.empty(); else self.build(data);
                }
                if (!cats.length) { self.activity.loader(false); self.empty(); return this.render(); }
                cats.forEach(function (c, i) {
                    Lampa.Api.sources.tmdb.get(c.url, { page: 1 }, function (j) {
                        res[i] = cleanResults(j && j.results, true).filter(function (x) { return x.poster_path; });
                        fin();
                    }, function () { res[i] = []; fin(); });
                });
                return this.render();
            };
            comp.onMore = function (data) {
                Lampa.Activity.push({ url: data.url, title: data.title || 'Ще', component: 'category_full', source: 'tmdb', page: 1 });
            };
            return comp;
        });
    }

    // ===== Банер і плитки стрімінгів (власні картки Lampa.Maker) =====
    function imgUrl(path, size) {
        try { if (Lampa.TMDB && Lampa.TMDB.image) return Lampa.TMDB.image('t/p/' + size + path); } catch (e) {}
        return 'https://image.tmdb.org/t/p/' + size + path;
    }
    function makeInstance(d) {
        return Lampa.Maker.make('Card', d, function (module) { return module.only('Card', 'Callback'); });
    }
    function htmlOf(inst, extra) {
        var h = (inst && inst.html) || (extra && extra.html) || extra;
        if (!h) return null;
        if (h.jquery) return h;
        return (window.$ && h.nodeType) ? window.$(h) : null;
    }
    function openFull(m) {
        Lampa.Activity.push({
            url: '', component: 'full', id: m.id, method: (m.media_type === 'tv' || m.name) ? 'tv' : 'movie',
            card: m, source: 'tmdb'
        });
    }
    function esc(t) { return String(t || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    var HERO_TITLES = { mix: 'У тренді', cinema: 'Зараз у кінотеатрах', fresh: 'Нове й найкраще' };
    // Що показувати у банері: тренди тижня (фільми й серіали), кінотеатри або свіже з високим рейтингом
    function heroSources(src) {
        var today = dayStr(0);
        if (src === 'cinema') return [['movie/now_playing?region=UA', 'movie', 1]];
        if (src === 'fresh') return [
            ['discover/movie?sort_by=popularity.desc&primary_release_date.gte=' + dayStr(-75) + '&primary_release_date.lte=' + today + '&vote_average.gte=6.5&vote_count.gte=80', 'movie', 1],
            ['discover/tv?sort_by=popularity.desc&first_air_date.gte=' + dayStr(-120) + '&first_air_date.lte=' + today + '&vote_average.gte=7&vote_count.gte=40', 'tv', 1]
        ];
        return [['trending/all/week', '', 1], ['movie/now_playing?region=UA', 'movie', 1]];
    }

    function heroCall(row) {
        return function (call) {
            var src = getStr('lmx_hero_src', 'mix');
            var srcs = heroSources(src), left = srcs.length, all = [], seenIds = {};
            function fin() {
                if (--left > 0) return;
                var list = all.filter(function (m) {
                    if (!m.backdrop_path || seenIds[m.id]) return false;
                    if (m.media_type === 'person') return false;
                    if (!(m.overview && String(m.overview).trim())) return false;
                    if (m.vote_count > 30 && m.vote_average < 6.3) return false;
                    seenIds[m.id] = 1;
                    return true;
                });
                list.sort(function (a, b) { return (b.popularity || 0) - (a.popularity || 0); });
                list = list.slice(0, 12);
                if (!list.length) return call();
                var items = list.map(function (m) {
                    var it = {};
                    for (var k in m) it[k] = m[k];
                    it.params = {
                        createInstance: makeInstance,
                        emit: {
                            onCreate: function () {
                                var self = this, ex = arguments[0];
                                safe(function () {
                                    var h = htmlOf(self, ex);
                                    if (!h) return;
                                    h.addClass('card--lmxhero');
                                    var view = h.find('.card__view');
                                    view.css('background-image', 'url(' + imgUrl(m.backdrop_path, 'w500') + ')');
                                    view.find('img').css('opacity', 0);
                                    h.find('.card__title,.card__age,.card__vote').remove();
                                    var v = Number(m.vote_average) || 0;
                                    var isTv = m.media_type === 'tv' || (!m.title && m.name);
                                    var year = String(m.release_date || m.first_air_date || '').slice(0, 4);
                                    var ov = String(m.overview || '');
                                    if (ov.length > 120) ov = ov.slice(0, 117).replace(/\s+\S*$/, '') + '…';
                                    view.append('<div class="lmx-hero__shade"></div><div class="lmx-hero__text"><div class="lmx-hero__title">' +
                                        esc(m.title || m.name) + '</div><div class="lmx-hero__meta">' +
                                        (v ? '<span class="lmx-hero__v">' + v.toFixed(1) + '</span>' : '') +
                                        '<span>' + (isTv ? 'Серіал' : 'Фільм') + '</span>' + (year ? '<span>' + year + '</span>' : '') +
                                        '</div><div class="lmx-hero__o">' + esc(ov) + '</div></div>');
                                });
                            },
                            onlyEnter: function () { openFull(m); }
                        }
                    };
                    return it;
                });
                call({ title: HERO_TITLES[src] || HERO_TITLES.mix, results: items, params: { items: { mapping: 'line', view: 15 } } });
            }
            srcs.forEach(function (x) {
                Lampa.Api.sources.tmdb.get(x[0], { page: 1 }, function (j) {
                    (j && j.results || []).forEach(function (m) { if (x[1] && !m.media_type) m.media_type = x[1]; all.push(m); });
                    fin();
                }, function () { fin(); });
            });
        };
    }

    var PROV_COLORS = { 8: '#c8102e', 350: '#1d1d1f', 1899: '#5b2bd0', 119: '#0f79af', 337: '#0b2a6b', 531: '#0064ff', 1773: '#6a1b9a' };
    function studioCall(row) {
        return function (call) {
            var logos = {};
            function done() {
                var items = SERVICES.map(function (x) {
                    return {
                        id: 'lmxstudio' + x[2], title: x[1], params: {
                            createInstance: makeInstance,
                            emit: {
                                onCreate: function () {
                                    var self = this, ex = arguments[0];
                                    safe(function () {
                                        var h = htmlOf(self, ex);
                                        if (!h) return;
                                        h.addClass('card--lmxstudio');
                                        var view = h.find('.card__view');
                                        view.css('background-color', PROV_COLORS[x[2]] || '#2a2f3d');
                                        view.find('img').css('opacity', 0);
                                        h.find('.card__title,.card__age,.card__vote').remove();
                                        var lg = logos[x[2]];
                                        view.append(lg ? '<img class="lmx-studio__logo" src="' + imgUrl(lg, 'w154') + '">' :
                                            '<div class="lmx-studio__name">' + esc(x[1]) + '</div>');
                                    });
                                },
                                onlyEnter: function () { openService(x); }
                            }
                        }
                    };
                });
                call({ title: row.title, results: items, params: { items: { mapping: 'line', view: 15 } } });
            }
            Lampa.Api.sources.tmdb.get('watch/providers/movie?watch_region=UA', {}, function (j) {
                ((j && j.results) || []).forEach(function (p) { logos[p.provider_id] = p.logo_path; });
                done();
            }, function () { done(); });
        };
    }
    function openService(x) {
        registerServicePage();
        Lampa.Activity.push({ url: '', title: x[1], component: 'lmx_service', service_id: x[0], page: 1 });
    }

    function makeCall(row) {
        if (row.custom) return function () { return row.custom(); };
        return function () {
            return function (call) {
                var urls = typeof row.urls === 'function' ? row.urls() : [row.url];
                var best = null, i = 0;
                function done() {
                    if (best && best.list.length) {
                        call({ title: row.title, results: best.list, url: best.url, source: 'tmdb', page: 1, more: true, total_pages: Math.max(best.pages, 2) });
                    } else call();
                }
                function next() {
                    if (i >= urls.length) return done();
                    var url = urls[i++];
                    Lampa.Api.sources.tmdb.get(url, { page: 1 }, function (json) {
                        var list = cleanResults(json && json.results, row.ua);
                        if (list.length && (!best || list.length > best.list.length)) best = { list: list, url: url, pages: json.total_pages || 1 };
                        if (best && best.list.length >= (row.minCount || 1)) return done();
                        next();
                    }, function () { next(); });
                }
                next();
            };
        };
    }

    function initRows() {
        if (rowsStarted) return;
        rowsStarted = true;
        registerServicePage();
        if (!Lampa.ContentRows || !Lampa.ContentRows.add) return;
        ROWS.forEach(function (row) {
            if (row.gate && !getBool(row.gate, true)) return;
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
    var MAX_PARALLEL = 3;
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
        var fa = dayDiff(j.first_air_date);
        var planned = j.status === 'Planned' || j.status === 'In Production' || j.status === 'Pilot';
        if ((fa !== null && fa > 0) || (planned && !j.last_episode_to_air && fa === null)) return { t: 'Скоро', c: 'soon' };
        return null;
    }
    function movieMark(d) {
        var n = dayDiff(d.release_date);
        if (n !== null && n <= 0 && n >= -30) return { t: 'Новинка', c: 'new' };
        if (n !== null && n > 0) return { t: 'Скоро', c: 'soon' };
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
        var nSoon = RGB[getStr('lmx_c_soon', 'blue')] ? getStr('lmx_c_soon', 'blue') : 'blue';

        var pill;
        if (st === 'glass') {
            pill = 'background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.38);';
        } else if (st === 'minimal') {
            pill = 'background:none;padding:.1em .2em;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.8);';
        } else {
            pill = 'background:rgba(0,0,0,.62);';
        }
        var ringBg = st === 'glass' ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.62)';
        function markCss(cls, nm) {
            var sel = '.lmx-pill.lmx-m-' + cls;
            if (st === 'cinema') return sel + '{background:' + rgba(nm, 0.62) + ';border:1px solid ' + rgba(nm, 0.9) + '}';
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
            markCss('next', nNext) + markCss('new', 'purple') + markCss('soon', nSoon) +
            '.lmx-ord__row{display:flex;align-items:center;padding:.45em .7em;border-radius:.5em}' +
            '.lmx-ord__row:nth-child(even){background:rgba(255,255,255,.06)}' +
            '.lmx-ord__name{flex:1;min-width:0;font-size:1.15em}' +
            '.lmx-ord__sub{display:block;font-size:.7em;opacity:.55;margin-top:.15em}' +
            '.lmx-ord__btn{display:flex;align-items:center;justify-content:center;width:2.6em;height:2.6em;margin-left:.3em;border-radius:.5em}' +
            '.lmx-ord__btn.focus{background:#fff;color:#000}' +
            '.lmx-ord__off{opacity:.5}' +
            '.lmx-ord__reset{margin-top:.8em;padding:.8em 1em;border-radius:.5em;text-align:center;background:rgba(255,255,255,.08)}' +
            '.lmx-ord__reset.focus{background:#fff;color:#000}' +
            '.lmx-ring{position:relative;display:inline-block;width:2.8em;height:2.8em;font-size:' + fs + 'em;border-radius:50%;background:' + ringBg + '}' +
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
            '.lmx-ip.lmx-bad{background:' + COLORS.red + '}' +
            (st === 'cinema' ?
                '.lmx-stripe,.lmx-br,.lmx-bl{display:none !important}' +
                '.lmx-tr .lmx-pill,.lmx-box .lmx-pill{font-size:' + (0.72 * fs).toFixed(2) + 'em;padding:.28em .6em;border-radius:.55em;font-weight:500;letter-spacing:.02em}' +
                '.lmx-box .lmx-pill{background:rgba(30,32,40,.7);border:1px solid rgba(255,255,255,.32)}' +
                '.card .card__title,.card .card__age,.card .card__vote{display:none !important}' +
                '.lmx-cin{position:absolute;left:0;right:0;bottom:0;padding:2.2em .7em .6em;color:#fff;z-index:2;pointer-events:none;border-radius:0 0 1em 1em;' +
                    'background:linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.7) 45%,rgba(0,0,0,0) 100%)}' +
                '.lmx-cin__g{font-size:' + (0.72 * fs).toFixed(2) + 'em;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                '.lmx-cin__t{font-size:' + (1.15 * fs).toFixed(2) + 'em;font-weight:600;line-height:1.15;margin:.15em 0 .35em;max-height:3.5em;overflow:hidden}' +
                '.lmx-cin__r{display:flex;justify-content:space-between;align-items:center;font-size:' + (0.9 * fs).toFixed(2) + 'em}' +
                '.lmx-cin__v i{font-style:normal}.lmx-cin__y{opacity:.85}' : '') +
            (getStr('lmx_card_size', 'm') !== 'm' ?
                '.items-line .card:not(.card--lmxhero):not(.card--lmxstudio){width:' + (getStr('lmx_card_size', 'm') === 'xl' ? '19.5em' : '17em') + ' !important}' : '') +
            fullCss() +
            '.card--lmxhero.focus .card__view,.card--lmxstudio.focus .card__view{box-shadow:0 0 0 .22em #fff !important}' +
            '.card--lmxhero.focus .card__view::after,.card--lmxstudio.focus .card__view::after{display:none !important}' +
            '.lmx-hero__o{font-size:.85em;opacity:.85;margin-top:.35em;line-height:1.3;max-height:2.7em;overflow:hidden}' +
            '.card--lmxhero{width:' + (getStr('lmx_card_size', 'm') === 'xl' ? '38em' : getStr('lmx_card_size', 'm') === 'l' ? '34em' : '30em') + ' !important}' +
            '.card--lmxhero .card__view{padding-bottom:0 !important;height:15em;background-size:cover;background-position:center;border-radius:.8em;overflow:hidden;position:relative}' +
            '.lmx-hero__shade{position:absolute;left:0;right:0;bottom:0;height:70%;background:linear-gradient(to top,rgba(0,0,0,.85),rgba(0,0,0,0))}' +
            '.lmx-hero__text{position:absolute;left:1em;right:1em;bottom:.8em;color:#fff}' +
            '.lmx-hero__title{font-size:1.5em;font-weight:600;line-height:1.15;margin-bottom:.35em}' +
            '.lmx-hero__meta{display:flex;gap:.6em;font-size:1em;opacity:.95;align-items:center}' +
            '.lmx-hero__v{background:' + COLORS.green + ';padding:.15em .5em;border-radius:.4em}' +
            '.card--lmxstudio{width:13em !important}' +
            '.card--lmxstudio .card__view{padding-bottom:0 !important;height:6.5em;border-radius:.8em;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}' +
            '.lmx-studio__logo{width:3.6em;height:3.6em;border-radius:.6em;object-fit:cover}' +
            '.lmx-studio__name{color:#fff;font-size:1.3em;font-weight:600;text-align:center;padding:0 .4em}';
    }
    // Сторінка фільму/серіалу в кіно-стилі: фон на весь екран, затемнення, великий заголовок, скляні кнопки
    function fullCss() {
        var B = 'body.lmx-full ';
        var compact = getBool('lmx_btn_compact', true);
        return '' +
            B + '.full-start-new__body{position:relative;height:84vh;padding-bottom:3vh;box-sizing:border-box;' +
                'background-image:linear-gradient(to right,rgba(0,0,0,.82) 0%,rgba(0,0,0,.5) 40%,rgba(0,0,0,0) 70%),linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.55) 25%,rgba(0,0,0,0) 60%)}' +
            B + '.full-start-new__right{display:flex;flex-direction:column;justify-content:flex-end;max-width:56%}' +
            B + '.full-start-new__reactions,' + B + '.full-start-new .reaction__count{display:none !important}' +
            B + '.full-start-new__title{font-size:3em;line-height:1.05;font-weight:700;text-shadow:0 2px 10px rgba(0,0,0,.6)}' +
            B + '.full-start-new__tagline{font-size:1.05em;opacity:.8;margin-top:.3em}' +
            B + '.full-start-new__rate-line{margin:.9em 0 .8em 0}' +
            B + '.full-start-new__details{margin:0 0 .8em -0.3em}' +
            B + '.full-start__background{opacity:.55 !important}' +
            B + '.lmx-descr{position:absolute;right:2%;top:11%;width:30vw;font-size:1.05em;line-height:1.5;z-index:2;color:#fff;' +
                'background:rgba(0,0,0,.45);padding:.9em 1.1em;border-radius:1em;' +
                'display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}' +
            // кнопки: компактно, у кілька рядків без розтягування
            B + '.full-start-new__buttons{display:flex;flex-wrap:wrap;margin-top:.4em}' +
            B + '.full-start__button,' + B + '.full-start-new__buttons .simple-button{background:rgba(255,255,255,.14);border-radius:.8em;margin:0 .5em .5em 0;padding:.55em 1em;font-size:.95em}' +
            B + '.full-start__button.focus,' + B + '.full-start-new__buttons .simple-button.focus{background:#fff;color:#111}' +
            (compact ?
                // підписи показуємо лише у перших трьох кнопок і в тієї, що у фокусі — решта лишається іконками
                B + '.full-start-new__buttons > .full-start__button:nth-child(n+4) span{display:none}' +
                B + '.full-start-new__buttons > .full-start__button:nth-child(n+4).focus span{display:inline}' : '') +
            B + '.lmx-info .lmx-ip{background:rgba(255,255,255,.14)}' +
            (getBool('lmx_full_poster', true) ? B + '.full-start-new__left{display:none !important}' : '');
    }
    function applyFullClass() {
        var on = getBool('lmx_full', true);
        if (document.body && document.body.classList) document.body.classList.toggle('lmx-full', on);
    }

    function applyStyle() {
        safe(applyFullClass);
        var s = document.getElementById('lmx-css');
        if (!s) {
            s = document.createElement('style');
            s.id = 'lmx-css';
            document.head.appendChild(s);
        }
        s.textContent = buildCss();
    }

    // ===== Пошук даних картки (кілька способів, бо внутрішності Lampa різняться між версіями) =====
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
        return !!(n.closest && n.closest('.lmx-box,.lmx-bl,.lmx-br,.lmx-tr,.lmx-cin'));
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

    var GENRES = { 28: 'Бойовик', 12: 'Пригоди', 16: 'Мультфільм', 35: 'Комедія', 80: 'Кримінал', 99: 'Документальний', 18: 'Драма', 10751: 'Сімейний',
        14: 'Фентезі', 36: 'Історія', 27: 'Жахи', 10402: 'Музика', 9648: 'Детектив', 10749: 'Мелодрама', 878: 'Фантастика', 10770: 'ТВ-фільм',
        53: 'Трилер', 10752: 'Військовий', 37: 'Вестерн', 10759: 'Бойовик', 10762: 'Дитячий', 10763: 'Новини', 10764: 'Реаліті',
        10765: 'Фантастика', 10766: 'Мильна опера', 10767: 'Ток-шоу', 10768: 'Війна і політика' };
    function genresOf(d) {
        var ids = d.genre_ids || (d.genres || []).map(function (g) { return g.id; }) || [];
        var out = [];
        for (var i = 0; i < ids.length && out.length < 2; i++) { var n = GENRES[ids[i]]; if (n && out.indexOf(n) < 0) out.push(n); }
        return out.join(', ');
    }
    function cinemaOverlay(view, d, type) {
        if (view.querySelector('.lmx-cin')) return;
        var v = Number(d.vote_average) || 0;
        var year = String(d.release_date || d.first_air_date || '').slice(0, 4);
        var g = genresOf(d);
        var title = d.title || d.name || '';
        var html = '<div class="lmx-cin__g">' + esc(type === 'tv' ? ('Серіал' + (g ? ' · ' + g : '')) : g) + '</div>' +
            '<div class="lmx-cin__t">' + esc(title) + '</div>' +
            '<div class="lmx-cin__r">' +
            (v > 0 ? '<span class="lmx-cin__v" style="color:' + ratingColor(v) + '"><i>&#9734;</i> ' + v.toFixed(1) + '</span>' : '<span></span>') +
            '<span class="lmx-cin__y">' + year + '</span></div>';
        addTo(view, 'lmx-cin', html);
    }

    // Рейтинг, мітка Фільм/Серіал (лише якщо її немає), для фільмів ще мітка «Новинка» і смужка
    function extras(el, d, type) {
        var view = el.querySelector('.card__view');
        if (!view) return;
        var v = Number(d.vote_average) || 0;

        hideLeaves(view, RE_NATIVE_TV);

        if (getStr('lmx_style', 'classic') === 'cinema') {
            // стандартні підписи ховає CSS (без обчислень у JS — так легше для ТВ)
            cinemaOverlay(view, d, type);
            if (type === 'movie') addMark(view, movieMark(d));
            return;
        }

        if (v > 0) {
            var ratingLeaf = findLeaf(view, RE_RATING);
            var has = !!view.querySelector('.lmx-br');
            if (ratingLeaf && getBool('lmx_replace_rating', true)) {
                // стандартний рейтинг міг з'явитися пізніше за наш — тоді ховаємо його
                hideEl(pillOf(ratingLeaf, view));
                if (!has) addTo(view, 'lmx-br', ratingHtml(v));
            } else if (!ratingLeaf && !has) {
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

    // Відкладена робота над картками: невеликими порціями, щоб не гальмувати підвантаження списків
    var work = [], workTimer = null;
    function addWork(job) {
        work.push(job);
        if (!workTimer) workTimer = setTimeout(runWork, 30);
    }
    function runWork() {
        workTimer = null;
        var now = Date.now(), left = [], done = 0;
        for (var i = 0; i < work.length; i++) {
            var j = work[i];
            if (j.due > now || (!j.fast && done >= 6)) { left.push(j); continue; }
            if (!j.fast) done++;
            if (document.body.contains(j.el)) safe(j.fn);
        }
        work = left;
        if (work.length) workTimer = setTimeout(runWork, 120);
    }

    var pumpTimer = null;
    function pumpSoon() {
        if (pumpTimer) return;
        pumpTimer = setTimeout(function () { pumpTimer = null; pump(); }, 60);
    }
    function pump() {
        while (active < MAX_PARALLEL && queue.length) {
            (function (task) {
                active++;
                load(task.id, function (j) {
                    active--;
                    if (j) renderTv(task.el, j);
                    if (queue.length) setTimeout(pump, 120);
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
        pumpSoon();
    }, { rootMargin: '300px' }) : null;

    function scan() {
        var cards = document.querySelectorAll('.card:not([data-lmx])');
        cards.forEach(function (el) {
            el.setAttribute('data-lmx', '1');
            if (el.classList.contains('card--lmxhero') || el.classList.contains('card--lmxstudio')) return;
            found++;

            if (getBool('lmx_hide_year', true) && getStr('lmx_style', 'classic') !== 'cinema') {
                hideYear(el);
                addWork({ el: el, fast: !el.closest('.category-full'), due: Date.now() + 700, fn: function () { hideYear(el); } });
            }

            var d = getData(el);
            if (!d) return;
            withData++;
            var type = typeOf(d);

            // Головна — майже одразу; екран «Ще» (довгі списки) — легше й із затримкою
            var fast = !el.closest('.category-full');
            addWork({ el: el, fast: fast, due: Date.now() + (fast ? 0 : 700), fn: function () { extras(el, d, type); } });

            if (type === 'tv') {
                var task = { el: el, id: d.id };
                if (io) { el.__lmx = task; io.observe(el); }
                else { queue.push(task); }
            }
        });
        if (!io) pumpSoon();
        if (getBool('lmx_debug', false) && cards.length && Lampa.Noty) {
            Lampa.Noty.show('lmx: карток ' + found + ', з даними ' + withData + ', значків ' + rendered);
        }
    }

    var timer = null;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(function () { safe(scan); }, 120);
    }

    // після зміни стилю: прибрати наші елементи, показати сховане, перемалювати
    function resetCards() {
        hiddenEls.forEach(function (e) { e.style.display = ''; });
        hiddenEls = [];
        var mine = document.querySelectorAll('.lmx-box,.lmx-bl,.lmx-br,.lmx-tr,.lmx-stripe,.lmx-cin');
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
        var m = e.data && e.data.movie;
        if (!m) return;
        var r = e.object.activity.render();

        // опис у правому верхньому куті (копія, оригінал нижче лишається)
        if (getBool('lmx_full', true)) {
            r.find('.lmx-descr').remove();
            var txt = String(m.overview || '').trim();
            var body = r.find('.full-start-new__body').eq(0);
            if (txt && body.length) body.append($('<div class="lmx-descr"></div>').text(txt));
        }

        if (!getBool('lmx_info', true)) return;
        var pills = infoPills(m);
        if (!pills.length) return;

        r.find('.lmx-info').remove();

        var html = '<div class="lmx-info">' + pills.map(function (x) {
            return '<div class="lmx-ip ' + (x.c || '') + '">' + x.t + '</div>';
        }).join('') + '</div>';

        var anchor = r.find('.full-start-new__buttons, .full-start__buttons').eq(0);
        if (anchor.length) anchor.before(html);
        else r.find('.full-start-new__right, .full-start__right').eq(0).append(html);
    }

    // ===== Запуск =====
    // Перехоплення ставимо одразу при завантаженні, щоб побачити ряди, які додадуться пізніше
    // Одноразово при оновленні до цієї версії — повертаємо порядок рядів за замовчуванням
    var VERSION = '2.9';
    safe(function () {
        var prev = String(Lampa.Storage.get('lmx_ver', '') || '');
        if (prev < '2.1') {
            Lampa.Storage.set('lmx_order', []);
            Lampa.Storage.set('lmx_hidden', []);
        }
        if (prev !== VERSION) Lampa.Storage.set('lmx_ver', VERSION);
    });
    safe(patchContentRows);

    function start() {
        safe(patchContentRows);
        safe(addSettings);
        safe(initRows);
        safe(function () {
            applyStyle();
            new MutationObserver(function (muts) {
                // реагуємо лише коли додались картки, а не на кожну зміну сторінки
                for (var i = 0; i < muts.length; i++) {
                    var add = muts[i].addedNodes;
                    for (var k = 0; k < add.length; k++) {
                        var n = add[k];
                        if (n.nodeType === 1 && ((n.classList && n.classList.contains('card')) || (n.querySelector && n.querySelector('.card')))) { schedule(); return; }
                    }
                }
            }).observe(document.body, { childList: true, subtree: true });
            scan();
            Lampa.Listener.follow('full', function (e) { safe(function () { onFull(e); }); });
        });
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') start();
    });
})();
