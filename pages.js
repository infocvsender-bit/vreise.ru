"use strict";
/* Страницы сайта (HTML на сервере). Только русский язык. */
const C = require("./catalog.js");
const {esc, siteUrl, phone, WA, TGL, rub} = require("./mails.js");
const V = (String(process.env.RAILWAY_GIT_COMMIT_SHA || "").slice(0, 8)) || String(Date.now());
const env = k => String(process.env[k] || "").trim();

const POSITIONS = ["Master", "Chief Officer", "Second Officer", "Third Officer", "DPO", "SDPO", "Chief Engineer", "Second Engineer", "Third Engineer", "Fourth Engineer", "ETO", "Electrician",
    "Bosun", "AB", "OS", "Crane Operator", "Deck Cadet", "Engine Cadet", "Motorman", "Fitter", "Welder", "Wiper", "Oiler", "Cook", "Steward", "Messman", "Medic"];
const VESSELS = ["Офшорные суда", "Контейнеровозы", "Танкеры (нефть, продукты, химия)", "Газовозы (LPG / LNG)", "Балкеры", "Генеральные грузы", "Ро-ро / паромы", "Пассажирские суда", "Яхты", "Любые суда"];

function shell({title, desc, body, path = "/", hero = "", noindex = false, scripts = ""}){
    const url = siteUrl() + path, img = siteUrl() + "/static/ship.jpg";
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${esc(url)}">`}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta property="og:locale" content="ru_RU">
<link rel="icon" type="image/png" href="/static/favicon.png"><link rel="apple-touch-icon" href="/static/icon-192.png"><meta name="theme-color" content="#0A3340">
<link rel="stylesheet" href="/static/style.css?v=${V}"></head><body>
${hero}${body}
<footer class="f"><div class="c"><span>© Vreise.ru${env("LEGAL_NAME") ? " · " + esc(env("LEGAL_NAME")) : ""}</span><span><a href="/policy">Политика конфиденциальности</a><a href="/offer">Публичная оферта</a></span></div></footer>
${scripts}</body></html>`;
}

const logo = `<a class="brand" href="/"><img src="/static/logo.svg" alt="" width="44" height="44"><span>Vreise<i>.ru</i></span></a>`;
const navTop = (full = true) => `<nav class="top">${logo}<span class="sp"></span>${full ? `<a class="l" href="/#services">Услуги</a><a class="l" href="/#how">Как это работает</a><a class="l" href="/#pay">Оплата</a><a class="l" href="/#contacts">Контакты</a>` : ""}<a class="btn gold sm" href="/order">Заказать рассылку</a></nav>`;

/* ---------- главная ---------- */
const plAddr = n => { const a = n % 10, b = n % 100; return (a === 1 && b !== 11) ? "адрес" : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? "адреса" : "адресов"; };
const numFmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
const addrCount = n => n > 0 ? `${numFmt(n)}\u00a0${plAddr(n)}` : "";
function home(counts){
    const n = counts && counts.byBase || {};
    const rows = C.BASES.map((b, i) => `<li class="pc a${i % 4}" data-p="${b.prices.map((_, k) => C.priceOf(b, k + 1)).join(",")}" data-b="${b.key}">
      <h4>${esc(b.name)}</h4><p class="pc-note">${esc(b.note)}</p>
      ${n[b.key] > 0 ? `<div class="pc-cnt"><b>${numFmt(n[b.key])}</b><span>${plAddr(n[b.key])} в базе</span></div>` : `<div class="pc-cnt"></div>`}
      <div class="pc-foot"><div class="pc-price" data-price>${rub(C.priceOf(b, 1))}</div><a class="btn gold" data-order href="/order?s=${C.SERVICES.find(s => s.base === b.key && s.times === 1).slug}">Заказать</a><a class="btn ghost" href="#included">Что входит в заказ</a></div></li>`).join("");
    const hero = `<header class="hero">${navTop()}<div class="wrap"><div>
<div class="pill"><b></b>Онлайн-сервис для моряков</div>
<h1>Ваше резюме — <span>сразу в крюинговые компании</span></h1>
<p class="lead">Выберите базу, загрузите резюме — мы разошлём его в нужные компании и пришлём отчёт о рассылке. Сопроводительное письмо входит в услугу, а резюме «Стандарт» составим с нуля.</p>
<div class="cta"><a class="btn gold" href="#services">Выбрать рассылку</a><a class="btn line" href="/order?s=${C.CV.slug}">Составить резюме · ${rub(C.cvPrice())}</a></div>
<div class="facts"><div><b>${C.BASES.length} баз</b>Россия · Европа<br>Офшор · Мир</div><div><b>Статистика</b>и статус в личном<br>кабинете</div><div><b>от ${rub(Math.min(...C.BASES.map(b => C.priceOf(b, 1))))}</b>оплата картой<br>в рублях</div></div>
</div><div class="photo"><img src="/static/ship.jpg" alt="Контейнеровоз в море" width="1656" height="740">
<div class="glass g1"><span class="ic">✉️</span><div><b>Рассылка резюме</b>крюинговым компаниям и судовладельцам по всему миру</div></div>
<div class="glass g2"><span class="chip on">Россия</span><span class="chip">Европа</span><span class="chip">Офшор</span><span class="chip">Мир</span></div></div></div></header>`;
    const body = `<section class="sec" id="services"><div class="c">
<div class="kick">Услуги</div><h2>Рассылка резюме по базам</h2>
<p class="sub">Выберите базу и количество рассылок. Письма уходят с отдельного почтового ящика на ваше имя, а ответы компаний приходят прямо вам на почту.</p>
<div class="board" id="board"><div class="board-head"><h3>Выберите базу и количество рассылок</h3>
<div class="seg" role="group" aria-label="Количество рассылок"><button type="button" data-n="1" class="on">1 рассылка</button><button type="button" data-n="2">2 рассылки</button><button type="button" data-n="3">3 рассылки</button></div></div>
<ul class="pcs">${rows}</ul></div>
<div class="included" id="included"><h3>Что входит в заказ</h3><ul>
<li>Рассылка вашего резюме по выбранной базе компаний</li><li>Сопроводительное письмо — своё или готовое</li><li>Личный кабинет: ход рассылки и отправленные письма</li><li>Тему и письмо можно поменять в любой момент</li><li>Возможность заменить резюме</li><li>Можно исключить ненужные компании</li><li>Ответы компаний — в кабинете и на вашу почту</li><li>Вопросы менеджеру — прямо из кабинета</li></ul></div>
<div class="strip"><div><h3>Составление резюме «Стандарт»</h3><ul>${C.CV.bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul></div>
<div class="pr"><b>${rub(C.cvPrice())}</b><a class="btn gold" href="/order?s=${C.CV.slug}">Заказать резюме</a></div></div>
</div></section>
<section class="sec alt" id="how"><div class="c"><div class="kick">Как это работает</div><h2>Четыре шага до рассылки</h2><p class="sub">Никакой регистрации и паролей — всё по ссылке из письма.</p>
<ol class="steps"><li><b>Выберите базу</b><span>Россия, Европа, Офшор, Мир или сочетание — и число рассылок.</span></li>
<li><b>Загрузите резюме</b><span>Укажите должность и типы судов, при желании — своё письмо и компании-исключения. Письмо всегда можно проверить в кабинете.</span></li>
<li><b>Оплатите картой</b><span>Переводом на карту в рублях. Мы проверяем платёж и подтверждаем заказ.</span></li>
<li><b>Получите отчёт</b><span>На странице заказа видно, куда ушли письма. Ответы приходят вам на почту.</span></li></ol></div></section>
<section class="sec" id="pay"><div class="c"><div class="pay"><div><div class="kick">Оплата</div><h2>Картой, в рублях</h2>
<p class="sub" style="margin-bottom:0">После оформления заказа вы увидите сумму и реквизиты карты для перевода. Платёж проверяем вручную и сразу запускаем работу.</p></div>
<div class="note"><p><b>Что входит в стоимость.</b> Рассылка по выбранной базе, сопроводительное письмо, отдельный почтовый ящик на ваше имя на время рассылки и отчёт о каждом отправленном письме.</p>
<p style="margin-top:10px"><b>Повторные рассылки.</b> При заказе двух и трёх рассылок следующая идёт через неделю после предыдущей.</p></div></div></div></section>
<section class="sec alt"><div class="c faq"><div class="kick">Вопросы</div><h2>Коротко о главном</h2><div style="margin-top:20px">
<details><summary>Куда приходят ответы компаний?</summary><p>На ту почту, которую вы указали в заказе. В письме компании видят ваше имя, а ответ уходит прямо вам.</p></details>
<details><summary>Можно ли исключить некоторые компании?</summary><p>Да. При оформлении заказа впишите названия компаний или домены — мы не будем им писать.</p></details>
<details><summary>Какое сопроводительное письмо уйдёт?</summary><p>Стандартное письмо уже готово: оно составляется по вашим данным — на русском для российской базы и на английском для остальных. В личном кабинете вы видите его целиком и можете переписать тему и текст как угодно до старта рассылки. Пока вы ничего не меняли, уйдёт стандартное письмо.</p></details>
<details><summary>Что есть в личном кабинете?</summary><p>Страница вашего заказа по личной ссылке, без регистрации и пароля. На ней: оплата и статус заказа; ход каждой рассылки; список компаний, куда уже ушло письмо; тема и сопроводительное письмо, которые можно поправить; для резюме — готовый файл; и чат с менеджером, если что-то непонятно.</p></details>
<details><summary>Как быстро начнётся рассылка?</summary><p>Сразу после подтверждения оплаты. Письма уходят постепенно в течение нескольких часов, чтобы не попасть в спам.</p></details>
<details><summary>Что нужно для резюме «Стандарт»?</summary><p>Заполните форму с вашими данными и приложите документы или старое резюме. Готовое резюме придёт на почту и появится на странице заказа в течение 6 часов после оплаты.</p></details>
</div></div></section>
<section class="sec" id="contacts"><div class="c"><div class="contacts"><div><h2>Остались вопросы?</h2><p>Напишите нам — ответим в WhatsApp или Telegram.</p>${phone() ? `<div class="tel">${esc(phone())}</div>` : ""}</div>
<div class="btns">${WA() ? `<a class="btn gold" href="${WA()}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${TGL() ? `<a class="btn line" href="${TGL()}" target="_blank" rel="noopener">Telegram</a>` : ""}</div></div></div></section>`;
    const scripts = `<script src="/static/site.js?v=${V}" defer></script>`;
    return shell({title: "Vreise.ru — рассылка резюме моряков в крюинговые компании", desc: "Рассылка резюме моряков по базам: Россия, Европа, Офшор, Мир. Резюме «Стандарт» с нуля. Оплата картой в рублях.", hero, body, scripts});
}

/* ---------- форма заказа ---------- */
const ENGLISH = ["Elementary", "Pre-Intermediate", "Intermediate", "Upper-Intermediate", "Advanced"];
const chips = (name, list, max, ph) => `<div class="msel" data-chips="${name}"${max ? ` data-max="${max}"` : ""} data-ph="${esc(ph)}"><button type="button" class="ms-btn">${esc(ph)}</button><div class="ms-pop" hidden>${list.map(x => `<label><input type="checkbox" value="${esc(x)}"><span>${esc(x)}</span></label>`).join("")}</div></div>`;
/* Форма заказа резюме «Стандарт»: те же поля, что нужны для международной анкеты (Application Form) */
function orderFormCv(counts){
    const r = (id, label, extra = "", req = true) => `<label class="f">${label}${req ? ' <i class="rq">*</i>' : ""}<input class="in" id="${id}" ${extra}></label>`;
    const body = `<div class="page"><h1>Заказ резюме «Стандарт»</h1>
<p class="sub">Заполните анкету — мы составим резюме по международному образцу (Application Form). Поля со звёздочкой обязательны.</p>
<form id="f" novalidate><div class="err" id="err" hidden></div>
<input type="hidden" id="slug" value="${C.CV.slug}" data-price="${C.cvPrice()}">
<div class="panel"><h3>Услуга</h3><p class="hint" style="margin-top:0">${esc(C.CV.title)} · <b>${rub(C.cvPrice())}</b></p></div>
<div class="panel"><h3>👤 Основные данные</h3><div class="grid2">
${r("first", "Имя (на английском)", 'autocomplete="given-name" placeholder="Ivan" lang="en"')}
${r("last", "Фамилия (на английском)", 'autocomplete="family-name" placeholder="Petrov" lang="en"')}
<label class="f">E-mail <i class="rq">*</i><small> — сюда придут письма и готовое резюме</small><input class="in" id="email" type="email" autocomplete="email"></label>
${r("phone", "Телефон", 'type="tel" autocomplete="tel" placeholder="+7 900 000 00 00"')}
</div>
<div class="fld"><div class="lbl">Должность <i class="rq">*</i> <small>— до 3-х</small></div><input type="hidden" id="position">${chips("position", POSITIONS.concat(["Другая"]), 3, "Выберите должность")}
<input class="in" id="positionOther" placeholder="Укажите вашу должность" hidden></div>
<div class="fld"><div class="lbl">Предпочитаемый вид судов <i class="rq">*</i> <small>— до 5 типов</small></div><input type="hidden" id="vessel">${chips("vessel", VESSELS, 5, "Выберите типы судов")}</div>
<div class="grid2" style="margin-top:16px">
<label class="f">Ссылка на LinkedIn<input class="in" id="linkedin" placeholder="https://linkedin.com/in/…"></label>
<div class="fld" style="margin:0"><div class="lbl">Мессенджеры на этом номере <i class="rq">*</i></div><div class="chips" id="msgs"><label><input type="checkbox" name="msg" value="WhatsApp"><span>WhatsApp</span></label><label><input type="checkbox" name="msg" value="Telegram"><span>Telegram</span></label><label><input type="checkbox" name="msg" value="Viber"><span>Viber</span></label></div></div>
${r("location", "Ваше местонахождение", 'placeholder="Город, страна"')}
${r("dob", "Дата рождения", 'type="date"')}</div></div>
<div class="panel"><h3>⚓ Профессиональные данные</h3><div class="grid2">
<label class="f">Уровень английского <i class="rq">*</i><select class="in" id="english"><option value="">Выберите уровень</option>${ENGLISH.map(x => `<option>${x}</option>`).join("")}</select></label>
<label class="f">Минимальная зарплата (USD)<input class="in" id="minSalary" inputmode="numeric" placeholder="например, 6500"></label></div>
<div style="margin-top:16px">${r("school", "Учебное заведение", 'placeholder="Название, город, годы обучения"')}</div>
<div style="margin-top:16px">${r("vesselExp", "На каких судах у вас есть опыт", 'placeholder="например, PSV, AHTS, Bulk Carrier"')}</div>
<div style="margin-top:16px">${r("engines", "Опыт с двигателями (для механиков)", 'placeholder="MAN B&amp;W, Wärtsilä, Caterpillar…"', false)}</div></div>
<div class="panel"><h3>📏 Физические параметры</h3><div class="grid5">
${r("eyes", "Цвет глаз")}${r("height", "Рост (см)", 'inputmode="numeric"')}${r("weight", "Вес (кг)", 'inputmode="numeric"')}${r("overall", "Размер робы", 'placeholder="L, 52…"')}${r("shoe", "Размер обуви", 'inputmode="numeric"')}</div></div>
<div class="panel"><h3>👨‍👩‍👧 Ближайший родственник</h3><div class="grid3">
${r("nokName", "Имя Фамилия")}${r("nokRel", "Кем приходится", 'placeholder="жена, мать…"')}${r("nokPhone", "Телефон родственника", 'type="tel" placeholder="+7 …"')}</div></div>
<div class="panel"><h3>📎 Документы</h3>
<label class="f">Старое резюме, паспорт моряка, дипломы, сертификаты<small> — по желанию: можно выбрать сразу несколько файлов (PDF, Word, Excel, JPG, PNG…), до 15 МБ каждый, не больше 25 файлов</small>
<input class="in" type="file" id="docs" multiple accept=".pdf,.doc,.docx,.rtf,.odt,.xls,.xlsx,.ods,.txt,.jpg,.jpeg,.png,.webp"></label>
<div id="docList" class="doclist"></div>
<p class="hint">Можно оформить заказ и без файлов — резюме составим по анкете, а документы пришлёте менеджеру позже.</p>
<div style="margin-top:16px"><label class="f">Дополнительно<small> — по желанию: опыт, пожелания к резюме</small><textarea class="in" id="comment" style="min-height:110px"></textarea></label></div></div>
<div class="panel addon"><h3>➕ Добавить рассылку резюме <span class="badge">−${C.discPct()}%</span></h3>
<p class="hint" style="margin-top:0">Разошлём готовое резюме в крюинговые компании со скидкой ${C.discPct()}%. Рассылка стартует сама, как только резюме будет готово и вы подтвердите e-mail.</p>
<label class="f">База и количество рассылок<select class="in" id="addBase"><option value="" data-p="0">Не нужна</option>${C.BASES.map(b => `<optgroup label="${esc(b.name)}${(counts && counts.byBase && counts.byBase[b.key] > 0) ? " · " + addrCount(counts.byBase[b.key]) : ""}">${[1, 2, 3].map(n => `<option value="${b.key}:${n}" data-p="${C.addonPrice(C.priceOf(b, n))}">${C.TIMES[n - 1]} — ${numFmt(C.priceOf(b, n))} ₽ → ${numFmt(C.addonPrice(C.priceOf(b, n)))} ₽</option>`).join("")}</optgroup>`).join("")}</select></label>
<div id="addMore" hidden style="margin-top:14px"><label class="f">Исключить компании<small> — по желанию: названия или домены, по одному в строке</small><textarea class="in" id="exclude" style="min-height:80px"></textarea></label></div></div>
<div class="panel"><label class="check"><input type="checkbox" id="agree" required><span>Я принимаю условия <a href="/offer" target="_blank">публичной оферты</a> и согласен(на) на обработку персональных данных согласно <a href="/policy" target="_blank">политике конфиденциальности</a>.</span></label></div>
<input type="text" id="hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<div class="sum"><div>К оплате<br><b id="total">${rub(C.cvPrice())}</b></div><button class="btn gold" id="go" type="submit">Оформить заказ</button></div></form></div>`;
    return shell({title: "Заказ резюме «Стандарт» — Vreise.ru", desc: "Оформление заказа на Vreise.ru", path: "/order", noindex: true,
        hero: `<header class="hero short">${navTop(false)}</header>`, body, scripts: `<script src="/static/order.js?v=${V}" defer></script>`});
}

function orderForm(slug, counts){
    if(slug === C.CV.slug) return orderFormCv(counts);
    const sv = C.bySlug(slug) || C.SERVICES.find(s => s.base === "rossiya" && s.times === 1), cv = sv.kind === "cv";
    const cnt = counts && counts.byBase || {};
    const opts = C.BASES.map(b => `<optgroup label="${esc(b.name)}${cnt[b.key] > 0 ? " · " + addrCount(cnt[b.key]) : ""}">${[1, 2, 3].map(n => `<option value="${C.SERVICES.find(s => s.base === b.key && s.times === n).slug}" data-name="${esc(b.name)}" data-price="${C.priceOf(b, n)}"${sv.base === b.key && sv.times === n ? " selected" : ""}>${esc(b.name)} — ${n === 1 ? "1 рассылка" : n + " рассылки"} · ${rub(C.priceOf(b, n))}</option>`).join("")}</optgroup>`).join("");
    const pick = cv ? `<input type="hidden" id="slug" value="${C.CV.slug}" data-price="${C.cvPrice()}">` :
        `<label class="f">База и количество рассылок<select class="in" id="slug">${opts}</select></label>`;
    const extraPanel = cv ? "" : `<div class="panel addon"><h3>➕ Добавить ещё одну базу <span class="badge">−${C.extraDiscPct()}%</span></h3>
<p class="hint" style="margin-top:0">Любую базу можно добавить в те же рассылки на ${C.extraDiscPct()}% дешевле — например, к базе «Россия» добавить «Танкеры и газовозы». Адреса не повторяются.</p>
<label class="f">Дополнительная база<select class="in" id="extra"><option value="">Не нужна</option>${C.BASES.map(b => `<option value="${b.key}" data-p="${[1, 2, 3].map(n => C.extraPrice(C.priceOf(b, n))).join(",")}">${esc(b.name)}${cnt[b.key] > 0 ? " · " + addrCount(cnt[b.key]) : ""}</option>`).join("")}</select></label></div>`;
    const body = `<div class="page"><h1>${cv ? "Заказ резюме «Стандарт»" : `Оформление заказа на базу <span id="ttl">«${esc(C.baseOf(sv.base).name)}»</span>`}</h1>
<p class="sub">${cv ? "Заполните данные — мы подготовим резюме по международному образцу." : "Заполните форму и загрузите резюме. Оплата — на следующем шаге."}</p>
<form id="f" novalidate><div class="err" id="err" hidden></div>
<div class="panel"><h3>${cv ? "Услуга" : "Что отправляем"}</h3>${pick}${cv ? `<p class="hint" style="margin-top:0">${esc(C.CV.title)} · <b>${rub(C.cvPrice())}</b></p>` : ""}</div>
${extraPanel}
<div class="panel"><h3>О вас</h3><div class="grid2">
<label class="f">Имя<input class="in" id="first" autocomplete="given-name" required></label>
<label class="f">Фамилия<input class="in" id="last" autocomplete="family-name" required></label>
<label class="f">E-mail<small> — сюда придут письма и ответы компаний</small><input class="in" id="email" type="email" autocomplete="email" required></label>
<label class="f">Телефон / WhatsApp<input class="in" id="phone" type="tel" autocomplete="tel" placeholder="+7 …"></label>
</div>
<div class="fld"><div class="lbl">Должность <small>— до 3-х</small></div><input type="hidden" id="position">${chips("position", POSITIONS.concat(["Другая"]), 3, "Выберите должность")}
<input class="in" id="positionOther" placeholder="Укажите вашу должность" hidden></div>
<div class="fld"><div class="lbl">Предпочитаемый вид судов <small>— до 5 типов</small></div><input type="hidden" id="vessel">${chips("vessel", VESSELS, 5, "Выберите типы судов")}</div></div>
${cv ? `<div class="panel"><h3>Данные для резюме</h3>
<label class="f">Расскажите о себе и опыте<small> — должности, суда, даты контрактов, образование, сертификаты, языки</small><textarea class="in" id="comment" style="min-height:190px"></textarea></label>
<div style="margin-top:16px"><label class="f">Старое резюме или документы<small> — по желанию, PDF / Word / фото, до 5 МБ</small><input class="in" type="file" id="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"></label></div></div>` :
`<div class="panel"><h3>Резюме и письмо</h3>
<label class="f">Ваше резюме<small> — PDF или Word, до 5 МБ</small><input class="in" type="file" id="file" accept=".pdf,.doc,.docx" required></label>
<div style="margin-top:16px"><label class="f">Сопроводительное письмо<small> — по желанию</small><textarea class="in" id="letter" placeholder="Если оставить пустым, отправим стандартное письмо"></textarea></label></div>
<div style="margin-top:16px"><label class="f">Исключить компании<small> — по желанию: названия или домены, по одному в строке</small><textarea class="in" id="exclude" style="min-height:80px"></textarea></label></div></div>`}
<div class="panel"><label class="check"><input type="checkbox" id="agree" required><span>Я принимаю условия <a href="/offer" target="_blank">публичной оферты</a> и согласен(на) на обработку персональных данных согласно <a href="/policy" target="_blank">политике конфиденциальности</a>.</span></label></div>
<input type="text" id="hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<div class="sum"><div>К оплате<br><b id="total">${rub(cv ? C.cvPrice() : sv.price)}</b></div><button class="btn gold" id="go" type="submit">Оформить заказ</button></div></form></div>`;
    return shell({title: (cv ? "Заказ резюме «Стандарт»" : "Заказ рассылки") + " — Vreise.ru", desc: "Оформление заказа на Vreise.ru", path: "/order", noindex: true,
        hero: `<header class="hero short">${navTop(false)}</header>`, body, scripts: `<script src="/static/order.js?v=${V}" defer></script>`});
}

/* ---------- страница заказа ---------- */
const STATUS = {new: "Ожидает оплаты", claimed: "Проверяем оплату", paid: "Оплачен", in_progress: "В работе", done: "Выполнен", cancelled: "Отменён"};
const fmtCard = c => String(c).replace(/\s+/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
function orderPage(o, jobs, sent, msgs = [], std = null, replies = []){
    const cv = o.kind === "cv", mail = !!o.base, pay = o.status === "new" || o.status === "claimed";
    const card = env("PAY_CARD");
    const payBlock = pay ? `<div class="panel"><h3>Оплата картой в рублях</h3>
${o.status === "claimed" ? `<div class="ok">Спасибо! Мы проверяем ваш платёж — как только увидим перевод, заказ будет подтверждён, и вы получите письмо.</div>` : ""}
<p>Сумма к оплате: <b style="font-size:22px">${rub(o.price)}</b></p>
${card ? `<p style="margin-top:12px">Переведите на карту${env("PAY_BANK") ? " " + esc(env("PAY_BANK")) : ""}:</p><div><span class="card-num" id="card">${esc(fmtCard(card))}</span><button class="copy" type="button" data-copy="${esc(card.replace(/\s+/g, ""))}">Скопировать</button></div>${env("PAY_HOLDER") ? `<p class="hint">Получатель: ${esc(env("PAY_HOLDER"))}</p>` : ""}`
 : `<div class="err">Реквизиты для оплаты пока не заданы. Напишите нам в WhatsApp или Telegram${phone() ? ": " + esc(phone()) : ""}.</div>`}
<p class="hint" style="margin-top:14px">В комментарии к платежу, если есть такая возможность, укажите номер заказа <b>№${o.num}</b>. Переводите точную сумму.</p>
${o.status === "new" ? `<div style="margin-top:18px"><button class="btn gold" id="claim" type="button">Я оплатил(а)</button></div>` : ""}</div>` : "";
    const progress = mail && jobs.length ? `<div class="panel"><h3>Рассылка</h3>${jobs.map(j => {
        const pct = j.total ? Math.round((Number(j.sent) + Number(j.failed)) / j.total * 100) : 0;
        const st = {wait: "ожидает запуска", run: "идёт", pause: "на паузе", done: "завершена", stop: "остановлена"}[j.status] || j.status;
        return `<div style="margin-bottom:14px"><b>Рассылка №${j.m}</b> — ${st}${j.status === "wait" ? ` (старт ${new Date(j.start_at).toLocaleDateString("ru-RU")})` : ""}<div class="bar"><i style="width:${pct}%"></i></div>
<span class="hint">Отправлено ${j.sent} из ${j.total || "—"}${Number(j.failed) ? `, не доставлено ${j.failed}` : ""}</span></div>`; }).join("")}</div>` : "";
    const list = mail && sent.length ? `<div class="panel nosel"><h3>Куда отправлено</h3><table class="t"><thead><tr><th>Компания</th><th>E-mail</th><th>Когда</th></tr></thead><tbody>${sent.map(r =>
        `<tr><td>${esc(r.company || "—")}</td><td>${esc(r.email)}</td><td>${esc(new Date(r.sent_at).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}))}</td></tr>`).join("")}</tbody></table>
<p class="hint">Показаны последние отправленные письма. Названия и адреса компаний частично скрыты — это защита базы.</p></div>` : "";
    const repl = mail && (replies.length || jobs.length) ? `<div class="panel"><h3>Ответы компаний${replies.length ? ` · ${replies.length}` : ""}</h3>${replies.length ? replies.map(r => `<div class="rpl"><div class="h nosel"><b>${esc(r.from_name || r.from_email)}</b>${r.from_name ? ` · ${esc(r.from_email)}` : ""} · ${esc(new Date(r.at).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}))}${r.kind === "auto" ? " · автоответ" : ""}</div><div style="font-weight:700;margin-top:4px">${esc(r.subject || "(без темы)")}</div><div class="b">${esc(r.text || "")}</div></div>`).join("") : `<p class="hint" style="margin:0">Пока ответов нет. Компании отвечают не сразу — как только придёт письмо, оно появится здесь, и мы сообщим на почту.</p>`}<p class="hint" style="margin-top:12px">Отвечать компаниям лучше со своей личной почты — на адрес, с которого вам написали. Ящик рассылки работает ещё сутки после окончания рассылки.</p></div>` : "";
    const res = cv && o.res_name ? `<div class="panel"><h3>Ваше резюме готово</h3><p><a class="btn gold" href="/o/${o.token}/file">Скачать: ${esc(o.res_name)}</a></p></div>` : "";
    const wait = cv && ["paid", "in_progress"].includes(o.status) && !o.res_name ? `<div class="ok">Оплата получена. Готовим ваше резюме — оно придёт на почту и появится здесь в течение 6 часов.</div>` : "";
    const emailBanner = !o.email_ok && o.status !== "cancelled" ? `<div class="err" style="background:#fff7dc;color:#6b4e00;border-color:#f0d78a;margin-bottom:18px">✉️ <b>Подтвердите e-mail.</b> Мы отправили письмо на <b>${esc(o.email)}</b> — нажмите в нём кнопку. ${cv ? "" : "Без подтверждения рассылка не начнётся. "}Письма нет? Проверьте «Спам» или <button class="btn gold sm" id="resend" type="button" style="margin:0 6px">отправьте ещё раз</button><span class="hint" id="rsmsg"></span></div>` : "";
    const running = jobs.some(j => j.status === "run");
    const resumeBlock = o.kind === "mailing" && o.status !== "cancelled" ? `<div class="panel"><h3>Ваше резюме</h3>
<p class="hint" style="margin:0 0 12px">Сейчас компаниям уходит файл <b>${esc(o.cv_name || "резюме")}</b>. Можно заменить его в любой момент${running ? " — новый файл будет приложен к письмам, которые ещё не отправлены" : ""}.</p>
<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><input class="in" type="file" id="rsfile" accept=".pdf,.doc,.docx" style="max-width:360px"><button class="btn gold sm" id="rsgo" type="button">Заменить резюме</button><span class="hint" id="rsmsg2"></span></div>
<p class="hint" style="margin:10px 0 0">PDF или Word, до 5 МБ.</p></div>` : "";
    const letterBlock = std && o.status !== "cancelled" ? `<div class="panel"><h3>Тема и сопроводительное письмо</h3>
<p class="hint" style="margin:0 0 14px">✉️ ${jobs.length ? "Мы отправили" : "Как только всё будет готово, мы отправим"} вам на почту <b>${esc(o.email)}</b> письмо — так ваша рассылка будет выглядеть для работодателей. ${o.letter || o.subject ? "Здесь ваш вариант письма." : "Сейчас стоит стандартное письмо, составленное по вашим данным."} Резюме прикладывается автоматически. <b>Если хотите что-то поменять — сделайте это здесь:</b> новый вариант применится ко всем ещё не отправленным письмам${running ? " (уже отправленные не изменятся)" : ""}.</p>
<form id="lf"><label class="f">Тема письма<input class="in" id="lsub" maxlength="200" value="${esc(std.cur.subject)}"></label>
<div style="margin-top:14px"><label class="f">Текст письма<textarea class="in" id="ltxt" maxlength="4000" style="min-height:230px">${esc(std.cur.text)}</textarea></label></div>
<div style="margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn gold sm" id="lsave" type="submit">Сохранить</button><button class="btn line sm" id="lreset" type="button" style="color:var(--deep);border-color:#9fb6bb">Вернуть стандартное</button><span class="hint" id="lmsg"></span></div></form>
<script type="application/json" id="lstd">${JSON.stringify({subject: std.def.subject, text: std.def.text}).replace(/</g, "\\u003c")}</script></div>` : "";
    const chat = `<div class="faq" style="margin-bottom:22px"><details${msgs.length ? " open" : ""} style="border:1px solid var(--line);border-radius:16px;padding:16px 20px;background:#fff"><summary>💬 Что-то непонятно? Напишите менеджеру</summary>
${msgs.map(m => `<div style="margin-top:14px;padding:10px 14px;border-radius:12px;background:${m.author === "Ответ менеджера" ? "#e9f6f3" : "#f3f6f7"}"><span class="hint">${m.author === "Ответ менеджера" ? "Менеджер" : "Вы"} · ${esc(new Date(m.at).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}))}</span><div style="color:var(--ink);white-space:pre-wrap">${esc(m.text)}</div></div>`).join("")}
<form id="msgf" style="margin-top:14px"><textarea class="in" id="msgt" maxlength="1500" placeholder="Ваш вопрос. Ответ придёт на ${esc(o.email)} и появится здесь." style="min-height:90px"></textarea>
<div style="margin-top:10px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn gold sm" id="msgb" type="submit">Отправить</button><span class="hint" id="msgs"></span></div></form></details></div>`;
    const body = `<div class="page"><h1>Заказ №${o.num}</h1><p class="sub">${esc(o.title)} · <span class="tag ${o.status}">${STATUS[o.status] || o.status}</span></p>
${emailBanner}${payBlock}${wait}${res}${progress}${repl}${list}${letterBlock}${resumeBlock}${chat}
<div class="panel"><h3>Данные заказа</h3><table class="t"><tbody>
<tr><td>Клиент</td><td>${esc([o.first_name, o.last_name].filter(Boolean).join(" "))}</td></tr><tr><td>E-mail</td><td>${esc(o.email)}</td></tr>
${o.phone ? `<tr><td>Телефон</td><td>${esc(o.phone)}</td></tr>` : ""}${o.position ? `<tr><td>Должность</td><td>${esc(o.position)}</td></tr>` : ""}
<tr><td>Сумма</td><td>${rub(o.price)}</td></tr><tr><td>Оформлен</td><td>${esc(new Date(o.created_at).toLocaleString("ru-RU"))}</td></tr></tbody></table>
<p class="hint" style="margin-top:12px">Сохраните эту ссылку — по ней всегда можно посмотреть состояние заказа.${phone() ? ` Вопросы — WhatsApp / Telegram ${esc(phone())}.` : ""}</p></div></div>`;
    const live = ["claimed", "paid", "in_progress"].includes(o.status) ? `<script>setInterval(function(){var a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;if(document.querySelector("textarea[data-dirty]"))return;location.reload()},45000);document.addEventListener("input",function(e){if(e.target&&e.target.tagName==="TEXTAREA")e.target.setAttribute("data-dirty","1")})</script>` : "";
    return shell({title: `Заказ №${o.num} — Vreise.ru`, desc: "Страница заказа", path: "/o/" + o.token, noindex: true, hero: `<header class="hero short">${navTop(false)}</header>`, body,
        scripts: `<script>window.__tok=${JSON.stringify(o.token)}</script><script src="/static/order.js?v=${V}" defer></script><script src="/static/noselect.js?v=${V}" defer></script>${live}`});
}

/* ---------- политика и оферта ---------- */
const who = () => env("LEGAL_NAME") || "владелец сайта Vreise.ru (далее — Исполнитель)";
function legal(kind){
    const contact = `${phone() ? `WhatsApp / Telegram: ${esc(phone())}` : "через форму на сайте"}`;
    const policy = `<h1>Политика конфиденциальности</h1>
<p>Настоящая политика описывает, какие данные собирает сайт Vreise.ru и как они используются. Оператор данных — ${esc(who())}${env("LEGAL_INN") ? `, ИНН ${esc(env("LEGAL_INN"))}` : ""}.</p>
<h2>Какие данные мы получаем</h2><ul><li>Имя, фамилия, e-mail, телефон, должность и типы судов — из формы заказа.</li><li>Файлы, которые вы загружаете: резюме, документы, текст письма.</li><li>Технические данные: IP-адрес и сведения о браузере — для защиты сайта от злоупотреблений.</li></ul>
<h2>Для чего используем</h2><ul><li>Для выполнения заказа: рассылка вашего резюме в выбранные компании, составление резюме, связь с вами.</li><li>Для уведомлений о ходе заказа на указанную вами почту.</li></ul>
<p>Ваше резюме и контактные данные передаются только тем компаниям, которым вы заказали рассылку, и только в составе отправляемого письма. Мы не продаём данные и не передаём их третьим лицам для рекламы.</p>
<h2>Сколько храним</h2><p>Данные заказа хранятся столько, сколько нужно для выполнения услуги и разрешения возможных вопросов. По вашей просьбе мы удалим данные заказа — напишите нам: ${contact}.</p>
<h2>Cookies</h2><p>Сайт не использует рекламные и аналитические cookies.</p>
<h2>Контакты</h2><p>По вопросам обработки данных: ${contact}.</p>`;
    const offer = `<h1>Публичная оферта</h1>
<p>Настоящий документ — предложение ${esc(who())} (далее — Исполнитель) любому лицу (далее — Заказчик) заключить договор на оказание услуг на условиях ниже. Оформление заказа на сайте Vreise.ru означает согласие с этой офертой.</p>
<h2>1. Услуги</h2><ul><li><b>Рассылка резюме</b> — отправка резюме Заказчика на адреса электронной почты компаний из выбранной базы с сопроводительным письмом. Количество рассылок (одна, две или три) выбирается при заказе; повторные рассылки проходят с интервалом около недели.</li><li><b>Резюме «Стандарт»</b> — составление резюме по данным, предоставленным Заказчиком; одна бесплатная правка.</li></ul>
<h2>2. Стоимость и оплата</h2><p>Стоимость указана на сайте в рублях. Оплата — переводом на банковскую карту по реквизитам, указанным на странице заказа. Заказ принимается в работу после подтверждения поступления платежа.</p>
<h2>3. Порядок оказания услуг</h2><ul><li>Рассылка начинается после подтверждения оплаты. Письма отправляются постепенно в течение нескольких часов.</li><li>Ход рассылки и список компаний доступны Заказчику на странице заказа.</li><li>Резюме «Стандарт» готовится в течение 6 часов после подтверждения оплаты и направляется на e-mail Заказчика.</li></ul>
<h2>4. Ограничение ответственности</h2><p>Исполнитель обязуется отправить резюме по выбранной базе, но не гарантирует ответ компаний, приглашение на собеседование или трудоустройство: решения принимают работодатели. Исполнитель не отвечает за недоставку писем по причинам на стороне получателя (неактуальный адрес, спам-фильтры, переполненный ящик). Заказчик отвечает за достоверность своих данных и за право распространять предоставленные документы.</p>
<h2>5. Возврат</h2><p>Если услуга не начата, Исполнитель возвращает оплату по обращению Заказчика. После начала рассылки или составления резюме возврат осуществляется по соглашению сторон, если услуга оказана не в полном объёме по вине Исполнителя.</p>
<h2>6. Контакты и реквизиты</h2><p>${esc(who())}${env("LEGAL_INN") ? `, ИНН ${esc(env("LEGAL_INN"))}` : ""}. Связь: ${contact}.</p>`;
    return shell({title: (kind === "policy" ? "Политика конфиденциальности" : "Публичная оферта") + " — Vreise.ru", desc: kind === "policy" ? "Политика конфиденциальности Vreise.ru" : "Публичная оферта Vreise.ru", path: "/" + kind,
        hero: `<header class="hero short">${navTop(false)}</header>`, body: `<div class="legal">${kind === "policy" ? policy : offer}</div>`});
}

const notFound = () => shell({title: "Страница не найдена — Vreise.ru", desc: "", noindex: true, hero: `<header class="hero short">${navTop(false)}</header>`,
    body: `<div class="page"><h1>Страница не найдена</h1><p class="sub">Такой страницы нет. <a href="/">Перейти на главную</a></p></div>`});

module.exports = {home, orderForm, orderPage, legal, notFound, shell};
