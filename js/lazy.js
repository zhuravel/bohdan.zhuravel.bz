/* BzLazy(urls, done): loads scripts the first time something needs them, running them in order
   like the <script> tags they replace. done(ok) runs once they have (at once if they already did).
   A failed load is forgotten, so the next call tries again. */
(function () {
  "use strict";
  var state = {}; // urls.join(" ") → true once loaded, or the callbacks waiting for it

  window.BzLazy = function (urls, done) {
    var key = urls.join(" ");
    if (state[key] === true) return done(true);
    if (state[key]) return state[key].push(done);
    var waiting = state[key] = [done], left = urls.length, settled = false;
    function settle(ok) {
      if (settled) return;
      settled = true;
      state[key] = ok || undefined;
      waiting.forEach(function (cb) { try { cb(ok); } catch (e) {} });
    }
    urls.forEach(function (url) {
      var s = document.createElement("script");
      s.src = url;
      s.async = false; // keep their order
      s.onload = function () { if (--left === 0) settle(true); };
      s.onerror = function () { s.remove(); settle(false); };
      document.head.appendChild(s);
    });
  };
})();
