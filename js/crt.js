/* bz — CRT monitor filter, a full-viewport visual-only overlay
   Reference studied: https://ichiaka.github.io/CRTFilter/ ("CRTFilter by Aka") is a
   WebGL shader that redraws a <canvas> (game/video frame) through a fragment shader
   doing curvature, scanlines, mask and vignette in one pass. It reprojects pixels
   (barrel distortion), so it cannot be dropped over a live, interactive DOM: it needs
   a single rasterized texture to sample, and any geometric warp would desync mouse
   hit-testing with what the user sees. This file is a DOM-safe approximation: the
   same visual ingredients (scanlines, phosphor mask, vignette, rounded tube corners,
   flicker, soft glow) on a `pointer-events: none` overlay.

   Every layer is plain alpha compositing — no mix-blend-mode. Blend modes make the
   compositor re-blend the overlay against whatever changed underneath, and in Chrome
   that lags a frame: freshly rendered content (a Finder folder, a new window) flashes
   unfiltered before the effect catches up. Normal alpha paints in the same frame. */
(function () {
  "use strict";

  var KEY = "bz-crt";
  var ID = "bz-crt-overlay";
  var STYLE_ID = "bz-crt-style";
  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var dpr = window.devicePixelRatio || 1;
  var scanPeriod = dpr >= 1.5 ? 2 : 3; // px; crisp at 1x (3px) and 2x (2px, still >=4 device px)

  function css() {
    var scanlines = "repeating-linear-gradient(to bottom," +
      "rgba(0,0,0,.09) 0, rgba(0,0,0,.09) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) " + scanPeriod + "px)";
    // aperture grille: faint R, G, B phosphor columns
    var mask = "repeating-linear-gradient(90deg," +
      "rgba(255,40,80,.022) 0, rgba(255,40,80,.022) 1px," +
      "rgba(60,255,120,.016) 1px, rgba(60,255,120,.016) 2px," +
      "rgba(60,110,255,.026) 2px, rgba(60,110,255,.026) 3px," +
      "rgba(0,0,0,0) 3px, rgba(0,0,0,0) 4px)";
    var glow = "radial-gradient(ellipse 90% 80% at 50% 42%, rgba(255,255,255,.03), rgba(255,255,255,0) 60%)";
    var vignette = "radial-gradient(ellipse 145% 130% at 50% 50%, rgba(0,0,0,0) 62%, rgba(0,0,0,.1) 82%, rgba(0,0,0,.32) 100%)";

    return "" +
      "#" + ID + "{position:fixed;inset:0;z-index:2000;pointer-events:none;overflow:hidden;" +
      "background-image:" + scanlines + "," + mask + "," + glow + "," + vignette + ";" +
      "box-shadow:inset 0 0 60px 18px rgba(0,0,0,.24),inset 0 0 0 2px rgba(0,0,0,.1);}" +
      // brightness flicker: an opacity-only animation, so it runs on the compositor
      "#" + ID + "::before{content:'';position:absolute;inset:0;background:#fff;opacity:0;will-change:opacity;" +
      (reduced ? "" : "animation:bz-crt-flicker 6.2s steps(1) infinite;") + "}" +
      // rounded tube corners
      "#" + ID + "::after{content:'';position:absolute;inset:0;border-radius:18px;box-shadow:0 0 0 40px rgba(0,0,0,.88);}" +
      "@keyframes bz-crt-flicker{0%,92%,100%{opacity:0}93%{opacity:.03}94%{opacity:.01}95.5%{opacity:.022}97%{opacity:0}}";
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = css();
    document.head.appendChild(s);
  }

  function ensureOverlay() {
    var el = document.getElementById(ID);
    if (el) return el;
    ensureStyle();
    el = document.createElement("div");
    el.id = ID;
    el.setAttribute("aria-hidden", "true");
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function readState() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch (e) {}
    return true; // default ON
  }

  function writeState(on) {
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch (e) {}
  }

  var state = readState();

  function apply() {
    if (state) {
      ensureOverlay().style.display = "";
    } else {
      var el = document.getElementById(ID);
      if (el) el.style.display = "none";
    }
  }

  function enable(on) {
    state = !!on;
    writeState(state);
    apply();
  }

  function toggle() {
    enable(!state);
    return state;
  }

  function enabled() {
    return state;
  }

  function init() {
    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.BzCRT = {
    enable: enable,
    toggle: toggle,
    enabled: enabled
  };
})();
