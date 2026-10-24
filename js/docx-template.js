/* ==========================================================================
   docx-template.js — pure DOCX XML template builder (no DOM, testable)
   Input: collected form data + label set. Output: OOXML part strings.
   Used by js/builder.js in the browser; validated in Node by tests.
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Node
  root.DOCXTPL = api;                                                     // Browser
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ACCENT = "2B4BDF", INK = "101114", SOFT = "55585F", LINE = "B9C4F2";
  const PAGE_W = 9026; // content width in twips (A4, default 1440 margins)

  function xesc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function run(text, opt) {
    const o = opt || {};
    return `<w:r><w:rPr>` +
      (o.bold ? `<w:b/>` : "") +
      `<w:color w:val="${o.color || INK}"/>` +
      `<w:sz w:val="${o.sz || 21}"/>` +
      `</w:rPr><w:t xml:space="preserve">${xesc(text)}</w:t></w:r>`;
  }

  function para(runsXml, opt) {
    const o = opt || {};
    return `<w:p><w:pPr>` +
      (o.align ? `<w:jc w:val="${o.align}"/>` : "") +
      `<w:spacing w:before="${o.before || 0}" w:after="${o.after != null ? o.after : 120}" w:line="276" w:lineRule="auto"/>` +
      (o.borderBottom ? `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="${ACCENT}"/></w:pBdr>` : "") +
      (o.tabs ? `<w:tabs><w:tab w:val="right" w:pos="${PAGE_W}"/></w:tabs>` : "") +
      `</w:pPr>${runsXml}</w:p>`;
  }

  function sectionHeading(text) {
    return para(run(text, { bold: true, color: ACCENT, sz: 26 }), { borderBottom: true, before: 320, after: 160 });
  }

  function entryXml(line1bold, line1rest, date, desc) {
    let xml = para(
      run(line1bold, { bold: true }) +
      (line1rest ? run(" — " + line1rest) : "") +
      (date ? `<w:r><w:tab/></w:r>` + run(date, { color: SOFT, sz: 19 }) : ""),
      { tabs: true, after: 40 }
    );
    if (desc) xml += para(run(desc, { color: SOFT, sz: 20 }), { after: 100 });
    return xml;
  }

  /**
   * @param {object} d  collected data {objective, exp[], edu[], act[], hobby}
   * @param {object} L  label set {title, objective, exp, edu, act, hobby,
   *                             name, gender, phone, email, addr, photo}
   * @returns {string}  word/document.xml
   */
  function buildDocxXml(d, L) {
    const blank = (label, n) => para(run(label + ":  " + "_".repeat(n), { sz: 21 }), { align: "right", after: 60 });

    const photoCell = `
      <w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:tcBorders>
        <w:top w:val="dashed" w:sz="8" w:color="${LINE}"/><w:bottom w:val="dashed" w:sz="8" w:color="${LINE}"/>
        <w:left w:val="dashed" w:sz="8" w:color="${LINE}"/><w:right w:val="dashed" w:sz="8" w:color="${LINE}"/>
      </w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
      ${para(run(" ", {}), { after: 0 })}
      ${para(run(L.photo, { color: SOFT, sz: 20 }), { align: "center", after: 0 })}
      ${para(run(" ", {}), { after: 0 })}${para(run(" ", {}), { after: 0 })}
      ${para(run(" ", {}), { after: 0 })}${para(run(" ", {}), { after: 0 })}
      </w:tc>`;
    const blanksCell = `
      <w:tc><w:tcPr><w:tcW w:w="${PAGE_W - 3000}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
      ${blank(L.name, 22)}${blank(L.gender, 20)}${blank(L.phone, 20)}${blank(L.email, 20)}${blank(L.addr, 18)}
      </w:tc>`;

    let body = `
      ${para(run(L.title, { bold: true, sz: 36, color: INK }), { align: "center", before: 0, after: 240 })}
      <w:tbl><w:tblPr><w:tblW w:w="${PAGE_W}" w:type="dxa"/><w:tblBorders>
        <w:top w:val="none" w:sz="0"/><w:bottom w:val="none" w:sz="0"/>
        <w:left w:val="none" w:sz="0"/><w:right w:val="none" w:sz="0"/>
        <w:insideH w:val="none" w:sz="0"/><w:insideV w:val="none" w:sz="0"/>
      </w:tblBorders></w:tblPr>
      <w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="${PAGE_W - 3000}"/></w:tblGrid>
      <w:tr>${photoCell}${blanksCell}</w:tr></w:tbl>`;

    if (d.objective) body += sectionHeading(L.objective) + para(run(d.objective), {});
    if (d.exp.length) {
      body += sectionHeading(L.exp);
      d.exp.forEach((e) => { body += entryXml(e.role, "", [e.start, e.end].filter(Boolean).join(" – "), e.desc); });
    }
    if (d.edu.length) {
      body += sectionHeading(L.edu);
      d.edu.forEach((e) => { body += entryXml(e.degree, e.school, [e.start, e.end].filter(Boolean).join(" – "), ""); });
    }
    if (d.act.length) {
      body += sectionHeading(L.act);
      d.act.forEach((a) => { body += para(run("•  " + a), { after: 60 }); });
    }
    if (d.hobby) body += sectionHeading(L.hobby) + para(run(d.hobby), {});

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
</w:sectPr></w:body></w:document>`;
  }

  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="DengXian" w:cs="Calibri"/>
<w:sz w:val="21"/><w:color w:val="${INK}"/>
</w:rPr></w:rPrDefault></w:docDefaults>
</w:styles>`;

  const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  return { buildDocxXml, STYLES_XML, CONTENT_TYPES, RELS, DOC_RELS, xesc };
});
