/* The contact address, kept out of the page source: stored XOR-encoded and decoded only when
   a person reaches for a link (pointer over it, keyboard focus, or a click), so middle-click
   and Copy Link get the real mailto too. Links opt in with class="js-email";
   a click shows the address unless data-reveal="keep". */
(function () {
  "use strict";

  var K = [83, 243, 39, 102, 167];
  var D = [49, 156, 79, 2, 198, 61, 179, 93, 14, 210, 33, 146, 81, 3, 203, 125, 145, 93];
  var SUBJECT = "Hello from bohdan.zhuravel.bz"; // so a note from the site stands out in the inbox

  function address() {
    return D.map(function (c, i) { return String.fromCharCode(c ^ K[i % K.length]); }).join("");
  }

  function href() { return "mailto:" + address() + "?subject=" + encodeURIComponent(SUBJECT); }

  function bindAll() {
    Array.prototype.forEach.call(document.querySelectorAll("a.js-email"), function (el) {
      function arm() { el.href = href(); }
      el.addEventListener("pointerenter", arm);
      el.addEventListener("focus", arm);
      el.addEventListener("click", function () {
        arm(); // before the default action runs, so this very click opens mail
        if (el.getAttribute("data-reveal") !== "keep") el.textContent = address();
      });
    });
  }

  window.BzEmail = { address: address, href: href };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindAll);
  else bindAll();
})();
