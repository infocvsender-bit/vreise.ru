/* Vreise.ru: кнопка чата справа: вкладки «Помощник» (ИИ) и «Менеджер» (живой чат). Сервер: POST /api/assistant. Открыть: window.VRAsst.open() */
(function(){
"use strict";
if(window.__vrAsst) return; window.__vrAsst = 1;
var esc = function(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); };
var fmt = function(s){ return esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>"); };
var KEY = "vr_asst", H = [];
try { H = JSON.parse(sessionStorage.getItem(KEY) || "[]").slice(-20); } catch(e){}
var save = function(){ try { sessionStorage.setItem(KEY, JSON.stringify(H.slice(-20))); } catch(e){} };
var ICO = {
  ai: '<svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="#0B3641" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h20a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H15l-6 5v-5H6a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z"/><circle cx="11" cy="15.5" r="1" fill="#0B3641"/><circle cx="16" cy="15.5" r="1" fill="#0B3641"/><circle cx="21" cy="15.5" r="1" fill="#0B3641"/></svg>'
};
var CHIPS = ["Сколько стоит рассылка?", "Как работает рассылка резюме?", "Как оплатить?", "Что такое персональное письмо?"];
var st = document.createElement("style");
st.textContent = '\
.vr-fc{position:fixed;right:16px;bottom:22px;z-index:60;display:flex;flex-direction:column;gap:12px;align-items:center}\
.vr-fc a,.vr-fc button{width:56px;height:56px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 26px rgba(7,32,40,.32);transition:transform .18s;text-decoration:none;position:relative}\
.vr-fc a:hover,.vr-fc button:hover{transform:translateY(-3px) scale(1.04)}\
.vr-fc .ai{background:#F2B400;width:62px;height:62px}\
.vr-fc .ai:after{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px solid rgba(242,180,0,.55);animation:vrp 2.4s ease-out infinite}\
@keyframes vrp{0%{transform:scale(.92);opacity:.9}100%{transform:scale(1.25);opacity:0}}\
.vr-fc [data-tip]:before{content:attr(data-tip);position:absolute;right:calc(100% + 10px);top:50%;transform:translateY(-50%);background:#fff;color:#0B3641;box-shadow:0 6px 18px rgba(7,32,40,.3);font:700 13px/1 Inter,Arial,sans-serif;padding:9px 12px;border-radius:9px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s}\
.vr-fc [data-tip]:hover:before{opacity:1}\
.vr-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(7,32,40,.5);display:none}.vr-bg.on{display:block}\
.vr-box{position:fixed;right:16px;bottom:16px;z-index:2147483001;width:min(390px,calc(100vw - 32px));height:min(640px,calc(100vh - 32px));display:none;flex-direction:column;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 24px 70px rgba(7,32,40,.45);font:15px/1.45 Inter,"Segoe UI",Arial,sans-serif;color:#17303a}\
.vr-box.on{display:flex;animation:vrup .18s ease-out}@keyframes vrup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}\
.vr-h{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 16px;background:linear-gradient(135deg,#0B3641,#0F4C5C);color:#fff;min-height:60px}\
.vr-h .t{flex:1;min-width:0}.vr-h b{display:block;font-size:16px;line-height:1.2}.vr-h small{opacity:.78;font-size:12.5px}\
.vr-ib{flex:none;width:42px;height:42px;border:0;border-radius:12px;background:rgba(255,255,255,.14);color:#fff;font-size:22px;line-height:1;cursor:pointer;display:grid;place-items:center}.vr-ib:hover{background:rgba(255,255,255,.26)}.vr-ib.x{font-size:28px}\
.vr-m{flex:1;overflow:auto;padding:14px;background:#f3f8f8;display:flex;flex-direction:column;gap:9px}\
.vr-note{background:#fff8e1;border:1px solid #f0dc9a;color:#5a4710;border-radius:12px;padding:10px 12px;font-size:13.5px}\
.vr-b{max-width:88%;padding:9px 13px;border-radius:15px;word-wrap:break-word;overflow-wrap:anywhere}.vr-b a{color:inherit;text-decoration:underline}\
.vr-u{align-self:flex-end;background:#0F4C5C;color:#fff;border-bottom-right-radius:4px}.vr-a{align-self:flex-start;background:#fff;border:1px solid #dce6e8;border-bottom-left-radius:4px}.vr-a a{color:#0F4C5C}\
.vr-btns{align-self:flex-start;display:flex;flex-direction:column;gap:6px;max-width:92%}\
.vr-lnk{display:inline-block;background:#F2B400;color:#0B3641!important;text-decoration:none!important;font:700 14px/1.2 Inter,Arial,sans-serif;padding:10px 14px;border-radius:12px;box-shadow:0 4px 12px rgba(242,180,0,.35)}.vr-lnk.ext{background:#17a560;color:#fff!important;box-shadow:0 4px 12px rgba(23,165,96,.3)}\
.vr-chips{display:flex;flex-direction:column;gap:6px;align-items:flex-start}.vr-chip{background:#fff;border:1px solid #c9dde0;color:#0B3641;border-radius:999px;padding:7px 13px;font:600 13.5px Inter,Arial,sans-serif;cursor:pointer;text-align:left}.vr-chip:hover{background:#eef6f6}\
.vr-mg{display:flex;gap:8px;padding:8px 14px 0;background:#fff;align-items:center;font-size:12.5px;color:#5b727a;flex-wrap:wrap}.vr-mg a{display:inline-block;padding:5px 12px;border-radius:999px;color:#fff;text-decoration:none;font-weight:700}.vr-mg .w{background:#17a560}.vr-mg .g{background:#229ed9}\
.vr-f{display:flex;gap:8px;padding:10px 12px 12px;background:#fff}.vr-f textarea{flex:1;resize:none;border:1px solid #cfdde0;border-radius:12px;padding:9px 11px;font:16px/1.35 Inter,Arial,sans-serif;height:42px;max-height:96px;outline:none}.vr-f textarea:focus{border-color:#0F4C5C}\
.vr-f button{border:0;border-radius:12px;background:#F2B400;color:#0B3641;font:700 14px Inter,Arial,sans-serif;padding:0 15px;cursor:pointer}.vr-f button:disabled{opacity:.5;cursor:default}\
.vr-tease{position:fixed;right:88px;bottom:30px;z-index:62;max-width:220px;background:#fff;color:#17303a;border-radius:14px 14px 4px 14px;padding:11px 28px 11px 13px;font:600 13.5px/1.35 Inter,Arial,sans-serif;box-shadow:0 10px 30px rgba(7,32,40,.3);cursor:pointer;animation:vrup .25s ease-out}.vr-tease u{position:absolute;right:7px;top:3px;text-decoration:none;font-size:18px;color:#8aa0a7;padding:2px 4px}\
body.vr-open .vr-fc,body.vr-open .vr-tease{display:none}\
.vr-tabs{display:flex;background:#fff;border-bottom:1px solid #dce6e8}.vr-tabs button{flex:1;border:0;background:none;padding:11px 8px;font:700 14px Inter,Arial,sans-serif;color:#6b8189;cursor:pointer;border-bottom:3px solid transparent;position:relative}.vr-tabs button.on{color:#0B3641;border-bottom-color:#F2B400}\
.vr-tabs i{position:absolute;top:8px;margin-left:4px;width:9px;height:9px;border-radius:50%;background:#e5484d;display:none}.vr-tabs i.on{display:inline-block}\
.vr-cm,.vr-cf{display:none!important}.vr-box.mgr .vr-m.vr-cm{display:flex!important}.vr-box.mgr .vr-f.vr-cf{display:flex!important}.vr-box.mgr .vr-m:not(.vr-cm),.vr-box.mgr .vr-f:not(.vr-cf){display:none!important}\
.vr-pick{display:none;flex:1;flex-direction:column;gap:12px;padding:16px;background:#f3f8f8;overflow:auto}.vr-pick h4{margin:0;font:800 17px/1.3 Inter,Arial,sans-serif;color:#0B3641}\
.vr-pc{display:block;width:100%;text-align:left;border:2px solid #dce6e8;border-radius:16px;background:#fff;padding:14px 16px;cursor:pointer;font:15px/1.45 Inter,Arial,sans-serif;color:#17303a;transition:border-color .15s,transform .15s}.vr-pc:hover{border-color:#F2B400;transform:translateY(-1px)}\
.vr-pc b{display:block;font-size:17px;color:#0B3641;margin-bottom:4px}.vr-pc.rec{border-color:#F2B400;background:#fffbea}.vr-pc i{font-style:normal;display:inline-block;margin-top:6px;font-size:12.5px;font-weight:700;color:#0a7a3d}\
.vr-box.pick .vr-pick{display:flex}.vr-box.pick .vr-tabs,.vr-box.pick .vr-m,.vr-box.pick .vr-f{display:none!important}\
.vr-pre{display:none}.vr-box.mgr.pre .vr-pre{display:flex;flex-direction:column;gap:9px;padding:12px 14px 14px;background:#fff;border-top:1px solid #dce6e8}.vr-box.mgr.pre .vr-f.vr-cf{display:none!important}\
.vr-pre p{margin:0;font-size:13.5px;color:#41566b}.vr-pre input{border:1px solid #cfdde0;border-radius:12px;padding:10px 12px;font:16px Inter,Arial,sans-serif;outline:none}.vr-pre input:focus{border-color:#0F4C5C}.vr-pre button{border:0;border-radius:12px;background:#F2B400;color:#0B3641;font:700 15px Inter,Arial,sans-serif;padding:11px;cursor:pointer}.vr-pre .e{color:#c0392b;font-size:13px;min-height:0}\
.vr-sys{align-self:center;text-align:center;background:#e8f1f2;color:#41566b;border-radius:12px;padding:8px 14px;font-size:13.5px;max-width:92%}\
.vr-who{font-size:11.5px;color:#7b9097;margin:0 4px -4px}.vr-who.r{align-self:flex-end}\
.vr-fc .ai .dot{position:absolute;top:2px;right:2px;width:15px;height:15px;border-radius:50%;background:#e5484d;border:2px solid #fff;display:none}.vr-fc .ai .dot.on{display:block}\
@media(max-width:700px){.vr-fc{right:10px;bottom:84px;gap:10px}.vr-fc a,.vr-fc button{width:48px;height:48px}.vr-fc .ai{width:52px;height:52px}.vr-fc [data-tip]:before{display:none}.vr-box{right:8px;left:8px;bottom:8px;width:auto;height:calc(100vh - 16px);height:calc(100dvh - 16px)}.vr-tease{right:72px;bottom:90px;max-width:170px}}';
document.head.appendChild(st);

var fc = document.createElement("div"); fc.className = "vr-fc";
fc.innerHTML = '<button class="ai" type="button" aria-label="Чат" data-tip="Чат: помощник и менеджер">' + ICO.ai + '<span class="dot"></span></button>';
var bg = document.createElement("div"); bg.className = "vr-bg";
var box = document.createElement("div"); box.className = "vr-box"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Онлайн-помощник Vreise.ru");
box.innerHTML = '<div class="vr-h"><div class="t"><b>Чат Vreise.ru</b><small>помощник и живой менеджер</small></div>' +
  '<button class="vr-ib new" type="button" aria-label="Новый диалог" title="Новый диалог с помощником">↺</button><button class="vr-ib x" type="button" aria-label="Закрыть" title="Закрыть">×</button></div>' +
  '<div class="vr-pick"><h4>Кому вы хотите написать?</h4>' +
  '<button type="button" class="vr-pc rec" data-pk="ai"><b>🤖 Онлайн-помощник</b>Знает ответы на все ваши вопросы: цены и сроки рассылки, оплата, резюме, письмо, личный кабинет. Отвечает сразу, 24/7.<br><i>✓ быстрее всего</i></button>' +
  '<button type="button" class="vr-pc" data-pk="mgr"><b>👤 Менеджер</b>Живой человек: поможет по вашему заказу, платежу или нестандартному вопросу. Ответ придёт прямо в этот чат.</button></div>' +
  '<div class="vr-tabs"><button type="button" data-tb="ai" class="on">🤖 Помощник</button><button type="button" data-tb="mgr">👤 Менеджер<i></i></button></div>' +
  '<div class="vr-m"><div class="vr-note">🤖 Я — онлайн-помощник Vreise.ru (бот). Отвечу на вопросы об услугах, ценах, оплате и сроках. Если нужен живой менеджер — откройте вкладку «Менеджер» и напишите там.</div><div class="vr-chips"></div></div>' +
  '<form class="vr-f"><textarea rows="1" maxlength="800" placeholder="Напишите вопрос…"></textarea><button type="submit">Отправить</button></form>' +
  '<div class="vr-m vr-cm"><div class="vr-note">👤 Чат с живым менеджером. Напишите вопрос — ответ появится здесь же. Если закроете страницу, ответ сохранится: загляните сюда позже.</div></div>' +
  '<form class="vr-pre"><p>Представьтесь, пожалуйста — так менеджер сможет вам ответить.</p><input name="n" maxlength="80" placeholder="Ваше имя" autocomplete="name" required><input name="e" type="email" maxlength="120" placeholder="Ваш e-mail" autocomplete="email" required><div class="e"></div><button type="submit">Начать чат</button></form>' +
  '<form class="vr-f vr-cf"><textarea rows="1" maxlength="1000" placeholder="Сообщение менеджеру…"></textarea><button type="submit">Отправить</button></form>';
document.body.appendChild(fc); document.body.appendChild(bg); document.body.appendChild(box);
var $ = function(s){ return box.querySelector(s); };
var M = $(".vr-m"), F = $("form"), TA = F.querySelector("textarea"), SB = F.querySelector("button"), CH = $(".vr-chips");
var add = function(role, text){ var d = document.createElement("div"); d.className = "vr-b " + (role === "user" ? "vr-u" : "vr-a"); d.innerHTML = fmt(text); M.appendChild(d); M.scrollTop = M.scrollHeight; return d; };
var addBtns = function(bs){ if(!bs || !bs.length) return; var w = document.createElement("div"); w.className = "vr-btns";
  bs.slice(0, 3).forEach(function(b){ if(!b || !/^(\/|https:\/\/|#manager$)/.test(b.url || "")) return; var a = document.createElement("a"); a.className = "vr-lnk" + (b.ext ? " ext" : ""); a.href = b.url; a.textContent = b.label + " →"; if(b.url === "#manager"){ a.addEventListener("click", function(ev){ ev.preventDefault(); tabTo("mgr"); }); } else if(b.ext){ a.target = "_blank"; a.rel = "noopener"; } else a.addEventListener("click", function(){ open(false); }); w.appendChild(a); });
  if(w.children.length){ M.appendChild(w); M.scrollTop = M.scrollHeight; } };
H.forEach(function(m){ add(m.role, m.content); addBtns(m.b); }); if(H.length) CH.style.display = "none";
CHIPS.forEach(function(q){ var c = document.createElement("button"); c.type = "button"; c.className = "vr-chip"; c.textContent = q; c.onclick = function(){ ask(q); }; CH.appendChild(c); });
var busy = false;
function ask(q){
  q = String(q || "").trim(); if(!q || busy) return; busy = true; SB.disabled = true; CH.style.display = "none";
  H.push({role: "user", content: q}); add("user", q); TA.value = ""; TA.style.height = "42px";
  var w = add("assistant", "Пишу ответ…"); w.style.opacity = ".6";
  fetch("/api/assistant", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({messages: H.slice(-12).map(function(m){ return {role: m.role, content: m.content}; }), page: location.pathname})})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if(!r.ok || !d.reply) throw new Error(d.error || "err"); return d; }); })
    .then(function(d){ w.style.opacity = ""; w.innerHTML = fmt(d.reply); H.push({role: "assistant", content: d.reply, b: d.buttons || []}); addBtns(d.buttons); })
    .catch(function(e){ w.style.opacity = ""; w.innerHTML = fmt(e && e.message && e.message !== "err" ? e.message : "Не получилось ответить — напишите менеджеру во вкладке «Менеджер»."); H.pop(); })
    .then(function(){ save(); busy = false; SB.disabled = false; M.scrollTop = M.scrollHeight; try { TA.focus(); } catch(e){} });
}
function fresh(){ if(busy) return; H = []; save(); M.querySelectorAll(".vr-b,.vr-btns").forEach(function(x){ x.remove(); }); CH.style.display = ""; }

/* ---------- вкладка «Менеджер»: живой чат ---------- */
var CM = $(".vr-cm"), CF = $(".vr-cf"), CT = CF.querySelector("textarea"), CS = CF.querySelector("button"), TB = box.querySelectorAll(".vr-tabs button"), tdot = box.querySelector(".vr-tabs i"), fdot = fc.querySelector(".dot");
var NAME = "", EMAIL = "", PRE = box.querySelector(".vr-pre");
try { NAME = localStorage.getItem("vr_n") || ""; EMAIL = localStorage.getItem("vr_e") || ""; } catch(e){}
var setPre = function(){ box.classList.toggle("pre", !(NAME && EMAIL)); };
var curTab = "ai", SID = "", seenIds = {}, lastAt = "", poll = null, bgPoll = null, SEEN_AT = "";
try { SID = localStorage.getItem("vr_sid") || ""; SEEN_AT = localStorage.getItem("vr_seen") || ""; } catch(e){}
var newSid = function(){ var a = new Uint8Array(9), s = ""; (window.crypto || window.msCrypto).getRandomValues(a); for(var i = 0; i < a.length; i++) s += (a[i] % 36).toString(36); return "v" + s + Date.now().toString(36).slice(-4); };
var ensureSid = function(){ if(!SID){ SID = newSid(); try { localStorage.setItem("vr_sid", SID); } catch(e){} } return SID; };
var cadd = function(who, text, at){ if(who === "system"){ var sy = document.createElement("div"); sy.className = "vr-sys"; sy.textContent = text; CM.appendChild(sy); CM.scrollTop = CM.scrollHeight; return; } var t = at ? new Date(at) : new Date(), hh = ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2);
  var l = document.createElement("div"); l.className = "vr-who" + (who === "user" ? " r" : ""); l.textContent = (who === "user" ? "Вы" : "Менеджер") + " · " + hh;
  var d = document.createElement("div"); d.className = "vr-b " + (who === "user" ? "vr-u" : "vr-a"); d.innerHTML = fmt(text); CM.appendChild(l); CM.appendChild(d); CM.scrollTop = CM.scrollHeight; };
function pull(show){
  if(!SID) return Promise.resolve();
  if(!show){                                           // фоновая проверка: только метка «есть новый ответ», без изменения состояния
    return fetch("/api/chat?sid=" + encodeURIComponent(SID) + "&after=" + encodeURIComponent(SEEN_AT)).then(function(r){ return r.json(); }).then(function(d){
      if((d.msgs || []).some(function(m){ return m.who === "admin"; })) unread(true);
    }).catch(function(){});
  }
  return fetch("/api/chat?sid=" + encodeURIComponent(SID) + "&after=" + encodeURIComponent(lastAt)).then(function(r){ return r.json(); }).then(function(d){
    (d.msgs || []).forEach(function(m){ if(seenIds[m.id]) return; seenIds[m.id] = 1; if(m.at > lastAt) lastAt = m.at; cadd(m.who, m.text, m.at); });
    if((d.msgs || []).length){ SEEN_AT = lastAt; try { localStorage.setItem("vr_seen", SEEN_AT); } catch(e){} unread(false); }
  }).catch(function(){});
}
function unread(on){ tdot.classList.toggle("on", !!on); fdot.classList.toggle("on", !!on); }
function startPoll(){ stopPoll(); poll = setInterval(function(){ pull(true); }, 4000); }
function stopPoll(){ if(poll){ clearInterval(poll); poll = null; } }
var loaded = false;
function showPick(){ stopPoll(); box.classList.remove("mgr"); box.classList.add("pick"); }
function tabTo(w){
  box.classList.remove("pick"); curTab = w; box.classList.toggle("mgr", w === "mgr"); [].forEach.call(TB, function(b){ b.classList.toggle("on", b.getAttribute("data-tb") === w); });
  if(w === "mgr"){ setPre(); if(!loaded){ loaded = true; pull(true).then(function(){ CM.scrollTop = CM.scrollHeight; }); } else pull(true); unread(false); startPoll(); try { (NAME && EMAIL ? CT : PRE.querySelector("input")).focus(); } catch(e){} }
  else { stopPoll(); try { TA.focus(); } catch(e){} }
}
[].forEach.call(box.querySelectorAll(".vr-pc"), function(b){ b.onclick = function(){ tabTo(b.getAttribute("data-pk")); }; });
[].forEach.call(TB, function(b){ b.onclick = function(){ tabTo(b.getAttribute("data-tb")); }; });
PRE.onsubmit = function(e){ e.preventDefault(); var n = PRE.n.value.trim(), m = PRE.e.value.trim(), er = PRE.querySelector(".e");
  if(n.length < 2){ er.textContent = "Укажите имя"; return; } if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m)){ er.textContent = "Проверьте e-mail, например name@mail.ru"; return; }
  er.textContent = ""; NAME = n; EMAIL = m; try { localStorage.setItem("vr_n", n); localStorage.setItem("vr_e", m); } catch(x){} setPre(); try { CT.focus(); } catch(x){} };
CF.onsubmit = function(e){ e.preventDefault(); sendMgr(); };
CT.addEventListener("keydown", function(e){ if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); sendMgr(); } });
CT.addEventListener("input", function(){ CT.style.height = "42px"; CT.style.height = Math.min(96, CT.scrollHeight) + "px"; });
function sendMgr(){
  var t = CT.value.trim(); if(!t || CS.disabled) return; ensureSid(); CS.disabled = true;
  fetch("/api/chat", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({sid: SID, text: t, name: NAME, email: EMAIL})})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if(!r.ok) throw new Error(d.error || "Не удалось отправить"); return d; }); })
    .then(function(d){ seenIds[d.id] = 1; if(d.at > lastAt) lastAt = d.at; cadd("user", t, d.at); CT.value = ""; CT.style.height = "42px"; })
    .catch(function(e){ var n = document.createElement("div"); n.className = "vr-note"; n.textContent = e.message || "Не удалось отправить, попробуйте ещё раз"; CM.appendChild(n); CM.scrollTop = CM.scrollHeight; })
    .then(function(){ CS.disabled = false; try { CT.focus(); } catch(e){} });
}
bgPoll = setInterval(function(){ if(!box.classList.contains("on") || curTab !== "mgr") pull(false); }, 30000); setTimeout(function(){ pull(false); }, 3000);
var teaser = null, hideTease = function(){ if(teaser){ teaser.remove(); teaser = null; } };
function open(on, which){
  hideTease(); document.body.classList.toggle("vr-open", !!on); box.classList.toggle("on", on); bg.classList.toggle("on", on);
  if(on){ if(which === "mgr" || which === "ai") tabTo(which); else showPick(); setTimeout(function(){ try { if(!box.classList.contains("pick")) (curTab === "mgr" ? CT : TA).focus(); } catch(e){} }, 80); }
  else stopPoll();
}
fc.querySelector(".ai").onclick = function(){ open(true); };
$(".x").onclick = function(){ open(false); }; bg.onclick = function(){ open(false); }; $(".new").onclick = fresh;
F.onsubmit = function(e){ e.preventDefault(); ask(TA.value); };
TA.addEventListener("keydown", function(e){ if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); ask(TA.value); } });
TA.addEventListener("input", function(){ TA.style.height = "42px"; TA.style.height = Math.min(96, TA.scrollHeight) + "px"; });
document.addEventListener("keydown", function(e){ if(e.key === "Escape" && box.classList.contains("on")) open(false); });
window.VRAsst = {open: function(w){ open(true, w); }};
setTimeout(function(){
  var seen = false; try { seen = sessionStorage.getItem("vr_asst_tease") === "1"; } catch(e){}
  if(seen || box.classList.contains("on")) return;
  try { sessionStorage.setItem("vr_asst_tease", "1"); } catch(e){}
  teaser = document.createElement("div"); teaser.className = "vr-tease"; teaser.innerHTML = "Есть вопросы? Онлайн-помощник знает ответы — спросите 👇<u>×</u>";
  teaser.onclick = function(ev){ if(ev.target.tagName === "U") hideTease(); else open(true); };
  document.body.appendChild(teaser); setTimeout(hideTease, 9000);
}, 8000);
})();
