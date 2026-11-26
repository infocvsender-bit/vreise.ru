"use strict";
/* Рассылка: заказ оплачен → задания (1/2/3 рассылки на выбранные даты, отправка по будням 06:00–18:00 МСК, не быстрее 10 часов; базы Россия / Европа + Россия / Офшор / Танкеры — не быстрее 6 часов) → ящик на каждом сервере Hestia (по имени клиента) →
   очередь адресов из базы → письма по одному с паузой SEND_GAP_SEC → отчёт. Ответы компаний идут клиенту (Reply-To). Ящики удаляются через 24 часа после конца. */
const crypto = require("crypto");
const M = require("./mailer.js");
const Mail = require("./mails.js");
const {env} = M;

const uuid = () => crypto.randomUUID(), now = () => new Date().toISOString();
const GAP = () => Math.max(2, Number(env("SEND_GAP_SEC")) || 20) * 1000;
const WEEK = 7 * 864e5, DAY = 864e5, MSK = 3 * 3600e3;
/* Окно отправки: будни, 06:00–18:00 по Москве (UTC+3, без перехода на летнее время). Рассылка идёт минимум 10 часов окна. */
const MIN_HOURS = 10, WIN_FROM = 6, WIN_TO = 18;
const mskParts = ms => { const d = new Date(ms + MSK); return {dow: d.getUTCDay(), h: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600, d}; };
/* заказ на тестовую базу владельца (без реальной доп. базы): окно 06:00–18:00 МСК, выходные и 10-часовой темп не применяются */
const PLAN = require("./plan.js");
const isTest = o => !!o && o.base === "test" && !o.extra_base;
const inWindow = ms => { const p = mskParts(ms); return p.dow >= 1 && p.dow <= 5 && p.h >= WIN_FROM && p.h < WIN_TO; };
/* Старт «сегодня» (по Москве): можно, если заказ оформляется в будний день до 12:00 МСК; время старта — не позже 15:00 (дальше идёт до 18:00 и продолжается на следующий рабочий день).
   После 12:00 и в выходные: «на сегодня нет свободных мест». Возвращает текст ошибки или "" (если дата не сегодняшняя — тоже ""). */
const TODAY_UNTIL = 12, TODAY_LAST_START = 15, NO_PLACES = "На сегодня нет свободных мест — выберите другую дату";
function sameDayCheck(at, nowMs = Date.now()){
    const ms = parseMsk(at); if(!Number.isFinite(ms)) return "";
    const day = t => Math.floor((t + MSK) / DAY); if(day(ms) !== day(nowMs)) return "";
    const np = mskParts(nowMs), p = mskParts(ms);
    if(np.dow < 1 || np.dow > 5 || np.h >= TODAY_UNTIL) return NO_PLACES;
    if(p.h > TODAY_LAST_START) return `Сегодня старт возможен не позже ${TODAY_LAST_START}:00 по Москве`;
    if(ms < nowMs) return "Это время уже прошло — выберите более позднее";
    return "";
}
/* Пауза клиента — не дольше 2 рабочих дней: прибавляем 2 будних дня (суббота и воскресенье не считаются) */
const PAUSE_DAYS = 2;
function addWorkdays(ms, n){ let t = ms, k = 0; while(k < n){ t += DAY; const w = mskParts(t).dow; if(w >= 1 && w <= 5) k++; } return t; }
function nextWindow(ms){                                   // ближайший момент не раньше ms, когда отправка разрешена
    let t = ms;
    for(let i = 0; i < 12; i++){
        const p = mskParts(t), day0 = Date.UTC(p.d.getUTCFullYear(), p.d.getUTCMonth(), p.d.getUTCDate()) - MSK;   // 00:00 МСК этого дня, в UTC
        if(p.dow === 6) t = day0 + 2 * DAY + WIN_FROM * 3600e3;          // суббота → понедельник
        else if(p.dow === 0) t = day0 + DAY + WIN_FROM * 3600e3;         // воскресенье → понедельник
        else if(p.h < WIN_FROM) t = day0 + WIN_FROM * 3600e3;
        else if(p.h >= WIN_TO) t = day0 + DAY + WIN_FROM * 3600e3;
        else return t;
    }
    return t;
}
const parseMsk = s => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(s || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - MSK : NaN; };

module.exports = function engine(db){
    const q = (s, p) => db.query(s, p), one = (s, p) => db.one(s, p);
    const Push = require("./push.js")({getDb: () => db, now, subject: (process.env.SITE_URL || "").startsWith("https://") ? process.env.SITE_URL : "https://vreise.ru"});
    Push.init().catch(e => console.error("push init:", e.message));
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
        const tokens = parseExclude(o.exclude), seen = new Set(), out = [], keys = [o.base, o.extra_base].filter(Boolean);
        if(keys.includes("test")){                                      // служебная база владельца: свои адреса из test_rows, в реальные базы не попадают
            for(const r of await q(`SELECT email, company FROM test_rows ORDER BY added_at, email`)) if(!seen.has(r.email) && seen.add(r.email)) out.push({email: r.email, company: r.company || "", country: "", fleets: "", bases: "test"});
        }
        const real = keys.filter(k => k !== "test");
        if(real.length){
            const rows = await q(`SELECT email, company, country, fleets, bases FROM base_rows`);
            for(const r of rows) if(real.some(k => hasBase(r, k)) && !excluded(r, tokens) && !seen.has(r.email) && seen.add(r.email)) out.push(r);
        }
        return out;
    }
    /* порядок отправки: сначала компании, чей флот совпадает с видами судов, выбранными моряком; внутри группы — вперемешку.
       Далее — компании без указанного флота, в конце — с другим флотом. «Любые суда» / нет выбора — просто вперемешку. */
    const FLEET_OF = [[/офшор/i, "offshore"], [/танкер|газовоз/i, "tanker"], [/пассажир|яхт|ро-ро|паром/i, "passenger"], [/контейнер|балкер|генеральн/i, "merchant"]];
    function wantFleets(o){
        const v = String(o.vessel || ""); if(!v || /любые суда/i.test(v)) return [];
        return [...new Set(FLEET_OF.filter(([re]) => re.test(v)).map(x => x[1]))];
    }
    function byFleet(rows, o){
        const want = wantFleets(o), rnd = () => Math.random() - .5;
        if(!want.length) return rows.slice().sort(rnd);
        const score = r => {
            const f = String(r.fleets || "").toLowerCase().split(/[;,\s\/]+/).filter(Boolean);
            if(!f.length) return 1;
            const hit = want.filter(w => f.some(x => x.includes(w) || (w === "tanker" && /gas|lng|lpg/.test(x)))).length;
            return hit ? 3 + hit : 0;
        };
        return rows.map(r => ({r, s: score(r), k: Math.random()})).sort((a, b) => b.s - a.s || a.k - b.k).map(x => x.r);
    }
    async function baseCounts(){
        const rows = await q(`SELECT fleets, bases FROM base_rows`), out = {};
        /* пока базы не загружены в CRM, на карточках показываем ориентировочное число адресов из каталога */
        for(const b of require("./catalog.js").BASES) out[b.key] = rows.filter(r => hasBase(r, b.key)).length || (rows.length ? 0 : b.count || 0);
        return {total: rows.length, byBase: out};
    }

    /* Уведомление клиенту об ответах (письмо + пуш) — ОДНО на заказ: когда пришло первых 10 писем компаний (ответы и автоответы).
       Дальше не шлём (решение владельца 26.11); сами письма всегда видны в кабинете. */
    async function flushReplies(o, why){
        const rows = await q(`SELECT id, kind, subject FROM replies WHERE order_id = $1 AND kind IN ('reply', 'auto') AND notified IS NULL ORDER BY at`, [o.id]);
        if(!rows.length) return 0;
        const live = rows.filter(r => r.kind === "reply").length, n = rows.length, t = now();
        for(const r of rows) await q(`UPDATE replies SET notified = $1 WHERE id = $2`, [t, r.id]);
        await note(o.id, `Клиенту сообщили о новых письмах компаний: ${n}${live ? `, живых ответов: ${live}` : " (автоответы)"} — повод: ${why}`, "Система");
        if(o.email_ok) Mail.T.newReplies(o, n, live).catch(() => {});
        const last = rows[rows.length - 1];
        Push.notify(o.email, {title: live ? `💬 Ответ компании · заказ №${o.num}` : `✉️ Автоответы компаний · заказ №${o.num}`,
            body: n > 1 ? `Новых писем: ${n}${live ? `, живых ответов: ${live}` : ""}. Нажмите, чтобы прочитать.` : String(last.subject || "Нажмите, чтобы прочитать").slice(0, 120), url: Mail.orderLink(o) + "#replies", tag: "reply-" + o.id}).catch(() => {});
        return n;
    }
    async function notifyReplies10(o){
        if(o.replies_ntf) return;
        const c = Number((await one(`SELECT COUNT(*) AS c FROM replies WHERE order_id = $1 AND kind IN ('reply', 'auto')`, [o.id])).c);
        if(c < 10) return;
        await q(`UPDATE orders SET replies_ntf = $1 WHERE id = $2 AND replies_ntf IS NULL`, [now(), o.id]);
        await flushReplies(o, "пришло первых 10 писем");
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
            return `Добрый день!\nУважаемый менеджер по экипажам!\nМеня зовут ${name}.\nПишу, чтобы откликнуться на ${many ? "должности" : "должность"} ${P.join(", ") || "моряка"} в вашей компании. У меня большой морской опыт, я ответственно отношусь к безопасности и умею работать в команде.\nЯ работал(а) на судах разных типов, имею все необходимые документы по конвенции ПДНВ (STCW). Если вашей компании потребуются дополнительные документы, я готов(а) их оформить.\n${o.vessel ? `Хотел(а) бы работать на судах: ${o.vessel}.\n` : ""}Безопасность для меня — приоритет: умею оценивать риски, действовать в аварийных ситуациях и применять эффективные меры безопасности. Легко нахожу общий язык с интернациональными экипажами.\nРезюме прикладываю — там подробнее о моей квалификации и опыте.\nСпасибо за внимание к моей кандидатуре. Готов(а) пройти собеседование в удобное для вас время и буду рад(а) обсудить, чем могу быть полезен(на) вашей компании.\nМои контакты:\n\nE-mail: ${o.reply_to || o.email}${phone}\n\nС уважением,\n${name}`;
        }
        const nm = latin(name);
        return `Good day\nDear Crew Manager\nMy name is ${nm}\nI am writing to apply for ${many ? "the positions" : "the position"} of ${P.join(", ") || "a seafarer position"} at your company. With my extensive maritime experience and strong commitment to safety and teamwork.\nI have experience in the maritime industry, having served onboard various types of vessels. I possess the necessary certifications according to STCW convention. Also I\u2019m ready to obtain any additional documents if it is required by your company.\n${o.vessel ? `I would like to work onboard: ${vesEn(o.vessel)}.\n` : ""}Safety is my top priority, and I have a proven track record of promoting a culture of safety onboard. I am skilled in risk assessment, emergency response, and implementing effective safety measures. I am also a team player with excellent communication skills and the ability to work well with multicultural crews.\nI have attached my resume for your review, which provides further details on my qualifications and experiences.\nThank you for considering my application. I am available for an interview at your convenience, and I look forward to the opportunity to discuss how my skills align with the needs of your company.\nMy Contact details\n\nEmail: ${o.reply_to || o.email}${phone}\n\nBest Regards\n${nm}`;
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
        let sched = []; try { sched = JSON.parse(o.schedule || "[]"); } catch(e){}
        let prev = 0;
        for(let m = 1; m <= Number(o.times || 1); m++){
            let chosen = parseMsk(sched[m - 1]); if(Number.isFinite(chosen)){ const wd = mskParts(chosen).dow; if(wd === 6) chosen += 2 * DAY; else if(wd === 0) chosen += DAY; }   // выходной → тот же час в понедельник
            const want = Math.max(Number.isFinite(chosen) ? chosen : Date.now() + (m - 1) * WEEK, Date.now(), prev ? prev + 2 * DAY : 0);
            const at = nextWindow(want); prev = at;
            await q(`INSERT INTO jobs(id, order_id, m, status, start_at) VALUES($1,$2,$3,'wait',$4)`, [uuid(), o.id, m, new Date(at).toISOString()]);
        }
        await q(`UPDATE orders SET status = 'in_progress' WHERE id = $1`, [o.id]);
        await note(o.id, `Рассылка поставлена в очередь: ${o.times} шт. по выбранным клиентом датам (отправка — по будням 06:00–18:00 МСК)`, who || "Система");
        if(Number(o.cover) && !o.cover_ok){
            await note(o.id, "💌 Заказано персональное сопроводительное письмо — составьте его в CRM (карточка заказа), клиент подтвердит. Рассылка стартует после подтверждения.", "Система");
            Mail.owner(`💌 Нужно персональное письмо — заказ №${o.num}\n${[o.first_name, o.last_name].filter(Boolean).join(" ")} · ${o.position || ""}\nCRM → заказ №${o.num} → «Персональное письмо». Рассылка ждёт.`, o.id);
        }
        setTimeout(() => tick().catch(() => {}), 1500);
    }

    async function prepare(job, o){
        const rows = await pick(o);
        if(!rows.length) throw new Error(`в базе «${o.base}» нет адресов — загрузите базу в CRM → Базы`);
        if(!M.sendCfgs().length) throw new Error("не настроены почтовые серверы (HESTIA_N_URL / KEY / USER / DOMAIN)");
        const {ids, errs} = await createBoxes(o, job);
        if(!ids.length) throw new Error("ящики не созданы: " + errs.join("; "));
        if(errs.length) await note(o.id, `⚠️ Часть серверов не дала ящик: ${errs.join("; ")}`);
        const ordered = byFleet(rows, o);
        for(let i = 0; i < ordered.length; i++){ const r = ordered[i]; await q(`INSERT INTO queue(id, job_id, email, company, country, ord, status) VALUES($1,$2,$3,$4,$5,$6,'wait')`, [uuid(), job.id, r.email, r.company || "", r.country || "", i]); }
        await q(`UPDATE jobs SET status = 'run', total = $1, started_at = $2, last_error = NULL WHERE id = $3`, [rows.length, now(), job.id]);
        await note(o.id, `Рассылка №${job.m} началась: ${rows.length} адресов, ящиков: ${ids.length}`);
        Mail.T.started(o, {...job, total: rows.length}).catch(() => {});
        Mail.owner(`▶️ Рассылка №${job.m} запущена\nЗаказ №${o.num} · ${o.first_name || ""} ${o.last_name || ""}\n${rows.length} адресов`, o.id);
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
            const raw = M.message({fromEmail: box.email, fromName: name, to: row.email, subject: L.subject, text: L.text, attach, replyTo: o.reply_to || o.email});
            await M.smtp(box, pass, box.email, row.email, raw);
            await q(`UPDATE queue SET status = 'sent', box = $1, sent_at = $2 WHERE id = $3`, [box.email, now(), row.id]);
            await q(`UPDATE jobs SET sent = sent + 1 WHERE id = $1`, [job.id]); await q(`UPDATE boxes SET sent = sent + 1 WHERE id = $1`, [box.id]);
        } catch(e){
            const auth = e instanceof M.SmtpError && e.stage === "вход", msg = String(e.message || e).slice(0, 300);
            if(auth){ await q(`UPDATE boxes SET active = 0, last_error = $1 WHERE id = $2`, [msg, box.id]); alertOnce("auth:" + box.id, `⚠️ Ящик ${box.email} не пускает по паролю: ${msg}`); }
            else if(PERM(e) || Number(row.tries) >= 1){
                await q(`UPDATE queue SET status = 'fail', error = $1, tries = tries + 1, box = $2 WHERE id = $3`, [msg, box.email, row.id]);
                await q(`UPDATE jobs SET failed = failed + 1 WHERE id = $1`, [job.id]);
            } else await q(`UPDATE queue SET tries = tries + 1, error = $1, ord = ord + 10000000 WHERE id = $2`, [msg, row.id]);
            await q(`UPDATE boxes SET last_error = $1 WHERE id = $2`, [msg, box.id]);
        }
        return true;
    }

    async function finish(job, o){
        await q(`UPDATE jobs SET status = 'done', finished_at = $1 WHERE id = $2`, [now(), job.id]);
        const j = await one(`SELECT * FROM jobs WHERE id = $1`, [job.id]);
        await note(o.id, `Рассылка №${j.m} завершена: отправлено ${j.sent} из ${j.total}, ошибок ${j.failed}`);
        Mail.T.finished(o, j).catch(() => {});
        Mail.owner(`✅ Рассылка №${j.m} завершена\nЗаказ №${o.num} · ${o.first_name || ""} ${o.last_name || ""}\nОтправлено ${j.sent} из ${j.total}, ошибок ${j.failed}`, o.id);
        const left = await one(`SELECT COUNT(*) AS n FROM jobs WHERE order_id = $1 AND status <> 'done' AND status <> 'stop'`, [o.id]);
        if(Number(left.n) === 0){ await q(`UPDATE orders SET status = 'done', done_at = $1 WHERE id = $2`, [now(), o.id]); }
    }

    /* ---------- цикл ---------- */
    async function tick(){
        if(busy) return; busy = true;
        try {
            for(const pj of await q(`SELECT * FROM jobs WHERE status = 'pause' AND pause_until IS NOT NULL AND pause_until <= $1 AND last_error IS NULL`, [now()])){      // пауза клиента закончилась — продолжаем сами
                await jobCtl(pj, "resume", "Система"); const po = await one(`SELECT * FROM orders WHERE id = $1`, [pj.order_id]);
                if(po){ await note(po.id, `Рассылка №${pj.m}: пауза (максимум 2 рабочих дня) закончилась — рассылка продолжена автоматически`, "Система"); Mail.owner(`▶️ Пауза закончилась (2 рабочих дня), рассылка продолжена автоматически\nЗаказ №${po.num} · рассылка №${pj.m} · ${po.email}`, po.id).catch(() => {}); }
            }
            const jobs = await q(`SELECT j.* FROM jobs j WHERE j.status IN ('wait','run') ORDER BY j.start_at`);
            for(const job of jobs){
                const o = await one(`SELECT * FROM orders WHERE id = $1`, [job.order_id]); if(!o) continue;
                if(job.status === "wait"){
                    if(Number(o.cover) && !o.cover_ok) continue;                       // ждём персональное письмо и подтверждение клиента
                    if(o.kind === "mailing" && !o.cv_b64) continue;                      // резюме не прикреплено — рассылка не начнётся, пока клиент не загрузит файл в кабинете
                    if(!o.start_ok) continue;                                           // клиент ещё не нажал «Старт рассылки» в кабинете (или менеджер не запустил без него)
                    if(o.kind === "cv" && o.base && !o.res_ok) continue;               // резюме «Стандарт» + рассылка: ждём, пока клиент проверит и подтвердит готовое резюме
                    if(Date.parse(job.start_at) > Date.now() || (!isTest(o) && !inWindow(Date.now())) || !["paid", "in_progress"].includes(o.status) || !o.email_ok) continue;           // ждём оплату и подтверждение e-mail
                    try { await prepare(job, o); } catch(e){
                        await q(`UPDATE jobs SET last_error = $1 WHERE id = $2`, [String(e.message).slice(0, 300), job.id]);
                        alertOnce("prep:" + job.id, `⚠️ Не удалось подготовить рассылку по заказу №${o.num}: ${e.message}`, 120);
                    }
                    continue;
                }
                if(!isTest(o) && !inWindow(Date.now())) continue;                              // вне окна 06:00–18:00 МСК и в выходные не отправляем
                let batch = 1, keepLast = 0;
                if(!isTest(o) && require("./catalog.js").sameDay(o)){            // «Россия» / «Европа + Россия» / «Офшор» / «Танкеры»: вся рассылка не быстрее 6 часов (вместо 10) — при старте до 12:00 уходит в тот же день
                    const g = Math.max(PLAN.sameGapMs(), PLAN.SAME_MIN_H * 3600e3 / Math.max(1, Number(job.total) || 1)), last = lastSend.get(job.id) || 0, since = Date.now() - last;
                    if(since < g) continue;
                    batch = Math.min(4, Math.floor(since / g));                           // тик раз в 5 с: при паузе меньше 5 с за тик уходит несколько писем; остаток времени переносится
                    keepLast = last && since < 5 * g ? last + batch * g : Date.now();
                } else
                if(Date.now() - (lastSend.get(job.id) || 0) < (isTest(o) ? GAP() : Math.max(GAP(), MIN_HOURS * 3600e3 / Math.max(1, Number(job.total) || 1)))) continue;   // темп: вся рассылка не быстрее 10 часов
                lastSend.set(job.id, keepLast || Date.now());
                let more = await sendOne(job, o);
                for(let bi = 1; bi < batch && more; bi++) more = await sendOne(job, o);
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
                        /* недоставленное (бан, ошибка, квота) — клиенту не показываем, храним для CRM; автоответы и ответы — показываем */
                        if(r.kind !== "bounce" && (!r.from || own.has(String(r.from).split("@")[1]) || own.has(String(r.fromRaw).split("@")[1]))) continue;
                        if(await one(`SELECT id FROM replies WHERE order_id = $1 AND box = $2 AND uid = $3`, [b.order_id, b.email, uid])) continue;
                        await q(`INSERT INTO replies(id, order_id, box, uid, from_email, from_name, subject, text, kind, at, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                            [uuid(), b.order_id, b.email, uid, r.from, String(r.name || "").slice(0, 200), r.subject, r.text, r.kind, new Date(r.date).toISOString(), now()]);
                        if(r.kind !== "bounce"){ const f = fresh.get(b.order_id) || {reply: 0, auto: 0, last: ""}; f[r.kind === "reply" ? "reply" : "auto"]++; f.last = r.subject || f.last; fresh.set(b.order_id, f); }
                    }
                } catch(e){ err = String(e.message || e).slice(0, 300); }
                finally { if(S) S.close(); }
                await q(`DELETE FROM imap_state WHERE box_id = $1`, [b.id]);
                await q(`INSERT INTO imap_state(box_id, last_uid, checked_at, error) VALUES($1,$2,$3,$4)`, [b.id, last, now(), err]);
            }
            for(const [oid, f] of fresh){
                const o = await one(`SELECT * FROM orders WHERE id = $1`, [oid]); if(!o) continue;
                await note(oid, `Пришло писем от компаний: ${f.reply + f.auto}` + (f.reply ? `, живых ответов: ${f.reply}` : " (автоответы)"), "Система");
                await notifyReplies10(o);
            }
        } catch(e){ console.error("replies:", e); } finally { replyBusy = false; }
    }
    /* ---------- входящие на системную почту (info@…): читаем по IMAP, показываем в CRM → «Письма» ---------- */
    let inboxBusy = false;
    async function pollInbox(){
        if(inboxBusy || !M.sysOn()) return; inboxBusy = true;
        try {
            const IM = require("./imap.js"), host = env("SYS_IMAP_HOST") || env("SYS_SMTP_HOST"), port = Number(env("SYS_IMAP_PORT")) || 993;
            const mine = new Set([env("SYS_SMTP_USER"), env("SYS_SMTP_FROM")].map(x => String(x || "").replace(/^.*<([^>]+)>.*$/, "$1").trim().toLowerCase()).filter(Boolean));     // письма с самого ящика (наши же уведомления, тесты) в «Входящие» не берём — иначе уведомление порождает новое уведомление
            await q(`DELETE FROM inbox WHERE lower(from_email) = ANY($1)`.replace("= ANY($1)", "IN (" + [...mine].map((_, i) => "$" + (i + 1)).join(",") + ")"), [...mine]).catch(() => {});
            const st = await one(`SELECT value FROM meta WHERE key = 'inbox_uid'`); let last = st ? Number(st.value) || 0 : -1, err = null, fresh = [];
            let S = null;
            try {
                S = await IM.session({host, port, user: env("SYS_SMTP_USER"), pass: env("SYS_SMTP_PASS"), insecure: env("SYS_SMTP_INSECURE") === "1"});
                await S.login(); await S.select("INBOX");
                let uids = last < 0 ? (await S.search("ALL")).slice(-30) : (await S.search(`UID ${last + 1}:*`)).filter(u => u > last).slice(0, 60);
                for(const {uid, data} of await S.fetchMany(uids)){
                    last = Math.max(last, uid);
                    if(!data || !data.length) continue;
                    const r = IM.parseMail(data);
                    if(mine.has(String(r.fromRaw || r.from).toLowerCase())) continue;
                    if(await one(`SELECT id FROM inbox WHERE uid = $1`, [uid])) continue;
                    await q(`INSERT INTO inbox(id, uid, from_email, from_name, subject, text, kind, at, created_at, seen) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,0)`,
                        [uuid(), uid, r.fromRaw || r.from, String(r.name || "").slice(0, 200), r.subject, r.text, r.kind, new Date(r.date).toISOString(), now()]);
                    if(r.kind === "reply" && Date.now() - r.date < 3 * 864e5) fresh.push(r);
                }
                if(last < 0) last = 0;
            } catch(e){ err = String(e.message || e).slice(0, 300); console.error("inbox:", err); }
            finally { if(S) S.close(); }
            if(last >= 0){ await q(`DELETE FROM meta WHERE key = 'inbox_uid'`); await q(`INSERT INTO meta(key, value) VALUES('inbox_uid', $1)`, [String(last)]); }
            await q(`DELETE FROM meta WHERE key = 'inbox_state'`); await q(`INSERT INTO meta(key, value) VALUES('inbox_state', $1)`, [JSON.stringify({at: now(), error: err})]);
            if(fresh.length) await Mail.owner(`✉️ ${fresh.length > 1 ? "Новые письма (" + fresh.length + ")" : "Новое письмо"} на ${env("SYS_SMTP_USER")} — откройте CRM → «Письма».${fresh.length === 1 ? "\nОт: " + (fresh[0].name || fresh[0].fromRaw || fresh[0].from) : ""}`).catch(() => {});
        } catch(e){ console.error("inbox:", e); } finally { inboxBusy = false; }
    }
    const REPLY_MS = () => { const m = Number(env("REPLY_MIN")); return (m > 0 ? m : 5) * 60e3; };
    /* через 3 дня после выполнения заказа — письмо «Оставьте отзыв» (ссылка на /reviews?o=<токен>); раз на заказ (`orders.review_ask`) */
    const REVIEW_DAYS = 3; let reviewAt = 0;
    /* Полное удаление заказа: останавливает рассылки, удаляет ящики на серверах и все данные. Возвращает список ошибок по ящикам. */
    async function deleteOrder(o, who){
        await q(`UPDATE jobs SET status = 'stop', finished_at = $1 WHERE order_id = $2 AND status IN ('wait','run','pause')`, [now(), o.id]);
        const errs = [];
        for(const b of await q(`SELECT * FROM boxes WHERE order_id = $1 AND deleted_at IS NULL`, [o.id])) try { await deleteBox(b); } catch(e){ errs.push(`${b.email}: ${e.message}`); }
        for(const b of await q(`SELECT id FROM boxes WHERE order_id = $1`, [o.id])) await q(`DELETE FROM imap_state WHERE box_id = $1`, [b.id]);
        await q(`DELETE FROM queue WHERE job_id IN (SELECT id FROM jobs WHERE order_id = $1)`, [o.id]);
        for(const t of ["jobs", "boxes", "replies", "reply_fwd", "notes", "order_docs", "ai_resumes", "reviews"]) await q(`DELETE FROM ${t} WHERE order_id = $1`, [o.id]);
        await q(`DELETE FROM orders WHERE id = $1`, [o.id]);
        console.log(`🗑 Заказ №${o.num} удалён (${who})`);
        return errs;
    }
    /* Не оплачен за UNPAID_H часов (по умолчанию 12; только статус «ждёт оплаты» — кто нажал «Я оплатил(а)», остаётся): письмо «Заказ отменён» с кнопкой «Оформить повторно», затем заказ удаляется везде. */
    const UNPAID_H = () => { const n = Number(env("UNPAID_H")); return n > 0 ? n : 12; };
    async function expireUnpaid(){
        const cut = new Date(Date.now() - UNPAID_H() * 3600e3).toISOString();
        const rows = await q(`SELECT * FROM orders WHERE status = 'new' AND created_at <= $1 ORDER BY created_at LIMIT 20`, [cut]);
        for(const o of rows){
            const cur = await one(`SELECT status FROM orders WHERE id = $1`, [o.id]); if(!cur || cur.status !== "new") continue;     // успел нажать «Я оплатил(а)»
            let sent = false; try { sent = await Mail.T.expired(o); } catch(e){}
            try { await deleteOrder(o, "Система"); } catch(e){ console.error("expire:", e.message); continue; }
            Mail.owner(`🗑 Заказ №${o.num} не оплачен за ${UNPAID_H()} ч — отменён и удалён\n${o.first_name || ""} ${o.last_name || ""} · ${Mail.rub(o.price)}\nПисьмо клиенту ${sent ? "отправлено" : "НЕ отправлено"}`);
        }
    }
    async function askReviews(){
        const cut = new Date(Date.now() - REVIEW_DAYS * DAY).toISOString();
        const rows = await q(`SELECT * FROM orders WHERE status = 'done' AND done_at IS NOT NULL AND done_at <= $1 AND review_ask IS NULL ORDER BY done_at LIMIT 20`, [cut]);
        for(const o of rows){
            await q(`UPDATE orders SET review_ask = $1 WHERE id = $2`, [now(), o.id]);          // сначала отмечаем — повторов не будет
            if(!o.email_ok || await one(`SELECT id FROM reviews WHERE order_id = $1`, [o.id])) continue;
            const sent = (await q(`SELECT sent FROM jobs WHERE order_id = $1`, [o.id])).some(j => Number(j.sent) > 0);
            if(!(sent || (o.kind === "cv" && o.res_name))) continue;                          // услуга не оказана (отмена до старта) — отзыв не просим
            Mail.T.reviewAsk(o).catch(() => {});
            await note(o.id, "Клиенту отправлена просьба оставить отзыв (через 3 дня после выполнения)", "Система");
        }
    }
    const start = () => { if(!timer) timer = setInterval(() => { tick().catch(() => {}); if(Date.now() - reviewAt > 600e3){ reviewAt = Date.now(); askReviews().catch(() => {}); expireUnpaid().catch(e => console.error("expire:", e.message)); } if(Date.now() - replyAt > REPLY_MS()){ replyAt = Date.now(); pollReplies().catch(() => {}); pollInbox().catch(() => {}); } }, 5000); };

    /* клиент поменял список исключений: убираем подходящие адреса из ещё не отправленной очереди уже идущих рассылок */
    async function applyExclude(o){
        const tokens = parseExclude(o.exclude); let removed = 0;
        if(!tokens.length) return 0;
        const jobs = await q(`SELECT * FROM jobs WHERE order_id = $1 AND started_at IS NOT NULL AND status IN ('run','pause','wait')`, [o.id]);
        for(const j of jobs){
            const rows = await q(`SELECT id, email, company FROM queue WHERE job_id = $1 AND status = 'wait'`, [j.id]);
            const drop = rows.filter(r => excluded(r, tokens));
            for(const r of drop) await q(`DELETE FROM queue WHERE id = $1`, [r.id]);
            if(drop.length){ await q(`UPDATE jobs SET total = total - $1 WHERE id = $2`, [drop.length, j.id]); removed += drop.length; }
        }
        return removed;
    }

    /* клиент меняет время старта ещё не начавшейся рассылки; at — «YYYY-MM-DDTHH:MM» по Москве */
    async function setJobTime(o, job, at, opt = {}){
        const T = isTest(o), ms = parseMsk(at); if(!Number.isFinite(ms)) throw new Error("Неверная дата");
        const p = mskParts(ms); if(!T && (p.h < WIN_FROM || p.h >= WIN_TO)) throw new Error("Время старта — с 06:00 до 18:00 по Москве");
        if(opt.client){ const e = sameDayCheck(at); if(e) throw new Error(e); }          // клиент: «сегодня» — только по правилу до 12:00 / не позже 15:00
        if(ms < Date.now() + (T ? 60e3 : 3600e3)) throw new Error(T ? "Время должно быть в будущем" : "Старт — не раньше чем через час от текущего момента");
        if(ms > Date.now() + 200 * DAY) throw new Error("Дата слишком далеко");
        const jobs = await q(`SELECT * FROM jobs WHERE order_id = $1 ORDER BY m`, [o.id]), day = t => Math.floor((t + MSK) / DAY);
        const prev = jobs.find(x => x.m === job.m - 1), next = jobs.find(x => x.m === job.m + 1);
        const GAPD = opt.client ? 2 : 1, fd = t => new Date(t).toLocaleDateString("ru-RU", {timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit"});     // клиенту между рассылками — минимум один свободный день (26.11 → следующая с 28.11), менеджеру — просто позже
        if(!T && prev && day(ms) - day(Date.parse(prev.start_at)) < GAPD) throw new Error(opt.client ? `Между рассылками должен пройти минимум один день — рассылка №${job.m} доступна с ${fd(Date.parse(prev.start_at) + 2 * DAY)}: так вашу рассылку не примут за спам` : "Каждая следующая рассылка — на более позднюю дату, чем предыдущая");
        if(!T && next && day(Date.parse(next.start_at)) - day(ms) < GAPD) throw new Error(opt.client ? `Между рассылками должен пройти минимум один день: эта рассылка должна быть не позже ${fd(Date.parse(next.start_at) - 2 * DAY)} (следующая стоит на ${fd(Date.parse(next.start_at))})` : "Эта рассылка должна быть раньше следующей");
        const at2 = T ? ms : nextWindow(ms);
        await q(`UPDATE jobs SET start_at = $1, status = CASE WHEN status = 'pause' THEN 'pause' ELSE 'wait' END WHERE id = $2`, [new Date(at2).toISOString(), job.id]);
        let sched = []; try { sched = JSON.parse(o.schedule || "[]"); } catch(e){}
        sched[job.m - 1] = at; await q(`UPDATE orders SET schedule = $1 WHERE id = $2`, [JSON.stringify(sched), o.id]);
        return new Date(at2).toISOString();
    }

    /* владелец: добавить заказу ещё одну рассылку (без доплаты); opt = {now: true} или {at: "YYYY-MM-DDTHH:MM"} по Москве */
    async function addJob(o, opt = {}){
        if(!o.base) throw new Error("У заказа нет рассылки");
        if(o.status === "cancelled") throw new Error("Заказ отменён");
        if(["new", "claimed"].includes(o.status)) throw new Error("Сначала подтвердите оплату заказа");
        const last = await one(`SELECT MAX(m) AS m FROM jobs WHERE order_id = $1`, [o.id]), m = (Number(last && last.m) || 0) + 1;
        if(m > 6) throw new Error("Не больше 6 рассылок в заказе");
        const T = isTest(o); let ms = opt.now ? Date.now() : parseMsk(opt.at);
        if(!Number.isFinite(ms)) throw new Error("Неверная дата: нужен формат ГГГГ-ММ-ДДTЧЧ:ММ по Москве");
        if(ms < Date.now() - 60e3) throw new Error("Время должно быть в будущем");
        if(ms > Date.now() + 200 * DAY) throw new Error("Дата слишком далеко");
        const at2 = T ? Math.max(ms, Date.now()) : nextWindow(Math.max(ms, Date.now()));
        await q(`INSERT INTO jobs(id, order_id, m, status, start_at) VALUES($1,$2,$3,'wait',$4)`, [uuid(), o.id, m, new Date(at2).toISOString()]);
        await q(`UPDATE orders SET times = $1, status = CASE WHEN status = 'done' THEN 'in_progress' ELSE status END, done_at = NULL WHERE id = $2`, [Math.max(m, Number(o.times) || 0), o.id]);
        setTimeout(() => tick().catch(() => {}), 1000);
        return {m, at: new Date(at2).toISOString()};
    }

    /* владелец из CRM: поставить старт на ближайшее разрешённое время («сейчас» — но только будни 06:00–18:00 МСК) */
    async function startJobNow(job){
        const o = await one(`SELECT * FROM orders WHERE id = $1`, [job.order_id]), T = isTest(o);
        const at2 = T ? Date.now() : nextWindow(Date.now()), prev = await one(`SELECT m, start_at FROM jobs WHERE order_id = $1 AND m < $2 ORDER BY m DESC LIMIT 1`, [job.order_id, job.m]);
        if(!T && prev && Date.parse(prev.start_at) >= at2) throw new Error(`Рассылка №${prev.m} должна стартовать раньше — сначала запустите её`);
        await q(`UPDATE jobs SET start_at = $1, status = CASE WHEN status = 'pause' THEN 'pause' ELSE 'wait' END WHERE id = $2`, [new Date(at2).toISOString(), job.id]);
        setTimeout(() => tick().catch(() => {}), 1000);
        return new Date(at2).toISOString();
    }

    async function jobCtl(job, action, who){
        const o = await one(`SELECT * FROM orders WHERE id = $1`, [job.order_id]);
        if(action === "pause") await q(`UPDATE jobs SET status = 'pause', pause_until = $2 WHERE id = $1 AND status IN ('run','wait')`, [job.id, who === "Клиент" ? new Date(addWorkdays(Date.now(), PAUSE_DAYS)).toISOString() : null]);   // клиентская пауза кончается сама через 2 рабочих дня; менеджер ставит паузу без срока
        else if(action === "resume") await q(`UPDATE jobs SET status = CASE WHEN started_at IS NULL THEN 'wait' ELSE 'run' END, last_error = NULL, pause_until = NULL WHERE id = $1 AND status = 'pause'`, [job.id]);
        else if(action === "stop"){ await q(`UPDATE jobs SET status = 'stop', finished_at = $1, pause_until = NULL WHERE id = $2`, [now(), job.id]); }
        else if(action === "retry"){ await q(`UPDATE queue SET status = 'wait', tries = 0, error = NULL WHERE job_id = $1 AND status = 'fail'`, [job.id]);
            await q(`UPDATE jobs SET status = 'run', failed = 0 WHERE id = $1`, [job.id]); }
        if(o) await note(o.id, `Рассылка №${job.m}: ${({pause: "пауза", resume: "продолжена", stop: "остановлена", retry: "повтор ошибок"})[action] || action}`, who);
    }

    /* тестовое письмо: временный ящик на первом сервере → письмо на адрес владельца */
    async function testSend(to, domain){
        const c = domain ? M.sendCfgs().find(x => x.domain === domain) : M.sendCfgs()[0]; if(!c) throw new Error("не настроены почтовые серверы");
        const acc = "test" + crypto.randomBytes(3).toString("hex"), pass = M.newPass(), email = `${acc}@${c.domain}`;
        await M.hestia(c, "v-add-mail-account", [c.user, c.domain, acc, pass, c.quota]);
        try {
            await new Promise(r => setTimeout(r, 2500));
            await M.smtp({host: c.smtp, port: c.port, email, insecure: c.insecure}, pass, email, to,
                M.message({fromEmail: email, fromName: "Vreise тест", to, subject: "Тест рассылки Vreise.ru", text: "Это тестовое письмо. Сервер " + c.domain + " принимает и отправляет почту.", unsub: false}));
        } finally { await M.hestia(c, "v-delete-mail-account", [c.user, c.domain, acc]).catch(() => {}); }
        return c.domain;
    }

    return {askReviews, expireUnpaid, deleteOrder, pollReplies, pollInbox, startOrder, tick, start, jobCtl, applyExclude, setJobTime, startJobNow, sameDayCheck, addJob, createBoxes, note, pick, baseCounts, testSend, letterFor, hasBase, parseExclude, deleteBox, byFleet, push: Push, flushReplies, notifyReplies10};
};
