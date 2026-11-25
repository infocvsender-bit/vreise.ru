"use strict";
/* Почта: серверы Hestia (создание/удаление ящиков по API) + отправка по SMTP + шифрование паролей ящиков. */
const net = require("net"), tls = require("tls"), https = require("https"), crypto = require("crypto");
const env = k => String(process.env[k] || "").trim();

/* ---------- шифрование паролей ящиков (ключ — MAILBOX_KEY) ---------- */
const key = () => crypto.createHash("sha256").update(env("MAILBOX_KEY") || "vreise-boxes-dev").digest();
function encrypt(t){
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key(), iv);
    const e = Buffer.concat([c.update(String(t), "utf8"), c.final()]);
    return [iv, c.getAuthTag(), e].map(b => b.toString("base64")).join(".");
}
function decrypt(s){
    const [iv, tag, e] = String(s || "").split(".").map(x => Buffer.from(x, "base64"));
    const d = crypto.createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(e), d.final()]).toString("utf8");
}

/* ---------- серверы Hestia: HESTIA_N_URL / KEY / USER / DOMAIN (N = 1…9), необязательно _INSECURE, _SMTP_HOST, _SMTP_PORT, _QUOTA ---------- */
function cfgs(){
    const out = [];
    for(let n = 0; n <= 9; n++){
        const E = k => env(n ? `HESTIA_${n}_${k}` : `HESTIA_${k}`);
        const url = E("URL").replace(/\/+$/, ""), k = E("KEY"), user = E("USER"), domain = E("DOMAIN").toLowerCase();
        if(!(url && k && user && domain) || out.some(c => c.domain === domain)) continue;
        out.push({n: n || 1, url, key: k, user, domain, insecure: E("INSECURE") === "1", quota: E("QUOTA") || "unlimited",
            smtp: E("SMTP_HOST") || "mail." + domain, port: Number(E("SMTP_PORT")) || 465});
    }
    return out;
}
const skipRe = () => new RegExp(env("SRV_SKIP_DOMAINS") || "off+shore", "i");
const sendCfgs = () => cfgs().filter(c => !skipRe().test(c.domain));

const CODES = {1: "не хватает данных", 2: "неверное имя или параметр", 3: "домен или пользователь не найден", 4: "такой ящик уже есть", 5: "домен не найден",
    6: "пользователь заблокирован", 8: "лимит тарифа (ящиков/места)", 9: "неверный ключ API", 10: "ключ API не подходит или IP не разрешён", 11: "доступ запрещён"};
function hestia(c, cmd, args, out = false, waitMs = 20000){
    const form = new URLSearchParams({hash: c.key, returncode: out ? "no" : "yes", cmd});
    args.forEach((a, i) => form.set("arg" + (i + 1), String(a)));
    const body = form.toString(), u = new URL(c.url + "/api/"), tag = `Hestia ${c.domain}`, lib = u.protocol === "http:" ? require("http") : https;
    return new Promise((ok, no) => {
        const rq = lib.request({hostname: u.hostname, port: u.port || (u.protocol === "http:" ? 80 : 8083), path: u.pathname, method: "POST", rejectUnauthorized: !c.insecure, timeout: waitMs,
            headers: {"Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body)}}, r => {
            let t = ""; r.on("data", d => t += d); r.on("end", () => {
                const code = out ? Number(r.headers["hestia-exit-code"] ?? (r.statusCode < 300 ? 0 : -1)) : Number(String(t).trim());
                if(out ? code === 0 : String(t).trim() === "0") ok(out ? String(t) : 0);
                else no(Object.assign(new Error(`${tag}: ${CODES[code] || String(t).trim().slice(0, 120) || "HTTP " + r.statusCode}`), {code}));
            });
        });
        rq.on("timeout", () => rq.destroy(new Error(`${tag}: не ответил за ${Math.round(waitMs / 1000)} с`)));
        rq.on("error", e => no(new Error(/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(e.code + e.message) ? `${tag}: сертификат не проверен — добавьте HESTIA_${c.n}_INSECURE=1` : `${tag}: ${e.message}`)));
        rq.end(body);
    });
}

/* ---------- адрес ящика из имени: ivan.petrov → petrov.ivan → i.petrov … ---------- */
const TR = {а:"a",б:"b",в:"v",г:"g",ґ:"g",д:"d",е:"e",ё:"e",є:"ye",ж:"zh",з:"z",и:"i",і:"i",ї:"yi",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"};
const translit = s => String(s || "").toLowerCase().split("").map(ch => TR[ch] ?? ch).join("").normalize("NFKD").replace(/[̀-ͯ]/g, "");
const mailLocal = name => translit(name).replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").split(".").filter(Boolean).slice(0, 3).join(".").slice(0, 40);
function variants(name){
    const p = mailLocal(name).split(".").filter(Boolean);
    if(p.length < 2) return p.length && p[0].length >= 3 ? [p[0]] : [];
    const f = p[0], l = p[p.length - 1], fi = f[0], li = l[0], f2 = f.slice(0, 2);
    return [...new Set([`${f}.${l}`, `${l}.${f}`, `${fi}.${l}`, `${l}.${fi}`, `${f2}.${l}`, `${l}.${f2}`, `${f}.${li}`, `${li}.${f}`].map(x => x.slice(0, 40)))].filter(x => x.length >= 3);
}
const newPass = () => crypto.randomBytes(12).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 14) + "7a";

/* ---------- SMTP ---------- */
class SmtpError extends Error { constructor(stage, code, text){ super(`${stage}: ${code} ${text}`); this.stage = stage; this.code = code; this.text = text; } }
function reader(sock){
    let buf = "", lines = [], waiting = null, error = null;
    const flush = () => {
        if(!waiting) return;
        if(error){ const w = waiting; waiting = null; return w.reject(error); }
        const i = lines.findIndex(l => /^\d{3}( |$)/.test(l));
        if(i < 0) return;
        const part = lines.splice(0, i + 1), w = waiting; waiting = null;
        w.resolve({code: Number(part[i].slice(0, 3)), text: part.map(l => l.slice(4)).join(" ").trim()});
    };
    sock.on("data", d => { buf += d.toString("utf8"); let k; while((k = buf.indexOf("\n")) >= 0){ lines.push(buf.slice(0, k).replace(/\r$/, "")); buf = buf.slice(k + 1); } flush(); });
    sock.on("error", e => { error = e; flush(); });
    sock.on("close", () => { error = error || new Error("соединение закрыто сервером"); flush(); });
    return {next: () => new Promise((res, rej) => { waiting = {resolve: res, reject: rej}; flush(); }), detach: () => sock.removeAllListeners("data")};
}
/* box = {host, port, email, insecure}; raw == null — только проверка входа */
async function smtp(box, pass, from, to, raw){
    const host = box.host, port = Number(box.port) || 465, ssl = port === 465, tlsOpt = {...(net.isIP(host) ? {} : {servername: host}), rejectUnauthorized: !box.insecure};
    let sock = await new Promise((ok, no) => {
        const s = ssl ? tls.connect({host, port, ...tlsOpt}) : net.connect({host, port});
        s.setTimeout(40_000, () => s.destroy(new Error("сервер не отвечает (таймаут)")));
        s.once(ssl ? "secureConnect" : "connect", () => ok(s)); s.once("error", no);
    });
    let r = reader(sock);
    const cmd = async (line, stage, okc = [250]) => { if(line != null) sock.write(line + "\r\n"); const x = await r.next(); if(!okc.includes(x.code)) throw new SmtpError(stage, x.code, x.text); return x; };
    try {
        await cmd(null, "приветствие", [220]);
        const helo = box.email.split("@")[1] || "localhost";
        let eh = await cmd(`EHLO ${helo}`, "EHLO");
        if(!ssl && env("VR_SMTP_PLAIN") !== "1"){
            if(!/STARTTLS/i.test(eh.text)) throw new SmtpError("STARTTLS", 0, "сервер не поддерживает шифрование — используйте порт 465");
            await cmd("STARTTLS", "STARTTLS", [220]); r.detach();
            sock = await new Promise((ok, no) => { const s = tls.connect({socket: sock, ...tlsOpt}, () => ok(s)); s.once("error", no); });
            r = reader(sock); eh = await cmd(`EHLO ${helo}`, "EHLO");
        }
        if(!/AUTH[ =][^\n]*PLAIN/i.test(eh.text) && /AUTH[ =][^\n]*LOGIN/i.test(eh.text)){
            await cmd("AUTH LOGIN", "вход", [334]); await cmd(Buffer.from(box.email).toString("base64"), "вход", [334]); await cmd(Buffer.from(pass).toString("base64"), "вход", [235]);
        } else await cmd("AUTH PLAIN " + Buffer.from(`\0${box.email}\0${pass}`).toString("base64"), "вход", [235]);
        if(raw == null){ sock.write("QUIT\r\n"); return; }
        await cmd(`MAIL FROM:<${from}>`, "MAIL FROM");
        await cmd(`RCPT TO:<${to}>`, "RCPT", [250, 251]);
        await cmd("DATA", "DATA", [354]);
        await cmd(raw.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..") + "\r\n.", "отправка");
        sock.write("QUIT\r\n");
    } finally { setTimeout(() => sock.destroy(), 500); }
}

/* ---------- письмо ---------- */
function encWord(s){
    s = String(s || ""); if(/^[\x20-\x7e]*$/.test(s)) return s;
    const out = []; let cur = "";
    for(const ch of s){ if(Buffer.byteLength(cur + ch) > 42){ out.push(cur); cur = ""; } cur += ch; }
    if(cur) out.push(cur);
    return out.map(p => `=?UTF-8?B?${Buffer.from(p).toString("base64")}?=`).join("\r\n ");
}
const b64 = buf => buf.toString("base64").replace(/.{1,76}/g, "$&\r\n");
/* text — обычный текст; html — необязательно (тогда письмо multipart/alternative); attach = {name, mime, data: Buffer} */
function message({fromEmail, fromName, to, subject, text, html, attach, replyTo, unsub = true}){
    const domain = fromEmail.split("@")[1], id = crypto.randomBytes(12).toString("hex");
    const head = [`From: ${fromName ? `"${encWord(fromName).replace(/"/g, "")}" ` : ""}<${fromEmail}>`, `To: <${to}>`,
        ...(replyTo && replyTo.toLowerCase() !== fromEmail.toLowerCase() ? [`Reply-To: <${replyTo}>`] : []),
        `Subject: ${encWord(subject)}`, `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`, `Message-ID: <${crypto.randomUUID()}@${domain}>`,
        ...(unsub ? [`List-Unsubscribe: <mailto:${fromEmail}?subject=unsubscribe>`] : []), "MIME-Version: 1.0"];
    const plain = ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(Buffer.from(String(text).replace(/\r?\n/g, "\r\n"), "utf8"))];
    const body = html ? [`Content-Type: multipart/alternative; boundary="=_alt_${id}"`, "", `--=_alt_${id}`, ...plain,
        `--=_alt_${id}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(Buffer.from(html, "utf8")), `--=_alt_${id}--`] : plain;
    if(!attach) return [...head, ...body].join("\r\n");
    return [...head, `Content-Type: multipart/mixed; boundary="=_mix_${id}"`, "", `--=_mix_${id}`, ...body, `--=_mix_${id}`,
        `Content-Type: ${attach.mime || "application/octet-stream"}; name="${encWord(attach.name)}"`, "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${encWord(attach.name)}"`, "", b64(attach.data), `--=_mix_${id}--`, ""].join("\r\n");
}

/* письма клиентам и владельцу — через отдельный ящик SYS_SMTP_* (не из ящиков рассылки) */
const sysOn = () => !!(env("SYS_SMTP_HOST") && env("SYS_SMTP_USER") && env("SYS_SMTP_PASS"));
async function sendSystem(to, subject, text, html, replyTo, attach){
    if(!sysOn()) throw new Error("почта для писем клиентам не настроена (SYS_SMTP_HOST / SYS_SMTP_USER / SYS_SMTP_PASS)");
    const from = env("SYS_SMTP_FROM") || env("SYS_SMTP_USER"), box = {host: env("SYS_SMTP_HOST"), port: Number(env("SYS_SMTP_PORT")) || 465, email: env("SYS_SMTP_USER"), insecure: env("SYS_SMTP_INSECURE") === "1"};
    await smtp(box, env("SYS_SMTP_PASS"), from, to, message({fromEmail: from, fromName: env("SYS_SMTP_NAME") || "Vreise.ru", to, subject, text, html, replyTo, attach, unsub: false}));
}

const MIME = {pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", rtf: "application/rtf",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", txt: "text/plain"};
const mimeOf = name => MIME[String(name).split(".").pop().toLowerCase()] || "application/octet-stream";

module.exports = {env, encrypt, decrypt, cfgs, sendCfgs, hestia, variants, newPass, smtp, SmtpError, message, encWord, sysOn, sendSystem, mimeOf, translit};
