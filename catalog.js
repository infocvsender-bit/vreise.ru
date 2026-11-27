"use strict";
/* Каталог услуг и цены в рублях. Рассылки: 6 готовых баз × 1/2/3 рассылки. Резюме «Стандарт» — 1999 ₽, персональное сопроводительное письмо — 449 ₽.
   Поменять цену можно переменной Railway PRICE_<slug>=1500 (дефис в slug → _). */
const ALL_BASES = [
    {key: "rossiya", hidden: true, day: true, count: 1200, name: "Россия", note: "Крюинговые компании и судовладельцы России", prices: [1439, 2249, 3329]},
    {key: "ofsor", day: true, count: 4778, name: "Офшор", note: "Крюинговые компании и судовладельцы по всему миру, нанимающие на офшорный флот", prices: [1439, 2249, 3329]},
    {key: "tanker", day: true, count: 3466, name: "Танкеры и газовозы", note: "Крюинговые компании и судовладельцы по всему миру с танкерным и газовым флотом", prices: [1439, 2249, 3329]},
    {key: "evropa", day: true, count: 3646, name: "Европа + Россия + СНГ", note: "Крюинговые компании и судовладельцы Европы, России и СНГ", prices: [1709, 2519, 3419]},
    {key: "ofsor-evropa", count: 7259, name: "Офшор + Европа + Россия + СНГ", note: "Крюинговые компании и судовладельцы: офшорный флот мира, Европа, Россия и СНГ", prices: [2339, 3239, 4139]},
    {key: "mir", count: 6465, name: "Мир", note: "Крюинговые компании и судовладельцы по всему миру", prices: [2069, 3149, 4049]},
    {key: "mir-ofsor", count: 9146, name: "Мир + Офшор", note: "Крюинговые компании и судовладельцы по всему миру, включая офшорный флот", prices: [2879, 3779, 4679]}
];
/* 27.11 (решение владельца): база «Россия» убрана из продаж — карточки, форма заказа, помощник; остаётся только для старых заказов и данных (baseOf/baseName/sameDay). Адреса .ru по-прежнему входят в «Европа + Россия + СНГ». */
const BASES = ALL_BASES.filter(b => !b.hidden);
const TIMES = ["разовая", "двухразовая", "трёхразовая"];
const CV = {slug: "reziume-standart", title: "Составление резюме «Стандарт»", price: 1999,
    bullets: ["Резюме в международном формате (Application Form) с нуля — по вашим данным", "Корректное оформление морского стажа (Sea Service), документов и сертификатов",
        "Новый фирменный дизайн, файлы Word и PDF", "Готово в течение 6 часов после оплаты — придёт на вашу почту и в личную страницу заказа", "Одна бесплатная правка"]};

const envPrice = slug => { const v = process.env["PRICE_" + slug] ?? process.env["PRICE_" + slug.replace(/-/g, "_")]; return v && Number(v) > 0 ? Math.round(Number(v)) : 0; };
const mailSlug = (b, n) => `rassylka-${n}-${b}`;

const SERVICES = [];
for(const b of BASES) b.prices.forEach((p, i) => SERVICES.push({slug: mailSlug(b.key, i + 1), kind: "mailing", base: b.key, times: i + 1, price: envPrice(mailSlug(b.key, i + 1)) || p,
    title: `Рассылка ${TIMES[i]} · ${b.name}`}));
SERVICES.push({slug: CV.slug, kind: "cv", times: 0, price: envPrice(CV.slug) || CV.price, title: CV.title});

const bySlug = slug => SERVICES.find(s => s.slug === slug);
const baseOf = key => ALL_BASES.find(b => b.key === key);
/* Базы «Европа + Россия + СНГ», «Офшор» и «Танкеры и газовозы» идут не быстрее 6 часов — при старте до 12:00 МСК уходят целиком в день старта (решение владельца 26.11); остальные («Офшор + Европа + Россия + СНГ», «Мир», «Мир + Офшор») — не менее 10 часов, остаток на следующий рабочий день. С дополнительной базой — 6 часов только если и она из первых четырёх. */
const sameDay = o => { const ks = [o && o.base, o && o.extra_base].filter(Boolean); return !!ks.length && ks.every(k => { const b = baseOf(k); return !!(b && b.day); }); };
/* оценка числа адресов до старта (когда реальное число ещё не известно) */
const estCount = o => [o && o.base, o && o.extra_base].filter(Boolean).reduce((s, k) => s + ((baseOf(k) || {}).count || 0), 0);
/* «Тест» — служебная база владельца (адреса вписывает он сам в CRM). В BASES и SERVICES её нет, клиент заказать её не может; ставится только из CRM в карточке заказа. */
const TEST_KEY = "test";
const baseName = key => key === TEST_KEY ? "Тест" : (baseOf(key) || {}).name || key;
const priceOf = (b, n) => envPrice(mailSlug(b.key, n)) || b.prices[n - 1];
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";

/* скидка на рассылку, добавленную к резюме: 15% (меняется переменной COMBO_DISC) */
const discPct = () => { const v = String(process.env.COMBO_DISC ?? "").trim(); return v !== "" && Number(v) >= 0 && Number(v) < 90 ? Number(v) : 15; };
const addonPrice = full => Math.max(1, Math.round(full * (100 - discPct()) / 100 / 10) * 10 - 1);

/* скидка на вторую (любую) базу в рассылке: 20% (меняется переменной EXTRA_DISC) */
const extraDiscPct = () => { const v = String(process.env.EXTRA_DISC ?? "").trim(); return v !== "" && Number(v) >= 0 && Number(v) < 90 ? Number(v) : 20; };
const extraPrice = full => Math.max(1, Math.round(full * (100 - extraDiscPct()) / 100 / 10) * 10 - 1);

const coverPrice = () => envPrice("cover") || 449;

module.exports = {sameDay, estCount, TEST_KEY, baseName, coverPrice, discPct, addonPrice, extraDiscPct, extraPrice, BASES, TIMES, CV, SERVICES, bySlug, baseOf, priceOf, fmt, cvPrice: () => envPrice(CV.slug) || CV.price};
