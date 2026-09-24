/* bz — a Panther-era Finder window, sharing window.BzFS with the Terminal */
(function () {
  "use strict";

  var CSS_ID = "bz-finder-css";
  var SPRITE_ID = "bz-finder-sprite";
  var LABEL_HEX = { red: "#ff3b30", orange: "#ff9500", yellow: "#ffcc00", green: "#34c759", blue: "#007aff", purple: "#af52de", gray: "#8e8e93" };
  var LABEL_ORDER = ["none", "red", "orange", "yellow", "green", "blue", "purple", "gray"];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  function tint(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  // ── one-time CSS + icon sprite injection ───────────────────────
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css =
      ".f-toolbar{display:flex;align-items:center;gap:8px;padding:6px 8px;background:transparent;border-bottom:1px solid rgba(0,0,0,.25);font-family:'Lucida Grande',Tahoma,Geneva,sans-serif;}" +
      ".f-nav{display:flex;}" +
      ".f-nav-btn,.f-view-btn{width:26px;height:22px;border:1px solid rgba(0,0,0,.4);background:linear-gradient(#fefefe,#d6d6d6);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;}" +
      ".f-nav-btn:first-child,.f-view-btn:first-child{border-radius:5px 0 0 5px;border-right:none;}" +
      ".f-nav-btn:last-child,.f-view-btn:last-child{border-radius:0 5px 5px 0;}" +
      ".f-nav-btn:active:not(:disabled){background:linear-gradient(#c4c4c4,#aeaeae);}" +
      ".f-nav-btn:disabled{opacity:.35;cursor:default;}" +
      ".f-arrow{width:0;height:0;border-style:solid;}" +
      ".f-arrow-back{border-width:4px 6px 4px 0;border-color:transparent #333 transparent transparent;}" +
      ".f-arrow-fwd{border-width:4px 0 4px 6px;border-color:transparent transparent transparent #333;}" +
      ".f-view-group{display:flex;margin-left:2px;}" +
      ".f-view-btn[aria-pressed='true']{background:linear-gradient(#8fb4e8,#4d7fc9);box-shadow:inset 0 1px 3px rgba(0,0,0,.45);}" +
      ".f-vg-grid{width:12px;height:12px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:1px;}" +
      ".f-vg-grid span{background:#555;display:block;}" +
      ".f-view-btn[aria-pressed='true'] .f-vg-grid span{background:#fff;}" +
      ".f-vg-list{width:14px;height:12px;display:flex;flex-direction:column;justify-content:space-between;}" +
      ".f-vg-list span{height:2px;background:#555;display:block;}" +
      ".f-view-btn[aria-pressed='true'] .f-vg-list span{background:#fff;}" +
      ".f-spacer{flex:1;}" +
      ".f-search-wrap{position:relative;width:140px;max-width:40vw;}" +
      ".f-search{width:100%;box-sizing:border-box;height:20px;border-radius:10px;border:1px solid #9d9d9d;padding:0 8px 0 20px;font-size:11px;background:#fff;box-shadow:inset 0 1px 2px rgba(0,0,0,.35);}" +
      ".f-search-icon{position:absolute;left:6px;top:50%;width:9px;height:9px;margin-top:-5px;border:1.5px solid #888;border-radius:50%;pointer-events:none;}" +
      ".f-search-icon:after{content:'';position:absolute;width:4px;height:1.5px;background:#888;right:-4px;bottom:-1px;transform:rotate(45deg);}" +
      ".f-body{display:flex;height:var(--fh,360px);}" +
      ".f-sidebar{width:118px;flex:0 0 118px;background:#e8ecf1;box-shadow:inset -1px 0 0 rgba(0,0,0,.18),inset 1px 0 0 rgba(255,255,255,.7);overflow:auto;padding:6px 4px;font-size:12px;font-family:'Lucida Grande',Tahoma,sans-serif;}" +
      ".f-side-row{display:flex;align-items:center;gap:6px;height:20px;padding:0 6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1a1a1a;border-radius:4px;}" +
      ".f-side-row svg,.f-side-row img{width:16px;height:16px;flex:0 0 16px;}" +
      ".window.active .f-side-row.f-current{background:#3875d7;color:#fff;}" +
      ".window:not(.active) .f-side-row.f-current{background:#d4d4d4;color:#000;}" +
      ".f-side-row.f-drop-hover{background:rgba(56,117,215,.3);outline:1px dashed rgba(56,117,215,.8);}" +
      ".f-side-divider{height:1px;background:rgba(0,0,0,.18);margin:5px 8px;}" +
      ".f-main{flex:1;background:#fff;box-shadow:inset 0 0 0 1px rgba(0,0,0,.3);overflow:auto;position:relative;}" +
      ".f-icons{display:grid;grid-template-columns:repeat(auto-fill,84px);gap:12px 4px;padding:14px;align-content:start;}" +
      ".f-icon{width:84px;display:flex;flex-direction:column;align-items:center;text-align:center;touch-action:none;cursor:default;user-select:none;-webkit-user-select:none;}" +
      ".f-icon-glyph{width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:10px;box-sizing:border-box;}" +
      ".f-icon.f-selected .f-icon-glyph{background:rgba(0,0,0,.22);}" +
      ".f-icon.f-drop-hover .f-icon-glyph{background:rgba(56,117,215,.35);outline:2px solid rgba(56,117,215,.75);}" +
      ".f-icon-glyph svg,.f-icon-glyph img{width:52px;height:52px;display:block;}" +
      ".f-icon-label{margin-top:2px;font-size:12px;line-height:14px;max-height:30px;overflow:hidden;padding:1px 6px;border-radius:9px;word-break:break-word;color:#000;}" +
      ".window.active .f-icon.f-selected .f-icon-label{background:#3875d7;color:#fff;}" +
      ".window:not(.active) .f-icon.f-selected .f-icon-label{background:#dcdcdc;color:#000;}" +
      ".f-list{width:100%;border-collapse:collapse;font-size:12px;font-family:'Lucida Grande',Tahoma,sans-serif;}" +
      ".f-list thead th{position:sticky;top:0;background:linear-gradient(#f8fafc,#dde5ef);border-bottom:1px solid #a9a9a9;border-right:1px solid #ccd2da;text-align:left;padding:3px 8px;font-weight:normal;z-index:1;}" +
      ".f-list thead th{cursor:default;user-select:none;-webkit-user-select:none;white-space:nowrap;}" +
      ".f-list thead th.f-sorted{background:linear-gradient(#cfe2fa,#9ec0ee 50%,#83aee8 51%,#b4d1f5);border-bottom-color:#5d7fb6;}" +
      ".f-sort-arrow{display:inline-block;margin-left:6px;font-size:8px;line-height:1;color:#1f3f78;vertical-align:1px;}" +
      ".f-list tbody tr.f-row{touch-action:none;cursor:default;}" +
      ".f-list tbody tr.f-row:nth-child(odd){background:#fff;}" +
      ".f-list tbody tr.f-row:nth-child(even){background:#edf3fe;}" +
      ".f-list tbody td{padding:2px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".f-row-name{display:flex;align-items:center;gap:6px;}" +
      ".f-row-name svg,.f-row-name img{width:16px;height:16px;flex:0 0 16px;}" +
      ".window.active .f-row.f-selected{background:#3875d7 !important;color:#fff;}" +
      ".window:not(.active) .f-row.f-selected{background:#d4d4d4 !important;color:#000;}" +
      ".f-row.f-drop-hover{outline:2px solid rgba(56,117,215,.75);outline-offset:-2px;}" +
      ".f-main.f-drop-hover{box-shadow:inset 0 0 0 2px rgba(56,117,215,.6);}" +
      ".f-status{height:20px;padding:0 10px;display:flex;align-items:center;font-size:11px;color:#444;background:transparent;border-top:1px solid rgba(0,0,0,.2);font-family:'Lucida Grande',Tahoma,sans-serif;}" +
      ".f-menu{position:fixed;min-width:170px;background:rgba(255,255,255,.97);border:1px solid rgba(0,0,0,.25);border-radius:3px;box-shadow:0 6px 18px rgba(0,0,0,.4);padding:4px 0;font-size:14px;font-family:'Lucida Grande',Tahoma,sans-serif;z-index:2200;}" +
      ".f-menu-item{padding:3px 16px;cursor:default;color:#000;}" +
      ".f-menu-item.f-hot{background:linear-gradient(#5c9aff,#2d63d0);color:#fff;}" +
      ".f-menu-sep{height:1px;background:rgba(0,0,0,.15);margin:4px 0;}" +
      ".f-menu-label{padding:3px 16px;font-size:11px;color:#666;}" +
      ".f-menu-colors{display:flex;gap:6px;padding:2px 16px 6px;}" +
      ".f-swatch{width:14px;height:14px;border-radius:50%;border:1px solid rgba(0,0,0,.35);cursor:pointer;padding:0;box-sizing:border-box;}" +
      ".f-swatch.f-none{background:#fff;}" +
      ".f-ghost{position:fixed;pointer-events:none;z-index:3000;opacity:.75;display:flex;flex-direction:column;align-items:center;width:84px;}" +
      ".f-ghost.f-returning{transition:left .2s ease,top .2s ease,opacity .2s ease;}" +
      ".f-ghost svg,.f-ghost img{width:52px;height:52px;display:block;}" +
      ".f-ghost span{font-size:12px;background:rgba(56,117,215,.9);color:#fff;border-radius:9px;padding:1px 6px;margin-top:2px;max-width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".f-viewer .titlebar{cursor:default;}" +
      ".f-viewer .light[disabled]{background:#c7c7c7 !important;box-shadow:none !important;cursor:default;}" +
      ".f-viewer-body{background:#fff;}" +
      ".f-viewer-text{width:var(--vw,520px);height:var(--vh,300px);overflow-wrap:anywhere;padding:20px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;overflow:auto;box-sizing:border-box;color:#111;white-space:pre-wrap;}" +
      ".f-viewer-text a{color:#1155cc;}" +
      ".f-viewer-image{display:flex;align-items:center;justify-content:center;padding:20px;}" +
      ".f-viewer-image{background:#fff;padding:0;}" +
      ".f-viewer-image img{width:var(--vw,320px);height:auto;display:block;}" +
      // zoom grows a document to fit its contents, as far as the space between the menu bar and the Dock allows
      ".f-viewer.zoomed .f-viewer-text{height:auto;max-height:calc(100vh - 160px);}" +
      ".f-viewer.zoomed .f-viewer-image img{width:auto;height:auto;max-width:calc(100vw - 40px);max-height:calc(100vh - 160px);}" +
      ".f-alert-blocker{position:fixed;inset:0;background:transparent;z-index:2500;}" +
      ".f-alert{position:fixed;left:50%;top:22%;transform:translateX(-50%);width:380px;z-index:2501;}" +
      ".f-alert .titlebar{height:6px;min-height:6px;padding:0;}" +
      ".f-alert-content{display:flex;gap:14px;padding:18px 20px 10px;}" +
      ".f-alert-icon{width:64px;height:64px;flex:0 0 64px;}" +
      ".f-alert-icon svg,.f-alert-icon img{width:64px;height:64px;display:block;}" +
      ".f-alert-text{flex:1;font-family:'Lucida Grande',Tahoma,sans-serif;}" +
      ".f-alert-title{font-weight:bold;font-size:13px;margin-bottom:6px;color:#111;}" +
      ".f-alert-sub{font-size:11px;color:#333;}" +
      ".f-alert-buttons{display:flex;justify-content:flex-end;gap:8px;padding:10px 20px 18px;}" +
      "@media (max-width:480px){.f-sidebar{width:92px;flex-basis:92px;}.f-icons{grid-template-columns:repeat(auto-fill,76px);}.f-search-wrap{width:96px;}}";
    var style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function sym(id, viewBox, body) {
    return '<symbol id="' + id + '" viewBox="' + viewBox + '">' + body + "</symbol>";
  }

  function injectSprite() {
    if (document.getElementById(SPRITE_ID)) return;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = SPRITE_ID;
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.style.overflow = "hidden";
    var defs =
      '<defs>' +
      '<linearGradient id="fi-g-folder-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8ff0"/><stop offset="1" stop-color="#1d55b8"/></linearGradient>' +
      '<linearGradient id="fi-g-folder-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9cdff"/><stop offset="1" stop-color="#5f97ee"/></linearGradient>' +
      '<linearGradient id="fi-g-page" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f0f0f0"/></linearGradient>' +
      "</defs>";
    var folderBack = '<rect x="4" y="12" width="24" height="9" rx="2" fill="url(#fi-g-folder-back)"/><rect x="4" y="18" width="56" height="38" rx="4" fill="url(#fi-g-folder-back)"/>';
    var folderFront = '<rect x="4" y="27" width="56" height="29" rx="4" fill="url(#fi-g-folder-front)"/>';
    var page = '<polygon points="14,4 40,4 50,14 50,60 14,60" fill="url(#fi-g-page)" stroke="#9a9a9a" stroke-width="1"/><polygon points="40,4 40,14 50,14" fill="#d8d8d8" stroke="#9a9a9a" stroke-width="1"/>';
    var body =
      sym("fi-folder", "0 0 64 64", folderBack + folderFront) +
      sym("fi-home", "0 0 64 64", folderBack + folderFront + '<path d="M32 30 L44 40 L40 40 L40 50 L24 50 L24 40 L20 40 Z" fill="#fff" opacity=".92"/>') +
      sym("fi-doc", "0 0 64 64", page + '<line x1="20" y1="24" x2="44" y2="24" stroke="#8b8b8b" stroke-width="2"/><line x1="20" y1="31" x2="44" y2="31" stroke="#8b8b8b" stroke-width="2"/><line x1="20" y1="38" x2="44" y2="38" stroke="#8b8b8b" stroke-width="2"/><line x1="20" y1="45" x2="36" y2="45" stroke="#8b8b8b" stroke-width="2"/>') +
      sym("fi-image", "0 0 64 64", page + '<rect x="19" y="24" width="26" height="20" rx="1" fill="#fff" stroke="#9a9a9a" stroke-width="1.2"/><circle cx="25" cy="30" r="2.6" fill="#f4c542"/><polyline points="19,42 28,33 34,39 39,32 45,40" fill="none" stroke="#5b9bd5" stroke-width="2"/>') +
      sym("fi-webloc", "0 0 64 64", page + '<circle cx="32" cy="34" r="12" fill="#4d90fe" stroke="#2d63d0" stroke-width="1"/><ellipse cx="32" cy="34" rx="5" ry="12" fill="none" stroke="#fff" stroke-width="1"/><line x1="20" y1="34" x2="44" y2="34" stroke="#fff" stroke-width="1"/><line x1="22.5" y1="27" x2="41.5" y2="27" stroke="#fff" stroke-width="1"/><line x1="22.5" y1="41" x2="41.5" y2="41" stroke="#fff" stroke-width="1"/>') +
      sym("fi-hd", "0 0 16 16", '<rect x="1.5" y="4" width="13" height="8" rx="1.5" fill="none" stroke="#5a6472" stroke-width="1.2"/><line x1="1.5" y1="9" x2="14.5" y2="9" stroke="#5a6472" stroke-width="1"/><circle cx="11.5" cy="10.5" r=".8" fill="#5a6472"/>') +
      sym("fi-house", "0 0 16 16", '<path d="M8 2 L14.5 7.5 L13 7.5 L13 14 L9.5 14 L9.5 9.5 L6.5 9.5 L6.5 14 L3 14 L3 7.5 L1.5 7.5 Z" fill="#5a6472"/>') +
      sym("fi-folder-sm", "0 0 16 16", '<rect x="1" y="4.5" width="6" height="2.2" rx=".6" fill="#5a6472"/><rect x="1" y="6" width="14" height="8.5" rx="1.3" fill="#5a6472"/>') +
      sym("fi-trash", "0 0 64 64", '<path d="M20 18 L44 18 L42 56 L22 56 Z" fill="#d9dde2" stroke="#8b8f96" stroke-width="1.5"/><rect x="16" y="12" width="32" height="6" rx="1.5" fill="#c3c8cf" stroke="#8b8f96" stroke-width="1.2"/><rect x="26" y="6" width="12" height="6" rx="1.5" fill="#c3c8cf" stroke="#8b8f96" stroke-width="1.2"/><line x1="27" y1="24" x2="28" y2="50" stroke="#8b8f96" stroke-width="1.4"/><line x1="32" y1="24" x2="32" y2="50" stroke="#8b8f96" stroke-width="1.4"/><line x1="37" y1="24" x2="36" y2="50" stroke="#8b8f96" stroke-width="1.4"/>');
    svg.innerHTML = defs + body;
    document.body.appendChild(svg);
  }

  // Genuine Panther icons (10.3 build 7B85, see img/icons/SOURCES.txt); small ones have 16/32 px cuts
  var ICONS = {
    "fi-folder": "folder", "fi-doc": "doc-text", "fi-image": "doc-image", "fi-webloc": "webloc", "fi-trash": "trash-full",
    "fi-hd": "hd-16", "fi-house": "home-16", "fi-folder-sm": "folder-16"
  };

  function useIcon(id, cls) {
    var name = ICONS[id];
    if (!name) return '<svg class="' + (cls || "") + '" aria-hidden="true"><use xlink:href="#' + id + '"></use></svg>';
    var src = "img/icons/" + name + ".png";
    var set = /-16$/.test(name) ? ' srcset="img/icons/' + name.replace(/-16$/, "-32") + '.png 2x"' : "";
    return '<img class="' + (cls || "") + '" src="' + src + '"' + set + ' alt="" draggable="false">';
  }

  function iconIdFor(node) {
    if (!node) return "fi-doc";
    if (node.type === "dir") return "fi-folder";
    if (node.type === "image") return "fi-image";
    if (node.type === "link") return "fi-webloc";
    return "fi-doc";
  }

  // ── the Finder ───────────────────────────────────────────────
  window.BzFinder = function (opts) {
    if (opts.win._bzFinderApi) return opts.win._bzFinderApi;

    injectCSS();
    injectSprite();

    var win = opts.win;
    // viewers, menus, alerts and drag ghosts live on the desktop beside the Finder window, so they
    // share its stacking, its Aqua scroll bars and its no-text-selection rule
    var desk = win.parentNode;
    var fs = opts.fs;
    var isActive = opts.isActive || function () { return true; };
    var reveal = opts.reveal || function () {};
    var nextZ = opts.nextZ || function () { return 100; };
    var minimize = opts.minimize; // (window, app icon, slow): into the Dock, with the genie
    var growBox = opts.growBox; // (window, grow box, start): the desktop's resize-by-corner
    var growPixels = opts.growPixels; // (window, height element, [width var, height var], min w, min h[, grow box])
    var openURL = opts.openURL || function (u) { window.open(u, "_blank", "noopener"); };
    var dropOnTerminal = opts.dropOnTerminal || function () {};
    var sound = opts.sound;

    function play(name) { if (sound && sound.play) sound.play(name); }

    // ── state ──
    var curPath = [];
    var hist = [[]];
    var histPos = 0;
    var mode = "icon";
    var selectedName = null;
    var query = "";
    var lastNames = [];
    var sortKey = "name", sortDir = 1; // list view: click a header to sort, again to reverse
    var lastColumns = 1;
    var viewers = {}; // absolute path -> section element
    var viewerCount = 0;
    var menuEl = null;
    var alertEls = null;
    var typeBuf = "", typeTimer = null;

    // ── build chrome ──
    var titlebar = win.querySelector(".titlebar");
    var titleH2 = titlebar.querySelector("h2");

    var toolbar = document.createElement("div");
    toolbar.className = "f-toolbar";
    toolbar.setAttribute("data-drag", "");
    toolbar.innerHTML =
      '<div class="f-nav">' +
      '<button type="button" class="f-nav-btn f-back" aria-label="Back"><span class="f-arrow f-arrow-back"></span></button>' +
      '<button type="button" class="f-nav-btn f-fwd" aria-label="Forward"><span class="f-arrow f-arrow-fwd"></span></button>' +
      "</div>" +
      '<div class="f-view-group" role="group" aria-label="View">' +
      '<button type="button" class="f-view-btn f-view-icon" aria-label="Icon view" aria-pressed="true"><span class="f-vg-grid"><span></span><span></span><span></span><span></span></span></button>' +
      '<button type="button" class="f-view-btn f-view-list" aria-label="List view" aria-pressed="false"><span class="f-vg-list"><span></span><span></span><span></span></span></button>' +
      "</div>" +
      '<div class="f-spacer"></div>' +
      '<div class="f-search-wrap"><span class="f-search-icon"></span><input type="text" class="f-search" placeholder="Search"></div>';
    win.insertBefore(toolbar, titlebar.nextSibling);

    var body = document.createElement("div");
    body.className = "f-body";
    body.innerHTML = '<div class="f-sidebar"></div><div class="f-main"></div>';
    win.insertBefore(body, toolbar.nextSibling);

    var status = document.createElement("div");
    status.className = "f-status";
    status.setAttribute("data-drag", "");
    win.insertBefore(status, body.nextSibling);

    if (growPixels) growPixels(win, body, ["--fw", "--fh"], 420, 120); // grow box in the status bar's corner

    var backBtn = toolbar.querySelector(".f-back");
    var fwdBtn = toolbar.querySelector(".f-fwd");
    var viewIconBtn = toolbar.querySelector(".f-view-icon");
    var viewListBtn = toolbar.querySelector(".f-view-list");
    var searchInput = toolbar.querySelector(".f-search");
    var sidebarEl = body.querySelector(".f-sidebar");
    var mainEl = body.querySelector(".f-main");

    // ── path helpers ──
    function isTrashPath(p) { return p.length === 1 && p[0] === ".Trash"; }
    function pathKey(p) { return p.join("/"); }
    function sameArr(a, b) { return a.length === b.length && a.every(function (s, i) { return s === b[i]; }); }

    // ── navigation ──
    function ensureValid() {
      if (!fs.get(curPath)) {
        curPath = [];
        hist[histPos] = [];
      }
    }

    function navigate(path, push) {
      curPath = path;
      selectedName = null;
      if (push) {
        hist = hist.slice(0, histPos + 1);
        hist.push(path);
        histPos = hist.length - 1;
      }
      render();
    }

    function goTo(path) { navigate(path, true); }
    function open(path) { reveal(); goTo(path); }

    function back() { if (histPos > 0) { histPos--; curPath = hist[histPos]; selectedName = null; render(); } }
    function forward() { if (histPos < hist.length - 1) { histPos++; curPath = hist[histPos]; selectedName = null; render(); } }

    backBtn.addEventListener("click", back);
    fwdBtn.addEventListener("click", forward);

    // ── view mode ──
    function setMode(m) {
      mode = m;
      viewIconBtn.setAttribute("aria-pressed", String(m === "icon"));
      viewListBtn.setAttribute("aria-pressed", String(m === "list"));
      render();
    }
    viewIconBtn.addEventListener("click", function () { setMode("icon"); });
    viewListBtn.addEventListener("click", function () { setMode("list"); });

    // ── search ──
    searchInput.addEventListener("input", function () { query = searchInput.value; render(); });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (query) { query = ""; searchInput.value = ""; render(); }
        else { searchInput.blur(); clearSelection(); }
      }
    });

    // ── sidebar ──
    function renderSidebar() {
      var hasLinks = !!fs.get(["links"]);
      var curRole = curPath.length === 0 ? "home" : (curPath.length === 1 && curPath[0] === "links" ? "links" : null);
      var html = "";
      html += '<div class="f-side-row" data-role="hd">' + useIcon("fi-hd") + "<span>Macintosh HD</span></div>";
      html += '<div class="f-side-divider"></div>';
      html += '<div class="f-side-row' + (curRole === "home" ? " f-current" : "") + '" data-role="home">' + useIcon("fi-house") + "<span>bohdan</span></div>";
      if (hasLinks) html += '<div class="f-side-row' + (curRole === "links" ? " f-current" : "") + '" data-role="links">' + useIcon("fi-folder-sm") + "<span>links</span></div>";
      sidebarEl.innerHTML = html;
    }

    function roleToPath(role) {
      if (role === "hd" || role === "home") return [];
      if (role === "links") return ["links"];
      return null;
    }

    sidebarEl.addEventListener("click", function (e) {
      var row = e.target.closest(".f-side-row");
      if (!row) return;
      var p = roleToPath(row.getAttribute("data-role"));
      if (p) goTo(p);
    });

    // ── main content render ──
    function statusText() {
      var n = lastNames.length;
      var word = n === 1 ? "item" : "items";
      if (isTrashPath(curPath)) return n + " " + word;
      return n + " " + word + ", 42.1 GB available";
    }

    // ── list sorting ──
    var SIZE_UNITS = { bytes: 1, KB: 1024, MB: 1048576, GB: 1073741824 };
    var MONTHS = "JanFebMarAprMayJunJulAugSepOctNovDec";

    function sizeValue(n) {
      var m = /^([\d.]+)\s*(bytes|KB|MB|GB)$/.exec(n.size || "");
      return m ? parseFloat(m[1]) * SIZE_UNITS[m[2]] : -1; // folders ("--") sort as smallest
    }

    function dateValue(n) {
      var m = /^(\w{3}) (\d+), (\d{4}) (\d+):(\d+) (AM|PM)$/.exec(n.date || "");
      if (!m) return 0;
      return new Date(+m[3], MONTHS.indexOf(m[1]) / 3, +m[2], (+m[4] % 12) + (m[6] === "PM" ? 12 : 0), +m[5]).getTime();
    }

    function sortNames(node, names) {
      function byName(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase(), undefined, { numeric: true }); }
      return names.slice().sort(function (a, b) {
        var A = node.children[a], B = node.children[b], d = 0;
        if (sortKey === "date") d = dateValue(A) - dateValue(B);
        else if (sortKey === "size") d = sizeValue(A) - sizeValue(B);
        else if (sortKey === "kind") d = fs.kind(A).localeCompare(fs.kind(B));
        if (d) return d * sortDir;
        return byName(a, b) * (sortKey === "name" ? sortDir : 1);
      });
    }

    function setSort(key) {
      if (sortKey === key) sortDir = -sortDir;
      else { sortKey = key; sortDir = 1; }
      render();
    }

    function render() {
      ensureValid();
      var node = fs.get(curPath);
      var trash = isTrashPath(curPath);
      titleH2.textContent = trash ? "Trash" : (curPath.length === 0 ? "bohdan" : curPath[curPath.length - 1]);

      renderSidebar();

      backBtn.disabled = histPos <= 0;
      fwdBtn.disabled = histPos >= hist.length - 1;

      var names = fs.names(node, false);
      if (query) {
        var q = query.toLowerCase();
        names = names.filter(function (n) { return n.toLowerCase().indexOf(q) !== -1; });
      }
      if (mode === "list") names = sortNames(node, names);
      lastNames = names;
      if (selectedName && names.indexOf(selectedName) === -1) selectedName = null;

      if (mode === "icon") renderIcons(node, names); else renderList(node, names);

      status.textContent = statusText();
    }

    function labelStyle(node) {
      if (!node.label || !LABEL_HEX[node.label]) return "";
      return ' style="background:' + tint(LABEL_HEX[node.label], .38) + '"';
    }

    function renderIcons(node, names) {
      var html = '<div class="f-icons">';
      names.forEach(function (name) {
        var child = node.children[name];
        var sel = name === selectedName;
        html += '<div class="f-icon' + (sel ? " f-selected" : "") + '" data-name="' + esc(name) + '">' +
          '<div class="f-icon-glyph">' + useIcon(iconIdFor(child)) + "</div>" +
          '<div class="f-icon-label"' + (sel ? "" : labelStyle(child)) + ">" + esc(name) + "</div>" +
          "</div>";
      });
      html += "</div>";
      mainEl.innerHTML = html;
      var icons = mainEl.querySelectorAll(".f-icon");
      lastColumns = 1;
      if (icons.length) {
        var top0 = icons[0].offsetTop;
        var cols = 0;
        for (var i = 0; i < icons.length; i++) { if (icons[i].offsetTop === top0) cols++; else break; }
        lastColumns = cols || 1;
      }
    }

    function renderList(node, names) {
      var cols = [["name", "Name"], ["date", "Date Modified"], ["size", "Size"], ["kind", "Kind"]];
      var html = '<table class="f-list"><thead><tr>' + cols.map(function (c) {
        var on = c[0] === sortKey;
        return '<th data-sort="' + c[0] + '"' + (on ? ' class="f-sorted" aria-sort="' + (sortDir > 0 ? "ascending" : "descending") + '"' : "") + ">" +
          c[1] + (on ? '<span class="f-sort-arrow">' + (sortDir > 0 ? "▲" : "▼") + "</span>" : "") + "</th>";
      }).join("") + "</tr></thead><tbody>";
      names.forEach(function (name) {
        var child = node.children[name];
        var sel = name === selectedName;
        var size = child.size || "--";
        html += '<tr class="f-row' + (sel ? " f-selected" : "") + '" data-name="' + esc(name) + '"' + (sel ? "" : labelStyle(child)) + '>' +
          '<td><div class="f-row-name">' + useIcon(iconIdFor(child)) + "<span>" + esc(name) + "</span></div></td>" +
          "<td>" + esc(child.date || "") + "</td>" +
          "<td>" + esc(size) + "</td>" +
          "<td>" + esc(fs.kind(child)) + "</td>" +
          "</tr>";
      });
      html += "</tbody></table>";
      mainEl.innerHTML = html;
    }

    // ── selection ──
    function select(name) {
      selectedName = name;
      var items = mainEl.querySelectorAll("[data-name]");
      for (var i = 0; i < items.length; i++) {
        var on = items[i].getAttribute("data-name") === name;
        items[i].classList.toggle("f-selected", on);
        if (mode === "icon") {
          var lbl = items[i].querySelector(".f-icon-label");
          var child = fs.get(curPath) && fs.get(curPath).children[items[i].getAttribute("data-name")];
          if (lbl && child) { if (on) lbl.removeAttribute("style"); else if (child.label && LABEL_HEX[child.label]) lbl.setAttribute("style", "background:" + tint(LABEL_HEX[child.label], .38)); else lbl.removeAttribute("style"); }
        } else {
          var child2 = fs.get(curPath) && fs.get(curPath).children[items[i].getAttribute("data-name")];
          if (child2) { if (on) items[i].removeAttribute("style"); else if (child2.label && LABEL_HEX[child2.label]) items[i].setAttribute("style", "background:" + tint(LABEL_HEX[child2.label], .38)); else items[i].removeAttribute("style"); }
        }
      }
    }
    function clearSelection() { select(null); }

    // ── activation ──
    function activateName(name) {
      var node = fs.get(curPath);
      var child = node && node.children[name];
      if (!child) return;
      var itemPath = curPath.concat([name]);
      if (child.type === "dir") goTo(itemPath);
      else if (child.type === "link") openURL(child.url);
      else openViewer(itemPath, child);
    }

    // ── viewer windows ──
    function openViewer(path, node) {
      var key = fs.absolute(path);
      var open = viewers[key];
      if (open && open.isConnected) {
        if (open.classList.contains("minimized") && open._restore) open._restore(false); // out of the Dock
        else focusViewer(open);
        return;
      }
      var name = path[path.length - 1];
      var rect = win.getBoundingClientRect();
      viewerCount++;
      var off = (viewerCount % 6) * 26;
      var sec = document.createElement("section");
      sec.className = "window f-viewer active";
      sec.style.position = "fixed";
      sec.style.left = Math.round(rect.left + 40 + off) + "px";
      sec.style.top = Math.round(rect.top + 40 + off) + "px";
      sec.style.zIndex = String(nextZ());
      sec.setAttribute("data-app", "Viewer");
      var bodyHtml;
      if (node.type === "image") {
        bodyHtml = '<div class="f-viewer-body f-viewer-image"><img src="' + esc(node.src) + '" alt="' + esc(node.alt || name) + '"></div>' +
          (growBox ? '<span class="grow-box"></span>' : "");
      } else {
        bodyHtml = '<div class="f-viewer-body f-viewer-text">' + node.html + "</div>" +
          (growPixels ? '<div class="grow"><span class="grow-box"></span></div>' : "");
      }
      sec.innerHTML =
        '<div class="titlebar f-viewer-titlebar">' +
        '<div class="lights">' +
        '<button type="button" class="light close" aria-label="Close"></button>' +
        '<button type="button" class="light min" aria-label="Minimize"' + (minimize ? "" : " disabled") + '></button>' +
        '<button type="button" class="light zoom" aria-label="Zoom"></button>' +
        "</div>" +
        "<h2>" + esc(name) + "</h2>" +
        "</div>" + bodyHtml;
      desk.appendChild(sec);
      viewers[key] = sec;

      sec.querySelector(".light.close").addEventListener("click", function () {
        sec.remove();
        delete viewers[key];
      });
      // the app that would have opened it on Panther: its icon badges the Dock tile
      var appIcon = "img/icons/" + (node.type === "image" ? "preview" : "textedit") + ".png";
      if (minimize) sec.querySelector(".light.min").addEventListener("click", function (e) { sec._restore = minimize(sec, appIcon, e.shiftKey); });
      var unzoomed = null; // where the window was before zooming
      sec.querySelector(".light.zoom").addEventListener("click", function () {
        if (sec.classList.contains("zoomed")) {
          sec.classList.remove("zoomed");
          sec.style.left = unzoomed.left;
          sec.style.top = unzoomed.top;
          return;
        }
        unzoomed = { left: sec.style.left, top: sec.style.top };
        sec.classList.add("zoomed");
        sec.style.top = "30px";
        sec.style.left = Math.max(8, Math.min(sec.offsetLeft, window.innerWidth - sec.offsetWidth - 8)) + "px";
      });
      sec.addEventListener("pointerdown", function () { sec.style.zIndex = String(nextZ()); }, true);
      var grip = sec.querySelector(".grow-box"), textEl = sec.querySelector(".f-viewer-text"), img = sec.querySelector(".f-viewer-image img");
      if (textEl && grip) growPixels(sec, textEl, ["--vw", "--vh"], 200, 100, grip);
      // a picture scales with its window, keeping its shape
      if (img && grip) growBox(sec, grip, function (room) {
        var w0 = img.offsetWidth, ratio = img.naturalWidth / img.naturalHeight || 1;
        var maxW = Math.min(w0 + room.x, (w0 / ratio + room.y) * ratio);
        return function (dx, dy) {
          sec.style.setProperty("--vw", Math.round(Math.min(maxW, Math.max(160, w0 + Math.max(dx, dy * ratio)))) + "px");
        };
      });

      var bar = sec.querySelector(".f-viewer-titlebar");
      var dragging = null;
      bar.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button")) return;
        dragging = { x: e.clientX, y: e.clientY, left: sec.offsetLeft, top: sec.offsetTop, id: e.pointerId };
        bar.setPointerCapture(e.pointerId);
        sec.style.zIndex = String(nextZ());
      });
      bar.addEventListener("pointermove", function (e) {
        if (!dragging || dragging.id !== e.pointerId) return;
        sec.style.left = (dragging.left + e.clientX - dragging.x) + "px";
        sec.style.top = (dragging.top + e.clientY - dragging.y) + "px";
      });
      bar.addEventListener("pointerup", function (e) { dragging = null; });
    }

    function focusViewer(sec) { sec.style.zIndex = String(nextZ()); }

    // ── context menu ──
    function closeMenu() {
      if (menuEl) { menuEl.remove(); menuEl = null; }
      document.removeEventListener("pointerdown", onDocPointerDownForMenu, true);
    }
    function onDocPointerDownForMenu(e) {
      if (menuEl && !menuEl.contains(e.target)) closeMenu();
    }

    function openItemMenu(x, y, name, node, trash) {
      closeMenu();
      var el = document.createElement("div");
      el.className = "f-menu";
      var html = '<div class="f-menu-item" data-act="open">Open</div><div class="f-menu-sep"></div>';
      if (!trash) html += '<div class="f-menu-item" data-act="trash">Move to Trash</div><div class="f-menu-sep"></div>';
      html += '<div class="f-menu-label">Color Label:</div><div class="f-menu-colors">';
      LABEL_ORDER.forEach(function (c) {
        var hex = LABEL_HEX[c];
        html += '<button type="button" class="f-swatch' + (c === "none" ? " f-none" : "") + '" data-color="' + c + '" title="' + c + '"' + (hex ? ' style="background:' + hex + '"' : "") + "></button>";
      });
      html += "</div>";
      el.innerHTML = html;
      desk.appendChild(el);
      positionMenu(el, x, y);
      menuEl = el;

      Array.prototype.forEach.call(el.querySelectorAll(".f-menu-item"), function (it) {
        it.addEventListener("mouseenter", function () { it.classList.add("f-hot"); });
        it.addEventListener("mouseleave", function () { it.classList.remove("f-hot"); });
        it.addEventListener("click", function () {
          var act = it.getAttribute("data-act");
          closeMenu();
          if (act === "open") activateName(name);
          else if (act === "trash") { fs.trash(curPath.concat([name])); play("poof"); }
        });
      });
      Array.prototype.forEach.call(el.querySelectorAll(".f-swatch"), function (sw) {
        sw.addEventListener("click", function () {
          var c = sw.getAttribute("data-color");
          node.label = c === "none" ? null : c;
          closeMenu();
          render();
        });
      });
      setTimeout(function () { document.addEventListener("pointerdown", onDocPointerDownForMenu, true); }, 0);
    }

    function openTrashDockMenu(x, y) {
      closeMenu();
      var el = document.createElement("div");
      el.className = "f-menu";
      el.innerHTML = '<div class="f-menu-item" data-act="open">Open</div><div class="f-menu-item" data-act="empty">Empty Trash</div>';
      desk.appendChild(el);
      positionMenu(el, x, y);
      menuEl = el;
      Array.prototype.forEach.call(el.querySelectorAll(".f-menu-item"), function (it) {
        it.addEventListener("mouseenter", function () { it.classList.add("f-hot"); });
        it.addEventListener("mouseleave", function () { it.classList.remove("f-hot"); });
        it.addEventListener("click", function () {
          var act = it.getAttribute("data-act");
          closeMenu();
          if (act === "open") { reveal(); open([".Trash"]); }
          else if (act === "empty") emptyTrashAlert();
        });
      });
      setTimeout(function () { document.addEventListener("pointerdown", onDocPointerDownForMenu, true); }, 0);
    }

    function positionMenu(el, x, y) {
      var vw = window.innerWidth, vh = window.innerHeight;
      var r = el.getBoundingClientRect();
      var left = Math.min(x, vw - r.width - 4);
      var top = Math.min(y, vh - r.height - 4);
      el.style.left = Math.max(4, left) + "px";
      el.style.top = Math.max(4, top) + "px";
    }

    mainEl.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      var item = e.target.closest("[data-name]");
      if (!item) return;
      var name = item.getAttribute("data-name");
      select(name);
      var node = fs.get(curPath);
      var child = node && node.children[name];
      if (child) openItemMenu(e.clientX, e.clientY, name, child, isTrashPath(curPath));
    });

    var dockTrash = document.querySelector('[data-drop="trash"]');
    if (dockTrash) {
      dockTrash.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        openTrashDockMenu(e.clientX, e.clientY);
      });
    }

    // ── empty trash alert ──
    function emptyTrashAlert() {
      if (fs.trashCount() === 0) { play("alert"); return; }
      var blocker = document.createElement("div");
      blocker.className = "f-alert-blocker";
      var sec = document.createElement("section");
      sec.className = "window f-alert";
      sec.innerHTML =
        '<div class="titlebar"></div>' +
        '<div class="f-alert-content">' +
        '<div class="f-alert-icon">' + useIcon("fi-trash") + "</div>" +
        '<div class="f-alert-text">' +
        '<div class="f-alert-title">Are you sure you want to remove the items in the Trash permanently?</div>' +
        '<div class="f-alert-sub">You cannot undo this action.</div>' +
        "</div></div>" +
        '<div class="f-alert-buttons"><button type="button" class="btn f-cancel">Cancel</button><button type="button" class="btn default f-ok">OK</button></div>';
      desk.appendChild(blocker);
      desk.appendChild(sec);
      alertEls = { blocker: blocker, sec: sec };

      function done() {
        blocker.remove(); sec.remove();
        alertEls = null;
        document.removeEventListener("keydown", onKey, true);
      }
      function confirmOk() { fs.emptyTrash(); play("trash"); done(); }
      function cancel() { done(); }

      sec.querySelector(".f-ok").addEventListener("click", confirmOk);
      sec.querySelector(".f-cancel").addEventListener("click", cancel);
      blocker.addEventListener("click", cancel);

      function onKey(e) {
        var focused = document.activeElement && sec.contains(document.activeElement) ? document.activeElement : null;
        if (e.key === "Enter" || (e.key === " " && focused)) {
          e.preventDefault(); e.stopPropagation();
          if (focused && focused.classList.contains("f-cancel")) cancel(); else confirmOk();
        } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
        else if (e.key === "Tab") { // keep focus inside the alert
          e.preventDefault(); e.stopPropagation();
          var btns = [sec.querySelector(".f-cancel"), sec.querySelector(".f-ok")];
          btns[(btns.indexOf(focused) + 1) % 2].focus();
        }
      }
      sec.setAttribute("role", "alertdialog");
      sec.setAttribute("aria-modal", "true");
      document.addEventListener("keydown", onKey, true);
    }

    // ── drag & drop (pointer events) ──
    var drag = null; // {name, path, node, startX, startY, active, ghost, originRect, lastTarget}

    function iconOrigin(el) {
      var r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }

    function makeGhost(name, node, origin) {
      var g = document.createElement("div");
      g.className = "f-ghost";
      g.innerHTML = useIcon(iconIdFor(node)) + "<span>" + esc(name) + "</span>";
      g.style.left = (origin.left) + "px";
      g.style.top = (origin.top) + "px";
      desk.appendChild(g);
      return g;
    }

    function moveGhost(g, x, y) {
      g.style.left = (x - 42) + "px";
      g.style.top = (y - 30) + "px";
    }

    function clearHover() {
      if (drag && drag.hoverEl) {
        drag.hoverEl.classList.remove("f-drop-hover", "drop-hover");
        drag.hoverEl = null;
        drag.hoverType = null;
      }
      if (drag) clearSpring();
    }

    function clearSpring() {
      if (drag && drag.springTimer) { clearTimeout(drag.springTimer); drag.springTimer = null; }
    }

    function findDropTarget(x, y) {
      var el = document.elementFromPoint(x, y);
      if (!el) return null;
      var trashDock = el.closest('[data-drop="trash"]');
      if (trashDock) return { type: "trash", el: trashDock, hostClass: true };
      var term = el.closest('[data-drop="terminal"]');
      if (term) return { type: "terminal", el: term, hostClass: true };
      var side = el.closest(".f-side-row");
      if (side && sidebarEl.contains(side)) {
        var p = roleToPath(side.getAttribute("data-role"));
        if (p) return { type: "sidebar", el: side, path: p };
      }
      var item = el.closest("[data-name]");
      if (item && mainEl.contains(item)) {
        var name = item.getAttribute("data-name");
        var node = fs.get(curPath);
        var child = node && node.children[name];
        if (child && child.type === "dir") return { type: "folder", el: item, path: curPath.concat([name]) };
      }
      if (mainEl.contains(el) || el === mainEl) return { type: "content", el: mainEl, path: curPath.slice() };
      return null;
    }

    function applyHover(target) {
      if (drag.hoverEl === (target && target.el)) return;
      clearHover();
      if (!target) return;
      drag.hoverEl = target.el;
      drag.hoverType = target.type;
      target.el.classList.add(target.hostClass ? "drop-hover" : "f-drop-hover");
      if (target.type === "folder" || target.type === "sidebar") {
        drag.springTimer = setTimeout(function () {
          goTo(target.path);
          drag.hoverEl = null;
        }, 800);
      }
    }

    function endDrag(x, y) {
      var target = findDropTarget(x, y);
      var handled = false;
      if (target) {
        if (target.type === "trash") { fs.trash(drag.path); play("poof"); handled = true; }
        else if (target.type === "terminal") { dropOnTerminal(drag.path); handled = true; }
        else if (target.type === "folder" || target.type === "sidebar" || target.type === "content") {
          var err = fs.move(drag.path, target.path, null, { unique: true });
          handled = !err;
        }
      }
      clearHover();
      if (handled) {
        drag.ghost.remove();
      } else {
        var g = drag.ghost;
        g.classList.add("f-returning");
        var o = drag.origin;
        requestAnimationFrame(function () {
          g.style.left = o.left + "px";
          g.style.top = o.top + "px";
          g.style.opacity = "0";
        });
        setTimeout(function () { g.remove(); }, 220);
      }
      drag = null;
    }

    mainEl.addEventListener("pointerdown", function (e) {
      var th = e.target.closest("th[data-sort]");
      if (th) { setSort(th.getAttribute("data-sort")); return; }
      var item = e.target.closest("[data-name]");
      if (!item) { clearSelection(); return; }
      var name = item.getAttribute("data-name");
      select(name);
      var node = fs.get(curPath);
      var child = node && node.children[name];
      if (!child) return;
      var origin = iconOrigin(item);
      var pending = { name: name, path: curPath.concat([name]), node: child, startX: e.clientX, startY: e.clientY, active: false, origin: origin, hoverEl: null, hoverType: null, springTimer: null };
      drag = pending;

      function onMove(ev) {
        if (!drag) return;
        var dx = ev.clientX - drag.startX, dy = ev.clientY - drag.startY;
        if (!drag.active) {
          if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
          drag.active = true;
          drag.ghost = makeGhost(drag.name, drag.node, drag.origin);
        }
        moveGhost(drag.ghost, ev.clientX, ev.clientY);
        applyHover(findDropTarget(ev.clientX, ev.clientY));
      }
      function detach() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
      }
      function onUp(ev) {
        detach();
        if (drag && drag.active) endDrag(ev.clientX, ev.clientY);
        else drag = null;
      }
      function onCancel() {
        detach();
        if (drag) {
          clearHover();
          if (drag.ghost) drag.ghost.remove();
          drag = null;
        }
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
    });

    mainEl.addEventListener("dblclick", function (e) {
      var item = e.target.closest("[data-name]");
      if (!item) return;
      activateName(item.getAttribute("data-name"));
    });

    // ── keyboard ──
    document.addEventListener("keydown", function (e) {
      if (!isActive()) return;
      if (alertEls) return;
      var inField = e.target === searchInput;

      if (e.key === "Escape") {
        if (inField) return; // field handles its own Escape
        if (query) { query = ""; searchInput.value = ""; render(); }
        else clearSelection();
        return;
      }
      if (inField) return;

      if (e.metaKey && !e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); searchInput.focus(); searchInput.select(); return; }
      if (e.metaKey && e.shiftKey && e.key === "Backspace") { e.preventDefault(); emptyTrashAlert(); return; }
      if (e.metaKey && e.key === "Backspace") {
        e.preventDefault();
        if (selectedName) { fs.trash(curPath.concat([selectedName])); play("poof"); }
        return;
      }
      if (e.metaKey && (e.key.toLowerCase() === "o" || e.key === "ArrowDown")) {
        e.preventDefault();
        if (selectedName) activateName(selectedName);
        return;
      }
      if (e.metaKey && e.key === "ArrowUp") {
        e.preventDefault();
        if (curPath.length) goTo(curPath.slice(0, -1));
        return;
      }
      if (e.metaKey) return;

      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(e.key);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey) typeSelect(e.key);
    });

    function moveSelection(key) {
      var names = lastNames;
      if (!names.length) return;
      var idx = names.indexOf(selectedName);
      if (idx === -1) { select(names[0]); return; }
      var step = 1;
      if (mode === "icon") {
        if (key === "ArrowLeft") idx -= 1;
        else if (key === "ArrowRight") idx += 1;
        else if (key === "ArrowUp") idx -= lastColumns;
        else if (key === "ArrowDown") idx += lastColumns;
      } else {
        if (key === "ArrowUp") idx -= 1;
        else if (key === "ArrowDown") idx += 1;
      }
      idx = Math.max(0, Math.min(names.length - 1, idx));
      select(names[idx]);
    }

    function typeSelect(ch) {
      typeBuf += ch.toLowerCase();
      if (typeTimer) clearTimeout(typeTimer);
      typeTimer = setTimeout(function () { typeBuf = ""; }, 700);
      var match = lastNames.filter(function (n) { return n.toLowerCase().indexOf(typeBuf) === 0; })[0];
      if (match) select(match);
    }

    // ── live updates ──
    fs.on(function () { render(); });

    render();

    var api = { open: open, emptyTrash: emptyTrashAlert, path: function () { return curPath.slice(); } };
    win._bzFinderApi = api;
    return api;
  };
})();
