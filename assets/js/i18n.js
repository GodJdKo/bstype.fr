/* ============================================================
   I18N.JS — LE SITE EN FRANCAIS OU EN ANGLAIS
   ------------------------------------------------------------
   Le bouton FR/EN de la barre du haut change la langue de TOUT
   le site. Pas de melange : une fois la langue choisie, chaque
   texte d'interface vient de la colonne correspondante.

   POUR TRADUIRE OU CORRIGER UN TEXTE :
   tout est dans le tableau DICT ci-dessous. Une ligne =
       cle: { fr: "texte francais", en: "english text" }
   Rien d'autre a toucher.

   POUR AJOUTER UN TEXTE DANS UNE PAGE HTML :
   ecrire  <span data-i18n="ma-cle"></span>  puis ajouter
   "ma-cle" dans DICT.

   Les textes EDITORIAUX (presentation des fontes, bulle
   « a propos ») ne sont pas ici :
     - fontes  : champs  info  (fr) et  infoEn  (en) dans
                 assets/js/fonts-data.js
     - bulles  : assets/authorfaces/<CLE>.txt (fr) et
                 assets/authorfaces/<CLE>.en.txt (en)

   La langue est retenue dans le navigateur ; en changer
   recharge la page (c'est ce qui garantit qu'il ne reste aucun
   texte dans l'autre langue).
   ============================================================ */

window.BSI18n = (function () {
  const STORE = "bs.lang";
  const LANGS = ["fr", "en"];

  const DICT = {
    /* ---- barre du haut ---- */
    "nav.fonts":            { fr: "Fontes",              en: "Fonts" },
    "nav.lang":             { fr: "Changer de langue",   en: "Switch language" },

    /* ---- page d'accueil ---- */
    "home.title":           { fr: "BS.type — Fonderie de caracteres open source",
                              en: "BS.type — Open source type foundry" },
    "home.description":     { fr: "BS.type, fonderie de caracteres independante, francaise, open source et a but non lucratif.",
                              en: "BS.type, an independent French type foundry: open source and not for profit." },
    "home.subtitle":        { fr: "Fonderie francaise independante, open source",
                              en: "Open source, independant French type foundry" },
    "home.inuse":           { fr: "Fontes en usage",     en: "Fonts in use" },
    "home.col.name":        { fr: "Nom",                 en: "Name" },
    "home.col.type":        { fr: "Genre",               en: "Type" },
    "home.col.date":        { fr: "Date",                en: "Date" },
    "home.col.designer":    { fr: "Dessinateur",         en: "Designer" },
    "home.footer":          { fr: "Fonderie independante — faite en France, tranquille et open source.",
                              en: "Independent foundry — made in France, chill & open source." },

    /* --- pied de page (assets/js/footer.js) ---
       La ligne orange tient sur DEUX lignes : le retour a la ligne
       est ecrit tel quel dans le texte. */
    "foot.tagline":         { fr: "FONDERIE DE CARACTERES FRANCAISE,\nINDEPENDANTE ET OPEN SOURCE",
                              en: "OPEN SOURCE, INDEPENDENT\nFRENCH TYPE FOUNDRY" },
    "foot.founded":         { fr: "FONDEE PAR ENZO CETERA ET LUCAS PERNET",
                              en: "FOUNDED BY ENZO CETERA AND LUCAS PERNET" },
    "home.viewfont":        { fr: "voir",                en: "view" },
    "home.seeall1":         { fr: "voir",                en: "see" },
    "home.seeall2":         { fr: "tout",                en: "all" },
    "home.close":           { fr: "fermer",              en: "close" },
    "home.fonts":           { fr: "fontes",              en: "typefaces" },
    "home.project":         { fr: "Voir le projet",      en: "See the project" },
    "home.pickfont":        { fr: "Choisir la fonte prévisualisée",
                              en: "Choose the previewed typeface" },

    /* ---- types de module (page d'une fonte) ---- */
    "zone.characterset":    { fr: "jeu de caracteres",   en: "characterset" },
    "zone.media":           { fr: "media",               en: "media" },
    "zone.info":            { fr: "infos",               en: "info" },
    "zone.editor":          { fr: "editeur",             en: "editor" },
    "zone.download":        { fr: "telechargement",      en: "download" },
    "zone.blank":           { fr: "vide",                en: "blank" },
    "zone.change":          { fr: "Changer le type de ce module",
                              en: "Change this module's type" },

    /* ---- menus ---- */
    "menu.fonts":           { fr: "fontes",              en: "fonts" },
    "menu.font":            { fr: "fonte",               en: "font" },
    "menu.mediaTitle":      { fr: "media de cette page", en: "media for this page" },
    "menu.mediaEmpty":      { fr: "(dossier media vide)", en: "(media folder is empty)" },

    /* ---- module editeur ---- */
    "ed.family":            { fr: "famille",             en: "font family" },
    "ed.variant":           { fr: "variante",            en: "font variant" },
    "ed.style":             { fr: "style",               en: "font style" },
    "ed.size":              { fr: "corps",               en: "font size" },
    "ed.lineHeight":        { fr: "interligne",          en: "line height" },
    "ed.letterSpacing":     { fr: "approche",            en: "letter spacing" },
    "ed.color":             { fr: "couleur du texte",    en: "font color" },
    "ed.bg":                { fr: "couleur du fond",     en: "background color" },
    "ed.random":            { fr: "hasard",              en: "random" },
    "ed.align":             { fr: "Aligner",             en: "Align" },
    "ed.sample":            { fr: "Ecrire ici.",         en: "Type something here." },
    "ed.drawerOpen":        { fr: "Ouvrir les reglages", en: "Open the settings" },
    "ed.drawerClose":       { fr: "Fermer les reglages", en: "Close the settings" },
    "ed.sample1":           { fr: "Un mot",              en: "One word" },
    "ed.sample2":           { fr: "Une ligne",           en: "One line" },
    "ed.sample3":           { fr: "Un paragraphe",       en: "A paragraph" },

    /* ---- jeu de caracteres ---- */
    "cs.metrics":           { fr: "mesures",             en: "measurements" },
    "cs.ascender":          { fr: "ascendante",          en: "ascender" },
    "cs.capHeight":         { fr: "hauteur de capitale", en: "cap height" },
    "cs.xHeight":           { fr: "hauteur d'oeil",      en: "x height" },
    "cs.baseline":          { fr: "ligne de base",       en: "baseline" },
    "cs.descender":         { fr: "descendante",         en: "descender" },

    /* ---- module telechargement ---- */
    "dl.word1":             { fr: "tele",                en: "down" },
    "dl.word2":             { fr: "charger",             en: "load" },
    "dl.all":               { fr: "tout",                en: "all" },
    "dl.selected":          { fr: "selection",           en: "selected" },
    "dl.variants":          { fr: "variantes",           en: "variants" },
    "dl.variant":           { fr: "variante",            en: "variant" },
    "dl.styles":            { fr: "styles",              en: "styles" },
    "dl.style":             { fr: "style",               en: "style" },
    "dl.allTitle":          { fr: "Telecharger toute la famille (ZIP)",
                              en: "Download the whole family (ZIP)" },
    "dl.selTitle":          { fr: "Telecharger la graisse choisie",
                              en: "Download the chosen style" },
    "dl.pick":              { fr: "Choisir la graisse a telecharger",
                              en: "Choose the style to download" },

    /* ---- bulle « a propos » ---- */
    "about.close":          { fr: "Fermer",              en: "Close" },
    "about.label":          { fr: "A propos",            en: "About" },
    "about.todo":           { fr: "Texte a ecrire dans assets/authorfaces/bstype.txt",
                              en: "Text to be written in assets/authorfaces/bstype.en.txt" }
  };

  /* langue retenue, sinon celle du navigateur, sinon francais */
  function initial() {
    let saved = null;
    try { saved = localStorage.getItem(STORE); } catch (_e) {}
    if (LANGS.indexOf(saved) >= 0) return saved;
    return /^en/i.test(navigator.language || "") ? "en" : "fr";
  }

  let lang = initial();
  document.documentElement.lang = lang;

  function t(key) {
    const row = DICT[key];
    if (!row) return key;              /* cle inconnue : visible, donc corrigeable */
    return row[lang] || row.fr || key;
  }

  /* Choisit entre deux valeurs deja ecrites (textes editoriaux). */
  function pick(fr, en) {
    return lang === "en" ? (en || fr) : (fr || en);
  }

  function set(next) {
    if (LANGS.indexOf(next) < 0 || next === lang) return;
    try { localStorage.setItem(STORE, next); } catch (_e) {}
    /* On RECHARGE : c'est la seule facon simple de garantir qu'il
       ne reste pas un seul texte dans l'autre langue. */
    window.location.reload();
  }

  /* Remplit les textes ecrits en dur dans les pages HTML. */
  function applyStatic(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    (root || document).querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    (root || document).querySelectorAll("[data-i18n-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-label")));
    });
    const meta = document.querySelector('meta[name="description"][data-i18n-meta]');
    if (meta) meta.setAttribute("content", t(meta.getAttribute("data-i18n-meta")));
  }

  /* Bouton FR/EN de la barre du haut. */
  function wireToggle() {
    const host = document.querySelector(".nav");
    if (!host || host.querySelector(".nav__lang")) return;
    const box = document.createElement("div");
    box.className = "nav__lang";
    box.setAttribute("aria-label", t("nav.lang"));
    LANGS.forEach((code) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nav__lang-btn";
      b.textContent = code.toUpperCase();
      b.setAttribute("lang", code);
      if (code === lang) b.classList.add("is-active");
      b.addEventListener("click", () => set(code));
      box.appendChild(b);
    });
    host.appendChild(box);
  }

  function boot() {
    applyStatic();
    wireToggle();
    const title = document.querySelector("title[data-i18n]");
    if (title) document.title = t(title.getAttribute("data-i18n"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { t, pick, set, applyStatic, get lang() { return lang; } };
})();
