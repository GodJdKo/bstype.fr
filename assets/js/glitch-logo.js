/* ============================================================
   GLITCH-LOGO.JS — LE LOGO QUI SE CONSTRUIT PENDANT LE GLITCH
   ------------------------------------------------------------
   Quand la page part en bouillie (assets/js/idle-glitch.js), la
   video assets/logoMedia/BSGLITCH.mp4 est jouee PAR-DESSUS, sur sa
   propre toile. Elle n'est donc PAS abimee par l'effet : le
   dereglement continue derriere elle, le logo reste net.

   Le film :
     - il part d'un ecran vide et fait apparaitre le logo point par
       point ; il sert donc aussi de fondu d'entree ;
     - arrive a la derniere image, il se FIGE tant qu'on ne fait
       rien ;
     - au premier geste, il repart EN ARRIERE depuis l'image ou il
       en etait, et s'efface une fois revenu au debut.

   POURQUOI PLUS RIEN N'EST GARDE EN MEMOIRE
   -----------------------------------------
   Premiere version : on detourait tout le film au chargement et on
   gardait les images en memoire, comme la vignette des tetes. Ca ne
   tient pas ici. Le film fait 1280 x 1280 et dure 12 secondes a 30
   images par seconde : 359 x 1280 x 1280 x 4 octets = 2,3 Go. Pour
   rentrer dans une memoire raisonnable il fallait le reduire a
   295 x 295 et a 8 images par seconde — d'ou le logo grossier, et
   d'ou le noir qu'on voyait encore : reduire une image MELANGE
   chaque point avec le noir autour, et ce gris-la passait au
   travers du detourage.

   Cette version ne garde RIEN. Le navigateur joue le film
   normalement, et chaque image est detouree AU VOL par la carte
   graphique (WebGL). Memoire : zero. Definition : celle du fichier.
   Rythme : celui du fichier.

   LE DETOURAGE
   ------------
   On ne garde QUE les pixels verts. Un pixel est vert si :
     - il est assez clair (LUMIERE_MIN), ce qui elimine le fond ;
     - et son vert depasse son rouge ET son bleu d'au moins
       MARGE_VERT.
   Mesure faite sur le fichier : les points du logo ont un ecart de
   vert de 5 a 40 sur 255 (98 % au-dessus de 5), et le fond est noir
   pur. Le test est FRANC, sans bord adouci : un pixel est garde ou
   il est jete, jamais entre les deux. Aucun voile gris possible.

   Le film est carre et l'ecran ne l'est pas : il est agrandi
   jusqu'a couvrir le plus grand cote, et les bords qui depassent
   sont coupes. Jamais de deformation.

   A L'OUVERTURE DU SITE, le meme film est joue A L'ENVERS depuis sa
   derniere image, sur un fond noir plein qui s'efface au meme
   rythme : le logo se defait, le noir se leve, la page apparait.
   C'est assets/js/boot.js qui declenche ca, une fois la page prete.

   REGLAGES (tout est en haut du fichier) :
     CADENCE       images dessinees par seconde (20 ; le film en a 30)
     RETOUR        vitesse du rembobinage (4 = quatre fois plus vite)
     DEPART_RETOUR ou le retour commence (0.75 = aux trois quarts)
     COULEUR       aplat qui remplit le pochoir (null = couleurs du film)
     INTRO         vitesse de l'ouverture du site
     LUMIERE_MIN   en dessous, le pixel est jete (0 a 255)
     MARGE_VERT    de combien le vert doit depasser le rouge et le
                   bleu pour que le pixel soit garde (0 a 255)
     PIXELS_MAX    taille maximum de la toile, en pixels

   window.BS_NO_GLITCH = true avant ce script le desactive.
   Console : BSLogoGlitch.jouer(), .rembobiner(), .montre(t), .etat
   ============================================================ */

(function () {
  if (window.BS_NO_GLITCH) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ---------------- reglages ---------------- */
  const FICHIER = "assets/logoMedia/BSGLITCH.mp4";
  /* Images dessinees par seconde. Le film en contient 30 : on n'en
     montre que 20, ce qui allege d'un tiers le travail de la machine
     sans que le mouvement en souffre. C'est la cadence DANS LES DEUX
     SENS, ouverture comprise. */
  const CADENCE = 20;
  const CADENCE_FILM = 30;      /* cadence du fichier */
  /* Vitesses, en multiples du temps reel. En arriere on saute des
     images du film pour aller plus vite : a 4x et 20 images par
     seconde, on recule de six images de film a chaque dessin. */
  const RETOUR = 4;             /* au reveil : rembobinage rapide */
  /* Au reveil on ne rembobine pas depuis l'endroit ou on en etait :
     on SAUTE aux trois quarts du film, et on repart de la. Le retour
     dure donc toujours la meme chose, quel que soit le moment. */
  const DEPART_RETOUR = 0.75;
  const INTRO = 3;              /* a l'ouverture du site */
  const LUMIERE_MIN = 100;      /* sur 255 */
  const MARGE_VERT = 6;         /* sur 255 */
  /* Le film ne sert plus que de POCHOIR : on garde sa forme et on la
     remplit d'un aplat, le vert acide de la charte. Ca ne coute rien
     — c'est meme une operation de moins par pixel que de recopier la
     couleur du film. Mettre COULEUR a null rend au film ses propres
     couleurs. */
  const COULEUR = "#9dff00";
  /* Plafond de la toile. Un ecran 5K demanderait 15 millions de
     pixels a remplir : inutile, le film n'en a que 1,6 million. */
  const PIXELS_MAX = 4200000;

  const moi = document.currentScript && document.currentScript.src;
  const BASE = moi ? moi.replace(/assets\/js\/glitch-logo\.js.*$/, "") : "";

  /* ---------------- la toile ---------------- */
  const hote = document.createElement("div");
  hote.className = "bs-glitch-logo";
  hote.setAttribute("aria-hidden", "true");
  /* la photo de la page ne doit pas se photographier elle-meme */
  hote.setAttribute("data-no-snapshot", "");

  /* Voile noir de l'ouverture : il part opaque et s'efface au fil du
     film, decouvrant la page. Sous la toile, jamais au-dessus. */
  const voile = document.createElement("div");
  voile.className = "bs-glitch-logo__voile";
  hote.appendChild(voile);

  const toile = document.createElement("canvas");
  hote.appendChild(toile);

  /* Le <video> doit rester DANS le document : un element detache
     n'est pas decode par le navigateur. Il est donc present mais
     invisible (jamais display:none, qui couperait le decodage). */
  const video = document.createElement("video");
  video.className = "bs-face-src";
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("aria-hidden", "true");

  /* ---------------- etat ---------------- */
  let gl = null;
  let prog = null;
  let texture = null;
  let uEchelle = null;
  let pret = false;         /* le film est-il jouable ? */
  let sens = 0;             /* +1 avance, -1 rembobine, 0 fige */
  let boucle = 0;
  let dernier = 0;
  let dernierTemps = -1;    /* pour ne pas renvoyer deux fois la meme image */
  let dernierDessin = 0;    /* pour tenir la cadence */
  let posee = false;
  let ouverture = false;    /* on joue l'ouverture du site ? */
  /* Surveillance du retour en arriere. Reculer dans un film demande
     au navigateur de redecoder : sur telephone il refuse parfois, et
     l'image se figeait puis disparaissait d'un coup. Si le film ne
     recule plus pendant BLOCAGE millisecondes, on abandonne le
     retour image par image et on FOND simplement — meme duree, meme
     effet a l'oeil, et ca ne se coince jamais. */
  const BLOCAGE = 400;
  let derniereAvancee = 0;  /* instant du dernier vrai recul */
  let posSurveillee = -1;
  let fondu = 0;            /* 0 = pas de fondu ; sinon, ce qu'il reste */
  let fonduTotal = 0;
  let aLaMain = false;      /* on pousse le film nous-memes ? */

  /* Dimensions prises sur LA TOILE ELLE-MEME des qu'elle est posee.
     Sur telephone, la hauteur de la fenetre ne vaut pas la hauteur
     de ce qu'on voit (barre d'adresse) : le logo s'y retrouvait
     legerement deforme. */
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
  const largeur = () => Math.max(1, boite().width);
  const hauteur = () => Math.max(1, boite().height);

  /* ============================================================
     LA CARTE GRAPHIQUE
     ------------------------------------------------------------
     Deux petits programmes. Le premier pose un rectangle qui couvre
     l'ecran et calcule, pour chaque point, ou aller chercher la
     couleur dans le film — c'est la que se fait le recadrage. Le
     second decide, pour chaque point, s'il est vert, et le jette
     sinon.
     ============================================================ */
  const SOMMETS = [
    "attribute vec2 place;",
    "uniform vec2 echelle;",
    "varying vec2 uv;",
    "void main() {",
    "  vec2 t = place * 0.5 + 0.5;",
    "  t = (t - 0.5) * echelle + 0.5;",
    "  uv = vec2(t.x, 1.0 - t.y);",   /* le film est a l'endroit, la toile a l'envers */
    "  gl_Position = vec4(place, 0.0, 1.0);",
    "}"
  ].join("\n");

  const COULEURS = [
    "precision mediump float;",
    "varying vec2 uv;",
    "uniform sampler2D film;",
    "uniform float lumiereMin;",
    "uniform float margeVert;",
    "uniform vec4 aplat;",
    "void main() {",
    "  vec3 c = texture2D(film, uv).rgb;",
    "  float lum = dot(c, vec3(0.299, 0.587, 0.114));",
    "  float vert = c.g - max(c.r, c.b);",
    /* test franc : garde ou jete, jamais entre les deux */
    "  if (lum < lumiereMin || vert < margeVert) discard;",
    /* aplat si une couleur est donnee, sinon la couleur du film */
    "  gl_FragColor = vec4(aplat.a > 0.5 ? aplat.rgb : c, 1.0);",
    "}"
  ].join("\n");

  /* « #9dff00 » -> [0.61, 1, 0] */
  function lireCouleur(h) {
    const m = String(h).trim().replace("#", "");
    if (m.length !== 6) return null;
    return [
      parseInt(m.slice(0, 2), 16) / 255,
      parseInt(m.slice(2, 4), 16) / 255,
      parseInt(m.slice(4, 6), 16) / 255
    ];
  }

  function compiler(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }

  function preparerCarte() {
    gl = toile.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false })
      || toile.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) return false;

    const vs = compiler(gl.VERTEX_SHADER, SOMMETS);
    const fs = compiler(gl.FRAGMENT_SHADER, COULEURS);
    if (!vs || !fs) return false;

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    /* le rectangle qui couvre l'ecran : deux triangles */
    const tampon = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const place = gl.getAttribLocation(prog, "place");
    gl.enableVertexAttribArray(place);
    gl.vertexAttribPointer(place, 2, gl.FLOAT, false, 0, 0);

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    /* pas de lissage : les points du logo restent des carres nets */
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    uEchelle = gl.getUniformLocation(prog, "echelle");
    gl.uniform1i(gl.getUniformLocation(prog, "film"), 0);
    gl.uniform1f(gl.getUniformLocation(prog, "lumiereMin"), LUMIERE_MIN / 255);
    gl.uniform1f(gl.getUniformLocation(prog, "margeVert"), MARGE_VERT / 255);
    const t = COULEUR ? lireCouleur(COULEUR) : null;
    gl.uniform4f(gl.getUniformLocation(prog, "aplat"),
      t ? t[0] : 0, t ? t[1] : 0, t ? t[2] : 0, t ? 1 : 0);
    return true;
  }

  /* ---------------- la toile a la bonne taille ---------------- */
  function tailler() {
    const L = largeur(), H = hauteur();
    /* On dessine a la definition de l'ecran (Retina compris), sans
       depasser PIXELS_MAX. */
    let d = Math.min(window.devicePixelRatio || 1, 2);
    const k = Math.sqrt(PIXELS_MAX / Math.max(1, L * H * d * d));
    if (k < 1) d *= k;
    const l = Math.max(1, Math.round(L * d));
    const h = Math.max(1, Math.round(H * d));
    if (toile.width !== l || toile.height !== h) {
      toile.width = l;
      toile.height = h;
      if (gl) gl.viewport(0, 0, l, h);
    }
    /* Recadrage « couvrir » : le film est carre, on garde ses
       proportions et on coupe ce qui depasse. */
    if (uEchelle) {
      if (l > h) gl.uniform2f(uEchelle, 1, h / l);
      else gl.uniform2f(uEchelle, l / h, 1);
    }
  }

  function dessiner(force) {
    if (!gl || !pret) return;
    if (!force && video.currentTime === dernierTemps) return;
    dernierTemps = video.currentTime;
    tailler();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    } catch (_e) {
      return;                        /* image pas encore decodee */
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function poser() {
    if (posee) return;
    document.body.appendChild(hote);
    posee = true;
  }

  /* opacite du voile noir : plein au debut du film... a l'envers,
     donc a la FIN, et rien une fois revenu au debut */
  function poserVoile(v) {
    voile.style.opacity = ouverture ? Math.max(0, Math.min(1, v)).toFixed(3) : "0";
  }

  function retirer() {
    if (boucle) { cancelAnimationFrame(boucle); boucle = 0; }
    video.pause();
    ouverture = false;
    fondu = 0;
    aLaMain = false;
    posSurveillee = -1;
    hote.style.opacity = "";
    hote.classList.remove("is-ouverture");
    poserVoile(0);
    if (!posee) return;
    hote.remove();
    posee = false;
    /* on remet le film au debut : la prochaine fois il repart de la */
    try { video.currentTime = 0; } catch (_e) {}
  }

  /* ---------------- le deroulement ---------------- */
  const fin = () => Math.max(0, (video.duration || 0) - 0.04);

  function avancer(maintenant) {
    boucle = 0;
    if (!pret) { sens = 0; return; }

    /* CADENCE : on ne dessine pas a chaque battement de l'ecran,
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
      /* Le film avance-t-il vraiment ? Sur telephone la lecture est
         parfois refusee en silence (economie d'energie, onglet juge
         invisible) : l'image restait figee sur la premiere et ne
         partait jamais. On repasse alors en AVANCE MANUELLE : on
         pousse currentTime nous-memes, image par image. */
      if (posSurveillee < 0 || video.currentTime > posSurveillee + 0.001) {
        posSurveillee = video.currentTime;
        derniereAvancee = maintenant;
      } else if (maintenant - derniereAvancee > BLOCAGE) {
        aLaMain = true;
      }
      if (aLaMain) {
        const pas = Math.max(1, Math.round(CADENCE_FILM / CADENCE)) / CADENCE_FILM;
        const t = video.currentTime + pas;
        if (t < fin()) { try { video.currentTime = t; } catch (_e) {} }
        posSurveillee = video.currentTime;
      }
      dessiner(aLaMain);
      /* Arrive au bout : on se fige tant qu'on ne fait rien. La
         derniere image reste dessinee sur la toile. */
      if (video.currentTime >= fin()) { video.pause(); sens = 0; return; }
    } else if (sens < 0) {
      const vitesse = ouverture ? INTRO : RETOUR;

      /* --- le film s'est coince : on finit en fondu --- */
      if (fondu > 0) {
        fondu -= maintenant - (dernierDessin || maintenant);
        const reste = Math.max(0, fondu / Math.max(1, fonduTotal));
        hote.style.opacity = reste.toFixed(3);
        poserVoile(reste);
        if (fondu <= 0) { sens = 0; retirer(); return; }
        boucle = requestAnimationFrame(avancer);
        return;
      }

      /* En arriere on SAUTE des images du film : a chaque dessin on
         recule de plusieurs images d'un coup. Il y a une image cle
         toutes les dix images dans ce fichier, donc reculer y est
         rapide — quand le navigateur veut bien. */
      const saut = Math.max(1, Math.round((CADENCE_FILM / CADENCE) * vitesse));
      const t = video.currentTime - Math.max(dt * vitesse, saut / CADENCE_FILM);
      if (t <= 0) { sens = 0; retirer(); return; }

      /* le film a-t-il vraiment recule depuis la derniere image ? */
      if (posSurveillee < 0 || video.currentTime < posSurveillee - 0.001) {
        posSurveillee = video.currentTime;
        derniereAvancee = maintenant;
      } else if (maintenant - derniereAvancee > BLOCAGE) {
        fonduTotal = Math.max(200, (video.currentTime / vitesse) * 1000);
        fondu = fonduTotal;
        boucle = requestAnimationFrame(avancer);
        return;
      }

      video.currentTime = t;
      poserVoile(t / Math.max(0.01, video.duration || 1));
      dessiner(true);
    } else {
      return;
    }
    boucle = requestAnimationFrame(avancer);
  }

  function relancer() {
    if (!sens) return;
    posSurveillee = -1;
    derniereAvancee = performance.now();
    /* On annule toujours l'image en attente avant d'en demander une
       autre : quand l'onglet passe en arriere-plan, la demande
       posee ne se realise jamais, et sans cette annulation le film
       resterait bloque pour de bon. */
    if (boucle) cancelAnimationFrame(boucle);
    dernier = performance.now();
    dernierDessin = 0;
    boucle = requestAnimationFrame(avancer);
  }

  function jouer() {
    if (!pret) return false;
    fondu = 0;
    aLaMain = false;
    hote.style.opacity = "";
    /* Si le film etait reste sur sa derniere image — apres
       l'ouverture du site, ou apres un arret force — on repart du
       debut, sinon il se figerait aussitot. */
    if (video.currentTime >= fin() - 0.05) {
      try { video.currentTime = 0; } catch (_e) {}
    }
    poser();
    sens = 1;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
    relancer();
    return true;
  }

  function rembobiner() {
    if (!posee) return false;
    video.pause();
    if (video.currentTime <= 0) { retirer(); return false; }
    /* Saut aux trois quarts du film, puis retour en arriere depuis
       la — quel que soit l'endroit ou on en etait. Le retour dure
       donc toujours la meme chose. */
    const depart = (video.duration || 0) * DEPART_RETOUR;
    sens = -1;
    if (depart > 0 && Math.abs(depart - video.currentTime) > 0.05) {
      const fait = () => { video.removeEventListener("seeked", fait); dessiner(true); relancer(); };
      video.addEventListener("seeked", fait);
      try { video.currentTime = depart; } catch (_e) { relancer(); }
      return true;
    }
    relancer();
    return true;
  }

  /* ---------------- l'ecran de chargement ----------------
     La DERNIERE image du film — le logo entier — posee sur un fond
     noir plein, et rien qui bouge. C'est ce qu'on voit tant que la
     page n'est pas prete. Ensuite ouvrir() prend la suite. */
  function figer() {
    if (!pret) return false;
    ouverture = true;
    hote.classList.add("is-ouverture");
    poser();
    poserVoile(1);
    video.pause();
    sens = 0;
    if (boucle) { cancelAnimationFrame(boucle); boucle = 0; }
    const fait = () => { video.removeEventListener("seeked", fait); dessiner(true); };
    video.addEventListener("seeked", fait);
    video.currentTime = fin();
    return true;
  }

  /* ---------------- l'ouverture du site ----------------
     Le film est joue A L'ENVERS depuis sa derniere image, sur fond
     noir plein — et ce noir s'efface au meme rythme, decouvrant la
     page. Quand le film revient a son debut, il ne reste rien.
     Appelee par assets/js/boot.js, une fois la page prete. */
  function ouvrir() {
    if (!pret) return false;
    ouverture = true;
    hote.classList.add("is-ouverture");
    poser();
    poserVoile(1);
    video.pause();
    /* deja fige sur la derniere image : on repart de la */
    if (video.currentTime >= fin() - 0.2) {
      dessiner(true);
      sens = -1;
      relancer();
      return true;
    }
    const fait = () => {
      video.removeEventListener("seeked", fait);
      dessiner(true);
      sens = -1;
      relancer();
    };
    video.addEventListener("seeked", fait);
    video.currentTime = fin();
    return true;
  }

  /* ---------------- branchements ---------------- */
  window.addEventListener("resize", () => { if (posee) dessiner(true); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { sens = 0; retirer(); try { video.currentTime = 0; } catch (_e) {} }
  });

  /* On ne va chercher le film qu'APRES le chargement de la page :
     il pese quelques mega-octets, il ne doit pas se mettre en
     travers du site. */
  function telecharger() {
    if (video.src) return;
    video.src = BASE + FICHIER;
  }
  if (document.readyState === "complete") setTimeout(telecharger, 400);
  else window.addEventListener("load", () => setTimeout(telecharger, 400), { once: true });

  video.addEventListener("loadeddata", () => {
    if (pret) return;
    if (!gl && !preparerCarte()) return;   /* pas de WebGL : pas de logo */
    pret = true;
    video.pause();
    try { video.currentTime = 0; } catch (_e) {}
  });

  function monter() {
    document.body.appendChild(video);
    window.BSLogoGlitch = {
      hote: hote,
      video: video,
      jouer: jouer,
      rembobiner: rembobiner,
      figer: figer,
      ouvrir: ouvrir,
      /* mise au point : BSLogoGlitch.montre(8) fige le film a la
         huitieme seconde, BSLogoGlitch.montre() rend la main */
      montre(t) {
        if (t === undefined || t === null) { sens = 0; retirer(); return 0; }
        if (!pret) return -1;
        sens = 0;
        video.pause();
        poser();
        const fait = () => { video.removeEventListener("seeked", fait); dessiner(true); };
        video.addEventListener("seeked", fait);
        video.currentTime = Math.max(0, Math.min(fin(), t));
        return video.currentTime;
      },
      get pret() { return pret; },
      get etat() {
        return {
          pret: pret,
          definition: [video.videoWidth, video.videoHeight],
          duree: Math.round((video.duration || 0) * 100) / 100,
          seconde: Math.round(video.currentTime * 100) / 100,
          toile: [toile.width, toile.height],
          sens: sens,
          memoire_Mo: 0
        };
      }
    };
  }
  if (document.body) monter();
  else document.addEventListener("DOMContentLoaded", monter);
})();
