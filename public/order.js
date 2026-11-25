/* Форма заказа и страница заказа */
(function(){
    function $(id){ return document.getElementById(id); }
    function fmt(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }

    /* часть документов не загрузилась */
    var dm = /[?&]docs=(\d+)/.exec(location.search);
    if(dm && document.querySelector(".page h1")){ var nb = document.createElement("div"); nb.className = "err"; nb.textContent = "Не все файлы удалось загрузить (" + dm[1] + "). Напишите об этом менеджеру в чате на сайте — резюме составим по анкете.";
        document.querySelector(".page h1").insertAdjacentElement("afterend", nb); }

    /* копирование номера карты */
    [].forEach.call(document.querySelectorAll("[data-copy]"), function(b){
        b.addEventListener("click", function(){
            var t = b.getAttribute("data-copy"), done = function(){ var o = b.textContent; b.textContent = "Скопировано"; setTimeout(function(){ b.textContent = o; }, 1800); };
            if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done);
            else { var a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch(e){} a.remove(); done(); }
        });
    });

    /* выбор банка (Сбербанк / Тинькофф) */
    [].forEach.call(document.querySelectorAll("[data-bank]"), function(b){
        b.addEventListener("click", function(){
            [].forEach.call(document.querySelectorAll("[data-bank]"), function(x){ x.classList.toggle("on", x === b); });
            [].forEach.call(document.querySelectorAll("[data-bankcard]"), function(c){ c.hidden = c.getAttribute("data-bankcard") !== b.getAttribute("data-bank"); });
        });
    });

    /* управление рассылкой: пауза / продолжить / отменить / время старта */
    function post(path, data){
        return fetch("/api/o/" + window.__tok + path, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)})
            .then(function(r){ return r.json().then(function(d){ if(!r.ok || !d.ok) throw new Error(d.error || "Не получилось, попробуйте ещё раз"); return d; }); });
    }
    function say(el, t){ if(el) el.textContent = t || ""; }
    [].forEach.call(document.querySelectorAll(".jbtn"), function(b){
        b.addEventListener("click", function(){
            var act = b.getAttribute("data-a");
            if(act === "pause" && !confirm("Поставить рассылку на паузу? Письма перестанут уходить. Пауза — не дольше 2 рабочих дней, затем рассылка продолжится сама (или раньше — по кнопке «Продолжить»).")) return;
            if(act === "cancel" && !confirm("Отменить рассылку? Неотправленные письма не уйдут, это действие нельзя отменить. Уже отправленные письма вернуть нельзя.")) return;
            var msg = b.parentNode.querySelector(".jmsg"); b.disabled = true; say(msg, "");
            post("/job", {id: b.getAttribute("data-j"), action: act}).then(function(){ location.reload(); }).catch(function(e){ b.disabled = false; say(msg, e.message); });
        });
    });
    [].forEach.call(document.querySelectorAll(".jtime"), function(b){
        b.addEventListener("click", function(){ var f = b.closest(".jc2").querySelector(".jtf"); if(f) f.hidden = !f.hidden; });
    });
    [].forEach.call(document.querySelectorAll(".jtcancel"), function(b){ b.addEventListener("click", function(){ b.closest(".jtf").hidden = true; }); });
    [].forEach.call(document.querySelectorAll(".jtsave"), function(b){
        b.addEventListener("click", function(){
            var f = b.closest(".jtf"), msg = f.querySelector(".jtmsg"), v = f.querySelector(".jtv").value;
            if(!v){ say(msg, "Выберите дату и время"); return; }
            b.disabled = true; say(msg, "");
            post("/job-time", {id: f.getAttribute("data-j"), at: v.slice(0, 16)}).then(function(){ location.reload(); }).catch(function(e){ b.disabled = false; say(msg, e.message); });
        });
    });
    /* куда не отправлять */
    var exedit = $("exedit"); if(exedit){
        exedit.addEventListener("click", function(){ $("exform").hidden = false; exedit.hidden = true; $("exview").hidden = true; });
        $("excancel").addEventListener("click", function(){ $("exform").hidden = true; exedit.hidden = false; $("exview").hidden = false; });
        $("exsave").addEventListener("click", function(){
            var b = $("exsave"); b.disabled = true; say($("exmsg"), "");
            post("/exclude", {text: $("extxt").value}).then(function(){ location.reload(); }).catch(function(e){ b.disabled = false; say($("exmsg"), e.message); });
        });
    }
    /* адрес для ответов */
    var rtedit = $("rtedit"); if(rtedit){
        rtedit.addEventListener("click", function(){ $("rtform").hidden = false; rtedit.hidden = true; });
        $("rtcancel").addEventListener("click", function(){ $("rtform").hidden = true; rtedit.hidden = false; });
        $("rtsave").addEventListener("click", function(){
            var b = $("rtsave"); b.disabled = true; say($("rtmsg"), "");
            post("/reply-to", {email: $("rtin").value}).then(function(){ location.reload(); }).catch(function(e){ b.disabled = false; say($("rtmsg"), e.message); });
        });
    }

    /* «Я оплатил(а)» */
    var claim = $("claim");
    if(claim) claim.addEventListener("click", function(){
        claim.disabled = true;
        fetch("/api/o/" + window.__tok + "/claim", {method: "POST"}).then(function(r){ return r.json(); }).then(function(){ location.reload(); }).catch(function(){ claim.disabled = false; });
    });

    /* повторное письмо с подтверждением e-mail */
    var rsd = $("resend");
    if(rsd) rsd.addEventListener("click", function(){
        rsd.disabled = true;
        fetch("/api/o/" + window.__tok + "/resend", {method: "POST"}).then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }); })
            .then(function(x){ $("rsmsg").textContent = x.ok ? "Отправили — проверьте почту" : (x.j.error || "Не удалось отправить"); if(!x.ok) rsd.disabled = false; })
            .catch(function(){ rsd.disabled = false; });
    });

    /* тема и письмо */
    var cok = $("cvok");
    if(cok) cok.addEventListener("click", function(){
        var msg = $("cvmsg"); cok.disabled = true; msg.textContent = "Подтверждаем…";
        fetch("/api/o/" + window.__tok + "/cover-approve", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({subject: $("cvsub").value, text: $("cvtxt").value})})
            .then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }); })
            .then(function(x){ if(!x.ok) throw new Error(x.j.error || "Не удалось подтвердить"); msg.textContent = "✅ Подтверждено — рассылка скоро начнётся"; setTimeout(function(){ location.reload(); }, 900); })
            .catch(function(e){ cok.disabled = false; msg.textContent = "❌ " + e.message; });
    });
    /* пуш-уведомления: плашка «Включить», состояние на этом устройстве */
    var PUSH_OK = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window, IOS = /iphone|ipad|ipod/i.test(navigator.userAgent), STANDALONE = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    function pk(s){ var b = atob((s + "===".slice((s.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/")), a = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
    function pushApi(body){ return fetch("/api/o/" + window.__tok + "/push", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)}).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if(!r.ok) throw new Error(d.error || "Ошибка"); return d; }); }); }
    function pushBar(){
        var box = $("pushbar"); if(!box) return;
        var hid = 0; try { hid = Number(localStorage.getItem("vr-push-hide") || 0); } catch(e){}
        var draw = function(st){
            if(st === "none" || ((st === "off" || st === "ios") && hid > Date.now())){ box.innerHTML = ""; return; }
            var x = '<button class="pb-x" data-push="hide" title="Скрыть" type="button">✕</button>';
            box.innerHTML = st === "on" ? '<div class="pushbar on">✅ Уведомления включены на этом устройстве <button class="pb-l" data-push="off" type="button">Отключить</button></div>'
                : st === "denied" ? '<div class="pushbar on">🔕 Уведомления для сайта заблокированы в браузере. Чтобы включить: нажмите на значок 🔒 слева от адреса сайта → «Уведомления» → «Разрешить».</div>'
                : st === "ios" ? '<div class="pushbar">' + x + '<div class="pb-i">🔔</div><div><b>Уведомления на iPhone</b><small>Safari → «Поделиться» → «На экран „Домой“». Откройте кабинет со значка на экране и нажмите «Включить уведомления».</small></div></div>'
                : '<div class="pushbar">' + x + '<div class="pb-i">🔔</div><div><b>Включите уведомления</b><small>Сообщим, когда компании ответят на рассылку — в том числе автоответом, — даже если сайт закрыт.</small></div><button class="btn gold sm pb-b" data-push="on" type="button">Включить</button></div>';
        };
        if(!PUSH_OK){ draw(IOS && !STANDALONE ? "ios" : "none"); return; }
        if(Notification.permission === "denied"){ draw("denied"); return; }
        navigator.serviceWorker.register("/sw.js").then(function(reg){ return reg.pushManager.getSubscription(); })
            .then(function(sub){ if(sub) pushApi({sub: sub.toJSON()}).catch(function(){}); draw(sub ? "on" : "off"); }).catch(function(){ draw("none"); });
    }
    document.addEventListener("click", function(e){
        var f = e.target.closest && e.target.closest(".rfwd");
        if(f){
            var c = prompt("Что кажется вам неправильным в этом письме? (необязательно — можно оставить пустым)", "");
            if(c === null) return;
            f.disabled = true;
            fetch("/api/o/" + window.__tok + "/reply-forward", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id: f.getAttribute("data-id"), comment: c})})
                .then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }); })
                .then(function(x){ if(!x.ok) throw new Error(x.j.error || "Не удалось переслать"); f.parentNode.innerHTML = '<span class="hint">✅ Переслано администратору — мы разберёмся</span>'; })
                .catch(function(err){ f.disabled = false; alert(err.message); });
            return;
        }
        var b = e.target.closest && e.target.closest("[data-push]"); if(!b) return;
        var a = b.getAttribute("data-push");
        if(a === "hide"){ try { localStorage.setItem("vr-push-hide", String(Date.now() + 7 * 864e5)); } catch(x){} $("pushbar").innerHTML = ""; return; }
        b.disabled = true;
        navigator.serviceWorker.register("/sw.js").then(function(){ return navigator.serviceWorker.ready; }).then(function(reg){
            if(a === "off") return reg.pushManager.getSubscription().then(function(sub){ if(!sub) return; return pushApi({off: true, endpoint: sub.endpoint}).catch(function(){}).then(function(){ return sub.unsubscribe(); }); });
            return Notification.requestPermission().then(function(perm){
                if(perm !== "granted") return;
                return fetch("/api/push/key").then(function(r){ return r.json(); }).then(function(k){ if(!k.key) throw new Error("Уведомления временно недоступны"); return reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: pk(k.key)}); })
                    .then(function(sub){ return pushApi({sub: sub.toJSON(), hello: true}); });
            });
        }).catch(function(err){ alert(err.message); }).then(pushBar);
    });
    pushBar();
    var rok = $("resok");
    if(rok) rok.addEventListener("click", function(){
        if(!confirm("Подтвердить резюме? После этого рассылка начнётся по выбранным датам.")) return;
        var msg = $("resmsg"); rok.disabled = true; msg.textContent = "Подтверждаем…";
        fetch("/api/o/" + window.__tok + "/resume-approve", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"})
            .then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }); })
            .then(function(x){ if(!x.ok) throw new Error(x.j.error || "Не удалось подтвердить"); msg.textContent = "✅ Подтверждено"; setTimeout(function(){ location.reload(); }, 800); })
            .catch(function(e){ rok.disabled = false; msg.textContent = "❌ " + e.message; });
    });
    var lf = $("lf");
    if(lf){
        var std = {}; try { std = JSON.parse($("lstd").textContent); } catch(e){}
        var lmsg = function(t){ $("lmsg").textContent = t; };
        var post = function(body){
            lmsg("Сохраняем…");
            return fetch("/api/o/" + window.__tok + "/letter", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)})
                .then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }); })
                .then(function(x){ if(!x.ok) throw new Error(x.j.error || "Не удалось сохранить"); lmsg("✅ Сохранено"); })
                .catch(function(e){ lmsg("❌ " + e.message); });
        };
        lf.addEventListener("submit", function(ev){ ev.preventDefault(); post({subject: $("lsub").value, text: $("ltxt").value}); });
        var rs = $("lreset"); if(rs) rs.addEventListener("click", function(){ $("lsub").value = std.subject || ""; $("ltxt").value = std.text || ""; post({reset: true}); });
    }

    /* замена резюме */
    var rg = $("rsgo");
    if(rg) rg.addEventListener("click", function(){
        var fl = $("rsfile").files[0], st = $("rsmsg2");
        if(!fl){ st.textContent = "Выберите файл"; return; }
        if(!/\.(pdf|docx?)$/i.test(fl.name)){ st.textContent = "Нужен файл PDF или Word"; return; }
        if(fl.size > 5 * 1024 * 1024){ st.textContent = "Файл больше 5 МБ"; return; }
        rg.disabled = true; st.textContent = "Загружаем…";
        fetch("/api/o/" + window.__tok + "/resume", {method: "POST", headers: {"Content-Type": "application/octet-stream", "X-Name": encodeURIComponent(fl.name)}, body: fl})
            .then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }); })
            .then(function(x){ if(!x.ok) throw new Error(x.j.error || "Не удалось заменить"); sessionStorage.setItem("vr_open", "1"); location.reload(); })
            .catch(function(e){ rg.disabled = false; st.textContent = e.message; });
    });

    /* сообщение менеджеру */
    var mf = $("msgf");
    if(mf) mf.addEventListener("submit", function(ev){
        ev.preventDefault();
        var t = $("msgt").value.trim(), st = $("msgs"), b = $("msgb");
        if(t.length < 2){ st.textContent = "Напишите сообщение"; return; }
        b.disabled = true; st.textContent = "Отправляем…";
        fetch("/api/o/" + window.__tok + "/message", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({text: t})})
            .then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }); })
            .then(function(x){ if(!x.ok) throw new Error(x.j.error || "Не удалось отправить"); sessionStorage.setItem("vr_open", "1"); location.reload(); })
            .catch(function(e){ b.disabled = false; st.textContent = e.message; });
    });

    /* форма заказа */
    var f = $("f"); if(!f) return;
    var sel = $("slug"), total = $("total"), isCv = !!$("dob"), addBase = $("addBase"), extra = $("extra"), docs = [];
    var LATIN = /^[A-Za-z][A-Za-z' .-]*$/, DOC_EXT = /\.(pdf|docx?|rtf|odt|xlsx?|ods|txt|jpe?g|png|webp)$/i, DOC_MAX = 15 * 1024 * 1024, DOC_TOTAL = 100 * 1024 * 1024, DOC_COUNT = 25;
    var phoneOk = function(v){ return /^\+\d{9,15}$/.test(String(v).replace(/[\s()-]/g, "")); };
    function timesOf(){ var m = /^rassylka-(\d)-/.exec(sel ? sel.value : ""); return m ? Number(m[1]) : 1; }
    /* даты и время рассылок (по Москве) */
    var schedBox = $("sched"), schedVals = [];
    function p2(n){ return (n < 10 ? "0" : "") + n; }
    function dstr(d){ return d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate()); }
    function mskDay(add){ return dstr(new Date(Date.now() + 3 * 3600e3 + add * 864e5)); }
    function mailCount(){ if(isCv){ if(!addBase || !addBase.value) return 0; return Number(addBase.value.split(":")[1]) || 1; } return timesOf(); }
    function renderSched(){
        if(!schedBox) return;
        var n = mailCount(), min = mskDay(1), html = "";
        for(var i = 0; i < n; i++){
            var v = schedVals[i] || {d: mskDay(1 + 7 * i), t: "10:00"};
            if(v.d < min) v.d = min; schedVals[i] = v;
            var opts = ""; for(var h = 6; h < 18; h++) for(var m = 0; m < 60; m += 30){ var tt = p2(h) + ":" + p2(m); opts += "<option" + (tt === v.t ? " selected" : "") + ">" + tt + "</option>"; }
            html += '<div class="schrow"><span class="schn">' + (n > 1 ? "Рассылка №" + (i + 1) : "Рассылка") + '</span><input type="date" class="in" data-sd="' + i + '" min="' + min + '" value="' + v.d + '"><select class="in" data-st="' + i + '">' + opts + '</select><span class="schw" data-sw="' + i + '"></span></div>';
        }
        schedBox.innerHTML = html; weekendNotes();
    }
    function weekendNotes(){
        [].forEach.call(schedBox ? schedBox.querySelectorAll("[data-sw]") : [], function(w){
            var v = schedVals[Number(w.getAttribute("data-sw"))]; if(!v || !v.d) return;
            var dw = new Date(v.d + "T00:00:00Z").getUTCDay();
            w.textContent = dw === 6 || dw === 0 ? "Выходной — старт перенесётся на понедельник" : "";
        });
    }
    if(schedBox) schedBox.addEventListener("change", function(e){
        var a = e.target.getAttribute("data-sd"), b = e.target.getAttribute("data-st");
        if(a !== null){ schedVals[Number(a)].d = e.target.value; }
        if(b !== null){ schedVals[Number(b)].t = e.target.value; }
        weekendNotes();
    });
    function schedCheck(){
        var n = mailCount(), min = mskDay(1), prev = "";
        for(var i = 0; i < n; i++){
            var v = schedVals[i]; if(!v || !/^\d{4}-\d{2}-\d{2}$/.test(v.d)) return "Выберите дату рассылки";
            if(v.d < min) return "Дата рассылки — не раньше завтрашнего дня";
            if(prev && v.d <= prev) return "Каждая следующая рассылка — на более позднюю дату, чем предыдущая";
            prev = v.d;
        }
        return "";
    }
    var lastSum = 0;
    function recalc(){
        var sum = 0;
        if(isCv){
            sum = Number(sel.getAttribute("data-price")) || 0;
            if(addBase && addBase.value){ sum += Number(addBase.options[addBase.selectedIndex].getAttribute("data-p")) || 0; }
            var mo = $("addMore"); if(mo) mo.hidden = !(addBase && addBase.value);
        } else if(sel){
            sum = Number((sel.getAttribute("data-prices") || "").split(",")[timesOf() - 1]) || 0;
            var tt = $("tmsTxt"), ts = $("tmsSum"); if(tt) tt.textContent = timesOf() + (timesOf() === 1 ? " рассылка" : " рассылки"); if(ts) ts.textContent = fmt(sum);
            if(extra){
                [].forEach.call(extra.options, function(x){ x.disabled = !!x.value && sel.value === "rassylka-" + timesOf() + "-" + x.value; });
                var tn = timesOf() - 1;
                var note = $("extraNote");
                if(extra.value){ var eo = extra.options[extra.selectedIndex]; if(eo.disabled){ extra.value = ""; } else sum += Number((eo.getAttribute("data-p") || "").split(",")[tn]) || 0; }
                if(note){
                    if(extra.value){ var eo2 = extra.options[extra.selectedIndex], f2 = Number((eo2.getAttribute("data-f") || "").split(",")[tn]), d2 = Number((eo2.getAttribute("data-p") || "").split(",")[tn]);
                        note.innerHTML = "Цена базы <s>" + fmt(f2) + "</s> — для вас <b>" + fmt(d2) + "</b>. Вы экономите " + fmt(f2 - d2) + "."; note.hidden = false; }
                    else note.hidden = true;
                }
            }
        }
        lastSum = sum;
        if(total) total.textContent = fmt(sum);
        if(schedBox){ var cur = schedBox.querySelectorAll("[data-sd]").length; if(cur !== mailCount() || !cur && mailCount()) renderSched(); }
    }
    /* предложение персонального сопроводительного письма — после нажатия «Оформить заказ» */
    function askCover(cb){
        var m = $("coverModal"); if(!m) return cb(false);
        var price = Number(m.getAttribute("data-price")) || 0, std = $("coverStd");
        $("coverTotal").textContent = fmt(lastSum + price);
        var mail = !isCv || !!(addBase && addBase.value), okh = $("coverOk");
        if(std) std.hidden = !mail; if(okh) okh.hidden = !mail; $("coverNo").textContent = mail ? "Нет, стандартное письмо" : "Нет, спасибо";
        var prev = document.activeElement;
        function close(){ m.hidden = true; document.body.classList.remove("modal-open"); document.removeEventListener("keydown", esc); if(prev && prev.focus) prev.focus(); }
        function esc(e){ if(e.key === "Escape") close(); }
        $("coverYes").onclick = function(){ close(); cb(true); };
        $("coverNo").onclick = function(){ close(); cb(false); };
        $("coverBack").onclick = close;
        m.onclick = function(e){ if(e.target === m) close(); };
        document.addEventListener("keydown", esc);
        m.hidden = false; document.body.classList.add("modal-open"); $("coverYes").focus();
    }
    var seg = $("timesSeg");
    if(seg) seg.addEventListener("click", function(e){
        var bt = e.target.closest("button[data-n]"); if(!bt) return;
        [].forEach.call(seg.querySelectorAll("button"), function(x){ x.classList.toggle("on", x === bt); });
        sel.value = (sel.getAttribute("data-slugs") || "").split(",")[Number(bt.getAttribute("data-n")) - 1];
        recalc(); history.replaceState(null, "", "/order?s=" + sel.value);
    });
    if(addBase) addBase.addEventListener("change", recalc);
    if(extra) extra.addEventListener("change", recalc);
    recalc();

    /* выбор должностей и судов */
    [].forEach.call(document.querySelectorAll("[data-chips]"), function(box){
        var name = box.getAttribute("data-chips"), max = Number(box.getAttribute("data-max")) || 0, hid = $(name), pop = box.querySelector(".ms-pop"), btn = box.querySelector(".ms-btn");
        btn.addEventListener("click", function(){ var open = pop.hidden; [].forEach.call(document.querySelectorAll(".ms-pop"), function(p){ p.hidden = true; }); pop.hidden = !open; });
        document.addEventListener("click", function(e){ if(!box.contains(e.target)) pop.hidden = true; });
        document.addEventListener("keydown", function(e){ if(e.key === "Escape") pop.hidden = true; });
        box.addEventListener("change", function(ev){
            var on = [].filter.call(box.querySelectorAll("input:checked"), function(x){ return true; });
            if(max && on.length > max){ ev.target.checked = false; on = on.filter(function(x){ return x !== ev.target; }); fail("Можно выбрать не больше " + max + (name === "position" ? " должностей" : " типов судов")); return; }
            var vals = on.map(function(x){ return x.value; });
            box.querySelector(".ms-btn").textContent = vals.length ? vals.join(", ") : box.getAttribute("data-ph");
            box.classList.toggle("has", vals.length > 0);
            if(name === "position"){ var oth = $("positionOther"); if(oth) oth.hidden = vals.indexOf("Другая") < 0; }
            hid.value = vals.join(", ");
        });
    });
    function positionValue(){
        var v = $("position").value; if(v.split(", ").indexOf("Другая") < 0) return v;
        if(!$("positionOther")) return v;
        var oth = $("positionOther").value.trim(); return v.split(", ").filter(function(x){ return x !== "Другая"; }).concat(oth ? [oth] : []).join(", ");
    }

    /* документы к резюме */
    function renderDocs(){
        var box = $("docList"); if(!box) return;
        box.innerHTML = docs.map(function(d, i){ return '<div>📎 ' + d.name.replace(/[<>&]/g, "") + ' · ' + Math.max(1, Math.round(d.size / 1024)) + ' КБ <a href="#" data-rm="' + i + '">убрать</a></div>'; }).join("");
        [].forEach.call(box.querySelectorAll("[data-rm]"), function(a){ a.onclick = function(e){ e.preventDefault(); docs.splice(Number(a.getAttribute("data-rm")), 1); renderDocs(); }; });
    }
    var dIn = $("docs");
    if(dIn) dIn.addEventListener("change", function(){
        var bad = [];
        [].forEach.call(dIn.files, function(fl){
            if(docs.some(function(d){ return d.name === fl.name && d.size === fl.size; })) return;
            if(!DOC_EXT.test(fl.name)){ bad.push(fl.name + " — такой тип файла не принимаем"); return; }
            if(fl.size > DOC_MAX){ bad.push(fl.name + " — больше 15 МБ"); return; }
            if(docs.length >= DOC_COUNT){ bad.push("Можно приложить не больше " + DOC_COUNT + " файлов"); return; }
            docs.push(fl);
        });
        if(docs.reduce(function(a, d){ return a + d.size; }, 0) > DOC_TOTAL){ docs.length = 0; bad.push("Общий размер файлов больше 100 МБ — приложите самые важные"); }
        dIn.value = ""; renderDocs(); if(bad.length) fail(bad.join("; "));
    });

    /* автозаполнение анкеты по прикреплённому резюме */
    function setVal(id, v){ var el = $(id); if(!el || v == null || String(v) === "") return 0; el.value = String(v); el.classList.add("auto"); el.classList.remove("need"); return 1; }
    function fillForm(F){
        var n = 0;
        ["first", "last", "email", "phone", "linkedin", "location", "dob", "minSalary", "school", "vesselExp", "engines", "eyes", "height", "weight", "overall", "shoe", "nokName", "nokRel", "nokPhone"].forEach(function(k){ n += setVal(k, F[k]); });
        if(F.english){ var en = $("english"); if(en && [].some.call(en.options, function(o){ return o.value === F.english; })){ en.value = F.english; en.classList.add("auto"); n++; } }
        [["position", F.position], ["vessel", F.vessel]].forEach(function(pr){
            var box = document.querySelector('[data-chips="' + pr[0] + '"]'); if(!box || !pr[1] || !pr[1].length) return;
            var ins = [].slice.call(box.querySelectorAll("input")); ins.forEach(function(i){ i.checked = false; });
            var on = ins.filter(function(i){ return pr[1].indexOf(i.value) >= 0; }); on.forEach(function(i){ i.checked = true; });
            if(on.length){ on[0].dispatchEvent(new Event("change", {bubbles: true})); n++; }
        });
        if(F.messengers && F.messengers.length){ [].forEach.call(document.querySelectorAll("input[name=msg]"), function(c){ c.checked = F.messengers.indexOf(c.value) >= 0; }); n++; }
        return n;
    }
    var af = $("autoFile");
    if(af) af.addEventListener("change", function(){
        var fl = af.files[0], msg = $("autoMsg"); if(!fl) return;
        msg.style.color = ""; 
        if(fl.size > 5 * 1024 * 1024){ msg.textContent = "Файл больше 5 МБ — приложите его в разделе «Документы» ниже и заполните анкету вручную."; return; }
        msg.textContent = "⏳ Читаем резюме… обычно до минуты. Не закрывайте страницу.";
        fetch("/api/parse-cv", {method: "POST", headers: {"Content-Type": "application/octet-stream", "X-Name": encodeURIComponent(fl.name)}, body: fl})
            .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || "Не удалось прочитать файл"); return j; }); })
            .then(function(j){
                var n = fillForm(j.fields || {});
                if(!docs.some(function(d){ return d.name === fl.name && d.size === fl.size; }) && docs.length < DOC_COUNT){ docs.push(fl); renderDocs(); }
                var miss = [["first", "last", "email", "phone", "location", "dob", "english", "school", "vesselExp", "eyes", "height", "weight", "overall", "shoe", "nokName", "nokRel", "nokPhone"]][0].filter(function(id){ var el = $(id); return el && !el.value; });
                miss.forEach(function(id){ $(id).classList.add("need"); });
                msg.textContent = n ? "✅ Заполнили полей: " + n + ". Файл добавлен к заказу. Проверьте данные" + (miss.length ? " и допишите поля, выделенные жёлтым — их нет в резюме." : ".") : "В файле не нашлось данных для анкеты — заполните её вручную.";
            })
            .catch(function(e){ msg.textContent = "⚠ " + e.message; });
    });
    [].forEach.call(document.querySelectorAll(".in"), function(el){ el.addEventListener("input", function(){ el.classList.remove("need"); }); el.addEventListener("change", function(){ el.classList.remove("need"); }); });

    function fail(t){ var e = $("err"); e.textContent = t; e.hidden = false; e.scrollIntoView({behavior: "smooth", block: "center"}); }
    function readFile(file){
        return new Promise(function(ok, no){
            var r = new FileReader();
            r.onload = function(){ ok({name: file.name, b64: String(r.result).split(",")[1] || ""}); };
            r.onerror = function(){ no(new Error("Не удалось прочитать файл")); };
            r.readAsDataURL(file);
        });
    }
    var val = function(id){ var e = $(id); return e ? e.value.trim() : ""; };
    function checkCv(){
        if(!LATIN.test(val("first")) || !LATIN.test(val("last"))) return "Имя и фамилию укажите на английском (латиницей), как в паспорте моряка";
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val("email"))) return "Укажите корректный e-mail";
        if(!phoneOk(val("phone"))) return "Телефон укажите с кодом страны, например +7 900 000 00 00";
        if(!$("position").value) return "Выберите должность";
        if($("position").value.split(", ").indexOf("Другая") >= 0 && !val("positionOther")) return "Укажите вашу должность";
        if(!$("vessel").value) return "Выберите предпочитаемый вид судов";
        if(!document.querySelector("input[name=msg]:checked")) return "Отметьте мессенджеры на этом номере";
        var need = [["location", "местонахождение"], ["dob", "дату рождения"], ["english", "уровень английского"], ["school", "учебное заведение"], ["vesselExp", "суда, на которых есть опыт"], ["eyes", "цвет глаз"], ["height", "рост"],
            ["weight", "вес"], ["overall", "размер робы"], ["shoe", "размер обуви"], ["nokName", "ближайшего родственника"], ["nokRel", "кем приходится родственник"], ["nokPhone", "телефон родственника"]];
        for(var k = 0; k < need.length; k++) if(!val(need[k][0])){ $(need[k][0]).focus(); return "Заполните: " + need[k][1]; }
        var age = (Date.now() - Date.parse(val("dob"))) / 31557600000; if(!(age >= 16 && age <= 80)) return "Проверьте дату рождения";
        if(!phoneOk(val("nokPhone"))) return "Телефон родственника укажите с кодом страны";
        return "";
    }
    f.addEventListener("submit", function(ev){
        ev.preventDefault(); $("err").hidden = true;
        var go = $("go"), fileEl = $("file"), file = fileEl && fileEl.files && fileEl.files[0];
        if(isCv){ var m = checkCv(); if(m) return fail(m); }
        else {
            if(!val("first") || !val("last")) return fail("Укажите имя и фамилию");
            if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val("email"))) return fail("Укажите корректный e-mail");
            if($("position").value.split(", ").indexOf("Другая") >= 0 && !val("positionOther")) return fail("Укажите вашу должность");
            if(fileEl && fileEl.hasAttribute("required") && !file) return fail("Загрузите ваше резюме (PDF или Word)");
            if(file && file.size > 5 * 1024 * 1024) return fail("Файл больше 5 МБ — уменьшите его или напишите менеджеру в чате");
        }
        if(!$("agree").checked) return fail("Нужно согласие с офертой и политикой конфиденциальности");
        var sm = schedCheck(); if(sm) return fail(sm);
        askCover(function(cover){
        go.disabled = true; go.textContent = "Отправляем…";
        (file ? readFile(file) : Promise.resolve(null)).then(function(fl){
            var body = {slug: val("slug"), first: val("first"), last: val("last"), email: val("email"), phone: val("phone"), position: positionValue(), vessel: val("vessel"),
                letter: val("letter"), exclude: val("exclude"), comment: val("comment"), hp: val("hp"), agree: $("agree").checked, file: fl, cover: cover ? 1 : 0};
            if(extra && extra.value) body.extra = extra.value;
            if(mailCount()) body.schedule = schedVals.slice(0, mailCount()).map(function(v){ return v.d + "T" + v.t; });
            if(isCv){
                if(addBase && addBase.value){ var ps = addBase.value.split(":"); body.addon = {base: ps[0], times: Number(ps[1])}; }
                body.details = {linkedin: val("linkedin"), messengers: [].map.call(document.querySelectorAll("input[name=msg]:checked"), function(x){ return x.value; }), location: val("location"), dob: val("dob"),
                    english: val("english"), minSalary: val("minSalary"), school: val("school"), vesselExp: val("vesselExp"), engines: val("engines"), eyes: val("eyes"), height: val("height"), weight: val("weight"),
                    overall: val("overall"), shoe: val("shoe"), nokName: val("nokName"), nokRel: val("nokRel"), nokPhone: val("nokPhone")};
            }
            return fetch("/api/order", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
        }).then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }); }).then(function(x){
            if(!x.ok) throw new Error(x.j.error || "Не удалось оформить заказ");
            if(!isCv || !docs.length || !x.j.id) { location.href = x.j.url; return; }
            var i = 0, bad = 0, base = "/api/order/" + encodeURIComponent(x.j.id);
            var next = function(){
                if(i >= docs.length){
                    return fetch(base + "/docs-done?t=" + encodeURIComponent(x.j.token), {method: "POST"}).catch(function(){}).then(function(){ location.href = x.j.url + (bad ? "?docs=" + bad : ""); });
                }
                go.textContent = "Загружаем документы: " + (i + 1) + " из " + docs.length + "…";
                var d = docs[i++];
                return fetch(base + "/doc?t=" + encodeURIComponent(x.j.token), {method: "POST", headers: {"Content-Type": d.type || "application/octet-stream", "X-Name": encodeURIComponent(d.name)}, body: d})
                    .then(function(r){ if(!r.ok) bad++; }).catch(function(){ bad++; }).then(next);
            };
            return next();
        }).catch(function(e){ go.disabled = false; go.textContent = "Оформить заказ"; fail(e.message); });
        });
    });
})();
