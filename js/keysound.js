/* bz -- klacky keyboard sounds, played from real sampled key hits (WebAudio).
   Samples live in keysound-data.js (base64 mono 44.1kHz 16-bit WAVs, one
   real Apple Alps-switch keyboard -- see SOUND-CREDITS.txt) and are loaded
   lazily as a <script> through js/lazy.js (works from file://, unlike
   fetch/XHR), so the host loads lazy.js and this file, then calls
   BzKeys.bind(). Falls back to window.BzSound's
   synthesized clicks whenever a real sample isn't ready or decode failed.
   API: BzKeys.bind(), BzKeys.ready(), BzKeys.feed() for keys typed in another frame,
   and the test-only BzKeys._render(). */
(function () {
  "use strict";

  var scriptEl = document.currentScript;
  var DATA_URL = (function () {
    try { return new URL("keysound-data.js", scriptEl ? scriptEl.src : document.baseURI).href; }
    catch (e) { return "keysound-data.js"; }
  })();

  var CLASSES = ["letter", "space", "return", "backspace", "modifier"];

  // Per-class gain in dB, calibrated (see SOUND-CREDITS.txt / verification
  // notes) so an ordinary letter press lands ~3dB below BzSound's mouse
  // "down" click (compared as 50ms-onset RMS), space/return ~0..-1dB below
  // it. Includes a +3dB offset for the StereoPannerNode's center attenuation.
  var CLASS_GAIN_DB = { letter: -19.8, space: -14.5, "return": -23.2, backspace: -22.4, modifier: -11.4 };

  var RATE_JITTER = { letter: 0.01, space: 0.005, "return": 0.005, backspace: 0.01, modifier: 0.01 };
  var GAIN_JITTER_DB = 0.75;
  var RELEASE_EXTRA_JITTER_DB = 0.3;
  var IDLE_BOOST_MS = 1500;
  var IDLE_BOOST_DB = 0.5;
  var VELOCITY_BOOST_DB = 1;
  var VOICE_CAP = 32;
  var STEAL_MIN_AGE_S = 0.05;
  var STEAL_FADE_S = 0.004;

  // ── physical layout (KeyboardEvent.code) -> stereo pan, narrow +-0.25 ──
  var ROWS = [
    { offset: 0, codes: ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"] },
    { offset: 1.5, codes: ["Tab", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Backslash"] },
    { offset: 1.75, codes: ["CapsLock", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"] },
    { offset: 2.25, codes: ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"] }
  ];
  var KEYPOS = {};
  (function () {
    for (var ri = 0; ri < ROWS.length; ri++) {
      var row = ROWS[ri];
      for (var ki = 0; ki < row.codes.length; ki++) KEYPOS[row.codes[ki]] = row.offset + ki;
    }
  })();
  // derived from the table itself (not hardcoded) so KeyQ/KeyP land exactly
  // on +-PAN_SCALE regardless of which extra codes share their rows
  var PAN_MID = (KEYPOS.KeyQ + KEYPOS.KeyP) / 2;
  var PAN_HALF = (KEYPOS.KeyP - KEYPOS.KeyQ) / 2;
  var PAN_SCALE = 0.25, PAN_MAX = 0.25;
  var PAN_FIXED = { Space: 0, Enter: 0.23, NumpadEnter: 0.23, Backspace: 0.25 };

  function panFor(code) {
    if (!code) return 0;
    if (PAN_FIXED.hasOwnProperty(code)) return PAN_FIXED[code];
    var x = KEYPOS[code];
    if (x == null) {
      if (code.indexOf("Left") >= 0) x = 0;
      else if (code.indexOf("Right") >= 0) x = 13.6;
      else return 0;
    }
    var p = ((x - PAN_MID) / PAN_HALF) * PAN_SCALE;
    if (p < -PAN_MAX) p = -PAN_MAX;
    if (p > PAN_MAX) p = PAN_MAX;
    return p;
  }

  function classify(code, key) {
    code = code || "";
    key = key || "";
    if (code === "Space" || key === " ") return "space";
    if (code === "Enter" || code === "NumpadEnter" || key === "Enter") return "return";
    if (code === "Backspace" || key === "Backspace" || key === "Delete" || code === "Delete") return "backspace";
    if (code.indexOf("Shift") === 0 || code.indexOf("Control") === 0 || code.indexOf("Alt") === 0 ||
        code.indexOf("Meta") === 0 || code === "CapsLock" ||
        key === "Shift" || key === "Meta" || key === "Alt" || key === "Control" || key === "CapsLock") return "modifier";
    return "letter";
  }

  function fallbackName(cls) {
    if (cls === "space") return "space";
    if (cls === "return" || cls === "backspace") return "return";
    if (cls === "modifier") return "mod";
    return "key";
  }

  function fallbackPlay(cls, type) {
    var bs = window.BzSound;
    if (!bs || typeof bs.play !== "function") return;
    try { bs.play(type === "release" ? "keyup" : fallbackName(cls)); } catch (e) {}
  }

  function isMuted() {
    var bs = window.BzSound;
    if (!bs || typeof bs.muted !== "function") return false;
    try { return !!bs.muted(); } catch (e) { return false; }
  }

  function dbToLinear(d) { return Math.pow(10, d / 20); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // ── shuffle-bag per class+direction, excluding the previous 2 picks ──
  function makePicker() {
    var bags = {}, hist = {};
    return function (key, arr) {
      var n = arr.length;
      if (n === 0) return -1;
      if (n === 1) return 0;
      var excludeN = Math.min(2, n - 1);
      var h = hist[key] || [];
      var st = bags[key];
      if (!st || st.pos >= st.order.length) {
        var order = [];
        for (var i = 0; i < n; i++) order.push(i);
        for (i = order.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = order[i]; order[i] = order[j]; order[j] = t;
        }
        // fix the seam so the new bag doesn't repeat the last `excludeN` picks
        for (var guard = 0; guard < excludeN; guard++) {
          if (h.indexOf(order[guard]) !== -1) {
            for (var k = order.length - 1; k > guard; k--) {
              if (h.indexOf(order[k]) === -1) {
                var tmp = order[guard]; order[guard] = order[k]; order[k] = tmp;
                break;
              }
            }
          }
        }
        st = { order: order, pos: 0 };
        bags[key] = st;
      }
      var idx = st.order[st.pos++];
      h.push(idx);
      while (h.length > 2) h.shift();
      hist[key] = h;
      return idx;
    };
  }

  // ── decode ──
  function b64ToArrayBuffer(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function decodeOne(c, ab) {
    return new Promise(function (resolve, reject) {
      try {
        var p = c.decodeAudioData(ab, function (buf) { resolve(buf); }, function (err) { reject(err); });
        if (p && typeof p.then === "function") p.then(resolve, reject);
      } catch (e) { reject(e); }
    });
  }

  function decodeInto(targetCtx, onDone) {
    var data = window.BzKeySamples;
    if (!data || !data.classes) { onDone(null); return; }
    var out = {}, jobs = [];
    for (var ci = 0; ci < CLASSES.length; ci++) {
      var cn = CLASSES[ci];
      var src = data.classes[cn] || { press: [], release: [] };
      out[cn] = { press: [], release: [] };
      ["press", "release"].forEach(function (type) {
        var list = src[type] || [];
        for (var i = 0; i < list.length; i++) {
          (function (i, type, cn) {
            var job = decodeOne(targetCtx, b64ToArrayBuffer(list[i])).then(function (buf) {
              out[cn][type][i] = buf;
            }, function () { /* drop this one sample, keep the rest */ });
            jobs.push(job);
          })(i, type, cn);
        }
      });
    }
    Promise.all(jobs).then(function () {
      for (var k in out) {
        if (!out.hasOwnProperty(k)) continue;
        out[k].press = out[k].press.filter(function (x) { return !!x; });
        out[k].release = out[k].release.filter(function (x) { return !!x; });
      }
      onDone(out);
    }, function () { onDone(null); });
  }

  // ── live player state ──
  var ctx = null;
  var bound = false;
  var liveBuffers = null;
  var isReady = false;
  var livePick = makePicker();
  var voices = []; // {src, gain, pan, gainLinear, startTime}
  var held = {};   // code -> {cls, rate, gainDb, fallback}
  var lastPressAt = null;
  var recentIntervals = [];

  // The recordings load once, shared by every caller (js/lazy.js); after a failure the fallback sounds
  // play meanwhile and the next gesture tries again.
  function ensureDataLoaded(onLoaded, onFailed) {
    var got = function (ok) { var fn = ok && window.BzKeySamples ? onLoaded : onFailed; if (fn) fn(); };
    if (window.BzLazy) window.BzLazy([DATA_URL], got); else got(!!window.BzKeySamples);
  }

  var decoding = false;
  function startDecode() {
    if (decoding || isReady) return; // never decode the board twice
    decoding = true;
    ensureDataLoaded(function () {
      try {
        decodeInto(ctx, function (buffers) {
          decoding = false;
          if (buffers) { liveBuffers = buffers; isReady = true; }
        });
      } catch (e) { decoding = false; }
    }, function () { decoding = false; });
  }

  function resumeCtx() {
    if (!ctx || ctx.state === "running") return;
    try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} // also covers iOS "interrupted"
  }

  function ensureCtx() {
    if (ctx) { resumeCtx(); if (!isReady) startDecode(); return; }
    try {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      try { ctx = new Ctor({ latencyHint: "interactive" }); }
      catch (e) { ctx = new Ctor(); }
      resumeCtx();
      startDecode();
    } catch (e) { ctx = null; }
  }

  // idle prefetch: start pulling the data (and, once a gesture has created
  // ctx, decoding it) well before the user is likely to type.
  setTimeout(function () { ensureDataLoaded(function () { if (ctx) startDecode(); }); }, IDLE_BOOST_MS);

  function onFirstGesture() {
    ensureCtx();
  }

  // ── voices ──
  function stealOldestOrQuietest(now, list) {
    var idx = -1, best = Infinity;
    for (var i = 0; i < list.length - 1; i++) { // the last entry is the incoming voice
      var v = list[i];
      if (now - v.startTime > STEAL_MIN_AGE_S && v.gainLinear < best) { best = v.gainLinear; idx = i; }
    }
    if (idx === -1) return false; // everything is still in its attack: keep them, drop the newcomer
    var v = list[idx];
    list.splice(idx, 1);
    try {
      var g = v.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.0001, now + STEAL_FADE_S);
      v.src.stop(now + STEAL_FADE_S + 0.001);
    } catch (e) {}
    return true;
  }

  function scheduleVoice(c, dest, buffer, t0, rate, gainLinear, panValue, voicesArr) {
    var src = c.createBufferSource();
    src.buffer = buffer;
    try { src.playbackRate.value = rate; } catch (e) {}
    var gain = c.createGain();
    gain.gain.value = gainLinear;
    var panNode = null;
    if (typeof c.createStereoPanner === "function") {
      panNode = c.createStereoPanner();
      panNode.pan.value = panValue;
      src.connect(gain); gain.connect(panNode); panNode.connect(dest);
    } else {
      src.connect(gain); gain.connect(dest);
    }
    var voice = { src: src, gain: gain, pan: panNode, gainLinear: gainLinear, startTime: t0 };
    src.onended = function () {
      try { src.disconnect(); gain.disconnect(); if (panNode) panNode.disconnect(); } catch (e) {}
      var i = voicesArr.indexOf(voice);
      if (i >= 0) voicesArr.splice(i, 1);
    };
    voicesArr.push(voice);
    if (voicesArr.length > VOICE_CAP && !stealOldestOrQuietest(t0, voicesArr)) {
      voicesArr.pop();
      try { src.disconnect(); gain.disconnect(); if (panNode) panNode.disconnect(); } catch (e) {}
      return null;
    }
    try { src.start(t0); } catch (e) {}
    return voice;
  }

  function pickBuffer(buffersRoot, picker, cls, type) {
    var arr = (buffersRoot[cls] && buffersRoot[cls][type]) || [];
    var idx = picker(cls + ":" + type, arr);
    if (idx < 0) return null;
    return { buffer: arr[idx], idx: idx };
  }

  function medianOf(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  // ── real key handling ──
  function handleKeyDown(e) {
    try {
      if (e.isComposing || e.keyCode === 229) return;
      if (isMuted()) return;
      if (e.repeat) return;
      var code = e.code || ("key:" + e.key);
      if (held.hasOwnProperty(code)) return; // duplicate keydown for an already-held code
      var cls = classify(e.code, e.key);

      // ctx creation + decode kickoff happen only in onFirstGesture (registered
      // before this listener, so it has already run for this same event); this
      // handler only ever reads readiness, it never triggers decoding itself.
      if (!ctx || !isReady) {
        held[code] = { cls: cls, fallback: true };
        fallbackPlay(cls, "press");
        return;
      }

      var now = ctx.currentTime;
      var nowMs = now * 1000;
      var idleGap = lastPressAt == null ? null : (nowMs - lastPressAt);
      var idleBoost = (idleGap != null && idleGap > IDLE_BOOST_MS) ? IDLE_BOOST_DB : 0;
      if (idleGap != null) {
        recentIntervals.push(idleGap);
        while (recentIntervals.length > 4) recentIntervals.shift();
      }
      var m = medianOf(recentIntervals);
      var velocity = m == null ? 0 : Math.max(0, Math.min(1, (220 - m) / 160));
      var velocityBoost = velocity * VELOCITY_BOOST_DB;
      lastPressAt = nowMs;

      var picked = pickBuffer(liveBuffers, livePick, cls, "press");
      if (!picked) { held[code] = { cls: cls, fallback: true }; fallbackPlay(cls, "press"); return; }

      var jRate = RATE_JITTER[cls] || RATE_JITTER.letter;
      var rate = 1 + rand(-jRate, jRate);
      var gainJitterDb = rand(-GAIN_JITTER_DB, GAIN_JITTER_DB);
      var totalDb = (CLASS_GAIN_DB[cls] || CLASS_GAIN_DB.letter) + gainJitterDb + idleBoost + velocityBoost;
      var pan = panFor(e.code);

      scheduleVoice(ctx, ctx.destination, picked.buffer, now, rate, dbToLinear(totalDb), pan, voices);
      held[code] = { cls: cls, rate: rate, gainDb: gainJitterDb };
    } catch (err) {}
  }

  function handleKeyUp(e) {
    try {
      var code = e.code || ("key:" + e.key);
      var info = held[code];
      delete held[code];
      if (code === "MetaLeft" || code === "MetaRight") {
        Object.keys(held).forEach(function (k) { if (held[k].cls !== "modifier") delete held[k]; });
      }
      if (!info || isMuted()) return; // never validly pressed (or cleared by blur): no phantom release

      if (info.fallback || !isReady || !ctx) { fallbackPlay(info.cls, "release"); return; }

      var picked = pickBuffer(liveBuffers, livePick, info.cls, "release");
      if (!picked) { fallbackPlay(info.cls, "release"); return; }

      var now = ctx.currentTime;
      var rate = info.rate || 1;
      var gainJitterDb = (info.gainDb || 0) + rand(-RELEASE_EXTRA_JITTER_DB, RELEASE_EXTRA_JITTER_DB);
      var totalDb = (CLASS_GAIN_DB[info.cls] || CLASS_GAIN_DB.letter) + gainJitterDb;
      var pan = panFor(e.code);

      scheduleVoice(ctx, ctx.destination, picked.buffer, now, rate, dbToLinear(totalDb), pan, voices);
    } catch (err) {}
  }

  function clearHeld() { held = {}; }

  function bind() {
    if (bound) return;
    bound = true;
    try {
      // registered first so it runs before handleKeyDown on the same event
      // (capture-phase listeners on the same target fire in add order)
      document.addEventListener("keydown", onFirstGesture, { capture: true, passive: true });
      document.addEventListener("pointerdown", onFirstGesture, { capture: true, passive: true });
      document.addEventListener("keydown", handleKeyDown, { capture: true, passive: true });
      document.addEventListener("keyup", handleKeyUp, { capture: true, passive: true });
      window.addEventListener("blur", clearHeld, { capture: true });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) clearHeld();
      }, { capture: true });
    } catch (e) {}
  }

  function ready() { return isReady; }

  // Keys typed in another frame (the page in Safari), forwarded by its bridge: they sound the same.
  // e is {type: "keydown" | "keyup" | "blur", code, key, isComposing}; the frame drops auto-repeats.
  function feed(e) {
    if (e.type === "keydown") { onFirstGesture(); handleKeyDown(e); }
    else if (e.type === "keyup") handleKeyUp(e);
    else if (e.type === "blur") clearHeld();
  }

  // Test-only: schedules a typed sequence into an OfflineAudioContext.
  // keys: array of { code, key, type: "down"|"up", time (s), repeat }.
  // Bypasses mute state and the live/gesture path (same convention as
  // BzSound._render); loads+decodes the data fresh into the given context.
  function _render(keys, offlineCtx) {
    return new Promise(function (resolve) {
      try {
        ensureDataLoaded(function () {
          decodeInto(offlineCtx, function (buffers) {
            try {
              if (buffers) {
                var picker = makePicker();
                var voicesArr = [];
                var renderHeld = {};
                for (var i = 0; i < keys.length; i++) {
                  var ev = keys[i];
                  if (ev.repeat) continue;
                  var code = ev.code || ("key:" + ev.key);
                  var cls = classify(ev.code, ev.key);
                  var type = ev.type === "up" ? "release" : "press";
                  if (type === "press") {
                    if (renderHeld.hasOwnProperty(code)) continue;
                    var picked = pickBuffer(buffers, picker, cls, "press");
                    if (!picked) continue;
                    var jRate = RATE_JITTER[cls] || RATE_JITTER.letter;
                    var rate = 1 + rand(-jRate, jRate);
                    var gDb = rand(-GAIN_JITTER_DB, GAIN_JITTER_DB);
                    var totalDb = (CLASS_GAIN_DB[cls] || CLASS_GAIN_DB.letter) + gDb;
                    scheduleVoice(offlineCtx, offlineCtx.destination, picked.buffer, ev.time || 0, rate, dbToLinear(totalDb), panFor(ev.code), voicesArr);
                    renderHeld[code] = { cls: cls, rate: rate, gainDb: gDb };
                  } else {
                    var info = renderHeld[code];
                    if (!info) continue;
                    delete renderHeld[code];
                    var picked2 = pickBuffer(buffers, picker, info.cls, "release");
                    if (!picked2) continue;
                    var gDb2 = info.gainDb + rand(-RELEASE_EXTRA_JITTER_DB, RELEASE_EXTRA_JITTER_DB);
                    var totalDb2 = (CLASS_GAIN_DB[info.cls] || CLASS_GAIN_DB.letter) + gDb2;
                    scheduleVoice(offlineCtx, offlineCtx.destination, picked2.buffer, ev.time || 0, info.rate, dbToLinear(totalDb2), panFor(ev.code), voicesArr);
                  }
                }
              }
            } catch (e) {}
            resolve(true);
          });
        });
      } catch (e) { resolve(false); }
    });
  }

  window.BzKeys = {
    bind: bind,
    ready: ready,
    feed: feed,
    _render: _render
  };
})();
