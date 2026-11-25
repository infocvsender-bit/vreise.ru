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
    const site = siteUrl(), host = site.replace(/^https?:\/\//, "");
    const A = "text-decoration:none;color:#ffffff", mailTo = String(env("SYS_SMTP_FROM") || env("SYS_SMTP_USER") || "").replace(/^.*<([^>]+)>.*$/, "$1").trim();
    const pill = (href, ico, label, bg) => href ? `<td style="padding:0 8px 0 0"><a href="${esc(href)}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;padding:8px 14px 8px 10px;border-radius:999px"><img src="${esc(site)}/static/mail-${ico}.png" width="18" height="18" alt="" style="vertical-align:middle;border:0;margin-right:6px">${label}</a></td>` : "";
    const pills = pill(WA(), "wa", "WhatsApp", "#1f9d55") + pill(TGL(), "tg", "Telegram", "#2a8bd0") + pill(mailTo ? "mailto:" + mailTo : "", "mail", "Почта", "#0F4C5C");
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;background:#eef3f4;font-family:Arial,Helvetica,sans-serif;color:#10262c">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f4;padding:24px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0A3340;padding:22px 28px 18px">
<table cellpadding="0" cellspacing="0"><tr>
<td valign="middle" style="padding-right:14px"><a href="${esc(site)}" style="${A}"><img src="${esc(site)}/static/icon-192.png" width="52" height="52" alt="Vreise.ru" style="display:block;border:0;border-radius:50%"></a></td>
<td valign="middle"><a href="${esc(site)}" style="${A};font-size:26px;font-weight:bold;letter-spacing:.3px;line-height:1.1;display:block">Vreise<span style="color:#F2B705;font-size:16px">.ru</span></a>
<div style="color:#b9d3da;font-size:13px;line-height:1.4;margin-top:4px">Составление и рассылка резюме для моряков</div></td>
</tr></table></td></tr>
<tr><td style="background:#F2B705;height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px">
<h2 style="margin:0 0 14px;font-size:20px;color:#0A3340">${esc(title)}</h2>
<div style="font-size:15px;line-height:1.6">${body}</div>
${btn && url ? `<p style="margin:24px 0 4px"><a href="${esc(url)}" style="background:#F2B705;color:#1b1500;text-decoration:none;font-weight:bold;padding:13px 24px;border-radius:999px;display:inline-block">${esc(btn)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:20px 28px 22px;background:#f6f9fa;color:#5b727a;font-size:12.5px;line-height:1.6;border-top:1px solid #e3ebee">
<b style="color:#0A3340">Vreise.ru</b> — составление резюме и рассылка его в крюинговые компании.<br>
Сайт: <a href="${esc(site)}" style="color:#0F4C5C;font-weight:bold;text-decoration:none">${esc(host)}</a>
${pills ? `<table cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>${pills}</tr></table>` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}
const strip = h => String(h).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();

async function toClient(to, title, body, btn, url, attach, strict){
    return send(to, title, layout(title, body, btn, url), strip(body) + (url ? `\n\n${btn}: ${url}` : ""), attach, strict);
}
async function send(to, subject, html, text, attach, strict){
    try { await M.sendSystem(to, subject, text || strip(html), html, undefined, attach); return true; }
    catch(e){ console.error("✉️ письмо не ушло:", to, e.message); if(strict) throw e; return false; }
}

const rub = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
const orderLink = o => `${siteUrl()}/o/${o.token}`;

const T = {
    confirm: o => toClient(o.email, `Подтвердите e-mail — заказ №${o.num} принят`,
        `<p>Здравствуйте, ${esc(o.first_name || "")}!</p><p>Мы приняли ваш заказ <b>№${o.num}</b>: ${esc(o.title)}.<br>Сумма к оплате: <b>${rub(o.price)}</b>.</p>
         <p><b>Подтвердите, пожалуйста, что этот адрес ваш.</b> Это нужно для того, чтобы мы были уверены, что вы не совершили ошибку при заказе!${o.kind === "mailing" ? " Без подтверждения рассылка не начнётся." : ""}</p>
         <p>Ваш личный кабинет — страница заказа: <a href="${orderLink(o)}">${orderLink(o)}</a>. Вход без пароля, ссылка персональная — сохраните это письмо. В кабинете видны статус, статистика рассылки и ответы компаний.</p>
         <p>Оплатить заказ можно на странице заказа — реквизиты и сумма там. После перевода нажмите «Я оплатил(а)», мы проверим платёж и начнём работу.</p>`, "Подтвердить e-mail", `${orderLink(o)}/confirm`),
    paid: o => toClient(o.email, `Оплата заказа №${o.num} получена`,
        o.kind === "cv"
            ? `<p>Спасибо! Оплата заказа <b>№${o.num}</b> получена. Резюме «Стандарт» будет готово в течение 6 часов — мы пришлём его на эту почту и добавим на страницу заказа.</p>`
            : `<p>Спасибо! Оплата заказа <b>№${o.num}</b> получена. Рассылка вашего резюме скоро начнётся. Все отправленные письма будут видны на странице заказа.</p>
               <p>Ответы компаний придут прямо на вашу почту <b>${esc(o.email)}</b>, а также в личный кабинет!</p>`, "Личный кабинет", orderLink(o)),
    started: (o, j) => toClient(o.email, `Рассылка №${j.m} по заказу №${o.num} началась`,
        (() => { const P = require("./plan.js"), act = P.activeMs(j.total), end = P.plannedEnd(Date.now(), act);
            return `<p>Рассылка вашего резюме началась: ${j.total} адресов. Письма уходят постепенно, чтобы не попасть в спам.</p>
         <p>Отправка займёт около <b>${P.hoursText(act)}</b>: письма уходят по будням с 06:00 до 18:00 по Москве, поэтому плановое окончание — <b>${P.fmtMsk(end)} МСК</b>.</p><p>Ответы компаний приходят на вашу почту <b>${esc(o.reply_to || o.email)}</b>, а статистику и ответы можно смотреть в личном кабинете.</p>`; })(), "Личный кабинет", orderLink(o)),
    finished: (o, j) => toClient(o.email, `Рассылка по заказу №${o.num} завершена ✅`,
        `<p>Здравствуйте, ${esc(o.first_name || "")}! Рассылка вашего резюме завершена.</p>
         <table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr><td align="center" style="background:#eef8f3;border:1px solid #c5e6d3;border-radius:16px;padding:22px 16px">
           <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#2f7a55;font-weight:bold">Рассылка №${j.m} · завершена</div>
           <div style="font-size:46px;line-height:1.15;font-weight:bold;color:#0A3340;margin:6px 0 2px">${Number(j.sent).toLocaleString("ru-RU")}</div>
           <div style="font-size:15px;color:#0A3340">${(() => { const n = Number(j.sent), m = n % 100, k = n % 10; return m > 10 && m < 20 ? "компаний получили" : k === 1 ? "компания получила" : k >= 2 && k <= 4 ? "компании получили" : "компаний получили"; })()} ваше резюме</div>
         </td></tr></table>
         <p>Ответы компаний приходят на <b>${esc(o.reply_to || o.email)}</b> и появляются в личном кабинете — мы сообщим, как только придёт письмо.</p>
         ${Number(o.times) > Number(j.m) ? `<p>Следующая рассылка по вашему заказу пройдёт в выбранную вами дату — расписание в личном кабинете.</p>` : ""}`, "Личный кабинет", orderLink(o)),
    reply: (o, text, subject, attach) => toClient(o.email, subject || `Ответ менеджера по заказу №${o.num}`,
        `<p>Здравствуйте, ${esc(o.first_name || "")}!</p><p>${esc(text).replace(/\n/g, "<br>")}</p><p style="color:#5b727a;font-size:13.5px">Написать нам можно на странице заказа или в мессенджеры.</p>`, "Открыть заказ", orderLink(o), attach, true),
    free: (to, subject, text, attach) => toClient(to, subject, String(text).split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join(""), null, null, attach, true),
    newReplies: (o, n, live = n) => toClient(o.email, live ? `Ответ компании по заказу №${o.num}` : `Автоответы компаний по заказу №${o.num}`,
        `<p>Здравствуйте, ${esc(o.first_name || "")}!</p><p>${live ? `На вашу рассылку пришл${n === 1 ? "о новое письмо" : "и новые письма"} от компаний (${n}${n > live ? `, из них ${live} — живые ответы` : ""}).` : `На вашу рассылку пришли автоответы компаний (${n}): «получено», «нет на месте» и т. п. Это нормально — письма дошли.`} Прочитать ${n === 1 ? "его" : "их"} можно в личном кабинете.</p>
         <p style="color:#5b727a;font-size:13.5px">Отвечать компаниям лучше со своей личной почты — на ту, с которой вам написали.</p>`, "Открыть ответы", orderLink(o)),
    coverDraft: (o, subject, text) => toClient(o.email, `Ваше персональное письмо готово — подтвердите, заказ №${o.num}`,
        `<p>Здравствуйте, ${esc(o.first_name || "")}!</p><p>Мы составили для вас персональное сопроводительное письмо. Вот как оно выглядит:</p>
         <div style="margin:16px 0;padding:16px 18px;border:1px solid #d5e3e6;border-radius:12px;background:#f6fafb"><div style="font-size:13px;color:#5b727a">Тема письма</div><div style="font-weight:700;margin:2px 0 12px">${esc(subject)}</div><div style="font-size:13px;color:#5b727a">Текст письма</div><div style="margin-top:4px">${esc(text).replace(/\n/g, "<br>")}</div></div>
         <p><b>Рассылка начнётся только после вашего подтверждения.</b> Откройте личный кабинет, проверьте письмо и нажмите «Подтвердить». Нужны правки — поправьте текст там же или напишите менеджеру.</p>`, "Проверить и подтвердить", orderLink(o)),
    preview: (o, L, file) => toClient(o.email, `Как будет выглядеть ваша рассылка — заказ №${o.num}`,
        `<p>Здравствуйте, ${esc(o.first_name || "")}!</p><p>Всё готово к рассылке по заказу <b>№${o.num}</b>. Ниже — письмо ровно в том виде, в каком его получат работодатели${file ? `; резюме <b>${esc(file)}</b> прикладывается к нему файлом` : ""}.</p>
         <div style="margin:16px 0;padding:16px 18px;border:1px solid #d5e3e6;border-radius:12px;background:#f6fafb"><div style="font-size:13px;color:#5b727a">Тема письма</div><div style="font-weight:700;margin:2px 0 12px">${esc(L.subject)}</div><div style="font-size:13px;color:#5b727a">Текст письма</div><div style="margin-top:4px">${esc(L.text).replace(/\n/g, "<br>")}</div></div>
         <p><b>Хотите что-то поменять?</b> Тему, текст письма и резюме можно изменить в личном кабинете — новый вариант уйдёт во всех ещё не отправленных письмах.</p>`, "Открыть личный кабинет", orderLink(o)),
    cvReady: o => toClient(o.email, `Резюме по заказу №${o.num} готово${o.base ? " — проверьте и подтвердите" : ""}`,
        o.base ? `<p>Ваше резюме «Стандарт» готово. Скачать его можно в личном кабинете — нажмите кнопку ниже и внимательно проверьте.</p>
         <p><b>Рассылка начнётся только после вашего подтверждения:</b> всё верно — нажмите в кабинете «Подтвердить резюме». Нужна правка — напишите нам там же внизу страницы, одна правка входит в стоимость.</p>
         ${o.email_ok ? "" : `<p style="color:#8a5a00">Также рассылка не начнётся, пока не подтверждён ваш e-mail — нажмите кнопку в нашем первом письме.</p>`}`
        : `<p>Ваше резюме «Стандарт» готово — скачать файл можно в личном кабинете. Если нужна правка, напишите нам: одна правка входит в стоимость.</p>`, "Личный кабинет", orderLink(o))
};

/* уведомление владельцу: письмо на OWNER_EMAIL + (если заданы ADMIN_HOOK_URL и ADMIN_HOOK_KEY) копия в админ-бот. Клиентам бот нигде не показывается. */
async function toBot(text, id){
    const url = env("ADMIN_HOOK_URL"), key = env("ADMIN_HOOK_KEY"); if(!url || key.length < 16) return;
    try { const r = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json", "x-hook-key": key}, body: JSON.stringify({text: String(text).slice(0, 3500), id: id || ""}), signal: AbortSignal.timeout(15000)}); if(!r.ok) console.error("admin-hook:", r.status); }
    catch(e){ console.error("admin-hook:", e.message); }
}
async function owner(text, id){
    toBot(text, id);
    const subj = text.split("\n")[0].slice(0, 120);
    if(env("OWNER_EMAIL")) await send(env("OWNER_EMAIL"), subj, `<pre style="font:14px/1.5 Arial,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`, text).catch(() => {});
    console.log("🔔", text.replace(/\n/g, " | "));
}

module.exports = {toBot, esc, siteUrl, phone, WA, TGL, rub, orderLink, T, owner, send, layout};
