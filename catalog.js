"use strict";
/* Каталог услуг и цены в рублях. Рассылки: 7 готовых баз × 1/2/3 рассылки. Резюме «Стандарт» — 1979 ₽.
   Поменять цену можно переменной Railway PRICE_<slug>=1500 (дефис в slug → _). */
const BASES = [
    {key: "rossiya", name: "Россия", note: "крюинговые компании и судовладельцы России", prices: [1439, 2249, 3329]},
    {key: "ofsor", name: "Офшор", note: "компании, нанимающие на офшорный флот", prices: [1439, 2249, 3329]},
    {key: "tanker", name: "Танкерный и газовый флот", note: "компании с танкерами и газовозами", prices: [1439, 2249, 3329]},
    {key: "evropa", name: "Европа + Россия", note: "компании Европы и России", prices: [1709, 2519, 3419]},
    {key: "ofsor-evropa", name: "Офшор + Европа + Россия", note: "офшор, Европа и Россия без повторов адресов", prices: [2339, 3239, 4139]},
    {key: "mir", name: "Мир", note: "крюинговые компании всего мира", prices: [2069, 3149, 4049]},
    {key: "mir-ofsor", name: "Мир + Офшор", note: "весь мир и офшорный флот", prices: [2879, 3779, 4679]}
];
const TIMES = ["разовая", "двухразовая", "трёхразовая"];
const CV = {slug: "reziume-standart", title: "Составление резюме «Стандарт»", price: 1979,
    bullets: ["Резюме в международном формате (Application Form) с нуля — по вашим данным", "Корректное оформление морского стажа (Sea Service), документов и сертификатов",
        "Новый фирменный дизайн, файлы Word и PDF", "Готово в течение 6 часов после оплаты — придёт на вашу почту и в личную страницу заказа", "Одна бесплатная правка"]};

const envPrice = slug => { const v = process.env["PRICE_" + slug] ?? process.env["PRICE_" + slug.replace(/-/g, "_")]; return v && Number(v) > 0 ? Math.round(Number(v)) : 0; };
const mailSlug = (b, n) => `rassylka-${n}-${b}`;

const SERVICES = [];
for(const b of BASES) b.prices.forEach((p, i) => SERVICES.push({slug: mailSlug(b.key, i + 1), kind: "mailing", base: b.key, times: i + 1, price: envPrice(mailSlug(b.key, i + 1)) || p,
    title: `Рассылка ${TIMES[i]} · ${b.name}`}));
SERVICES.push({slug: CV.slug, kind: "cv", times: 0, price: envPrice(CV.slug) || CV.price, title: CV.title});

const bySlug = slug => SERVICES.find(s => s.slug === slug);
const baseOf = key => BASES.find(b => b.key === key);
const priceOf = (b, n) => envPrice(mailSlug(b.key, n)) || b.prices[n - 1];
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";

module.exports = {BASES, TIMES, CV, SERVICES, bySlug, baseOf, priceOf, fmt, cvPrice: () => envPrice(CV.slug) || CV.price};
