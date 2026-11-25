/* Резюме «Стандарт» Vreise.ru — Word (.docx), английский Seafarer CV.
   Макет: белая шапка с логотипом, слева бирюзовая колонка (фото, контакты, данные), справа — стаж и документы.
   build(D, photo) → Buffer. D пусто → чистый бланк. photo = {buf, ext: "jpeg"|"png"} (3,5×4,5 см).
   Запуск для образцов: node tools/resume-standard.js <папка>  (создаст blank и demo). */
"use strict";
const fs = require("fs"), path = require("path");
const {Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, BorderStyle,
    ImageRun, Header, Footer, PageNumber, VerticalAlign, TableLayoutType, HeightRule} = require("docx");

const TEAL = "0F4C5C", DEEP = "0B3641", GOLD = "F2B400", GOLD_D = "B07F00", MIST = "CFE3E6", INK = "1B2E35", MUTED = "6A7F86", LINE = "DCE6E8", PALE = "F2F8F8", WHITE = "FFFFFF";
const FONT = "Calibri", PAGE_W = 11906, SIDE = 3500, MAIN = PAGE_W - SIDE, MAIN_IN = MAIN - 300 - 520;
const PHONE = process.env.CONTACT_PHONE || "+79005830138";
const phonePretty = (/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(PHONE) || []).slice(1);
const PHONE_FMT = phonePretty.length ? `+7 ${phonePretty[0]} ${phonePretty[1]}-${phonePretty[2]}-${phonePretty[3]}` : PHONE;
const LOGO = fs.readFileSync(path.join(__dirname, "..", "public", "icon-192.png"));

const none = {style: BorderStyle.NONE, size: 0, color: WHITE}, NOB = {top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none};
const line = (c, sz = 4) => ({style: BorderStyle.SINGLE, size: sz, color: c});
const s = v => String(v ?? "").trim();
const t = (text, o = {}) => new TextRun({text: String(text ?? ""), font: FONT, size: o.size || 18, bold: o.bold, italics: o.italics, color: o.color || INK, allCaps: o.caps, characterSpacing: o.sp});
const p = (runs, o = {}) => new Paragraph({children: Array.isArray(runs) ? runs : [runs], alignment: o.align || AlignmentType.LEFT, spacing: {before: o.before || 0, after: o.after || 0}, keepNext: o.keepNext, border: o.border});
const cell = (children, o = {}) => new TableCell({children: Array.isArray(children) ? children : [children], width: {size: o.w, type: WidthType.DXA},
    shading: o.fill ? {type: ShadingType.CLEAR, color: "auto", fill: o.fill} : undefined, borders: o.borders || NOB, columnSpan: o.span,
    verticalAlign: o.va || VerticalAlign.TOP, margins: {top: o.mt ?? 40, bottom: o.mb ?? 40, left: o.ml ?? 80, right: o.mr ?? 80}});
const table = (cols, rows, borders) => new Table({width: {size: cols.reduce((a, b) => a + b, 0), type: WidthType.DXA}, columnWidths: cols, layout: TableLayoutType.FIXED, borders: borders || NOB, rows});

function header(){
    return new Header({children: [
        table([800, 4200, PAGE_W - 5000], [new TableRow({children: [
            cell(p(new ImageRun({type: "png", data: LOGO, transformation: {width: 34, height: 34}})), {w: 800, ml: 420, mr: 0, va: VerticalAlign.CENTER}),
            cell(p([t("Vreise", {size: 30, bold: true, color: TEAL}), t(".ru", {size: 30, bold: true, color: GOLD_D})]), {w: 4200, ml: 40, va: VerticalAlign.CENTER}),
            cell([p(t("SEAFARER CV", {size: 17, bold: true, color: TEAL, sp: 60}), {align: AlignmentType.RIGHT}),
                p(t(`WhatsApp · Telegram  ${PHONE_FMT}`, {size: 14, color: MUTED}), {align: AlignmentType.RIGHT})], {w: PAGE_W - 5000, mr: 420, va: VerticalAlign.CENTER})]})]),
        p(t(""), {border: {bottom: {style: BorderStyle.SINGLE, size: 24, color: GOLD, space: 1}}})]});
}
function footer(){
    const m = {size: 14, color: MUTED};
    return new Footer({children: [p([t(`Prepared by Vreise.ru  ·  ${PHONE_FMT}  ·  page `, m), new TextRun({children: [PageNumber.CURRENT], font: FONT, size: 14, color: MUTED}),
        t(" of ", m), new TextRun({children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: MUTED})], {align: AlignmentType.CENTER})]});
}

/* ---- левая колонка ---- */
const sbTitle = x => p(t(x, {size: 15, bold: true, color: GOLD, caps: true, sp: 40}), {before: 280, after: 80, keepNext: true, border: {bottom: {style: BorderStyle.SINGLE, size: 6, color: "2F7381", space: 3}}});
const sbField = (label, value, blank) => [p(t(label, {size: 13, color: MIST, caps: true, sp: 10}), {before: 90}), p(t(s(value) || (blank ? "" : "—"), {size: 18, bold: true, color: WHITE}), {before: 10})];

function sidebar(D, photo, blank){
    const dash = {style: BorderStyle.DASHED, size: 8, color: "5E96A2"};
    const ph = photo && photo.buf
        ? p(new ImageRun({type: photo.ext === "png" ? "png" : "jpg", data: photo.buf, transformation: {width: 126, height: Math.round(126 * 45 / 35)}}), {align: AlignmentType.CENTER})
        : table([2300], [new TableRow({height: {value: 1900, rule: HeightRule.ATLEAST}, children: [cell([p(t("PHOTO", {size: 18, bold: true, color: "8FB6BF", sp: 50}), {align: AlignmentType.CENTER}),
            p(t("3.5 × 4.5 cm", {size: 14, color: "8FB6BF"}), {align: AlignmentType.CENTER, before: 30})], {w: 2300, va: VerticalAlign.CENTER, borders: {top: dash, bottom: dash, left: dash, right: dash}})]})]);
    const b = D.bio || {}, k = D.nok || {};
    return [p(t(""), {after: 120}), ph,
        sbTitle("Contact"), ...sbField("Phone · WhatsApp · Telegram", blank ? "+00 000 000 0000" : D.phone), ...sbField("E-mail", blank ? "name@email.com" : D.email), ...sbField("City / nearest airport", blank ? "City, Country" : D.location),
        sbTitle("Personal"), ...sbField("Date of birth", blank ? "DD.MM.YYYY" : D.dob), ...sbField("Nationality", D.nationality, blank), ...sbField("English level", D.english, blank),
        ...sbField("Desired salary", blank ? "0000 USD / month" : D.salary), ...sbField("Available from", blank ? "DD.MM.YYYY" : D.available || "Immediately"),
        sbTitle("Biometrics"), ...sbField("Height / weight", [s(b.height) && s(b.height) + " cm", s(b.weight) && s(b.weight) + " kg"].filter(Boolean).join("  /  "), blank),
        ...sbField("Eyes", b.eyes, blank), ...sbField("Overall / shoe size", [s(b.overall), s(b.shoe)].filter(Boolean).join("  /  "), blank),
        sbTitle("Next of kin"), ...sbField("Name", k.name, blank), ...sbField("Relation", k.relation, blank), ...sbField("Phone", k.phone, blank),
        p(t(""), {after: 200})];
}

/* ---- правая колонка ---- */
const secTitle = x => p(t(x, {size: 20, bold: true, color: TEAL, caps: true, sp: 40}), {before: 300, after: 110, keepNext: true, border: {bottom: {style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 3}}});
function seaItem(x, blank){
    const L = [MAIN_IN - 2300, 2300], bl = {top: none, right: none, bottom: line(LINE), left: line(GOLD, 24)};
    const meta = blank ? "Vessel type  ·  Flag  ·  DWT / GRT  ·  ME power  ·  Owner / crewing" : [x.type, x.flag, x.grt && "DWT/GRT " + x.grt, x.power && "ME " + x.power, x.owner].filter(Boolean).join("  ·  ");
    const dates = blank ? "MM.YYYY – MM.YYYY" : [s(x.from), s(x.to)].filter(Boolean).join(" – ");
    return table(L, [new TableRow({cantSplit: true, children: [
        cell([p([t(blank ? "Position" : s(x.position), {size: 19, bold: true}), t("  ·  ", {size: 19, color: GOLD_D}), t(blank ? "Vessel name" : s(x.vessel), {size: 19, bold: true, color: TEAL})]), p(t(meta, {size: 15, color: MUTED}), {before: 20})],
            {w: L[0], borders: {...NOB, ...bl}, ml: 140, mt: 70, mb: 70}),
        cell(p(t(dates, {size: 16, bold: true, color: TEAL}), {align: AlignmentType.RIGHT}), {w: L[1], borders: {...NOB, bottom: line(LINE)}, va: VerticalAlign.CENTER, mr: 60})]})]);
}
const DOC = [3300, 1900, 1153, 1153];
function docTable(title, rows, h1){
    const head = new TableRow({cantSplit: true, children: [h1 || "Document", "Place of issue", "Issued", "Expires"].map((l, i) => cell(p(t(l, {size: 13, bold: true, color: MUTED, caps: true}), {align: i > 1 ? AlignmentType.CENTER : AlignmentType.LEFT, keepNext: true}),
        {w: DOC[i], borders: {...NOB, bottom: line(TEAL, 8)}, fill: PALE}))});
    const body = rows.map(r => new TableRow({cantSplit: true, height: {value: 330, rule: HeightRule.ATLEAST}, children: r.map((v, i) => cell(p(t(v, {size: 16, bold: !i}), {align: i > 1 ? AlignmentType.CENTER : AlignmentType.LEFT}),
        {w: DOC[i], borders: {...NOB, bottom: line(LINE)}, va: VerticalAlign.CENTER}))}));
    return [secTitle(title), table(DOC, [head, ...body])];
}
const STCW = ["Basic safety training (VI/1, A-VI/1)", "Survival craft and rescue boats (VI/2, A-VI/2)", "Fast rescue boats (VI/2, A-VI/2)", "Advanced fire fighting (VI/3, A-VI/3)",
    "Medical first aid (VI/4, A-VI/4)", "Ship security officer / Security awareness (VI/5, VI/6)"];

async function build(D = {}, photo = null){
    const blank = !s(D.name);
    const row = d => [s(d.name), s(d.place), s(d.issued), s(d.expires)];
    const list = a => (a || []).filter(c => c && s(c.name)).map(row);
    const pass = blank ? [["Travel passport", "", "", ""], ["Seaman's book", "", "", ""], ["Visa (US C1/D, other)", "", "", ""]]
        : [["Travel passport", s(D.passport?.place), s(D.passport?.issued), s(D.passport?.expires)], ["Seaman's book", s(D.seamanBook?.place), s(D.seamanBook?.issued), s(D.seamanBook?.expires)], ...list(D.visas)];
    const coc = blank ? [["Certificate of Competency", "", "", ""], ["Endorsement (flag state)", "", "", ""], ["GMDSS GOC / ROC", "", "", ""]] : list(D.coc);
    const certs = blank ? [...STCW.map(n => [n, "", "", ""]), ["", "", "", ""], ["", "", "", ""]] : list(D.certs);
    const med = blank ? [["Medical certificate (ILO / MLC)", "", "", ""], ["Drug & alcohol test", "", "", ""], ["Yellow fever vaccination", "", "", ""]] : list(D.medical);
    const sea = blank ? Array(4).fill(null) : (D.sea || []).filter(x => x && (s(x.vessel) || s(x.position)));

    const mainChildren = [
        p(t((s(D.title) || "Rank  |  Fleet").replace(/\s*\|\s*/g, "   |   "), {size: 20, bold: true, color: GOLD_D, caps: true, sp: 30}), {before: 120}),
        p(t(s(D.name) || "Name Surname", {size: 46, bold: true, color: TEAL, caps: true}), {before: 20, after: 60}),
        p(t(blank ? "One line about you: rank, fleet, years at sea, vessel types, DP / main engine experience." : s(D.subtitle), {size: 17, color: MUTED, italics: true}), {after: 40}),
        ...(blank || s(D.summary) ? [secTitle("Profile"), p(t(blank ? "Two or three sentences: experience, key vessels, strengths, what you are looking for." : D.summary, {size: 17, color: blank ? MUTED : INK, italics: blank}), {after: 40})] : []),
        secTitle(blank ? "Sea service · last 5 years" : "Sea service"),
        ...(sea.length ? sea.flatMap(x => [seaItem(x, blank), p(t(""), {after: 50})]) : [p(t("—", {color: MUTED}))]),
        ...docTable("Passports and seaman's book", pass), ...docTable("National CoC and endorsements", coc, "Certificate"), ...docTable("STCW and other certificates", certs, "Certificate"),
        ...docTable("Medical", med),
        ...(s(D.comment) || blank ? [secTitle("Additional"), p(t(blank ? "Courses, skills, languages, references — anything else that helps." : D.comment, {size: 17, color: blank ? MUTED : INK, italics: blank}))] : []),
        p(t("I confirm that the information above is true and complete.", {size: 15, italics: true, color: MUTED}), {before: 260}),
        p([t("Date: ____________________", {size: 16, color: MUTED}), t("          Signature: ____________________", {size: 16, color: MUTED})], {before: 140})];

    const body = table([SIDE, MAIN], [new TableRow({children: [
        cell(sidebar(D, photo, blank), {w: SIDE, fill: TEAL, ml: 300, mr: 260, mt: 0, mb: 0}),
        cell(mainChildren, {w: MAIN, ml: 380, mr: 520, mt: 0, mb: 0})]})]);
    const doc = new Document({creator: "Vreise.ru", title: blank ? "Seafarer CV — Vreise.ru" : `CV ${s(D.name)}`, styles: {default: {document: {run: {font: FONT, size: 18}}}},
        sections: [{properties: {page: {size: {width: PAGE_W, height: 16838}, margin: {top: 1150, bottom: 700, left: 0, right: 0, header: 250, footer: 300}}}, headers: {default: header()}, footers: {default: footer()}, children: [body]}]});
    return Packer.toBuffer(doc);
}

const DEMO = {name: "Ivan Sokolov", title: "Chief Officer | Offshore Fleet", subtitle: "11 years at sea · PSV / AHTS / Subsea · DP Unlimited (Nautical Institute)",
    summary: "Chief Officer with 11 years in the offshore fleet, 4 of them as C/O on DP2 PSV and AHTS vessels in the North Sea and West Africa. Strong record in cargo and deck operations, HSE and audits. Looking for a C/O position on PSV / AHTS / subsea vessels.",
    phone: "+7 900 123-45-67", email: "ivan.sokolov@example.com", location: "Novorossiysk, Russia / Istanbul", dob: "14.03.1988", nationality: "Russian", english: "Upper-Intermediate", salary: "6500 USD / month", available: "01.02.2027",
    bio: {height: "182", weight: "84", eyes: "Grey", overall: "L / 52", shoe: "43"}, nok: {name: "Elena Sokolova", relation: "Wife", phone: "+7 900 765-43-21"},
    passport: {place: "FMS 77130", issued: "12.05.2021", expires: "12.05.2031"}, seamanBook: {place: "Novorossiysk", issued: "03.09.2022", expires: "03.09.2027"},
    visas: [{name: "US visa C1/D", place: "Moscow", issued: "20.06.2023", expires: "19.06.2033"}],
    coc: [{name: "Chief Officer, unlimited (II/2)", place: "Panama", issued: "10.03.2024", expires: "10.03.2029"}, {name: "GMDSS GOC", place: "Panama", issued: "10.03.2024", expires: "10.03.2029"}],
    certs: [{name: "Basic safety training (VI/1)", place: "Novorossiysk", issued: "05.04.2022", expires: "05.04.2027"}, {name: "Advanced fire fighting (VI/3)", place: "Novorossiysk", issued: "07.04.2022", expires: "07.04.2027"},
        {name: "DP Unlimited", place: "Nautical Institute", issued: "11.11.2023", expires: "—"}, {name: "Offshore Crane Operator (OCO)", place: "Aberdeen", issued: "02.08.2024", expires: "02.08.2029"}],
    medical: [{name: "Medical certificate (ILO / MLC)", place: "Novorossiysk", issued: "18.08.2026", expires: "18.08.2028"}, {name: "Yellow fever vaccination", place: "Novorossiysk", issued: "10.01.2021", expires: "Lifetime"}],
    sea: [{position: "Chief Officer", vessel: "Sea Falcon", type: "PSV", flag: "Panama", grt: "3 100", power: "2 × 3 250 kW", owner: "Offshore Marine Ltd", from: "03.2024", to: "10.2026"},
        {position: "Second Officer", vessel: "North Star", type: "AHTS", flag: "Norway", grt: "4 800", power: "2 × 6 000 kW", owner: "Nordic Offshore AS", from: "01.2022", to: "02.2024"},
        {position: "Third Officer", vessel: "Atlantic Guard", type: "Subsea / IMR", flag: "Marshall Is.", grt: "6 900", power: "4 × 2 800 kW", owner: "Subsea Services Inc", from: "05.2019", to: "12.2021"}],
    comment: "Courses: BOSIET, HUET, Bridge Resource Management, Cargo handling for PSV. Languages: Russian (native), English (fluent)."};

module.exports = {build, DEMO};
if(require.main === module){
    const out = process.argv[2] || "."; fs.mkdirSync(out, {recursive: true});
    (async () => { fs.writeFileSync(path.join(out, "Vreise_CV_Standard_blank.docx"), await build({})); fs.writeFileSync(path.join(out, "Vreise_CV_Standard_example.docx"), await build(DEMO)); console.log("ok"); })();
}
