/* ============================================================
   FACES-DATA.JS — VIGNETTES VIDEO DES AUTEURS
   ------------------------------------------------------------
   FICHIER GENERE : ne pas editer a la main.
   Reecrit par  node scripts/sync-fonts.js  a partir des videos
   deposees dans assets/authorfaces/.

   Nommage attendu : PRENOM + initiale du nom, en majuscules.
     Enzo Cetera   -> ENZOC.mp4
     Lucas Pernet  -> LUCASP.mp4
   (ENZOCETERA.mp4, ENZO.mp4 ou EC.mp4 marchent aussi.)

   La page d'une fonte affiche la vignette de son auteur ; les
   autres pages affichent la vignette par defaut ci-dessous.
   Lecture et detourage du fond vert : assets/js/face-video.js
   ============================================================ */

window.BS_FACE_DEFAULT = "assets/2face.mp4";

window.BS_FACES = {
  "Enzo Cetera": "assets/authorfaces/enzoC.mp4",
  "José GARBEROGLIO": "assets/authorfaces/joseG.mp4",
  "Lucas PERNET": "assets/authorfaces/lucasP.mp4",
  "Lucas Pernet": "assets/authorfaces/lucasP.mp4"
};

/* Textes des bulles : celui de la fonderie (accueil) et un par
   auteur (page de sa fonte). Ecrits dans assets/authorfaces/*.txt */
window.BS_FOUNDRY = {
  "paragraphs": [
    "Bs.type est une fonderie libre et gratuite, ouverte a tous, faite par deux amis qui voulaient juste un endroit ou partager librement leur travail et celui de leurs amis !",
    "Toutes les fontes de ce site sont libres d'usage et de modification, pour des travaux personnels comme commerciaux ! Montrez-nous ce que vous en faites, on l'affichera ici !",
    "Vous pouvez aussi nous envoyer vos propres caracteres si vous voulez les voir entrer au catalogue !",
    "On prend aussi les commandes : webdesign, dessin de caracteres, graphisme ou art numerique, interactif ou non, on trouvera.",
    "Ecrivez-nous pour n'importe quoi, on repond vite.",
    "Enzo et Lucas"
  ],
  "contacts": [
    "bstype.open@gmail.com",
    "bstype.com",
    "insta@bstype"
  ]
};

window.BS_BUBBLES = {
  "Enzo Cetera": {
    "paragraphs": [
      "Enzo Cetera dessine des caracteres modulaires et travaille l'image de synthese, le motion et l'interactif.",
      "A completer : quelques lignes sur ton parcours et ce que tu cherches dans le dessin de caractere."
    ],
    "contacts": [
      "enzocetera.pro@gmail.com",
      "enzocetera.com",
      "insta@jdko._"
    ]
  },
  "José GARBEROGLIO": {
    "paragraphs": [
      "José Tomàs dessine des caracteres de texte et de labeur, entre inscription lapidaire et lecture courante.",
      "A completer : quelques lignes sur ton parcours et ce que tu cherches dans le dessin de caractere."
    ],
    "contacts": [
      "contact@lucaspernet.fr",
      "lucaspernet.fr",
      "insta@pernet.lucas"
    ]
  },
  "Lucas PERNET": {
    "paragraphs": [
      "Lucas Pernet dessine des caracteres de texte et de labeur, entre inscription lapidaire et lecture courante.",
      "A completer : quelques lignes sur ton parcours et ce que tu cherches dans le dessin de caractere."
    ],
    "contacts": [
      "contact@lucaspernet.fr",
      "lucaspernet.fr",
      "insta@pernet.lucas"
    ]
  },
  "Lucas Pernet": {
    "paragraphs": [
      "Lucas Pernet dessine des caracteres de texte et de labeur, entre inscription lapidaire et lecture courante.",
      "A completer : quelques lignes sur ton parcours et ce que tu cherches dans le dessin de caractere."
    ],
    "contacts": [
      "contact@lucaspernet.fr",
      "lucaspernet.fr",
      "insta@pernet.lucas"
    ]
  }
};

/* Memes textes en anglais : assets/authorfaces/<CLE>.en.txt et
   bstype.en.txt. Absents = la bulle reste en francais. */
window.BS_FOUNDRY_EN = {
  "paragraphs": [
    "Bs.type is a free libre foundry for everyone, made by two friends that just wanted a platform to share freely their own and friends' work!",
    "Every font on this website is free to use and modify for personnal and commercial work! Please share your work using it so we can feature it on here!",
    "You can also share your typefaces that you'd like to be added to the catalogue !",
    "We are open to any commission work you'd need from us, from webdesign, fontwork, graphic design or any kind of digital art, interactive or not, we'll make it work.",
    "Please contact us for any matter, we'll respond in no time.",
    "Enzo and Lucas"
  ],
  "contacts": [
    "bstype.open@gmail.com",
    "bstype.com",
    "insta@bstype"
  ]
};

window.BS_BUBBLES_EN = {
  "Enzo Cetera": {
    "paragraphs": [
      "Enzo Cetera draws modular typefaces and works with CGI, motion and interactive design.",
      "To be written: a few lines about your background and what you are after in type design."
    ],
    "contacts": [
      "enzocetera.pro@gmail.com",
      "enzocetera.com",
      "insta@jdko._"
    ]
  },
  "Lucas PERNET": {
    "paragraphs": [
      "Lucas Pernet draws text and workhorse typefaces, somewhere between lapidary inscription and everyday reading.",
      "To be written: a few lines about your background and what you are after in type design."
    ],
    "contacts": [
      "contact@lucaspernet.fr",
      "lucaspernet.fr",
      "insta@pernet.lucas"
    ]
  },
  "Lucas Pernet": {
    "paragraphs": [
      "Lucas Pernet draws text and workhorse typefaces, somewhere between lapidary inscription and everyday reading.",
      "To be written: a few lines about your background and what you are after in type design."
    ],
    "contacts": [
      "contact@lucaspernet.fr",
      "lucaspernet.fr",
      "insta@pernet.lucas"
    ]
  }
};
