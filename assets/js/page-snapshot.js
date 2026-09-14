/* ============================================================
   PAGE-SNAPSHOT.JS — PHOTOGRAPHIER LA PAGE AFFICHEE
   ------------------------------------------------------------
   Un navigateur ne sait PAS se photographier lui-meme : aucune
   fonction ne rend l'ecran. La seule methode qui marche partout
   (c'est celle de la bibliotheque html2canvas) est de REDESSINER
   la page : on recopie le contenu, on colle tous les styles
   calcules dessus, on glisse le tout dans une image SVG, et on
   dessine cette image dans un canvas.

   BSSnapshot.take() -> Promise<canvas | null>
     Le canvas fait la taille de la fenetre visible et montre ce
     qu'on y voit, au pixel pres du defilement courant.

   Ce qui ne passe pas tout seul, et qu'on rattrape a la main :
     - les <video> : redessinees, image courante
     - les <canvas> : recopies tels quels
     - les fontes : reinjectees en dur (sinon tout retombe sur la
       police du systeme)
     - les images d'un AUTRE site : retirees (le navigateur
       l'interdit)

   Sert a l'effet d'inactivite (assets/js/idle-glitch.js), mais
   rien n'y oblige : c'est une brique autonome.
   ============================================================ */

window.BSSnapshot = (function () {
  /* Budget d'inclusion des fontes. Au-dela, on s'arrete : une
     capture ne doit pas peser 10 Mo. */
  const POIDS_MAX_FONTE = 400 * 1024;
  const POIDS_MAX_TOTAL = 1400 * 1024;

  /* Derniere raison d'echec, pour pouvoir regarder dans la console :
     BSSnapshot.dernierSouci */
  let souci = null;

  let cssFontes = null;       /* calcule une fois, reutilise ensuite */
  const cacheFichiers = new Map();

  /* ---------- styles ----------
     On ne recopie PAS le style calcule sur chaque element : ca
     pesait des mega-octets et ca perdait les variables CSS (donc
     toute la grille des pages de fonte). On reprend les feuilles
     de style telles quelles, en un seul bloc : plus leger, plus
     fidele, et les variables, les container queries et les media
     queries continuent de fonctionner. */
  let cssPage = null;

  function absolu(url, base) {
    try { return new URL(url, base).href; } catch (_e) { return url; }
  }

  function reprendreFeuilles() {
    if (cssPage != null) return cssPage;
    const bouts = [];
    for (const feuille of document.styleSheets) {
      let regles;
      try { regles = feuille.cssRules; } catch (_e) { continue; }
      if (!regles) continue;
      const base = feuille.href || document.baseURI;
      for (const r of regles) {
        let texte = r.cssText || "";
        if (!texte) continue;
        /* les chemins d'une feuille sont relatifs A ELLE : on les
           rend absolus, sinon ils pointeraient dans le vide */
        texte = texte.replace(/url\((["']?)([^"')]+)\1\)/g, (m, q, u) => {
          if (/^(data:|https?:|blob:)/i.test(u)) return m;
          return 'url("' + absolu(u, base) + '")';
        });
        bouts.push(texte);
      }
    }
    cssPage = bouts.join("\n");
    return cssPage;
  }

  /* ---------- fichiers en dur ---------- */
  function enDataURI(url) {
    if (cacheFichiers.has(url)) return cacheFichiers.get(url);
    const p = fetch(url, { mode: "cors", credentials: "omit" })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob || blob.size > POIDS_MAX_FONTE) return null;
        return new Promise((ok) => {
          const fr = new FileReader();
          fr.onloadend = () => ok(typeof fr.result === "string" ? fr.result : null);
          fr.onerror = () => ok(null);
          fr.readAsDataURL(blob);
        });
      })
      .catch(() => null);
    cacheFichiers.set(url, p);
    return p;
  }

  /* ---------- fontes ----------
     Les @font-face de la page pointent vers des fichiers ; dans
     l'image SVG ces liens ne sont pas suivis. On refabrique donc
     les memes regles avec le fichier ecrit dedans. */
  function reglesFontes() {
    const out = [];
    for (const feuille of document.styleSheets) {
      let regles;
      try { regles = feuille.cssRules; } catch (_e) { continue; }
      if (!regles) continue;
      /* PIEGE A NE PLUS REFAIRE : le chemin ecrit dans une regle
         (« ../fonts/X.otf ») est relatif A LA FEUILLE DE STYLE, pas
         a la page. En le resolvant depuis la page on tombait a cote
         (404), la fonte etait jetee de la photo, et le texte
         repartait sur la police du systeme : c'est ce qui faisait
         « changer de fonte » quand l'effet demarrait. */
      const base = feuille.href || document.baseURI;
      for (const r of regles) {
        const t = r.cssText || "";
        if (t.indexOf("@font-face") === 0) out.push({ texte: t, base: base });
      }
    }
    return out;
  }

  function construireCssFontes() {
    if (cssFontes) return Promise.resolve(cssFontes);

    const regles = reglesFontes();
    if (!regles.length) { cssFontes = ""; return Promise.resolve(cssFontes); }

    /* la fonte d'interface passe en premier : c'est elle qui porte
       tout le texte de la page */
    const ui = (getComputedStyle(document.body).fontFamily || "").split(",")[0]
      .replace(/["']/g, "").trim().toLowerCase();
    regles.sort((a, b) => {
      const pa = a.texte.toLowerCase().indexOf(ui) >= 0 ? 0 : 1;
      const pb = b.texte.toLowerCase().indexOf(ui) >= 0 ? 0 : 1;
      return pa - pb;
    });

    const jobs = regles.map((regle) => {
      const texte = regle.texte;
      const m = texte.match(/src\s*:\s*([^;}]+)/i);
      if (!m) return Promise.resolve(null);
      const u = m[1].match(/url\(["']?([^"')]+)["']?\)/i);
      if (!u) return Promise.resolve(null);
      let abs;
      try { abs = new URL(u[1], regle.base).href; } catch (_e) { return Promise.resolve(null); }
      return enDataURI(abs).then((data) => (data ? { texte, data } : null));
    });

    return Promise.all(jobs).then((liste) => {
      const gardees = [];
      let poids = 0;
      liste.forEach((e) => {
        if (!e) return;
        const octets = e.data.length * 0.75;
        if (poids + octets > POIDS_MAX_TOTAL) return;
        poids += octets;
        gardees.push(e.texte.replace(/src\s*:\s*[^;}]+/i, 'src: url("' + e.data + '")'));
      });
      cssFontes = gardees.join("\n");
      return cssFontes;
    });
  }

  /* ---------- elements que le SVG ne sait pas rendre ----------
     Une video ou un canvas ne se recopient pas : on les remplace
     par une image de leur contenu actuel. */
  function remplacerMedias(source, copie) {
    const vrais = source.querySelectorAll("video, canvas");
    const copies = copie.querySelectorAll("video, canvas");
    for (let i = 0; i < vrais.length && i < copies.length; i += 1) {
      const el = vrais[i];
      const cl = copies[i];
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) { cl.remove(); continue; }

      let data = null;
      try {
        if (el.tagName === "CANVAS") {
          data = el.toDataURL("image/png");
        } else if (el.readyState >= 2) {
          const tmp = document.createElement("canvas");
          tmp.width = Math.max(1, Math.round(r.width));
          tmp.height = Math.max(1, Math.round(r.height));
          const c = tmp.getContext("2d");
          /* la video est affichee en "cover" : on refait le meme
             recadrage, sinon l'image serait deformee */
          const vw = el.videoWidth, vh = el.videoHeight;
          if (vw && vh) {
            const k = Math.max(tmp.width / vw, tmp.height / vh);
            const w = vw * k, h = vh * k;
            c.drawImage(el, (tmp.width - w) / 2, (tmp.height - h) / 2, w, h);
            data = tmp.toDataURL("image/jpeg", 0.8);
          }
        }
      } catch (_e) { data = null; }

      /* L'image qui remplace la video garde la CLASSE de l'original :
         sans elle, les regles de la feuille de style ne s'appliquent
         plus et l'element reprend sa taille naturelle — ce qui
         poussait tout le reste de la page hors du cadre. On fige en
         plus ses dimensions mesurees a l'ecran. */
      const img = document.createElement("img");
      img.className = cl.className;
      if (cl.id) img.id = cl.id;
      img.setAttribute(
        "style",
        (cl.getAttribute("style") || "") +
          ";width:" + r.width + "px;height:" + r.height + "px;object-fit:cover;"
      );
      if (data) img.setAttribute("src", data);
      cl.parentNode.replaceChild(img, cl);
    }
  }

  /* Les images : dans une image SVG, un <img> qui pointe vers un
     fichier n'est PAS telecharge — on ne verrait que l'icone
     d'image cassee. On remplace donc chaque image du site par son
     contenu ecrit en dur, pris a meme l'image deja affichee.
     Celles qui viennent d'un autre site sont retirees : le
     navigateur interdit de les relire. */
  /* Y a-t-il des pixels transparents ? On ne relit pas tout : une
     grille de sondages suffit a le savoir. */
  function aDuVide(ctx, toile) {
    let d;
    try { d = ctx.getImageData(0, 0, toile.width, toile.height).data; } catch (_e) { return false; }
    const pas = Math.max(4, Math.round(Math.sqrt((toile.width * toile.height) / 4000))) * 4;
    for (let i = 3; i < d.length; i += pas) {
      if (d[i] < 250) return true;
    }
    return false;
  }

  function figerImages(source, copie) {
    const vraies = source.querySelectorAll("img");
    const copies = copie.querySelectorAll("img");
    for (let i = 0; i < vraies.length && i < copies.length; i += 1) {
      const el = vraies[i];
      const cl = copies[i];
      const src = cl.getAttribute("src");
      if (!src || src.indexOf("data:") === 0) continue;

      let interne = false;
      try { interne = new URL(src, document.baseURI).origin === location.origin; } catch (_e) {}
      if (!interne || !el.complete || !el.naturalWidth) {
        cl.removeAttribute("src");
        continue;
      }
      try {
        /* On garde les PROPORTIONS D'ORIGINE de l'image. Redimensionner
           vers la boite d'affichage l'ecrasait : le recadrage
           « object-fit: cover » etait deja applique par la feuille de
           style, on le faisait donc une deuxieme fois. */
        const tmp = document.createElement("canvas");
        tmp.width = Math.min(el.naturalWidth, 1400);
        tmp.height = Math.max(1, Math.round((el.naturalHeight / el.naturalWidth) * tmp.width));
        const c = tmp.getContext("2d");
        c.drawImage(el, 0, 0, tmp.width, tmp.height);
        /* Une image a fond TRANSPARENT (la photo du pied de page, par
           exemple) doit rester transparente : le JPEG ne connait pas
           la transparence, et le vide y devenait NOIR au milieu du
           fond clair. On sonde donc l'image, et on garde le PNG des
           qu'il y a du vide. Un peu plus lourd, mais juste. */
        cl.setAttribute("src", tmp.toDataURL(aDuVide(c, tmp) ? "image/png" : "image/jpeg", 0.78));
      } catch (_e) {
        cl.removeAttribute("src");
      }
    }
  }

  /* Les commentaires du HTML doivent partir : l'image SVG est lue
     en XML strict, et un simple « -- » dans un commentaire (on en
     ecrit tout le temps) fait echouer TOUTE la lecture. */
  function retirerCommentaires(racine) {
    const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_COMMENT, null);
    const aJeter = [];
    while (marcheur.nextNode()) aJeter.push(marcheur.currentNode);
    aJeter.forEach((n) => { if (n.parentNode) n.parentNode.removeChild(n); });
  }

  /* ---------- la photo ---------- */
  function take() {
    const largeur = Math.max(1, document.documentElement.clientWidth);
    const hauteur = Math.max(1, document.documentElement.clientHeight);
    const dx = window.scrollX;
    const dy = window.scrollY;

    return construireCssFontes().then((css) => {
      const copie = document.documentElement.cloneNode(true);
      figerImages(document.documentElement, copie);
      remplacerMedias(document.documentElement, copie);

      copie.querySelectorAll('script, link[rel="stylesheet"], style').forEach((n) => n.remove());
      /* on ne se photographie pas soi-meme : la toile de l'effet et
         tout ce qui porte data-no-snapshot sortent de la photo */
      copie.querySelectorAll(".bs-glitch, [data-no-snapshot]").forEach((n) => n.remove());
      retirerCommentaires(copie);

      /* une seule feuille : celle de la page, plus les fontes
         ecrites en dur */
      const st = document.createElement("style");
      st.textContent = reprendreFeuilles() + (css ? "\n" + css : "");
      const head = copie.querySelector("head");
      if (head) head.appendChild(st);
      else copie.insertBefore(st, copie.firstChild);

      const html = new XMLSerializer().serializeToString(copie);
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + largeur + '" height="' + hauteur + '">' +
        '<foreignObject width="100%" height="100%">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + largeur + 'px;height:' + hauteur + 'px;overflow:hidden">' +
        '<div style="position:relative;left:-' + dx + 'px;top:-' + dy + 'px">' +
        html +
        "</div></div></foreignObject></svg>";

      /* Adresse "data:" et NON lien blob : une image SVG venue d'un
         blob salit le canvas (le navigateur la traite comme si elle
         venait d'ailleurs), et on ne pourrait plus relire les
         pixels — donc plus d'effet du tout. */
      return new Promise((ok) => {
        const image = new Image();
        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = largeur;
            canvas.height = hauteur;
            canvas.getContext("2d").drawImage(image, 0, 0);
            souci = null;
            ok(canvas);
          } catch (e) {
            souci = "dessin impossible : " + e;
            ok(null);
          }
        };
        image.onerror = () => {
          souci = "le navigateur a refuse l'image (" + Math.round(svg.length / 1024) + " Ko)";
          ok(null);
        };
        image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      });
    }).catch((e) => { souci = "capture : " + e; return null; });
  }

  return { take, get dernierSouci() { return souci; } };
})();
