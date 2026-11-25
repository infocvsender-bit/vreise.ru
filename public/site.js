/* Главная: у каждой карточки свой переключатель 1 / 2 / 3 рассылки — меняет цену и ссылку «Заказать» только в этой карточке */
(function(){
    var slugs = {1: "rassylka-1-", 2: "rassylka-2-", 3: "rassylka-3-"}, words = {1: "за 1 рассылку", 2: "за 2 рассылки", 3: "за 3 рассылки"};
    function fmt(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }
    [].forEach.call(document.querySelectorAll("#board .pc"), function(card){
        var btns = [].slice.call(card.querySelectorAll(".pc-seg button")), p = (card.getAttribute("data-p") || "").split(",");
        function setN(n){
            btns.forEach(function(b){ b.classList.toggle("on", Number(b.getAttribute("data-n")) === n); });
            card.querySelector("[data-price]").textContent = fmt(Number(p[n - 1]));
            card.querySelector("[data-note]").textContent = words[n];
            var full = Number(p[0]) * n, now = Number(p[n - 1]), old = card.querySelector("[data-old]"), save = card.querySelector("[data-save]");   // «было» — столько стоили бы n отдельных рассылок
            if(n > 1 && full > now){ old.hidden = false; old.textContent = fmt(full); save.hidden = false; save.textContent = "Выгоднее на " + fmt(full - now) + " (−" + Math.round((full - now) / full * 100) + "%)"; }
            else { old.hidden = true; save.hidden = true; }
            card.querySelector("[data-order]").setAttribute("href", "/order?s=" + slugs[n] + card.getAttribute("data-b"));
        }
        btns.forEach(function(b){ b.addEventListener("click", function(){ setN(Number(b.getAttribute("data-n"))); }); });
    });
})();
