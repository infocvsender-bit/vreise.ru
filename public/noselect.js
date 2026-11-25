/* Список «Куда отправлено» и ответы компаний нельзя выделить и скопировать (в т.ч. на телефоне, Ctrl+A, печать) */
(function(){
    var SEL = ".nosel";
    function hit(t){ try { if(t && t.nodeType === 3) t = t.parentElement; return !!(t && t.closest && t.closest(SEL)); } catch(e){ return false; } }
    ["selectstart", "copy", "cut", "dragstart", "contextmenu"].forEach(function(ev){ document.addEventListener(ev, function(e){ if(hit(e.target)) e.preventDefault(); }, true); });
    function touches(){ try { var s = window.getSelection(); if(!s || s.isCollapsed) return false; var els = document.querySelectorAll(SEL); for(var i = 0; i < s.rangeCount; i++){ var r = s.getRangeAt(i); for(var j = 0; j < els.length; j++) if(r.intersectsNode(els[j])) return true; } } catch(e){} return false; }
    ["copy", "cut"].forEach(function(ev){ document.addEventListener(ev, function(e){ if(touches()){ e.preventDefault(); try { e.clipboardData.setData("text/plain", ""); } catch(x){} } }, true); });
    document.addEventListener("selectionchange", function(){ try { var s = window.getSelection(); if(!s || s.isCollapsed || !s.rangeCount) return; if(hit(s.anchorNode) || hit(s.focusNode)) s.removeAllRanges(); } catch(e){} });
})();
