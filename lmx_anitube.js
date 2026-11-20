/*
 * LMX Anitube — кнопка «Anitube» на сторінці аніме: перегляд з anitube.in.ua з українською озвучкою (FanVoxUA, Рідний Голос та ін.)
 *  • Самостійний плагін: має власний стандартний екран «Онлайн» (його оформлює LMX Watch), інші онлайн-плагіни не потрібні
 *  • Кнопка з’являється лише на аніме (жанр «Анімація», японське чи китайське походження)
 *  • Пошук, сезони, озвучки й серії віддає LMX Worker; посилання на відео бере сам пристрій (плеєр Ashdi працює лише для України)
 *
 *  Екран «Онлайн» узято з відкритого проєкту Lampac (https://github.com/immisterio/Lampac, ліцензія AGPL-3.0);
 *  тож і цей файл поширюється на умовах AGPL-3.0 з відкритим кодом.
 */
(function () {
    'use strict';
    if (window.__lmxAnitube4) return;
    window.__lmxAnitube4 = true;
    var VERSION = '4.1';
    // Назва в списку розширень Lampa (інакше там «Без назви»)
    try { if (window.Lampa && Lampa.Manifest) Lampa.Manifest.plugins = { type: 'other', version: String(VERSION), name: 'LMX Anitube', description: 'Кнопка Anitube на сторінці аніме: українська озвучка з anitube.in.ua', author: 'Irfnekf' }; } catch (e) {}

    var DEFAULT_HOST = 'https://lmx-sync.vladshkaraputa07.workers.dev';
    var KEY = 'anitube';
    var COMP = 'lmx_anitube_online';

    function safe(fn) { try { return fn(); } catch (e) { try { console.log('LMX Anitube', e); } catch (x) {} } }
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
    function playerOf(url) { var m = String(url || '').match(/\/lite\/anitube\/video\?u=([^&]+)/); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } }

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
        if (document.getElementById('lmxat-css')) return;
        var st = document.createElement('style'); st.id = 'lmxat-css';
        // екран з одним заданим джерелом малює серії без кадрів (ховає їх) — повертаємо кадри, як на звичайному «Онлайн»
        st.textContent = '.lmxat-act .online-prestige__img{display:block !important}';
        document.head.appendChild(st);
    }

    // Наш екран: посилання на серії розбираємо на пристрої, а не через Worker; кадри серій показуємо
    function hookCreate() {
        var C = Lampa.Component;
        if (!C || typeof C.create !== 'function' || C.__lmxAt4) return;
        var real = C.create;
        C.create = function (object) {
            var comp = real.apply(C, arguments);
            safe(function () {
                if (!comp || !(object && object.component === COMP) || typeof comp.getFileUrl !== 'function' || comp.__lmxAt4) return;
                comp.__lmxAt4 = 1;
                safe(function () { var r = comp.render && comp.render(); if (r && r.addClass) r.addClass('lmxat-act'); });
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
        C.__lmxAt4 = 1;
    }

    function liteUrl(card) {
        var q = ['id=' + encodeURIComponent(card.id || ''), 'title=' + encodeURIComponent(card.title || card.name || ''),
            'original_title=' + encodeURIComponent(card.original_title || card.original_name || ''),
            'year=' + String(card.release_date || card.first_air_date || '').slice(0, 4), 'serial=' + (isSerial(card) ? 1 : 0)];
        return host() + '/lite/anitube?' + q.join('&');
    }
    function open(card) {
        ensureCss();
        Lampa.Activity.push({
            url: liteUrl(card), title: 'Anitube', component: COMP, movie: card, page: 1,
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
        btn.on('hover:enter', function () { safe(function () { open(card); }); });
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
    if (url.indexOf('token=') == -1) {
      var token = '';
      if (token != '') url = Lampa.Utils.addUrlComponent(url, 'token=');
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
      return Lampa.Storage.cache('online_last_balanser', 3000, {})[object.movie.id];
    }

    function hasProgress(name) {
      var choice = comp.getChoice(name);
      return Lampa.Arrays.getKeys(choice.episodes_view || {}).length > 0;
    }

    function addHabit(name) {
      var habits = Lampa.Storage.get('online_balanser_habits', '{}');
      for (var k in habits) {
        habits[k] *= 0.85;
        if (habits[k] < 0.05) delete habits[k];
      }
      habits[name] = (habits[name] || 0) + 1;
      Lampa.Storage.set('online_balanser_habits', habits);
    }

    function getHabits() {
      var habits = Lampa.Storage.get('online_balanser_habits', '{}');
      // перенос старого глобального выбора, чтобы любимый балансер не потерялся после обновления
      var legacy = Lampa.Storage.get('online_balanser', '');
      if (legacy && !Lampa.Arrays.getKeys(habits).length) {
        habits[legacy] = 1;
        Lampa.Storage.set('online_balanser_habits', habits);
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
      rchRun(json, function () {
        if (!noreset) _this2.find();
        else noreset();
      });
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
      var last_select_balanser = Lampa.Storage.cache('online_last_balanser', 3000, {});
      if (last_select_balanser[object.movie.id] !== balanser_name) addHabit(balanser_name);
      last_select_balanser[object.movie.id] = balanser_name;
      Lampa.Storage.set('online_last_balanser', last_select_balanser);
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
      query.push('year=' + ((object.movie.release_date || object.movie.first_air_date || '0000') + '').slice(0, 4));
      query.push('source=' + card_source);
      query.push('clarification=' + (object.clarification ? 1 : 0));
      query.push('similar=' + (object.similar ? true : false));
      query.push(
        'rchtype=' +
        ((window.rch_nws && window.rch_nws[hostkey]
          ? window.rch_nws[hostkey].type
          : window.rch && window.rch[hostkey]
            ? window.rch[hostkey].type
            : '') || '')
      );
      if (Lampa.Storage.get('account_email', ''))
        query.push('cub_id=' + Lampa.Utils.hash(Lampa.Storage.get('account_email', '')));
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
    };
    // ── source & life events ──
    this.startSource = function (json) {
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
          Lampa.Storage.set('active_balanser', balanser);
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
              Lampa.Loading.stop();
              call(json, json);
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
      var data = Lampa.Storage.cache('online_choice_' + (for_balanser || balanser), 3000, {});
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
      var data = Lampa.Storage.cache('online_choice_' + (for_balanser || balanser), 3000, {});
      data[object.movie.id] = choice;
      Lampa.Storage.set('online_choice_' + (for_balanser || balanser), data);
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
      var html = Lampa.Template.get('lmxat_does_not_answer', {
        balanser: balanser
      });
      if (er && er.accsdb) html.find('.online-empty__title').html(er.msg);

      var tic = er && er.accsdb ? 10 : 5;
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
