/* ==========================================================================
   docx-zip.js — minimal dependency-free .docx writer
   A .docx is a ZIP of XML parts. We emit STORED (uncompressed) entries with
   correct CRC-32 — Word/WPS accept this fine, and no CDN library can fail
   during your presentation.
   Exposes: window.DOCXZIP.build(files) -> Blob  (files: [{name, xml:String}])
   ========================================================================== */
(function () {
  "use strict";

  /* ---- CRC-32 ---- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const enc = new TextEncoder();

  function dosDateTime() {
    const d = new Date();
    const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31);
    const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time, date };
  }

  function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
  function u32(v) { return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF]; }

  /**
   * @param {{name:string, xml:string}[]} files
   * @returns {Blob}
   */
  function build(files) {
    const parts = files.map((f) => ({ name: f.name, data: enc.encode(f.xml) }));
    const { time, date } = dosDateTime();
    const locals = [], centrals = [];
    let offset = 0;

    for (const p of parts) {
      const nameBytes = enc.encode(p.name);
      const crc = crc32(p.data);
      const size = p.data.length;

      const lh = [
        0x50, 0x4B, 0x03, 0x04,           // local file header signature
        ...u16(20),                        // version needed
        ...u16(0x0800),                    // flags: UTF-8 names
        ...u16(0),                         // method: store
        ...u16(time), ...u16(date),
        ...u32(crc), ...u32(size), ...u32(size),
        ...u16(nameBytes.length), ...u16(0),
      ];
      locals.push(new Uint8Array(lh), nameBytes, p.data);

      const ch = [
        0x50, 0x4B, 0x01, 0x02,           // central dir signature
        ...u16(20), ...u16(20),            // versions
        ...u16(0x0800), ...u16(0),
        ...u16(time), ...u16(date),
        ...u32(crc), ...u32(size), ...u32(size),
        ...u16(nameBytes.length),
        ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(0), ...u32(offset),
      ];
      centrals.push(new Uint8Array(ch), nameBytes);
      offset += lh.length + nameBytes.length + size;
    }

    const centralSize = centrals.reduce((s, a) => s + a.length, 0);
    const eocd = new Uint8Array([
      0x50, 0x4B, 0x05, 0x06,
      ...u16(0), ...u16(0),
      ...u16(parts.length), ...u16(parts.length),
      ...u32(centralSize), ...u32(offset), ...u16(0),
    ]);

    return new Blob([...locals, ...centrals, eocd],
      { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  window.DOCXZIP = { build };
})();
