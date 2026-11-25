/* CRM Vreise.ru */
(function(){
    var view = document.getElementById("view"), tab = "orders", filter = "", search = "", mode = "board";
    var ST = {new: "Ждёт оплаты", claimed: "Клиент оплатил", paid: "Оплачен", in_progress: "В работе", done: "Выполнен", cancelled: "Отменён"};
    var JST = {wait: "ждёт", run: "идёт", pause: "пауза", done: "готово", stop: "остановлена"};
    function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); }
    function rub(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }
    function dt(s){ return s ? new Date(s).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}) : "—"; }
    function api(path, opt){
        opt = opt || {};
        return fetch("/crm/api" + path, {method: opt.body ? "POST" : "GET", headers: {"Content-Type": "application/json"}, body: opt.body ? JSON.stringify(opt.body) : undefined}).then(function(r){
            if(r.status === 401){ location.reload(); throw new Error("auth"); }
            return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || "Ошибка"); return j; });
        });
    }
    function alertErr(e){ if(e.message !== "auth") window.alert(e.message); }
    function readFile(file){ return new Promise(function(ok, no){ var r = new FileReader(); r.onload = function(){ ok({name: file.name, b64: String(r.result).split(",")[1] || ""}); }; r.onerror = no; r.readAsDataURL(file); }); }
    function readText(file){ return new Promise(function(ok, no){ var r = new FileReader(); r.onload = function(){ ok(String(r.result)); }; r.onerror = no; r.readAsText(file, "utf-8"); }); }

    /* ---------- заказы ---------- */
    function orders(){
        api("/orders?status=" + (mode === "board" ? "" : encodeURIComponent(filter)) + "&q=" + encodeURIComponent(search)).then(function(d){
            if(mode === "board") return board(d);
            if(mode === "list") return table(d);
            var s = d.summary, fl = [["", "Все"]].concat(Object.keys(ST).map(function(k){ return [k, ST[k] + (s[k] ? " · " + s[k] : "")]; }));
            view.innerHTML = '<div class="flt">' + fl.map(function(f){ return '<button data-f="' + f[0] + '"' + (f[0] === filter ? ' class="on"' : "") + ">" + esc(f[1]) + "</button>"; }).join("") +
                '<input class="in" id="q" placeholder="Поиск: №, имя, e-mail" style="max-width:260px;padding:7px 12px" value="' + esc(search) + '"></div>' +
                '<div class="panel" style="padding:8px 14px;overflow:auto"><table class="t"><thead><tr><th>№</th><th>Дата</th><th>Услуга</th><th>Клиент</th><th>Сумма</th><th>Рассылка</th><th>Статус</th></tr></thead><tbody>' +
                (d.orders.length ? d.orders.map(function(o){ return '<tr class="click" data-id="' + o.id + '"><td><b>' + o.num + "</b></td><td>" + dt(o.created_at) + "</td><td>" + esc(o.title) + "</td><td>" + esc(o.first_name + " " + o.last_name) + '<br><span class="mut">' + esc(o.email) + '</span></td><td>' + rub(o.price) + '</td><td>' + (o.total ? o.sent + ' / ' + o.total + (o.failed ? ' <span class="mut">(ош. ' + o.failed + ')</span>' : '') : '<span class="mut">—</span>') + (o.email_ok ? '' : '<br><span class="mut" title="e-mail не подтверждён">⚠️ почта</span>') + '</td><td><span class="tag ' + o.status + '">' + esc(ST[o.status] || o.status) + "</span></td></tr>"; }).join("") : '<tr><td colspan="7" class="mut">Заказов пока нет</td></tr>') + "</tbody></table></div>";
            view.insertAdjacentHTML("afterbegin", modeSwitch()); bindMode();
            [].forEach.call(view.querySelectorAll("[data-f]"), function(b){ b.onclick = function(){ filter = b.getAttribute("data-f"); orders(); }; });
            [].forEach.call(view.querySelectorAll("tr.click"), function(r){ r.onclick = function(){ order(r.getAttribute("data-id")); }; });
            var q = document.getElementById("q"); q.onkeydown = function(e){ if(e.key === "Enter"){ search = q.value; orders(); } };
        }).catch(alertErr);
    }


    /* ---------- таблица заказов: суммы в рублях, «Часть Дима» = сумма минус 40% ---------- */
    var tFold = {}, tStatus = "", tService = "", tMonth = "", PAID = ["paid", "in_progress", "done"], DIMA = 0.6;
    function dfull(s){ return s ? new Date(s).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"}) : "—"; }
    function mailDate(o, m){
        var j = (o.jobs || []).filter(function(x){ return x.m === m; })[0]; if(j && j.start_at) return dfull(j.start_at);
        var sc = []; try { sc = JSON.parse(o.schedule || "[]"); } catch(e){}
        var x = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(sc[m - 1] || ""); return x ? x[3] + "." + x[2] + "." + x[1] + " " + x[4] : "—";
    }
    function table(d){
        var mk = function(o){ var x = new Date(o.created_at); return String(x.getFullYear() * 100 + x.getMonth() + 1); };
        var all = d.orders.filter(function(o){ return (!tStatus || o.status === tStatus) && (!tService || (tService === "cv" ? o.kind === "cv" : o.kind === "mailing")) && (!tMonth || mk(o) === tMonth); });
        var rows = all.slice().sort(function(a, b){ return a.created_at < b.created_at ? 1 : -1; });
        var paid = function(o){ return PAID.indexOf(o.status) >= 0; };
        var sum = function(list){ return list.filter(paid).reduce(function(a, o){ return a + Number(o.price); }, 0); };
        var dim = function(o){ return Math.round(Number(o.price) * DIMA); }, sumD = function(list){ return list.filter(paid).reduce(function(a, o){ return a + dim(o); }, 0); }, sumM = function(list){ return sum(list) - sumD(list); };
        var settled = Number(d.settled) || 0, out = function(o){ return paid(o) && Number(o.num) <= settled; }, sumOut = function(list){ return sumD(list.filter(out)); }, sumDue = function(list){ return sumD(list.filter(function(o){ return !out(o); })); };
        var tot = sum(rows), MN = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
        var groups = [], gi = {};
        rows.forEach(function(o){ var dd = new Date(o.created_at), k = dd.getFullYear() * 100 + dd.getMonth(); if(!gi[k]){ gi[k] = {k: k, t: MN[dd.getMonth()] + " " + dd.getFullYear(), l: []}; groups.push(gi[k]); } gi[k].l.push(o); });
        var th = ["№ заказа", "Дата заказа", "1 рассылка", "2 рассылка", "3 рассылка", "Имя Фамилия", "Статус", "Сумма заказа", "Часть Дима (60%)", "Часть Максима (40%)", "Услуга", "Тип судов", "Должность", "E-mail", "Телефон", "Резюме"];
        var body = groups.map(function(g){
            var gs = sum(g.l);
            var fold = !!tFold[g.k];
            return '<tr class="grp" data-g="' + g.k + '"><td colspan="' + th.length + '"><span class="car">' + (fold ? "▸" : "▾") + "</span> " + esc(g.t) + " · " + g.l.length + " заказ(ов) · зашло " + rub(gs) + " · Дима " + rub(sumD(g.l)) + " · Максим " + rub(sumM(g.l)) + (sumDue(g.l) ? " · к выплате Диме " + rub(sumDue(g.l)) : "") + "</td></tr>" + g.l.map(function(o){
                var files = (o.cv_name ? '<a href="/crm/api/orders/' + o.id + '/cv" onclick="event.stopPropagation()">📎 ' + esc(o.cv_name) + "</a>" : "") + (o.res_name ? '<div><a href="/crm/api/orders/' + o.id + '/res" onclick="event.stopPropagation()">📄 ' + esc(o.res_name) + "</a></div>" : "");
                var p = paid(o);
                return '<tr class="click' + (o.status === "cancelled" ? " canc" : "") + (out(o) ? " outd" : "") + '" data-id="' + o.id + '" data-gk="' + g.k + '"' + (fold ? ' style="display:none"' : "") + '><td><b>№' + o.num + "</b></td><td>" + dfull(o.created_at) + "</td><td>" + (o.base ? mailDate(o, 1) : "—") + "</td><td>" + (o.base && Number(o.times) > 1 ? mailDate(o, 2) : "—") + "</td><td>" + (o.base && Number(o.times) > 2 ? mailDate(o, 3) : "—") + "</td><td>" + esc(((o.first_name || "") + " " + (o.last_name || "")).trim()) + "</td><td>" + esc(ST[o.status] || o.status) + (out(o) ? ' <span class="outb">✅ выведено</span>' : "") + '</td><td class="num">' + (p ? rub(o.price) : '<span class="mut">' + rub(o.price) + "</span>") + '</td><td class="num">' + (p ? "<b>" + rub(dim(o)) + "</b>" : '<span class="mut">—</span>') + '</td><td class="num">' + (p ? "<b>" + rub(o.price - dim(o)) + "</b>" : '<span class="mut">—</span>') + "</td><td>" + esc(o.title) + (Number(o.cover) ? " + персональное письмо" : "") + "</td><td>" + esc(o.vessel || "—") + "</td><td>" + esc(o.position || "—") + "</td><td>" + esc(o.email) + "</td><td>" + esc(o.phone || "—") + "</td><td>" + (files || "—") + "</td></tr>";
            }).join("");
        }).join("");
        var opts = function(map, cur){ return Object.keys(map).map(function(k){ return '<option value="' + k + '"' + (k === cur ? " selected" : "") + ">" + esc(map[k]) + "</option>"; }).join(""); };
        var monOpts = {"": "Все месяцы"}, seen = {}; d.orders.slice().sort(function(a, b){ return a.created_at < b.created_at ? 1 : -1; }).forEach(function(o){ var k = mk(o); if(!seen[k]){ seen[k] = 1; var x = new Date(o.created_at); monOpts[k] = MN[x.getMonth()] + " " + x.getFullYear(); } });
        var stOpts = {}; stOpts[""] = "Все статусы"; Object.keys(ST).forEach(function(k){ stOpts[k] = ST[k]; });
        view.innerHTML = '<div class="flt tbar"><b style="font-size:18px">📋 Таблица заказов</b><span class="mut">заказов: ' + rows.length + "</span>" +
            '<input class="in" id="q" placeholder="Поиск: имя, e-mail, телефон, №, должность" style="max-width:300px;padding:7px 12px" value="' + esc(search) + '">' +
            '<select class="in" id="tmo" style="max-width:190px;padding:7px 10px">' + opts(monOpts, tMonth) + '</select><select class="in" id="tst" style="max-width:170px;padding:7px 10px">' + opts(stOpts, tStatus) + '</select><select class="in" id="tsv" style="max-width:170px;padding:7px 10px">' + opts({"": "Все услуги", mailing: "Рассылки", cv: "Резюме"}, tService) + '</select>' +
            '<button class="btn sm" id="tfold" type="button">' + (groups.length && groups.every(function(g){ return tFold[g.k]; }) ? "▾ Развернуть всё" : "▸ Свернуть всё") + '</button><button class="btn gold sm" id="tcsv" type="button">⬇ Excel (CSV)</button></div>' +
            '<div class="tcards"><div><span>Всего зашло</span><b>' + rub(tot) + '</b></div><div class="d"><span>Дима · 60%</span><b>' + rub(sumD(rows)) + '</b></div><div class="m"><span>Максим · 40%</span><b>' + rub(sumM(rows)) + '</b></div><div class="o"><span>Выведено Диме</span><b>' + rub(sumOut(rows)) + '</b></div><div class="u"><span>К выплате Диме</span><b>' + rub(sumDue(rows)) + '</b></div></div>' +
            '<div class="settle"><span>💸 Максим выплатил Диме за заказы до №</span><input class="in" id="stl" type="number" min="0" placeholder="1401" value="' + (settled || "") + '"><span>включительно</span><button class="btn gold sm" id="stlok" type="button">Отметить</button>' + (settled ? '<button class="btn sm" id="stlx" type="button">Сбросить</button><span class="mut">сейчас выведено до №' + settled + "</span>" : '<span class="mut">пока ничего не отмечено</span>') + "</div>" + '<div class="panel tbl" style="padding:0;overflow:auto;max-height:78vh"><table class="t wide"><thead><tr>' + th.map(function(h){ return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" + (body || '<tr><td colspan="' + th.length + '" class="mut" style="padding:20px">Заказов нет</td></tr>') + "</tbody></table></div>";
        view.insertAdjacentHTML("afterbegin", modeSwitch()); bindMode();
        [].forEach.call(view.querySelectorAll("tr.click"), function(r){ r.onclick = function(){ order(r.getAttribute("data-id")); }; });
        var q = document.getElementById("q"); q.onkeydown = function(e){ if(e.key === "Enter"){ search = q.value; orders(); } };
        var setFold = function(k, f){ tFold[k] = f; [].forEach.call(view.querySelectorAll('tr[data-gk="' + k + '"]'), function(r){ r.style.display = f ? "none" : ""; }); var h = view.querySelector('tr.grp[data-g="' + k + '"] .car'); if(h) h.textContent = f ? "▸" : "▾"; };
        [].forEach.call(view.querySelectorAll("tr.grp"), function(r){ r.onclick = function(){ var k = r.getAttribute("data-g"); setFold(k, !tFold[k]); var all = groups.every(function(g){ return tFold[g.k]; }); document.getElementById("tfold").textContent = all ? "▾ Развернуть всё" : "▸ Свернуть всё"; }; });
        document.getElementById("tfold").onclick = function(){ var all = groups.length && groups.every(function(g){ return tFold[g.k]; }); groups.forEach(function(g){ setFold(g.k, !all); }); this.textContent = all ? "▸ Свернуть всё" : "▾ Развернуть всё"; };
        document.getElementById("stlok").onclick = function(){ var n = Number(document.getElementById("stl").value); if(!(n > 0)) return alert("Введите номер заказа, например 1401"); if(!confirm("Отметить заказы до №" + n + " включительно как «выведено» (выплачено Диме)?")) return; api("/settle", {body: {num: n}}).then(function(){ orders(); }).catch(alertErr); };
        var sx = document.getElementById("stlx"); if(sx) sx.onclick = function(){ if(confirm("Снять все отметки «выведено»?")) api("/settle", {body: {num: 0}}).then(function(){ orders(); }).catch(alertErr); };
        document.getElementById("tmo").onchange = function(){ tMonth = this.value; table(d); };
        document.getElementById("tst").onchange = function(){ tStatus = this.value; table(d); };
        document.getElementById("tsv").onchange = function(){ tService = this.value; table(d); };
        document.getElementById("tcsv").onclick = function(){
            var csv = [th.concat([]).join(";")].concat(rows.map(function(o){ var p = paid(o);
                return [o.num, dfull(o.created_at), o.base ? mailDate(o, 1) : "", o.base && o.times > 1 ? mailDate(o, 2) : "", o.base && o.times > 2 ? mailDate(o, 3) : "", ((o.first_name || "") + " " + (o.last_name || "")).trim(), ST[o.status] || o.status, Math.round(o.price), p ? dim(o) : "", p ? Math.round(o.price) - dim(o) : "", o.title, o.vessel || "", o.position || "", o.email, o.phone || "", o.cv_name || o.res_name || ""].map(function(x){ return '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"'; }).join(";"); })).join("\r\n");
            var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], {type: "text/csv;charset=utf-8"})); a.download = "zakazy-vreise-" + new Date().toISOString().slice(0, 10) + ".csv"; a.click();
        };
    }

    /* ---------- доска заказов (канбан) ---------- */
    function modeSwitch(){ return '<div class="flt" id="msw"><button data-m="board"' + (mode === "board" ? ' class="on"' : "") + '>🗂 Доска</button><button data-m="list"' + (mode === "list" ? ' class="on"' : "") + ">📋 Таблица</button></div>"; }
    function bindMode(){ [].forEach.call(document.querySelectorAll("#msw [data-m]"), function(b){ b.onclick = function(){ mode = b.getAttribute("data-m"); orders(); }; }); }
    var COLS = [["new", "🆕 Ждёт оплаты", "#e0a030"], ["claimed", "💬 Проверка оплаты", "#e05a2a"], ["paid", "💰 Оплачен", "#2f9e63"], ["work", "🛠 В работе", "#3b78c9"],
        ["run", "📨 Рассылка", "#6b4fd8"], ["done", "✅ Выполнен", "#0A3340"], ["cancelled", "✖ Отменён", "#a33"]];
    var COLORS = ["#b04a3c", "#3f51b5", "#2f9e8f", "#8e5bb5", "#c77d1a", "#3a7ca5", "#6b8e23"];
    function colOf(o){ if(o.status === "in_progress") return (o.jobs || []).some(function(j){ return j.status === "run"; }) ? "run" : "work"; return o.status; }
    function initials(o){ return ((o.first_name || "?")[0] + (o.last_name || "")[0]).toUpperCase(); }
    function pill(cls, t){ return '<div class="kb-p ' + cls + '">' + t + "</div>"; }
    function delOrder(id, num, done){
        if(!confirm("Удалить заказ №" + num + " НАВСЕГДА?\n\nБудут удалены карточка, файлы клиента, ответы компаний, история; рассылка остановится, ящики рассылки удалятся с серверов. Вернуть будет нельзя.")) return;
        api("/orders/" + id + "/delete", {body: {}}).then(function(r){ if(r && r.warn) alert(r.warn); done(); }).catch(alertErr);
    }
    function card(o){
        var js = o.jobs || [], run = js.filter(function(j){ return j.status === "run"; }), pause = js.some(function(j){ return j.status === "pause"; }), wait = js.filter(function(j){ return j.status === "wait"; });
        var col = COLORS[(o.num || 0) % COLORS.length], pct = o.total ? Math.round((o.sent + o.failed) / o.total * 100) : 0, b = [];
        b.push(o.email_ok ? pill("ok", "✉️ Почта: ✅ подтверждена") : pill("bad", "✉️ Почта не подтверждена" + (o.base ? " — рассылка ждёт" : "")));
        if(o.base){
            if(o.kind === "cv" && o.res_name) b.push(o.res_ok ? pill("ok", "📄 Резюме: ✅ подтверждено клиентом") : pill("warn", "📄 Резюме: ⏳ ждёт подтверждения клиента"));
            if(Number(o.cover)) b.push(o.cover_ok ? pill("ok", "💌 Персональное письмо: ✅ подтверждено") : pill("warn", "💌 Персональное письмо: ⏳ " + (o.status === "new" || o.status === "claimed" ? "после оплаты" : "нужно составить / подтвердить")));
            else b.push(pill("", o.own_letter ? "📝 своё письмо" : "📝 стандартное письмо"));
        }
        if(js.length && o.total) b.push('<div class="kb-prog"><i style="width:' + pct + '%"></i></div>' + pill("", "📨 Отправлено <b>" + pct + "%</b> · " + o.sent.toLocaleString("ru-RU") + " из " + o.total.toLocaleString("ru-RU")));
        if(pause) b.push(pill("warn", "⏸ Рассылка на паузе"));
        if(o.base){   /* рассылки 1-2-3 прямо в карточке: дата и время старта, статус и % */
            var n = Math.max(1, Math.min(3, Number(o.times) || 1)), L = "";
            for(var m = 1; m <= n; m++){
                var j = js.filter(function(x){ return x.m === m; })[0], st = !j ? "" : j.status === "run" ? " · идёт" + (j.total ? " " + Math.round((j.sent + j.failed) / j.total * 100) + "%" : "") : j.status === "pause" ? " · ⏸ пауза" : j.status === "done" ? " · ✅ готово" : j.status === "stop" ? " · остановлена" : j.status === "cancel" || j.status === "cancelled" ? " · отменена" : j.status === "wait" ? " · ждёт" : "";
                L += '<div class="kb-m"><b>' + m + "</b> " + mailDate(o, m).replace(/^(\d+\.\d+)\.\d{4}/, "$1") + st + "</div>";
            }
            b.push('<div class="kb-ms"><span class="mut">Рассылки</span>' + L + "</div>");
        }
        if(o.replies) b.push(pill("ok", "💬 Ответов компаний: " + o.replies));
        var ti = [o.position, o.vessel].filter(Boolean).join(" · ");
        return '<div class="kb-c" data-id="' + o.id + '"><button class="kb-del" data-del="' + o.id + '" data-num="' + o.num + '" title="Удалить заказ" type="button">🗑</button><div class="kb-h"><span>№' + o.num + (o.base ? " · 📨" : "") + (o.kind === "cv" ? " · 📄" : "") + "</span><b class=\"kb-pr\">" + rub(o.price) + "</b></div>" +
            '<div class="kb-who"><span class="kb-av" style="background:' + col + '">' + esc(initials(o)) + '</span><div class="kb-n"><b>' + esc(o.first_name + " " + o.last_name) + "</b><small>" + esc(ti) + "</small></div></div>" +
            '<div class="kb-t">' + esc(o.title) + ' <span class="mut">· ' + dt(o.created_at) + "</span></div>" + b.join("") + "</div>";
    }
    function board(d){
        var by = {}; COLS.forEach(function(c){ by[c[0]] = []; }); d.orders.forEach(function(o){ (by[colOf(o)] || (by[colOf(o)] = [])).push(o); });
        /* пустые колонки сворачиваются в узкую полоску — доска помещается на экран без прокрутки */
        var tpl = COLS.map(function(){ return "minmax(165px,250px)"; }).join(" ");
        var open = d.orders.length;
        var h = modeSwitch() + '<div class="flt"><input class="in" id="q" placeholder="Поиск: №, имя, e-mail" style="max-width:260px;padding:7px 12px" value="' + esc(search) + '"><span class="mut">Всего заказов: ' + d.orders.length + (open ? "" : " · заказов пока нет") + "</span></div>" + '<div class="kb" style="grid-template-columns:' + tpl + '">';
        COLS.forEach(function(c){
            var list = by[c[0]], sum = list.reduce(function(a, o){ return a + o.price; }, 0), cap = c[0] === "cancelled" ? 10 : c[0] === "done" ? 20 : 500;
            h += '<div class="kb-col" style="border-top-color:' + c[2] + '"><div class="kb-ch"><span><i style="background:' + c[2] + '"></i>' + c[1] + '</span><b>' + list.length + "</b></div>" + (list.length ? '<div class="mut" style="margin:-4px 0 8px 2px">' + rub(sum) + "</div>" : "") +
                (list.length ? list.slice(0, cap).map(card).join("") + (list.length > cap ? '<p class="mut" style="text-align:center">…ещё ' + (list.length - cap) + " (смотрите во вкладке «Список»)</p>" : "") : '<div class="kb-empty">Пусто</div>') + "</div>";
        });
        view.innerHTML = h + "</div>"; bindMode();
        [].forEach.call(view.querySelectorAll(".kb-c"), function(c){ c.onclick = function(){ order(c.getAttribute("data-id")); }; });
        [].forEach.call(view.querySelectorAll(".kb-del"), function(b){ b.onclick = function(e){ e.stopPropagation(); delOrder(b.getAttribute("data-del"), b.getAttribute("data-num"), orders); }; });
        var q = document.getElementById("q"); q.onkeydown = function(e){ if(e.key === "Enter"){ search = q.value; orders(); } };
    }

    function order(id){
        api("/orders/" + id).then(function(d){
            var o = d.order, cv = o.kind === "cv";
            var h = '<p><a href="#" id="back">← К заказам</a></p><div class="panel"><h3>Заказ №' + o.num + ' · <span class="tag ' + o.status + '">' + esc(ST[o.status] || o.status) + "</span></h3><div class=\"kv\">" +
                "<b>Услуга</b><span>" + esc(o.title) + " — " + rub(o.price) + "</span><b>Клиент</b><span>" + esc(o.first_name + " " + o.last_name) + "</span><b>E-mail</b><span>" + esc(o.email) + "</span>" +
                (o.phone ? "<b>Телефон</b><span>" + esc(o.phone) + "</span>" : "") + (o.position ? "<b>Должность</b><span>" + esc(o.position) + "</span>" : "") + (o.vessel ? "<b>Суда</b><span>" + esc(o.vessel) + "</span>" : "") +
                "<b>Подтверждение e-mail</b><span>" + (o.email_ok ? "✅ подтверждён " + dt(o.email_ok) : "⚠️ не подтверждён <button class=\"btn sm gold\" id=\"emok\" style=\"margin-left:8px\">Отметить подтверждённым</button>") + "</span><b>Оформлен</b><span>" + dt(o.created_at) + "</span><b>Нажал «оплатил»</b><span>" + dt(o.claimed_at) + "</span><b>Оплата подтверждена</b><span>" + dt(o.paid_at) + "</span>" +
                '<b>Страница клиента</b><span><a href="' + esc(d.link) + '" target="_blank">' + esc(d.link) + "</a></span>" +
                (o.cv_name ? '<b>Файл клиента</b><span><a href="/crm/api/orders/' + o.id + '/cv">' + esc(o.cv_name) + "</a></span>" : "") + "</div>" +
                (o.letter ? '<p class="mut" style="margin-top:12px">Письмо клиента:</p><div class="pre">' + esc(o.letter) + "</div>" : "") +
                (o.exclude ? '<p class="mut" style="margin-top:12px">Исключить:</p><div class="pre">' + esc(o.exclude) + "</div>" : "") +
                (o.comment ? '<p class="mut" style="margin-top:12px">Данные для резюме:</p><div class="pre">' + esc(o.comment) + "</div>" : "") +
                '<div class="acts">' + (["new", "claimed"].indexOf(o.status) >= 0 ? '<button class="btn gold sm" id="confirm">✔ Подтвердить оплату и запустить</button>' : "") +
                (["done", "cancelled"].indexOf(o.status) < 0 ? '<button class="btn sm red" id="cancel">Отменить заказ</button>' : "") + '<button class="btn sm line" id="delorder" style="color:#a33;border-color:#e0b3a8">🗑 Удалить заказ</button></div></div>';
            if(cv && o.base && o.res_name && !o.res_ok) h += '<div class="panel" style="border:2px solid #f2b400"><h3>📄 Резюме отправлено клиенту — ждём его подтверждения</h3><p class="mut">Рассылка стартует только после того, как клиент проверит резюме в кабинете и нажмёт «Подтвердить» (и подтвердит e-mail). Нужна правка — загрузите новый файл в блоке результата: клиент получит его снова.</p><div class="acts"><button class="btn sm line" id="resskip" style="color:var(--deep);border-color:#9fb6bb">Запустить без подтверждения клиента</button></div></div>';
            if(Number(o.cover)) h += '<div class="panel" style="border:2px solid #f2b400"><h3>💌 Персональное письмо (оплачено клиентом)</h3>' + (d.def ?
                (o.cover_ok ? '<p class="mut">✅ Клиент подтвердил письмо ' + dt(o.cover_ok) + '. Новое сохранение снова уйдёт ему на подтверждение, но на уже идущую рассылку не повлияет.</p>' : o.draft_letter ? '<p class="mut" style="color:#b9770e">Письмо отправлено клиенту — <b>ждём его подтверждения</b>, рассылка стоит. Можно поправить и отправить заново.</p>' : '<p class="mut" style="color:#b9770e">Письмо ещё не написано — <b>рассылка ждёт</b>. Отредактируйте текст ниже (подставлен стандартный), сохраните — клиент получит его на подтверждение.</p>') +
                '<input class="in" id="cvs" value="' + esc((o.subject && String(o.subject).trim()) || d.def.subject) + '" placeholder="Тема письма"><textarea class="in" id="cvt" style="min-height:260px;margin-top:10px">' + esc(o.draft_letter || o.letter || d.def.text) + '</textarea>' +
                '<div class="acts"><button class="btn gold sm" id="cvgo">Отправить клиенту на подтверждение</button>' + (o.cover_ok ? "" : '<button class="btn sm line" id="cvskip" style="color:var(--deep);border-color:#9fb6bb">Запустить без подтверждения (стандартное письмо)</button>') + '</div>' :
                '<p class="mut">У заказа нет рассылки: напишите письмо и отправьте клиенту файлом через блок «Переписка и история» → «Письмо клиенту».</p>') + '</div>';
            if(cv && ["paid", "in_progress", "done"].indexOf(o.status) >= 0) h += '<div class="panel"><h3>Готовое резюме</h3>' + (o.res_name ? '<p>Загружено: <a href="/crm/api/orders/' + o.id + '/res">' + esc(o.res_name) + "</a></p>" : "<p class=\"mut\">Файл ещё не загружен.</p>") +
                '<input type="file" id="resf" class="in"><div class="acts"><button class="btn gold sm" id="resgo">Загрузить и отправить клиенту</button></div></div>';
            if(d.jobs.length) h += '<div class="panel"><h3>Рассылки</h3><table class="t"><thead><tr><th>№</th><th>Статус</th><th>Старт</th><th>Отправлено</th><th>Ошибок</th><th>Осталось</th><th></th></tr></thead><tbody>' +
                d.jobs.map(function(j){ return "<tr><td>" + j.m + "</td><td>" + esc(JST[j.status] || j.status) + (j.last_error ? '<br><span class="mut" style="color:#c0392b">' + esc(j.last_error) + "</span>" : "") + "</td><td>" + dt(j.start_at) + "</td><td>" + j.sent + " / " + j.total + "</td><td>" + j.failed + "</td><td>" + j.wait + '</td><td style="white-space:nowrap">' +
                    (["run", "wait"].indexOf(j.status) >= 0 ? '<button class="btn sm line jc" style="color:var(--deep);border-color:#9fb6bb" data-j="' + j.id + '" data-a="pause">Пауза</button> ' : "") +
                    (j.status === "pause" ? '<button class="btn sm gold jc" data-j="' + j.id + '" data-a="resume">Продолжить</button> ' : "") +
                    (j.failed > 0 ? '<button class="btn sm line jc" style="color:var(--deep);border-color:#9fb6bb" data-j="' + j.id + '" data-a="retry">Повторить ошибки</button> ' : "") +
                    (["run", "wait", "pause"].indexOf(j.status) >= 0 ? '<button class="btn sm red jc" data-j="' + j.id + '" data-a="stop">Стоп</button>' : "") + "</td></tr>"; }).join("") + "</tbody></table>" +
                (d.boxes.length ? '<p class="mut" style="margin-top:10px">Ящики: ' + d.boxes.map(function(b){ return esc(b.email) + " (" + b.sent + (b.active ? "" : ", выкл") + (b.deleted_at ? ", удалён" : "") + ")"; }).join("; ") + "</p>" : "") + "</div>";
            var D = d.details, DL = {linkedin: "LinkedIn", messengers: "Мессенджеры", location: "Местонахождение", dob: "Дата рождения", english: "Английский", minSalary: "Мин. зарплата, USD", school: "Учебное заведение", vesselExp: "Опыт на судах", engines: "Двигатели", eyes: "Глаза", height: "Рост, см", weight: "Вес, кг", overall: "Размер робы", shoe: "Размер обуви", nokName: "Родственник", nokRel: "Кем приходится", nokPhone: "Тел. родственника"};
            if(D) h += '<div class="panel"><h3>Анкета для резюме</h3><div class="kv">' + Object.keys(DL).filter(function(k){ return D[k] && D[k].length; }).map(function(k){ return "<b>" + DL[k] + "</b><span>" + esc(Array.isArray(D[k]) ? D[k].join(", ") : D[k]) + "</span>"; }).join("") + "</div></div>";
            if(d.docs && d.docs.length) h += '<div class="panel"><h3>Документы клиента (' + d.docs.length + ')</h3>' + d.docs.map(function(f){ return '<p style="margin:4px 0"><a href="/crm/api/orders/' + o.id + '/doc/' + f.id + '">' + esc(f.name) + '</a> <span class="mut">' + Math.round(f.size / 1024) + " КБ</span></p>"; }).join("") + "</div>";
            if(d.replies && d.replies.length) h += '<div class="panel"><h3>Ответы компаний (' + d.replies.length + ')</h3>' + d.replies.map(function(r){ return '<div style="margin:8px 0;padding:10px 12px;border-radius:10px;background:#f3f6f7"><span class="mut">' + dt(r.at) + " · " + esc(r.from_name || "") + " &lt;" + esc(r.from_email) + "&gt;" + (r.kind === "auto" ? " · автоответ" : "") + "</span><br><b>" + esc(r.subject || "(без темы)") + '</b><div class="pre" style="margin-top:4px">' + esc(r.text) + "</div></div>"; }).join("") + "</div>";
            if(d.sent && d.sent.length) h += '<div class="panel"><h3>Кому что отправлено (' + d.sent.length + (d.sent.length >= 1000 ? "+" : "") + ')</h3><p><a href="/crm/api/orders/' + o.id + '/sent.csv">⬇ Скачать полный список (CSV)</a></p><div style="max-height:360px;overflow:auto"><table class="t"><thead><tr><th>№</th><th>Время</th><th>Компания</th><th>Страна</th><th>E-mail</th><th>Статус</th></tr></thead><tbody>' +
                d.sent.slice(0, 400).map(function(s){ return "<tr><td>" + s.m + "</td><td>" + dt(s.sent_at) + "</td><td>" + esc(s.company || "—") + "</td><td>" + esc(s.country || "") + "</td><td>" + esc(s.email) + "</td><td>" + (s.status === "sent" ? "✅" : '<span style="color:#c0392b" title="' + esc(s.error || "") + '">❌ ошибка</span>') + "</td></tr>"; }).join("") + "</tbody></table></div></div>";
            h += '<div class="panel"><h3>Переписка и история</h3><div style="margin-bottom:14px"><p class="mut" style="margin:0 0 6px">Письмо клиенту (уйдёт на ' + esc(o.email) + ' и появится в истории)</p><input class="in" id="rps" placeholder="Тема (необязательно)" style="margin-bottom:8px"><textarea class="in" id="rp" placeholder="Текст письма" style="min-height:100px"></textarea><input type="file" id="rpf" class="in" style="margin-top:8px"><p class="mut" style="margin:4px 0 0">Файл можно приложить (до 8 МБ) — он придёт вложением. Письмо уходит в фирменном оформлении Vreise.ru.</p><div class="acts"><button class="btn gold sm" id="rpgo">Отправить письмо клиенту</button></div></div><div style="display:flex;gap:8px;margin-bottom:12px"><input class="in" id="nt" placeholder="Внутренняя заметка (клиент не видит)"><button class="btn sm line" style="color:var(--deep);border-color:#9fb6bb" id="ntgo">Заметка</button></div>' +
                d.notes.map(function(n){ var chat = n.author === "Сообщение клиента" || n.author === "Ответ менеджера"; return '<p style="font-size:14px;margin:6px 0' + (chat ? ";padding:8px 10px;border-radius:10px;background:" + (n.author === "Ответ менеджера" ? "#e9f6f3" : "#fff3cd") : "") + '"><span class="mut">' + dt(n.at) + " · " + esc(n.author) + "</span><br>" + esc(n.text) + "</p>"; }).join("") + "</div>";
            view.innerHTML = h;
            var $ = function(i){ return document.getElementById(i); }, post = function(p, body, msg){
                if(msg && !confirm(msg)) return; return api(p, {body: body || {}}).then(function(){ order(id); }).catch(alertErr); };
            $("back").onclick = function(e){ e.preventDefault(); orders(); };
            if($("confirm")) $("confirm").onclick = function(){ post("/orders/" + id + "/confirm", {}, "Деньги на карте? Подтвердить оплату заказа №" + o.num + " и запустить работу?"); };
            if($("delorder")) $("delorder").onclick = function(){ delOrder(id, o.num, function(){ orders(); }); };
            if($("cancel")) $("cancel").onclick = function(){ post("/orders/" + id + "/cancel", {}, "Отменить заказ №" + o.num + "? Рассылки будут остановлены."); };
            if($("emok")) $("emok").onclick = function(){ post("/orders/" + id + "/email-ok", {}, "Отметить e-mail клиента подтверждённым вручную?"); };
            if($("cvgo")) $("cvgo").onclick = function(){
                if(!confirm("Отправить письмо клиенту на подтверждение? Рассылка начнётся после его «Подтвердить».")) return;
                api("/orders/" + id + "/cover-letter", {body: {subject: $("cvs").value, text: $("cvt").value}}).then(function(){ order(id); }).catch(alertErr);
            };
            if($("resskip")) $("resskip").onclick = function(){ post("/orders/" + id + "/res-skip", {}, "Запустить рассылку без подтверждения резюме клиентом?"); };
            if($("cvskip")) $("cvskip").onclick = function(){ post("/orders/" + id + "/cover-skip", {}, "Снять ожидание и запустить рассылку со стандартным письмом, без подтверждения клиента?"); };
            $("ntgo").onclick = function(){ if($("nt").value.trim()) post("/orders/" + id + "/note", {text: $("nt").value}); };
            $("rpgo").onclick = function(){
                if(!$("rp").value.trim()) return alert("Напишите текст письма");
                if(!confirm("Отправить письмо клиенту на " + o.email + "?")) return;
                var f = $("rpf").files[0]; $("rpgo").disabled = true;
                (f ? readFile(f) : Promise.resolve(null)).then(function(fl){ return api("/orders/" + id + "/reply", {body: {subject: $("rps").value, text: $("rp").value, file: fl}}); })
                    .then(function(){ order(id); alert("Письмо отправлено клиенту"); }).catch(function(e){ $("rpgo").disabled = false; alertErr(e); });
            };
            [].forEach.call(view.querySelectorAll(".jc"), function(b){ b.onclick = function(){ post("/jobs/" + b.getAttribute("data-j") + "/" + b.getAttribute("data-a"), {}, b.getAttribute("data-a") === "stop" ? "Остановить рассылку? Продолжить её будет нельзя." : ""); }; });
            if($("resgo")) $("resgo").onclick = function(){
                var f = $("resf").files[0]; if(!f) return alert("Выберите файл");
                readFile(f).then(function(fl){ return post("/orders/" + id + "/result", fl, "Отправить клиенту письмо «Резюме готово»?"); }).catch(alertErr);
            };
        }).catch(alertErr);
    }

    /* ---------- базы ---------- */
    function bases(){
        api("/bases").then(function(d){
            view.innerHTML = '<div class="panel"><h3>Адреса в базах · всего ' + d.total + "</h3><table class=\"t\"><tbody>" + d.bases.map(function(b){ return "<tr><td>" + esc(b.name) + "</td><td><b>" + (d.byBase[b.key] || 0) + "</b></td></tr>"; }).join("") + "</tbody></table>" +
                '<p class="mut" style="margin-top:10px">Рассылка идёт только по адресам из этих баз. Адреса хранятся в базе данных, не в репозитории.</p></div>' +
                '<div class="panel"><h3>Загрузить адреса</h3><p class="mut" style="margin-bottom:12px">Подойдёт список e-mail (по одному в строке, можно «email,компания») или CSV с колонками email, company, country, fleets, bases. Если в файле нет колонки bases — выберите базу, в которую добавить.</p>' +
                '<label class="f">Добавить в базу<select class="in" id="bs"><option value="">— по колонке bases из файла —</option>' + d.bases.map(function(b){ return '<option value="' + b.key + '">' + esc(b.name) + "</option>"; }).join("") + "</select></label>" +
                '<div style="margin-top:14px"><label class="f">Файл CSV / TXT<input class="in" type="file" id="bf" accept=".csv,.txt,text/csv,text/plain"></label></div>' +
                '<div style="margin-top:14px"><label class="f">…или вставьте список<textarea class="in" id="bt" style="min-height:120px"></textarea></label></div>' +
                '<div class="acts"><button class="btn gold sm" id="bgo">Загрузить</button></div><p id="bmsg" class="mut" style="margin-top:10px"></p></div>' +
                '<div class="panel"><h3>База «Россия»</h3><p class="mut">Адреса на .ru, .su, .рф, компании из России (страна) и с российскими номерами (+7 / 8 в колонке phone) попадают в базу «Россия» сами при загрузке. Эта кнопка добавит в «Россию» уже загруженные адреса.</p><div class="acts"><button class="btn sm" id="rurs">Добавить российские адреса в базу «Россия»</button></div><p id="rumsg" class="mut" style="margin-top:10px"></p></div>' +
                '<div class="panel"><h3>Очистить все базы</h3><p class="mut">Удалит все адреса. Введите слово «очистить».</p><div style="display:flex;gap:8px;margin-top:10px"><input class="in" id="cc" style="max-width:200px"><button class="btn sm red" id="cgo">Очистить</button></div></div>';
            var $ = function(i){ return document.getElementById(i); };
            $("rurs").onclick = function(){ $("rumsg").textContent = "Проверяю…"; api("/bases/ru-rescan", {body: {}}).then(function(r){ $("rumsg").textContent = "Добавлено в «Россия»: " + r.added + " (всего адресов в базах: " + r.total + ")"; }).catch(function(e){ $("rumsg").textContent = ""; alertErr(e); }); };
            $("bgo").onclick = function(){
                var f = $("bf").files[0], go = function(text){
                    if(!text.trim()) return alert("Выберите файл или вставьте список");
                    $("bgo").disabled = true; $("bmsg").textContent = "Загружаю…";
                    api("/bases/import", {body: {text: text, base: $("bs").value}}).then(function(r){ $("bmsg").textContent = "Готово: новых " + r.added + ", обновлено " + r.updated + " (строк разобрано: " + r.rows + ")"; setTimeout(bases, 1500); })
                        .catch(function(e){ $("bmsg").textContent = ""; $("bgo").disabled = false; alertErr(e); });
                };
                if(f) readText(f).then(go); else go($("bt").value);
            };
            $("cgo").onclick = function(){ api("/bases/clear", {body: {confirm: $("cc").value.trim().toLowerCase()}}).then(bases).catch(alertErr); };
        }).catch(alertErr);
    }

    /* ---------- серверы ---------- */
    function letter(){
        Promise.all([api("/letters"), api("/inbox")]).then(function(rr){
            var d = rr[0], ib = rr[1], kn = {reply: "", auto: " · автоответ", bounce: " · не доставлено"};
            view.innerHTML = '<div class="panel"><h3>Входящие' + (ib.unread ? ' <span style="background:#c0392b;color:#fff;border-radius:999px;padding:1px 9px;font-size:13px">' + ib.unread + " нов.</span>" : "") + "</h3>" +
                '<p class="mut" style="margin-top:0">Письма, которые пришли на ' + esc(ib.box || "почту сайта") + (ib.state ? " · проверено " + dt(ib.state.at) + (ib.state.error ? ' · <span style="color:#c0392b">ошибка: ' + esc(ib.state.error) + "</span>" : "") : " · проверка идёт каждые несколько минут") + ' <button class="btn sm line" id="ibr" style="margin-left:8px">Проверить сейчас</button></p>' +
                (ib.inbox.length ? ib.inbox.map(function(m){
                    var fresh = !Number(m.seen) && m.kind === "reply", who = (m.from_name ? m.from_name + " " : "") + "<" + m.from_email + ">", snip = String(m.text || "").replace(/\s+/g, " ").slice(0, 90);
                    return '<details class="ml"' + (fresh ? ' data-new="' + esc(m.id) + '"' : "") + ' style="border-top:1px solid #e3ebee"><summary style="cursor:pointer;list-style:none;padding:10px 0;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">' +
                        '<span style="min-width:150px;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (fresh ? "font-weight:bold" : "") + '">' + (fresh ? "🆕 " : "") + esc(m.from_name || m.from_email) + "</span>" +
                        '<span style="flex:1;min-width:160px;' + (fresh ? "font-weight:bold" : "") + '">' + esc(m.subject || "(без темы)") + ' <span class="mut" style="font-weight:normal">— ' + esc(snip) + "</span></span>" +
                        '<span class="mut" style="white-space:nowrap">' + dt(m.at) + (kn[m.kind] || "") + "</span></summary>" +
                        '<div style="padding:4px 0 14px"><div class="mut" style="margin-bottom:6px">' + esc(who) + '</div><div style="white-space:pre-wrap;font-size:14px;background:#f6f9fa;border-radius:10px;padding:12px 14px">' + esc(String(m.text || "").slice(0, 4000)) + "</div>" +
                        '<div class="acts">' + (m.kind === "bounce" ? "" : '<button class="btn sm gold" data-re="' + esc(m.id) + '">Ответить</button> ') + '<button class="btn sm line" data-close="1">Закрыть</button> <button class="btn sm line" style="color:#c0392b;border-color:#e3b4ae" data-del="' + esc(m.id) + '">Удалить</button></div></div></details>'; }).join("") : '<p class="mut">Пока писем нет</p>') + "</div>" +
                '<div class="panel" id="wr"><h3>Написать письмо</h3><p class="mut" style="margin-top:0">Любое письмо — тема и текст ваши, можно приложить файл. Уйдёт в фирменном оформлении Vreise.ru' + (d.from ? " от " + esc(d.from) : "") + '. Ответы придут на эту почту.</p>' +
                '<input class="in" id="lto" type="email" placeholder="Кому (e-mail)" style="margin-bottom:8px"><input class="in" id="lsu" placeholder="Тема" style="margin-bottom:8px"><textarea class="in" id="ltx" placeholder="Текст письма" style="min-height:180px"></textarea>' +
                '<input type="file" id="lfl" class="in" style="margin-top:8px"><p class="mut" style="margin:4px 0 0">Вложение — до 8 МБ.</p><div class="acts"><button class="btn gold" id="lgo">Отправить письмо</button> <span class="mut" id="lmg"></span></div></div>' +
                '<div class="panel"><h3>Отправленные письма</h3>' + (d.letters.length ? '<table class="t"><thead><tr><th>Когда</th><th>Кому</th><th>Тема</th><th>Файл</th><th></th></tr></thead><tbody>' + d.letters.map(function(l){
                    return "<tr><td>" + dt(l.at) + "</td><td>" + esc(l.to_email) + "</td><td>" + esc(l.subject) + "</td><td>" + esc(l.file_name || "") + "</td><td>" + (l.ok ? "✅" : '<span style="color:#c0392b" title="' + esc(l.error || "") + '">❌ не ушло</span>') + "</td></tr>"; }).join("") + "</tbody></table>" : '<p class="mut">Пока ничего не отправляли</p>') + "</div>";
            var $ = function(i){ return document.getElementById(i); };
            [].forEach.call(document.querySelectorAll("[data-close]"), function(b){ b.onclick = function(){ var d = b.closest("details"); d.open = false; d.scrollIntoView({block: "nearest"}); }; });
            [].forEach.call(document.querySelectorAll("[data-del]"), function(b){ b.onclick = function(){
                if(!confirm("Удалить письмо из CRM? На самой почте info@ оно останется.")) return;
                api("/inbox/delete", {body: {id: b.getAttribute("data-del")}}).then(letter).catch(alertErr); }; });
            [].forEach.call(document.querySelectorAll("details.ml > summary"), function(sm){ sm.style.outline = "none"; });
            [].forEach.call(document.querySelectorAll("details.ml[data-new]"), function(d){ d.addEventListener("toggle", function(){
                if(!d.open || !d.getAttribute("data-new")) return; var id = d.getAttribute("data-new"); d.removeAttribute("data-new");
                var s1 = d.querySelector("summary"); s1.innerHTML = s1.innerHTML.replace(/🆕 /, "").replace(/font-weight:\s*bold/g, ""); [].forEach.call(s1.querySelectorAll("span"), function(x){ x.style.fontWeight = "normal"; });
                api("/inbox/read", {body: {id: id}}).catch(function(){}); }); });
            $("ibr").onclick = function(){ $("ibr").disabled = true; $("ibr").textContent = "Проверяю…"; api("/inbox/refresh", {body: {}}).then(letter).catch(function(e){ alertErr(e); letter(); }); };
            [].forEach.call(document.querySelectorAll("[data-re]"), function(b){ b.onclick = function(){
                var m = ib.inbox.filter(function(x){ return x.id === b.getAttribute("data-re"); })[0]; if(!m) return;
                $("lto").value = m.from_email; $("lsu").value = /^re:/i.test(m.subject || "") ? m.subject : "Re: " + (m.subject || "");
                $("ltx").value = "\n\n— — —\n" + String(m.text || "").split("\n").map(function(l){ return "> " + l; }).join("\n").slice(0, 1500);
                $("wr").scrollIntoView({behavior: "smooth"}); $("ltx").focus(); $("ltx").setSelectionRange(0, 0); }; });
            $("lgo").onclick = function(){
                if(!$("lto").value.trim() || !$("lsu").value.trim() || !$("ltx").value.trim()) return alert("Заполните: кому, тему и текст письма");
                if(!confirm("Отправить письмо на " + $("lto").value.trim() + "?")) return;
                var f = $("lfl").files[0]; $("lgo").disabled = true; $("lmg").textContent = "Отправляю…";
                (f ? readFile(f) : Promise.resolve(null)).then(function(fl){ return api("/letter", {body: {to: $("lto").value, subject: $("lsu").value, text: $("ltx").value, file: fl}}); })
                    .then(function(){ alert("Письмо отправлено"); letter(); }).catch(function(e){ $("lgo").disabled = false; $("lmg").textContent = ""; alertErr(e); });
            };
        }).catch(alertErr);
    }
    function servers(){
        api("/servers").then(function(d){
            var yes = function(b){ return b ? "✅" : "⚠️ не задано"; };
            view.innerHTML = '<div class="panel"><h3>Серверы рассылки (Hestia)</h3>' + (d.servers.length ? '<table class="t"><thead><tr><th>Домен</th><th>SMTP</th><th>Ящиков</th><th></th></tr></thead><tbody>' + d.servers.map(function(s){ return "<tr><td>" + esc(s.domain) + "</td><td>" + esc(s.host) + ":" + s.port + "</td><td>" + s.boxes + "</td><td>" + (s.skipped ? "не используется" : "в работе") + "</td></tr>"; }).join("") + "</tbody></table>" : '<div class="err">Серверы не подключены: добавьте HESTIA_1_URL / KEY / USER / DOMAIN в Railway.</div>') +
                '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><input class="in" id="tt" placeholder="Ваш e-mail для теста" style="max-width:280px"><button class="btn gold sm" id="tgo">Тест всех серверов рассылки</button><button class="btn sm line" style="color:var(--deep);border-color:#9fb6bb" id="tsys">Тест системной почты</button></div><p id="tmsg" class="mut" style="margin-top:10px"></p></div>' +
                '<div class="panel"><h3>Настройки</h3><div class="kv"><b>Системная почта</b><span>' + yes(d.system) + " (SYS_SMTP_*)</span><b>Почта владельца</b><span>" + yes(d.owner) + " (OWNER_EMAIL)</span><b>Карта для оплаты</b><span>" + yes(d.pay) + " (PAY_CARD)</span><b>Телефон</b><span>" + yes(d.phone) + " (CONTACT_PHONE)</span><b>Пауза между письмами</b><span>" + d.gap + " с (SEND_GAP_SEC)</span></div></div>";
            var TPL = [["confirm", "Подтверждение e-mail (рассылка)"], ["confirm_cv", "Подтверждение e-mail (резюме)"], ["paid", "Оплата получена (рассылка)"], ["paid_cv", "Оплата получена (резюме)"], ["preview", "Как будет выглядеть рассылка"],
                ["coverDraft", "Персональное письмо готово — подтвердите"], ["started", "Рассылка началась"], ["finished", "Рассылка завершена"], ["newReplies", "Пришёл ответ компании"], ["reply", "Ответ менеджера"], ["cvReady_cv", "Резюме готово"], ["owner_order", "Вам: новый заказ (полное уведомление)"]];
            view.insertAdjacentHTML("beforeend", '<div class="panel"><h3>Тест писем клиенту</h3><p class="mut" style="margin-top:0">Отправит выбранное письмо на ваш адрес — так, как его получает клиент. Номер заказа не обязателен: без него берутся примерные данные.</p>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap"><select class="in" id="mtpl" style="max-width:340px">' + TPL.map(function(t){ return '<option value="' + t[0] + '">' + esc(t[1]) + "</option>"; }).join("") + '</select><input class="in" id="mto" type="email" placeholder="Куда отправить" style="max-width:260px"><input class="in" id="mnum" placeholder="№ заказа (по желанию)" style="max-width:190px"><button class="btn gold sm" id="mgo">Отправить тест</button></div><p id="mmsg" class="mut" style="margin-top:10px"></p></div>');
            document.getElementById("mgo").onclick = function(){ var m = document.getElementById("mmsg"); m.textContent = "Отправляю…";
                api("/mail-test", {body: {tpl: document.getElementById("mtpl").value, to: document.getElementById("mto").value, num: document.getElementById("mnum").value}}).then(function(r){ m.textContent = "✅ Отправлено" + (r.demo ? " (на примерных данных)" : "") + " — проверьте почту"; }).catch(function(e){ m.textContent = "❌ " + e.message; }); };
            var $ = function(i){ return document.getElementById(i); }, run = function(path, label){
                $("tmsg").textContent = "Отправляю…";
                api(path, {body: {to: $("tt").value}}).then(function(r){ $("tmsg").textContent = "✅ " + label + (r.domain ? " (" + r.domain + ")" : "") + " — проверьте почту"; }).catch(function(e){ $("tmsg").textContent = (/^✅|^❌/.test(e.message) ? "" : "❌ ") + e.message; });
            };
            $("tgo").onclick = function(){ run("/servers/test", "Тест пройден, писем придёт по одному с каждого сервера"); };
            $("tsys").onclick = function(){ run("/servers/test-system", "Системное письмо отправлено"); };
        }).catch(alertErr);
    }


    /* ---------- чаты с моряками ---------- */
    var chatSid = "", chatView = "chats", cQ = "";
    function csvCell(v){ v = String(v == null ? "" : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    function contactsTab(){
        api("/chats/contacts").then(function(d){
            var all = d.contacts, qq = cQ.toLowerCase(), rows = all.filter(function(c){ return !qq || (c.email + " " + (c.name || "")).toLowerCase().indexOf(qq) >= 0; });
            view.innerHTML = chatSwitch() + '<div class="panel"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><input class="in" id="cq" placeholder="Поиск по имени или e-mail" value="' + esc(cQ) + '" style="max-width:320px"><span class="mut">Всего: ' + all.length + (qq ? " · найдено " + rows.length : "") + '</span><button class="btn gold sm" id="ccsv" type="button">⬇ Excel (CSV)</button></div>' +
                (rows.length ? '<div style="overflow:auto"><table class="t"><thead><tr><th>Имя</th><th>E-mail</th><th>Первое обращение</th><th>Последнее</th><th>Чатов</th><th>Сообщ.</th><th></th></tr></thead><tbody>' + rows.map(function(c, i){ return '<tr><td><b>' + esc(c.name || "—") + '</b></td><td>' + esc(c.email) + '</td><td>' + dt(c.first_at) + '</td><td>' + dt(c.last_at) + '</td><td>' + c.chats + '</td><td>' + c.msgs + '</td><td style="white-space:nowrap"><button class="btn sm" data-o="' + i + '" type="button">Открыть чат</button> <button class="btn sm" data-d="' + i + '" type="button" title="Удалить из списка">🗑</button></td></tr>'; }).join("") + '</tbody></table></div>' : '<p class="mut">Контактов пока нет: имя и e-mail попадают сюда, когда моряк пишет в чат.</p>') + '</div>';
            bindSwitch();
            var qi = document.getElementById("cq"); qi.oninput = function(){ cQ = qi.value; clearTimeout(contactsTab.t); contactsTab.t = setTimeout(function(){ contactsTab(); var n = document.getElementById("cq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); };
            [].forEach.call(view.querySelectorAll("[data-o]"), function(b){ b.onclick = function(){ chatSid = rows[+b.getAttribute("data-o")].last_sid || ""; chatView = "chats"; chatsTab(); }; });
            [].forEach.call(view.querySelectorAll("[data-d]"), function(b){ b.onclick = function(){ var c = rows[+b.getAttribute("data-d")]; if(confirm("Удалить контакт " + c.email + " из списка? Сами чаты останутся.")) api("/chats/contacts/delete", {body: {email: c.email}}).then(contactsTab).catch(alertErr); }; });
            document.getElementById("ccsv").onclick = function(){
                var csv = ["Имя;E-mail;Первое обращение;Последнее обращение;Чатов;Сообщений"].concat(all.map(function(c){ return [c.name, c.email, c.first_at, c.last_at, c.chats, c.msgs].map(csvCell).join(";"); })).join("\r\n");
                var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], {type: "text/csv;charset=utf-8"})); a.download = "kontakty-chat-vreise-" + new Date().toISOString().slice(0, 10) + ".csv"; a.click();
            };
        }).catch(alertErr);
    }
    function chatSwitch(){ return '<div style="display:flex;gap:8px;margin-bottom:12px"><button class="btn sm' + (chatView === "chats" ? " gold" : "") + '" data-cv="chats" type="button">💬 Чаты</button><button class="btn sm' + (chatView === "contacts" ? " gold" : "") + '" data-cv="contacts" type="button">👥 Контакты (имя и e-mail)</button></div>'; }
    function bindSwitch(){ [].forEach.call(view.querySelectorAll("[data-cv]"), function(b){ b.onclick = function(){ chatView = b.getAttribute("data-cv"); chatView === "contacts" ? contactsTab() : chatsTab(); }; }); }
    function chatsTab(){
        if(chatView === "contacts") return contactsTab();
        api("/chats").then(function(d){
            view.innerHTML = chatSwitch() + '<div class="chs"><div class="chl">' + (d.chats.length ? d.chats.map(function(c){ return '<div class="chi' + (c.sid === chatSid ? " on" : "") + (c.last_who === "user" ? " w" : "") + '" data-s="' + c.sid + '"><b>' + esc(c.name || "#" + c.sid.slice(0, 8)) + " · " + dt(c.last_at) + (c.status === "closed" ? " · ✅ закрыт" : c.last_who === "user" ? " · ждёт ответа" : "") + "</b><span>" + esc((c.last_who === "user" ? "" : c.last_who === "admin" ? "Вы: " : "") + c.last_text) + "</span></div>"; }).join("") : '<div class="mut" style="padding:14px">Чатов пока нет</div>') + '</div><div class="panel" id="chv"><p class="mut">Выберите чат слева</p></div></div>';
            bindSwitch();
            [].forEach.call(view.querySelectorAll(".chi"), function(r){ r.onclick = function(){ chatSid = r.getAttribute("data-s"); chatsTab(); }; });
            if(!chatSid) return;
            api("/chats/" + chatSid).then(function(m){
                var v = document.getElementById("chv"); if(!v) return;
                var inf = m.info || {};
                v.innerHTML = '<h3>' + esc(inf.name || "Чат #" + chatSid.slice(0, 8)) + (inf.email ? ' · <a href="mailto:' + esc(inf.email) + '">' + esc(inf.email) + "</a>" : "") + (inf.status === "closed" ? ' <span class="mut">· чат закрыт</span>' : "") + '</h3>' + (inf.status === "closed" ? "" : '<p><button class="btn sm" id="chx" type="button">✅ Спасибо за обращение — закрыть чат</button></p>') + '<div class="cht" id="cht">' + m.msgs.map(function(x){ return x.who === "system" ? '<div class="cms">' + esc(x.text) + "</div>" : '<div class="' + (x.who === "user" ? "cmu" : "cma") + '">' + esc(x.text) + '<span class="cmt">' + (x.who === "user" ? "Моряк" : "Вы") + " · " + dt(x.at) + "</span></div>"; }).join("") + '</div><form id="chf" style="display:flex;gap:8px;margin-top:10px"><textarea class="in" id="cht2" rows="2" maxlength="1500" placeholder="Ответ моряку — он увидит его в чате на сайте" style="flex:1"></textarea><button class="btn gold" type="submit">Ответить</button></form>';
                var t = document.getElementById("cht"); t.scrollTop = t.scrollHeight;
                var cx = document.getElementById("chx"); if(cx) cx.onclick = function(){ if(confirm("Отправить моряку «Спасибо за ваше обращение! Данный чат закрыт.» и закрыть чат? Если он напишет снова, чат откроется.")) api("/chats/" + chatSid + "/close", {body: {}}).then(chatsTab).catch(alertErr); };
                document.getElementById("chf").onsubmit = function(e){ e.preventDefault(); var x = document.getElementById("cht2").value.trim(); if(!x) return; api("/chats/" + chatSid + "/reply", {body: {text: x}}).then(chatsTab).catch(alertErr); };
            }).catch(alertErr);
        }).catch(alertErr);
    }

    /* ---------- ящики рассылки ---------- */
    function boxesTab(){
        api("/boxes").then(function(d){
            var ST = {working: ["🟢 работает", "ok"], paused: ["⏸ рассылка на паузе", "warn"], ending: ["🕓 доживает срок", "warn"], deleted: ["удалён", ""]};
            view.innerHTML = '<div class="panel"><h3>Ящики рассылки · сейчас живых: ' + d.live + "</h3>" +
                '<p class="mut" style="margin-top:0">Ящик создаётся при старте каждой рассылки (на каждом сервере по одному) и удаляется через ' + d.hours + " ч после её окончания или отмены. Пока рассылка на паузе, ящики остаются — она считается незавершённой.</p>" +
                (d.boxes.length ? '<div style="overflow:auto"><table class="t"><thead><tr><th>Ящик</th><th>Сервер</th><th>Заказ</th><th>Создан</th><th>Отправлено</th><th>Статус</th><th>Удалится</th></tr></thead><tbody>' +
                d.boxes.map(function(b){ var st = ST[b.state] || ["", ""];
                    return "<tr><td>" + esc(b.email) + (b.last_error ? '<br><span class="mut" style="color:#c0392b">' + esc(b.last_error) + "</span>" : "") + "</td><td>" + esc(b.domain) + "</td><td>" + (b.num ? "№" + b.num + " · " + esc((b.first_name || "") + " " + (b.last_name || "")) + (b.m ? " · рассылка " + b.m : "") : "—") + "</td><td>" + dt(b.created_at) + "</td><td>" + b.sent + "</td><td>" + st[0] + (Number(b.active) ? "" : " · выкл") + "</td><td>" +
                    (b.deleted_at ? "удалён " + dt(b.deleted_at) : b.delete_at ? dt(b.delete_at) : "через " + d.hours + " ч после окончания") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="mut">Ящиков пока нет — они появятся при старте первой рассылки.</p>') + "</div>";
        }).catch(alertErr);
    }

    function show(){ ({orders: orders, chats: chatsTab, boxes: boxesTab, bases: bases, letter: letter, servers: servers})[tab](); }
    [].forEach.call(document.querySelectorAll("#tabs button"), function(b){ b.onclick = function(){
        tab = b.getAttribute("data-t"); [].forEach.call(document.querySelectorAll("#tabs button"), function(x){ x.classList.toggle("on", x === b); }); show(); }; });
    show();
    setInterval(function(){ if(tab === "chats" && chatView === "chats" && document.activeElement && document.activeElement.tagName !== "TEXTAREA") chatsTab(); }, 20000);
    setInterval(function(){ if(tab === "orders" && document.activeElement && document.activeElement.id !== "q" && view.querySelector(".flt")) orders(); }, 60000);
})();
