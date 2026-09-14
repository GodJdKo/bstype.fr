/* ============================================================
   NAV.JS — LA BARRE DU HAUT
   ------------------------------------------------------------
   « BS.type » ramene a l'accueil.
   « Fonts »  ouvre un menu (le meme composant que partout,
              assets/js/popup.js) listant TOUTES les fontes du
              catalogue ; cliquer une fonte ouvre sa page.

   Il n'y a plus de page « About » : la presentation vit dans la
   bulle qui s'ouvre en cliquant la tete, en bas a droite
   (assets/js/about-bubble.js).
   ============================================================ */

(function () {
  const trigger = document.querySelector(".nav__fonts");
  if (!trigger || !window.BSPopup) return;

  /* prefixe vers la racine : "" depuis l'accueil, "../../" depuis
     une page de fonte. On le lit sur le lien de marque. */
  const brand = document.querySelector(".nav__brand");
  const href = brand ? brand.getAttribute("href") || "" : "";
  const base = href.replace(/index\.html.*$/, "");

  function open() {
    const fonts = window.BS_FONTS || [];
    window.BSPopup.list({
      anchor: trigger,
      title: window.BSI18n ? window.BSI18n.t("menu.fonts") : "fonts",
      /* chaque nom s'affiche DANS sa fonte ; les points restent en BS Mono */
      items: fonts.map((f) => ({ value: f.slug, label: f.name, family: f.cssFamily })),
      selected: window.BS_SLUG || null,
      onPick: (slug) => { window.location.href = base + "fonts/" + slug + "/"; }
    });
  }

  trigger.addEventListener("click", (e) => { e.preventDefault(); open(); });
})();
