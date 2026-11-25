/* Главная: переключатель 1 / 2 / 3 рассылки на таблице цен */
(function(){
    var rows = [].slice.call(document.querySelectorAll("#board .pc"));
    var btns = [].slice.call(document.querySelectorAll("#board .seg button"));
    var slugs = {1: "rassylka-1-", 2: "rassylka-2-", 3: "rassylka-3-"};
    function fmt(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }
    function setN(n){
        btns.forEach(function(b){ b.classList.toggle("on", Number(b.getAttribute("data-n")) === n); });
        rows.forEach(function(r){
            var p = (r.getAttribute("data-p") || "").split(",");
            r.querySelector("[data-price]").textContent = fmt(Number(p[n - 1]));
            r.querySelector("[data-order]").setAttribute("href", "/order?s=" + slugs[n] + r.getAttribute("data-b"));
        });
    }
    btns.forEach(function(b){ b.addEventListener("click", function(){ setN(Number(b.getAttribute("data-n"))); }); });
})();
