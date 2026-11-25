"use strict";
const V = (String(process.env.RAILWAY_GIT_COMMIT_SHA || "").slice(0, 8)) || String(Date.now());
/* Оболочка CRM: форма входа или рабочая страница (логика — public/crm.js) */
const head = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>CRM — Vreise.ru</title><link rel="icon" href="/static/favicon.png"><link rel="stylesheet" href="/static/style.css?v=${V}"><style>
body{background:#eef3f4}.crm{max-width:1180px;margin:0 auto;padding:20px 18px 80px}.top2{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px}
.top2 h1{font-size:26px;color:var(--deep);flex:1}.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}.tabs button{border:0;background:#fff;border-radius:999px;padding:9px 18px;font:inherit;font-weight:700;cursor:pointer;color:var(--deep)}
.tabs button.on{background:var(--deep);color:#fff}.flt{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.flt button{border:1px solid #cfdde0;background:#fff;border-radius:999px;padding:6px 14px;font:inherit;font-size:14px;cursor:pointer}.flt button.on{background:var(--gold);border-color:var(--gold);font-weight:700}
tr.click{cursor:pointer}tr.click:hover{background:#f3f8f9}.kv{display:grid;grid-template-columns:160px 1fr;gap:6px 14px;font-size:15px}.kv b{color:var(--muted);font-weight:600}.acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.btn.sm.red{background:#c0392b;color:#fff}.pre{white-space:pre-wrap;background:#f3f8f9;border-radius:10px;padding:12px;font-size:14px;max-height:220px;overflow:auto}.mut{color:var(--muted);font-size:13.5px}
@media(max-width:700px){.kv{grid-template-columns:1fr}table.t{font-size:13px}}
</style></head><body>`;

function page(authed, enabled){
    if(!authed) return head + `<div class="page" style="max-width:420px"><h1>CRM</h1><p class="sub">Vreise.ru</p>${enabled ? `<div class="panel"><div class="err" id="err" hidden></div>
<label class="f">Пароль<input class="in" id="pw" type="password" autofocus></label><div style="margin-top:16px"><button class="btn gold" id="go">Войти</button></div></div>
<script>var go=document.getElementById("go"),pw=document.getElementById("pw"),er=document.getElementById("err");
function login(){fetch("/crm/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pw.value})}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok)location.reload();else{er.textContent=x.j.error||"Ошибка";er.hidden=false}})}
go.onclick=login;pw.onkeydown=function(e){if(e.key==="Enter")login()}</script>` : `<div class="err">Не задан пароль CRM. Добавьте переменную CRM_PASSWORD в Railway.</div>`}</div></body></html>`;
    return head + `<div class="crm"><div class="top2"><h1>CRM Vreise.ru</h1><a class="btn sm line" style="color:var(--deep);border-color:#9fb6bb" href="/crm/logout">Выйти</a></div>
<div class="tabs" id="tabs"><button data-t="orders" class="on">Заказы</button><button data-t="bases">Базы адресов</button><button data-t="servers">Серверы и настройки</button></div>
<div id="view">Загрузка…</div></div><script src="/static/crm.js?v=${V}"></script></body></html>`;
}
module.exports = {page};
