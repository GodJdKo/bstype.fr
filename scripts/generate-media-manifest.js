#!/usr/bin/env node
/* ============================================================
   GENERATE-MEDIA-MANIFEST.JS
   ------------------------------------------------------------
   Le site est 100% statique : le navigateur ne peut pas lister
   un dossier. Ce script scanne fonts/<slug>/media/ et écrit
   fonts/<slug>/media/manifest.json — lu par render-grid.js.

   À relancer à chaque ajout/retrait de fichier média :
     node scripts/generate-media-manifest.js

   Formats : jpg jpeg png webp svg (image), gif (gif),
             mp4 webm mov (video). Le reste est ignoré.

   MODE DE LECTURE DES VIDÉOS
   -------------------------
   Optionnel : un fichier fonts/<slug>/media/playback.txt, une
   ligne par vidéo :
       ma-video.mp4 = scrub
       autre.mp4    = loop
   Modes : scrub (défaut, la vidéo suit le scroll) | loop |
           once | static. Le mode part dans manifest.json
           (champ "playback"), c'est tout ce que le site lit.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FONTS_DIR = path.join(ROOT, "fonts");

const KIND_BY_EXT = {
  ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image", ".svg": "image",
  ".gif": "gif",
  ".mp4": "video", ".webm": "video", ".mov": "video"
};

const VALID_MODES = ["scrub", "loop", "once", "static"];
const DEFAULT_VIDEO_MODE = "scrub";

function readPlayback(mediaDir) {
  const file = path.join(mediaDir, "playback.txt");
  const map = {};
  if (!fs.existsSync(file)) return map;
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^\s*([^=#]+?)\s*=\s*([a-z]+)\s*$/i);
      if (!m) return;
      const mode = m[2].toLowerCase();
      if (VALID_MODES.includes(mode)) map[m[1].trim()] = mode;
    });
  return map;
}

function buildManifestFor(slug) {
  const mediaDir = path.join(FONTS_DIR, slug, "media");
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

  const playback = readPlayback(mediaDir);

  const files = fs
    .readdirSync(mediaDir)
    .filter((name) => !name.startsWith(".") && name !== "manifest.json" && name.toLowerCase() !== "readme.txt" && name.toLowerCase() !== "playback.txt")
    .filter((name) => KIND_BY_EXT[path.extname(name).toLowerCase()])
    .sort()
    .map((name) => {
      const kind = KIND_BY_EXT[path.extname(name).toLowerCase()];
      const entry = { file: name, kind };
      if (kind === "video") entry.playback = playback[name] || DEFAULT_VIDEO_MODE;
      return entry;
    });

  fs.writeFileSync(path.join(mediaDir, "manifest.json"), JSON.stringify(files, null, 2) + "\n");
  return files.length;
}

const slugs = fs.readdirSync(FONTS_DIR).filter((name) => {
  const full = path.join(FONTS_DIR, name);
  return fs.statSync(full).isDirectory();
});

let total = 0;
slugs.forEach((slug) => {
  const count = buildManifestFor(slug);
  total += count;
  console.log(`${slug}: ${count} media`);
});
console.log(`Total: ${total} media dans ${slugs.length} fontes.`);
