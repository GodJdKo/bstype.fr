/* ============================================================
   BOOT.JS — L'ECRAN DE CHARGEMENT
   ------------------------------------------------------------
   Ce fichier est charge dans le <head>, AVANT tout le reste : il
   doit pouvoir poser son fond noir avant que la page se dessine.

   DEUX ECRANS, UN PAR TYPE DE PAGE :

   - PAGE D'ACCUEIL : le logo entier — la derniere image de
     assets/logoMedia/BSGLITCH.mp4, FIGEE — sur fond noir. Quand la
     page est prete, le film repart EN ARRIERE et le noir s'efface
     au meme rythme (c'est glitch-logo.js qui joue ca).

   - PAGE D'UNE FONTE : la vignette assets/2face.mp4, en boucle,
     qui pivote lentement sur le fond noir, son fond vert detoure.
     Quand la page est prete, l'ecran s'efface, sans plus.

   Dans les deux cas l'ecran reste tant que la page n'est pas
   VRAIMENT prete : fichiers charges, fontes installees, grille des
   modules composee. Pendant ce temps le defilement et les clics
   sont bloques, et l'effet de dereglement ne demarre pas.

   REGLAGES, en haut du fichier :
     MINIMUM   temps d'affichage minimum de l'ecran noir (ms)
     MAXIMUM   au-dela, on ouvre meme si quelque chose traine (ms)
     TOUR      duree d'un tour de la vignette (ms)
     TAILLE    cote de la vignette, en pixels

   window.BS_NO_BOOT = true avant ce script le desactive.
   ============================================================ */

(function () {
  if (window.BS_NO_BOOT) return;

  const MINIMUM = 900;
  const MAXIMUM = 9000;
  const TOUR = 5200;
  const TAILLE = 190;

  const doux = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* base du site, deduite de l'URL de CE script */
  const moi = document.currentScript && document.currentScript.src;
  const BASE = moi ? moi.replace(/assets\/js\/boot\.js.*$/, "") : "";

  /* --- quel ecran ? ---
     On compare l'adresse de la page a la RACINE DU SITE, deduite de
     l'URL de ce script. Un simple test sur le chemin ne suffit pas :
     « /fonts/baton/ » finit par une barre, comme la racine, et
     passait pour l'accueil. */
  let accueil = false;
  try {
    const racineSite = new URL(BASE || "./", location.href).href;
    const ici = new URL(location.pathname, location.href).href;
    accueil = ici === racineSite || ici === racineSite + "index.html";
  } catch (_e) {
    accueil = /(^\/?|\/)(index\.html)?$/.test(location.pathname) &&
      location.pathname.split("/").filter(Boolean).length <= 1;
  }

  /* ---------------- le fond noir ----------------
     Pose sur <html> et pas sur <body> : au moment ou ce script
     tourne, <body> n'existe pas encore. */
  const ecran = document.createElement("div");
  ecran.className = "bs-boot";
  ecran.setAttribute("aria-hidden", "true");
  ecran.setAttribute("data-no-snapshot", "");
  (document.body || document.documentElement).appendChild(ecran);

  /* ---------------- defilement et clics bloques ----------------
     Tant que le chargement dure, la page ne repond pas : on
     l'observe, on ne s'en sert pas encore. */
  const racine = document.documentElement;
  racine.classList.add("bs-charge");

  const avaler = (e) => { e.preventDefault(); e.stopPropagation(); };
  const bloques = ["wheel", "touchmove", "click", "mousedown", "keydown"];
  bloques.forEach((n) => window.addEventListener(n, avaler, { capture: true, passive: false }));
  function deverrouiller() {
    bloques.forEach((n) => window.removeEventListener(n, avaler, { capture: true }));
    racine.classList.remove("bs-charge");
  }

  /* ============================================================
     LA VIGNETTE QUI TOURNE — pages de fonte seulement
     ------------------------------------------------------------
     Meme principe de detourage que la vignette du bas de page
     (assets/js/face-video.js) : la couleur du fond est relevee dans
     les coins de la premiere image, et tout ce qui s'en approche
     passe en transparent. Fait en direct, sur une petite image :
     ca ne coute rien, et l'ecran ne vit que quelques secondes.
     ============================================================ */
  let video = null;
  let bat = 0;

  function monterVignette() {
    const toile = document.createElement("canvas");
    toile.className = "bs-boot__c";
    toile.width = TAILLE;
    toile.height = TAILLE;
    if (!doux) toile.style.animation = "bs-boot-tour " + TOUR + "ms linear infinite";
    ecran.appendChild(toile);
    const ctx = toile.getContext("2d", { willReadFrequently: true });

    video = document.createElement("video");
    video.src = BASE + (window.BS_FACE_DEFAULT || "assets/2face.mp4");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "auto";
    video.className = "bs-boot__src";
    ecran.appendChild(video);

    const PRES = 60 * 60;       /* distances AU CARRE : pas de racine */
    const LOIN = 130 * 130;
    let fond = null;

    function relever(d) {
      const coin = (x, y) => {
        const i = (y * TAILLE + x) * 4;
        return [d[i], d[i + 1], d[i + 2]];
      };
      const coins = [coin(1, 1), coin(TAILLE - 2, 1), coin(1, TAILLE - 2), coin(TAILLE - 2, TAILLE - 2)];
      let meilleur = null;
      let score = -Infinity;
      coins.forEach((c) => {
        const s = c[1] - Math.max(c[0], c[2]);
        if (s > score) { score = s; meilleur = c; }
      });
      /* Aucun coin vert : l'image n'est pas encore decodee — c'est
         courant sur telephone, la premiere arrive noire. On ne
         retient RIEN et on redemande a la suivante, sinon on fige un
         faux vert et le fond reste visible derriere la tete. */
      return score > 20 ? meilleur : null;
    }
    const ESSAIS_FOND = 40;
    let essaisFond = 0;

    function composer() {
      if (video.readyState < 2 || !video.videoWidth) return;
      ctx.clearRect(0, 0, TAILLE, TAILLE);
      /* recadrage « couvrir », sans deformation */
      const k = Math.max(TAILLE / video.videoWidth, TAILLE / video.videoHeight);
      const l = video.videoWidth * k;
      const h = video.videoHeight * k;
      ctx.drawImage(video, (TAILLE - l) / 2, (TAILLE - h) / 2, l, h);
      let img;
      try { img = ctx.getImageData(0, 0, TAILLE, TAILLE); } catch (_e) { return; }
      const d = img.data;
      if (!fond) {
        fond = relever(d);
        essaisFond += 1;
        if (!fond && essaisFond >= ESSAIS_FOND) fond = [0, 177, 64];
        if (!fond) return;          /* on retente a l'image suivante */
      }
      const kr = fond[0], kg = fond[1], kb = fond[2];
      for (let i = 0; i < d.length; i += 4) {
        const dr = d[i] - kr, dg = d[i + 1] - kg, db = d[i + 2] - kb;
        const d2 = dr * dr + dg * dg + db * db;
        if (d2 <= PRES) { d[i + 3] = 0; continue; }
        if (d2 < LOIN) d[i + 3] = ((Math.sqrt(d2) - 60) / 70) * 255;
      }
      ctx.putImageData(img, 0, 0);
      ecran.classList.add("is-ready");
    }

    video.addEventListener("loadeddata", () => { video.play().catch(() => {}); composer(); });
    function battre() {
      composer();
      bat = setTimeout(battre, 1000 / 15);    /* quinze images par seconde suffisent */
    }
    battre();
  }

  if (!accueil) monterVignette();

  /* ---------------- quand la page est-elle prete ? ---------------- */
  function attendre(poser) {
    return new Promise((ok) => {
      let fini = false;
      poser(() => { if (!fini) { fini = true; ok(); } });
    });
  }

  const fichiers = attendre((ok) => {
    if (document.readyState === "complete") ok();
    else window.addEventListener("load", ok, { once: true });
  });

  const polices = attendre((ok) => {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ok);
    else ok();
    setTimeout(ok, 6000);
  });

  /* La grille d'une page de fonte se compose apres coup : tant
     qu'elle porte la classe is-waiting, la page n'est pas montrable. */
  const grille = attendre((ok) => {
    const voir = () => {
      const g = document.querySelector(".specimen-grid");
      if (!g) return document.readyState === "complete";   /* page sans grille */
      return !g.classList.contains("is-waiting") && g.children.length > 0;
    };
    if (voir()) { ok(); return; }
    const t = setInterval(() => { if (voir()) { clearInterval(t); ok(); } }, 120);
    setTimeout(() => { clearInterval(t); ok(); }, 7000);
  });

  /* Sur l'accueil seulement : le film doit etre decode pour pouvoir
     montrer sa derniere image. */
  const film = accueil ? attendre((ok) => {
    const voir = () => {
      if (!window.BSLogoGlitch || !window.BSLogoGlitch.pret) return false;
      window.BSLogoGlitch.figer();        /* le logo entier, fige */
      return true;
    };
    if (voir()) { ok(); return; }
    const t = setInterval(() => { if (voir()) { clearInterval(t); ok(); } }, 120);
    setTimeout(() => { clearInterval(t); ok(); }, 7000);
  }) : Promise.resolve();

  const minimum = new Promise((ok) => setTimeout(ok, MINIMUM));
  const maximum = new Promise((ok) => setTimeout(ok, MAXIMUM));

  let ouvert = false;
  function ouvrir() {
    if (ouvert) return;
    ouvert = true;

    /* Sur l'accueil, le logo pose son PROPRE voile noir avant que le
       notre parte : les deux se recouvrent, donc aucun eclair de
       page nue. */
    const passe = accueil && window.BSLogoGlitch && window.BSLogoGlitch.ouvrir
      ? window.BSLogoGlitch.ouvrir() : false;

    if (bat) { clearTimeout(bat); bat = 0; }
    if (video) video.pause();
    ecran.classList.add("is-done");
    setTimeout(() => { ecran.remove(); if (video) video.remove(); }, passe ? 260 : 500);
    deverrouiller();

    /* le compte a rebours du dereglement ne part que maintenant */
    if (window.BSGlitch && window.BSGlitch.wake) window.BSGlitch.wake();

    /* Filet de securite : si le film n'arrivait jamais au bout
       (onglet mis en arriere-plan pile a ce moment-la, carte
       graphique qui rend la main...), on retire le voile de force.
       Personne ne doit rester devant un ecran noir. */
    if (passe) {
      setTimeout(() => {
        if (window.BSLogoGlitch && window.BSLogoGlitch.montre) window.BSLogoGlitch.montre();
      }, 8000);
    }
  }

  Promise.race([
    Promise.all([fichiers, polices, grille, film, minimum]),
    maximum
  ]).then(ouvrir);

  window.BSBoot = {
    ecran: ecran,
    ouvrir: ouvrir,
    get accueil() { return accueil; },
    get pret() { return ouvert; }
  };
})();
