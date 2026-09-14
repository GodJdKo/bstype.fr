/* ============================================================
   ABOUT-BUBBLE.JS — LA BULLE QUI S'OUVRE DEPUIS LA TETE
   ------------------------------------------------------------
   Il n'y a plus de page "about" : cliquer la tete en bas a droite
   ouvre une bulle, sa pointe dirigee vers la tete.

     - page d'accueil : le texte de la fonderie
       (assets/authorfaces/bstype.txt)
     - page d'une fonte : le texte de SON auteur
       (assets/authorfaces/<CLE>.txt, ex. ENZOC.txt)

   Le titre « thanks 4 using BS.type! » tire une fonte du catalogue
   AU HASARD POUR CHAQUE LETTRE. A l'ouverture les lettres defilent
   entre les fontes puis se figent une a une, jusqu'a s'arreter sur
   une combinaison tiree au sort.

   Un disque orange apparait derriere la tete tant que la bulle est
   ouverte (classe is-about sur la vignette, voir base.css).
   ============================================================ */

(function () {
  const TITLE = "thanks 4 using BS.type!";
  /* raccourci vers les textes d'interface (assets/js/i18n.js) */
  const t = (k) => (window.BSI18n ? window.BSI18n.t(k) : k);
  const pick = (fr, en) => (window.BSI18n ? window.BSI18n.pick(fr, en) : fr);

  function fonts() {
    return (window.BS_FONTS || []).filter((f) => f.cssFamily);
  }

  /* Quel texte pour cette page, et dans quelle langue ?
     Textes francais : assets/authorfaces/<CLE>.txt
     Textes anglais  : assets/authorfaces/<CLE>.en.txt
     (bstype.txt / bstype.en.txt pour la fonderie) */
  function content() {
    const slug = window.BS_SLUG;
    if (slug && window.BS_BUBBLES) {
      const font = (window.BS_FONTS || []).find((f) => f.slug === slug);
      const fr = font && window.BS_BUBBLES[font.designer];
      const en = font && (window.BS_BUBBLES_EN || {})[font.designer];
      if (fr || en) return { data: pick(fr, en) || fr || en, title: font.designer };
    }
    return { data: pick(window.BS_FOUNDRY, window.BS_FOUNDRY_EN) || window.BS_FOUNDRY || null, title: null };
  }

  let el = null;      /* la bulle */
  let letters = [];   /* les <span> du titre */
  let spinning = 0;

  function pickFamily() {
    const list = fonts();
    if (!list.length) return "";
    return list[Math.floor(Math.random() * list.length)].cssFamily;
  }

  function buildTitle(host, text) {
    letters = [];
    Array.from(text).forEach((ch) => {
      const s = document.createElement("span");
      s.className = "about__ch";
      if (ch === " ") {
        s.innerHTML = "&nbsp;";
        s.classList.add("is-space");
      } else {
        s.textContent = ch;
        s.dataset.final = pickFamily();
        s.style.fontFamily = "'" + s.dataset.final + "'";
      }
      host.appendChild(s);
      letters.push(s);
    });
  }

  /* ---- largeur des lettres ----
     Chaque case fait la chasse de la lettre DANS SA FONTE FINALE :
     le titre garde sa longueur normale, sur une seule ligne. Pendant
     le defilement, une fonte plus large que la case est resserree
     (scaleX) au lieu de deborder sur la voisine : jamais de
     chevauchement, jamais de saut. */
  let measureCtx = null;
  let letterSize = 0;
  const advCache = new Map();

  /* Les largeurs se mesurent DANS les vraies fontes. A la premiere
     ouverture elles ne sont pas encore chargees (le navigateur ne
     charge une fonte que lorsqu'un texte la demande) : on mesurait
     alors la police de secours et les lettres se chevauchaient. On
     force donc leur chargement avant de mesurer. */
  let facesReady = null;

  function loadFaces() {
    if (facesReady) return facesReady;
    if (!document.fonts || !document.fonts.load) {
      facesReady = Promise.resolve();
      return facesReady;
    }
    const jobs = fonts().map((f) =>
      document.fonts.load("40px '" + f.cssFamily + "'", TITLE).catch(() => {})
    );
    facesReady = Promise.all(jobs).then(() => document.fonts.ready).catch(() => {});
    return facesReady;
  }

  function advance(family, ch, size) {
    const key = family + "::" + ch + "::" + size;
    if (advCache.has(key)) return advCache.get(key);
    if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
    measureCtx.font = size + "px '" + family + "'";
    const w = measureCtx.measureText(ch).width;
    advCache.set(key, w);
    return w;
  }

  /* pose une fonte sur une lettre, resserree si elle deborde */
  function wear(span, family) {
    span.style.fontFamily = "'" + family + "'";
    const box = parseFloat(span.style.width);
    if (!box || !letterSize) return;
    const a = advance(family, span.textContent, letterSize);
    span.style.transform = a > box ? "scaleX(" + (box / a).toFixed(3) + ")" : "";
  }

  function lockWidths() {
    const live = letters.filter((s) => !s.classList.contains("is-space"));
    if (!live.length) return;

    const cs = getComputedStyle(live[0]);
    letterSize = parseFloat(cs.fontSize) || 16;

    live.forEach((s) => {
      s.style.transform = "";
      s.style.width = "";
      s.style.fontFamily = "'" + (s.dataset.final || "") + "'";
    });
    /* une seule lecture de geometrie pour tout le titre */
    const widths = live.map((s) => s.getBoundingClientRect().width);
    live.forEach((s, i) => {
      if (widths[i]) s.style.width = widths[i].toFixed(2) + "px";
    });

    /* La hauteur de ligne suit aussi la fonte : on fige le bloc du
       titre a la hauteur qu'il a une fois pose. */
    const host = live[0].parentNode;
    if (host) {
      host.style.height = "";
      host.style.height = host.getBoundingClientRect().height.toFixed(2) + "px";
    }
  }

  /* Defilement : les lettres changent, puis se figent une par une
     de gauche a droite. Le rythme part TRES vite puis ralentit en
     pente douce (courbe en cube), et l'ensemble reste court. */
  function spin() {
    const live = letters.filter((s) => !s.classList.contains("is-space"));
    if (!live.length) return;
    spinning += 1;
    const run = spinning;

    let settled = 0;
    const tick = () => {
      if (run !== spinning) return;              /* une autre ouverture a pris la main */
      for (let i = settled; i < live.length; i += 1) wear(live[i], pickFamily());
      if (settled < live.length) {
        /* la lettre qui se fige reprend SA fonte definitive */
        wear(live[settled], live[settled].dataset.final || pickFamily());
        settled += 1;
        const t = settled / live.length;
        const delay = 10 + 95 * t * t * t;       /* ~600 ms au total */
        setTimeout(tick, delay);
      }
    };

    /* on ne mesure — donc on ne demarre — qu'une fois les fontes
       reellement disponibles */
    loadFaces().then(() => {
      if (run !== spinning) return;
      lockWidths();
      tick();
    });
  }

  function build() {
    const { data } = content();

    el = document.createElement("div");
    el.className = "about";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", t("about.label"));

    const inner = document.createElement("div");
    inner.className = "about__inner";
    el.appendChild(inner);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "about__close";
    close.setAttribute("aria-label", t("about.close"));
    close.textContent = "X";
    close.addEventListener("click", (e) => { e.stopPropagation(); hide(); });
    inner.appendChild(close);

    const h = document.createElement("h2");
    h.className = "about__title";
    buildTitle(h, TITLE);
    inner.appendChild(h);

    const bodyEl = document.createElement("div");
    bodyEl.className = "about__body";
    if (data && data.paragraphs) {
      data.paragraphs.forEach((t) => {
        const p = document.createElement("p");
        p.textContent = t;
        bodyEl.appendChild(p);
      });
    } else {
      const p = document.createElement("p");
      p.textContent = t("about.todo");
      bodyEl.appendChild(p);
    }
    inner.appendChild(bodyEl);

    if (data && data.contacts && data.contacts.length) {
      const c = document.createElement("div");
      c.className = "about__contacts";
      data.contacts.forEach((line) => {
        const d = document.createElement("div");
        d.textContent = line;
        c.appendChild(d);
      });
      inner.appendChild(c);
    }

    document.body.appendChild(el);
    return el;
  }

  function isOpen() { return el && el.classList.contains("is-open"); }

  function show() {
    if (!el) build();
    el.classList.add("is-open");
    const face = document.querySelector(".bs-face");
    if (face) face.classList.add("is-about");
    spin();
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDoc, true);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("mouseenter", () => {
      if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = 0; }
    });
  }

  function hide() {
    if (!el) return;
    el.classList.remove("is-open");
    const face = document.querySelector(".bs-face");
    if (face) face.classList.remove("is-about");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("mousedown", onDoc, true);
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = 0; }
  }

  /* la souris quitte la bulle : elle se ferme. Un court delai laisse
     le temps de repasser dessus, ou d'aller vers la tete. */
  let leaveTimer = 0;
  function onLeave() {
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      leaveTimer = 0;
      if (el && el.matches(":hover")) return;
      const face = document.querySelector(".bs-face");
      if (face && face.matches(":hover")) return;
      hide();
    }, 260);
  }

  function toggle() { if (isOpen()) hide(); else show(); }

  function onKey(e) { if (e.key === "Escape") hide(); }
  function onDoc(e) {
    if (!isOpen()) return;
    const face = document.querySelector(".bs-face");
    if (el.contains(e.target)) return;
    if (face && face.contains(e.target)) return;
    hide();
  }

  /* La vignette est creee par face-video.js, peut-etre apres nous. */
  function wire() {
    const face = document.querySelector(".bs-face");
    if (!face || face._bsAbout) return !!face;
    face._bsAbout = true;
    face.classList.add("is-clickable");
    face.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    return true;
  }

  if (!wire()) {
    const obs = new MutationObserver(() => { if (wire()) obs.disconnect(); });
    obs.observe(document.body, { childList: true });
    setTimeout(() => obs.disconnect(), 10000);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (letters.length) lockWidths(); });
  }

  window.BSAbout = { show, hide, toggle, spin };
})();
