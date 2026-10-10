/* Appearance is deliberately isolated from authentication and comments. */
(() => {
  "use strict";
  const slots = ["background", "masthead", "hero", "cover"];
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  function safeSource(value, preview = false) {
    if (typeof value !== "string") return "";
    if (/^\/(?!\/)/.test(value)) return value;
    if (!/^https:\/\//i.test(value) && !(preview && value.startsWith("blob:"))) return "";
    try {
      const url = new URL(value, location.origin);
      if (url.protocol === "https:") return url.href;
      if (preview && url.protocol === "blob:" && url.origin === location.origin) return url.href;
    } catch { /* Invalid images fall back to an empty slot. */ }
    return "";
  }
  function normalize(settings, preview = false) {
    const input = settings && typeof settings === "object" ? settings : {};
    const output = {
      accent: /^#[\da-f]{6}$/i.test(input.accent || "") ? input.accent : "#ce412d",
      motion: input.motion !== false,
      surface: { opacity: clamp(input.surface?.opacity, .55, 1, .96), blur: clamp(input.surface?.blur, 0, 40, 18) }
    };
    for (const slot of slots) {
      const image = input[slot] || {};
      output[slot] = {
        src: safeSource(image.src, preview), alt: String(image.alt || "").slice(0, 500),
        caption: String(image.caption || "").slice(0, 500),
        opacity: clamp(image.opacity, 0, 1, 1), blur: clamp(image.blur, 0, 40, 0),
        focus_x: clamp(image.focus_x, 0, 100, 50), focus_y: clamp(image.focus_y, 0, 100, 50),
        fit: image.fit === "contain" ? "contain" : "cover"
      };
    }
    return output;
  }
  function apply(settings, preview = false) {
    const config = normalize(settings, preview);
    const style = document.documentElement.style;
    style.setProperty("--accent", config.accent);
    style.setProperty("--surface-opacity", config.surface.opacity);
    style.setProperty("--surface-blur", config.surface.blur + "px");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.classList.toggle("motion-on", config.motion && !reducedMotion);
    document.body.classList.toggle("motion-off", !config.motion || reducedMotion);
    for (const slot of slots) {
      let figure = document.querySelector('[data-visual-slot="' + slot + '"]');
      if (!figure && preview && config[slot].src) {
        const container = {
          background: document.querySelector(".ambient"),
          masthead: document.querySelector(".site-header"),
          hero: document.querySelector(".hero-art"),
          cover: document.querySelector(".article-cover")
        }[slot];
        if (!container) continue;
        if (slot === "masthead") {
          const wrapper = document.createElement("div");
          wrapper.className = "masthead-image";
          container.append(wrapper);
          figure = document.createElement("figure");
          wrapper.append(figure);
        } else {
          figure = document.createElement("figure");
          container.prepend(figure);
        }
        figure.className = "visual-image";
        figure.dataset.visualSlot = slot;
        const image = document.createElement("img");
        image.width = 1200; image.height = 900;
        figure.append(image);
      }
      if (!figure) continue;
      const image = figure.querySelector("img");
      figure.hidden = !config[slot].src;
      if (!image) continue;
      if (config[slot].src) image.src = config[slot].src;
      image.alt = slot === "background" ? "" : config[slot].alt;
      image.style.opacity = config[slot].opacity;
      image.style.filter = "blur(" + config[slot].blur + "px)";
      image.style.objectPosition = config[slot].focus_x + "% " + config[slot].focus_y + "%";
      image.style.objectFit = config[slot].fit;
      const caption = figure.querySelector("figcaption");
      if (caption) caption.textContent = config[slot].caption;
    }
  }
  try { apply(JSON.parse(document.getElementById("site-appearance").textContent)); } catch { /* Content remains readable. */ }
  window.HanshuiAppearance = { normalize, apply };
  if (window.parent !== window && new URLSearchParams(location.search).get("preview") === "1") {
    window.addEventListener("message", event => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "hanshui:appearance") return;
      apply(event.data.settings, true);
    });
  }
  let pending = false;
  function progress() {
    const bar = document.querySelector(".reading-progress");
    if (bar) {
      const distance = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (distance > 0 ? Math.min(1, window.scrollY / distance) : 0) + ")";
    }
    pending = false;
  }
  window.addEventListener("scroll", () => {
    if (!pending) { pending = true; window.requestAnimationFrame(progress); }
  }, { passive: true });
  window.addEventListener("resize", progress);
  progress();
})();
