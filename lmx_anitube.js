/*
 * LMX Anitube — окрема кнопка «Anitube» на сторінці аніме: перегляд з anitube.in.ua з українською озвучкою (FanVoxUA, Рідний Голос та ін.)
 *  • Кнопка з’являється лише на аніме (жанр «Анімація», японське чи китайське походження); інші онлайн-плагіни не чіпає
 *  • Свій екран: сезон, озвучка, серії з прогресом перегляду; озвучка й сезон запам’ятовуються для кожного тайтлу
 *  • Пошук, озвучки й серії віддає LMX Worker (Cloudflare), плеєр Ashdi розбирається до прямого відео
 */
(function () {
    'use strict';
    if (window.__lmxAnitube2) return;
    window.__lmxAnitube2 = true;
    var VERSION = '2.0';
    // Назва в списку розширень Lampa (інакше там «Без назви»)
    try { if (window.Lampa && Lampa.Manifest) Lampa.Manifest.plugins = { type: 'other', version: String(VERSION), name: 'LMX Anitube', description: 'Кнопка Anitube на сторінці аніме: українська озвучка з anitube.in.ua', author: 'Irfnekf' }; } catch (e) {}

    var DEFAULT_HOST = 'https://lmx-sync.vladshkaraputa07.workers.dev';
    var COMP = 'lmx_anitube';

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
    function isSerial(c) { return !!(c && (c.name || c.number_of_seasons || c.first_air_date) && !c.title); }

    // ───────── запити до Worker (кеш на час сесії) ─────────
    var cache = {};
    function getJson(url, ok, fail) {
        var hit = cache[url];
        if (hit && Date.now() - hit.t < 15 * 60000) return ok(hit.d);
        var done = false, timer = setTimeout(function () { if (!done) { done = true; fail('Anitube не відповів вчасно'); } }, 30000);
        fetch(url).then(function (r) { return r.json(); })
            .then(function (j) {
                if (done) return; done = true; clearTimeout(timer);
                if (!j || j.error) return fail(j && j.error === 'no_file' ? 'Плеєр не віддав відео' : 'Anitube зараз недоступний');
                cache[url] = { t: Date.now(), d: j }; ok(j);
            })
            .catch(function () { if (done) return; done = true; clearTimeout(timer); fail('Немає зв’язку з LMX Worker'); });
    }
    function findUrl(card) {
        var q = ['fmt=json', 'id=' + encodeURIComponent(card.id || ''), 'title=' + encodeURIComponent(card.title || card.name || ''),
            'original_title=' + encodeURIComponent(card.original_title || card.original_name || ''), 'year=' + String(card.release_date || card.first_air_date || '').slice(0, 4),
            'serial=' + (isSerial(card) ? 1 : 0)];
        return host() + '/lite/anitube?' + q.join('&');
    }
    function voicesUrl(href) { return host() + '/lite/anitube?fmt=json&ath=' + encodeURIComponent(href); }
    function videoUrl(file, voice) { return host() + '/lite/anitube/video?u=' + encodeURIComponent(file) + '&t=' + encodeURIComponent(voice || ''); }

    // ───────── прогрес перегляду: ті самі ключі, що й в онлайн-плагінах, тож прогрес спільний ─────────
    function baseName(card) { return card.original_title || card.original_name || card.title || card.name || ''; }
    function epHash(card, s, e) { return Lampa.Utils.hash([s, s > 10 ? ':' : '', e, baseName(card)].join('')); }
    function filmHash(card) { return Lampa.Utils.hash(baseName(card)); }
    function timeline(hash) { return safe(function () { return Lampa.Timeline.view(hash); }) || { hash: hash, percent: 0, time: 0, duration: 0 }; }

    // ───────── вибір озвучки й сезону для тайтлу ─────────
    function choiceAll() { var o = null; try { o = Lampa.Storage.get('lmx_anitube_choice', {}); } catch (e) {} return o && typeof o === 'object' ? o : {}; }
    function choice(id) { return choiceAll()[id] || {}; }
    function setChoice(id, patch) {
        var o = choiceAll(), k;
        o[id] = Object.assign({}, o[id] || {}, patch, { t: Date.now() });
        var ks = Object.keys(o);
        if (ks.length > 300) { ks.sort(function (a, b) { return (o[a].t || 0) - (o[b].t || 0); }); for (k = 0; k < ks.length - 300; k++) delete o[ks[k]]; }
        try { Lampa.Storage.set('lmx_anitube_choice', o); } catch (e) {}
    }

    // ───────── оформлення ─────────
    function addCss() {
        if (document.getElementById('lmxat-css')) return;
        var css = '.lmxat{padding:1.5em 3em 3em}' +
            '.lmxat__head{display:flex;align-items:baseline;gap:.8em;margin-bottom:1.2em}' +
            '.lmxat__title{font-size:2.2em;font-weight:700;line-height:1.15}' +
            '.lmxat__src{font-size:1em;opacity:.55;letter-spacing:.06em;text-transform:uppercase}' +
            '.lmxat__bar{display:flex;flex-wrap:wrap;gap:.8em;margin-bottom:1.6em}' +
            '.lmxat__chip{padding:.55em 1.1em;border-radius:2em;background:rgba(255,255,255,.08);font-size:1.15em;white-space:nowrap}' +
            '.lmxat__chip b{opacity:.55;font-weight:400;margin-right:.4em}' +
            '.lmxat__chip.focus{background:#fff;color:#000}' +
            '.lmxat__list{display:flex;flex-direction:column;gap:.7em}' +
            '.lmxat__ep{position:relative;display:flex;align-items:center;gap:1.2em;padding:1em 1.3em;border-radius:.8em;background:rgba(255,255,255,.06);overflow:hidden}' +
            '.lmxat__ep.focus{background:#fff;color:#000}' +
            '.lmxat__num{min-width:2.4em;font-size:1.9em;font-weight:700;text-align:center;opacity:.9}' +
            '.lmxat__name{flex:1;font-size:1.3em}' +
            '.lmxat__info{font-size:1em;opacity:.6;white-space:nowrap}' +
            '.lmxat__ep.is-seen .lmxat__num{opacity:.4}' +
            '.lmxat__line{position:absolute;left:0;bottom:0;height:.22em;background:#e93b6d}' +
            '.lmxat__msg{font-size:1.3em;opacity:.7;padding:2em 0}';
        var st = document.createElement('style'); st.id = 'lmxat-css'; st.textContent = css; document.head.appendChild(st);
    }

    // ───────── екран ─────────
    function Component(object) {
        var card = object.movie || object.card || {};
        var serial = isSerial(card);
        var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
        var html = $('<div class="lmxat-wrap"></div>');
        var body = $('<div class="lmxat"></div>');
        var head = $('<div class="lmxat__head"><div class="lmxat__title"></div><div class="lmxat__src">Anitube</div></div>');
        var bar = $('<div class="lmxat__bar"></div>');
        var list = $('<div class="lmxat__list"></div>');
        var self = this, last = null, seasons = [], season = null, voices = [], vi = 0, alive = true;
        head.find('.lmxat__title').text(card.title || card.name || '');

        this.create = function () {
            addCss();
            body.append(head).append(bar).append(list);
            scroll.append(body[0]);
            html.append(scroll.render());
            this.activity.loader(true);
            safe(function () { if (card.backdrop_path) Lampa.Background.change(Lampa.TMDB.image('/t/p/w1280' + card.backdrop_path)); });
            load();
            return this.render();
        };
        function message(t) { list.empty().append($('<div class="lmxat__msg"></div>').text(t)); bar.empty(); self.activity.loader(false); last = null; toggle(); }
        function load() {
            getJson(findUrl(card), function (j) {
                if (!alive) return;
                if (!serial) {
                    if (!j.film) return message('На Anitube цей тайтл не знайдено');
                    seasons = [{ n: 0, href: j.film.href }];
                } else {
                    seasons = j.seasons || [];
                    if (!seasons.length) return message('На Anitube цей тайтл не знайдено');
                }
                var ch = choice(card.id), want = seasons.filter(function (s) { return s.n === ch.season; })[0];
                openSeason(want || seasons[0]);
            }, function (err) { if (alive) message(err); });
        }
        function openSeason(s) {
            season = s;
            self.activity.loader(true);
            getJson(voicesUrl(s.href), function (j) {
                if (!alive) return;
                voices = j.voices || [];
                if (!voices.length) return message('Немає серій у підтримуваному плеєрі');
                var ch = choice(card.id), k = -1;
                voices.forEach(function (v, i) { if (k < 0 && ch.voice && v.name === ch.voice) k = i; });
                if (k < 0) voices.forEach(function (v, i) { if (k < 0 && !v.sub) k = i; });
                vi = Math.max(0, k);
                draw();
            }, function (err) { if (alive) message(err); });
        }
        function chip(label, value, onEnter) {
            var c = $('<div class="lmxat__chip selector"><b></b><span></span></div>');
            c.find('b').text(label); c.find('span').text(value);
            c.on('hover:enter', onEnter).on('hover:focus', function () { last = c[0]; scroll.update(c, true); });
            return c;
        }
        function selectFrom(title, items, onPick) {
            Lampa.Select.show({ title: title, items: items, onSelect: function (a) { onPick(a); }, onBack: function () { Lampa.Controller.toggle('content'); } });
        }
        function draw() {
            self.activity.loader(false);
            bar.empty(); list.empty(); last = null;
            var v = voices[vi];
            if (serial && seasons.length > 1) bar.append(chip('Сезон', season.n, function () {
                selectFrom('Сезон', seasons.map(function (s) { return { title: s.n + ' сезон', s: s, selected: s === season }; }), function (a) { setChoice(card.id, { season: a.s.n }); openSeason(a.s); });
            }));
            if (voices.length > 1) bar.append(chip('Озвучка', v.name, function () {
                selectFrom('Озвучка', voices.map(function (x, i) { return { title: x.name, subtitle: x.eps.length + ' сер.', i: i, selected: i === vi }; }), function (a) {
                    vi = a.i; setChoice(card.id, { voice: voices[vi].name }); draw();
                });
            }));
            var firstNew = null;
            v.eps.forEach(function (e, idx) {
                var sn = serial ? season.n : 0;
                var tl = timeline(serial ? epHash(card, sn, e.n) : filmHash(card));
                var el = $('<div class="lmxat__ep selector"><div class="lmxat__num"></div><div class="lmxat__name"></div><div class="lmxat__info"></div></div>');
                el.find('.lmxat__num').text(serial ? e.n : '▶');
                el.find('.lmxat__name').text(serial ? 'Серія ' + e.n : (card.title || card.name || 'Дивитись'));
                if (tl.percent) {
                    el.append($('<div class="lmxat__line"></div>').css('width', Math.min(100, tl.percent) + '%'));
                    el.find('.lmxat__info').text(tl.percent >= 90 ? 'переглянуто' : tl.percent + '%');
                    if (tl.percent >= 90) el.addClass('is-seen');
                }
                if (!firstNew && (tl.percent || 0) < 90) firstNew = el[0];
                el.on('hover:enter', function () { play(idx); }).on('hover:focus', function () { last = el[0]; scroll.update(el, true); });
                list.append(el);
            });
            last = firstNew || list.find('.selector')[0] || bar.find('.selector')[0] || null;
            toggle();
        }
        function resolve(e, voice, ok, fail) { getJson(videoUrl(e.file, voice), ok, fail); }
        function play(idx) {
            var v = voices[vi], sn = serial ? season.n : 0;
            setChoice(card.id, serial ? { voice: v.name, season: season.n } : { voice: v.name });
            var items = v.eps.map(function (e) {
                var hash = serial ? epHash(card, sn, e.n) : filmHash(card);
                var item = { title: serial ? (card.title || card.name || '') + ' · ' + sn + ' сезон · Серія ' + e.n : (card.title || card.name || ''), timeline: timeline(hash), voice_name: v.name };
                if (serial) { item.season = sn; item.episode = e.n; }
                // посилання на відео отримуємо, лише коли черга дійде до серії
                item.url = function (call) { resolve(e, v.name, function (j) { item.url = j.url; if (j.quality) item.quality = j.quality; call(); }, function (err) { item.url = ''; noty(err); call(); }); };
                return item;
            });
            var first = items[idx];
            Lampa.Loading.start(function () { Lampa.Loading.stop(); });
            resolve(v.eps[idx], v.name, function (j) {
                Lampa.Loading.stop();
                first.url = j.url; if (j.quality) first.quality = j.quality;
                safe(function () { Lampa.Favorite.add('history', card, 100); });
                Lampa.Player.play(first);
                // зовнішній плеєр не вміє чергу з відкладеними посиланнями — йому лише обрана серія
                var inner = true; try { inner = Lampa.Storage.field('player') === 'inner'; } catch (x) {}
                Lampa.Player.playlist(inner ? items : [first]);
            }, function (err) { Lampa.Loading.stop(); noty(err); });
        }
        function toggle() { try { if (alive && Lampa.Activity.active().activity === self.activity) Lampa.Controller.toggle('content'); } catch (e) {} }

        this.start = function () {
            if (Lampa.Activity.active().activity !== this.activity) return;
            Lampa.Controller.add('content', {
                toggle: function () { Lampa.Controller.collectionSet(scroll.render()); Lampa.Controller.collectionFocus(last || false, scroll.render()); },
                up: function () { if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
                down: function () { if (Navigator.canmove('down')) Navigator.move('down'); },
                left: function () { if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
                right: function () { if (Navigator.canmove('right')) Navigator.move('right'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };
        this.render = function () { return html; };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { alive = false; try { scroll.destroy(); } catch (e) {} html.remove(); };
    }

    // ───────── кнопка на сторінці аніме ─────────
    var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.8c1.6 2.3 4.4 2.8 6.3 1.6-.1 2.8 1.7 5 4.1 5.6-2 1.6-2.7 4.4-1.4 6.7-2.8-.4-5.2 1.2-5.9 3.8-1.6-2.3-4.5-3-6.9-1.7.5-2.8-1.1-5.3-3.7-6.1 2.2-1.4 3-4.2 1.9-6.6 2.6.6 5-.5 5.6-3.3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.3" fill="currentColor"/></svg>';
    function addButton(e) {
        var card = e.data && e.data.movie;
        if (!isAnime(card)) return;
        var render = e.object && e.object.activity && e.object.activity.render();
        if (!render || !render.length || render.find('.view--lmxat').length) return;
        var box = render.find('.full-start-new__buttons, .full-start__buttons').eq(0);
        if (!box.length) return;
        var btn = $('<div class="full-start__button selector view--lmxat">' + ICON + '<span>Anitube</span></div>');
        btn.on('hover:enter', function () { Lampa.Activity.push({ url: '', title: 'Anitube', component: COMP, movie: card, page: 1 }); });
        var online = box.find('.view--online').last();
        if (online.length) online.after(btn); else box.prepend(btn);
    }

    function settings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;
        S.addComponent({ component: 'lmx_anitube', name: 'LMX Anitube', icon: ICON });
        S.addParam({ component: 'lmx_anitube', param: { name: 'lmx_anitube_v', type: 'title', default: '' }, field: { name: 'LMX Anitube v' + VERSION + ' · кнопка з’являється лише на аніме' } });
    }
    function start() {
        if (window.__lmxAnitubeOn2) return;
        window.__lmxAnitubeOn2 = true;
        Lampa.Component.add(COMP, Component);
        Lampa.Listener.follow('full', function (e) { if (e.type === 'complite') safe(function () { addButton(e); }); });
        safe(settings);
    }
    if (window.Lampa && Lampa.Component && Lampa.Listener) start();
    else { var n = 0, iv = setInterval(function () { if (window.Lampa && Lampa.Component && Lampa.Listener) { clearInterval(iv); start(); } else if (++n > 300) clearInterval(iv); }, 100); }
})();
