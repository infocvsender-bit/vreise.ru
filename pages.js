"use strict";
/* Страницы сайта (HTML на сервере). Только русский язык. */
const C = require("./catalog.js");
const {esc, siteUrl, phone, WA, TGL, rub} = require("./mails.js");
const V = (String(process.env.RAILWAY_GIT_COMMIT_SHA || "").slice(0, 8)) || String(Date.now());
const env = k => String(process.env[k] || "").trim();

const POSITIONS = ["Master", "Chief Officer", "Second Officer", "Third Officer", "DPO", "SDPO", "Chief Engineer", "Second Engineer", "Third Engineer", "Fourth Engineer", "ETO", "Electrician",
    "Bosun", "AB", "OS", "Crane Operator", "Deck Cadet", "Engine Cadet", "Motorman", "Fitter", "Welder", "Wiper", "Oiler", "Cook", "Steward", "Messman", "Medic"];
const SCHED_NOTE = "Время московское. Старт — с 06:00 до 18:00. Рассылка идёт по будням с 06:00 до 18:00 и занимает не менее 10 часов: если она началась, например, в 15:00, то с 15:00 до 18:00 уйдёт часть писем, остальные — на следующий рабочий день с 06:00. В выходные письма не отправляются — всё переносится на понедельник. Дата — не раньше завтрашнего дня.";
const VESSELS = ["Офшорные суда", "Контейнеровозы", "Танкеры (нефть, продукты, химия)", "Газовозы (LPG / LNG)", "Балкеры", "Генеральные грузы", "Ро-ро / паромы", "Пассажирские суда", "Яхты", "Любые суда"];

function shell({title, desc, body, path = "/", hero = "", noindex = false, scripts = ""}){
    const url = siteUrl() + path, img = siteUrl() + "/static/hero.jpg";
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${esc(url)}">`}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta property="og:locale" content="ru_RU">
<link rel="icon" type="image/png" href="/static/favicon.png"><link rel="apple-touch-icon" href="/static/icon-192.png"><meta name="theme-color" content="#0A3340">
<link rel="stylesheet" href="/static/style.css?v=${V}"></head><body>
${hero}${body}
<footer class="f"><div class="c"><span>© Vreise.ru${env("LEGAL_NAME") ? " · " + esc(env("LEGAL_NAME")) : ""}</span><span><a href="/policy">Политика конфиденциальности</a><a href="/offer">Публичная оферта</a></span></div></footer>
<script>window.__vr=${JSON.stringify({wa: WA(), tg: TGL(), phone: phone()}).replace(/</g, "\\u003c")}</script><script src="/static/assistant.js?v=${V}" defer></script>
${scripts}</body></html>`;
}

const logo = `<a class="brand" href="/"><img src="/static/logo.svg" alt="" width="44" height="44"><span>Vreise<i>.ru</i></span></a>`;
const navTop = (full = true) => `<nav class="top">${logo}<span class="sp"></span>${full ? `<a class="l" href="/#services">Услуги</a><a class="l" href="/#how">Как это работает</a><a class="l" href="/#pay">Оплата</a><a class="l" href="/#contacts">Контакты</a>`  : ""}${full ? `<a class="btn gold sm" href="/order">Заказать рассылку</a>` : `<a class="btn gold sm" href="/#services">← Главное меню</a>`}</nav>`;

/* ---------- главная ---------- */
const plAddr = n => { const a = n % 10, b = n % 100; return (a === 1 && b !== 11) ? "адрес" : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? "адреса" : "адресов"; };
const numFmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
const addrCount = n => n > 0 ? `${numFmt(n)}\u00a0${plAddr(n)}` : "";
function home(counts){
    const n = counts && counts.byBase || {};
    const rows = C.BASES.map((b, i) => `<li class="pc a${i % 4}" data-p="${b.prices.map((_, k) => C.priceOf(b, k + 1)).join(",")}" data-b="${b.key}">
      <h4>${esc(b.name)}</h4><p class="pc-note">${esc(b.note)}</p>
      ${n[b.key] > 0 ? `<div class="pc-cnt"><b>${numFmt(n[b.key])}</b><span>Адресов в базе</span></div>` : `<div class="pc-cnt"></div>`}
      <div class="pc-foot"><div class="pc-price" data-price>${rub(C.priceOf(b, 1))}</div><a class="btn gold" data-order href="/order?s=${C.SERVICES.find(s => s.base === b.key && s.times === 1).slug}">Заказать</a><a class="btn ghost" href="#included">Что входит в заказ?</a></div></li>`).join("");
    const hero = `<header class="hero">${navTop()}<div class="wrap"><div>
<div class="pill"><b></b>Онлайн-сервис для моряков</div>
<h1>Ваше резюме — <span>сразу в крюинговые компании</span></h1>
<p class="lead">Выберите базу, загрузите резюме — мы разошлём его в нужные компании и пришлём отчёт о рассылке. Сопроводительное письмо входит в услугу, а резюме «Стандарт» составим с нуля.</p>
<div class="cta"><a class="btn gold" href="#services">Выбрать рассылку</a><a class="btn line" href="#resume">Составить резюме · ${rub(C.cvPrice())}</a></div>
<div class="facts"><div><b>${C.BASES.length} баз</b>Россия · Европа<br>Офшор · Мир</div><div><b>Статистика</b>и статус в личном<br>кабинете</div><div><b>от ${rub(Math.min(...C.BASES.map(b => C.priceOf(b, 1))))}</b>оплата картой<br>в рублях</div></div>
</div><div class="photo"><img src="/static/hero.jpg" alt="Морская платформа и судно снабжения" width="1500" height="1303" fetchpriority="high">
<div class="glass g1"><span class="ic">✉️</span><div><b>Рассылка резюме</b>крюинговым компаниям и судовладельцам по всему миру</div></div>
<div class="glass g2"><span class="chip on">Россия</span><span class="chip">Европа</span><span class="chip">Офшор</span><span class="chip">Мир</span></div></div></div></header>`;
    const body = `<section class="sec" id="services"><div class="c">
<div class="kick">Услуги</div><h2>Рассылка резюме по базам</h2>
<p class="sub">Выберите базу и количество рассылок. Письма уходят от вашего имени, а ответы компаний приходят на вашу почту и в личный кабинет!</p>
<div class="board" id="board"><div class="board-head"><h3>Количество рассылок</h3>
<div class="seg" role="group" aria-label="Количество рассылок"><button type="button" data-n="1" class="on">1 рассылка</button><button type="button" data-n="2">2 рассылки</button><button type="button" data-n="3">3 рассылки</button></div></div>
<ul class="pcs">${rows}</ul></div>
<div class="included" id="included"><h3>Что входит в заказ</h3><ul>
<li>Рассылка вашего резюме по выбранной базе компаний</li><li>Сопроводительное письмо — своё или готовое</li><li>Личный кабинет: ход рассылки и отправленные письма</li><li>Тему и письмо можно поменять в любой момент</li><li>Возможность заменить резюме</li><li>Можно исключить ненужные компании</li><li>Ответы компаний — в кабинете и на вашу почту</li><li>Вопросы менеджеру — прямо из кабинета</li></ul></div>
<div class="strip" id="resume"><div><h3>Составление резюме «Стандарт»</h3><ul>${C.CV.bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul></div>
<a class="rex" href="/static/resume-example.pdf" target="_blank" rel="noopener"><img src="/static/resume-example.jpg" alt="Пример резюме «Стандарт»" width="420" loading="lazy"><span>Пример резюме «Стандарт» — нажмите, чтобы открыть целиком</span></a>
<div class="pr"><b>${rub(C.cvPrice())}</b><a class="btn gold" href="/order?s=${C.CV.slug}">Заказать резюме</a></div></div>
</div></section>
<section class="sec alt" id="how"><div class="c"><div class="kick">Как это работает</div><h2>Четыре шага до рассылки</h2><p class="sub">Никакой регистрации и паролей — всё по ссылке из письма.</p>
<ol class="steps"><li><b>Выберите базу</b><span>Россия, Европа, Офшор, Мир или сочетание — и число рассылок.</span></li>
<li><b>Загрузите резюме</b><span>Укажите должность и типы судов, при желании — своё письмо и компании-исключения. Письмо всегда можно проверить в кабинете.</span></li>
<li><b>Оплатите картой</b><span>Переводом на карту в рублях. Мы проверяем платёж и подтверждаем заказ.</span></li>
<li><b>Получите отчёт</b><span>На странице заказа видно, куда ушли письма. Ответы приходят вам на почту.</span></li></ol></div></section>
<section class="sec" id="pay"><div class="c"><div class="pay"><div><div class="kick">Оплата</div><h2>Картой, в рублях</h2>
<p class="sub" style="margin-bottom:0">После оформления заказа вы увидите сумму и реквизиты карты для перевода. Платёж проверяем вручную и сразу запускаем работу.</p></div>
<div class="note"><p><b>Что входит в стоимость.</b> Рассылка по выбранной базе, сопроводительное письмо, статистика и статус рассылки в личном кабинете.</p>
<p style="margin-top:10px"><b>Даты рассылок.</b> Дату и время старта каждой рассылки вы выбираете при оформлении заказа: не раньше завтрашнего дня, старт с 06:00 до 18:00 по Москве. Письма уходят по будням с 06:00 до 18:00, рассылка занимает не менее 10 часов, в выходные перерыв — продолжение в понедельник.</p></div></div></div></section>
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
const coverModal = () => `<div class="modal" id="coverModal" data-price="${C.coverPrice()}" hidden role="dialog" aria-modal="true" aria-labelledby="cvmT"><div class="mbox">
<div class="mico">💌</div><h3 id="cvmT">Добавить персональное сопроводительное письмо?</h3>
<p>Составим письмо лично под вас: с вашей должностью, опытом и сильными сторонами. Стоимость — <b>${rub(C.coverPrice())}</b>. Итого к оплате будет <b id="coverTotal"></b>.</p>
<p class="hint" id="coverStd">Если нажмёте «Нет», рассылка уйдёт со стандартным письмом — таким, как у большинства заказчиков. Его всегда можно поменять в личном кабинете.</p>
<p class="hint" id="coverOk">Персональное письмо мы пришлём вам на подтверждение — рассылка начнётся после вашего «Подтвердить».</p>
<div class="macts"><button type="button" class="btn gold" id="coverYes">Да, добавить за ${rub(C.coverPrice())}</button><button type="button" class="btn line" id="coverNo">Нет, без письма</button></div>
<button type="button" class="mback" id="coverBack">← Вернуться к форме</button></div></div>`;

function orderFormCv(counts){
    const r = (id, label, extra = "", req = true) => `<label class="f">${label}${req ? ' <i class="rq">*</i>' : ""}<input class="in" id="${id}" ${extra}></label>`;
    const body = `<div class="page"><h1>Заказ резюме «Стандарт»</h1>
<p class="sub">Заполните анкету — мы составим резюме по международному образцу (Application Form). Поля со звёздочкой обязательны.</p>
<form id="f" novalidate><div class="err" id="err" hidden></div>
<input type="hidden" id="slug" value="${C.CV.slug}" data-price="${C.cvPrice()}">
<div class="panel"><h3>Услуга</h3><p class="hint" style="margin-top:0">${esc(C.CV.title)} · <b>${rub(C.cvPrice())}</b></p><p class="hint" style="margin:8px 0 0"><a href="/static/resume-example.pdf" target="_blank" rel="noopener">👁 Посмотреть пример готового резюме</a></p></div>
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
<div id="addMore" hidden style="margin-top:14px"><div class="lbl" style="font-weight:700;color:var(--deep);margin-bottom:8px">📅 Дата и время рассылки</div><div id="sched"></div><p class="hint" style="margin:8px 0 14px">${SCHED_NOTE}</p><label class="f">Исключить компании<small> — по желанию, по одному в строке. Можно указать название компании, но лучше домен — так точнее: например, <b>@marlownavigation.com</b></small><textarea class="in" id="exclude" style="min-height:80px" placeholder="@marlownavigation.com"></textarea></label></div></div>
<div class="panel"><label class="check"><input type="checkbox" id="agree" required><span>Я принимаю условия <a href="/offer" target="_blank">публичной оферты</a> и согласен(на) на обработку персональных данных согласно <a href="/policy" target="_blank">политике конфиденциальности</a>.</span></label></div>
<input type="text" id="hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<div class="sum"><div>К оплате<br><b id="total">${rub(C.cvPrice())}</b></div><button class="btn gold" id="go" type="submit">Оформить заказ</button></div></form></div>${coverModal()}`;
    return shell({title: "Заказ резюме «Стандарт» — Vreise.ru", desc: "Оформление заказа на Vreise.ru", path: "/order", noindex: true,
        hero: `<header class="hero short">${navTop(false)}</header>`, body, scripts: `<script src="/static/order.js?v=${V}" defer></script>`});
}

function orderForm(slug, counts){
    if(slug === C.CV.slug) return orderFormCv(counts);
    const sv = C.bySlug(slug) || C.SERVICES.find(s => s.base === "rossiya" && s.times === 1), cv = sv.kind === "cv";
    const cnt = counts && counts.byBase || {};
    const bs = C.baseOf(sv.base), slugs = [1, 2, 3].map(n => C.SERVICES.find(x => x.base === bs.key && x.times === n).slug), prices = [1, 2, 3].map(n => C.priceOf(bs, n));
    const timesLbl = ["1 рассылка", "2 рассылки", "3 рассылки"];
    const pick = cv ? `<input type="hidden" id="slug" value="${C.CV.slug}" data-price="${C.cvPrice()}">` :
        `<input type="hidden" id="slug" value="${sv.slug}" data-slugs="${slugs.join(",")}" data-prices="${prices.join(",")}">
<div class="lbl" style="font-weight:700;color:var(--deep);margin-bottom:10px">Количество рассылок</div>
<div class="seg full" id="timesSeg" role="group" aria-label="Количество рассылок">${[1, 2, 3].map(n => `<button type="button" data-n="${n}"${sv.times === n ? ' class="on"' : ""}>${timesLbl[n - 1]}<small>${rub(prices[n - 1])}</small></button>`).join("")}</div>
<div class="xnote big" id="baseNote">Рассылка по базе <b>«${esc(bs.name)}»</b>${cnt[bs.key] > 0 ? " · " + addrCount(cnt[bs.key]) : ""} · <span id="tmsTxt">${timesLbl[sv.times - 1]}</span> — <b id="tmsSum">${rub(prices[sv.times - 1])}</b><br><span class="hint">Дату и время каждой рассылки выберите ниже. <a href="/#services">Выбрать другую базу</a></span></div>`;
    const extraPanel = cv ? "" : `<div class="panel addon"><h3>➕ Добавить ещё одну базу <span class="badge">−${C.extraDiscPct()}%</span></h3>
<p class="hint" style="margin-top:0">Любую базу можно добавить в те же рассылки на ${C.extraDiscPct()}% дешевле — например, к базе «Россия» добавить «Танкеры и газовозы». Адреса не повторяются.</p>
<label class="f">Дополнительная база<select class="in" id="extra"><option value="">Не нужна</option>${C.BASES.map(b => `<option value="${b.key}" data-p="${[1, 2, 3].map(n => C.extraPrice(C.priceOf(b, n))).join(",")}" data-f="${[1, 2, 3].map(n => C.priceOf(b, n)).join(",")}">${esc(b.name)}</option>`).join("")}</select></label>
<div class="xnote" id="extraNote" hidden></div></div>`;
    const body = `<div class="page"><h1>${cv ? "Заказ резюме «Стандарт»" : `Оформление заказа на базу <span id="ttl">«${esc(C.baseOf(sv.base).name)}»</span>`}</h1>
<p class="sub">${cv ? "Заполните данные — мы подготовим резюме по международному образцу." : "Заполните форму и загрузите резюме. Оплата — на следующем шаге."}</p>
<form id="f" novalidate><div class="err" id="err" hidden></div>
<div class="panel">${cv ? "<h3>Услуга</h3>" : ""}${pick}${cv ? `<p class="hint" style="margin-top:0">${esc(C.CV.title)} · <b>${rub(C.cvPrice())}</b></p>` : ""}</div>
${cv ? "" : `<div class="panel"><h3>📅 Дата и время рассылки</h3><div id="sched"></div><p class="hint" style="margin:12px 0 0">${SCHED_NOTE}</p></div>`}
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
<div style="margin-top:16px"><label class="f">Исключить компании<small> — по желанию, по одному в строке. Можно указать название компании, но лучше домен — так точнее: например, <b>@marlownavigation.com</b></small><textarea class="in" id="exclude" style="min-height:80px" placeholder="@marlownavigation.com"></textarea></label></div></div>`}
${extraPanel}
<div class="panel"><label class="check"><input type="checkbox" id="agree" required><span>Я принимаю условия <a href="/offer" target="_blank">публичной оферты</a> и согласен(на) на обработку персональных данных согласно <a href="/policy" target="_blank">политике конфиденциальности</a>.</span></label></div>
<input type="text" id="hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<div class="sum"><div>К оплате<br><b id="total">${rub(cv ? C.cvPrice() : sv.price)}</b></div><button class="btn gold" id="go" type="submit">Оформить заказ</button></div></form></div>${coverModal()}`;
    return shell({title: (cv ? "Заказ резюме «Стандарт»" : "Заказ рассылки") + " — Vreise.ru", desc: "Оформление заказа на Vreise.ru", path: "/order", noindex: true,
        hero: `<header class="hero short">${navTop(false)}</header>`, body, scripts: `<script src="/static/order.js?v=${V}" defer></script>`});
}

/* ---------- страница заказа ---------- */
const STATUS = {new: "Ожидает оплаты", claimed: "Проверяем оплату", paid: "Оплачен", in_progress: "В работе", done: "Выполнен", cancelled: "Отменён"};
const fmtCard = c => String(c).replace(/\s+/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
function orderPage(o, jobs, sent, msgs = [], std = null, replies = []){
    const cv = o.kind === "cv", mail = !!o.base, pay = o.status === "new" || o.status === "claimed";
    const cards = [["PAY_CARD", "PAY_BANK"], ["PAY_CARD_2", "PAY_BANK_2"]].map(([c, b]) => ({card: String(env(c) || "").replace(/\s+/g, ""), bank: env(b) || ""})).filter(x => x.card);
    const cardsHtml = (cards.length > 1 ? `<div class="seg" style="margin-top:12px">${cards.map((x, i) => `<button type="button" class="${i ? "" : "on"}" data-bank="${i}">${esc(x.bank || "Карта " + (i + 1))}</button>`).join("")}</div>` : "")
        + cards.map((x, i) => `<div data-bankcard="${i}" style="margin-top:6px"${i ? " hidden" : ""}><div><span class="card-num">${esc(fmtCard(x.card))}</span><button class="copy" type="button" data-copy="${esc(x.card)}">Скопировать</button></div></div>`).join("");
    const payBlock = pay ? `<div class="panel"><h3>Оплата картой в рублях</h3>
${o.status === "claimed" ? `<div class="ok">Спасибо! Мы проверяем ваш платёж — как только увидим перевод, заказ будет подтверждён, и вы получите письмо.</div>` : ""}
<p>Сумма к оплате: <b style="font-size:22px">${rub(o.price)}</b></p>
${cards.length ? `<p style="margin-top:12px;margin-bottom:0">${cards.length > 1 ? "Выберите банк и переведите на карту" : "Переведите на карту" + (cards[0].bank ? " " + esc(cards[0].bank) : "")}:</p>${cardsHtml}${env("PAY_HOLDER") ? `<p class="hint">Получатель: ${esc(env("PAY_HOLDER"))}</p>` : ""}`
 : `<div class="err">Реквизиты для оплаты пока не заданы. Напишите нам в WhatsApp или Telegram${phone() ? ": " + esc(phone()) : ""}.</div>`}
<p class="hint" style="margin-top:14px">В комментарии к платежу, если есть такая возможность, укажите номер заказа <b>№${o.num}</b>. Переводите точную сумму.</p>
${o.status === "new" ? `<div style="margin-top:18px"><button class="btn gold" id="claim" type="button">Я оплатил(а)</button></div>` : ""}</div>` : "";
    const fmtMsk = s => new Date(s).toLocaleString("ru-RU", {timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"});
    /* трекер этапов заказа */
    const paidDone = ["paid", "in_progress", "done"].includes(o.status), jobsEnded = jobs.length > 0 && jobs.every(j => ["done", "stop"].includes(j.status));
    const steps = [{t: "Заказ оформлен", s: "done", d: ""},
        {t: "Оплата", s: paidDone ? "done" : "todo", d: o.status === "claimed" ? "проверяем платёж" : o.status === "new" ? "ждём оплату" : "получена"}];
    const resPending = cv && mail && !!o.res_name && !o.res_ok && o.status !== "cancelled";
    if(cv) steps.push({t: "Резюме", s: o.res_name && !resPending ? "done" : "todo", d: resPending ? "ждёт вашего подтверждения" : o.res_name ? (mail ? "подтверждено" : "готово") : paidDone ? "составляем" : ""});
    if(mail) steps.push({t: "Рассылка", s: jobsEnded ? "done" : "todo", d: jobsEnded ? "завершена" : jobs.some(j => j.status === "pause") ? "на паузе" : jobs.some(j => j.status === "run") ? "идёт" : jobs.length ? (resPending ? "после подтверждения резюме" : !o.email_ok ? "после подтверждения e-mail" : "ждёт старта") : paidDone ? "готовим" : ""});
    steps.push({t: "Готово", s: o.status === "done" || steps.every(x => x.s === "done") ? "done" : "todo", d: ""});
    const nowIdx = steps.findIndex(x => x.s !== "done"); if(nowIdx >= 0) steps[nowIdx].s = "now";
    const tracker = o.status === "cancelled" ? `<div class="err">Заказ отменён.</div>`
        : `<ol class="trk">${steps.map(x => `<li class="${x.s}"><i>${x.s === "done" ? "✓" : ""}</i><b>${x.t}</b><span>${x.d}</span></li>`).join("")}</ol>`;
    /* карточки рассылок */
    const MSKMS = 3 * 3600e3, DAYMS = 864e5;
    const PL = require("./plan.js"), plannedEnd = (startMs, left) => PL.plannedEnd(startMs, left);
    const fmtShort = ms => new Date(ms).toLocaleString("ru-RU", {timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"});
    const JST = {wait: "Запланирована", run: "Идёт", pause: "На паузе", done: "Завершена", stop: "Отменена"};
    const progress = mail && jobs.length ? `<div class="panel"><h3>Рассылка</h3>${jobs.map(j => {
        const sentN = Number(j.sent), failN = Number(j.failed), total = Number(j.total || 0), pct = total ? Math.round((sentN + failN) / total * 100) : 0, left = Math.max(0, total - sentN - failN);
        const act = total ? PL.activeMs(total) : 10 * 3600e3, startMs = Date.parse(j.started_at || j.start_at), endMs = plannedEnd(startMs, act), late = j.status === "wait" && Date.parse(j.start_at) < Date.now();
        const notStarted = !j.started_at && ["wait", "pause"].includes(j.status), active = ["wait", "run", "pause"].includes(j.status);
        const why = j.status === "wait" ? (!o.email_ok ? "Рассылка не начнётся, пока вы не подтвердите e-mail — нажмите кнопку в письме, которое мы отправили на " + o.email + "." : resPending ? "Рассылка начнётся после того, как вы проверите и подтвердите готовое резюме (блок выше)." : Number(o.cover) && !o.cover_ok ? "Рассылка начнётся после подтверждения персонального письма." : "") : "";
        const badge = j.status === "wait" && why ? "⏳ Ждёт подтверждения" : j.status === "wait" ? `🕒 Запланирована на ${fmtShort(Date.parse(j.start_at))}` : JST[j.status] || j.status;
        const info = {
            wait: why ? why : late ? "Рассылка стартует в ближайшее рабочее время (будни с 06:00 до 18:00 МСК)." : "До старта можно поменять время, письмо, резюме и список исключений — всё ниже на этой странице.",
            run: `Письма уходят по будням с 06:00 до 18:00 МСК небольшими порциями, чтобы не попадать в спам.${left ? ` Осталось отправить: ${left}.` : ""}`,
            pause: j.last_error ? "Рассылка приостановлена с нашей стороны — мы уже разбираемся. Если срочно, напишите менеджеру внизу страницы." : "Письма не отправляются. Нажмите «Продолжить», когда будете готовы — рассылка пойдёт с того места, где остановилась.",
            done: j.finished_at ? `Завершена ${fmtMsk(j.finished_at)} МСК.` : "Рассылка завершена.", stop: "Рассылка отменена."}[j.status] || "";
        const mskVal = new Date(Date.parse(j.start_at) + MSKMS).toISOString().slice(0, 16);
        const btns = [];
        if(["wait", "run"].includes(j.status)) btns.push(`<button class="btn sm jbtn jline" data-j="${esc(j.id)}" data-a="pause" type="button">⏸ Пауза</button>`);
        if(j.status === "pause" && !j.last_error) btns.push(`<button class="btn gold sm jbtn" data-j="${esc(j.id)}" data-a="resume" type="button">▶ Продолжить</button>`);
        if(notStarted) btns.push(`<button class="btn sm jline jtime" data-j="${esc(j.id)}" type="button">🕒 Изменить время</button>`);
        if(active) btns.push(`<button class="btn sm jbtn jred" data-j="${esc(j.id)}" data-a="cancel" type="button">✖ Отменить рассылку</button>`);
        return `<div class="jc2"><div class="jh"><b>Рассылка №${j.m}</b><span class="jst ${j.status}">${badge}</span></div>
${active && j.status !== "pause" ? `<div class="chips"><span>🕒 ${fmtShort(startMs)} – ${fmtShort(endMs)} МСК</span><span class="dk">${Math.round(act / 3600e3)} ч</span></div>` : ""}
<div class="bigp"><div class="bgn">${pct}<small>%</small></div><div class="bgr"><div class="bar"><i style="width:${pct}%"></i></div>
<div>${total ? `Отправлено: <b>${sentN}</b> из ${total.toLocaleString("ru-RU")} адресов` : "Отправлено: <b>0</b> · адреса подберём перед стартом"}${failN ? `, не доставлено ${failN}` : ""}</div>
${active ? `<span class="hint">Старт: ${fmtShort(startMs)} МСК · плановое окончание: ${fmtShort(endMs)} МСК</span>` : ""}</div></div>
<p class="jn">${info}</p>
${btns.length ? `<div class="ja">${btns.join("")}<span class="hint jmsg"></span></div>` : ""}
${notStarted ? `<div class="jtf" hidden data-j="${esc(j.id)}"><label class="f">Новое время старта <small>— по Москве, с 06:00 до 18:00, не раньше чем через час</small><input class="in jtv" type="datetime-local" value="${mskVal}" step="60"></label>
<div class="ja"><button class="btn gold sm jtsave" type="button">Сохранить время</button><button class="btn sm jline jtcancel" type="button">Отмена</button><span class="hint jtmsg"></span></div></div>` : ""}</div>`; }).join("")}</div>` : "";
    /* куда не отправлять / адрес для ответов */
    const exList = String(o.exclude || "").split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
    const started = jobs.some(j => j.started_at);
    const exclBlock = mail && o.status !== "cancelled" ? `<div class="panel"><h3>🚫 Куда НЕ отправлять</h3>
<p class="hint" style="margin:0 0 8px" id="exview">${exList.length ? esc(exList.join(", ")) : "Ограничений нет — резюме уйдёт всем компаниям из базы."}</p>
<div id="exform" hidden><textarea class="in" id="extxt" maxlength="1500" style="min-height:90px" placeholder="По одному в строке: домен (например, @marlownavigation.com) или название компании">${esc(exList.join("\n"))}</textarea>
<p class="hint">${started ? "Новые исключения применятся сразу ко всем ещё не отправленным письмам. Вернуть уже убранные адреса нельзя." : "Мы уберём эти компании из рассылки перед стартом."}</p>
<div class="ja"><button class="btn gold sm" id="exsave" type="button">Сохранить</button><button class="btn sm jline" id="excancel" type="button">Отмена</button><span class="hint" id="exmsg"></span></div></div>
<button class="btn sm jline" id="exedit" type="button">✏️ Изменить</button></div>` : "";
    const replyAddr = o.reply_to || o.email;
    const replyBlock = mail && o.status !== "cancelled" ? `<div class="panel"><h3>📩 Ответы компаний придут на</h3>
<p style="margin:0 0 10px"><b id="rtview">${esc(replyAddr)}</b> <span class="hint">· ${o.reply_to ? "указанный вами адрес" : "e-mail заказа"}</span></p>
<div id="rtform" hidden><input class="in" id="rtin" type="email" maxlength="120" value="${esc(replyAddr)}" style="max-width:380px"><p class="hint">Этот адрес будет указан в письмах компаниям для ответа.${started ? " Для уже отправленных писем адрес не изменится." : ""}</p>
<div class="ja"><button class="btn gold sm" id="rtsave" type="button">Сохранить</button><button class="btn sm jline" id="rtcancel" type="button">Отмена</button><span class="hint" id="rtmsg"></span></div></div>
<button class="btn sm jline" id="rtedit" type="button">✏️ Изменить адрес</button></div>` : "";
    const list = mail && sent.length ? `<div class="panel nosel"><h3>Куда отправлено</h3><table class="t"><thead><tr><th>Компания</th><th>E-mail</th><th>Когда</th></tr></thead><tbody>${sent.map(r =>
        `<tr><td>${esc(r.company || "—")}</td><td>${esc(r.email)}</td><td>${esc(new Date(r.sent_at).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}))}</td></tr>`).join("")}</tbody></table>
<p class="hint">Показаны последние отправленные письма. Названия и адреса компаний частично скрыты — это защита базы.</p></div>` : "";
    const repl = mail && (replies.length || jobs.length) ? `<div class="panel" id="replies"><h3>Ответы компаний${replies.length ? ` · ${replies.length}` : ""}</h3>${replies.length ? replies.map(r => `<div class="rpl"><div class="h nosel"><b>${esc(r.from_name || r.from_email)}</b>${r.from_name ? ` · ${esc(r.from_email)}` : ""} · ${esc(new Date(r.at).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}))}${r.kind === "auto" ? ' · <span class="atag">автоответ</span>' : ""}</div><div style="font-weight:700;margin-top:4px">${esc(r.subject || "(без темы)")}</div><div class="b">${esc(r.text || "")}</div>
<div class="rfw">${r.fwd ? `<span class="hint">✅ Переслано администратору</span>` : `<button class="btn sm jline rfwd" type="button" data-id="${esc(r.id)}">📤 Переслать администратору</button>`}</div></div>`).join("") : `<p class="hint" style="margin:0">Пока ответов нет. Компании отвечают не сразу — как только придёт письмо, оно появится здесь, и мы сообщим на почту.</p>`}<p class="hint" style="margin-top:12px">Отвечать компаниям лучше со своей личной почты — на адрес, с которого вам написали. Ящик рассылки работает ещё сутки после окончания рассылки.</p></div>` : "";
    const res = cv && o.res_name ? (resPending ? `<div class="panel" style="border:2px solid #f2b400"><h3>📄 Ваше резюме готово — проверьте и подтвердите</h3>
<p class="hint" style="margin:0 0 12px">Скачайте резюме и внимательно проверьте данные. <b>Рассылка начнётся только после вашего подтверждения</b>${o.email_ok ? "" : " и подтверждения e-mail"}. Нужна правка — напишите менеджеру внизу страницы (одна правка входит в стоимость), мы пришлём исправленный файл.</p>
<p><a class="btn line" href="/o/${o.token}/file" style="color:var(--deep);border-color:#9fb6bb">Скачать: ${esc(o.res_name)}</a></p>
<div style="margin-top:14px"><button class="btn gold" id="resok" type="button">✅ Всё верно — подтвердить резюме</button> <span class="hint" id="resmsg"></span></div></div>`
 : `<div class="panel"><h3>Ваше резюме готово${mail ? " ✅" : ""}</h3><p><a class="btn gold" href="/o/${o.token}/file">Скачать: ${esc(o.res_name)}</a></p></div>`) : "";
    const wait = cv && ["paid", "in_progress"].includes(o.status) && !o.res_name ? `<div class="ok">Оплата получена. Готовим ваше резюме — оно придёт на почту и появится здесь в течение 6 часов.</div>` : "";
    const emailBanner = !o.email_ok && o.status !== "cancelled" ? `<div class="err" style="background:#fff7dc;color:#6b4e00;border-color:#f0d78a;margin-bottom:18px">✉️ <b>Подтвердите e-mail.</b> Мы отправили письмо на <b>${esc(o.email)}</b> — нажмите в нём кнопку. ${cv ? "" : "Без подтверждения рассылка не начнётся. "}Письма нет? Проверьте «Спам» или <button class="btn gold sm" id="resend" type="button" style="margin:0 6px">отправьте ещё раз</button><span class="hint" id="rsmsg"></span></div>` : "";
    const running = jobs.some(j => j.status === "run");
    const draftReady = Number(o.cover) && o.base && !o.cover_ok && String(o.draft_letter || "").trim() && o.status !== "cancelled";
    const coverBanner = Number(o.cover) && o.status !== "cancelled" && !draftReady ? `<div class="err" style="background:#eef8f5;color:#0b3641;border-color:#bfe0d6;margin-bottom:18px">💌 <b>Персональное сопроводительное письмо</b> — ${!o.base ? "заказано. Пришлём его вместе с готовым резюме." : o.cover_ok ? "готово и подтверждено вами ✅" : "заказано. Мы составляем его для вас. Когда оно будет готово, мы пришлём его вам на почту и покажем на этой странице — рассылка начнётся только после вашего подтверждения."}</div>` : "";
    const coverDraft = draftReady ? `<div class="panel" style="border:2px solid #f2b400"><h3>💌 Ваше персональное письмо готово — подтвердите</h3>
<p class="hint" style="margin:0 0 14px">Проверьте письмо. Всё устраивает — нажмите «Подтвердить», и рассылка начнётся. Нужны правки — поправьте текст прямо здесь или напишите менеджеру внизу страницы.</p>
<label class="f">Тема письма<input class="in" id="cvsub" maxlength="200" value="${esc(o.draft_subject || "")}"></label>
<div style="margin-top:14px"><label class="f">Текст письма<textarea class="in" id="cvtxt" maxlength="4000" style="min-height:260px">${esc(o.draft_letter)}</textarea></label></div>
<div style="margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn gold" id="cvok" type="button">Подтвердить и запустить рассылку</button><span class="hint" id="cvmsg"></span></div></div>` : "";
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
${tracker}${mail ? `<div id="pushbar"></div>` : ""}${emailBanner}${coverBanner}${coverDraft}${payBlock}${wait}${res}${progress}${exclBlock}${replyBlock}${repl}${list}${letterBlock}${resumeBlock}${chat}
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
<h2>1. Услуги</h2><ul><li><b>Рассылка резюме</b> — отправка резюме Заказчика на адреса электронной почты компаний из выбранной базы с сопроводительным письмом. Количество рассылок (одна, две или три) выбирается при заказе; дату и время старта каждой рассылки Заказчик выбирает при оформлении заказа (не ранее чем со следующего дня; старт — с 06:00 до 18:00 по московскому времени); отправка осуществляется по будням с 06:00 до 18:00 по московскому времени, рассылка занимает не менее 10 часов, в выходные дни отправка переносится на понедельник.</li><li><b>Резюме «Стандарт»</b> — составление резюме по данным, предоставленным Заказчиком; одна бесплатная правка.</li></ul>
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
