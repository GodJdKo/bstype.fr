VIDÉO DE FOND DE LA LANDING PAGE
================================

Fichiers :
  - landbg.mp4          → vidéo affichée (H.264, sans son, boucle)
  - landbg-poster.jpg    → image affichée pendant le chargement, et à la
                           place de la vidéo quand le téléphone est en
                           mode économie d'énergie

REMPLACER LA VIDÉO :
  1. Déposer le nouveau fichier ici sous le nom "landbg.mp4"
     (ou changer le chemin dans index.html, balise <video>).
  2. Refaire l'image d'attente (sinon l'ancienne s'affiche le temps
     du chargement) :
       ffmpeg -y -i landbg.mp4 -vframes 1 -vf "scale=640:-2,format=gray" -q:v 12 landbg-poster.jpg
     (format=gray : la vidéo actuelle est en noir et blanc ; à retirer
     pour une vidéo en couleur)

RECOMMANDATIONS TECHNIQUES :
  - Format H.264 (.mp4), pas de son (fichier plus léger).
  - Largeur 1280px suffit (la vidéo est agrandie en CSS, pas besoin de 4K).
  - Compresser avec ffmpeg si le fichier dépasse quelques Mo, ex :
       ffmpeg -i source.mov -vf "fps=30,scale=1280:-2" -c:v libx264 \
         -pix_fmt yuv420p -crf 23 -preset medium -movflags +faststart -an landbg.mp4

Le cadrage (crop-to-fit) est géré en CSS (assets/css/home.css,
règle .hero__video) — il n'y a rien à changer côté vidéo pour ça.
