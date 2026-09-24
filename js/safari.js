/* bz — a Safari 1.2-era (Mac OS X 10.3 Panther) browser window, showing the
   2004-era version of this site by default. Same wiring convention as
   finder.js: one injected <style>, chrome built onto the host's .window
   section after .titlebar, everything looked up via win.querySelector (never
   document.getElementById) because the host clones the section for its
   genie/minimize animations and strips ids from the clone. */
(function () {
  "use strict";

  var CSS_ID = "bz-safari-css";
  var OWNER_HOSTS = ["bohdan.zhuravel.bz", "zhuravel.bz", "bohdan.bz", "bohdanzhuravel.com"];
  var CANONICAL_HOST = "bohdan.zhuravel.bz";
  var SITE_DIR = "2004/";
  var HOME_TITLE = "Bohdan Zhuravel's Homepage";

  // ── one-time CSS injection ───────────────────────
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css =
      ".s-toolbar{display:flex;align-items:center;gap:6px;padding:6px 8px;background:transparent;border-bottom:1px solid rgba(0,0,0,.22);font-family:'Lucida Grande','Lucida Sans Unicode',Geneva,Verdana,sans-serif;}" +
      ".s-navbtn{display:flex;align-items:center;justify-content:center;width:26px;height:24px;flex:0 0 auto;border:1px solid rgba(0,0,0,.45);border-radius:6px;background:linear-gradient(#fbfbfb,#d8d8d8 45%,#c2c2c2);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 1px 1px rgba(0,0,0,.15);color:#333;cursor:default;padding:0;}" +
      ".s-navbtn:active:not(:disabled){background:linear-gradient(#b7b7b7,#9c9c9c);}" +
      ".s-navbtn:disabled{opacity:.35;}" +
      ".s-navbtn .s-ico{display:block;width:11px;height:11px;}" +
      ".s-reload{position:relative;}" +
      ".s-reload .s-ico-stop{display:none;}" +
      ".s-reload.s-stopmode .s-ico-reload{display:none;}" +
      ".s-reload.s-stopmode .s-ico-stop{display:block;}" +
      ".s-addbm{border-radius:50%;width:22px;height:22px;flex:0 0 auto;font:bold 14px/20px Georgia,'Times New Roman',serif;color:#333;margin-left:2px;}" +
      "@keyframes s-pop{0%{transform:scale(1);}45%{transform:scale(1.3);}100%{transform:scale(1);}}" +
      ".s-addbm.s-pop{animation:s-pop .3s ease;}" +
      ".s-address{position:relative;flex:1 1 auto;min-width:110px;display:flex;align-items:center;gap:5px;height:21px;padding:0 6px;background:#fdfdfd;border-radius:11px;border:1px solid #8c8c8c;box-shadow:inset 0 1px 3px rgba(0,0,0,.4);overflow:hidden;}" +
      ".s-page-icon{position:relative;z-index:1;flex:0 0 auto;display:flex;}" +
      ".s-page-icon svg{display:block;width:11px;height:11px;}" +
      ".s-progress{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(180deg,#cfe2ff,#4a86f7 55%,#2360cf);opacity:0;pointer-events:none;transition:opacity .4s ease;}" +
      ".s-address.s-loading .s-progress{opacity:.92;}" +
      ".s-address-input{position:relative;z-index:1;flex:1 1 auto;min-width:0;border:0;background:transparent;font:11px/1.2 'Lucida Grande',Tahoma,sans-serif;color:#111;}" +
      ".s-address-input:focus{outline:none;}" +
      ".s-snapback{position:relative;z-index:1;flex:0 0 auto;width:15px;height:15px;border-radius:50%;border:0;padding:0;background:radial-gradient(circle at 35% 30%,#ffb066,#ff8a1f 55%,#d9670a);box-shadow:0 0 0 1px rgba(0,0,0,.3);cursor:default;}" +
      ".s-snapback[hidden]{display:none;}" +
      ".s-snapback svg{display:block;width:100%;height:100%;}" +
      ".s-google{position:relative;flex:0 0 120px;display:flex;align-items:center;gap:4px;height:21px;padding:0 6px;background:#fdfdfd;border-radius:11px;border:1px solid #8c8c8c;box-shadow:inset 0 1px 3px rgba(0,0,0,.4);}" +
      ".s-google-icon{flex:0 0 auto;display:flex;}" +
      ".s-google-icon svg{display:block;width:10px;height:10px;}" +
      ".s-google-input{flex:1 1 auto;min-width:0;border:0;background:transparent;font:11px/1.2 'Lucida Grande',Tahoma,sans-serif;color:#111;}" +
      ".s-google-input::placeholder{color:#9a9a9a;}" +
      ".s-google-input:focus{outline:none;}" +
      ".s-bookmarks{display:flex;align-items:center;flex-wrap:wrap;gap:2px 2px;padding:4px 10px;background:transparent;border-bottom:1px solid rgba(0,0,0,.18);font:11px 'Lucida Grande',Tahoma,sans-serif;position:relative;}" +
      ".s-bm{display:inline-block;padding:2px 7px;border-radius:4px;border:0;background:transparent;color:#1a2f4d;text-decoration:none;text-shadow:0 1px 0 rgba(255,255,255,.5);font:11px 'Lucida Grande',Tahoma,sans-serif;cursor:default;}" +
      ".s-bm:hover{background:rgba(255,255,255,.5);}" +
      ".s-bm:active{background:rgba(0,0,0,.12);}" +
      ".s-news{position:relative;padding:0;}" +
      ".s-caret{font-size:9px;}" +
      ".s-news-drop{display:none;position:absolute;top:100%;left:0;min-width:230px;background:rgba(255,255,255,.98);border:1px solid rgba(0,0,0,.3);border-radius:0 0 5px 5px;box-shadow:0 6px 16px rgba(0,0,0,.35);padding:3px 0;z-index:20;}" +
      ".s-news.s-open .s-news-drop{display:block;}" +
      ".s-news-drop a{display:block;padding:3px 12px;color:#1a2f4d;text-decoration:none;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".s-news-drop a:hover{background:#3875d7;color:#fff;}" +
      ".s-content{height:var(--sh,460px);background:#fff;position:relative;}" +
      ".s-frame{display:block;width:100%;height:100%;border:0;background:#fff;}" +
      ".s-status{height:18px;padding:0 10px;display:flex;align-items:center;background:transparent;border-top:1px solid rgba(0,0,0,.18);font:11px 'Lucida Grande',Tahoma,sans-serif;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "@media (max-width:520px){.s-content{height:300px;}.s-google{flex-basis:90px;}.s-bm{padding:2px 5px;}}" +
      "@media (prefers-reduced-motion: reduce){.s-addbm.s-pop{animation:none;}}";
    var style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── URL handling ───────────────────────
  // Recognizes the owner's domains (canonical + 3 aliases), with or without a
  // scheme/www, and splits off a path and a #hash/?query "tail".
  function parseOwnerUrl(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return null;
    var m = /^[a-z][a-z0-9+.-]*:\/\//i.exec(s);
    var rest = m ? s.slice(m[0].length) : s;
    if (!m && /^[a-z][a-z0-9+.-]*:/i.test(rest)) return null; // mailto:, javascript:, etc.
    var tailIdx = rest.search(/[?#]/);
    var pathPart = tailIdx === -1 ? rest : rest.slice(0, tailIdx);
    var tail = tailIdx === -1 ? "" : rest.slice(tailIdx);
    var slashIdx = pathPart.indexOf("/");
    var hostRaw = slashIdx === -1 ? pathPart : pathPart.slice(0, slashIdx);
    var pathRaw = slashIdx === -1 ? "" : pathPart.slice(slashIdx);
    hostRaw = hostRaw.replace(/^www\./i, "").replace(/:\d+$/, "").toLowerCase();
    if (OWNER_HOSTS.indexOf(hostRaw) === -1) return null;
    pathRaw = pathRaw || "/";
    if (/^\/index\.html$/i.test(pathRaw)) pathRaw = "/"; // so a clicked "Home" link matches the typed-domain home path
    return { host: hostRaw, isAlias: hostRaw !== CANONICAL_HOST, path: pathRaw, tail: tail };
  }

  function normalizeExternal(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;
    if (!s) return s;
    if (/\s/.test(s) || s.indexOf(".") === -1) {
      return "https://www.google.com/search?q=" + encodeURIComponent(s);
    }
    return "http://" + s;
  }

  // "?a=1#top" → { query: "?a=1", hash: "#top" }
  function splitTail(tail) {
    var s = tail == null ? "" : String(tail), hash = s.replace(/^[^#]*/, "");
    return { query: s.slice(0, s.length - hash.length), hash: hash };
  }

  // Reload's cache-buster goes in the query, before any #fragment (after it, the browser would only scroll)
  function withCacheBust(file, tail) {
    var t = splitTail(tail);
    return file + (t.query ? t.query + "&" : "?") + "_r=" + Date.now() + t.hash;
  }

  // ...and never shows up in the address or history when the page reports where it is
  function withoutCacheBust(tail) {
    var t = splitTail(tail);
    var params = t.query.slice(1).split("&").filter(function (p) { return p && !/^_r=\d+$/.test(p); });
    return (params.length ? "?" + params.join("&") : "") + t.hash;
  }

  function siteFileFor(path) {
    var p = String(path || "/").replace(/^\/+/, "");
    p = p.replace(new RegExp("^" + SITE_DIR), "");
    if (!p) p = "index.html";
    return SITE_DIR + p;
  }

  function pageTitle(iframe) {
    try { return iframe.contentDocument ? iframe.contentDocument.title : null; }
    catch (e) { return null; }
  }

  // easeOut with two brief stalls, so the fill doesn't move at a constant rate
  function loadCurve(t) {
    if (t < 0.35) return (t / 0.35) * 0.45;
    if (t < 0.5) return 0.45;
    if (t < 0.8) return 0.45 + ((t - 0.5) / 0.3) * 0.4;
    if (t < 0.9) return 0.85;
    return 0.85 + ((t - 0.9) / 0.1) * 0.15;
  }

  window.BzSafari = function (opts) {
    if (opts.win._bzSafariApi) return opts.win._bzSafariApi;

    injectCSS();

    var win = opts.win;
    var isActive = opts.isActive || function () { return true; };
    var reveal = opts.reveal || function () {};
    var openExternal = opts.openExternal || function (u) { window.open(u, "_blank", "noopener"); };
    var sound = opts.sound;
    function play(name) { if (sound && sound.play) sound.play(name); }

    // ── build chrome ──
    var titlebar = win.querySelector(".titlebar");
    var titleH2 = titlebar.querySelector("h2");

    var toolbar = document.createElement("div");
    toolbar.className = "s-toolbar";
    toolbar.setAttribute("data-drag", "");
    toolbar.innerHTML =
      '<button type="button" class="s-navbtn s-back" aria-label="Back" disabled>' +
      '<svg class="s-ico" viewBox="0 0 10 10" aria-hidden="true"><path d="M7 1 2 5l5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<button type="button" class="s-navbtn s-fwd" aria-label="Forward" disabled>' +
      '<svg class="s-ico" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<button type="button" class="s-navbtn s-reload" aria-label="Reload">' +
      '<svg class="s-ico s-ico-reload" viewBox="0 0 14 14" aria-hidden="true"><path d="M11.3 3.6A5 5 0 1 0 12.5 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M11.6 1v3.2h-3.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<svg class="s-ico s-ico-stop" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>' +
      '<div class="s-address">' +
      '<span class="s-page-icon" aria-hidden="true"><svg viewBox="0 0 12 12"><rect x="2" y="1" width="8" height="10" rx="1" fill="#fff" stroke="#9aa4b0"/><line x1="3.5" y1="4" x2="8.5" y2="4" stroke="#9aa4b0"/><line x1="3.5" y1="6" x2="8.5" y2="6" stroke="#9aa4b0"/><line x1="3.5" y1="8" x2="7" y2="8" stroke="#9aa4b0"/></svg></span>' +
      '<span class="s-progress" aria-hidden="true"></span>' +
      '<input type="text" class="s-address-input" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Address" />' +
      '<button type="button" class="s-snapback" aria-label="SnapBack to home page" hidden>' +
      '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M11 7A4 4 0 1 1 8 3.2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M8 1.1 8.7 3.6 6.2 3.9Z" fill="#fff"/></svg></button>' +
      "</div>" +
      '<button type="button" class="s-navbtn s-addbm" aria-label="Add Bookmark">+</button>' +
      '<div class="s-google">' +
      '<span class="s-google-icon" aria-hidden="true"><svg viewBox="0 0 12 12"><circle cx="5" cy="5" r="3.4" fill="none" stroke="#6b7684" stroke-width="1.3"/><line x1="7.4" y1="7.4" x2="10.6" y2="10.6" stroke="#6b7684" stroke-width="1.3" stroke-linecap="round"/></svg></span>' +
      '<input type="text" class="s-google-input" placeholder="Google" spellcheck="false" autocomplete="off" aria-label="Google Search" />' +
      "</div>";
    win.insertBefore(toolbar, titlebar.nextSibling);

    var bookmarks = document.createElement("div");
    bookmarks.className = "s-bookmarks";
    bookmarks.setAttribute("data-drag", "");
    bookmarks.innerHTML =
      '<a href="http://' + CANONICAL_HOST + '/" class="s-bm" data-owner="http://' + CANONICAL_HOST + '/">bohdan.zhuravel.bz</a>' +
      '<a href="https://github.com/zhuravel" class="s-bm" data-external target="_blank" rel="noopener">GitHub</a>' +
      '<a href="https://www.linkedin.com/in/bohdanzhuravel/" class="s-bm" data-external target="_blank" rel="noopener">LinkedIn</a>' +
      '<a href="https://www.talkable.com" class="s-bm" data-external target="_blank" rel="noopener">Talkable</a>' +
      '<div class="s-bm s-news">' +
      '<button type="button" class="s-news-btn">News <span class="s-caret">&#9662;</span></button>' +
      '<div class="s-news-drop">' +
      '<a href="http://www.apple.com/" data-external target="_blank" rel="noopener">Apple ships Mac OS X 10.3 &#8220;Panther&#8221;</a>' +
      '<a href="http://www.google.com/" data-external target="_blank" rel="noopener">Google files for its IPO</a>' +
      '<a href="http://www.mozilla.org/" data-external target="_blank" rel="noopener">Mozilla Firefox nears 1.0</a>' +
      "</div></div>";
    win.insertBefore(bookmarks, toolbar.nextSibling);

    var content = document.createElement("div");
    content.className = "s-content";
    content.innerHTML = '<iframe class="s-frame" title="Web content"></iframe>';
    win.insertBefore(content, bookmarks.nextSibling);

    var status = document.createElement("div");
    status.className = "s-status";
    status.setAttribute("data-drag", "");
    win.insertBefore(status, content.nextSibling);

    if (opts.growPixels) opts.growPixels(win, content, ["--sw", "--sh"], 480, 160); // grow box in the status bar's corner

    // ── refs ──
    var backBtn = toolbar.querySelector(".s-back");
    var fwdBtn = toolbar.querySelector(".s-fwd");
    var reloadBtn = toolbar.querySelector(".s-reload");
    var addBmBtn = toolbar.querySelector(".s-addbm");
    var addressWrap = toolbar.querySelector(".s-address");
    var addressInput = toolbar.querySelector(".s-address-input");
    var progressFill = toolbar.querySelector(".s-progress");
    var snapBtn = toolbar.querySelector(".s-snapback");
    var googleInput = toolbar.querySelector(".s-google-input");
    var newsEl = bookmarks.querySelector(".s-news");
    var iframe = content.querySelector(".s-frame");

    // ── state ──
    var hist = [];
    var histPos = -1;
    var currentPath = "/";
    var currentTail = "";
    var loading = false;
    var loadToken = 0;
    var frameDoc = null; // the page document whose hash changes count (null while another one loads)

    function computeFinalDisplay(path, tail) { return "http://" + CANONICAL_HOST + path + tail; }
    // does this address load another document than the one showing? (another path or query does, another #hash doesn't)
    function leavesDoc(path, tail) {
      return siteFileFor(path) + splitTail(tail).query !== siteFileFor(currentPath) + splitTail(currentTail).query;
    }
    function setAddress(text) { addressInput.value = text; }
    function setProgress(p) { progressFill.style.width = Math.round(p * 100) + "%"; addressWrap.dataset.progress = String(Math.round(p * 100)); }

    // ── loading animation: blue fill, ease-out with a couple of stalls, ~0.6-1.4s ──
    function runLoad(durationMs, statusUrl, onProgress) {
      loading = true;
      var token = ++loadToken;
      reloadBtn.classList.add("s-stopmode");
      addressWrap.classList.add("s-loading");
      addressWrap.classList.remove("s-loaded");
      status.textContent = "Contacting “" + CANONICAL_HOST + "”…";
      // setTimeout, not requestAnimationFrame: rAF doesn't reliably tick forward
      // under headless Chrome's --virtual-time-budget (no compositor frames get
      // produced for a single-shot --screenshot/--dump-dom run), which would
      // otherwise leave the "page" stuck loading forever under a test harness.
      // setTimeout is driven by virtual time directly, so it always advances.
      var t0 = performance.now();
      function frame() {
        if (token !== loadToken) return;
        var t = Math.min(1, (performance.now() - t0) / durationMs);
        var pct = loadCurve(t);
        setProgress(pct);
        if (onProgress) onProgress(pct);
        if (statusUrl && pct > 0.15 && pct < 0.92) {
          status.textContent = "Loading “" + statusUrl + "”, completed 3 of 7 items";
        }
        if (t < 1) setTimeout(frame, 16);
        else finishLoad(token);
      }
      frame();
    }

    function finishLoad(token) {
      if (token !== loadToken) return;
      setProgress(1);
      status.textContent = "";
      loading = false;
      reloadBtn.classList.remove("s-stopmode");
      addressWrap.classList.add("s-loaded"); // triggers the fade (opacity transition)
      setTimeout(function () {
        if (token !== loadToken) return;
        addressWrap.classList.remove("s-loading", "s-loaded");
        setProgress(0);
      }, 380);
    }

    function stopLoad() {
      loadToken++; // invalidates any in-flight animation frame
      loading = false;
      reloadBtn.classList.remove("s-stopmode");
      addressWrap.classList.remove("s-loading", "s-loaded");
      status.textContent = "";
      setProgress(0);
    }

    function flashProgress(label) {
      status.textContent = label || ("Contacting “" + CANONICAL_HOST + "”…");
      runLoad(420, null, null);
    }

    // ── history ──
    function updateNavButtons() {
      backBtn.disabled = histPos <= 0;
      fwdBtn.disabled = histPos >= hist.length - 1;
    }

    function pushHistory(entry) {
      hist = hist.slice(0, histPos + 1);
      hist.push(entry);
      histPos = hist.length - 1;
      updateNavButtons();
    }

    function updateSnapBack() {
      snapBtn.hidden = currentPath === "/";
    }

    // ── the 2004 pages talk to Safari via postMessage (file:// frames can be opaque, so no DOM reach-in) ──
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (e.source !== iframe.contentWindow || !d || typeof d.bzSafari !== "string") return;
      if (d.bzSafari === "navigate" && /^[\w-]+\.html(#[\w-]*)?$/i.test(d.href)) {
        go("http://" + CANONICAL_HOST + "/" + d.href, true);
      } else if (d.bzSafari === "external" && /^https?:\/\//i.test(d.url)) {
        flashProgress();
        openExternal(d.url);
      } else if (d.bzSafari === "hash" && d.doc === frameDoc && /^(\?[^#\s<>"]*)?(#[\w-]*)?$/.test(d.tail)) {
        // a jump within the page: new address and a history entry, as in Safari 1.2. Back/Forward set
        // currentTail before the frame reports it, so they don't add one; "…#" and "…" are the same place.
        var tail = withoutCacheBust(d.tail).replace(/#$/, "");
        if (tail === currentTail.replace(/#$/, "")) return;
        currentTail = tail;
        var display = computeFinalDisplay(currentPath, currentTail);
        setAddress(display);
        pushHistory({ display: display, file: siteFileFor(currentPath) + currentTail, path: currentPath, tail: currentTail });
      } else if (d.bzSafari === "key") {
        if (opts.typing) opts.typing({ type: String(d.type), code: String(d.code || ""), key: String(d.key || ""), isComposing: !!d.isComposing });
      } else if (d.bzSafari === "loaded") {
        frameDoc = typeof d.doc === "string" ? d.doc : null;
        if (typeof d.title === "string" && d.title) titleH2.textContent = d.title;
        syncFrameState();
      }
    });

    // graphite scroller in the page while the Safari window is in the background, like Aqua
    function syncFrameState() {
      try { iframe.contentWindow.postMessage({ bzSafari: "state", active: win.classList.contains("active") }, "*"); } catch (e) {}
    }
    if (window.MutationObserver) new MutationObserver(syncFrameState).observe(win, { attributes: true, attributeFilter: ["class"] });
    iframe.addEventListener("load", syncFrameState);

    iframe.addEventListener("load", function () {
      var title = pageTitle(iframe);
      titleH2.textContent = title || HOME_TITLE;
    });

    // ── navigation ──
    function loadInto(path, tail, options) {
      options = options || {};
      var push = options.push !== false;
      var isAlias = !!options.isAlias;
      var doReveal = options.reveal !== false;
      if (doReveal) reveal();

      var finalDisplay = computeFinalDisplay(path, tail);
      setAddress(options.typedDisplay != null ? options.typedDisplay : finalDisplay);

      var file = options.cacheBust ? withCacheBust(siteFileFor(path), tail) : siteFileFor(path) + tail;
      var didMid = false;
      var dur = 600 + Math.random() * 800; // 0.6-1.4s, per Safari 1.x's typical local-page load feel
      runLoad(dur, finalDisplay, function (pct) {
        // an alias (bohdan.bz…) turns into the real address midway, or wherever the page has jumped since
        if (isAlias && !didMid && pct >= 0.5) { didMid = true; setAddress(computeFinalDisplay(currentPath, currentTail)); }
      });

      if (options.cacheBust || leavesDoc(path, tail)) frameDoc = null; // a new document is coming
      iframe.src = file;
      currentPath = path;
      currentTail = tail;
      if (push) pushHistory({ display: finalDisplay, file: siteFileFor(path) + tail, path: path, tail: tail });
      updateSnapBack();
      updateNavButtons();
    }

    function go(raw, push) {
      var owner = parseOwnerUrl(raw);
      if (owner) {
        loadInto(owner.path, owner.tail, {
          push: push,
          isAlias: owner.isAlias,
          typedDisplay: owner.isAlias ? String(raw).trim() : null
        });
        return;
      }
      var was = computeFinalDisplay(currentPath, currentTail);
      flashProgress();
      openExternal(normalizeExternal(raw));
      setTimeout(function () { setAddress(was); }, 500);
    }

    function showHistoryEntry(idx) {
      var e = hist[idx];
      if (!e) return;
      histPos = idx;
      reveal();
      setAddress(e.display);
      var dur = 200 + Math.random() * 200; // back/forward feels "cached" and faster
      runLoad(dur, e.display, null);
      if (leavesDoc(e.path, e.tail)) frameDoc = null;
      iframe.src = e.file;
      currentPath = e.path;
      currentTail = e.tail;
      updateSnapBack();
      updateNavButtons();
    }

    function back() { if (histPos > 0) showHistoryEntry(histPos - 1); }
    function forward() { if (histPos < hist.length - 1) showHistoryEntry(histPos + 1); }
    function reloadCurrent() {
      loadInto(currentPath, currentTail, { push: false, isAlias: false, typedDisplay: null, cacheBust: true, reveal: false });
    }

    // ── wire up controls ──
    backBtn.addEventListener("click", back);
    fwdBtn.addEventListener("click", forward);
    reloadBtn.addEventListener("click", function () { if (loading) stopLoad(); else reloadCurrent(); });
    snapBtn.addEventListener("click", function () { go("http://" + CANONICAL_HOST + "/", true); });
    addBmBtn.addEventListener("click", function () {
      addBmBtn.classList.remove("s-pop");
      void addBmBtn.offsetWidth;
      addBmBtn.classList.add("s-pop");
    });

    addressInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addressInput.blur(); go(addressInput.value, true); }
      else if (e.key === "Escape") { addressInput.value = computeFinalDisplay(currentPath, currentTail); addressInput.blur(); }
    });
    addressInput.addEventListener("focus", function () { addressInput.select(); });

    googleInput.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var q = googleInput.value.trim();
      googleInput.blur();
      if (!q) return;
      flashProgress("Contacting “www.google.com”…");
      openExternal("https://www.google.com/search?q=" + encodeURIComponent(q));
      googleInput.value = "";
    });

    function closeNews() { newsEl.classList.remove("s-open"); }
    bookmarks.addEventListener("click", function (e) {
      var newsBtn = e.target.closest ? e.target.closest(".s-news-btn") : null;
      if (newsBtn) { e.preventDefault(); newsEl.classList.toggle("s-open"); return; }
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      e.preventDefault();
      closeNews();
      if (a.hasAttribute("data-owner")) { go(a.getAttribute("data-owner"), true); return; }
      if (a.hasAttribute("data-external")) { flashProgress(); openExternal(a.href); return; }
    });
    document.addEventListener("pointerdown", function (e) {
      if (newsEl.classList.contains("s-open") && !newsEl.contains(e.target)) closeNews();
    });

    document.addEventListener("keydown", function (e) {
      if (!isActive()) return;
      var el = document.activeElement;
      if (el === addressInput || el === googleInput) return; // let the field handle its own keys
      if (e.metaKey && e.key.toLowerCase() === "l") { e.preventDefault(); addressInput.focus(); addressInput.select(); }
      else if (e.metaKey && e.key === "[") { e.preventDefault(); back(); }
      else if (e.metaKey && e.key === "]") { e.preventDefault(); forward(); }
      else if (e.metaKey && e.key.toLowerCase() === "r") { e.preventDefault(); if (!loading) reloadCurrent(); }
    });

    // ── initial page: the 2004 homepage, without stealing focus/front on construction ──
    loadInto("/", "", { push: true, isAlias: false, reveal: false });

    var api = {
      open: function (url) { go(url, true); },
      back: back,
      forward: forward
    };
    win._bzSafariApi = api;
    return api;
  };
})();
