"use strict";
/* Маскировка адресной базы в личной странице заказа: клиент видит, что письма ушли, но не может восстановить базу.
   В CRM названия и адреса показываются полностью. */
const crypto = require("crypto");

function maskCompany(name){
    const s = String(name || ""), chars = [...s];
    const pos = chars.map((c, i) => /[\p{L}\p{N}]/u.test(c) && i > 0 ? i : -1).filter(i => i >= 0);
    if(pos.length < 2) return s;
    let h = crypto.createHash("sha256").update(s.toLowerCase()).digest(), k = 0;
    const want = Math.min(pos.length - 1, pos.length <= 4 ? 1 : pos.length <= 7 ? 2 + (h[0] % 2) : 3 + (h[0] % 3));
    const pick = new Set();
    while(pick.size < want && k < 64){ pick.add(pos[h[(k + 1) % h.length] % pos.length]); k++; if(k % 31 === 0) h = crypto.createHash("sha256").update(h).digest(); }
    return chars.map((c, i) => pick.has(i) ? "•" : c).join("");
}
/* первая буква имени, две первые буквы домена и зона: c***@an***.com */
function maskEmail(e){
    const m = String(e || "").toLowerCase().match(/^([^@]+)@(.+)\.([a-z0-9-]+)$/); if(!m) return "";
    return `${m[1][0]}***@${m[2].slice(0, 2)}***.${m[3]}`;
}
module.exports = {maskCompany, maskEmail};
