#!/usr/bin/env node
/* ============================================================
   SYNC-FONTS.JS — TOUT LE SITE S'ADAPTE AUX FICHIERS DE POLICE
   ------------------------------------------------------------
   Depose tes .otf / .ttf / .woff / .woff2 dans assets/fonts/,
   puis lance depuis la racine du projet :

       node scripts/sync-fonts.js

   Le script :
     0. indexe les vignettes video des auteurs (assets/authorfaces/)
        et ecrit assets/js/faces-data.js, puis s'assure que chaque
        page charge la vignette
     1. lit assets/fonts/ et nomme chaque fichier FAMILLE-Style
        (ex: JALLEAU-Italic.otf -> famille JALLEAU, style Italic)
     2. REGENERE assets/css/fonts.css (une regle @font-face par
        fichier, avec font-weight / font-style deduits du style)
     3. met a jour assets/js/fonts-data.js :
        - nouvelle graisse d'une fonte existante -> ajoutee a son
          tableau "styles" (elle apparait dans le menu font family)
        - famille inconnue -> nouveau bloc de fonte pre-rempli,
          a completer (designer, annee, textes...)
     4. CREE le dossier de la page specimen fonts/<slug>/ a partir
        de fonts/_template.html, avec son sous-dossier media/
     5. regenere les manifestes media (comme
        scripts/generate-media-manifest.js)

   Rien n'est ecrase de ce que tu as ecrit a la main : les textes,
   le designer, l'annee et les dispositions sont conserves.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FONT_DIR = path.join(ROOT, "assets", "fonts");
const PAGES_DIR = path.join(ROOT, "fonts");
const DATA_FILE = path.join(ROOT, "assets", "js", "fonts-data.js");
const FACES_DIR = path.join(ROOT, "assets", "authorfaces");
const FACES_FILE = path.join(ROOT, "assets", "js", "faces-data.js");
const INUSE_FILE = path.join(ROOT, "assets", "js", "inuse-data.js");
const DEFAULT_FACE = "assets/2face.mp4";
const VIDEO_EXT = [".mp4", ".webm", ".mov"];
const CSS_FILE = path.join(ROOT, "assets", "css", "fonts.css");
const TEMPLATE = path.join(PAGES_DIR, "_template.html");

const FORMATS = { ".otf": "opentype", ".ttf": "truetype", ".woff": "woff", ".woff2": "woff2" };

const WEIGHTS = [
  ["extrablack", 950], ["ultrablack", 950], ["extrabold", 800], ["ultrabold", 800],
  ["extralight", 200], ["ultralight", 200], ["semibold", 600], ["demibold", 600],
  ["black", 900], ["heavy", 900], ["bold", 700], ["medium", 500],
  ["light", 300], ["thin", 100], ["book", 400], ["regular", 400], ["normal", 400]
];

/* ---------- lecture du dossier de polices ---------- */
function readFontFiles() {
  if (!fs.existsSync(FONT_DIR)) return [];
  return fs
    .readdirSync(FONT_DIR)
    .filter((n) => !n.startsWith(".") && FORMATS[path.extname(n).toLowerCase()])
    .filter((n) => !/\.zip$/i.test(n))
    .sort()
    .map((name) => {
      /* NOMMAGE : FAMILLE-Style, ou FAMILLE-Variante-Style.
         La famille est toujours avant le premier tiret. A partir de
         trois morceaux, le deuxieme est la VARIANTE (techniquement
         un autre dessin, range sous le meme nom) et le reste est le
         style.  Persvrance-Carre45Fusion-Regular
           famille PERSVRANCE, variante Carre45Fusion, style Regular */
      const ext = path.extname(name).toLowerCase();
      const stem = path.basename(name, ext);
      const parts = stem.split("-").filter(Boolean);
      const prefix = parts[0] || stem;
      const variantRaw = parts.length >= 3 ? parts[1] : "";
      const styleRaw = parts.length >= 3
        ? parts.slice(2).join(" ")
        : (parts[1] || "Regular");
      const low = styleRaw.toLowerCase().replace(/[^a-z]/g, "");
      let weight = 400;
      for (const [key, w] of WEIGHTS) {
        if (low.includes(key)) { weight = w; break; }
      }
      return {
        name,
        stem,
        prefix,
        rel: "assets/fonts/" + name,
        format: FORMATS[ext],
        label: pretty(styleRaw),
        variant: variantRaw ? pretty(variantRaw) : "",
        weight,
        style: /italic|oblique/i.test(styleRaw) ? "italic" : "normal"
      };
    })
    .reduce(garderUnSeulFormat, [])
    .reduce(demelerLesDoublons, []);
}

/* Le meme dessin depose en plusieurs formats (BATON-Regular.otf ET
   BATON-Regular.ttf) n'est pas deux graisses : c'est un seul
   fichier, deux emballages. On n'en garde qu'un, dans cet ordre de
   preference — le plus leger d'abord. L'archive de telechargement,
   elle, contient toujours tout ce qui est depose. */
const PREFERENCE = [".woff2", ".woff", ".otf", ".ttf"];
function garderUnSeulFormat(liste, f) {
  const rang = (n) => {
    const i = PREFERENCE.indexOf(path.extname(n).toLowerCase());
    return i < 0 ? PREFERENCE.length : i;
  };
  const deja = liste.findIndex((x) => x.stem === f.stem);
  if (deja < 0) liste.push(f);
  else if (rang(f.name) < rang(liste[deja].name)) liste[deja] = f;
  return liste;
}

/* Deux fichiers d'une meme famille qui tombent sur la MEME graisse
   et le MEME style ne peuvent pas partager un nom CSS : le
   navigateur n'a alors aucun moyen de les distinguer, et il en
   affiche toujours un seul. C'est le cas d'Arutext
   (Inverted / Smearing / Tipnib, toutes en 400 normal) : choisir un
   style ne changeait rien a l'ecran.
   On leur donne donc un NOM CSS distinct — et rien d'autre. La
   VARIANTE n'y touche pas : elle reste ce que dit le nom du fichier
   (deux morceaux = famille-style, trois = famille-variante-style).
   Le nom CSS est de la plomberie ; la variante, elle, se voit dans
   les menus du site. */
function demelerLesDoublons(liste, f) {
  liste.push(f);
  /* on ne peut trancher qu'une fois la famille complete : on
     retravaille la liste a chaque ajout, c'est court */
  const parFamille = new Map();
  liste.forEach((x) => {
    if (!parFamille.has(x.prefix)) parFamille.set(x.prefix, []);
    parFamille.get(x.prefix).push(x);
  });
  parFamille.forEach((files) => {
    const vus = new Map();
    files.forEach((x) => {
      const clef = x.variant + "|" + x.weight + "|" + x.style;
      if (!vus.has(clef)) vus.set(clef, []);
      vus.get(clef).push(x);
    });
    vus.forEach((groupe) => {
      if (groupe.length < 2) return;
      groupe.forEach((x) => {
        /* nom CSS interne, jamais montre : « Arutext Smearing » */
        if (!x.cssNom) x.cssNom = x.variant ? x.variant + " " + x.label : x.label;
      });
    });
  });
  return liste;
}

/* ---------- lecture des fontes deja declarees ---------- */
function readFonts() {
  const sandbox = { window: {} };
  const code = fs.readFileSync(DATA_FILE, "utf8");
  new Function("window", code)(sandbox.window);
  return sandbox.window.BS_FONTS || [];
}

const slugify = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---------- 1. rattacher chaque fichier a une fonte ---------- */
function assign(files, fonts) {
  const byFont = new Map();   // slug -> [file]
  const orphans = [];
  fonts.forEach((f) => byFont.set(f.slug, []));

  files.forEach((file) => {
    /* le familyKey le plus long qui correspond gagne : le stem
       complet (HEXCD-Nuked) l'emporte sur le prefixe (HEXCD). */
    let best = null;
    fonts.forEach((f) => {
      /* comparaison SANS tenir compte de la casse : « Persvrance »
         et « PERSVRANCE » designent la meme fonte. */
      const key = (f.familyKey || f.slug).toUpperCase();
      if (file.stem.toUpperCase() === key || file.prefix.toUpperCase() === key) {
        if (!best || key.length > (best.familyKey || "").length) best = f;
      }
    });
    if (best) byFont.get(best.slug).push(file);
    else orphans.push(file);
  });

  const newFamilies = new Map(); // prefix -> [file]
  orphans.forEach((f) => {
    const key = f.prefix.toUpperCase();
    if (!newFamilies.has(key)) newFamilies.set(key, []);
    newFamilies.get(key).push(f);
  });
  return { byFont, newFamilies };
}

/* ---------- 1bis. fontes dont le fichier a disparu ----------
   Retirer un .otf/.ttf de assets/fonts/ doit retirer la fonte du
   site : son bloc dans fonts-data.js, sa ligne dans l'ordre
   "Fonts in use", son archive .zip, et son dossier de page.

   Le dossier de page n'est PAS detruit : il contient tes medias et
   tes travaux "in use". Il est deplace dans fonts/_corbeille/, ou
   tu peux le recuperer ou le jeter toi-meme. */
const TRASH_DIR = path.join(PAGES_DIR, "_corbeille");
const TRASH_README = `Dossiers des fontes retirees de assets/fonts/.

Rien n'a ete detruit : les medias et les travaux "in use" de la
fonte sont ici, intacts. Remets le fichier de police dans
assets/fonts/ et relance la mise a jour pour retrouver la page,
ou supprime ce dossier toi-meme si tu n'en veux plus.
`;

/* Retire le bloc { ... } d'une fonte du tableau window.BS_FONTS. */
function dropFontBlock(src, slug) {
  const idx = src.indexOf('slug: "' + slug + '"');
  if (idx < 0) return src;
  const start = src.lastIndexOf("\n  {", idx);
  if (start < 0) return src;

  const mid = src.indexOf("\n  },", idx);   /* un bloc suivi d'un autre */
  const last = src.indexOf("\n  }\n];", idx); /* dernier bloc du tableau */

  if (mid >= 0 && (last < 0 || mid < last)) {
    return src.slice(0, start) + src.slice(mid + 5);
  }
  if (last < 0) return src;
  /* dernier bloc : la virgule du bloc precedent doit sauter aussi */
  return (src.slice(0, start) + src.slice(last + 4)).replace(/,(\s*)\n\];/, "$1\n];");
}

/* Retire le slug de window.BS_FONTS_IN_USE_ORDER. */
function dropInUseOrder(src, slug) {
  return src
    .replace(new RegExp('\\n\\s*"' + slug + '",'), "")
    .replace(new RegExp(',(\\s*)"' + slug + '"(\\s*)\\n\\]'), "$1$2\n]");
}

function removeMissingFonts(byFont, fonts) {
  const gone = fonts.filter((f) => !(byFont.get(f.slug) || []).length);
  if (!gone.length) return [];

  let src = fs.readFileSync(DATA_FILE, "utf8");
  const done = [];

  gone.forEach((f) => {
    src = dropFontBlock(src, f.slug);
    src = dropInUseOrder(src, f.slug);
    const notes = [];

    /* archive de la famille */
    const zip = path.join(FONT_DIR, (f.familyKey || f.slug) + ".zip");
    if (fs.existsSync(zip)) { fs.unlinkSync(zip); notes.push("archive .zip supprimee"); }

    /* dossier de la page : deplace, jamais detruit */
    const dir = path.join(PAGES_DIR, f.slug);
    if (fs.existsSync(dir)) {
      fs.mkdirSync(TRASH_DIR, { recursive: true });
      fs.writeFileSync(path.join(TRASH_DIR, "LISEZ-MOI.txt"), TRASH_README);
      let dest = path.join(TRASH_DIR, f.slug);
      let n = 2;
      while (fs.existsSync(dest)) { dest = path.join(TRASH_DIR, f.slug + "-" + n); n += 1; }
      fs.renameSync(dir, dest);
      notes.push("dossier deplace dans " + path.relative(ROOT, dest));
    }
    done.push(f.slug + (notes.length ? " (" + notes.join(", ") + ")" : ""));
  });

  fs.writeFileSync(DATA_FILE, src);
  return done;
}

/* Archives .zip qui ne correspondent plus a aucune famille. */
function cleanZips(fonts) {
  if (!fs.existsSync(FONT_DIR)) return [];
  const keep = new Set(
    fonts.map((f) => (f.zip || "").split("/").pop()).filter(Boolean)
  );
  const dead = [];
  fs.readdirSync(FONT_DIR)
    .filter((n) => /\.zip$/i.test(n) && !keep.has(n))
    .forEach((n) => { fs.unlinkSync(path.join(FONT_DIR, n)); dead.push(n); });
  return dead;
}

/* ---------- lecture de la table « name » d'une police ----------
   Le dessinateur ecrit son nom DANS le fichier a l'export. On va
   le chercher la plutot que de le redemander :
     nameID 9 = Designer, 8 = Manufacturer,
     1 = famille, 2 = sous-famille. */
function readNameTable(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch (_e) { return {}; }
  try {
    const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const tag = (off) => String.fromCharCode(v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3));
    let base = 0;
    if (tag(0) === "ttcf") base = v.getUint32(12);

    const numTables = v.getUint16(base + 4);
    let name = null;
    for (let i = 0; i < numTables; i += 1) {
      const rec = base + 12 + i * 16;
      if (tag(rec) === "name") { name = { off: v.getUint32(rec + 8) }; break; }
    }
    if (!name) return {};

    const count = v.getUint16(name.off + 2);
    const storage = name.off + v.getUint16(name.off + 4);
    const out = {};

    for (let i = 0; i < count; i += 1) {
      const rec = name.off + 6 + i * 12;
      const platform = v.getUint16(rec);
      const nameID = v.getUint16(rec + 6);
      const len = v.getUint16(rec + 8);
      const off = storage + v.getUint16(rec + 10);
      if (off + len > buf.length) continue;

      let str;
      if (platform === 3 || platform === 0) {
        /* UTF-16BE */
        str = buf.toString("utf16le", off, off + len)
          .split("")
          .map((c) => String.fromCharCode(((c.charCodeAt(0) & 0xff) << 8) | (c.charCodeAt(0) >> 8)))
          .join("");
      } else {
        str = buf.toString("latin1", off, off + len);
      }
      str = str.replace(/\u0000/g, "").trim();
      /* on garde la premiere valeur non vide rencontree */
      if (str && !out[nameID]) out[nameID] = str;
    }
    return out;
  } catch (_e) {
    return {};
  }
}

/* ---------- archive ZIP d'une famille ----------
   Une fonte a plusieurs graisses : le bouton de telechargement
   doit donner la famille entiere. On ecrit donc un .zip nous-meme
   (methode « store », sans compression : un fichier de police est
   deja compact, et ca evite toute dependance). */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function makeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  entries.forEach((e) => {
    const name = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const size = e.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          /* version necessaire */
    local.writeUInt16LE(0, 6);           /* pas de drapeau */
    local.writeUInt16LE(0, 8);           /* methode 0 = stocke */
    local.writeUInt16LE(0, 10);          /* heure */
    local.writeUInt16LE(0x21, 12);       /* date (1980-01-01) */
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, e.data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);

    offset += local.length + name.length + size;
  });

  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([Buffer.concat(chunks), cdBuf, end]);
}

/* Un .zip par famille de plus d'une graisse. Renvoie le chemin
   relatif, ou null si la famille n'a qu'un fichier. */
function writeFamilyZip(font, files) {
  const zipPath = path.join(FONT_DIR, font.familyKey + ".zip");
  if (files.length < 2) {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return null;
  }
  const entries = files.map((f) => ({
    name: f.name,
    data: fs.readFileSync(path.join(FONT_DIR, f.name))
  }));
  fs.writeFileSync(zipPath, makeZip(entries));
  return "assets/fonts/" + font.familyKey + ".zip";
}

/* Nom de famille CSS d'un fichier. La VARIANTE se voit dans les
   menus du site ; le suffixe cssNom, lui, ne sert qu'a empecher deux
   dessins de meme graisse de s'ecraser. */
function familleCss(base, f) {
  if (f.cssNom) return base + " " + f.cssNom;
  return f.variant ? base + " " + f.variant : base;
}

/* ---------- 2. assets/css/fonts.css ---------- */
function writeCss(entries) {
  const head = `/* ============================================================
   FONTS.CSS — DECLARATIONS @FONT-FACE
   ------------------------------------------------------------
   FICHIER GENERE : ne pas editer a la main.
   Il est reecrit par  node scripts/sync-fonts.js  a partir des
   fichiers presents dans assets/fonts/. Pour ajouter une police
   ou une graisse : deposer le fichier puis relancer le script.

   Le nom "font-family" correspond au champ cssFamily de
   assets/js/fonts-data.js ; les graisses d'une meme famille
   partagent ce nom et se distinguent par font-weight/font-style.
   ============================================================ */
`;
  const blocks = [];
  const face = (family, f) =>
    `@font-face {\n  font-family: "${family}";\n  src: url("../fonts/${f.name}") format("${f.format}");\n` +
    `  font-weight: ${f.weight};\n  font-style: ${f.style};\n  font-display: swap;\n}`;

  entries.forEach(({ cssFamily, files, main }) => {
    files.forEach((f) => {
      /* une variante — ou deux dessins de meme graisse — = sa propre
         famille CSS, sinon l'une ecraserait l'autre */
      blocks.push(face(familleCss(cssFamily, f), f));
    });
    /* la famille "nue" doit toujours exister : characterset, pastilles
       et demos de l'accueil s'y referent */
    if (main && familleCss(cssFamily, main) !== cssFamily) blocks.push(face(cssFamily, main));
  });
  fs.writeFileSync(CSS_FILE, head + "\n" + blocks.join("\n\n") + "\n");
  return blocks.length;
}

/* ---------- 3. mise a jour de fonts-data.js ---------- */
/* Ordre des graisses : par VARIANTE (ordre alphabetique), puis le
   long de l'AXE D'EPAISSEUR (maigre -> gras), le romain avant
   l'italique. C'est l'ordre du menu de l'editeur. */
function sortByAxis(files) {
  const variants = [...new Set(files.map((f) => f.variant || ""))]
    .sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  return files.slice().sort((a, b) => {
    const va = variants.indexOf(a.variant || "");
    const vb = variants.indexOf(b.variant || "");
    if (va !== vb) return va - vb;
    if (a.weight !== b.weight) return a.weight - b.weight;
    return (a.style === "italic" ? 1 : 0) - (b.style === "italic" ? 1 : 0);
  });
}

function stylesLiteral(files, baseFamily) {
  return "[\n" + sortByAxis(files).map((f) => {
    const fam = familleCss(baseFamily, f);
    return `      { label: ${JSON.stringify(f.label)}, variant: ${JSON.stringify(f.variant || "")}, ` +
           `cssFamily: ${JSON.stringify(fam)}, file: ${JSON.stringify(f.rel)}, ` +
           `weight: ${f.weight}, style: ${JSON.stringify(f.style)} }`;
  }).join(",\n") + "\n    ]";
}

const orphanWarnings = [];
const designersFound = [];
const designerMissing = [];

function updateData(byFont, newFamilies, fonts) {
  let src = fs.readFileSync(DATA_FILE, "utf8");
  const added = [];

  /* Bornes du bloc d'une fonte dans le fichier : de son "slug:"
     jusqu'au "slug:" suivant. Toute retouche se fait DANS ces
     bornes — une expression reguliere lancee sur le fichier entier
     deborde sur le bloc d'a cote quand le champ cherche manque. */
  function blockRange(text, slug) {
    const head = text.indexOf('slug: "' + slug + '"');
    if (head < 0) return null;
    const next = text.indexOf('\n    slug: "', head + 1);
    return { start: head, end: next < 0 ? text.length : next };
  }

  function editBlock(text, slug, fn) {
    const r = blockRange(text, slug);
    if (!r) return text;
    const before = text.slice(0, r.start);
    const block = text.slice(r.start, r.end);
    return before + fn(block) + text.slice(r.end);
  }

  /* styles des fontes existantes */
  fonts.forEach((f) => {
    const files = byFont.get(f.slug) || [];
    if (!files.length) return;

    /* Fichier principal : la graisse la plus proche du romain. Il
       sert au bouton de telechargement et a la lecture des
       metriques, donc il DOIT suivre les renommages. */
    const main = files.slice().sort((a, b) => {
      const score = (x) => Math.abs((x.weight || 400) - 400) + (x.style === "italic" ? 50 : 0);
      return score(a) - score(b);
    })[0];
    const zip = writeFamilyZip(f, files);

    /* on compare la signature COMPLETE (fichier, libelle, variante,
       famille CSS) : un simple renommage de variante ne change pas
       le chemin du fichier, il doit quand meme etre repercute */
    const sig = (label, variant, fam, file) => [file, label, variant || "", fam].join("~");
    const wasSig = (f.styles || [])
      .map((s) => sig(s.label, s.variant, s.cssFamily || f.cssFamily, s.file)).join("|");
    const nowSig = sortByAxis(files)
      .map((s) => sig(s.label, s.variant, familleCss(f.cssFamily, s), s.rel)).join("|");
    /* Designer : si la fiche ne dit rien (ou « A completer »), on
       prend celui que le dessinateur a inscrit dans le fichier.
       Ce controle est fait AVANT le raccourci de sortie ci-dessous :
       il ne depend pas d'un changement de graisses. */
    const PLACEHOLDER = /^(|a completer|à compléter|todo|-)$/i;
    if (PLACEHOLDER.test(String(f.designer || "").trim())) {
      const names = readNameTable(path.join(ROOT, main.rel));
      /* nameID 9 = Designer (le dessinateur), nameID 8 = Manufacturer
         (la fonderie). On prefere 9 ; a defaut on prend 8, et on dit
         lequel a servi pour que ce soit corrigeable. */
      const found = (names[9] || names[8] || "").trim();
      const fromField = names[9] ? "Designer (nameID 9)" : "Manufacturer (nameID 8)";
      if (found) {
        src = editBlock(src, f.slug, (b) => b.replace(/designer: "[^"]*"/, 'designer: ' + JSON.stringify(found)));
        designersFound.push(f.slug + " : " + found + " — lu dans " + fromField);
      } else {
        designerMissing.push(f.slug + " (" + path.basename(main.rel) + " ne declare ni Designer ni Manufacturer)");
      }
    }

    const stylesChanged = wasSig !== nowSig;
    const fileChanged = f.file !== main.rel;
    const zipChanged = (f.zip || null) !== zip;
    if (!stylesChanged && !fileChanged && !zipChanged) return;   /* designer deja traite plus haut */

    src = editBlock(src, f.slug, (block) => {
      let b = block;
      b = b.replace(/(styles: )\[[\s\S]*?\](,)/, (m, head, tail) => head + stylesLiteral(files, f.cssFamily) + tail);
      b = b.replace(/file: "[^"]*"/, 'file: ' + JSON.stringify(main.rel));
      b = b.replace(/variant: "[^"]*"/, 'variant: ' + JSON.stringify(main.label));

      const zipLine = "zip: " + (zip ? JSON.stringify(zip) : "null") + ",";
      if (/zip: (?:"[^"]*"|null),/.test(b)) b = b.replace(/zip: (?:"[^"]*"|null),/, zipLine);
      else b = b.replace(/(\n\s*)(familyKey: )/, (m, sp, k) => sp + zipLine + sp + k);
      return b;
    });

    const bits = [];
    if (stylesChanged) bits.push(files.length + " variante(s)");
    if (fileChanged) bits.push("fichier principal -> " + path.basename(main.rel));
    if (zipChanged) bits.push(zip ? "archive " + path.basename(zip) : "archive retiree");
    if (bits.length) added.push(f.slug + " : " + bits.join(", "));
  });

  /* nouvelles fontes */
  const created = [];
  newFamilies.forEach((files, prefix) => {
    const name = prefix.charAt(0) + prefix.slice(1).toLowerCase();
    const slug = slugify(name);
    if (fonts.some((f) => f.slug === slug)) {
      /* Une fonte porte deja ce slug mais son familyKey ne colle pas :
         on le dit au lieu de laisser le fichier de cote sans bruit. */
      orphanWarnings.push(
        files.map((x) => path.basename(x.rel)).join(", ") +
        ` -> la fonte "${slug}" existe deja mais son familyKey ne correspond pas ` +
        `(corrige familyKey dans fonts-data.js, ou renomme le fichier)`
      );
      return;
    }
    const main = files[0];
    const block = `  {
    slug: ${JSON.stringify(slug)},
    name: ${JSON.stringify(name)},
    variant: ${JSON.stringify(main.label)},
    category: "A completer",
    designer: "A completer",
    year: ${JSON.stringify(String(new Date().getFullYear()))},
    cssFamily: ${JSON.stringify(name)},
    file: ${JSON.stringify(main.rel)},
    demoText: ${JSON.stringify(name)},
    showDemo: true,
    demoScale: 1,
    inUse: false,
    pill: null,
    familyKey: ${JSON.stringify(prefix)},
    styles: ${stylesLiteral(files, name)},
    info: [
      { label: "GENESIS", body: "A completer." },
      { label: "FUTURE", body: "A completer." }
    ],
    infoEn: [
      { label: "GENESIS", body: "To be written." },
      { label: "FUTURE", body: "To be written." }
    ],
    editorDefaults: { size: 48, lineHeight: 1.25, letterSpacing: 0, color: "D9D9D9", bg: "191919", align: "left" },
    gridLayout: [
      { type: "editor", span: 2, content: {} },
      { type: "characterset", span: 2, content: {} },
      { type: "info", span: 2, content: {} },
      { type: "media", span: 2, content: {} }
    ]
  }
];`;
    src = src.replace(/\n\s*\}\n\];/, "\n  },\n" + block);
    created.push({ slug, name, files });
  });

  fs.writeFileSync(DATA_FILE, src);
  return { added, created };
}

/* ---------- travaux "in use" d'une fonte ----------
   fonts/<slug>/inUse/ contient les images/videos montrees quand on
   deplie la ligne de la fonte dans la section "Fonts in use" de
   l'accueil. Le manifeste garde le champ "text" deja saisi a la
   main pour chaque fichier : on ne l'ecrase jamais. */
const INUSE_README = `Depose ici les travaux realises avec cette fonte
(images jpg/png/webp/gif, videos mp4/webm/mov).

Ils apparaissent sur la page d'accueil, section "Fonts in use" :
la ligne de la fonte devient cliquable et se deplie sur ces
visuels. Dossier vide = pas de ligne du tout.

Pour legender un visuel, ouvre manifest.json et remplis le champ
"text" de la ligne correspondante. Ton texte est conserve quand tu
relances la mise a jour.

Un texte d'introduction commun : mets-le dans un fichier .txt
depose dans ce dossier.

L'ADRESSE DU PROJET : ouvre manifest.json et remplis le champ
"link" en haut du fichier, par exemple
  "link": "https://mon-projet.fr"
Cliquer la ligne de la fonte sur la page d'accueil ouvre cette
adresse. Ton texte est conserve quand tu relances la mise a jour.
`;

/* ============================================================
   DIMENSIONS D'UN MEDIA
   ------------------------------------------------------------
   On lit la largeur et la hauteur DANS le fichier, sans aucune
   bibliotheque : l'en-tete de chaque format les donne. Elles sont
   ecrites dans manifest.json (champs "w" et "h"), et le site s'en
   sert pour poser chaque media dans le module dont la forme
   RECADRE LE MOINS (voir render-grid.js).
   Format inconnu ou illisible : on ne met rien, et le site retombe
   sur une largeur tiree au sort comme avant.
   ============================================================ */
function mesurerMedia(fichier) {
  let d;
  try { d = fs.readFileSync(fichier); } catch (_e) { return null; }
  if (d.length < 32) return null;

  /* --- PNG --- */
  if (d[0] === 0x89 && d.toString("latin1", 1, 4) === "PNG") {
    return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
  }
  /* --- GIF --- */
  if (d.toString("latin1", 0, 3) === "GIF") {
    return { w: d.readUInt16LE(6), h: d.readUInt16LE(8) };
  }
  /* --- WEBP --- */
  if (d.toString("latin1", 0, 4) === "RIFF" && d.toString("latin1", 8, 12) === "WEBP") {
    const type = d.toString("latin1", 12, 16);
    if (type === "VP8X") return { w: (d.readUIntLE(24, 3) & 0xffffff) + 1, h: (d.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (type === "VP8 ") return { w: d.readUInt16LE(26) & 0x3fff, h: d.readUInt16LE(28) & 0x3fff };
    if (type === "VP8L") {
      const b = d.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  /* --- JPEG : on avance de marqueur en marqueur jusqu'a un SOF --- */
  if (d[0] === 0xff && d[1] === 0xd8) {
    let i = 2;
    while (i + 9 < d.length) {
      if (d[i] !== 0xff) { i += 1; continue; }
      const m = d[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = d.readUInt16BE(i + 2);
      /* SOF0..SOF15, sauf les marqueurs qui n'en sont pas */
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: d.readUInt16BE(i + 5), w: d.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  /* --- MP4 / MOV : on descend moov > trak > tkhd --- */
  if (d.toString("latin1", 4, 8) === "ftyp") {
    let trouve = null;
    const boites = (debut, fin) => {
      let i = debut;
      while (i + 8 <= fin) {
        let taille = d.readUInt32BE(i);
        const nom = d.toString("latin1", i + 4, i + 8);
        let tete = 8;
        if (taille === 1) { taille = Number(d.readBigUInt64BE(i + 8)); tete = 16; }
        if (taille < tete || i + taille > fin) return;
        if (nom === "moov" || nom === "trak" || nom === "mdia") boites(i + tete, i + taille);
        else if (nom === "tkhd") {
          const version = d[i + tete];
          /* apres l'en-tete : version+drapeaux (4), les dates et la
             duree (20 en version 0, 32 en version 1), un bloc de 16,
             la matrice de 36 — puis largeur et hauteur, en 16.16 */
          const base = i + tete + 4 + (version === 1 ? 32 : 20) + 16 + 36;
          const w = d.readUInt32BE(base) / 65536;
          const h = d.readUInt32BE(base + 4) / 65536;
          /* on garde la plus grande piste : c'est l'image */
          if (w > 1 && h > 1 && (!trouve || w * h > trouve.w * trouve.h)) {
            trouve = { w: Math.round(w), h: Math.round(h) };
          }
        }
        i += taille;
      }
    };
    boites(0, d.length);
    return trouve;
  }
  return null;
}

const brokenManifests = [];

function inUseFor(slug) {
  const dir = path.join(PAGES_DIR, slug, "inUse");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const readme = path.join(dir, "README.txt");
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, INUSE_README);

  /* textes deja saisis, repris par nom de fichier */
  const manifestPath = path.join(dir, "manifest.json");
  const previous = {};
  let prevLink = "";
  if (fs.existsSync(manifestPath)) {
    const raw = fs.readFileSync(manifestPath, "utf8");
    try {
      const old = JSON.parse(raw.replace(/,\s*([\]}])/g, "$1"));
      const list = Array.isArray(old) ? old : (old.items || []);
      if (!Array.isArray(old) && typeof old.link === "string") prevLink = old.link;
      list.forEach((e) => { if (e && e.file) previous[e.file] = e.text || ""; });
    } catch (_e) {
      /* Manifeste illisible (souvent un guillemet non echappe dans un
         texte). On NE PERD RIEN : l'original est mis de cote avant
         d'etre reecrit, et on previent. */
      const backup = path.join(dir, "manifest.illisible.json");
      try { fs.writeFileSync(backup, raw); } catch (_e2) {}
      brokenManifests.push(path.relative(ROOT, backup));
    }
  }

  const names = fs.readdirSync(dir).filter((n) => !n.startsWith("."));

  /* texte d'intro : premier .txt du dossier (hors README) */
  let intro = "";
  const txt = names.find((n) => /\.txt$/i.test(n) && n.toLowerCase() !== "readme.txt");
  if (txt) intro = fs.readFileSync(path.join(dir, txt), "utf8").trim();

  const items = names
    .filter((n) => KIND_BY_EXT[path.extname(n).toLowerCase()])
    .sort()
    .map((n) => {
      const kind = KIND_BY_EXT[path.extname(n).toLowerCase()];
      return { file: n, kind, text: previous[n] || "" };
    });

  /* "link" = l'adresse du projet. La ligne "Fonts in use" de la
     page d'accueil y mene. Saisi a la main, jamais ecrase. */
  fs.writeFileSync(manifestPath, JSON.stringify({ text: intro, link: prevLink, items }, null, 2) + "\n");
  return { text: intro, link: prevLink, items };
}

function writeInUse(fonts) {
  const map = {};
  let total = 0;
  fonts.forEach((f) => {
    const data = inUseFor(f.slug);
    if (data.items.length) { map[f.slug] = data; total += data.items.length; }
  });

  const body = `/* ============================================================
   INUSE-DATA.JS — TRAVAUX MONTRES DANS "FONTS IN USE"
   ------------------------------------------------------------
   FICHIER GENERE : ne pas editer a la main.
   Reecrit par  node scripts/sync-fonts.js  a partir de ce qui se
   trouve dans fonts/<slug>/inUse/.

   Une fonte sans fichier dans ce dossier n'apparait PAS dans la
   section "Fonts in use" de la page d'accueil.
   Les legendes se saisissent dans fonts/<slug>/inUse/manifest.json
   (champ "text" de chaque ligne) et sont conservees.
   ============================================================ */

window.BS_INUSE = ${JSON.stringify(map, null, 2)};
`;
  fs.writeFileSync(INUSE_FILE, body);
  return { fonts: Object.keys(map).length, items: total };
}

/* ---------- vignettes video des auteurs ---------- */
const noAccent = (t) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");

/* Cles possibles pour "Enzo Cetera", par ordre de preference :
   ENZOC (prenom + initiale du nom), ENZOCETERA, ENZO, EC. */
function faceKeys(designer) {
  const parts = String(designer || "").trim().split(/\s+/).filter(Boolean).map(noAccent);
  if (!parts.length) return [];
  const first = parts[0];
  const rest = parts.slice(1).join("");
  const keys = [];
  if (rest) keys.push(first + rest[0], first + rest);
  keys.push(first);
  if (rest) keys.push(parts.map((p) => p[0]).join(""));
  return keys;
}

/* Texte de la bulle : paragraphes, puis un bloc de contacts apres
   une ligne « --- ». Voir assets/authorfaces/LISEZ-MOI.txt. */
function readBubble(file) {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const cut = raw.split(/^\s*---\s*$/m);
  const body = cut[0].trim();
  const contacts = (cut[1] || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const paragraphs = body.split(/\n{2,}/).map((t) => t.replace(/\n/g, " ").trim()).filter(Boolean);
  return { paragraphs, contacts };
}

function writeFaces(fonts) {
  if (!fs.existsSync(FACES_DIR)) fs.mkdirSync(FACES_DIR, { recursive: true });

  const available = new Map(); // CLE -> chemin
  fs.readdirSync(FACES_DIR)
    .filter((n) => !n.startsWith(".") && VIDEO_EXT.includes(path.extname(n).toLowerCase()))
    .forEach((n) => available.set(noAccent(path.basename(n, path.extname(n))), "assets/authorfaces/" + n));

  const designers = [...new Set(fonts.map((f) => f.designer).filter(Boolean))].sort();
  const map = {};
  const bubbles = {};
  const bubblesEn = {};
  const missing = [];
  designers.forEach((d) => {
    const keys = faceKeys(d);
    const hit = keys.find((k) => available.has(k));
    if (hit) map[d] = available.get(hit);
    else missing.push({ designer: d, expected: keys[0] });

    /* texte de la bulle du designer, en francais puis en anglais */
    for (const k of keys) {
      const txt = readBubble(path.join(FACES_DIR, k + ".txt"));
      if (txt) { bubbles[d] = txt; break; }
    }
    for (const k of keys) {
      const txt = readBubble(path.join(FACES_DIR, k + ".en.txt"));
      if (txt) { bubblesEn[d] = txt; break; }
    }
  });

  const foundry = readBubble(path.join(FACES_DIR, "bstype.txt"));
  const foundryEn = readBubble(path.join(FACES_DIR, "bstype.en.txt"));

  const body = `/* ============================================================
   FACES-DATA.JS — VIGNETTES VIDEO DES AUTEURS
   ------------------------------------------------------------
   FICHIER GENERE : ne pas editer a la main.
   Reecrit par  node scripts/sync-fonts.js  a partir des videos
   deposees dans assets/authorfaces/.

   Nommage attendu : PRENOM + initiale du nom, en majuscules.
     Enzo Cetera   -> ENZOC.mp4
     Lucas Pernet  -> LUCASP.mp4
   (ENZOCETERA.mp4, ENZO.mp4 ou EC.mp4 marchent aussi.)

   La page d'une fonte affiche la vignette de son auteur ; les
   autres pages affichent la vignette par defaut ci-dessous.
   Lecture et detourage du fond vert : assets/js/face-video.js
   ============================================================ */

window.BS_FACE_DEFAULT = ${JSON.stringify(DEFAULT_FACE)};

window.BS_FACES = ${JSON.stringify(map, null, 2)};

/* Textes des bulles : celui de la fonderie (accueil) et un par
   auteur (page de sa fonte). Ecrits dans assets/authorfaces/*.txt */
window.BS_FOUNDRY = ${JSON.stringify(foundry, null, 2)};

window.BS_BUBBLES = ${JSON.stringify(bubbles, null, 2)};

/* Memes textes en anglais : assets/authorfaces/<CLE>.en.txt et
   bstype.en.txt. Absents = la bulle reste en francais. */
window.BS_FOUNDRY_EN = ${JSON.stringify(foundryEn, null, 2)};

window.BS_BUBBLES_EN = ${JSON.stringify(bubblesEn, null, 2)};
`;
  fs.writeFileSync(FACES_FILE, body);
  return {
    count: Object.keys(map).length,
    missing,
    total: designers.length,
    texts: Object.keys(bubbles).length,
    textsEn: Object.keys(bubblesEn).length,
    foundry: !!foundry,
    foundryEn: !!foundryEn
  };
}

/* ---------- tampon de version sur les CSS/JS ----------
   Les navigateurs gardent longtemps en cache les feuilles de style
   et les scripts. On estampille chaque lien avec l'heure de la
   derniere mise a jour : plus besoin de vider le cache a la main
   apres avoir lance ce script. */
function stampAssets(file, stamp) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const after = before.replace(
    /(href|src)="((?:\.\.\/)*assets\/(?:css|js)\/[^"?]+)(\?v=\d+)?"/g,
    (m, attr, url) => `${attr}="${url}?v=${stamp}"`
  );
  if (after === before) return false;
  fs.writeFileSync(file, after);
  return true;
}

/* Chaque page doit charger les textes d'interface et les textes
   d'essai. On les insere juste apres la source de donnees. */
function ensureCommonScripts(file) {
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, "utf8");
  const m = html.match(/( *)<script src="((?:\.\.\/)*assets\/js\/)fonts-data\.js(\?v=\d+)?"><\/script>\n/);
  if (!m) return false;
  const [line, indent, prefix, ver] = [m[0], m[1], m[2], m[3] || ""];
  let add = "";
  if (!html.includes("assets/js/i18n.js")) {
    add += indent + "<!-- Textes de l'interface en francais / anglais (bouton FR/EN) -->\n"
         + indent + '<script src="' + prefix + 'i18n.js' + ver + '"></script>\n';
  }
  if (!html.includes("assets/js/samples.js")) {
    add += indent + "<!-- Textes d'essai, communs a toutes les fontes -->\n"
         + indent + '<script src="' + prefix + 'samples.js' + ver + '"></script>\n';
  }
  if (!html.includes("assets/js/idle-glitch.js")) {
    const vendor = prefix.replace("assets/js/", "assets/vendor/");
    add += indent + "<!-- Effet de dereglement quand on ne fait rien -->\n"
         + indent + '<script src="' + vendor + 'p5.min.js"></script>\n'
         + indent + '<script src="' + prefix + 'page-snapshot.js' + ver + '"></script>\n'
         + indent + '<script src="' + prefix + 'idle-glitch.js' + ver + '"></script>\n';
  }
  if (!html.includes("assets/js/glitch-logo.js")) {
    add += indent + "<!-- Le logo joue par-dessus le dereglement -->\n"
         + indent + '<script src="' + prefix + 'glitch-logo.js' + ver + '"></script>\n';
  }
  if (!html.includes("assets/js/footer.js")) {
    add += indent + "<!-- Pied de page, le meme sur toutes les pages -->\n"
         + indent + '<script src="' + prefix + 'footer.js' + ver + '"></script>\n';
  }
  if (!add) return false;
  fs.writeFileSync(file, html.replace(line, line + add));
  return true;
}

/* L'ecran de chargement doit etre le PREMIER script de la page :
   il pose son fond noir avant que quoi que ce soit se dessine. Il
   va donc dans le <head>, juste apres les feuilles de style. */
function ensureBootScript(file) {
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("assets/js/boot.js")) return false;
  const m = html.match(/( *)<link rel="stylesheet" href="((?:\.\.\/)*assets\/css\/)[^"]*"[^>]*>\n(?![\s\S]*<link rel="stylesheet")/);
  if (!m) return false;
  const indent = m[1];
  const prefix = m[2].replace("assets/css/", "assets/js/");
  const add = "\n" + indent + "<!-- Ecran de chargement, puis ouverture du site -->\n"
            + indent + '<script src="' + prefix + 'boot.js"></script>\n';
  fs.writeFileSync(file, html.replace(m[0], m[0] + add));
  return true;
}

/* la page d'accueil doit charger les travaux "in use" */
function ensureInUseScript(file) {
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("assets/js/inuse-data.js")) return false;
  const anchor = '<script src="assets/js/fonts-data.js"></script>';
  if (!html.includes(anchor)) return false;
  html = html.replace(anchor, anchor + '\n  <script src="assets/js/inuse-data.js"></script>');
  fs.writeFileSync(file, html);
  return true;
}

/* ---------- chaque page doit charger la vignette ---------- */
function ensureFaceScripts(file) {
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("assets/js/face-video.js")) return false;

  const scripts = html.match(/(\s*)<script src="((?:\.\.\/)*assets\/js\/)[^"]+\.js"><\/script>/g);

  let prefix;
  let indent = "\n  ";
  let anchor = null;

  if (scripts && scripts.length) {
    anchor = scripts[scripts.length - 1];
    prefix = (anchor.match(/src="((?:\.\.\/)*assets\/js\/)/) || [])[1];
    indent = (anchor.match(/^\s*/) || ["\n  "])[0];
  } else {
    /* page sans aucun script (ex: about.html) : on deduit le chemin
       des feuilles de style et on insere avant </body> */
    const css = html.match(/href="((?:\.\.\/)*assets\/)css\//);
    if (!css) return false;
    prefix = css[1] + "js/";
  }

  const add =
    `${indent}<!-- Vignette video de l'auteur, collee en bas a droite -->` +
    `${indent}<script src="${prefix}faces-data.js"></script>` +
    `${indent}<script src="${prefix}face-video.js"></script>`;

  if (anchor) html = html.replace(anchor, anchor + add);
  else html = html.replace(/(\s*)<\/body>/, add + "$1</body>");

  fs.writeFileSync(file, html);
  return true;
}

/* ---------- pastilles de l'accueil ----------
   Toutes les fontes doivent avoir une pastille. La POSITION est
   tiree au sort a chaque chargement par render-home.js ; ici on
   s'assure juste que le champ n'est pas null. */
function ensurePills(fonts) {
  let src = fs.readFileSync(DATA_FILE, "utf8");
  let added = 0;
  fonts.forEach((f) => {
    if (f.pill) return;
    const re = new RegExp(`(slug: "${f.slug}"[\\s\\S]*?)pill: null,`);
    if (re.test(src)) {
      src = src.replace(re, (m, head) => head + 'pill: { top: "40%", left: "40%" },');
      added += 1;
    }
  });
  if (added) fs.writeFileSync(DATA_FILE, src);
  return added;
}

/* ---------- 4. dossier de la page specimen ---------- */
const MEDIA_README = `Depose ici les images/videos de cette fonte (jpg, png, webp,
gif, mp4, webm, mov). Elles apparaissent dans les zones "media"
de la page, choisissables dans le sous-menu du menu de zone.

Mode de lecture des videos : voir playback.txt.
Apres tout ajout/retrait, relancer depuis la racine :

  node scripts/sync-fonts.js
`;

const PLAYBACK_README = `# Mode de lecture des videos de ce dossier.
# Une ligne par fichier :   ma-video.mp4 = scrub
# Modes : scrub (defaut, la video suit le scroll) | loop | once | static
`;

function ensurePage(slug) {
  const dir = path.join(PAGES_DIR, slug);
  const created = !fs.existsSync(dir);
  fs.mkdirSync(path.join(dir, "media"), { recursive: true });

  const index = path.join(dir, "index.html");
  if (!fs.existsSync(index) && fs.existsSync(TEMPLATE)) {
    fs.writeFileSync(index, fs.readFileSync(TEMPLATE, "utf8").replace(/__SLUG__/g, slug));
  }
  const readme = path.join(dir, "media", "README.txt");
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, MEDIA_README);
  const pb = path.join(dir, "media", "playback.txt");
  if (!fs.existsSync(pb)) fs.writeFileSync(pb, PLAYBACK_README);
  return created;
}

/* ---------- 5. manifestes media ---------- */
const KIND_BY_EXT = {
  ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image", ".svg": "image",
  ".gif": "gif", ".mp4": "video", ".webm": "video", ".mov": "video"
};
const VALID_MODES = ["scrub", "loop", "once", "static"];

/* « Carre45Fusion » -> « Carre 45 Fusion » : lisible dans un menu */
const pretty = (t) =>
  String(t)
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

function manifestFor(slug) {
  const dir = path.join(PAGES_DIR, slug, "media");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const modes = {};
  const pb = path.join(dir, "playback.txt");
  if (fs.existsSync(pb)) {
    fs.readFileSync(pb, "utf8").split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([^=#]+?)\s*=\s*([a-z]+)\s*$/i);
      if (m && VALID_MODES.includes(m[2].toLowerCase())) modes[m[1].trim()] = m[2].toLowerCase();
    });
  }

  const files = fs.readdirSync(dir)
    .filter((n) => !n.startsWith(".") && !["manifest.json", "readme.txt", "playback.txt"].includes(n.toLowerCase()))
    .filter((n) => KIND_BY_EXT[path.extname(n).toLowerCase()])
    .sort()
    .map((n) => {
      const kind = KIND_BY_EXT[path.extname(n).toLowerCase()];
      const e = { file: n, kind };
      if (kind === "video") e.playback = modes[n] || "scrub";
      /* dimensions lues dans le fichier : elles servent a choisir la
         largeur de module qui recadre le moins */
      const taille = mesurerMedia(path.join(dir, n));
      if (taille) { e.w = taille.w; e.h = taille.h; }
      return e;
    });

  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(files, null, 2) + "\n");
  return files.length;
}

/* ---------- go ---------- */
const files = readFontFiles();
if (!files.length) {
  console.log("Aucun fichier de police dans assets/fonts/. Rien a faire.");
  process.exit(0);
}

/* fontes dont le fichier a ete retire de assets/fonts/ : on nettoie
   avant tout le reste, puis on relit la liste a jour */
const firstPass = readFonts();
const removed = removeMissingFonts(assign(files, firstPass).byFont, firstPass);

const fonts = readFonts();
const { byFont, newFamilies } = assign(files, fonts);
const { added, created } = updateData(byFont, newFamilies, fonts);

/* relire apres mise a jour pour generer le CSS complet */
const finalFonts = readFonts();
const cssEntries = finalFonts.map((f) => {
  const own = (f.styles || []).map((s) => files.find((x) => x.rel === s.file)).filter(Boolean);
  return {
    cssFamily: f.cssFamily,
    files: own,
    main: own.find((x) => x.rel === f.file) || own[0] || null
  };
});
const faces = writeCss(cssEntries);

let pagesCreated = 0;
let media = 0;
finalFonts.forEach((f) => {
  if (ensurePage(f.slug)) pagesCreated += 1;
  media += manifestFor(f.slug);
});

/* pastilles, travaux "in use", vignettes des auteurs */
const deadZips = cleanZips(finalFonts);
const pillsAdded = ensurePills(finalFonts);
const inUseInfo = writeInUse(finalFonts);
const facesInfo = writeFaces(finalFonts);
const pages = [
  path.join(ROOT, "index.html"),
  TEMPLATE
].concat(finalFonts.map((f) => path.join(PAGES_DIR, f.slug, "index.html")));
let wired = 0;
pages.forEach((f) => { if (ensureFaceScripts(f)) wired += 1; });
pages.forEach((f) => { if (ensureCommonScripts(f)) wired += 1; });
pages.forEach((f) => { if (ensureBootScript(f)) wired += 1; });
if (ensureInUseScript(path.join(ROOT, "index.html"))) wired += 1;

const stamp = Date.now();
let stamped = 0;
pages.forEach((f) => { if (stampAssets(f, stamp)) stamped += 1; });

console.log(`Polices trouvees : ${files.length} fichier(s)`);
console.log(`fonts.css        : ${faces} regle(s) @font-face`);
added.forEach((a) => console.log(`  + variantes     : ${a}`));
removed.forEach((r) => console.log(`  - FONTE RETIREE  : ${r}`));
if (removed.length) {
  console.log("    (si tu as seulement RENOMME les fichiers, le contenu de la page est");
  console.log("     dans fonts/_corbeille/ : remets-le dans le dossier de la nouvelle fonte)");
}
deadZips.forEach((z) => console.log(`  - archive orpheline supprimee : ${z}`));
created.forEach((c) => console.log(`  + NOUVELLE FONTE: ${c.slug} (${c.files.length} fichier(s)) — completer category/designer/info dans fonts-data.js`));
/* fichiers disparus : on previent, on ne supprime rien */
const present = new Set(files.map((f) => f.rel));
finalFonts.forEach((f) => {
  const missing = (f.styles || []).map((s) => s.file).filter((x) => !present.has(x));
  if (missing.length) console.log(`  ! ${f.slug} : fichier(s) absent(s) de assets/fonts/ -> ${missing.join(", ")}`);
});
console.log(`Pages specimen   : ${finalFonts.length} (dont ${pagesCreated} creee(s))`);
console.log(`Media indexes    : ${media}`);
console.log(`Cache navigateur : ${stamped} page(s) reestampillees (plus besoin de vider le cache)`);
console.log(`Pastilles accueil: ${finalFonts.length} fonte(s)` + (pillsAdded ? ` (${pillsAdded} ajoutee(s))` : ""));
console.log(`Fonts in use     : ${inUseInfo.fonts} fonte(s), ${inUseInfo.items} visuel(s)`);
brokenManifests.forEach((b) => console.log(`  ! manifeste illisible, copie mise de cote -> ${b}`));
orphanWarnings.forEach((w) => console.log(`  ! fichier non rattache : ${w}`));
designersFound.forEach((d) => console.log(`  + designer lu dans la police : ${d}`));
designerMissing.forEach((d) => console.log(`  ! designer introuvable pour ${d} — a saisir dans fonts-data.js`));
console.log(`Textes de bulle  : ${facesInfo.texts}/${facesInfo.total} auteur(s)` + (facesInfo.foundry ? " + fonderie" : " — bstype.txt MANQUANT"));
console.log(`  version anglaise: ${facesInfo.textsEn}/${facesInfo.total} auteur(s)` + (facesInfo.foundryEn ? " + fonderie" : " — bstype.en.txt manquant"));
console.log(`Vignettes auteurs: ${facesInfo.count}/${facesInfo.total} auteur(s)` + (wired ? ` (branchees sur ${wired} page(s))` : ""));
facesInfo.missing.forEach((m) => console.log(`  ! pas de video pour ${m.designer} -> attendu assets/authorfaces/${m.expected}.mp4`));
if (!fs.existsSync(path.join(ROOT, DEFAULT_FACE))) console.log(`  ! vignette par defaut absente -> ${DEFAULT_FACE}`);
