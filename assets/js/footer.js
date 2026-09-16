/* ============================================================
   FOOTER.JS — LE PIED DE PAGE, LE MEME PARTOUT
   ------------------------------------------------------------
   Un seul endroit a modifier pour toutes les pages du site :
   accueil et pages de fonte. Le pied est pose a la fin du <body>,
   apres tout le reste.

   Ce qu'il contient, de haut en bas :
     - BS.type, en grand
     - la ligne orange (deux lignes), traduite par i18n.js
     - la ligne « fondee par... », en bas a gauche
     - la photo assets/pied.png, calee en bas a droite, qui
       deborde du cadre

   POUR CHANGER LE TEXTE : assets/js/i18n.js, clefs foot.*
   POUR CHANGER LA PHOTO : remplacer assets/pied.png (fond
   transparent, sujet cale en bas).
   POUR CHANGER LES TAILLES ET LES COULEURS : .bs-pied dans
   assets/css/base.css.
   ============================================================ */

(function () {
  const moi = document.currentScript && document.currentScript.src;
  const BASE = moi ? moi.replace(/assets\/js\/footer\.js.*$/, "") : "";

  function t(clef, repli) {
    if (window.BSI18n && window.BSI18n.t) {
      const v = window.BSI18n.t(clef);
      if (v && v !== clef) return v;
    }
    return repli;
  }

  function monter() {
    /* on remplace les anciens pieds de page s'il en reste */
    document.querySelectorAll(".footer, .specimen-foot, .bs-pied")
      .forEach((n) => n.remove());

    const pied = document.createElement("footer");
    pied.className = "bs-pied";

    const texte = document.createElement("div");
    texte.className = "bs-pied__texte";

    const titre = document.createElement("p");
    titre.className = "bs-pied__titre";
    titre.textContent = "BS.type";

    const ligne = document.createElement("p");
    ligne.className = "bs-pied__ligne";
    ligne.setAttribute("data-i18n", "foot.tagline");
    ligne.textContent = t("foot.tagline", "OPEN SOURCE, INDEPENDENT\nFRENCH TYPE FOUNDRY");

    const fonde = document.createElement("p");
    fonde.className = "bs-pied__fonde";
    fonde.setAttribute("data-i18n", "foot.founded");
    fonde.textContent = t("foot.founded", "FOUNDED BY ENZO CETERA AND LUCAS PERNET");

    texte.append(titre, ligne, fonde);

    const photo = document.createElement("img");
    photo.className = "bs-pied__photo";
    photo.src = BASE + "assets/pied.png";
    photo.alt = "";
    photo.loading = "lazy";
    photo.setAttribute("aria-hidden", "true");
    /* La photo prend toute la hauteur du pied ; pour que sa LARGEUR
       suive, il lui faut ses proportions — la grille ne sait pas les
       deviner avant d'avoir la hauteur, et la boite se retrouvait
       etroite avec l'image perdue au milieu. On les releve sur
       l'image chargee : n'importe quelle photo marche. */
    photo.addEventListener("load", () => {
      if (photo.naturalWidth && photo.naturalHeight) {
        photo.style.aspectRatio = photo.naturalWidth + " / " + photo.naturalHeight;
      }
    });

    pied.append(texte, photo);
    document.body.appendChild(pied);
  }

  if (document.body) monter();
  else document.addEventListener("DOMContentLoaded", monter);
})();
