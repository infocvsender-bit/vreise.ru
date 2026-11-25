/* =========================================================
   Vreise.ru — «кто сейчас на сайте». Страницы шлют лёгкий пинг (POST /api/ping, public/assistant.js);
   данные только в памяти сервера (после перезапуска список пустой), без IP и без личных данных, кроме имени/e-mail,
   которые человек сам указал в чате, и номера заказа (если он в личном кабинете / на странице оплаты). CRM → «Онлайн».
========================================================= */
"use strict";
const V = new Map();                                            // vid -> посетитель
const DAY = {d: "", n: new Set()};                              // уникальные за сегодня (по Москве)
const mskDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

function prune(){ const t = Date.now(); for(const [k, v] of V) if(t - v.last > 30 * 60e3) V.delete(k); }

function ping(e){
    const t = Date.now(); let v = V.get(e.vid);
    if(!v){ if(V.size > 5000) prune(); if(V.size > 5000) return; v = {vid: e.vid, first: t, pages: 0, trail: [], ref: "", dev: e.dev, who: null, chatAt: 0}; V.set(e.vid, v); }
    if(v.path !== e.path || v.label !== e.label){ v.pages++; v.trail.push({label: e.label, at: t}); if(v.trail.length > 8) v.trail.shift(); v.path = e.path; v.label = e.label; }
    v.last = t; v.hidden = !!e.hidden; if(e.ref && !v.ref) v.ref = e.ref;
    const d = mskDay(); if(DAY.d !== d){ DAY.d = d; DAY.n = new Set(); } DAY.n.add(e.vid);
    return v;
}
const get = vid => V.get(vid);
function list(){
    prune(); const t = Date.now();
    const rows = [...V.values()].filter(v => t - v.last < 15 * 60e3).sort((a, b) => b.last - a.last).map(v => ({id: v.vid.slice(0, 5), label: v.label, path: v.path, since: v.first, last: v.last, hidden: v.hidden, dev: v.dev, ref: v.ref,
        pages: v.pages, trail: v.trail.map(x => x.label), who: v.who, state: t - v.last < 90e3 ? (v.hidden ? "idle" : "on") : t - v.last < 180e3 ? "idle" : "left"}));
    return {now: t, online: rows.filter(r => r.state !== "left").length, active: rows.filter(r => r.state === "on").length, today: DAY.d === mskDay() ? DAY.n.size : 0, rows};
}
module.exports = {ping, get, list};
