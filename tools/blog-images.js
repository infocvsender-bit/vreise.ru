"use strict";
/* Рендер иллюстраций блога: node tools/blog-images.js → public/blog/<name>.jpg (сцены из tools/blog-images.html, data-name). */
const path = require("path"), fs = require("fs");
const {chromium} = require("playwright");
(async () => {
    const out = path.join(__dirname, "..", "public", "blog"); fs.mkdirSync(out, {recursive: true});
    const b = await chromium.launch(), pg = await b.newPage({deviceScaleFactor: 1});
    await pg.goto("file://" + path.join(__dirname, "blog-images.html")); await pg.evaluate(() => document.fonts.ready);
    const scenes = await pg.$$(".scene"), info = {};
    for(const el of scenes){
        const name = await el.getAttribute("data-name"), f = path.join(out, name + ".jpg");
        await el.screenshot({path: f, type: "jpeg", quality: 88});
        const bb = await el.boundingBox(); info[name] = [Math.round(bb.width), Math.round(bb.height), fs.statSync(f).size];
    }
    await b.close(); console.log(JSON.stringify(info, null, 1));
})();
