/* ============================================================
   RENDER-GRID.JS — SYSTEME DE ZONES DES PAGES SPECIMEN
   ------------------------------------------------------------
   Page fonts/<slug>/ : barre de meta en haut et en bas, puis une
   grille 4 colonnes de ZONES. Chaque zone a un en-tete
   « nom.............. v » : le v ouvre le menu de type.

   Contour : style terminal ASCII (voir grid.css) — filet exterieur
   plein, filet interieur a montants en pointilles verticaux.

   TYPES DE ZONE ET LEUR "content" :

     blank            {}
       Zone vide.

     characterset     { char? }
       TOUT le jeu de glyphes de la fonte dans une grille dont la
       taille de case s'adapte pour tout faire tenir ; si c'est
       trop petit, la grille defile (ascenseur au style des
       sliders). Survol = carre gris, clic = carre orange et le
       glyphe s'affiche en grand dans l'apercu de la MEME zone
       (l'apercu fait partie du module characterset).

     media            { src?, kind?, crop?, playback? }
       src vide -> lit fonts/<slug>/media/manifest.json. Le choix
       du fichier se fait dans le SOUS-MENU du menu de type
       (cliquer « media »), en aplat orange, le fichier courant
       etant rappele dans la barre de titre du sous-menu.
       playback (video), reglable dans media/playback.txt :
         scrub (defaut, suit le scroll) | loop | once | static

     info             {}
       Blocs editoriaux de la fonte (font.info : [{label, body}]).
       Ancien type "text" { title, body } encore accepte.

     editor           { text?, family?, size?, lineHeight?,
                        letterSpacing?, color?, bg?, align? }
       Panneau de controles a gauche (chaque reglage = un libelle
       pointille + un selecteur en aplat gris), apercu editable a
       droite. L'apercu ne change JAMAIS la taille de la zone : il
       defile. Les couleurs s'editent dans un selecteur maison
       (3 sliders RGB ou HSV + choix du format affiche).

   MODIFIER UNE DISPOSITION : font.gridLayout dans fonts-data.js.
   ============================================================ */

(function () {
  /* raccourci vers les textes d'interface (assets/js/i18n.js) */
  const t = (k) => (window.BSI18n ? window.BSI18n.t(k) : k);
  const pick = (fr, en) => (window.BSI18n ? window.BSI18n.pick(fr, en) : fr);

  const fonts = window.BS_FONTS || [];
  const slug = window.BS_SLUG;
  const font = fonts.find((f) => f.slug === slug);
  const grid = document.querySelector(".specimen-grid");
  const specimen = document.querySelector(".specimen");

  if (!font || !grid) return;

  document.title = font.name + " — BS.type";

  const CELL_TYPES = [
    { value: "characterset", label: t("zone.characterset") },
    { value: "media", label: t("zone.media") },
    { value: "info", label: t("zone.info") },
    { value: "editor", label: t("zone.editor") },
    { value: "download", label: t("zone.download") },
    { value: "blank", label: t("zone.blank") }
  ];

  /* Jeu de caracteres candidat : on garde ceux que la fonte
     possede vraiment (assets/js/glyph-fallback.js). */
  function candidateChars() {
    const out = [];
    const add = (a, b) => {
      for (let c = a; c <= b; c += 1) out.push(String.fromCharCode(c));
    };
    add(0x21, 0x7e); /* ASCII imprimable */
    add(0xa1, 0xff); /* Latin-1 */
    add(0x152, 0x153); /* OE oe */
    add(0x160, 0x161); /* S caron */
    add(0x178, 0x178); /* Y trema */
    add(0x17d, 0x17e); /* Z caron */
    "–—‘’‚“”„†‡•…‰‹›€™".split("").forEach((c) => out.push(c));
    return out;
  }

  /* ---------------- centrage optique d'un glyphe ----------------
     Le flexbox centre la CHASSE du caractere, pas son dessin : un
     glyphe dont l'encre n'est pas centree dans sa chasse (ou dont
     la hauteur d'oeil est loin de la ligne de base) parait decale.
     On mesure l'encre au canvas et on corrige en em. */
  let inkCtx = null;
  const inkCache = new Map();

  /* Une FACE = famille + graisse + italique. Plusieurs graisses
     partagent souvent le meme nom CSS : sans la graisse, on
     mesurait toujours le romain. */
  function faceOf(st) {
    return {
      family: (st && st.cssFamily) || font.cssFamily,
      weight: (st && st.weight) || 400,
      style: (st && st.style) || "normal"
    };
  }
  const faceKey = (f) => f.family + "|" + f.weight + "|" + f.style;
  const faceFont = (f, size) =>
    (f.style === "italic" ? "italic " : "") + f.weight + " " + size + 'px "' + f.family + '"';

  function inkShift(face, ch) {
    const key = faceKey(face) + "::" + ch;
    if (inkCache.has(key)) return inkCache.get(key);
    let res = { x: 0, y: 0 };
    try {
      if (!inkCtx) inkCtx = document.createElement("canvas").getContext("2d");
      const S = 100;
      inkCtx.font = faceFont(face, S);
      const m = inkCtx.measureText(ch);
      const fa = m.fontBoundingBoxAscent != null ? m.fontBoundingBoxAscent : S * 0.8;
      const fd = m.fontBoundingBoxDescent != null ? m.fontBoundingBoxDescent : S * 0.2;
      const aa = m.actualBoundingBoxAscent || 0;
      const ad = m.actualBoundingBoxDescent || 0;
      const al = m.actualBoundingBoxLeft || 0;
      const ar = m.actualBoundingBoxRight || 0;
      const baseline = (S - (fa + fd)) / 2 + fa;  /* ligne de base depuis le haut */
      const inkY = baseline + (ad - aa) / 2;      /* centre vertical de l'encre */
      res.y = (S / 2 - inkY) / S;
      res.x = (m.width / 2 - (ar - al) / 2) / S;
    } catch (_e) {}
    inkCache.set(key, res);
    return res;
  }

  /* ---------------- metriques de la fonte ----------------
     Relevees au canvas, en em (1 = corps). On mesure la hauteur
     d'oeil sur le "x", la hauteur de capitale sur le "H", et les
     ascendantes/descendantes sur des lettres qui en ont. */
  const metricsCache = new Map();

  function fontMetrics(face) {
    const key = faceKey(face);
    if (metricsCache.has(key)) return metricsCache.get(key);
    let m = null;
    try {
      if (!inkCtx) inkCtx = document.createElement("canvas").getContext("2d");
      const S = 100;
      inkCtx.font = faceFont(face, S);
      const of = (ch) => inkCtx.measureText(ch);
      const base = of("H");
      const asc = Math.max(
        of("b").actualBoundingBoxAscent || 0,
        of("d").actualBoundingBoxAscent || 0,
        of("l").actualBoundingBoxAscent || 0,
        base.actualBoundingBoxAscent || 0
      );
      const desc = Math.max(
        of("p").actualBoundingBoxDescent || 0,
        of("g").actualBoundingBoxDescent || 0,
        of("y").actualBoundingBoxDescent || 0
      );
      m = {
        cap: (base.actualBoundingBoxAscent || 0) / S,
        x: (of("x").actualBoundingBoxAscent || 0) / S,
        asc: asc / S,
        desc: desc / S,
        emAsc: (base.fontBoundingBoxAscent != null ? base.fontBoundingBoxAscent : S * 0.8) / S,
        emDesc: (base.fontBoundingBoxDescent != null ? base.fontBoundingBoxDescent : S * 0.2) / S
      };
    } catch (_e) {
      m = { cap: 0.7, x: 0.5, asc: 0.75, desc: 0.2, emAsc: 0.8, emDesc: 0.2 };
    }
    metricsCache.set(key, m);
    return m;
  }

  /* Helpers couleur et tirage au sort : voir editor-module.js */

  /* ---------------- barre de meta (haut + bas) ---------------- */
  function metaBar() {
    const bar = document.createElement("div");
    bar.className = "specimen__meta";
    const inner = document.createElement("span");
    inner.className = "specimen__meta-in";
    const name = document.createElement("span");
    name.className = "specimen__meta-name";
    name.textContent = font.name;
    inner.appendChild(name);
    String(font.category || "").split(",").map((s) => s.trim()).filter(Boolean)
      .forEach((t) => inner.appendChild(document.createTextNode("  ·  " + t)));
    /* L'auteur et l'annee dans leur propre morceau : sur telephone la
       ligne est coupee juste avant, plutot que de passer a deux
       lignes (voir .specimen__meta-qui dans specimen.css). */
    const qui = [font.designer, font.year].filter(Boolean);
    if (qui.length) {
      const bout = document.createElement("span");
      bout.className = "specimen__meta-qui";
      bout.textContent = qui.map((t) => "  ·  " + t).join("");
      inner.appendChild(bout);
    }
    bar.appendChild(inner);
    return bar;
  }
  if (specimen) {
    specimen.insertBefore(metaBar(), grid);
    specimen.appendChild(metaBar());
  }

  /* ---------------- manifest media ---------------- */
  let manifestPromise = null;
  function loadMediaManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch("media/manifest.json")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
    }
    return manifestPromise;
  }

  /* ---------------- construction d'une zone ---------------- */
  function clampSpan(span) {
    const n = parseInt(span, 10);
    if (isNaN(n)) return 1;
    return Math.min(4, Math.max(1, n));
  }

  /* Contraintes de largeur par type de zone : certaines ont besoin
     de place, d'autres ne doivent pas s'etaler. Appliquees au
     chargement ET quand on change le type d'une zone, pour que la
     mise en page reste stable. */
  const SPAN_RULES = {
    info: { max: 2 },
    editor: { min: 2 },
    characterset: { min: 2 }
  };

  function spanFor(type, span) {
    let n = clampSpan(span);
    const r = SPAN_RULES[type];
    if (r) {
      if (r.min) n = Math.max(n, r.min);
      if (r.max) n = Math.min(n, r.max);
    }
    return Math.min(4, Math.max(1, n));
  }

  /* Largeurs possibles par type, pour le tirage de disposition. */
  const SPAN_RANGE = {
    characterset: [2, 4],
    editor: [2, 4],
    info: [1, 2],
    media: [1, 4],
    download: [1, 4],   /* largeur libre : le module a des variantes */
    blank: [1, 2]
  };

  /* ============================================================
     QUELLE LARGEUR POUR UN MEDIA ?
     ------------------------------------------------------------
     Un module recadre toujours son image en « cover » : ce qui
     depasse est coupe. Une photo verticale dans un module large,
     ou l'inverse, perd donc la moitie du cadrage. On choisit la
     largeur — une a quatre colonnes — dont la FORME est la plus
     proche de celle du fichier, pour couper le moins possible.
     Les dimensions viennent de fonts/<slug>/media/manifest.json,
     ou scripts/sync-fonts.js les a ecrites en lisant les fichiers.
     Fichier sans dimensions : on retombe sur un tirage au sort.
     ============================================================ */
  /* Hauteur de reference d'un module, telle que la feuille de style
     la donne (--zone-h) : jamais une valeur ecrite ici. */
  function hauteurZone() {
    if (!grid) return 480;
    const sonde = document.createElement("div");
    sonde.className = "grid-cell";
    sonde.style.visibility = "hidden";
    sonde.style.removeProperty("--cell-h");
    grid.appendChild(sonde);
    const h = sonde.getBoundingClientRect().height;
    sonde.remove();
    return h > 10 ? h : 480;
  }

  function formeDuModule() {
    let l = document.documentElement.clientWidth;
    if (grid) {
      const rg = grid.getBoundingClientRect();
      if (rg.width > 10) l = rg.width;
    }
    return { colonne: l / 4, hauteur: hauteurZone() };
  }

  function largeurPourForme(ratio, forme) {
    if (!ratio || !isFinite(ratio) || ratio <= 0) return 0;
    let meilleure = 2;
    let perteMin = Infinity;
    for (let span = 1; span <= 4; span += 1) {
      const rModule = (forme.colonne * span) / forme.hauteur;
      /* part de l'image perdue par le recadrage */
      const perte = 1 - Math.min(rModule, ratio) / Math.max(rModule, ratio);
      if (perte < perteMin) { perteMin = perte; meilleure = span; }
    }
    return meilleure;
  }

  /* La page se REDISPOSE a chaque rechargement : on garde les memes
     zones (font.gridLayout est le vivier) mais on tire au sort leur
     ordre et leur largeur. Chaque rangee est completee pour faire
     exactement 4 colonnes : jamais de trou.
     Mettre font.shuffleLayout = false dans fonts-data.js pour figer
     la disposition ecrite a la main. */
  /* REGLE DE TIRAGE : chaque type n'apparait qu'UNE fois, sauf
     "media" qui peut se repeter — et seulement s'il y a au moins
     deux fichiers dans fonts/<slug>/media/. Sans media du tout, la
     zone media disparait. Le bouton de telechargement est toujours
     present. */
  function buildPool(defs, files) {
    const mediaCount = Array.isArray(files) ? files.length : 0;
    const seen = new Set();
    const pool = [];
    const zonesMedia = [];
    let medias = 0;
    const maxMedia = mediaCount >= 2 ? Math.min(mediaCount, 3) : (mediaCount === 1 ? 1 : 0);

    defs.forEach((d) => {
      const t = normalizeType(d.type);
      if (t === "media") {
        if (medias >= maxMedia) return;
        medias += 1;
      } else if (seen.has(t)) {
        return;
      } else {
        seen.add(t);
      }
      const def = Object.assign({}, d, { type: t });
      pool.push(def);
      if (t === "media") zonesMedia.push(def);
    });

    /* on complete : media manquantes, et le bouton download */
    while (medias < maxMedia) {
      const def = { type: "media", span: 2, content: {} };
      pool.push(def);
      zonesMedia.push(def);
      medias += 1;
    }
    if (!seen.has("download")) pool.push({ type: "download", span: 4, content: {} });

    /* Un fichier par zone media, et la largeur qui le recadre le
       moins. Les fichiers sont pris dans l'ordre du dossier, mais
       chacun garde SA forme : une affiche verticale n'ira pas dans
       un module panoramique. */
    if (zonesMedia.length) {
      const forme = formeDuModule();
      const libres = [];
      for (let i = 0; i < mediaCount; i += 1) libres.push(i);
      zonesMedia.forEach((def, n) => {
        const i = libres.length ? libres.splice(n % libres.length, 1)[0] : 0;
        const f = files[i] || {};
        def.content = Object.assign({}, def.content, { index: i });
        const ratio = f.w && f.h ? f.w / f.h : 0;
        def.ratio = ratio;
        const span = largeurPourForme(ratio, forme);
        if (span) { def.span = span; def.spanFige = true; }
      });
    }

    return pool;
  }

  function shuffledLayout(defs) {
    const pool = defs.map((d) => Object.assign({}, d));
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }

    const out = [];
    let row = [];
    let used = 0;

    function closeRow() {
      if (!row.length) return;
      let left = 4 - used;
      /* on elargit les zones de la rangee, chacune jusqu'a sa largeur
         maximale — celle du tirage ET celle imposee par son type
         (SPAN_RULES), sinon la largeur calculee ici serait rognee
         ensuite et laisserait un trou. */
      let guard = 0;
      while (left > 0 && guard < 16) {
        guard += 1;
        let grew = false;
        for (const it of row) {
          if (left <= 0) break;
          if (it.spanFige) continue;        /* largeur calee sur la forme du media */
          const rule = SPAN_RULES[it.type];
          const max = Math.min(
            (SPAN_RANGE[it.type] || [1, 4])[1],
            rule && rule.max ? rule.max : 4
          );
          if (it.span < max) { it.span += 1; left -= 1; grew = true; }
        }
        if (!grew) break;
      }
      /* Toutes au maximum et il reste de la place : on BOUCHE avec un
         module vide plutot que de laisser un trou dans la grille. */
      if (left > 0) row.push({ type: "blank", span: left, content: {} });
      out.push.apply(out, row);
      row = [];
      used = 0;
    }

    pool.forEach((def) => {
      const r = SPAN_RANGE[def.type] || [1, 4];
      const mini = def.spanFige ? def.span : r[0];
      if (used + mini > 4) closeRow();
      if (def.spanFige) {
        /* largeur imposee par la forme du fichier : on ne la tire
           pas au sort, on la rogne seulement si la rangee est trop
           courte pour l'accueillir en entier */
        def.span = Math.max(1, Math.min(def.span, 4 - used));
      } else {
        const hi = Math.min(r[1], 4 - used);
        def.span = r[0] + Math.floor(Math.random() * (hi - r[0] + 1));
      }
      row.push(def);
      used += def.span;
      if (used >= 4) closeRow();
    });
    closeRow();
    return out;
  }

  function applySpan(cell, def) {
    const n = spanFor(def.type, def.span);
    cell.style.setProperty("--cell-span", n);
    cell.dataset.span = n;
    /* largeur VOULUE, gardee de cote : quand la grille passe a deux
       colonnes ou a une seule, on repart de celle-la pour recalculer
       sans laisser de trou (voir ajusterGrille). */
    cell.dataset.spanIdeal = n;
    /* forme du media, pour que la case puisse prendre la hauteur qui
       lui va (voir ajusterGrille) */
    if (def.ratio) cell.dataset.ratio = def.ratio;
    /* Hauteur tiree au sort, gardee pour la vie de la page : les
       rangees ne font pas toutes la meme hauteur, comme le module de
       telechargement ne fait pas la hauteur d'un module entier. */
    if (!cell.dataset.hauteur) {
      /* L'editeur et le jeu de caracteres ne retrecissent PAS : on
         s'en sert, il leur faut leur place. Les autres peuvent. */
      const liste = (def.type === "editor" || def.type === "characterset")
        ? HAUTEURS.filter((x) => x >= 1)
        : HAUTEURS;
      cell.dataset.hauteur = liste[Math.floor(Math.random() * liste.length)];
    }
  }

  /* ============================================================
     PAS DE TROU, QUEL QUE SOIT LE NOMBRE DE COLONNES
     ------------------------------------------------------------
     La disposition est calculee pour quatre colonnes. Sur un ecran
     plus etroit la grille en compte deux, ou une seule : une rangee
     « 1 + 2 + 1 » ne pave alors plus, le module de trop passe a la
     ligne et laisse un trou derriere lui.
     On refait donc le calcul avec le nombre REEL de colonnes :
     meme ordre, largeurs reajustees, chaque rangee remplie
     exactement. Rejoue a chaque changement de taille.
     ============================================================ */
  /* Hauteurs possibles d'une rangee, en parts de --zone-h. */
  const HAUTEURS = [0.72, 0.86, 1, 1, 1.18, 1.4];
  /* Bornes absolues, pour qu'un media tres allonge ne fasse pas une
     rangee interminable — ni une bande illisible. */
  const HAUTEUR_MINI = 0.5;
  const HAUTEUR_MAXI = 2.4;

  function nombreDeColonnes(cells) {
    if (!grid) return 4;
    /* PIEGE : un module plus large que la grille lui fait fabriquer
       des colonnes en plus, de quelques pixels. On compte donc les
       colonnes APRES avoir remis tout le monde a une colonne — sinon
       on relit sa propre erreur de la fois d'avant. */
    if (cells) cells.forEach((c) => c.style.setProperty("--cell-span", 1));
    const v = getComputedStyle(grid).gridTemplateColumns || "";
    const n = v.split(" ")
      .filter((x) => x && x !== "none" && parseFloat(x) > 20).length;
    return Math.max(1, n || 4);
  }

  function ajusterGrille() {
    if (!grid) return;
    const cells = Array.prototype.slice.call(grid.children);
    if (!cells.length) return;
    const n = nombreDeColonnes(cells);

    const mini = (c) => {
      const r = SPAN_RULES[c.dataset.type];
      return Math.min(n, Math.max(1, (r && r.min) || 1));
    };
    const maxi = (c) => {
      const r = SPAN_RULES[c.dataset.type];
      const plage = SPAN_RANGE[c.dataset.type] || [1, 4];
      return Math.min(n, r && r.max ? r.max : plage[1]);
    };

    /* mesurees UNE fois pour toute la grille, pas a chaque rangee :
       chaque mesure oblige le navigateur a recalculer la page */
    const zone = hauteurZone();
    const largeurColonne = (grid.getBoundingClientRect().width || 1) / n;

    let rangee = [];
    let pris = 0;

    function fermer() {
      if (!rangee.length) return;
      let reste = n - pris;
      let garde = 0;
      /* on elargit les modules de la rangee jusqu'a leur maximum */
      while (reste > 0 && garde < 24) {
        garde += 1;
        let pousse = false;
        for (const c of rangee) {
          if (reste <= 0) break;
          if (c._span < maxi(c)) { c._span += 1; reste -= 1; pousse = true; }
        }
        if (!pousse) break;
      }
      /* tous au maximum et il reste de la place : le dernier prend
         le reste. Mieux vaut un module un peu large qu'un trou. */
      if (reste > 0) rangee[rangee.length - 1]._span += reste;
      rangee.forEach((c) => {
        c.style.setProperty("--cell-span", c._span);
        c.dataset.span = c._span;
      });
      poserHauteur(rangee);
      rangee = [];
      pris = 0;
    }

    /* ---- la hauteur de la rangee ----
       Toutes les cases d'une rangee font la MEME hauteur : c'est ce
       qui empeche les trous. Cette hauteur est la plus grande des
       envies : un media veut la hauteur qui respecte sa forme, les
       autres modules veulent celle qu'ils ont tiree au sort. */
    function poserHauteur(cases) {
      if (!cases.length) return;
      let veut = 0;
      cases.forEach((c) => {
        const ratio = parseFloat(c.dataset.ratio || "0");
        if (ratio > 0) {
          /* un media : la hauteur qui montre l'image en entier */
          veut = Math.max(veut, (largeurColonne * c._span) / ratio);
        } else if (c.dataset.type !== "download" && c.dataset.type !== "blank") {
          let m = parseFloat(c.dataset.hauteur) || 1;
          /* Sur telephone (une seule colonne) les besoins changent :
             l'editeur empile ses reglages et sa zone de texte, il lui
             faut de la hauteur ; le jeu de caracteres, lui, tient
             mieux en moins haut, l'apercu prenant la moitie. */
          if (n <= 1) {
            if (c.dataset.type === "editor") m = Math.max(m, 1.7);
            if (c.dataset.type === "characterset") m = Math.min(m, 0.85);
          }
          veut = Math.max(veut, zone * m);
        }
      });
      if (!veut) veut = zone * 0.72;
      const h = Math.max(zone * HAUTEUR_MINI, Math.min(zone * HAUTEUR_MAXI, veut));
      cases.forEach((c) => c.style.setProperty("--cell-h", Math.round(h) + "px"));
    }

    cells.forEach((c) => {
      const voulu = Math.min(n, parseInt(c.dataset.spanIdeal, 10) || 1);
      const m = mini(c);
      if (pris + m > n) fermer();
      c._span = Math.max(m, Math.min(voulu, n - pris));
      rangee.push(c);
      pris += c._span;
      if (pris >= n) fermer();
    });
    fermer();
  }

  function normalizeType(t) {
    if (t === "empty") return "blank";
    if (t === "text") return "info";
    if (t === "glyph") return "characterset"; /* l'apercu est dans le charset */
    return t || "blank";
  }

  function buildCell(def) {
    def.type = normalizeType(def.type);

    const cell = document.createElement("div");
    cell.className = "grid-cell";
    cell.style.setProperty("--cell-rows", Math.max(1, parseInt(def.rows, 10) || 1));
    cell.dataset.type = def.type;
    applySpan(cell, def);

    const head = document.createElement("div");
    head.className = "zone__head";
    const name = document.createElement("span");
    name.className = "zone__name";
    const leader = document.createElement("span");
    leader.className = "dots";
    const chev = document.createElement("button");
    chev.type = "button";
    chev.className = "zone__chev";
    chev.setAttribute("aria-label", t("zone.change"));
    chev.textContent = "V";
    head.append(name, leader, chev);
    cell.appendChild(head);

    const body = document.createElement("div");
    body.className = "grid-cell__body zone__body";
    cell.appendChild(body);

    function setLabel() {
      const opt = CELL_TYPES.find((o) => o.value === def.type);
      name.textContent = (opt ? opt.label : def.type) + " ";
    }
    setLabel();

    /* toute la barre d'en-tete ouvre le menu, pas seulement le V */
    head.setAttribute("role", "button");
    head.tabIndex = 0;
    head.addEventListener("click", () => openTypeMenu(chev, def, cell, body, setLabel));
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openTypeMenu(chev, def, cell, body, setLabel);
      }
    });

    renderCellContent(body, def);
    return cell;
  }

  /* menu de type ; « media » ouvre un sous-menu de fichiers */
  function openTypeMenu(chev, def, cell, body, setLabel) {
    const parent = window.BSPopup.open({
      anchor: chev,
      title: (CELL_TYPES.find((o) => o.value === def.type) || {}).label || def.type,
      className: "bs-popup--types",
      build: (bd, done) => {
        CELL_TYPES.forEach((t) => {
          const b = window.BSPopup.item(t.label, { selected: t.value === def.type });
          b.addEventListener("click", () => {
            if (t.value === "media") {
              if (def.type !== "media") {
                def.type = "media";
                cell.dataset.type = "media";
                applySpan(cell, def);
                setLabel();
                renderCellContent(body, def);
              }
              openMediaMenu(b, parent, body);
              return;
            }
            def.type = t.value;
            cell.dataset.type = t.value;
            applySpan(cell, def);
            setLabel();
            renderCellContent(body, def);
            done();
          });
          bd.appendChild(b);
        });
      }
    });
  }

  /* sous-menu orange : tous les medias du dossier de la fonte */
  function openMediaMenu(anchorItem, parent, body) {
    loadMediaManifest().then((files) => {
      const api = body._bsMedia;
      const current = api && api.current();
      window.BSPopup.open({
        anchor: anchorItem,
        parent,
        title: current ? current.file : t("menu.mediaTitle"),
        className: "bs-popup--media",
        build: (bd, done) => {
          if (!files.length) {
            const e = window.BSPopup.item(t("menu.mediaEmpty"));
            e.disabled = true;
            bd.appendChild(e);
            return;
          }
          files.forEach((f, i) => {
            const b = window.BSPopup.item(f.file, { selected: current && current.file === f.file });
            b.addEventListener("click", () => {
              if (api) api.show(i);
              window.BSPopup.closeAll();
            });
            bd.appendChild(b);
          });
        }
      });
    });
  }

  function renderCellContent(body, def) {
    if (body._bsCleanup) {
      try { body._bsCleanup(); } catch (_e) {}
      body._bsCleanup = null;
    }
    body._bsMedia = null;
    body.innerHTML = "";
    body.removeAttribute("style");
    body.className = "grid-cell__body zone__body";

    switch (def.type) {
      case "media": renderMedia(body, def.content || {}); break;
      case "characterset": renderCharacterset(body, def.content || {}); break;
      case "info": renderInfo(body, def.content || {}); break;
      case "editor": renderEditor(body, def.content || {}); break;
      case "download": renderDownload(body, def.content || {}); break;
      default: break;
    }
  }

  /* ---------------- MEDIA ---------------- */
  function renderMedia(body, content) {
    body.classList.add("grid-cell__media");
    const crop = content.crop || "cover";

    if (content.src) {
      body._bsCleanup = mountMedia(body, { file: content.src, kind: content.kind || "image", playback: content.playback }, crop);
      return;
    }

    body.classList.add("grid-cell__media--loading");
    loadMediaManifest().then((files) => {
      body.classList.remove("grid-cell__media--loading");
      if (!files || !files.length) {
        body.classList.add("grid-cell__media--placeholder");
        body.innerHTML = "<span>media</span>";
        return;
      }

      const stage = document.createElement("div");
      stage.className = "grid-cell__media-stage";
      body.appendChild(stage);

      let clean = null;
      let index = 0;
      function show(i) {
        if (clean) { try { clean(); } catch (_e) {} clean = null; }
        index = i;
        stage.innerHTML = "";
        clean = mountMedia(stage, files[i], crop);
        body._bsCleanup = clean;
      }
      body._bsMedia = { show, index: () => index, current: () => files[index], files };

      /* Le fichier a ete choisi a la disposition, en meme temps que
         la largeur du module : chacun sa forme (voir buildPool).
         Sans cette indication, on reprend l'ancienne regle : le
         premier fichier qu'aucun autre module n'a deja pris. */
      let first = 0;
      if (typeof content.index === "number" && files[content.index]) {
        first = content.index;
      } else {
        const taken = new Set();
        document.querySelectorAll(".grid-cell__media").forEach((other) => {
          if (other !== body && other._bsMedia) taken.add(other._bsMedia.index());
        });
        for (let i = 0; i < files.length; i += 1) {
          if (!taken.has(i)) { first = i; break; }
        }
      }
      show(first);
    });
  }

  /* Filet pour les noms accentues : macOS ecrit les accents en deux
     morceaux, git et les serveurs en un seul. Si le fichier demande
     n'arrive pas, on retente avec l'autre ecriture avant d'abandonner. */
  function autreEcriture(url) {
    if (typeof "".normalize !== "function") return null;
    const nfc = url.normalize("NFC");
    const nfd = url.normalize("NFD");
    if (url !== nfc) return nfc;
    if (url !== nfd) return nfd;
    return null;
  }

  function filetDeNom(el, src) {
    let deja = false;
    el.addEventListener("error", () => {
      if (deja) return;
      deja = true;
      const autre = autreEcriture(src);
      if (autre) el.src = autre;
    });
  }

  function mountMedia(host, entry, crop) {
    const kind = entry.kind || "image";
    const src = "media/" + entry.file;

    if (kind !== "video") {
      const img = document.createElement("img");
      filetDeNom(img, src);
      img.src = src;
      img.alt = kind === "gif" ? "Animation" : "Image";
      img.loading = "lazy";
      img.style.objectFit = crop;
      host.appendChild(img);
      return function () {};
    }

    const mode = entry.playback || "scrub";
    const video = document.createElement("video");
    filetDeNom(video, src);
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.style.objectFit = crop;
    host.appendChild(video);

    if (mode === "loop" || mode === "once") {
      video.loop = mode === "loop";
      const io = new IntersectionObserver(
        (ents) => ents.forEach((e) => {
          if (e.isIntersecting) video.play().catch(() => {});
          else if (mode === "loop") video.pause();
        }),
        /* threshold 0 + marge : une video ne s'arrete que lorsqu'elle
           est VRAIMENT sortie de l'ecran. A 0,35 elle se figeait des
           qu'il en restait moins d'un tiers — et ca se voyait. */
        { threshold: 0, rootMargin: "200px" }
      );
      io.observe(video);
      return () => io.disconnect();
    }

    if (mode === "static") {
      video.currentTime = 0.05;
      return function () {};
    }

    /* scrub : la video suit la progression de la zone dans le viewport.
       Chaque changement de currentTime coute un decodage : on n'en
       demande pas plus d'un par image, on ignore les micro-ecarts, et
       on ne travaille pas du tout quand la zone est hors ecran. C'est
       ce qui garde le defilement fluide avec plusieurs videos. */
    let dur = 0;
    let raf = 0;
    let onScreen = true;
    let lastT = -1;
    const STEP = 1 / 30;          /* plus fin que ca ne se voit pas */

    video.addEventListener("loadedmetadata", () => { dur = video.duration || 0; update(); });

    function update() {
      raf = 0;
      if (!onScreen || document.hidden || !dur) return;
      const r = host.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      let p = 1 - (r.top + r.height) / (vh + r.height);
      p = Math.max(0, Math.min(1, p));
      const t = p * Math.max(0, dur - 0.05);
      if (Math.abs(t - lastT) < STEP) return;
      lastT = t;
      try { video.currentTime = t; } catch (_e) {}
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }

    let io = null;
    if (window.IntersectionObserver) {
      io = new IntersectionObserver((ents) => {
        ents.forEach((e) => { onScreen = e.isIntersecting; });
        if (onScreen) onScroll();
      }, { rootMargin: "120px" });
      io.observe(host);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return function () {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (io) io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }

  /* ---------------- CHARACTERSET (grille + apercu) ----------------
     La grille montre tout le jeu de glyphes ; l'apercu montre le
     caractere choisi, pose sur sa VRAIE ligne de base, avec les
     metriques lues dans le fichier de police (font-metrics.js).
     Les metriques sont masquees par defaut, un bouton les montre. */
  function renderCharacterset(body, content) {
    body.classList.add("grid-cell__charset");

    /* Graisse montree par CE module. Elle se choisit dans le menu
       deroulant pose a droite du bouton « metriques » : c'est le
       MEME composant que celui de l'editeur (editor-module.js). */
    const csStyles = window.BSEditor.stylesOf(font);
    /* meme graisse de depart que le module editeur, pour que la page
       ne montre pas deux choix differents au chargement */
    let csStyle = csStyles.find((x) => x.file === content.style) || csStyles[0];
    const face = () => faceOf(csStyle);

    /* Applique la face (famille + graisse + italique) a un element :
       plusieurs graisses partagent le meme nom CSS, la famille seule
       ne suffit pas. */
    function wearFace(el) {
      const f = face();
      el.style.fontFamily = "'" + f.family + "'";
      el.style.fontWeight = f.weight;
      el.style.fontStyle = f.style;
    }

    const gridEl = document.createElement("div");
    gridEl.className = "cs__grid";

    const preview = document.createElement("div");
    preview.className = "cs__preview";
    const rules = document.createElement("div");
    rules.className = "cs__metrics";
    const big = document.createElement("div");
    big.className = "cs__big";
    /* Temoin de ligne de base : une boite de hauteur nulle, alignee
       sur la base du texte. Sa position nous dit ou le navigateur a
       REELLEMENT pose la ligne de base du glyphe — ce qui ne se
       calcule pas de façon fiable, chaque fonte pouvant faire suivre
       au navigateur ses metriques hhea, OS/2 typo ou OS/2 win. Les
       traits sont donc poses sur une mesure, pas sur un calcul. */
    const temoin = document.createElement("span");
    temoin.className = "cs__base-probe";
    temoin.setAttribute("aria-hidden", "true");

    /* le point de code du caractere choisi, en haut de l'apercu */
    const code = document.createElement("span");
    code.className = "cs__code";

    /* barre d'outils du bas : bascule des metriques + choix de graisse */
    const tools = document.createElement("div");
    tools.className = "cs__tools";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "cs__toggle";
    toggle.textContent = t("cs.metrics");
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      const on = preview.classList.toggle("show-metrics");
      toggle.classList.toggle("is-on", on);
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
    });

    const pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "cs__pick";
    const pickVal = document.createElement("span");
    pickVal.className = "cs__pick-val";
    const pickChev = document.createElement("span");
    pickChev.className = "cs__pick-chev";
    pickChev.textContent = "V";
    pickBtn.append(pickVal, window.BSPopup.dots(), pickChev);
    pickBtn.addEventListener("click", () => {
      window.BSEditor.openStyleMenu({
        anchor: pickBtn,
        font: font,
        current: csStyle,
        onPick: (st) => { csStyle = st; applyStyle(); }
      });
    });

    tools.append(toggle, pickBtn);
    preview.append(rules, big, code, tools);
    body.append(gridEl, preview);

    let chars = [];
    let picked = content.char || "A";
    let metrics = null;   /* lues dans le fichier de police */

    /* Change la graisse montree : glyphes, apercu et metriques. */
    function applyStyle() {
      pickVal.textContent = window.BSEditor.styleLabel(font, csStyle);
      wearFace(big);
      gridEl.querySelectorAll(".cs__glyph").forEach((g) => {
        wearFace(g);
        const sh = inkShift(face(), g.textContent);
        g.style.transform = "translate(" + sh.x.toFixed(4) + "em," + sh.y.toFixed(4) + "em)";
      });
      metrics = null;
      loadMetrics();
      /* le jeu de glyphes n'est pas le meme d'une graisse a l'autre */
      refill();
      layoutPreview();
    }

    function loadMetrics() {
      if (!window.BSMetrics || !csStyle.file) return;
      const want = csStyle.file;
      window.BSMetrics.load("../../" + want).then((m) => {
        if (want !== csStyle.file) return;          /* on a change entre-temps */
        if (m && m.ascender) { metrics = m; layoutPreview(); }
      });
    }

    /* « U+0041 » : le numero du caractere dans la table Unicode,
       toujours ecrit sur au moins quatre chiffres. */
    function unicodeOf(ch) {
      const cp = ch.codePointAt(0);
      return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
    }

    function paint() {
      big.textContent = picked;
      big.appendChild(temoin);
      code.textContent = unicodeOf(picked);
      gridEl.querySelectorAll(".cs__cell").forEach((el) => {
        el.classList.toggle("is-picked", el.dataset.ch === picked);
      });
      layoutPreview();
    }

    /* ---- hauteur de capitale et hauteur d'oeil, MESUREES ----
       Les valeurs sCapHeight / sxHeight de la table OS/2 sont
       souvent celles posees par defaut par le logiciel de dessin,
       jamais remises a jour : toutes nos fontes annoncent 700/1000
       alors que leurs capitales ne font pas cette hauteur-la. Le
       trait tombait donc a cote.
       On mesure donc la hauteur d'encre d'une capitale A PLAT (H, E,
       F...) et d'un bas de casse a plat (x, z, v...). C'est la
       hauteur reellement dessinee, pas celle declaree. */
    const hauteursVues = new Map();

    function hauteursMesurees(f) {
      const clef = f.family + "|" + f.weight + "|" + f.style;
      if (hauteursVues.has(clef)) return hauteursVues.get(clef);
      const vide = { capHeight: 0, xHeight: 0, ascender: 0, descender: 0 };
      if (!document.fonts || !document.fonts.check) return vide;
      const spec = f.style + " " + f.weight + " 200px '" + f.family + "'";
      if (!document.fonts.check(spec)) return vide;      /* pas encore chargee */

      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = spec;
      /* lettres a sommet PLAT d'abord : une ronde deborde un peu
         au-dessus de la ligne (le « debord optique »), et fausserait
         la mesure de quelques pour cent */
      const hauteur = (lettres) => {
        for (const ch of lettres) {
          const m = ctx.measureText(ch);
          if (m.width > 0 && m.actualBoundingBoxAscent > 1) {
            return m.actualBoundingBoxAscent / 200;
          }
        }
        return 0;
      };
      /* Le bas d'un glyphe, pour la descendante. */
      const profondeur = (lettres) => {
        for (const ch of lettres) {
          const m = ctx.measureText(ch);
          if (m.width > 0 && m.actualBoundingBoxDescent > 1) {
            return m.actualBoundingBoxDescent / 200;
          }
        }
        return 0;
      };
      const out = {
        capHeight: hauteur("HEFTILXZBDPRO"),
        xHeight: hauteur("xzvwmnrusaeo"),
        /* L'ascendante DECLAREE (table hhea) est presque toujours
           plus haute que ce qui est dessine : Jalleau annonce 950
           pour 1000 alors que ses ascendantes montent a 720. Le
           trait partait donc beaucoup trop haut. On prend le plus
           haut de ce qui est reellement dessine — hampes d'abord,
           puis capitales et accents. */
        ascender: hauteur("bdhklfitBDEHKLAOM"),
        descender: profondeur("pqgjyQJ")
      };
      hauteursVues.set(clef, out);
      return out;
    }

    /* Pose le glyphe sur sa ligne de base et trace les metriques. */
    function layoutPreview() {
      const box = preview.getBoundingClientRect();
      if (!box.height) return;

      const m = metrics || (() => {
        const c = fontMetrics(face());
        return { ascender: c.emAsc, descender: c.emDesc, capHeight: c.cap, xHeight: c.x };
      })();

      const em = m.ascender + m.descender;
      /* Dans un module etroit (telephone), l'apercu est plus large
         que haut : le glyphe peut alors occuper bien plus de sa
         hauteur sans risquer de toucher les bords. */
      const large = box.width > box.height;
      const wCap = box.width > 0 ? box.width * (large ? 0.72 : 0.62) : Infinity;
      const size = Math.min((box.height * (large ? 0.82 : 0.62)) / em, wCap);
      let baseline = box.height / 2 + ((m.ascender - m.descender) / 2) * size;

      big.style.fontSize = size + "px";
      /* avec line-height:1, la base tombe a ce Y depuis le haut du bloc */
      big.style.top = (baseline - ((1 - em) / 2 + m.ascender) * size) + "px";

      /* ... puis on RELEVE ou elle est tombee pour de vrai. Le calcul
         ci-dessus suppose que le navigateur suit les metriques hhea ;
         selon la fonte et le systeme il suit parfois OS/2 typo ou
         OS/2 win, et le glyphe se retrouve alors decale de plusieurs
         pour cent par rapport aux traits. */
      if (temoin.parentNode) {
        const r = temoin.getBoundingClientRect();
        if (r.height === 0 && r.bottom) {
          const vue = r.bottom - box.top;
          if (vue > 0 && vue < box.height) baseline = vue;
        }
      }
      /* recentrage horizontal sur le dessin, pas sur la chasse */
      big.style.transform = "translateX(" + inkShift(face(), picked).x.toFixed(4) + "em)";

      /* la hauteur reellement dessinee l'emporte sur celle declaree */
      const vues = hauteursMesurees(face());
      const lines = [
        [t("cs.ascender"), vues.ascender || m.ascender],
        [t("cs.capHeight"), vues.capHeight || m.capHeight],
        [t("cs.xHeight"), vues.xHeight || m.xHeight],
        [t("cs.baseline"), 0],
        [t("cs.descender"), -(vues.descender || m.descender)]
      ];
      rules.innerHTML = "";
      /* Deux traits trop proches, et leurs noms se recouvrent. On
         pose alors le nom du second DE L'AUTRE COTE de l'apercu. On
         garde pour ça la derniere hauteur utilisee a gauche et a
         droite, et on choisit le cote le plus degage. */
      const ECART_MINI = 14;      /* px : en dessous, ca se chevauche */
      let derniereG = -1e9;
      let derniereD = -1e9;

      lines.forEach(([label, v], i) => {
        if (!v && i !== 3) return;                  /* valeur absente du fichier */
        const y = baseline - v * size;
        if (y < 1 || y > box.height - 1) return;
        const l = document.createElement("span");
        l.className = "cs__metric" + (i === 3 ? " is-base" : "");
        l.style.top = y + "px";
        l.dataset.label = label;

        const placeG = y - derniereG;
        const placeD = y - derniereD;
        const aDroite = placeG < ECART_MINI && placeD >= placeG;
        if (aDroite) { l.classList.add("is-droite"); derniereD = y; }
        else { derniereG = y; }

        rules.appendChild(l);
      });
    }

    function fill(list) {
      chars = list;
      gridEl.innerHTML = "";
      list.forEach((ch) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cs__cell";
        b.dataset.ch = ch;
        /* Le glyphe vit dans un span : c'est LUI qu'on recentre.
           Recentrer le bouton lui-meme decalerait la case et
           casserait l'alignement de la grille. */
        const g = document.createElement("span");
        g.className = "cs__glyph";
        g.textContent = ch;
        wearFace(g);
        const sh = inkShift(face(), ch);
        g.style.transform = "translate(" + sh.x.toFixed(4) + "em," + sh.y.toFixed(4) + "em)";
        b.appendChild(g);
        b.addEventListener("click", () => { picked = ch; paint(); });
        gridEl.appendChild(b);
      });
      if (!list.includes(picked)) picked = list[0] || "A";
      paint();
      sizeGrid();
    }

    /* taille de case : la plus grande qui fait tout tenir ; sous le
       minimum, la grille defile. Au DOIGT le minimum monte a 40 px :
       une case de 26 px ne se vise pas (voir « DOIGTS » dans
       base.css). Il y a moins de cases par ligne, et on fait
       defiler. Ce reglage vit ICI et pas dans la feuille de style :
       la taille calculee est posee directement sur la grille, elle
       l'emporterait sur toute regle CSS. */
    const AU_DOIGT = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const MIN = AU_DOIGT ? 40 : 26, MAX = 72;
    function sizeGrid() {
      const w = gridEl.clientWidth, h = gridEl.clientHeight, n = chars.length;
      if (!w || !h || !n) return;
      let best = MIN;
      for (let s = MAX; s >= MIN; s -= 1) {
        const cols = Math.floor(w / s), rows = Math.floor(h / s);
        if (cols > 0 && rows > 0 && cols * rows >= n) { best = s; break; }
      }
      gridEl.style.setProperty("--cs-cell", best + "px");
    }

    /* ---- quels caracteres montrer ? ----
       On les lit DANS LE FICHIER de la fonte (table `cmap`), pas
       dans une liste ecrite a la main : on obtient donc tout ce que
       la fonte couvre, y compris les dessins ranges dans la zone
       privee (U+E000 et au-dela), la ou vont les glyphes « custom ».
       On ne retire ensuite que ceux qui ne dessinent rien, pour ne
       pas laisser de case vide. */
    function charsFromFile() {
      if (!window.BSMetrics || !window.BSMetrics.codepoints || !csStyle.file) {
        return Promise.resolve(null);
      }
      return window.BSMetrics.codepoints("../../" + csStyle.file)
        .then((cps) => {
          if (!cps || cps.length < 10) return null;
          const out = [];
          cps.forEach((cp) => {
            try { out.push(String.fromCodePoint(cp)); } catch (_e) {}
          });
          return out;
        })
        .catch(() => null);
    }

    /* La fonte doit etre REELLEMENT chargee avant qu'on dessine la
       grille : sinon le navigateur remplit les cases avec sa police
       de secours (on voyait du Times au premier affichage). */
    function faceReady() {
      const f = face();
      if (!document.fonts || !document.fonts.load) return Promise.resolve();
      const spec = (f.style === "italic" ? "italic " : "") + f.weight + " 32px '" + f.family + "'";
      return document.fonts.load(spec, "ABCabc123")
        .then(() => document.fonts.ready)
        .catch(() => {});
    }

    let fillToken = 0;

    function refill() {
      const token = (fillToken += 1);
      faceReady()
        .then(charsFromFile)
        .then((fromFile) => {
          if (token !== fillToken) return;         /* graisse changee entre-temps */
          const f = face().family;
          const all = fromFile || candidateChars();
          let list = all;
          if (window.BSGlyph) {
            /* liste venue du fichier : elle fait foi, on ne retire
               que les glyphes qui ne dessinent rien */
            list = fromFile
              ? all.filter((c) => window.BSGlyph.hasInk(f, c))
              : all.filter((c) => window.BSGlyph.supports(f, c) && window.BSGlyph.hasInk(f, c));
            if (list.length < 10) list = all;      /* garde-fou */
          }
          fill(list);
        });
    }

    applyStyle();

    const ro = new ResizeObserver(sizeGrid);
    ro.observe(gridEl);
    const rp = new ResizeObserver(layoutPreview);
    rp.observe(preview);
    body._bsCleanup = () => { ro.disconnect(); rp.disconnect(); };
  }

  /* ---------------- DOWNLOAD ----------------
     Une ligne, toute la largeur : le bouton EST le module. */
  const DL_SIZES = ["s", "m", "l", "xl"];

  /* Le mot tient sur UNE ligne tant que c'est possible : on reduit
     le corps jusqu'a ce qu'il rentre dans la largeur du bouton.
     Seulement si meme reduit il devient illisible, on le coupe en
     deux (TELE / CHARGER). « telecharger » est long en francais :
     c'est ce reglage qui le fait tenir partout. */
  function fitDownload(btn) {
    const label = btn.querySelector(".download-btn__label");
    if (!label) return;
    btn.classList.remove("is-stacked");
    label.style.fontSize = "";

    const cs = getComputedStyle(btn);
    const base = parseFloat(cs.fontSize) || 20;
    let avail = btn.clientWidth
      - (parseFloat(cs.paddingLeft) || 0)
      - (parseFloat(cs.paddingRight) || 0);

    /* bouton en rangee : le rappel du format est A COTE du mot, il
       faut lui laisser sa place */
    const meta = btn.querySelector(".download-btn__meta");
    if (meta && cs.flexDirection === "row") {
      avail -= meta.getBoundingClientRect().width + 14;
    }
    if (avail <= 0 || !base) return;

    /* Reduit le corps jusqu'a ce que le texte rentre. Plusieurs
       passes : l'interlettrage et les arrondis font que la premiere
       reduction n'est jamais tout a fait exacte. */
    function shrink(min) {
      let size = base;
      for (let i = 0; i < 5 && label.scrollWidth > avail; i += 1) {
        size = size * (avail / label.scrollWidth) * 0.99;
        if (size < min) return false;
        label.style.fontSize = size.toFixed(1) + "px";
      }
      return label.scrollWidth <= avail;
    }

    if (label.scrollWidth <= avail) return;            /* tient tel quel */
    if (shrink(Math.max(15, base * 0.42))) return;     /* tient, reduit */

    /* meme reduit il deviendrait illisible : on coupe en deux
       (TELE / CHARGER), quitte a reduire encore un peu */
    label.style.fontSize = "";
    btn.classList.add("is-stacked");
    if (label.scrollWidth > avail) shrink(12);
  }

  /* On refait le calcul a chaque fois que la largeur ou la fonte
     peut avoir change : au montage, une fois BS Mono chargee, au
     redimensionnement de la fenetre, et quand le module lui-meme
     change de largeur. */
  function watchFit(btn) {
    const run = () => fitDownload(btn);
    run();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
    [60, 300, 800].forEach((d) => setTimeout(run, d));
    window.addEventListener("resize", run);
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(run); ro.observe(btn); }
    return () => {
      window.removeEventListener("resize", run);
      if (ro) ro.disconnect();
    };
  }

  function dlLabel(extra) {
    const label = document.createElement("span");
    label.className = "download-btn__label";
    label.innerHTML = "<i>" + t("dl.word1") + "</i><i>" + t("dl.word2") + "</i>";
    if (extra) {
      const q = document.createElement("b");
      q.className = "download-btn__which";
      q.textContent = extra;
      label.appendChild(q);
    }
    return label;
  }

  function dlButton(href, label, title) {
    const a = document.createElement("a");
    a.className = "download-btn";
    a.href = "../../" + href;
    a.setAttribute("download", "");
    if (title) a.title = title;
    a.appendChild(label);
    a.appendChild(window.BSPopup.dots());
    return a;
  }

  function dlMeta(text) {
    const m = document.createElement("span");
    m.className = "download-btn__meta";
    m.textContent = text;
    return m;
  }

  function renderDownload(body, content) {
    body.classList.add("grid-cell__download");

    /* Variantes : la hauteur et le corps changent d'un tirage a
       l'autre. */
    const size = content.size || DL_SIZES[Math.floor(Math.random() * DL_SIZES.length)];
    body.dataset.size = size;
    const cell = body.closest(".grid-cell");
    if (cell) cell.dataset.size = size;

    const styles = window.BSEditor.stylesOf(font);
    const variants = [...new Set(styles.map((x) => x.variant).filter(Boolean))];
    const family = styles.length > 1 && font.zip;
    const stops = [];
    body._bsCleanup = () => stops.forEach((f) => f());

    /* Une seule graisse : un seul bouton, le fichier tel quel. */
    if (!family) {
      const ext = (font.file.split(".").pop() || "").toUpperCase();
      const a = dlButton(font.file, dlLabel(""));
      a.appendChild(dlMeta(font.name + " · " + ext));
      body.appendChild(a);
      stops.push(watchFit(a));
      return;
    }

    /* Plusieurs graisses : le module se coupe en deux.
         - « tout »       : l'archive .zip de la famille entiere
         - « selection »  : la graisse choisie JUSTE EN DESSOUS, dans
                            son propre menu. Ce module ne depend plus
                            de ce qui est ouvert dans l'editeur.
       Le decompte dit la verite : des VARIANTES (autres dessins) et
       des STYLES (graisses), ce ne sont pas la meme chose. */
    body.classList.add("grid-cell__download--split");

    const counts = [];
    if (variants.length > 1) {
      counts.push(variants.length + " " + t("dl.variants"));
    }
    counts.push(styles.length + " " + (styles.length > 1 ? t("dl.styles") : t("dl.style")));

    const leftHalf = document.createElement("div");
    leftHalf.className = "download-half";
    const all = dlButton(font.zip, dlLabel(t("dl.all")), t("dl.allTitle"));
    all.appendChild(dlMeta(font.name + " · " + counts.join(" · ") + " · ZIP"));
    leftHalf.appendChild(all);

    const rightHalf = document.createElement("div");
    rightHalf.className = "download-half";
    const sel = dlButton(font.file, dlLabel(t("dl.selected")), t("dl.selTitle"));
    rightHalf.appendChild(sel);

    /* le choix de la graisse : meme menu que partout ailleurs */
    let dlStyle = styles.find((x) => x.file === font.file) || styles[0];
    const pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "download-pick";
    pickBtn.setAttribute("aria-label", t("dl.pick"));
    const pickVal = document.createElement("span");
    pickVal.className = "download-pick__val";
    const pickChev = document.createElement("span");
    pickChev.className = "download-pick__chev";
    pickChev.textContent = "V";
    pickBtn.append(pickVal, window.BSPopup.dots(), pickChev);

    function syncPick() {
      sel.href = "../../" + dlStyle.file;
      pickVal.textContent =
        window.BSEditor.styleLabel(font, dlStyle) +
        " · " + (dlStyle.file.split(".").pop() || "").toUpperCase();
    }
    pickBtn.addEventListener("click", () => {
      window.BSEditor.openStyleMenu({
        anchor: pickBtn,
        font: font,
        current: dlStyle,
        onPick: (st) => { dlStyle = st; syncPick(); }
      });
    });
    syncPick();
    rightHalf.appendChild(pickBtn);

    body.append(leftHalf, rightHalf);
    stops.push(watchFit(all), watchFit(sel));
  }

  /* ---------------- INFO ---------------- */
  function renderInfo(body, content) {
    body.classList.add("grid-cell__info");
    let sections = [];
    if (Array.isArray(content.sections)) sections = content.sections;
    else if (content.title || content.body) sections = [{ label: content.title || "", body: content.body || "" }];
    else sections = pick(font.info, font.infoEn) || font.info || [];

    sections.forEach((s) => {
      const h = document.createElement("h3");
      h.textContent = s.label || "";
      const p = document.createElement("p");
      p.textContent = s.body || "";
      body.append(h, p);
    });
  }

  /* ---------------- EDITOR ----------------
     Le module lui-meme vit dans assets/js/editor-module.js : le
     meme composant sert ici et sur la page d'accueil. */
  function renderEditor(body, content) {
    const ed = window.BSEditor.create({
      font: font,
      content: content,
      fileBase: "../../"
    });
    body.classList.add("grid-cell__editor");
    /* on reprend le contenu du module dans la zone de la grille */
    while (ed.el.firstChild) body.appendChild(ed.el.firstChild);
    body._bsEditor = ed;
  }

  /* ---------------- montage ----------------
     On attend le manifeste : le nombre de medias decide combien de
     zones "media" ont le droit d'exister. */
  /* La page se montre UNE FOIS, deja juste. Sans ca, elle
     s'affichait avec la police de secours, puis tout se recalculait
     quand les vraies fontes arrivaient : ce deuxieme passage donnait
     l'impression que la page se rechargeait toute seule.
     Filet de securite : au bout de 1,5 s on affiche quoi qu'il
     arrive, meme si une fonte ne se charge jamais. */
  if (grid) {
    grid.classList.add("is-waiting");
    const reveler = () => grid.classList.remove("is-waiting");
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reveler);
    setTimeout(reveler, 1500);
  }

  const base = Array.isArray(font.gridLayout) ? font.gridLayout : [];
  loadMediaManifest().then((files) => {
    const pool = buildPool(base, files);
    const layout = font.shuffleLayout === false ? pool : shuffledLayout(pool);
    layout.forEach((def) => grid.appendChild(buildCell(def)));
    ajusterGrille();
  });

  /* La grille se recalcule quand la fenetre change de LARGEUR, et
     seulement dans ce cas : sur telephone la barre d'adresse change
     la hauteur en plein defilement, et tout recalculer a ce
     moment-la faisait sauter la page sous le doigt. */
  let minuteurTaille = 0;
  let largeurGrille = document.documentElement.clientWidth;
  window.addEventListener("resize", () => {
    const l = document.documentElement.clientWidth;
    if (l === largeurGrille) return;
    largeurGrille = l;
    clearTimeout(minuteurTaille);
    minuteurTaille = setTimeout(ajusterGrille, 120);
  });

  /* Le pied de page est pose par assets/js/footer.js : le meme
     sur toutes les pages du site. */
})();
