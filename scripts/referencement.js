/* ============================================================
   REFERENCEMENT.JS — ETRE TROUVE SUR INTERNET
   ------------------------------------------------------------
   Appele par scripts/sync-fonts.js (donc par Maj.command) : rien
   a lancer a part. A chaque mise a jour il reecrit :

     - dans chaque page, le bloc « REFERENCEMENT » du <head> : la
       description lue par Google, l'adresse officielle de la page
       (canonical), l'annonce de la version anglaise (hreflang), la
       carte de partage (Open Graph : Instagram, WhatsApp, iMessage,
       Discord, LinkedIn...) et la fiche lisible par les moteurs
       (JSON-LD, schema.org) ;
     - le titre des pages de fonte, et leur titre invisible (h1)
       pour les lecteurs d'ecran et les moteurs ;
     - sitemap.xml : la liste de toutes les pages, pour Google ;
     - robots.txt : ce que les moteurs ont le droit de lire ;
     - assets/partage/*.jpg : l'image qui s'affiche quand on partage
       un lien. Une par fonte, le nom ecrit DANS la fonte, et une
       pour le site. Fabriquees sur le Mac par Quick Look (qlmanage)
       et sips, deux outils livres avec macOS. Sans eux (autre
       systeme), les images deja faites restent, et une fonte
       nouvelle prend l'image du site.

   L'adresse du site est lue dans le fichier CNAME (www.bstype.fr).
   Les liens du site (Instagram...) et les fondateurs sont dans
   assets/js/fonts-data.js, bloc window.BS_SITE.

   Ne rien modifier A LA MAIN entre les commentaires
   « REFERENCEMENT » des pages : c'est reecrit a chaque mise a jour.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

/* Les blocs ecrits dans les pages sont encadres par deux
   commentaires : c'est ce qui permet de les reecrire a chaque
   mise a jour sans toucher au reste. */
const debut = (nom) => "<!-- " + nom + " : ecrit par Maj.command (scripts/referencement.js), ne pas modifier ici -->";
const fin = (nom) => "<!-- /" + nom + " -->";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Coupe proprement a ~160 signes : au-dela, Google tronque. */
function couper(texte, max) {
  const t = String(texte).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const bout = t.slice(0, max - 1);
  return bout.slice(0, bout.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
}

const aRemplir = (s) => !s || /^a completer|^to be written/i.test(String(s).trim());

/* ============================================================
   LARGEUR D'UN TEXTE DANS UNE FONTE
   ------------------------------------------------------------
   Pour que le nom de la fonte tienne dans l'image de partage, on
   lit la chasse de chaque lettre dans le fichier (tables cmap,
   hmtx, head, hhea). Resultat en « em » (1 = le corps).
   ============================================================ */
function tables(buf) {
  const n = buf.readUInt16BE(4);
  const out = {};
  for (let i = 0; i < n; i += 1) {
    const r = 12 + i * 16;
    out[buf.toString("latin1", r, r + 4)] = buf.readUInt32BE(r + 8);
  }
  return out;
}

function glypheDe(buf, cmap, code) {
  const n = buf.readUInt16BE(cmap + 2);
  let f4 = -1, f12 = -1;
  for (let i = 0; i < n; i += 1) {
    const r = cmap + 4 + i * 8;
    const p = buf.readUInt16BE(r), e = buf.readUInt16BE(r + 2);
    const o = cmap + buf.readUInt32BE(r + 4);
    const format = buf.readUInt16BE(o);
    if (format === 12 && (p === 3 || p === 0)) f12 = o;
    if (format === 4 && ((p === 3 && e === 1) || p === 0)) f4 = o;
  }
  if (f12 >= 0) {
    const groupes = buf.readUInt32BE(f12 + 12);
    for (let g = 0; g < groupes; g += 1) {
      const r = f12 + 16 + g * 12;
      const a = buf.readUInt32BE(r), b = buf.readUInt32BE(r + 4);
      if (code >= a && code <= b) return buf.readUInt32BE(r + 8) + (code - a);
    }
    return 0;
  }
  if (f4 < 0 || code > 0xffff) return 0;
  const seg = buf.readUInt16BE(f4 + 6) / 2;
  const fins = f4 + 14, debuts = fins + seg * 2 + 2;
  const deltas = debuts + seg * 2, decalages = deltas + seg * 2;
  for (let i = 0; i < seg; i += 1) {
    const fin = buf.readUInt16BE(fins + i * 2);
    if (code > fin) continue;
    const debut = buf.readUInt16BE(debuts + i * 2);
    if (code < debut) return 0;
    const delta = buf.readInt16BE(deltas + i * 2);
    const dec = buf.readUInt16BE(decalages + i * 2);
    if (!dec) return (code + delta) & 0xffff;
    const g = buf.readUInt16BE(decalages + i * 2 + dec + (code - debut) * 2);
    return g ? (g + delta) & 0xffff : 0;
  }
  return 0;
}

function largeurEm(fichier, texte) {
  try {
    const buf = fs.readFileSync(fichier);
    const t = tables(buf);
    if (!t.cmap || !t.hmtx || !t.head || !t.hhea) return null;
    const upm = buf.readUInt16BE(t.head + 18);
    const nMetriques = buf.readUInt16BE(t.hhea + 34);
    let total = 0;
    for (const ch of texte) {
      const g = glypheDe(buf, t.cmap, ch.codePointAt(0));
      const i = Math.min(g, nMetriques - 1);
      total += buf.readUInt16BE(t.hmtx + i * 4);
    }
    return total / upm;
  } catch (_e) {
    return null;
  }
}

/* ============================================================
   IMAGES DE PARTAGE (1200 x 630)
   ------------------------------------------------------------
   On ecrit une image SVG qui EMBARQUE les fichiers de police, puis
   Quick Look la dessine et sips la recadre et la passe en JPEG.
   PIEGE : Quick Look ne rend que des vignettes CARREES. Le dessin
   est donc pose au milieu d'un carre de 1200 x 1200, et sips en
   garde la bande centrale de 630 px.
   Une empreinte de chaque image (assets/partage/empreintes.json)
   evite de les refaire quand rien n'a change.
   ============================================================ */
const MIME = { ".otf": "font/otf", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2" };

function fontePourSvg(nom, fichier) {
  const data = fs.readFileSync(fichier).toString("base64");
  const mime = MIME[path.extname(fichier).toLowerCase()] || "font/otf";
  return "@font-face { font-family: " + nom + "; src: url(data:" + mime + ";base64," + data + "); }";
}

function svgPartage(o) {
  /* o : { titre, fichierTitre, bas, fichierMono, domaine } */
  const L = 1200, H = 630, marge = 64;
  const largeur = o.fichierTitre ? largeurEm(o.fichierTitre, o.titre) : null;
  const corps = Math.round(Math.min(230, largeur ? (L - 2 * marge) / largeur : 150));
  const base = Math.round(H / 2 + corps * 0.33);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 -285 1200 1200">',
    "<style>",
    fontePourSvg("Titre", o.fichierTitre || o.fichierMono),
    fontePourSvg("Mono", o.fichierMono),
    "</style>",
    '<rect y="-285" width="1200" height="1200" fill="#191919"/>',
    '<text x="' + marge + '" y="110" font-family="Mono" font-size="44" fill="#9dff00">BS.type</text>',
    '<text x="' + marge + '" y="' + base + '" font-family="Titre" font-size="' + corps + '" fill="#d9d9d9">' + esc(o.titre) + "</text>",
    '<text x="' + marge + '" y="560" font-family="Mono" font-size="30" fill="#ff5100">' + esc(o.bas) + "</text>",
    '<text x="' + (L - marge) + '" y="560" text-anchor="end" font-family="Mono" font-size="26" fill="#d9d9d9" fill-opacity="0.6">' + esc(o.domaine) + "</text>",
    "</svg>"
  ].join("\n");
}

function dessiner(svg, sortie) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "bstype-partage-"));
  try {
    const src = path.join(dossier, "partage.svg");
    fs.writeFileSync(src, svg);
    execFileSync("qlmanage", ["-t", "-s", "1200", "-o", dossier, src], { stdio: "ignore" });
    const png = src + ".png";
    if (!fs.existsSync(png)) return false;
    execFileSync("sips", ["-c", "630", "1200", "-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", sortie], { stdio: "ignore" });
    return fs.existsSync(sortie);
  } catch (_e) {
    return false;
  } finally {
    fs.rmSync(dossier, { recursive: true, force: true });
  }
}

/* ============================================================
   LE BLOC DU <head>
   ============================================================ */
function blocHead(o) {
  /* o : { url, titre, description, image, imageAlt, icones, manifeste, jsonld, avecDescription } */
  const l = [];
  if (o.avecDescription) l.push('<meta name="description" content="' + esc(o.description) + '" />');
  l.push('<link rel="canonical" href="' + o.url + '" />');
  l.push('<link rel="alternate" hreflang="fr" href="' + o.url + '" />');
  l.push('<link rel="alternate" hreflang="en" href="' + o.url + '?lang=en" />');
  l.push('<link rel="alternate" hreflang="x-default" href="' + o.url + '" />');
  l.push('<meta name="theme-color" content="#191919" />');
  l.push('<link rel="apple-touch-icon" href="' + o.icones + 'apple-touch-icon.png" />');
  l.push('<link rel="manifest" href="' + o.manifeste + '" />');
  l.push('<meta property="og:type" content="website" />');
  l.push('<meta property="og:site_name" content="BS.type" />');
  l.push('<meta property="og:title" content="' + esc(o.titre) + '" />');
  l.push('<meta property="og:description" content="' + esc(o.description) + '" />');
  l.push('<meta property="og:url" content="' + o.url + '" />');
  l.push('<meta property="og:image" content="' + o.image + '" />');
  l.push('<meta property="og:image:width" content="1200" />');
  l.push('<meta property="og:image:height" content="630" />');
  l.push('<meta property="og:image:alt" content="' + esc(o.imageAlt) + '" />');
  l.push('<meta property="og:locale" content="fr_FR" />');
  l.push('<meta property="og:locale:alternate" content="en_GB" />');
  l.push('<meta name="twitter:card" content="summary_large_image" />');
  l.push('<script type="application/ld+json">' + JSON.stringify(o.jsonld).replace(/</g, "\\u003c") + "</script>");
  return l.map((x) => "  " + x).join("\n");
}

/* Remplace (ou pose, juste apres l'ancre) le bloc « nom ». */
function poserBloc(html, nom, contenu, ancre, indent) {
  const echap = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("[ \\t]*" + echap(debut(nom)) + "[\\s\\S]*?" + echap(fin(nom)) + "\\n?");
  const bloc = indent + debut(nom) + "\n" + contenu + "\n" + indent + fin(nom) + "\n";
  /* remplacement par fonction : un « $ » dans un texte serait lu
     comme une consigne de remplacement */
  if (re.test(html)) return html.replace(re, () => bloc);
  return html.replace(ancre, (m) => m + bloc);
}

/* ============================================================
   TOUT ECRIRE
   ============================================================ */
function ecrire({ ROOT, PAGES_DIR, fonts, site, i18nTitreFonte }) {
  const rapport = { pages: 0, images: 0, imagesManquantes: [], outils: true, domaine: null };
  let domaine = "";
  try { domaine = fs.readFileSync(path.join(ROOT, "CNAME"), "utf8").trim(); } catch (_e) {}
  if (!domaine) { rapport.domaine = null; return rapport; }
  rapport.domaine = domaine;
  const SITE = "https://" + domaine.replace(/\/+$/, "") + "/";
  const infos = site || {};

  /* ---- images de partage ---- */
  const dossierPartage = path.join(ROOT, "assets", "partage");
  fs.mkdirSync(dossierPartage, { recursive: true });
  const fichierEmpreintes = path.join(dossierPartage, "empreintes.json");
  let empreintes = {};
  try { empreintes = JSON.parse(fs.readFileSync(fichierEmpreintes, "utf8")); } catch (_e) {}
  const mono = path.join(ROOT, "assets", "fonts", "BSMONO-Regular.otf");
  const monoOk = fs.existsSync(mono);

  function image(nom, svg) {
    const sortie = path.join(dossierPartage, nom + ".jpg");
    const h = crypto.createHash("sha1").update(svg).digest("hex");
    if (empreintes[nom] === h && fs.existsSync(sortie)) return true;
    if (!dessiner(svg, sortie)) { rapport.outils = false; return fs.existsSync(sortie); }
    empreintes[nom] = h;
    rapport.images += 1;
    return true;
  }

  const imageSite = monoOk && image("bstype", svgPartage({
    titre: "BS.type",
    fichierTitre: mono,
    fichierMono: mono,
    bas: "FONDERIE FRANCAISE, OPEN SOURCE",
    domaine: domaine
  }));

  /* ---- descriptions ---- */
  const descriptionSite =
    "BS.type, fonderie de caractères française, indépendante et open source : " +
    "des polices libres et gratuites, à essayer en ligne et à télécharger.";

  /* Les categories de fonts-data.js sont ecrites en anglais : on
     les dit en francais dans la description. Une categorie absente
     de la liste est reprise telle quelle. */
  const GENRES = {
    sans: "sans empattements", serif: "à empattements", mono: "à chasse fixe",
    display: "de titrage", modular: "modulaire", script: "script",
    blackletter: "gothique", text: "de texte", slab: "à empattements carrés"
  };

  function descriptionFonte(f) {
    const genres = String(f.category || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
      .map((g) => GENRES[g] || g);
    const qui = f.designer ? ", dessinée par " + f.designer + (f.year ? " (" + f.year + ")" : "") : "";
    const genese = (f.info || []).map((b) => b.body).find((b) => !aRemplir(b));
    /* l'essentiel D'ABORD : Google coupe vers 160 signes */
    const phrase = f.name + " : police " + (genres.length ? genres.join(" et ") + " " : "") +
      "libre et gratuite" + qui + ", à essayer et télécharger sur BS.type.";
    return couper(phrase + (genese ? " " + genese : ""), 200);
  }

  const organisation = {
    "@type": "Organization",
    "@id": SITE + "#fonderie",
    name: "BS.type",
    url: SITE,
    logo: SITE + "assets/icones/icon-512.png",
    description: descriptionSite
  };
  if (Array.isArray(infos.fondateurs) && infos.fondateurs.length) {
    organisation.founder = infos.fondateurs.map((n) => ({ "@type": "Person", name: n }));
  }
  const liens = [infos.instagram, infos.behance, infos.github].concat(infos.autresLiens || []).filter(Boolean);
  if (liens.length) organisation.sameAs = liens;

  /* ---- l'accueil ---- */
  const accueil = path.join(ROOT, "index.html");
  if (fs.existsSync(accueil)) {
    let html = fs.readFileSync(accueil, "utf8");
    const bloc = blocHead({
      url: SITE,
      titre: "BS.type — fonderie de caractères open source",
      description: descriptionSite,
      image: SITE + "assets/partage/bstype.jpg",
      imageAlt: "BS.type, fonderie de caractères open source",
      icones: "assets/icones/",
      manifeste: "site.webmanifest",
      avecDescription: false,
      jsonld: {
        "@context": "https://schema.org",
        "@graph": [
          organisation,
          { "@type": "WebSite", "@id": SITE + "#site", url: SITE, name: "BS.type", inLanguage: ["fr", "en"], publisher: { "@id": SITE + "#fonderie" } }
        ]
      }
    });
    /* la description de l'accueil existe deja (traduite par i18n.js) */
    html = html.replace(/(<meta name="description"[^>]*content=")[^"]*(")/, (m, a, b) => a + esc(descriptionSite) + b);
    html = poserBloc(html, "REFERENCEMENT", bloc, /<link rel="icon"[^>]*>\n/, "  ");
    fs.writeFileSync(accueil, html);
    rapport.pages += 1;
  }

  /* ---- les pages de fonte ---- */
  fonts.forEach((f) => {
    const page = path.join(PAGES_DIR, f.slug, "index.html");
    if (!fs.existsSync(page)) return;
    const url = SITE + "fonts/" + f.slug + "/";
    const description = descriptionFonte(f);
    const titre = f.name + " — " + i18nTitreFonte + " · BS.type";

    let img = "bstype";
    const fichier = f.file ? path.join(ROOT, f.file) : null;
    if (monoOk && fichier && fs.existsSync(fichier)) {
      const ok = image(f.slug, svgPartage({
        titre: f.name,
        fichierTitre: fichier,
        fichierMono: mono,
        bas: [f.designer, f.year].filter(Boolean).join(" · ").toUpperCase(),
        domaine: domaine
      }));
      if (ok) img = f.slug;
      else rapport.imagesManquantes.push(f.slug);
    }
    if (img === "bstype" && !imageSite) rapport.imagesManquantes.push(f.slug);

    const jsonld = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CreativeWork",
          /* « police de caracteres » dans Wikidata : schema.org n'a
             pas de type propre aux fontes */
          additionalType: "https://www.wikidata.org/wiki/Q17451",
          "@id": url + "#fonte",
          name: f.name,
          url: url,
          image: SITE + "assets/partage/" + img + ".jpg",
          description: description,
          genre: f.category || undefined,
          creator: f.designer ? { "@type": "Person", name: f.designer } : undefined,
          dateCreated: f.year || undefined,
          isAccessibleForFree: true,
          publisher: organisation
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "BS.type", item: SITE },
            { "@type": "ListItem", position: 2, name: f.name, item: url }
          ]
        }
      ]
    };

    let html = fs.readFileSync(page, "utf8");
    html = html.replace(/<title>[^<]*<\/title>/, "<title>" + esc(titre) + "</title>");
    html = poserBloc(html, "REFERENCEMENT", blocHead({
      url: url,
      titre: titre,
      description: description,
      image: SITE + "assets/partage/" + img + ".jpg",
      imageAlt: f.name + ", police de caractères",
      icones: "../../assets/icones/",
      manifeste: "../../site.webmanifest",
      avecDescription: true,
      jsonld: jsonld
    }), /<link rel="icon"[^>]*>\n/, "  ");
    /* Un vrai titre de page (h1), invisible a l'ecran : la page ne
       montre que des modules, mais un lecteur d'ecran ou un moteur
       doit savoir de quoi elle parle sans attendre le JavaScript. */
    const h1 = '    <h1 class="sr-only">' + esc(f.name) + " — " + esc(i18nTitreFonte) +
      (f.designer ? ", " + esc("dessinée par " + f.designer) : "") + "</h1>";
    html = poserBloc(html, "TITRE", h1, /<main class="specimen">\n/, "    ");
    fs.writeFileSync(page, html);
    rapport.pages += 1;
  });

  fs.writeFileSync(fichierEmpreintes, JSON.stringify(empreintes, null, 2) + "\n");

  /* ---- sitemap.xml ---- */
  const adresses = [SITE].concat(fonts.map((f) => SITE + "fonts/" + f.slug + "/"));
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!-- Ecrit par Maj.command (scripts/referencement.js) : la liste des pages du site, pour les moteurs de recherche. -->",
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
  ];
  adresses.forEach((u) => {
    sitemap.push("  <url>");
    sitemap.push("    <loc>" + u + "</loc>");
    sitemap.push('    <xhtml:link rel="alternate" hreflang="fr" href="' + u + '"/>');
    sitemap.push('    <xhtml:link rel="alternate" hreflang="en" href="' + u + '?lang=en"/>');
    sitemap.push('    <xhtml:link rel="alternate" hreflang="x-default" href="' + u + '"/>');
    sitemap.push("  </url>");
  });
  sitemap.push("</urlset>");
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap.join("\n") + "\n");

  /* ---- robots.txt ---- */
  fs.writeFileSync(path.join(ROOT, "robots.txt"), [
    "# Ecrit par Maj.command (scripts/referencement.js).",
    "# Tout le site peut etre lu ; les outils de mise a jour, non.",
    "User-agent: *",
    "Allow: /",
    "Disallow: /scripts/",
    "Disallow: /Maj.command",
    "",
    "Sitemap: " + SITE + "sitemap.xml",
    ""
  ].join("\n"));

  return rapport;
}

module.exports = { ecrire };
