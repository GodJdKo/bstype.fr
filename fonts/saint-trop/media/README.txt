Depose ici tes images/videos pour cette fonte (jpg, png, webp,
gif, mp4, webm, mov). Elles apparaissent automatiquement dans
les cases "media" de la page specimen de la fonte, avec un
selecteur pour choisir laquelle afficher.

Apres avoir ajoute/retire un fichier, relance depuis la racine
du projet :

  node scripts/generate-media-manifest.js

(regenere fonts/*/media/manifest.json, lu par le site — le
navigateur ne peut pas lister un dossier tout seul).
