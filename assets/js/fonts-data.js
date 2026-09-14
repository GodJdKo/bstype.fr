/* ============================================================
   FONTS-DATA.JS — LA SEULE SOURCE DE DONNÉES DU CATALOGUE
   ------------------------------------------------------------
   Tout le site (pastilles, liste home, tableau "Fonts in use",
   pages spécimen) lit ce fichier.

   • AJOUTER UNE FONTE :
     1. Déposer le .otf/.ttf dans assets/fonts/
     2. Ajouter un @font-face dans assets/css/fonts.css
     3. Copier un bloc { ... } ci-dessous et remplir les champs
     4. Dupliquer un dossier fonts/<slug>/ (copier fonts/_template.html
        vers fonts/<slug>/index.html, y régler window.BS_SLUG)
     5. Déposer les médias dans fonts/<slug>/media/ puis lancer
        node scripts/generate-media-manifest.js

   • CHAMPS PRINCIPAUX :
     slug, name, variant, category, designer, year
     cssFamily → nom EXACT du @font-face (fonts.css)
     file      → chemin du fichier de police (download)
     demoText, showDemo, demoScale, inUse, pill  → page d'accueil

   • CHAMPS PAGE SPÉCIMEN :
     familyKey → prefixe des fichiers de cette fonte dans
              assets/fonts/ (ex: "JALLEAU" pour JALLEAU-Italic.otf).
              Sert a scripts/sync-fonts.js pour rattacher les
              nouveaux fichiers a la bonne fonte.
     styles → variantes ayant un VRAI fichier, remplies
              automatiquement par scripts/sync-fonts.js :
              [{ label, file, weight, style }]. Liste du menu
              "font family" de l'editeur.
     info   → blocs éditoriaux (zone "info") : [{ label, body }].
     editorDefaults → valeurs de départ de la zone "editor" :
              { text, family, size(px), lineHeight, letterSpacing(em),
                color(hex sans #), bg(hex sans #), align }.
     shuffleLayout → false pour figer la disposition ci-dessous.
              Par défaut la page se redispose à chaque rechargement
              (mêmes zones, ordre et largeurs tirés au sort).
     gridLayout → vivier de zones de la page. Une entrée
              = une zone : { type, span(1-4), content }.
              "span" sert de disposition de repli quand
              shuffleLayout est false.
              type : "characterset" | "media" | "info" |
                     "editor" | "blank"
              (l'apercu du glyphe fait partie de "characterset")
              (voir en-tête de assets/js/render-grid.js pour le
               détail de "content" par type). Modifiable ici, ou
               en direct via le ⌄ de chaque zone (non sauvegardé).
   ============================================================ */

window.BS_FONTS = [
  {
    slug: "bs-mono",
    name: "BS Mono",
    variant: "Regular",
    category: "Sans, Mono",
    designer: "Lucas Pernet",
    year: "2026",
    cssFamily: "BS Mono",
    file: "assets/fonts/BSMONO-Regular.otf",
    demoText: "Same width",
    showDemo: true,
    demoScale: 1,
    inUse: true,
    pill: { top: "26%", left: "5%" },
    familyKey: "BSMONO",
    styles: [
      { label: "Regular", file: "assets/fonts/BSMONO-Regular.otf", weight: 400, style: "normal" }
    ],
    info: [
      { label: "GENESIS", body: "Née d'un besoin d'outil : afficher du code et des interfaces sans bruit. Chasse fixe, formes sèches, aucune fioriture." },
      { label: "FUTURE", body: "Élargir la casse technique — flèches, symboles, ligatures de programmation — et ajouter une graisse medium pour le texte long." }
    ],
    infoEn: [
      { label: "GENESIS", body: "Born out of a need for a tool: showing code and interfaces without noise. Fixed width, dry shapes, no frills." },
      { label: "FUTURE", body: "Widen the technical case - arrows, symbols, programming ligatures - and add a medium weight for long text." }
    ],
    editorDefaults: { size: 44, lineHeight: 1.3, letterSpacing: 0, color: "D9D9D9", bg: "191919", align: "left" },
    gridLayout: [
      { type: "editor", span: 2, content: {} },
      { type: "characterset", span: 2, content: {} },
      { type: "info", span: 2, content: {} },
      { type: "media", span: 1, content: {} },
      { type: "blank", span: 1, content: {} }
    ]
  },
  {
    slug: "hexcd",
    name: "Hexcd",
    variant: "Regular",
    category: "Modular, Display",
    designer: "Enzo Cetera",
    year: "2025",
    cssFamily: "HEXCD",
    file: "assets/fonts/HEXCD-Regular.otf",
    demoText: "Modular ski",
    showDemo: true,
    demoScale: 1,
    inUse: true,
    pill: { top: "13%", left: "64%" },
    zip: "assets/fonts/HEXCD.zip",
    familyKey: "HEXCD",
    styles: [
      { label: "Extra Light", variant: "", cssFamily: "HEXCD", file: "assets/fonts/HEXCD-ExtraLight.otf", weight: 200, style: "normal" },
      { label: "Regular", variant: "", cssFamily: "HEXCD", file: "assets/fonts/HEXCD-Regular.otf", weight: 400, style: "normal" },
      { label: "Bold", variant: "", cssFamily: "HEXCD", file: "assets/fonts/HEXCD-Bold.otf", weight: 700, style: "normal" },
      { label: "Black", variant: "", cssFamily: "HEXCD", file: "assets/fonts/HEXCD-Black.otf", weight: 900, style: "normal" },
      { label: "Extra Black", variant: "", cssFamily: "HEXCD", file: "assets/fonts/HEXCD-ExtraBlack.otf", weight: 950, style: "normal" }
    ],
    info: [
      { label: "GENESIS", body: "Un système, pas un dessin. Chaque glyphe posé sur une trame hexagonale, pensé pour l'écran et le motion design." },
      { label: "FUTURE", body: "Version variable : densité et rotation du module en axe. Jeu de pictogrammes bâtis sur la même grille." }
    ],
    infoEn: [
      { label: "GENESIS", body: "A system, not a drawing. Every glyph sits on a hexagonal grid, made for screen and motion design." },
      { label: "FUTURE", body: "Variable version: module density and rotation on an axis. A set of pictograms built on the same grid." }
    ],
    editorDefaults: { size: 48, lineHeight: 1.2, letterSpacing: 0, color: "D9D9D9", bg: "191919", align: "left" },
    gridLayout: [
      { type: "editor", span: 3, content: {} },
      { type: "characterset", span: 2, content: {} },
      { type: "characterset", span: 2, content: {} },
      { type: "info", span: 2, content: {} },
      { type: "media", span: 2, content: {} }
    ]
  },
  {
    slug: "saint-trop",
    name: "Saint Trop",
    variant: "Regular",
    category: "Sans, Display",
    designer: "Lucas Pernet",
    year: "2026",
    cssFamily: "Saint Trop",
    file: "assets/fonts/SAINTTROP-Regular.ttf",
    demoText: "Plage privee",
    showDemo: false,
    demoScale: 1,
    inUse: true,
    pill: { top: "32%", left: "18%" },
    familyKey: "SAINTTROP",
    styles: [{ label: "Regular", file: "assets/fonts/SAINTTROP-Regular.ttf", weight: 400, style: "normal" }],
    info: [
      { label: "GENESIS", body: "Display sans-serif au ton estival. Contrastes francs, terminaisons nettes, esprit affiche de bord de mer." },
      { label: "FUTURE", body: "Un condensé pour les très gros titres, des capitales alternatives, des accents étendus." }
    ],
    infoEn: [
      { label: "GENESIS", body: "A display sans with a summer tone. Blunt contrast, clean terminals, seaside poster spirit." },
      { label: "FUTURE", body: "A condensed cut for very large headlines, alternate capitals, extended accents." }
    ],
    editorDefaults: { size: 54, lineHeight: 1.15, letterSpacing: 0, color: "D9D9D9", bg: "191919", align: "left" },
    gridLayout: [
      { type: "editor", span: 2, content: {} },
      { type: "media", span: 2, content: {} },
      { type: "characterset", span: 4, content: {} },
      { type: "info", span: 2, content: {} }
    ]
  },
  {
    slug: "arutext",
    name: "Arutext",
    variant: "Inverted",
    category: "Blackletter, Display",
    designer: "Lucas Pernet",
    year: "2026",
    cssFamily: "Arutext",
    file: "assets/fonts/ARUTEXT-Inverted.otf",
    demoText: "Gothique moderne",
    showDemo: false,
    demoScale: 1,
    inUse: true,
    pill: { top: "51%", left: "60%" },
    zip: "assets/fonts/ARUTEXT.zip",
    familyKey: "ARUTEXT",
    styles: [
      { label: "Inverted", variant: "", cssFamily: "Arutext Inverted", file: "assets/fonts/ARUTEXT-Inverted.otf", weight: 400, style: "normal" },
      { label: "Smearing", variant: "", cssFamily: "Arutext Smearing", file: "assets/fonts/ARUTEXT-Smearing.otf", weight: 400, style: "normal" },
      { label: "Tipnib", variant: "", cssFamily: "Arutext Tipnib", file: "assets/fonts/ARUTEXT-Tipnib.otf", weight: 400, style: "normal" }
    ],
    info: [
      { label: "GENESIS", body: "Blackletter passée à l'envers : les pleins deviennent déliés. Lecture graphique avant lecture de texte." },
      { label: "FUTURE", body: "Une version pour petits corps, des ligatures gothiques historiques, un jeu de lettrines." }
    ],
    infoEn: [
      { label: "GENESIS", body: "Blackletter turned inside out: the thicks become thins. Graphic reading before text reading." },
      { label: "FUTURE", body: "A version for small sizes, historical gothic ligatures, a set of drop caps." }
    ],
    editorDefaults: { size: 60, lineHeight: 1.2, letterSpacing: 0, color: "D9D9D9", bg: "191919", align: "left" },
    gridLayout: [
      { type: "media", span: 2, content: {} },
      { type: "editor", span: 2, content: {} },
      { type: "info", span: 2, content: {} },
      { type: "characterset", span: 2, content: {} }
    ]
  },
  {
    slug: "baton",
    name: "Baton",
    variant: "Regular",
    category: "Script",
    designer: "Lucas Pernet",
    year: "2026",
    cssFamily: "Baton",
    file: "assets/fonts/BATON-Regular.otf",
    demoText: "Passe le relais",
    showDemo: false,
    demoScale: 1,
    inUse: true,
    pill: { top: "20%", left: "76%" },
    zip: null,
    familyKey: "BATON",
    styles: [
      { label: "Regular", variant: "", cssFamily: "Baton", file: "assets/fonts/BATON-Regular.otf", weight: 400, style: "normal" }
    ],
    info: [
      { label: "GENESIS", body: "Script du geste rapide : tracé d'un seul trait, comme un relais qu'on passe sans s'arrêter." },
      { label: "FUTURE", body: "Des alternatives contextuelles pour casser la répétition, des capitales complètes, une variante « marker » plus épaisse." }
    ],
    infoEn: [
      { label: "GENESIS", body: "A script of the quick gesture: drawn in one stroke, like a baton passed without stopping." },
      { label: "FUTURE", body: "Contextual alternates to break up repetition, a full set of capitals, a thicker marker variant." }
    ],
    editorDefaults: { size: 64, lineHeight: 1.3, letterSpacing: 0, color: "D9D9D9", bg: "191919", align: "left" },
    gridLayout: [
      { type: "editor", span: 2, content: {} },
      { type: "media", span: 2, content: {} },
      { type: "characterset", span: 2, content: {} },
      { type: "info", span: 2, content: {} }
    ]
  },
  {
    slug: "persvrance",
    name: "Persvrance",
    variant: "Regular",
    category: "Modular, Display",
    designer: "José GARBEROGLIO",
    year: "2026",
    cssFamily: "Persvrance",
    file: "assets/fonts/PERSVRANCE-Fusion-Regular.ttf",
    demoText: "Persvrance",
    showDemo: true,
    demoScale: 1,
    inUse: false,
    pill: { top: "40%", left: "40%" },
    zip: "assets/fonts/PERSVRANCE.zip",
    familyKey: "PERSVRANCE",
    styles: [
      { label: "Regular", variant: "Carre 45 Fusion", cssFamily: "Persvrance Carre 45 Fusion", file: "assets/fonts/Persvrance-Carre45Fusion-Regular.ttf", weight: 400, style: "normal" },
      { label: "Regular", variant: "Fusion", cssFamily: "Persvrance Fusion", file: "assets/fonts/PERSVRANCE-Fusion-Regular.ttf", weight: 400, style: "normal" }
    ],
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
  },
  {
    slug: "jalleau",
    name: "Jalleau",
    variant: "Regular",
    category: "Text, Serif",
    designer: "Lucas PERNET",
    year: "2026",
    cssFamily: "Jalleau",
    file: "assets/fonts/JALLEAU-Regular.otf",
    demoText: "Jalleau",
    showDemo: true,
    demoScale: 1,
    inUse: false,
    pill: { top: "40%", left: "40%" },
    zip: "assets/fonts/JALLEAU.zip",
    familyKey: "JALLEAU",
    styles: [
      { label: "Regular", variant: "", cssFamily: "Jalleau", file: "assets/fonts/JALLEAU-Regular.otf", weight: 400, style: "normal" },
      { label: "Italic", variant: "", cssFamily: "Jalleau", file: "assets/fonts/JALLEAU-Italic.otf", weight: 400, style: "italic" },
      { label: "Bold", variant: "", cssFamily: "Jalleau", file: "assets/fonts/JALLEAU-Bold.otf", weight: 700, style: "normal" }
    ],
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
];

/* Ordre des lignes du tableau "Fonts in use" (slugs). */
window.BS_FONTS_IN_USE_ORDER = [
  "bs-mono",
  "saint-trop",
  "hexcd",
  "arutext",
  "baton"
  
];
