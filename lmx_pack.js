/*
 * LMX Pack v1.2 — надбудова для Lampa, що працює РАЗОМ з плагіном «Ліхтар» (не замінює його).
 *  1) Додаткові ряди на головній (TMDB + українське кіно та серіали): кожен ряд вмикається окремо, позиція налаштовується
 *  2) Значок С3Е24, мітка Фільм/Серіал, рейтинг із кольором за оцінкою, прибирання року
 *  3) Тривалість («1 год 45 хв») і кольоровий статус виходу всередині картки
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
    function safe(fn) {
        try { fn(); } catch (e) { console.error('LMX', e); }
    }

    var COLORS = {
        green:  'rgba(46,158,91,.94)',
        orange: 'rgba(224,123,32,.96)',
        blue:   'rgba(48,112,220,.92)',
        red:    'rgba(192,57,43,.94)',
        purple: 'rgba(130,80,200,.92)',
        gray:   'rgba(110,110,120,.92)'
    };
    var COLOR_NAMES = { green: 'Зелений', orange: 'Помаранчевий', blue: 'Синій', red: 'Червоний', purple: 'Фіолетовий', gray: 'Сірий' };
    var SIZES = { s: 0.8, m: 0.95, l: 1.1, xl: 1.25 };
    var SIZE_NAMES = { s: 'Маленький', m: 'Середній', l: 'Великий', xl: 'Дуже великий' };

    // ===== РЯДИ (значення за замовчуванням) =====
    function uaUrl(kind) {
        var q = getStr('lmx_ua_mode', 'lang') === 'country' ? 'with_origin_country=UA' : 'with_original_language=uk';
        return 'discover/' + kind + '?' + q + '&sort_by=popularity.desc';
    }
    var ROWS = [
        { name: 'LmxPopularMovies', title: 'Популярні фільми',    url: 'movie/popular',     index: 2 },
        { name: 'LmxNowPlaying',    title: 'Зараз у кінотеатрах', url: 'movie/now_playing', index: 3 },
        { name: 'LmxUpcoming',      title: 'Скоро вийдуть',       url: 'movie/upcoming',    index: 4 },
        { name: 'LmxTopMovies',     title: 'Найвищий рейтинг',    url: 'movie/top_rated',   index: 5 },
        { name: 'LmxPopularTv',     title: 'Популярні серіали',   url: 'tv/popular',        index: 6 },
        { name: 'LmxUaMovies',      title: 'Українське кіно',     url: function () { return uaUrl('movie'); }, index: 7 },
        { name: 'LmxUaTv',          title: 'Українські серіали',  url: function () { return uaUrl('tv'); },    index: 8 }
    ];

    var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';

    // ===== СТОРІНКА НАЛАШТУВАНЬ =====
    function addSettings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;

        S.addComponent({ component: 'lmx', name: 'LMX Pack', icon: ICON });

        function title(id, text) {
            S.addParam({ component: 'lmx', param: { name: id, type: 'title', default: '' }, field: { name: text } });
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

        // --- Ряди ---
        title('lmx_t_rows', 'Ряди на головній (зміни — після перезапуску Lampa)');
        var POS = {};
        for (var i = 0; i <= 20; i++) POS[String(i)] = i === 0 ? '0 (найвище)' : String(i);

        ROWS.forEach(function (row) {
            trigger('lmx_on_' + row.name, true, row.title, 'Показувати цей ряд на головній', restart);
            select('lmx_row_' + row.name, POS, String(row.index), '   ↳ позиція ряду «' + row.title + '»',
                'Ряди Ліхтаря теж мають номери, тож пробуйте різні', restart);
        });
        select('lmx_ua_mode', {
            lang: 'Мова оригіналу — українська',
            country: 'Країна виробництва — Україна'
        }, 'lang', 'Що вважати «українським»',
            'Мова оригіналу точніша. Країна виробництва додає також російськомовні проєкти українського виробництва', restart);

        // --- Вигляд карток ---
        title('lmx_t_cards', 'Вигляд карток');
        select('lmx_size', SIZE_NAMES, 'm', 'Розмір написів на постерах', 'Значки, рейтинг, мітка Фільм/Серіал', restyle);
        trigger('lmx_badge', true, 'Значок С3Е24 на серіалах', 'Сезони та серії в лівому верхньому куті');
        trigger('lmx_type', true, 'Мітка Фільм/Серіал', 'Внизу ліворуч, якщо її ще немає на картці');
        trigger('lmx_rating', true, 'Рейтинг на картках', 'Додає рейтинг там, де його ще немає');
        trigger('lmx_rate_color', true, 'Колір рейтингу за оцінкою', 'Зелений — високий, жовтий і помаранчевий — середній, червоний — низький', restyle);
        trigger('lmx_recolor', true, 'Перефарбувати рейтинг Ліхтаря', 'Застосувати колір за оцінкою й до рейтингу, який малює Ліхтар');
        trigger('lmx_hide_year', true, 'Прибрати рік на постері', 'Рік під назвою залишається');

        // --- Кольори статусів ---
        title('lmx_t_colors', 'Кольори статусів усередині картки');
        select('lmx_c_next', COLOR_NAMES, 'orange', 'Наступна серія', 'Фон напису про дату наступної серії', restyle);
        select('lmx_c_done', COLOR_NAMES, 'green', 'Вийшов / Завершено', 'Фон напису про вихід фільму чи завершення серіалу', restyle);
        select('lmx_c_soon', COLOR_NAMES, 'blue', 'Очікується', 'Фон напису для ще не випущеного', restyle);

        // --- Додатково ---
        title('lmx_t_misc', 'Додатково');
        trigger('lmx_info', true, 'Тривалість і статус усередині картки', 'Рядок над кнопкою «Дивитись»');
        trigger('lmx_debug', false, 'Режим налагодження', 'Показує підказку з кількістю знайдених карток');
    }

    // ===== РЯДИ НА ГОЛОВНІЙ =====
    var rowsStarted = false;

    function makeCall(row) {
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
            if (!getBool('lmx_on_' + row.name, true)) return;
            var pos = getStr('lmx_row_' + row.name, String(row.index));
            if (pos === 'off') return;
            var idx = parseInt(pos, 10);
            if (isNaN(idx)) idx = row.index;
            Lampa.ContentRows.add({
                name: row.name,
                title: row.title,
                index: idx,
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

    function typeOf(d) {
        if (d.media_type === 'tv' || d.media_type === 'movie') return d.media_type;
        return (d.name || d.first_air_date || d.number_of_seasons) ? 'tv' : 'movie';
    }
    function fmtFull(s) {
        var p = String(s || '').split('-');
        return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : '';
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
    function ratingColor(v) {
        if (!getBool('lmx_rate_color', true)) return COLORS.blue;
        if (v >= 7.5) return 'rgba(46,158,91,.95)';
        if (v >= 6.5) return 'rgba(140,160,30,.95)';
        if (v >= 5.5) return 'rgba(224,123,32,.95)';
        return 'rgba(192,57,43,.95)';
    }

    function buildCss() {
        var fs = SIZES[getStr('lmx_size', 'm')] || SIZES.m;
        var cNext = COLORS[getStr('lmx_c_next', 'orange')] || COLORS.orange;
        var cDone = COLORS[getStr('lmx_c_done', 'green')] || COLORS.green;
        var cSoon = COLORS[getStr('lmx_c_soon', 'blue')] || COLORS.blue;
        return '' +
            '.lmx-box{position:absolute;left:.4em;top:.4em;z-index:3;pointer-events:none}' +
            '.lmx-bl{position:absolute;left:.4em;bottom:.4em;z-index:3;pointer-events:none}' +
            '.lmx-br{position:absolute;right:.4em;bottom:.4em;z-index:3;pointer-events:none}' +
            '.lmx-pill{display:inline-block;font-size:' + fs + 'em;line-height:1;padding:.32em .6em;border-radius:.6em;' +
            'background:rgba(0,0,0,.62);color:#fff;font-weight:600;white-space:nowrap}' +
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
        return !!(n.closest && n.closest('.lmx-box,.lmx-bl,.lmx-br'));
    }
    function findLeaf(view, re) {
        var all = view.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            if (n.children.length === 0 && n.offsetWidth > 0 && !isOurs(n) && re.test(n.textContent)) return n;
        }
        return null;
    }
    // елемент-«плашка» з фоном навколо тексту (щоб ховати/фарбувати плашку, а не лише текст)
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

    function hideYear(el) {
        var view = el.querySelector('.card__view');
        if (!view) return;
        var all = view.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            if (n.children.length === 0 && RE_YEAR.test(n.textContent) && !isOurs(n)) {
                pillOf(n, view).style.display = 'none';
            }
        }
    }

    function hideNativeTv(view) {
        var all = view.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            if (n.children.length === 0 && RE_NATIVE_TV.test(n.textContent) && !isOurs(n)) {
                pillOf(n, view).style.display = 'none';
            }
        }
    }

    // Рейтинг, мітка Фільм/Серіал — додаємо лише якщо їх ще немає; рейтинг Ліхтаря перефарбовуємо
    function extras(el, d, type) {
        var view = el.querySelector('.card__view');
        if (!view) return;
        var v = Number(d.vote_average) || 0;

        hideNativeTv(view);

        var ratingLeaf = findLeaf(view, RE_RATING);
        if (ratingLeaf) {
            if (v > 0 && getBool('lmx_rate_color', true) && getBool('lmx_recolor', true)) {
                pillOf(ratingLeaf, view).style.setProperty('background-color', ratingColor(v), 'important');
            }
        } else if (getBool('lmx_rating', true) && v > 0 && !view.querySelector('.lmx-br')) {
            var r = document.createElement('div');
            r.className = 'lmx-br';
            r.innerHTML = '<span class="lmx-pill" style="background:' + ratingColor(v) + '">' + v.toFixed(1) + '</span>';
            view.appendChild(r);
            rendered++;
        }

        if (getBool('lmx_type', true) && !findLeaf(view, RE_TYPE) && !view.querySelector('.lmx-bl')) {
            var t = document.createElement('div');
            t.className = 'lmx-bl';
            t.innerHTML = '<span class="lmx-pill">' + (type === 'tv' ? 'Серіал' : 'Фільм') + '</span>';
            view.appendChild(t);
            rendered++;
        }
    }

    function renderBadge(el, j) {
        var view = el.querySelector('.card__view');
        if (!view || view.querySelector('.lmx-box')) return;
        if (!j.number_of_seasons || !j.number_of_episodes) return;
        var box = document.createElement('div');
        box.className = 'lmx-box';
        var s = document.createElement('span');
        s.className = 'lmx-pill';
        s.textContent = code(j.number_of_seasons, j.number_of_episodes);
        box.appendChild(s);
        view.appendChild(box);
        rendered++;
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
                    if (j) renderBadge(task.el, j);
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

            if (type === 'tv' && getBool('lmx_badge', true)) {
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
                    p.push({ t: 'Наступна серія: ' + fmtFull(n.air_date) + ' (' + code(n.season_number, n.episode_number) + ')', c: 'lmx-next' });
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
                var rd = m.release_date ? ' · ' + fmtFull(m.release_date) : '';
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
    function start() {
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
