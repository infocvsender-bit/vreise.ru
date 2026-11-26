"use strict";
/* Расчёт реальной длительности рассылки: пауза между письмами = max(SEND_GAP_SEC, 10 ч / число адресов), отправка только по будням 06:00–18:00 МСК.
   Те же правила, что в engine.js (inWindow / темп) — здесь только расчёт для писем и кабинета. */
const MSK = 3 * 3600e3, DAY = 864e5;
const gapMs = () => Math.max(2, Number(process.env.SEND_GAP_SEC) || 20) * 1000;
const activeMs = total => Math.max(10 * 3600e3, Math.max(1, Number(total) || 1) * gapMs());      // чистое время отправки
function plannedEnd(startMs, left = 10 * 3600e3){
    let t = startMs;
    for(let i = 0; i < 400 && left > 0; i++){
        const d = new Date(t + MSK), dow = d.getUTCDay(), h = d.getUTCHours() + d.getUTCMinutes() / 60, day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - MSK;
        if(dow >= 1 && dow <= 5 && h >= 6 && h < 18){ const can = Math.min(left, day0 + 18 * 3600e3 - t); left -= can; t += can; if(left > 0) t = day0 + DAY + 6 * 3600e3; }
        else t = (dow >= 1 && dow <= 5 && h < 6) ? day0 + 6 * 3600e3 : day0 + DAY + 6 * 3600e3;
    }
    return t;
}
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
const hoursText = ms => { const h = Math.max(1, Math.round(ms / 3600e3)); return `${h} ${plural(h, "час", "часа", "часов")}`; };
const fmtMsk = ms => new Date(ms).toLocaleString("ru-RU", {timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"});
/* Базы «Россия», «Европа + Россия + СНГ», «Офшор», «Танкеры» (catalog.sameDay): вся рассылка идёт не быстрее 6 часов (вместо 10) — при старте до 12:00 МСК уходит в тот же день;
   пауза между письмами не меньше SAMEDAY_GAP_SEC (по умолчанию 3 с). При более позднем старте часть уходит до 18:00, остаток — на следующий рабочий день. */
const SAME_MIN_H = 6, sameGapMs = () => Math.max(2, Number(process.env.SAMEDAY_GAP_SEC) || 3) * 1000;
function calc(startMs, total, sameDay){
    const n = Math.max(1, Number(total) || 1);
    const act = sameDay ? Math.max(SAME_MIN_H * 3600e3, n * sameGapMs()) : activeMs(n);
    return {act, end: plannedEnd(startMs, act)};
}
module.exports = {activeMs, plannedEnd, hoursText, fmtMsk, calc, sameGapMs, SAME_MIN_H};
