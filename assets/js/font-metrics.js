/* ============================================================
   FONT-METRICS.JS — LIT LES METRIQUES DANS LE FICHIER DE POLICE
   ------------------------------------------------------------
   Les vraies valeurs (ligne de base, hauteur d'oeil, hauteur de
   capitale, ascendantes, descendantes) sont ecrites DANS le
   fichier .otf/.ttf, dans les tables `head`, `hhea` et `OS/2`.
   On va les chercher la plutot que de les deviner au pixel.

   BSMetrics.load("../../assets/fonts/JALLEAU-Italic.otf")
     -> Promise<{ unitsPerEm, capHeight, xHeight, ascender,
                  descender, typoAscender, typoDescender }>
   Toutes les valeurs sauf unitsPerEm sont EN EM (1 = corps),
   pretes a multiplier par la taille d'affichage.
   Renvoie null si le fichier est illisible : l'appelant retombe
   alors sur une mesure approchee au canvas.
   ============================================================ */

window.BSMetrics = (function () {
  const cache = new Map();

  function tag(view, off) {
    return String.fromCharCode(
      view.getUint8(off), view.getUint8(off + 1),
      view.getUint8(off + 2), view.getUint8(off + 3)
    );
  }

  function parse(buffer) {
    const v = new DataView(buffer);
    let base = 0;

    /* collection (.ttc) : on prend la premiere police */
    if (tag(v, 0) === "ttcf") base = v.getUint32(12);

    const numTables = v.getUint16(base + 4);
    const tables = {};
    for (let i = 0; i < numTables; i += 1) {
      const rec = base + 12 + i * 16;
      tables[tag(v, rec)] = { off: v.getUint32(rec + 8), len: v.getUint32(rec + 12) };
    }

    const head = tables.head;
    if (!head) return null;
    const unitsPerEm = v.getUint16(head.off + 18) || 1000;

    let ascender = 0;
    let descender = 0;
    if (tables.hhea) {
      ascender = v.getInt16(tables.hhea.off + 4);
      descender = v.getInt16(tables.hhea.off + 6);
    }

    let capHeight = 0;
    let xHeight = 0;
    let typoAscender = 0;
    let typoDescender = 0;
    const os2 = tables["OS/2"];
    if (os2) {
      const version = v.getUint16(os2.off);
      typoAscender = v.getInt16(os2.off + 68);
      typoDescender = v.getInt16(os2.off + 70);
      /* sxHeight et sCapHeight n'existent qu'a partir de la version 2 */
      if (version >= 2 && os2.len >= 90) {
        xHeight = v.getInt16(os2.off + 86);
        capHeight = v.getInt16(os2.off + 88);
      }
    }

    const em = (n) => (n ? n / unitsPerEm : 0);
    return {
      unitsPerEm,
      ascender: em(ascender),
      descender: em(Math.abs(descender)),
      typoAscender: em(typoAscender),
      typoDescender: em(Math.abs(typoDescender)),
      capHeight: em(capHeight),
      xHeight: em(xHeight)
    };
  }

  /* ---------- table `cmap` : TOUS les caracteres de la fonte ----------
     Le jeu de caracteres ne doit pas venir d'une liste ecrite a la
     main : il vient du fichier. On lit la table `cmap`, qui dit
     exactement quels points de code la fonte couvre — y compris
     ceux rangees dans la zone privee (zone « custom », U+E000 et
     au-dela), ou beaucoup de dessins hors alphabet sont places. */
  function readCmap(buffer) {
    const v = new DataView(buffer);
    let base = 0;
    if (tag(v, 0) === "ttcf") base = v.getUint32(12);

    const numTables = v.getUint16(base + 4);
    let cmap = null;
    for (let i = 0; i < numTables; i += 1) {
      const rec = base + 12 + i * 16;
      if (tag(v, rec) === "cmap") { cmap = v.getUint32(rec + 8); break; }
    }
    if (cmap == null) return null;

    /* on prefere un sous-tableau Unicode complet (format 12),
       sinon le format 4 (BMP) */
    const n = v.getUint16(cmap + 2);
    let best = null;
    let bestScore = -1;
    for (let i = 0; i < n; i += 1) {
      const rec = cmap + 4 + i * 8;
      const platform = v.getUint16(rec);
      const encoding = v.getUint16(rec + 2);
      const off = cmap + v.getUint32(rec + 4);
      const format = v.getUint16(off);
      let score = -1;
      if (format === 12 && platform === 3 && encoding === 10) score = 5;
      else if (format === 12) score = 4;
      else if (format === 4 && platform === 3 && encoding === 1) score = 3;
      else if (format === 4) score = 2;
      else if (format === 6 || format === 0) score = 1;
      if (score > bestScore) { bestScore = score; best = { off, format }; }
    }
    if (!best) return null;

    const out = [];
    const MAX = 6000;                 /* garde-fou memoire */
    const push = (cp) => { if (out.length < MAX) out.push(cp); };

    if (best.format === 12) {
      const groups = v.getUint32(best.off + 12);
      for (let g = 0; g < groups && out.length < MAX; g += 1) {
        const rec = best.off + 16 + g * 12;
        const start = v.getUint32(rec);
        const end = v.getUint32(rec + 4);
        for (let cp = start; cp <= end && out.length < MAX; cp += 1) push(cp);
      }
    } else if (best.format === 4) {
      const segX2 = v.getUint16(best.off + 6);
      const segs = segX2 / 2;
      const endAt = best.off + 14;
      const startAt = endAt + segX2 + 2;
      for (let i = 0; i < segs && out.length < MAX; i += 1) {
        const end = v.getUint16(endAt + i * 2);
        const start = v.getUint16(startAt + i * 2);
        if (start > end || start === 0xffff) continue;
        for (let cp = start; cp <= end && out.length < MAX; cp += 1) push(cp);
      }
    } else if (best.format === 6) {
      const first = v.getUint16(best.off + 6);
      const count = v.getUint16(best.off + 8);
      for (let i = 0; i < count; i += 1) push(first + i);
    } else {
      for (let cp = 0; cp < 256; cp += 1) {
        if (v.getUint8(best.off + 6 + cp)) push(cp);
      }
    }

    /* on retire ce qui ne se dessine pas : espaces et commandes */
    return out.filter((cp) => cp > 0x20 && !(cp >= 0x7f && cp <= 0xa0));
  }

  const cpCache = new Map();

  /* BSMetrics.codepoints(url) -> Promise<number[]> */
  function codepoints(url) {
    if (cpCache.has(url)) return cpCache.get(url);
    const p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => (buf ? readCmap(buf) : null))
      .catch(() => null);
    cpCache.set(url, p);
    return p;
  }

  function load(url) {
    if (cache.has(url)) return cache.get(url);
    const p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => (buf ? parse(buf) : null))
      .catch(() => null);
    cache.set(url, p);
    return p;
  }

  return { load, parse, codepoints };
})();
