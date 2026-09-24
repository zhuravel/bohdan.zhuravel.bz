# Flurry (vendored)

Source: https://github.com/RoyCurtis/Flurry-WebGL
Commit: ab9d489bd7b4b2a48da5d8393d80d6ae422ebb3e (2018-08-24)
License: MIT (see LICENSE in this directory; copied from upstream LICENSE.md).
Upstream's notice: the HTML/CSS/JS here is MIT-licensed by Roy Adrian Curtis, who
states he ported large parts of it from Calum Robinson's original (also
open-source) Flurry screensaver, with permission.

## What's vendored and why

Only the files needed to run the simulation headlessly, without dat.GUI, an FPS
meter, or index.html, were kept:

- `js/Flurry.js` - namespace + constants (unmodified; `Flurry.main()` is defined
  but never called by the wrapper, so its dat.GUI/Stats references are dead code)
- `js/GLSaver.js` - sim state + render loop (**modified**, see below)
- `js/Renderer.js` - WebGL setup/draw calls (**modified**, see below)
- `js/Star.js`, `js/Spark.js`, `js/Smoke.js`, `js/SmokeParticle.js`, `js/Texture.js`
  - unmodified. Texture.js generates its texture procedurally on the GPU; nothing
    here fetches an image or any other resource.
- `js/enums/BlendModes.js`, `js/enums/ColorModes.js` - unmodified
- `js/util/Math.js`, `js/util/Vectors.js`, `js/util/ArrayOf.js` - unmodified
- `js/data/Config.js` - unmodified. This *is* Panther's classic Flurry look
  (additive blend, Tiedye color mode, 5 streams, etc.) - it's identical to the
  "Default" entry in upstream's `js/data/Presets.js`.
- `js/vendor/gl-matrix-2.1.0.js` - unmodified (only `mat4.ortho`/`mat4.identity`
  are used, by Renderer.js)
- `js/Shaders.js` - **new file, not from upstream** (see below)

Dropped (unused by the wrapper, so not vendored):

- `js/vendor/dat.gui-0.5.js`, `js/vendor/Stats-r11.js` - only used by
  `Flurry.setupGui()`, which the wrapper never calls (no on-screen GUI/FPS meter
  for a screensaver)
- `js/data/Presets.js` - only consumed by dat.GUI's preset loader; `Config.js`
  already equals the "Default"/Classic preset, so the wrapper uses it directly
- `js/util/Colors.js` (`ColorC`) - only used inside the dat.GUI color-picker
  `onChange` callback in `Flurry.js`, which is dead code here
- `index.html`, `css/index.css`, `res/*`, `docs/*`, `original/*`,
  `browserconfig.xml`, `favicon.ico` - page chrome / favicons / reference C
  source, not needed to run the sim

## Changes made to upstream code

1. **`js/Renderer.js` - `resize()`**: upstream sizes the canvas's backing buffer to
   raw `window.innerWidth`/`innerHeight` (i.e. always renders at 1 device pixel
   per CSS pixel, uncapped). Changed it to use `this.canvas.clientWidth/Height *
   (this.pixelRatio || 1)`, where `this.pixelRatio` is a plain property the
   wrapper sets to a capped devicePixelRatio. This is what gives the wrapper DPR
   handling and a render-resolution cap. Also dropped a `console.log` line. No
   other logic changed.

2. **`js/GLSaver.js` - `render()`**: upstream's `render()` unconditionally calls
   `window.requestAnimationFrame(Flurry.GLSaver.render)` as its first statement,
   with no way to ever stop the loop short of navigating away (this is a
   screensaver demo page, not an embeddable component). Added a
   `Flurry.GLSaver.running` flag checked at the top of `render()` (returns
   immediately if false) and stored the frame handle in `Flurry.GLSaver.rafId` so
   the wrapper can `cancelAnimationFrame` it. No other logic in the function
   changed.

3. **`js/Shaders.js` (new)**: upstream keeps its two GLSL programs as inline
   `<script id="vertexShader">`/`<script id="fragShader">` tags in `index.html`,
   which `Renderer.prototype.useShader(id)` reads via
   `document.getElementById(id).innerHTML` - not a fetch/XHR, but it does require
   those DOM nodes to exist on the host page. Since the wrapper isn't allowed to
   edit the host page (desktop.html), this file injects the same two DOM nodes at
   load time instead, with the GLSL source copied byte-for-byte from upstream's
   `index.html`. `Renderer.useShader()` itself was not touched.

Nothing here performs a `fetch`/`XMLHttpRequest`/`Image().src` load of any local
file at runtime; the only "loading" of an asset (the shaders) was already a
synchronous DOM read, now satisfied by `js/Shaders.js` instead of host-page markup.

## Load order

The host page must load these as plain `<script>` tags, in this order, followed
by `variants/screensaver.js`:

```html
<script src="variants/vendor/flurry/js/vendor/gl-matrix-2.1.0.js"></script>
<script src="variants/vendor/flurry/js/Shaders.js"></script>
<script src="variants/vendor/flurry/js/Flurry.js"></script>
<script src="variants/vendor/flurry/js/enums/BlendModes.js"></script>
<script src="variants/vendor/flurry/js/enums/ColorModes.js"></script>
<script src="variants/vendor/flurry/js/data/Config.js"></script>
<script src="variants/vendor/flurry/js/util/ArrayOf.js"></script>
<script src="variants/vendor/flurry/js/util/Vectors.js"></script>
<script src="variants/vendor/flurry/js/util/Math.js"></script>
<script src="variants/vendor/flurry/js/Star.js"></script>
<script src="variants/vendor/flurry/js/Spark.js"></script>
<script src="variants/vendor/flurry/js/SmokeParticle.js"></script>
<script src="variants/vendor/flurry/js/Smoke.js"></script>
<script src="variants/vendor/flurry/js/Texture.js"></script>
<script src="variants/vendor/flurry/js/Renderer.js"></script>
<script src="variants/vendor/flurry/js/GLSaver.js"></script>
<script src="variants/screensaver.js"></script>
```

`GLSaver.js` must be last of the vendor files: its top level constructs
`Flurry.Smoke`/`Flurry.Star`/`Flurry.Spark` instances immediately (not lazily),
so `Flurry.js`, the enums, and `util/*`, `Star.js`, `Spark.js`,
`SmokeParticle.js`, `Smoke.js` must all be defined first. `enums/*` must precede
`data/Config.js` for the same reason (it reads `BlendModes.Additive` /
`ColorModes.Tiedye` at parse time). Everything else only touches these symbols
from inside function bodies, so their relative order doesn't matter.

Then, once at page setup:

```html
<script>
  BzScreensaver.bindIdle(120000);
  BzScreensaver.bindHotCorner('br', 700);
</script>
```
