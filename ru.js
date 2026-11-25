"use strict";
/* Российская компания: домен .ru / .su / .рф, страна «Россия», российский телефон (+7 / 8 с кодом 3xx, 4xx, 8xx, 9xx; коды 6xx и 7xx — Казахстан, не считаем). */
const RU_TLD = /\.(ru|su|xn--p1ai|рф)$/i;
const RU_COUNTRY = /(^|[^\p{L}])(росси|russia|рф(?![\p{L}])|ru(?![\p{L}]))/iu;
function ruPhone(p){
    const d = String(p || "").replace(/\D/g, "");
    if(d.length === 11 && /^[78]/.test(d)) return /^[3489]/.test(d[1]);
    if(d.length === 10) return /^[3489]/.test(d[0]) && /^\+?7/.test(String(p).trim());
    return false;
}
const isRu = (email, country, phone) => {
    const dom = String(email || "").toLowerCase().split("@")[1] || "";
    return RU_TLD.test(dom) || RU_COUNTRY.test(String(country || "")) || ruPhone(phone);
};
module.exports = {isRu, ruPhone, RU_TLD};
