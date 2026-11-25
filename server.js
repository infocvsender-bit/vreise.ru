"use strict";
/* Vreise.ru — сервер: сайт, заказы, CRM, рассылка. Только русский язык. */
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const openDb = require("./db.js"), makeEngine = require("./engine.js"), Mail = require("./mails.js"), M = require("./mailer.js"), C = require("./catalog.js"), P = require("./pages.js"), CRM = require("./crmpage.js"), Mask = require("./mask.js");
const {env} = M;

const PUB = path.join(__dirname, "public");
const MIME = {".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8"};
const uuid = () => crypto.randomUUID(), now = () => new Date().toISOString();
const MAX_FILE = 5 * 1024 * 1024;

/* ---------- мелочи ---------- */
const ipOf = req => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
const hits = new Map();
function limited(key, max, ms){
    const t = Date.now(), a = (hits.get(key) || []).filter(x => t - x < ms);
    if(a.length >= max){ hits.set(key, a); return true; }
    a.push(t); hits.set(key, a); return false;
}
setInterval(() => { const t = Date.now(); for(const [k, a] of hits) if(!a.some(x => t - x < 3600e3)) hits.delete(k); }, 600e3).unref();

const send = (res, code, body, type = "text/html; charset=utf-8", extra = {}) => {
    res.writeHead(code, {"Content-Type": type, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", ...extra});
    res.end(body);
};
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), "application/json; charset=utf-8", {"Cache-Control": "no-store"});
const redirect = (res, to, code = 302) => { res.writeHead(code, {Location: to}); res.end(); };
function body(req, limit = 9 * 1024 * 1024){
    return new Promise((ok, no) => {
        let n = 0; const ch = [];
        req.on("data", d => { n += d.length; if(n > limit){ no(Object.assign(new Error("слишком большой запрос"), {status: 413})); req.destroy(); } else ch.push(d); });
        req.on("end", () => { try { ok(ch.length ? JSON.parse(Buffer.concat(ch).toString("utf8")) : {}); } catch(e){ no(Object.assign(new Error("неверный формат запроса"), {status: 400})); } });
        req.on("error", no);
    });
}
function rawBody(req, limit){
    return new Promise((ok, no) => {
        let n = 0; const ch = [];
        req.on("data", d => { n += d.length; if(n > limit){ no(Object.assign(new Error("файл слишком большой"), {status: 413})); req.destroy(); } else ch.push(d); });
        req.on("end", () => ok(Buffer.concat(ch)));
        req.on("error", no);
    });
}
const clean = (s, n = 300) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, n);
const LATIN = /^[A-Za-z][A-Za-z' .-]*$/, PHONE_OK = v => /^\+\d{9,15}$/.test(String(v).replace(/[\s()-]/g, ""));
const ENG = ["Elementary", "Pre-Intermediate", "Intermediate", "Upper-Intermediate", "Advanced"];
const DOC_EXT = /\.(pdf|docx?|rtf|odt|xlsx?|ods|txt|jpe?g|png|webp)$/i, DOC_MAX = 15 * 1024 * 1024, DOC_TOTAL = 100 * 1024 * 1024, DOC_COUNT = 25;
/* анкета для резюме «Стандарт»: проверка и очистка */
function cvDetails(b, first, last){
    const d = b.details && typeof b.details === "object" ? b.details : {}, c = (k, n = 200) => clean(d[k], n);
    if(!LATIN.test(first) || !LATIN.test(last)) return {error: "Имя и фамилию укажите на английском (латиницей), как в паспорте моряка"};
    const o = {linkedin: c("linkedin"), messengers: (Array.isArray(d.messengers) ? d.messengers : []).filter(x => ["WhatsApp", "Telegram", "Viber"].includes(x)),
        location: c("location"), dob: c("dob", 10), english: c("english", 30), minSalary: c("minSalary", 12), school: c("school"), vesselExp: c("vesselExp"), engines: c("engines"),
        eyes: c("eyes", 40), height: c("height", 6), weight: c("weight", 6), overall: c("overall", 12), shoe: c("shoe", 6), nokName: c("nokName", 80), nokRel: c("nokRel", 60), nokPhone: c("nokPhone", 30)};
    const need = {location: "местонахождение", dob: "дату рождения", english: "уровень английского", school: "учебное заведение", vesselExp: "суда, на которых есть опыт", eyes: "цвет глаз", height: "рост",
        weight: "вес", overall: "размер робы", shoe: "размер обуви", nokName: "ближайшего родственника", nokRel: "кем приходится родственник", nokPhone: "телефон родственника"};
    for(const k in need) if(!o[k]) return {error: "Заполните: " + need[k]};
    if(!o.messengers.length) return {error: "Отметьте мессенджеры на номере"};
    if(!ENG.includes(o.english)) return {error: "Выберите уровень английского"};
    const age = (Date.now() - Date.parse(o.dob)) / 31557600e3; if(!(age >= 16 && age <= 80)) return {error: "Проверьте дату рождения"};
    if(!PHONE_OK(b.phone)) return {error: "Телефон укажите с кодом страны, например +7 900 000 00 00"};
    if(!PHONE_OK(o.nokPhone)) return {error: "Телефон родственника укажите с кодом страны"};
    return {d: o};
}

/* ---------- CRM: вход по паролю, cookie с подписью ---------- */
const secret = () => env("CRM_SECRET") || env("CRM_PASSWORD") + "|vreise";
const sign = v => crypto.createHmac("sha256", secret()).update(v).digest("hex");
const cookieOf = req => Object.fromEntries(String(req.headers.cookie || "").split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
function crmAuthed(req){
    if(!env("CRM_PASSWORD")) return false;
    const [exp, sig] = String(cookieOf(req).vr_crm || "").split(".");
    if(!exp || !sig || Number(exp) < Date.now()) return false;
    const a = Buffer.from(sig), b = Buffer.from(sign(exp));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const passOk = p => { const a = crypto.createHash("sha256").update(String(p)).digest(), b = crypto.createHash("sha256").update(env("CRM_PASSWORD")).digest(); return crypto.timingSafeEqual(a, b); };

/* ---------- CSV базы ---------- */
function csvLine(line, d = ","){
    const out = []; let cur = "", q = false;
    for(let i = 0; i < line.length; i++){
        const ch = line[i];
        if(q){ if(ch === '"'){ if(line[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += ch; }
        else if(ch === '"') q = true; else if(ch === d){ out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur); return out.map(x => x.trim());
}
const EMAIL = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[a-z]{2,}$/i;
function parseBase(text, defaultBase){
    const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
    if(!lines.length) return [];
    let cols = null, start = 0;
    const l0 = lines[0], d = l0.includes(",") ? "," : l0.includes("\t") ? "\t" : /@[^;]*;/.test(l0) || /^[^@]*;[^@]*$/.test(l0) ? ";" : ",";
    const first = csvLine(l0, d).map(x => x.toLowerCase());
    if(first.includes("email") || first.includes("e-mail")){ cols = first.map(x => x === "e-mail" ? "email" : x); start = 1; }
    const out = [];
    for(const l of lines.slice(start)){
        const f = csvLine(l, d);
        let r;
        if(cols){ r = {}; cols.forEach((c, i) => r[c] = f[i] || ""); }
        else r = {email: f[0], company: f[1] || ""};
        const email = String(r.email || "").trim().toLowerCase(); if(!EMAIL.test(email)) continue;
        const bases = [...new Set(String(r.bases || "").split(/[;,\s]+/).filter(Boolean).concat(defaultBase ? [defaultBase] : []))];
        if(!bases.length) continue;
        out.push({email, company: clean(r.company, 120), country: clean(r.country, 60), fleets: clean(r.fleets, 120), bases: bases.join(";")});
    }
    return out;
}

/* ---------- запуск ---------- */
(async () => {
    const db = await openDb(), engine = makeEngine(db), q = (s, p) => db.query(s, p), one = (s, p) => db.one(s, p);
    let counts = null, countsAt = 0;
    const getCounts = async () => { if(!counts || Date.now() - countsAt > 300e3){ counts = await engine.baseCounts(); countsAt = Date.now(); } return counts; };
    const byToken = t => one(`SELECT * FROM orders WHERE token = $1`, [clean(t, 80)]);
    const ORDER_LIST = `id, num, email_ok, token, kind, slug, title, base, times, price, status, first_name, last_name, email, phone, position, vessel, created_at, claimed_at, paid_at, done_at, cv_name, res_name`;

    /* ---------- сайт ---------- */
    async function site(req, res, u){
        const p = u.pathname.replace(/\/+$/, "") || "/";
        if(p === "/health") return send(res, 200, "ok", "text/plain");
        if(p === "/robots.txt") return send(res, 200, `User-agent: *\nDisallow: /crm\nDisallow: /o/\nDisallow: /api/\nDisallow: /order\nSitemap: ${Mail.siteUrl()}/sitemap.xml\n`, "text/plain; charset=utf-8");
        if(p === "/sitemap.xml"){
            const s = Mail.siteUrl(), urls = ["/", "/policy", "/offer"].map(x => `<url><loc>${s}${x === "/" ? "" : x}</loc></url>`).join("");
            return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, "application/xml; charset=utf-8");
        }
        if(p === "/favicon.ico") return redirect(res, "/static/favicon.png", 301);
        if(p.startsWith("/static/")){
            const f = path.normalize(path.join(PUB, p.slice(8)));
            if(!f.startsWith(PUB + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return send(res, 404, "not found", "text/plain");
            return send(res, 200, fs.readFileSync(f), MIME[path.extname(f).toLowerCase()] || "application/octet-stream", {"Cache-Control": "public, max-age=86400"});
        }
        if(p === "/") return send(res, 200, P.home(await getCounts().catch(() => null)));
        if(p === "/order") return send(res, 200, P.orderForm(u.searchParams.get("s") || "", await getCounts().catch(() => null)));
        if(p === "/policy" || p === "/offer") return send(res, 200, P.legal(p.slice(1)));

        let m = p.match(/^\/o\/([A-Za-z0-9_-]{10,80})\/confirm$/);
        if(m){
            const o = await byToken(m[1]); if(!o) return send(res, 404, P.notFound());
            if(!o.email_ok){ await q(`UPDATE orders SET email_ok = $1 WHERE id = $2`, [now(), o.id]); await engine.note(o.id, "E-mail подтверждён клиентом", "Клиент"); }
            return redirect(res, "/o/" + o.token);
        }
        m = p.match(/^\/o\/([A-Za-z0-9_-]{10,80})(\/file)?$/);
        if(m){
            const o = await byToken(m[1]); if(!o) return send(res, 404, P.notFound());
            if(m[2]){
                if(!o.res_b64) return send(res, 404, P.notFound());
                return send(res, 200, Buffer.from(o.res_b64, "base64"), M.mimeOf(o.res_name || "cv.pdf"),
                    {"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(o.res_name || "cv.pdf")}`, "Cache-Control": "no-store"});
            }
            const jobs = await q(`SELECT * FROM jobs WHERE order_id = $1 ORDER BY m`, [o.id]);
            const msgs = await q(`SELECT at, author, text FROM notes WHERE order_id = $1 AND author IN ('Сообщение клиента', 'Ответ менеджера') ORDER BY at`, [o.id]);
            const sent = (jobs.length ? await q(`SELECT qu.company, qu.email, qu.sent_at FROM queue qu JOIN jobs j ON j.id = qu.job_id WHERE j.order_id = $1 AND qu.status = 'sent' ORDER BY qu.sent_at DESC LIMIT 200`, [o.id]) : []).map(r => ({company: Mask.maskCompany(r.company || ""), email: Mask.maskEmail(r.email), sent_at: r.sent_at}));
            const std = o.base ? {cur: engine.letterFor(o), def: engine.letterFor({...o, letter: "", subject: ""})} : null;
            const replies = o.base ? await q(`SELECT from_email, from_name, subject, text, kind, at FROM replies WHERE order_id = $1 ORDER BY at DESC LIMIT 100`, [o.id]) : [];
            return send(res, 200, P.orderPage(o, jobs, sent, msgs, std, replies), "text/html; charset=utf-8", {"Cache-Control": "no-store"});
        }
        return send(res, 404, P.notFound());
    }

    /* ---------- публичные API ---------- */
    async function publicApi(req, res, u){
        const p = u.pathname;
        if(req.method === "POST" && p === "/api/order"){
            const ip = ipOf(req);
            if(limited("order:" + ip, 6, 3600e3)) return json(res, 429, {error: "Слишком много заказов с вашего адреса. Попробуйте позже или напишите нам в WhatsApp."});
            const b = await body(req);
            if(b.hp) return json(res, 200, {url: "/"});                           // ловушка для ботов
            const sv = C.bySlug(clean(b.slug, 80)); if(!sv) return json(res, 400, {error: "Выберите услугу"});
            const email = clean(b.email, 120).toLowerCase(), first = clean(b.first, 60), last = clean(b.last, 60);
            if(!first || !last) return json(res, 400, {error: "Укажите имя и фамилию"});
            if(!EMAIL.test(email)) return json(res, 400, {error: "Укажите корректный e-mail"});
            if(!b.agree) return json(res, 400, {error: "Нужно согласие с офертой и политикой конфиденциальности"});
            let cvName = "", cvB64 = "";
            if(b.file && b.file.b64){
                cvName = clean(b.file.name, 120) || "resume.pdf"; cvB64 = String(b.file.b64).replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
                if(!/^[A-Za-z0-9+/=]+$/.test(cvB64) || Buffer.from(cvB64, "base64").length > MAX_FILE) return json(res, 400, {error: "Файл слишком большой (до 5 МБ) или повреждён"});
                if(!/\.(pdf|docx?|jpe?g|png)$/i.test(cvName)) return json(res, 400, {error: "Допустимы файлы PDF, Word, JPG или PNG"});
            }
            if(sv.kind === "mailing" && !cvB64) return json(res, 400, {error: "Загрузите ваше резюме (PDF или Word)"});
            let details = null, price = sv.price, title = sv.title, base = sv.base || null, times = sv.times || 1, extra = null;
            if(sv.kind === "cv"){
                const v = cvDetails(b, first, last); if(v.error) return json(res, 400, {error: v.error});
                if(!clean(b.position, 160) || !clean(b.vessel, 300)) return json(res, 400, {error: "Выберите должность и вид судов"});
                details = JSON.stringify(v.d);
                if(b.addon && b.addon.base){
                    const ms = C.bySlug(`rassylka-${Number(b.addon.times) || 1}-${clean(b.addon.base, 40)}`); if(!ms) return json(res, 400, {error: "Выберите рассылку"});
                    base = ms.base; times = ms.times; price = sv.price + C.addonPrice(ms.price);
                    title = `${sv.title} + рассылка ${C.TIMES[ms.times - 1]} · ${C.baseOf(ms.base).name} (−${C.discPct()}%)`;
                }
            } else if(b.extra){
                const eb = C.baseOf(clean(b.extra, 40)); if(!eb || eb.key === sv.base) return json(res, 400, {error: "Выберите дополнительную базу"});
                extra = eb.key; price = sv.price + C.addonPrice(C.priceOf(eb, sv.times));
                title = `${sv.title} + «${eb.name}» (доп. база −${C.discPct()}%)`;
            }
            const id = uuid(), token = crypto.randomBytes(18).toString("base64url");
            let o;
            for(let k = 0; k < 5 && !o; k++){
                const num = Number((await one(`SELECT COALESCE(MAX(num), 1000) + 1 AS n FROM orders`)).n);
                try {
                    await q(`INSERT INTO orders(id, num, token, kind, slug, title, base, times, price, status, first_name, last_name, email, phone, position, vessel, letter, exclude, comment, cv_name, cv_b64, ip, created_at, details, extra_base)
                        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'new',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
                        [id, num, token, sv.kind, sv.slug, title, base, times, price, first, last, email, clean(b.phone, 40), clean(b.position, 160), clean(b.vessel, 300),
                         sv.kind === "mailing" ? clean(b.letter, 4000) : "", base ? clean(b.exclude, 1500) : "", sv.kind === "cv" ? clean(b.comment, 6000) : "", cvName, cvB64, ip, now(), details, extra]);
                    o = await one(`SELECT * FROM orders WHERE id = $1`, [id]);
                } catch(e){ if(!/unique|duplicate/i.test(e.message)) throw e; }
            }
            if(!o) return json(res, 500, {error: "Не удалось создать заказ, попробуйте ещё раз"});
            Mail.T.confirm(o).catch(() => {});
            Mail.owner(`🆕 Новый заказ №${o.num}\n${o.title} · ${Mail.rub(o.price)}\n${first} ${last} · ${email}${o.phone ? " · " + o.phone : ""}`);
            return json(res, 200, {url: "/o/" + o.token, id: o.id, token: o.token});
        }
        let m = p.match(/^\/api\/order\/([\w-]{10,60})\/doc$/);
        if(req.method === "POST" && m){
            if(limited("doc:" + ipOf(req), 80, 3600e3)) return json(res, 429, {error: "Слишком много файлов, попробуйте позже"});
            const o = await one(`SELECT id, token, kind, status FROM orders WHERE id = $1`, [m[1]]);
            if(!o || o.kind !== "cv" || o.token !== u.searchParams.get("t") || o.status === "cancelled") return json(res, 404, {error: "Заказ не найден"});
            const name = clean(decodeURIComponent(String(req.headers["x-name"] || "document")), 120) || "document";
            if(!DOC_EXT.test(name)) return json(res, 400, {error: "Этот тип файла не принимаем"});
            const st = await one(`SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS s FROM order_docs WHERE order_id = $1`, [o.id]);
            if(Number(st.n) >= DOC_COUNT) return json(res, 400, {error: "Слишком много файлов"});
            const buf = await rawBody(req, DOC_MAX);
            if(!buf.length) return json(res, 400, {error: "Пустой файл"});
            if(Number(st.s) + buf.length > DOC_TOTAL) return json(res, 400, {error: "Превышен общий размер файлов"});
            await q(`INSERT INTO order_docs(id, order_id, name, size, b64, added_at) VALUES($1,$2,$3,$4,$5,$6)`, [uuid(), o.id, name, buf.length, buf.toString("base64"), now()]);
            return json(res, 200, {ok: true});
        }
        m = p.match(/^\/api\/order\/([\w-]{10,60})\/docs-done$/);
        if(req.method === "POST" && m){
            const o = await one(`SELECT * FROM orders WHERE id = $1`, [m[1]]);
            if(!o || o.token !== u.searchParams.get("t") || limited("docsdone:" + o.id, 3, 3600e3)) return json(res, 200, {ok: true});
            const n = Number((await one(`SELECT COUNT(*) AS n FROM order_docs WHERE order_id = $1`, [o.id])).n);
            if(n){ await engine.note(o.id, `Клиент приложил файлов: ${n}`, "Клиент"); Mail.owner(`📎 К заказу №${o.num} приложено файлов: ${n}\n${Mail.siteUrl()}/crm`); }
            return json(res, 200, {ok: true});
        }
        m = p.match(/^\/api\/o\/([A-Za-z0-9_-]{10,80})\/claim$/);
        if(req.method === "POST" && m){
            if(limited("claim:" + ipOf(req), 20, 3600e3)) return json(res, 429, {error: "Слишком много запросов"});
            const o = await byToken(m[1]); if(!o) return json(res, 404, {error: "Заказ не найден"});
            if(o.status !== "new") return json(res, 200, {ok: true});
            await q(`UPDATE orders SET status = 'claimed', claimed_at = $1 WHERE id = $2 AND status = 'new'`, [now(), o.id]);
            await engine.note(o.id, "Клиент нажал «Я оплатил(а)»", "Клиент");
            Mail.owner(`💳 Клиент сообщил об оплате\nЗаказ №${o.num} · ${Mail.rub(o.price)}\n${o.first_name || ""} ${o.last_name || ""} · ${o.email}\nПроверьте карту и подтвердите в CRM: ${Mail.siteUrl()}/crm`);
            return json(res, 200, {ok: true});
        }
        m = p.match(/^\/api\/o\/([A-Za-z0-9_-]{10,80})\/resend$/);
        if(req.method === "POST" && m){
            if(limited("resend:" + m[1], 3, 3600e3)) return json(res, 429, {error: "Письмо уже отправлено несколько раз — проверьте папку «Спам» или напишите менеджеру."});
            const o = await byToken(m[1]); if(!o) return json(res, 404, {error: "Заказ не найден"});
            if(o.email_ok) return json(res, 200, {ok: true});
            Mail.T.confirm(o).catch(() => {}); return json(res, 200, {ok: true});
        }
        m = p.match(/^\/api\/o\/([A-Za-z0-9_-]{10,80})\/letter$/);
        if(req.method === "POST" && m){
            if(limited("letter:" + m[1], 30, 3600e3)) return json(res, 429, {error: "Слишком много изменений, попробуйте позже"});
            const o = await byToken(m[1]); if(!o || !o.base) return json(res, 404, {error: "Заказ не найден"});
            if(o.status === "cancelled") return json(res, 400, {error: "Заказ отменён"});
            if(await one(`SELECT id FROM jobs WHERE order_id = $1 AND status = 'run'`, [o.id])) return json(res, 400, {error: "Рассылка идёт — письмо можно изменить после её окончания, для следующих рассылок."});
            const b = await body(req, 40000), std = engine.letterFor({...o, letter: "", subject: ""});
            let subject = clean(b.subject, 200).replace(/[\r\n]+/g, " "), text = String(b.text ?? "").replace(/\r/g, "").trim().slice(0, 4000);
            if(b.reset){ subject = ""; text = ""; }
            else { if(text.length < 20) return json(res, 400, {error: "Письмо слишком короткое — напишите хотя бы пару предложений"}); if(!subject) return json(res, 400, {error: "Укажите тему письма"});
                if(text.replace(/\s+/g, " ") === std.text.replace(/\s+/g, " ")) text = ""; if(subject === std.subject) subject = ""; }
            await q(`UPDATE orders SET letter = $1, subject = $2, letter_ok = $3 WHERE id = $4`, [text, subject, now(), o.id]);
            await engine.note(o.id, b.reset ? "Клиент вернул стандартное письмо" : "Клиент изменил тему и текст письма", "Клиент");
            return json(res, 200, {ok: true});
        }
        m = p.match(/^\/api\/o\/([A-Za-z0-9_-]{10,80})\/message$/);
        if(req.method === "POST" && m){
            if(limited("msg:" + m[1], 10, 3600e3)) return json(res, 429, {error: "Слишком много сообщений. Напишите нам в WhatsApp или Telegram."});
            const o = await byToken(m[1]); if(!o) return json(res, 404, {error: "Заказ не найден"});
            const text = clean((await body(req, 20000)).text, 1500); if(text.length < 2) return json(res, 400, {error: "Напишите сообщение"});
            await engine.note(o.id, text, "Сообщение клиента");
            Mail.owner(`💬 Сообщение от клиента\nЗаказ №${o.num} · ${o.first_name || ""} ${o.last_name || ""} · ${o.email}\n\n${text}\n\nОтветить: ${Mail.siteUrl()}/crm`);
            return json(res, 200, {ok: true});
        }
        return json(res, 404, {error: "not found"});
    }

    /* ---------- CRM ---------- */
    async function crmApi(req, res, u){
        const p = u.pathname.replace(/^\/crm\/api/, ""), who = "Владелец";
        let m;
        if(req.method === "GET" && p === "/orders"){
            const st = clean(u.searchParams.get("status"), 20), s = clean(u.searchParams.get("q"), 80).toLowerCase();
            let rows = await q(`SELECT ${ORDER_LIST} FROM orders ORDER BY num DESC LIMIT 500`);
            if(st) rows = rows.filter(r => r.status === st);
            if(s) rows = rows.filter(r => [r.num, r.email, r.first_name, r.last_name, r.phone].join(" ").toLowerCase().includes(s));
            const pr = await q(`SELECT order_id, SUM(sent) AS s, SUM(total) AS t, SUM(failed) AS f FROM jobs GROUP BY order_id`), pm = Object.fromEntries(pr.map(r => [r.order_id, r]));
            for(const r of rows){ const x = pm[r.id]; r.sent = x ? Number(x.s) : 0; r.total = x ? Number(x.t) : 0; r.failed = x ? Number(x.f) : 0; }
            const sum = await q(`SELECT status, COUNT(*) AS n FROM orders GROUP BY status`);
            return json(res, 200, {orders: rows, summary: Object.fromEntries(sum.map(r => [r.status, Number(r.n)]))});
        }
        if(req.method === "GET" && (m = p.match(/^\/orders\/([\w-]+)$/))){
            const o = await one(`SELECT ${ORDER_LIST}, letter, exclude, comment, details, extra_base FROM orders WHERE id = $1`, [m[1]]); if(!o) return json(res, 404, {error: "нет заказа"});
            const jobs = await q(`SELECT * FROM jobs WHERE order_id = $1 ORDER BY m`, [o.id]);
            for(const j of jobs){
                j.wait = Number((await one(`SELECT COUNT(*) AS n FROM queue WHERE job_id = $1 AND status = 'wait'`, [j.id])).n);
                j.fails = await q(`SELECT email, error FROM queue WHERE job_id = $1 AND status = 'fail' LIMIT 30`, [j.id]);
            }
            const notes = await q(`SELECT at, author, text FROM notes WHERE order_id = $1 ORDER BY at DESC LIMIT 100`, [o.id]);
            const boxes = await q(`SELECT email, sent, active, last_error, deleted_at FROM boxes WHERE order_id = $1 ORDER BY created_at`, [o.id]);
            const sent = await q(`SELECT qu.company, qu.email, qu.country, qu.status, qu.error, qu.sent_at, j.m FROM queue qu JOIN jobs j ON j.id = qu.job_id WHERE j.order_id = $1 AND qu.status IN ('sent','fail') ORDER BY qu.sent_at DESC LIMIT 1000`, [o.id]);
            const docs = await q(`SELECT id, name, size FROM order_docs WHERE order_id = $1 ORDER BY added_at`, [o.id]);
            let det = null; try { det = o.details ? JSON.parse(o.details) : null; } catch(e){} delete o.details;
            const replies = await q(`SELECT from_email, from_name, subject, text, kind, at FROM replies WHERE order_id = $1 ORDER BY at DESC LIMIT 200`, [o.id]);
            return json(res, 200, {order: o, details: det, docs, replies, sent, jobs, notes, boxes, link: Mail.orderLink(o)});
        }
        if(req.method === "GET" && (m = p.match(/^\/orders\/([\w-]+)\/doc\/([\w-]+)$/))){
            const d = await one(`SELECT name, b64 FROM order_docs WHERE id = $1 AND order_id = $2`, [m[2], m[1]]); if(!d) return json(res, 404, {error: "файла нет"});
            return send(res, 200, Buffer.from(d.b64, "base64"), M.mimeOf(d.name), {"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`});
        }
        if(req.method === "GET" && (m = p.match(/^\/orders\/([\w-]+)\/sent\.csv$/))){
            const rows = await q(`SELECT j.m, qu.sent_at, qu.status, qu.company, qu.country, qu.email, qu.error FROM queue qu JOIN jobs j ON j.id = qu.job_id WHERE j.order_id = $1 AND qu.status IN ('sent','fail') ORDER BY j.m, qu.sent_at`, [m[1]]);
            const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
            const csv = "\ufeff" + ["рассылка;время;статус;компания;страна;email;ошибка"].concat(rows.map(r => [r.m, r.sent_at || "", r.status === "sent" ? "отправлено" : "ошибка", r.company, r.country, r.email, r.error].map(cell).join(";"))).join("\r\n");
            return send(res, 200, csv, "text/csv; charset=utf-8", {"Content-Disposition": `attachment; filename="sent-${m[1].slice(0, 8)}.csv"`});
        }
        if(req.method === "GET" && (m = p.match(/^\/orders\/([\w-]+)\/(cv|res)$/))){
            const o = await one(`SELECT cv_name, cv_b64, res_name, res_b64 FROM orders WHERE id = $1`, [m[1]]); const name = o && o[m[2] + "_name"], b64 = o && o[m[2] + "_b64"];
            if(!b64) return json(res, 404, {error: "файла нет"});
            return send(res, 200, Buffer.from(b64, "base64"), M.mimeOf(name), {"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`});
        }
        if(req.method === "POST" && (m = p.match(/^\/orders\/([\w-]+)\/(confirm|cancel|note|result)$/))){
            const o = await one(`SELECT * FROM orders WHERE id = $1`, [m[1]]); if(!o) return json(res, 404, {error: "нет заказа"});
            const b = await body(req);
            if(m[2] === "confirm"){
                if(!["new", "claimed"].includes(o.status)) return json(res, 400, {error: "Заказ уже не ожидает оплаты"});
                await q(`UPDATE orders SET status = 'paid', paid_at = $1 WHERE id = $2`, [now(), o.id]);
                await engine.note(o.id, "Оплата подтверждена", who);
                Mail.T.paid({...o, status: "paid"}).catch(() => {});
                await engine.startOrder({...o, status: "paid"}, who);
            } else if(m[2] === "cancel"){
                if(["done", "cancelled"].includes(o.status)) return json(res, 400, {error: "Заказ уже закрыт"});
                await q(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [o.id]);
                await q(`UPDATE jobs SET status = 'stop', finished_at = $1 WHERE order_id = $2 AND status IN ('wait','run','pause')`, [now(), o.id]);
                await engine.note(o.id, "Заказ отменён", who);
            } else if(m[2] === "note"){
                const t = clean(b.text, 1000); if(!t) return json(res, 400, {error: "пустая заметка"});
                await engine.note(o.id, t, who);
            } else {
                if(o.kind !== "cv") return json(res, 400, {error: "Файл результата — только для резюме"});
                if(!["paid", "in_progress", "done"].includes(o.status)) return json(res, 400, {error: "Сначала подтвердите оплату"});
                const name = clean(b.name, 120), b64 = String(b.b64 || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
                if(!name || !/^[A-Za-z0-9+/=]+$/.test(b64) || Buffer.from(b64, "base64").length > 8 * 1024 * 1024) return json(res, 400, {error: "Файл не принят (до 8 МБ)"});
                const withMail = !!o.base && !(await one(`SELECT id FROM jobs WHERE order_id = $1`, [o.id]));
                await q(`UPDATE orders SET res_name = $1, res_b64 = $2, status = $3, done_at = $4 WHERE id = $5`, [name, b64, withMail || o.base ? "in_progress" : "done", o.base ? null : now(), o.id]);
                await engine.note(o.id, `Готовое резюме загружено: ${name}`, who);
                if(b.notify !== false) Mail.T.cvReady(o).catch(() => {});
                if(withMail) await engine.startOrder({...o, res_name: name, res_b64: b64, status: "in_progress"}, who, {resume: true});
            }
            return json(res, 200, {ok: true});
        }
        if(req.method === "POST" && (m = p.match(/^\/orders\/([\w-]+)\/email-ok$/))){
            const o = await one(`SELECT id FROM orders WHERE id = $1`, [m[1]]); if(!o) return json(res, 404, {error: "нет заказа"});
            await q(`UPDATE orders SET email_ok = $1 WHERE id = $2 AND email_ok IS NULL`, [now(), o.id]); await engine.note(o.id, "E-mail отмечен подтверждённым вручную", who);
            return json(res, 200, {ok: true});
        }
        if(req.method === "POST" && (m = p.match(/^\/orders\/([\w-]+)\/reply$/))){
            const o = await one(`SELECT * FROM orders WHERE id = $1`, [m[1]]); if(!o) return json(res, 404, {error: "нет заказа"});
            const rb = await body(req, 20000), text = clean(rb.text, 5000), subject = clean(rb.subject, 150).replace(/[\r\n]+/g, " "); if(!text) return json(res, 400, {error: "Пустой ответ"});
            await engine.note(o.id, subject ? `${subject}\n${text}` : text, "Ответ менеджера");
            Mail.T.reply(o, text, subject).catch(() => {});
            return json(res, 200, {ok: true});
        }
        if(req.method === "POST" && (m = p.match(/^\/jobs\/([\w-]+)\/(pause|resume|stop|retry)$/))){
            const j = await one(`SELECT * FROM jobs WHERE id = $1`, [m[1]]); if(!j) return json(res, 404, {error: "нет задания"});
            await engine.jobCtl(j, m[2], who); return json(res, 200, {ok: true});
        }
        if(req.method === "GET" && p === "/bases"){
            counts = null; const c = await getCounts();
            return json(res, 200, {total: c.total, byBase: c.byBase, bases: C.BASES.filter(b => b.key !== "tanker-rossiya").map(b => ({key: b.key, name: b.name}))});
        }
        if(req.method === "POST" && p === "/bases/import"){
            const b = await body(req), def = clean(b.base, 40), rows = parseBase(b.text, def);
            if(def && (!C.baseOf(def) || def === "tanker-rossiya") && def !== "tanker") return json(res, 400, {error: "Неизвестная база"});
            if(!rows.length) return json(res, 400, {error: "Не нашёл ни одного адреса. Нужен список e-mail (по одному в строке) или CSV с колонкой email и выбранная база."});
            let added = 0, updated = 0;
            for(const r of rows){
                const ex = await one(`SELECT bases, company, country, fleets FROM base_rows WHERE email = $1`, [r.email]);
                if(!ex){ await q(`INSERT INTO base_rows(email, company, country, fleets, bases, added_at) VALUES($1,$2,$3,$4,$5,$6)`, [r.email, r.company, r.country, r.fleets, r.bases, now()]); added++; }
                else {
                    const merged = [...new Set(String(ex.bases || "").split(/[;,\s]+/).filter(Boolean).concat(r.bases.split(";")))].join(";");
                    await q(`UPDATE base_rows SET bases = $1, company = $2, country = $3, fleets = $4 WHERE email = $5`, [merged, ex.company || r.company, ex.country || r.country, ex.fleets || r.fleets, r.email]); updated++;
                }
            }
            counts = null; return json(res, 200, {ok: true, added, updated, rows: rows.length});
        }
        if(req.method === "POST" && p === "/bases/clear"){
            const b = await body(req); if(b.confirm !== "очистить") return json(res, 400, {error: "Для очистки введите слово «очистить»"});
            await q(`DELETE FROM base_rows`); counts = null; return json(res, 200, {ok: true});
        }
        if(req.method === "GET" && p === "/servers"){
            const act = await q(`SELECT domain, COUNT(*) AS n, SUM(sent) AS sent FROM boxes WHERE deleted_at IS NULL AND active = 1 GROUP BY domain`);
            return json(res, 200, {servers: M.cfgs().map(c => ({domain: c.domain, host: c.smtp, port: c.port, skipped: !M.sendCfgs().some(x => x.domain === c.domain),
                boxes: Number((act.find(a => a.domain === c.domain) || {}).n || 0)})), system: M.sysOn(), owner: !!env("OWNER_EMAIL"), gap: Number(env("SEND_GAP_SEC")) || 20,
                pay: !!env("PAY_CARD"), phone: !!env("CONTACT_PHONE")});
        }
        if(req.method === "POST" && p === "/servers/test"){
            const b = await body(req), to = clean(b.to, 120);
            if(!EMAIL.test(to)) return json(res, 400, {error: "Укажите e-mail для теста"});
            try { return json(res, 200, {ok: true, domain: await engine.testSend(to)}); } catch(e){ return json(res, 500, {error: e.message}); }
        }
        if(req.method === "POST" && p === "/servers/test-system"){
            const b = await body(req), to = clean(b.to, 120);
            if(!EMAIL.test(to)) return json(res, 400, {error: "Укажите e-mail для теста"});
            const ok = await Mail.send(to, "Тест писем Vreise.ru", Mail.layout("Тест писем", "<p>Если вы видите это письмо, системная почта настроена верно.</p>"), "Если вы видите это письмо, системная почта настроена верно.");
            return json(res, ok ? 200 : 500, ok ? {ok: true} : {error: "Письмо не ушло — проверьте SYS_SMTP_* и логи"});
        }
        return json(res, 404, {error: "not found"});
    }

    /* ---------- маршрутизатор ---------- */
    const server = http.createServer(async (req, res) => {
        try {
            const u = new URL(req.url, "http://x");
            if(u.pathname === "/crm/login" && req.method === "POST"){
                if(!env("CRM_PASSWORD")) return json(res, 503, {error: "CRM_PASSWORD не задан в Railway"});
                if(limited("login:" + ipOf(req), 8, 600e3)) return json(res, 429, {error: "Слишком много попыток, подождите 10 минут"});
                const b = await body(req, 10000);
                if(!passOk(b.password || "")) return json(res, 401, {error: "Неверный пароль"});
                const exp = String(Date.now() + 30 * 864e5);
                res.setHeader("Set-Cookie", `vr_crm=${encodeURIComponent(exp + "." + sign(exp))}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 86400}${/^https/.test(Mail.siteUrl()) ? "; Secure" : ""}`);
                return json(res, 200, {ok: true});
            }
            if(u.pathname === "/crm/logout"){ res.setHeader("Set-Cookie", "vr_crm=; Path=/; Max-Age=0"); return redirect(res, "/crm"); }
            if(u.pathname === "/crm" || u.pathname === "/crm/") return send(res, 200, CRM.page(crmAuthed(req), !!env("CRM_PASSWORD")), "text/html; charset=utf-8", {"Cache-Control": "no-store", "X-Robots-Tag": "noindex"});
            if(u.pathname.startsWith("/crm/api/")){
                if(!crmAuthed(req)) return json(res, 401, {error: "Войдите в CRM"});
                if(req.method === "POST" && !/^https?:\/\/([^/]+)/.test(req.headers.origin || "http://" + req.headers.host)) return json(res, 403, {error: "origin"});
                return await crmApi(req, res, u);
            }
            if(u.pathname.startsWith("/api/")) return await publicApi(req, res, u);
            if(req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed", "text/plain");
            return await site(req, res, u);
        } catch(e){
            console.error("http:", req.method, req.url, e.message);
            if(!res.headersSent) json(res, e.status || 500, {error: e.status ? e.message : "Ошибка сервера"}); else res.end();
        }
    });
    server.requestTimeout = 60000;
    const port = Number(env("PORT")) || 3000;
    server.listen(port, () => { console.log(`✅ Vreise.ru на порту ${port} · БД: ${db.kind} · серверов рассылки: ${M.sendCfgs().length}`); engine.start(); });
    process.on("unhandledRejection", e => console.error("unhandled:", e && e.message || e));
})().catch(e => { console.error("СТАРТ НЕ УДАЛСЯ:", e); process.exit(1); });
