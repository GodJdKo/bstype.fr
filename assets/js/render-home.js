/* ============================================================
   RENDER-HOME.JS — CONTENU DE LA PAGE D'ACCUEIL
   ------------------------------------------------------------
   Lit window.BS_FONTS (fonts-data.js) et window.BS_INUSE
   (inuse-data.js, genere par scripts/sync-fonts.js) et injecte :

   - le nuage de pastilles : UNE PAR FONTE, position tiree au sort
     a chaque chargement, et qui derive doucement
   - le catalogue : TOUTES les fontes, dans un ordre tire au sort
     a chaque chargement. Une fonte = un module, avec les memes
     contours, menus, sliders et boutons que les pages specimen
   - la section "Fonts in use" : une ligne par fonte AYANT des
     travaux dans fonts/<slug>/inUse/. Cliquer une ligne la
     deplie et montre les images/videos + le texte + un gros
     bouton vers la page de la fonte.

   Les variantes proposees (font family) sont les VRAIES graisses
   presentes dans assets/fonts/, jamais des styles inventes.
   ============================================================ */

(function () {
  /* raccourci vers les textes d'interface (assets/js/i18n.js) */
  const t = (k) => (window.BSI18n ? window.BSI18n.t(k) : k);

  const fonts = window.BS_FONTS || [];
  const inUse = window.BS_INUSE || {};
  const ALIGNS = ["left", "center", "right", "justify"];

  const shuffle = (a) => {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  };
  const rand = (min, max) => min + Math.random() * (max - min);

  function dots() {
    const d = document.createElement("span");
    d.className = "dots";
    return d;
  }

  /* ---- 1. Pastilles : une par fonte, placees au hasard ----
     Contraintes : elles restent DANS la page (marges comprises,
     derive incluse) et ne descendent jamais sur le titre ni sur la
     ligne de sous-titre, qui doivent rester lisibles et cliquables. */
  const pillsContainer = document.querySelector(".pills");
  if (pillsContainer) {
    const DRIFT = 22;        /* amplitude max de la derive, en px */
    const TOP_SAFE = 3;      /* % : sous la nav */

    /* Jusqu'ou les pastilles ont le droit de descendre ? Jusqu'au
       titre, pas plus. On le MESURE au lieu de le deviner : sinon
       elles se tassent toutes en haut et laissent le bas vide. */
    function bottomSafe() {
      const hero = document.querySelector(".hero");
      const title = document.querySelector(".hero__title");
      if (!hero || !title) return 62;
      const hr = hero.getBoundingClientRect();
      const tr = title.getBoundingClientRect();
      if (!hr.height) return 62;
      const pct = ((tr.top - hr.top) / hr.height) * 100 - 2;
      return Math.max(35, Math.min(94, pct));
    }

    const list = shuffle(fonts);
    const pills = list.map((f) => {
      const a = document.createElement("a");
      a.href = "fonts/" + f.slug + "/";
      a.className = "pill";
      /* le nom vit dans un span : la pastille elle-meme porte le
         halo noir (voir .pill / .pill__label dans home.css) */
      const lb = document.createElement("span");
      lb.className = "pill__label";
      lb.textContent = f.name;
      a.appendChild(lb);
      a.style.setProperty("--drift-x", rand(-DRIFT, DRIFT).toFixed(1) + "px");
      a.style.setProperty("--drift-y", rand(-DRIFT, DRIFT).toFixed(1) + "px");
      a.style.setProperty("--drift-t", rand(3.2, 6.5).toFixed(1) + "s");
      a.style.setProperty("--drift-d", rand(-4, 0).toFixed(1) + "s");
      pillsContainer.appendChild(a);
      return a;
    });

    /* Une pastille par case d'une grille, decalee au hasard DANS sa
       case : jamais deux au meme endroit, et toute la hauteur
       disponible est occupee. */
    function placePills() {
      const box = pillsContainer.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const bottom = bottomSafe();

      /* Combien de colonnes ? Au plus autant que de pastilles qui
         tiennent cote a cote SANS se chevaucher. Sur un ecran
         etroit, cela retombe a une seule colonne. */
      let widest = 0;
      pills.forEach((a) => { widest = Math.max(widest, a.offsetWidth); });
      const fit = widest ? Math.floor(box.width / widest) : 4;
      const cols = Math.max(1, Math.min(4, Math.min(fit, Math.ceil(Math.sqrt(pills.length)))));
      const rows = Math.ceil(pills.length / cols);
      const slots = shuffle(pills.map((_, i) => i));
      const cellW = 100 / cols;
      const cellH = (bottom - TOP_SAFE) / rows;

      pills.forEach((a, i) => {
        const slot = slots[i];
        const cx = slot % cols;
        const cy = Math.floor(slot / cols);

        /* On tient compte de la TAILLE de la pastille : sans ca, le
           bas et la droite de chaque case restaient toujours vides
           et tout se tassait en haut. */
        const wPct = (a.offsetWidth / box.width) * 100;
        const hPct = (a.offsetHeight / box.height) * 100;

        const l0 = cx * cellW;
        const l1 = Math.max(l0, (cx + 1) * cellW - wPct);
        const t0 = TOP_SAFE + cy * cellH;
        const t1 = Math.max(t0, TOP_SAFE + (cy + 1) * cellH - hPct);

        a.style.left = rand(l0, l1) + "%";
        a.style.top = rand(t0, t1) + "%";
      });
    }

    placePills();
    /* La hauteur du titre change avec la LARGEUR de la fenetre.
       PIEGE TELEPHONE : la barre d'adresse qui se replie en plein
       defilement change la hauteur de la fenetre, et chaque fois les
       pastilles etaient retirees au sort — elles sautaient partout
       pendant qu'on faisait defiler. On ne reagit donc qu'a un
       changement de largeur. */
    let largeurPastilles = document.documentElement.clientWidth;
    window.addEventListener("resize", () => {
      const l = document.documentElement.clientWidth;
      if (l === largeurPastilles) return;
      largeurPastilles = l;
      placePills();
    });
    window.addEventListener("load", placePills);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placePills);
  }

  /* ---- 2. Catalogue ----
     La page s'ouvre sur TROIS fontes seulement, suivies d'un module
     « voir tout » dessine comme le bouton de telechargement des
     pages de fonte. Il deplie le catalogue entier (une fonte = un
     module) et allonge la page ; un bouton « fermer » en haut ET en
     bas du paquet revient a trois.
     Changer le chiffre ci-dessous change le nombre de depart. */
  const VISIBLE = 3;

  const catalog = document.querySelector(".catalog");
  if (catalog) buildCatalog(catalog);

  function catalogButton(word1, word2, meta, className) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "catalog__btn" + (className ? " " + className : "");
    const label = document.createElement("span");
    label.className = "catalog__btn-label";
    label.innerHTML = "<i>" + word1 + "</i><i>" + word2 + "</i>";
    const m = document.createElement("span");
    m.className = "catalog__btn-meta";
    m.textContent = meta;
    b.append(label, dots(), m);
    return b;
  }

  function buildCatalog(host) {
    const order = shuffle(fonts);

    const topClose = catalogButton(t("home.close"), "", order.length + " " + t("home.fonts"), "catalog__btn--close");
    topClose.hidden = true;

    const list = document.createElement("div");
    list.className = "catalog__list";

    const more = catalogButton(t("home.seeall1"), t("home.seeall2"),
      order.length + " " + t("home.fonts"), "catalog__btn--more");

    const bottomClose = catalogButton(t("home.close"), "", order.length + " " + t("home.fonts"), "catalog__btn--close");
    bottomClose.hidden = true;

    host.append(topClose, list, more, bottomClose);

    let built = 0;
    function buildUpTo(n) {
      while (built < n && built < order.length) {
        /* au-dela des trois premiers, le module NAIT replie : la
           classe est posee avant l'insertion dans la page, donc
           aucune animation ne se declenche a la creation. */
        buildFontModule(list, order[built], built >= VISIBLE);
        built += 1;
      }
    }

    /* Les modules ne sont pas masques par "hidden" mais par une
       classe : c'est ce qui permet de les ouvrir et de les refermer
       EN ANIMANT leur hauteur. Un petit decalage par module donne
       l'impression qu'ils se deplient l'un apres l'autre. */
    function fold(row, folded, delay) {
      row.style.transitionDelay = delay + "ms";
      /* Filet de securite des DEUX cotes : si les transitions ne
         jouent pas (vieux navigateur, mode economie d'energie), le
         module doit quand meme finir a l'etat voulu. On pose donc
         la valeur finale en dur une fois l'animation theoriquement
         terminee — sans effet visible quand elle a bien joue. */
      const finir = () => {
        const replie = row.classList.contains("is-folded");
        row.style.maxHeight = replie ? "0px" : "none";
      };

      if (folded) {
        row.style.maxHeight = "";        /* on repart de la valeur CSS */
        void row.offsetHeight;           /* pour que le depart soit fige */
        row.classList.add("is-folded");
      } else {
        row.style.maxHeight = "";
        row.classList.remove("is-folded");
      }
      setTimeout(finir, 520 + delay);
    }

    function expand() {
      buildUpTo(order.length);
      const rows = [...list.querySelectorAll(".font-row")];
      more.hidden = true;
      topClose.hidden = false;
      bottomClose.hidden = false;
      /* un souffle avant de lancer : le module vient d'etre pose
         dans la page, il doit d'abord y exister a l'etat replie */
      setTimeout(() => {
        rows.forEach((r, i) => fold(r, false, i < VISIBLE ? 0 : (i - VISIBLE) * 55));
      }, 20);
    }

    function collapse() {
      /* On ne DETRUIT pas les modules deja construits : on les
         replie. Revenir a « voir tout » est alors instantane, et on
         ne recharge pas les fontes. */
      const rows = [...list.querySelectorAll(".font-row")];
      const extra = rows.length - VISIBLE;
      rows.forEach((r, i) => {
        /* on referme en partant du bas : la page se retracte vers
           le haut au lieu de sauter */
        fold(r, i >= VISIBLE, i >= VISIBLE ? (extra - (i - VISIBLE) - 1) * 45 : 0);
      });
      topClose.hidden = true;
      host.scrollIntoView({ block: "start" });
      setTimeout(() => {
        more.hidden = false;
        bottomClose.hidden = true;
      }, 260);
    }

    more.addEventListener("click", expand);
    topClose.addEventListener("click", collapse);
    bottomClose.addEventListener("click", collapse);

    buildUpTo(VISIBLE);
  }

  /* Un module de fonte = LE MODULE EDITEUR (assets/js/editor-module.js),
     le meme que sur les pages de fonte, mis a l'echelle de la page
     d'accueil. Un seul composant, donc un seul comportement. */
  function buildFontModule(host, f, folded) {
    let activeFont = f;

    const row = document.createElement("article");
    row.className = "font-row grid-cell" + (folded ? " is-folded" : "");

    const head = document.createElement("div");
    head.className = "zone__head";
    const name = document.createElement("span");
    name.className = "zone__name";
    const chev = document.createElement("button");
    chev.type = "button";
    chev.className = "zone__chev";
    chev.setAttribute("aria-label", t("home.pickfont"));
    chev.textContent = "V";
    head.append(name, dots(), chev);
    head.setAttribute("role", "button");
    head.tabIndex = 0;
    row.appendChild(head);

    const slot = document.createElement("div");
    slot.className = "font-row__body";
    row.appendChild(slot);
    host.appendChild(row);

    let editor = null;

    function mount(font) {
      activeFont = font;
      name.textContent = font.name + " ";
      slot.innerHTML = "";
      editor = window.BSEditor.create({
        font: font,
        fileBase: "",
        /* les reglages sortent en tiroir, tous visibles d'un coup */
        drawer: true
      });
      /* lien vers la page de la fonte, aligne avec les boutons
         d'alignement et le bouton random */
      const view = document.createElement("a");
      view.className = "editor__view editor__rail-btn";
      view.href = "fonts/" + font.slug + "/";
      view.textContent = t("home.viewfont");
      /* dans la colonne de gauche, entre la poignee du tiroir et
         le bouton « hasard » */
      const rail = editor.rail;
      const rnd = rail && rail.querySelector(".editor__random");
      if (rail && rnd) rail.insertBefore(view, rnd);
      else if (rail) rail.appendChild(view);
      slot.appendChild(editor.el);
      if (editor.placeCaret) editor.placeCaret();
    }

    function openFontMenu() {
      window.BSPopup.list({
        anchor: chev,
        title: t("menu.font"),
        /* chaque nom dans sa propre fonte, comme dans le header */
        items: fonts.map((x) => ({ value: x.slug, label: x.name, family: x.cssFamily })),
        selected: activeFont.slug,
        onPick: (slugValue) => {
          const font = fonts.find((x) => x.slug === slugValue);
          if (font) mount(font);
        }
      });
    }
    head.addEventListener("click", openFontMenu);
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFontMenu(); }
    });

    mount(f);
    return row;
  }

  /* ---- 3. Fonts in use : une ligne par fonte ayant des travaux ---- */
  const list = document.querySelector(".in-use__list");
  if (list) {
    const order = (window.BS_FONTS_IN_USE_ORDER || []).slice();
    fonts.forEach((f) => { if (order.indexOf(f.slug) < 0) order.push(f.slug); });

    let any = false;
    order.forEach((slug) => {
      const f = fonts.find((x) => x.slug === slug);
      const works = inUse[slug];
      /* rien dans le dossier inUse/ : pas de ligne du tout */
      if (!f || !works || !works.items || !works.items.length) return;
      any = true;
      buildInUseRow(list, f, works);
    });

    const section = document.querySelector(".in-use");
    if (!any && section) section.hidden = true;
  }

  /* ---- la bulle flottante des travaux ----
     Survoler une ligne ouvre une bulle qui SUIT la souris, dans le
     style de la bulle « a propos » : les visuels d'un cote, le
     texte de l'autre. Elle flotte au-dessus de la page : la section
     ne change jamais de hauteur. Cliquer la ligne ouvre le projet
     (champ "link" de fonts/<slug>/inUse/manifest.json). */
  let bubble = null;
  let bubbleTimer = 0;
  const pos = { x: 0, y: 0, tx: 0, ty: 0 };

  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement("div");
    bubble.className = "inuse-bubble";
    bubble.innerHTML = '<div class="inuse-bubble__media"></div><div class="inuse-bubble__side"></div>';
    document.body.appendChild(bubble);
    return bubble;
  }

  /* deplacement doux : on va vers la souris par petits pas */
  function step() {
    pos.x += (pos.tx - pos.x) * 0.18;
    pos.y += (pos.ty - pos.y) * 0.18;
    if (bubble) bubble.style.transform = "translate3d(" + Math.round(pos.x) + "px," + Math.round(pos.y) + "px,0)";
  }

  function startFollow() {
    if (bubbleTimer) return;
    bubbleTimer = setInterval(step, 16);
  }

  function stopFollow() {
    if (!bubbleTimer) return;
    clearInterval(bubbleTimer);
    bubbleTimer = 0;
  }

  function aim(e) {
    const b = ensureBubble();
    const w = b.offsetWidth || 520;
    const h = b.offsetHeight || 260;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    /* la bulle se pose en bas a droite du curseur, et se retourne
       quand elle sortirait de la fenetre */
    let x = e.clientX + 24;
    let y = e.clientY + 20;
    if (x + w > vw - 12) x = Math.max(12, e.clientX - w - 24);
    if (y + h > vh - 12) y = Math.max(12, vh - h - 12);
    pos.tx = x;
    pos.ty = y;
  }

  function showBubble(f, works, e) {
    const b = ensureBubble();
    const media = b.querySelector(".inuse-bubble__media");
    const side = b.querySelector(".inuse-bubble__side");

    media.innerHTML = "";
    (works.items || []).slice(0, 4).forEach((it) => {
      const src = "fonts/" + f.slug + "/inUse/" + it.file;
      if (it.kind === "video") {
        const v = document.createElement("video");
        v.src = src; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "metadata";
        v.play().catch(() => {});
        media.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.src = src; img.alt = ""; img.loading = "lazy";
        media.appendChild(img);
      }
    });

    side.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = f.name;
    h.style.fontFamily = "'" + f.cssFamily + "'";
    side.appendChild(h);
    if (works.text) {
      const p = document.createElement("p");
      p.textContent = works.text;
      side.appendChild(p);
    }
    const cta = document.createElement("span");
    cta.className = "inuse-bubble__cta";
    cta.textContent = t("home.project");
    side.appendChild(cta);

    /* premiere pose : sous la souris tout de suite, sans glissade */
    aim(e);
    pos.x = pos.tx;
    pos.y = pos.ty;
    step();
    b.classList.add("is-open");
    startFollow();
  }

  function hideBubble() {
    stopFollow();
    if (bubble) bubble.classList.remove("is-open");
  }

  function buildInUseRow(list, f, works) {
    const item = document.createElement("div");
    item.className = "in-use__entry";

    /* la ligne EST le lien vers le projet */
    const row = document.createElement(works.link ? "a" : "div");
    row.className = "in-use__row";
    if (works.link) {
      row.href = works.link;
      row.target = "_blank";
      row.rel = "noopener noreferrer";
    } else {
      row.tabIndex = 0;
      row.setAttribute("role", "link");
      row.addEventListener("click", () => { window.location.href = "fonts/" + f.slug + "/"; });
    }

    [f.name, f.category, f.year, f.designer].forEach((v) => {
      const c = document.createElement("span");
      c.textContent = v;
      row.appendChild(c);
    });

    row.addEventListener("mouseenter", (e) => showBubble(f, works, e));
    row.addEventListener("mousemove", aim);
    row.addEventListener("mouseleave", hideBubble);
    row.addEventListener("focus", () => row.scrollIntoView({ block: "nearest" }));

    item.appendChild(row);
    list.appendChild(item);
  }
})();
