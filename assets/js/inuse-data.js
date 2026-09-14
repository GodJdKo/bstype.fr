/* ============================================================
   INUSE-DATA.JS — TRAVAUX MONTRES DANS "FONTS IN USE"
   ------------------------------------------------------------
   FICHIER GENERE : ne pas editer a la main.
   Reecrit par  node scripts/sync-fonts.js  a partir de ce qui se
   trouve dans fonts/<slug>/inUse/.

   Une fonte sans fichier dans ce dossier n'apparait PAS dans la
   section "Fonts in use" de la page d'accueil.
   Les legendes se saisissent dans fonts/<slug>/inUse/manifest.json
   (champ "text" de chaque ligne) et sont conservees.
   ============================================================ */

window.BS_INUSE = {};
