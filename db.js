"use strict";
/* База данных: Postgres на Railway (DATABASE_URL), локально — SQLite (node:sqlite). Запросы с $1, $2 … */
const path = require("path");

module.exports = async function openDb(){
    const url = String(process.env.DATABASE_URL || "").trim();
    let db;
    if(url){
        const {Pool} = require("pg");
        const ssl = /railway\.internal|localhost|127\.0\.0\.1/.test(url) ? false : {rejectUnauthorized: false};
        const pool = new Pool({connectionString: url, ssl, max: 8});
        db = {kind: "pg", query: async (s, p = []) => (await pool.query(s, p)).rows};
    } else {
        const {DatabaseSync} = require("node:sqlite");
        const d = new DatabaseSync(process.env.SQLITE_FILE || path.join(__dirname, "data.db"));
        d.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
        db = {kind: "sqlite", query: async (s, p = []) => {
            const q = s.replace(/\$(\d+)/g, "?$1"), st = d.prepare(q), a = p.map(x => x === undefined ? null : x);
            if(/^\s*(SELECT|WITH|PRAGMA)/i.test(q) || /RETURNING/i.test(q)) return st.all(...a);
            st.run(...a); return [];
        }};
    }
    db.one = async (s, p) => (await db.query(s, p))[0];
    for(const s of [
        `CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, num INTEGER NOT NULL, token TEXT NOT NULL, kind TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL,
            base TEXT, times INTEGER NOT NULL DEFAULT 1, price INTEGER NOT NULL, status TEXT NOT NULL, first_name TEXT, last_name TEXT, email TEXT NOT NULL, phone TEXT,
            position TEXT, vessel TEXT, letter TEXT, exclude TEXT, comment TEXT, cv_name TEXT, cv_b64 TEXT, res_name TEXT, res_b64 TEXT, ip TEXT,
            created_at TEXT NOT NULL, claimed_at TEXT, paid_at TEXT, done_at TEXT)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_num ON orders(num)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token ON orders(token)`,
        `CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY, order_id TEXT NOT NULL, at TEXT NOT NULL, author TEXT, text TEXT NOT NULL)`,
        `CREATE INDEX IF NOT EXISTS idx_notes_order ON notes(order_id)`,
        `CREATE TABLE IF NOT EXISTS base_rows(email TEXT PRIMARY KEY, company TEXT, country TEXT, fleets TEXT, bases TEXT NOT NULL, added_at TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, order_id TEXT NOT NULL, m INTEGER NOT NULL, status TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0,
            sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, start_at TEXT NOT NULL, started_at TEXT, finished_at TEXT, last_error TEXT, rr INTEGER NOT NULL DEFAULT 0, boxes_deleted_at TEXT)`,
        `CREATE INDEX IF NOT EXISTS idx_jobs_order ON jobs(order_id)`,
        `CREATE TABLE IF NOT EXISTS queue(id TEXT PRIMARY KEY, job_id TEXT NOT NULL, email TEXT NOT NULL, company TEXT, country TEXT, ord REAL NOT NULL,
            status TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, error TEXT, box TEXT, sent_at TEXT)`,
        `CREATE INDEX IF NOT EXISTS idx_queue_job ON queue(job_id, status, ord)`,
        `CREATE TABLE IF NOT EXISTS boxes(id TEXT PRIMARY KEY, order_id TEXT, job_id TEXT, email TEXT NOT NULL, domain TEXT, host TEXT, port INTEGER, pass_enc TEXT,
            insecure INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sent INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL, deleted_at TEXT)`,
        `CREATE TABLE IF NOT EXISTS names(name_key TEXT NOT NULL, local TEXT NOT NULL, at TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS order_docs(id TEXT PRIMARY KEY, order_id TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, b64 TEXT NOT NULL, added_at TEXT NOT NULL)`,
        `CREATE INDEX IF NOT EXISTS idx_docs_order ON order_docs(order_id)`,
        `CREATE TABLE IF NOT EXISTS replies(id TEXT PRIMARY KEY, order_id TEXT NOT NULL, box TEXT NOT NULL, uid INTEGER NOT NULL, from_email TEXT, from_name TEXT, subject TEXT, text TEXT,
            kind TEXT NOT NULL, at TEXT NOT NULL, created_at TEXT NOT NULL)`,
        `CREATE INDEX IF NOT EXISTS idx_replies_order ON replies(order_id, at)`,
        `CREATE TABLE IF NOT EXISTS imap_state(box_id TEXT PRIMARY KEY, last_uid INTEGER NOT NULL DEFAULT 0, checked_at TEXT, error TEXT)`,
        `CREATE TABLE IF NOT EXISTS crm_letters(id TEXT PRIMARY KEY, at TEXT NOT NULL, to_email TEXT NOT NULL, subject TEXT, body TEXT, file_name TEXT, ok INTEGER NOT NULL, error TEXT)`,
        `CREATE TABLE IF NOT EXISTS mail_log(id TEXT PRIMARY KEY, at TEXT NOT NULL, to_email TEXT, subject TEXT, ok INTEGER NOT NULL, error TEXT)`
    ]) await db.query(s);
    for(const c of ["subject TEXT", "letter_ok TEXT", "email_ok TEXT", "details TEXT", "extra_base TEXT"]) await db.query(`ALTER TABLE orders ADD COLUMN ${c}`).catch(() => {});
    return db;
};
