/* Проверка постоянных адресов: все slug из seo-urls.json должны существовать в blog.js (или быть в moved). Запуск перед коммитом: node tools/check-urls.js */
const B = require("../blog.js"), U = require("../seo-urls.json");
const miss = U.blog.filter(s => !B.A[s] && !(U.moved || {})["/blog/" + s]);
if(miss.length){ console.error("❌ Пропали адреса блога:", miss.join(", "), "— верните статью или добавьте в seo-urls.json → moved"); process.exit(1); }
const fresh = B.SLUGS.filter(s => !U.blog.includes(s));
if(fresh.length) console.log("ℹ️ Новые статьи, добавьте в seo-urls.json → blog:", fresh.join(", "));
console.log("✅ Адреса на месте: " + U.blog.length + " статей блога");
