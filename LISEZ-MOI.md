# BS.type — mode d'emploi

Site statique, sans build, sans dépendance. Tout se règle avec
des fichiers déposés dans des dossiers, plus **un double-clic**.

---

## Ajouter une graisse à une fonte existante

Exemple : ajouter le Bold de HEXCD.

1. Nomme le fichier avec **le même préfixe** que la fonte existante :
   `HEXCD-Bold.otf` (puisque l'existant est `HEXCD-Regular.otf`).
2. Dépose-le dans `assets/fonts/`.
3. Double-clique **`Maj.command`**.
4. Recharge la page.

La graisse apparaît dans le menu **font family** de l'éditeur, sur
la page de la fonte. Rien d'autre à faire.

---

## Le nom du designer

`Maj.command` lit la table `name` du fichier de police et remplit le
champ `designer` tout seul, **à condition** que le dessinateur ait
renseigné *Designer* (nameID 9) ou *Manufacturer* (nameID 8) à
l'export.

Beaucoup d'exports laissent ces champs vides — dans Glyphs c'est
`Font Info > Font > Designer`, dans FontLab `Font Info > Names`. Le
script te dit alors quelle police ne déclare rien, et tu saisis le
nom à la main dans `assets/js/fonts-data.js`.

Un nom déjà saisi n'est jamais écrasé : le remplissage automatique
n'agit que si le champ est vide ou vaut « A completer ».

**Designer ou Manufacturer ?** Ce sont deux champs différents du
fichier de police :

| Champ | nameID | Ce que ça veut dire |
|---|---|---|
| *Designer* | 9 | la personne qui a dessiné la fonte |
| *Manufacturer* | 8 | la fonderie / le vendeur qui la publie |

`Maj.command` prend le **9** en priorité et ne se rabat sur le **8**
que si le 9 est vide — et il écrit dans son rapport lequel des deux
a servi. Si le rapport dit « lu dans Manufacturer (nameID 8) », c'est
que la case *Designer* n'a pas été remplie à l'export : soit tu la
remplis et tu réexportes, soit tu corriges le nom à la main dans
`assets/js/fonts-data.js`.

---

## Le bouton de téléchargement

Chaque page de fonte porte un module `download`. Sa taille et sa
largeur changent à chaque chargement.

- **une seule graisse** : un seul bouton, qui donne le fichier de
  police.
- **plusieurs graisses** : le module se coupe en **deux** boutons.
  - *télécharger tout* : l'archive `assets/fonts/<FAMILLE>.zip`,
    fabriquée par `Maj.command` avec toute la famille. Elle est
    refaite à chaque mise à jour, et supprimée si la famille retombe
    à une seule graisse.
  - *télécharger sélection* : la graisse choisie dans le petit menu
    juste en dessous du bouton. Ce module a son propre choix : il ne
    dépend plus de ce qui est ouvert dans l'éditeur.

Le mot reste sur **une seule ligne** tant que c'est possible : le
corps est réduit automatiquement pour tenir dans la largeur du
bouton. Ce n'est que s'il deviendrait illisible qu'il se coupe en
deux (TÉLÉ / CHARGER). Rien à régler — c'est ce qui fait tenir
« télécharger », plus long que « download », dans un module étroit.

Le rappel sous le bouton compte les **variantes** (d'autres dessins,
rangés sous le même nom) et les **styles** (les graisses) séparément :
« 2 variantes · 2 styles » n'est pas la même chose que « 2 styles ».

Rien à faire à la main : les `.zip` sont générés.

---

## Supprimer une fonte

Retire son fichier de `assets/fonts/`, puis double-clique
`Maj.command`. Le script fait le ménage tout seul :

- le bloc de la fonte disparaît de `assets/js/fonts-data.js` ;
- sa ligne disparaît de l'ordre « Fonts in use » ;
- son archive `.zip` est supprimée ;
- sa règle `@font-face` disparaît de `assets/css/fonts.css`.

**Ton travail n'est jamais détruit.** Le dossier `fonts/<slug>/`
(médias, travaux *in use*, légendes) est *déplacé* dans
`fonts/_corbeille/`. À toi de le récupérer ou de le jeter.

> ⚠️ **Renommer les fichiers d'une fonte, c'est la supprimer et en
> créer une autre.** `JALLEAU-Regular.otf` renommé en
> `BSJALLEAU-Regular.otf` fait disparaître la fonte `jalleau` et
> apparaître la fonte `bsjalleau`, vide.
> Pour renommer proprement : change d'abord `familyKey` (et
> `cssFamily`, `name`) dans `assets/js/fonts-data.js` **avant** de
> relancer `Maj.command`. Si c'est déjà fait, récupère le contenu
> dans `fonts/_corbeille/`.

---

## Le site en français ou en anglais

Le bouton **FR / EN** en haut à droite change la langue de tout le
site. Il n'y a jamais de mélange : la page se recharge dans la
langue choisie, et le navigateur s'en souvient.

Trois endroits où écrire les textes :

| Quoi | Où |
|---|---|
| textes d'interface (menus, boutons, colonnes…) | `assets/js/i18n.js`, tableau `DICT` |
| présentation d'une fonte | `info` (fr) et `infoEn` (en) dans `assets/js/fonts-data.js` |
| bulle « à propos » | `assets/authorfaces/<CLE>.txt` (fr) et `<CLE>.en.txt` (en) |

Dans `i18n.js`, une ligne = une phrase :

```js
"ed.random":  { fr: "hasard",  en: "random" },
```

Une clé oubliée s'affiche telle quelle à l'écran (par exemple
`ed.random`) : c'est voulu, ça se repère tout de suite.

---

## Les textes d'essai (pangrammes)

Ils sont **communs à tout le catalogue**, dans un seul fichier :
`assets/js/samples.js`. Aucune fonte n'a « son » texte — ce sont
des textes pour *essayer* n'importe quelle fonte.

Trois listes, en français et en anglais :

| Liste | Bouton | Contenu |
|---|---|---|
| `words` | **1** | un mot |
| `lines` | **2** | une ligne / un pangramme |
| `paragraphs` | **3** | un paragraphe entier |

Pour en ajouter, écris ta phrase dans la bonne liste, entre
guillemets, suivie d'une virgule :

```js
lines: [
  "Portez ce vieux whisky au juge blond qui fume.",
  "Ta phrase ici.",
],
```

Les textes livrés sont des **placeholders** : remplace-les.

Au chargement, l'éditeur tire une ligne au hasard dans `lines`.
Sous 10 mots, le corps est calculé pour que la ligne **remplisse
toute la largeur** de l'aperçu.

Le champ `editorDefaults` de `fonts-data.js` garde les autres
réglages de départ (corps, interligne, approche, alignement) mais
plus de texte.

---

## Quand une fonte n'a pas le caractère

Arutext n'a pas de capitales, Saint-Trop n'a pas tout l'alphabet
accentué. Plutôt que de laisser un carré vide, le site descend une
échelle de remplaçants jusqu'à en trouver un que la fonte dessine :

1. le caractère lui-même
2. **l'autre casse** — `G` → `g`
3. la lettre **sans accent** — `É` → `E`, puis `e`
4. un **sosie de dessin** — `0` → `O`, `«` → `"`, `€` → `E`

Une **ponctuation** absente (apostrophe, tiret, guillemet) laisse un
**espace** : sans ça, « l'eau » devenait « leau » et deux mots se
collaient. Une lettre absente, elle, disparaît sans laisser de trou.

Si rien ne marche, le caractère est sauté — jamais remplacé par la
police du système. C'est dans `assets/js/glyph-fallback.js`,
fonction `nearest()`.

La règle s'applique **aussi pendant que tu tapes** dans un module
éditeur : taper `G` dans Arutext écrit `g`. Pour changer ou enrichir
les équivalences, la table `LOOKALIKE` est en haut du même fichier.

---

## Ajouter une nouvelle fonte

1. Nomme les fichiers `MAFONTE-Regular.otf`, `MAFONTE-Italic.otf`, etc.
2. Dépose-les dans `assets/fonts/`.
3. Double-clique **`Maj.command`**.

Le script crée tout seul :
- les règles `@font-face` dans `assets/css/fonts.css`
- une fiche dans `assets/js/fonts-data.js`
- la page `fonts/mafonte/` avec son dossier `media/`

4. Ouvre `assets/js/fonts-data.js`, trouve le bloc `slug: "mafonte"`
   et remplace les `"A completer"` :

```js
category: "Sans, Display",       // classification
designer: "Ton Nom",
year: "2026",
demoText: "Texte de la home",
info: [                          // blocs éditoriaux de la page
  { label: "GENESIS", body: "..." },
  { label: "FUTURE",  body: "..." }
],
```

5. Pour la faire apparaître sur la page d'accueil :
   - `showDemo: true` → bloc de démo dans le catalogue
   - `inUse: true` → ligne dans le tableau *Fonts in use*
   - `pill: { top: "30%", left: "20%" }` → pastille orange sur le hero
     (`null` = pas de pastille)
   - ajoute son `slug` dans `BS_FONTS_IN_USE_ORDER`, en bas du fichier

---

## Les mesures du jeu de caractères

Les traits (ascendante, hauteur de capitale, hauteur d'œil, ligne de
base, descendante) ne sont plus posés sur ce que le **fichier
déclare**, mais sur ce qui est **réellement dessiné**. Deux raisons :

1. **`sCapHeight` et `sxHeight`, dans la table OS/2, sont souvent
   les valeurs posées par défaut par le logiciel de dessin**, jamais
   remises à jour. Toutes nos fontes annoncent 700/1000 ; HEXCD
   annonce 833/1000 alors que ses capitales font 757. Le trait
   tombait donc à côté. La hauteur est maintenant **mesurée** sur une
   capitale à sommet plat (H, E, F…) et sur un bas de casse à sommet
   plat (x, z, v…) — les lettres rondes débordent un peu au-dessus de
   la ligne et fausseraient la mesure.
2. **La ligne de base non plus ne se calcule pas de façon fiable** :
   selon la fonte et le système, le navigateur suit les métriques
   `hhea`, `OS/2 typo` ou `OS/2 win`, et le glyphe se retrouve décalé
   de plusieurs pour cent par rapport aux traits. Un témoin invisible
   de hauteur nulle, aligné sur la base du texte, est donc posé dans
   le glyphe : sa position **dit** où la ligne de base est tombée.

Vérifié sur Jalleau à 123 px : le trait de capitale et le sommet
d'encre du A sont à **1 pixel** l'un de l'autre.

**L'ascendante et la descendante sont mesurées elles aussi.** La
valeur déclarée dans `hhea` est presque toujours bien plus haute que
ce qui est dessiné : Jalleau annonce 950 pour 1000 alors que ses
hampes montent à 720. Le trait partait donc beaucoup trop haut. On
prend maintenant le sommet d'encre le plus haut (b, d, h, k, l…) et
le bas le plus profond (p, q, g, j, y).

Vérifié sur Jalleau à 123 px, glyphe « b » : trait d'ascendante et
sommet d'encre **au même pixel** ; descendante à **1 pixel** du bas
du « p ».

---

## Deux dessins, une seule graisse

Si deux fichiers d'une même famille tombent sur la **même graisse et
le même style**, ils ne peuvent pas partager un nom CSS : le
navigateur n'a alors aucun moyen de les distinguer et en affiche
toujours un seul.

C'est le cas d'**Arutext** — `Inverted`, `Smearing` et `Tipnib`,
toutes en 400 normal : choisir un style ne changeait rien à l'écran.
`scripts/sync-fonts.js` leur donne donc un **nom CSS distinct**
(« Arutext Smearing »…) — et rien d'autre.

> Ce nom-là est de la plomberie : il ne se voit nulle part sur le
> site. **La variante, elle, reste ce que dit le nom du fichier** :
> `FAMILLE-Style` (deux morceaux) n'a pas de variante,
> `FAMILLE-Variante-Style` (trois morceaux) en a une. Arutext
> apparaît donc avec trois styles — *inverted*, *smearing*,
> *tipnib* — et pas avec trois variantes du même nom.

> Et le même dessin déposé en **plusieurs formats**
> (`BATON-Regular.otf` **et** `BATON-Regular.ttf`) n'est pas deux
> graisses : c'est un fichier, deux emballages. Un seul est retenu,
> dans l'ordre `woff2`, `woff`, `otf`, `ttf`. L'archive de
> téléchargement, elle, contient toujours tout ce qui est déposé.

---

## Règle de nommage des fichiers

    FAMILLE-Style.otf
    FAMILLE-Variante-Style.otf

La **famille** est toujours avant le premier tiret. À partir de trois
morceaux, le deuxième est la **variante** — techniquement un autre
dessin, mais rangé sous le même nom — et le reste est le **style** :

    PERSVRANCE-Carre45Fusion-Regular.ttf
      famille PERSVRANCE · variante Carre 45 Fusion · style Regular

Quand une fonte a plusieurs variantes, le premier menu de l'éditeur
liste les variantes, et chacune ouvre le sous-menu de ses styles. Le
libellé du réglage devient alors « font variant ».

Toutes les graisses d'une même fonte partagent le préfixe.
La graisse est déduite du nom : `Thin` 100, `ExtraLight` 200,
`Light` 300, `Regular` 400, `Medium` 500, `SemiBold` 600,
`Bold` 700, `ExtraBold` 800, `Black` 900. Un nom contenant
`Italic` passe en italique. Un nom non reconnu reste en 400 normal.

Détail dans `assets/fonts/LISEZ-MOI.txt`.

---

## Ajouter des médias à une fonte

1. Dépose images / vidéos / gifs dans `fonts/<slug>/media/`.
2. Double-clique `Maj.command` (il réindexe aussi les médias).

Ils deviennent choisissables dans le sous-menu **media** de chaque zone.

Le module `characterset` lit la liste des caractères **dans le
fichier de la fonte** (table `cmap`), pas dans une liste écrite à la
main : tu vois donc tout ce que la fonte couvre, y compris les
dessins rangés dans la zone privée (`U+E000` et au-delà), là où vont
les glyphes « custom ». Ceux qui ne dessinent rien sont retirés —
plus de case vide. Si la grille ne tient pas dans le module, elle
**défile** ; le module, lui, ne grandit pas.

> Un glyphe sans **aucun** point de code (accessible seulement par
> une fonctionnalité OpenType, `salt`, `ss01`…) ne peut pas être
> affiché par du texte HTML : il n'y a pas de caractère à taper. Pour
> qu'il apparaisse ici, place-le dans la zone privée à l'export.

Une page peut afficher jusqu'à **trois** modules `media`, et chacun
prend un fichier **différent** : avec deux médias dans le dossier, tu
vois deux visuels différents, jamais deux fois le même. Un dossier
vide = pas de module `media` du tout.

Mode de lecture des vidéos : `fonts/<slug>/media/playback.txt`,
une ligne par fichier :

```
ma-video.mp4 = scrub
autre.mp4    = loop
```

`scrub` (défaut) la vidéo suit le scroll · `loop` · `once` · `static`.

---

## Ajouter la vignette vidéo d'un auteur

Une petite vidéo est collée en bas à droite de chaque page. Elle
**défile avec le scroll** et son **fond vert est détouré** (alpha 0).

- Page d'une fonte : la vidéo de son auteur.
- Accueil, About : la vidéo par défaut, `assets/2face.mp4`.

Pour ajouter un auteur : dépose sa vidéo dans `assets/authorfaces/`,
nommée **prénom + initiale du nom, en majuscules** :

| Auteur | Fichier |
|---|---|
| Enzo Cetera | `ENZOC.mp4` |
| Lucas Pernet | `LUCASP.mp4` |

Puis double-clique `Maj.command`. Il liste les auteurs sans vidéo et
le nom de fichier qu'il attend.

`ENZOCETERA.mp4`, `ENZO.mp4` ou `EC.mp4` sont acceptés aussi.
Formats : `.mp4`, `.webm`, `.mov`.

Conseils de tournage : fond vert franc et uni, sujet détaché du fond.
Le vert exact est relevé automatiquement dans les coins de la première
image, donc n'importe quelle teinte de vert marche — mais évite d'en
porter sur toi.

### La taille de la vignette

Une seule valeur : `--face-w`, dans `assets/css/tokens.css`. Le
disque orange, la zone cliquable et la place de la bulle
« à propos » se calent tous dessus — changer ce nombre suffit, tout
suit.

Attention au format vertical : la valeur des petits écrans est dans
`assets/css/base.css`, sous `@media (max-width: 560px)`. Sur un
téléphone de 375 px de large, la vignette actuelle occupe environ la
moitié de la largeur.

### Ce qui a été retiré

La vignette **ne tourne plus** quand on ne fait rien. Il reste le
balancement (`.bs-face__bob` dans `assets/css/base.css`) et l'entrée
par le bas au premier défilement.

### La zone cliquable

Ce n'est **pas** le carré de la vidéo : celui-ci est transparent
presque partout et avalerait les clics tout autour de la tête. Un
disque est posé à l'endroit exact où la tête a été détourée. Ses
proportions sont **mesurées à l'exécution** par `face-video.js` — il
relève la boîte occupée par la tête sur l'ensemble des images
détourées, et la dépose dans `--tete-x`, `--tete-y`, `--tete-l`,
`--tete-h`. N'importe quelle vidéo marche, sans rien régler. Le
disque orange derrière la tête se cale sur la même mesure.

---

## La bulle « à propos »

Il n'y a plus de page *About*. Cliquer la tête en bas à droite ouvre
une bulle :

- **page d'accueil** : la présentation de la fonderie
- **page d'une fonte** : la présentation de son auteur

Les textes s'écrivent dans `assets/authorfaces/` :

| Fichier | Contenu |
|---|---|
| `bstype.txt` | bulle de la page d'accueil |
| `ENZOC.txt` | bulle des pages de fontes signées Enzo Cetera |
| `LUCASP.txt` | idem pour Lucas Pernet |
| `bstype.en.txt`, `ENZOC.en.txt`, … | les mêmes textes **en anglais** |

Format : du texte normal, une ligne vide sépare deux paragraphes.
Une ligne contenant seulement `---` ouvre le bloc de contacts, centré,
une ligne par contact. Détail dans `assets/authorfaces/LISEZ-MOI.txt`.

Puis double-clique `Maj.command`.

Le titre « thanks 4 using BS.type! » tire une fonte du catalogue au
hasard **pour chaque lettre**, et les fait défiler à l'ouverture avant
de se figer. Rien à régler : il suit le catalogue.

---

## Section « Fonts in use »

Une ligne par fonte **ayant des travaux** dans `fonts/<slug>/inUse/`.
Dossier vide = pas de ligne du tout.

**Survoler** une ligne ouvre une bulle flottante qui suit la souris :
les visuels d'un côté, le texte de l'autre. Elle flotte au-dessus de
la page — la section ne change jamais de hauteur.

**Cliquer** la ligne ouvre le projet. L'adresse se saisit dans
`fonts/<slug>/inUse/manifest.json`, champ `link` :

```json
{
  "text": "Une phrase sur ces travaux.",
  "link": "https://mon-projet.fr",
  "items": [ ... ]
}
```

Ton `link` et tes légendes sont **conservés** à chaque mise à jour.
Sans `link`, cliquer mène à la page de la fonte.

Pour les visuels : dépose-les dans `fonts/<slug>/inUse/` puis
double-clique `Maj.command`.

---

## Le pied de page

Le même sur toutes les pages, construit par `assets/js/footer.js`.

- **le texte** : `assets/js/i18n.js`, clefs `foot.tagline` (la ligne
  orange — le retour à la ligne est écrit dans le texte) et
  `foot.founded` ;
- **la photo** : `assets/pied.png`. Fond transparent, sujet calé en
  bas : elle est posée en bas à droite et déborde du cadre ;
- **les tailles, les couleurs, le débord** : bloc `.bs-pied` dans
  `assets/css/base.css`.

---

## Les modules « media » et le recadrage

Un module recadre toujours son image en *cover* : ce qui dépasse est
coupé. Une affiche verticale posée dans un module panoramique perd
donc la moitié de son cadrage.

`scripts/sync-fonts.js` lit maintenant **la largeur et la hauteur de
chaque fichier** — directement dans son en-tête, sans aucune
bibliothèque — et les écrit dans `fonts/<slug>/media/manifest.json` :

```json
{ "file": "POST3.jpg", "kind": "image", "w": 1081, "h": 1350 }
```

Au montage de la page, chaque média reçoit alors **la largeur de
module dont la forme est la plus proche de la sienne** : une à quatre
colonnes, celle qui coupe le moins. Une affiche verticale va dans un
module étroit, un panoramique dans un module large. Cette largeur-là
n'est pas tirée au sort et n'est pas élargie pour combler une rangée
— c'est un module vide qui s'en charge.

Formats lus : `png`, `jpg`, `gif`, `webp`, `mp4`, `mov`. Un format
inconnu n'a pas de dimensions : le module retombe alors sur une
largeur tirée au sort, comme avant.

---

## Changer une couleur

`assets/css/tokens.css` — une seule variable, elle s'applique partout :
`--color-lime`, `--color-orange`, `--color-bg`, `--color-text`.

---

## Sur téléphone

Ce qui a été mesuré, et corrigé, à 320, 375, 390, 768 et 1440 px.

**Les modules.** L'éditeur passe à **trois réglages par ligne** :
empilés, ils prenaient toute la hauteur du module et il ne restait
rien pour la zone de texte — qui est pourtant ce qu'on vient
essayer. Il gagne aussi de la hauteur (1,7 fois la hauteur de base).
Le jeu de caractères fait l'inverse : **moins haut** (0,85), et son
aperçu prend **la moitié** du module au lieu de 45 %, le glyphe
occupant 82 % de cette moitié au lieu de 62 %.

**Les pastilles de l'accueil** restent **dispersées et dérivantes**
sur téléphone. Les mettre en flux normal les rangeait en colonne, ce
qui n'est plus la page d'accueil du site : `placePills` tient déjà
compte de la largeur et retombe tout seul sur une ou deux colonnes
de cases, en tirant une position au hasard dans chaque case.

**La barre orange** d'une page de fonte tient sur **une seule
ligne** : sur téléphone elle est coupée juste avant le nom de
l'auteur (`.specimen__meta-qui`), plutôt que de passer à deux lignes.

**Les libellés des réglages** tiennent eux aussi sur une ligne — un
libellé qui passe à deux décale sa boîte et les réglages voisins ne
sont plus alignés. « couleur du texte » et « couleur du fond » sont
devenus « texte » et « fond ».

**Les cibles au doigt.** Mesuré à 320 px : le chevron d'un module
faisait 11 × 12 pixels, les liens du haut 20 pixels de haut, la
pastille de couleur 16 de large, les cases de glyphes 28. Apple
comme Google recommandent 44 points. Une zone invisible de 12
pixels est posée autour de chaque bouton — **rien ne bouge à
l'écran** — et les cases de glyphes passent à 40 pixels. Uniquement
sur écran tactile (`pointer: coarse`) : à la souris la précision est
là, et une zone trop large gênerait.

> **`100vh` est un piège sur téléphone** : il vaut la hauteur de
> l'écran *barre d'adresse cachée*. La toile de l'effet était donc
> plus haute que ce qu'on voit, et la photo de la page s'y
> retrouvait étirée et décalée. Les toiles se mesurent maintenant
> **sur leur propre boîte**, jamais sur la fenêtre, et la photo est
> prise exactement à cette taille.

> **Reculer dans un film**, le navigateur d'un téléphone refuse
> parfois : le logo se figeait puis disparaissait d'un coup. Un
> garde surveille que le film recule vraiment ; s'il ne bouge plus
> pendant 400 ms, on abandonne le retour image par image et on
> **fond** — même durée, même effet à l'œil, et ça ne se coince
> jamais.

> **Une zone tactile ne se pose JAMAIS sur un élément qui contient
> un champ natif.** La boîte d'un slider est un `<span>` avec un
> `<input type="range">` dedans : la zone invisible ajoutée pour le
> doigt se posait par-dessus l'input et avalait le geste — les
> curseurs ne bougeaient plus du tout. Elle n'est ajoutée qu'aux
> boutons et à la pastille de couleur, qui n'ont rien dedans.

> **`touch-action: none` sur les sliders.** Sans ça le navigateur
> prend le glissement pour un défilement du panneau de réglages, et
> le curseur ne suit pas le doigt.

> **Un `<input type="range">` ne se photographie pas.** Il est
> dessiné par le navigateur lui-même, et dans l'image SVG il retombe
> sur son dessin par défaut : le curseur ne tombait plus au même
> endroit quand l'effet démarrait. Il est remplacé dans la photo par
> un trait posé à la bonne position, calculée depuis la valeur.

> **Le fond vert de la vignette** n'était pas toujours détouré : la
> couleur du fond est relevée sur la première image décodée, et sur
> téléphone cette image arrive parfois noire. On ne retient plus
> rien tant qu'aucun coin n'est franchement vert — on redemande à
> l'image suivante, jusqu'à trente fois.

---

## Les noms de fichiers des médias

> **Piège à ne plus refaire.** macOS écrit les accents en **deux
> morceaux** (« e » + accent) ; git, les serveurs et les navigateurs
> comparent les **octets**. Un `spécimen.jpg` écrit en deux morceaux
> dans le manifeste demandait donc un fichier qui n'existe pas pour
> le serveur, et le module restait vide alors que le fichier était
> bien là.

Le manifeste écrit maintenant la forme **recomposée**, celle que git
enregistre. Et si un média ne se charge pas, le site retente
automatiquement avec l'autre écriture avant d'abandonner.

`Maj.command` signale les noms fragiles :

```
! nom fragile : hexcd/media/spécimen hex orange.jpg
```

Ça marche, mais des **lettres simples et des tirets** évitent la
question pour de bon.

---

## Le poids du site

Le site entier pèse **17 Mo**. Il en pesait 60. Aucun visuel n'a
changé à la taille où on le voit ; les originaux sont tous rangés
dans `_originaux/`, qui **ne fait pas partie du site** — tu peux le
déplacer ailleurs ou le supprimer quand tu es rassuré.

Ce qui a été fait, et la règle à garder :

- **les vidéos** sont ramenées à **1440 px maximum, 30 images par
  seconde, H.264 (CRF 22)**. Un reel en 4K à 17 Mbit/s pour une
  vignette de 1000 px, c'était 15 Mo pour rien. Et 60 images par
  seconde sur une vidéo qui défile au scroll ne se voit pas ;
- **les affiches** passent en **JPEG, 2000 px maximum**. Le PNG ne
  sert à rien sur une photo : la même image pesait 14 Mo en PNG et
  840 Ko en JPEG de qualité 90 ;
- **tout est en H.264**, plus rien en HEVC. Safari lit le HEVC,
  Chrome seulement là où la machine sait le décoder, Firefox pas du
  tout : c'était une vidéo invisible pour une partie des visiteurs.

Si tu déposes un nouveau média, la commande qui va bien :

```bash
ffmpeg -i source.mov -vf "scale='min(1440,iw)':-2" -r 30 -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart -an sortie.mp4
```

> Deux choses **volontairement laissées** telles quelles :
> `assets/vendor/p5.min.js` (1,0 Mo, chargé sur chaque page — on
> n'en utilise qu'une poignée de fonctions, mais c'est p5 qui a été
> demandé) et `assets/pied.png` (1,0 Mo — il lui faut sa
> transparence, et il est déjà compressé au maximum de ce que le PNG
> sait faire).

---

## Pas de trou dans la grille

La disposition est calculée pour **quatre colonnes**. Sur un écran
plus étroit la grille en compte deux, ou une seule — et une rangée
« 1 + 2 + 1 » ne pave alors plus : le module de trop passait à la
ligne et laissait un trou derrière lui. C'était la cause des trous et
de la page qui s'allongeait.

`ajusterGrille()`, dans `assets/js/render-grid.js`, refait donc le
calcul avec le nombre **réel** de colonnes : même ordre, largeurs
réajustées, chaque rangée remplie exactement. Rejoué à l'affichage et
à chaque changement de taille de fenêtre.

> Piège à ne pas refaire : un module plus large que la grille lui
> fait fabriquer des colonnes en plus, de quelques pixels. On compte
> donc les colonnes **après** avoir remis tout le monde à une seule —
> sinon on relit sa propre erreur de la fois d'avant.

Vérifié à 820 px de large : deux colonnes, six rangées, toutes
pleines, aucun module vide nécessaire.

### La hauteur des rangées

Toutes les cases d'une rangée font la **même** hauteur : c'est ce qui
empêche les trous. Mais les rangées, elles, n'ont pas toutes la même.
La hauteur d'une rangée est la plus grande des envies :

- un module **media** veut la hauteur qui **respecte la forme de son
  fichier** — c'est ce qui lui permet d'être montré dans n'importe
  quelles dimensions, et surtout en grand ;
- les autres modules veulent une hauteur **tirée au sort** parmi
  `HAUTEURS` (0,72 à 1,4 fois `--zone-h`), gardée pour la vie de la
  page ;
- le module de téléchargement ne demande rien : il s'étire jusqu'au
  bas de sa rangée.

Le tout est borné entre 0,5 et 2,4 fois `--zone-h` : un panorama très
allongé ne fait pas une rangée interminable, ni une bande illisible.
Ces bornes sont en haut de `assets/js/render-grid.js`.

---

## Changer la disposition d'une page de fonte

Dans `assets/js/fonts-data.js`, le tableau `gridLayout` de la fonte.
Une entrée = une zone, dans l'ordre. `span` = largeur en colonnes (1 à 4).

```js
gridLayout: [
  { type: "editor",       span: 2, content: {} },
  { type: "characterset", span: 2, content: {} },
  { type: "info",         span: 2, content: {} },
  { type: "media",        span: 2, content: {} }
]
```

Types : `characterset` · `media` · `info` · `editor` · `blank`.
Contraintes : `info` max 2 colonnes, `editor` et `characterset` min 2.

Le `V` en haut de chaque zone permet aussi de changer son type en
direct dans le navigateur — mais ce n'est pas sauvegardé, un
rechargement revient à ce qui est écrit ici.

---

## L'écran de chargement

**Deux écrans, un par type de page.**

| Page | Ce qu'on voit |
|---|---|
| **accueil** | le logo entier — la dernière image de `BSGLITCH.mp4`, **figée** — sur fond noir |
| **page d'une fonte** | la vignette `assets/2face.mp4`, en boucle, qui **pivote** lentement, son fond vert détouré |

Dans les deux cas l'écran reste tant que la page n'est pas *vraiment*
prête : fichiers chargés, fontes installées, grille des modules
composée. Il apparaît à **chaque** chargement de sa page.

Pendant ce temps :

- le **défilement et les clics sont bloqués** (classe `bs-charge` sur
  `<html>`, plus un garde qui avale wheel, touchmove, click,
  mousedown et keydown) ;
- **le compte à rebours du dérèglement ne part pas** : `endormir()`
  refuse tant que `BSBoot.pret` est faux, et c'est `boot.js` qui
  relance le compte une fois le chargement fini.

**À la fin.** Sur une page de fonte, l'écran s'efface, sans plus. Sur
l'accueil, `glitch-logo.js` prend la suite : le film repart **en
arrière** depuis cette dernière image, et le noir s'efface au même
rythme.

| Réglage (`boot.js`) | Ce qu'il fait |
|---|---|
| `MINIMUM` | temps d'affichage minimum de l'écran noir (0,9 s) |
| `MAXIMUM` | au-delà, on ouvre même si quelque chose traîne (9 s) |
| `TOUR` | durée d'un tour de la vignette (5,2 s) |
| `TAILLE` | côté de la vignette, en pixels |

`window.BS_NO_BOOT = true` avant le script le désactive.

> Piège à ne pas refaire : l'accueil ne se reconnaît **pas** à son
> chemin. `/fonts/baton/` finit par une barre, comme la racine, et
> passait pour l'accueil — les pages de fonte montraient donc le
> logo. On compare maintenant l'adresse de la page à la racine du
> site, déduite de l'URL du script lui-même.

> Sur le **« la page se recharge toute seule »** : il n'y a jamais eu
> de rechargement. La seule ligne du site qui en déclenche un est le
> bouton FR/EN. Ce qu'on voyait était la page **en train de se
> composer** — l'écran de chargement le cache maintenant partout.

---

## L'effet de dérèglement

Après quelques secondes sans un geste, la page est photographiée
puis travaillée image après image — **sans jamais être redessinée**.
Chaque passe abîme le résultat de la précédente : c'est ce qui fait
que ça finit en belle bouillie au lieu de clignoter.

Deux gestes mélangés :

1. **Le barbouillage.** On prélève un petit carré de l'image et on
   le repose un peu à côté. Des centaines de fois par image. Le
   décalage est donné par un bruit de Perlin **étiré** : fin dans un
   sens, large dans l'autre, ce qui produit des coulures franchement
   horizontales ou franchement verticales, jamais un grain uniforme.

2. **Le rangement des pixels** (*pixel sort*). Des suites de pixels
   sont rangées par luminosité, teinte, saturation, rouge, vert,
   bleu — ou simplement retournées. Il avance **progressivement** :
   une tranche par image, et des suites **qui s'allongent toutes
   seules** tant qu'on ne touche à rien. Au bout d'une quinzaine de
   secondes les suites traversent l'écran entier et la page n'est
   plus qu'un rideau de coulures. Rien ne se fige d'un coup.

**L'ombre.** Un voile noir **uni**, plein écran, se dépose pendant
que la bouillie s'installe : rien au premier instant, **15 % de noir
au bout de quinze secondes**. Deux constantes dans `idle-glitch.js` :
`OMBRE_MONTEE` (15 s) et `OMBRE_FORCE` (0,15).

Le compte part du moment où l'effet est **lancé**, pas des images
dessinées : photographier la page prend un instant, et le compte
serait faussé d'autant.

**Le logo arrive après.** Il ne démarre pas avec la bouillie mais
**cinq secondes plus tard** (`ATTENTE_LOGO`) : le dérèglement
s'installe d'abord, le logo se construit ensuite. Si on reprend la
main avant, il ne surgit pas après coup.

Le **dosage entre les deux** est tiré au sort lui aussi. Certains
chargements donnent surtout de la bouillie ; d'autres presque
uniquement du rangement — la page reste alors lisible longtemps,
traversée de longues colonnes triées. Un gros rangement veut peu de
barbouillage, sinon il est effacé au fur et à mesure : le tirage en
tient compte.

Les tranches rangées ne sont **pas** prises dans l'ordre. Prendre
les lignes 0, 1, 2, 3… ferait descendre une ligne bien nette en
travers de l'écran, comme le rafraîchissement d'un minitel. Un
**ordre mélangé** est tiré à chaque tour : chaque ligne (ou colonne)
y passe une fois et une seule, mais jamais dans l'ordre. Le
rangement se dépose donc comme du bruit, pas comme un balayage.

Les dégâts visent en priorité les endroits **contrastés** de la
page : sur une page de fonte, presque noire, barbouiller du noir sur
du noir ne montrerait rien. Une carte des contrastes est relevée une
fois par photo, et trois prélèvements sur quatre y sont dirigés — le
quatrième va n'importe où, pour que toute la page y passe.

### Tout est tiré au sort, puis retouché à chaque arrêt

Le même effet, jamais deux fois pareil. **Une seule table donne les
bornes** de chaque réglage : `BORNES`, en haut de
`assets/js/idle-glitch.js`. Au chargement de la page on tire un
nombre au hasard dans chaque borne.

Et **à chaque fois que l'effet s'arrête**, on ne retire pas tout :
on *retouche* ce qu'on avait, dans les mêmes bornes
(`retoucherReglages()`). On reste donc dans la même famille d'effet
sans jamais répéter la fois d'avant.

Surtout, **la retouche grandit d'un arrêt à l'autre** : le deuxième
bouge plus fort que le premier, le troisième plus fort encore. Plus
on reste sur la page, plus l'effet s'éloigne de son tirage de
départ. Trois constantes règlent ça :

| Constante | Ce qu'elle fait |
|---|---|
| `RETOUCHE` | pas du **premier** arrêt (0,14 de l'étendue) |
| `RETOUCHE_CROISSANCE` | de combien le pas grandit à chaque arrêt (0,35) |
| `RETOUCHE_MAX` | plafond du pas (0,9 de l'étendue) |
| `CHANGE_UN_CHOIX` | une chance sur 4 de changer aussi un choix au premier arrêt — cette chance grandit au même rythme |

Mesuré : premier arrêt, les valeurs bougent de 18 % de leur étendue ;
au septième, de 38 %. Le compteur repart à zéro au chargement de la
page.

Les réglages :

| Réglage | Ce qu'il change |
|---|---|
| `taille` | côté du carré prélevé (10 à 34 px) |
| `nombre` | prélèvements par image (70 à 240) |
| `pas` | amplitude du décalage (4 à 26 px) |
| `sens` | `H` ou `V` : sens d'étirement du bruit |
| `bruitX` / `bruitY` | dimensions du bruit — l'une fine, l'autre large |
| `vitesse` | dérive du bruit dans le temps |
| `biais` | part du décalage qui suit le sens d'étirement |
| `triPar` | `BR` luminosité, `H` teinte, `S` saturation, `R`/`G`/`B`, `F` retourner |
| `triSens` | `V` colonnes, `H` lignes, `W` marcheur |
| `triMin` / `triMax` | longueur de départ des suites rangées |
| `triCroissance` | vitesse à laquelle les suites s'allongent (0,6 à 3,2) |
| `melange` | dosage : 0 = que de la bouillie, 1 = que du rangement |
| `triPondere` | `N` pas pondéré, `F` pour, `A` contre |
| `triInverse` | range à l'envers |
| `triParImage` | tranches rangées par image |

Constantes générales au-dessus : `ATTENTE` (4 s d'inactivité),
`MONTEE` (9 s pour arriver au maximum), `FONDU` (4 s de fondu entre
la page vivante et l'effet), `SORTIE` (0,16 s pour revenir au
direct), `CADENCE` (24 images/s), `ECHELLE` (0.7).

L'entrée et la sortie ne sont **pas** symétriques, et c'est voulu :
l'effet s'installe en quatre secondes, sans coupure visible entre la
page et sa photo, mais il disparaît en un sixième de seconde au
premier geste — attendre casserait l'effet.

Dans la console du navigateur :

```js
BSGlitch.montre(1)    // fige l'effet à fond, le temps de le regarder
BSGlitch.montre(0)    // rend la main
BSGlitch.retirer()    // un nouveau jeu de réglages, sans recharger
BSGlitch.retoucher()  // la même retouche qu'à chaque arrêt
BSGlitch.reglages     // voir le tirage en cours
```

### Le logo par-dessus le dérèglement

Pendant que la page part en bouillie, la vidéo
`assets/logoMedia/BSGLITCH.mp4` est jouée **au-dessus**, sur sa
propre toile (`assets/js/glitch-logo.js`). Elle n'est donc **pas**
abîmée par l'effet : le dérèglement continue derrière elle, le logo
reste net.

Le déroulement :

- le film part d'un écran vide et fait apparaître le logo point par
  point — il sert donc aussi de fondu d'entrée ;
- arrivé à la dernière image, il **se fige** tant qu'on ne fait
  rien ;
- au premier geste, il repart **en arrière** depuis l'image où il en
  était, quatre fois plus vite, et la toile est retirée une fois
  revenu au début.

Le film est joué **à sa vraie définition, 1280 × 1280**. Rien n'est
gardé en mémoire.

Il est dessiné **20 fois par seconde** (`CADENCE`) alors que le
fichier en contient 30 : on saute donc une image sur trois. C'est un
tiers de travail en moins pour la machine, dans les deux sens et à
l'ouverture comme au réveil, sans que le mouvement en souffre — le
film est une montée de points, pas un panoramique.

Au réveil, le film **saute aux trois quarts** et repart en arrière de
là, quatre fois plus vite — quel que soit l'endroit où il en était.
Le retour dure donc toujours la même chose : mesuré à **2,25 s**.

**Le film n'est plus qu'un pochoir.** On ne garde de lui que sa
forme, remplie d'un aplat — le vert acide de la charte (`COULEUR`).
Ça ne coûte rien : c'est une opération de moins par pixel que de
recopier la couleur du film. Mettre `COULEUR` à `null` lui rend ses
propres couleurs.

> **Pourquoi rien n'est gardé en mémoire.** Première version : on
> détourait tout le film au chargement et on gardait les images,
> comme la vignette des têtes. Ça ne tient pas ici : 359 images de
> 1280 × 1280 en quatre octets font **2,3 Go**. Pour rentrer dans
> une mémoire raisonnable il fallait descendre à 295 × 295 et à 8
> images par seconde — d'où le logo grossier, et d'où **le noir
> qu'on voyait encore** : réduire une image mélange chaque point
> avec le noir autour, et ce gris-là passait au travers du
> détourage. La version actuelle ne garde rien : le navigateur joue
> le film normalement, et chaque image est détourée **au vol par la
> carte graphique** (WebGL, une quinzaine de lignes en haut du
> fichier).

**Le détourage.** On ne garde que les pixels verts. Un pixel est
gardé s'il est assez clair (`LUMIERE_MIN`) **et** si son vert dépasse
son rouge et son bleu d'au moins `MARGE_VERT`. Le test est **franc**,
sans bord adouci : gardé ou jeté, jamais entre les deux. Aucun voile
gris possible. Les valeurs viennent d'une mesure faite sur le
fichier : les points du logo ont un écart de vert de 5 à 40 sur 255
(98 % au-dessus de 5) et le fond est noir pur.

Le film est carré et l'écran ne l'est pas : il est **agrandi jusqu'à
couvrir le plus grand côté**, et les bords qui dépassent sont
coupés. Jamais de déformation.

Les réglages sont en haut de `assets/js/glitch-logo.js` :

| Réglage | Ce qu'il fait |
|---|---|
| `CADENCE` | images dessinées par seconde (20) |
| `RETOUR` | vitesse du rembobinage (4 = quatre fois plus vite) |
| `DEPART_RETOUR` | où le retour commence (0,75 = aux trois quarts) |
| `COULEUR` | aplat qui remplit le pochoir (`null` = couleurs du film) |
| `INTRO` | vitesse de l'ouverture du site (3) |
| `LUMIERE_MIN` | en dessous, le pixel est jeté (100 sur 255) |
| `MARGE_VERT` | de combien le vert doit dépasser le rouge et le bleu (6 sur 255) |
| `PIXELS_MAX` | taille maximum de la toile, pour les très grands écrans |

Le film n'est téléchargé qu'**après** le chargement de la page : il
pèse 4 Mo, il ne doit pas se mettre en travers du site.

> ⚠️ **Le fichier actuel est encodé en HEVC.** Safari le lit, Chrome
> seulement là où la machine sait le décoder, Firefox souvent pas du
> tout. Pour un site fait pour durer, mieux vaut du H.264, lu
> partout depuis quinze ans :
>
> ```
> ffmpeg -i BSGLITCH.mp4 -c:v libx264 -pix_fmt yuv420p -crf 20 -g 4 -an BSGLITCH-h264.mp4
> ```
>
> Le `-g 4` garde une image clé toutes les quatre images : c'est ce
> qui rend le rembobinage fluide.

Si tu remplaces le film : garde-le **carré**, sur **fond noir**, avec
un sujet **vert**. Rien d'autre à régler.

Dans la console :

```js
BSLogoGlitch.montre(11.5)  // fige le film à la 11,5ᵉ seconde
BSLogoGlitch.montre()      // rend la main
BSLogoGlitch.etat          // définition, durée, seconde, toile
```

D'où ça vient : deux sketches p5 de l'auteur du site — le
barbouillage cumulatif au `get()`/`image()`, et un *pixel sorter*
complet (tri par luminosité/teinte/saturation, sens et pondération
réglables). Les deux sont ici fondus en un seul, rendus progressifs,
et branchés sur la photo de la page.

**p5 ne sait pas photographier la page** — aucun navigateur ne le
sait. C'est `page-snapshot.js` qui s'en charge, en redessinant la
page dans une image SVG (la méthode de `html2canvas`). p5 ne
travaille que sur cette photo.

### Quatre pièges de la photographie de page

Déjà traités dans `page-snapshot.js`, à ne pas défaire :

- **les commentaires HTML** : un simple `--` dans un commentaire
  fait échouer la lecture de toute l'image (elle est lue en XML
  strict). Ils sont retirés de la copie.
- **les vidéos, les canvas et les images** ne se chargent pas dans
  une image SVG : ils sont remplacés par leur contenu du moment,
  écrit en dur, **en gardant leur classe** — sans elle la mise en
  page part en vrille. Et **en gardant leurs proportions
  d'origine** : les redimensionner vers leur boîte d'affichage les
  écrasait, puisque le recadrage `object-fit: cover` est déjà fait
  par la feuille de style.
- **l'adresse `data:` est obligatoire** : une image SVG chargée
  depuis un lien `blob:` salit le canvas, et on ne peut plus relire
  les pixels — donc plus d'effet du tout.
- **une image à fond transparent doit le rester** : le JPEG ne
  connaît pas la transparence, et le vide y devenait **noir** — la
  photo du pied de page se retrouvait dans un carré noir au milieu
  du fond clair dès que le dérèglement démarrait. L'image est
  maintenant sondée : dès qu'il y a du vide, elle est gardée en PNG.
- **le chemin d'une fonte est relatif à sa feuille de style**, pas à
  la page. `url("../fonts/X.otf")` écrit dans
  `assets/css/fonts.css` ne veut pas dire la même chose vu depuis
  `/` ou depuis `/fonts/jalleau/`. En le résolvant depuis la page on
  tombait à côté, la fonte était jetée de la photo, et le texte
  repartait sur la police du système : **c'est ce qui faisait
  « changer de fonte » quand l'effet démarrait**. Sur une machine où
  les fontes du catalogue sont installées, le repli tombait même sur
  une vraie fonte du même nom — d'où le bug difficile à voir, où
  seules *certaines* fontes changeaient d'allure.

Ce qu'on ne peut pas capturer : les images venant d'un autre site.
Le navigateur l'interdit, elles sont retirées de la photo.

---

## Fluidité

Ce qui coûtait cher et a été borné — à garder en tête si tu ajoutes
des animations :

- **La vignette vidéo** détourait son fond vert en direct, image par
  image. Elle le fait maintenant **une seule fois, au chargement** :
  elle parcourt la vidéo, détoure 40 images et les garde en mémoire.
  Ensuite, afficher une image ne coûte plus qu'un `drawImage`.
  Mesuré : **0,003 ms** par image affichée, contre 0,85 à 2,13 ms
  avant. Coût mémoire : environ 6 Mo. Les constantes `NB_IMAGES` et
  `TAILLE_MAX` sont en haut de `assets/js/face-video.js`.
- **La vidéo du logo** du dérèglement fait l'inverse : elle ne garde
  **rien** en mémoire. Le navigateur la joue normalement et la carte
  graphique détoure chaque image au vol. Coût mémoire : zéro. Coût
  processeur : un envoi de texture par image de film.
- **Les vidéos en boucle** ne s'arrêtaient pas au bon moment : le
  seuil de visibilité était à 0,35, donc une vidéo se figeait dès
  qu'il en restait moins d'un tiers à l'écran — et ça se voyait.
  Seuil à 0 et marge de 200 px : elle ne s'arrête que lorsqu'elle est
  vraiment sortie.
- **La vignette du bas de page a de l'inertie.** Elle ne colle plus
  au défilement : elle le suit avec un peu de retard et d'élan, et
  quand on s'arrête net elle continue un instant puis revient se
  poser. Deux constantes en haut de `assets/js/face-video.js` :
  `RAIDEUR` (attirance vers la position réelle) et `AMORTI`
  (freinage). Mesuré : un dépassement de 29 %, puis retour au calme
  en une demi-seconde. `RAIDEUR: 1` et `AMORTI: 0` la recollent au
  défilement.
- **Le défilement s'arrête net en haut et en bas** :
  `overscroll-behavior: none` sur `html` et `body`. Plus de rebond,
  plus de page qui continue de glisser au-delà de son contenu.
- **Les vidéos des modules `media`** en mode `scrub` demandaient une
  nouvelle image à chaque pixel de défilement. Elles ignorent
  maintenant les écarts de moins d'1/30 de seconde et ne travaillent
  plus quand le module est hors écran.
- **Le barbouillage de l'effet de dérèglement** recopiait la toile
  sur elle-même, un `drawImage` par carré. Chaque copie obligeait la
  carte graphique à rendre la main : **0,2 ms pièce, soit 18,7 ms
  pour 83 carrés** — à elle seule, presque toute l'image. Les carrés
  sont maintenant déplacés **dans le tableau de pixels**, en même
  temps que le rangement, avec **une seule lecture et une seule
  écriture de pixels par image**. Mesuré sur la même page, même
  toile de 1008 × 630 : **19,5 ms → 5,9 ms**, pour un budget de
  42 ms. C'est le correctif à ne pas défaire.
- **La toile de l'effet** est plafonnée à `PIXELS_MAX` (1,6 million
  de pixels). Au-delà — écran 4K ou 5K — elle devient simplement
  plus grossière. L'effet est déjà pixelisé, ça ne se voit pas.
- **L'effet de dérèglement** ne tourne QUE pendant l'inactivité, à
  24 images par seconde, et **jamais quand l'onglet est caché**. La
  photo coûte 18 à 40 ms, une seule fois par mise en veille.
- Si ça rame, **le chiffre à regarder** est `BSGlitch.mesure` dans la
  console : il donne le coût médian d'une image, le pire, la taille
  de la toile et le budget.
- **La grille d'une page de fonte** n'apparaît qu'une fois les
  fontes chargées. Avant, elle s'affichait avec la police de secours
  puis se recomposait : ce deuxième passage donnait l'impression que
  la page se rechargeait toute seule.

Règle générale : tout ce qui tourne en continu doit s'arrêter quand
ce n'est pas visible.

---

## Fichiers à ne pas éditer à la main

`assets/css/fonts.css`, `assets/js/faces-data.js`,
`assets/js/inuse-data.js` et les `fonts/*/media/manifest.json` sont
**régénérés** par le script. Toute modification manuelle sera écrasée.

`assets/js/i18n.js` (les textes FR/EN), `assets/js/samples.js` (les
textes d'essai) et `assets/js/fonts-data.js`, eux, sont faits pour
être édités à la main.

En revanche les `fonts/*/inUse/manifest.json` **conservent** les
textes que tu y écris.

---

## Ce qui bouge tout seul

- **Page d'accueil** : la page s'ouvre sur **3 fontes**, tirées au
  sort à chaque chargement, puis un module **voir tout** qui déplie
  le catalogue entier, en animation, l'un après l'autre. Un bouton
  **fermer** en haut et en bas du paquet revient à trois. Pour
  changer ce nombre : constante `VISIBLE` en haut de
  `assets/js/render-home.js`.
  Les pastilles sont placées au hasard sans jamais se chevaucher,
  chacune sur un halo noir en dégradé, et dérivent lentement.
- **Page d'une fonte** : disposition des zones tirée au sort à chaque
  chargement, couleurs de l'éditeur aussi. Le bouton **random** de
  l'éditeur rejoue tout d'un coup (couleurs, graisse, corps,
  interligne, interlettrage, alignement).
- **Module éditeur de l'accueil** : une colonne de boutons est collée
  au bord gauche — la poignée du tiroir (des flèches sur toute sa
  hauteur), puis **voir** et **hasard**, libellés à la verticale.
  Ouvrir le tiroir **décale** l'aperçu vers la droite, il n'est
  jamais recouvert. Tous les réglages restent visibles en même temps.
- **Graisse de départ** : la plus proche d'un *Regular* (poids le
  plus près de 400, romain avant italique), jamais la plus maigre.
- **Corps de départ** : calculé pour qu'un texte de moins de 10 mots
  remplisse la largeur. Dès que tu touches le curseur **corps**, le
  calcul s'arrête : ton réglage n'est plus jamais écrasé.
- **Justification** : un seul bouton, une seule zone cliquable.
  Chaque clic passe à la justification suivante — gauche, centre,
  droite, et on recommence. La position du pavé orange dit
  l'alignement.
- **Jeu de caractères** : le point de code du caractère choisi
  (`U+0041`) s'affiche en haut de l'aperçu.
- **Couleurs de l'éditeur** : au chargement, celles de la charte —
  fond noir, texte gris clair (`assets/css/tokens.css`). Aucun
  tirage au sort. Seul le bouton **hasard** change les couleurs.
- **Hauteur des modules** : imposée. Ni le texte tapé, ni le corps
  de la fonte, ni la grille de glyphes ne peuvent faire grandir un
  module : ce qui dépasse **défile à l'intérieur**.
- **Choix de la graisse** : le même menu partout — dans l'éditeur, et
  à droite du bouton *métriques* du module `characterset`. Quand la
  fonte a plusieurs variantes, le premier menu liste les variantes
  (vert) et chacune ouvre le sous-menu de ses styles (orange). Les
  graisses sont rangées le long de l'axe d'épaisseur, de la plus
  maigre à la plus grasse, et chaque nom s'affiche **dans sa propre
  graisse**. Le sous-menu s'ouvre sous la souris, par-dessus le menu
  parent : aucun déplacement à faire pour l'atteindre.
- **Vignette vidéo** : monte du hors-champ en pivotant dès qu'on
  défile, suit le scroll, et se met à tourner au bout de 4 s
  d'inactivité (elle s'arrête au moindre geste).

Pour figer la disposition d'une fonte : `shuffleLayout: false` dans
son bloc de `fonts-data.js`.
