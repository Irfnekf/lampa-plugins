/*
 * LMX Watch — екран перегляду: вибір джерела, сезону, озвучки й серії для будь-яких онлайн-джерел Lampa (окремий плагін; раніше був частиною LMX Pack)
 *  • Шапка з банером, логотипом і кнопками «Дивитись / Перша непереглянута / Продовжити»
 *  • Один суцільний екран без «стандартного» інтерфейсу Lampa, швидка перевірка джерел у фоні, перемикання джерела без перезавантаження
 *  • Серії широкими картками, ряд вибору (сортування, джерело, сезон, озвучка), «Спробувати інше джерело», «Повторити», «Уточнити пошук»
 *  • Налаштування: Lampa → Налаштування → LMX Watch, а також кнопка ⚙ біля банера
 *  Працює незалежно від LMX Pack: підключіть окремим плагіном.
 */
// ===== LMX Watch: оформлення екрана «Онлайн» для будь-яких джерел =====
// Шапка з фоном і кнопками «Продовжити», серії широкими картками з кадром і номером, чіпи озвучок. Стандартна розмітка
// онлайн-плагінів (.videos__item, .videos__button, .online-prestige) однакова в більшості джерел, тож діє на всі. Нічого в Lampa не підміняємо.
(function () {
    'use strict';
    if (window.__lmxOnline) return;
    window.__lmxOnline = true;
    var VERSION = '3.36';
    // Назва в списку розширень Lampa (інакше там «Без назви»)
    try { if (window.Lampa && Lampa.Manifest) Lampa.Manifest.plugins = { type: 'other', version: String(VERSION), name: 'LMX Watch', description: 'Екран «Онлайн»: швидкий і розумний вибір джерела, українська озвучка, зручний список серій', author: 'Irfnekf' }; } catch (e) {}
    function safe(fn) { try { return fn(); } catch (e) { try { console.error('LMX Watch', e); } catch (x) {} } }
    function isOn() { var v = Lampa.Storage.get('lmx_online', 'true'); return v === true || v === 'true'; }
    function img(path, size) {
        try { if (Lampa.TMDB && Lampa.TMDB.image) return Lampa.TMDB.image('t/p/' + size + path); } catch (e) {}
        return 'https://image.tmdb.org/t/p/' + size + path;
    }

    // Елемент .selectbox у Lampa є в DOM завжди (його додають при старті), тож «меню відкрите» визначаємо за класом на body
    // Плеєр відкритий (або вмикається наступна серія): наші сторожові таймери не мають забирати в нього керування — раніше натискання «наступна серія» викидало у список
    function plyOn() {
        try {
            if (Lampa.Player && typeof Lampa.Player.opened === 'function' && Lampa.Player.opened()) return true;
            var c = Lampa.Controller.enabled();
            return !!(c && /^player/i.test(c.name || ''));
        } catch (e) { return false; }
    }
    function ctlContent() { if (plyOn()) return; try { Lampa.Controller.toggle('content'); } catch (e) {} }
    function selOpen() {
        try { if (window.Lampa && Lampa.Select && typeof Lampa.Select.opened === 'function' && Lampa.Select.opened()) return true; } catch (e) {}
        // у різних збірках Lampa «відкрито» позначається по-різному — дивимось на всі ознаки
        return document.body.classList.contains('selectbox--open') || !!document.querySelector('.selectbox.animate, .selectbox.selectbox--open');
    }
    // Активний контролер — не наш екран (рідне меню «select», вікно «Редагувати джерела» «modal», налаштування тощо): наші стрілки,
    // «ОК» і службові таймери в цей час взагалі не втручаються, інакше вони рухали б фокус на екрані ПІД вікном
    function selCtl() {
        try { var c = Lampa.Controller.enabled(); return !!(c && c.name && c.name !== 'content'); } catch (e) { return false; }
    }
    var S = 'body.lmx-online .explorer.lmx-onl ';
    var B = S + '.explorer__files-body .scroll__body';
    // сітка серій може стояти не на самому .scroll__body, а на обгортці карток (інші плагіни): правила діють на будь-якому рівні
    var BG = S + '.explorer__files-body .lmx-onl-grid.lmx-onl-grid';
    var CSS = '' +
        S + '.explorer__files-head{padding-bottom:.3em}' +
        S + '.filter--search,' + S + '.filter--sort,' + S + '.filter--filter,' + S + '.filter--back,' + S + '.simple-button.selector{border-radius:99em;background:rgba(255,255,255,.12)}' +
        S + '.filter--search.focus,' + S + '.filter--sort.focus,' + S + '.filter--filter.focus,' + S + '.filter--back.focus,' + S + '.simple-button.selector.focus{background:#fff;color:#111}' +
        S + '.videos__button{border-radius:99em;background:rgba(255,255,255,.12);padding:.55em 1.2em;margin:0 .5em .5em 0}' +
        S + '.videos__button.focus{background:#fff;color:#111}' +
        // список: серії у сітці широких карток (кадр зверху, підпис знизу)
        BG + '{display:flex;flex-wrap:wrap;align-items:stretch;gap:.9em;width:100%;max-width:100%;box-sizing:border-box;flex:1 1 100%;min-width:0}' +
        B + ' > *{box-sizing:border-box}' +
        BG + ' > .lmx-onl-item,' + BG + ' > .videos__item,' + BG + ' > .videos__season{flex:0 0 calc(20% - .72em);width:calc(20% - .72em);margin:0}' +
        '@media (max-width:1100px){' + BG + ' > .lmx-onl-item,' + BG + ' > .videos__item,' + BG + ' > .videos__season{flex-basis:calc(33.333% - .62em);width:calc(33.333% - .62em)}}' +
        '@media (max-width:760px){' + BG + ' > .lmx-onl-item,' + BG + ' > .videos__item,' + BG + ' > .videos__season{flex-basis:calc(50% - .45em);width:calc(50% - .45em)}}' +
        S + '.lmx-onl-item,' + S + '.videos__item,' + S + '.videos__season,' + S + '.online-prestige,' + S + '.torrent-item{border-radius:1em;background:rgba(255,255,255,.06);overflow:hidden;transition:background .15s ease,transform .15s ease}' +
        S + '.online-prestige,' + S + '.torrent-item{margin-bottom:.7em}' +
        S + '.lmx-onl-item.focus,' + S + '.videos__item.focus,' + S + '.videos__season.focus,' + S + '.online-prestige.focus,' + S + '.torrent-item.focus{background:rgba(255,255,255,.16);box-shadow:0 0 0 .18em #fff}' +
        S + '.lmx-onl-item.lmx-onl-dim{opacity:.34 !important;filter:grayscale(.65) brightness(.75);transition:opacity .2s,filter .2s}' +
        S + '.lmx-onl-item.lmx-onl-dim.focus{opacity:.72 !important;filter:grayscale(.3) brightness(.9)}' +
        S + '.videos__item.focus::after,' + S + '.videos__season.focus::after,' + S + '.online-prestige.focus::after,' + S + '.torrent-item.focus::after,' +
        S + '.videos__item.focus::before,' + S + '.videos__season.focus::before,' + S + '.online-prestige.focus::before,' + S + '.torrent-item.focus::before{display:none !important}' +
        S + '.explorer__left{display:none !important}' +
        S + '.explorer__files{width:100% !important}' +
        BG + ' > .lmx-onl-item{display:flex !important;flex-direction:column;align-items:stretch}' +
        BG + ' > .lmx-onl-item > *:first-child{width:100% !important;max-width:none !important;height:auto !important;aspect-ratio:16/9;margin:0 !important;border-radius:1em 1em 0 0;overflow:hidden;position:relative}' +
        BG + ' > .lmx-onl-item > *:first-child img{width:100%;height:100%;object-fit:cover;display:block}' +
        BG + ' > .lmx-onl-item > *:not(:first-child){width:100% !important;box-sizing:border-box;padding:.5em .7em;margin:0 !important}' +
        S + '.videos__item-imgbox{position:relative;width:100%;aspect-ratio:16/9;border-radius:1em 1em 0 0;overflow:hidden;background:rgba(255,255,255,.05)}' +
        S + '.videos__item-imgbox img{width:100%;height:100%;object-fit:cover;display:block}' +
        S + '.videos__item-imgbox[data-n]::before{content:attr(data-n);position:absolute;left:.5em;top:.5em;z-index:2;min-width:1.9em;padding:.12em .45em;border-radius:.5em;background:rgba(0,0,0,.62);font-size:.85em;font-weight:700;text-align:center;line-height:1.35}' +
        S + '.videos__item-title,' + S + '.videos__item-footer{padding-left:.7em;padding-right:.7em}' +
        S + '.videos__item-title{padding-top:.5em;font-weight:700;line-height:1.2}' +
        S + '.videos__item-footer{padding-bottom:.6em;opacity:.8;font-size:.85em}' +
        // інформація в картці (якість, озвучка, розмір…): джерела обрізають її трикрапкою, а нам потрібно все читабельно — переносимо на рядки
        S + '.lmx-onl-item [class*="__info"],' + S + '.lmx-onl-item [class*="-footer"],' + S + '.lmx-onl-item [class*="__footer"]{display:flex !important;flex-wrap:wrap;gap:.15em .7em;white-space:normal !important;overflow:visible !important;opacity:.95 !important;font-size:.92em !important;line-height:1.3;height:auto !important;max-height:none !important;padding:.2em .7em .6em !important;box-sizing:border-box;margin:0 !important}' +
        S + '.lmx-onl-item [class*="__info"] > *,' + S + '.lmx-onl-item [class*="-footer"] > *,' + S + '.lmx-onl-item [class*="__footer"] > *{flex:0 0 auto !important;width:auto !important;max-width:100% !important;overflow:visible !important;text-overflow:clip !important;white-space:normal !important;margin-left:0 !important;margin-right:0 !important;padding-left:0 !important;padding-right:0 !important}' +
        S + '.lmx-onl-item [class*="__title"]{display:block !important;white-space:normal !important;overflow:visible !important;text-overflow:clip !important;-webkit-line-clamp:unset !important;line-clamp:unset !important;-webkit-box-orient:initial !important;line-height:1.2;height:auto !important;max-height:none !important;word-break:normal;overflow-wrap:break-word}' +
        S + '.lmx-onl-item [class*="__info"] *,' + S + '.lmx-onl-item [class*="-footer"] *,' + S + '.lmx-onl-item [class*="__footer"] *{overflow:visible !important;text-overflow:clip !important;white-space:normal !important;min-width:0 !important;overflow-wrap:break-word}' +
        // уся текстова частина картки (і в джерел зі своєю розміткою): без трикрапки й обрізання, з однаковою мінімальною висотою — картки однакові незалежно від довжини тексту
        S + '.lmx-onl-item{height:auto !important;max-height:none !important;min-height:0}' +
        S + '.lmx-onl-item div,' + S + '.lmx-onl-item span{text-overflow:clip !important;-webkit-line-clamp:unset !important;line-clamp:unset !important}' +
        S + '.lmx-onl-item [class*="title"],' + S + '.lmx-onl-item [class*="name"]{white-space:normal !important;overflow:visible !important;-webkit-box-orient:initial !important;max-height:none !important;height:auto !important;overflow-wrap:break-word}' +
        BG + ' > .lmx-onl-item [class*="__title"]{min-height:2.45em}' +
        BG + ' > .lmx-onl-item [class*="__info"],' + BG + ' > .lmx-onl-item [class*="-footer"],' + BG + ' > .lmx-onl-item [class*="__footer"]{min-height:2.7em;margin-top:auto !important}' +
        BG + ' > .lmx-onl-item > *:first-child{flex:0 0 auto !important}' +
        S + '.videos__item .time-line,' + S + '.online-prestige .time-line{border-radius:99em;height:.28em;background:rgba(255,255,255,.2);overflow:hidden}' +
        S + '.videos__item .time-line > div,' + S + '.online-prestige .time-line > div{background:#fff;border-radius:99em;height:100%}' +
        // поки джерела шукаються: рідний лоадер Lampa ховаємо, замість нього — шапка з логотипом, що переливається
        'body.lmx-online .activity.lmx-onl-load .activity__body{opacity:1 !important}' +
        'body.lmx-online .activity.lmx-onl-load .activity__loader{display:none !important}' +
        '@keyframes lmxShim{0%{opacity:.55}50%{opacity:1}100%{opacity:.55}}' +
        '.lmx-onl-hero--load .lmx-onl-hero__logo,.lmx-onl-hero--load .lmx-onl-hero__t{animation:lmxShim 1.6s ease-in-out infinite}' +
        '.lmx-onl-hero__s{margin-top:.9em;font-size:.95em;font-weight:600;opacity:.85}' +
        '.lmx-onl-hero--load .lmx-onl-hero__s{display:none}' +
        BG + ' > .lmx-onl-wide{flex:0 0 100%;width:100%}' +
        // стара панель фільтрів лишається в DOM (через неї працюють меню), але не показується, коли нашу панель побудовано
        S.slice(0, -1) + '.lmx-onl-barred .explorer__files-head > *:not(.lmx-onl-hero):not(.lmx-onl-bar):not(.lmx-onl-drop):not(.lmx-onl-prog){display:none !important}' +
        S + '.lmx-onl-drop{display:flex;flex-wrap:wrap;gap:.5em;padding:0 0 .9em}' +
        S + '.lmx-onl-item [data-lmx-t]{white-space:nowrap !important;flex:0 0 auto !important;overflow-wrap:normal !important}' +
        S + '.lmx-onl-epi{padding:.1em .7em .2em;font-size:.82em;line-height:1.3;opacity:.85;min-height:2.6em;box-sizing:border-box;white-space:normal;overflow:visible}' +
        S + '.lmx-onl-epi__n{font-weight:600}' +
        S + '.lmx-onl-epi__d{opacity:.7;font-size:.92em}' +
        S + '.lmx-onl-g--cfg .lmx-onl-g__l{display:none}' +
        S + '.lmx-onl-g--sort .lmx-onl-g__l{display:none}' +
        S + '.lmx-onl-g--cfg .lmx-onl-pill{min-width:0;padding:.5em .85em;font-size:1.05em;justify-content:center}' +
        S + '.lmx-onl-opt{margin:0;padding:.5em 1.3em;font-size:.95em}' +
        S + '.lmx-onl-opt--on{box-shadow:inset 0 0 0 .14em rgba(255,255,255,.75)}' +
        // випадаючий список (сезон, озвучення): лежить поверх карток, нічого не зсуває
        S + '.lmx-onl-drop--pop{position:absolute;z-index:60;display:block;padding:.35em;overflow-y:auto;overflow-x:hidden;border-radius:.8em;background:rgba(18,20,28,.98);border:1px solid rgba(255,255,255,.14);box-shadow:0 1em 3em rgba(0,0,0,.75);box-sizing:border-box}' +
        S + '.lmx-onl-drop--pop .lmx-onl-opt{display:flex !important;justify-content:space-between;align-items:center;width:100%;box-sizing:border-box;margin:0 0 .12em !important;padding:.5em .9em !important;border:0 !important;border-radius:.5em !important;background:transparent !important;box-shadow:none !important;white-space:nowrap;transform:none !important}' +
        S + '.lmx-onl-drop--pop .lmx-onl-opt__n{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}' +
        S + '.lmx-onl-drop--pop .lmx-onl-opt__s{flex:0 0 auto;margin-left:.8em;font-size:.72em;opacity:.65;white-space:nowrap}' +
        S + '.lmx-onl-drop--pop .lmx-onl-opt__q{flex:0 0 auto;margin-left:.8em;padding:.1em .5em;border-radius:.4em;background:rgba(255,255,255,.14);font-size:.72em;font-weight:700;letter-spacing:.04em}' +
        S + '.lmx-onl-drop--pop .lmx-onl-opt.focus .lmx-onl-opt__q{background:rgba(0,0,0,.12)}' +
        S + '.lmx-onl-drop--pop .lmx-onl-opt--ok::before{margin-right:.65em;flex:0 0 auto}' +
        S + '.lmx-onl-drop--pop .lmx-onl-sep{display:block;margin:.35em .5em .2em;padding:.35em 0 0;border-top:1px solid rgba(255,255,255,.14);font-size:.7em;letter-spacing:.08em;text-transform:uppercase;opacity:.55}' +
        S + '.lmx-onl-drop--pop::before,' + S + '.lmx-onl-drop--pop::after{display:none;position:-webkit-sticky;position:sticky;left:0;right:0;height:1.9em;line-height:1.9em;text-align:center;font-size:.7em;font-weight:600;letter-spacing:.04em;pointer-events:none;z-index:3;color:#fff}' +
        S + '.lmx-onl-drop--pop[data-up]::before{content:attr(data-up);display:block;top:-.4em;margin-bottom:-1.9em;background:linear-gradient(180deg,rgba(18,20,28,1) 35%,rgba(18,20,28,0))}' +
        S + '.lmx-onl-drop--pop[data-dn]::after{content:attr(data-dn);display:block;bottom:-.4em;margin-top:-1.9em;background:linear-gradient(0deg,rgba(18,20,28,1) 35%,rgba(18,20,28,0))}' +
        S + '.lmx-onl-drop--pop .lmx-onl-opt--on{color:#e9a24a}' +
        S + '.lmx-onl-drop--pop .lmx-onl-opt--on::after{content:"\\2713";margin-left:1em}' +
        S + '.lmx-onl-drop--pop .lmx-onl-opt.focus{background:#fff !important;color:#0a0b10 !important}' +
        S + '.lmx-onl-opt--dim{opacity:.45}' +
        '.lmx-onl-off{display:none !important}' + B + ' > .lmx-onl-item.lmx-onl-off,' + B + ' > .lmx-onl-off{display:none !important}' +
        S + '.lmx-onl-left{padding:.1em .7em .2em;font-size:.82em;opacity:.85}' +
        S + '.lmx-onl-sep{flex:0 0 100%;font-size:.72em;font-weight:700;opacity:.55;text-transform:uppercase;letter-spacing:.06em;margin:.4em 0 -.1em}' +
        S + '.lmx-onl-dead{display:flex;flex-wrap:wrap;gap:.8em;margin-top:.9em}' +
        'body.lmx-onl-fill.lmx-online .lmx-onl-item.focus{background:#fff !important;color:#111;box-shadow:none !important}' +
        'body.lmx-onl-fill.lmx-online .lmx-onl-item.focus *{color:#111}' +
        'body.lmx-onl-fade .lmx-onl-hero__bg{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 16%,#000 84%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 16%,#000 84%,transparent 100%)}' +
        S + '.lmx-onl-opt--ok{background:linear-gradient(135deg,rgba(255,255,255,.26),rgba(255,255,255,.12));box-shadow:0 0 0 .12em rgba(255,255,255,.4),0 .2em .9em rgba(0,0,0,.35);font-weight:700}' +
        S + '.lmx-onl-opt--ok::before{content:"";display:inline-block;width:.5em;height:.5em;border-radius:50%;background:#5fe39a;box-shadow:0 0 .6em #5fe39a;margin-right:.55em;vertical-align:.05em}' +
        '.lmx-scan{position:fixed;left:0;right:0;bottom:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:#0b0d12;transition:opacity .35s}' +
        '.lmx-scan--out{opacity:0}' +
        '.lmx-scan__bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.28;filter:blur(.3em)}' +
        '.lmx-scan__c{position:relative;width:min(34em,80%);text-align:center}' +
        '.lmx-scan__t{font-size:1.9em;font-weight:800;margin-bottom:.8em}' +
        '.lmx-scan__s{font-size:1.05em;opacity:.85;margin-bottom:.7em}' +
        '.lmx-scan__b{height:.4em;border-radius:99em;background:rgba(255,255,255,.14);overflow:hidden}' +
        '.lmx-scan__b i{display:block;height:100%;width:5%;border-radius:99em;background:#fff;transition:width .5s ease}' +
        '.lmx-scan__h{margin-top:1.4em;font-size:.8em;opacity:.45}' +
        S + '.lmx-onl-nothumb img{visibility:hidden}' +
        S + '.lmx-onl-nothumb [class*="episode-number"]{display:none !important}' +
        S + '.lmx-onl-nothumb{background-size:cover !important;background-position:center !important;background-color:rgba(0,0,0,.45);background-blend-mode:multiply}' +
        S + '.explorer__files-body .scroll--mask,' + S + '.explorer__files-body .scroll{-webkit-mask-image:none !important;mask-image:none !important}' +
        S + '.explorer__files:after,' + S + '.explorer__files:before,' + S + '.explorer__files-body:after,' + S + '.explorer__files-body:before{display:none !important}' +
        S + '.explorer__files-head.hide{display:block !important}' +
        S + '.lmx-onl-wide{display:none !important}' +
        'body.lmx-online .activity.lmx-onl-load .explorer__files-body{visibility:hidden}' +
        // після завантаження список ще ~0,35 с лишається схованим: за цей час картки приймають остаточну форму, а фокус стає на місце (без стрибків і «з'їзду» вниз). Запасний вихід — анімація, що сама показує список
        'body.lmx-online .activity.lmx-onl-hold .explorer__files-body{opacity:0}' +
        'body.lmx-online .activity.lmx-onl-fadein .explorer__files-body{animation:lmxHold .2s ease both}' +
        '@keyframes lmxHold{from{opacity:0}to{opacity:1}}' +
        // поки автопідбір сам перемикає порожнє джерело, рідний екран «нічого не знайдено» з його кнопками не показуємо
        'body.lmx-online .activity.lmx-onl-eg .explorer__files-body{visibility:hidden}' +
        'body.lmx-online .activity.lmx-onl-load .explorer__files-head > *:not(.lmx-onl-hero):not(.lmx-onl-prog){display:none !important}' +
        'body.lmx-online .activity.lmx-onl-rl .explorer__files-body .scroll__body > *{display:none !important}' +
        'body.lmx-onl-pick .selectbox{opacity:0 !important}' +
        'body.lmx-online.lmx-onl-entering .explorer:not(.lmx-onl) .explorer__left,body.lmx-online.lmx-onl-entering .explorer:not(.lmx-onl) .explorer__files{opacity:0 !important}' +
        // панель пошуку джерел: на місці карток — прогрес і заготовки, які переливаються
        S + '.lmx-onl-prog{padding:.2em 0 1em}' +
        S + '.lmx-onl-prog__s{font-size:.95em;font-weight:600;opacity:.9;margin:.2em 0 .6em}' +
        // «Нічого не знайдено»: стандартний блок Lampa («Пошук на … не дав результатів», кнопки, сірі заглушки) ховаємо — замість нього наша панель
        S + '[class*="online-empty"]{display:none !important}' +
        S + '.lmx-onl-prog--end{display:flex;flex-direction:column;align-items:center;text-align:center;margin:.4em 0 1em;padding:2.4em 1.5em 2em;border-radius:1.2em;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}' +
        S + '.lmx-onl-prog--end::before{content:"";display:block;width:3.2em;height:3.2em;margin:0 0 .7em;opacity:.55;background:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'1.6\' stroke-linecap=\'round\'><circle cx=\'10.5\' cy=\'10.5\' r=\'6.5\'/><path d=\'M15.5 15.5L21 21M8 8l5 5M13 8l-5 5\'/></svg>") center/contain no-repeat}' +
        S + '.lmx-onl-prog--end .lmx-onl-prog__s{font-size:1.25em;font-weight:700;opacity:1;margin:0 0 .3em;max-width:34em}' +
        S + '.lmx-onl-prog--end .lmx-onl-dead{justify-content:center;margin-top:1.1em}' +
        S + '.lmx-onl-prog__b{height:.28em;border-radius:99em;background:rgba(255,255,255,.14);overflow:hidden;margin-bottom:1em}' +
        S + '.lmx-onl-prog__b i{display:block;height:100%;width:8%;border-radius:99em;background:#fff;transition:width .5s ease;animation:lmxBar 1.4s ease-in-out infinite alternate}' +
        '@keyframes lmxBar{0%{opacity:.55}100%{opacity:1}}' +
        S + '.lmx-onl-prog__f{display:flex;gap:1.3em;padding:.1em 0 .9em}' +
        S + '.lmx-onl-prog__f i{display:block;width:11em;height:2.6em;border-radius:99em;background:rgba(255,255,255,.08);animation:lmxShim 1.6s ease-in-out infinite}' +
        S + '.lmx-onl-prog--end .lmx-onl-prog__f{display:none}' +
        S + '.lmx-onl-prog__g{display:flex;gap:.9em}' +
        S + '.lmx-onl-prog__c{display:flex;flex-direction:column;box-sizing:border-box;flex:0 0 calc(20% - .72em);border-radius:1em;overflow:hidden;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.08);animation:lmxShim 1.6s ease-in-out infinite}' +
        S + '.lmx-onl-prog__c::before{content:"";display:block;width:100%;aspect-ratio:16/9;background:rgba(255,255,255,.12)}' +
        S + '.lmx-onl-prog__c::after{content:"";display:block;height:5.15em;background:linear-gradient(rgba(255,255,255,.2),rgba(255,255,255,.2)) .7em .75em/62% .85em no-repeat,linear-gradient(rgba(255,255,255,.13),rgba(255,255,255,.13)) .7em 2.15em/38% .7em no-repeat,linear-gradient(rgba(255,255,255,.13),rgba(255,255,255,.13)) .7em 3.8em/30% .8em no-repeat}' +
        '@media (max-width:1100px){' + S + '.lmx-onl-prog__c{flex-basis:calc(33.333% - .62em)}' + S + '.lmx-onl-prog__c:nth-child(n+4){display:none}}' +
        '@media (max-width:760px){' + S + '.lmx-onl-prog__c{flex-basis:calc(50% - .45em)}' + S + '.lmx-onl-prog__c:nth-child(n+3){display:none}}' +
        S + '.lmx-onl-prog__c:nth-child(2){animation-delay:.15s}' + S + '.lmx-onl-prog__c:nth-child(3){animation-delay:.3s}' + S + '.lmx-onl-prog__c:nth-child(4){animation-delay:.45s}' + S + '.lmx-onl-prog__c:nth-child(5){animation-delay:.6s}' +
        S + '.lmx-onl-prog--end .lmx-onl-prog__g,' + S + '.lmx-onl-prog--end .lmx-onl-prog__b{display:none}' +
        S + '.lmx-onl-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.6em 1.3em;padding:.1em 0 .9em}' +
        S + '.lmx-onl-g{display:inline-flex;align-items:center;gap:.4em}' +
        S + '.lmx-onl-g__l{font-size:.72em;font-weight:700;letter-spacing:.08em;opacity:.7;text-transform:uppercase}' +
        S + '.lmx-onl-pill{display:inline-flex;align-items:center;justify-content:space-between;margin:0;padding:.5em 1.3em;min-width:8.5em;font-size:.95em}' +
        S + '.lmx-onl-pill__c{font-style:normal;margin-left:.55em;opacity:.8}' +
        S + '.lmx-onl-pill__t{max-width:15em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        'body.lmx-onl-big ' + S.replace('body.lmx-online ', '') + '.explorer__files-body .scroll__body > .lmx-onl-item{flex:0 0 calc(33.333% - .62em) !important;width:calc(33.333% - .62em) !important}' +
        // режим «Список»: кожна серія — рядок на всю ширину
        'body.lmx-onl-list ' + S.replace('body.lmx-online ', '') + '.explorer__files-body .scroll__body > .lmx-onl-item{flex:0 0 100% !important;width:100% !important;flex-direction:row !important;align-items:center}' +
        'body.lmx-onl-list ' + S.replace('body.lmx-online ', '') + '.explorer__files-body .scroll__body > .lmx-onl-item > *:first-child{width:22% !important;flex:0 0 22%;border-radius:1em 0 0 1em}' +
        // шапка
        '.lmx-onl-hero{position:relative;flex:0 0 100%;width:100%;min-height:16em;margin:-1.5em -1.5em .8em;width:calc(100% + 3em);flex-basis:auto;padding:1.5em 3.2em 1.2em;border-radius:0 0 1.2em 1.2em;overflow:hidden;background:#161922;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end}' +
        '.lmx-onl-hero__bg{position:absolute;inset:0;background-size:cover;background-position:62% 0%;opacity:.95}' +
        '.lmx-onl-hero__sh{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,10,16,.92) 0%,rgba(8,10,16,.55) 45%,rgba(8,10,16,0) 80%),linear-gradient(0deg,rgba(8,10,16,.75) 0%,rgba(8,10,16,0) 55%)}' +
        '.lmx-onl-hero > *:not(.lmx-onl-hero__bg):not(.lmx-onl-hero__sh){position:relative;z-index:1}' +
        '.lmx-onl-hero__t{font-size:2.6em;font-weight:800;line-height:1.05;text-transform:uppercase;max-width:60%;visibility:hidden}' +
        '.lmx-onl-hero--tt .lmx-onl-hero__t{visibility:visible}' +
        '.lmx-onl-hero__lg{position:relative;display:flex;align-items:flex-end;height:5.4em;margin-bottom:.45em}' +
        '.lmx-onl-hero__lg .lmx-onl-hero__t{position:absolute;left:0;bottom:0;margin:0}' +
        '.lmx-onl-hero__logo{display:block;flex:0 0 auto;max-width:48%;height:100%;width:auto;object-fit:contain;object-position:left bottom}' +
        '.lmx-onl-hero__m{display:flex;align-items:center;gap:.9em;margin-top:.9em;font-weight:600}' +
        '.lmx-onl-hero__q{padding:.08em .5em;border-radius:.4em;background:rgba(255,255,255,.22);font-size:.8em;font-weight:800}' +
        '.lmx-onl-hero__o{margin-top:.7em;max-width:62%;font-size:.95em;line-height:1.4;opacity:.9;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
        '.lmx-onl-hero__a{display:flex;flex-wrap:wrap;align-items:center;gap:.7em;margin-top:1.3em}' +
        '.lmx-onl-btn{display:inline-flex;align-items:center;padding:.65em 1.6em;border-radius:99em;background:rgba(255,255,255,.2);font-weight:700;font-size:.95em}' +
        '.lmx-onl-btn--main{background:#fff;color:#111}' +
        '.lmx-onl-btn.focus{box-shadow:0 0 0 .16em #fff;transform:scale(1.05)}' +
        '.lmx-onl-btn--main.focus{background:#fff}' +
        '.lmx-onl-hero__src{margin-left:.4em;font-size:.9em;font-weight:600;opacity:.85}' +
        '.lmx-onl-hero__w{margin-top:1.1em;font-size:.85em;font-weight:600;opacity:.9}' +
        '.lmx-onl-hero__bar{position:absolute !important;left:0;right:0;bottom:0;height:.3em;background:rgba(255,255,255,.2)}' +
        '.lmx-onl-hero__bar i{display:block;height:100%;background:#fff}' +
        '@media (max-width:760px){.lmx-onl-hero{padding:1em 1.1em .9em;min-height:13em}.lmx-onl-hero__t{font-size:1.7em;max-width:90%}.lmx-onl-hero__o{max-width:100%}.lmx-onl-hero__logo{max-width:60%}}' +
        // Телефон: шапка й фільтри займали пів екрана, на серії лишалось 2–3 ряди. Стискаємо шапку, а фільтри ставимо в один рядок, що гортається вбік
        '@media (max-width:760px){.lmx-onl-hero{min-height:9.5em;margin-bottom:.4em}.lmx-onl-hero__w{margin-top:.5em}' + S + '.lmx-onl-bar{flex-wrap:nowrap;overflow-x:auto;gap:.5em .8em;padding:.1em 0 .5em;-webkit-overflow-scrolling:touch;scrollbar-width:none}' + S + '.lmx-onl-bar::-webkit-scrollbar{display:none}' + S + '.lmx-onl-bar .lmx-onl-g{flex:0 0 auto}' + S + '.lmx-onl-bar .lmx-onl-g__l{display:none}}';
    // Оформлення під тему, яку вибрано в LMX Pack (клас на body ставить LMX Pack: lmx-prem «Кіно», lmx-apple «Скло»; без нього — «Полегшена»)
    var THEME_CSS = (function () {
        var H = 'body.lmx-online ', P = H + '.explorer.lmx-onl ', K = 'body.lmx-prem ' + '.explorer.lmx-onl ', G = 'body.lmx-apple ' + '.explorer.lmx-onl ';
        var D = '"Oswald","Inter","Helvetica Neue",Arial,sans-serif', BG = '#0a0b10', GOLD = '#e9a24a', I = ' .lmx-onl-item';
        return '' +
            // ===== Кіно: темна плівка, Oswald, золотий акцент, прямокутні кнопки, біла рамка у фокусі =====
            'body.lmx-prem.lmx-online .explorer.lmx-onl{background:' + BG + '}' +
            K + '.lmx-onl-hero{background:' + BG + ';border-radius:0 0 .9em .9em}' +
            K + '.lmx-onl-hero__sh{background:linear-gradient(90deg,' + BG + ' 0%,rgba(10,11,16,.82) 34%,rgba(10,11,16,.2) 70%,rgba(10,11,16,0) 100%),linear-gradient(0deg,' + BG + ' 0%,rgba(10,11,16,.55) 32%,rgba(10,11,16,0) 62%)}' +
            K + '.lmx-onl-hero__t{font-family:' + D + ';font-weight:700;letter-spacing:.01em}' +
            K + '.lmx-onl-hero__q{background:none;padding:0;color:' + GOLD + ';letter-spacing:.14em;font-size:.85em}' +
            K + '.lmx-onl-hero__m span{color:#d8dcea}' +
            K + '.lmx-onl-btn{border-radius:.7em;background:rgba(255,255,255,.16);font-weight:600;padding:.7em 2em}' +
            K + '.lmx-onl-btn--main{background:#fff;color:' + BG + ';font-weight:700}' +
            K + '.lmx-onl-btn.focus{box-shadow:0 0 0 .18em #fff;transform:scale(1.04)}' +
            K + '.lmx-onl-hero__bar i,' + K + '.lmx-onl-prog__b i{background:' + GOLD + '}' +
            K + '.lmx-onl-hero__src{color:' + GOLD + ';opacity:1}' +
            K + '.lmx-onl-g__l{color:#aeb4c8;letter-spacing:.14em}' +
            K + '.lmx-onl-pill,' + K + '.lmx-onl-opt{border-radius:.7em;background:#14161f;border:1px solid rgba(255,255,255,.1)}' +
            K + '.lmx-onl-pill.focus,' + K + '.lmx-onl-opt.focus{background:#1c1f2c;border-color:transparent;box-shadow:0 0 0 .16em #fff}' +
            K + '.lmx-onl-opt--on{box-shadow:inset 0 0 0 .12em ' + GOLD + '}' +
            K + '.explorer__files-body .scroll__body > .lmx-onl-item{background:#14161f !important;border-radius:.8em;border:1px solid rgba(255,255,255,.06)}' +
            K + '.explorer__files-body .scroll__body > .lmx-onl-item.focus{background:#1c1f2c !important;border-color:transparent;box-shadow:0 0 0 .2em #fff}' +
            K + '.lmx-onl-item [class*="__title"]{font-family:' + D + ';font-weight:600;letter-spacing:.01em}' +
            K + '.lmx-onl-epi__n{color:#e8eaf2}' + K + '.lmx-onl-epi__d{color:' + GOLD + ';opacity:.9}' +
            // ===== Скло: напівпрозорі панелі з розмиттям, великі заокруглення =====
            G + '.lmx-onl-hero{border-radius:0 0 1.4em 1.4em}' +
            G + '.lmx-onl-btn,' + G + '.lmx-onl-pill,' + G + '.lmx-onl-opt{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22)}' +
            G + '.lmx-onl-btn--main{background:rgba(255,255,255,.92);color:#111;border-color:transparent}' +
            G + '.lmx-onl-btn.focus,' + G + '.lmx-onl-pill.focus,' + G + '.lmx-onl-opt.focus{box-shadow:0 0 0 .16em rgba(255,255,255,.95)}' +
            G + '.explorer__files-body .scroll__body > .lmx-onl-item{background:rgba(255,255,255,.1) !important;border:1px solid rgba(255,255,255,.16);border-radius:1.2em}' +
            G + '.explorer__files-body .scroll__body > .lmx-onl-item.focus{background:rgba(255,255,255,.2) !important;box-shadow:0 0 0 .18em rgba(255,255,255,.95)}' +
            G + '.lmx-onl-g__l{opacity:.6}' +
            // ===== Полегшена: без розмиттів, трохи м'якші картки =====
            'body.lmx-online:not(.lmx-prem):not(.lmx-apple) .explorer.lmx-onl .explorer__files-body .scroll__body > .lmx-onl-item{border-radius:1em}';
    })();
    // Оформлення екрана плагіна UAKino (компонент uakino_online) під ту саму тему: лише CSS, його навігацію й логіку не чіпаємо
    var UAK_CSS = (function () {
        var U = 'body.lmx-online .uakino-online ', BG = '#0a0b10', GOLD = '#e9a24a', D = '"Oswald","Inter","Helvetica Neue",Arial,sans-serif';
        var K = 'body.lmx-prem.lmx-online .uakino-online ', G = 'body.lmx-apple.lmx-online .uakino-online ';
        return '' +
            U + '.uakino-online__body{padding:0 2.4em 2.4em}' +
            // шапка як наш hero: велика назва, м'які градієнти, без окремого постера
            U + '.uakino-online__head{margin:0 -2.4em 1.2em;padding:1.8em 2.4em 1.4em;min-height:11em;align-items:flex-end;border-radius:0 0 1.2em 1.2em}' +
            U + '.uakino-online__hero-bg{opacity:.95;background-position:62% 0}' +
            U + '.uakino-online__hero-shade{background:linear-gradient(90deg,rgba(8,10,16,.92) 0%,rgba(8,10,16,.55) 45%,rgba(8,10,16,0) 80%),linear-gradient(0deg,#0b0d11 0%,rgba(8,10,16,.55) 40%,rgba(8,10,16,0) 70%)}' +
            U + '.uakino-online__poster{display:none}' +
            U + '.uakino-online__head-text{max-width:66%}' +
            U + '.uakino-online__head-title{font-size:2.6em;font-weight:800;line-height:1.05;text-transform:uppercase;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
            U + '.lmx-uak-hero .lmx-onl-hero__t{max-width:100%;font-size:2.6em}' +
            U + '.lmx-uak-hero .lmx-onl-hero__lg{margin-bottom:.2em}' +
            U + '.uakino-online__head-sub{margin-top:.9em;font-weight:600;color:rgba(255,255,255,.88)}' +
            U + '.uakino-online__badge{border:0;background:rgba(255,255,255,.22);border-radius:.4em;padding:.08em .5em;font-weight:800}' +
            U + '.uakino-online__badge--bad{background:rgba(255,159,67,.25)}' +
            U + '.uakino-online__head-descr{margin-top:.8em;max-width:62%;font-size:.95em;color:#fff;opacity:.9}' +
            // рядки джерела/сезонів — наші «пігулки»
            U + '.uakino-online__filters{margin:.2em 0 .5em;align-items:center}' +
            U + '.uakino-online__filter{padding:.55em 1.4em;border-radius:99em;background:rgba(255,255,255,.14);font-weight:700;font-size:.95em;border:1px solid transparent}' +
            U + '.uakino-online__tabs .uakino-online__filter{background:rgba(255,255,255,.08)}' +
            U + '.uakino-online__filter--active{background:rgba(255,255,255,.3) !important}' +
            U + '.uakino-online__filter.focus{background:rgba(255,255,255,.24) !important;color:#fff;box-shadow:0 0 0 .16em #fff;transform:scale(1.05)}' +
            U + '.uakino-online__filter--active.focus{background:rgba(255,255,255,.34) !important}' +
            U + '.uakino-online__filter.uakino-online__filter--help.focus{background:#2f86ff !important;box-shadow:0 0 0 .16em #fff}' +
            U + '.uakino-online__filter.uakino-online__filter--donate.focus{background:#ffd257 !important;box-shadow:0 0 0 .16em #fff}' +
            // картки серій
            U + '.uakino-online__list{margin:1.2em -.7em 0}' +
            U + '.uakino-online__thumb{border-radius:1em}' +
            U + '.uakino-online__num{font-weight:800;left:.6em;bottom:.4em}' +
            U + '.uakino-online__title{margin-top:.8em;font-weight:700}' +
            U + '.uakino-online__info{margin-top:.3em;font-weight:500}' +
            U + '.uakino-online__item.focus{transform:scale(1.05)}' +
            U + '.uakino-online__item.focus .uakino-online__thumb{box-shadow:0 0 0 .22em #fff,0 1.2em 2.4em rgba(0,0,0,.6)}' +
            U + '.uakino-online__empty{margin:1em 0;padding:3em 1em;border-radius:1.2em;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);font-size:1.1em;font-weight:600}' +
            // ===== Кіно =====
            'body.lmx-prem.lmx-online .uakino-online{background:' + BG + '}' +
            K + '.uakino-online__hero-shade{background:linear-gradient(90deg,' + BG + ' 0%,rgba(10,11,16,.82) 34%,rgba(10,11,16,.2) 70%,rgba(10,11,16,0) 100%),linear-gradient(0deg,' + BG + ' 0%,rgba(10,11,16,.55) 32%,rgba(10,11,16,0) 62%)}' +
            K + '.uakino-online__head-title{font-family:' + D + ';font-weight:700;letter-spacing:.01em}' +
            K + '.uakino-online__badge{background:none;padding:0;color:' + GOLD + ';letter-spacing:.14em}' +
            K + '.uakino-online__filter{border-radius:.7em;background:#14161f;border-color:rgba(255,255,255,.1);font-weight:600}' +
            K + '.uakino-online__tabs .uakino-online__filter{background:#14161f}' +
            K + '.uakino-online__filter--active{background:#1c1f2c !important;box-shadow:inset 0 0 0 .12em ' + GOLD + '}' +
            K + '.uakino-online__filter.focus{background:#1c1f2c !important;border-color:transparent}' +
            K + '.uakino-online__thumb{border-radius:.8em}' +
            K + '.uakino-online__title{font-family:' + D + ';font-weight:600;letter-spacing:.01em}' +
            K + '.uakino-online__num{color:' + GOLD + '}' +
            // ===== Скло =====
            G + '.uakino-online__head{border-radius:0 0 1.4em 1.4em}' +
            G + '.uakino-online__filter{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.22)}' +
            G + '.uakino-online__filter.focus{background:rgba(255,255,255,.26) !important;box-shadow:0 0 0 .16em rgba(255,255,255,.95)}' +
            G + '.uakino-online__thumb{border-radius:1.2em;border:1px solid rgba(255,255,255,.16)}';
    })();
    // Картки серій: «скляна» рамка з відступом, кадр із заокругленням, номер-бейдж, рейтинг пігулкою; рамка фокуса має те ж заокруглення, що й картка
    var CARD_CSS = (function () {
        var C = 'body.lmx-online .explorer.lmx-onl .explorer__files-body .lmx-onl-grid.lmx-onl-grid > .lmx-onl-item', GOLD = '#e9a24a';
        return '' +
            C + '{padding:.5em !important;border-radius:1.3em !important;background:rgba(255,255,255,.1) !important;border:1px solid rgba(255,255,255,.15);transition:background .15s ease,transform .15s ease,box-shadow .15s ease}' +
            C + '.focus{background:rgba(255,255,255,.2) !important;border-color:transparent;box-shadow:0 0 0 .2em #fff !important;transform:scale(1.03);z-index:2}' +
            C + ' > *:first-child{border-radius:.85em !important}' +
            C + ' > *:not(:first-child){padding-left:.45em !important;padding-right:.45em !important}' +
            // дуже довгу назву обрізаємо трикрапкою після трьох рядків (майже завжди назва вміщується повністю)
            C + ' [class*="__title"]{font-weight:700;font-size:1.05em;display:-webkit-box !important;-webkit-box-orient:vertical !important;-webkit-line-clamp:3 !important;line-clamp:3 !important;overflow:hidden !important;text-overflow:ellipsis !important;min-height:0 !important}' +
            C + ' [class*="episode-number"],' + C + ' [class*="__num"]:not([class*="__number-"]){position:absolute !important;left:.55em !important;top:.55em !important;right:auto !important;bottom:auto !important;transform:none !important;margin:0 !important;min-width:1.9em;padding:.12em .55em !important;border-radius:.6em;background:rgba(255,255,255,.92) !important;color:#111 !important;font-size:.9em !important;font-weight:800 !important;line-height:1.3 !important;text-align:center;text-shadow:none !important;z-index:3}' +
            C + ' .videos__item-imgbox[data-n]::before,' + C + ' [class*="imgbox"][data-n]::before{background:rgba(255,255,255,.92);color:#111;border-radius:.6em;font-weight:800}' +
            C + ' .online-prestige-split{display:none !important}' +
            // без «хвиль»: назва зверху, а смужка перегляду й рядок «рейтинг · дата · якість» завжди притиснуті до низу картки (однаково в усьому ряду)
            C + ' > [class*="__body"]{display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0}' +
            C + ' [class*="__head"]{flex:1 1 auto !important;align-items:flex-start}' +
            C + ' .time-line,' + C + ' [class*="__timeline"]{flex:0 0 auto;margin:.55em 0 .5em !important}' +
            C + ' [class*="__footer"],' + C + ' [class*="-footer"]{flex:0 0 auto;margin-top:0 !important;flex-wrap:wrap !important;row-gap:.3em}' +
            C + ' [class*="__info"]{flex:1 1 auto;flex-wrap:wrap !important;min-width:0;white-space:normal !important}' +
            C + ' [class*="__info"] > *,' + C + ' [class*="-footer"] > *{max-width:100% !important;min-width:0 !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important}' +
            C + ' [data-lmx-chip]{display:inline-flex !important;padding:.15em .65em !important;border-radius:99em;background:rgba(255,255,255,.14);font-weight:700;font-size:.9em;color:#f4d58a}' +
            C + ' [class*="__footer"],' + C + ' [class*="-footer"]{align-items:center !important;min-height:0 !important}' +
            C + ' [class*="__info"]{align-items:center !important;min-height:0 !important;gap:.3em .6em !important}' +
            C + ' [class*="-rate"]{display:inline-flex !important;align-items:center;gap:.35em;padding:.15em .65em;border-radius:99em;background:rgba(255,255,255,.12);font-size:.92em}' +
            C + ' [class*="__quality"]:not(:empty){margin-left:auto;align-self:center;min-height:0 !important;padding:.15em .65em;border-radius:99em;background:rgba(255,255,255,.12);font-weight:700}' +
            // Скло — справжнє розмиття; Кіно — темна панель із золотом; Полегшена — без розмиття
            'body.lmx-apple.lmx-online .explorer.lmx-onl .lmx-onl-grid.lmx-onl-grid > .lmx-onl-item{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}' +
            'body.lmx-prem.lmx-online .explorer.lmx-onl .lmx-onl-grid.lmx-onl-grid > .lmx-onl-item{background:#14161f !important;border-color:rgba(255,255,255,.08);border-radius:1em !important}' +
            'body.lmx-prem.lmx-online .explorer.lmx-onl .lmx-onl-grid.lmx-onl-grid > .lmx-onl-item.focus{background:#1c1f2c !important;border-color:transparent}' +
            'body.lmx-prem.lmx-online .explorer.lmx-onl .lmx-onl-grid.lmx-onl-grid > .lmx-onl-item [class*="episode-number"]{background:rgba(0,0,0,.7) !important;color:' + GOLD + ' !important}';
    })();
    function addCss() {
        var st = document.getElementById('lmx-online-css');
        if (!st) { st = document.createElement('style'); st.id = 'lmx-online-css'; document.head.appendChild(st); }
        st.textContent = CSS + THEME_CSS + CARD_CSS + UAK_CSS;
    }

    // серія, що ще не вийшла: джерела показують її напівпрозорою (як у Nova — «soon»); у «Продовжити/Наступна» її не враховуємо
    function isSoon(el) { var m = (el.getAttribute && el.getAttribute('style') || '').match(/opacity\s*:\s*([\d.]+)/); return !!m && (parseFloat(m[1]) || 1) < 0.9; }
    // прогрес серії читається з розмітки; за один прохід його питають по 5–6 разів на кожну серію (у довгих аніме — тисячі пошуків), тож тримаємо результат 0,3 с
    function pct(item) {
        var now = Date.now(), c = item.__lmxPc;
        if (c && now - c.t < 300) return c.v;
        var b = item.querySelector('.time-line > div'), w = b && b.style && b.style.width ? parseFloat(b.style.width) : 0;
        w = isFinite(w) ? w : 0;
        item.__lmxPc = { v: w, t: now };
        return w;
    }
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    // розбір data-json кожної серії викликається в багатьох циклах (сотні карток) — запам'ятовуємо результат на самому елементі, поки атрибут не змінився
    function jd(el) {
        var raw = el.getAttribute('data-json') || '{}', c = el.__lmxJ;
        if (c && c.r === raw) return c.v;
        var v; try { v = JSON.parse(raw) || {}; } catch (e) { v = {}; }
        el.__lmxJ = { r: raw, v: v };
        return v;
    }
    // розбір JSON зі сховища лише коли рядок справді змінився (джерела, озвучки, пам'ять читаються десятки разів за відкриття списку)
    function parseCached(slot, raw) {
        if (slot.r === raw && slot.ok) return slot.v;
        var v; try { v = JSON.parse(raw); } catch (e) { return undefined; }
        slot.r = raw; slot.v = v; slot.ok = true;
        return v;
    }
    var PC_SLOT = {}, LEARN_SLOT = {}, VC_SLOT = {};
    // Перегляд усього серіалу (усі сезони): по кожній серії дивимось позначку часу Lampa (хеш такий самий, як у онлайн-плагінів)
    function seriesStats(card) {
        try {
            if (!card || !card.seasons || !card.seasons.length || !Lampa.Timeline || !Lampa.Timeline.view || !Lampa.Utils || !Lampa.Utils.hash) return null;
            var ot = card.original_title || card.original_name || card.title || card.name || '', last = card.last_episode_to_air || null, per = {}, seen = 0, total = 0, order = [];
            card.seasons.forEach(function (se) {
                var sn = se.season_number, n = se.episode_count || 0, e, w = 0;
                if (!sn || sn < 1 || !n) return;
                if (last && sn > last.season_number) return;
                if (last && sn === last.season_number && last.episode_number) n = Math.min(n, last.episode_number);
                for (e = 1; e <= n; e++) {
                    var v = Lampa.Timeline.view(Lampa.Utils.hash([sn, sn > 10 ? ':' : '', e, ot].join('')));
                    if (v && v.percent >= 90) w++;
                }
                per[sn] = { seen: w, total: n };
                order.push(sn);
                seen += w; total += n;
            });
            return total ? { seen: seen, total: total, per: per, order: order } : null;
        } catch (e) { return null; }
    }
    // Сезон, з якого продовжити: останній, де вже щось дивились і не доглянули; якщо той закінчено — наступний. Нічого не дивились — null
    function targetSeason(ss) {
        var o = ss.order, i, last = -1;
        for (i = 0; i < o.length; i++) if (ss.per[o[i]].seen > 0) last = i;
        if (last < 0) return null;
        if (ss.per[o[last]].seen < ss.per[o[last]].total) return o[last];
        for (i = last + 1; i < o.length; i++) if (ss.per[o[i]].seen < ss.per[o[i]].total) return o[i];
        return null;
    }
    // Перемикаємо сезон через рідне меню фільтра джерела: «Сезон» → «N сезон»
    function gotoSeason(act, n) {
        var inst = instFor(act), g = inst && readSets(inst).season;
        if (g) {
            var j, rxn = new RegExp('(^|\\D)' + n + '(\\D|$)');
            for (j = 0; j < g.items.length; j++) if (rxn.test(String(g.items[j].title || ''))) { try { selIn(inst, 'filter', { stype: 'season' }, { index: idxOf(g, g.items[j]) }); } catch (e) {} return; }
            return;
        }
        var f = act.querySelector('.filter--filter');
        if (!f || selOpen()) return;
        var ctl = ''; try { ctl = Lampa.Controller.enabled().name; } catch (e) {}
        document.body.classList.add('lmx-onl-pick');
        window.__lmxAllowSel = Date.now();
        try { $(f).trigger('hover:enter'); } catch (e) {}
        var step = 1, k = 0, rx = new RegExp('(^|\\D)' + n + '\\D*(сезон|season)|^\\s*' + n + '\\s*$', 'i'), iv = setInterval(function () {
            var its = document.querySelectorAll('.selectbox-item'), j, t, hit = null;
            for (j = 0; j < its.length; j++) { t = its[j].querySelector('.selectbox-item__title'); t = t ? t.textContent : ''; if (step === 1 ? RX_SEASON.test(t) && !/\d/.test(t) : rx.test(t)) { hit = its[j]; break; } }
            if (hit) {
                try { $(hit).trigger('hover:enter'); } catch (e) {}
                if (step === 1) { step = 2; k = 0; document.body.classList.add('lmx-onl-pick'); return; }
                clearInterval(iv);
                setTimeout(function () { document.body.classList.remove('lmx-onl-pick'); }, 60);
            } else if (++k > 40) {
                clearInterval(iv);
                try { if (selOpen()) Lampa.Select.close(); if (ctl) Lampa.Controller.toggle(ctl); } catch (e) {}
                document.body.classList.remove('lmx-onl-pick');
            }
        }, 80);
    }
    function qual(items) {
        var m, i, t;
        for (i = 0; i < items.length && i < 6; i++) {
            t = items[i].textContent || '';
            m = t.match(/\b(4K|2160p?|FHD|1080p?|HD|720p?)\b/i);
            if (m) return m[1].toUpperCase().replace(/^1080P?$/, 'FHD').replace(/^2160P?$/, '4K');
        }
        return '';
    }

    // Фон банера з'являється плавно, коли картинка завантажена (раніше банер миттєво «вистрибував» поверх порожнього місця)
    function fadeBg(h) {
        var bg = h.querySelector('.lmx-onl-hero__bg'), m;
        if (!bg) return;
        m = String(bg.style.backgroundImage || '').match(/url\(["']?([^"')]+)/);
        if (!m) { bg.style.opacity = ''; return; }
        var im = new Image();
        im.onload = function () { bg.style.transition = 'opacity .45s ease'; bg.style.opacity = ''; };
        im.onerror = function () { bg.style.opacity = ''; };
        im.src = m[1];
        if (im.complete && im.naturalWidth) { bg.style.transition = 'none'; bg.style.opacity = ''; }
    }
    function capKeys(o, max) { var ks = Object.keys(o), i; if (ks.length > max) for (i = 0; i < ks.length - max; i++) delete o[ks[i]]; }
    var logoCache = {};
    function pickLogo(list) {
        var best = null, bs = -1;
        (list || []).forEach(function (l) {
            if (!l || !l.file_path) return;
            var sc = l.iso_639_1 === 'uk' ? 3 : (l.iso_639_1 === 'en' ? 2 : (!l.iso_639_1 ? 1 : 0));
            if (!sc) return;
            sc = sc * 1000 + (l.vote_average || 0) * 10;
            if (sc > bs) { bs = sc; best = l; }
        });
        return best && best.file_path;
    }
    function putLogo(hero, card) {
        var kind = (card.name || card.first_air_date || card.number_of_seasons) ? 'tv' : 'movie', key = kind + card.id, done = false;
        // Назва під логотипом схована, поки не з'ясується, є логотип чи ні (щоб текст не блимав перед логотипом)
        function showTitle() { if (!done) { done = true; hero.classList.add('lmx-onl-hero--tt'); } }
        // Місце під логотип/назву завжди однакове за висотою — шапка не стрибає, коли логотип дозавантажується
        (function () {
            var t = hero.querySelector('.lmx-onl-hero__t');
            if (!t || hero.querySelector('.lmx-onl-hero__lg')) return;
            var lg = document.createElement('div'); lg.className = 'lmx-onl-hero__lg';
            hero.insertBefore(lg, t); lg.appendChild(t);
        })();
        setTimeout(showTitle, 2200);
        function show(path) {
            if (!path || !hero.parentNode) return showTitle();
            var im = document.createElement('img');
            im.className = 'lmx-onl-hero__logo';
            im.onload = function () {
                done = true; hero.classList.remove('lmx-onl-hero--tt');
                var t = hero.querySelector('.lmx-onl-hero__t'); if (t && im.parentNode) t.style.display = 'none';
                var ar = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 3;
                im.style.maxWidth = Math.max(22, Math.min(52, Math.round(ar * 11))) + '%';
            };
            im.onerror = function () { if (!im.__retry) { im.__retry = 1; im.src = img(path, 'original'); } else { if (im.parentNode) im.parentNode.removeChild(im); showTitle(); } };
            im.src = img(path, 'w500');
            var t0 = hero.querySelector('.lmx-onl-hero__t');
            var lg0 = hero.querySelector('.lmx-onl-hero__lg');
            if (lg0) lg0.insertBefore(im, lg0.firstChild); else if (t0) hero.insertBefore(im, t0);
            if (im.complete && im.naturalWidth) im.onload();
        }
        if (key in logoCache) return show(logoCache[key]);
        if (!(Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb && card.id)) return showTitle();
        Lampa.Api.sources.tmdb.get(kind + '/' + card.id + '/images?include_image_language=uk%2Cen%2Cnull', {}, function (j) {
            logoCache[key] = pickLogo(j && j.logos); capKeys(logoCache, 80);
            show(logoCache[key]);
        }, function () { showTitle(); });
    }

    // Джерело (або TMDB) не дало кадр серії — підставляємо кадр із фону серіалу, щоб картки не були порожніми
    function thumbFallback(list, card) {
        var bg = card && (card.backdrop_path || card.poster_path);
        if (!bg) return;
        var url = img(bg, artMax() ? 'w780' : 'w500'), i, box, im;
        for (i = 0; i < list.length; i++) {
            if (list[i].__lmxTF && list[i].classList.contains('lmx-onl-off')) continue;   // сховану серію вже оформлювали
            list[i].__lmxTF = 1;
            box = list[i].querySelector('.videos__item-imgbox, [class*="imgbox"], [class*="prestige__img"]');
            if (!box) {
                // у картці зовсім немає місця під постер (джерело без картинок) — додаємо власне, з кадром фільму
                if (list[i].querySelector('img')) continue;
                box = document.createElement('div'); box.className = 'videos__item-imgbox';
                list[i].insertBefore(box, list[i].firstChild);
                if (list[i].parentNode) list[i].parentNode.classList.add('lmx-onl-grid');
            }
            im = box.querySelector('img');
            // Lampa підставляє заглушку (img_load / img_broken), коли в TMDB немає кадру серії — вона «завантажується», але нічого не показує
            if (im && im.complete && im.naturalWidth > 0 && !/img_(load|broken)|placeholder|broken|blank/i.test(im.currentSrc || im.src || '')) { box.classList.remove('lmx-onl-nothumb'); box.style.removeProperty('background-image'); continue; }
            box.classList.add('lmx-onl-nothumb'); box.style.setProperty('background-image', 'url("' + url + '")', 'important');
        }
    }
    // Порядок серій і сторінки довгих сезонів (як у Nova: 10 / 20 / 50 серій на сторінку). Серії поза сторінкою ховаємо й забираємо з навігації
    var PAGING = true;   // довгі сезони (понад 60 серій) ділимо на сторінки — сотні карток разом гальмують ТВ
    function pageSizeOf(total) { return 30; }   // менша сторінка — менше карток і картинок одночасно на екрані (довгі аніме на ТВ)
    // Довгі серіали (1200+ серій): картинки прихованих сторінок не вантажимо — телевізор інакше тримає в пам'яті сотні постерів і зависає; повертаємо, коли сторінку відкрито
    function imgDefer(el, off) {
        try {
            var im = el.getElementsByTagName('img'), k, x;
            for (k = 0; k < im.length; k++) {
                x = im[k];
                if (off) { var sv = x.getAttribute('src'); if (sv && !x.__lmxS) { x.__lmxS = sv; x.removeAttribute('src'); } }
                else if (x.__lmxS) { if (!x.getAttribute('src')) x.setAttribute('src', x.__lmxS); x.__lmxS = null; }
            }
        } catch (e) {}
    }
    function applyOrderPages(act, list) {
        var total = list.length, rev = orderRev(), i, el;
        for (i = 0; i < total; i++) list[i].style.order = rev ? String(total - i) : '';
        var size = pageSizeOf(total);
        if (!PAGING || total <= 60) {
            act.__lmxPages = null;
            for (i = 0; i < total; i++) { el = list[i]; if (el.classList.contains('lmx-onl-off')) { el.classList.remove('lmx-onl-off'); el.classList.add('selector'); el.style.removeProperty('display'); } }
            return;
        }
        var n = Math.ceil(total / size), j0 = jd(list[0]), key = total + '|' + (j0.season || '') + '|' + (j0.voice || '');
        if (act.__lmxPK !== key) {
            act.__lmxPK = key;
            var fu = 0, lw = -1; for (i = 0; i < total; i++) if (pct(list[i]) >= 1) lw = i; if (lw >= 0) fu = Math.min(total - 1, pct(list[lw]) >= 90 ? lw + 1 : lw);
            act.__lmxPage = Math.floor(fu / size);
        }
        var pg = Math.min(n - 1, Math.max(0, act.__lmxPage | 0));
        act.__lmxPage = pg;
        for (i = 0; i < total; i++) {
            el = list[i];
            if (Math.floor(i / size) === pg) { el.classList.remove('lmx-onl-off'); el.style.removeProperty('display'); if (!el.classList.contains('selector')) el.classList.add('selector'); if (total > 300) imgDefer(el, false); }
            else { el.classList.add('lmx-onl-off'); el.style.setProperty('display', 'none', 'important'); el.classList.remove('selector', 'focus'); if (total > 300) imgDefer(el, true); }
        }
        act.__lmxPages = { size: size, n: n, total: total, pg: pg };
    }
    function pageLabel(pgs, k) { var a = k * pgs.size + 1, b = Math.min(pgs.total, (k + 1) * pgs.size); return a + '\u2013' + b; }
    // Тривалість у картці фільму: джерела пишуть «02:32» (години:хвилини), що читається як 2 хвилини. Якщо значення збігається з тривалістю фільму
    // як Г:ХХ — показуємо «2 г 32 хв»
    // Слоган фільму («Ласкаво просимо у світ без правил.») джерело дописує в рядок інформації — ховаємо його
    // Назву озвучки в картці не показуємо: озвучку вибирають зверху
    function hideVoice(act, list) {
        var names = [];
        try { var ii = instFor(act), Sv = ii && readSets(ii), g = Sv && Sv.voice; if (g) g.items.forEach(function (it) { if (it && it.title) names.push(String(it.title).toLowerCase().replace(/[^\wа-яіїєґ]+/gi, ' ').trim()); }); } catch (e) {}
        if (!names.length) return;
        list.forEach(function (it) {
            [].forEach.call(it.querySelectorAll('[class*="__info"] *, [class*="-footer"] *, [class*="__footer"] *'), function (n) {
                if (n.children.length || n.getAttribute('data-lmx-vc')) return;
                var nt = String(n.textContent || '').toLowerCase().replace(/[^\wа-яіїєґ]+/gi, ' ').trim();
                if (nt && names.indexOf(nt) >= 0) { n.setAttribute('data-lmx-vc', '1'); n.style.setProperty('display', 'none', 'important'); }
            });
        });
    }
    function hideTagline(list, card) {
        if (!card || card.number_of_seasons || (card.first_air_date && !card.release_date)) return;
        var norm = function (t) { return String(t || '').toLowerCase().replace(/[^\wа-яіїєґ]+/gi, ' ').trim(); }, tg = norm(card.tagline);
        list.forEach(function (it) {
            [].forEach.call(it.querySelectorAll('[class*="__info"] *, [class*="-footer"] *, [class*="__footer"] *'), function (n) {
                if (n.children.length || n.getAttribute('data-lmx-tg')) return;
                var t = String(n.textContent || '').trim(), nt = norm(t);
                if (!nt) return;
                var hit = tg ? (nt === tg || (tg.length > 8 && (nt.indexOf(tg) >= 0 || tg.indexOf(nt) >= 0))) : (t.length >= 24 && nt.split(' ').length >= 4 && !/\d{4}/.test(t));
                if (hit) { n.setAttribute('data-lmx-tg', '1'); n.style.setProperty('display', 'none', 'important'); }
            });
        });
    }
    // Після приховування озвучки/слогану в рядку інформації лишаються сусідні роздільники («●  ●»): прибираємо зайві, початкові й кінцеві
    function isSep(k) {
        if (/split|separ|divider|\bdot\b|-dot|__dot/i.test(String(k.className))) return true;
        var t = String(k.textContent || '').trim();
        return !k.children.length && (t === '' || /^[\u25CF\u2022\u00B7|\/\-\u2013\u2014]+$/.test(t));
    }
    function dropDupDates(list) {
        list.forEach(function (it) {
            var nodes = [].slice.call(it.querySelectorAll('[class*="__info"] *, [class*="-footer"] *, [class*="__footer"] *')).filter(function (n) { return !n.children.length; });
            var words = nodes.some(function (n) { return /\d{1,2}\s+[А-Яа-яІіЇїЄє]{3,}/.test(n.textContent || ''); });
            if (!words) return;
            nodes.forEach(function (n) { if (/^\s*\d{1,2}\.\d{1,2}\.\d{4}\s*$/.test(n.textContent || '')) { n.setAttribute('data-lmx-sep', '1'); n.style.setProperty('display', 'none', 'important'); } });
        });
    }
    // Довга назва місяця («30 Листопада 2004») не вміщається в рядок з рейтингом і переходить на другий рядок, ламаючи рівність карток.
    // Якщо хоч в одній картці дата переноситься — скорочуємо місяць у всіх картках списку («30 лис. 2004»), щоб вигляд був однаковий
    var MON = { 'січня': 'січ.', 'лютого': 'лют.', 'березня': 'бер.', 'квітня': 'кві.', 'травня': 'тра.', 'червня': 'чер.', 'липня': 'лип.', 'серпня': 'сер.', 'вересня': 'вер.', 'жовтня': 'жов.', 'листопада': 'лис.', 'грудня': 'гру.' };
    // Дата в картці: фільм — лише рік; серіал — «28 чер. 2005». Назва озвучки в рядку, що повторює заголовок картки, ховається
    function shortDates(list, card) {
        var tv = !!(card && (card.number_of_seasons || (card.first_air_date && !card.release_date)));
        var nm = function (t) { return String(t || '').toLowerCase().replace(/[^\wа-яіїєґ]+/gi, ' ').trim(); };
        list.forEach(function (it) {
            var ti = it.querySelector('[class*="__title"]'), tt = ti ? nm(ti.textContent) : '';
            [].forEach.call(it.querySelectorAll('[class*="__info"] *, [class*="-footer"] *, [class*="__footer"] *'), function (n) {
                if (n.children.length) return;
                // «Залишилось 5 днів» (серія ще не вийшла) → «Ще 5 дн.»; «14 Листопада» без року → «14 лис.»: короткі позначки завжди вміщаються в картку
                var t0 = String(n.textContent || ''), cd = t0.match(/^\s*Залишил[а-яіїє]*\s+(\d+)\s*(?:дн[а-яіїє]*|д)\.?\s*$/i), dm = t0.match(/^\s*(\d{1,2})\s+([А-Яа-яІіЇїЄє']{3,})\s*$/);
                if (cd) { n.setAttribute('data-lmx-chip', '1'); n.textContent = 'Ще ' + cd[1] + ' дн.'; return; }
                if (dm && MON[dm[2].toLowerCase()] && tv) { n.textContent = dm[1] + ' ' + MON[dm[2].toLowerCase()]; return; }
                var t = n.getAttribute('data-lmx-full') || n.textContent || '', m = t.match(/^\s*(\d{1,2})\s+([А-Яа-яІіЇїЄє']{3,})\s+(\d{4})\s*$/);
                if (m && MON[m[2].toLowerCase()]) {
                    n.setAttribute('data-lmx-full', t); n.setAttribute('data-lmx-sd', '1');
                    var v = tv ? m[1] + ' ' + MON[m[2].toLowerCase()] + ' ' + m[3] : m[3];
                    if (n.textContent !== v) n.textContent = v;
                    return;
                }
                if (tt && !n.getAttribute('data-lmx-vc') && nm(t) === tt) { n.setAttribute('data-lmx-vc', '1'); n.style.setProperty('display', 'none', 'important'); }
            });
        });
    }
    function fitDates(list) {
        var rows = [], vis = false, wrap = false;
        list.forEach(function (it) {
            if (it.classList.contains('lmx-onl-off')) return;   // сховані сторінки довгих сезонів не вимірюємо
            [].forEach.call(it.querySelectorAll('[class*="__info"], [class*="-footer"], [class*="__footer"]'), function (box) {
                var nodes = [].slice.call(box.querySelectorAll('*')).filter(function (n) { return !n.children.length && n.offsetHeight; });
                nodes.forEach(function (n) {
                    if (n.getAttribute('data-lmx-sd')) return;   // дату вже скоротив shortDates — не відновлюємо повну
                    var t = n.getAttribute('data-lmx-full') || n.textContent || '', m = t.match(/^\s*(\d{1,2})\s+([А-Яа-яІіЇїЄє']{4,})\s+(\d{4})\s*$/);
                    if (!m || !MON[m[2].toLowerCase()]) return;
                    n.setAttribute('data-lmx-full', t);
                    if (n.textContent !== t) n.textContent = t;
                    rows.push({ n: n, first: nodes[0], m: m });
                });
            });
        });
        rows.forEach(function (r, ri) {
            if (wrap || ri > 40 || !r.n.offsetHeight) return;   // досить перших рядків: перенос видно одразу, далі лише читання розмітки без користі
            vis = true;
            if (r.first !== r.n && r.n.getBoundingClientRect().top - r.first.getBoundingClientRect().top > r.n.offsetHeight * 0.6) wrap = true;
        });
        if (!vis || !wrap) return;
        rows.forEach(function (r) { r.n.textContent = r.m[1] + ' ' + MON[r.m[2].toLowerCase()] + ' ' + r.m[3]; });
    }
    function tidySeps(list) {
        list.forEach(function (it) {
            [].forEach.call(it.querySelectorAll('[class*="__info"], [class*="-footer"], [class*="__footer"]'), function (box) {
                var kids = [].slice.call(box.children), out = [], i, k;
                kids.forEach(function (k) { if (k.getAttribute('data-lmx-sep')) { k.style.removeProperty('display'); k.removeAttribute('data-lmx-sep'); } });
                for (i = 0; i < kids.length; i++) {
                    k = kids[i];
                    if (k.style.display === 'none' || (window.getComputedStyle && getComputedStyle(k).display === 'none')) continue;
                    if (isSep(k)) { if (out.length && !isSep(out[out.length - 1])) out.push(k); else { k.setAttribute('data-lmx-sep', '1'); k.style.setProperty('display', 'none', 'important'); } }
                    else out.push(k);
                }
                while (out.length && isSep(out[out.length - 1])) { k = out.pop(); k.setAttribute('data-lmx-sep', '1'); k.style.setProperty('display', 'none', 'important'); }
            });
        });
    }
    function fixTimes(list, card) {
        var rt = card && parseInt(card.runtime, 10) || 0;
        // Серіал: джерела пишуть тривалість як «00:44» (години:хвилини), і воно читається як 44 секунди. Показуємо «44 хв» / «1 г 5 хв»
        if (card && (card.number_of_seasons || (card.first_air_date && !card.release_date))) {
            list.forEach(function (it) {
                [].forEach.call(it.querySelectorAll('*'), function (n) {
                    if (n.children.length || n.getAttribute('data-lmx-t') || n.closest('.time-line')) return;
                    var m = String(n.textContent || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
                    if (!m) return;
                    var a = parseInt(m[1], 10), b = parseInt(m[2], 10), mins;
                    if (m[3] !== undefined) mins = a * 60 + b;             // Г:ХХ:СС
                    else if (a <= 3) mins = a * 60 + b;                    // Г:ХХ
                    else mins = a;                                         // ХХ:СС — хвилини
                    if (!mins) return;                                    // 00:00 — лишаємо для підстановки з TMDB
                    n.textContent = fmtRun(mins); n.setAttribute('data-lmx-t', '1');
                });
            });
            return;
        }
        if (rt < 60) return;
        list.forEach(function (it) {
            [].forEach.call(it.querySelectorAll('*'), function (n) {
                if (n.children.length || n.getAttribute('data-lmx-t') || n.closest('.time-line')) return;
                var m = String(n.textContent || '').trim().match(/^(\d{1,2}):(\d{2})$/);
                if (!m) return;
                var a = parseInt(m[1], 10), b = parseInt(m[2], 10), hm = a * 60 + b;
                if (b < 60 && Math.abs(hm - rt) <= 15 && Math.abs(a - rt) > 15) { n.textContent = a + ' г ' + b + ' хв'; n.setAttribute('data-lmx-t', '1'); }
            });
        });
    }
    // Інформація про серію (як у Nova): назва, дата виходу, тривалість із TMDB. Джерела часто пишуть «00:00» — підставляємо справжню тривалість
    var epCache = {};
    function fmtRun(m) { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + ' г ' + (m % 60 ? (m % 60) + ' хв' : '') : m + ' хв'; }
    function fmtDate(d) { var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
    function timeNode(it) {
        var all = it.querySelectorAll('*'), i, n;
        for (i = 0; i < all.length; i++) { n = all[i]; if (!n.children.length && !n.closest('.time-line') && /^\s*\d{1,2}:\d{2}(:\d{2})?\s*$/.test(n.textContent || '')) return n; }
        return null;
    }
    function epInfo(list, card, act) {
        if (!list.length || !card || !card.id) return;
        var isTv = !!(card.name || card.number_of_seasons || (card.first_air_date && !card.release_date));
        function zero(n) { return n && /^\s*0{1,2}:0{2}(:0{2})?\s*$/.test(n.textContent || ''); }
        if (!isTv) {
            var rt = parseInt(card.runtime, 10) || 0;
            list.forEach(function (it) { var n = timeNode(it); if (zero(n)) { if (rt) { n.textContent = fmtRun(rt); n.setAttribute('data-lmx-t', '1'); } else n.style.display = 'none'; } });
            return;
        }
        var sn = parseInt(jd(list[0]).season, 10) || 0;
        if (!sn) { var mm = String((list[0].textContent || '')).match(/сезон\s*(\d+)|season\s*(\d+)/i); sn = mm ? parseInt(mm[1] || mm[2], 10) : 0; }
        if (!sn && act) {
            try { var Sx = instFor(act) && readSets(instFor(act)), sg = Sx && Sx.season, si = sg && selItem(sg), m1 = si && String(si.title || '').match(/\d+/); if (m1) sn = parseInt(m1[0], 10); } catch (e) {}
            if (!sn) { var m2 = filterText(act).match(/(\d+)\s*сезон|сезон\s*:?\s*(\d+)|season\s*:?\s*(\d+)/i); if (m2) sn = parseInt(m2[1] || m2[2] || m2[3], 10) || 0; }
        }
        if (!sn) {
            // сезон невідомий — хоча б виправляємо «00:00» тривалістю серії з картки серіалу
            var r0 = card.episode_run_time && card.episode_run_time[0] || 0;
            list.forEach(function (it) { var n = timeNode(it); if (zero(n)) { if (r0) { n.textContent = fmtRun(r0); n.setAttribute('data-lmx-t', '1'); } else n.style.display = 'none'; } });
            return;
        }
        var key = card.id + '_' + sn;
        function apply(eps) {
            var mk = key + (eps ? 'm' : 'n');
            list.forEach(function (it, idx) {
                if (!it.parentNode || it.__lmxEI === mk || it.classList.contains('lmx-onl-off')) return;   // сховані сторінки оформимо, коли їх відкриють   // ця серія вже оформлена з цими даними — не чіпаємо (сотні серій аніме гальмували)
                it.__lmxEI = mk;
                var j = jd(it), num = parseInt(j.episode, 10) || (idx + 1), e = eps && eps[num], n = timeNode(it);
                var run = (e && e.runtime) || (card.episode_run_time && card.episode_run_time[0]) || 0;
                if (zero(n)) { if (run) { n.textContent = fmtRun(run); n.setAttribute('data-lmx-t', '1'); } else n.style.display = 'none'; }
                var x = it.querySelector('.lmx-onl-epi'), full = String(it.textContent || '').toLowerCase().replace(/\s+/g, ' ');
                var nm = e && e.name && !/^(серія|эпизод|episode)\s*\d+$/i.test(e.name.trim()) ? e.name : '', dt = e && fmtDate(e.air_date);
                // джерело вже могло показати назву й дату серії (Makhno): не дублюємо
                var has = x ? String(x.textContent || '').toLowerCase().replace(/\s+/g, ' ') : '';
                if (has) full = full.replace(has, ' ');
                if (nm && full.indexOf(nm.toLowerCase().replace(/\s+/g, ' ')) >= 0) nm = '';
                if (dt && (full.indexOf(dt) >= 0 || /\d{1,2}\s+[а-яіїєґ]{3,}\.?(\s+\d{4})?/.test(full) || /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(full))) dt = '';   // дата в картці вже є (повна чи скорочена) — другу не додаємо
                if (!nm && !dt) { if (x && x.parentNode) x.parentNode.removeChild(x); return; }
                if (!x) {
                    x = document.createElement('div'); x.className = 'lmx-onl-epi';
                    // вставляємо ПІСЛЯ рядка з назвою (а не поруч із назвою всередині flex-рядка — тоді назва стискається в вузьку колонку)
                    var tt = it.querySelector('[class*="__title"], [class*="title"]'), row = tt;
                    while (row && row.parentNode && row.parentNode !== it) row = row.parentNode;
                    if (row && row.parentNode === it) it.insertBefore(x, row.nextSibling); else it.appendChild(x);
                }
                x.innerHTML = (nm ? '<div class="lmx-onl-epi__n">' + esc(nm) + '</div>' : '') + (dt ? '<div class="lmx-onl-epi__d">' + dt + '</div>' : '');
            });
        }
        if (epCache[key]) return apply(epCache[key]);
        apply(null);
        try {
            Lampa.Api.sources.tmdb.get('tv/' + card.id + '/season/' + sn, {}, function (r) {
                var map = {}; ((r && r.episodes) || []).forEach(function (e) { map[e.episode_number] = e; });
                epCache[key] = map; capKeys(epCache, 12); apply(map);
            }, function () {});
        } catch (e) {}
    }
    // «Залишилось N хв» під смужкою для частково переглянутої серії (як у Nova)
    function leftTimes(list) {
        list.forEach(function (el) {
            var tl = jd(el).timeline, v = null;
            try { if (tl && tl.hash !== undefined && Lampa.Timeline && Lampa.Timeline.view) v = Lampa.Timeline.view(tl.hash); } catch (e) {}
            v = v || tl || {};
            var left = v.duration && v.time ? Math.round((v.duration - v.time) / 60) : 0, line = el.querySelector('.time-line'), ex = el.querySelector('.lmx-onl-left');
            if (!(v.percent >= 1 && v.percent < 90 && left > 0 && line)) { if (ex && ex.parentNode) ex.parentNode.removeChild(ex); return; }
            if (!ex) { ex = document.createElement('div'); ex.className = 'lmx-onl-left'; line.parentNode.insertBefore(ex, line.nextSibling); }
            ex.textContent = 'Залишилось ' + (left >= 60 ? Math.floor(left / 60) + ' г ' + (left % 60) + ' хв' : left + ' хв');
        });
    }
    function numberItems(list) {
        for (var i = 0; i < list.length; i++) {
            var box = list[i].querySelector('.videos__item-imgbox');
            if (box && !box.hasAttribute('data-n')) box.setAttribute('data-n', i < 9 ? '0' + (i + 1) : String(i + 1));
        }
    }
    function settleHold(act) {
        try {
            // лише на переході «завантаження → список»; повторні виклики не перезапускають приховування (інакше список блимав би знову)
            if (act.classList.contains('lmx-onl-hold') || !(act.classList.contains('lmx-onl-load') || act.classList.contains('lmx-onl-rl'))) return;
            act.classList.add('lmx-onl-hold');
            // поки список схований, прокрутка йде без анімації — картки не «їдуть» і не «сповзають» на очах
            var sb = act.querySelector('.explorer__files-body .scroll__body'); if (sb) sb.classList.add('notransition');
            var t0 = Date.now(), last = -1, same = 0;
            clearTimeout(act.__lmxHT);
            // Показуємо список, коли він перестав рости (джерело домальовує картки по одній): мінімум 0,3 с, максимум 1,5 с
            (function poll() {
                act.__lmxHT = setTimeout(function () {
                    try {
                        var n = act.querySelectorAll('.explorer__files-body .selector').length, el = Date.now() - t0;
                        if (n === last) same++; else { same = 0; last = n; }
                        var raw = act.querySelectorAll('.explorer__files-body .scroll__body > .selector:not(.lmx-onl-item):not(.lmx-onl-wide):not(.lmx-onl-btn):not(.videos__season)').length;
                        if (!document.body.contains(act) || (el >= 250 && same >= 2 && raw === 0) || el >= 1600) {
                            act.classList.remove('lmx-onl-hold'); act.classList.add('lmx-onl-fadein');
                            var b2 = act.querySelector('.explorer__files-body .scroll__body'); if (b2) b2.classList.remove('notransition');
                            setTimeout(function () { try { act.classList.remove('lmx-onl-fadein'); } catch (e) {} }, 260);
                            return;
                        }
                        poll();
                    } catch (e) { try { act.classList.remove('lmx-onl-hold'); } catch (x) {} }
                }, 100);
            })();
        } catch (e) {}
    }
    function press(el) { window.__lmxAllowSel = Date.now(); try { $(el).trigger('hover:enter'); } catch (e) { try { el.click(); } catch (x) {} } }
    // Після перемальовування списку/шапки колекція фокусованих елементів Lampa застаріває (старі вузли видалено, нові в ній відсутні) —
    // стрілки й виділення перестають працювати. Перезбираємо її рідним способом і, якщо фокус загублено, ставимо його на першу серію/кнопку
    // Утримання фокуса: після вибору сезону/озвучки/джерела кілька механізмів (resync, recover, viewGuard, рідний фокус Lampa) по черзі
    // ставили фокус то на кнопку «Дивитись», то на першу картку, то на «Сортувати» — рамка стрибала туди-сюди. Поки йде перезавантаження і ще
    // 2 с після нього, лише цей цикл тримає фокус на пілюлі, яку щойно обрав користувач (або на кнопці шапки при першому показі); натискання клавіші його вимикає
    function holdFocus(act, key, ms) {
        var t0 = Date.now();
        act.__lmxHold = { key: key, until: t0 + ms, t0: t0 };
        clearInterval(act.__lmxHI);
        act.__lmxHI = setInterval(function () {
            safe(function () {
                var h = act.__lmxHold;
                if (!h || !document.body.contains(act) || Date.now() > h.until || (window.__lmxKeyT || 0) > t0 || (window.__lmxTouchT || 0) > t0) { clearInterval(act.__lmxHI); act.__lmxHold = null; return; }
                if (selOpen() || act.__lmxOpen) return;
                var tg = h.key === 'hero' ? act.querySelector('.lmx-onl-hero .lmx-onl-btn.selector') : act.querySelector('.lmx-onl-g--' + h.key + ' .selector');
                if (!tg || !(tg.offsetWidth || tg.offsetHeight)) return;
                var f = act.querySelector('.focus');
                if (f === tg) return;
                var cn = Lampa.Controller.enabled(); if (cn && cn.name && cn.name !== 'content') return;
                ctlContent();
                if (window.Navigator && Navigator.focus) Navigator.focus(tg);
            });
        }, 90);
    }
    function holdMore(act, ms) { if (act.__lmxHold) act.__lmxHold.until = Math.max(act.__lmxHold.until, Date.now() + ms); }
    function resync(act, force) {
        clearTimeout(act.__lmxRS);
        function pass(final) {
            safe(function () {
                if (!document.body.contains(act) || selOpen() || act.__lmxHold) return;
                if (!force && ((window.__lmxKeyT || 0) > Date.now() - 400 || (window.__lmxTouchT || 0) > Date.now() - 5000)) return;
                var c = Lampa.Controller.enabled(), nm = c && c.name;
                // 'select' без відкритого меню — застарілий стан після вкладених меню фільтра: керування «залипло» на закритому меню
                if (nm === 'content' || nm === 'select' || !nm) Lampa.Controller.toggle('content');
                else if (!final) return;
                setTimeout(function () {
                    safe(function () {
                        if (okFocus(act) || !window.Navigator || !Navigator.focus) return;
                        var cn = Lampa.Controller.enabled(); if (cn && cn.name && cn.name !== 'content') return;
                        var t = act.querySelector('.lmx-onl-btn.selector') || act.querySelector('.lmx-onl-item');
                        if (t) Navigator.focus(t);
                    });
                }, 80);
            });
        }
        [250, 900, 1800].forEach(function (d) { setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, d); });
        act.__lmxRS = setTimeout(function () { pass(false); act.__lmxRS2 = setTimeout(function () { pass(true); }, 900); }, 220);
    }
    // Після вибору сезону/озвучки/джерела список перемальовується не одразу (чекає відповіді джерела), і Lampa лишає керування на видалених
    // вузлах. Не покладаємось на назву контролера: поки йде завантаження чекаємо, а як з'явились кнопки/серії — примусово повертаємо
    // 'content', перебираємо колекцію й ставимо фокус на видимий елемент
    // Фокус «живий», лише якщо стоїть на видимому нашому елементі; старі кнопки джерела (озвучка серії тощо), що блимають на мить, не підходять
    function okFocus(act) {
        var f = act.querySelector('.focus');
        if (!f || !document.body.contains(f)) return false;
        if (!(f.offsetWidth || f.offsetHeight)) return false;
        return !!f.closest('.lmx-onl-item, .lmx-onl-btn, .lmx-onl-opt, .lmx-onl-bar, .lmx-onl-hero, .lmx-onl-drop, .videos__season, .selectbox');
    }
    // Службові рядки джерела без картинки (кнопка «озвучка серії», довідки) ховаємо й одразу забираємо з навігації — інакше фокус на них «зникає»
    // Картка серії: є картинка/смужка прогресу, АБО (джерело без постерів — Люпен, Кульгаві коні) — це власна картка джерела з текстом
    function hasEp(el) {
        if (el.querySelector('img, .time-line, [class*="prestige__img"], [class*="imgbox"]')) return true;
        return /videos__item|prestige|online-|episode/i.test(String(el.className)) && !/videos__button|simple-button|season|folder/i.test(String(el.className)) && !!el.querySelector('[class*="title"], [class*="episode"], [class*="info"]');
    }
    // «Родина» картки: якщо в списку є кілька карток одного типу (online-prestige / videos__item), а одна — іншого типу (залишок попереднього
    // джерела, довга службова кнопка «Джерело · Сезон · Серія»), то це не серія: ховаємо й забираємо з навігації
    function famOf(el) { var m = String(el.className).match(/videos__item|online-prestige|torrent-item/); return m ? m[0] : 'x'; }
    function famFilter(els) {
        var cnt = {}, best = '', bn = 0, out = [], i, f;
        els.forEach(function (e) { f = famOf(e); cnt[f] = (cnt[f] || 0) + 1; if (cnt[f] > bn) { bn = cnt[f]; best = f; } });
        if (bn < 2) return els;
        for (i = 0; i < els.length; i++) {
            if (famOf(els[i]) === best) out.push(els[i]);
            else { els[i].classList.remove('selector', 'focus', 'lmx-onl-item'); els[i].classList.add('lmx-onl-wide'); }
        }
        return out;
    }
    // Інколи джерело віддає той самий список двічі (стара й нова відповідь після швидкого перемикання) і серії лягають одна за одною.
    // Серія визначається сезоном, номером і озвучкою; дублікати прибираємо, лишаючи свіжіший (останній) екземпляр
    function dedupeEps(els) {
        var seen = {}, drop = [], i, j, key;
        for (i = els.length - 1; i >= 0; i--) {
            j = jd(els[i]);
            if (!j || j.episode === undefined || j.episode === null || j.episode === '') continue;
            key = [j.season || '', j.episode, j.voice || j.translate || j.balanser || '', j.quality ? JSON.stringify(j.quality) : ''].join('|');
            if (seen[key]) drop.push(els[i]); else seen[key] = 1;
        }
        if (!drop.length) return els;
        drop.forEach(function (e) { try { if (e.parentNode) e.parentNode.removeChild(e); } catch (x) {} });
        return els.filter(function (e) { return drop.indexOf(e) < 0; });
    }
    function hideJunk(act) {
        var body = act.querySelector('.explorer__files-body .scroll__body'), kids = body ? body.children : [], i, el, ch = false;
        // кнопки рідного блоку «не дав результатів» невидимі — не даємо їм ловити фокус
        if (body) [].forEach.call(body.querySelectorAll('[class*="online-empty"].selector, [class*="online-empty"] .selector'), function (e) { e.classList.remove('selector', 'focus'); ch = true; });
        for (i = 0; i < kids.length; i++) {
            el = kids[i];
            if (!el.classList || !el.classList.contains('selector') || el.classList.contains('lmx-onl-item') || el.classList.contains('lmx-onl-btn') || el.classList.contains('videos__season') || /folder/.test(el.className)) continue;
            if (hasEp(el)) continue;
            el.classList.add('lmx-onl-wide'); el.classList.remove('selector', 'focus'); ch = true;
        }
        return ch;
    }
    // Після зміни джерела/озвучки список перемальовується, а Lampa лишає прокрутку зі старим зсувом — серії опиняються за межами екрана.
    // Скидаємо зсув; далі фокус на елементі сам підтягне прокрутку
    // Список «поза екраном» — лише якщо жодна картка не видна. Раніше перевірялась тільки перша серія: щойно користувач опускався нижче
    // першого ряду, запобіжник вважав список втраченим і через секунду повертав прокрутку нагору, фокус стрибав на першу картку
    function listOff(act) {
        var its = act.querySelectorAll('.lmx-onl-item'), i, r, any = false;
        if (!its.length) return false;
        for (i = 0; i < its.length; i++) {
            r = its[i].getBoundingClientRect();
            if (!(r.width && r.height)) continue;
            any = true;
            if (r.bottom > 40 && r.top < window.innerHeight - 20) return false;
        }
        return any;
    }
    function resetScroll(act) {
        var b = act.querySelector('.explorer__files-body .scroll__body'), sc = b && b.parentNode;
        try { var nsc = b && scrollFor(b); if (nsc && typeof nsc.reset === 'function') nsc.reset(); } catch (e) {}
        if (b) b.style.transform = 'translate3d(0px,0px,0px)';
        if (sc) { sc.scrollTop = 0; sc.scrollLeft = 0; }
        try { var o = act.querySelector('.explorer__files-body .scroll'); if (o) o.scrollTop = 0; } catch (e) {}
    }
    function recover(act) {
        clearInterval(act.__lmxRC);
        var n = 0, okTicks = 0, rt0 = Date.now();
        act.__lmxRC = setInterval(function () {
            safe(function () {
                n++;
                if ((window.__lmxTouchT || 0) > rt0) { clearInterval(act.__lmxRC); return; }
                if (!document.body.contains(act) || n > 40) { clearInterval(act.__lmxRC); return; }
                if (selOpen() || act.__lmxOpen || act.__lmxHold) return;
                var tg = (act.__lmxRlKey && act.querySelector('.lmx-onl-g--' + act.__lmxRlKey + ' .selector')) || act.querySelector('.lmx-onl-btn.selector') || act.querySelector('.lmx-onl-item');
                if (!tg || act.classList.contains('lmx-onl-load') || act.__lmxProbing) { okTicks = 0; return; }
                var cn = Lampa.Controller.enabled(), nm = cn && cn.name;
                if (listOff(act)) { resetScroll(act); okTicks = 0; }
                else if (okFocus(act) && (nm === 'content' || (window.__lmxKeyT || 0) > rt0)) { if (++okTicks >= 2) clearInterval(act.__lmxRC); return; }   // користувач уже сам пересунув фокус (напр. на «Озвучка») — не повертаємо його на джерело
                hideJunk(act);
                okTicks = 0;
                ctlContent();
                var sc = act.querySelector('.explorer__files-body .scroll'), fl = act.querySelector('.explorer__files');
                try { Lampa.Controller.collectionSet($(sc || fl), sc && fl ? $(fl) : false); } catch (e) {}
                if (window.Navigator && Navigator.focus) Navigator.focus(listOff(act) ? act.querySelector('.lmx-onl-item') || tg : tg);
            });
        }, 400);
    }
    // На мишці/тачпаді Lampa віддає і «hover:enter», і браузерний «click» — обробник спрацьовував двічі: друге відкриття меню фільтра
    // перебивало перше (меню блимало й зникало), а кнопка «Продовжити» могла запустити відтворення двічі
    function once(fn) {
        var t = 0;
        return function () { var n = Date.now(); if (n - t < 700) return; t = n; return fn.apply(this, arguments); };
    }
    function addNav(el) {
        try { if (Lampa.Controller && Lampa.Controller.collectionAppend) Lampa.Controller.collectionAppend($(el)); } catch (e) {}
    }

    // Три кнопки замість «Фільтр» і пошуку: озвучка, сезон, серія. Озвучку й сезон відкриваємо через рідне меню фільтра джерела
    // (воно лишається в DOM, ховається стилями), тож працює з будь-яким джерелом
    var RX_VOICE = /переклад|озвуч|перевод|voice|translat|studio|студ/i, RX_SEASON = /сезон|season/i;
    function filterText(act) {
        var f = act.querySelector('.filter--filter');
        return f ? (f.textContent || '').replace(/\s+/g, ' ').trim() : '';
    }
    // «Сезон: 3 сезон Переклад: Netflix» (роздільники бувають різні, а то й нема): позначки — слова з великої літери перед двокрапкою
    function chosen(txt, rx) {
        var re = /(?:^|[\s,;·|])([A-ZА-ЯІЇЄҐ][A-Za-zА-Яа-яІіЇїЄєҐґ']{2,}):\s*/g, mm, marks = [], k, v;
        while ((mm = re.exec(txt))) marks.push({ k: mm[1], s: mm.index + mm[0].length, e: mm.index });
        for (k = 0; k < marks.length; k++) {
            if (!rx.test(marks[k].k)) continue;
            v = txt.slice(marks[k].s, k + 1 < marks.length ? marks[k + 1].e : txt.length).replace(/[\s,;·|]+$/, '').trim();
            return v;
        }
        return '';
    }
    function openFilterItem(act, rx) {
        var f = act.querySelector('.filter--filter');
        if (!f || selOpen()) return;
        document.body.classList.add('lmx-onl-pick');
        window.__lmxAllowSel = Date.now();
        try { $(f).trigger('hover:enter'); } catch (e) {}
        var n = 0, iv = setInterval(function () {
            var its = document.querySelectorAll('.selectbox-item'), k, t, hit = null;
            for (k = 0; k < its.length; k++) { t = its[k].querySelector('.selectbox-item__title'); if (t && rx.test(t.textContent || '')) { hit = its[k]; break; } }
            if (hit) {
                clearInterval(iv);
                // заодно запам'ятовуємо обране з підписів меню (текст кнопки «Фільтр» Lampa скорочує посередині)
                try {
                    var F = act.__lmxF || (act.__lmxF = {}), q, tt, ss;
                    for (q = 0; q < its.length; q++) {
                        tt = its[q].querySelector('.selectbox-item__title'); ss = its[q].querySelector('.selectbox-item__subtitle');
                        tt = tt ? tt.textContent : ''; ss = ss ? ss.textContent.replace(/\s+/g, ' ').trim() : '';
                        if (!ss) continue;
                        if (RX_SEASON.test(tt)) F.season = ss; else if (RX_VOICE.test(tt)) F.voice = ss;
                    }
                } catch (e) {}
                try { $(hit).trigger('hover:enter'); } catch (e) {}
                setTimeout(function () { document.body.classList.remove('lmx-onl-pick'); }, 40);
            } else if (++n > 12) {
                clearInterval(iv);
                // такого пункту в меню фільтра цього джерела немає — лишаємо рідне меню відкритим, щоб було що вибрати (але порожнє меню з одним «Скинути фільтр» закриваємо)
                document.body.classList.remove('lmx-onl-pick');
                try { if (selOpen() && document.querySelectorAll('.selectbox-item').length <= 1) { Lampa.Select.close(); ctlContent(); } } catch (e) {}
            }
        }, 60);
    }
    function group(act, key, label, val, onEnter) {
        var g = act.querySelector('.lmx-onl-g--' + key);
        if (!g) {
            g = document.createElement('div');
            g.className = 'lmx-onl-g lmx-onl-g--' + key;
            g.innerHTML = '<span class="lmx-onl-g__l"></span><div class="simple-button simple-button--filter selector lmx-onl-pill"><span class="lmx-onl-pill__t"></span><i class="lmx-onl-pill__c">&#8964;</i></div>';
            $(g.querySelector('.selector')).on('hover:enter click', once(function () { onEnter(); }));
            g.__new = true;
        }
        g.firstChild.textContent = label;
        g.querySelector('.lmx-onl-pill__t').textContent = val;
        g.querySelector('.lmx-onl-pill__c').style.display = key === 'cfg' ? 'none' : '';
        return g;
    }
    function findSort(act) {
        var all = act.querySelectorAll('.explorer__files-head .selector'), i;
        for (i = 0; i < all.length; i++) if (/^\s*(сортувати|сортировать|sort)/i.test(all[i].textContent || '') && !all[i].closest('.lmx-onl-bar')) return all[i];
        return act.querySelector('.filter--sort');
    }
    function findRef(act) {
        var all = act.querySelectorAll('.explorer__files-head .selector'), i;
        for (i = 0; i < all.length; i++) if (/^\s*(джерел|источник|source)/i.test(all[i].textContent || '') && !all[i].closest('.lmx-onl-bar')) return all[i];
        return null;
    }
    function buildBar(act, hd, list) {
        var txt = filterText(act), F = act.__lmxF || {}, season = F.season || chosen(txt, RX_SEASON), voice = F.voice || chosen(txt, RX_VOICE);
        if (!season) { var ms = txt.match(/(\d+)\s*(?:сезон|season)/i); if (ms) season = ms[0]; }
        if (!voice) { var ie = Math.max(txt.lastIndexOf('\u2026'), txt.lastIndexOf('...')); if (ie > 0) voice = txt.slice(ie).replace(/^[.\u2026\s]+/, '').trim(); }
        act.__lmxList = list;
        var ex = act.querySelector('.explorer');
        var bar = hd.querySelector('.lmx-onl-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'lmx-onl-bar';
            var hero = hd.querySelector('.lmx-onl-hero');
            if (hero && hero.nextSibling) hd.insertBefore(bar, hero.nextSibling); else hd.appendChild(bar);
        }
        var ref = findRef(act), want = [], inst = instFor(act), SG = inst ? readSets(inst) : null;
        if (SG) { var si = selItem(SG.season), vi = selItem(SG.voice); if (si && si.title) season = seTitle(si.title); if (vi && vi.title) voice = vi.title; }
        want.push(group(act, 'sort', 'Сортувати', 'Сортувати', function () { var f = findSort(act); if (f) press(f); }));
        var srcIt = SG && curSrc(act, SG.sort), srcLbl = (srcIt && srcIt.title) ? String(srcIt.title).trim() : '';
        if (ref) want.push(group(act, 'src', 'Джерело', srcLbl || (ref.textContent || '').replace(/^\s*(джерело|source)\s*/i, '').trim() || 'Джерело', function () { if (!toggleDrop(act, 'src')) press(ref); }));
        // є дані фільтра — працюємо напряму з ними (кнопки лише там, де такий вибір справді є); немає — старий запасний шлях
        if (SG ? SG.season : (season || /сезон|season/i.test(txt))) want.push(group(act, 'season', 'Сезон', season || 'Сезон', function () { act.__lmxSA = 2; if (!toggleDrop(act, 'season')) openFilterItem(act, RX_SEASON); }));
        if (SG ? SG.voice : act.querySelector('.filter--filter')) want.push(group(act, 'voice', 'Озвучка', voice || 'Обрати', function () { act.__lmxSA = 2; if (!toggleDrop(act, 'voice')) openFilterItem(act, RX_VOICE); }));
        if (act.__lmxPages && act.__lmxPages.n > 1) want.push(group(act, 'page', 'Серії', pageLabel(act.__lmxPages, act.__lmxPages.pg), function () { toggleDrop(act, 'page'); }));
        want.push(group(act, 'cfg', '', '⚙︎', function () { openCfg(act); }));
        want.forEach(function (g, k) {
            if (bar.children[k] !== g) bar.insertBefore(g, bar.children[k] || null);
            if (g.__new) { g.__new = false; addNav(g.querySelector('.selector')); }
        });
        // решту (зайві групи, якщо джерело перестало їх віддавати) прибираємо
        for (var q = bar.children.length - 1; q >= want.length; q--) bar.removeChild(bar.children[q]);
        if (ex) ex.classList.add('lmx-onl-barred');
    }

    // Налаштування вікна: вигляд серій (плитка / крупна / список) та автоперемикання джерел
    var VIEWS = { tile: 'Плитка (5 в ряд)', big: 'Крупна плитка (3 в ряд)', list: 'Список' };
    function applyView(v) {
        document.body.classList.toggle('lmx-onl-list', v === 'list');
        document.body.classList.toggle('lmx-onl-big', v === 'big');
        document.body.classList.toggle('lmx-onl-fill', opt('lmx_online_focus', 'ring') === 'fill');
        document.body.classList.toggle('lmx-onl-fade', opt('lmx_online_fade', 'off') === 'on');
    }
    function opt(k, d) { var v = Lampa.Storage.get(k, d); return (typeof v === 'string' || typeof v === 'number') ? String(v) : d; }
    function orderRev() { return opt('lmx_online_order', 'std') === 'rev'; }
    function artMax() { return opt('lmx_online_art', 'auto') === 'max'; }
    // налаштування-перемикачі: ключ → [заголовок, значення за замовчуванням, {значення: підпис}]
    var OPTS = {
        ua: ['Перевага українській озвучці', 'on', { on: 'Увімкнено', off: 'Вимкнено' }, 'lmx_online_ua'],
        bal: ['Баланс вибору джерела', 'balanced', { balanced: 'Збалансовано', ua: 'Українська в пріоритеті', quality: 'Якість у пріоритеті' }, 'lmx_online_bal'],
        vauto: ['Авто-вибір української озвучки', 'on', { on: 'Увімкнено', off: 'Вимкнено' }, 'lmx_online_vauto'],
        sortsrc: ['Автосортування списку джерел', 'on', { on: 'Увімкнено', off: 'Вимкнено' }, 'lmx_online_sortsrc'],
        order: ['Порядок серій', 'std', { std: 'Стандартний', rev: 'Зворотний (нові зверху)' }, 'lmx_online_order'],
        art: ['Якість кадру', 'auto', { auto: 'Авто', max: 'Максимальна (важча)' }, 'lmx_online_art'],
        focus: ['Виділення', 'ring', { ring: 'Ободок', fill: 'Біла заливка' }, 'lmx_online_focus'],
        fade: ['Розмиті краї постера', 'off', { off: 'Вимкнено', on: 'Увімкнено' }, 'lmx_online_fade']
    };
    function curView() { var v = Lampa.Storage.get('lmx_online_view', 'tile'); return VIEWS[v] ? v : 'tile'; }
    // sel — пункт, на якому лишається фокус після зміни; en — контролер, у який повертаємось, коли вікно закрите
    function openCfg(act, sel, en) {
        var enabled = en || '';
        if (!enabled) { try { enabled = Lampa.Controller.enabled().name; } catch (e) {} }
        function back() { try { Lampa.Controller.toggle(enabled); } catch (e) {} }
        Lampa.Select.show({
            title: 'Налаштування вікна · v' + VERSION,
            items: [
                { title: 'Вигляд серій', subtitle: VIEWS[curView()], k: 'view' },
                { title: 'Автоперемикання джерел', subtitle: autoOn() ? 'Увімкнено' : 'Вимкнено', k: 'auto' },
                { title: 'Підбирати найкраще джерело', subtitle: probeOn() ? 'Увімкнено' : 'Вимкнено', k: 'probe' },
                { title: 'Бажана якість', subtitle: QPREF[qPref()], k: 'q' }
            ].concat(Object.keys(OPTS).map(function (k) { var o = OPTS[k]; return { title: o[0], subtitle: o[2][opt(o[3], o[1])] || o[2][o[1]], k: 'o:' + k }; })).map(function (it) { if (sel && it.k === sel) it.selected = true; return it; }),
            onBack: back,
            onSelect: function (a) {
                if (a.k === 'q') {
                    Lampa.Select.show({
                        title: 'Бажана якість',
                        items: Object.keys(QPREF).map(function (key) { return { title: QPREF[key], subtitle: key === qPref() ? 'Зараз' : '', k: key }; }),
                        onBack: function () { openCfg(act, 'q', enabled); },
                        onSelect: function (b) { try { Lampa.Storage.set('lmx_online_q', b.k); } catch (e) {} openCfg(act, 'q', enabled); }
                    });
                    return;
                }
                if (a.k === 'probe') {
                    try { Lampa.Storage.set('lmx_online_probe', probeOn() ? 'false' : 'true'); } catch (e) {}
                    openCfg(act, 'probe', enabled);
                    return;
                }
                if (a.k === 'auto') {
                    try { Lampa.Storage.set('lmx_online_auto', autoOn() ? 'false' : 'true'); } catch (e) {}
                    openCfg(act, 'auto', enabled);
                    return;
                }
                if (/^o:/.test(a.k)) {
                    var od = OPTS[a.k.slice(2)], vals = Object.keys(od[2]), now = opt(od[3], od[1]), nx = vals[(vals.indexOf(now) + 1) % vals.length];
                    try { Lampa.Storage.set(od[3], nx); } catch (e) {}
                    applyView(curView());
                    var ha = document.querySelector('.activity--active .lmx-onl-hero');
                    if (ha) ha.setAttribute('data-sig', '');
                    safe(buildHero);
                    openCfg(act, a.k, enabled);
                    return;
                }
                var cur = curView();
                Lampa.Select.show({
                    title: 'Вигляд серій',
                    items: Object.keys(VIEWS).map(function (key) { return { title: VIEWS[key], subtitle: key === cur ? 'Зараз' : '', k: key }; }),
                    onBack: function () { openCfg(act, 'view', enabled); },
                    onSelect: function (b) {
                        try { Lampa.Storage.set('lmx_online_view', b.k); } catch (e) {}
                        applyView(b.k);
                        openCfg(act, 'view', enabled);
                    }
                });
            }
        });
    }

    // Автоперемикання джерел: джерело нічого не знайшло — пробуємо наступне зі списку (до 6 спроб)
    function autoOn() { var v = Lampa.Storage.get('lmx_online_auto', 'true'); return v === true || v === 'true'; }
    // якість, яку джерело вказує в назві пункту меню («Makhno ~ 1080», «UaFlix - 4K»): 4=4K, 3=FHD, 2=HD, 0=невідомо
    function titleQ(t) {
        t = String(t || '');
        if (/\b(4k|2160p?|uhd)\b/i.test(t)) return 4;
        if (/\b(1080p?|fhd)\b/i.test(t)) return 3;
        if (/\b(720p?|hd)\b/i.test(t)) return 2;
        return 0;
    }
    function srcName(t) { return String(t || '').replace(/\s*[-–—~]\s*(\d{3,4}p?|4k|uhd|fhd|hd)\b.*$/i, '').replace(/[^\wа-яіїєґ]+/gi, ' ').trim().toLowerCase(); }
    // ---- Фонова перевірка джерел (як у Nova): не перемикаємо екран, а самі запитуємо ті ж адреси «/lite/<джерело>» і читаємо відповідь ----
    // Адресу вчимося у власних запитів онлайн-плагіна (підміняємо в ній назву джерела); 'rch'/'accsdb'/'blocked' і незрозумілі відповіді пропускаємо
    // Профілі онлайн-плагінів: усе, що відрізняється від стандартного (lampaua) — в одному місці
    var PROFILES = {
        def: { simple: false, first: null, seqWait: 2500, egWait: 0, label: '' },
        bwa: { simple: true, first: /uakino|ua\s*kino/i, seqWait: 20000, egWait: 20000, label: 'Завантажуємо джерело…' }
    };
    function profileOf(gs) { return (gs && gs.bwa) || isBwa() ? PROFILES.bwa : PROFILES.def; }
    // BWA (окремий онлайн-плагін) розпізнаємо лише за назвою його екрана; ніяких перехоплень мережі й спільного стану з lampaua
    function isBwa() {
        try {
            var h = document.querySelector('.head__title'), a = Lampa.Activity.active();
            return /^\s*bwa\s*$/i.test(h ? h.textContent : '') || /^\s*bwa\s*$/i.test(String(a && a.title || '')) || /bwa/i.test(String(a && a.component || ''));
        } catch (e) { return false; }
    }
    function hookRequest() {
        try {
            var R = Lampa.Reguest;
            if (!R || R.__lmxHook) return;
            function Wrapped() {
                var inst = new R();
                ['native', 'silent'].forEach(function (name) {
                    var origin = inst[name];
                    if (typeof origin !== 'function') return;
                    inst[name] = function (url) {
                        try {
                            if (!inst.__lmxProbe) {
                                var v = String(url == null ? '' : url);
                                if (/\/lite\/[^\/?&]+/.test(v) && v.indexOf('lite/events') < 0 && v.indexOf('lite/withsearch') < 0) {
                                    var a = Lampa.Activity.active(), c = a && (a.movie || a.card);
                                    window.__lmxProbeUrl = { u: v, cid: String(c && c.id || ''), t: Date.now() };
                                }
                            }
                        } catch (e) {}
                        return origin.apply(inst, arguments);
                    };
                });
                return inst;
            }
            for (var k in R) { try { Wrapped[k] = R[k]; } catch (e) {} }
            Wrapped.prototype = R.prototype;
            Wrapped.__lmxHook = 1;
            Lampa.Reguest = Wrapped;
        } catch (e) {}
    }
    function pcGet() {
        try { var v = Lampa.Storage.get('lmx_online_pc', ''); if (typeof v === 'string' && v) v = parseCached(PC_SLOT, v); if (v && typeof v === 'object') return v; } catch (e) {}
        return {};
    }
    function pcSet(o) {
        try {
            var ks = Object.keys(o);
            if (ks.length > 120) { ks.sort(function (a, b) { return (o[a].t || 0) - (o[b].t || 0); }); ks.slice(0, ks.length - 120).forEach(function (k) { delete o[k]; }); }
            Lampa.Storage.set('lmx_online_pc', JSON.stringify(o));
        } catch (e) {}
    }
    function pcEntry(cid, key) {
        var m = pcGet()[cid], e = m && m.l && m.l[key];
        if (!e) return null;
        var ttl = e.s === 'ok' ? 12 * 3600000 : e.s === 'empty' ? 1800000 : 600000;
        return Date.now() - (e.t || 0) > ttl ? null : e;
    }
    // Запам'ятована якість джерела для фільму (як rememberQuality у Nova): бейдж 4K/FHD/HD на чипі, тиждень
    var QB = { 4: '4K', 3: 'FHD', 2: 'HD', 1: 'SD' };
    function qmGet() { var o = Lampa.Storage.get('lmx_online_qm', {}); return o && typeof o === 'object' ? o : {}; }
    function qmPut(cid, key, rank) {
        if (!cid || !key || !rank || isBwa()) return;
        var o = qmGet(), now = Date.now(), k, n = 0;
        for (k in o) { if (!o[k] || now - (o[k].t || 0) > 604800000) delete o[k]; else n++; }
        var m = o[cid] || (o[cid] = { t: 0, l: {} });
        if ((m.l[key] || 0) < rank) m.l[key] = rank;
        m.t = now;
        if (n > 150) { var old = Object.keys(o).sort(function (a, b) { return o[a].t - o[b].t; })[0]; if (old !== cid) delete o[old]; }
        try { Lampa.Storage.set('lmx_online_qm', o); } catch (e) {}
    }
    function qmBadge(cid, key) { var m = qmGet()[cid]; return m && m.l && QB[m.l[key]] || ''; }
    function pcPut(cid, key, e) {
        if (isBwa()) return;
        if (e && e.s === 'ok' && e.q) qmPut(cid, key, e.q);
        var o = pcGet(), m = o[cid] || (o[cid] = { t: 0, l: {} });
        m.t = e.t = Date.now(); m.l[key] = e; pcSet(o);
    }
    // швидкість відповіді джерела (ковзне середнє, мс): при однаковій якості швидші — вище
    function msNote(key, ms) {
        try { var mem = memGet(), g = mem.g[key] || (mem.g[key] = { ok: 0, fail: 0, q: 0 }); g.ms = g.ms ? Math.round((g.ms * 2 + ms) / 3) : ms; memSet(mem); } catch (e) {}
    }
    // історія ручного вибору: джерело для тайтла (30 днів) і скільки разів ви обирали його взагалі
    var hCache = { t: 0, h: {} };
    function manualPick(cid, key) {
        if (!key) return;
        window.__lmxPickKey = key; window.__lmxPickT = Date.now();   // який саме пункт щойно обрали вручну (до того, як фільтр оновить виділене джерело)
        try {
            var mem = memGet(), ks;
            mem.h = mem.h || {}; mem.m = mem.m || {};
            mem.h[key] = Math.min(50, (mem.h[key] || 0) + 1);
            if (cid) {
                mem.m[cid] = { s: key, at: Date.now() };
                ks = Object.keys(mem.m);
                if (ks.length > 150) { ks.sort(function (a, b) { return mem.m[a].at - mem.m[b].at; }); ks.slice(0, ks.length - 150).forEach(function (k) { delete mem.m[k]; }); }
            }
            memSet(mem); hCache.t = 0;
        } catch (e) {}
    }
    function msCmp(a, b) { var x = a && a.ms, y = b && b.ms; return x && y && Math.abs(x - y) > 1500 ? (x < y ? 1 : -1) : 0; }
    // Назви озвучок із відповіді джерела (поля voice/translate… і кнопки вибору озвучки): за ними знаємо, чи є тут українська озвучка саме для цього тайтла
    function bgVoices(b) {
        var out = {}, m, rx = /"(?:voice_name|translate|translation|voice|studio|dub)"\s*:\s*"([^"]{2,80})"/gi, rb = /class="[^"]*videos__button[^"]*"[^>]*>([^<]{2,80})</gi, junk = /^\s*(\d+\s*)?(сезон|season|серія|серия|episode|дивитись|смотреть|всі|все|all|play)/i, t;
        while ((m = rx.exec(b))) { t = m[1].trim(); if (t && !junk.test(t)) out[t] = 1; }
        while ((m = rb.exec(b))) { t = m[1].trim(); if (t && !junk.test(t)) out[t] = 1; }
        return Object.keys(out).slice(0, 80);
    }
    // Відповіді-заглушки джерел: потрібен свій акаунт / такого сезону чи тайтла немає
    var PAYWALL = /только со своим аккаунт|тільки зі своїм акаунт|тільки з власним акаунт|привяжите аккаунт|потрібен (?:свій )?акаунт|привʼяжіть акаунт|привяжіть акаунт|нужна привязк|потрібна прив/i, NOSEASON = /нет \d+ сезон|нет сезон|нет серий|нет результат|не найден|нічого не знайд|немає \d+ сезон/i;
    function bgParse(ans) {
        var b = typeof ans === 'string' ? ans : '';
        if (ans && typeof ans === 'object') { try { b = JSON.stringify(ans).split('\\"').join('"'); } catch (e) { b = ''; } }
        // довгі серіали (Конан, 1200+ серій) віддають відповіді на мегабайти: на телевізорі їх розбір блокує потік і з'їдає пам'ять — читаємо лише початок
        if (b.length > 350000) b = b.slice(0, 350000);
        if (!b) return { s: 'skip' };
        if (b.indexOf('"rch"') >= 0 || b.indexOf('"accsdb"') >= 0 || b.indexOf('"blocked"') >= 0) return { s: 'skip' };
        if (PAYWALL.test(b)) return { s: 'skip', acc: 1 };
        if (NOSEASON.test(b) && !/videos__item|"method"/i.test(b)) return { s: 'empty', c: 0 };
        var c = (b.match(/videos__item/g) || []).length || (b.match(/"method"\s*:\s*"(play|call|link)"/g) || []).length;
        var tor = /torrent-item|"magnet"|magnet:|"seeders?"|"seeds?"/i.test(b);
        if (!c && tor) c = (b.match(/torrent-item|magnet:/gi) || []).length || 1;
        if (c) {
            var q = 0, marks = b.match(/(2160|1440|1080|720|576|480|360)\s*p/gi) || [];
            marks.forEach(function (m) { var n = parseInt(m, 10), r = n >= 2160 ? 4 : n >= 1080 ? 3 : n >= 720 ? 2 : 1; if (r > q) q = r; });
            if (/4k|uhd/i.test(b)) q = 4;
            var vs = bgVoices(b), uv = 0;
            vs.forEach(function (x) { if (isUaVoice(x)) uv++; });
            return { s: 'ok', c: c, q: q, t: tor ? 1 : 0, u: /укр|ukr|українськ|\bua\b|\\u0443\\u043a\\u0440/i.test(b) ? 1 : 0, v: vs.length, uv: uv };
        }
        if (!/videos__|"method"|online-prestige|"data"/i.test(b)) return { s: 'skip' };
        return { s: 'empty', c: 0 };
    }
    // job: { cid, url, items:[{key, source}], par, timeout, onEach(), onEnd() }
    // довгий серіал: сотні серій у кожній відповіді — перевіряємо джерела по два, щоб не вбити пам'ять телевізора
    function longSeries(c) { try { if (!c) return false; if ((c.number_of_episodes || 0) > 300) return true; var n = 0; (c.seasons || []).forEach(function (x) { n += (x && x.episode_count) || 0; }); return n > 300; } catch (e) { return false; } }
    function bgProbe(job) {
        var idx = 0, finished = 0, nets = [];
        job.stopped = false;
        job.stop = function () { job.stopped = true; nets.forEach(function (n) { try { n.clear(); } catch (e) {} }); };
        function urlFor(src) { return job.url.replace(/(\/lite\/)[^\/?&]+/, '$1' + encodeURIComponent(src)); }
        function fin() { finished++; if (finished >= job.items.length && !job.stopped) job.onEnd(); }
        function step() {
            if (job.stopped || idx >= job.items.length) return;
            var it = job.items[idx++], net = null, ended = false, t1 = Date.now();
            try { net = new Lampa.Reguest(); } catch (e) { net = null; }
            function end(ans) {
                if (ended || job.stopped) return;
                ended = true;
                var r = bgParse(ans); r.ms = Date.now() - t1; pcPut(job.cid, it.key, r); if (r.s === 'ok') { msNote(it.key, r.ms); if (r.uv > 0) uaNote(it.key); }
                try { job.onEach(it, r); } catch (e) {}
                fin(); step();
            }
            if (!net) return end('');
            net.__lmxProbe = true; nets.push(net);
            // страховка: якщо мережа не віддала ні відповіді, ні помилки (рідний timeout не спрацював) — завершуємо самі, щоб підбір не стояв
            setTimeout(function () { if (!ended && !job.stopped) { try { net.clear(); } catch (e) {} end(''); } }, (it.to || job.timeout) + 1500);
            try { net.timeout(it.to || job.timeout); } catch (e) {}
            var prm = { dataType: 'text' }; if (job.headers) prm.headers = job.headers;
            window.__lmxPB = true;
            try { net['native'](urlFor(it.source), end, function () { end(''); }, false, prm); } catch (e) { end(''); }
            window.__lmxPB = false;
        }
        if (!job.items.length) return job.onEnd();
        for (var w = 0; w < job.par; w++) step();
    }
    // Загальний екран перевірки: живе на рівні body, тому не блимає, коли плагін перестворює екран при зміні джерела
    function scanText() {
        var gs = window.__lmxProbe, n = gs ? (gs.bg === 'run' ? (gs.bgDone || 0) : Math.min(gs.tried.length, gs.total || gs.tried.length)) : 0;
        if (!gs || gs.done || !gs.total) return 'Шукаємо джерела…';
        if (profileOf(gs).label) return profileOf(gs).label + (gs.t00 && Date.now() - gs.t00 > 4000 ? ' \u00b7 ' + Math.round((Date.now() - gs.t00) / 1000) + ' с' : '');
        var hint = (typeof gs.cur === 'string' && gs.cur ? ' \u00b7 ' + gs.cur : '') + (gs.results && gs.results.length ? ' \u00b7 знайдено ' + gs.results.length : '');
        return 'Перевіряємо джерела: ' + n + ' з ' + gs.total + hint + (gs.t00 && Date.now() - gs.t00 > 4000 ? ' \u00b7 ' + Math.round((Date.now() - gs.t00) / 1000) + ' с' : '');
    }
    function scanFrac() { var gs = window.__lmxProbe, tf = gs && gs.t00 ? Math.min(0.9, (Date.now() - gs.t00) / 24000) : 0; return Math.max(tf, scanFrac0()); }
    function scanFrac0() { var gs = window.__lmxProbe; if (gs && gs.bg === 'run' && gs.total) return Math.max(0.04, Math.min(0.98, (gs.bgDone || 0) / gs.total)); return gs && gs.total ? Math.max(0.04, Math.min(0.98, (gs.tried.length - 0.5) / gs.total)) : 0.05; }
    // Один екран замість трьох: поки йде перевірка, стандартний екран джерела ховаємо (клас на body), а наш скелет — шапка з логотипом, що переливається,
    // і шкала прогресу — будується в самій активності ще до першої відмальовки, навіть коли плагін перестворює її при зміні джерела
    function scanning() { var g = window.__lmxProbe; return !!(g && !g.done && Date.now() - g.t00 < 130000); }
    function entering(on) {
        clearTimeout(lastEnter.tm);
        if (!on) { document.body.classList.remove('lmx-onl-entering'); return; }
        document.body.classList.add('lmx-onl-entering');
        lastEnter.tm = setTimeout(function chk() {
            if (scanning()) { lastEnter.tm = setTimeout(chk, 500); return; }
            document.body.classList.remove('lmx-onl-entering');
        }, 1800);
    }
    function showScan() { entering(true); }
    function updScan() {}
    function hideScanLater() {
        if (window.__lmxHL) return;
        window.__lmxHL = 1;
        var n = 0, iv = setInterval(function () {
            n++;
            var a = document.querySelector('.activity--active');
            var ready = a && a.querySelector('.lmx-onl-hero') && a.querySelector('.lmx-onl-item') && !a.__lmxProbing;
            if (ready || n > 40) { clearInterval(iv); window.__lmxHL = 0; entering(false); }
        }, 150);
    }
    // Нічого не знайшли: кнопки «Повторити» та «Уточнити пошук»
    // Найкраще наступне джерело (як nextSource у Nova): не пробуване, не ghost/порожнє; спершу ті, що дали результат, далі за якістю
    function nextSourceFor(act) {
        var inst = instFor(act), S = inst && readSets(inst);
        if (!S || !S.sort) return null;
        var tried = act.__lmxHop = act.__lmxHop || {};
        S.sort.forEach(function (x) { if (x && x.selected) tried[srcName(x.title)] = 1; });
        var pool = S.sort.filter(function (x) { var k = x && srcName(x.title); return x && !x.selected && !x.ghost && k && !tried[k] && srcState(k) !== 'no'; });
        pool.sort(function (a, b) { return ((srcState(srcName(a.title)) === 'ok' ? 0 : 2) - (srcState(srcName(b.title)) === 'ok' ? 0 : 2)) || (titleQ(b.title) - titleQ(a.title)); });
        return pool[0] || null;
    }
    // Нічого не знайшли: «Спробувати <джерело>», «Усі джерела», «Повторити», «Уточнити пошук» (як панель-нотатка в Nova)
    function deadActions(act) {
        var pr = act.querySelector('.lmx-onl-prog');
        if (!pr || pr.querySelector('.lmx-onl-dead')) return;
        var row = document.createElement('div'), inst = instFor(act), next = nextSourceFor(act), manySrc = false;
        try { manySrc = (readSets(inst).sort || []).length > 1; } catch (e) {}
        row.className = 'lmx-onl-dead';
        var h = '';
        if (next) h += '<div class="lmx-onl-btn lmx-onl-btn--main selector" data-a="next">Спробувати «' + esc(srcName(next.title)) + '»</div>';
        if (manySrc) h += '<div class="lmx-onl-btn selector" data-a="all">Усі джерела</div>';
        h += '<div class="lmx-onl-btn' + (next ? '' : ' lmx-onl-btn--main') + ' selector" data-a="retry">Повторити</div>';
        if (act.querySelector('.filter--search')) h += '<div class="lmx-onl-btn selector" data-a="clarify">Уточнити пошук</div>';
        row.innerHTML = h;
        if (!next && manySrc) { var ps = pr.querySelector('.lmx-onl-prog__s'); if (ps) ps.textContent = 'Жодне джерело не дало результатів'; }
        pr.appendChild(row);
        safe(function () { hideJunk(act); });
        [].forEach.call(row.querySelectorAll('.lmx-onl-btn'), function (b) {
            $(b).on('hover:enter click', once(function () {
                var a = b.getAttribute('data-a');
                if (a === 'clarify') { var f = act.querySelector('.filter--search'); if (f) { window.__lmxAllowSel = Date.now(); try { $(f).trigger('hover:enter'); } catch (e) {} } return; }
                if (a === 'all') { act.__lmxAllSrc = true; act.__lmxOpen = ''; toggleDrop(act, 'src'); return; }
                if (a === 'next' && next) {
                    window.__lmxManual = Date.now();
                    if (row.parentNode) row.parentNode.removeChild(row);
                    act.classList.add('lmx-onl-load'); act.__lmxEG = 0;
                    act.__lmxRlKey = 'src'; selIn(inst, 'sort', next); recover(act); emptyGuard(act);
                    return;
                }
                var cid = '', card = null;
                try { var a0 = Lampa.Activity.active(); card = a0 && (a0.movie || a0.card); cid = String(card && card.id || ''); } catch (e) {}
                var o = pcGet(); delete o[cid]; pcSet(o);
                window.__lmxProbe = null; window.__lmxBad = null; act.__lmxHop = null;
                if (row.parentNode) row.parentNode.removeChild(row);
                act.classList.add('lmx-onl-load'); act.__lmxWatch = 0; act.__lmxEG = 0; act.__lmxProbing = false;
                var pr2 = act.querySelector('.lmx-onl-prog'); if (pr2) pr2.classList.remove('lmx-onl-prog--end');
                window.__lmxInplace = Date.now();
                var comp = compNow();
                if (!(reloadable(comp) && reloadInPlace(comp))) { try { Lampa.Activity.replace(); } catch (e) {} }
                if (card) watchSources(act, card);
            }));
            addNav(b);
        });
        setTimeout(function () { safe(function () { if ((window.__lmxKeyT || 0) < Date.now() - 1500) syncNav(act, row.querySelector('.selector')); }); }, 300);
    }
    function heroStatus(act, text, stop, frac) {
        var gs0 = window.__lmxProbe;
        if (!stop && gs0 && !gs0.done) { text = scanText(); frac = scanFrac(); }
        // Не перемикаємо тип повідомлення («перевіряємо» ↔ «джерело нічого не дало») частіше, ніж раз на 1,5 с — текст не блимає
        if (!stop) {
            var cat = /нічого не дало|Пробуємо/.test(String(text || '')) ? 'f' : 'o', hs = act.__lmxHS;
            if (hs && hs.c !== cat && Date.now() - hs.t < 1500) text = hs.x; else act.__lmxHS = { c: cat, t: hs && hs.c === cat ? hs.t : Date.now(), x: text };
        }
        var s = act.querySelector('.lmx-onl-hero__s'), h = act.querySelector('.lmx-onl-hero'), pr = act.querySelector('.lmx-onl-prog'), ps = pr && pr.querySelector('.lmx-onl-prog__s'), pb = pr && pr.querySelector('.lmx-onl-prog__b i');
        if (s) s.textContent = text;
        if (ps) ps.textContent = text;
        if (pb && typeof frac === 'number') pb.style.width = Math.max(6, Math.min(100, Math.round(frac * 100))) + '%';
        if (stop && h) h.classList.remove('lmx-onl-hero--load');
        // Пошук закінчено: спершу оформлюємо картки нового джерела (клас сітки, нумерація) і лише тоді знімаємо режим завантаження — інакше на частку секунди
        // видно «сирі» стандартні картки, поки не спрацює перебудова (було помітно на повторному пошуку через кнопку «Онлайн»)
        if (stop) { try { act.__lmxProbing = false; buildHero(); } catch (e) {} }
        if (stop) { act.classList.remove('lmx-onl-load'); if (pr) pr.classList.add('lmx-onl-prog--end'); if (/жодне|нічого не знайдено: жодне/i.test(String(text || ''))) deadActions(act); }
    }
    // ---- Пам'ять джерел: що спрацювало раніше (для цього фільму і взагалі) і якої якості ----
    function memGet() {
        try {
            var v = Lampa.Storage.get(memKey(), '');
            if (typeof v === 'string' && v) v = JSON.parse(v);
            if (v && typeof v === 'object' && v.g && v.t) { if (v.hv !== 3) { v.g = {}; v.t = {}; v.h = {}; v.m = {}; v.hv = 3; } return v; }   // одноразове скидання досвіду, накопиченого під час тестів BWA
        } catch (e) {}
        return { g: {}, t: {} };
    }
    // досвід джерел (успіхи, швидкість, звичний вибір) ведемо окремо для BWA, щоб він не впливав на підбір у lampaua
    function memKey() { return isBwa() ? 'lmx_online_mem_bwa' : 'lmx_online_mem'; }
    function memSet(mem) {
        try {
            var ks = Object.keys(mem.t);
            if (ks.length > 150) {
                ks.sort(function (a, b) { return (mem.t[a].at || 0) - (mem.t[b].at || 0); });
                ks.slice(0, ks.length - 150).forEach(function (k) { delete mem.t[k]; });
            }
            Lampa.Storage.set(memKey(), JSON.stringify(mem));
        } catch (e) {}
    }
    function qrank(q) { return q === '4K' ? 4 : q === 'FHD' ? 3 : q === 'HD' ? 2 : q ? 1 : 0; }
    function gscore(g) { return g ? (g.ok || 0) - (g.fail || 0) * 2 + (g.q || 0) * 2 : 0; }
    var QPREF = { auto: 'Авто (FHD і вище)', '4k': 'Віддавати перевагу 4K', fhd: 'Віддавати перевагу FHD', hd: 'Достатньо HD' };
    function qPref() { var v = String(Lampa.Storage.get('lmx_online_q', 'auto')); return QPREF[v] ? v : 'auto'; }
    // скільки ранг якості вважаємо «досить добрим», щоб не шукати далі
    // Перевага українській озвучці: (1) у відповіді джерела є українські озвучки/позначки; (2) назва джерела з відомих українських. Вимикається в ⚙
    function uaOn() { return opt('lmx_online_ua', 'on') === 'on'; }
    var UA_SRC = /(^|[^a-z])ua|укр|uaflix|uakino|makhno|eneyida|kinobaza|animeon|toloka|tvukr|ashdi|kinoukr|uaserial|animeua|bambooua|wormhole|kinotron|petlura|mikai|bamboo|unimay|anihub|aniworld|anitube|moonanime|klon|kinostrain|serialno|ufdub|moviestape|[еe]н[еe][їi]д|ukr|filmix|фільмікс|фильмикс/i;
    function uaName(k) { return UA_SRC.test(String(k || '')); }
    // Джерело, на якому ми самі бачили українську озвучку (Filmix із преміумом тощо), вважаємо українським, навіть якщо назва про це не каже
    function uaLearned(k) { try { var g = memGet().g[k]; return !!(g && (g.ua || 0) >= 1); } catch (e) { return false; } }
    function uaNote(k) { try { if (!k || uaName(k)) return; var mem = memGet(), gg = mem.g[k] || (mem.g[k] = { ok: 0, fail: 0, q: 0 }); if ((gg.ua || 0) < 9) { gg.ua = (gg.ua || 0) + 1; memSet(mem); } } catch (e) {} }
    function learnUaVoice(act, list) {
        if (isBwa()) return;
        try {
            var inst = instFor(act), S = inst && readSets(inst), sel = S && S.sort && curSrc(act, S.sort), k = sel ? srcName(sel.title) : '';
            if (!k || uaName(k) || act.__lmxUaL === k) return;
            var hit = false, g = S.voice;
            if (g && g.items) g.items.forEach(function (it) { if (it && it.title && isUaVoice(String(it.title))) hit = true; });
            if (!hit) (list || []).forEach(function (e) { var t = e.querySelector('[class*="__title"]'); if (t && isUaVoice(String(t.textContent || ''))) hit = true; });
            act.__lmxUaL = k;
            if (!hit) return;
            uaNote(k);
        } catch (e) {}
    }
    // Аніме (жанр «Анімація» + японське походження) — перевага джерелам, що спеціалізуються на аніме; додається до бонусу за українську озвучку, а не замість нього
    var ANIME_SRC = /anime|аніме|moon|fenix|mikai|bamboo|unimay|anihub|aniworld|anitube|anilib|anidub|hikka|yummy|animevost|jutsu|ukranime|aniua/i;
    function isAnimeCard() {
        try {
            var a = Lampa.Activity.active(), c = a && (a.movie || a.card);
            if (!c) return false;
            var gen = (c.genres || []).some(function (g) { return g && (g.id === 16 || /анімац|animation|аніме/i.test(String(g.name || ''))); }) || (c.genre_ids || []).indexOf(16) >= 0;
            var ja = c.original_language === 'ja' || (c.origin_country || []).indexOf('JP') >= 0;
            return gen && ja;
        } catch (e) { return false; }
    }
    function animeBonus(k) { return opt('lmx_online_anime', 'on') === 'on' && (ANIME_SRC.test(String(k || '')) || (HINT[k] && HINT[k].a) || learnedAnime(k)) && isAnimeCard() ? 4 : 0; }
    // Універсальність: плагін не прив'язаний до назв конкретного онлайн-плагіна. Окрім списків слів, діють ще два шари:
    // (1) значки в назві джерела (🌸/🎌 — аніме, 🇺🇦 — українське): запам'ятовуємо їх із сирої назви, бо в ключі значки відкидаються;
    // (2) навчання: джерело, що знаходить аніме, але майже ніколи — інші тайтли, плагін вважає аніме-спеціалізованим
    var HINT = {};
    function noteHints(it) {
        try {
            var k = srcName(it && it.title), t = String(it && it.title || '');
            if (!k) return;
            var h = HINT[k] || (HINT[k] = { a: 0, u: 0 });
            if (/\uD83C\uDF38|\uD83C\uDF8C|\u26E9/.test(t)) h.a = 1;
            if (/\uD83C\uDDFA\uD83C\uDDE6/.test(t)) h.u = 1;
        } catch (e) {}
    }
    function learnGet() { try { var v = Lampa.Storage.get('lmx_online_learn', ''); if (typeof v === 'string' && v) v = parseCached(LEARN_SLOT, v); if (v && typeof v === 'object' && v.s) return v; } catch (e) {} return { s: {}, seen: {} }; }
    function learnNote(sort, cid) {
        if (isBwa()) return;
        try {
            if (!cid) return;
            var L = learnGet(), an = isAnimeCard();
            if (L.seen[cid]) return;
            L.seen[cid] = 1;
            var sk = Object.keys(L.seen); if (sk.length > 300) delete L.seen[sk[0]];
            sort.forEach(function (x) {
                if (!x || typeof x.ghost === 'undefined') return;
                var k = srcName(x.title); if (!k) return;
                var e = L.s[k] || (L.s[k] = { a: [0, 0], o: [0, 0] }), b = an ? e.a : e.o;
                b[1]++; if (!x.ghost) b[0]++;
            });
            Lampa.Storage.set('lmx_online_learn', JSON.stringify(L));
        } catch (e) {}
    }
    function learnedAnime(k) {
        try { var e = learnGet().s[k]; return !!e && e.a[1] >= 3 && e.a[0] / e.a[1] >= 0.6 && e.o[1] >= 3 && e.o[0] / e.o[1] <= 0.25; } catch (x) { return false; }
    }
    function uaBonus(k, pe) { return (uaOn() && ((pe && pe.u) || uaName(k) || uaLearned(k) || (HINT[k] && HINT[k].u)) ? 2 : 0) + animeBonus(k); }
    // ---- Єдиний рейтинг джерела. Режим «Баланс» міняє ваги: q — рівень якості (1–4), qHi — вага рівня понад FHD (4K не вдвічі кращий за 1080),
    // ua — реальна українська озвучка саме для цього тайтла, uaGuess — лише припущення за назвою джерела, anime — спеціалізоване аніме-джерело на аніме, hab — ваш звичний вибір
    var BAL = {
        balanced: { q: 1.0, qHi: 0.5, ua: 1.6, uaGuess: 1.0, anime: 5, hab: 0.7 },
        ua:       { q: 0.8, qHi: 0.4, ua: 3.6, uaGuess: 2.2, anime: 5, hab: 0.7 },
        quality:  { q: 1.3, qHi: 1.0, ua: 0.6, uaGuess: 0.4, anime: 5, hab: 0.5 }
    };
    var BAL_NAMES = { balanced: 'Збалансовано', ua: 'Українська в пріоритеті', quality: 'Якість у пріоритеті' };
    var QL = { 4: '4K', 3: '1080', 2: '720', 1: 'SD' };
    function balMode() { var v = opt('lmx_online_bal', 'balanced'); return BAL[v] ? v : 'balanced'; }
    function vautoOn() { return opt('lmx_online_vauto', 'on') === 'on'; }
    function sortSrcOn() { return opt('lmx_online_sortsrc', 'on') === 'on'; }
    // o: { q — якість із назви, pe — запис фонової перевірки (реальна якість і озвучки), ms }; повертає { s: бал, why: [причини], ua: 'real'|'guess'|'none'|'' }
    function srcScore(k, o, mem) {
        o = o || {};
        var W = BAL[balMode()], pe = o.pe || null, s = 0, why = [], q = (pe && pe.q) || o.q || 0, ua = '', g, ms;
        mem = mem || memGet();
        s += q <= 3 ? q * W.q : 3 * W.q + (q - 3) * W.qHi;
        if (uaOn()) {
            if (pe && pe.uv > 0) { s += W.ua + (pe.uv >= 3 ? 0.3 : 0); ua = 'real'; why.push('українська озвучка'); }
            else if (pe && pe.v > 0 && pe.uv === 0) ua = 'none';
            else if ((pe && pe.u) || uaName(k) || uaLearned(k) || (HINT[k] && HINT[k].u)) { s += W.uaGuess; ua = 'guess'; why.push('українське джерело'); }
        }
        if (animeBonus(k)) { s += ua === 'none' ? 2 : W.anime; why.push('аніме-джерело'); }   // аніме-джерело вище за універсальні (навіть 4K), але без української озвучки — лише трохи
        if (q) why.push(QL[q]);
        if (mem.h && (mem.h[k] || 0) >= 3) { s += W.hab; why.push('ваш звичний вибір'); }
        g = mem.g && mem.g[k];
        if (g && (g.fail || 0) > (g.ok || 0)) s -= Math.min(1.5, ((g.fail || 0) - (g.ok || 0)) * 0.25);
        ms = (pe && pe.ms) || (g && g.ms) || 0;
        if (ms) s += ms <= 1500 ? 0.25 : ms <= 3000 ? 0.1 : ms > 6000 ? -0.2 : 0;
        return { s: s, why: why, ua: ua, ms: ms };
    }
    function qTarget() { var v = qPref(); return v === '4k' ? 4 : v === 'hd' ? 2 : 3; }
    function probeOn() { var v = Lampa.Storage.get('lmx_online_probe', 'true'); return v === true || v === 'true'; }

    // ---- Фільтр джерела: перехоплюємо екземпляри Lampa.Filter і читаємо їхні списки (джерела, сезони, озвучки) та керуємо ними напряму,
    // без жодних автоматичних натискань на невидимі меню ----
    var FILTERS = [];
    function hookFilter() {
        try {
            if (!Lampa.Filter || Lampa.Filter.__lmxHook) return;
            var real = Lampa.Filter;
            var Wrapped = function (params) {
                var inst = new real(params), setter = inst.set;
                inst.lmx_sets = {};
                inst.lmx_t = Date.now();
                if (typeof setter === 'function') inst.set = function (type, list) { inst.lmx_sets[type] = list; return setter.apply(inst, arguments); };
                FILTERS.unshift(inst);
                if (FILTERS.length > 5) FILTERS.pop();
                return inst;
            };
            Wrapped.prototype = real.prototype;
            for (var k in real) if (Object.prototype.hasOwnProperty.call(real, k)) Wrapped[k] = real[k];
            Wrapped.__lmxHook = true;
            Lampa.Filter = Wrapped;
        } catch (e) {}
    }
    // Фільтр джерела при виборі сам викликає Select.hide/close; якщо жодне меню не відкрите (а ми вибираємо напряму), Lampa кидає
    // «undefined is not an object (evaluating 'closed.onBack')» і вибір не доходить до перезавантаження. Гасимо цю помилку
    // ---- Перезавантаження джерела «на місці» (як у Nova): зміна джерела в онлайн-плагіні викликає Activity.replace() і перестворює весь екран.
    // Перехоплюємо це й просто скидаємо та перезапитуємо поточний компонент — екран лишається, змінюється лише список
    function selIn(inst, a, b, c) {
        window.__lmxInplace = Date.now();
        // запам'ятовуємо, яке джерело ми щойно відкрили: прапорці selected у рідному плагіні оновлюються із запізненням (підпис і галочка розходились)
        try { if (a === 'sort' && b && b.title) { var ac = document.querySelector('.activity--active'); if (ac) ac.__lmxSel = { k: srcName(b.title), t: Date.now() }; } } catch (e) {}
        return inst.onSelect(a, b, c);
    }
    // яке джерело зараз «обране»: наш останній вибір (протягом 8 с, поки прапорці плагіна ще не оновились), інакше те, що віддає плагін
    function curSrc(act, items) {
        var i, m = act && act.__lmxSel;
        // правда — підпис на рідній кнопці «Джерело»: прапорці selected у деяких плагінів (BWA) не оновлюються взагалі, а наш запам'ятований вибір може бути застарілим
        try {
            var rf = act && findRef(act), rl = rf ? srcName(String(rf.textContent || '').replace(/^\s*(джерело|источник|source)\s*/i, '')) : '';
            if (rl) for (i = 0; i < items.length; i++) if (items[i] && srcName(items[i].title) === rl) return items[i];
        } catch (e) {}
        if (m && Date.now() - m.t < 8000) for (i = 0; i < items.length; i++) if (items[i] && srcName(items[i].title) === m.k) return items[i];
        for (i = 0; i < items.length; i++) if (items[i] && items[i].selected) return items[i];
        return null;
    }
    function inplaceOn() { return Date.now() - (window.__lmxInplace || 0) < 2500; }
    function compNow() { try { var a = Lampa.Activity.active(); return (a && a.activity && a.activity.component) || null; } catch (e) { return null; } }
    function reloadable(c) { return !!(c && !c.destroyed && typeof c.createSource === 'function' && (typeof c.search === 'function' || typeof c.find === 'function')); }
    function reloadInPlace(comp) {
        var act = document.querySelector('.activity--active'), keep = [];
        if (act) ['.lmx-onl-hero', '.lmx-onl-prog', '.lmx-onl-bar', '.lmx-onl-drop'].forEach(function (sel) {
            var e = act.querySelector(sel);
            if (e && e.parentNode) keep.push({ e: e, p: e.parentNode });
        });
        keep.forEach(function (k) { try { k.p.removeChild(k.e); } catch (e) {} });
        // як у Nova (listHold): поки список перезавантажується, тримаємо його висоту, щоб низ екрана не стискався
        try { var hb = act && act.querySelector('.explorer__files-body .scroll__body'); if (hb && hb.offsetHeight > 0) hb.style.minHeight = hb.offsetHeight + 'px'; } catch (e) {}
        if (act) act.__lmxKeep = keep;
        try { if (typeof comp.reset === 'function') comp.reset(); } catch (e) {}
        for (var i = keep.length - 1; i >= 0; i--) { try { keep[i].p.insertBefore(keep[i].e, keep[i].p.firstChild); } catch (e) {} }
        var chain = null;
        try { chain = comp.createSource(); } catch (e) { chain = null; }
        if (!chain || typeof chain.then !== 'function') return false;
        if (act) afterReload(act);
        chain.then(function () { try { if (typeof comp.search === 'function') comp.search(); else comp.find(); } catch (e) {} })['catch'](function (err) { try { if (typeof comp.noConnectToServer === 'function') comp.noConnectToServer(err); else if (typeof comp.empty === 'function') comp.empty(); } catch (e) {} });
        return true;
    }
    // Поки список перезавантажується, рідні заглушки плагіна («обрізані картки») ховаємо, показуємо смужку, а коли серії з'явились —
    // заново збираємо колекцію фокусу (comp.reset() лишає її на старих/службових вузлах) і ставимо фокус на кнопку «Джерело»
    // Лише по одному екземпляру шапки / смужки / панелей (після перезавантаження джерела шапка могла з'явитись двічі)
    function dedupeUi(act) {
        ['.lmx-onl-hero', '.lmx-onl-prog', '.lmx-onl-bar', '.lmx-onl-drop'].forEach(function (sel) {
            var all = act.querySelectorAll(sel), i;
            for (i = all.length - 1; i >= 1; i--) if (all[i].parentNode) all[i].parentNode.removeChild(all[i]);
        });
        // після повторних перебудов екрана смужка завантаження могла опинитись над шапкою фільму — шапка завжди перша
        try {
            var hr = act.querySelector('.lmx-onl-hero'), hp = hr && hr.parentNode;
            if (hp && hp.firstElementChild !== hr) {
                var ft = hp.firstElementChild;
                if (ft && ft.classList && (ft.classList.contains('lmx-onl-prog') || ft.classList.contains('lmx-onl-bar') || ft.classList.contains('lmx-onl-drop'))) hp.insertBefore(hr, ft);
            }
        } catch (e) {}
    }
    // Повільні пристрої (телефон): після зміни джерела старі картки ще стоять у списку, поки приходять нові. Позначаємо наявні як «старі»,
    // чекаємо свіжих і лише тоді прибираємо старі — інакше екран показував обидва списки одразу
    function markStale(act) {
        var b = act.querySelector('.explorer__files-body .scroll__body');
        if (b) [].forEach.call(b.children, function (el) { if (el.nodeType === 1 && !el.hasAttribute('data-lmx-old') && (el.classList.contains('selector') || el.classList.contains('lmx-onl-off'))) el.setAttribute('data-lmx-old', '1'); });
    }
    function dropStale(act) {
        var b = act.querySelector('.explorer__files-body .scroll__body'), n = 0;
        if (!b) return;
        [].slice.call(b.querySelectorAll('[data-lmx-old]')).forEach(function (el) { if (el.parentNode) { el.parentNode.removeChild(el); n++; } });
        return n;
    }
    function freshEps(body) { return episodeEls(body).filter(function (e) { return !e.hasAttribute('data-lmx-old'); }); }
    function afterReload(act) {
        act.__lmxVT0 = Date.now();
        act.classList.add('lmx-onl-rl');
        markStale(act);
        // відкрита панель вибору (джерело/сезон/озвучка) після вибору зайва — закриваємо, щоб було видно завантаження
        safe(function () { var dr = act.querySelector('.lmx-onl-drop'); if (dr && dr.parentNode) dr.parentNode.removeChild(dr); });
        safe(function () {
            var old = act.querySelector('.lmx-onl-prog'); if (old && old.parentNode) old.parentNode.removeChild(old);
            var hero = act.querySelector('.lmx-onl-hero'), hd = act.querySelector('.explorer__files-head'), pr = document.createElement('div');
            var nm = ''; try { var ii = instFor(act), Sd = ii && readSets(ii), it0 = Sd && Sd.sort && selItem(Sd.sort); nm = it0 ? String(it0.title || '').replace(/\s*~.*$/, '') : ''; } catch (e) {}
            pr.className = 'lmx-onl-prog'; pr.setAttribute('data-lmx-rl', '1');
            var bar0 = act.querySelector('.lmx-onl-bar');
            pr.innerHTML = (bar0 ? '' : PROG_PILLS) + '<div class="lmx-onl-prog__s">Завантажуємо' + (nm ? ': ' + esc(nm) : '') + '…</div><div class="lmx-onl-prog__b"><i></i></div>' + PROG_CARDS;
            // панель фільтрів лишається на місці, а завантаження — під нею, там, де з'являться серії
            if (bar0 && bar0.parentNode) bar0.parentNode.insertBefore(pr, bar0.nextSibling);
            else if (hero && hero.parentNode) hero.parentNode.insertBefore(pr, hero.nextSibling);
            else if (hd) hd.insertBefore(pr, hd.firstChild);
            // екран міг бути прокручений вниз — повертаємо нагору, щоб смужку завантаження було видно
            resetScroll(act);
        });
        // страховка від «чорного екрана» під час перезавантаження: якщо ні панелі, ні смужки завантаження не видно — показуємо рідний інтерфейс
        // і від «нескінченного завантаження»: якщо за 14 с нових серій так і не з'явилось, прибираємо смужку й повертаємо наявний список (позначку «старе» знімаємо)
        setTimeout(function () {
            safe(function () {
                if (!document.body.contains(act) || !act.classList.contains('lmx-onl-rl')) return;
                var bd = act.querySelector('.explorer__files-body .scroll__body');
                if (!bd || freshEps(bd).length) return;
                [].forEach.call(bd.querySelectorAll('[data-lmx-old]'), function (el) { el.removeAttribute('data-lmx-old'); });
                var pq = act.querySelector('.lmx-onl-prog[data-lmx-rl]'); if (pq && pq.parentNode) pq.parentNode.removeChild(pq);
                act.classList.remove('lmx-onl-rl'); relayout();
            });
        }, 14000);
        [4500, 10000].forEach(function (ms) {
            setTimeout(function () {
                safe(function () {
                    if (!document.body.contains(act)) return;
                    if (!act.classList.contains('lmx-onl-rl')) { var st = act.querySelector('.lmx-onl-prog[data-lmx-rl]'); if (st && freshEps(act.querySelector('.explorer__files-body .scroll__body') || document.createElement('div')).length && st.parentNode) st.parentNode.removeChild(st); return; }
                    var vis = false;
                    [].forEach.call(act.querySelectorAll('.lmx-onl-prog, .lmx-onl-bar, .lmx-onl-hero'), function (e) { var r = e.getBoundingClientRect(); if (r.height > 20 && r.width > 20) vis = true; });
                    if (!vis) act.classList.remove('lmx-onl-rl');
                });
            }, ms);
        });
        clearInterval(act.__lmxAR);
        var n = 0;
        act.__lmxAR = setInterval(function () {
            safe(function () {
                n++;
                if (!document.body.contains(act)) return clearInterval(act.__lmxAR);
                // MutationObserver-аналог: якщо Lampa прибрала наші шапку/смужку під час перезавантаження — повертаємо їх
                try { (act.__lmxKeep || []).slice().reverse().forEach(function (k) { var cl = k.e && String(k.e.className).split(' ')[0]; if (k.e && cl && !act.contains(k.e) && !act.querySelector('.' + cl) && k.p && act.contains(k.p) && !k.e.classList.contains('lmx-onl-drop')) k.p.insertBefore(k.e, k.p.firstChild); }); } catch (e) {}
                dedupeUi(act);
                var body = act.querySelector('.explorer__files-body .scroll__body');
                if (!body) return;
                var has = freshEps(body).length, msg = /не дав результат|no results|помилка/i.test(body.textContent || '');
                if (Date.now() < (act.__lmxRlMin || 0)) return;
                if (!has && !msg && n < 330) return;
                clearInterval(act.__lmxAR);
                // спершу оформлюємо нові картки (клас сітки, нумерація, час), і лише потім показуємо — інакше вони на мить з'являються «сирими» й вишиковуються в плитки на очах
                dropStale(act);
                holdMore(act, 2200);
                if (has) safe(buildHero);
                act.classList.remove('lmx-onl-rl');
                try { body.style.minHeight = ''; } catch (e) {}
                relayout();
                // смужка «Завантажуємо…» від перезавантаження (вибір озвучки/сезону) має зникнути, щойно з'явились серії — навіть якщо фонова перевірка джерел ще йде
                if (has) safe(function () { var rq = act.querySelector('.lmx-onl-prog[data-lmx-rl]'); if (rq && rq.parentNode) rq.parentNode.removeChild(rq); });
                if (!act.__lmxProbing) {
                    var q = act.querySelector('.lmx-onl-prog');
                    if (q && has) q.parentNode.removeChild(q);
                    else if (q && act.__lmxEG) { /* порожнє джерело: далі веде автоперемикання (emptyGuard), смужку знімає страховка */ }
                    else if (q) { var qs = q.querySelector('.lmx-onl-prog__s'); if (qs) qs.textContent = 'Це джерело нічого не дало'; q.classList.add('lmx-onl-prog--end'); deadActions(act); }
                }
                setTimeout(function () {
                    safe(function () {
                        if (!document.body.contains(act) || act.__lmxProbing || selOpen()) return;
                        hideJunk(act);
                        var fk = act.__lmxRlKey; act.__lmxRlKey = '';
                        var byUser = Date.now() - (window.__lmxManual || 0) < 20000, tg = (byUser && fk && act.querySelector('.lmx-onl-g--' + fk + ' .selector')) || act.querySelector('.lmx-onl-hero .lmx-onl-btn.selector') || act.querySelector('.lmx-onl-g--src .selector') || act.querySelector('.lmx-onl-item');
                        if (tg) { ctlContent(); syncNav(act, tg); }
                    });
                }, 300);
            });
        }, 120);
    }
    // Як у Nova: вбудовуємось у сам контролер «content». Кожен його toggle (після меню, плеєра, перезавантаження) завершуємо перезбиранням колекції фокусу
    // по шапці й списку та поверненням фокуса на живий елемент — тож стрілки не «залипають» на видалених вузлах
    var lastFocusEl = null, scrollList = [];
    // Як у Nova: запам'ятовуємо екземпляри Lampa.Scroll, щоб прокручувати рідним scroll.update(), а не лише скидати зсув стилем
    // Як у Nova (refreshMarks/hookPlayer): після закриття плеєра або зміни позначки часу оновлюємо смужки перегляду, кнопки «Продовжити/Наступна»
    // і лічильник — джерело саме смужки не перемальовує
    var markT = [];
    function refreshMarks() {
        var a = document.querySelector('.activity--active');
        if (!a || !a.querySelector('.explorer.lmx-onl') || selOpen()) return;
        try { if (Lampa.Player && typeof Lampa.Player.opened === 'function' && Lampa.Player.opened()) return; } catch (e) {}
        var body = a.querySelector('.explorer__files-body .scroll__body');
        if (!body) return;
        var keep = document.querySelector('.focus'), keepIdx = -1, els = [].slice.call(body.querySelectorAll('.lmx-onl-item'));
        keepIdx = keep ? els.indexOf(keep) : -1;
        els.forEach(function (el) {
            var tl = jd(el).timeline, h = tl && tl.hash;
            if (h === undefined || h === null || !Lampa.Timeline || !Lampa.Timeline.view) return;
            var p = 0; try { p = Lampa.Timeline.view(h).percent || 0; } catch (e) {}
            var bar = el.querySelector('.time-line > div');
            if (bar) { bar.style.width = Math.min(100, p) + '%'; if (p > 0) { var tlEl = bar.parentNode; if (tlEl && tlEl.style) tlEl.style.display = ''; } }
        });
        safe(function () { leftTimes(els); });
        safe(buildHero);
        // героя могло бути перебудовано: повертаємо фокус на ту саму серію або на кнопку «Продовжити»
        setTimeout(function () {
            safe(function () {
                var cur = document.querySelector('.focus');
                if (cur && document.body.contains(cur) && cur.offsetWidth) return;
                var tg = keepIdx >= 0 && els[keepIdx] && document.body.contains(els[keepIdx]) && els[keepIdx].offsetWidth ? els[keepIdx] : (a.querySelector('.lmx-onl-btn.selector') || a.querySelector('.lmx-onl-item'));
                if (tg) { ctlContent(); syncNav(a, tg); }
            });
        }, 120);
        relayout();
    }
    function refreshBurst() {
        markT.forEach(clearTimeout); markT = [];
        safe(refreshMarks);
        [200, 700, 1600].forEach(function (d) { markT.push(setTimeout(function () { safe(refreshMarks); }, d)); });
    }
    var outsidePl = false;
    function hookPlayerMarks() {
        if (window.__lmxPlMarks) return;
        window.__lmxPlMarks = 1;
        try {
            if (Lampa.Player && Lampa.Player.listener) {
                Lampa.Player.listener.follow('destroy', function () { outsidePl = false; refreshBurst(); });
                Lampa.Player.listener.follow('external', function () { outsidePl = true; });
                // як у Nova (hookQuality): при старті відтворення обираємо з доступних потоків найближчий до бажаної якості, але не вищий за неї
                Lampa.Player.listener.follow('start', function (data) {
                    safe(warmNext);
                    // озвучка, з якою ви справді дивитесь серіал, запам'ятовується для нього (навіть якщо ви її не вибирали вручну): наступного разу відкриється вона
                    try {
                        var pa = document.querySelector('.activity--active'), pc = Lampa.Activity.active(), pm = pc && (pc.movie || pc.card);
                        if (isOn() && pa && pm && pm.id && (pm.name || pm.number_of_seasons || (pm.first_air_date && !pm.release_date))) {
                            var pi = instFor(pa), pS = pi && readSets(pi), pg = pS && pS.voice, pv = pg && selItem(pg);
                            if (pg && pg.items && pg.items.length > 1 && pv && pv.title && !isSubOnly(pv.title) && !/оригінал|original/i.test(pv.title)) {
                                var cur0 = vpGet()[String(pm.id)];
                                if (!cur0 || vnorm(cur0.t) !== vnorm(pv.title)) vpSet(pm.id, pv.title, true);
                            }
                        }
                    } catch (e) {}
                    try {
                        if (!isOn()) return;
                        var qp = qPref(), want = qp === '4k' ? 2160 : qp === 'fhd' ? 1080 : qp === 'hd' ? 720 : 0;
                        if (!want || !data || !data.quality || typeof data.quality !== 'object') return;
                        var keys = Object.keys(data.quality), best = null, diff = Infinity, i;
                        if (!keys.length) return;
                        for (i = 0; i < keys.length; i++) { var num = parseInt(keys[i], 10); if (!isNaN(num) && num <= want && want - num < diff) { best = keys[i]; diff = want - num; } }
                        if (!best) best = keys.sort(function (x, y) { return parseInt(x, 10) - parseInt(y, 10); })[0];
                        if (best && data.quality[best]) data.url = data.quality[best];
                    } catch (e) {}
                });
            }
        } catch (e) {}
        try { if (Lampa.Timeline && Lampa.Timeline.listener && Lampa.Timeline.listener.follow) Lampa.Timeline.listener.follow('update', function () { clearTimeout(refreshBurst.__t); refreshBurst.__t = setTimeout(refreshBurst, 300); }); } catch (e) {}
        var back = function () {
            try { if (document.visibilityState && document.visibilityState !== 'visible') return; } catch (e) {}
            if (!outsidePl) return;
            outsidePl = false;
            refreshBurst();
        };
        try { document.addEventListener('visibilitychange', back, false); window.addEventListener('focus', back, false); } catch (e) {}
    }
    function hookScroll() {
        try {
            var R = Lampa.Scroll;
            if (!R || R.__lmxScroll) return;
            function Wrapped(params) { var inst = new R(params); scrollList.unshift(inst); if (scrollList.length > 8) scrollList.pop(); return inst; }
            for (var k in R) { try { Wrapped[k] = R[k]; } catch (e) {} }
            Wrapped.prototype = R.prototype;
            Wrapped.__lmxScroll = 1;
            Lampa.Scroll = Wrapped;
        } catch (e) {}
    }
    function scrollFor(node) {
        for (var i = 0; i < scrollList.length; i++) {
            try { var r = scrollList[i].render(); if (r && r.length && $.contains(r[0], node)) return scrollList[i]; } catch (e) {}
        }
        return null;
    }
    function bringIn(node) {
        var sc = scrollFor(node);
        if (sc) { try { sc.update($(node), true); return true; } catch (e) {} }
        // як у Nova: якщо рідний Scroll не знайдено, зсуваємо тіло прокрутки самі
        try {
            var box = $(node).closest('.scroll'), body = box.find('.scroll__body').first();
            if (!box.length || !body.length) return false;
            var top = node.getBoundingClientRect().top - box[0].getBoundingClientRect().top, seat = box[0].offsetHeight || 0;
            var lift = Math.round(Math.max(20, seat / 2 - (node.offsetHeight || 0) / 2));
            var st = body[0].style.transform || body[0].style['-webkit-transform'] || '';
            if (st.indexOf('translate') !== -1) {
                var pr = st.match(/-?[\d.]+px,\s*(-?[\d.]+)px/), now = pr ? parseFloat(pr[1]) || 0 : 0, nx = Math.min(0, Math.round(now - top + lift));
                body[0].style['-webkit-transform'] = body[0].style.transform = 'translate3d(0px,' + nx + 'px,0px)';
            } else box[0].scrollTop = Math.max(0, box[0].scrollTop + top - lift);
            return true;
        } catch (e) {}
        return false;
    }
    function keepFocus() {
        var act = document.querySelector('.activity--active');
        if (!act || !act.querySelector('.explorer.lmx-onl') || act.__lmxProbing || act.classList.contains('lmx-onl-rl') || selOpen()) return;
        hideJunk(act);
        var sc = act.querySelector('.explorer__files-body .scroll'), fl = act.querySelector('.explorer__files');
        try { Lampa.Controller.collectionSet($(sc || fl), sc && fl ? $(fl) : false); } catch (e) {}
        var f = lastFocusEl && document.body.contains(lastFocusEl) && lastFocusEl.offsetWidth && act.contains(lastFocusEl) && !lastFocusEl.classList.contains('lmx-onl-wide') ? lastFocusEl : null;
        var tg = f || act.querySelector('.lmx-onl-btn.selector') || act.querySelector('.lmx-onl-item');
        if (tg && window.Navigator && Navigator.focus) { Navigator.focus(tg); bringIn(tg); }
    }
    function hookController() {
        try {
            var K = Lampa.Controller;
            if (!K || K.__lmxCtl || typeof K.add !== 'function') return;
            var realAdd = K.add;
            if (!window.__lmxFocusTrack) { window.__lmxFocusTrack = 1; $(document).on('hover:focus', function (e) { if (e && e.target && e.target.nodeType === 1) lastFocusEl = e.target; }); }
            K.add = function (name, object) {
                try {
                    // як у Nova: перехоплюємо up/down самого контролера «content» (їх викликають і стрілки, і колесо миші, і геймпад — не лише keydown)
                    if (name === 'content' && object && !object.__lmxUD) {
                        object.__lmxUD = 1;
                        ['up', 'down'].forEach(function (dir) {
                            if (typeof object[dir] !== 'function') return;
                            var orig = object[dir];
                            object[dir] = function () {
                                try { if (isOn() && navStep(dir === 'up')) return; } catch (e) {}
                                return orig.apply(this, arguments);
                            };
                        });
                    }
                    if (name === 'content' && object && typeof object.enter === 'function' && !object.__lmxEn) {
                        object.__lmxEn = 1;
                        var oEnter = object.enter;
                        object.enter = function () {
                            try {
                                if (isOn() && Date.now() - (window.__lmxPickT || 0) < 800) {
                                    var fe2 = document.querySelector('.activity--active .focus');
                                    if (fe2 && fe2.classList && fe2.classList.contains('lmx-onl-item')) return;
                                }
                            } catch (e) {}
                            return oEnter.apply(this, arguments);
                        };
                    }
                    if (name === 'content' && object && typeof object.toggle === 'function' && !object.__lmxT) {
                        object.__lmxT = 1;
                        var tg0 = object.toggle;
                        object.toggle = function () {
                            // на час toggle вимикаємо анімацію прокрутки — інакше список «їде» зі старим зсувом
                            var body = null;
                            try { if (isOn()) { body = document.querySelector('.activity--active .explorer__files-body .scroll__body'); if (body) body.classList.add('notransition'); } } catch (e) {}
                            var r = tg0.apply(this, arguments);
                            try { if (isOn()) keepFocus(); } catch (e) {}
                            if (body) setTimeout(function () { try { body.classList.remove('notransition'); } catch (e) {} }, 0);
                            return r;
                        };
                    }
                } catch (e) {}
                return realAdd.apply(K, arguments);
            };
            // Вибір пункту у списку джерела/сезону/озвучки закриває його, а повторне «Enter» (автоповтор клавіші пульта, подвійна подія) потрапляло
            // на картку серії, що опинилась під ним, — і відтворення запускалось саме. Одразу після вибору «Enter» на картці серії ігноруємо (0,8 с)
            if (typeof K.enter === 'function' && !K.__lmxEnter) {
                K.__lmxEnter = 1;
                var realEnter = K.enter;
                K.enter = function () {
                    try {
                        if (isOn() && Date.now() - (window.__lmxPickT || 0) < 800) {
                            var fe = document.querySelector('.activity--active .focus');
                            if (fe && fe.classList && fe.classList.contains('lmx-onl-item')) return;
                        }
                    } catch (e) {}
                    return realEnter.apply(this, arguments);
                };
            }
            K.__lmxCtl = 1;
        } catch (e) {}
    }
    var realReplace = null;
    function hookReplace() {
        try {
            if (!Lampa.Activity || Lampa.Activity.__lmxRep || typeof Lampa.Activity.replace !== 'function') return;
            realReplace = Lampa.Activity.replace;
            Lampa.Activity.replace = function (params) {
                if (window.__lmxSwallow) return;
                var empty = !params || !Object.keys(params).length;
                if (inplaceOn() && empty && isOn()) {
                    window.__lmxInplace = 0;
                    var c = compNow();
                    if (reloadable(c) && reloadInPlace(c)) return;
                }
                return realReplace.apply(Lampa.Activity, arguments);
            };
            Lampa.Activity.__lmxRep = 1;
        } catch (e) {}
    }
    function learnUrl(url) {
        try {
            var v = String(url == null ? '' : url);
            if (!/\/lite\/[^\/?&]+/.test(v) || v.indexOf('lite/events') >= 0 || v.indexOf('lite/withsearch') >= 0) return;
            var a = Lampa.Activity.active(), c = a && (a.movie || a.card);
            window.__lmxProbeUrl = { u: v, cid: String(c && c.id || ''), t: Date.now() };
        } catch (e) {}
    }
    // Створення компонента: гасимо стандартний екран ще до першої відмальовки, підслуховуємо адреси запитів і не даємо перестворювати екран
    function hookComponent() {
        try {
            var C = Lampa.Component;
            if (!C || typeof C.create !== 'function' || C.__lmxHook) return;
            var realCreate = C.create;
            C.create = function (object) {
                var comp = realCreate.apply(C, arguments);
                try {
                    if (comp && typeof comp.changeBalanser === 'function' && !comp.__lmxHost) {
                        comp.__lmxHost = 1;
                        if (isOn() && !(object && object.component === 'torrents')) { lastEnter.t = Date.now(); lastEnter.on = true; entering(true); }
                        ['request', 'requestParams'].forEach(function (nm) {
                            var f = comp[nm];
                            if (typeof f !== 'function') return;
                            comp[nm] = function (url) {
                                var out = f.apply(comp, arguments);
                                try { learnUrl(nm === 'request' ? url : out); } catch (e) {}
                                return out;
                            };
                        });
                        var realCB = comp.changeBalanser;
                        comp.changeBalanser = function () {
                            if (!inplaceOn() || !reloadable(comp) || !isOn()) return realCB.apply(comp, arguments);
                            window.__lmxInplace = 0; window.__lmxSwallow = true;
                            try { realCB.apply(comp, arguments); } catch (e) {}
                            window.__lmxSwallow = false;
                            if (reloadInPlace(comp)) return;
                            if (realReplace) realReplace.call(Lampa.Activity, {});
                        };
                    }
                } catch (e) {}
                return comp;
            };
            C.__lmxHook = 1;
        } catch (e) {}
    }
    function hookSelect() {
        try {
            var S0 = Lampa.Select;
            if (S0 && typeof S0.show === 'function' && !S0.__lmxShow) {
                var realShow = S0.show;
                // «Вправо» на екрані «Онлайн» відкривало стандартне меню «Фільтр» — у нас свої кнопки, тож глушимо його (крім наших власних викликів)
                S0.show = function (p) {
                    try {
                        // меню «Фільтр» лише з «Скинути фільтр» (у джерела ще немає ні сезонів, ні озвучок) — порожня панель справа, що лишалась на екрані: не показуємо ніколи
                        if (isOn() && document.querySelector('.activity--active .explorer.lmx-onl') && p && Array.isArray(p.items) && p.items.length && p.items.every(function (i) { return i && i.reset; })) {
                            setTimeout(function () { ctlContent(); }, 0);
                            return;
                        }
                        if (isOn() && document.querySelector('.activity--active .explorer.lmx-onl') && p && Array.isArray(p.items) && p.items.some(function (i) { return i && i.reset; }) &&
                            Date.now() - (window.__lmxAllowSel || 0) > 1200 && !document.body.classList.contains('lmx-onl-pick')) {
                            setTimeout(function () { ctlContent(); }, 0);
                            return;
                        }
                        // дозвіл разовий: наступне «Вправо» одразу після власного вибору не має відкривати стандартне меню «Фільтр»
                        if (p && Array.isArray(p.items) && p.items.some(function (i) { return i && i.reset; })) window.__lmxAllowSel = 0;
                    } catch (e) {}
                    return realShow.apply(S0, arguments);
                };
                S0.__lmxShow = 1;
            }
        } catch (e) {}
        try {
            var S = Lampa.Select;
            if (!S || S.__lmxHook) return;
            ['hide', 'close'].forEach(function (name) {
                var real = S[name];
                if (typeof real !== 'function') return;
                S[name] = function () { try { return real.apply(S, arguments); } catch (e) {} };
            });
            S.__lmxHook = 1;
        } catch (e) {}
    }
    // Екземпляр фільтра, що належить цьому екрану; якщо привʼязати до DOM не вдалось — найновіший, який уже отримав списки
    function instFor(act) {
        var i, el, inst;
        for (i = 0; i < FILTERS.length; i++) {
            inst = FILTERS[i];
            try { el = inst.render && inst.render(); el = el && el[0]; if (el && act.contains(el)) { inst.lmx_comp = compNow(); return inst; } } catch (e) {}
        }
        for (i = 0; i < FILTERS.length; i++) {
            inst = FILTERS[i];
            // запасний шлях лише для того самого онлайн-плагіна: інакше «Сортувати» в іншому плагіні (Alpac тощо) показувало б дані lampaua
            if (inst.lmx_sets && (inst.lmx_sets.sort || inst.lmx_sets.filter) && Date.now() - inst.lmx_t < 60000 && (!inst.lmx_comp || inst.lmx_comp === compNow())) return inst;
        }
        return null;
    }
    // TMDB-«сезон 0» — це спеціальні випуски (OVA, фільми, спешли), а не справжній сезон
    function seTitle(t) { return /^\s*(сезон|season)\s*0\s*$/i.test(t || '') ? 'Спеціальні' : t; }
    // Джерела з підписом «нужна привязка» (без прив'язки акаунта) нічого не віддають: у перевірках і автопідборі їх пропускаємо. Після прив'язки підпис зникає, і джерело працює як усі
    function unbound(x) { try { return !!(x && /нужна привязк|потрібна прив[’'`]?язк|потрібен прив/i.test(String(x.subtitle || x.description || x.info || ''))); } catch (e) { return false; } }
    function readSets(inst) {
        var out = { season: null, voice: null, sort: [], sortAll: [] };
        if (!inst || !inst.lmx_sets) return out;
        (inst.lmx_sets.filter || []).forEach(function (g) {
            if (!g || !g.items || !g.items.length) return;
            if (g.stype === 'season') out.season = g; else if (g.stype === 'voice') out.voice = g;
        });
        out.sortAll = inst.lmx_sets.sort || [];
        out.sort = out.sortAll.filter(function (x) { return !x || x.selected || !unbound(x); });
        return out;
    }
    function selItem(g) {
        var i;
        if (!g || !g.items) return null;
        for (i = 0; i < g.items.length; i++) if (g.items[i] && g.items[i].selected) return g.items[i];
        return g.items[0] || null;
    }
    function idxOf(g, it) { return typeof it.index === 'number' ? it.index : g.items.indexOf(it); }
    // ---- Власний випадний ряд вибору (джерело / сезон / озвучка): рядок кнопок під панеллю, без рідних меню Lampa ----
    // Колекцію фокусованих елементів перебираємо самі (Controller.collectionSet) і явно ставимо фокус — так керування не губиться
    function syncNav(act, el) {
        safe(function () {
            var sc = act.querySelector('.explorer__files-body .scroll'), fl = act.querySelector('.explorer__files');
            try { Lampa.Controller.collectionSet($(sc || fl), sc && fl ? $(fl) : false); } catch (e) {}
            if (el && window.Navigator && Navigator.focus) {
                var okf = Navigator.focus(el);
                // елемент не потрапив у колекцію (джерело зі своєю розміткою) — додаємо його вручну й пробуємо ще раз
                if (okf === false) {
                    if (!el.classList.contains('selector')) el.classList.add('selector');
                    try { Lampa.Controller.collectionAppend($(el)); } catch (e) {}
                    if (Navigator.focus(el) === false) { el.classList.add('focus'); try { $(el).trigger('hover:focus'); } catch (e) {} }
                }
            }
            // шапка Lampa (пошук, налаштування…) інколи лишає свій клас focus — тоді виділення «двоїться», а стрілки читають не той елемент
            if (el) [].forEach.call(document.querySelectorAll('.focus'), function (x) { if (x !== el) x.classList.remove('focus'); });
        });
    }
    // Що джерело знайшло для цього матеріалу: 'ok' (є серії), 'no' (порожньо), '' (ще не перевіряли)
    // Типи озвучок (дубляж / багатоголосий / …) — для групування у списку озвучок
    // Озвучки, які користувач сам обирав двічі й більше, плагін теж вважає «своїми» й піднімає вгору — так список «вчиться» на ваших вподобаннях
    // Озвучка, яку користувач сам обрав для цього матеріалу: наступного разу відкриваємо одразу її
    function vpGet() { try { var v = Lampa.Storage.get('lmx_watch_vp', ''); if (typeof v === 'string' && v) v = JSON.parse(v); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
    function vpSet(cid, title, auto) {
        try {
            cid = String(cid || ''); if (!cid || !title) return;
            var m = vpGet(), ks = Object.keys(m);
            if (ks.length > 200) ks.sort(function (a, b) { return (m[a].ts || 0) - (m[b].ts || 0); }).slice(0, ks.length - 150).forEach(function (k) { delete m[k]; });
            m[cid] = { t: String(title), ts: Date.now() };
            if (auto) m[cid].a = 1;   // запам'ятовано автоматично зі перегляду, а не обрано вручну
            Lampa.Storage.set('lmx_watch_vp', JSON.stringify(m));
        } catch (e) {}
    }
    function vnorm(t) { return String(t || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    // Яку озвучку відкрити першою: збережений вибір для цього серіалу → найчастіше обирана українська → дубляж → багатоголосий → перша українська зі списку
    function pickVoice(cid, items) {
        var vp = vpGet(), ve = vp[String(cid)], rem = ve && vnorm(ve.t), vc = vcGet(), best = null, bs = -1, i, t, sc;
        // автоматично запам'ятована НЕ українська озвучка не заважає відкрити українську, якщо вона з'явилась; вручну обрану поважаємо завжди
        if (ve && ve.a && !isUaVoice(ve.t) && items.some(function (x) { return x && x.title && isUaVoice(String(x.title)); })) rem = '';
        for (i = 0; i < items.length; i++) {
            if (!items[i] || !items[i].title) continue;
            t = String(items[i].title); var n = vnorm(t);
            if (rem && n === rem) return items[i];
            if (!isUaVoice(t)) continue;
            sc = 1 + (vc[n] || 0) * 10 + (/дубл|dub/i.test(t) ? 3 : 0) + (/багатоголос|multi|2\+|різноголос/i.test(t) ? 2 : 0) + (/укр|ukr/i.test(t) ? 1 : 0) - i * 0.001;
            if (sc > bs) { bs = sc; best = items[i]; }
        }
        return best;
    }
    // Вибір озвучки «під заставкою»: список уже прийшов, але екран ще закритий смужкою завантаження — міняємо озвучку до першого показу, тож перезавантаження не видно.
    // Один раз на джерело+сезон; не чіпаємо, якщо користувач уже щось натискав; якщо з новою озвучкою серій немає — повертаємо попередню
    function voiceGate(act, card, list) {
        try {
            if (!vautoOn() || !(act.classList.contains('lmx-onl-load') || act.classList.contains('lmx-onl-rl')) || act.__lmxOpen || selOpen()) return false;   // і при першому відкритті, і після ручної зміни джерела
            var man = Date.now() - (window.__lmxManual || 0) < 120000;   // ручна зміна джерела: озвучку попереднього джерела не переносимо — беремо українську (або будь-яку) вже нового
            if (!man && !(card && (card.name || card.number_of_seasons || (card.first_air_date && !card.release_date)))) return false;   // для фільмів озвучку не підбираємо
            var inst = instFor(act), S = inst && readSets(inst), g = S && S.voice;
            if (!g || !g.items || g.items.length < 2) return false;
            var cid = String(card && card.id || ''), sel = S.sort && curSrc(act, S.sort), sn = S.season && selItem(S.season);
            if (Date.now() - (window.__lmxPickT || 0) < 30000 && /jac|torrent|jackett|torr|magnet/i.test(window.__lmxPickKey || '')) return false;   // щойно вручну відкрили торентне джерело
            if ((sel && isTorSrc(sel)) || (list || []).some(function (e) { return /torrent/i.test(e.className) || e.querySelector('[class*="torrent"], [class*="seed"]'); })) return false;   // торенти мають власну систему вибору озвучок — не чіпаємо
            var key = cid + '|' + (sel ? srcName(sel.title) : '') + '|' + (sn ? seTitle(sn.title) : '');
            act.__lmxVG = act.__lmxVG || {};
            if (act.__lmxVG[key]) return false;
            act.__lmxVG[key] = 1;
            var t0 = act.__lmxVT0 || 0;
            if (!man && Date.now() - t0 > 12000) return false;   // джерело й так відповідало довго — не додаємо ще одне очікування
            if ((window.__lmxKeyT || 0) > t0 || (window.__lmxTouchT || 0) > t0 || (window.__lmxUserVoiceT || 0) > t0) return false;
            var cur = selItem(g), cand = pickVoice(cid, g.items);
            if (!cand || cand === cur) return false;
            if (cur && !vpGet()[cid] && isUaVoice(cur.title)) return false;
            if (cand.title && cur && vnorm(cand.title) === vnorm(cur.title)) return false;
            act.__lmxVGt = Date.now();
            try { heroStatus(act, 'Підбираємо озвучку\u2026', false, 0.92); } catch (e) {}
            var prev = cur, idx = idxOf(g, cand), stype = g.stype;
            selIn(inst, 'filter', { stype: stype }, { index: idx });
            setTimeout(function () {
                safe(function () {
                    if (!document.body.contains(act)) return;
                    act.__lmxVGt = 0;
                    if (act.querySelector('.lmx-onl-item') || !prev) return;
                    var i2 = instFor(act), S2 = i2 && readSets(i2), g2 = S2 && S2.voice, j;
                    if (!g2) return;
                    for (j = 0; j < g2.items.length; j++) if (g2.items[j] && vnorm(g2.items[j].title) === vnorm(prev.title)) { selIn(i2, 'filter', { stype: g2.stype }, { index: idxOf(g2, g2.items[j]) }); break; }
                });
            }, 5000);
            return true;
        } catch (e) { return false; }
    }
    function vcGet() { try { var v = Lampa.Storage.get('lmx_watch_vc', ''); if (typeof v === 'string' && v) v = parseCached(VC_SLOT, v); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
    function vcNote(t) {
        try { var m = vcGet(), k = String(t || '').replace(/\s+/g, ' ').trim().toLowerCase(); if (!k) return; m[k] = (m[k] || 0) + 1; Lampa.Storage.set('lmx_watch_vc', JSON.stringify(m)); } catch (e) {}
    }
    // Субтитри (навіть українські) озвучкою не вважаємо — лишаються в «Інших»; назва, що закінчується на «UA» (FanVoxUA, AniUA), — українська
    // субтитри (будь-де в назві: «Українські субтитри», «UA Sub») — це не озвучка: не обираються й не рахуються автоматично
    function isSubOnly(t) { return /субтитр|subtitle|(^|[^a-z])subs?([^a-z]|$)/i.test(String(t || '')); }
    function isUaVoice(t) { if (/оригінал|original|озвучення іншого/i.test(t)) return false; if (isSubOnly(t)) return false; if (/anidub|ани ?даб|ані ?даб/i.test(t) || (/[ыэъё]/i.test(t) && !/укр|ukr/i.test(t))) return false; return UA_VOICE.test(t) || /[A-Za-z\u0400-\u04FF]UA\b/.test(t) || (vcGet()[String(t || '').replace(/\s+/g, ' ').trim().toLowerCase()] || 0) >= 2; }
    var UA_VOICE = /укр|ukr|uaflix|уафлікс|(^|[^a-z])qtv([^a-z]|$)|saturn ?union|amanogawa|аманогава|fronda|фронда|freedub|фрідаб|inari ?dub|інарі ?даб|4ua|(^|[^a-z0-9])10gu|animesh|анімеш|сатурн ?юніон|\bua\b|(^|[^а-яіїєґ])уа([^а-яіїєґ]|$)|postmodern|постмодерн|pozitiv|позитив|dniprofilm|дніпрофільм|gears media|так треба|1\+1|2\+2|ictv|новий канал|(^|[^а-яіїєґ])стб([^а-яіїєґ]|$)|інтер|hdrezka ua|tvoe kino ua|[іїєґІЇЄҐ]|енейв|eneyida|enej|didko|дідько|гуртом|hurtom|омікрон|omikron|filmua|ledoyen|мазепа|mazepa|dublіv|дубл[іи]в|sweet\.?tv|(^|[^а-яіїєґ])тет([^а-яіїєґ]|$)|\btet\b|pythagoras|піфагор|adrian ?zp|cinema ?prestige|kyivstar|київстар|нтн|(^|[^а-яіїєґ])к1([^а-яіїєґ]|$)|(^|[^а-яіїєґ])к2([^а-яіїєґ]|$)|телеканал|трк україна|студія|студія|film\.?ua|ukr ?tv|\bdub ?ua\b|\bdublyazh|дубляж укр|багатоголосий укр|кіноманія|kino ?mania|ufdub|voices ?band|робота голосом|кайзок|kaizoku|кіото|kioto|козацьк|kozac|fan ?vox|flame ?studio|sun ?dragon|glass ?moon|(^|[^а-яіїєґ])ско(?![а-яіїєґ])|fan ?wox|чаюванн|аніме ?укр|aniua|ukranime|aurora production|ukr ?dub|укрдуб|гуртом/i;
    function isTorSrc(x) { return /jac|torrent|jackett|torr|magnet/i.test(String(x && x.title) + ' ' + String(x && x.source)) ? 1 : 0; }
    // Стан джерела для поточного сезону (джерело може мати один сезон і не мати іншого): 'ok' / 'no' / ''
    function curSeason() {
        try { var act = document.querySelector('.activity--active'), inst = act && instFor(act), S = inst && readSets(inst), it = S && selItem(S.season); return it ? String(it.title || '') : ''; } catch (e) { return ''; }
    }
    function seGet(cid, key) { var m = window.__lmxSE; return m && m[cid + '|' + key + '|' + curSeason()] || ''; }
    function seSet(cid, key, v) { if (!cid || !key) return; var m = window.__lmxSE || (window.__lmxSE = {}); m[cid + '|' + key + '|' + curSeason()] = v; }
    function srcState(name) {
        var gs = window.__lmxProbe, bad = window.__lmxBad, cid = '', i;
        try { var a = Lampa.Activity.active(), c = a && (a.movie || a.card); cid = String(c && c.id || ''); } catch (e) {}
        var se = seGet(cid, name); if (se) return se;
        var pe = pcEntry(cid, name);
        if (pe && pe.s === 'ok') return 'ok';
        if (pe && pe.s === 'empty') return 'no';
        if (gs && gs.cid === cid) {
            for (i = 0; i < gs.results.length; i++) if (gs.results[i].name === name) return 'ok';
            if (gs.tried.indexOf(name) >= 0 && gs.cur !== name) return 'no';
            if (gs.tried.indexOf(name) >= 0 && gs.done) return 'no';
        }
        if (bad && bad.cid === cid && bad.names.indexOf(name) >= 0) return 'no';
        return '';
    }
    // Як у Nova (relayout): після зміни висоти шапки (відкрили/закрили ряд, перезавантажили список) просимо Lampa перерахувати розміри —
    // інакше нижня частина екрана «стискається», знизу чорна смуга, а прокрутка не йде далі другого ряду
    function relayout() {
        try {
            if (!Lampa.Layer || typeof Lampa.Layer.update !== 'function') return;
            var cur = Lampa.Activity.active();
            if (!cur || !cur.activity) return;
            var target = cur.activity.render();
            Lampa.Layer.update(target);
            setTimeout(function () { try { Lampa.Layer.update(target); } catch (e) {} }, 120);
        } catch (e) {}
    }
    function closeDrop(act, key) {
        var d = act.querySelector('.lmx-onl-drop');
        if (d) d.parentNode.removeChild(d);
        act.__lmxOpen = '';
        if (key) { var pill = act.querySelector('.lmx-onl-g--' + key + ' .selector'); if (pill) syncNav(act, pill); }
        relayout();
    }
    // Випадаючий список під кнопкою: позиція від кнопки, висота — до низу екрана, довгі списки прокручуються всередині
    function popPlace(act, d, key, bar) {
        var g = act.querySelector('.lmx-onl-g--' + key), par = bar.parentNode;
        var pill = g && (g.querySelector('.selector') || g);
        if (!pill || !par) return;
        if (window.getComputedStyle(par).position === 'static') par.style.position = 'relative';
        var pr = pill.getBoundingClientRect(), br = par.getBoundingClientRect();
        d.classList.add('lmx-onl-drop--pop');
        d.style.left = Math.max(0, pr.left - br.left) + 'px';
        d.style.top = (pr.bottom - br.top + 4) + 'px';
        d.style.minWidth = Math.max(pr.width, 180) + 'px';
        d.style.maxWidth = Math.max(240, window.innerWidth - pr.left - 24) + 'px';
        d.style.maxHeight = Math.max(160, window.innerHeight - pr.bottom - 28) + 'px';
        d.addEventListener('scroll', function () { popHint(d); });
        popHint(d);
    }
    // підказки «↑ ще N / ↓ ще N», коли в списку є пункти поза видимою частиною
    function popHint(d) {
        if (!d) return;
        var its = [].slice.call(d.querySelectorAll('.lmx-onl-opt')), up = 0, dn = 0, top = d.scrollTop, bot = top + d.clientHeight;
        its.forEach(function (x) { if (x.offsetTop + x.offsetHeight <= top + 2) up++; else if (x.offsetTop >= bot - 2) dn++; });
        if (up) d.setAttribute('data-up', '\u2191 ще ' + up); else d.removeAttribute('data-up');
        if (dn) d.setAttribute('data-dn', '\u2193 ще ' + dn); else d.removeAttribute('data-dn');
    }
    // прокрутка всередині списку (scrollIntoView не використовуємо: він міг би зсунути весь екран)
    function popReveal(el) {
        var d = el && el.closest && el.closest('.lmx-onl-drop--pop');
        if (!d) return;
        var t = el.offsetTop, h = el.offsetHeight;
        if (t < d.scrollTop) d.scrollTop = Math.max(0, t - 4);
        else if (t + h > d.scrollTop + d.clientHeight) d.scrollTop = t + h - d.clientHeight + 4;
        popHint(d);
    }
    function toggleDrop(act, key) {
        var inst = instFor(act), S = inst && readSets(inst), opts = [], bar = act.querySelector('.lmx-onl-bar');
        if (!S || !bar) return false;
        if (act.__lmxOpen === key) { closeDrop(act, key); return true; }
        // щойно вибрали пункт: повторне «ОК» (автоповтор / keyup пульта) не має знову відкривати список
        if ((act.__lmxPopT || 0) > Date.now() - 700) return true;
        if (key === 'src') {
            var hidden = 0, anyOk = false;
            var allSrc = S.sortAll || S.sort, lifeFlags = allSrc.some(function (x) { return x && typeof x.ghost !== 'undefined'; });
            allSrc.forEach(function (it) { if (it && !unbound(it) && (lifeFlags ? !it.ghost : srcState(srcName(it.title)) === 'ok')) anyOk = true; });
            var cid0 = ''; try { var ac = Lampa.Activity.active(), cd0 = ac && (ac.movie || ac.card); cid0 = String(cd0 && cd0.id || ''); } catch (e) {}
            var seenLook = {}, mem1 = memGet(), curS = curSrc(act, allSrc);
            allSrc.forEach(function (it) {
                if (!it) return;
                var key0 = srcName(it.title), st = srcState(key0);
                if (lifeFlags) st = it.ghost ? 'no' : 'ok';
                if (unbound(it) && !it.selected) st = 'no';
                var se0 = seGet(cid0, key0); if (se0) st = se0;
                // дублі (однакова назва й якість) об'єднуємо; бейдж якості береться з назви або з пам'яті попередніх перевірок
                var badge = titleQ(it.title) ? '' : qmBadge(cid0, key0), look = key0 + '|' + (titleQ(it.title) || badge);
                var title = badge ? it.title + ' \u00b7 ' + badge : it.title;
                var prev = seenLook[look];
                if (prev) { var isSel = curS ? it === curS : !!it.selected; if ((isSel && !prev.sel) || (!isSel && !prev.sel && st === 'ok' && !prev.ok)) { prev.title = title; prev.sel = isSel; prev.ok = st === 'ok'; prev.dim = !!it.ghost || st === 'no'; prev.run = function () { selIn(inst, 'sort', it); }; } return; }
                // українські джерела (за назвою) не ховаємо, навіть якщо швидка перевірка їх не підтвердила: вона могла просто не дочекатись відповіді
                if (anyOk && !act.__lmxAllSrc && st !== 'ok' && !it.selected && true) { hidden++; return; }
                var o = { title: title, sel: curS ? it === curS : !!it.selected, dim: !!it.ghost || st === 'no', ok: st === 'ok', run: function () { manualPick(cid0, key0); selIn(inst, 'sort', it); } };
                // рейтинг і підпис: реальні дані перевірки (укр. озвучки, швидкість), якщо вони є
                var pe1 = pcEntry(cid0, key0); pe1 = pe1 && pe1.s === 'ok' ? pe1 : null;
                var sc1 = srcScore(key0, { q: titleQ(it.title) || qrank(badge), pe: pe1 }, mem1), sp = [];
                if (pe1) { if (sc1.ua === 'real') sp.push('\uD83C\uDDFA\uD83C\uDDE6 ' + pe1.uv); else if (sc1.ua === 'none') sp.push('без укр.'); if (sc1.ms) sp.push((sc1.ms / 1000).toFixed(1) + ' с'); }
                o.sc = sc1.s; o.why = sc1.why; o.sub = sp.join(' \u00b7 '); o.idx = opts.length;
                if (unbound(it)) { o.sub = 'потрібна прив\u2019язка'; o.dim = true; o.ok = false; o.sc = -1e6; }
                seenLook[look] = o;
                opts.push(o);
            });
            // порядок за рейтингом (вимикається в налаштуваннях): джерела без результатів — внизу, решта від найкращого; рівні — як у списку плагіна
            if (opts.length > 1 && sortSrcOn()) opts.sort(function (x, y) { return ((x.dim ? 1 : 0) - (y.dim ? 1 : 0)) || (y.sc - x.sc) || (x.idx - y.idx); });
            // у розкритому списку спершу джерела з результатами, нижче — без результатів (під розділювачем)
            if (anyOk && act.__lmxAllSrc) {
                var okO = opts.filter(function (x) { return x.ok || x.sel; }), noO = opts.filter(function (x) { return !(x.ok || x.sel); });
                if (okO.length && noO.length) opts = okO.concat([{ sep: true, title: 'Без результатів' }], noO);
            }
            // ★ рекомендоване джерело (найвищий рейтинг серед тих, що мають результат); при впорядкованому списку — ще й заголовки груп
            var bestI = -1, bestS = -1e9, realN = opts.filter(function (x) { return !x.sep; }).length;
            opts.forEach(function (x, i) { if (!x.sep && !x.dim && x.sc > bestS) { bestS = x.sc; bestI = i; } });
            if (bestI >= 0 && realN > 1) {
                opts[bestI].star = true;
                if (sortSrcOn() && bestI === 0) {
                    var r0 = opts[0], habit = r0.why && r0.why.indexOf('ваш звичний вибір') >= 0, why0 = (r0.why || []).filter(function (w) { return w !== 'ваш звичний вибір'; });
                    opts.splice(0, 0, { sep: true, title: (habit ? '\u2605 Частий вибір' : '\u2605 Найкращий') + (why0.length ? ' \u00b7 ' + why0.join(', ') : '') });
                    if (realN > 2 && opts[2] && !opts[2].sep) opts.splice(2, 0, { sep: true, title: 'Доступно' });
                }
            }
            if (anyOk && (hidden || act.__lmxAllSrc)) opts.push({ title: act.__lmxAllSrc ? 'Лише з результатом' : 'Показати всі (+' + hidden + ')', sticky: true, run: function () { act.__lmxAllSrc = !act.__lmxAllSrc; } });
        }
        else if (key === 'page') {
            var pgs = act.__lmxPages;
            if (!pgs) return false;
            for (var pk = 0; pk < pgs.n; pk++) (function (k) {
                opts.push({ title: pageLabel(pgs, k), sel: k === pgs.pg, run: function () {
                    act.__lmxPage = k;
                    var lst = act.__lmxList || [];
                    applyOrderPages(act, lst);
                    safe(function () { var a9 = Lampa.Activity.active(), c9 = a9 && (a9.movie || a9.card); if (c9) epInfo(lst, c9, act); });   // назви/дати серій нової сторінки
                    var hd2 = act.querySelector('.explorer__files-head');
                    if (hd2) safe(function () { buildBar(act, hd2, lst); });
                    var first = null; lst.forEach(function (x) { if (!first && x.classList.contains('selector')) first = x; });
                    if (first) { ctlContent(); syncNav(act, first); bringIn(first); }
                } });
            })(pk);
        } else {
            var g = key === 'season' ? S.season : S.voice;
            if (!g) return false;
            g.items.forEach(function (it) { if (it) opts.push({ title: key === 'season' ? seTitle(it.title) : it.title, sel: !!it.selected, run: function () { if (key === 'voice') { vcNote(it.title); window.__lmxUserVoiceT = Date.now(); try { var ac2 = Lampa.Activity.active(), cd2 = ac2 && (ac2.movie || ac2.card); vpSet(cd2 && cd2.id, it.title); } catch (e) {} } selIn(inst, 'filter', { stype: g.stype }, { index: idxOf(g, it) }); } }); });
            // українські озвучки — вгору (порядок усередині груп зберігається); вимикається в налаштуваннях «Перевага українській озвучці»
            if (key === 'voice' && uaOn()) {
                var uaV = opts.filter(function (x) { return isUaVoice(x.title) || (isSubOnly(x.title) && (UA_VOICE.test(x.title) || /укр|ukr|[іїєґ]|(^|[^a-z])ua([^a-z]|$)/i.test(x.title))); }), otV = opts.filter(function (x) { return uaV.indexOf(x) < 0; });
                if (uaV.length && otV.length) opts = uaV.concat([{ sep: true, title: 'Інші озвучки' }], otV);
            }
        }
        if (!opts.length) return false;
        closeDrop(act);
        act.__lmxOpen = key; act.__lmxSA = 2;
        var d = document.createElement('div'), focusEl = null;
        d.className = 'lmx-onl-drop';
        opts.forEach(function (o) {
            var c = document.createElement('div');
            if (o.sep) { c.className = 'lmx-onl-sep'; c.textContent = o.title; d.appendChild(c); return; }
            c.className = 'simple-button selector lmx-onl-opt' + (o.sel ? ' lmx-onl-opt--on' : '') + (o.dim ? ' lmx-onl-opt--dim' : '') + (o.ok ? ' lmx-onl-opt--ok' : '');
            var qm = key === 'src' && !o.sticky ? String(o.title).match(/^(.*?)\s*(?:[~\-\u2013\u2014|\u00b7]\s*)(4K|2160p?|UHD|1440p?|1080p?|FHD|720p?|HD|480p?|SD)\s*$/i) : null;
            if (qm && qm[1]) {
                var nm0 = document.createElement('span'), q0 = document.createElement('span');
                nm0.className = 'lmx-onl-opt__n'; nm0.textContent = (o.star ? '\u2605 ' : '') + qm[1]; q0.className = 'lmx-onl-opt__q'; q0.textContent = qm[2].toUpperCase().replace(/P$/, '');
                c.appendChild(nm0); if (o.sub) { var sb0 = document.createElement('span'); sb0.className = 'lmx-onl-opt__s'; sb0.textContent = o.sub; c.appendChild(sb0); } c.appendChild(q0);
            } else { var nm1 = document.createElement('span'); nm1.className = 'lmx-onl-opt__n'; nm1.textContent = (o.star ? '\u2605 ' : '') + o.title; c.appendChild(nm1); if (o.sub) { var sb1 = document.createElement('span'); sb1.className = 'lmx-onl-opt__s'; sb1.textContent = o.sub; c.appendChild(sb1); } }
            $(c).on('hover:enter click', once(function () {
                if (o.sticky) { try { o.run(); } catch (e) {} act.__lmxOpen = ''; closeDrop(act); toggleDrop(act, key); return; }
                window.__lmxManual = Date.now();
                window.__lmxPopSel = Date.now(); window.__lmxPickT = Date.now(); act.__lmxPopT = Date.now();
                closeDrop(act, key);
                if (!o.sel) {
                    try { o.run(); } catch (e) {}
                    // сезон/озвучка: як і при зміні джерела, ховаємо рідні «сирі» картки й показуємо свою заглушку, поки з'являться наші
                    if (key === 'season' || key === 'voice' || key === 'src') holdFocus(act, key, 15000);
                    if (key === 'season' || key === 'voice') { act.__lmxRlKey = key; act.__lmxRlMin = Date.now() + 450; act.__lmxKeep = []; safe(function () { afterReload(act); }); }
                    recover(act);
                    if (key === 'src') { act.__lmxRlKey = 'src'; act.__lmxEG = 0; emptyGuard(act); act.__lmxRlMin = Date.now() + 450; act.__lmxKeep = []; safe(function () { afterReload(act); }); }
                }
            }));
            d.appendChild(c);
            if (o.sel && !focusEl) focusEl = c;
        });
        bar.parentNode.insertBefore(d, bar.nextSibling);
        if (key === 'season' || key === 'voice' || key === 'src' || key === 'page') safe(function () { popPlace(act, d, key, bar); });
        syncNav(act, focusEl || d.querySelector('.selector'));
        if (d.classList.contains('lmx-onl-drop--pop')) popReveal(focusEl || d.querySelector('.selector'));
        relayout();
        return true;
    }
    // «Назад» при відкритому ряді закриває ряд, а не весь екран
    function dropBackHook() {
        if (window.__lmxDropBack) return;
        window.__lmxDropBack = 1;
        document.addEventListener('keydown', function (e) {
            var a = document.querySelector('.activity--active'), k = e.keyCode;
            if (!a || !a.__lmxOpen) return;
            if (k === 27 || k === 8 || k === 10009 || k === 461 || e.key === 'Escape' || e.key === 'GoBack') {
                e.preventDefault(); e.stopImmediatePropagation();
                closeDrop(a, a.__lmxOpen);
            }
        }, true);
    }
    // ---- Єдина навігація «вгору/вниз» по екрану (замість кількох окремих «рятувальників») ----
    // Рівні: кнопки героя → ряд вибору → відкритий ряд варіантів (по рядках) → кнопки «Повторити» → картки серій (по рядках).
    // Стрілка завжди переходить рівно на сусідній рядок і тримає ту саму колонку; штатну навігацію Lampa не питаємо,
    // бо вона стрибала через ряди та у шапку Lampa. З кнопок героя «вгору» віддаємо Lampa (шапка), далі не лізе нічого.
    var navCx = null, navT = 0;
    function navRows(a) {
        function vis(x) { return x.offsetWidth && x.offsetHeight && !x.classList.contains('lmx-onl-off'); }
        function group(sel) {
            var els = [].slice.call(a.querySelectorAll(sel)).filter(vis).map(function (x) { return { e: x, r: x.getBoundingClientRect() }; });
            els.sort(function (p, q) { return (p.r.top - q.r.top) || (p.r.left - q.r.left); });
            var rows = [], last = null;
            els.forEach(function (o) {
                if (!last || Math.abs(o.r.top - last.top) > Math.max(8, o.r.height / 3)) { last = { top: o.r.top, els: [] }; rows.push(last); }
                last.els.push(o.e);
            });
            return rows.map(function (r) { return r.els; });
        }
        var rows = [];
        [group('.lmx-onl-hero .selector'), group('.lmx-onl-bar .selector'), group('.lmx-onl-drop .selector'), group('.lmx-onl-dead .selector'), group('.lmx-onl-item.selector')].forEach(function (g) { g.forEach(function (r) { rows.push(r); }); });
        return rows;
    }
    // Повертає true, якщо ми обробили крок (в т.ч. «проковтнули» його на краю), false — віддати штатній навігації Lampa
    function navStep(up) {
        var a = document.querySelector('.activity--active'), cur = null;
        if (!a || !a.querySelector('.explorer.lmx-onl') || selOpen() || selCtl()) return false;
        // «справжній» фокус — той, що знає навігатор Lampa (клас focus лише косметика і може лишатись на кількох елементах)
        try { cur = window.Navigator && Navigator.getFocusedElement ? Navigator.getFocusedElement() : null; } catch (e) { cur = null; }
        if (!(cur && cur.nodeType === 1 && a.contains(cur) && document.body.contains(cur))) cur = a.querySelector('.focus');
        var pop = cur && cur.closest && cur.closest('.lmx-onl-drop--pop');
        if (pop) {
            var its = [].slice.call(pop.querySelectorAll('.selector')), ix = its.indexOf(cur), nx = its[ix + (up ? -1 : 1)];
            window.__lmxKeyT = Date.now();
            if (nx) { syncNav(a, nx); popReveal(nx); }
            return true;
        }
        var rows = navRows(a), ri = -1, k;
        if (!cur) {
            // фокус у шапці Lampa: «вниз» повертає на головну кнопку героя
            if (!up && rows.length && document.querySelector('.focus')) { window.__lmxKeyT = Date.now(); syncNav(a, rows[0][0]); return true; }
            return false;
        }
        for (k = 0; k < rows.length; k++) if (rows[k].indexOf(cur) >= 0) { ri = k; break; }
        if (ri < 0) return false;                            // фокус не на наших елементах — штатна поведінка
        var ti = ri + (up ? -1 : 1);
        if (ti < 0) return false;                            // вище героя — шапка Lampa
        if (ti >= rows.length) return true;                  // нижче немає нічого
        var row = rows[ti], cr = cur.getBoundingClientRect(), now = Date.now();
        if (navCx === null || now - navT > 1500) navCx = cr.left + cr.width / 2;
        navT = now;
        var best = null, bd = 1e9;
        if (up && ti === 0) best = rows[0][0];               // до героя — завжди на головну кнопку
        if (!best) row.forEach(function (x) { var r = x.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - navCx); if (d < bd) { bd = d; best = x; } });
        if (!best) return true;
        window.__lmxKeyT = now;
        syncNav(a, best);
        if (best.classList.contains('lmx-onl-item')) bringIn(best);
        return true;
    }
    // Поки відкритий випадаючий список — він єдиний, що приймає пульт: стрілки ходять тільки по ньому, «ОК» вибирає, фокус не йде на картки
    function popItem(pop) {
        return pop.querySelector('.lmx-onl-opt.focus') || pop.querySelector('.lmx-onl-opt--on') || pop.querySelector('.lmx-onl-opt');
    }
    function popKeys(e) {
        var a = document.querySelector('.activity--active'), pop = a && a.querySelector('.lmx-onl-drop--pop');
        if (!pop || selOpen() || selCtl()) return false;
        var k = e.keyCode, nm = e.key, up = k === 38 || nm === 'ArrowUp', dn = k === 40 || nm === 'ArrowDown',
            lr = k === 37 || k === 39 || nm === 'ArrowLeft' || nm === 'ArrowRight', ok = k === 13 || nm === 'Enter';
        if (!up && !dn && !lr && !ok) return false;
        var its = [].slice.call(pop.querySelectorAll('.lmx-onl-opt')), cur = popItem(pop), ix = its.indexOf(cur);
        window.__lmxKeyT = Date.now();
        e.preventDefault(); e.stopImmediatePropagation();
        if (ok) { window.__lmxPopSel = Date.now(); if (cur) try { $(cur).trigger('hover:enter'); } catch (x) {} return true; }
        if (lr) {
            // вліво/вправо закриває список, а фокус переходить на сусідню кнопку панелі в той бік, куди натиснули
            var goR = k === 39 || nm === 'ArrowRight', key0 = a.__lmxOpen;
            var pills = [].slice.call(a.querySelectorAll('.lmx-onl-bar .selector')), own = key0 && a.querySelector('.lmx-onl-g--' + key0 + ' .selector'), pi = pills.indexOf(own);
            var tgt = pi >= 0 ? pills[Math.max(0, Math.min(pills.length - 1, pi + (goR ? 1 : -1)))] : own;
            closeDrop(a);
            if (tgt) { ctlContent(); syncNav(a, tgt); }
            return true;
        }
        if (!its.length) return true;
        var nx = its[Math.max(0, Math.min(its.length - 1, (ix < 0 ? 0 : ix) + (up ? -1 : 1)))];
        if (nx && nx !== cur || !document.querySelector('.lmx-onl-drop--pop .focus')) { syncNav(a, nx || cur); popReveal(nx || cur); }
        return true;
    }
    function navKeys(e) {
        if (popKeys(e)) return;
        var up = e.keyCode === 38 || e.key === 'ArrowUp', dn = e.keyCode === 40 || e.key === 'ArrowDown';
        if (!up && !dn) {
            navCx = null;
            // у відкритому списку вліво/вправо нікуди не веде
            if (e.keyCode === 37 || e.keyCode === 39 || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                var fo = document.querySelector('.activity--active .lmx-onl-drop--pop .focus');
                if (fo) { e.preventDefault(); e.stopImmediatePropagation(); }
            }
            return;
        }
        if (navStep(up)) { e.preventDefault(); e.stopImmediatePropagation(); }
    }
    // «Назад» під час пошуку джерел: екран у цей час майже порожній, і штатний контролер його ігнорував (доводилось перезаходити).
    // Перехоплюємо клавішу самі: зупиняємо пошук і виходимо з екрана
    function backKeys(e) {
        var k = e.keyCode, back = k === 8 || k === 27 || k === 461 || k === 10009 || k === 166 || k === 4 || e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack' || e.key === 'GoBack';
        if (!back) return;
        var a = document.querySelector('.activity--active');
        if (!a || !a.querySelector('.explorer.lmx-onl') || !a.classList.contains('lmx-onl-load') || selOpen()) return;
        var tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault(); e.stopImmediatePropagation();
        try { var gs = window.__lmxProbe; if (gs) { gs.bg = 'off'; gs.done = true; try { gs.job && gs.job.stop && gs.job.stop(); } catch (x) {} } window.__lmxProbe = null; a.__lmxProbing = false; } catch (x) {}
        entering(false);
        try { Lampa.Activity.backward(); } catch (x) { try { window.history.back(); } catch (y) {} }
    }
    // Жорсткий запобіжник: «завантаження» не може тривати вічно. Якщо екран понад 75 с у режимі пошуку (джерело мовчить, запит завис, прапорець застряг) —
    // зупиняємо наш пошук і віддаємо екран рідному вигляду плагіна, щоб можна було обрати джерело вручну
    // панель «Шукаємо / нічого немає» під панеллю фільтрів: повертаємо наявну або створюємо нову
    function ensureProg(a) {
        var pr = a.querySelector('.lmx-onl-prog');
        if (pr) return pr;
        pr = document.createElement('div'); pr.className = 'lmx-onl-prog'; pr.setAttribute('data-lmx-bg', '1');
        pr.innerHTML = '<div class="lmx-onl-prog__s"></div><div class="lmx-onl-prog__b"><i></i></div>' + PROG_CARDS;
        var bar0 = a.querySelector('.lmx-onl-bar'), hero = a.querySelector('.lmx-onl-hero');
        if (bar0 && bar0.parentNode) bar0.parentNode.insertBefore(pr, bar0.nextSibling);
        else if (hero && hero.parentNode) hero.parentNode.insertBefore(pr, hero.nextSibling);
        else return null;
        return pr;
    }
    // Порожній екран без жодного пояснення (після зміни сезону/озвучки джерело нічого не віддало, а смужка завантаження вже знята): показуємо
    // або «Завантажуємо…» (поки відповідь ще може прийти), або чесне «нічого немає» з кнопками. Кожна перевірка — раз на 3 с, лише на екрані з джерелами
    function blankGuard(a) {
        var ex = a.querySelector('.explorer.lmx-onl'), body = ex && a.querySelector('.explorer__files-body .scroll__body'), pr = a.querySelector('.lmx-onl-prog');
        var bg = a.querySelector('.lmx-onl-prog[data-lmx-bg]');
        var busy = !!(a.__lmxProbing || a.__lmxEG || a.classList.contains('lmx-onl-load') || a.classList.contains('lmx-onl-rl'));
        if (!body || !a.querySelector('.lmx-onl-hero') || a.__lmxOpen || a.__lmxHold || selOpen() || selCtl() || plyOn()) { a.__lmxBlankN = 0; return; }
        if (freshEps(body).length || a.querySelector('.lmx-onl-item')) {
            a.__lmxBlankN = 0;
            if (bg && bg.parentNode) bg.parentNode.removeChild(bg);
            return;
        }
        if (pr && !bg) { a.__lmxBlankN = 0; return; }
        a.__lmxBlankN = (a.__lmxBlankN || 0) + 1;
        if (a.__lmxBlankN < 2) return;
        var msg = /не дав результат|no results|нічого не знайдено|помилка/i.test(body.textContent || '');
        var dead = !busy && (msg || a.__lmxBlankN >= 6);
        if (!bg) {
            bg = document.createElement('div'); bg.className = 'lmx-onl-prog'; bg.setAttribute('data-lmx-bg', '1');
            bg.innerHTML = '<div class="lmx-onl-prog__s"></div><div class="lmx-onl-prog__b"><i></i></div>' + PROG_CARDS;
            var bar0 = a.querySelector('.lmx-onl-bar'), hero = a.querySelector('.lmx-onl-hero');
            if (bar0 && bar0.parentNode) bar0.parentNode.insertBefore(bg, bar0.nextSibling);
            else if (hero && hero.parentNode) hero.parentNode.insertBefore(bg, hero.nextSibling);
            else return;
        }
        var ps = bg.querySelector('.lmx-onl-prog__s');
        if (!dead) { if (ps && !ps.textContent) ps.textContent = busy ? 'Шукаємо…' : 'Завантажуємо…'; return; }
        if (ps) ps.textContent = msg ? 'Для цього сезону чи озвучки тут нічого немає. Оберіть іншу озвучку, сезон або джерело' : 'Джерело довго не відповідає. Оберіть іншу озвучку, сезон або джерело';
        bg.classList.add('lmx-onl-prog--end');
        deadActions(a);
        hideJunk(a);
    }
    function loadWatchdog() {
        window.__lmxLW = loadWatchdog;
        var a = document.querySelector('.activity--active');
        if (!a) return;
        safe(function () { blankGuard(a); });
        // Пошук скінчився, рідний список серій уже на екрані, а наша розмітка його не розпізнала: статус і порожня рамка не мають висіти
        var bd = a.querySelector('.explorer__files-body .scroll__body');
        if (!a.classList.contains('lmx-onl-load') && !a.__lmxProbing && bd && !a.querySelector('.lmx-onl-item') && (a.querySelector('.lmx-onl-prog') || a.querySelector('.lmx-onl-hero__s')) && nativeList(bd)) {
            a.__lmxNatN = (a.__lmxNatN || 0) + 1;
            if (a.__lmxNatN >= 2) { a.__lmxNatN = 0; releaseNative(a); }
        } else a.__lmxNatN = 0;
        if (!a.classList.contains('lmx-onl-load')) { a.__lmxLoadT = 0; return; }
        if (!a.__lmxLoadT) { a.__lmxLoadT = Date.now(); return; }
        // підбір «живий», доки тік оновлює мітку; якщо мітка застаріла (екран перестворено, підбір не продовжився) — не чекаємо 75 с, а за ~10 с віддаємо екран
        var g0 = window.__lmxProbe, stalled = !!(g0 && !g0.done && Date.now() - (g0.tickT || g0.t00 || 0) > 6000);
        if (Date.now() - a.__lmxLoadT < (stalled ? 9000 : 75000)) return;
        a.__lmxLoadT = 0;
        try { var g = window.__lmxProbe; if (g) { g.bg = 'off'; g.done = true; try { g.job && g.job.stop && g.job.stop(); } catch (x) {} } } catch (x) {}
        releaseNative(a);
        try { buildHero(); } catch (x) {}
    }
    function downRescue() {
        if (window.__lmxDown) return;
        window.__lmxDown = 1;
        document.addEventListener('keydown', navKeys, true);
        document.addEventListener('keydown', backKeys, true);
        // після вибору пункту списку «ОК» не повинен спрацювати ще раз на тому, куди повернувся фокус (інакше на озвучці стартувало відео)
        function eatOk(e) {
            if (Date.now() - (window.__lmxPopSel || 0) > 700) return;
            if (e.type !== 'click' && !(e.keyCode === 13 || e.key === 'Enter')) return;
            e.preventDefault(); e.stopImmediatePropagation();
        }
        ['keydown', 'keyup', 'keypress', 'click'].forEach(function (t) { document.addEventListener(t, eatOk, true); });
        // страховка: якщо щось (перемальовування, службові таймери) забрало фокус зі списку — повертаємо
        setInterval(function () {
            if (document.hidden || plyOn()) return;
            safe(function () {
                var pop = document.querySelector('.activity--active .lmx-onl-drop--pop'), a = pop && document.querySelector('.activity--active');
                if (!pop || selOpen()) return;
                var f = document.querySelector('.focus');
                if (f && pop.contains(f)) return;
                var it = popItem(pop); if (it) { syncNav(a, it); popReveal(it); }
            });
        }, 250);
    }
    function upRescue() { window.__lmxUp = 1; }
    // Запобіжник: після будь-якого перемальовування серії можуть опинитись за межами екрана або фокус — на зниклому елементі
    function viewGuard() {
        if (window.__lmxVG) return;
        window.__lmxVG = 1;
        var bad = 0;
        setInterval(function () {
            if (document.hidden || plyOn()) return;
            safe(function () {
                var act = document.querySelector('.activity--active');
                if (!act || !act.querySelector('.explorer.lmx-onl') || act.__lmxProbing || act.__lmxOpen || act.__lmxHold || document.getElementById('lmx-scan') || selOpen()) { bad = 0; return; }
                if ((window.__lmxKeyT || 0) > Date.now() - 900 || (window.__lmxTouchT || 0) > Date.now() - 60000) { bad = 0; return; }
                var tg = act.querySelector('.lmx-onl-btn.selector') || act.querySelector('.lmx-onl-item');
                if (!tg) { bad = 0; return; }
                var cn = Lampa.Controller.enabled(), nm = cn && cn.name;
                if (listOff(act)) {
                    resetScroll(act);
                    ctlContent();
                    var it0 = act.querySelector('.lmx-onl-item') || tg;
                    if (window.Navigator && Navigator.focus) Navigator.focus(it0);
                    return;
                }
                if (nm && nm !== 'content') { bad = 0; return; }
                if (okFocus(act)) { bad = 0; return; }
                if (++bad < 2) return;
                bad = 0;
                hideJunk(act);
                ctlContent();
                var sc = act.querySelector('.explorer__files-body .scroll'), fl = act.querySelector('.explorer__files');
                try { Lampa.Controller.collectionSet($(sc || fl), sc && fl ? $(fl) : false); } catch (e) {}
                if (window.Navigator && Navigator.focus) Navigator.focus(tg);
            });
        }, 700);
    }
    function noty(t) { try { if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(t); } catch (e) {} }
    // Серії у списку джерела: прямі нащадки з .selector і картинкою/смужкою прогресу (назви класів у джерел різні)
    function episodeEls(body) {
        var kids = body.children, out = [], i, el;
        for (i = 0; i < kids.length; i++) {
            el = kids[i];
            if (!el.classList || !(el.classList.contains('selector') || el.classList.contains('lmx-onl-off')) || el.classList.contains('lmx-onl-btn') || el.classList.contains('videos__button') || el.classList.contains('simple-button') || el.classList.contains('videos__season') || /folder/.test(el.className)) continue;
            if (hasEp(el)) out.push(el);
        }
        if (!out.length) out = nestedEps(body);
        if (!out.length) out = genericEps(body);
        return dedupeEps(famFilter(out));
    }
    // Запасне розпізнавання для невідомої розмітки (інший плагін/тема): картка — найзовнішній фокусований елемент зі списку, що не є кнопкою, службовим рядком порожнього стану
    // чи нашим елементом, і має картинку, смужку прогресу або достатньо тексту
    function genericEps(body) {
        var all = body.querySelectorAll('.selector'), out = [], i, el;
        for (i = 0; i < all.length; i++) {
            el = all[i];
            if (el.closest('[class*="empty"], .lmx-onl-hero, .lmx-onl-bar, .lmx-onl-drop, .lmx-onl-prog') || /empty|simple-button|videos__button|videos__season|folder|lmx-onl-btn/.test(el.className)) continue;
            if (out.length && out[out.length - 1].contains(el)) continue;
            if (el.querySelector('img, .time-line, [style*="background-image"]') || (el.textContent || '').replace(/\s+/g, '').length > 6) out.push(el);
        }
        return out.length >= 1 && (out.length >= 2 || out[0].querySelector('img, .time-line, [style*="background-image"]')) ? out : [];
    }
    // Деякі онлайн-плагіни кладуть картки не прямо в список, а в проміжну обгортку — шукаємо серії глибше (лише найзовнішні, без службових кнопок)
    function nestedEps(body) {
        var all = body.querySelectorAll('.selector'), out = [], i, el;
        for (i = 0; i < all.length; i++) {
            el = all[i];
            if (el.closest('.lmx-onl-hero, .lmx-onl-bar, .lmx-onl-drop, .lmx-onl-prog') || el.classList.contains('lmx-onl-btn') || el.classList.contains('videos__button') || el.classList.contains('simple-button') || el.classList.contains('videos__season') || /folder/.test(el.className)) continue;
            if (!hasEp(el)) continue;
            if (out.length && out[out.length - 1].contains(el)) continue;
            out.push(el);
        }
        return out;
    }

    // Підбір джерела: стан живе в window.__lmxProbe, бо після зміни джерела плагін може перестворити екран — тоді підбір просто
    // продовжується на новому екрані. Спершу відкриваємо те, що спрацювало раніше / має найкращу якість у назві, порожнє міняємо на наступне,
    // нічого не знайшли — «Жодне джерело…». Усе — прямими викликами фільтра, без натискань на меню
    // Скільки днів пам'ятати «найкраще джерело» для тайтла: фільм і завершений серіал — 30, серіал, що виходить, — 4 (нова серія може з'явитись на іншому джерелі)
    function memDays(card) {
        try { var tv = card && (card.name || card.number_of_seasons || (card.first_air_date && !card.release_date)); return tv && !/^(ended|canceled|cancelled)$/i.test(String(card.status || '')) ? 4 : 30; } catch (e) { return 30; }
    }
    function watchSources(act, card) {
        if (act.__lmxWatch) return;
        act.__lmxWatch = 1;
        var cid = String(card && card.id || ''), mem = memGet(), t = Date.now();
        var wantHi = qTarget() >= 4, allSrc = probeOn(), maxTry = longSeries(card) ? 3 : allSrc ? 40 : (wantHi ? 10 : 5), budget = allSrc ? 30000 : (wantHi ? 25000 : 20000);
        var gs = window.__lmxProbe;
        if (!gs || gs.cid !== cid || t - gs.t00 > 150000 || (lastEnter.on && lastEnter.t > gs.t00 + 800 && gs.done)) gs = window.__lmxProbe = { cid: cid, t00: t, tried: [], results: [], tq: {}, switches: 0, started: false, cur: '', since: t, done: false };
        if (gs.done) { hideScanLater(); return; }
        act.__lmxProbing = true;
        safe(function () { showScan(card); });
        var t0 = Date.now(), lastSig = '', stableAt = 0, EV = ['keydown', 'mousedown', 'touchstart'];
        function keyOf(it) { return srcName(it && it.title); }
        function scOf(it) { var k = keyOf(it); return srcScore(k, { q: titleQ(it.title), pe: null }, mem).s; }
        // порядок обходу — за єдиним рейтингом (якість + українська озвучка за назвою джерела + досвід), а не лише за якістю в назві
        function cmp(a, b) { return (scOf(b) - scOf(a)) || (gscore(mem.g[keyOf(b)]) - gscore(mem.g[keyOf(a)])); }
        function stop() { clearInterval(iv); EV.forEach(function (ev) { document.removeEventListener(ev, userStop, true); }); if (gs.done) hideScanLater(); }
        function finish(msg) {
            gs.done = true; act.__lmxProbing = false; stop(); hideScanLater();
            if (msg) heroStatus(act, msg, true); else safe(buildHero);
        }
        function userStop() { finish(); }
        EV.forEach(function (ev) { document.addEventListener(ev, userStop, true); });
        function save(name, rank) {
            var g = mem.g[name] || (mem.g[name] = { ok: 0, fail: 0, q: 0 });
            if (rank < 0) { g.fail = Math.min(20, (g.fail || 0) + 1); g.ft = Date.now(); }
            else { g.ok = Math.min(50, (g.ok || 0) + 1); g.q = Math.max(0, Math.round(((g.q || 0) * 2 + rank) / 3)); }
            memSet(mem);
        }
        function switchTo(inst, it, text) {
            gs.switches++; gs.cur = keyOf(it); gs.since = Date.now(); lastSig = '';
            if (gs.tried.indexOf(gs.cur) < 0) gs.tried.push(gs.cur);
            heroStatus(act, text + ' (' + gs.tried.length + ' з ' + (gs.total || '?') + '): ' + it.title + '…', false, Math.min(0.95, gs.tried.length / (gs.total || maxTry)));
            try { selIn(inst, 'sort', it); } catch (e) { finish('Помилка підбору: ' + (e && e.message)); }
        }
        function conclude(inst, sort) {
            if (!gs.results.length) return finish('Жодне джерело не знайшло цей матеріал');
            gs.results.sort(function (a, b) { return (srcScore(b.name, { q: b.rank, pe: null }, mem).s - srcScore(a.name, { q: a.rank, pe: null }, mem).s) || (b.rank - a.rank) || (b.n - a.n); });
            var best = gs.results[0], i;
            if (cid) { mem.t[cid] = { s: best.name, q: best.rank, at: Date.now(), v: 2 }; memSet(mem); }
            if (best.name !== gs.cur) {
                for (i = 0; i < sort.length; i++) if (keyOf(sort[i]) === best.name) { switchTo(inst, sort[i], 'Найкраще джерело'); return finish(); }
            }
            finish();
        }
        // «Достатньо» зупинятись лише якщо поточне джерело українське (за назвою) або українських джерел, яких ще не пробували, не лишилось; в режимі «Якість» цього не вимагаємо
        function uaEnough(sort) {
            if (balMode() === 'quality' || !uaOn()) return true;
            if (uaBonus(gs.cur, null) > 0) return true;
            return !sort.some(function (x) { return x && !x.selected && !x.ghost && keyOf(x) && gs.tried.indexOf(keyOf(x)) < 0 && uaBonus(keyOf(x), null) > 0; });
        }
        function next(inst, sort) {
            var c = sort.filter(function (x) { return x && !x.selected && !x.ghost && keyOf(x) && gs.tried.indexOf(keyOf(x)) < 0; }).sort(cmp);
            if (!c.length || gs.tried.length >= maxTry || Date.now() - gs.t00 > budget - 5000) return conclude(inst, sort);
            switchTo(inst, c[0], 'Перевіряємо джерело');
        }
        function tick() {
            gs.tickT = Date.now();   // метка «підбір живий»: за нею запобіжник відрізняє повільне джерело від зависшого підбору
            if (!document.body.contains(act)) {
                // екран перестворено (плагін при зміні джерела робить Activity.replace) — передаємо підбір новому екрану, інакше лічильник і шкала зависають
                stop();
                setTimeout(function () { safe(function () { var na = document.querySelector('.activity--active'), a2 = Lampa.Activity.active(), c2 = a2 && (a2.movie || a2.card); if (na && na !== act && !gs.done && c2 && na.querySelector('.explorer') && !na.__lmxWatch) watchSources(na, c2); }); }, 400);
                return;
            }
            if (!gs.done && Date.now() - (gs.hsT || 0) > 500) { gs.hsT = Date.now(); try { heroStatus(act, '', false, scanFrac()); } catch (e) {} }   // лічильник і шкала рухаються завжди, а не лише при відповіді джерела   // екран перестворено — підбір продовжить новий екран
            if (!isOn() || !autoOn() || Date.now() - gs.t00 > budget) return finish();
            // Деякі джерела при відкритті показують вікно (прив'язка акаунта, вибір, запит): воно блокує перебір — закриваємо і йдемо до наступного
            try {
                if (gs.cur && document.querySelector('.modal, .selectbox') && Date.now() - gs.since > 400) {
                    try { Lampa.Modal.close(); } catch (e) {} try { Lampa.Select.close(); } catch (e) {}
                    save(gs.cur, -1);
                    var i1 = instFor(act), S1 = i1 && readSets(i1); if (S1) return next(i1, S1.sort);
                }
            } catch (e) {}
            var inst = instFor(act), S = inst && readSets(inst), sort = S ? S.sort : [], body = act.querySelector('.explorer__files-body .scroll__body');
            if (!inst || !sort.length || !body) { if (Date.now() - t0 > 8000) finish(); return; }
            var i, curIt = null;
            for (i = 0; i < sort.length; i++) if (sort[i] && sort[i].selected) { curIt = sort[i]; break; }
            var curKey = curIt ? keyOf(curIt) : '';
            sort.forEach(function (x) { gs.tq[keyOf(x)] = titleQ(x.title); noteHints(x); });
            if (gs.bg !== 'run') gs.total = sort.filter(function (x) { return x && !x.ghost; }).length;   // під час фонової перевірки лічильник показує, скільки джерел справді перевіряємо
            // Сам онлайн-плагін позначає джерела прапорцем ghost (нема результатів / не відповідає) — як і Nova, довіряємо цьому і не перевіряємо вдруге:
            // беремо живі джерела, сортуємо за якістю в назві і відкриваємо найкраще (торентні нарівні з рештою, як у Nova)
            var prof = profileOf(gs), bwa = prof.simple;
            if (bwa) gs.bwa = true;   // раз розпізнали — вважаємо BWA до кінця підбору (ознаки не мають «мигати»)
            var life = !bwa && sort.some(function (x) { return x && typeof x.ghost !== 'undefined'; });
            if (bwa && !gs.bg) gs.bg = 'off';
            if (life && allSrc && !gs.bg && !gs.lifeOff) {
                var live = sort.map(function (x, ix) { return x && !x.ghost && keyOf(x) ? { it: x, ix: ix, tor: isTorSrc(x), q: titleQ(x.title), g: gscore(mem.g[keyOf(x)]) } : null; }).filter(Boolean);
                // рейтинг із реальними даними (якість і озвучки з відповідей джерел), якщо вони вже є; інакше — за назвою
                function rankLive() {
                    live.forEach(function (r) { var k = keyOf(r.it), pe = pcEntry(cid, k), sc = srcScore(k, { q: r.q, pe: pe && pe.s === 'ok' ? pe : null }, mem); r.sc = sc.s; r.why = sc.why; r.rq = (pe && pe.s === 'ok' && pe.q) || r.q; });
                    live.sort(function (a, b) { return (b.sc - a.sc) || msCmp(mem.g[keyOf(b.it)], mem.g[keyOf(a.it)]) || (b.g - a.g) || (a.ix - b.ix); });
                }
                rankLive();
                // 3: джерело, яке ви вручну обирали для цього тайтла, відкриваємо першим (30 днів)
                var mp = mem.m && mem.m[cid], mpIt = null;
                if (mp && Date.now() - (mp.at || 0) < 30 * 86400000) live.forEach(function (r) { if (!mpIt && keyOf(r.it) === mp.s) mpIt = r; });
                if (mpIt) { live.splice(live.indexOf(mpIt), 1); live.unshift(mpIt); mpIt.q = Math.max(mpIt.q, qTarget()); mpIt.rq = Math.max(mpIt.rq || 0, qTarget()); }
                var top = live[0], waitedL = Date.now() - t0;
                if (top && (top.rq >= qTarget() || waitedL > 5000)) {
                    // Не зупиняємось на першому «достатньому»: коротко (до ~3,5 с) питаємо кількох найкращих кандидатів, чи є в них українська озвучка саме для цього тайтла
                    var pu2 = window.__lmxProbeUrl;
                    if (!gs.refine && !mpIt && live.length > 1 && pu2 && pu2.cid === cid && probeOn() && !longSeries(card)) {
                        var rc = live.slice(0, 6).filter(function (r) { var pe0 = pcEntry(cid, keyOf(r.it)); return !(pe0 && pe0.s === 'ok' && typeof pe0.v !== 'undefined'); });
                        gs.refine = { t: Date.now(), done: !rc.length };
                        if (rc.length) {
                            // як тільки хтось із кандидатів уже явно переміг (українська озвучка + потрібна якість, або 4K у режимі «Якість»), решту не чекаємо
                            var rjob = { cid: cid, url: pu2.u, headers: pu2.h || null, par: longSeries(card) ? 2 : 6, timeout: 2500, onEach: function (it, r) {
                                if (r && r.s === 'ok' && !gs.refine.done) {
                                    var rq0 = r.q || it.q || 0;
                                    if (balMode() === 'quality' ? rq0 >= 4 : (r.uv > 0 && rq0 >= qTarget())) { gs.refine.done = true; try { rjob.stop(); } catch (e) {} }
                                }
                            }, onEnd: function () { gs.refine.done = true; },
                                items: rc.map(function (r) { return { key: keyOf(r.it), source: r.it.source || keyOf(r.it).replace(/\s+/g, ''), q: r.q, tor: r.tor, to: r.tor ? 3500 : 0 }; }) };
                            bgProbe(rjob);
                        }
                    }
                    if (gs.refine && !gs.refine.done && Date.now() - gs.refine.t < 2800) { heroStatus(act, 'Перевіряємо озвучки…', false, 0.5); return; }
                    if (gs.refine && !gs.refine.rk) { gs.refine.rk = 1; rankLive(); if (mpIt) { live.splice(live.indexOf(mpIt), 1); live.unshift(mpIt); } top = live[0]; }
                    live.forEach(function (r) { gs.results.push({ name: keyOf(r.it), rank: r.rq || r.q, n: 0 }); });
                    learnNote(sort, cid);
                    if (cid) { mem.t[cid] = { s: keyOf(top.it), q: top.rq || top.q, at: Date.now(), v: 2, oks: live.map(function (r) { return keyOf(r.it); }) }; memSet(mem); }
                    if (!top.it.selected) switchTo(inst, top.it, 'Відкриваємо найкраще джерело');
                    return finish();
                }
                if (top || waitedL < 9000) { heroStatus(act, '', false, 0.1); return; }
                gs.lifeOff = true;
            }
            if (allSrc && !gs.bg && !life && Date.now() - t0 < 1200) return;
            if (allSrc && !gs.bg) {
                var pu = window.__lmxProbeUrl;
                if (pu && pu.cid === cid && sort.length > 1) {
                    gs.bg = 'run'; gs.bgDone = 0; gs.bgT = Date.now();
                    var items = [], cached = 0;
                    sort.forEach(function (x) {
                        if (!x || x.ghost || !x.source || !keyOf(x)) return;
                        if (pcEntry(cid, keyOf(x)) && pcEntry(cid, keyOf(x)).s !== 'skip') { cached++; return; }
                        // карантин: джерело, що кілька разів поспіль підводило за останню добу, не перевіряємо (воно лишається в списку)
                        var gq = mem.g[keyOf(x)];
                        if (gq && gq.fail >= 3 && gq.fail > (gq.ok || 0) * 2 && Date.now() - (gq.ft || 0) < 86400000) return;
                        var isTor = /jac|torrent|jackett|torr|magnet/i.test(String(x.title) + ' ' + String(x.source));
                        // очікування за досвідом: швидке джерело — 3 с, повільне, але робоче — до 8 с (пропорційно його звичному часу відповіді); невідоме — стандартні 4,5 с
                        var gms = gq && gq.ms || 0;
                        items.push({ key: keyOf(x), source: x.source || keyOf(x).replace(/\s+/g, ''), q: titleQ(x.title), tor: isTor, to: isTor ? 5000 : gms ? Math.max(3000, Math.min(8000, Math.round(gms * 2.2))) : 0 });
                    });
                    // спершу ймовірно найкращі: висока якість у назві й джерела, що раніше спрацьовували; стабільно порожні — в кінець черги
                    function pri(x) { var g = mem.g[x.key]; return (g && g.fail >= 2 && !g.ok ? -100 : 0) + x.q * 3 + uaBonus(x.key, null) * 3 + animeBonus(x.key) * 3 + Math.max(-3, Math.min(6, gscore(g) / 4)); }
                    items.sort(function (a, b) { return pri(b) - pri(a); });
                    if (longSeries(card)) items = items.slice(0, 5);   // довгий серіал: відповіді джерел важкі — питаємо лише кількох найімовірніших
                    gs.total = items.length + cached; gs.bgDone = cached;
                    gs.job = { cid: cid, url: pu.u, headers: pu.h || null, items: items.slice(0, longSeries(card) ? 5 : 40), par: longSeries(card) ? 2 : 6, timeout: 4500, onEach: function (it, r) {
                        gs.bgDone++; updScan();
                        // знайшли джерело потрібної якості — відкриваємо одразу, решту дoперевіряємо у фоні для меню
                        if (r && r.s === 'ok' && !gs.early && gs.bg === 'run' && Math.max(r.q || 0, it.q || 0) >= qTarget()) { gs.early = true; gs.bg = 'done'; }
                    }, onEnd: function () { gs.bg = 'done'; } };
                    gs.bgDeadline = Date.now() + (longSeries(card) ? 9000 : 14000);
                    bgProbe(gs.job);
                } else if (Date.now() - t0 > 3500) gs.bg = 'off';
                else return;
            }
            if (gs.bg === 'run' && Date.now() - gs.bgT > 4000) {
                // довго чекаємо повільні джерела — вже щось знайшли, тож відкриваємо найкраще з наявного, решта догрузиться у фоні
                var anyOk = false;
                sort.forEach(function (x) { var pe = x && keyOf(x) && pcEntry(cid, keyOf(x)); if (pe && pe.s === 'ok') anyOk = true; });
                if (anyOk) gs.bg = 'done';
            }
            if (gs.bg === 'run') { if (Date.now() > gs.bgDeadline) { try { gs.job.stop(); } catch (e) {} gs.bg = 'done'; } return; }
            if (gs.bg === 'done') {
                gs.bg = 'fin';
                var okL = [], skipN = 0;
                sort.forEach(function (x) {
                    if (!x || x.ghost || !keyOf(x)) return;
                    var pe = pcEntry(cid, keyOf(x));
                    if (pe && pe.s === 'ok') okL.push({ it: x, name: keyOf(x), rank: pe.q || titleQ(x.title), n: pe.c || 0, sc: srcScore(keyOf(x), { q: titleQ(x.title), pe: pe }, mem).s });
                    else if (!pe || pe.s === 'skip') skipN++;
                });
                if (!okL.length) {
                    // жодна перевірка нічого не підтвердила, але деякі джерела не відповіли — довіряти цьому не можна: переходимо на надійний обхід через сам екран
                    if (skipN) { gs.bg = 'off'; gs.slow = true; return; }   // жодне джерело не встигло відповісти — вони повільні (довгі серіали), тож і далі чекаємо довше
                    return finish('Жодне джерело не знайшло цей матеріал');
                }
                okL.sort(function (a, b) { return (b.sc - a.sc) || msCmp(mem.g[b.name], mem.g[a.name]) || (gscore(mem.g[b.name]) - gscore(mem.g[a.name])) || (b.n - a.n); });
                okL.forEach(function (r) { gs.results.push({ name: r.name, rank: r.rank, n: r.n }); });
                var bestO = okL[0];
                if (cid) { mem.t[cid] = { s: bestO.name, q: bestO.rank, at: Date.now(), v: 2, oks: okL.map(function (r) { return r.name; }) }; memSet(mem); }
                var curK = '';
                sort.forEach(function (x) { if (x && x.selected) curK = keyOf(x); });
                if (bestO.name !== curK) { switchTo(inst, bestO.it, 'Відкриваємо найкраще джерело'); }
                return finish();
            }
            if (gs.bg === 'fin') return;
            if (!gs.started) {
                gs.started = true; gs.cur = curKey; gs.since = Date.now();
                if (curKey) gs.tried.push(curKey);
                var target = null, c = sort.filter(function (x) { return x && !x.selected && !x.ghost && keyOf(x); }).sort(cmp), curQ = titleQ(curIt && curIt.title);
                if (bwa) {
                    var uak = prof.first && sort.filter(function (x) { return x && !x.selected && !x.ghost && prof.first.test(keyOf(x)); })[0];
                    if (uak && !prof.first.test(curKey)) target = uak;
                }
                else if (qPref() !== 'auto' && probeOn()) { if (c[0] && titleQ(c[0].title) > curQ) target = c[0]; }
                else {
                    // плагін відкрив своє перше джерело (часто не найкраще): якщо за рейтингом є явно краще — одразу відкриваємо його, не ходимо по гірших
                    if (c[0] && curIt && scOf(c[0]) > scOf(curIt) + 0.5) target = c[0];
                    var pt = mem.t[cid], pref = pt && pt.v === 2 && Date.now() - (pt.at || 0) < memDays(card) * 86400000 ? pt.s : '';
                    if (pref && pref !== curKey) for (i = 0; i < c.length; i++) if (keyOf(c[i]) === pref) { target = c[i]; break; }
                }
                if (target) return switchTo(inst, target, 'Відкриваємо джерело');
            }
            if (gs.cur && curKey && curKey !== gs.cur) { if (Date.now() - gs.since > 10000) finish(); return; }   // перемикання ще триває
            var waited = Date.now() - gs.since; items = episodeEls(body);
            if (items.length) {
                var sig = items.length + ':' + qual(items);
                if (sig !== lastSig) { lastSig = sig; stableAt = Date.now(); return; }
                if (Date.now() - stableAt < 350) return;
                var rank = Math.max(qrank(qual(items)), gs.tq[gs.cur] || 0);
                gs.results.push({ name: gs.cur, rank: rank, n: items.length });
                save(gs.cur, rank);
                heroStatus(act, 'Знайдено: ' + items.length + ' серій' + (qual(items) ? ', ' + qual(items) : '') + '…', false, Math.min(0.95, gs.tried.length / (gs.total || maxTry)));
                // Послідовний обхід не має сенсу доводити до кінця: джерела йдуть від найкращих, тож щойно знайшлось підходяще за якістю (або вже минуло 15 с і щось є) — відкриваємо
                if (bwa || !probeOn() || gs.results.length >= maxTry || (rank >= (balMode() === 'quality' ? 4 : qTarget()) && uaEnough(sort)) || Date.now() - t0 > 15000) return conclude(inst, sort);
                return next(inst, sort);
            }
            heroStatus(act, 'Чекаємо відповіді джерела' + (gs.cur ? ': ' + gs.cur : '') + '… ' + Math.round(waited / 1000) + ' с', false, 0.12 + Math.min(0.6, waited / 20000));
            if (/не дав результат|не дал результат|нет результат|no results/i.test(body.textContent || '') && waited > 250) {
                // власний таймер плагіна «переключиться через 10 секунд» не чекаємо — скасовуємо його й переходимо самі
                try { $(body).find('[class*="empty__button"].cancel').each(function () { if (!/заказ|замов|order|запит|озвуч|request/i.test(this.textContent || '')) $(this).trigger('hover:enter'); }); } catch (e) {}
                save(gs.cur, -1); return next(inst, sort);
            }
            if (PAYWALL.test(body.textContent || '') && waited > 250) { save(gs.cur, -1); return next(inst, sort); }
            if (waited > (gs.slow ? Math.max(prof.seqWait, 9000) : prof.seqWait)) { save(gs.cur, -1); next(inst, sort); }
        }
        var iv = setInterval(function () {
            try { tick(); } catch (e) { try { console.error('LMX Watch', e); } catch (x) {} finish('Помилка підбору: ' + (e && e.message)); }
        }, 150);
    }

    // Страж порожнього результату: після ручного вибору (або будь-коли, коли серій немає) джерело може відповісти «не дав результатів» або
    // зависнути. Показуємо, що нічого не знайдено, і за кілька секунд самі переходимо на найкраще з ще не пробованих джерел
    // Є рідний список серій навіть якщо його розмітка нам незнайома: щонайменше дві «не службові» картки, що вміщають текст і не є кнопками порожнього стану
    function nativeList(body) {
        var all = body.querySelectorAll('.selector'), n = 0, rich = 0, i, el;
        for (i = 0; i < all.length; i++) {
            el = all[i];
            // порожній стан джерела (картинка «нічого не знайдено», кнопки «Змінити джерело») карткою не вважаємо — інакше зникає екран і зупиняється автоперемикання
            if (el.closest('[class*="empty"], .lmx-onl-hero, .lmx-onl-bar, .lmx-onl-drop, .lmx-onl-prog') || /empty|simple-button|videos__button|season|folder|lmx-onl-btn/.test(el.className)) continue;
            if ((el.textContent || '').replace(/\s+/g, '').length > 6) n++;
            if (el.querySelector('img, .time-line, [style*="background-image"]')) rich++;
        }
        return rich >= 1 || n >= 2;
    }
    // Віддати екран рідному вигляду плагіна: прибрати наші смужки, статус і режим завантаження (запасний шлях, коли розмітка джерела нам незнайома)
    function releaseNative(act) {
        try {
            act.__lmxProbing = false; act.__lmxEG = 0;
            var g = window.__lmxProbe; if (g) { g.done = true; try { g.job && g.job.stop && g.job.stop(); } catch (e) {} }
            [].forEach.call(act.querySelectorAll('.lmx-onl-prog, .lmx-onl-hero__s'), function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
            act.classList.remove('lmx-onl-load', 'lmx-onl-rl', 'lmx-onl-barred');
            document.body.classList.remove('lmx-onl-entering', 'lmx-onl-barred');
            var h = act.querySelector('.lmx-onl-hero'); if (h) h.classList.remove('lmx-onl-hero--load');
            relayout();
        } catch (e) {}
    }
    function emptyGuard(act) {
        if (act.__lmxEG) return;
        act.__lmxEG = 1;
        var card = null; try { var a0 = Lampa.Activity.active(); card = a0 && (a0.movie || a0.card); } catch (e) {}
        var cid = String(card && card.id || ''), bad = window.__lmxBad;
        if (!bad || bad.cid !== cid) bad = window.__lmxBad = { cid: cid, names: [] };
        act.classList.add('lmx-onl-eg');
        var natT = 0, since = Date.now(), lastKey = null, cd = 0, cand = null, t0 = Date.now(), EV = ['keydown', 'mousedown', 'touchstart'], iv = 0;
        function stop() { clearInterval(iv); act.__lmxEG = 0; act.classList.remove('lmx-onl-eg'); EV.forEach(function (ev) { document.removeEventListener(ev, cancel, true); }); }
        function cancel() {
            if (Date.now() - t0 < 600) return;
            if (cd) { heroStatus(act, 'Автоперемикання скасовано. Оберіть джерело кнопкою «Джерело»', true); }
            else safe(function () {
                var b = act.querySelector('.explorer__files-body .scroll__body');
                if (b && !freshEps(b).length && !act.__lmxProbing) heroStatus(act, 'Це джерело ще нічого не дало. Оберіть інше кнопкою «Джерело»', true);
            });
            stop();
        }
        EV.forEach(function (ev) { document.addEventListener(ev, cancel, true); });
        iv = setInterval(function () {
            safe(function () {
                if (!document.body.contains(act) || Date.now() - t0 > 180000) return stop();
                var body = act.querySelector('.explorer__files-body .scroll__body');
                if (!body) return;
                // стара відповідь попереднього джерела ще в списку (data-lmx-old) — це не результат: інакше сторож вимикався одразу й порожнє джерело лишалось без допомоги
                if (freshEps(body).length) {
                    // серії з'явились: якщо це джерело раніше позначили «порожнім» — знімаємо позначку
                    try {
                        var i0 = instFor(act), S0 = i0 && readSets(i0), sel0 = S0 && S0.sort.filter(function (x) { return x && x.selected; })[0], k0 = sel0 ? srcName(sel0.title) : '', p0 = bad.names.indexOf(k0);
                        if (k0 && p0 >= 0) bad.names.splice(p0, 1);
                    } catch (e) {}
                    return stop();
                }
                // Рідний список серій уже на екрані, а наш розбір його не розпізнав (інша розмітка плагіна) — не висимо «Перевіряємо джерела…», а віддаємо екран рідному вигляду
                if (nativeList(body)) {
                    if (!natT) natT = Date.now();
                    else if (Date.now() - natT > 3500) { releaseNative(act); return stop(); }
                } else natT = 0;
                if (act.__lmxProbing || !isOn() || (act.__lmxVGt && Date.now() - act.__lmxVGt < 5500)) { since = Date.now(); return; }
                var inst = instFor(act), S = inst && readSets(inst), sort = S ? S.sort : [], i, curIt = null;
                if (!inst || !sort.length) return;
                for (i = 0; i < sort.length; i++) if (sort[i] && sort[i].selected) { curIt = sort[i]; break; }
                var curKey = curIt ? srcName(curIt.title) : '';
                try { ['voice', 'season'].forEach(function (gk) { var pq = act.querySelector('.lmx-onl-g--' + gk + ' .lmx-onl-pill__t'), gi = S[gk] && selItem(S[gk]); if (pq && gi && gi.title && pq.textContent !== (gk === 'season' ? seTitle(gi.title) : String(gi.title).trim())) pq.textContent = gk === 'season' ? seTitle(gi.title) : String(gi.title).trim(); }); } catch (e) {}   // підписи кнопок не повинні відставати від реального вибору, поки серій ще нема
                try { var pl = act.querySelector('.lmx-onl-g--src .lmx-onl-pill__t'); if (pl && curIt && curIt.title && pl.textContent !== String(curIt.title).trim()) pl.textContent = String(curIt.title).trim(); } catch (e) {}
                if (curKey !== lastKey) { lastKey = curKey; since = Date.now(); cd = 0; cand = null; act.__lmxNg = 0; }
                var waited = Date.now() - since, txt = body.textContent || '';
                var manual = Date.now() - (window.__lmxManual || 0) < 120000;
                var empty = (/не дав результат|не дал результат|no results|нічого не знайд|ничего не найд|помилка|ошибка|нет \d+ сезон|нет сезон|нет серий|нет результат|не найден|попробуйте другой источник|спробуйте інше джерело|немає \d+ сезон|только со своим аккаунт|привяжите аккаунт|скройте источник|потрібен (?:свій )?акаунт/i.test(txt) && waited > 700) || waited > (profileOf(window.__lmxProbe).egWait || (manual ? 12000 : 6000));   // BWA відповідає повільно: чекаємо довше, щоб не перемикати джерело, яке ще вантажиться
                // Джерело порожнє лише для поточної озвучки, а має інші (напр. Mikai без «Дублированный», але з FRONDA): спершу пробуємо їх, і лише потім
                // оголошуємо джерело порожнім. Повільна відповідь ≠ порожня: зміна озвучки перезапускає запит, тож за 4,5 с вона обривала довгий пошук (UAKino, JackTor) і не давала йому завершитись — тепер чекаємо 20 с
                function tryVoice() {
                    if (!(vautoOn() && S.voice && S.voice.items && S.voice.items.length > 1)) return false;
                    var vg = S.voice, vs0 = S.season && selItem(S.season), vtk = cid + '|' + curKey + '|' + (vs0 ? seTitle(vs0.title) : '');
                    var vt = act.__lmxVTry = act.__lmxVTry || {}, tr = vt[vtk] = vt[vtk] || { n: 0, done: {} }, vcur = selItem(vg);
                    if (vcur && vcur.title) tr.done[vnorm(vcur.title)] = 1;
                    var left0 = vg.items.filter(function (x) { return x && x.title && !tr.done[vnorm(x.title)]; });
                    var vc = tr.n < (manual ? 5 : 3) ? pickVoice(cid, left0) : null;
                    // ручне перемикання джерела: української озвучки в нього немає — відкриваємо будь-яку (крім субтитрів), аби не було порожнього екрана
                    if (!vc && manual && tr.n < 5) vc = left0.filter(function (x) { return !isSubOnly(x.title) && !/оригінал|original/i.test(x.title); })[0] || null;
                    if (!vc) return false;
                    tr.n++; tr.done[vnorm(vc.title)] = 1; act.__lmxVGt = Date.now(); since = Date.now();
                    heroStatus(act, 'Шукаємо озвучку «' + String(vc.title).trim() + '» на «' + curKey + '»…', false, 0.3);
                    if (manual && !act.__lmxHold) holdFocus(act, 'src', 9000);   // фокус лишається на пілюлі джерела, поки Lampa перемальовує список
                    try { var vpl = act.querySelector('.lmx-onl-g--voice .lmx-onl-pill__t'); if (vpl) vpl.textContent = String(vc.title).trim(); } catch (e) {}
                    selIn(inst, 'filter', { stype: vg.stype }, { index: idxOf(vg, vc) });
                    // автоматична зміна озвучки теж перезавантажує список — показуємо заглушку, інакше під панеллю 2–5 с порожньо
                    act.__lmxRlKey = ''; act.__lmxRlMin = Date.now() + 450; act.__lmxKeep = [];
                    safe(function () { afterReload(act); });
                    return true;
                }
                if (!cd && (empty || (manual && waited > 20000)) && tryVoice()) return;
                // Після перемикання ДЖЕРЕЛА запит інколи «губиться» (список не приходить ні з відповіддю «порожньо», ні з помилкою), хоча той самий запит
                // через вибір сезону/озвучки спрацьовує одразу. Тому, якщо за 8 с нічого немає, робимо саме цю дію: повторно обираємо поточний сезон (або озвучку),
                // а коли це неможливо — повторюємо запит джерела. Не більше двох спроб на джерело (на 8 с і на 20 с)
                if (!empty && !cd && (act.__lmxNg || 0) < 2 && waited > ((act.__lmxNg || 0) ? 20000 : 8000)) {
                    act.__lmxNg = (act.__lmxNg || 0) + 1;
                    heroStatus(act, 'Повторюємо запит до «' + (curKey || 'джерела') + '»…', false, 0.4);
                    var ngG = (S.season && S.season.items && S.season.items.length) ? S.season : (S.voice && S.voice.items && S.voice.items.length ? S.voice : null), ngDone = false;
                    if (ngG) { try { var ngI = selItem(ngG); if (ngI) { selIn(inst, 'filter', { stype: ngG.stype }, { index: idxOf(ngG, ngI) }); ngDone = true; } } catch (e) { ngDone = false; } }
                    if (!ngDone) { try { if (typeof inst.find === 'function') inst.find(); } catch (e) {} }
                    since = Date.now();
                    act.__lmxRlKey = ''; act.__lmxRlMin = Date.now() + 450; act.__lmxKeep = []; act.__lmxVGt = Date.now();
                    safe(function () { afterReload(act); });
                    return;
                }
                if (!empty) { heroStatus(act, manual ? 'Шукаємо на «' + srcName(curIt && curIt.title) + '»… ' + Math.round(waited / 1000) + ' с' + (waited > 9000 ? ' · джерело відповідає повільно, можна обрати інше кнопкою «Джерело»' : '') : (profileOf(window.__lmxProbe).label || 'Перевіряємо джерела…'), false, 0.15 + Math.min(0.6, waited / 16000)); return; }
                if (!cd) {
                    try { $(body).find('[class*="empty__button"].cancel').each(function () { if (!/заказ|замов|order|запит|озвуч|request/i.test(this.textContent || '')) $(this).trigger('hover:enter'); }); } catch (e) {}
                    if (curKey && bad.names.indexOf(curKey) < 0) bad.names.push(curKey);
                    if (curKey && cid) seSet(cid, curKey, 'no');
                    var mem = memGet();
                    if (curKey) { var g = mem.g[curKey] || (mem.g[curKey] = { ok: 0, fail: 0, q: 0 }); g.fail = Math.min(20, (g.fail || 0) + 1); g.ft = Date.now(); memSet(mem); }
                    var c = sort.filter(function (x) { return x && !x.selected && !x.ghost && srcName(x.title) && bad.names.indexOf(srcName(x.title)) < 0; })
                        .sort(function (x, y) { var kx = srcName(x.title), ky = srcName(y.title); return (srcScore(ky, { q: titleQ(y.title), pe: pcEntry(cid, ky) }, mem).s - srcScore(kx, { q: titleQ(x.title), pe: pcEntry(cid, kx) }, mem).s) || (gscore(mem.g[ky]) - gscore(mem.g[kx])); });
                    if (!c.length) {
                        // раніше тут усі панелі знімались, і лишався порожній екран з крихітним статусом у шапці. Тепер — видима панель із кнопками «Усі джерела» / «Повторити»
                        // (а список «порожніх» джерел скидаємо, щоб ручний вибір чи повтор не впирались у нього)
                        act.__lmxProbing = false; bad.names = [];
                        safe(function () { ensureProg(act); });
                        heroStatus(act, 'Нічого не знайдено: жодне джерело не дало результатів', true);
                        act.classList.remove('lmx-onl-load'); relayout(); return stop();
                    }
                    cand = c[0]; cd = Date.now() + (manual ? 4000 : 600);
                }
                var left = Math.ceil((cd - Date.now()) / 1000);
                if (left > 0) { if (!manual) { heroStatus(act, 'Джерело «' + (curKey || '—') + '» нічого не дало. Пробуємо «' + srcName(cand.title) + '»…', false, 0.2); return; } heroStatus(act, 'Нічого не знайдено на «' + (curKey || 'цьому джерелі') + '». Перемикаємо на «' + srcName(cand.title) + '» через ' + left + ' с…', false, 1 - left / 4); return; }
                var go = cand; cd = 0; cand = null; since = Date.now(); lastKey = null;
                if (manual) heroStatus(act, 'Відкриваємо «' + srcName(go.title) + '»…', false, 0.2);
                try { selIn(inst, 'sort', go); } catch (e) {}
            });
        }, 500);
    }

    // Заготовки завантаження: ряд «фільтрів» на місці панелі й картки там, де з'являться серії — висота збігається з готовим екраном
    var PROG_PILLS = '<div class="lmx-onl-prog__f"><i></i><i></i><i></i><i></i></div>';
    var PROG_CARDS = '<div class="lmx-onl-prog__g"><i class="lmx-onl-prog__c"></i><i class="lmx-onl-prog__c"></i><i class="lmx-onl-prog__c"></i><i class="lmx-onl-prog__c"></i><i class="lmx-onl-prog__c"></i></div>';
    function buildSkeleton(act, hd, card) {
        act.__lmxVT0 = Date.now();
        var q = (card.title || card.name || ''), year = String(card.release_date || card.first_air_date || '').slice(0, 4), vote = Number(card.vote_average) || 0;
        var h = document.createElement('div');
        h.className = 'lmx-onl-hero lmx-onl-hero--load';
        h.setAttribute('data-sig', 'load');
        h.innerHTML = (card.backdrop_path ? '<div class="lmx-onl-hero__bg" style="opacity:0;background-image:url(\'' + img(card.backdrop_path, artMax() ? 'original' : 'w1280') + '\')"></div>' : '') +
            '<div class="lmx-onl-hero__sh"></div><div class="lmx-onl-hero__t"></div>' +
            '<div class="lmx-onl-hero__m">' + (vote ? '<span>&#9733; ' + vote.toFixed(1) + '</span>' : '') + (year ? '<span>' + year + '</span>' : '') + '</div>' +
            '<div class="lmx-onl-hero__a" style="visibility:hidden"><div class="lmx-onl-btn lmx-onl-btn--main">&nbsp;</div></div>' +
            ((card.name || card.number_of_seasons || (card.first_air_date && !card.release_date)) ? '<div class="lmx-onl-hero__w" style="visibility:hidden">&nbsp;</div>' : '') +
            '<div class="lmx-onl-hero__s">Шукаємо джерела…</div>';
        h.querySelector('.lmx-onl-hero__t').textContent = q;
        hd.insertBefore(h, hd.firstChild);
        fadeBg(h);
        var pr = document.createElement('div');
        pr.className = 'lmx-onl-prog';
        pr.innerHTML = PROG_PILLS + '<div class="lmx-onl-prog__s">Шукаємо джерела…</div><div class="lmx-onl-prog__b"><i></i></div>' + PROG_CARDS;
        hd.insertBefore(pr, h.nextSibling);
        act.classList.add('lmx-onl-load');
        if (scanning()) safe(function () { heroStatus(act, '', false, 0); });
        var ex2 = act.querySelector('.explorer'); if (ex2) ex2.classList.add('lmx-onl');
        putLogo(h, card);
        if (autoOn()) watchSources(act, card);
        // якщо джерел так і не знайшлось, переливання не вічне
        setTimeout(function () { act.__lmxProbing = false; safe(buildHero); setTimeout(function () { settleHold(act); act.classList.remove('lmx-onl-load'); h.classList.remove('lmx-onl-hero--load'); var q = act.querySelector('.lmx-onl-prog'); var bd = act.querySelector('.explorer__files-body .scroll__body'); if (q && bd && nativeList(bd)) { var hs = act.querySelector('.lmx-onl-hero__s'); if (hs && hs.parentNode) hs.parentNode.removeChild(hs); q.parentNode.removeChild(q); } else if (q && !act.querySelector('.lmx-onl-item')) { q.classList.add('lmx-onl-prog--end'); var ps = q.querySelector('.lmx-onl-prog__s'); if (ps) ps.textContent = 'Джерела не відповіли. Оберіть джерело вручну'; } else if (q) q.parentNode.removeChild(q); }, 50); }, (probeOn() ? 130000 : (qTarget() >= 4 ? 65000 : 30000)));
    }

    // Як у Nova: коли джерело відкрите, читаємо якість з реальних серій (1080p, 4K…) і запам'ятовуємо найвищу — бейдж у списку джерел стає точним
    function learnQuality(act, list, card) {
        var cid = String(card && card.id || ''), inst = instFor(act), S = inst && readSets(inst), sel = null, best = 0, i, m, n, t;
        if (!cid || !S) return;
        S.sort.forEach(function (x) { if (x && x.selected) sel = x; });
        var key = sel ? srcName(sel.title) : '';
        if (!key) return;
        for (i = 0; i < list.length && i < 60; i++) {
            t = String(list[i].textContent || '');
            m = t.match(/(2160|1440|1080|720|576|480|360)\s*p/i);
            n = /\b(4k|uhd)\b/i.test(t) ? 4 : m ? (parseInt(m[1], 10) >= 2160 ? 4 : parseInt(m[1], 10) >= 1080 ? 3 : parseInt(m[1], 10) >= 720 ? 2 : 1) : 0;
            if (n > best) best = n;
        }
        seSet(cid, key, 'ok');
        if (best && act.__lmxLQ !== key + best) { act.__lmxLQ = key + best; qmPut(cid, key, best); }
    }
    // Оформлення карток (час, слоган, озвучка, дати, роздільники) кожна серія проходить один раз: раніше при кожному перемальовуванні
    // обходились усі сотні серій і браузер щоразу перераховував розмітку. Видимі — одразу, решта — невеликими порціями
    function decorate(act, list, card) {
        var fresh = list.filter(function (it) { return !it.__lmxDec; });
        if (!fresh.length) return;
        fresh.forEach(function (it) { it.__lmxDec = 1; });
        var now = fresh.filter(function (it) { return !it.classList.contains('lmx-onl-off'); }), rest = fresh.filter(function (it) { return it.classList.contains('lmx-onl-off'); });
        function run(l) { safe(function () { fixTimes(l, card); hideTagline(l, card); hideVoice(act, l); dropDupDates(l); shortDates(l, card); tidySeps(l); }); }
        run(now);
        (function step() {
            if (!rest.length || !document.body.contains(act)) return;
            run(rest.splice(0, 30));
            if (rest.length) setTimeout(step, 40);
        })();
    }
    function buildHero() {
        var act = document.querySelector('.activity--active');
        var body = act && act.querySelector('.explorer__files-body .scroll__body');
        if (!body || !isOn()) return;
        // Джерела розмічають серії по-різному (.videos__item, .online-prestige, з префіксами на кшталт .onl-online-prestige…), тому не
        // покладаємось на назви класів: серією вважаємо кожен фокусований елемент списку, у якому є картинка або смужка прогресу
        var kids = body.children, list = [], i;
        for (i = 0; i < kids.length; i++) {
            var el = kids[i];
            if (!el.classList || !(el.classList.contains('selector') || el.classList.contains('lmx-onl-off')) || el.classList.contains('lmx-onl-btn')) continue;
            if (el.classList.contains('videos__button') || el.classList.contains('simple-button') || el.classList.contains('videos__season') || /folder/.test(el.className)) continue;
            if (hasEp(el)) list.push(el);
        }
        list = dedupeEps(famFilter(list));
        if (!list.length) { var ge = genericEps(body); if (ge.length) list = ge; }
        list.forEach(function (e) { e.classList.add('lmx-onl-item'); e.classList.toggle('lmx-onl-dim', isSoon(e) || /disabled|unavailable|not-?avail|soon/i.test(String(e.className))); });   // недоступні серії (нема в джерелі / без цієї озвучки) — темніші
        var ex = act.querySelector('.explorer');
        if (ex && (list.length || ex.querySelector('.videos__item, [class*="online-prestige"], .torrent-item'))) ex.classList.add('lmx-onl');
        if (body.querySelector('.videos__item-imgbox') || (list.length && list[0].querySelector('img'))) body.classList.add('lmx-onl-grid');
        if (list.length && list[0].parentNode && list[0].parentNode !== body && (body.classList.contains('lmx-onl-grid') || list[0].querySelector('img, [style*="background-image"], [class*="img"]'))) list[0].parentNode.classList.add('lmx-onl-grid');
        // рядки-довідки (без картинки), як «Netflix · Сезон 3 · Серія 5»: на всю ширину сітки
        for (i = 0; i < kids.length; i++) if (kids[i].classList && kids[i].classList.contains('selector') && !kids[i].classList.contains('lmx-onl-item') && !kids[i].classList.contains('videos__button') && !kids[i].classList.contains('lmx-onl-btn')) kids[i].classList.add('lmx-onl-wide');
        var card = null;
        try { var a = Lampa.Activity.active(); card = a && (a.movie || a.card); if (a && a.component === 'torrents') return; } catch (e) {}
        if (!card) return;
        var hd = act.querySelector('.explorer__files-head') || body, old = hd.querySelector('.lmx-onl-hero');
        if (act.__lmxProbing) return;
        if (!list.length) { if (!old && hd !== body) buildSkeleton(act, hd, card); safe(function () { emptyGuard(act); }); return; }
        if (voiceGate(act, card, list)) return;
        settleHold(act);
        act.classList.remove('lmx-onl-load');
        var pg = hd.querySelector('.lmx-onl-prog'); if (pg) pg.parentNode.removeChild(pg);
        numberItems(list);
        safe(function () { applyOrderPages(act, list); });
        safe(function () { leftTimes(list); });
        safe(function () { decorate(act, list, card); });
        safe(function () { epInfo(list, card, act); });
        safe(function () { learnQuality(act, list, card); });
        safe(function () { learnUaVoice(act, list); });
        safe(function () { clearTimeout(act.__lmxFD); act.__lmxFD = setTimeout(function () { safe(function () { fitDates(list); }); setTimeout(function () { safe(function () { fitDates(list); }); }, 1300); }, 350); });
        safe(function () { thumbFallback(list, card); [1200, 3000, 7000].forEach(function (d) { setTimeout(function () { safe(function () { thumbFallback(list, card); }); }, d); }); });
        safe(function () { buildBar(act, hd, list); });
        // перший вхід: Lampa рахує висоту прокрутки до того, як з'явились усі ряди — перераховуємо (раніше це давав лише повторний вибір «Серії 1-10»)
        if (act.__lmxRLn !== list.length) { act.__lmxRLn = list.length; relayout(); [400, 1500, 3500].forEach(function (d) { setTimeout(function () { safe(relayout); }, d); }); }
        // при завантаженні списку опускаємось до останньої переглянутої серії сезону (фокус не чіпаємо)
        safe(function () {
            if (!(card.name || card.number_of_seasons || (card.first_air_date && !card.release_date))) return;   // фільм: це версії, а не серії — до «останньої переглянутої» не прокручуємо
            // Після ручного вибору джерела/сезону/озвучки фокус має лишитись на пілюлі, яку щойно обрали: спуск до «останньої переглянутої»
            // знімав її утримання й тягнув рамку на картку (було видно, як екран сам їде вниз і назад) — це лише для першого відкриття екрана
            if (Date.now() - (window.__lmxManual || 0) < 20000) return;
            var li = -1, q;
            for (q = 0; q < list.length; q++) if (pct(list[q]) >= 1) li = q;
            if (li < 5 || act.__lmxAS === list.length + '|' + (jd(list[0]).season || '') + '|' + li) return;
            act.__lmxAS = list.length + '|' + (jd(list[0]).season || '') + '|' + li;
            var tgt = list[li], t0 = Date.now();
            // Список опускається до останньої переглянутої серії — фокус теж має бути там, інакше він лишається на кнопці шапки/першій картці,
            // і перше ж натискання повертає екран нагору. Утримання фокуса на кнопці шапки для цього знімаємо
            act.__lmxHold = null; clearInterval(act.__lmxHI); act.__lmxAutoT = Date.now();
            // Фокус і прокрутку виставляємо, поки список ще схований (0–260 мс); пізніше (700 мс) лише страхуємо, якщо картка не в кадрі
            [0, 100, 220, 700].forEach(function (d) { setTimeout(function () { safe(function () {
                var cur = document.querySelector('.focus');
                if (!document.body.contains(tgt) || selOpen() || act.__lmxOpen) return;
                if (d >= 700) { var rr = tgt.getBoundingClientRect(); if (cur === tgt && rr.bottom > 40 && rr.top < window.innerHeight - 20) return; }
                if ((window.__lmxKeyT || 0) > t0 || (window.__lmxTouchT || 0) > t0) return;
                if (cur && cur !== tgt && cur.closest && cur.closest('.lmx-onl-bar, .lmx-onl-drop')) return;
                if (cur && cur.classList.contains('lmx-onl-item') && cur !== tgt && cur !== list[0]) return;
                if (cur !== tgt) { ctlContent(); if (window.Navigator && Navigator.focus) Navigator.focus(tgt); }
                bringIn(tgt);
            }); }, d); });
        });
        var refEl = findRef(act), srcTxt = ((refEl && refEl.textContent || '').replace(/^\s*(джерело|source)\s*/i, '').trim().replace(/\s*~.*$/, '') + (chosen(filterText(act), RX_VOICE) ? ' \u00b7 ' + chosen(filterText(act), RX_VOICE) : '')).replace(/^\s*\u00b7\s*/, '');
        var sst = seriesStats(card), sig = list.length + ':' + list.map(function (el) { return Math.round(pct(el)); }).join(',') + '|' + srcTxt + '|' + (sst ? sst.seen + '/' + sst.total : '');
        if (old && old.getAttribute('data-sig') === sig) return;
        var oldFocIdx = -1;
        if (old) { try { oldFocIdx = [].indexOf.call(old.querySelectorAll('.lmx-onl-btn'), old.querySelector('.focus')); } catch (e) {} old.parentNode.removeChild(old); }

        var seen = 0, cont = -1, k;
        for (k = 0; k < list.length; k++) { if (isSoon(list[k])) continue; var pp = pct(list[k]); if (pp >= 90) seen++; else if (pp >= 1 && cont < 0) cont = k; }
        if (cont < 0) { for (k = 0; k < list.length; k++) if (!isSoon(list[k]) && pct(list[k]) < 90) { cont = k; break; } }
        var ss = seriesStats(card), curSn = 0, jj = list.length ? jd(list[0]) : {}, nextSn = 0, allSeen = false;
        curSn = parseInt(jj.season, 10) || 0;
        // сезон закінчено (cont < 0): шукаємо сезон, де ще є непереглянуте; якщо такого немає — серіал переглянуто повністю
        if (cont < 0 && seen > 0) {
            if (ss && curSn) {
                var ord = ss.order, q2;
                for (q2 = 0; q2 < ord.length; q2++) if (ord[q2] > curSn && ss.per[ord[q2]].seen < ss.per[ord[q2]].total) { nextSn = ord[q2]; break; }
                if (!nextSn) for (q2 = 0; q2 < ord.length; q2++) if (ord[q2] < curSn && ss.per[ord[q2]].seen < ss.per[ord[q2]].total) { nextSn = ord[q2]; break; }
            }
            if (!nextSn) { allSeen = true; cont = 0; }
        }
        // відкрили серіал на сезоні, який уже не відповідає прогресу — один раз переходимо на потрібний (ручний вибір сезону це скасовує)
        if (ss && curSn && !act.__lmxSA) {
            act.__lmxSA = 1;
            var tgt = targetSeason(ss);
            if (tgt && tgt !== curSn) setTimeout(function () { safe(function () { if ((window.__lmxKeyT || 0) > Date.now() - 5000 || act.__lmxSA > 1 || selOpen()) return; gotoSeason(act, tgt); }); }, 1500);
        }
        // «Продовжити» діє на весь серіал: якщо за прогресом треба інший сезон, ніж відкритий, кнопка веде туди й запускає серію
        var resSn = 0;
        if (ss && curSn && !allSeen) { var rt0 = targetSeason(ss); if (rt0 && rt0 !== curSn) resSn = rt0; }
        // відкрили потрібний сезон після «Продовжити» з іншого — запускаємо першу недоглянуту серію
        var pl = window.__lmxPlay;
        if (pl && pl.cid === String(card.id || '') && Date.now() - pl.at < 25000 && curSn === pl.season && cont >= 0 && !allSeen) {
            window.__lmxPlay = null;
            var pt = list[cont];
            setTimeout(function () { safe(function () { press(pt); }); }, 500);
        }
        var firstUn = -1; for (k = 0; k < list.length; k++) if (!isSoon(list[k]) && pct(list[k]) < 90) { firstUn = k; break; }
        // Фільм: у списку не серії, а варіанти (релізи/озвучки), тож зверху лишається одна кнопка «Дивитись / Продовжити»
        var isMovie = !(card.name || card.number_of_seasons || (card.first_air_date && !card.release_date));
        var showFirst = !isMovie && firstUn >= 0 && cont >= 0 && firstUn < cont && !resSn && !allSeen;
        var haveProg = seen > 0 || cont > 0 || (cont === 0 && pct(list[0]) >= 1);
        var fSn = 0;
        try { var Sx = instFor(act) && readSets(instFor(act)), sg = Sx && Sx.season, si = sg && selItem(sg); if (si) { var mm = String(si.title || '').match(/\d+/); fSn = mm ? parseInt(mm[0], 10) : 0; } } catch (e) {}
        function lab(idx) { var j = jd(list[idx]), n = j.episode || (idx + 1), sn = j.season || curSn || fSn; return (sn ? 'S' + sn + ' ' : '') + 'E' + n; }

        var title = card.title || card.name || '', q = qual(list);
        var year = String(card.release_date || card.first_air_date || '').slice(0, 4);
        var rt = card.episode_run_time && card.episode_run_time[0] || card.runtime || 0;
        var vote = Number(card.vote_average) || 0;
        var h = document.createElement('div');
        h.className = 'lmx-onl-hero';
        h.setAttribute('data-sig', sig);
        h.innerHTML = (card.backdrop_path ? '<div class="lmx-onl-hero__bg" style="opacity:0;background-image:url(\'' + img(card.backdrop_path, artMax() ? 'original' : 'w1280') + '\')"></div>' : '') +
            '<div class="lmx-onl-hero__sh"></div><div class="lmx-onl-hero__t">' + esc(title) + '</div>' +
            '<div class="lmx-onl-hero__m">' + (q ? '<span class="lmx-onl-hero__q">' + esc(q) + '</span>' : '') + (vote ? '<span>&#9733; ' + vote.toFixed(1) + '</span>' : '') +
            (year ? '<span>' + year + '</span>' : '') + (rt ? '<span>' + rt + ' хв</span>' : '') + '</div>' +
                        '<div class="lmx-onl-hero__a">' +
            (nextSn ? '<div class="lmx-onl-btn lmx-onl-btn--main selector" data-season="' + nextSn + '">&#9654;&#xFE0E;&nbsp; ' + (nextSn > curSn ? 'Наступний сезон' : 'Непереглянутий сезон') + ' &middot; S' + nextSn + '</div>' : '') +
            (resSn ? '<div class="lmx-onl-btn lmx-onl-btn--main selector" data-resume="' + resSn + '">&#9654;&#xFE0E;&nbsp; Продовжити &middot; S' + resSn + '</div>' : cont >= 0 ? '<div class="lmx-onl-btn lmx-onl-btn--main selector" data-go="' + cont + '">&#9654;&#xFE0E;&nbsp; ' + (allSeen ? 'Дивитись знову' : haveProg ? 'Продовжити' : 'Дивитись') + (isMovie ? '' : ' &middot; ' + esc(lab(cont))) + '</div>' : '') +
            (showFirst ? '<div class="lmx-onl-btn selector" data-go="' + firstUn + '">Перша непереглянута &middot; ' + esc(lab(firstUn)) + '</div>' : '') + (srcTxt ? '<span class="lmx-onl-hero__src">' + esc(srcTxt) + '</span>' : '') + '</div>' +
            (list.length > 1 && !isMovie ? (ss ? '<div class="lmx-onl-hero__w">Переглянуто ' + ss.seen + ' з ' + ss.total + (curSn && ss.per[curSn] ? ' &middot; цей сезон ' + ss.per[curSn].seen + ' з ' + ss.per[curSn].total : '') + '</div>' +
                '<div class="lmx-onl-hero__bar"><i style="width:' + Math.round(ss.seen / ss.total * 100) + '%"></i></div>' :
                '<div class="lmx-onl-hero__w">Переглянуто ' + seen + ' з ' + list.length + (list.length - seen > 0 ? ' &middot; залишилось ' + (list.length - seen) : '') + '</div>' +
                '<div class="lmx-onl-hero__bar"><i style="width:' + Math.round(seen / list.length * 100) + '%"></i></div>') : '');
        hd.insertBefore(h, hd.firstChild);
        fadeBg(h);
        dedupeUi(act);
        putLogo(h, card);
        resync(act);
        // Перший показ списку: рідний фокус Lampa спершу стає на першу картку (рамка + легке прокручування), а за мить наш код переносить його на кнопку шапки,
        // і список «сповзає» назад — це видно як стрибок картки. Переносимо фокус одразу й підстраховуємось кількома короткими повторами
        if (!act.__lmxFF) {
            act.__lmxFF = Date.now();
            var autoOwns = !!(act.__lmxAutoT && Date.now() - act.__lmxAutoT < 4000);
            if ((!window.__lmxKeyT || window.__lmxKeyT < Date.now() - 1500) && !(act.__lmxAutoT && Date.now() - act.__lmxAutoT < 4000)) holdFocus(act, 'hero', 1800);
            var tk0 = window.__lmxKeyT || 0;
            [0, 60, 150, 300, 500].forEach(function (d) {
                setTimeout(function () {
                    safe(function () {
                        if (!document.body.contains(act) || selOpen() || act.__lmxOpen || (window.__lmxKeyT || 0) > tk0) return;
                        var f = act.querySelector('.focus'), tg = act.querySelector('.lmx-onl-hero .lmx-onl-btn.selector');
                        if (!tg || autoOwns || (f && !f.classList.contains('lmx-onl-item'))) return;
                        var cn = Lampa.Controller.enabled(); if (cn && cn.name && cn.name !== 'content') return;
                        ctlContent();
                        if (window.Navigator && Navigator.focus) Navigator.focus(tg);
                        resetScroll(act);
                    });
                }, d);
            });
        }
        var btns = h.querySelectorAll('.lmx-onl-btn');
        // шапку перебудовано (змінився прогрес), а фокус стояв на її кнопці — одразу повертаємо його на таку саму нову, інакше Lampa кидає його на картку
        if (oldFocIdx >= 0 && btns.length && window.Navigator && Navigator.focus) safe(function () { ctlContent(); Navigator.focus(btns[Math.min(oldFocIdx, btns.length - 1)]); });
        for (i = 0; i < btns.length; i++) (function (b) {
            $(b).on('hover:enter click', once(function () {
                var sn = b.getAttribute('data-season'), rs = b.getAttribute('data-resume');
                if (rs) { window.__lmxPlay = { cid: String(card.id || ''), season: parseInt(rs, 10), at: Date.now() }; act.__lmxSA = 2; return gotoSeason(act, parseInt(rs, 10)); }
                if (sn) return gotoSeason(act, parseInt(sn, 10));
                var t = list[parseInt(b.getAttribute('data-go'), 10)]; if (t) press(t);
            }));
            addNav(b);
        })(btns[i]);
        // Lampa прокручує список до сфокусованої серії, і шапка залишалась нагорі за кадром. Поки пульт не чіпали, ставимо фокус на «Продовжити»
        // Фільм: картки — це версії (озвучка, якість), а не серії, тож фокус не залишаємо на «останній переглянутій» (його туди ставить сама Lampa) — повертаємо на головну кнопку.
        // Один раз для кожного нового списку й лише якщо пульт у цей момент не чіпали
        if (isMovie && btns.length) {
            var mfSig = list.length + '|' + String(list[0] && list[0].textContent || '').replace(/\s+/g, ' ').slice(0, 40);
            if (body.__lmxMF !== mfSig) {
                body.__lmxMF = mfSig;
                [80, 400, 900, 1600].forEach(function (d) {
                    setTimeout(function () { safe(function () {
                        var f = document.querySelector('.focus');
                        if (f && f.classList.contains('lmx-onl-item') && Date.now() - (window.__lmxKeyT || 0) > 1500 && Date.now() - (window.__lmxTouchT || 0) > 1500 && window.Navigator && Navigator.focus && document.body.contains(btns[0])) Navigator.focus(btns[0]);
                    }); }, d);
                });
            }
        }
        if (btns.length && !body.__lmxFocus && (window.__lmxKeyT || 0) <= actT0) {
            body.__lmxFocus = 1;
            setTimeout(function () { safe(function () { if ((window.__lmxKeyT || 0) <= actT0 && window.Navigator && Navigator.focus) Navigator.focus(btns[0]); }); }, 60);
        }
    }

    // «Онлайн» відкривається миттєво: екран перетворюємо в момент появи, до першої відрисовки (раніше на долі секунди мигало старе меню)
    var lastEnter = { t: 0, cls: '' };
    function early(ex) {
        var a = null, card = null;
        try { a = Lampa.Activity.active(); card = a && (a.movie || a.card); } catch (e) {}
        if (!card || (a && a.component === 'torrents')) return;
        var act = ex.closest('.activity'), hd = ex.querySelector('.explorer__files-head');
        if (!act || !hd || hd.querySelector('.lmx-onl-hero')) return;
        ex.classList.add('lmx-onl');
        buildSkeleton(act, hd, card);
        document.body.classList.remove('lmx-onl-entering');
    }
    function watchInsert() {
        $(document).on('hover:enter', function (e) {
            lastEnter.t = Date.now(); lastEnter.cls = String((e.target && e.target.className) || '');
            lastEnter.on = /online|онлайн/i.test(lastEnter.cls + ' ' + String((e.target && e.target.textContent) || '').slice(0, 60));
            // стандартний екран джерела не повинен мигнути: до того, як побудуємо свій, ховаємо його (страховка 1.8 с)
            if (lastEnter.on && isOn()) {
                entering(true);
            }
        });
        var host = document.querySelector('.activitys__slides') || document.body;
        new MutationObserver(function (muts) {
            if (!((Date.now() - lastEnter.t <= 2500 && lastEnter.on) || scanning()) || !isOn()) return;
            var i, j, n, cl, ex;
            for (i = 0; i < muts.length; i++) for (j = 0; j < muts[i].addedNodes.length; j++) {
                n = muts[i].addedNodes[j];
                if (n.nodeType !== 1) continue;
                cl = n.classList;
                if (!(cl.contains('explorer') || cl.contains('activity__body') || cl.contains('activity'))) continue;
                ex = cl.contains('explorer') ? n : n.querySelector('.explorer');
                if (ex && !ex.__lmxEarly) { ex.__lmxEarly = 1; safe(function () { early(ex); }); }
            }
        }).observe(host, { childList: true, subtree: true });
    }

    var obs = null, obsTarget = null, tm = 0, actT0 = 0;
    function arm() {
        var act = document.querySelector('.activity--active');
        var body = act && act.querySelector('.explorer__files-body .scroll__body');
        if (!body || body === obsTarget) return;
        if (obs) obs.disconnect();
        obsTarget = body;
        // плагін-джерело перемальовує список (зміна сезону, джерела, озвучки) — оновлюємо шапку з паузою, щоб не заважати
        obs = new MutationObserver(function () { var a1 = document.querySelector('.activity--active'); if (a1 && a1.querySelector('.explorer.lmx-onl')) safe(function () { hideJunk(a1); }); clearTimeout(tm); tm = setTimeout(function () { safe(buildHero); var a2 = document.querySelector('.activity--active'); if (a2) { resync(a2); recover(a2); } }, 250); });
        obs.observe(body, { childList: true });
    }

    // Екран плагіна UAKino: свій компонент, без Lampa.Filter, тож нашу логіку він не бачить. Додаємо лише безпечне, без нових фокусних елементів:
    // логотип замість тексту назви (як у нашій шапці), мітку для стилів. Його навігацію й кнопки не чіпаємо
    function uakAdapt() {
        var hd0 = document.querySelector('.uakino-online__head-text');
        if (!hd0 || hd0.getAttribute('data-lmx-uak') || !isOn()) return;
        var act = document.querySelector('.activity--active'), hd = act && act.querySelector('.uakino-online__head-text');
        if (!hd || hd.getAttribute('data-lmx-uak')) return;
        hd.setAttribute('data-lmx-uak', '1');
        var t = hd.querySelector('.uakino-online__head-title'), card = null;
        try { var a0 = Lampa.Activity.active(); card = a0 && (a0.movie || a0.card); } catch (e) {}
        if (!t || !card || !card.id) return;
        t.classList.add('lmx-onl-hero__t');
        hd.classList.add('lmx-uak-hero');
        putLogo(hd, card);
    }
    // ---- Підвантаження наступної серії: поки йде поточна, один раз «будимо» посилання наступної (лише для серій із відкладеним посиланням method:'call'), щоб джерело
    // встигло віддати потік і перемикання в плеєрі було швидшим. Один запит, лише коли плеєр стартував з нашого екрана; вимикається в налаштуваннях
    function prefetchOn() { var v = Lampa.Storage.get('lmx_online_prefetch', 'true'); return v === true || v === 'true'; }
    function trackPlay() {
        if (window.__lmxTP) return;
        window.__lmxTP = 1;
        try { $(document).on('hover:enter', '.lmx-onl-item', function () { window.__lmxPlayEl = this; window.__lmxPlayT = Date.now(); }); } catch (e) {}
    }
    function warmNext() {
        try {
            if (!prefetchOn() || !isOn()) return;
            var el = window.__lmxPlayEl;
            if (!el || !document.body.contains(el) || Date.now() - (window.__lmxPlayT || 0) > 20000) return;
            var nx = el.nextElementSibling;
            while (nx && !(nx.classList && nx.classList.contains('lmx-onl-item'))) nx = nx.nextElementSibling;
            if (!nx || nx.__lmxWarm) return;
            nx.__lmxWarm = 1;
            var j = jd(nx), u = j && j.url;
            if (!u || j.method !== 'call' || typeof u !== 'string' || !/^https?:/i.test(u)) return;
            var net = new Lampa.Reguest(); net.__lmxProbe = true;
            try { net.timeout(8000); } catch (e) {}
            net.silent(u, function () {}, function () {}, false, { dataType: 'text' });
        } catch (e) {}
    }
    // ---- «Здоров'я джерел»: що ми знаємо про кожне джерело зі зібраного досвіду (успіхи, невдачі, швидкість, якість)
    function showHealth() {
        var enabled = ''; try { enabled = Lampa.Controller.enabled().name; } catch (e) {}
        function back() { try { Lampa.Controller.toggle(enabled); } catch (e) {} }
        var mem = memGet(), g = mem.g || {}, keys = Object.keys(g).filter(function (k) { return g[k] && ((g[k].ok || 0) + (g[k].fail || 0)) > 0; });
        keys.sort(function (a, b) { return gscore(g[b]) - gscore(g[a]); });
        var QN = { 4: '4K', 3: 'FHD', 2: 'HD', 1: 'SD' };
        var items = keys.map(function (k) {
            var x = g[k], q = Math.round(x.q || 0), quar = (x.fail || 0) >= 3 && x.fail > (x.ok || 0) * 2 && Date.now() - (x.ft || 0) < 86400000;
            return { title: k, subtitle: '✓ ' + (x.ok || 0) + '  ✗ ' + (x.fail || 0) + (x.ms ? '  · ' + (x.ms / 1000).toFixed(1) + ' с' : '') + (QN[q] ? '  · ' + QN[q] : '') + (quar ? '  · тимчасово пропускається' : ''), k: k };
        });
        if (!items.length) { try { Lampa.Noty.show('Досвіду про джерела ще немає: відкрийте кілька фільмів чи серіалів онлайн'); } catch (e) {} return; }
        items.push({ title: 'Скинути накопичену статистику', subtitle: 'Плагін почне вчитись заново', k: '__reset' });
        Lampa.Select.show({
            title: 'Здоров’я джерел',
            items: items,
            onBack: back,
            onSelect: function (a) {
                if (a.k === '__reset') { try { var m2 = memGet(); m2.g = {}; memSet(m2); Lampa.Noty.show('Статистику джерел скинуто'); } catch (e) {} }
                back();
            }
        });
    }
    // Діагностика: стисла схема розмітки активного екрана (класи, розміри, видимість) — копіюється в буфер обміну
    function copyDiag() {
        var act = document.querySelector('.activity--active') || document.querySelector('.activity'), out = [], cnt = 0;
        function walk(el, d) {
            if (cnt > 520 || d > 9 || el.nodeType !== 1) return;
            var r = el.getBoundingClientRect(), cs = window.getComputedStyle(el), cl = String(el.className || '').replace(/\s+/g, '.').slice(0, 90);
            out.push(new Array(d + 1).join(' ') + el.tagName.toLowerCase() + (cl ? '.' + cl : '') + ' [' + Math.round(r.width) + 'x' + Math.round(r.height) + (cs.display === 'none' ? ' none' : '') + (cs.visibility === 'hidden' ? ' hidden' : '') + (el.hasAttribute('data-lmx-old') ? ' OLD' : '') + ']');
            cnt++;
            [].forEach.call(el.children, function (c) { walk(c, d + 1); });
        }
        var head = 'LMX Watch ' + VERSION + ' | ' + window.innerWidth + 'x' + window.innerHeight + ' | body: ' + document.body.className.slice(0, 160) + '\nact: ' + (act ? act.className : '-') + '\n';
        if (act) walk(act, 0);
        var text = head + out.join('\n');
        function done(ok) { noty(ok ? 'Діагностику скопійовано' : 'Не вдалося скопіювати'); }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fb(); }); return; }
        } catch (e) {}
        fb();
        function fb() {
            try { var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-999px;top:0'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); document.body.removeChild(ta); done(ok); } catch (e) { done(false); }
        }
    }
    function start() {
        safe(function () {
            addCss();
            document.body.classList.toggle('lmx-online', isOn());
            // Рідний Lampac після завантаження списку сам ставить фокус на «останню» картку (екран їхав до серій 06–08 і назад).
            // Поки триває утримання фокуса на пілюлі (користувач нічого не тиснув), фокус на картки серій не пускаємо
            if (window.Navigator && Navigator.focus && !Navigator.__lmxFG) {
                Navigator.__lmxFG = 1;
                var realFocus = Navigator.focus;
                Navigator.focus = function (el) {
                    try {
                        if (!(el && el.classList && el.classList.contains('lmx-onl-item'))) return realFocus.apply(this, arguments);
                        var aa = document.querySelector('.activity--active'), hh = aa && aa.__lmxHold;
                        if (hh && hh.key !== 'hero' && Date.now() < hh.until && el && el.classList && el.classList.contains('lmx-onl-item')
                            && !((window.__lmxKeyT || 0) > (hh.t0 || 0)) && document.querySelector('.activity--active .focus') !== el) return;
                    } catch (e) {}
                    return realFocus.apply(this, arguments);
                };
            }
            if (!window.__lmxKeyHook) { window.__lmxKeyHook = 1; window.__lmxKeyT = 0; document.addEventListener('keydown', function () { window.__lmxKeyT = Date.now(); }, true); }
            // Дотик/колесо: на телефоні фокусу немає, і наші «рятувальні» цикли (viewGuard, recover, resync) щоразу ставили фокус на кнопку шапки —
            // список прокручувався нагору просто під пальцем. Тепер вони стають осторонь, поки користувач сам гортає
            if (!window.__lmxTouchHook) { window.__lmxTouchHook = 1; window.__lmxTouchT = 0; ['touchstart', 'touchmove', 'touchend', 'wheel'].forEach(function (ev) { document.addEventListener(ev, function () { window.__lmxTouchT = Date.now(); }, { capture: true, passive: true }); }); }
            var S2 = Lampa.SettingsApi;
            if (S2 && S2.addComponent) S2.addComponent({ component: 'lmx_watch', name: 'LMX Watch', icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M10 8.5l5 2.5-5 2.5z" fill="currentColor"/><path d="M8 21h8"/></svg>' });
            if (S2 && S2.addParam) S2.addParam({
                component: 'lmx_watch', param: { name: 'lmx_online', type: 'trigger', default: true },
                field: { name: 'Оформлення екрана «Онлайн»', description: 'Шапка з кнопками «Продовжити» і «Наступна», серії широкими картками, чіпи озвучок. Для всіх джерел. Якщо екран джерела виглядає зламаним — вимкніть' },
                onChange: function () { setTimeout(function () { document.body.classList.toggle('lmx-online', isOn()); }, 50); }
            });
            safe(hookFilter);
            safe(hookSelect);
            safe(hookRequest);
            safe(hookReplace);
            safe(hookComponent);
            safe(hookController);
            safe(hookScroll);
            safe(hookPlayerMarks);
            safe(dropBackHook);
            safe(downRescue);
            safe(upRescue);
            safe(viewGuard);
            safe(trackPlay);
            setInterval(function () { if (!document.hidden) safe(loadWatchdog); }, 3000);
            safe(watchInsert);
            setInterval(function () { if (!document.hidden) safe(uakAdapt); }, 600);
            // після закриття будь-якого меню (власного чи рідного) повертаємо фокус на екран «Онлайн»
            try { Lampa.Select.listener.follow('hide', function () { var a = document.querySelector('.activity--active'); if (a && a.querySelector('.explorer.lmx-onl')) resync(a, true); }); } catch (e) {}
            applyView(curView());
            if (S2 && S2.addParam) S2.addParam({
                component: 'lmx_watch', param: { name: 'lmx_online_auto', type: 'trigger', default: true },
                field: { name: 'Автоперемикання джерел', description: 'Відкриває джерело, що спрацювало раніше; якщо воно порожнє — пробує наступне (до 6 спроб) і запам\'ятовує результат' }
            });
            if (S2 && S2.addParam) S2.addParam({
                component: 'lmx_watch', param: { name: 'lmx_online_vauto', type: 'select', values: { on: 'Увімкнено', off: 'Вимкнено' }, default: 'on' },
                field: { name: 'Авто-вибір української озвучки', description: 'Поки йде завантаження, обирає українську озвучку (або ту, яку ви вже обирали для цього серіалу) — екран не перезавантажується на очах. Якщо з нею серій немає, повертає попередню' }
            });
            if (S2 && S2.addParam) S2.addParam({
                component: 'lmx_watch', param: { name: 'lmx_online_q', type: 'select', values: QPREF, default: 'auto' },
                field: { name: 'Бажана якість джерела', description: 'Підбір шукатиме джерело з такою якістю або кращою; якщо такого немає — візьме найкраще з наявних' }
            });
            if (S2 && S2.addParam) S2.addParam({
                component: 'lmx_watch', param: { name: 'lmx_online_prefetch', type: 'trigger', default: true },
                field: { name: 'Підвантажувати наступну серію', description: 'Під час перегляду один раз «будить» посилання наступної серії, щоб перемикання в плеєрі було швидшим' }
            });
            if (S2 && S2.addParam) S2.addParam({
                component: 'lmx_watch', param: { name: 'lmx_watch_health', type: 'button' },
                field: { name: 'Здоров\u2019я джерел', description: 'Які джерела відповідають швидко й стабільно, а які часто підводять — за вашим досвідом. Тут же можна скинути статистику' },
                onChange: function () { safe(showHealth); }
            });
            if (S2 && S2.addParam) S2.addParam({
                component: 'lmx_watch', param: { name: 'lmx_watch_ver', type: 'title', default: '' },
                field: { name: 'LMX Watch · версія ' + VERSION }
            });
            // Логотип назви вантажимо наперед, ще на картці фільму: на «Онлайн» він уже в кеші й з'являється одразу, без підміни тексту
            Lampa.Listener.follow('full', function (e) {
                safe(function () {
                    var m = e && e.type === 'complite' && e.data && e.data.movie; if (!m || !m.id) return;
                    var kind = (m.name || m.first_air_date || m.number_of_seasons) ? 'tv' : 'movie', key = kind + m.id;
                    if (key in logoCache || !(Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb)) return;
                    Lampa.Api.sources.tmdb.get(kind + '/' + m.id + '/images?include_image_language=uk%2Cen%2Cnull', {}, function (j) {
                        logoCache[key] = pickLogo(j && j.logos); capKeys(logoCache, 80);
                        if (logoCache[key]) { var pi = new Image(); pi.src = img(logoCache[key], 'w500'); }
                    }, function () {});
                });
            });
            Lampa.Listener.follow('activity', function (e) {
                if (!e || e.type !== 'start') return;
                obsTarget = null; actT0 = Date.now();
                [30, 150, 400, 800, 1500, 3000, 5000].forEach(function (ms) { setTimeout(function () { if (!document.querySelector('.activity--active .explorer__files-body')) return; safe(arm); safe(buildHero); }, ms); });
                // страховка від «чорного екрана»: якщо наша шапка так і не з'явилась (інша розмітка, помилка), знімаємо режим завантаження — рідний інтерфейс Lampa знову видно
                [4500, 9000, 15000].forEach(function (ms) {
                    setTimeout(function () {
                        safe(function () {
                            var a = document.querySelector('.activity--active');
                            if (!a || !a.classList.contains('lmx-onl-load')) return;
                            var hh = a.querySelector('.lmx-onl-hero'), rr = hh && hh.getBoundingClientRect();
                            if (!hh || !rr || rr.height < 20) { a.classList.remove('lmx-onl-load'); a.classList.remove('lmx-onl-rl'); }
                        });
                    }, ms);
                });
            });
        });
    }
    safe(hookFilter);
    safe(hookSelect);
    safe(hookRequest);
    safe(hookReplace);
    safe(hookComponent);
    safe(hookController);
    safe(hookScroll);
    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
})();
