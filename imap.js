"use strict";
/* Ответы компаний: заходим по IMAP в ящики рассылки (на серверах Hestia) и забираем новые письма.
   Без сторонних библиотек: небольшой IMAP-клиент (TLS, LOGIN, SELECT, UID SEARCH, UID FETCH) и разбор MIME. */
const tls = require("tls"), net = require("net");

function session({host, port = 993, user, pass, insecure}){
    return new Promise((resolve, reject) => {
        const sock = tls.connect({host, port, rejectUnauthorized: !insecure, ...(net.isIP(host) ? {} : {servername: host})});
        sock.setTimeout(40000, () => sock.destroy(new Error("IMAP: сервер не отвечает")));
        let buf = Buffer.alloc(0), n = 0, pending = null, greeted = false;
        const done = (err, val) => { const p = pending; pending = null; if(p) err ? p.reject(err) : p.resolve(val); };
        const tryParse = () => {
            if(!greeted){ const i = buf.indexOf("\r\n"); if(i < 0) return; buf = buf.subarray(i + 2); greeted = true; resolve(api); }
            if(!pending) return;
            let pos = 0;
            while(true){
                const e = buf.indexOf("\r\n", pos); if(e < 0) return;
                const line = buf.subarray(pos, e).toString("latin1"), lit = line.match(/\{(\d+)\}$/);
                if(lit){ const end = e + 2 + Number(lit[1]); if(buf.length < end) return; pos = end; continue; }
                if(line.startsWith(pending.tag + " ")){
                    const all = buf.subarray(0, e + 2); buf = buf.subarray(e + 2);
                    return done(/^\S+ OK/i.test(line) ? null : new Error("IMAP: " + line.slice(pending.tag.length + 1).slice(0, 160)), all);
                }
                pos = e + 2;
            }
        };
        sock.on("data", d => { buf = Buffer.concat([buf, d]); tryParse(); });
        sock.on("error", e => { if(!greeted) reject(e); done(e); });
        sock.on("close", () => { if(!greeted) reject(new Error("IMAP: соединение закрыто")); done(new Error("IMAP: соединение закрыто")); });
        const cmd = text => new Promise((res, rej) => { const tag = "A" + (++n); pending = {tag, resolve: res, reject: rej}; sock.write(`${tag} ${text}\r\n`); tryParse(); });
        const q = s => '"' + String(s).replace(/(["\\])/g, "\\$1") + '"';
        const api = {
            login: () => cmd(`LOGIN ${q(user)} ${q(pass)}`),
            select: box => cmd(`SELECT ${q(box)}`),
            search: async crit => { const r = (await cmd(`UID SEARCH ${crit}`)).toString("latin1"), m = r.match(/\* SEARCH([\d ]*)/i); return m ? m[1].trim().split(/\s+/).filter(Boolean).map(Number) : []; },
            fetchMany: async (uids, max = 150000) => {
                if(!uids.length) return [];
                const r = await cmd(`UID FETCH ${uids.join(",")} (UID BODY.PEEK[]<0.${max}>)`), out = [];
                let pos = 0;
                while(true){
                    const st = r.indexOf("* ", pos); if(st < 0) break;
                    const lb = r.indexOf("{", st), le = lb >= 0 ? r.indexOf("}\r\n", lb) : -1, eol = r.indexOf("\r\n", st);
                    if(lb < 0 || le < 0 || (eol >= 0 && eol < lb)){ pos = eol >= 0 ? eol + 2 : r.length; if(eol < 0) break; continue; }
                    const head = r.subarray(st, lb).toString("latin1"), len = Number(r.subarray(lb + 1, le).toString()), ds = le + 3;
                    let uid = Number((head.match(/UID (\d+)/i) || [])[1]) || 0;
                    const data = r.subarray(ds, ds + len); pos = ds + len;
                    if(!uid){ const a = r.subarray(pos, Math.min(r.length, pos + 80)).toString("latin1").match(/UID (\d+)/i); uid = a ? Number(a[1]) : 0; }
                    out.push({uid, data});
                }
                return out;
            },
            close: () => { try { sock.write(`A${++n} LOGOUT\r\n`); } catch(e){} setTimeout(() => sock.destroy(), 300); }
        };
    });
}

/* ---------- MIME ---------- */
const dec = (buf, cs) => { try { return new TextDecoder(String(cs || "utf-8").toLowerCase().replace(/^(us-ascii|ascii)$/, "utf-8"), {fatal: false}).decode(buf); } catch(e){ return buf.toString("utf8"); } };
function qp(s){ const out = []; s = s.replace(/=\r?\n/g, ""); for(let i = 0; i < s.length; i++){ if(s[i] === "=" && /^[0-9A-F]{2}$/i.test(s.substr(i + 1, 2))){ out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; } else out.push(s.charCodeAt(i) & 255); } return Buffer.from(out); }
function words(s){
    return String(s || "").replace(/\?=\s+=\?/g, "?==?").replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, cs, enc, t) => {
        try { return dec(enc.toUpperCase() === "B" ? Buffer.from(t, "base64") : qp(t.replace(/_/g, " ")), cs); } catch(e){ return m; } });
}
function headers(raw){ const h = {}; for(const l of raw.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)){ const i = l.indexOf(":"); if(i > 0){ const k = l.slice(0, i).trim().toLowerCase(); if(!(k in h)) h[k] = l.slice(i + 1).trim(); } } return h; }
const param = (v, name) => { const m = String(v || "").match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, "i")); return m ? (m[2] ?? m[1]) : ""; };
function part(buf){
    const s = buf.toString("latin1"), mm = s.match(/\r?\n\r?\n/), sep = mm ? mm.index : -1;
    const h = headers(sep < 0 ? s : s.slice(0, sep)), body = sep < 0 ? Buffer.alloc(0) : buf.subarray(sep + mm[0].length);
    const ct = h["content-type"] || "text/plain", type = ct.split(";")[0].trim().toLowerCase();
    if(type.startsWith("multipart/")){
        const b = param(ct, "boundary"); if(!b) return {h, type, parts: []};
        return {h, type, parts: body.toString("latin1").split("--" + b).slice(1).filter(c => !c.startsWith("--")).map(c => part(Buffer.from(c.replace(/^\r?\n/, ""), "latin1")))};
    }
    const enc = String(h["content-transfer-encoding"] || "").toLowerCase();
    return {h, type, cs: param(ct, "charset"), data: enc === "base64" ? Buffer.from(body.toString("latin1").replace(/\s+/g, ""), "base64") : enc === "quoted-printable" ? qp(body.toString("latin1")) : body};
}
function textOf(p){
    if(p.parts){ const all = p.parts.map(textOf); return all.find(x => x && !x.html) || all.find(Boolean) || null; }
    if(p.type === "text/plain") return {text: dec(p.data, p.cs)};
    if(p.type === "text/html") return {html: true, text: dec(p.data, p.cs).replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/(p|div|tr|li)>/gi, "\n").replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")};
    return null;
}
const addr = v => { const m = String(v || "").match(/<([^>]+)>/); return (m ? m[1] : String(v || "").split(/[\s,]/).find(x => x.includes("@")) || "").trim().toLowerCase(); };
const nameOf = v => words(String(v || "").replace(/<[^>]*>/, "").replace(/"/g, "").trim());

/* что это за письмо — те же правила, что на CV-Sender: недоставленное (бан, ошибка, квота) моряку не показываем, автоответы показываем */
const BOUNCE_FROM = /mailer-daemon|postmaster|mail[ ._-]?delivery|maildelivery|bounce|no-?reply-?dsn|mdaemon|mail\.?system|microsoftexchange/i;
const BOUNCE_SUBJ = /undeliver|not delivered|delivery (status|failure|failed|has failed|incomplete|notification|problem)|returned mail|failure notice|mail delivery (failed|subsystem)|could not be delivered|delivery report|message (blocked|rejected|bounced)|rejected|blocked|spam|quota|mailbox (is )?(full|unavailable)|over quota|address (not found|rejected)|user unknown|non ?delivery|nondeliverable|ndr\b|не доставлен|недоставлен|не удалось доставить|ящик (переполнен|заполнен)|возвращ[её]нн|отклонен/i;
const AUTO_SUBJ = /automatic reply|auto(matic)?[- ]?(reply|response|antwort|réponse)|out of (the )?office|away from|on leave|vacation|abwesen|автоответ|автоматический ответ|нет на месте|в отпуске|we (have )?received your|thank you for (your|contacting)|acknowledg/i;
/* 15.11: «Your message has expired without being delivered» и подобные — служебное письмо о недоставке, а не ответ компании */
const BOUNCE_TEXT = /(your|the) (e-?mail|message)[^.\n]{0,100}\b(has |had )?(expired|not been delivered|could not be delivered|couldn.?t be delivered|was not delivered|is delayed|has been delayed|was delayed)|expired without|message (delivery )?(has )?expired|delivery (is |has been )?delayed|(still|continue[sd]?) (trying|attempting) to deliver|will (continue|keep) (to )?(try|retry)|your message (has )?not (yet )?been delivered|undelivered mail returned|сообщение (не )?(было )?(доставлено|просрочено)|повідомлення (не )?(було )?(доставлено|прострочено)/i;
function classify(h, type, text){
    const from = String(h.from || ""), subj = words(h.subject || "");
    if(BOUNCE_FROM.test(from) || /multipart\/report/i.test(h["content-type"] || "") || /delivery-status/i.test(h["content-type"] || "")) return "bounce";
    if(BOUNCE_SUBJ.test(subj) && !AUTO_SUBJ.test(subj)) return "bounce";
    if(BOUNCE_TEXT.test(subj + "\n" + String(text || "").slice(0, 1500))) return "bounce";
    if(/^\s*(5\.\d\.\d|4\.\d\.\d)\b/m.test(text || "") && /(smtp|recipient|delivery)/i.test(text || "")) return "bounce";
    if(/auto-replied|auto-generated|auto-notified/i.test(h["auto-submitted"] || "") || h["x-autoreply"] || h["x-autorespond"] || /^(auto_reply|bulk|junk)$/i.test(h.precedence || "") || AUTO_SUBJ.test(subj)) return "auto";
    return "reply";
}
function parseMail(buf){
    const p = part(buf), t = textOf(p), h = p.h;
    let text = t ? t.text : "";
    text = text.replace(/\r/g, "").split(/\n(?:On .{5,200}wrote:|-{2,}\s*Original Message|From: .{3,200}\nSent: |От: .{3,200}\n(Отправлено|Дата): )/i)[0]
        .split("\n").filter(l => !/^\s*>/.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return {from: addr(h["reply-to"] || h.from), fromRaw: addr(h.from), name: nameOf(h.from), subject: words(h.subject || "").slice(0, 300),
        date: Date.parse(h.date || "") || Date.now(), kind: classify(h, p.type, text), text: text.slice(0, 4000)};
}
module.exports = {session, parseMail};
