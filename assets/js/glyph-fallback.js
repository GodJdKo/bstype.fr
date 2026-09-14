/* ============================================================
   GLYPH-FALLBACK.JS — repli quand un caractère manque à la fonte
   ------------------------------------------------------------
   Règle produit : caractère absent -> on tente l'autre casse
   (capitale <-> bas de casse) ; si vraiment absent dans les
   deux casses -> on saute le caractère (pas d'espace laissé).

   Détection : on dessine le caractère avec 'Famille, serif' puis
   'Famille, sans-serif' sur un canvas hors écran.
     - la fonte A le glyphe  -> son propre dessin sert dans les
       deux cas -> pixels IDENTIQUES -> supporté.
     - la fonte N'A PAS le glyphe -> chaque pile retombe sur SA
       police système (serif vs sans-serif) qui diffèrent ->
       pixels DIFFÉRENTS -> non supporté.

   Sécurité : si la fonte n'est pas réellement chargée, on ne
   touche à rien (filterText renvoie le texte tel quel). Et si le
   filtrage venait à tout supprimer, on renvoie aussi le texte
   d'origine — mieux vaut afficher que casser.
   Nécessite les fontes déjà chargées (document.fonts.ready).
   ============================================================ */

(function () {
  const cache = new Map();
  let canvas, ctx;

  function getCtx() {
    if (!ctx) {
      canvas = document.createElement("canvas");
      canvas.width = 48;
      canvas.height = 48;
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    }
    return ctx;
  }

  function draw(fontStack, ch) {
    const c = getCtx();
    c.clearRect(0, 0, 48, 48);
    c.font = `32px ${fontStack}`;
    c.textBaseline = "top";
    c.fillStyle = "#000";
    c.fillText(ch, 4, 4);
    return c.getImageData(0, 0, 48, 48).data;
  }

  function sameBitmap(a, b) {
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function isBlank(data) {
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return false;
    }
    return true;
  }

  function isWhitespace(ch) {
    return /\s/.test(ch);
  }

  /* La fonte est-elle réellement disponible pour dessiner ? */
  function fontReady(fontFamily) {
    try {
      return document.fonts ? document.fonts.check(`32px "${fontFamily}"`) : true;
    } catch (_e) {
      return true; // en cas de doute, on n'intervient pas
    }
  }

  function supports(fontFamily, ch) {
    if (isWhitespace(ch)) return true;
    const key = fontFamily + "::" + ch;
    if (cache.has(key)) return cache.get(key);
    let ok;
    try {
      const viaSerif = draw(`"${fontFamily}", serif`, ch);
      const viaSans = draw(`"${fontFamily}", sans-serif`, ch);
      // Glyphe fourni par la fonte => rendu identique dans les
      // deux piles. Rien dessiné du tout => on n'y touche pas.
      ok = sameBitmap(viaSerif, viaSans) || isBlank(viaSerif);
    } catch (_e) {
      ok = true; // fail open : mieux vaut afficher que casser le texte
    }
    cache.set(key, ok);
    return ok;
  }

  function swapCase(ch) {
    const lower = ch.toLowerCase();
    const upper = ch.toUpperCase();
    if (ch !== lower) return lower;
    if (ch !== upper) return upper;
    return null;
  }

  /* ---------- le glyphe le plus proche ----------
     Une fonte n'a pas toujours tout. Plutot que de sauter le
     caractere, on descend une echelle de remplacants, du plus
     fidele au plus lointain :
       1. le caractere lui-meme
       2. l'autre casse (G -> g)
       3. la lettre sans accent (É -> E), puis son autre casse
       4. un sosie de dessin (0 -> O, 1 -> l, « -> ")
     Le premier que la fonte dessine gagne. Si rien ne marche, on
     saute le caractere plutot que d'afficher le rectangle vide
     d'une police systeme. */
  const LOOKALIKE = {
    "0": "O", "1": "I", "5": "S", "8": "B",
    "O": "0", "I": "1", "l": "I", "S": "5", "B": "8",
    "«": '"', "»": '"', "“": '"', "”": '"', "‘": "'", "’": "'",
    "–": "-", "—": "-", "−": "-", "·": ".", "•": ".", "…": ".",
    "€": "E", "£": "L", "¥": "Y", "©": "C", "®": "R", "™": "TM",
    "×": "x", "÷": "/", "±": "+", "¡": "!", "¿": "?"
  };

  function deaccent(ch) {
    try {
      const bare = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return bare && bare !== ch ? bare : null;
    } catch (_e) {
      return null;
    }
  }

  function candidates(ch) {
    const list = [ch];
    const swapped = swapCase(ch);
    if (swapped) list.push(swapped);

    const bare = deaccent(ch);
    if (bare) {
      list.push(bare);
      const bareSwap = bare.length === 1 ? swapCase(bare) : null;
      if (bareSwap) list.push(bareSwap);
    }

    const look = LOOKALIKE[ch] || (bare ? LOOKALIKE[bare] : null);
    if (look) {
      list.push(look);
      const lookSwap = look.length === 1 ? swapCase(look) : null;
      if (lookSwap) list.push(lookSwap);
    }
    return list;
  }

  /* Une apostrophe ou une ponctuation absente laisse un ESPACE :
     sans ca « l'eau » devenait « leau » et deux mots se collaient.
     Une lettre absente, elle, disparait sans laisser de trou. */
  function isPunctuation(ch) {
    try {
      return /[\p{P}\p{S}]/u.test(ch);
    } catch (_e) {
      return /[!-\/:-@\[-`{-~]/.test(ch);
    }
  }

  /* Renvoie ce qu'il faut ecrire a la place de ch : le plus proche
     que la fonte dessine, un espace pour une ponctuation absente,
     rien du tout pour une lettre absente. */
  function nearest(fontFamily, ch) {
    if (isWhitespace(ch)) return ch;
    for (const c of candidates(ch)) {
      if (supports(fontFamily, c) && hasInk(fontFamily, c)) return c;
    }
    return isPunctuation(ch) ? " " : "";
  }

  function filterText(text, fontFamily) {
    if (!text) return text;
    // Fonte pas (encore) chargée : on ne filtre pas, on renvoie tel quel.
    if (!fontReady(fontFamily)) return text;

    let out = "";
    let removed = 0;
    for (const ch of text) {
      if (isWhitespace(ch) || supports(fontFamily, ch)) {
        out += ch;
        continue;
      }
      const near = nearest(fontFamily, ch);
      if (near) {
        out += near;
        continue;
      }
      /* aucun remplacant : on saute, sans espace */
      removed += 1;
    }

    // Garde-fou : si on a tout (ou presque tout) supprimé, la
    // détection est probablement en défaut -> on rend l'original.
    const kept = out.replace(/\s/g, "").length;
    const asked = text.replace(/\s/g, "").length;
    if (asked > 0 && kept === 0) return text;
    if (asked >= 4 && removed >= asked) return text;

    return out;
  }

  /* Le caractere dessine-t-il quelque chose ? Sert a la grille du
     jeu de caracteres : une case qui ne montre rien (espace
     insecable, trait conditionnel, glyphe vide) est un TROU, on ne
     la met pas dans la grille. */
  function hasInk(fontFamily, ch) {
    if (isWhitespace(ch)) return false;
    const key = "ink::" + fontFamily + "::" + ch;
    if (cache.has(key)) return cache.get(key);
    let ink;
    try {
      ink = !isBlank(draw(`"${fontFamily}", serif`, ch));
    } catch (_e) {
      ink = true;
    }
    cache.set(key, ink);
    return ink;
  }

  window.BSGlyph = { supports, hasInk, nearest, filterText };
})();
