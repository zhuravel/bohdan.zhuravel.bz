/* bz — synthesized UI sounds (WebAudio, no audio files)
   Everything below is generated at call time from noise buffers, biquad filters,
   oscillators and gain envelopes. The AudioContext is created lazily on the
   first user gesture (browsers block audio before that), and play() is a
   silent no-op until then. */
(function () {
  "use strict";

  var KEY = "bz-sound";
  var ctx = null;
  var boundClicks = false;

  function readMuted() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch (e) {}
    return false; // default NOT muted
  }

  function writeMuted(m) {
    try {
      localStorage.setItem(KEY, m ? "1" : "0");
    } catch (e) {}
  }

  var muted = readMuted();

  function unlock() {
    if (ctx) {
      resumeCtx();
      return;
    }
    try {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      if (ctx.state === "suspended") ctx.resume();
      loadChime();
    } catch (e) {
      ctx = null;
    }
  }

  function resumeCtx() {
    if (!ctx || ctx.state === "running") return;
    try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} // "suspended" or iOS "interrupted"
  }

  try {
    document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    document.addEventListener("keydown", unlock, { capture: true, passive: true });
  } catch (e) {}

  // ── synthesis helpers (work on both AudioContext and OfflineAudioContext) ──

  function noiseBuffer(c, duration) {
    var len = Math.max(1, Math.round(c.sampleRate * duration));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function noiseSource(c, duration) {
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(c, duration);
    return src;
  }

  // points: [[dtSeconds, value], ...] relative to t0; first point sets the start value.
  function gainEnv(c, t0, points) {
    var g = c.createGain();
    var p0 = points[0];
    g.gain.setValueAtTime(Math.max(p0[1], 0.0001), t0 + p0[0]);
    for (var i = 1; i < points.length; i++) {
      var p = points[i];
      if (p[1] <= 0.0001) g.gain.linearRampToValueAtTime(0.0001, t0 + p[0]);
      else g.gain.exponentialRampToValueAtTime(p[1], t0 + p[0]);
    }
    return g;
  }

  function bandpass(c, freq, q) {
    var f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  // Disconnects a finished source's chain from the graph instead of leaving it
  // idle for the rest of the buffer (a resonant filter otherwise keeps computing
  // a near-silent ring-down tail for no audible benefit).
  function autoStop(src, extraNodes) {
    src.onended = function () {
      try {
        src.disconnect();
        for (var i = 0; i < extraNodes.length; i++) extraNodes[i].disconnect();
      } catch (e) {}
    };
  }

  function tone(c, dest, t0, dur, freq, peak) {
    var osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.01);
    autoStop(osc, [g]);
  }

  // ── sound builders ───────────────────────────────────────────────────────
  // Each builder(c, dest, t0) schedules its graph on context `c`, connected to
  // `dest`, starting at time `t0`. They never touch the module's live `ctx`
  // directly, so the same code renders in a real AudioContext or an
  // OfflineAudioContext (used by the test harness).

  function buildDown(c, dest, t0) {
    var dur = 0.018;
    var src = noiseSource(c, dur);
    var f = bandpass(c, 2800, 1.5);
    var g = gainEnv(c, t0, [[0, 0.0001], [0.001, 0.05], [0.004, 0.02], [0.016, 0.0001]]);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + dur + 0.005);
    autoStop(src, [f, g]);
  }

  function buildDown2(c, dest, t0) {
    var dur = 0.018;
    var src = noiseSource(c, dur);
    var f = bandpass(c, 3300, 1.6);
    var g = gainEnv(c, t0, [[0, 0.0001], [0.001, 0.046], [0.004, 0.018], [0.016, 0.0001]]);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + dur + 0.005);
    autoStop(src, [f, g]);
  }

  function buildUp2(c, dest, t0) {
    var dur = 0.017;
    var src = noiseSource(c, dur);
    var f = bandpass(c, 3900, 1.4);
    var g = gainEnv(c, t0, [[0, 0.0001], [0.0015, 0.03], [0.005, 0.013], [0.02, 0.0001]]);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + dur + 0.005);
    autoStop(src, [f, g]);
  }

  function buildUp(c, dest, t0) {
    var dur = 0.017;
    var src = noiseSource(c, dur);
    var f = bandpass(c, 3400, 1.3); // higher pitch than "down"
    var g = gainEnv(c, t0, [[0, 0.0001], [0.0015, 0.032], [0.005, 0.014], [0.02, 0.0001]]); // softer than "down"
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + dur + 0.005);
    autoStop(src, [f, g]);
  }

  // A keystroke = a bright "clack" (the key bottoming out) plus a short low "thock"
  // (the keycap body). Soft-touch, roughly the Apple Pro Keyboard of the era.
  // Pitch and level vary per press so fast typing doesn't sound machine-gunned.
  function keystroke(c, dest, t0, o) {
    var peak = o.gain * (0.8 + Math.random() * 0.4);
    var src = noiseSource(c, o.len);
    var f = bandpass(c, o.bright * (0.85 + Math.random() * 0.3), 1.3);
    var g = gainEnv(c, t0, [[0, 0.0001], [0.0012, peak], [0.006, peak * 0.3], [o.len, 0.0001]]);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + o.len + 0.005);
    autoStop(src, [f, g]);

    var osc = c.createOscillator();
    osc.type = "triangle";
    var body = o.body * (0.9 + Math.random() * 0.2);
    osc.frequency.setValueAtTime(body, t0);
    osc.frequency.exponentialRampToValueAtTime(body * 0.6, t0 + 0.03);
    var bg = gainEnv(c, t0, [[0, 0.0001], [0.002, peak * 0.7], [0.036, 0.0001]]);
    osc.connect(bg); bg.connect(dest);
    osc.start(t0); osc.stop(t0 + 0.045);
    autoStop(osc, [bg]);
  }

  function buildKey(c, dest, t0) { keystroke(c, dest, t0, { body: 210, bright: 2400, gain: 0.06, len: 0.022 }); }
  function buildMod(c, dest, t0) { keystroke(c, dest, t0, { body: 240, bright: 2900, gain: 0.035, len: 0.016 }); }
  function buildReturn(c, dest, t0) { keystroke(c, dest, t0, { body: 150, bright: 1700, gain: 0.075, len: 0.032 }); }

  // The space bar is long: a deeper thock, then its stabilizer wire rattles a moment later
  function buildSpace(c, dest, t0) {
    keystroke(c, dest, t0, { body: 115, bright: 1300, gain: 0.08, len: 0.04 });
    keystroke(c, dest, t0 + 0.012, { body: 180, bright: 3200, gain: 0.018, len: 0.012 });
  }

  function buildKeyUp(c, dest, t0) {
    var src = noiseSource(c, 0.01);
    var f = bandpass(c, 4200 + Math.random() * 800, 2);
    var g = gainEnv(c, t0, [[0, 0.0001], [0.001, 0.014], [0.009, 0.0001]]);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + 0.014);
    autoStop(src, [f, g]);
  }

  function buildTrash(c, dest, t0) {
    var total = 0.65;
    var master = c.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.linearRampToValueAtTime(1, t0 + 0.05);
    master.gain.setValueAtTime(1, t0 + total - 0.18);
    master.gain.linearRampToValueAtTime(0.0001, t0 + total);
    master.connect(dest);

    // low rustling body under the crackle
    var bodySrc = noiseSource(c, total);
    var bodyFilter = bandpass(c, 1100, 0.6);
    var bodyGain = c.createGain();
    bodyGain.gain.value = 0.02;
    bodySrc.connect(bodyFilter); bodyFilter.connect(bodyGain); bodyGain.connect(master);
    bodySrc.start(t0); bodySrc.stop(t0 + total);
    autoStop(bodySrc, [bodyFilter, bodyGain]);

    // crinkle grains scattered across the duration (kept modest: plenty of crackle
    // texture without building an oversized one-off node graph)
    var grains = 20;
    for (var i = 0; i < grains; i++) {
      var gt = t0 + Math.random() * total;
      var gdur = 0.003 + Math.random() * 0.006;
      var gsrc = noiseSource(c, gdur);
      var gf = bandpass(c, 700 + Math.random() * 4200, 3 + Math.random() * 5);
      var gpeak = 0.02 + Math.random() * 0.035;
      var gg = gainEnv(c, gt, [[0, 0.0001], [0.001, gpeak], [gdur, 0.0001]]);
      gsrc.connect(gf); gf.connect(gg); gg.connect(master);
      gsrc.start(gt); gsrc.stop(gt + gdur + 0.002);
      autoStop(gsrc, [gf, gg]);
    }
  }

  function buildPoof(c, dest, t0) {
    var dur = 0.3;
    var src = noiseSource(c, dur);
    var f = bandpass(c, 3200, 0.9);
    f.frequency.setValueAtTime(3200, t0);
    f.frequency.exponentialRampToValueAtTime(500, t0 + dur);
    var g = gainEnv(c, t0, [[0, 0.0001], [0.02, 0.1], [0.12, 0.055], [dur, 0.0001]]);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + dur + 0.01);
    autoStop(src, [f, g]);
  }

  function buildGenie(c, dest, t0) {
    var dur = 0.4;
    var src = noiseSource(c, dur);
    var f = bandpass(c, 1200, 0.7);
    f.frequency.setValueAtTime(1200, t0);
    f.frequency.linearRampToValueAtTime(2600, t0 + dur * 0.5);
    f.frequency.linearRampToValueAtTime(900, t0 + dur);
    var g = gainEnv(c, t0, [[0, 0.0001], [0.08, 0.05], [0.28, 0.03], [dur, 0.0001]]);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + dur + 0.01);
    autoStop(src, [f, g]);
  }

  function buildAlert(c, dest, t0) {
    tone(c, dest, t0, 0.09, 880, 0.1);
    tone(c, dest, t0 + 0.11, 0.11, 1175, 0.1);
  }

  // The real startup chime (chime-data.js), fetched and decoded once audio is unlocked
  var chimeBuffer = null, chimeDecoding = false;
  function loadChime() {
    if (chimeBuffer || chimeDecoding) return;
    if (!window.BzChimeMP3) {
      if (window.BzLazy) window.BzLazy(["js/chime-data.js"], function (ok) { if (ok && window.BzChimeMP3) loadChime(); });
      return;
    }
    try {
      var bin = atob(window.BzChimeMP3), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      chimeDecoding = true;
      ctx.decodeAudioData(bytes.buffer, function (buf) { chimeBuffer = buf; chimeDecoding = false; }, function () { chimeDecoding = false; });
    } catch (e) { chimeDecoding = false; }
  }

  function playRecordedChime() {
    var src = ctx.createBufferSource();
    src.buffer = chimeBuffer;
    var g = ctx.createGain();
    g.gain.value = 0.28; // the recording peaks at +0.7 dBFS; this lands it near −10 dBFS
    src.connect(g); g.connect(ctx.destination);
    src.start(ctx.currentTime, 0.02); // skip the file's 20 ms lead-in
    autoStop(src, [g]);
  }

  // Fallback startup chime: an F-sharp major chord, as on G3/G4-era Macs. An original synthesis,
  // not Apple's recording: detuned warm saw voices through a closing low-pass,
  // a sub-octave for body, and a generated reverb tail.
  function impulse(c, dur, decay) {
    var len = Math.round(c.sampleRate * dur);
    var buf = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function buildChime(c, dest, t0) {
    var master = c.createGain();
    master.gain.value = 0.85;
    var dry = c.createGain();
    dry.gain.value = 0.8;
    var wet = c.createGain();
    wet.gain.value = 0.32;
    var verb = c.createConvolver();
    verb.buffer = impulse(c, 2.6, 2.4);
    master.connect(dry); dry.connect(dest);
    master.connect(verb); verb.connect(wet); wet.connect(dest);

    // F#2 C#3 F#3 A#3 C#4 F#4 A#4
    var notes = [92.5, 138.59, 185, 233.08, 277.18, 369.99, 466.16];
    var weights = [1, 0.8, 0.85, 0.62, 0.6, 0.45, 0.25];
    var end = t0 + 3.8;
    notes.forEach(function (freq, i) {
      [-5, 5].forEach(function (cents) {
        var o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = freq;
        o.detune.value = cents + (Math.random() * 2 - 1);
        var lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.Q.value = 0.6;
        lp.frequency.setValueAtTime(3400, t0);
        lp.frequency.exponentialRampToValueAtTime(1000, t0 + 1.1);
        lp.frequency.exponentialRampToValueAtTime(420, t0 + 3.4);
        var peak = weights[i] * 0.07;
        var g = gainEnv(c, t0, [[0, 0.0001], [0.018, peak], [0.4, peak * 0.55], [3.6, 0.0001]]);
        o.connect(lp); lp.connect(g); g.connect(master);
        o.start(t0); o.stop(end);
        autoStop(o, [lp, g]);
      });
    });
    var sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 46.25;
    var sg = gainEnv(c, t0, [[0, 0.0001], [0.03, 0.22], [3.2, 0.0001]]);
    sub.connect(sg); sg.connect(master);
    sub.start(t0); sub.stop(end);
    autoStop(sub, [sg]);
  }

  var SOUNDS = {
    chime: buildChime,
    down: buildDown,
    up: buildUp,
    down2: buildDown2,
    up2: buildUp2,
    key: buildKey,
    mod: buildMod,
    "return": buildReturn,
    space: buildSpace,
    keyup: buildKeyUp,
    trash: buildTrash,
    poof: buildPoof,
    genie: buildGenie,
    alert: buildAlert
  };

  // ── public API ────────────────────────────────────────────────────────────

  function play(name) {
    if (muted) return;
    if (!ctx) return; // no gesture yet: silent no-op
    var builder = SOUNDS[name];
    if (!builder) return;
    try {
      resumeCtx();
      if (name === "chime") {
        if (chimeBuffer) return playRecordedChime();
        loadChime(); // not in yet (or failed earlier): try again for next time, and synthesize this one
      }
      builder(ctx, ctx.destination, ctx.currentTime);
    } catch (e) {
      // never throw
    }
  }

  function setMuted(m) {
    muted = !!m;
    writeMuted(muted);
  }

  function toggle() {
    setMuted(!muted);
    return muted;
  }

  // Every mouse button is a physical switch: left, right (context menus) and middle all click.
  // The right one is a different micro-switch, so it sits a little higher.
  function onPointerDown(e) {
    if (e.button >= 0 && e.button <= 2) play(e.button === 2 ? "down2" : "down");
  }

  function onPointerUp(e) {
    if (e.button >= 0 && e.button <= 2) play(e.button === 2 ? "up2" : "up");
  }

  var MODS = { Shift: 1, Meta: 1, Alt: 1, Control: 1, CapsLock: 1, Fn: 1 };
  var HEAVY = { Enter: 1, Backspace: 1, Tab: 1, Delete: 1, Escape: 1 };
  var boundKeys = false;

  function onKeyDown(e) {
    if (e.repeat) return; // a held key autorepeats silently, like real hardware
    var k = e.key;
    play(k === " " ? "space" : HEAVY[k] ? "return" : MODS[k] ? "mod" : "key");
  }

  function onKeyUp() { play("keyup"); }

  function bindKeys() {
    if (boundKeys) return;
    boundKeys = true;
    try {
      document.addEventListener("keydown", onKeyDown, { capture: true, passive: true });
      document.addEventListener("keyup", onKeyUp, { capture: true, passive: true });
    } catch (e) {}
  }

  function bindClicks() {
    if (boundClicks) return;
    boundClicks = true;
    try {
      document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
      document.addEventListener("pointerup", onPointerUp, { capture: true, passive: true });
    } catch (e) {}
  }

  window.BzSound = {
    play: play,
    muted: function () { return muted; },
    setMuted: setMuted,
    toggle: toggle,
    bindClicks: bindClicks,
    bindKeys: bindKeys
  };

  // Test-only hook: renders a named sound's graph into any given AudioContext
  // (typically an OfflineAudioContext), bypassing mute state and gesture
  // unlocking. Not part of the public API; used by the verification harness.
  window.BzSound._render = function (name, c, dest, t0) {
    var builder = SOUNDS[name];
    if (!builder) return false;
    builder(c, dest || c.destination, t0 != null ? t0 : c.currentTime);
    return true;
  };
})();
