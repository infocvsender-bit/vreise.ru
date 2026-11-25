/* Форма заказа и страница заказа */
(function(){
    function $(id){ return document.getElementById(id); }
    function fmt(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }

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
    var sel = $("slug"), total = $("total");
    if(sel) sel.addEventListener("change", function(){
        var o = sel.options ? sel.options[sel.selectedIndex] : null, p = o ? o.getAttribute("data-price") : sel.getAttribute("data-price");
        if(p) total.textContent = fmt(Number(p));
        history.replaceState(null, "", "/order?s=" + sel.value);
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
    f.addEventListener("submit", function(ev){
        ev.preventDefault(); $("err").hidden = true;
        var go = $("go"), fileEl = $("file"), file = fileEl && fileEl.files && fileEl.files[0];
        if(!$("first").value.trim() || !$("last").value.trim()) return fail("Укажите имя и фамилию");
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($("email").value.trim())) return fail("Укажите корректный e-mail");
        if(fileEl && fileEl.hasAttribute("required") && !file) return fail("Загрузите ваше резюме (PDF или Word)");
        if(file && file.size > 5 * 1024 * 1024) return fail("Файл больше 5 МБ — уменьшите его или пришлите в WhatsApp");
        if(!$("agree").checked) return fail("Нужно согласие с офертой и политикой конфиденциальности");
        go.disabled = true; go.textContent = "Отправляем…";
        var val = function(id){ var e = $(id); return e ? e.value : ""; };
        (file ? readFile(file) : Promise.resolve(null)).then(function(fl){
            return fetch("/api/order", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({
                slug: val("slug"), first: val("first"), last: val("last"), email: val("email"), phone: val("phone"), position: val("position"), vessel: val("vessel"),
                letter: val("letter"), exclude: val("exclude"), comment: val("comment"), hp: val("hp"), agree: $("agree").checked, file: fl})});
        }).then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }); }).then(function(x){
            if(!x.ok) throw new Error(x.j.error || "Не удалось оформить заказ");
            location.href = x.j.url;
        }).catch(function(e){ go.disabled = false; go.textContent = "Оформить заказ"; fail(e.message); });
    });
})();
