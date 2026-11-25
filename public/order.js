/* Форма заказа и страница заказа */
(function(){
    function $(id){ return document.getElementById(id); }
    function fmt(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }

    /* часть документов не загрузилась */
    var dm = /[?&]docs=(\d+)/.exec(location.search);
    if(dm && document.querySelector(".page h1")){ var nb = document.createElement("div"); nb.className = "err"; nb.textContent = "Не все файлы удалось загрузить (" + dm[1] + "). Пришлите их менеджеру в WhatsApp или Telegram — резюме составим по анкете.";
        document.querySelector(".page h1").insertAdjacentElement("afterend", nb); }

    /* копирование номера карты */
    [].forEach.call(document.querySelectorAll("[data-copy]"), function(b){
        b.addEventListener("click", function(){
            var t = b.getAttribute("data-copy"), done = function(){ var o = b.textContent; b.textContent = "Скопировано"; setTimeout(function(){ b.textContent = o; }, 1800); };
            if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done);
            else { var a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch(e){} a.remove(); done(); }
        });
    });

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
                [].forEach.call(extra.options, function(x){ if(!x.value) return; var f = Number((x.getAttribute("data-f") || "").split(",")[tn]), d = Number((x.getAttribute("data-p") || "").split(",")[tn]); x.textContent = x.getAttribute("data-t") + " — " + fmt(f) + " → " + fmt(d); });
                var note = $("extraNote");
                if(extra.value){ var eo = extra.options[extra.selectedIndex]; if(eo.disabled){ extra.value = ""; } else sum += Number((eo.getAttribute("data-p") || "").split(",")[tn]) || 0; }
                if(note){
                    if(extra.value){ var eo2 = extra.options[extra.selectedIndex], f2 = Number((eo2.getAttribute("data-f") || "").split(",")[tn]), d2 = Number((eo2.getAttribute("data-p") || "").split(",")[tn]);
                        note.innerHTML = "Цена базы <s>" + fmt(f2) + "</s> — для вас <b>" + fmt(d2) + "</b>. Вы экономите " + fmt(f2 - d2) + "."; note.hidden = false; }
                    else note.hidden = true;
                }
            }
        }
        if(total) total.textContent = fmt(sum);
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
            if(file && file.size > 5 * 1024 * 1024) return fail("Файл больше 5 МБ — уменьшите его или пришлите в WhatsApp");
        }
        if(!$("agree").checked) return fail("Нужно согласие с офертой и политикой конфиденциальности");
        go.disabled = true; go.textContent = "Отправляем…";
        (file ? readFile(file) : Promise.resolve(null)).then(function(fl){
            var body = {slug: val("slug"), first: val("first"), last: val("last"), email: val("email"), phone: val("phone"), position: positionValue(), vessel: val("vessel"),
                letter: val("letter"), exclude: val("exclude"), comment: val("comment"), hp: val("hp"), agree: $("agree").checked, file: fl};
            if(extra && extra.value) body.extra = extra.value;
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
})();
