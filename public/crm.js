/* CRM Vreise.ru */
(function(){
    var view = document.getElementById("view"), tab = "orders", filter = "", search = "";
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
        api("/orders?status=" + encodeURIComponent(filter) + "&q=" + encodeURIComponent(search)).then(function(d){
            var s = d.summary, fl = [["", "Все"]].concat(Object.keys(ST).map(function(k){ return [k, ST[k] + (s[k] ? " · " + s[k] : "")]; }));
            view.innerHTML = '<div class="flt">' + fl.map(function(f){ return '<button data-f="' + f[0] + '"' + (f[0] === filter ? ' class="on"' : "") + ">" + esc(f[1]) + "</button>"; }).join("") +
                '<input class="in" id="q" placeholder="Поиск: №, имя, e-mail" style="max-width:260px;padding:7px 12px" value="' + esc(search) + '"></div>' +
                '<div class="panel" style="padding:8px 14px;overflow:auto"><table class="t"><thead><tr><th>№</th><th>Дата</th><th>Услуга</th><th>Клиент</th><th>Сумма</th><th>Рассылка</th><th>Статус</th></tr></thead><tbody>' +
                (d.orders.length ? d.orders.map(function(o){ return '<tr class="click" data-id="' + o.id + '"><td><b>' + o.num + "</b></td><td>" + dt(o.created_at) + "</td><td>" + esc(o.title) + "</td><td>" + esc(o.first_name + " " + o.last_name) + '<br><span class="mut">' + esc(o.email) + '</span></td><td>' + rub(o.price) + '</td><td>' + (o.total ? o.sent + ' / ' + o.total + (o.failed ? ' <span class="mut">(ош. ' + o.failed + ')</span>' : '') : '<span class="mut">—</span>') + (o.email_ok ? '' : '<br><span class="mut" title="e-mail не подтверждён">⚠️ почта</span>') + '</td><td><span class="tag ' + o.status + '">' + esc(ST[o.status] || o.status) + "</span></td></tr>"; }).join("") : '<tr><td colspan="7" class="mut">Заказов пока нет</td></tr>') + "</tbody></table></div>";
            [].forEach.call(view.querySelectorAll("[data-f]"), function(b){ b.onclick = function(){ filter = b.getAttribute("data-f"); orders(); }; });
            [].forEach.call(view.querySelectorAll("tr.click"), function(r){ r.onclick = function(){ order(r.getAttribute("data-id")); }; });
            var q = document.getElementById("q"); q.onkeydown = function(e){ if(e.key === "Enter"){ search = q.value; orders(); } };
        }).catch(alertErr);
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
                (["done", "cancelled"].indexOf(o.status) < 0 ? '<button class="btn sm red" id="cancel">Отменить заказ</button>' : "") + "</div></div>";
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
            if($("cancel")) $("cancel").onclick = function(){ post("/orders/" + id + "/cancel", {}, "Отменить заказ №" + o.num + "? Рассылки будут остановлены."); };
            if($("emok")) $("emok").onclick = function(){ post("/orders/" + id + "/email-ok", {}, "Отметить e-mail клиента подтверждённым вручную?"); };
            if($("cvgo")) $("cvgo").onclick = function(){
                if(!confirm("Отправить письмо клиенту на подтверждение? Рассылка начнётся после его «Подтвердить».")) return;
                api("/orders/" + id + "/cover-letter", {body: {subject: $("cvs").value, text: $("cvt").value}}).then(function(){ order(id); }).catch(alertErr);
            };
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
        api("/letters").then(function(d){
            view.innerHTML = '<div class="panel"><h3>Написать письмо</h3><p class="mut" style="margin-top:0">Любое письмо — тема и текст ваши, можно приложить файл. Уйдёт в фирменном оформлении Vreise.ru' + (d.from ? " от " + esc(d.from) : "") + '. Ответы придут на эту почту.</p>' +
                '<input class="in" id="lto" type="email" placeholder="Кому (e-mail)" style="margin-bottom:8px"><input class="in" id="lsu" placeholder="Тема" style="margin-bottom:8px"><textarea class="in" id="ltx" placeholder="Текст письма" style="min-height:180px"></textarea>' +
                '<input type="file" id="lfl" class="in" style="margin-top:8px"><p class="mut" style="margin:4px 0 0">Вложение — до 8 МБ.</p><div class="acts"><button class="btn gold" id="lgo">Отправить письмо</button> <span class="mut" id="lmg"></span></div></div>' +
                '<div class="panel"><h3>Отправленные письма</h3>' + (d.letters.length ? '<table class="t"><thead><tr><th>Когда</th><th>Кому</th><th>Тема</th><th>Файл</th><th></th></tr></thead><tbody>' + d.letters.map(function(l){
                    return "<tr><td>" + dt(l.at) + "</td><td>" + esc(l.to_email) + "</td><td>" + esc(l.subject) + "</td><td>" + esc(l.file_name || "") + "</td><td>" + (l.ok ? "✅" : '<span style="color:#c0392b" title="' + esc(l.error || "") + '">❌ не ушло</span>') + "</td></tr>"; }).join("") + "</tbody></table>" : '<p class="mut">Пока ничего не отправляли</p>') + "</div>";
            var $ = function(i){ return document.getElementById(i); };
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
                '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><input class="in" id="tt" placeholder="Ваш e-mail для теста" style="max-width:280px"><button class="btn gold sm" id="tgo">Тест рассылочного сервера</button><button class="btn sm line" style="color:var(--deep);border-color:#9fb6bb" id="tsys">Тест системной почты</button></div><p id="tmsg" class="mut" style="margin-top:10px"></p></div>' +
                '<div class="panel"><h3>Настройки</h3><div class="kv"><b>Системная почта</b><span>' + yes(d.system) + " (SYS_SMTP_*)</span><b>Почта владельца</b><span>" + yes(d.owner) + " (OWNER_EMAIL)</span><b>Карта для оплаты</b><span>" + yes(d.pay) + " (PAY_CARD)</span><b>Телефон</b><span>" + yes(d.phone) + " (CONTACT_PHONE)</span><b>Пауза между письмами</b><span>" + d.gap + " с (SEND_GAP_SEC)</span></div></div>";
            var $ = function(i){ return document.getElementById(i); }, run = function(path, label){
                $("tmsg").textContent = "Отправляю…";
                api(path, {body: {to: $("tt").value}}).then(function(r){ $("tmsg").textContent = "✅ " + label + (r.domain ? " (" + r.domain + ")" : "") + " — проверьте почту"; }).catch(function(e){ $("tmsg").textContent = "❌ " + e.message; });
            };
            $("tgo").onclick = function(){ run("/servers/test", "Тестовое письмо отправлено"); };
            $("tsys").onclick = function(){ run("/servers/test-system", "Системное письмо отправлено"); };
        }).catch(alertErr);
    }

    function show(){ ({orders: orders, bases: bases, letter: letter, servers: servers})[tab](); }
    [].forEach.call(document.querySelectorAll("#tabs button"), function(b){ b.onclick = function(){
        tab = b.getAttribute("data-t"); [].forEach.call(document.querySelectorAll("#tabs button"), function(x){ x.classList.toggle("on", x === b); }); show(); }; });
    show();
    setInterval(function(){ if(tab === "orders" && document.activeElement && document.activeElement.id !== "q" && view.querySelector(".flt")) orders(); }, 60000);
})();
