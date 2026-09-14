/* ============================================================
   IDLE-GLITCH.JS — LA PAGE PART EN BOUILLIE QUAND ON NE FAIT RIEN
   ------------------------------------------------------------
   Apres quelques secondes sans un geste, la page est
   photographiee (assets/js/page-snapshot.js) puis travaillee
   image apres image, SANS JAMAIS ETRE REDESSINEE : chaque passe
   abime le resultat de la precedente. C'est ce qui fait que ca
   finit en belle bouillie au lieu de clignoter.

   Deux gestes, melanges :

   1. LE BARBOUILLAGE — on preleve un petit carre de l'image et on
      le repose un peu a cote. Des centaines de fois par image. Le
      decalage est donne par un bruit de Perlin ETIRE : fin dans un
      sens, large dans l'autre, ce qui produit des coulures
      horizontales ou verticales au lieu d'un grain uniforme.

   2. LE RANGEMENT DES PIXELS (pixel sort) — des suites de pixels
      sont rangees par luminosite, par teinte, par saturation...
      Il avance PROGRESSIVEMENT : une tranche par image, et des
      suites de plus en plus longues a mesure que le temps passe.
      Rien ne se fige d'un coup.

   TOUS LES REGLAGES SONT TIRES AU SORT A CHAQUE CHARGEMENT de la
   page : taille du prelevement, nombre par image, amplitude,
   dimensions du bruit, sens d'etirement, critere et sens du
   rangement, longueur des suites. Le meme effet, jamais deux fois
   pareil. Et A CHAQUE FOIS QUE L'EFFET S'ARRETE, ces reglages sont
   RETOUCHES d'un petit pas au lieu d'etre retires : on reste dans
   la meme famille, sans jamais repeter la fois d'avant.

   Les tranches rangees ne sont pas prises dans l'ordre : un ordre
   melange est tire a chaque tour, sinon on verrait une ligne
   balayer l'ecran comme sur un minitel.

   Le logo (assets/js/glitch-logo.js) se joue PAR-DESSUS, sur sa
   propre toile : il n'est pas abime par l'effet.

   Ecrit avec p5.js (assets/vendor/p5.min.js), garde en local.
   A SAVOIR : p5 ne sait pas photographier la page — aucun
   navigateur ne le sait. C'est page-snapshot.js qui s'en charge.

   REGLAGES GENERAUX (les bornes du tirage sont plus bas, dans
   tirerReglages) :
     ATTENTE   inactivite avant que ca commence (ms)
     MONTEE    duree pour atteindre le desordre maximum (ms)
     RETOUR    duree du retour a la normale (ms)
     CADENCE   images par seconde
     ECHELLE   finesse (1 = plein ecran, 0.7 = plus gros grain)

   window.BS_NO_GLITCH = true avant ce script le desactive.
   Console : BSGlitch.montre(1) fige l'effet a fond,
   BSGlitch.montre(0) rend la main, BSGlitch.retirer() retire un
   nouveau jeu de reglages au hasard.
   ============================================================ */

(function () {
  if (window.BS_NO_GLITCH) return;
  if (typeof p5 === "undefined") return;
  if (!window.BSSnapshot) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ATTENTE = 4000;
  const MONTEE = 9000;       /* la bouillie se depose lentement */
  const FONDU = 4000;        /* fondu d'entree, de la page a l'effet */
  const SORTIE = 160;        /* retour au direct : quasi immediat */
  /* Un voile noir uni se pose SUR TOUT L'ECRAN pendant que la
     bouillie s'installe : rien au premier instant, 15 % de noir au
     bout de quinze secondes sans rien faire. */
  const OMBRE_MONTEE = 15000;
  const OMBRE_FORCE = 0.15;
  /* Le logo n'apparait pas des le debut du dereglement non plus. */
  const ATTENTE_LOGO = 5000;
  const CADENCE = 24;
  const ECHELLE = 0.7;
  /* Plafond du nombre de pixels travailles, pour les tres grands
     ecrans. Au-dela, la toile est simplement plus grossiere —
     l'effet est deja pixelise, ca ne se voit pas, et la page reste
     fluide. Mesure sur une toile de 1008 x 630 : 5,9 ms par image,
     pour un budget de 42 ms. */
  const PIXELS_MAX = 1600000;
  /* Plafond de tranches rangees par image (voir appliquer()). */
  const TRANCHES_MAX = 26;

  /* ============================================================
     LES REGLAGES
     ------------------------------------------------------------
     Chaque reglage a des BORNES, et une seule table les donne. Au
     chargement de la page on tire un nombre au hasard dans chaque
     borne. A CHAQUE FOIS QUE L'EFFET S'ARRETE on ne retire pas
     tout : on RETOUCHE ce qu'on avait, d'un petit pas. Memes
     bornes, meme famille d'effet, jamais tout a fait pareil.
     ============================================================ */
  const BORNES = {
    taille: [10, 34],          /* cote du carre preleve */
    nombre: [70, 240],         /* prelevements par image */
    pas: [4, 26],              /* amplitude du decalage */
    bruitFin: [0.010, 0.030],  /* dimension fine du bruit */
    bruitLarge: [0.0004, 0.0025], /* dimension large du bruit */
    vitesse: [0.04, 0.22],     /* derive du bruit */
    biais: [0.25, 0.85],       /* part du decalage qui suit le sens */
    triMin: [4, 40],           /* suite rangee la plus courte */
    triEtendue: [10, 160],     /* de combien la plus longue depasse */
    triParImage: [6, 22],      /* tranches rangees par image */
    triCroissance: [0.6, 3.2], /* vitesse d'allongement des suites */
    melange: [0, 1]            /* 0 bouillie, 1 rangement */
  };

  /* De combien on bouge au PREMIER arret, en part de l'etendue de
     la borne. 0.14 = un septieme : on reconnait l'effet, il n'est
     plus le meme. */
  const RETOUCHE = 0.14;
  /* Et la retouche GRANDIT d'un arret a l'autre : le deuxieme
     retouche plus fort que le premier, le troisieme plus fort
     encore. Plus on reste sur la page, plus l'effet s'eloigne de
     son tirage de depart. 0 = pas fixe. */
  const RETOUCHE_CROISSANCE = 0.35;
  const RETOUCHE_MAX = 0.9;      /* sans jamais couvrir toute la borne */
  /* Une chance sur COMBIEN de changer aussi un choix (sens du
     bruit, critere de rangement...) au premier arret. Cette chance
     grandit au meme rythme. */
  const CHANGE_UN_CHOIX = 4;

  let retouches = 0;             /* nombre d'arrets depuis le chargement */

  const R = {};   /* les reglages en service */
  const B = {};   /* les valeurs tirees, avant dosage */
  const hasard = (a, b) => a + Math.random() * (b - a);
  const parmi = (liste) => liste[Math.floor(Math.random() * liste.length)];
  const borner = (v, a, b) => Math.max(a, Math.min(b, v));

  function tirerTout() {
    Object.keys(BORNES).forEach((clef) => {
      B[clef] = hasard(BORNES[clef][0], BORNES[clef][1]);
    });
    B.sens = parmi(["H", "V"]);
    B.triPar = parmi(["BR", "BR", "BR", "H", "S", "R", "G", "B", "F"]);
    B.triSens = parmi(["V", "H", "V", "H", "W"]);
    B.triInverse = Math.random() < 0.5;
    B.triPondere = parmi(["N", "F", "A"]);
    retouches = 0;
  }

  function retoucherTout() {
    retouches += 1;
    /* le pas grandit a chaque arret */
    const ampleur = Math.min(RETOUCHE_MAX, RETOUCHE * (1 + retouches * RETOUCHE_CROISSANCE));
    Object.keys(BORNES).forEach((clef) => {
      const [a, b] = BORNES[clef];
      const pas = (b - a) * ampleur;
      B[clef] = borner(B[clef] + hasard(-pas, pas), a, b);
    });
    /* et la chance de changer un choix grandit pareil */
    const chance = Math.min(0.9, (1 / CHANGE_UN_CHOIX) * (1 + retouches * RETOUCHE_CROISSANCE));
    if (Math.random() < chance) B.sens = B.sens === "H" ? "V" : "H";
    if (Math.random() < chance) B.triPar = parmi(["BR", "BR", "BR", "H", "S", "R", "G", "B", "F"]);
    if (Math.random() < chance) B.triSens = parmi(["V", "H", "V", "H", "W"]);
    if (Math.random() < chance) B.triInverse = !B.triInverse;
    if (Math.random() < chance) B.triPondere = parmi(["N", "F", "A"]);
  }

  /* Des valeurs tirees, on fabrique les reglages en service. */
  function appliquer() {
    R.taille = Math.round(B.taille);
    R.pas = B.pas;
    R.vitesse = B.vitesse;
    R.biais = B.biais;

    /* Le bruit est ETIRE : une dimension fine, l'autre large. Fin
       en X = le decalage change vite d'une colonne a l'autre et
       lentement d'une ligne a l'autre, donc ca coule a
       l'horizontale. Et l'inverse a la verticale. */
    R.sens = B.sens;
    R.bruitX = B.sens === "H" ? B.bruitFin : B.bruitLarge;
    R.bruitY = B.sens === "H" ? B.bruitLarge : B.bruitFin;

    R.triPar = B.triPar;
    R.triSens = B.triSens;
    R.triInverse = B.triPar === "F" ? false : B.triInverse;  /* sinon ca s'annule */
    R.triPondere = B.triPondere;
    R.triMin = Math.round(B.triMin);
    R.triCroissance = B.triCroissance;

    /* Le DOSAGE entre les deux gestes : 0 = presque que de la
       bouillie, 1 = presque que du rangement. Un gros effet de
       rangement veut peu de barbouillage, sinon il est efface au
       fur et a mesure. */
    R.melange = B.melange;
    R.nombre = Math.round(B.nombre * (1 - B.melange * 0.9));
    /* Plafond : ranger une tranche coute cher (un tri par suite de
       pixels). Au-dela d'une trentaine par image on paie sans que
       ca se voie davantage. */
    R.triParImage = Math.min(TRANCHES_MAX, Math.round(B.triParImage * (0.4 + B.melange * 2.2)));
    R.triMax = Math.round((B.triMin + B.triEtendue) * (0.5 + B.melange * 1.8));
    return R;
  }

  function tirerReglages() { tirerTout(); return appliquer(); }
  function retoucherReglages() { retoucherTout(); return appliquer(); }
  tirerReglages();

  /* ---------- l'hote du canvas ---------- */
  const hote = document.createElement("div");
  hote.className = "bs-glitch";
  hote.setAttribute("aria-hidden", "true");

  /* Voile noir uni, plein ecran. Il vient DOUCEMENT, comme une ombre
     qui se depose. Son opacite est posee image par image, pas par
     une transition CSS. */
  const ombre = document.createElement("div");
  ombre.className = "bs-glitch__ombre";
  hote.appendChild(ombre);

  let photo = null;
  let enCours = false;
  let force = 0;
  let cible = 0;
  let minuteur = 0;
  let minuteurLogo = 0;
  let depuisSommeil = 0;     /* instant ou l'effet a ete lance */
  let croquis = null;
  let opacite = 0;           /* fondu, pilote image par image */
  let avancee = 0;           /* temps passe en sommeil, en secondes */
  let fige = false;
  /* Cout des dernieres images, en millisecondes. A 24 images par
     seconde il faut rester bien sous 41 ms. BSGlitch.mesure donne
     la mediane : c'est le chiffre a regarder si ca rame. */
  const mesures = [];

  const largeur = () => Math.max(1, document.documentElement.clientWidth);
  const hauteur = () => Math.max(1, document.documentElement.clientHeight);

  /* Finesse reelle de la toile : ECHELLE, sauf sur un grand ecran
     ou on descend pour rester sous PIXELS_MAX. */
  function echelle() {
    const surface = largeur() * hauteur();
    return Math.min(ECHELLE, Math.sqrt(PIXELS_MAX / Math.max(1, surface)));
  }

  function photographier() {
    if (enCours) return;
    enCours = true;
    window.BSSnapshot.take().then((c) => {
      photo = c;
      enCours = false;
      if (!c) { cible = 0; eteindre(); }
    });
  }

  /* ============================================================
     LE SKETCH p5
     ============================================================ */
  function sketch(p) {
    let posee = false;     /* la photo est-elle deja en place ? */
    let marcheX = 0;
    let marcheY = 0;

    /* ---- dans quel ordre ranger les tranches ? ----
       Pas 0, 1, 2, 3... : on verrait une ligne descendre
       regulierement en travers de l'ecran, facon rafraichissement
       de minitel. On tire au contraire un ORDRE MELANGE : chaque
       ligne (ou colonne) y passe une fois et une seule par tour,
       mais jamais dans l'ordre. Le rangement se depose donc comme
       du bruit, et non comme un balayage. */
    let ordre = null;
    let ordreI = 0;
    let ordrePour = -1;

    function melanger(n) {
      ordre = new Uint32Array(n);
      for (let i = 0; i < n; i += 1) ordre[i] = i;
      for (let i = n - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = ordre[i]; ordre[i] = ordre[j]; ordre[j] = t;
      }
      ordrePour = n;
      ordreI = 0;
    }

    function trancheSuivante(n) {
      if (ordrePour !== n || ordreI >= n) melanger(n);
      return ordre[ordreI++];
    }

    p.setup = function () {
      p.pixelDensity(1);
      const e = echelle();
      const c = p.createCanvas(Math.round(largeur() * e), Math.round(hauteur() * e));
      c.parent(hote);
      p.frameRate(CADENCE);
      p.noSmooth();
      p.noLoop();
    };

    /* ---- ou frotter ? ----
       Une page de fonte est surtout noire : prendre des points au
       hasard reviendrait a barbouiller du noir sur du noir, et on
       ne verrait rien. On repere donc une fois pour toutes les
       endroits CONTRASTES de la photo, et on y va plus souvent —
       sans jamais s'interdire le reste de la page. */
    const GX = 40, GY = 24;
    let cumul = new Float64Array(GX * GY);
    let total = 0;

    function reperer() {
      total = 0;
      p.loadPixels();
      const d = p.pixels;
      const W = p.width, H = p.height;
      const cw = W / GX, ch = H / GY;
      for (let gy = 0; gy < GY; gy += 1) {
        for (let gx = 0; gx < GX; gx += 1) {
          let mn = 255, mx = 0;
          /* quelques sondages suffisent a savoir si ca bouge */
          for (let k = 0; k < 12; k += 1) {
            const x = Math.min(W - 1, Math.floor((gx + (k % 4) / 4) * cw));
            const y = Math.min(H - 1, Math.floor((gy + Math.floor(k / 4) / 3) * ch));
            const i = (y * W + x) * 4;
            const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
            if (l < mn) mn = l;
            if (l > mx) mx = l;
          }
          /* + 6 : meme une case plate garde une petite chance */
          total += (mx - mn) + 6;
          cumul[gy * GX + gx] = total;
        }
      }
    }

    /* un point tire selon la carte des contrastes */
    function tirerPoint(hors) {
      const W = p.width, H = p.height;
      if (!total) return [Math.random() * (W - hors), Math.random() * (H - hors)];
      const v = Math.random() * total;
      let lo = 0, hi = cumul.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumul[mid] < v) lo = mid + 1; else hi = mid;
      }
      const gx = lo % GX, gy = Math.floor(lo / GX);
      const cw = W / GX, ch = H / GY;
      return [
        Math.min(W - hors - 1, Math.max(0, (gx + Math.random()) * cw)),
        Math.min(H - hors - 1, Math.max(0, (gy + Math.random()) * ch))
      ];
    }

    function poserPhoto() {
      p.drawingContext.imageSmoothingEnabled = false;
      p.drawingContext.drawImage(photo, 0, 0, p.width, p.height);
      posee = true;
      ordrePour = -1;
      marcheX = Math.floor(p.width / 2);
      marcheY = Math.floor(p.height / 2);
      reperer();
    }

    /* ---------- 1. le barbouillage ----------
       On deplace les carres DANS LE TABLEAU DE PIXELS, pas avec
       drawImage. Recopier la toile sur elle-meme obligeait la carte
       graphique a rendre la main a chaque carre : mesure a 0,2 ms
       piece, soit 18,7 ms pour 83 carres — a elle seule, presque
       toute l'image. Ici on deplace des octets : c'est le meme
       geste, cent fois moins cher, et ca partage la seule lecture
       de pixels de l'image avec le rangement. */
    function barbouiller(d, f, t) {
      const W = p.width, H = p.height;
      const s = Math.max(2, Math.round(R.taille));
      const n = Math.round(R.nombre * f);
      const pas = R.pas * f;
      const octets = s * 4;

      for (let i = 0; i < n; i += 1) {
        /* trois fois sur quatre on vise une zone contrastee ;
           la quatrieme, n'importe ou, pour que tout y passe */
        const pt = Math.random() < 0.75
          ? tirerPoint(s)
          : [Math.random() * (W - s), Math.random() * (H - s)];
        const x = pt[0];
        const y = pt[1];

        /* bruit etire : deux tirages decales pour X et Y */
        const nx = p.noise(x * R.bruitX, y * R.bruitY, t * R.vitesse) * 2 - 1;
        const ny = p.noise(x * R.bruitX + 137, y * R.bruitY + 137, t * R.vitesse) * 2 - 1;

        /* le decalage suit surtout le sens d'etirement du bruit */
        let dx = nx * pas;
        let dy = ny * pas;
        if (R.sens === "H") dy *= 1 - R.biais;
        else dx *= 1 - R.biais;

        const sx = Math.max(0, Math.min(W - s, Math.round(x)));
        const sy = Math.max(0, Math.min(H - s, Math.round(y)));
        const tx = Math.max(0, Math.min(W - s, Math.round(x + dx)));
        const ty = Math.max(0, Math.min(H - s, Math.round(y + dy)));
        if (sx === tx && sy === ty) continue;

        /* Quand depart et arrivee se chevauchent, on parcourt les
           lignes du bon cote : sinon on recopierait ce qu'on vient
           d'ecrire et le carre partirait en trainee. */
        if (ty > sy) {
          for (let r = s - 1; r >= 0; r -= 1) {
            const de = ((sy + r) * W + sx) * 4;
            d.copyWithin(((ty + r) * W + tx) * 4, de, de + octets);
          }
        } else {
          for (let r = 0; r < s; r += 1) {
            const de = ((sy + r) * W + sx) * 4;
            d.copyWithin(((ty + r) * W + tx) * 4, de, de + octets);
          }
        }
      }
    }

    /* ---------- 2. le rangement des pixels ---------- */
    const luminosite = (r, g, b) => (r + r + b + g + g + g) / 6;

    function teinte(r, g, b) {
      const mn = Math.min(r, g, b);
      const mx = Math.max(r, g, b);
      if (mn === mx) return 0;
      let h;
      if (mx === r) h = (g - b) / (mx - mn);
      else if (mx === g) h = 2 + (b - r) / (mx - mn);
      else h = 4 + (r - g) / (mx - mn);
      h *= 60;
      return h < 0 ? h + 360 : h;
    }

    function saturation(r, g, b) {
      const mn = Math.min(r, g, b);
      const mx = Math.max(r, g, b);
      const l = luminosite(r, g, b);
      if (mx === mn) return 0;
      return l <= 127.5 ? (mx - mn) / (mx + mn) : (mx - mn) / (510 - mx - mn);
    }

    function clef(r, g, b) {
      switch (R.triPar) {
        case "R": return r;
        case "G": return g;
        case "B": return b;
        case "H": return teinte(r, g, b);
        case "S": return saturation(r, g, b) * 255;
        default: return luminosite(r, g, b);
      }
    }

    /* tampons reutilises : trier ne doit rien allouer */
    let pix = new Uint32Array(0);
    let cles = new Float64Array(0);
    let rang = new Uint32Array(0);

    function reserver(n) {
      if (pix.length >= n) return;
      pix = new Uint32Array(n);
      cles = new Float64Array(n);
      rang = new Uint32Array(n);
    }

    /* Longueur d'une suite. Ponderee : plus le premier pixel est
       clair (ou sombre si « contre »), plus la suite est longue. */
    function longueurSuite(d, idx, mini, maxi) {
      if (R.triPondere === "N" || R.triPar === "F") {
        return Math.round(mini + Math.random() * (maxi - mini));
      }
      let c = clef(d[idx], d[idx + 1], d[idx + 2]);
      if (R.triPar === "H") c = (c / 360) * 255;
      if (R.triPondere === "A") c = 255 - c;
      return Math.round(mini + (Math.max(0, Math.min(255, c)) / 255) * (maxi - mini));
    }

    /* Range une suite de n pixels. pas = ecart entre deux pixels
       dans le tableau (4 en horizontal, 4*largeur en vertical). */
    function rangerSuite(d, depart, n, pas) {
      if (n < 3) return;
      if (R.triPar === "F") {
        for (let i = 0; i < n >> 1; i += 1) {
          const a = depart + i * pas;
          const b = depart + (n - 1 - i) * pas;
          for (let k = 0; k < 3; k += 1) {
            const tmp = d[a + k]; d[a + k] = d[b + k]; d[b + k] = tmp;
          }
        }
        return;
      }
      reserver(n);
      for (let i = 0; i < n; i += 1) {
        const j = depart + i * pas;
        pix[i] = (d[j] << 16) | (d[j + 1] << 8) | d[j + 2];
        cles[i] = clef(d[j], d[j + 1], d[j + 2]);
        rang[i] = i;
      }
      const vue = rang.subarray(0, n);
      Array.prototype.sort.call(vue, (a, b) => cles[a] - cles[b]);
      for (let i = 0; i < n; i += 1) {
        const c = pix[vue[R.triInverse ? n - 1 - i : i]];
        const j = depart + i * pas;
        d[j] = (c >> 16) & 255;
        d[j + 1] = (c >> 8) & 255;
        d[j + 2] = c & 255;
      }
    }

    function ranger(d, f) {
      const W = p.width, H = p.height;
      /* les suites s'allongent avec le temps : le rangement
         s'etire au lieu de tomber d'un coup */
      /* La longueur des suites depend du desordre ET du temps
         ecoule : plus on reste sans rien faire, plus le rangement
         va loin. Borne a la taille de l'image. */
      const etirement = 1 + avancee * R.triCroissance * 0.12;
      const plafond = R.triSens === "H" ? W : H;
      const maxi = Math.max(3, Math.min(plafond - 1, Math.round(R.triMax * f * etirement)));
      const mini = Math.max(2, Math.min(maxi - 1, Math.round(R.triMin * f)));
      const tranches = Math.max(1, Math.round(R.triParImage * f));

      if (R.triSens === "V") {
        for (let c = 0; c < tranches; c += 1) {
          const col = trancheSuivante(W);
          let y = 0;
          while (y < H) {
            let n = longueurSuite(d, (y * W + col) * 4, mini, maxi);
            if (y + n >= H) n = H - y;
            rangerSuite(d, (y * W + col) * 4, n, W * 4);
            y += Math.max(1, n);
          }
        }
      } else if (R.triSens === "H") {
        for (let c = 0; c < tranches; c += 1) {
          const lig = trancheSuivante(H);
          let x = 0;
          while (x < W) {
            let n = longueurSuite(d, (lig * W + x) * 4, mini, maxi);
            if (x + n >= W) n = W - x;
            rangerSuite(d, (lig * W + x) * 4, n, 4);
            x += Math.max(1, n);
          }
        }
      } else {
        /* le marcheur : il erre et range derriere lui */
        for (let c = 0; c < tranches * 2; c += 1) {
          const horizontal = Math.random() < 0.5;
          let n = longueurSuite(d, (marcheY * W + marcheX) * 4, mini, maxi);
          if (horizontal) {
            if (marcheX + n >= W) n = W - marcheX - 1;
            if (n > 2) rangerSuite(d, (marcheY * W + marcheX) * 4, n, 4);
            marcheX += Math.random() < 0.5 ? n : -n;
          } else {
            if (marcheY + n >= H) n = H - marcheY - 1;
            if (n > 2) rangerSuite(d, (marcheY * W + marcheX) * 4, n, W * 4);
            marcheY += Math.random() < 0.5 ? n : -n;
          }
          marcheX = Math.max(0, Math.min(W - 2, marcheX));
          marcheY = Math.max(0, Math.min(H - 2, marcheY));
        }
      }
    }

    p.draw = function () {
      const dt = Math.min(140, p.deltaTime || 1000 / CADENCE);

      if (!fige) {
        if (cible === 1) {
          /* le desordre monte, et le fondu de la page vers l'effet
             prend ses quatre secondes */
          force = Math.min(1, force + dt / MONTEE);
          poserOpacite(opacite + dt / FONDU);
        } else {
          /* on a repris la main : on rend l'image tout de suite */
          poserOpacite(opacite - dt / SORTIE);
          if (opacite <= 0.001) { p.noLoop(); eteindre(); return; }
        }
      }

      if (!photo) return;
      if (!posee) poserPhoto();
      if (force <= 0.002) return;

      /* Le temps passe en sommeil : c'est lui qui fait grandir le
         rangement tout seul. Il avance aussi en mode reglage, pour
         qu'on puisse voir l'effet s'etirer. */
      avancee += dt / 1000;
      poserOmbre();

      const t = p.millis() / 1000;
      const depart = performance.now();
      /* UNE seule lecture et UNE seule ecriture de pixels par
         image : les deux gestes travaillent sur le meme tableau. */
      p.loadPixels();
      const d = p.pixels;
      barbouiller(d, force, t);
      ranger(d, force);
      p.updatePixels();
      mesures.push(performance.now() - depart);
      if (mesures.length > 60) mesures.shift();
    };

    p.reposer = function () { posee = false; };
    p.redimensionner = function () {
      const e = echelle();
      p.resizeCanvas(Math.round(largeur() * e), Math.round(hauteur() * e));
      posee = false;
    };
  }

  /* ============================================================
     VIE DE L'EFFET
     ============================================================ */
  function poserOpacite(v) {
    opacite = Math.max(0, Math.min(1, v));
    hote.style.opacity = opacite.toFixed(3);
  }

  /* avancee = temps passe en sommeil, en secondes */
  function poserOmbre() {
    /* On compte a partir du moment ou l'effet a ete lance, pas a
       partir des images dessinees : la photo de la page prend un
       instant, et le compte serait fausse d'autant. */
    const passe = depuisSommeil ? performance.now() - depuisSommeil : 0;
    const v = Math.max(0, Math.min(1, passe / OMBRE_MONTEE));
    /* courbe douce aux deux bouts : l'ombre n'apparait pas d'un coup */
    ombre.style.opacity = (v * v * (3 - 2 * v) * OMBRE_FORCE).toFixed(4);
  }

  function preparer() {
    if (!hote.parentNode) document.body.appendChild(hote);
    if (!croquis) croquis = new p5(sketch, hote);
  }

  function allumer() {
    preparer();
    croquis.loop();
  }

  function eteindre() {
    poserOpacite(0);
    force = 0;
    avancee = 0;
    depuisSommeil = 0;
    ombre.style.opacity = "0";
    if (croquis && croquis.reposer) croquis.reposer();
    if (hote.parentNode) hote.remove();
    photo = null;
    /* Le logo n'est pas abime par l'effet et ne disparait pas avec
       lui : il repart en arriere depuis l'image ou il en etait. */
    if (window.BSLogoGlitch) window.BSLogoGlitch.rembobiner();
    /* A chaque arret on retouche les reglages : la prochaine fois
       ce sera la meme famille d'effet, pas le meme effet. */
    if (!fige) retoucherReglages();
  }

  function endormir() {
    if (document.hidden) return;
    /* Pendant l'ecran de chargement, rien ne part : le compte a
       rebours ne demarre qu'a la fin de l'ouverture, quand boot.js
       rappelle reveiller(). */
    if (window.BSBoot && !window.BSBoot.pret) { reveiller(); return; }
    cible = 1;
    force = 0;
    avancee = 0;
    poserOpacite(0);
    depuisSommeil = performance.now();
    photographier();
    allumer();
    /* Le logo arrive apres, sur sa propre toile (glitch-logo.js) :
       la bouillie s'installe d'abord, le logo se construit ensuite. */
    clearTimeout(minuteurLogo);
    minuteurLogo = setTimeout(() => {
      if (cible === 1 && window.BSLogoGlitch) window.BSLogoGlitch.jouer();
    }, ATTENTE_LOGO);
  }

  function reveiller() {
    fige = false;
    cible = 0;
    /* le logo ne doit pas surgir apres coup si on a repris la main
       avant qu'il ait commence */
    if (minuteurLogo) { clearTimeout(minuteurLogo); minuteurLogo = 0; }
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(endormir, ATTENTE);
    /* la toile est encore la : on la fait disparaitre tout de suite
       plutot que d'attendre la fin d'une descente */
    if (opacite > 0.001 && croquis) croquis.loop();
    else if (hote.parentNode) eteindre();
  }

  ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"]
    .forEach((ev) => window.addEventListener(ev, reveiller, { passive: true }));

  window.addEventListener("resize", () => {
    photo = null;
    if (croquis && croquis.redimensionner) croquis.redimensionner();
    reveiller();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cible = 0; force = 0; if (croquis) croquis.noLoop(); eteindre(); }
  });

  reveiller();

  window.BSGlitch = {
    hote: hote,
    reglages: R,
    get force() { return force; },
    /* cout median d'une image, en millisecondes */
    get mesure() {
      if (!mesures.length) return null;
      const t = mesures.slice().sort((a, b) => a - b);
      return {
        image_ms: Math.round(t[t.length >> 1] * 100) / 100,
        pire_ms: Math.round(t[t.length - 1] * 100) / 100,
        toile: croquis ? [croquis.width, croquis.height] : null,
        budget_ms: Math.round(1000 / CADENCE)
      };
    },
    get retouches() { return retouches; },
    sleep: endormir,
    wake: reveiller,
    /* un nouveau jeu de reglages, sans recharger la page */
    retirer() { tirerReglages(); if (croquis) croquis.reposer(); return R; },
    /* la meme retouche que celle faite a chaque arret */
    retoucher() { retoucherReglages(); if (croquis) croquis.reposer(); return R; },
    /* Fige l'effet pour le regarder. montre(1) puis montre(0). */
    montre(f) {
      if (!f) {
        fige = false; cible = 0; force = 0;
        if (croquis) croquis.noLoop();
        eteindre();
        return 0;
      }
      fige = true;
      cible = 1;
      force = Math.max(0, Math.min(1, f));
      preparer();
      const poser = () => { croquis.loop(); poserOpacite(1); return force; };
      if (photo) return poser();
      return window.BSSnapshot.take().then((c) => { photo = c; return poser(); });
    }
  };
})();
