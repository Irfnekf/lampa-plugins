/*
 * NoCub v1.7 — ховає елементи CUB в інтерфейсі Lampa (для особистого використання).
 * Усі пункти — окремі перемикачі в Налаштування → NoCub, за замовчуванням ВИМКНЕНІ.
 * Плагін лише ховає елементи стилем (нічого не видаляє і не блокує запитів), тож вимкнений перемикач повертає все назад.
 * Не чіпає: проксі TMDB, закладки/історію/таймкоди, каталог розширень, оновлення Lampa, рекламу у плеєрі.
 */
(function () {
    'use strict';
    if (window.__nocub) return;
    window.__nocub = true;

    var VERSION = '1.7';
    function safe(fn) { try { return fn(); } catch (e) { try { console.error('NoCub', e); } catch (x) {} } }

    // Перемикачі: ключ → що ховаємо
    var ITEMS = [
        { key: 'nocub_reactions', name: 'Реакції', desc: 'Кнопки реакцій на картках і на сторінці фільму' },
        { key: 'nocub_reviews', name: 'Коментарі та відгуки', desc: 'Блок «Коментарі» на сторінці фільму, разом із кнопкою «додати»' },
        { key: 'nocub_bell', name: 'Дзвіночок сповіщень', desc: 'Іконка сповіщень у шапці' },
        { key: 'nocub_premium', name: 'Преміум і запрошення', desc: 'Пункти меню, іконки й плашки про преміум-підписку та запрошення друзів' },
        { key: 'nocub_account', name: 'Акаунт CUB', desc: 'Пункти «Акаунт» / «Увійти» в меню та налаштуваннях' },
        { key: 'nocub_recs', name: 'Рекомендації на сторінці фільму', desc: 'Блоки «Рекомендації» і «Схожі» внизу сторінки фільму' },
        { key: 'nocub_subscribe', name: 'Кнопка «Підписатися»', desc: 'Підписка на фільм, серіал чи актора (потрібен акаунт CUB)' },
        { key: 'nocub_promo', name: 'Акційні кнопки й плашки', desc: 'Сезонні акції CUB (Хелловін, Новий рік, чорна п\'ятниця, знижки, подарунки) — за ознаками в назві', def: true },
        { key: 'nocub_strict', name: 'Лише відомі кнопки шапки', desc: 'Ховає будь-яку невідому кнопку в шапці (запасний варіант для нових акцій). Кнопки інших плагінів додайте в «Залишити кнопки» нижче', def: false }
    ];
    var PROMO = ['halloween', 'helloween', 'newyear', 'new-year', 'christmas', 'xmas', 'blackfriday', 'black-friday', 'cybermonday', 'sale', 'promo', 'discount', 'gift', 'valentine', 'easter', 'birthday', 'anniversary'];
    // Відомі кнопки шапки (решта — «невідомі» для суворого режиму)
    var KNOWN_HEAD = /open--(search|settings|broadcast|notice|profile|feed|premium)|notice--icon|full--screen|lmx-themebtn|head__back|head__menu|head__logo/;

    function defOf(key) { for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].key === key) return !!ITEMS[i].def; return false; }
    function on(key) {
        var v = Lampa.Storage.get(key, defOf(key) ? 'true' : 'false');
        return v === true || v === 'true';
    }

    // CSS-селектори (прості, без пошуку по тексту)
    var CSS = {
        nocub_reactions: [
            '.full-start__button.button--reaction', '.button--reaction',
            '.full-start-new__reactions', '.full-start__reactions', '.full-start-new .reaction', '.full-start .reaction',
            '.card__reactions', '.full-reactions'
        ],
        nocub_reviews: ['.full-review', '.full-review-add', '.full-reviews'],
        nocub_bell: ['.head__action.notice--icon', '.head__action.open--notice', '.head__action--notice', '.notice--icon'],
        nocub_premium: ['.head__action.halloween__button', '.halloween__button', 'body > .halloween', '.halloween', '.head__action[class*="halloween"]', '.head__action[class*="helloween"]', '.head [class*="premium"]', '.head__action[data-action*="premium"]', '.head__action.open--premium', '.open--premium', '.head [class*="cub-premium"]', '.menu__item[data-action="premium"]', '.settings-folder[data-component="premium"]'],
        nocub_account: ['.menu__item[data-action="account"]', '.settings-folder[data-component="account"]', '.head__action.open--profile'],
        nocub_subscribe: ['.button--subscribe', '.full-start__button.view--subscribe'],
        nocub_promo: PROMO.reduce(function (acc, w) { acc.push('[class^="' + w + '"]', '[class*=" ' + w + '"]'); return acc; }, [])
    };
    var HIDE = '{display:none !important}';
    function css() {
        var out = '';
        Object.keys(CSS).forEach(function (k) {
            out += CSS[k].map(function (s) { return 'body.' + k + ' ' + s; }).join(',') + HIDE;
        });
        return out + '.nocub-hide' + HIDE;
    }

    // Пошук по тексту (коли в елемента немає стабільного класу): ключ → [контейнер, regexp]
    var TEXT = [
        { key: 'nocub_premium', sel: '.head .head__action', html: /premium|преміум|премиум|halloween|helloween|хелоуін|хэллоуин/i },
        { key: 'nocub_premium', sel: '.menu .menu__item', re: /преміум|премиум|premium|запроси|пригласи|invite/i },
        { key: 'nocub_account', sel: '.menu .menu__item', re: /^\s*(акаунт|аккаунт|account|увійти|войти)(?![a-zа-яіїєґ])/i },
        { key: 'nocub_account', sel: '.settings-folder', re: /акаунт|аккаунт|cub account/i },
        { key: 'nocub_subscribe', sel: '.full-start-new__buttons .full-start__button, .full-start__buttons .full-start__button', re: /підписат|подписат|subscribe/i },
        { key: 'nocub_reviews', sel: '.items-line', re: /^\s*(коментар|комментар|відгук|отзыв|comments|reviews)/i, title: true },
        { key: 'nocub_recs', sel: '.items-line', re: /^\s*(рекомендац|рекомендаці|схож|similar|recommendations)/i, title: true, onlyFull: true }
    ];

    // Прихований елемент не має лишатися «вибираним» для пульта: інакше фокус потрапляє на невидимий пункт і підсвітка зникає
    function mark(el, key) {
        el.classList.add('nocub-hide');
        el.setAttribute('data-nocub', key);
        if (el.classList.contains('selector')) { el.classList.remove('selector'); el.setAttribute('data-nocub-sel', '1'); }
        if (el.classList.contains('focus')) el.classList.remove('focus');
    }
    function unmark(el) {
        el.classList.remove('nocub-hide');
        el.removeAttribute('data-nocub');
        if (el.getAttribute('data-nocub-sel')) { el.classList.add('selector'); el.removeAttribute('data-nocub-sel'); }
    }
    function scanCss() {
        Object.keys(CSS).forEach(function (k) {
            var active = on(k);
            var sel = CSS[k].join(',');
            var els;
            try { els = document.querySelectorAll(sel); } catch (e) { return; }
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (active) { if (!el.classList.contains('nocub-hide') || el.getAttribute('data-nocub') !== k) mark(el, k); }
                else if (el.getAttribute('data-nocub') === k) unmark(el);
            }
        });
    }
    // Страховка для пульта: будь-який невидимий (display:none) пункт налаштувань не повинен лишатися «вибираним» — навіть якщо його сховала сама Lampa
    function fixSettingsFocus() {
        var root = document.querySelector('.settings');
        if (!root) return;
        var changed = false, els = root.querySelectorAll('.selector, [data-nocub-sel="auto"]');
        for (var i = 0; i < els.length; i++) {
            var el = els[i], hidden = getComputedStyle(el).display === 'none';
            if (hidden && el.classList.contains('selector')) {
                el.classList.remove('selector');
                el.classList.remove('focus');
                el.setAttribute('data-nocub-sel', 'auto');
                changed = true;
            } else if (!hidden && el.getAttribute('data-nocub-sel') === 'auto') {
                el.classList.add('selector');
                el.removeAttribute('data-nocub-sel');
                changed = true;
            }
        }
        // Фокус чіпаємо лише якщо його втрачено (на видимому пункті немає .focus); інакше керування належить Lampa
        var hasFocus = false, fl = root.querySelectorAll('.selector.focus');
        for (var f = 0; f < fl.length; f++) if (getComputedStyle(fl[f]).display !== 'none') hasFocus = true;
        if (changed && !hasFocus) {
            var first = null, all = root.querySelectorAll('.selector');
            for (var j = 0; j < all.length; j++) if (getComputedStyle(all[j]).display !== 'none') { first = all[j]; break; }
            var C = window.Lampa && Lampa.Controller, name = '';
            try { name = C.enabled().name || ''; } catch (e) {}
            if (C && /settings/i.test(name)) {
                try { C.toggle(name); } catch (e) {}
                if (first && C.collectionFocus) { try { C.collectionFocus(first, root); } catch (e) {} }
            }
        }
    }
    function keepList() {
        var v = String(Lampa.Storage.get('nocub_keep', '') || '');
        return v.split(/[,\s]+/).filter(Boolean);
    }
    function scanStrict() {
        var active = on('nocub_strict'), keep = keepList();
        var els = document.querySelectorAll('.head .head__action');
        for (var i = 0; i < els.length; i++) {
            var el = els[i], cn = String(el.className);
            var known = KNOWN_HEAD.test(cn) || keep.some(function (k) { return cn.indexOf(k) >= 0; });
            if (active && !known) { if (el.getAttribute('data-nocub') !== 'nocub_strict') mark(el, 'nocub_strict'); }
            else if (el.getAttribute('data-nocub') === 'nocub_strict') unmark(el);
        }
    }
    function anyOn() { return ITEMS.some(function (it) { return on(it.key); }); }
    function scan() {
        var any = anyOn();
        if (any) safe(fixSettingsFocus);
        if (!any && !document.querySelector('.nocub-hide')) return;
        scanCss();
        scanStrict();
        TEXT.forEach(function (rule) {
            var els = document.querySelectorAll(rule.sel);
            var active = on(rule.key);
            for (var i = 0; i < els.length; i++) {
                var el = els[i], hit = false;
                if (active) {
                    var txt;
                    if (rule.html) {
                        hit = rule.html.test(el.outerHTML.slice(0, 600));
                    } else {
                        if (rule.title) {
                            var t = el.querySelector('.items-line__title');
                            txt = t ? t.textContent : '';
                        } else txt = el.textContent;
                        hit = !!txt && rule.re.test(txt.slice(0, 80));
                    }
                    // Блоки «Рекомендації» ховаємо лише на сторінці фільму, не на головній
                    if (hit && rule.onlyFull && !document.querySelector('.activity--active .full-start-new, .activity--active .full-start')) hit = false;
                }
                if (hit) mark(el, rule.key);
                else if (el.getAttribute('data-nocub') === rule.key) unmark(el);
            }
        });
    }

    function applyBody() {
        ITEMS.forEach(function (it) { document.body.classList.toggle(it.key, on(it.key)); });
    }

    var timer = 0;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(function () { safe(applyBody); safe(scan); }, 300);
    }

    function addSettings() {
        var S = Lampa.SettingsApi;
        if (!S || !S.addComponent) return;
        S.addComponent({
            component: 'nocub', name: 'NoCub',
            icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
        });
        S.addParam({ component: 'nocub', param: { name: 'nocub_t', type: 'title', default: '' }, field: { name: 'Сховати елементи CUB' } });
        ITEMS.forEach(function (it) {
            S.addParam({
                component: 'nocub', param: { name: it.key, type: 'trigger', default: !!it.def },
                field: { name: it.name, description: it.desc },
                onChange: function () { setTimeout(function () { safe(applyBody); safe(scan); }, 50); }
            });
        });
        S.addParam({
            component: 'nocub', param: { name: 'nocub_keep', type: 'input', values: '', default: '' },
            field: { name: 'Залишити кнопки', description: 'Для режиму «Лише відомі кнопки шапки»: частини назв класів кнопок інших плагінів через кому' },
            onChange: function () { setTimeout(function () { safe(scan); }, 50); }
        });
        S.addParam({ component: 'nocub', param: { name: 'nocub_v', type: 'title', default: '' }, field: { name: 'NoCub v' + VERSION + ' · лише ховає елементи, нічого не видаляє' } });
    }

    function start() {
        safe(function () {
            var st = document.createElement('style');
            st.id = 'nocub-css';
            st.textContent = css();
            document.head.appendChild(st);
        });
        safe(addSettings);
        safe(applyBody);
        safe(scan);
        safe(function () {
            new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        });
        safe(function () {
            Lampa.Listener.follow('full', schedule);
            Lampa.Listener.follow('activity', schedule);
            if (Lampa.Settings && Lampa.Settings.listener) Lampa.Settings.listener.follow('open', function () { safe(applyBody); safe(scan); });
        });
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
})();
