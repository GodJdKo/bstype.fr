/* ============================================================
   SLIDER.JS — slider du theme (home + pages specimen)
   ------------------------------------------------------------
   Look = une boite de texte : libelle, points de remplissage,
   valeur, et un petit RECTANGLE ORANGE vertical qui marque la
   position (c'est le "thumb" de l'input range, la piste est
   invisible). Style : assets/css/specimen.css.

   BSSlider.init(inputEl)            -> juste la barre (home)
   BSSlider.create({ min, max, step, value, label, format,
                     onInput })      -> { el, input, set, get }
     label absent : [valeur][points][marqueur]      (editeur)
     label present: [label][points][valeur][marqueur] (couleurs)
   ============================================================ */

window.BSSlider = {
  _progress(input) {
    const min = parseFloat(input.min || "0");
    const max = parseFloat(input.max || "100");
    const val = parseFloat(input.value);
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--range-progress", pct + "%");
  },

  init(input) {
    if (!input) return input;
    input.classList.add("slider");
    const update = () => this._progress(input);
    input.addEventListener("input", update);
    update();
    return input;
  },

  create({ min, max, step, value, label, format, onInput, ariaLabel }) {
    const wrap = document.createElement("span");
    wrap.className = "bs-slider";

    const out = document.createElement("span");
    out.className = "bs-slider__value";

    const dots = document.createElement("span");
    dots.className = "dots";

    const input = document.createElement("input");
    input.type = "range";
    input.className = "slider bs-slider__input";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step != null ? step : 1);
    input.value = String(value != null ? value : min);
    if (ariaLabel || label) input.setAttribute("aria-label", ariaLabel || label);

    if (label != null) {
      const lb = document.createElement("span");
      lb.className = "bs-slider__label";
      lb.textContent = label;
      wrap.append(lb, dots, out, input);
    } else {
      wrap.append(out, dots, input);
    }

    const fmt = typeof format === "function" ? format : (v) => String(v);
    const sync = () => {
      this._progress(input);
      out.textContent = fmt(parseFloat(input.value));
    };
    input.addEventListener("input", () => {
      sync();
      if (onInput) onInput(parseFloat(input.value));
    });
    sync();

    return {
      el: wrap,
      input,
      set(v, silent) {
        input.value = String(v);
        sync();
        if (!silent && onInput) onInput(parseFloat(input.value));
      },
      get() {
        return parseFloat(input.value);
      }
    };
  }
};
