/* ============================================================
   DROPDOWN.JS — menu déroulant custom partagé
   ------------------------------------------------------------
   Même composant que sur les pages spécimen (menu de type de
   case), réutilisé sur la home pour choisir la typo/graisse
   d'une ligne du catalogue.

   Usage :
     const dd = BSDropdown.create({
       options: [{ value, label }, ...],
       selected: value,
       onSelect: (value, option) => {},
       className: "extra-css-class" // optionnel
     });
     container.appendChild(dd.el);
   ============================================================ */

(function () {
  function closeAll() {
    document.querySelectorAll(".bs-dropdown.is-open").forEach((el) => el.classList.remove("is-open"));
  }
  document.addEventListener("click", closeAll);

  window.BSDropdown = {
    create({ options, selected, onSelect, className, ariaLabel }) {
      const wrap = document.createElement("div");
      wrap.className = "bs-dropdown bs-select-zone" + (className ? " " + className : "");

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "bs-dropdown__trigger";
      if (ariaLabel) trigger.setAttribute("aria-label", ariaLabel);
      wrap.appendChild(trigger);

      const menu = document.createElement("ul");
      menu.className = "bs-dropdown__menu";
      wrap.appendChild(menu);

      function setSelected(value) {
        const opt = options.find((o) => o.value === value) || options[0];
        trigger.textContent = opt ? opt.label : "";
        menu.querySelectorAll("li").forEach((li) => {
          li.classList.toggle("is-selected", li.dataset.value === (opt && opt.value));
        });
      }

      options.forEach((opt) => {
        const li = document.createElement("li");
        li.textContent = opt.label;
        li.dataset.value = opt.value;
        li.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelected(opt.value);
          wrap.classList.remove("is-open");
          if (onSelect) onSelect(opt.value, opt);
        });
        menu.appendChild(li);
      });

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = wrap.classList.contains("is-open");
        closeAll();
        if (!wasOpen) wrap.classList.add("is-open");
      });

      setSelected(selected);

      return { el: wrap, setSelected };
    }
  };
})();
