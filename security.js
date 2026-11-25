"use strict";
/* Защита сайта и CRM.
   • CRM (/crm, /crm/api/*) без секретной ссылки «не существует» (обычная страница 404). Ссылка с ключом меняется раз в CRM_ROTATE_DAYS дней
     (по умолчанию 7): новая приходит владельцу на OWNER_EMAIL и в админ-бот; старая перестаёт работать сразу. Дальше — ещё и пароль CRM.
   • Подбор: неверный ключ / пробы CRM / сканеры (.env, wp-admin, .git …) / подбор ссылок кабинетов / подбор пароля — бан IP.
   • Кабинет клиента: страница по длинному случайному токену, подбор токенов банится, страницы не индексируются, не кэшируются, Referer не передаётся.
   • Общие заголовки безопасности, проверка Origin у POST (CSRF), лимит запросов с одного адреса.
   Ключ и пароль нигде не пишутся в код: ключ хранится в базе (таблица meta), пароль — в переменной Railway CRM_PASSWORD. */
const crypto = require("crypto");
const {AsyncLocalStorage} = require("async_hooks");

/* адрес клиента: Railway подставляет X-Real-IP (и дописывает адрес в конец X-Forwarded-For). Первое значение X-Forwarded-For подделывается клиентом — ему не верим */
const ipOf = req => {
    const real = String(req.headers["x-real-ip"] || "").trim();
    if(real) return real;
    const xf = String(req.headers["x-forwarded-for"] || "").split(",").map(s => s.trim()).filter(Boolean);
    return xf.length ? xf[xf.length - 1] : String(req.socket.remoteAddress || "");
};
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); };
const cookieOf = req => Object.fromEntries(String(req.headers.cookie || "").split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf("="); try { return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; } catch(e){ return [c.slice(0, i), ""]; } }));

/* то, что ищут боты: .env, .git, админки WordPress / phpMyAdmin, shell-файлы … */
const SCAN = /(^|\/)(\.env[\w.-]*|\.git(\/|$)|\.svn|\.hg|\.aws|\.ssh|\.DS_Store|wp-(admin|login|content|includes|json)|xmlrpc\.php|wlwmanifest|phpmyadmin|pma|adminer|cgi-bin|actuator|vendor\/phpunit|\.well-known\/security\.txt\.bak|config\.(json|ya?ml|php|js)|backup[\w.-]*\.(zip|sql|tar|gz)|dump\.sql|database\.(sql|db)|id_rsa|server-status|boaform|setup\.cgi|shell\.php|eval-stdin|\.(php|asp|aspx|jsp|cgi)$)/i;

function create({one, q, now, Mail, env, siteUrl}){
    const als = new AsyncLocalStorage();
    const hits = new Map(), bans = new Map(), trusted = new Map(), alerted = new Map();
    const hit = (key, max, ms) => { const t = Date.now(), a = (hits.get(key) || []).filter(x => t - x < ms); a.push(t); hits.set(key, a); return a.length > max; };
    setInterval(() => { const t = Date.now(); for(const [k, a] of hits) if(!a.some(x => t - x < 24 * 3600e3)) hits.delete(k); for(const [k, v] of bans) if(v < t) bans.delete(k); for(const [k, v] of trusted) if(v < t) trusted.delete(k); }, 600e3).unref();

    const isTrusted = ip => (trusted.get(ip) || 0) > Date.now();
    const isBanned = ip => (bans.get(ip) || 0) > Date.now();
    const once = (k, min, fn) => { const t = alerted.get(k) || 0; if(Date.now() - t < min * 60e3) return; alerted.set(k, Date.now()); fn(); };
    function ban(ip, why, hours = 24){
        if(!ip || isTrusted(ip)) return;
        bans.set(ip, Date.now() + hours * 3600e3);
        console.log(`🛡 бан ${ip} на ${hours} ч: ${String(why).slice(0, 120)}`);
        logBan(ip, why, hours);                                  // сразу владельцу НЕ пишем — только сводка в конце дня (решение владельца 25.11)
    }
    /* сводка блокировок: копим в meta('ban_log'), раз в день (после 21:00 МСК) одним сообщением — письмо + админ-бот */
    let banLog = null;
    const mskDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10), mskHour = () => new Date(Date.now() + 3 * 3600e3).getUTCHours();
    async function loadLog(){ if(banLog) return banLog; let v = null; try { v = JSON.parse((await one(`SELECT value FROM meta WHERE key = 'ban_log'`))?.value || "null"); } catch(e){} banLog = v && Array.isArray(v.items) ? v : {items: [], sent: ""}; return banLog; }
    async function saveLog(){ try { await q(`DELETE FROM meta WHERE key = 'ban_log'`); await q(`INSERT INTO meta(key, value) VALUES('ban_log', $1)`, [JSON.stringify(banLog)]); } catch(e){} }
    function logBan(ip, why, hours){ loadLog().then(L => { L.items.push({at: Date.now(), ip, why: String(why).slice(0, 120), h: hours}); if(L.items.length > 500) L.items.splice(0, L.items.length - 500); return saveLog(); }).catch(() => {}); }
    async function digest(){
        const L = await loadLog(), day = mskDay(); if(L.sent === day || mskHour() < 21 || !L.items.length) return;
        const g = new Map(); for(const x of L.items){ const k = x.why.replace(/^(сканер): .*/, "$1"); const e = g.get(k) || {ips: new Set(), paths: new Set()}; e.ips.add(x.ip); const m = x.why.match(/^сканер: (.*)/); if(m) e.paths.add(m[1]); g.set(k, e); }
        const ips = new Set(L.items.map(x => x.ip));
        const lines = [...g.entries()].sort((a, b) => b[1].ips.size - a[1].ips.size).map(([k, e]) => `• ${k}: ${e.ips.size} адр.${e.paths.size ? " (" + [...e.paths].slice(0, 5).join(", ") + (e.paths.size > 5 ? "…" : "") + ")" : ""}`);
        L.items = []; L.sent = day; await saveLog();
        await Mail.owner(`🛡 Сводка защиты за день: заблокировано адресов — ${ips.size}\n${lines.join("\n")}\nВсе блокировки автоматические (24 ч), ничего делать не нужно.`).catch(() => {});
    }
    setInterval(() => { digest().catch(() => {}); }, 5 * 60e3).unref();
    const badToken = ip => { if(ip && hit("badtok:" + ip, 12, 3600e3)) ban(ip, "подбор ссылок кабинетов клиентов"); };

    /* ---------- секретная ссылка CRM ---------- */
    let KEY = "";
    const days = () => { const v = env("CRM_ROTATE_DAYS"); return v === "" ? 7 : Math.max(0, Number(v) || 0); };
    const link = () => `${siteUrl().replace(/\/+$/, "")}/crm?k=${KEY}`;
    const keyOk = req => !!KEY && safeEq(cookieOf(req).vr_key || "", KEY);
    async function rotate(force){
        const fixed = env("CRM_KEY");
        if(fixed && fixed.length >= 16 && !force){ KEY = fixed; return; }
        let st = null; try { st = JSON.parse((await one(`SELECT value FROM meta WHERE key = 'crm_key'`))?.value || "null"); } catch(e){}
        const d = days();
        if(st && st.k && !force && (d === 0 || Date.now() - Date.parse(st.at) < d * 864e5)){ KEY = st.k; return; }
        const k = crypto.randomBytes(18).toString("hex"), at = now();
        await q(`DELETE FROM meta WHERE key = 'crm_key'`); await q(`INSERT INTO meta(key, value) VALUES('crm_key', $1)`, [JSON.stringify({k, at})]);
        KEY = k;
        const till = d ? new Date(Date.now() + d * 864e5).toLocaleDateString("ru-RU", {timeZone: "Europe/Moscow"}) : "";
        console.log(`🔐 CRM: ${force ? "по запросу выпущена" : "выпущена"} новая ссылка входа${till ? ", действует до " + till : ""}: ${link()}`);
        await Mail.owner(`🔐 Новая ссылка для входа в CRM Vreise.ru${till ? ` (действует до ${till}, старая больше не работает)` : ""}:\n${link()}\n\nОткройте её один раз на каждом устройстве — браузер запомнит. Пароль CRM остаётся прежним. Ссылку никому не пересылайте.`).catch(() => {});
    }

    /* ---------- основная проверка запроса. true — ответ уже отправлен ---------- */
    async function guard(req, res, u, send, notFoundHtml){
        const ip = ipOf(req), p = u.pathname, TXT = "text/plain; charset=utf-8";
        const h = {"X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff", "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()", "Cross-Origin-Opener-Policy": "same-origin",
            "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"};
        if(/^https/.test(siteUrl()) || req.headers["x-forwarded-proto"] === "https") h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
        if(/^\/(crm|o\/|api\/)/.test(p)) h["X-Robots-Tag"] = "noindex, nofollow, noarchive, nosnippet";
        if(/^\/(crm|o\/|api\/)/.test(p)) { h["Cache-Control"] = "no-store"; h["Referrer-Policy"] = "no-referrer"; }
        for(const [k, v] of Object.entries(h)) res.setHeader(k, v);

        if(p === "/health") return false;
        if(isBanned(ip) && !isTrusted(ip)) return send(res, 403, "Forbidden", TXT), true;
        if(hit("rps:" + ip, 900, 60e3) && !isTrusted(ip)) return send(res, 429, "Too many requests", TXT, {"Retry-After": "60"}), true;
        if(SCAN.test(p) && !/^\/static\//.test(p)){ ban(ip, "сканер: " + p); return send(res, 403, "Forbidden", TXT), true; }

        /* CSRF: POST с чужого сайта (Origin не совпадает с нашим хостом) */
        if(req.method === "POST"){
            const og = req.headers.origin;
            if(og && og !== "null"){ let host = ""; try { host = new URL(og).host; } catch(e){} if(host !== req.headers.host) return send(res, 403, "Forbidden", TXT), true; }
            else if(og === "null") return send(res, 403, "Forbidden", TXT), true;
        }

        /* CRM — только по секретной ссылке */
        if(/^\/crm(\/|$)/.test(p)){
            if(p.replace(/\/+$/, "") === "/crm" && u.searchParams.has("k")){
                if(KEY && safeEq(u.searchParams.get("k"), KEY)){
                    trusted.set(ip, Date.now() + 24 * 3600e3); bans.delete(ip);
                    res.writeHead(302, {Location: "/crm", "Set-Cookie": `vr_key=${KEY}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${(days() || 30) * 86400}${/^https/.test(siteUrl()) ? "; Secure" : ""}`}); res.end(); return true;
                }
                if(hit("crmk:" + ip, 3, 3600e3)) ban(ip, "подбор ключа входа в CRM");
                return send(res, 404, notFoundHtml, "text/html; charset=utf-8"), true;
            }
            if(!keyOk(req)){
                if(hit("crmprobe:" + ip, 10, 3600e3)) ban(ip, "пробы CRM без ключа");
                return send(res, 404, notFoundHtml, "text/html; charset=utf-8"), true;
            }
            trusted.set(ip, Date.now() + 24 * 3600e3);
        }
        return false;
    }

    /* ---------- вход по паролю: учёт неудач ---------- */
    const loginFail = ip => {
        if(hit("lf:" + ip, 5, 600e3)) { if(hit("lf24:" + ip, 12, 24 * 3600e3)) ban(ip, "подбор пароля CRM"); return "slow"; }
        if(hit("lfall", 40, 3600e3)) { once("lfall", 60, () => Mail.owner("🛡 Массовый подбор пароля CRM: вход заблокирован на 15 минут для всех, кроме действующих сессий").catch(() => {})); hits.set("lock", [Date.now()]); }
        return "";
    };
    const loginLocked = () => { const l = (hits.get("lock") || [])[0]; return !!l && Date.now() - l < 15 * 60e3; };
    const loginOk = (ip, ua) => { hits.delete("lf:" + ip); once("loginok:" + ip, 24 * 60, () => Mail.owner(`🔐 Вход в CRM Vreise.ru\nАдрес: ${ip}\nБраузер: ${String(ua || "").slice(0, 120)}\nЕсли это были не вы — через бота нажмите «Новая ссылка в CRM» и смените CRM_PASSWORD в Railway.`).catch(() => {})); };

    return {als, ipOf, guard, rotate, link, keyOk, ban, badToken, loginFail, loginLocked, loginOk, isBanned, hit};
}

module.exports = {create, ipOf, safeEq, cookieOf};
