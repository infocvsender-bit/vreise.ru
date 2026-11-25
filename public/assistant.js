/* Vreise.ru: контакты справа (WhatsApp, Telegram) + окно «Онлайн-помощник». Сервер: POST /api/assistant. Открыть: window.VRAsst.open() */
(function(){
"use strict";
if(window.__vrAsst) return; window.__vrAsst = 1;
var X = window.__vr || {}, WA = X.wa || "", TG = X.tg || "";
var esc = function(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); };
var fmt = function(s){ return esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>"); };
var KEY = "vr_asst", H = [];
try { H = JSON.parse(sessionStorage.getItem(KEY) || "[]").slice(-20); } catch(e){}
var save = function(){ try { sessionStorage.setItem(KEY, JSON.stringify(H.slice(-20))); } catch(e){} };
var ICO = {
  wa: '<svg viewBox="0 0 32 32" width="28" height="28" fill="#fff"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7a10.7 10.7 0 0 1-5.5-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7c0 1.6 1.2 3.2 1.3 3.4s2.300 3.700 5.700 5.100c2.100.9 2.900.9 3.400.8.500-.1 1.900-.8 2.200-1.500s.3-1.400.2-1.500-.3-.2-.6-.4z"/></svg>',
  tg: '<svg viewBox="0 0 32 32" width="26" height="26" fill="#fff"><path d="M26.7 6.3 3.9 15.1c-1.6.6-1.5 1.5-.3 1.9l5.8 1.8 2.2 6.9c.3.8.5 1.1 1 1.1s.7-.2 1-.5l2.8-2.7 5.8 4.3c1.1.6 1.8.3 2.1-1l3.8-17.9c.4-1.6-.6-2.3-1.4-1.7zM12.4 19.1l11.5-7.3c.6-.3.5.1.3.3l-9.7 8.8-.4 4.2-1.7-6z"/></svg>',
  ai: '<svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="#0B3641" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h20a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H15l-6 5v-5H6a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z"/><circle cx="11" cy="15.5" r="1" fill="#0B3641"/><circle cx="16" cy="15.5" r="1" fill="#0B3641"/><circle cx="21" cy="15.5" r="1" fill="#0B3641"/></svg>'
};
var CHIPS = ["Сколько стоит рассылка?", "Как работает рассылка резюме?", "Как оплатить?", "Что такое персональное письмо?"];
var st = document.createElement("style");
st.textContent = '\
.vr-fc{position:fixed;right:16px;bottom:22px;z-index:60;display:flex;flex-direction:column;gap:12px;align-items:center}\
.vr-fc a,.vr-fc button{width:56px;height:56px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 26px rgba(7,32,40,.32);transition:transform .18s;text-decoration:none;position:relative}\
.vr-fc a:hover,.vr-fc button:hover{transform:translateY(-3px) scale(1.04)}\
.vr-fc .wa{background:#25d366}.vr-fc .tg{background:#229ed9}.vr-fc .ai{background:#F2B400;width:62px;height:62px}\
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
@media(max-width:700px){.vr-fc .wa,.vr-fc .tg{display:none}.vr-fc{right:10px;bottom:84px;gap:10px}.vr-fc a,.vr-fc button{width:48px;height:48px}.vr-fc .ai{width:52px;height:52px}.vr-fc [data-tip]:before{display:none}.vr-box{right:8px;left:8px;bottom:8px;width:auto;height:calc(100vh - 16px);height:calc(100dvh - 16px)}.vr-tease{right:72px;bottom:90px;max-width:170px}}';
document.head.appendChild(st);

var fc = document.createElement("div"); fc.className = "vr-fc";
fc.innerHTML = (WA ? '<a class="wa" href="' + esc(WA) + '" target="_blank" rel="noopener" aria-label="WhatsApp" data-tip="WhatsApp — менеджер">' + ICO.wa + '</a>' : "") +
  (TG ? '<a class="tg" href="' + esc(TG) + '" target="_blank" rel="noopener" aria-label="Telegram" data-tip="Telegram — менеджер">' + ICO.tg + '</a>' : "") +
  '<button class="ai" type="button" aria-label="Онлайн-помощник" data-tip="Онлайн-помощник">' + ICO.ai + '</button>';
var bg = document.createElement("div"); bg.className = "vr-bg";
var box = document.createElement("div"); box.className = "vr-box"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Онлайн-помощник Vreise.ru");
box.innerHTML = '<div class="vr-h"><div class="t"><b>Онлайн-помощник</b><small>отвечает сразу · 24/7</small></div>' +
  '<button class="vr-ib new" type="button" aria-label="Новый диалог" title="Новый диалог">↺</button><button class="vr-ib x" type="button" aria-label="Закрыть" title="Закрыть">×</button></div>' +
  '<div class="vr-m"><div class="vr-note">🤖 Я — онлайн-помощник Vreise.ru (бот). Отвечу на вопросы об услугах, ценах, оплате и сроках. Если хотите поговорить с живым менеджером — напишите в WhatsApp или Telegram.</div><div class="vr-chips"></div></div>' +
  '<div class="vr-mg"><span>Живой менеджер:</span>' + (WA ? '<a class="w" href="' + esc(WA) + '" target="_blank" rel="noopener">WhatsApp</a>' : "") + (TG ? '<a class="g" href="' + esc(TG) + '" target="_blank" rel="noopener">Telegram</a>' : "") + '</div>' +
  '<form class="vr-f"><textarea rows="1" maxlength="800" placeholder="Напишите вопрос…"></textarea><button type="submit">Отправить</button></form>';
document.body.appendChild(fc); document.body.appendChild(bg); document.body.appendChild(box);
var $ = function(s){ return box.querySelector(s); };
var M = $(".vr-m"), F = $("form"), TA = F.querySelector("textarea"), SB = F.querySelector("button"), CH = $(".vr-chips");
var add = function(role, text){ var d = document.createElement("div"); d.className = "vr-b " + (role === "user" ? "vr-u" : "vr-a"); d.innerHTML = fmt(text); M.appendChild(d); M.scrollTop = M.scrollHeight; return d; };
var addBtns = function(bs){ if(!bs || !bs.length) return; var w = document.createElement("div"); w.className = "vr-btns";
  bs.slice(0, 3).forEach(function(b){ if(!b || !/^(\/|https:\/\/)/.test(b.url || "")) return; var a = document.createElement("a"); a.className = "vr-lnk" + (b.ext ? " ext" : ""); a.href = b.url; a.textContent = b.label + " →"; if(b.ext){ a.target = "_blank"; a.rel = "noopener"; } else a.addEventListener("click", function(){ open(false); }); w.appendChild(a); });
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
    .catch(function(e){ w.style.opacity = ""; w.innerHTML = fmt(e && e.message && e.message !== "err" ? e.message : "Не получилось ответить — напишите нам в WhatsApp или Telegram."); H.pop(); })
    .then(function(){ save(); busy = false; SB.disabled = false; M.scrollTop = M.scrollHeight; try { TA.focus(); } catch(e){} });
}
function fresh(){ if(busy) return; H = []; save(); M.querySelectorAll(".vr-b,.vr-btns").forEach(function(x){ x.remove(); }); CH.style.display = ""; }
var teaser = null, hideTease = function(){ if(teaser){ teaser.remove(); teaser = null; } };
function open(on){
  hideTease(); document.body.classList.toggle("vr-open", !!on); box.classList.toggle("on", on); bg.classList.toggle("on", on);
  if(on){ M.scrollTop = M.scrollHeight; setTimeout(function(){ try { TA.focus(); } catch(e){} }, 80); }
}
fc.querySelector(".ai").onclick = function(){ open(true); };
$(".x").onclick = function(){ open(false); }; bg.onclick = function(){ open(false); }; $(".new").onclick = fresh;
F.onsubmit = function(e){ e.preventDefault(); ask(TA.value); };
TA.addEventListener("keydown", function(e){ if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); ask(TA.value); } });
TA.addEventListener("input", function(){ TA.style.height = "42px"; TA.style.height = Math.min(96, TA.scrollHeight) + "px"; });
document.addEventListener("keydown", function(e){ if(e.key === "Escape" && box.classList.contains("on")) open(false); });
window.VRAsst = {open: function(){ open(true); }};
setTimeout(function(){
  var seen = false; try { seen = sessionStorage.getItem("vr_asst_tease") === "1"; } catch(e){}
  if(seen || box.classList.contains("on")) return;
  try { sessionStorage.setItem("vr_asst_tease", "1"); } catch(e){}
  teaser = document.createElement("div"); teaser.className = "vr-tease"; teaser.innerHTML = "Есть вопросы? Онлайн-помощник ответит сразу 👇<u>×</u>";
  teaser.onclick = function(ev){ if(ev.target.tagName === "U") hideTease(); else open(true); };
  document.body.appendChild(teaser); setTimeout(hideTease, 9000);
}, 8000);
})();
