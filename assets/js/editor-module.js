/* ============================================================
   EDITOR-MODULE.JS — LE MODULE EDITEUR, PARTAGE
   ------------------------------------------------------------
   Le meme composant sur les pages specimen (une zone de la
   grille) et sur la page d'accueil (un module par fonte) : un
   panneau de reglages a gauche, un apercu editable a droite.
   Un seul code, donc un seul comportement.

     BSEditor.create({ font, content, fileBase })
       font     : la fonte (fonts-data.js)
       content  : valeurs de depart, sinon font.editorDefaults
       fileBase : prefixe vers la racine du site ("" depuis
                  l'accueil, "../../" depuis une page de fonte)
     -> { el, panel, preview, refresh }

   Le curseur clignotant REMPLACE celui du systeme : le vrai est
   masque (caret-color: transparent) et on dessine un rectangle
   de la couleur du texte a l'endroit exact du curseur.
   ============================================================ */

window.BSEditor = (function () {
  const HEX = /^#?[0-9a-fA-F]{6}$/;
  /* raccourci vers les textes d'interface (assets/js/i18n.js) */
  const t = (k) => (window.BSI18n ? window.BSI18n.t(k) : k);

  /* Les styles d'une fonte, RANGES PAR AXE DE GRAISSE : les
     variantes gardent leur ordre, et dans chacune les graisses
     vont de la plus maigre a la plus grasse, le romain avant
     l'italique. Le menu suit donc l'axe, pas l'alphabet. */
  /* La graisse de DEPART : celle qui ressemble le plus a un
     « Regular » — poids le plus proche de 400, romain avant
     italique. Sans ca, une famille rangee par axe s'ouvrait sur sa
     graisse la plus maigre. */
  function defaultStyle(font) {
    const list = stylesOf(font);
    const score = (x) => Math.abs((x.weight || 400) - 400) + (x.style === "italic" ? 1000 : 0);
    return list.slice().sort((a, b) => score(a) - score(b))[0];
  }

  function stylesOf(font) {
    const list = Array.isArray(font.styles) && font.styles.length
      ? font.styles.slice()
      : [{ label: font.variant || "Regular", weight: 400, style: "normal" }];
    const order = [...new Set(list.map((x) => x.variant || ""))];
    return list.sort((a, b) => {
      const va = order.indexOf(a.variant || "");
      const vb = order.indexOf(b.variant || "");
      if (va !== vb) return va - vb;
      const wa = a.weight || 400;
      const wb = b.weight || 400;
      if (wa !== wb) return wa - wb;
      return (a.style === "italic" ? 1 : 0) - (b.style === "italic" ? 1 : 0);
    });
  }
  const withHash = (h) => (h && h[0] === "#" ? h : "#" + (h || ""));
  const noHash = (h) => (h && h[0] === "#" ? h.slice(1) : h || "");

  function hexToRgb(h) {
    const s = noHash(h);
    return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0];
  }
  function rgbToHex(r, g, b) {
    return [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [Math.round(h), Math.round(mx ? (d / mx) * 100 : 0), Math.round(mx * 100)];
  }
  function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let p = [0, 0, 0];
    if (h < 60) p = [c, x, 0];
    else if (h < 120) p = [x, c, 0];
    else if (h < 180) p = [0, c, x];
    else if (h < 240) p = [0, x, c];
    else if (h < 300) p = [x, 0, c];
    else p = [c, 0, x];
    return p.map((n) => Math.round((n + m) * 255));
  }
  /* texte sombre sur couleur claire, gris de la charte sinon */
  function readableOn(hex) {
    const [r, g, b] = hexToRgb(hex);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? "var(--color-dark)" : "var(--color-text)";
  }
  const pad3 = (n) => String(Math.round(n)).padStart(3, "0");

  /* Une paire texte/fond lisible : on tire une teinte, puis on
     oppose les clartes pour garder du contraste. */
  function randomPair() {
    const h = Math.floor(Math.random() * 360);
    const h2 = (h + 120 + Math.floor(Math.random() * 120)) % 360;
    const darkText = Math.random() < 0.5;
    const ink = hsvToRgb(h, 60 + Math.random() * 40, darkText ? 25 + Math.random() * 30 : 85 + Math.random() * 15);
    const bg = hsvToRgb(h2, 10 + Math.random() * 40, darkText ? 85 + Math.random() * 15 : 12 + Math.random() * 20);
    return { color: rgbToHex(ink[0], ink[1], ink[2]), bg: rgbToHex(bg[0], bg[1], bg[2]) };
  }

  /* Couleurs de depart : celles de la CHARTE, lues dans tokens.css.
     Fond noir, texte gris clair, partout et a chaque chargement —
     aucun tirage au sort. Le bouton « hasard » est le seul a
     changer les couleurs. */
  function identityPair() {
    const css = getComputedStyle(document.documentElement);
    const v = (n, fallback) => (noHash(css.getPropertyValue(n).trim()) || fallback).toUpperCase();
    return { color: v("--color-text", "D9D9D9"), bg: v("--color-bg", "191919") };
  }

  let measureCtx = null;

  /* ---- textes d'essai ----
     Ils sont COMMUNS a tout le catalogue : assets/js/samples.js.
     Aucune fonte n'a « son » texte : ce sont des textes pour
     essayer n'importe quelle fonte. */
  function samplePool(kind) {
    const all = window.BS_SAMPLES || {};
    const lang = window.BSI18n && window.BSI18n.lang === "en" ? "en" : "fr";
    const set = all[lang] || all.fr || {};
    return set[kind] || [];
  }

  function pickSample(kind) {
    const pool = samplePool(kind);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* Nom lisible d'un style : « fusion regular » quand la fonte a
     plusieurs variantes, « regular » sinon. */
  function styleLabel(font, st) {
    const list = stylesOf(font);
    const many = [...new Set(list.map((x) => x.variant).filter(Boolean))].length > 1;
    return (many ? (st.variant || "") + " " + st.label : st.label).trim().toLowerCase();
  }

  /* Le menu de choix de graisse, PARTAGE : le module editeur et le
     module « jeu de caracteres » ouvrent exactement le meme.
     Plusieurs variantes -> menu des variantes, puis sous-menu de
     leurs styles, en aplat ORANGE. Sinon la liste des styles. */
  function openStyleMenu(opts) {
    const font = opts.font;
    const styles = stylesOf(font);
    const variants = [...new Set(styles.map((x) => x.variant).filter(Boolean))];
    const hasVariants = variants.length > 1;
    const title = hasVariants ? t("ed.variant") : (variants.length ? t("ed.style") : t("ed.family"));
    const current = opts.current || styles[0];
    const stylesOfVariant = (v) => styles.filter((x) => (x.variant || "") === v);

    if (!hasVariants) {
      window.BSPopup.list({
        anchor: opts.anchor,
        title: title,
        className: opts.className,
        items: styles.map((x) => ({
          value: x.file, label: x.label.toLowerCase(),
          family: x.cssFamily, weight: x.weight, fontStyle: x.style
        })),
        selected: current.file,
        onPick: (file) => {
          const st = styles.find((x) => x.file === file);
          if (st) opts.onPick(st);
        }
      });
      return;
    }

    const parent = window.BSPopup.open({
      anchor: opts.anchor,
      title: title,
      className: "bs-popup--list" + (opts.className ? " " + opts.className : ""),
      build: (bd) => {
        variants.forEach((v) => {
          const first = stylesOfVariant(v)[0];
          const b = window.BSPopup.item(v.toLowerCase(), {
            selected: v === current.variant,
            family: first && first.cssFamily,
            weight: first && first.weight,
            fontStyle: first && first.style
          });
          b.addEventListener("click", () => {
            window.BSPopup.list({
              anchor: b,
              parent: parent,
              /* sous-menu en aplat ORANGE, comme celui des medias */
              className: "bs-popup--sub",
              title: v.toLowerCase(),
              items: stylesOfVariant(v).map((x) => ({
                value: x.file, label: x.label.toLowerCase(),
                family: x.cssFamily, weight: x.weight, fontStyle: x.style
              })),
              selected: current.file,
              onPick: (file) => {
                const st = styles.find((x) => x.file === file);
                if (st) opts.onPick(st);
                window.BSPopup.closeAll();
              }
            });
          });
          bd.appendChild(b);
        });
      }
    });
  }

  function create(opts) {
    const font = opts.font;
    const content = opts.content || {};

    const body = document.createElement("div");
    body.className = "grid-cell__editor bs-editor";


  const styles = stylesOf(font);

  /* Le texte de depart vient du fonds commun (samples.js), jamais
     de la fiche de la fonte : un champ « texte » par fonte n'aurait
     aucun sens, ce sont des textes pour ESSAYER une fonte. */
  const baseDefaults = Object.assign({}, font.editorDefaults || {});
  delete baseDefaults.text;

  const D = Object.assign(
    {
      text: pickSample("lines") || t("ed.sample"),
      family: defaultStyle(font).label,
      size: 40,
      lineHeight: 1.3,
      letterSpacing: 0,
      color: "D9D9D9",
      bg: "191919",
      align: "left"
    },
    baseDefaults,
    content || {},
    identityPair()
  );

  const panel = document.createElement("div");
  panel.className = "editor__panel";
  const prevWrap = document.createElement("div");
  prevWrap.className = "editor__prev-wrap";
  const preview = document.createElement("div");
  preview.className = "editor__preview";
  preview.contentEditable = "true";
  preview.spellcheck = false;
  preview.textContent = D.text;
  prevWrap.appendChild(preview);
  body.append(panel, prevWrap);

  let activeStyle = styles.find((s) => s.label === D.family) || defaultStyle(font);

  function applyType() {
    preview.style.fontFamily = "'" + (activeStyle.cssFamily || font.cssFamily) + "'";
    preview.style.fontWeight = activeStyle.weight || 400;
    preview.style.fontStyle = activeStyle.style || "normal";
    document.fonts.ready.then(refilter);
  }
  function refilter() {
    if (!window.BSGlyph || document.activeElement === preview) return;
    const cur = preview.innerText;
    const f = window.BSGlyph.filterText(cur, activeStyle.cssFamily || font.cssFamily);
    if (f && f !== cur) preview.innerText = f;
  }
  preview.addEventListener("blur", refilter);

  /* A LA FRAPPE : un caractere que la fonte ne dessine pas est
     remplace par le plus proche qu'elle possede (capitale -> bas de
     casse, accent retire, sosie de dessin). On intercepte avant
     l'insertion, donc le curseur et l'annulation restent normaux. */
  preview.addEventListener("beforeinput", (e) => {
    if (e.inputType !== "insertText" || !e.data || !window.BSGlyph) return;
    const fam = activeStyle.cssFamily || font.cssFamily;
    let out = "";
    let changed = false;
    for (const ch of e.data) {
      if (/\s/.test(ch) || (window.BSGlyph.supports(fam, ch) && window.BSGlyph.hasInk(fam, ch))) {
        out += ch;
        continue;
      }
      out += window.BSGlyph.nearest(fam, ch);
      changed = true;
    }
    if (!changed) return;
    e.preventDefault();
    if (out) document.execCommand("insertText", false, out);
  });

  preview.style.setProperty("--ed-size", D.size + "px");
  preview.style.setProperty("--ed-lh", D.lineHeight);
  preview.style.setProperty("--ed-ls", D.letterSpacing + "em");
  preview.style.textAlign = D.align;

  /* un reglage = libelle pointille + selecteur en aplat gris.
     Tous les reglages sont visibles en meme temps : un reglage,
     un clic. */
  function control(label, boxEl, onOpen) {
    const c = document.createElement("div");
    c.className = "ctl";
    const head = document.createElement("div");
    head.className = "ctl__head";
    const l = document.createElement("span");
    l.textContent = label;
    head.append(l, window.BSPopup.dots());
    boxEl.classList.add("ctl__box");
    if (onOpen) {
      boxEl.classList.add("is-clickable");
      boxEl.setAttribute("role", "button");
      boxEl.tabIndex = 0;
      boxEl.addEventListener("click", () => onOpen(boxEl));
      boxEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(boxEl); }
      });
    }
    c.append(head, boxEl);
    panel.appendChild(c);
    return c;
  }

  /* --- variante / style ---
     Une fonte peut avoir plusieurs VARIANTES (d'autres dessins,
     ranges sous le meme nom) et, dans chacune, plusieurs styles.
     Deux variantes ou plus : le premier menu liste les variantes et
     chacune ouvre le sous-menu de ses styles. Sinon on liste
     directement les styles. */
  const variants = [...new Set(styles.map((x) => x.variant).filter(Boolean))];
  const hasVariants = variants.length > 1;
  const ctlLabel = hasVariants ? t("ed.variant") : (variants.length ? t("ed.style") : t("ed.family"));

  const famBox = document.createElement("div");
  const famVal = document.createElement("span");
  famVal.className = "ctl__text";
  famBox.append(famVal, window.BSPopup.dots());

  function famText() {
    return styleLabel(font, activeStyle);
  }

  function pickStyle(st) {
    activeStyle = st;
    famVal.textContent = famText();
    applyType();
    /* le module de telechargement suit la graisse ouverte ici */
    document.dispatchEvent(new CustomEvent("bs:style", { detail: { font: font, style: st } }));
  }

  famVal.textContent = famText();
  control(ctlLabel, famBox, (anchor) => {
    openStyleMenu({ anchor: anchor, font: font, current: activeStyle, onPick: pickStyle });
  });

  /* --- sliders --- */
  const sizeS = window.BSSlider.create({
    min: 8, max: 200, step: 1, value: D.size,
    format: (v) => String(Math.round(v)),
    onInput: (v) => { preview.style.setProperty("--ed-size", Math.round(v) + "px"); queueCaret(); }
  });
  control(t("ed.size"), sizeS.el);

  /* Des que le corps est regle A LA MAIN, on arrete de le recalculer
     tout seul : l'ouverture du tiroir ou un changement de largeur ne
     doivent plus ecraser le choix de la personne. L'evenement "input"
     de l'element n'arrive QUE sur une action reelle — sizeS.set()
     ne le declenche pas. */
  let sizeTouched = false;
  sizeS.input.addEventListener("input", () => { sizeTouched = true; });

  const lhS = window.BSSlider.create({
    min: 0.8, max: 2.6, step: 0.01, value: D.lineHeight,
    format: (v) => v.toFixed(2),
    onInput: (v) => { preview.style.setProperty("--ed-lh", v); queueCaret(); }
  });
  control(t("ed.lineHeight"), lhS.el);

  const lsS = window.BSSlider.create({
    min: -0.05, max: 0.5, step: 0.01, value: D.letterSpacing,
    format: (v) => v.toFixed(2),
    onInput: (v) => { preview.style.setProperty("--ed-ls", v + "em"); queueCaret(); }
  });
  control(t("ed.letterSpacing"), lsS.el);

  /* --- couleurs : selecteur maison RGB / HSV / HEX --- */
  const setters = [];   /* [setCouleurTexte, setCouleurFond] pour le bouton random */

  function colorControl(label, initHex, apply) {
    const box = document.createElement("div");
    const val = document.createElement("span");
    val.className = "ctl__text";
    box.append(val, window.BSPopup.dots());

    let hex = noHash(initHex).toUpperCase();
    let mode = "HEX";
    const setHex = (v) => { hex = noHash(v).toUpperCase(); paint(); };

    function text() {
      const [r, g, b] = hexToRgb(hex);
      if (mode === "RGB") return pad3(r) + "," + pad3(g) + "," + pad3(b);
      if (mode === "HSV") {
        const [h, s, v] = rgbToHsv(r, g, b);
        return pad3(h) + "," + pad3(s) + "," + pad3(v);
      }
      return hex;
    }
    /* l'aplat du selecteur PREND la couleur choisie (via variables
       CSS, pour que le survol vert puisse passer par-dessus) */
    function paint() {
      box.style.setProperty("--ctl-fill", withHash(hex));
      box.style.setProperty("--ctl-ink", readableOn(hex));
      val.textContent = text();
      apply(withHash(hex));
    }
    paint();

    setters.push(setHex);

    control(label, box, (anchor) => {
      window.BSPopup.open({
        anchor,
        title: label,
        className: "bs-popup--color",
        build: (bd) => {
          const sliders = [];
          const rows = document.createElement("div");
          rows.className = "cp__sliders";
          bd.appendChild(rows);

          const AXES = {
            RGB: [["red", 0, 255], ["green", 0, 255], ["blue", 0, 255]],
            HSV: [["hue", 0, 360], ["saturation", 0, 100], ["value", 0, 100]]
          };
          let axisMode = "RGB";

          function currentAxisValues() {
            const [r, g, b] = hexToRgb(hex);
            return axisMode === "RGB" ? [r, g, b] : rgbToHsv(r, g, b);
          }

          function fromSliders() {
            const v = sliders.map((s) => s.get());
            const rgb = axisMode === "RGB" ? v : hsvToRgb(v[0], v[1], v[2]);
            hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
            paint();
            refreshFormats();
          }

          function buildAxes() {
            rows.innerHTML = "";
            sliders.length = 0;
            const vals = currentAxisValues();
            AXES[axisMode].forEach(([name, min, max], i) => {
              const s = window.BSSlider.create({
                min, max, step: 1, value: vals[i], label: name,
                format: (v) => pad3(v),
                onInput: fromSliders
              });
              s.el.classList.add("cp__row");
              sliders.push(s);
              rows.appendChild(s.el);
            });
          }

          const fmtWrap = document.createElement("div");
          fmtWrap.className = "cp__formats";
          bd.appendChild(fmtWrap);

          function refreshFormats() {
            fmtWrap.innerHTML = "";
            ["RGB", "HSV", "HEX"].forEach((m) => {
              const [r, g, b] = hexToRgb(hex);
              let v;
              if (m === "RGB") v = pad3(r) + "," + pad3(g) + "," + pad3(b);
              else if (m === "HSV") { const t = rgbToHsv(r, g, b); v = pad3(t[0]) + "," + pad3(t[1]) + "," + pad3(t[2]); }
              else v = hex;
              const b2 = window.BSPopup.item(m, { selected: m === mode });
              const out = document.createElement("span");
              out.className = "cp__fmt-val";
              out.textContent = v;
              b2.appendChild(out);
              b2.addEventListener("click", () => {
                mode = m;
                if (m !== "HEX") { axisMode = m; buildAxes(); }
                paint();
                refreshFormats();
              });
              fmtWrap.appendChild(b2);
            });
          }

          buildAxes();
          refreshFormats();
        }
      });
    });
  }
  colorControl(t("ed.color"), D.color, (c) => (preview.style.color = c));
  colorControl(t("ed.bg"), D.bg, (c) => (prevWrap.style.background = c));

  /* --- alignement + textes d'essai ---
     Trois boutons de justification, puis 1 / 2 / 3 : un mot, une
     ligne, un paragraphe, pris dans assets/js/samples.js (les memes
     textes pour toutes les fontes). */
  const alignRow = document.createElement("div");
  alignRow.className = "editor__align";

  /* UN SEUL bouton, UNE seule zone cliquable : chaque clic passe a
     la justification suivante (gauche, centre, droite, et on
     recommence). Aucun filet entre les trois tiers — seul le pave
     orange se deplace, et sa position EST l'alignement. */
  const ALIGNS = ["left", "center", "right"];

  const justify = document.createElement("button");
  justify.type = "button";
  justify.className = "editor__justify";
  justify.setAttribute("aria-label", t("ed.align"));

  ALIGNS.forEach((a) => {
    const seg = document.createElement("span");
    seg.className = "editor__justify-seg";
    seg.dataset.align = a;
    for (let i = 0; i < 3; i += 1) seg.appendChild(document.createElement("i"));
    justify.appendChild(seg);
  });

  let alignIndex = Math.max(0, ALIGNS.indexOf(D.align));

  function setAlign(a) {
    const i = ALIGNS.indexOf(a);
    if (i >= 0) alignIndex = i;
    justify.querySelectorAll(".is-active").forEach((x) => x.classList.remove("is-active"));
    const seg = justify.querySelector('[data-align="' + ALIGNS[alignIndex] + '"]');
    if (seg) seg.classList.add("is-active");
    justify.title = t("ed.align") + " : " + ALIGNS[alignIndex];
    preview.style.textAlign = ALIGNS[alignIndex];
  }

  justify.addEventListener("click", () => {
    setAlign(ALIGNS[(alignIndex + 1) % ALIGNS.length]);
  });

  alignRow.appendChild(justify);
  setAlign(ALIGNS[alignIndex]);

  /* Pose un texte dans l'apercu : on remplace ce que la fonte ne
     sait pas dessiner, puis on recale le corps. */
  function setText(str) {
    const txt = window.BSGlyph ? window.BSGlyph.filterText(str, activeStyle.cssFamily || font.cssFamily) : str;
    preview.innerText = txt || str;
    fitTextToWidth();
    queueCaret();
  }

  [["words", "ed.sample1", "1"], ["lines", "ed.sample2", "2"], ["paragraphs", "ed.sample3", "3"]]
    .forEach(([kind, key, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "editor__sample";
      b.textContent = label;
      b.title = t(key);
      b.setAttribute("aria-label", t(key));
      b.addEventListener("click", () => {
        const txt = pickSample(kind);
        if (txt) setText(txt);
      });
      alignRow.appendChild(b);
    });

  /* --- bouton RANDOM : rejoue tous les reglages d'un coup --- */
  const randomBtn = document.createElement("button");
  randomBtn.type = "button";
  randomBtn.className = "editor__random";
  randomBtn.textContent = t("ed.random");
  randomBtn.addEventListener("click", () => {
    const pair = randomPair();
    setters[0](pair.color);
    setters[1](pair.bg);
    sizeS.set(Math.round(20 + Math.random() * 110));
    lhS.set(+(0.9 + Math.random() * 1.4).toFixed(2));
    lsS.set(+(-0.03 + Math.random() * 0.28).toFixed(2));

    pickStyle(styles[Math.floor(Math.random() * styles.length)]);

    setAlign(["left", "center", "right"][Math.floor(Math.random() * 3)]);
  });

  panel.appendChild(alignRow);

  /* --- TIROIR ---
     Une colonne de boutons collee au bord gauche du module :
     la poignee du tiroir (des fleches sur toute sa hauteur), puis
     « voir » et « hasard », meme largeur, quelques pixels d'ecart.
     Les libelles sont a la verticale, lettres l'une sur l'autre. */
  let rail = null;
  if (opts.drawer) {
    body.classList.add("has-drawer");

    rail = document.createElement("div");
    rail.className = "editor__rail";

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "editor__drawer-toggle";
    handle.setAttribute("aria-label", t("ed.drawerOpen"));
    const arrows = document.createElement("span");
    arrows.className = "editor__arrows";
    handle.appendChild(arrows);

    /* autant de fleches qu'il en faut pour remplir la hauteur */
    function fillArrows() {
      const glyph = body.classList.contains("is-drawer-open") ? "<" : ">";
      const h = handle.clientHeight;
      if (!h) return;
      const probe = document.createElement("i");
      probe.textContent = glyph;
      arrows.innerHTML = "";
      arrows.appendChild(probe);
      const one = probe.getBoundingClientRect().height || 14;
      const n = Math.max(1, Math.floor((h - 8) / one));
      arrows.innerHTML = "";
      for (let i = 0; i < n; i += 1) {
        const a = document.createElement("i");
        a.textContent = glyph;
        arrows.appendChild(a);
      }
    }

    handle.addEventListener("click", () => {
      const open = body.classList.toggle("is-drawer-open");
      handle.setAttribute("aria-label", t(open ? "ed.drawerClose" : "ed.drawerOpen"));
      fillArrows();
      setTimeout(fitTextToWidth, 320);
    });

    randomBtn.classList.add("editor__rail-btn");
    rail.append(handle, randomBtn);
    body.insertBefore(rail, panel);

    fillArrows();
    if (window.ResizeObserver) new ResizeObserver(fillArrows).observe(handle);
    [0, 200, 600].forEach((d) => setTimeout(fillArrows, d));
  } else {
    alignRow.appendChild(randomBtn);   /* a droite des boutons */
  }

  /* --- corps de depart ---
     Sous 10 mots, le texte doit tenir sur UNE ligne et remplir la
     largeur de l'apercu. Au-dela, on garde le corps regle. */
  function fitTextToWidth() {
    if (sizeTouched) return;              /* corps choisi a la main */
    const txt = preview.innerText.trim();
    if (!txt) return;
    if (txt.split(/\s+/).filter(Boolean).length >= 10) return;

    const box = prevWrap.clientWidth;
    if (!box) return;
    const cs = getComputedStyle(preview);
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const avail = box - pad;
    if (avail <= 0) return;

    try {
      if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
      const S = 100;
      measureCtx.font =
        (activeStyle.style === "italic" ? "italic " : "") +
        (activeStyle.weight || 400) + " " + S + "px '" +
        (activeStyle.cssFamily || font.cssFamily) + "'";
      const w = measureCtx.measureText(txt.split(/\n/)[0]).width;
      if (!w) return;
      /* l'interlettrage s'ajoute a la chasse */
      const ls = parseFloat(cs.letterSpacing) || 0;
      const total = w + (ls / (parseFloat(cs.fontSize) || S)) * S * txt.length;
      /* 2 % de marge : sans ca le texte touche le bord et passe
         a la ligne au moindre arrondi */
      const size = Math.max(8, Math.min(200, (avail / total) * S * 0.98));
      sizeS.set(Math.round(size));
    } catch (_e) {}
  }

  applyType();

    /* ---- curseur : remplace celui du systeme ----
       Le vrai curseur est masque (caret-color: transparent, voir
       specimen.css) et on dessine un rectangle de la couleur du
       texte a l'endroit exact ou il se trouve. */
    const caret = document.createElement("span");
    caret.className = "editor__caret";
    prevWrap.appendChild(caret);

    /* Largeur du curseur = chasse MEDIANE de la fonte affichee,
       mesuree sur le texte en cours. Une mediane, pas une moyenne :
       une poignee de glyphes tres larges ne la deplace pas. */
    const widthCache = new Map();
    function medianCharWidth(cs) {
      const key = cs.font + "::" + preview.innerText.length;
      if (widthCache.has(key)) return widthCache.get(key);
      let w = parseFloat(cs.fontSize) * 0.45;
      try {
        if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
        measureCtx.font = cs.font;
        const chars = [...new Set(preview.innerText.replace(/\s/g, ""))];
        if (chars.length) {
          const widths = chars.map((c) => measureCtx.measureText(c).width).sort((a, b) => a - b);
          w = widths[Math.floor(widths.length / 2)] || w;
        }
      } catch (_e) {}
      widthCache.set(key, w);
      return w;
    }

    function placeCaret() {
      const sel = window.getSelection();
      let rect = null;

      if (document.activeElement === preview && sel && sel.rangeCount) {
        const r = sel.getRangeAt(0).cloneRange();
        r.collapse(false);
        const rects = r.getClientRects();
        if (rects.length) rect = rects[rects.length - 1];
        else {
          /* debut de ligne vide : un marqueur temporaire donne la place */
          const mark = document.createElement("span");
          mark.textContent = "\u200b";
          r.insertNode(mark);
          rect = mark.getBoundingClientRect();
          const parent = mark.parentNode;
          mark.remove();
          if (parent) parent.normalize();
        }
      }
      if (!rect) {
        /* pas de curseur : on se cale a la FIN du texte. Un range
           replie en fin de contenu ne renvoie aucun rectangle, d'ou
           le marqueur temporaire — sans lui le curseur retombait au
           debut du bloc. */
        const r = document.createRange();
        r.selectNodeContents(preview);
        r.collapse(false);
        const rects = r.getClientRects();
        if (rects.length) rect = rects[rects.length - 1];
        else {
          const mark = document.createElement("span");
          mark.textContent = "\u200b";
          r.insertNode(mark);
          rect = mark.getBoundingClientRect();
          const parent = mark.parentNode;
          mark.remove();
          if (parent) parent.normalize();
        }
      }

      const host = prevWrap.getBoundingClientRect();
      const cs = getComputedStyle(preview);
      const size = parseFloat(cs.fontSize) || 16;
      const h = rect ? rect.height || size : size;
      const x = rect ? rect.left - host.left : parseFloat(cs.paddingLeft) || 0;
      const y = rect ? rect.top - host.top : parseFloat(cs.paddingTop) || 0;

      caret.style.left = x + "px";
      caret.style.top = y + "px";
      caret.style.width = Math.max(3, medianCharWidth(cs)) + "px";
      caret.style.height = h + "px";
      caret.style.background = cs.color;
    }

    /* Placement direct : deux lectures de geometrie, c'est assez
       leger pour chaque frappe, et ca ne depend pas de
       requestAnimationFrame (qui ne tourne pas dans un onglet
       en arriere-plan). */
    function queueCaret() {
      placeCaret();
    }

    ["input", "keyup", "click", "focus", "blur", "scroll"].forEach((ev) =>
      preview.addEventListener(ev, queueCaret)
    );
    document.addEventListener("selectionchange", () => {
      if (document.activeElement === preview) queueCaret();
    });
    if (window.ResizeObserver) new ResizeObserver(queueCaret).observe(prevWrap);
    document.fonts.ready.then(queueCaret);
    /* La premiere pose tombe avant que la mise en page soit stable
       (fonte pas encore chargee, largeurs pas encore resolues) : on
       repasse quelques fois, sinon le curseur reste au mauvais
       endroit au lieu de la fin du texte. */
    [0, 120, 400, 900].forEach((d) => setTimeout(queueCaret, d));

    /* Corps de depart : une fois la fonte chargee, on recale pour
       que le texte court remplisse la largeur. */
    document.fonts.ready.then(fitTextToWidth);
    [80, 350, 900].forEach((d) => setTimeout(fitTextToWidth, d));
    window.addEventListener("resize", fitTextToWidth);
    /* le tiroir change la largeur de l'apercu : on recale */
    if (window.ResizeObserver) new ResizeObserver(fitTextToWidth).observe(prevWrap);

    const api = {
      el: body,
      panel: panel,
      preview: preview,
      previewWrap: prevWrap,
      placeCaret: queueCaret,
      rail: rail,
      setText: setText,
      fit: fitTextToWidth,
      font: font,
      /* la graisse actuellement ouverte : lue par le module
         « telecharger cette graisse » (render-grid.js) */
      getStyle: () => activeStyle
    };
    instances.push(api);
    return api;
  }

  /* Tous les editeurs vivants de la page. */
  const instances = [];

  return { create, stylesOf, defaultStyle, styleLabel, openStyleMenu, instances, randomPair, identityPair, readableOn, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb };
})();
