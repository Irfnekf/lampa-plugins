/*
 * LMX Pack — надбудова для Lampa, що працює РАЗОМ з плагіном «Ліхтар» (не замінює його).
 *  1) Додаткові ряди на головній (TMDB + українське кіно та серіали)
 *  2) Значок С3Е24 на постерах серіалів, прибирання значка року
 *  3) Тривалість і статус виходу всередині картки фільму/серіалу
 */
(function () {
    'use strict';

    // ===== РЯДИ НА ГОЛОВНІЙ =====
    // on: false — вимкнути ряд. index — позиція (0 = зверху), підберіть під Ліхтар.
    var ROWS = [
        { on: true, name: 'LmxPopularMovies', title: 'Популярні фільми',     url: 'movie/popular',     index: 2 },
        { on: true, name: 'LmxNowPlaying',    title: 'Зараз у кінотеатрах',  url: 'movie/now_playing', index: 3 },
        { on: true, name: 'LmxUpcoming',      title: 'Скоро вийдуть',        url: 'movie/upcoming',    index: 4 },
        { on: true, name: 'LmxTopMovies',     title: 'Найвищий рейтинг',     url: 'movie/top_rated',   index: 5 },
        { on: true, name: 'LmxPopularTv',     title: 'Популярні серіали',    url: 'tv/popular',        index: 6 },
        { on: true, name: 'LmxUaMovies',      title: 'Українське кіно',      url: 'discover/movie?with_origin_country=UA&sort_by=popularity.desc', index: 7 },
        { on: true, name: 'LmxUaTv',          title: 'Українські серіали',   url: 'discover/tv?with_origin_country=UA&sort_by=popularity.desc',    index: 8 },
        { on: true, name: 'LmxUaLangMovies',  title: 'Фільми українською (оригінал)', url: 'discover/movie?with_original_language=uk&sort_by=popularity.desc', index: 9 },
        { on: true, name: 'LmxUaLangTv',      title: 'Серіали українською (оригінал)', url: 'discover/tv?with_original_language=uk&sort_by=popularity.desc',    index: 10 }
    ];

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
            if (!row.on) return;
            Lampa.ContentRows.add({
                name: row.name,
                title: row.title,
                index: row.index,
                screen: ['main'],
                call: makeCall(row)
            });
        });
    }

    function safe(fn) {
        try { fn(); } catch (e) { console.error('LMX', e); }
    }

    if (window.appready) safe(initRows);
    else Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') safe(initRows);
    });
})();

(function () {
    'use strict';

    // ===== Налаштування =====
    var DEBUG = false;      // true = підказка скільки карток знайдено (для налагодження на телефоні)
    var HIDE_YEAR = true;   // прибрати значок року на постері
    var MAX_PARALLEL = 4;   // скільки запитів до TMDB одночасно
    var CACHE_MIN = 1440;   // кеш відповідей TMDB, хвилин

    var mem = {};
    var queue = [];
    var active = 0;
    var found = 0, withData = 0, rendered = 0;

    function injectCss() {
        if (document.getElementById('lmx-css')) return;
        var s = document.createElement('style');
        s.id = 'lmx-css';
        s.textContent =
            '.lmx-box{position:absolute;left:.4em;top:.4em;z-index:3;pointer-events:none}' +
            '.lmx-pill{font-size:.75em;line-height:1;padding:.35em .55em;border-radius:.5em;background:rgba(0,0,0,.72);color:#fff;font-weight:600;white-space:nowrap}' +
            '.lmx-info{display:flex;flex-wrap:wrap;gap:.5em;margin:.8em 0}' +
            '.lmx-ip{font-size:1.1em;line-height:1;padding:.45em .8em;border-radius:.6em;background:rgba(255,255,255,.12);color:#fff}' +
            '.lmx-ok{background:rgba(30,150,80,.85)}' +
            '.lmx-soon{background:rgba(220,150,20,.9)}' +
            '.lmx-on{background:rgba(40,110,220,.88)}' +
            '.lmx-end{background:rgba(110,110,120,.88)}' +
            '.lmx-bad{background:rgba(190,50,50,.88)}';
        document.head.appendChild(s);
    }

    // ===== Допоміжне =====
    function typeOf(d) {
        if (d.media_type === 'tv' || d.media_type === 'movie') return d.media_type;
        return (d.name || d.first_air_date || d.number_of_seasons) ? 'tv' : 'movie';
    }
    function fmtShort(s) {
        var p = String(s || '').split('-');
        return p.length === 3 ? p[2] + '.' + p[1] : '';
    }
    function fmtFull(s) {
        var p = String(s || '').split('-');
        return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : '';
    }
    function code(s, e) {
        return 'С' + s + 'Е' + e;
    }

    // ===== Значок на картці (лише серіали): С3Е24 =====
    function getData(el) {
        var d = el.card_data || null;
        if (!d && window.$) {
            var $e = window.$(el);
            d = $e.data('card') || $e.data('card_data') || $e.data('data') || null;
        }
        return d && d.id ? d : null;
    }

    function hideYear(el) {
        if (!HIDE_YEAR) return;
        var view = el.querySelector('.card__view');
        if (!view) return;
        var all = view.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            if (n.children.length === 0 && /^\s*(19|20)\d\d\s*$/.test(n.textContent) && !n.closest('.lmx-box')) {
                n.style.display = 'none';
            }
        }
    }

    function render(el, j) {
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

    function load(type, id, cb) {
        var key = type + '/' + id;
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
                load('tv', task.id, function (j) {
                    active--;
                    if (j) render(task.el, j);
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
            hideYear(el);
            setTimeout(function () { hideYear(el); }, 1500);

            var d = getData(el);
            if (!d) return;
            withData++;
            if (typeOf(d) !== 'tv') return;
            var task = { el: el, id: d.id };
            if (io) { el.__lmx = task; io.observe(el); }
            else { queue.push(task); }
        });
        if (!io) pump();
        if (DEBUG && cards.length && Lampa.Noty) {
            Lampa.Noty.show('lmx: карток ' + found + ', з даними ' + withData + ', значків ' + rendered);
        }
    }

    var timer = null;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(scan, 300);
    }

    // ===== Всередині картки фільму/серіалу: тривалість і статус =====
    function infoPills(m) {
        var p = [];
        var tv = typeOf(m) === 'tv';

        if (tv) {
            var rt = (m.episode_run_time && m.episode_run_time[0]) ||
                (m.last_episode_to_air && m.last_episode_to_air.runtime) || 0;
            if (rt) p.push({ t: rt + ' хв/серія' });

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
            if (m.runtime) p.push({ t: m.runtime + ' хв' });

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

    function start() {
        injectCss();
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        scan();
        Lampa.Listener.follow('full', onFull);
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') start();
    });
})();
