// BzScreensaver - thin wrapper around the vendored Flurry-WebGL port
// (variants/vendor/flurry/). Boots/tears down Flurry's own renderer + render
// loop, fades a full-viewport canvas in/out, and handles idle/hot-corner
// auto-start and macOS-style dismiss-on-input.
//
// Load order expected by the host page: all files in variants/vendor/flurry/js
// (in the order listed in its README), then this file.
window.BzScreensaver = (function()
{
  var CANVAS_ID        = 'bzFlurryCanvas';
  var Z_INDEX          = 1950;
  var FADE_IN_MS        = 800;
  var FADE_OUT_MS       = 300;
  var DISMISS_MOVE_PX   = 6;
  var MAX_RENDER_DIM    = 2200; // device-px cap on the longer edge, for perf
  var MAX_PIXEL_RATIO   = 2;

  var canvas      = null;
  var renderer    = null;
  var glAvailable = false;
  var active      = false; // true from start() until teardown() finishes
  var fadingOut   = false;

  var resizeHandler   = null;
  var fadeOutTimer    = null;
  var moveStartX      = null;
  var moveStartY      = null;

  var idleMs    = 120000;
  var idleTimer = null;
  var idleBound = false;

  var cornerName    = null;
  var cornerMs      = 0;
  var cornerTimer   = null;
  var cornerBound   = false;

  var startGen = 0;

  // Flurry's files, in load order; fetched the first time the screensaver starts
  var FLURRY_FILES = [
    "vendor/flurry/js/vendor/gl-matrix-2.1.0.js",
    "vendor/flurry/js/Shaders.js",
    "vendor/flurry/js/Flurry.js",
    "vendor/flurry/js/enums/BlendModes.js",
    "vendor/flurry/js/enums/ColorModes.js",
    "vendor/flurry/js/data/Config.js",
    "vendor/flurry/js/util/ArrayOf.js",
    "vendor/flurry/js/util/Vectors.js",
    "vendor/flurry/js/util/Math.js",
    "vendor/flurry/js/Star.js",
    "vendor/flurry/js/Spark.js",
    "vendor/flurry/js/SmokeParticle.js",
    "vendor/flurry/js/Smoke.js",
    "vendor/flurry/js/Texture.js",
    "vendor/flurry/js/Renderer.js",
    "vendor/flurry/js/GLSaver.js"
  ];

  function hasFlurry()
  {
    return (typeof Flurry !== 'undefined') && !!Flurry.Renderer && !!Flurry.GLSaver;
  }

  function prefersReducedMotion()
  {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function computePixelRatio()
  {
    var dpr   = window.devicePixelRatio || 1;
    var ratio = Math.min(dpr, MAX_PIXEL_RATIO);
    var w     = window.innerWidth  * ratio;
    var h     = window.innerHeight * ratio;
    var maxWH = Math.max(w, h);

    if (maxWH > MAX_RENDER_DIM)
      ratio *= MAX_RENDER_DIM / maxWH;

    return ratio;
  }

  // ---------- boot / teardown ----------

  function makeCanvas()
  {
    var c = document.createElement('canvas');
    c.id = CANVAS_ID;
    c.style.position   = 'fixed';
    c.style.left       = '0';
    c.style.top        = '0';
    c.style.width      = '100%';
    c.style.height     = '100%';
    c.style.zIndex     = String(Z_INDEX);
    c.style.background = '#000';
    c.style.cursor     = 'none';
    c.style.opacity    = '0';
    c.style.transition = 'opacity ' + (FADE_IN_MS / 1000) + 's linear';
    return c;
  }

  // Returns true if Flurry actually booted (WebGL available); false means the
  // caller should just show the plain black canvas already in the DOM.
  function bootFlurry()
  {
    if (!hasFlurry())
      return false;

    try
    {
      renderer = new Flurry.Renderer(CANVAS_ID);
      renderer.pixelRatio = computePixelRatio();
      renderer.useShader('vertexShader');
      renderer.useShader('fragShader');
      renderer.setup();

      Flurry.renderer = renderer;

      // upstream workaround for a Firefox preserveDrawingBuffer resize glitch
      renderer.canvas.width  = 0;
      renderer.canvas.height = 0;
      renderer.resize();
      window.setTimeout(function()
      {
        if (!renderer) return;
        renderer.canvas.width  = 0;
        renderer.canvas.height = 0;
        renderer.resize();
      }, 100);

      Flurry.GLSaver.setup();
      Flurry.GLSaver.running = true;
      Flurry.GLSaver.render();
    }
    catch (e)
    {
      renderer = null;
      return false;
    }

    return true;
  }

  function onWindowResize()
  {
    if (!renderer) return;
    renderer.pixelRatio = computePixelRatio();
    renderer.resize();
  }

  function pauseRender()
  {
    if (!hasFlurry()) return;
    Flurry.GLSaver.running = false;
    if (Flurry.GLSaver.rafId != null)
    {
      window.cancelAnimationFrame(Flurry.GLSaver.rafId);
      Flurry.GLSaver.rafId = null;
    }
  }

  function resumeRender()
  {
    if (!active || fadingOut || !glAvailable || !hasFlurry()) return;
    if (Flurry.GLSaver.running) return;
    Flurry.GLSaver.running = true;
    Flurry.GLSaver.render();
  }

  function teardown()
  {
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }

    removeDismissListeners();
    pauseRender();

    if (renderer && renderer.gl)
    {
      var ext = renderer.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    renderer = null;

    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;

    glAvailable = false;
    active      = false;
    fadingOut   = false;

    restartIdleTimer();
  }

  function scheduleFadeOutTeardown()
  {
    if (fadeOutTimer) window.clearTimeout(fadeOutTimer);
    fadeOutTimer = window.setTimeout(function()
    {
      fadeOutTimer = null;
      teardown();
    }, FADE_OUT_MS);
  }

  // ---------- dismiss handling ----------
  // Capture-phase listeners on window fire before any bubble-phase listener
  // anywhere else in the document (including one the host page registers on
  // document), so stopPropagation() here keeps the event from ever reaching it.

  function dismiss(e)
  {
    if (!active || fadingOut) return;
    if (Date.now() < graceUntil)
    {
      e.stopPropagation();
      e.preventDefault();
      moveStartX = null; // movement after the grace period counts from wherever the pointer is then
      return;
    }
    fadingOut = true;

    e.stopPropagation();
    e.preventDefault();

    removeDismissListeners();

    if (canvas)
    {
      canvas.style.transition = 'opacity ' + (FADE_OUT_MS / 1000) + 's linear';
      canvas.style.opacity    = '0';
    }

    // render loop keeps going through the fade, then teardown() stops it
    scheduleFadeOutTeardown();
  }

  function onDismissKeydown(e)     { dismiss(e); }
  function onDismissPointerdown(e) { dismiss(e); }
  function onDismissWheel(e)       { dismiss(e); }

  function onDismissPointermove(e)
  {
    if (Date.now() < graceUntil) { moveStartX = null; return; }
    if (moveStartX === null)
    {
      moveStartX = e.clientX;
      moveStartY = e.clientY;
      return;
    }

    var dx = e.clientX - moveStartX;
    var dy = e.clientY - moveStartY;

    if ((dx * dx + dy * dy) > (DISMISS_MOVE_PX * DISMISS_MOVE_PX))
      dismiss(e);
  }

  function addDismissListeners()
  {
    moveStartX = null;
    moveStartY = null;
    window.addEventListener('keydown', onDismissKeydown, true);
    window.addEventListener('pointerdown', onDismissPointerdown, true);
    window.addEventListener('wheel', onDismissWheel, true);
    window.addEventListener('pointermove', onDismissPointermove, true);
  }

  function removeDismissListeners()
  {
    window.removeEventListener('keydown', onDismissKeydown, true);
    window.removeEventListener('pointerdown', onDismissPointerdown, true);
    window.removeEventListener('wheel', onDismissWheel, true);
    window.removeEventListener('pointermove', onDismissPointermove, true);
  }

  // ---------- idle auto-start ----------

  function clearIdleTimer()
  {
    if (idleTimer) { window.clearTimeout(idleTimer); idleTimer = null; }
  }

  function restartIdleTimer()
  {
    if (!idleBound) return;
    clearIdleTimer();
    idleTimer = window.setTimeout(onIdleTimeout, idleMs);
  }

  // the host can veto automatic starts (e.g. while the screen is asleep or booting)
  function hostAllows()
  {
    var api = window.BzScreensaver;
    try { return !(api && typeof api.canStart === 'function' && !api.canStart()); } catch (e) { return true; }
  }

  function onIdleTimeout()
  {
    idleTimer = null;
    if (document.hidden) return;
    if (prefersReducedMotion()) return;
    if (!active && hostAllows()) start();
  }

  function idleActivityHandler()
  {
    restartIdleTimer();
  }

  function bindIdle(ms)
  {
    idleMs = (typeof ms === 'number' && ms > 0) ? ms : 120000;

    if (!idleBound)
    {
      idleBound = true;
      window.addEventListener('pointermove', idleActivityHandler, false);
      window.addEventListener('keydown', idleActivityHandler, false);
      window.addEventListener('pointerdown', idleActivityHandler, false);
      window.addEventListener('wheel', idleActivityHandler, false);
    }

    restartIdleTimer();
  }

  // ---------- hot corner auto-start ----------

  function clearCornerTimer()
  {
    if (cornerTimer) { window.clearTimeout(cornerTimer); cornerTimer = null; }
  }

  // Measured on the visible page (clientWidth excludes a scrollbar); 16px is a comfortable target.
  function isInCorner(x, y, corner, margin)
  {
    var de = document.documentElement;
    var w = de.clientWidth || window.innerWidth, h = de.clientHeight || window.innerHeight, m = margin || 16;

    switch (corner)
    {
      case 'tl': return x <= m && y <= m;
      case 'tr': return x >= (w - m) && y <= m;
      case 'bl': return x <= m && y >= (h - m);
      case 'br': return x >= (w - m) && y >= (h - m);
      default:   return false;
    }
  }

  function cornerMoveHandler(e)
  {
    if (isInCorner(e.clientX, e.clientY, cornerName))
    {
      if (!cornerTimer)
      {
        cornerTimer = window.setTimeout(function()
        {
          cornerTimer = null;
          if (!active && hostAllows()) start();
        }, cornerMs);
      }
    }
    else
    {
      clearCornerTimer();
    }
  }

  // In a windowed browser the viewport corner isn't a screen edge, so the pointer slides past it.
  // Leaving the page through the corner region counts as resting in the corner.
  function cornerLeaveHandler(e)
  {
    if (e.relatedTarget) return; // still inside the page
    if (!isInCorner(e.clientX, e.clientY, cornerName, 48)) return;
    if (!cornerTimer)
    {
      cornerTimer = window.setTimeout(function()
      {
        cornerTimer = null;
        if (!active && hostAllows()) start();
      }, Math.min(cornerMs, 400));
    }
  }

  function bindHotCorner(corner, ms)
  {
    cornerName = corner || 'br';
    cornerMs   = (typeof ms === 'number' && ms > 0) ? ms : 700;

    if (!cornerBound)
    {
      cornerBound = true;
      window.addEventListener('pointermove', cornerMoveHandler, true);
      document.addEventListener('pointerout', cornerLeaveHandler, true);
    }
  }

  // ---------- visibility ----------

  document.addEventListener('visibilitychange', function()
  {
    if (document.hidden)
    {
      if (active) pauseRender();
    }
    else
    {
      resumeRender();
      restartIdleTimer();
    }
  });

  // ---------- public API ----------

  // opts.grace (ms): ignore input right after a deliberate start (Apple menu › Sleep),
  // so the hand still on the mouse doesn't wake it immediately
  var graceUntil = 0;

  function start(opts)
  {
    if (active) return;

    graceUntil = (opts && opts.grace) ? Date.now() + opts.grace : 0;
    active    = true;
    fadingOut = false;

    canvas = makeCanvas();
    document.body.appendChild(canvas);

    void canvas.offsetWidth; // force layout so the opacity transition animates
    canvas.style.opacity = '1';

    // Flurry boots once its files are in (at once after the first time); until then, or if it
    // can't (no WebGL, files failed to load), the plain black canvas stays up and still dismisses.
    glAvailable = false;
    var gen = ++startGen; // a stop() and start() while loading leave only this one to boot
    var boot = function (ok) { if (ok && gen === startGen && active && !fadingOut) glAvailable = bootFlurry(); };
    if (window.BzLazy) window.BzLazy(FLURRY_FILES, boot);
    else boot(hasFlurry());

    resizeHandler = onWindowResize;
    window.addEventListener('resize', resizeHandler);

    addDismissListeners();

    clearIdleTimer();
    clearCornerTimer();
  }

  function stop()
  {
    if (!active) return;

    if (fadeOutTimer) { window.clearTimeout(fadeOutTimer); fadeOutTimer = null; }
    fadingOut = true;
    teardown();
  }

  function running()
  {
    return active;
  }

  return {
    start: start,
    stop: stop,
    running: running,
    bindIdle: bindIdle,
    bindHotCorner: bindHotCorner
  };
})();
