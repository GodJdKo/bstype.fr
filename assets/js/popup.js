/* ============================================================
   POPUP.JS — menu deroulant flottant (style terminal BS.type)
   ------------------------------------------------------------
   Un menu = une barre de titre sombre + des lignes en aplat
   (vert acide, ou orange pour les medias). Contour de la couleur
   du fond. Ligne survolee : gris clair de la charte.

   Les menus s'empilent : ouvrir un sous-menu ne ferme pas son
   parent (ex: type de zone -> liste des medias). Un clic dehors
   ou Echap ferme toute la pile.

   API :
     BSPopup.open({ anchor, title, className, build, parent })
       build(bodyEl, closeSelf) -> tu remplis bodyEl
       parent : popup renvoyee par un open() precedent (sous-menu)

     BSPopup.item(label, { selected })   -> <button> pret a l'emploi
     BSPopup.list({ anchor, items, selected, title, onPick, className })
     BSPopup.closeAll()
   Le style vient de assets/css/specimen.css (.bs-popup).
   ============================================================ */

window.BSPopup = (function () {
  const stack = [];
  let hideTimer = null;

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  function dots() {
    const d = document.createElement("span");
    d.className = "dots";
    return d;
  }

  function closeAll() {
    cancelHide();
    while (stack.length) closeTop();
  }

  function closeTop() {
    const p = stack.pop();
    if (!p) return;
    p.el.remove();
    if (p.anchor) p.anchor.classList.remove("is-open");
    if (!stack.length) unbind();
  }

  /* ferme ce popup et tous ceux ouverts par-dessus */
  function closeFrom(p) {
    const i = stack.indexOf(p);
    if (i < 0) return;
    while (stack.length > i) closeTop();
  }

  function onKey(e) {
    if (e.key === "Escape") closeAll();
  }

  function onDoc(e) {
    if (!stack.length) return;
    const inside = stack.some(
      (p) => p.el.contains(e.target) || (p.anchor && p.anchor.contains(e.target))
    );
    if (!inside) closeAll();
  }

  function bind() {
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDoc, true);
    window.addEventListener("resize", closeAll);
  }
  function unbind() {
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("mousedown", onDoc, true);
    window.removeEventListener("resize", closeAll);
  }

  /* Dernier clic : le menu s'ouvre LA ou on a clique, pas sous
     l'ancre. On garde la position en continu, tous les menus
     partent d'un clic. */
  let lastClick = null;
  document.addEventListener(
    "pointerdown",
    (e) => { lastClick = { x: e.clientX, y: e.clientY }; },
    true
  );

  /* place le menu au point clique ; un sous-menu part a droite du parent */
  function position(el, anchor, parent, at) {
    const r = anchor ? anchor.getBoundingClientRect() : null;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    let left;
    let top;
    if (parent) {
      /* Le sous-menu s'ouvre SOUS LA SOURIS, par-dessus le menu
         parent : aucun deplacement a faire pour l'atteindre. */
      const pr = parent.el.getBoundingClientRect();
      left = at ? at.x : pr.right;
      top = (at ? at.y : (r ? r.top : 0)) - 2;
      if (left + w > vw - 8) left = Math.max(8, (at ? at.x : pr.right) - w);
    } else if (at) {
      left = at.x;
      top = at.y + 4;
      /* pas la place dessous : on bascule au-dessus du point clique */
      if (top + h > vh - 8 && at.y - h - 4 > 8) top = at.y - h - 4;
    } else {
      left = r ? r.left : 8;
      top = r ? r.bottom + 2 : 8;
      if (r && top + h > vh - 8 && r.top - h - 2 > 8) top = r.top - h - 2;
    }
    if (left + w > vw - 8) left = Math.max(8, vw - 8 - w);
    if (top + h > vh - 8) top = Math.max(8, vh - 8 - h);
    el.style.left = window.scrollX + left + "px";
    el.style.top = window.scrollY + top + "px";
  }

  function open({ anchor, title, className, build, parent, at }) {
    if (parent) closeFrom(stack[stack.indexOf(parent) + 1]);
    else closeAll();

    const el = document.createElement("div");
    el.className = "bs-popup" + (className ? " " + className : "");

    if (title != null) {
      const h = document.createElement("div");
      h.className = "bs-popup__title";
      const t = document.createElement("span");
      t.textContent = title;
      h.append(t, dots());
      el.appendChild(h);
    }
    const body = document.createElement("div");
    body.className = "bs-popup__body";
    el.appendChild(body);

    document.body.appendChild(el);

    const me = { el, anchor, body };

    /* la souris quitte le menu : on ferme (un petit delai laisse le
       temps de glisser vers un sous-menu, qui annule la fermeture). */
    el.addEventListener("mouseenter", cancelHide);
    el.addEventListener("mouseleave", () => {
      cancelHide();
      hideTimer = setTimeout(() => { hideTimer = null; closeFrom(me); }, 180);
    });
    if (typeof build === "function") build(body, () => closeFrom(me));

    if (anchor) anchor.classList.add("is-open");
    position(el, anchor || null, parent || null, at || lastClick);

    if (!stack.length) setTimeout(bind, 0);
    stack.push(me);
    return me;
  }

  /* une ligne de menu : libelle + points de remplissage */
  function item(label, opts) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bs-popup__item";
    const lb = document.createElement("span");
    lb.className = "bs-popup__label";
    /* le texte vit dans un span interne : c'est lui qui defile
       quand le nom est plus long que le menu */
    const inner = document.createElement("span");
    inner.textContent = label;
    lb.appendChild(inner);
    /* le libelle peut s'afficher DANS la fonte concernee ; les
       points de remplissage restent en BS Mono */
    if (opts && opts.family) lb.style.fontFamily = "'" + opts.family + "'";
    /* Une famille peut contenir plusieurs graisses sous le MEME nom
       CSS : sans ces deux lignes, tous les styles s'affichaient en
       romain et se ressemblaient. */
    if (opts && opts.weight) lb.style.fontWeight = opts.weight;
    if (opts && opts.fontStyle) lb.style.fontStyle = opts.fontStyle;
    b.append(lb, dots());
    measureOverflow(lb, inner);
    if (opts && opts.selected) b.classList.add("is-selected");
    if (opts && opts.value != null) b.dataset.value = String(opts.value);
    return b;
  }

  /* Combien le nom depasse-t-il de la place disponible ? On pose
     l'ecart et une duree proportionnelle : les noms longs defilent
     plus longtemps, pas plus vite. */
  function measureOverflow(box, inner) {
    const run = () => {
      const over = inner.scrollWidth - box.clientWidth;
      if (over > 1) {
        box.style.setProperty("--shift", -over + "px");
        box.style.setProperty("--marquee-t", Math.max(1.2, over / 40) + "s");
      } else {
        box.style.removeProperty("--shift");
      }
    };
    /* apres la mise en page, et de nouveau une fois la fonte chargee */
    setTimeout(run, 0);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  }

  function list({ anchor, items, selected, title, onPick, className, parent, at }) {
    return open({
      anchor,
      title,
      parent,
      at,
      className: "bs-popup--list" + (className ? " " + className : ""),
      build: (body, done) => {
        (items || []).forEach((it) => {
          const b = item(it.label, {
            selected: it.value === selected,
            value: it.value,
            family: it.family,
            weight: it.weight,
            fontStyle: it.fontStyle
          });
          b.addEventListener("click", () => {
            if (onPick) onPick(it.value, it);
            done();
          });
          body.appendChild(b);
        });
      }
    });
  }

  return { open, list, item, dots, closeAll, close: closeAll };
})();
