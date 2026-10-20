/* ============================================================
   GLITCH-LOGO.JS — LE LOGO QUI SE CONSTRUIT PENDANT LE GLITCH
   ------------------------------------------------------------
   Quand la page part en bouillie (assets/js/idle-glitch.js), le
   logo est dessiné PAR-DESSUS, sur sa propre toile. Il n'est donc
   PAS abimé par l'effet : le dérèglement continue derrière lui, le
   logo reste net.

   Le film :
     - il part d'un écran vide et fait apparaître le logo point par
       point ; il sert donc aussi de fondu d'entrée ;
     - arrivé à la dernière image, il se FIGE tant qu'on ne fait
       rien ;
     - au premier geste, il repart EN ARRIÈRE et s'efface une fois
       revenu au début.

   PLUS DE VIDÉO
   -------------
   Le logo est fait de carrés. Ils étaient joués depuis un film
   (BSGLITCH.mp4, 3 Mo, décodé puis détouré image par image par la
   carte graphique). Ils sont maintenant lus depuis une simple
   LISTE : pour chaque image du film, la position et la taille de
   chaque carré. Le navigateur les dessine en canvas 2D.

     - 208 Ko à télécharger au lieu de 2,9 Mo ;
     - rien à décoder : pas de <video>, pas de WebGL, pas de souci
       de lecture sur téléphone, pas de retour en arrière qui se
       coince : aller à une image, c'est lire une case d'un tableau ;
     - carrés NETS, à n'importe quelle taille d'écran : chaque bord
       est arrondi au pixel de l'écran, il n'y a ni flou ni bavure
       de compression ;
     - mêmes images, même rythme, mêmes sauts que le film.

   Le fichier est fabriqué par scripts/build-glitch-squares.js à
   partir de l'original (_originaux/assets/logoMedia/BSGLITCH.mp4).
   Le pochoir (clair ET vert) y est appliqué une fois pour toutes :
   ce qui n'est pas vert n'est pas dans le fichier.

   Le film est carré et l'écran ne l'est pas : il est agrandi
   jusqu'à couvrir le plus grand côté, et les bords qui dépassent
   sont coupés. Jamais de déformation.

   A L'OUVERTURE DU SITE, le même film est joué À L'ENVERS depuis sa
   dernière image, sur un fond noir plein qui s'efface au même
   rythme : le logo se défait, le noir se lève, la page apparaît.
   C'est assets/js/boot.js qui déclenche ça, une fois la page prête.

   REGLAGES (tout est en haut du fichier) :
     CADENCE       images dessinées par seconde (30, comme le film)
     RETOUR        vitesse du rembobinage (4 = quatre fois plus vite)
     DEPART_RETOUR timecode où le retour commence au plus tard (0.75 = aux trois quarts)
     COULEUR       aplat dont les carrés sont remplis
     INTRO         vitesse de l'ouverture du site
     PIXELS_MAX    taille maximum de la toile, en pixels
     ECHELLE_PORTRAIT  taille du motif sur téléphone (0.8 = 20 % de moins)

   COMPATIBILITÉ : le fichier est du gzip. Les navigateurs récents le
   décompressent seuls ; les anciens (Safari < 16.4...) passent par un
   décompresseur de secours inclus plus bas. Il suffit de fetch, canvas
   2D et requestAnimationFrame. Sur une machine lente, la définition de
   la toile baisse toute seule (voir BUDGET_MS).

   window.BS_NO_GLITCH = true avant ce script le désactive.
   Console : BSLogoGlitch.jouer(), .rembobiner(), .montre(t), .etat
   ============================================================ */

(function () {
  if (window.BS_NO_GLITCH) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ---------------- reglages ---------------- */
  const FICHIER = "assets/logoMedia/BSGLITCH.squares.bin";
  /* Images dessinées par seconde : les 30 du film, toutes. C'est la
     cadence DANS LES DEUX SENS, ouverture comprise. */
  const CADENCE = 30;
  const CADENCE_FILM = 30;      /* cadence du film d'origine */
  const TAILLE_FILM = 1280;     /* le film est carré : 1280 x 1280 */
  /* Vitesses, en multiples du temps réel. En arrière on saute des
     images du film pour aller plus vite : à 4x et 30 images par
     seconde, on recule de quatre images à chaque dessin. */
  const RETOUR = 4;             /* au réveil : rembobinage rapide */
  /* LE POINT DE DEPART DU RETOUR est un timecode fixe : les trois
     quarts du film, arrondis à l'image. Au réveil :
       - si le film n'y est pas encore arrivé (il joue en avant, en
         dessous de ce timecode), le retour part de l'endroit EXACT
         où il se trouve ;
       - s'il l'a dépassé (ou s'il est figé sur sa dernière image),
         on SAUTE à ce timecode et on repart de là.
     Le retour dure donc au plus la même chose, quel que soit le
     moment. */
  const DEPART_RETOUR = 0.75;
  const INTRO = 3;              /* à l'ouverture du site */
  /* L'aplat dont les carrés sont remplis : le vert acide de la charte. */
  const COULEUR = "#9dff00";
  /* Plafond de la toile. Un écran 5K demanderait 15 millions de
     pixels à remplir : inutile, le film n'en a que 1,6 million. */
  const PIXELS_MAX = 4200000;
  /* Filet de sécurité pour les petites machines : si dessiner une
     image coûte en moyenne plus que BUDGET_MS, on baisse la
     définition de la toile d'un quart (deux fois au plus). Les
     carrés restent nets : la toile est agrandie sans lissage. */
  const BUDGET_MS = 12;
  /* Sur téléphone (écran plus haut que large) le motif dépassait
     sur les bords : il est réduit de 20 %, toujours centré. */
  const ECHELLE_PORTRAIT = 0.8;

  const moi = document.currentScript && document.currentScript.src;
  const BASE = moi ? moi.replace(/assets\/js\/glitch-logo\.js.*$/, "") : "";

  /* ---------------- la toile ---------------- */
  const hote = document.createElement("div");
  hote.className = "bs-glitch-logo";
  hote.setAttribute("aria-hidden", "true");
  /* la photo de la page ne doit pas se photographier elle-même */
  hote.setAttribute("data-no-snapshot", "");

  /* Voile noir de l'ouverture : il part opaque et s'efface au fil du
     film, découvrant la page. Sous la toile, jamais au-dessus. */
  const voile = document.createElement("div");
  voile.className = "bs-glitch-logo__voile";
  hote.appendChild(voile);

  const toile = document.createElement("canvas");
  hote.appendChild(toile);
  const ctx = toile.getContext("2d", { alpha: true });

  /* ---------------- etat ---------------- */
  let images = null;        /* [{ n, x, y, w, h }] une entrée par image */
  let pret = false;         /* la liste est-elle chargée ? */
  let demande = false;      /* l'a-t-on demandée au réseau ? */
  let duree = 0;            /* nombre d'images / 30, en secondes */
  let temps = 0;            /* position dans le film, en secondes */
  let sens = 0;             /* +1 avance, -1 rembobine, 0 fige */
  let boucle = 0;
  let dernier = 0;
  let dernierDessin = 0;    /* pour tenir la cadence */
  let derniereImage = -1;   /* pour ne pas redessiner deux fois la même */
  let posee = false;
  let ouverture = false;    /* on joue l'ouverture du site ? */
  let qualite = 1;          /* 1 = définition pleine ; baisse si la machine rame */
  let coutTotal = 0, coutN = 0;

  /* Le film se termine un peu avant sa durée (comme avant : 0,04 s) */
  const fin = () => Math.max(0, duree - 0.04);
  /* timecode de départ du retour, exact à l'image près */
  const departRetour = () =>
    Math.floor(duree * DEPART_RETOUR * CADENCE_FILM) / CADENCE_FILM;
  const numero = () => Math.max(0, Math.min(images.length - 1, Math.floor(temps * CADENCE_FILM + 1e-6)));

  /* Dimensions prises sur LA TOILE ELLE-MEME dès qu'elle est posée.
     Sur téléphone, la hauteur de la fenêtre ne vaut pas la hauteur
     de ce qu'on voit (barre d'adresse). */
  function boite() {
    if (posee) {
      const r = hote.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) return r;
    }
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight
    };
  }

  /* ---------------- la toile a la bonne taille ---------------- */
  function tailler() {
    const b = boite();
    const L = Math.max(1, b.width), H = Math.max(1, b.height);
    /* On dessine à la définition de l'écran (Retina compris), sans
       dépasser PIXELS_MAX. */
    let d = Math.min(window.devicePixelRatio || 1, 2) * qualite;
    const k = Math.sqrt(PIXELS_MAX / Math.max(1, L * H * d * d));
    if (k < 1) d *= k;
    const l = Math.max(1, Math.round(L * d));
    const h = Math.max(1, Math.round(H * d));
    if (toile.width !== l || toile.height !== h) {
      toile.width = l;
      toile.height = h;
      derniereImage = -1;
    }
  }

  /* ============================================================
     LE DESSIN
     ------------------------------------------------------------
     Recadrage « couvrir » : le film est carré, on garde ses
     proportions et on coupe ce qui dépasse. Chaque carré est posé
     par son COIN arrondi au pixel de l'écran et son CÔTÉ arrondi
     lui aussi : net, sans lissage, jamais plus petit qu'un pixel, et
     toujours carré.
     ============================================================ */
  function dessiner(force) {
    if (!pret) return;
    const i = numero();
    if (!force && i === derniereImage) return;
    const debut = performance.now();
    tailler();
    const L = toile.width, H = toile.height;
    const e = Math.max(L, H) / TAILLE_FILM * (H > L ? ECHELLE_PORTRAIT : 1);
    const dx = (L - TAILLE_FILM * e) / 2;
    const dy = (H - TAILLE_FILM * e) / 2;
    const f = images[i];
    ctx.clearRect(0, 0, L, H);
    ctx.fillStyle = COULEUR;
    ctx.beginPath();
    for (let k = 0; k < f.n; k++) {
      const x0 = Math.round(dx + f.x[k] * e);
      const y0 = Math.round(dy + f.y[k] * e);
      /* UN CARRÉ : un seul côté, donc largeur = hauteur, toujours.
         (Arrondir les quatre bords séparément donnerait par moments
         un rectangle d'un pixel de plus d'un côté.) */
      const cote = Math.max(1, Math.round(f.c[k] * e));
      ctx.rect(x0, y0, cote, cote);
    }
    ctx.fill();
    derniereImage = i;
    coutTotal += performance.now() - debut;
    if (++coutN === 30) {
      if (coutTotal / coutN > BUDGET_MS && qualite > 0.5) { qualite *= 0.75; derniereImage = -1; }
      coutTotal = 0; coutN = 0;
    }
  }

  function poser() {
    if (posee) return;
    document.body.appendChild(hote);
    posee = true;
  }

  /* opacité du voile noir : plein au début du film... à l'envers,
     donc à la FIN, et rien une fois revenu au début */
  function poserVoile(v) {
    voile.style.opacity = ouverture ? Math.max(0, Math.min(1, v)).toFixed(3) : "0";
  }

  function retirer() {
    if (boucle) { cancelAnimationFrame(boucle); boucle = 0; }
    sens = 0;
    ouverture = false;
    hote.style.opacity = "";
    hote.classList.remove("is-ouverture");
    poserVoile(0);
    temps = 0;
    derniereImage = -1;
    if (!posee) return;
    hote.remove();
    posee = false;
  }

  /* ---------------- le deroulement ---------------- */
  function avancer(maintenant) {
    boucle = 0;
    if (!pret) { sens = 0; return; }

    /* CADENCE : on ne dessine pas à chaque battement de l'écran,
       mais vingt fois par seconde. Le reste du temps on repasse la
       main tout de suite. */
    const attendu = 1000 / CADENCE;
    if (maintenant - dernierDessin < attendu - 1) {
      boucle = requestAnimationFrame(avancer);
      return;
    }
    const dt = Math.min(200, maintenant - dernier) / 1000;
    dernier = maintenant;
    dernierDessin = maintenant;

    if (sens > 0) {
      temps = Math.min(fin(), temps + dt);
      dessiner();
      /* Arrivé au bout : on se fige tant qu'on ne fait rien. La
         dernière image reste dessinée sur la toile. */
      if (temps >= fin()) { sens = 0; return; }
    } else if (sens < 0) {
      const vitesse = ouverture ? INTRO : RETOUR;
      /* En arrière on SAUTE des images du film : à chaque dessin on
         recule de plusieurs images d'un coup (voulu). */
      const saut = Math.max(1, Math.round((CADENCE_FILM / CADENCE) * vitesse));
      temps -= Math.max(dt * vitesse, saut / CADENCE_FILM);
      if (temps <= 0) { retirer(); return; }
      poserVoile(temps / Math.max(0.01, duree));
      dessiner();
    } else {
      return;
    }
    boucle = requestAnimationFrame(avancer);
  }

  function relancer() {
    if (!sens) return;
    if (boucle) cancelAnimationFrame(boucle);
    dernier = performance.now();
    dernierDessin = 0;
    boucle = requestAnimationFrame(avancer);
  }

  function jouer() {
    if (!pret) return false;
    hote.style.opacity = "";
    /* Si le film était resté sur sa dernière image — après
       l'ouverture du site, ou après un arrêt forcé — on repart du
       début, sinon il se figerait aussitôt. */
    if (temps >= fin() - 0.05) temps = 0;
    poser();
    sens = 1;
    dessiner(true);
    relancer();
    return true;
  }

  function rembobiner() {
    if (!posee) return false;
    if (temps <= 0) { retirer(); return false; }
    /* Avant le timecode de départ : on recule depuis l'endroit exact
       où le film se trouve. Au-delà : on saute à ce timecode. */
    temps = Math.min(temps, departRetour());
    sens = -1;
    dessiner(true);
    relancer();
    return true;
  }

  /* ---------------- l'ecran de chargement ----------------
     La DERNIERE image du film — le logo entier — posée sur un fond
     noir plein, et rien qui bouge. C'est ce qu'on voit tant que la
     page n'est pas prête. Ensuite ouvrir() prend la suite. */
  function figer() {
    if (!pret) return false;
    ouverture = true;
    hote.classList.add("is-ouverture");
    poser();
    poserVoile(1);
    sens = 0;
    if (boucle) { cancelAnimationFrame(boucle); boucle = 0; }
    temps = fin();
    dessiner(true);
    return true;
  }

  /* ---------------- l'ouverture du site ----------------
     Le film est joué A L'ENVERS depuis sa dernière image, sur fond
     noir plein — et ce noir s'efface au même rythme, découvrant la
     page. Quand le film revient à son début, il ne reste rien.
     Appelée par assets/js/boot.js, une fois la page prête. */
  function ouvrir() {
    if (!pret) return false;
    ouverture = true;
    hote.classList.add("is-ouverture");
    poser();
    poserVoile(1);
    temps = fin();
    sens = -1;
    dessiner(true);
    relancer();
    return true;
  }

  /* ---------------- branchements ---------------- */
  window.addEventListener("resize", () => { if (posee) dessiner(true); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) retirer();
  });

  /* ---------------- le fichier ----------------
     Lecture de la liste (voir scripts/build-glitch-squares.js pour
     le format), puis décompression gzip par le navigateur. */
  function lire(octets) {
    const u8 = new Uint8Array(octets);
    const dv = new DataView(octets);
    const total = dv.getUint16(0, true);
    const liste = new Array(total);
    let p = 2;
    for (let f = 0; f < total; f++) {
      const n = dv.getUint16(p, true);
      p += 2;
      const oDyB = p, oDyH = p + n, oDxB = p + 2 * n, oDxH = p + 3 * n;
      const oC = p + 4 * n;
      const x = new Uint16Array(n), y = new Uint16Array(n);
      const c = new Uint8Array(n);
      let cx = 0, cy = 0;
      for (let i = 0; i < n; i++) {
        const dy = u8[oDyB + i] | (u8[oDyH + i] << 8);
        const dx = u8[oDxB + i] | (u8[oDxH + i] << 8);
        cx = dy === 0 ? cx + dx : dx;
        cy += dy;
        x[i] = cx;
        y[i] = cy;
        c[i] = u8[oC + i];
      }
      p += 5 * n;
      liste[f] = { n: n, x: x, y: y, c: c };
    }
    return liste;
  }

  /* ---------------- decompression de secours ----------------
     Les navigateurs d'avant 2023 (Safari < 16.4, vieux Android) ne
     savent pas décompresser du gzip eux-mêmes (DecompressionStream).
     Pour eux, ce petit décompresseur (algorithme DEFLATE, une soixantaine
     de lignes) : plus lent, quelques centaines de millisecondes, mais
     le logo marche partout. Les autres ne l'utilisent jamais. */
  const LB = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LE = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DB = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DE = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const ORDRE = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

  function gunzip(buf) {
    let p = 10;
    const fl = buf[3];
    if (fl & 4) p += 2 + (buf[p] | (buf[p + 1] << 8));
    if (fl & 8) while (buf[p++]);
    if (fl & 16) while (buf[p++]);
    if (fl & 2) p += 2;
    const m = buf.length;
    const taille = ((buf[m - 4] | (buf[m - 3] << 8) | (buf[m - 2] << 16) | (buf[m - 1] << 24)) >>> 0);
    const out = new Uint8Array(taille);
    let o = 0, tampon = 0, nb = 0;

    function bits(n) {
      while (nb < n) { tampon |= buf[p++] << nb; nb += 8; }
      const v = tampon & ((1 << n) - 1);
      tampon >>>= n; nb -= n;
      return v;
    }
    function table(longueurs, n) {
      const nombre = new Uint16Array(16), symbole = new Uint16Array(n), dec = new Uint16Array(16);
      for (let i = 0; i < n; i++) nombre[longueurs[i]]++;
      for (let l = 1; l < 15; l++) dec[l + 1] = dec[l] + nombre[l];
      for (let i = 0; i < n; i++) if (longueurs[i]) symbole[dec[longueurs[i]]++] = i;
      return { nombre: nombre, symbole: symbole };
    }
    function lire1(t) {
      let code = 0, premier = 0, index = 0;
      for (let l = 1; l <= 15; l++) {
        code |= bits(1);
        const c = t.nombre[l];
        if (code - c < premier) return t.symbole[index + (code - premier)];
        index += c; premier += c; premier <<= 1; code <<= 1;
      }
      throw new Error("deflate");
    }
    function codes(lit, dist) {
      for (;;) {
        let sym = lire1(lit);
        if (sym < 256) { out[o++] = sym; continue; }
        if (sym === 256) return;
        sym -= 257;
        const len = LB[sym] + bits(LE[sym]);
        const ds = lire1(dist);
        const d = DB[ds] + bits(DE[ds]);
        for (let i = 0; i < len; i++, o++) out[o] = out[o - d];
      }
    }

    let dernier;
    do {
      dernier = bits(1);
      const type = bits(2);
      if (type === 0) {
        tampon = 0; nb = 0;
        const len = buf[p] | (buf[p + 1] << 8);
        p += 4;
        for (let i = 0; i < len; i++) out[o++] = buf[p++];
      } else if (type === 1) {
        const l = new Uint8Array(288);
        for (let i = 0; i < 144; i++) l[i] = 8;
        for (let i = 144; i < 256; i++) l[i] = 9;
        for (let i = 256; i < 280; i++) l[i] = 7;
        for (let i = 280; i < 288; i++) l[i] = 8;
        codes(table(l, 288), table(new Uint8Array(30).fill(5), 30));
      } else if (type === 2) {
        const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4;
        const lc = new Uint8Array(19);
        for (let i = 0; i < nc; i++) lc[ORDRE[i]] = bits(3);
        const tc = table(lc, 19);
        const l = new Uint8Array(nl + nd);
        let i = 0;
        while (i < nl + nd) {
          const sym = lire1(tc);
          if (sym < 16) { l[i++] = sym; continue; }
          let rep = 0, val = 0;
          if (sym === 16) { val = l[i - 1]; rep = 3 + bits(2); }
          else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          while (rep--) l[i++] = val;
        }
        codes(table(l.subarray(0, nl), nl), table(l.subarray(nl), nd));
      } else throw new Error("deflate");
    } while (!dernier);
    return out;
  }

  /* Rend la liste en octets bruts, quelle que soit la route :
     - fichier non compressé (serveur qui l'a déjà dégzippé) : tel quel ;
     - navigateur moderne : décompression native ;
     - sinon : décompresseur ci-dessus. */
  function decompresser(octets) {
    const u8 = new Uint8Array(octets);
    if (u8[0] !== 0x1f || u8[1] !== 0x8b) return Promise.resolve(octets);
    if (typeof DecompressionStream !== "undefined" && typeof Blob !== "undefined" && Blob.prototype.stream) {
      return new Response(new Blob([octets]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    }
    return Promise.resolve(gunzip(u8).buffer);
  }

  function telecharger() {
    if (demande) return;
    demande = true;
    fetch(BASE + FICHIER)
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      })
      .then(decompresser)
      .then((octets) => {
        images = lire(octets);
        duree = images.length / CADENCE_FILM;
        pret = true;
      })
      .catch(() => { /* pas de liste : pas de logo, le site marche quand même */ });
  }

  /* Quand va-t-on chercher la liste ?
     - sur l'ACCUEIL, tout de suite : c'est elle qui fait l'écran de
       chargement, et boot.js ne l'attend que deux secondes ;
     - ailleurs, APRES le chargement de la page : elle ne doit pas se
       mettre en travers du site. */
  function programmer() {
    if (window.BSBoot && window.BSBoot.accueil) { telecharger(); return; }
    if (document.readyState === "complete") setTimeout(telecharger, 400);
    else window.addEventListener("load", () => setTimeout(telecharger, 400), { once: true });
  }

  function monter() {
    window.BSLogoGlitch = {
      hote: hote,
      jouer: jouer,
      rembobiner: rembobiner,
      figer: figer,
      ouvrir: ouvrir,
      /* mise au point : BSLogoGlitch.montre(8) fige le film à la
         huitième seconde, BSLogoGlitch.montre() rend la main */
      montre(t) {
        if (t === undefined || t === null) { retirer(); return 0; }
        if (!pret) return -1;
        sens = 0;
        if (boucle) { cancelAnimationFrame(boucle); boucle = 0; }
        poser();
        temps = Math.max(0, Math.min(fin(), t));
        dessiner(true);
        return temps;
      },
      get pret() { return pret; },
      /* la liste est-elle en route ? (boot.js compte ses deux secondes
         à partir de là) */
      get demande() { return demande; },
      get etat() {
        let octets = 0;
        if (images) for (const f of images) octets += f.n * 5;
        return {
          pret: pret,
          definition: [TAILLE_FILM, TAILLE_FILM],
          duree: Math.round(duree * 100) / 100,
          seconde: Math.round(temps * 100) / 100,
          toile: [toile.width, toile.height],
          sens: sens,
          memoire_Mo: Math.round(octets / 104857.6) / 10
        };
      }
    };
  }
  monter();
  programmer();
})();
