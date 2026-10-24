/*
 * LMX Pack v1.1 — надбудова для Lampa, що працює РАЗОМ з плагіном «Ліхтар» (не замінює його).
 *  1) Додаткові ряди на головній (TMDB + українське кіно та серіали), порядок налаштовується
 *  2) Значок С3Е24 на постерах серіалів, прибирання значка року, рейтинг і мітка Фільм/Серіал там, де їх немає
 *  3) Тривалість («1 год 45 хв») і статус виходу всередині картки
 *  Налаштування: Lampa → Налаштування → LMX Pack
 */
(function () {
    'use strict';

    // ===== Допоміжне: налаштування (зберігаються в Lampa.Storage) =====
    function getBool(name, def) {
        var v = Lampa.Storage.get(name, def ? 'true' : 'false');
        return v === true || v === 'true';
    }

    // ===== РЯДИ: значення за замовчуванням (змінюються в налаштуваннях Lampa) =====
    var ROWS = [
        { name: 'LmxPopularMovies', title: 'Популярні фільми',               url: 'movie/popular',     index: 2 },
        { name: 'LmxNowPlaying',    title: 'Зараз у кінотеатрах',            url: 'movie/now_playing', index: 3 },
        { name: 'LmxUpcoming',      title: 'Скоро вийдуть',                  url: 'movie/upcoming',    index: 4 },
        { name: 'LmxTopMovies',     title: 'Найвищий рейтинг',               url: 'movie/top_rated',   index: 5 },
        { name: 'LmxPopularTv',     title: 'Популярні серіали',              url: 'tv/popular',        index: 6 },
        { name: 'LmxUaMovies',      title: 'Українське кіно',                url: 'discover/movie?with_origin_country=UA&sort_by=popularity.desc', index: 7 },
        { name: 'LmxUaTv',          title: 'Українські серіали',             url: 'discover/tv?with_origin_country=UA&sort_by=popularity.desc',    index: 8 },
        { name: 'LmxUaLangMovies',  title: 'Фільми українською (оригінал)',  url: 'discover/movie?with_original_language=uk&sort_by=popularity.desc', index: 9 },
        { name: 'LmxUaLangTv',      title: 'Серіали українською (оригінал)', url: 'discover/tv?with_original_language=uk&sort_by=popularity.desc',    index: 10 }
    ];

    var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';

    function safe(fn) {
        try { fn(); } catch (e) { console.error('LMX', e); }
    }

    // ===== СТОРІНКА НАЛАШТУВАНЬ =====
    function addSettings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;

        S.addComponent({ component: 'lmx', name: 'LMX Pack', icon: ICON });

        S.addParam({
            component: 'lmx',
            param: { name: 'lmx_t_rows', type: 'title', default: '' },
            field: { name: 'Ряди на головній (потрібен перезапуск Lampa)' }
        });

        var POS = {};
        for (var i = 0; i <= 20; i++) POS[String(i)] = i === 0 ? '0 — найвище' : String(i);
        POS.off = 'Вимкнено';

        ROWS.forEach(function (row) {
            S.addParam({
                component: 'lmx',
                param: { name: 'lmx_row_' + row.name, type: 'select', values: POS, default: String(row.index) },
                field: { name: row.title, description: 'Позиція ряду. Ряди Ліхтаря теж мають номери, тож пробуйте різні. «Вимкнено» — в кінці списку.' },
                onChange: function () {
                    if (Lampa.Noty) Lampa.Noty.show('Перезапустіть Lampa, щоб змінити ряди');
                }
            });
        });

        S.addParam({
            component: 'lmx',
            param: { name: 'lmx_t_cards', type: 'title', default: '' },
            field: { name: 'Картки' }
        });

        [
            ['lmx_badge',  true,  'Значок С3Е24 на серіалах',    'Сезони та серії в лівому верхньому куті постера'],
            ['lmx_hide_year', true, 'Прибрати рік на постері',   'Рік під назвою залишається'],
            ['lmx_rating', true,  'Рейтинг, якщо його немає',    'Додає рейтинг на картки, де Ліхтар його не показав'],
            ['lmx_type',   true,  'Мітка Фільм/Серіал, якщо немає', 'Додає мітку на картки, де її немає'],
            ['lmx_info',   true,  'Тривалість і статус всередині картки', 'Рядок над кнопкою «Дивитись»'],
            ['lmx_debug',  false, 'Режим налагодження',          'Показує підказку з кількістю знайдених карток']
        ].forEach(function (p) {
            S.addParam({
                component: 'lmx',
                param: { name: p[0], type: 'trigger', default: p[1] },
                field: { name: p[2], description: p[3] }
            });
        });
    }

    // ===== РЯДИ НА ГОЛОВНІЙ =====
    var rowsStarted = false;

    function makeCall(row) {
        return function () {
            return function (call) {
                Lampa.Api.sources.tmdb.get(row.url, { page: 1 }, function (json) {
                    if (json && json.results && json.results.length) {
                        call({
                            title: row.title,
                            results: json.results,
                            url: row.url,
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
            var pos = Lampa.Storage.get('lmx_row_' + row.name, String(row.index));
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
    var RE_TYPE = /^\s*(Фільм|Фильм|Серіал|Сериал|Movie|TV|ТВ|Series)\s*$/i;

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

    function injectCss() {
        if (document.getElementById('lmx-css')) return;
        var s = document.createElement('style');
        s.id = 'lmx-css';
        s.textContent =
            '.lmx-box{position:absolute;left:.4em;top:.4em;z-index:3;pointer-events:none}' +
            '.lmx-pill{font-size:.75em;line-height:1;padding:.35em .55em;border-radius:.5em;background:rgba(0,0,0,.72);color:#fff;font-weight:600;white-space:nowrap}' +
            '.lmx-bl{position:absolute;left:.4em;bottom:.4em;z-index:3;pointer-events:none}' +
            '.lmx-br{position:absolute;right:.4em;bottom:.4em;z-index:3;pointer-events:none}' +
            '.lmx-rate{background:rgba(55,138,221,.95)}' +
            '.lmx-info{display:flex;flex-wrap:wrap;gap:.5em;margin:.8em 0}' +
            '.lmx-ip{font-size:1.1em;line-height:1;padding:.45em .8em;border-radius:.6em;background:rgba(255,255,255,.12);color:#fff}' +
            '.lmx-ok{background:rgba(30,150,80,.85)}' +
            '.lmx-soon{background:rgba(220,150,20,.9)}' +
            '.lmx-on{background:rgba(40,110,220,.88)}' +
            '.lmx-end{background:rgba(110,110,120,.88)}' +
            '.lmx-bad{background:rgba(190,50,50,.88)}';
        document.head.appendChild(s);
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

    function visibleLeaf(view, re) {
        var all = view.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            if (n.children.length === 0 && n.offsetWidth > 0 &&
                !(n.closest && n.closest('.lmx-box,.lmx-bl,.lmx-br')) && re.test(n.textContent)) return true;
        }
        return false;
    }

    function hideYear(el) {
        var view = el.querySelector('.card__view');
        if (!view) return;
        var all = view.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            if (n.children.length === 0 && RE_YEAR.test(n.textContent) && !(n.closest && n.closest('.lmx-box'))) {
                n.style.display = 'none';
            }
        }
    }

    // Рейтинг і мітка Фільм/Серіал — лише якщо їх ще немає на картці
    function extras(el, d, type) {
        var view = el.querySelector('.card__view');
        if (!view || view.querySelector('.lmx-bl,.lmx-br')) return;

        if (getBool('lmx_rating', true) && d.vote_average > 0 && !visibleLeaf(view, RE_RATING)) {
            var r = document.createElement('div');
            r.className = 'lmx-br';
            r.innerHTML = '<span class="lmx-pill lmx-rate">' + Number(d.vote_average).toFixed(1) + '</span>';
            view.appendChild(r);
            rendered++;
        }
        if (getBool('lmx_type', true) && !visibleLeaf(view, RE_TYPE)) {
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
                setTimeout(function () { hideYear(el); }, 1500);
            }

            var d = getData(el);
            if (!d) return;
            withData++;
            var type = typeOf(d);

            // даємо Ліхтарю час намалювати свої значки, потім доповнюємо
            setTimeout(function () { safe(function () { extras(el, d, type); }); }, 1600);

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
            if (st === 'Ended') p.push({ t: 'Завершено', c: 'lmx-end' });
            else if (st === 'Canceled') p.push({ t: 'Скасовано', c: 'lmx-bad' });
            else if (st === 'Returning Series') {
                var n = m.next_episode_to_air;
                if (n && n.air_date) {
                    p.push({ t: 'Наступна серія: ' + fmtFull(n.air_date) + ' (' + code(n.season_number, n.episode_number) + ')', c: 'lmx-on' });
                } else {
                    p.push({ t: 'Виходить, дата наступної серії невідома', c: 'lmx-on' });
                }
            } else if (st === 'In Production' || st === 'Planned' || st === 'Pilot') {
                p.push({ t: 'Очікується', c: 'lmx-soon' });
            }
        } else {
            if (m.runtime) p.push({ t: fmtDur(m.runtime) });

            var ms = m.status;
            if (ms === 'Released') p.push({ t: 'Вийшов', c: 'lmx-ok' });
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
            injectCss();
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
