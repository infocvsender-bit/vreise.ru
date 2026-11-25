/* Список «Куда отправлено» нельзя выделить и скопировать (в т.ч. на телефоне) */
(function(){
    var SEL = ".nosel";
    function hit(t){ try { if(t && t.nodeType === 3) t = t.parentElement; return !!(t && t.closest && t.closest(SEL)); } catch(e){ return false; } }
    ["selectstart", "copy", "cut", "dragstart", "contextmenu"].forEach(function(ev){ document.addEventListener(ev, function(e){ if(hit(e.target)) e.preventDefault(); }, true); });
    document.addEventListener("selectionchange", function(){ try { var s = window.getSelection(); if(!s || s.isCollapsed || !s.rangeCount) return; if(hit(s.anchorNode) || hit(s.focusNode)) s.removeAllRanges(); } catch(e){} });
})();
