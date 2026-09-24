/* Talks to the Safari window around this page (works on file:// and https alike):
   reports what loaded, and routes links through Safari instead of reaching out of the frame. */
(function () {
  if (window.parent === window) return;
  // only to this site's own Safari window (a page from file:// has an opaque origin, so there it's "*"),
  // so a site embedding these pages can't listen in, on the guestbook's keystrokes least of all
  var parentOrigin = location.protocol === "file:" ? "*" : location.origin;
  function send(msg) { try { window.parent.postMessage(msg, parentOrigin); } catch (e) {} }
  var doc = Math.random().toString(36).slice(2); // tells Safari which document a message comes from
  send({ bzSafari: "loaded", doc: doc, title: document.title });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // modified clicks stay the browser's
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    if (/^https?:\/\//i.test(href)) { e.preventDefault(); send({ bzSafari: "external", url: href }); }
    else if (/^[\w-]+\.html(#[\w-]*)?$/i.test(href)) { e.preventDefault(); send({ bzSafari: "navigate", href: href }); }
  }, true);
  // in-page anchors (#about, #links) scroll the frame by themselves; Safari still shows and remembers them
  window.addEventListener("hashchange", function () { send({ bzSafari: "hash", doc: doc, tail: location.search + location.hash }); });
  // typing here (the guestbook form) clicks like typing anywhere else on the desktop
  ["keydown", "keyup"].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (e.repeat) return; // a held key clicks once
      send({ bzSafari: "key", type: type, code: e.code, key: e.key, isComposing: e.isComposing || e.keyCode === 229 });
    }, true);
  });
  window.addEventListener("blur", function () { send({ bzSafari: "key", type: "blur" }); });
  // ...and clicking here clicks too, and brings Safari's window to the front
  ["pointerdown", "pointerup"].forEach(function (type) {
    document.addEventListener(type, function (e) { send({ bzSafari: "pointer", type: type, button: e.button }); }, true);
  });
  window.addEventListener("message", function (e) {
    if (e.source === window.parent && e.data && e.data.bzSafari === "state") {
      document.documentElement.classList.toggle("inactive", !e.data.active);
    }
  });
})();
