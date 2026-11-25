"use strict";
/* Web Push для клиентов Vreise (без сторонних библиотек): клиент один раз нажимает «Включить» в личном кабинете —
   и получает уведомления, когда приходят ответы компаний (включая автоответы). Ключи VAPID создаются сами и хранятся в базе (meta 'vapid') —
   в Railway ничего задавать не нужно. Шифрование — RFC 8291 (aes128gcm), подпись — RFC 8292 (VAPID, ES256). */
const crypto = require("crypto");
const b64u = b => Buffer.from(b).toString("base64url");
const unb64u = s => Buffer.from(String(s || ""), "base64url");

module.exports = function(X){
    const {getDb, now} = X;
    const db = () => getDb();
    const one = async (sql, p) => (await db().query(sql, p))[0];
    let VAPID = null;

    async function init(){
        await db().query(`CREATE TABLE IF NOT EXISTS push_subs(endpoint TEXT PRIMARY KEY, email TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, ua TEXT, created_at TEXT NOT NULL, last_ok TEXT, fails INTEGER NOT NULL DEFAULT 0)`);
        await db().query(`CREATE INDEX IF NOT EXISTS idx_push_email ON push_subs(email)`);
        // журнал отправленных пушей — для CRM «✉️ Автоматизация писем» → «🔔 Пуши»
        await db().query(`CREATE TABLE IF NOT EXISTS push_log(id TEXT PRIMARY KEY, email TEXT NOT NULL, title TEXT, body TEXT, devices INTEGER NOT NULL DEFAULT 0, ok INTEGER NOT NULL DEFAULT 0, at TEXT NOT NULL)`);
        await db().query(`CREATE INDEX IF NOT EXISTS idx_push_log_at ON push_log(at)`);
        await keys();
    }
    async function keys(){
        if(VAPID) return VAPID;
        let v = null;
        try { v = JSON.parse((await one(`SELECT value FROM meta WHERE key = 'vapid'`))?.value || "null"); } catch(e){}
        if(!v || !v.jwk || !v.pub){
            const {privateKey} = crypto.generateKeyPairSync("ec", {namedCurve: "prime256v1"});
            const jwk = privateKey.export({format: "jwk"});
            v = {jwk, pub: b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]))};
            await db().query(`DELETE FROM meta WHERE key = 'vapid'`);
            await db().query(`INSERT INTO meta(key, value) VALUES('vapid', $1)`, [JSON.stringify(v)]);
            console.log("🔔 Пуш-уведомления: созданы ключи VAPID");
        }
        VAPID = {pub: v.pub, key: crypto.createPrivateKey({key: v.jwk, format: "jwk"})};
        return VAPID;
    }
    const publicKey = async () => (await keys()).pub;

    // VAPID: JWT (ES256) для адреса push-сервиса
    async function vapidHeader(endpoint){
        const k = await keys(), aud = new URL(endpoint).origin;
        const h = b64u(JSON.stringify({typ: "JWT", alg: "ES256"}));
        const p = b64u(JSON.stringify({aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: X.subject || "https://vreise.ru"}));
        const sig = crypto.sign("sha256", Buffer.from(h + "." + p), {key: k.key, dsaEncoding: "ieee-p1363"});
        return `vapid t=${h}.${p}.${b64u(sig)}, k=${k.pub}`;
    }
    // RFC 8291: тело письма для одного подписчика
    function encrypt(sub, payload){
        const uaPub = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
        if(uaPub.length !== 65 || authSecret.length < 16) throw new Error("bad subscription keys");
        const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
        const asPub = ecdh.getPublicKey(), secret = ecdh.computeSecret(uaPub);
        const ikm = Buffer.from(crypto.hkdfSync("sha256", secret, authSecret, Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub]), 32));
        const salt = crypto.randomBytes(16);
        const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
        const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
        const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
        const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
        const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
        return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, body]);
    }
    async function sendOne(sub, data){
        const r = await fetch(sub.endpoint, {method: "POST", signal: AbortSignal.timeout(15_000),
            headers: {"Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "172800", Urgency: "normal", Authorization: await vapidHeader(sub.endpoint)},
            body: encrypt(sub, JSON.stringify(data))});
        if(r.status === 404 || r.status === 410){ await db().query(`DELETE FROM push_subs WHERE endpoint = $1`, [sub.endpoint]); return false; }   // подписку отключили
        if(!r.ok){
            await db().query(`UPDATE push_subs SET fails = fails + 1 WHERE endpoint = $1`, [sub.endpoint]).catch(() => {});
            await db().query(`DELETE FROM push_subs WHERE endpoint = $1 AND fails >= 20`, [sub.endpoint]).catch(() => {});
            console.error("🔔 Пуш:", r.status, (await r.text().catch(() => "")).slice(0, 200));
            return false;
        }
        await db().query(`UPDATE push_subs SET last_ok = $1, fails = 0 WHERE endpoint = $2`, [now(), sub.endpoint]).catch(() => {});
        return true;
    }
    // всем устройствам моряка; data = {title, body, url, tag}
    async function notify(email, data){
        const subs = await db().query(`SELECT * FROM push_subs WHERE email = $1`, [String(email || "").trim().toLowerCase()]).catch(() => []);
        let ok = 0;
        for(const s of subs.slice(0, 10)) if(await sendOne(s, data).catch(e => { console.error("🔔 Пуш:", e.message); return false; })) ok++;
        if(subs.length) await db().query(`INSERT INTO push_log(id, email, title, body, devices, ok, at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [crypto.randomUUID(), String(email || "").trim().toLowerCase(), String(data.title || "").slice(0, 200), String(data.body || "").slice(0, 500), Math.min(subs.length, 10), ok, now()]).catch(() => {});
        return ok;
    }
    async function subscribe(email, sub, ua){
        const e = String(email || "").trim().toLowerCase(), ep = String(sub && sub.endpoint || "");
        const k = (sub && sub.keys) || {};
        if(!/^https:\/\/[^\s]{10,800}$/.test(ep) || unb64u(k.p256dh).length !== 65 || unb64u(k.auth).length < 16) throw new Error("Неверная подписка");
        await db().query(`DELETE FROM push_subs WHERE endpoint = $1`, [ep]);
        await db().query(`INSERT INTO push_subs(endpoint, email, p256dh, auth, ua, created_at, fails) VALUES($1,$2,$3,$4,$5,$6,0)`, [ep, e, String(k.p256dh), String(k.auth), String(ua || "").slice(0, 200), now()]);
        const n = await db().query(`SELECT endpoint FROM push_subs WHERE email = $1 ORDER BY created_at DESC`, [e]);
        for(const r of n.slice(10)) await db().query(`DELETE FROM push_subs WHERE endpoint = $1`, [r.endpoint]);    // не больше 10 устройств
    }
    const unsubscribe = (email, endpoint) => db().query(`DELETE FROM push_subs WHERE email = $1 AND endpoint = $2`, [String(email || "").trim().toLowerCase(), String(endpoint || "")]);
    const count = async email => Number((await one(`SELECT COUNT(*) AS c FROM push_subs WHERE email = $1`, [String(email || "").trim().toLowerCase()]))?.c || 0);
    // для CRM: сколько устройств подписано и сколько пушей ушло
    async function stats(){
        const n = async (sql, p = []) => Number((await one(sql, p).catch(() => null))?.c || 0);
        const day = new Date(Date.now() - 864e5).toISOString(), week = new Date(Date.now() - 7 * 864e5).toISOString();
        return {devices: await n(`SELECT COUNT(*) AS c FROM push_subs`), people: await n(`SELECT COUNT(DISTINCT email) AS c FROM push_subs`),
            sentDay: await n(`SELECT COUNT(*) AS c FROM push_log WHERE ok > 0 AND at >= $1`, [day]), sentWeek: await n(`SELECT COUNT(*) AS c FROM push_log WHERE ok > 0 AND at >= $1`, [week]),
            sentAll: await n(`SELECT COUNT(*) AS c FROM push_log WHERE ok > 0`), failAll: await n(`SELECT COUNT(*) AS c FROM push_log WHERE ok = 0`),
            log: await db().query(`SELECT email, title, body, devices, ok, at FROM push_log ORDER BY at DESC LIMIT 200`).catch(() => []),
            subs: await db().query(`SELECT email, ua, created_at, last_ok, fails FROM push_subs ORDER BY created_at DESC LIMIT 200`).catch(() => [])};
    }
    return {init, stats, publicKey, notify, subscribe, unsubscribe, count, encrypt, vapidHeader};
};
