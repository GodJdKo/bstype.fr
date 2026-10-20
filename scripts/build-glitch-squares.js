#!/usr/bin/env node
/* ============================================================
   BUILD-GLITCH-SQUARES.JS — LE FILM DU LOGO, EN CARRÉS
   ------------------------------------------------------------
   Lit _originaux/assets/logoMedia/BSGLITCH.mp4 et en tire, image par image, la
   liste des carrés (x, y, cote) qui forment le logo.
   Résultat : assets/logoMedia/BSGLITCH.squares.bin (gzip).

   C'est ce fichier-là, et non plus le film, que lit
   assets/js/glitch-logo.js : il est dessiné en canvas, net à
   n'importe quelle taille, et le navigateur n'a plus de film à
   décoder.

   LE POCHOIR est celui de l'ancien shader, mot pour mot :
     un pixel est gardé s'il est assez clair (LUMIERE_MIN) ET si son
     vert dépasse son rouge et son bleu d'au moins MARGE_VERT.

   Format (après gunzip, petit-boutiste) :
     u16  nombre d'images
     par image :
       u16 n                 nombre de carrés
       n x u8  dy (octet bas)   n x u8 dy (octet haut)
       n x u8  dx (octet bas)   n x u8 dx (octet haut)
       n x u8  côté du carré
     Les carrés sont triés par (y, x). dy = y - y précédent ; dx = x -
     x précédent sur la même ligne, ou x tout court quand dy > 0.

   Usage : node scripts/build-glitch-squares.js
   Nécessite ffmpeg dans le PATH.
   ============================================================ */

"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { spawn } = require("child_process");

const RACINE = path.join(__dirname, "..");
/* On part de l'ORIGINAL (HEVC, net), pas de la version recompressée du site
   (H.264 crf 42, bords baveux). */
const ENTREE = path.join(RACINE, "_originaux/assets/logoMedia/BSGLITCH.mp4");
const SORTIE = path.join(RACINE, "assets/logoMedia/BSGLITCH.squares.bin");

/* — les mêmes réglages que l'ancien shader — */
const LUMIERE_MIN = 100;   /* sur 255 */
const MARGE_VERT = 6;      /* sur 255 */
/* En dessous de ce taux de remplissage, la tache n'est pas un
   rectangle plein : on la découpe en bandes d'un pixel de haut. */
const ALLONGEMENT = 1.4;   /* rapport longueur/largeur au-dela duquel une tache = plusieurs carres colles : on la decoupe */

function sonder() {
  return new Promise((ok, ko) => {
    const p = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", ENTREE]);
    let s = "";
    p.stdout.on("data", (d) => (s += d));
    p.on("error", ko);
    p.on("close", () => {
      const m = /(\d+)x(\d+)/.exec(s);
      m ? ok([+m[1], +m[2]]) : ko(new Error("ffprobe n'a rien rendu"));
    });
  });
}

/* Le film est compressé : les bords d'un carré sont un peu flous et
   bavent en couleur (sous-échantillonnage du chroma). Tester le
   pochoir pixel par pixel donnerait des carrés mangés, aux bords
   en dents de scie. On repère donc d'abord les taches (tout ce qui
   n'est pas noir), puis on applique le pochoir à la COULEUR DU CŒUR
   de chaque tache : elle est gardée ou jetée en entier, et elle est
   redessinée comme un carré net. */
let taches;                /* pixels de la tache en cours */
const SEUIL_TACHE = 40;     /* sur 255 : en dessous, c'est le fond */
const COEUR = 0.8;           /* part de la valeur max qui compte comme cœur */

function carres(rgb, L, H, masque, etiquette, pile) {
  masque.fill(0);
  etiquette.fill(0);
  for (let i = 0, j = 0; i < L * H; i++, j += 3) {
    const r = rgb[j], g = rgb[j + 1], b = rgb[j + 2];
    if (r > SEUIL_TACHE || g > SEUIL_TACHE || b > SEUIL_TACHE) masque[i] = 1;
  }
  const liste = [];
  let id = 0;
  for (let y0 = 0; y0 < H; y0++) {
    for (let x0 = 0; x0 < L; x0++) {
      const d = y0 * L + x0;
      if (!masque[d] || etiquette[d]) continue;
      id++;
      let sp = 0, n = 0;
      let x1 = x0, x2 = x0, y1 = y0, y2 = y0;
      pile[sp++] = d;
      etiquette[d] = id;
      while (sp) {
        const p = pile[--sp];
        const py = (p / L) | 0, px = p - py * L;
        taches[n] = p;
        n++;
        if (px < x1) x1 = px; if (px > x2) x2 = px;
        if (py < y1) y1 = py; if (py > y2) y2 = py;
        for (let dy = -1; dy <= 1; dy++) {
          const qy = py + dy;
          if (qy < 0 || qy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const qx = px + dx;
            if (qx < 0 || qx >= L) continue;
            const q = qy * L + qx;
            if (masque[q] && !etiquette[q]) { etiquette[q] = id; pile[sp++] = q; }
          }
        }
      }
      /* le pochoir, sur la couleur du cœur de la tache */
      let vmax = 0;
      for (let k = 0; k < n; k++) {
        const j = taches[k] * 3;
        const v = Math.max(rgb[j], rgb[j + 1], rgb[j + 2]);
        if (v > vmax) vmax = v;
      }
      let sr = 0, sg = 0, sb = 0, sn = 0;
      for (let k = 0; k < n; k++) {
        const j = taches[k] * 3;
        if (Math.max(rgb[j], rgb[j + 1], rgb[j + 2]) >= COEUR * vmax) {
          sr += rgb[j]; sg += rgb[j + 1]; sb += rgb[j + 2]; sn++;
        }
      }
      sr /= sn; sg /= sn; sb /= sn;
      const lum = 0.299 * sr + 0.587 * sg + 0.114 * sb;
      if (lum < LUMIERE_MIN || sg - Math.max(sr, sb) < MARGE_VERT) continue;

      /* TOUJOURS DES CARRÉS. La tache a un boîte w x h qui n'est pas
         toujours carrée (un pixel de flou de plus d'un côté) :
         on garde son centre et on prend le côté moyen. Une tache
         nettement plus longue que large (deux carrés collés) est
         découpée en carrés égaux, côte à côte. */
      const w = x2 - x1 + 1, h = y2 - y1 + 1;
      const court = Math.min(w, h), long_ = Math.max(w, h);
      const k = long_ / court > ALLONGEMENT ? Math.min(40, Math.round(long_ / court)) : 1;
      const c = k === 1 ? Math.round((w + h) / 2) : Math.round(long_ / k);
      const cote = Math.max(1, Math.min(255, c));
      for (let m = 0; m < k; m++) {
        let cx, cy;
        if (k === 1) { cx = x1 + w / 2; cy = y1 + h / 2; }
        else if (w >= h) { cx = x1 + (m + 0.5) * w / k; cy = y1 + h / 2; }
        else { cx = x1 + w / 2; cy = y1 + (m + 0.5) * h / k; }
        liste.push([
          Math.max(0, Math.round(cx - cote / 2)),
          Math.max(0, Math.round(cy - cote / 2)),
          cote
        ]);
      }
    }
  }
  liste.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return liste;
}

function coder(liste) {
  const n = liste.length;
  const t = Buffer.alloc(2 + n * 5);
  t.writeUInt16LE(n, 0);
  let py = 0, px = 0;
  for (let i = 0; i < n; i++) {
    const [x, y, c] = liste[i];
    const dy = y - py;
    const dx = dy === 0 ? x - px : x;
    t[2 + i] = dy & 255;
    t[2 + n + i] = dy >> 8;
    t[2 + 2 * n + i] = dx & 255;
    t[2 + 3 * n + i] = dx >> 8;
    t[2 + 4 * n + i] = c;
    py = y; px = x;
  }
  return t;
}

(async () => {
  if (!fs.existsSync(ENTREE)) { console.error("Introuvable : " + ENTREE); process.exit(1); }
  const [L, H] = await sonder();
  const taille = L * H * 3;
  console.log("film : " + L + " x " + H);

  const masque = new Uint8Array(L * H);
  const etiquette = new Int32Array(L * H);
  const pile = new Int32Array(L * H);
  taches = new Int32Array(L * H);
  const images = [];
  let total = 0;

  const ff = spawn("ffmpeg", ["-v", "error", "-i", ENTREE, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { stdio: ["ignore", "pipe", "inherit"] });
  let reste = [];
  let enAttente = 0;
  const traiter = (rgb) => {
    const liste = carres(rgb, L, H, masque, etiquette, pile);
    images.push(coder(liste));
    total += liste.length;
    if (images.length % 50 === 0) console.log("  " + images.length + " images");
  };
  for await (const morceau of ff.stdout) {
    reste.push(morceau);
    enAttente += morceau.length;
    if (enAttente >= taille) {
      let tout = Buffer.concat(reste);
      let o = 0;
      while (tout.length - o >= taille) { traiter(tout.subarray(o, o + taille)); o += taille; }
      tout = tout.subarray(o);
      reste = tout.length ? [Buffer.from(tout)] : [];
      enAttente = tout.length;
    }
  }

  const tete = Buffer.alloc(2);
  tete.writeUInt16LE(images.length, 0);
  const brut = Buffer.concat([tete, ...images]);
  const gz = zlib.gzipSync(brut, { level: 9 });
  fs.writeFileSync(SORTIE, gz);
  console.log(images.length + " images, " + total + " carrés, "
    + (brut.length / 1024).toFixed(0) + " Ko bruts -> " + (gz.length / 1024).toFixed(0) + " Ko gzip");
  console.log("écrit : " + path.relative(RACINE, SORTIE));
})().catch((e) => { console.error(e); process.exit(1); });
