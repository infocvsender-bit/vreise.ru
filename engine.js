"use strict";
/* Рассылка: заказ оплачен → задания (1/2/3 рассылки с интервалом в неделю) → ящик на каждом сервере Hestia (по имени клиента) →
   очередь адресов из базы → письма по одному с паузой SEND_GAP_SEC → отчёт. Ответы компаний идут клиенту (Reply-To). Ящики удаляются через 24 часа после конца. */
const crypto = require("crypto");
const M = require("./mailer.js");
const Mail = require("./mails.js");
const {env} = M;

const uuid = () => crypto.randomUUID(), now = () => new Date().toISOString();
const GAP = () => Math.max(2, Number(env("SEND_GAP_SEC")) || 20) * 1000;
const WEEK = 7 * 864e5;

module.exports = function engine(db){
    const q = (s, p) => db.query(s, p), one = (s, p) => db.one(s, p);
    const note = (orderId, text, author = "Система") => q(`INSERT INTO notes(id, order_id, at, author, text) VALUES($1,$2,$3,$4,$5)`, [uuid(), orderId, now(), author, text]);

    /* ---------- выбор адресов ---------- */
    const PARTS = {evropa: ["evropa", "rossiya"], "ofsor-evropa": ["ofsor", "evropa", "rossiya"], "mir-ofsor": ["mir", "ofsor"]};
    const inBases = (r, k) => String(r.bases || "").split(/[;,\s]+/).includes(k);
    const hasBase = (r, key) => key === "tanker" ? /tanker|gas|lng|lpg/i.test(r.fleets || "") : (PARTS[key] || [key]).concat(key).some(k => inBases(r, k));
    const parseExclude = t => String(t || "").split(/[\n,;]+/).map(x => x.trim().toLowerCase()).filter(x => x.length >= 3);
    function excluded(r, tokens){
        const e = String(r.email).toLowerCase(), dom = e.split("@")[1] || "", co = String(r.company || "").toLowerCase();
        return tokens.some(t => e === t || dom === t.replace(/^@/, "") || dom.includes(t) || (co && co.includes(t)));
    }
    async function pick(o){
        const rows = await q(`SELECT email, company, country, fleets, bases FROM base_rows`);
        const tokens = parseExclude(o.exclude), seen = new Set();
        return rows.filter(r => (hasBase(r, o.base) || (o.extra_base && hasBase(r, o.extra_base))) && !excluded(r, tokens) && !seen.has(r.email) && seen.add(r.email));
    }
    async function baseCounts(){
        const rows = await q(`SELECT fleets, bases FROM base_rows`), out = {};
        /* пока базы не загружены в CRM, на карточках показываем ориентировочное число адресов из каталога */
        for(const b of require("./catalog.js").BASES) out[b.key] = rows.filter(r => hasBase(r, b.key)).length || (rows.length ? 0 : b.count || 0);
        return {total: rows.length, byBase: out};
    }

    /* ---------- письмо ---------- */
    const cap = s => String(s || "").replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    const VES_EN = {"Офшорные суда": "Offshore vessels", "Контейнеровозы": "Container ships", "Танкеры (нефть, продукты, химия)": "Tankers (oil, products, chemicals)", "Газовозы (LPG / LNG)": "Gas carriers (LPG / LNG)",
        "Балкеры": "Bulk carriers", "Генеральные грузы": "General cargo", "Ро-ро / паромы": "Ro-Ro / ferries", "Пассажирские суда": "Passenger ships", "Яхты": "Yachts", "Любые суда": "Any vessel type"};
    const vesEn = s => String(s || "").split(/,\s(?=[А-ЯЁA-Z])/).map(x => VES_EN[x.trim()] || x.trim()).join(", ");
    const latin = s => cap(M.translit(s).replace(/[^a-z\s'-]/g, " ").replace(/\s+/g, " ").trim());
    const posList = o => String(o.position || "").split(/,\s*/).map(x => x.trim()).filter(x => x && x !== "Другая");
    function defaultLetter(o, ru){
        const name = [o.first_name, o.last_name].filter(Boolean).join(" "), P = posList(o), many = P.length > 1;
        const phone = o.phone ? `\n${ru ? "Телефон" : "Phone"}: ${o.phone}` : "";
        if(ru){
            return `Добрый день!\nУважаемый менеджер по экипажам!\nМеня зовут ${name}.\nПишу, чтобы откликнуться на ${many ? "должности" : "должность"} ${P.join(", ") || "моряка"} в вашей компании. У меня большой морской опыт, я ответственно отношусь к безопасности и умею работать в команде.\nЯ работал(а) на судах разных типов, имею все необходимые документы по конвенции ПДНВ (STCW). Если вашей компании потребуются дополнительные документы, я готов(а) их оформить.\n${o.vessel ? `Хотел(а) бы работать на судах: ${o.vessel}.\n` : ""}Безопасность для меня — приоритет: умею оценивать риски, действовать в аварийных ситуациях и применять эффективные меры безопасности. Легко нахожу общий язык с интернациональными экипажами.\nРезюме прикладываю — там подробнее о моей квалификации и опыте.\nСпасибо за внимание к моей кандидатуре. Готов(а) пройти собеседование в удобное для вас время и буду рад(а) обсудить, чем могу быть полезен(на) вашей компании.\nМои контакты:\n\nE-mail: ${o.email}${phone}\n\nС уважением,\n${name}`;
        }
        const nm = latin(name);
        return `Good day\nDear Crew Manager\nMy name is ${nm}\nI am writing to apply for ${many ? "the positions" : "the position"} of ${P.join(", ") || "a seafarer position"} at your company. With my extensive maritime experience and strong commitment to safety and teamwork.\nI have experience in the maritime industry, having served onboard various types of vessels. I possess the necessary certifications according to STCW convention. Also I\u2019m ready to obtain any additional documents if it is required by your company.\n${o.vessel ? `I would like to work onboard: ${vesEn(o.vessel)}.\n` : ""}Safety is my top priority, and I have a proven track record of promoting a culture of safety onboard. I am skilled in risk assessment, emergency response, and implementing effective safety measures. I am also a team player with excellent communication skills and the ability to work well with multicultural crews.\nI have attached my resume for your review, which provides further details on my qualifications and experiences.\nThank you for considering my application. I am available for an interview at your convenience, and I look forward to the opportunity to discuss how my skills align with the needs of your company.\nMy Contact details\n\nEmail: ${o.email}${phone}\n\nBest Regards\n${nm}`;
    }
    function letterFor(o){
        const ru = o.base === "rossiya" && !o.extra_base, name = [o.first_name, o.last_name].filter(Boolean).join(" ");
        const std = [ru ? name : latin(name), posList(o).join(", ") || (ru ? "Моряк" : "Seafarer"), o.vessel ? (ru ? o.vessel : vesEn(o.vessel)).replace(/\s*\([^)]*\)/g, "") : "", ru ? "В любое время" : "Any Time"].filter(Boolean).join("/");
        return {subject: String(o.subject || "").trim() || std, text: String(o.letter || "").trim() || defaultLetter(o, ru)};
    }

    /* ---------- ящики ---------- */
    async function createBoxes(o, job){
        const name = [o.first_name, o.last_name].filter(Boolean).join(" "), vs = M.variants(name);
        if(!vs.length) throw new Error("не удалось составить адрес ящика из имени — укажите имя и фамилию");
        const nk = vs[0], used = new Set((await q(`SELECT local FROM names WHERE name_key = $1`, [nk])).map(r => r.local));
        const order = [...vs.filter(v => !used.has(v)), ...vs.filter(v => used.has(v)).flatMap(v => [2, 3, 4, 5, 6].map(k => v + k))];
        const ids = [], errs = [];
        await Promise.all(M.sendCfgs().map(async c => {
            const pass = M.newPass();
            for(const acc of order){
                if(await one(`SELECT id FROM boxes WHERE email = $1 AND deleted_at IS NULL`, [`${acc}@${c.domain}`])) continue;
                try {
                    await M.hestia(c, "v-add-mail-account", [c.user, c.domain, acc, pass, c.quota]);
                    const id = uuid();
                    await q(`INSERT INTO boxes(id, order_id, job_id, email, domain, host, port, pass_enc, insecure, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                        [id, o.id, job.id, `${acc}@${c.domain}`, c.domain, c.smtp, c.port, M.encrypt(pass), c.insecure ? 1 : 0, now()]);
                    await q(`INSERT INTO names(name_key, local, at) VALUES($1,$2,$3)`, [nk, acc.replace(/\d+$/, ""), now()]).catch(() => {});
                    ids.push(id); return;
                } catch(e){ if(e.code === 4) continue; errs.push(e.message); return; }
            }
            errs.push(`${c.domain}: все варианты адреса заняты`);
        }));
        return {ids, errs};
    }
    async function deleteBox(b){
        const c = M.cfgs().find(x => x.domain === b.domain);
        if(c) try { await M.hestia(c, "v-delete-mail-account", [c.user, c.domain, b.email.split("@")[0]]); } catch(e){ if(e.code !== 3) throw e; }
        await q(`UPDATE boxes SET deleted_at = $1, active = 0 WHERE id = $2`, [now(), b.id]);
    }

    /* ---------- запуск после оплаты ---------- */
    async function startOrder(o, who, opt = {}){
        if(o.kind !== "mailing" && !(o.kind === "cv" && o.base && opt.resume)){ await q(`UPDATE orders SET status = 'in_progress' WHERE id = $1`, [o.id]); return; }
        if(await one(`SELECT id FROM jobs WHERE order_id = $1`, [o.id])) return;
        for(let m = 1; m <= Number(o.times || 1); m++)
            await q(`INSERT INTO jobs(id, order_id, m, status, start_at) VALUES($1,$2,$3,'wait',$4)`, [uuid(), o.id, m, new Date(Date.now() + (m - 1) * WEEK).toISOString()]);
        await q(`UPDATE orders SET status = 'in_progress' WHERE id = $1`, [o.id]);
        await note(o.id, `Рассылка поставлена в очередь: ${o.times} шт. (интервал — неделя)`, who || "Система");
        if(Number(o.cover) && !o.cover_ok){
            await note(o.id, "💌 Заказано персональное сопроводительное письмо — составьте его в CRM (карточка заказа), клиент подтвердит. Рассылка стартует после подтверждения.", "Система");
            Mail.owner(`💌 Нужно персональное письмо — заказ №${o.num}\n${[o.first_name, o.last_name].filter(Boolean).join(" ")} · ${o.position || ""}\nCRM → заказ №${o.num} → «Персональное письмо». Рассылка ждёт.`);
        } else try { const L = letterFor(o); Mail.T.preview(o, L, o.kind === "cv" ? o.res_name : o.cv_name).catch(() => {}); } catch(e){}
        setTimeout(() => tick().catch(() => {}), 1500);
    }

    async function prepare(job, o){
        const rows = await pick(o);
        if(!rows.length) throw new Error(`в базе «${o.base}» нет адресов — загрузите базу в CRM → Базы`);
        if(!M.sendCfgs().length) throw new Error("не настроены почтовые серверы (HESTIA_N_URL / KEY / USER / DOMAIN)");
        const {ids, errs} = await createBoxes(o, job);
        if(!ids.length) throw new Error("ящики не созданы: " + errs.join("; "));
        if(errs.length) await note(o.id, `⚠️ Часть серверов не дала ящик: ${errs.join("; ")}`);
        rows.sort(() => Math.random() - .5);
        for(const r of rows) await q(`INSERT INTO queue(id, job_id, email, company, country, ord, status) VALUES($1,$2,$3,$4,$5,$6,'wait')`, [uuid(), job.id, r.email, r.company || "", r.country || "", Math.random()]);
        await q(`UPDATE jobs SET status = 'run', total = $1, started_at = $2, last_error = NULL WHERE id = $3`, [rows.length, now(), job.id]);
        await note(o.id, `Рассылка №${job.m} началась: ${rows.length} адресов, ящиков: ${ids.length}`);
        Mail.T.started(o, {...job, total: rows.length}).catch(() => {});
        Mail.owner(`▶️ Рассылка №${job.m} запущена\nЗаказ №${o.num} · ${o.first_name || ""} ${o.last_name || ""}\n${rows.length} адресов`);
    }

    /* ---------- отправка одного письма ---------- */
    const PERM = e => e && (e.code >= 500 && e.code < 600) && e.stage === "RCPT";
    const lastSend = new Map(); let busy = false, alerted = new Map();
    const alertOnce = (k, text, min = 60) => { const t = alerted.get(k); if(t && Date.now() - t < min * 60e3) return; alerted.set(k, Date.now()); Mail.owner(text); };

    async function sendOne(job, o){
        const row = await one(`SELECT * FROM queue WHERE job_id = $1 AND status = 'wait' ORDER BY ord LIMIT 1`, [job.id]);
        if(!row) return false;
        const boxes = await q(`SELECT * FROM boxes WHERE job_id = $1 AND active = 1 AND deleted_at IS NULL ORDER BY created_at`, [job.id]);
        if(!boxes.length){
            await q(`UPDATE jobs SET status = 'pause', last_error = 'нет рабочих ящиков' WHERE id = $1`, [job.id]);
            alertOnce("nobox:" + job.id, `⚠️ Рассылка по заказу №${o.num} на паузе: нет рабочих ящиков. CRM → Серверы.`);
            return false;
        }
        const box = boxes[Number(job.rr) % boxes.length];
        await q(`UPDATE jobs SET rr = rr + 1 WHERE id = $1`, [job.id]);
        let pass; try { pass = M.decrypt(box.pass_enc); } catch(e){ await q(`UPDATE boxes SET active = 0, last_error = $1 WHERE id = $2`, [e.message, box.id]); return true; }
        const L = letterFor(o), fb = o.kind === "cv" ? {n: o.res_name, d: o.res_b64} : {n: o.cv_name, d: o.cv_b64};
        const attach = fb.d ? {name: fb.n || "CV.pdf", mime: M.mimeOf(fb.n || "CV.pdf"), data: Buffer.from(fb.d, "base64")} : null;
        const name = [o.first_name, o.last_name].filter(Boolean).join(" ");
        try {
            const raw = M.message({fromEmail: box.email, fromName: name, to: row.email, subject: L.subject, text: L.text, attach, replyTo: o.email});
            await M.smtp(box, pass, box.email, row.email, raw);
            await q(`UPDATE queue SET status = 'sent', box = $1, sent_at = $2 WHERE id = $3`, [box.email, now(), row.id]);
            await q(`UPDATE jobs SET sent = sent + 1 WHERE id = $1`, [job.id]); await q(`UPDATE boxes SET sent = sent + 1 WHERE id = $1`, [box.id]);
        } catch(e){
            const auth = e instanceof M.SmtpError && e.stage === "вход", msg = String(e.message || e).slice(0, 300);
            if(auth){ await q(`UPDATE boxes SET active = 0, last_error = $1 WHERE id = $2`, [msg, box.id]); alertOnce("auth:" + box.id, `⚠️ Ящик ${box.email} не пускает по паролю: ${msg}`); }
            else if(PERM(e) || Number(row.tries) >= 1){
                await q(`UPDATE queue SET status = 'fail', error = $1, tries = tries + 1, box = $2 WHERE id = $3`, [msg, box.email, row.id]);
                await q(`UPDATE jobs SET failed = failed + 1 WHERE id = $1`, [job.id]);
            } else await q(`UPDATE queue SET tries = tries + 1, error = $1, ord = ord + 1 WHERE id = $2`, [msg, row.id]);
            await q(`UPDATE boxes SET last_error = $1 WHERE id = $2`, [msg, box.id]);
        }
        return true;
    }

    async function finish(job, o){
        await q(`UPDATE jobs SET status = 'done', finished_at = $1 WHERE id = $2`, [now(), job.id]);
        const j = await one(`SELECT * FROM jobs WHERE id = $1`, [job.id]);
        await note(o.id, `Рассылка №${j.m} завершена: отправлено ${j.sent} из ${j.total}, ошибок ${j.failed}`);
        Mail.T.finished(o, j).catch(() => {});
        Mail.owner(`✅ Рассылка №${j.m} завершена\nЗаказ №${o.num} · ${o.first_name || ""} ${o.last_name || ""}\nОтправлено ${j.sent} из ${j.total}, ошибок ${j.failed}`);
        const left = await one(`SELECT COUNT(*) AS n FROM jobs WHERE order_id = $1 AND status <> 'done' AND status <> 'stop'`, [o.id]);
        if(Number(left.n) === 0){ await q(`UPDATE orders SET status = 'done', done_at = $1 WHERE id = $2`, [now(), o.id]); }
    }

    /* ---------- цикл ---------- */
    async function tick(){
        if(busy) return; busy = true;
        try {
            const jobs = await q(`SELECT j.* FROM jobs j WHERE j.status IN ('wait','run') ORDER BY j.start_at`);
            for(const job of jobs){
                const o = await one(`SELECT * FROM orders WHERE id = $1`, [job.order_id]); if(!o) continue;
                if(job.status === "wait"){
                    if(Number(o.cover) && !o.cover_ok) continue;                       // ждём персональное письмо и подтверждение клиента
                    if(Date.parse(job.start_at) > Date.now() || !["paid", "in_progress"].includes(o.status) || !o.email_ok) continue;           // ждём оплату и подтверждение e-mail
                    try { await prepare(job, o); } catch(e){
                        await q(`UPDATE jobs SET last_error = $1 WHERE id = $2`, [String(e.message).slice(0, 300), job.id]);
                        alertOnce("prep:" + job.id, `⚠️ Не удалось подготовить рассылку по заказу №${o.num}: ${e.message}`, 120);
                    }
                    continue;
                }
                if(Date.now() - (lastSend.get(job.id) || 0) < GAP()) continue;
                lastSend.set(job.id, Date.now());
                const more = await sendOne(job, o);
                if(!more){
                    const left = await one(`SELECT COUNT(*) AS n FROM queue WHERE job_id = $1 AND status = 'wait'`, [job.id]);
                    const cur = await one(`SELECT status FROM jobs WHERE id = $1`, [job.id]);
                    if(Number(left.n) === 0 && cur.status === "run") await finish(job, o);
                }
            }
            // ящики — через 24 часа после конца рассылки
            const h = Number(env("BOX_DELETE_H")); const hours = Number.isFinite(h) && h >= 0 && env("BOX_DELETE_H") !== "" ? h : 24;
            for(const job of await q(`SELECT * FROM jobs WHERE status IN ('done','stop') AND boxes_deleted_at IS NULL AND finished_at IS NOT NULL`)){
                if(Date.now() - Date.parse(job.finished_at) < hours * 3600e3) continue;
                let ok = true;
                for(const b of await q(`SELECT * FROM boxes WHERE job_id = $1 AND deleted_at IS NULL`, [job.id])) try { await deleteBox(b); } catch(e){ ok = false; console.error("ящик не удалён:", b.email, e.message); }
                if(ok) await q(`UPDATE jobs SET boxes_deleted_at = $1 WHERE id = $2`, [now(), job.id]);
            }
        } catch(e){ console.error("engine:", e); } finally { busy = false; }
    }
    let timer = null;
    /* ---------- ответы компаний: раз в REPLY_MIN минут читаем входящие ящиков рассылки ---------- */
    let replyAt = 0, replyBusy = false;
    async function pollReplies(){
        if(replyBusy) return; replyBusy = true;
        try {
            const IM = require("./imap.js"), cfgs = M.cfgs(), own = new Set(cfgs.map(c => c.domain)), fresh = new Map();
            for(const b of await q(`SELECT * FROM boxes WHERE deleted_at IS NULL AND active = 1`)){
                const c = cfgs.find(x => x.domain === b.domain); if(!c) continue;
                const st = await one(`SELECT * FROM imap_state WHERE box_id = $1`, [b.id]) || {last_uid: 0};
                let S = null, last = Number(st.last_uid) || 0, err = null;
                try {
                    S = await IM.session({host: c.imap, port: c.imapPort, user: b.email, pass: M.decrypt(b.pass_enc), insecure: !!Number(b.insecure)});
                    await S.login(); await S.select("INBOX");
                    const uids = (await S.search(`UID ${last + 1}:*`)).filter(u => u > last).slice(0, 60);
                    for(const {uid, data} of await S.fetchMany(uids)){
                        last = Math.max(last, uid);
                        if(!data || !data.length) continue;
                        const r = IM.parseMail(data);
                        if(r.kind === "bounce" || !r.from || own.has(String(r.from).split("@")[1]) || own.has(String(r.fromRaw).split("@")[1])) continue;
                        if(await one(`SELECT id FROM replies WHERE order_id = $1 AND box = $2 AND uid = $3`, [b.order_id, b.email, uid])) continue;
                        await q(`INSERT INTO replies(id, order_id, box, uid, from_email, from_name, subject, text, kind, at, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                            [uuid(), b.order_id, b.email, uid, r.from, String(r.name || "").slice(0, 200), r.subject, r.text, r.kind, new Date(r.date).toISOString(), now()]);
                        if(r.kind === "reply") fresh.set(b.order_id, (fresh.get(b.order_id) || 0) + 1);
                    }
                } catch(e){ err = String(e.message || e).slice(0, 300); }
                finally { if(S) S.close(); }
                await q(`DELETE FROM imap_state WHERE box_id = $1`, [b.id]);
                await q(`INSERT INTO imap_state(box_id, last_uid, checked_at, error) VALUES($1,$2,$3,$4)`, [b.id, last, now(), err]);
            }
            for(const [oid, n] of fresh){
                const o = await one(`SELECT * FROM orders WHERE id = $1`, [oid]); if(!o) continue;
                await note(oid, `Ответов от компаний: ${n}`, "Система");
                if(o.email_ok) Mail.T.newReplies(o, n).catch(() => {});
            }
        } catch(e){ console.error("replies:", e); } finally { replyBusy = false; }
    }
    const REPLY_MS = () => { const m = Number(env("REPLY_MIN")); return (m > 0 ? m : 5) * 60e3; };
    const start = () => { if(!timer) timer = setInterval(() => { tick().catch(() => {}); if(Date.now() - replyAt > REPLY_MS()){ replyAt = Date.now(); pollReplies().catch(() => {}); } }, 5000); };

    async function jobCtl(job, action, who){
        const o = await one(`SELECT * FROM orders WHERE id = $1`, [job.order_id]);
        if(action === "pause") await q(`UPDATE jobs SET status = 'pause' WHERE id = $1 AND status IN ('run','wait')`, [job.id]);
        else if(action === "resume") await q(`UPDATE jobs SET status = CASE WHEN started_at IS NULL THEN 'wait' ELSE 'run' END, last_error = NULL WHERE id = $1 AND status = 'pause'`, [job.id]);
        else if(action === "stop"){ await q(`UPDATE jobs SET status = 'stop', finished_at = $1 WHERE id = $2`, [now(), job.id]); }
        else if(action === "retry"){ await q(`UPDATE queue SET status = 'wait', tries = 0, error = NULL WHERE job_id = $1 AND status = 'fail'`, [job.id]);
            await q(`UPDATE jobs SET status = 'run', failed = 0 WHERE id = $1`, [job.id]); }
        if(o) await note(o.id, `Рассылка №${job.m}: ${({pause: "пауза", resume: "продолжена", stop: "остановлена", retry: "повтор ошибок"})[action] || action}`, who);
    }

    /* тестовое письмо: временный ящик на первом сервере → письмо на адрес владельца */
    async function testSend(to){
        const c = M.sendCfgs()[0]; if(!c) throw new Error("не настроены почтовые серверы");
        const acc = "test" + crypto.randomBytes(3).toString("hex"), pass = M.newPass(), email = `${acc}@${c.domain}`;
        await M.hestia(c, "v-add-mail-account", [c.user, c.domain, acc, pass, c.quota]);
        try {
            await new Promise(r => setTimeout(r, 2500));
            await M.smtp({host: c.smtp, port: c.port, email, insecure: c.insecure}, pass, email, to,
                M.message({fromEmail: email, fromName: "Vreise тест", to, subject: "Тест рассылки Vreise.ru", text: "Это тестовое письмо. Сервер " + c.domain + " принимает и отправляет почту.", unsub: false}));
        } finally { await M.hestia(c, "v-delete-mail-account", [c.user, c.domain, acc]).catch(() => {}); }
        return c.domain;
    }

    return {pollReplies, startOrder, tick, start, jobCtl, note, pick, baseCounts, testSend, letterFor, hasBase, parseExclude, deleteBox};
};
