"use strict";
/* Письма клиентам и владельцу — только на русском. Отправка через SYS_SMTP_* (mailer.sendSystem). */
const M = require("./mailer.js");
const {env} = M;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const siteUrl = () => (env("SITE_URL") || (env("RAILWAY_PUBLIC_DOMAIN") ? "https://" + env("RAILWAY_PUBLIC_DOMAIN") : "http://localhost:" + (env("PORT") || 3000))).replace(/\/+$/, "");
const phone = () => env("CONTACT_PHONE") || "";
const digits = () => phone().replace(/\D/g, "");
const WA = () => digits() ? `https://wa.me/${digits()}` : "";
const TGL = () => digits() ? `https://t.me/+${digits()}` : "";

function layout(title, body, btn, url){
    return `<!doctype html><html lang="ru"><body style="margin:0;background:#eef3f4;font-family:Arial,Helvetica,sans-serif;color:#10262c">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f4;padding:24px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0A3340;padding:20px 28px;color:#ffffff;font-size:22px;font-weight:bold">Vreise<span style="color:#F2B705;font-size:14px">.ru</span></td></tr>
<tr><td style="padding:28px">
<h2 style="margin:0 0 14px;font-size:20px;color:#0A3340">${esc(title)}</h2>
<div style="font-size:15px;line-height:1.6">${body}</div>
${btn && url ? `<p style="margin:24px 0 4px"><a href="${esc(url)}" style="background:#F2B705;color:#1b1500;text-decoration:none;font-weight:bold;padding:13px 24px;border-radius:999px;display:inline-block">${esc(btn)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;background:#f6f9fa;color:#5b727a;font-size:12.5px;line-height:1.5">Если есть вопросы — напишите нам${phone() ? ` в WhatsApp или Telegram: <b>${esc(phone())}</b>` : ""}.<br>Это письмо отправлено автоматически сайтом Vreise.ru.</td></tr>
</table></td></tr></table></body></html>`;
}
const strip = h => String(h).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();

async function toClient(to, title, body, btn, url){
    return send(to, title, layout(title, body, btn, url), strip(body) + (url ? `\n\n${btn}: ${url}` : ""));
}
async function send(to, subject, html, text){
    try { await M.sendSystem(to, subject, text || strip(html), html); return true; }
    catch(e){ console.error("✉️ письмо не ушло:", to, e.message); return false; }
}

const rub = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
const orderLink = o => `${siteUrl()}/o/${o.token}`;

const T = {
    confirm: o => toClient(o.email, `Подтвердите e-mail — заказ №${o.num} принят`,
        `<p>Здравствуйте, ${esc(o.first_name || "")}!</p><p>Мы приняли ваш заказ <b>№${o.num}</b>: ${esc(o.title)}.<br>Сумма к оплате: <b>${rub(o.price)}</b>.</p>
         <p><b>Подтвердите, пожалуйста, что этот адрес ваш</b> — на него придут отчёты о рассылке и ответы менеджера.${o.kind === "mailing" ? " Без подтверждения рассылка не начнётся." : ""}</p>
         <p>Оплатить заказ можно на странице заказа — реквизиты и сумма там. После перевода нажмите «Я оплатил(а)», мы проверим платёж и начнём работу.</p>`, "Подтвердить e-mail", `${orderLink(o)}/confirm`),
    paid: o => toClient(o.email, `Оплата заказа №${o.num} получена`,
        o.kind === "cv"
            ? `<p>Спасибо! Оплата заказа <b>№${o.num}</b> получена. Резюме «Стандарт» будет готово в течение 6 часов — мы пришлём его на эту почту и добавим на страницу заказа.</p>`
            : `<p>Спасибо! Оплата заказа <b>№${o.num}</b> получена. Рассылка вашего резюме скоро начнётся. Все отправленные письма будут видны на странице заказа, а по окончании мы пришлём отчёт.</p>
               <p>Ответы компаний придут прямо на вашу почту <b>${esc(o.email)}</b>.</p>`, "Страница заказа", orderLink(o)),
    started: (o, j) => toClient(o.email, `Рассылка №${j.m} по заказу №${o.num} началась`,
        `<p>Рассылка вашего резюме началась: ${j.total} адресов. Письма уходят постепенно, чтобы не попасть в спам, — это займёт несколько часов.</p><p>Ответы компаний приходят на вашу почту <b>${esc(o.email)}</b>.</p>`, "Следить за рассылкой", orderLink(o)),
    finished: (o, j) => toClient(o.email, `Рассылка по заказу №${o.num} завершена`,
        `<p>Рассылка №${j.m} завершена: отправлено <b>${j.sent}</b> из ${j.total}${j.failed ? `, не доставлено ${j.failed}` : ""}.</p>${Number(o.times) > Number(j.m) ? `<p>Следующая рассылка по вашему заказу пройдёт через неделю.</p>` : ""}
         <p>Полный список компаний — на странице заказа.</p>`, "Отчёт о рассылке", orderLink(o)),
    reply: (o, text) => toClient(o.email, `Ответ менеджера по заказу №${o.num}`,
        `<p>Здравствуйте, ${esc(o.first_name || "")}!</p><p>${esc(text).replace(/\n/g, "<br>")}</p><p style="color:#5b727a;font-size:13.5px">Написать нам можно на странице заказа или в мессенджеры.</p>`, "Открыть заказ", orderLink(o)),
    cvReady: o => toClient(o.email, `Резюме по заказу №${o.num} готово`,
        `<p>Ваше резюме «Стандарт» готово — файл можно скачать на странице заказа. Если нужна правка, напишите нам: одна правка входит в стоимость.</p>`, "Скачать резюме", orderLink(o))
};

/* уведомление владельцу: только письмо на OWNER_EMAIL (без Telegram-бота) */
async function owner(text){
    const subj = text.split("\n")[0].slice(0, 120);
    if(env("OWNER_EMAIL")) await send(env("OWNER_EMAIL"), subj, `<pre style="font:14px/1.5 Arial,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`, text).catch(() => {});
    console.log("🔔", text.replace(/\n/g, " | "));
}

module.exports = {esc, siteUrl, phone, WA, TGL, rub, orderLink, T, owner, send, layout};
