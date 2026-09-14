/* ============================================================
   FACE-VIDEO.JS — la petite video collee en bas a droite
   ------------------------------------------------------------
   Presente sur toutes les pages. Elle DEFILE AVEC LE SCROLL
   (comme les zones media en mode "scrub") et son fond vert est
   DETOURE : les pixels verts passent en alpha 0.

   Quelle video ?
     - page d'une fonte : celle de son auteur, d'apres
       assets/js/faces-data.js (genere par scripts/sync-fonts.js
       a partir de assets/authorfaces/)
     - sinon (accueil, about) : la video par defaut, assets/2face.mp4

   Le detourage se fait au canvas : impossible de rendre un
   <video> transparent directement, on redessine donc chaque
   image en mettant a zero l'alpha des pixels proches du vert.
   La couleur exacte du fond est relevee dans les coins de la
   premiere image, ce qui s'adapte a n'importe quel vert.

   Si la page n'est pas assez haute pour defiler, la video joue
   en boucle au lieu de suivre le scroll.
   ============================================================ */

(function () {
  /* base du site, deduite de l'URL de CE script : marche aussi
     bien depuis / que depuis /fonts/<slug>/ */
  const me = document.currentScript && document.currentScript.src;
  const BASE = me ? me.replace(/assets\/js\/face-video\.js.*$/, "") : "";

  const faces = window.BS_FACES || {};
  const fallback = window.BS_FACE_DEFAULT || "assets/2face.mp4";

  function pickSource() {
    if (window.BS_FACE_VIDEO) return window.BS_FACE_VIDEO;
    const slug = window.BS_SLUG;
    if (slug && Array.isArray(window.BS_FONTS)) {
      const font = window.BS_FONTS.find((f) => f.slug === slug);
      if (font && faces[font.designer]) return faces[font.designer];
    }
    return fallback;
  }

  const src = pickSource();
  if (!src) return;

  /* ---------------- elements ---------------- */
  /* Deux niveaux : l'enveloppe gere l'ENTREE (elle monte depuis
     le hors-champ en tournant quand on commence a defiler), le
     canvas gere la rotation d'INACTIVITE. Deux transforms
     separees, sinon elles s'ecrasent. */
  const wrap = document.createElement("div");
  wrap.className = "bs-face";

  /* deux niveaux de transform, sinon elles s'ecrasent :
     .bs-face = entree, .bs-face__bob = balancement */
  const bob = document.createElement("div");
  bob.className = "bs-face__bob";
  wrap.appendChild(bob);

  const canvas = document.createElement("canvas");
  canvas.className = "bs-face__c";
  canvas.setAttribute("aria-hidden", "true");
  bob.appendChild(canvas);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  /* La zone cliquable : un disque pose sur la tete, et pas le carre
     entier de la video, qui est transparent presque partout. Ses
     proportions sont MESUREES sur les images detourees (voir
     mesurerTete), donc elles suivent n'importe quelle video. */
  const hit = document.createElement("div");
  hit.className = "bs-face__hit";
  wrap.appendChild(hit);

  /* Le <video> doit rester DANS le document : un element detache
     n'est pas decode par le navigateur, le canvas resterait vide.
     Il est donc present mais invisible (jamais display:none, qui
     couperait aussi le decodage). */
  const video = document.createElement("video");
  video.className = "bs-face-src";
  video.src = BASE + src;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = true;
  video.preload = "auto";
  video.setAttribute("aria-hidden", "true");

  /* ---------------- detourage du vert ---------------- */
  let key = null;             /* couleur du fond, relevee dans les coins */
  const NEAR = 60;            /* en deca : totalement transparent */
  const FAR = 130;            /* au dela : totalement opaque */
  /* On compare des distances AU CARRE : une racine carree par
     pixel, 200 000 pixels, 30 fois par seconde, ca se sent. */
  const NEAR2 = NEAR * NEAR;
  const FAR2 = FAR * FAR;
  const SPAN = FAR - NEAR;

  function sampleKey(data, w, h) {
    const pick = (x, y) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const corners = [pick(1, 1), pick(w - 2, 1), pick(1, h - 2), pick(w - 2, h - 2)];
    /* on garde le coin le plus vert */
    let best = null;
    let bestScore = -Infinity;
    corners.forEach((c) => {
      const score = c[1] - Math.max(c[0], c[2]);
      if (score > bestScore) { bestScore = score; best = c; }
    });
    /* Aucun coin vert : l'image n'est pas encore decodee (c'est
       courant sur telephone, ou la premiere image arrive noire). On
       ne retient RIEN — on redemandera a la suivante. Sans ça on
       figeait un faux vert et la vignette gardait son fond. */
    return bestScore > 20 ? best : null;
  }

  function keyOut(img) {
    const d = img.data;
    const kr = key[0], kg = key[1], kb = key[2];
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const dr = r - kr, dg = g - kg, db = b - kb;
      const d2 = dr * dr + dg * dg + db * db;
      if (d2 <= NEAR2) {
        d[i + 3] = 0;
        continue;
      }
      if (d2 < FAR2) {
        /* bord progressif, pour ne pas decouper au couteau */
        d[i + 3] = ((Math.sqrt(d2) - NEAR) / SPAN) * 255;
      }
      /* anti-debordement : le vert qui bave sur les contours */
      const avg = (r + b) / 2;
      if (g > avg + 12) d[i + 1] = avg + 12;
    }
  }

  /* ---------------- rendu ----------------
     Le detourage est fait UNE SEULE FOIS, au chargement : on
     parcourt la video, on detoure chaque image et on la garde en
     memoire. Ensuite, afficher une image ne coute plus qu'un
     drawImage — plus aucun calcul par pixel, plus aucun seek
     video pendant le defilement. C'est ce qui rend la vignette
     fluide sur n'importe quelle machine.

     Cout memoire : NB_IMAGES x largeur x hauteur x 4 octets.
     40 images de 200 px = environ 6 Mo. Baisse NB_IMAGES si la
     video est longue. */
  const NB_IMAGES = 40;
  const TAILLE_MAX = 200;

  /* Boite occupee par la tete, tous les instants du film confondus.
     Sert a placer le disque orange et la zone cliquable. */
  let boite = null;

  function noterBoite(img) {
    const d = img.data, w = canvas.width, h = canvas.height;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (d[(y * w + x) * 4 + 3] > 60) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return;
    if (!boite) boite = { x0: x0, y0: y0, x1: x1, y1: y1 };
    else {
      boite.x0 = Math.min(boite.x0, x0);
      boite.y0 = Math.min(boite.y0, y0);
      boite.x1 = Math.max(boite.x1, x1);
      boite.y1 = Math.max(boite.y1, y1);
    }
  }

  function poserBoite() {
    if (!boite || !canvas.width || !canvas.height) return;
    const pc = (v) => (Math.round(v * 1000) / 10) + "%";
    wrap.style.setProperty("--tete-x", pc(boite.x0 / canvas.width));
    wrap.style.setProperty("--tete-y", pc(boite.y0 / canvas.height));
    wrap.style.setProperty("--tete-l", pc((boite.x1 - boite.x0 + 1) / canvas.width));
    wrap.style.setProperty("--tete-h", pc((boite.y1 - boite.y0 + 1) / canvas.height));
  }

  /* Nombre d'images qu'on s'autorise a attendre avant de decider que
     le fond n'est pas vert. */
  const ESSAIS_FOND = 30;
  let essaisFond = 0;

  let sized = false;
  let drawnOnce = false;
  let visible = true;       /* vignette a l'ecran ? (onglet, defilement) */
  let pending = 0;          /* images encore a composer, avant la bande */
  let strip = null;         /* la bande detouree, une fois prete */
  let building = false;

  function sizeCanvas() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return false;
    const w = Math.min(TAILLE_MAX, vw);
    canvas.width = w;
    canvas.height = Math.round((vh / vw) * w);
    sized = true;
    return true;
  }

  /* Compose l'image courante de la video (detourage en direct).
     Sert pendant la construction de la bande et de repli si elle
     ne peut pas etre construite. */
  function drawLive() {
    if (!sized && !sizeCanvas()) return false;
    if (video.readyState < 2) return false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let img;
    try {
      img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (_e) {
      return false;         /* canvas salis : jamais en local */
    }
    if (!key) {
      key = sampleKey(img.data, canvas.width, canvas.height);
      essaisFond += 1;
      /* au bout de ESSAIS_FOND images sans rien de vert, on se rabat
         sur un vert de studio classique plutot que de ne rien faire */
      if (!key && essaisFond >= ESSAIS_FOND) key = [0, 177, 64];
      if (!key) return false;
    }
    keyOut(img);
    ctx.putImageData(img, 0, 0);
    wrap.classList.add("is-ready");
    drawnOnce = true;
    return true;
  }

  /* Affiche une image DEJA detouree. */
  let shown = -1;
  function show(i) {
    if (!strip || !strip.length) return false;
    const idx = ((i % strip.length) + strip.length) % strip.length;
    if (idx === shown) return true;
    shown = idx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const frame = strip[idx];
    if (frame instanceof ImageData) ctx.putImageData(frame, 0, 0);
    else ctx.drawImage(frame, 0, 0);
    wrap.classList.add("is-ready");
    drawnOnce = true;
    return true;
  }

  /* Ancienne API, gardee : draw() compose ce qu'il faut. */
  function draw() {
    if (strip) return show(shown < 0 ? 0 : shown);
    return drawLive();
  }

  /* ---- construction de la bande ---- */
  function buildStrip() {
    if (building || strip) return;
    if (!sized && !sizeCanvas()) return;
    const dur = video.duration;
    if (!dur || !isFinite(dur) || dur <= 0) return;
    building = true;
    video.pause();

    const out = [];
    let i = 0;

    function store() {
      if (!drawLive()) return next();     /* image pas prete : on passe */
      let img;
      try {
        img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (_e) {
        building = false;
        return;
      }
      noterBoite(img);
      if (typeof createImageBitmap === "function") {
        createImageBitmap(img).then((bmp) => { out.push(bmp); next(); })
          .catch(() => { out.push(img); next(); });
      } else {
        out.push(img);
        next();
      }
    }

    function next() {
      i += 1;
      if (i >= NB_IMAGES) {
        strip = out.length ? out : null;
        building = false;
        shown = -1;
        poserBoite();
        updateMode();
        return;
      }
      seekTo(i);
    }

    function seekTo(n) {
      const t = (n / NB_IMAGES) * Math.max(0, dur - 0.02);
      const onSeek = () => {
        video.removeEventListener("seeked", onSeek);
        store();
      };
      video.addEventListener("seeked", onSeek);
      try { video.currentTime = t; } catch (_e) { building = false; }
    }

    seekTo(0);
  }

  /* ---------------- position dans la bande ---------------- */
  function scrollRange() {
    return Math.max(
      0,
      (document.documentElement.scrollHeight || 0) - (window.innerHeight || 0)
    );
  }

  /* Une lecture complete par LOOP_PX pixels de defilement, et on
     recommence. La vitesse ne depend donc PAS de la longueur de la
     page : elle est la meme partout. */
  const LOOP_PX = 900;

  /* ---------------- inertie ----------------
     La vignette ne colle pas au defilement : elle le SUIT, avec du
     retard et un peu d'elan. Quand on s'arrete net, elle continue
     un instant puis revient se poser — elle a un poids.
     RAIDEUR = de combien elle est tiree vers la position reelle.
     AMORTI  = freinage ; plus bas, elle s'arrete plus tot.
     Mettre RAIDEUR a 1 et AMORTI a 0 la recolle au defilement. */
  const RAIDEUR = 0.13;
  const AMORTI = 0.78;

  let posSuivie = null;       /* position que la vignette croit occuper */
  let elan = 0;
  let boucleInertie = 0;

  function frameForScroll() {
    const y = posSuivie == null ? window.scrollY : posSuivie;
    const p = (((y % LOOP_PX) + LOOP_PX) % LOOP_PX) / LOOP_PX;
    return Math.floor(p * NB_IMAGES);
  }

  function inertie() {
    boucleInertie = 0;
    const cible = window.scrollY;
    if (posSuivie == null) posSuivie = cible;
    elan += (cible - posSuivie) * RAIDEUR;
    elan *= AMORTI;
    posSuivie += elan;
    if (strip) show(frameForScroll());
    if (Math.abs(cible - posSuivie) > 0.4 || Math.abs(elan) > 0.4) {
      boucleInertie = requestAnimationFrame(inertie);
    } else {
      posSuivie = cible;
      elan = 0;
      if (strip) show(frameForScroll());
    }
  }

  function lancerInertie() {
    if (document.hidden || !visible) { posSuivie = window.scrollY; elan = 0; return; }
    if (!boucleInertie) boucleInertie = requestAnimationFrame(inertie);
  }

  /* Page trop courte pour defiler : la vignette tourne toute seule. */
  let looping = false;
  let loopTimer = 0;
  const LOOP_MS = 1000 / 16;      /* 16 images par seconde, c'est assez */

  function startLoop() {
    if (loopTimer) return;
    let n = 0;
    loopTimer = setInterval(() => {
      if (document.hidden || !visible) return;
      n += 1;
      if (strip) show(n);
      else drawLive();
    }, LOOP_MS);
  }

  function stopLoop() {
    if (!loopTimer) return;
    clearInterval(loopTimer);
    loopTimer = 0;
  }

  /* Cale la vignette sur la position courante, sans elan : sert au
     montage et au retour sur l'onglet. */
  function syncToScroll() {
    if (scrollRange() < 40) return false;
    posSuivie = window.scrollY;
    elan = 0;
    if (strip) { show(frameForScroll()); return true; }
    /* bande pas encore prete : on se contente de l'image courante */
    return true;
  }

  function updateMode() {
    const canScrub = scrollRange() >= 40;
    if (canScrub) {
      if (looping) { looping = false; stopLoop(); }
      video.pause();
      syncToScroll();
    } else if (!looping) {
      looping = true;
      if (strip) startLoop();
      else video.play().catch(() => {});
    }
    pending = 3;
  }

  /* Une seule boucle d'animation, et seulement tant que la bande
     n'est pas prete. Une fois la bande en memoire, on ne redessine
     que sur defilement. */
  let raf = 0;
  let lastScroll = -1;

  function tick() {
    if (strip) { raf = 0; return; }        /* plus rien a surveiller */
    raf = requestAnimationFrame(tick);
    if (window.scrollY !== lastScroll) {
      lastScroll = window.scrollY;
      updateEntrance();
    }
    if (!drawnOnce) drawLive();
    else if (pending > 0 && drawLive()) pending -= 1;
  }

  function onScroll() {
    updateEntrance();
    if (strip) { lancerInertie(); return; }
    pending = 2;
    drawLive();
  }

  /* ---------------- entree depuis le hors-champ ----------------
     En haut de page la vignette est cachee sous le bord bas et
     pivotee ; elle remonte et se redresse sur les premiers pixels
     de defilement. */
  const ENTER_OVER = 340;   /* distance de defilement de l'entree */
  /* L'entree ne joue que sur l'accueil. Sur la page d'une fonte la
     tete est en place des le chargement. */
  const ENTRANCE = !window.BS_SLUG;

  function updateEntrance() {
    if (!ENTRANCE) { wrap.style.setProperty("--enter", "1"); return; }
    const p = Math.max(0, Math.min(1, window.scrollY / ENTER_OVER));
    const eased = p * p * (3 - 2 * p);           /* adouci aux deux bouts */
    wrap.style.setProperty("--enter", eased.toFixed(4));
  }

  /* La vignette ne tourne plus quand on ne fait rien : la rotation
     d'inactivite a ete retiree. Il reste le balancement, pose par
     la feuille de style (.bs-face__bob). */

  /* Amorce : une lecture tres courte force le decodage de la
     premiere image, puis on construit la bande detouree. */
  let primed = false;
  function prime() {
    if (primed) return;
    primed = true;
    const p = video.play();
    const after = () => {
      video.pause();
      /* On attend d'avoir VRAIMENT releve la couleur du fond avant de
         fabriquer la bande : si on part sur une image noire, toutes
         les images gardees en memoire le seront sans detourage. */
      let essais = 0;
      const tenter = () => {
        drawLive();
        essais += 1;
        if (key || essais >= ESSAIS_FOND) { buildStrip(); return; }
        setTimeout(tenter, 70);
      };
      tenter();
    };
    if (p && p.then) p.then(after).catch(() => {
      try { video.currentTime = 0.01; } catch (_e) {}
      setTimeout(after, 120);
    });
    else setTimeout(after, 120);
  }

  /* On compose AUSSI directement sur ces evenements : quand l'onglet
     est en arriere-plan, requestAnimationFrame ne tourne pas, et la
     vignette resterait vide. */
  video.addEventListener("loadedmetadata", () => { sizeCanvas(); updateMode(); prime(); });
  video.addEventListener("canplay", () => { prime(); if (!strip) drawLive(); });
  video.addEventListener("loadeddata", () => { pending = 3; if (!strip) drawLive(); });

  /* La vignette est fixe en bas a droite, donc toujours visible —
     sauf onglet cache. On surveille quand meme, au cas ou une page
     la masquerait. */
  if (window.IntersectionObserver) {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { visible = e.isIntersecting; });
    }, { threshold: 0 });
    io.observe(wrap);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    shown = -1;
    if (strip) syncToScroll();
    else { pending = 2; drawLive(); }
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateMode);

  function mount() {
    document.body.appendChild(video);
    document.body.appendChild(wrap);
    raf = requestAnimationFrame(tick);
    updateMode();
    updateEntrance();
    /* poignee de mise au point : window.BSFace.draw(), .video, .key */
    window.BSFace = {
      wrap: wrap,
      canvas: canvas,
      video: video,
      get tete() { return boite; },
      /* mise au point de l'inertie : position suivie et elan */
      get suivi() {
        return {
          defilement: Math.round(window.scrollY),
          suivie: posSuivie == null ? null : Math.round(posSuivie * 10) / 10,
          elan: Math.round(elan * 100) / 100,
          image: frameForScroll()
        };
      },
      draw: draw,
      sync: syncToScroll,
      get key() { return key; },
      get drawn() { return drawnOnce; }
    };
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
