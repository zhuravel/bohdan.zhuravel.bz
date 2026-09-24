/* bz — a pretend Mac home folder, shared by the Terminal (bash) and the Finder */
(function () {
  "use strict";

  var HOME = "/Users/bohdan";
  var HOST = "bz";
  var USER = "bohdan";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  // ── Filesystem ──────────────────────────────────────────────
  // Everything lives under ~ (/Users/bohdan). The Trash is ~/.Trash, as on a real Mac.
  // Changes last for the session only; a reload restores the original files.
  window.BzFS = (function () {
    var root = {
      type: "dir", date: "Sep 21, 2026 4:10 PM",
      children: {
        ".Trash": { type: "dir", date: "Sep 21, 2026 4:10 PM", children: {} },
        "about.txt": {
          type: "file", date: "Sep 24, 2026 1:04 AM", size: "1136 bytes",
          html: 'Bohdan Zhuravel\nSoftware Engineer at <a href="https://www.talkable.com" target="_blank" rel="noopener">Talkable</a>\n\nWrites whatever the job needs (with AI, anything is possible) and\nreviews code the way he\'d want his own reviewed.\n\nLoves old things and new things alike. The collection: two Apple\nExtended Keyboard IIs, four Keychrons, a Magic Keyboard, four trackballs\nand one vertical mouse. The terminal: a small team of AI agents. Always\ntrying things, because the pursuit of excellence deserves no\nexplanation.\n\nAlso owns a PS4 and a PS5, a Switch and a Switch 2, an Xbox Series X\nand a few retro consoles. Life and work have been busy lately, so most\nof his gaming happens on YouTube, watching other people play.\n\nCollects good tools, goes looking for hard problems, and genuinely\nenjoys the work. Still runs the Mac OS X Tiger "Aqua Blue" wallpaper\nand believes a keyboard should sound like a keyboard.\n\nThis desktop is his idea of a homepage. Poke around, open things,\ndrag something to the Trash. Try `man bohdan`.\n\n  github    <a href="https://github.com/zhuravel" target="_blank" rel="me noopener">https://github.com/zhuravel</a>\n  linkedin  <a href="https://www.linkedin.com/in/bohdanzhuravel/" target="_blank" rel="noopener">https://www.linkedin.com/in/bohdanzhuravel/</a>\n  gaming    <a href="https://www.exophase.com/user/zhuravel/" target="_blank" rel="me noopener">https://www.exophase.com/user/zhuravel/</a>\n  email     run `finger bohdan`'
        },
        links: {
          type: "dir", date: "Sep 21, 2026 4:10 PM",
          children: {
            github: { type: "link", date: "Sep 21, 2026 4:10 PM", size: "4 KB", url: "https://github.com/zhuravel", rel: "me" },
            linkedin: { type: "link", date: "Sep 21, 2026 4:10 PM", size: "4 KB", url: "https://www.linkedin.com/in/bohdanzhuravel/" }
          }
        },
        "portrait.png": {
          type: "image", date: "Sep 18, 2026 11:47 AM", size: "142 KB",
          src: "img/portrait-white.jpg", term: "img/portrait-1bit.png", alt: "Portrait of Bohdan Zhuravel"
        }
      }
    };
    (function toMaps(node) {
      if (node.type !== "dir") return;
      var map = Object.create(null);
      Object.keys(node.children).forEach(function (k) { map[k] = node.children[k]; toMaps(map[k]); });
      node.children = map;
    })(root);

    var listeners = [];

    function isTrash(path) { return path.length === 1 && path[0] === ".Trash"; }

    function emit() { listeners.forEach(function (fn) { fn(); }); }

    function get(path) {
      var node = root;
      for (var i = 0; i < path.length; i++) {
        if (!node || node.type !== "dir" || !has(node.children, path[i])) return null;
        node = node.children[path[i]];
      }
      return node;
    }

    // path string (absolute, ~, or relative to cwd) → { node, path } | null
    function resolve(p, cwd) {
      var parts;
      // "/" is the top of the pretend disk, which is ~ (what Macintosh HD shows in the Finder)
      if (p == null || p === "" || p === "~" || /^\/+$/.test(p)) parts = [];
      else if (p.indexOf("~/") === 0) parts = p.slice(2).split("/");
      else if (p === HOME || p.indexOf(HOME + "/") === 0) parts = p.slice(HOME.length).split("/");
      else if (p.charAt(0) === "/") return null;
      else parts = (cwd || []).concat(p.split("/"));

      var stack = [];
      for (var i = 0; i < parts.length; i++) {
        var s = parts[i];
        if (!s || s === ".") continue;
        if (s === "..") { if (!stack.length) return null; stack.pop(); }
        else stack.push(s);
      }
      var node = get(stack);
      return node ? { node: node, path: stack } : null;
    }

    function names(node, all) {
      return Object.keys(node.children).filter(function (n) { return all || n.charAt(0) !== "."; }).sort(function (a, b) {
        return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
      });
    }

    function kind(node) {
      return { dir: "Folder", file: "Plain Text", image: "PNG image", link: "Web site location" }[node.type];
    }

    function uniqueName(dir, name) {
      if (!dir.children[name]) return name;
      var dot = name.lastIndexOf(".");
      var base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : "";
      for (var n = 2; ; n++) if (!dir.children[base + " " + n + ext]) return base + " " + n + ext;
    }

    function isInside(path, dirPath) {
      return dirPath.length >= path.length && path.every(function (s, i) { return dirPath[i] === s; });
    }

    // Move the node at `from` into directory `toDir`, optionally renaming it.
    // Returns an error string, or null on success.
    function move(from, toDir, name, opts) {
      opts = opts || {};
      if (!from.length || isTrash(from)) return "Operation not permitted";
      var parent = get(from.slice(0, -1)), dest = get(toDir);
      var oldName = from[from.length - 1];
      var node = parent && parent.children[oldName];
      if (!node) return "No such file or directory";
      if (!dest || dest.type !== "dir") return "No such file or directory";
      if (node.type === "dir" && isInside(from, toDir)) return "Invalid argument";
      name = name || oldName;
      if (dest === parent && name === oldName) return null;
      if (has(dest.children, name)) {
        if (opts.unique) name = uniqueName(dest, name);
        else if (dest.children[name].type === "dir" || node.type === "dir") return "Directory not empty";
      }
      delete parent.children[oldName];
      if (!opts.keepOrigin) delete node.origin;
      dest.children[name] = node;
      emit();
      return null;
    }

    function remove(path) {
      var parent = get(path.slice(0, -1));
      if (isTrash(path)) return "Operation not permitted";
      if (!path.length || !parent || !has(parent.children, path[path.length - 1])) return "No such file or directory";
      delete parent.children[path[path.length - 1]];
      emit();
      return null;
    }

    // Finder's Move to Trash: remembers where the item came from, for Put Back
    function trash(path) {
      var node = get(path);
      if (!node || !path.length || path[0] === ".Trash") return null;
      var t = get([".Trash"]);
      var name = uniqueName(t, path[path.length - 1]);
      var origin = { dir: path.slice(0, -1), name: path[path.length - 1] };
      var err = move(path, [".Trash"], name);
      if (!err) node.origin = origin;
      return err;
    }

    function putBack(name) {
      var node = get([".Trash", name]);
      if (!node || !node.origin) return "Unknown origin";
      var dir = get(node.origin.dir) ? node.origin.dir : [];
      return move([".Trash", name], dir, node.origin.name, { unique: true });
    }

    function emptyTrash() {
      get([".Trash"]).children = Object.create(null);
      emit();
    }

    return {
      HOME: HOME,
      get: get,
      resolve: resolve,
      names: names,
      kind: kind,
      move: move,
      remove: remove,
      trash: trash,
      putBack: putBack,
      emptyTrash: emptyTrash,
      trashCount: function () { var t = get([".Trash"]); return t ? Object.keys(t.children).length : 0; },
      absolute: function (path) { return HOME + (path.length ? "/" + path.join("/") : ""); },
      on: function (fn) { listeners.push(fn); }
    };
  })();

  var FS = window.BzFS;

  var COMMANDS = ["cal", "cat", "cd", "clear", "date", "echo", "exit", "help", "history", "hostname", "id", "imgcat", "ls", "man", "mv", "open", "pwd", "rm", "sw_vers", "tty", "uname", "whoami"];

  function anchor(node, label) {
    return '<a href="' + node.url + '" target="_blank"' + (node.rel ? ' rel="' + node.rel + '"' : "") + ">" + esc(label) + "</a>";
  }

  function stamp(d) {
    var p = d.toDateString().split(" "); // Wed Sep 23 2026
    return p[0] + " " + p[1] + " " + p[2] + " " + d.toTimeString().slice(0, 8);
  }

  function bashDate(d) {
    var tz = "";
    try {
      tz = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(d)
        .filter(function (x) { return x.type === "timeZoneName"; })[0].value;
    } catch (e) {}
    return stamp(d) + (tz ? " " + tz : "") + " " + d.getFullYear();
  }

  // ── cal(1) ──────────────────────────────────────────────────
  // Like BSD cal: Julian calendar until 2 September 1752, Gregorian from 14 September 1752
  // (so `cal 9 1752` is missing eleven days). Today is shown in reverse video.
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function gregorian(y, m, d) { return y > 1752 || (y === 1752 && (m > 9 || (m === 9 && d >= 14))); }

  // Julian Day Number; weekday = (jdn + 1) % 7 with 0 = Sunday
  function jdn(y, m, d) {
    var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    var base = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4);
    return gregorian(y, m, d) ? base - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045 : base - 32083;
  }

  function monthDays(y, m) {
    var leap = y > 1752 ? y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) : y % 4 === 0;
    var n = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1], days = [];
    for (var d = 1; d <= n; d++) if (!(y === 1752 && m === 9 && d > 2 && d < 14)) days.push(d);
    return days;
  }

  function pad(s, w, left) { s = String(s); while (s.length < w) s = left ? " " + s : s + " "; return s; }
  function center(s, w) { return pad(pad("", Math.floor((w - s.length) / 2)) + s, w); }

  // One month as 8 fixed-width lines: title, weekdays, six weeks. Today is wrapped in \x01…\x02.
  function monthBlock(y, m, withYear, julian, today) {
    var w = julian ? 27 : 20, cw = julian ? 3 : 2;
    var rows = [[], [], [], [], [], []], row = 0, first = true;
    monthDays(y, m).forEach(function (d) {
      var dow = (jdn(y, m, d) + 1) % 7;
      if (!first && dow === 0) row++;
      first = false;
      var label = pad(julian ? jdn(y, m, d) - jdn(y, 1, 1) + 1 : d, cw, true);
      if (today && today[0] === y && today[1] === m && today[2] === d) label = label.replace(/(\S+)/, "\x01$1\x02");
      rows[row][dow] = label;
    });
    var lines = [center(MONTHS[m - 1] + (withYear ? " " + y : ""), w), julian ? " Su  Mo  Tu  We  Th  Fr  Sa" : "Su Mo Tu We Th Fr Sa"];
    rows.forEach(function (r) {
      var cells = [];
      for (var i = 0; i < 7; i++) cells.push(r[i] || pad("", cw));
      lines.push(pad(cells.join(" "), w));
    });
    return lines;
  }

  function sideBySide(blocks) {
    var out = [];
    for (var i = 0; i < blocks[0].length; i++) out.push(blocks.map(function (b) { return b[i]; }).join("  ").replace(/\s+$/, ""));
    return out;
  }

  function cal(args) {
    var now = new Date(), today = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
    var julian = false, year3 = false, three = false, month = null, pos = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === "-m") {
        if (i + 1 >= args.length) return { error: "usage: cal [-13jy] [[month] year]\n       cal [-13j] [-m month] [year]" };
        month = args[++i];
        continue;
      }
      if (/^-[13jy]+$/.test(a)) {
        if (a.indexOf("j") > 0) julian = true;
        if (a.indexOf("y") > 0) year3 = true;
        if (a.indexOf("3") > 0) three = true;
        continue;
      }
      if (a.charAt(0) === "-") return { error: "usage: cal [-13jy] [[month] year]\n       cal [-13j] [-m month] [year]" };
      pos.push(a);
    }
    if (pos.length > 2) return { error: "usage: cal [-13jy] [[month] year]\n       cal [-13j] [-m month] [year]" };
    if (pos.length === 2) month = pos[0];
    var y = today[0], m = today[1];
    var ys = pos.length ? pos[pos.length - 1] : null;
    if (ys !== null) {
      if (!/^\d+$/.test(ys) || +ys < 1 || +ys > 9999) return { error: "cal: year `" + ys + "' not in range 1..9999" };
      y = +ys;
      if (pos.length === 1 && month === null) year3 = true;
    }
    if (month !== null) {
      var mi = /^\d+$/.test(month) ? +month : -1;
      if (mi < 0) MONTHS.forEach(function (n, k) { if (month.length >= 3 && n.toLowerCase().indexOf(month.toLowerCase()) === 0) mi = k + 1; });
      if (mi < 1 || mi > 12) return { error: "cal: " + month + " is neither a month number (1..12) nor a name" };
      m = mi;
      year3 = false;
    }
    var lines;
    if (year3) {
      // like BSD cal: the year is centred over the months (gaps excluded), groups split by a blank line
      var per = julian ? 2 : 3;
      lines = [center(String(y), (julian ? 27 : 20) * per).replace(/\s+$/, "")];
      for (var k = 1; k <= 12; k += per) {
        var group = [];
        for (var j = k; j < k + per && j <= 12; j++) group.push(monthBlock(y, j, false, julian, today));
        if (k > 1) lines.push("");
        lines = lines.concat(sideBySide(group));
      }
    } else if (three) {
      var prev = m === 1 ? [y - 1, 12] : [y, m - 1], next = m === 12 ? [y + 1, 1] : [y, m + 1];
      lines = sideBySide([prev, [y, m], next].filter(function (p) { return p[0] >= 1 && p[0] <= 9999; })
        .map(function (p) { return monthBlock(p[0], p[1], true, julian, today); }));
    } else {
      lines = monthBlock(y, m, true, julian, today).map(function (l) { return l.replace(/\s+$/, ""); });
    }
    return { text: lines.join("\n") };
  }

  // Shell words: "quoted", 'quoted', or backslash-escaped (about\ 2.txt)
  function tokenize(cmd) {
    var words = [], cur = null, q = null;
    for (var i = 0; i < cmd.length; i++) {
      var c = cmd.charAt(i);
      if (q) {
        if (c === q) q = null;
        else if (c === "\\" && q === '"' && i + 1 < cmd.length && /["\\$`]/.test(cmd.charAt(i + 1))) cur += cmd.charAt(++i);
        else cur += c;
      } else if (/\s/.test(c)) {
        if (cur !== null) { words.push(cur); cur = null; }
      } else {
        if (cur === null) cur = "";
        if (c === '"' || c === "'") q = c;
        else if (c === "\\" && i + 1 < cmd.length) cur += cmd.charAt(++i);
        else cur += c;
      }
    }
    if (cur !== null) words.push(cur);
    return words;
  }

  function shellEscape(s) { return s.replace(/([\s\\'"])/g, "\\$1"); }

  // quote s for where it's being typed: inside '…', inside "…", or bare
  function quoteAs(q, s) {
    if (q === "'") return s.replace(/'/g, "'\\''");
    if (q === '"') return s.replace(/(["\\$`])/g, "\\$1");
    return shellEscape(s);
  }

  // Add-on commands (e.g. toys.js): BzShell.register(name, fn(args, api))
  var EXT = {};

  window.BzShell = function (opts) {
    var screen = opts.screen;
    var input = opts.input;
    var isActive = opts.isActive || function () { return true; };
    // "panther" = Mac OS X 10.3 on a PowerPC; default = Mountain Lion
    var panther = opts.era === "panther";
    var TTY = panther ? "ttyp1" : "ttys000";
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var coarse = window.matchMedia("(pointer: coarse)").matches;

    var cwd = [];
    var session = 0; // bumped by start() and dispose(); timers from an older session stop themselves
    var loginAt = new Date();
    var MAX_LINES = 500;
    var mode = null; // an add-on that has taken over the keyboard (emacs, tetris…)
    var history = [];
    var hIndex = 0;
    var busy = false;
    var skip = false;
    var ended = false;
    var live;

    function prompt() { return HOST + ":" + (cwd.length ? cwd[cwd.length - 1] : "~") + " " + USER + "$ "; }

    function line(html, cls) {
      var el = document.createElement("div");
      el.className = "line" + (cls ? " " + cls : "");
      el.innerHTML = html;
      screen.insertBefore(el, live);
      while (screen.childElementCount > MAX_LINES + 1) screen.removeChild(screen.firstElementChild);
      return el;
    }

    function render(typed) {
      if (ended) return;
      var v = typed != null ? typed : input.value;
      var pos = typed != null || input.selectionStart == null ? v.length : input.selectionStart;
      live.innerHTML = '<span class="prompt">' + esc(prompt()) + "</span>" + esc(v.slice(0, pos)) +
        '<span class="cursor">' + (v.charAt(pos) ? esc(v.charAt(pos)) : " ") + "</span>" + esc(v.slice(pos + 1));
    }

    function scroll(intoView) {
      screen.scrollTop = screen.scrollHeight;
      if (intoView) live.scrollIntoView({ block: "nearest" });
    }

    function resolve(p) { return FS.resolve(p, cwd); }

    function listing(node, all) {
      var list = FS.names(node, all);
      if (all) list = [".", ".."].concat(list);
      return list.map(function (name) {
        var c = node.children[name];
        return c && c.type === "link" ? anchor(c, name) : "<span>" + esc(name) + "</span>";
      }).join("");
    }

    function flags(args) { return args.filter(function (a) { return a.charAt(0) === "-"; }).join(""); }
    function operands(args) { return args.filter(function (a) { return a.charAt(0) !== "-"; }); }
    function basename(p) { return p.replace(/\/+$/, "").split("/").pop(); }
    function dirname(p) { var i = p.replace(/\/+$/, "").lastIndexOf("/"); return i < 0 ? "." : p.slice(0, i) || "/"; }

    var bin = {
      help: function () {
        line('<span class="dim">' + COMMANDS.join("  ") + "</span>");
      },
      ls: function (args) {
        var all = /a/.test(flags(args));
        var paths = operands(args);
        if (!paths.length) paths = ["."];
        paths.forEach(function (p, i) {
          var r = resolve(p);
          if (!r) return line("ls: " + esc(p) + ": No such file or directory");
          if (paths.length > 1) line((i ? "\n" : "") + esc(p) + ":");
          if (r.node.type === "dir") line(listing(r.node, all), "ls");
          else line(r.node.type === "link" ? anchor(r.node, p) : esc(p));
        });
      },
      cd: function (args) {
        var p = args[0] || "~";
        var r = resolve(p);
        if (!r) return line("-bash: cd: " + esc(p) + ": No such file or directory");
        if (r.node.type !== "dir") return line("-bash: cd: " + esc(p) + ": Not a directory");
        cwd = r.path;
      },
      pwd: function () {
        line(esc(FS.absolute(cwd)));
      },
      cat: function (args) {
        operands(args).forEach(function (p) {
          var r = resolve(p);
          if (!r) return line("cat: " + esc(p) + ": No such file or directory");
          var n = r.node;
          if (n.type === "dir") line("cat: " + esc(p) + ": Is a directory");
          else if (n.type === "file") line(n.html);
          else if (n.type === "link") line(anchor(n, n.url));
          else line('<span class="dim">‰PNG  IHDR  ð  ð ÆzÔ  ²IDATxÚì½…</span>');
        });
      },
      imgcat: function (args) {
        var paths = operands(args);
        if (!paths.length) return line("usage: imgcat filename ...");
        paths.forEach(function (p) {
          var r = resolve(p);
          if (!r) return line("imgcat: " + esc(p) + ": No such file or directory");
          if (r.node.type !== "image") return line("imgcat: " + esc(p) + ": not an image");
          var img = line('<img class="portrait" src="' + (r.node.term || r.node.src) + '" width="240" height="240" alt="' + esc(r.node.alt) + '" />').querySelector("img");
          img.addEventListener("load", function () { scroll(); });
        });
      },
      open: function (args) {
        var paths = operands(args);
        if (!paths.length) return line("Usage: open [-e] [-t] [-f] [-W] [-R] [-n] [-g] [-h] [-b &lt;bundle identifier&gt;] [-a &lt;application&gt;] [filenames]");
        paths.forEach(function (p) {
          // URLs go to the browser (Safari on the desktop)
          if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p) || /^www\./i.test(p)) {
            var url = /^www\./i.test(p) ? "http://" + p : p;
            return opts.openURL ? opts.openURL(url) : window.open(url, "_blank", "noopener");
          }
          // bare link names ("open github") also resolve inside ~/links, but paths never do
          var r = resolve(p) || (p.indexOf("/") < 0 ? resolve("~/links/" + p) : null);
          if (!r) return line("The file " + esc(/^[\/~]/.test(p) ? p : FS.absolute(cwd) + "/" + p) + " does not exist.");
          var n = r.node;
          if (n.type === "link") window.open(n.url, "_blank", "noopener");
          else if (n.type === "dir") { if (opts.openDir) opts.openDir(r.path); else line(listing(n), "ls"); }
          else if (n.type === "file") line(n.html);
          else bin.imgcat([p]);
        });
      },
      // rm unlinks immediately; it never goes through the Trash
      rm: function (args) {
        var f = flags(args), recursive = /[rR]/.test(f), force = /f/.test(f);
        var paths = operands(args);
        if (!paths.length) return line("usage: rm [-f | -i] [-dPRrvW] file ...");
        paths.forEach(function (p) {
          if (/^\.\.?\/?$/.test(p) || /\/\.\.?\/?$/.test(p)) return line('rm: "." and ".." may not be removed');
          var r = resolve(p);
          if (!r) { if (!force) line("rm: " + esc(p) + ": No such file or directory"); return; }
          if (!r.path.length) return line("rm: " + esc(p) + ": Permission denied");
          if (r.node.type === "dir" && !recursive) return line("rm: " + esc(p) + ": is a directory");
          var err = FS.remove(r.path);
          if (err) line("rm: " + esc(p) + ": " + err);
        });
      },
      mv: function (args) {
        var paths = operands(args);
        if (paths.length < 2) return line("usage: mv [-f | -i | -n] [-v] source target\n       mv [-f | -i | -n] [-v] source ... directory");
        var target = paths.pop();
        var t = resolve(target);
        if (paths.length > 1 && (!t || t.node.type !== "dir")) return line("mv: " + esc(target) + " is not a directory");
        paths.forEach(function (p) {
          var r = resolve(p);
          if (!r) return line("mv: rename " + esc(p) + " to " + esc(target) + ": No such file or directory");
          var err;
          if (t && t.node.type === "dir") {
            err = FS.move(r.path, t.path, basename(p));
          } else {
            var parent = resolve(dirname(target));
            err = parent && parent.node.type === "dir" ? FS.move(r.path, parent.path, basename(target)) : "No such file or directory";
          }
          if (err) line("mv: rename " + esc(p) + " to " + esc(target) + ": " + esc(err));
        });
      },
      cal: function (args) {
        var r = cal(args);
        if (r.error) return line(esc(r.error));
        line(esc(r.text).replace(/\x01/g, '<span class="rev">').replace(/\x02/g, "</span>"));
      },
      whoami: function () { line(USER); },
      id: function (args) {
        if (args[0] === "-F") line("Bohdan Zhuravel");
        else if (args[0] === "-un") line(USER);
        else line("uid=501(bohdan) gid=20(staff) groups=20(staff),12(everyone),61(localaccounts),80(admin)");
      },
      hostname: function () { line(HOST); },
      tty: function () { line("/dev/" + TTY); },
      sw_vers: function () {
        line(panther
          ? "ProductName:\tMac OS X\nProductVersion:\t10.3.9\nBuildVersion:\t7W98"
          : "ProductName:\tMac OS X\nProductVersion:\t10.8.5\nBuildVersion:\t12F45");
      },
      man: function (args) {
        var page = operands(args)[0];
        if (!page) return line("What manual page do you want?");
        if (page !== "bohdan") return line("No manual entry for " + esc(page));
        var gh = FS.get(["links", "github"]), li = FS.get(["links", "linkedin"]);
        var ref = function (node, name) { return node ? anchor(node, name + "(1)") : name + "(1)"; };
        line([
          "BOHDAN(1)               BSD General Commands Manual              BOHDAN(1)",
          "",
          "<b>NAME</b>",
          "     <b>bohdan</b> -- software engineer",
          "",
          "<b>SYNOPSIS</b>",
          "     <b>bohdan</b> [<b>--github</b>] [<b>--linkedin</b>]",
          "",
          "<b>DESCRIPTION</b>",
          "     <b>Bohdan Zhuravel</b> is a software engineer at " + anchor({ url: "https://www.talkable.com" }, "Talkable") + ".",
          "",
          "<b>SEE ALSO</b>",
          "     <b>finger</b>(1), " + ref(gh, "github") + ", " + ref(li, "linkedin"),
          "",
          (panther ? "Mac OS X" : "OS X") + "                      September 21, 2026                     " + (panther ? "Mac OS X" : "    OS X")
        ].join("\n"));
      },
      uname: function (args) {
        var a = args[0] || "";
        if (a === "-a") {
          line(panther
            ? "Darwin bz 7.9.0 Darwin Kernel Version 7.9.0: Wed Mar 30 20:11:17 PST 2005; root:xnu/xnu-517.12.7.obj~1/RELEASE_PPC  Power Macintosh powerpc"
            : "Darwin bz 12.5.0 Darwin Kernel Version 12.5.0: Sun Sep 29 13:33:47 PDT 2013; root:xnu-2050.48.12~1/RELEASE_X86_64 x86_64");
        } else if (a === "-r") line(panther ? "7.9.0" : "12.5.0");
        else if (a === "-m") line(panther ? "Power Macintosh" : "x86_64");
        else if (a === "-p") line(panther ? "powerpc" : "i386");
        else line("Darwin");
      },
      echo: function (args) { line(esc(args.join(" "))); },
      date: function () { line(esc(bashDate(new Date()))); },
      history: function () {
        line(esc(history.map(function (h, i) { return ("    " + (i + 1)).slice(-5) + "  " + h; }).join("\n")));
      },
      clear: function () {
        Array.prototype.slice.call(screen.children).forEach(function (el) { if (el !== live) el.remove(); });
      },
      sudo: function () { line("bohdan is not in the sudoers file.  This incident will be reported."); },
      exit: function () {
        line("logout\n\n[Process completed]");
        ended = true;
        live.hidden = true;
      }
    };

    function exec(raw) {
      line('<span class="prompt">' + esc(prompt()) + "</span>" + esc(raw));
      var cmd = raw.trim();
      if (!cmd) return;
      history.push(cmd);
      hIndex = history.length;
      var toks = tokenize(cmd);
      var name = toks.shift();
      if (has(EXT, name)) EXT[name](toks, api); // add-ons may override builtins
      else if (has(bin, name)) bin[name](toks);
      else line("-bash: " + esc(name) + ": command not found");
    }

    function complete() {
      var v = input.value;
      var pos = input.selectionStart;
      var head = v.slice(0, pos);
      var tail = v.slice(pos);
      // find where the word under the cursor starts, honouring quotes and escapes
      var start = -1, q = null;
      for (var i = 0; i < head.length; i++) {
        var c = head.charAt(i);
        if (q) { if (c === q) q = null; else if (c === "\\" && q === '"') i++; }
        else if (/\s/.test(c)) start = -1;
        else { if (start < 0) start = i; if (c === '"' || c === "'") q = c; else if (c === "\\") i++; }
      }
      var word = start < 0 ? "" : head.slice(start);
      var before = head.slice(0, head.length - word.length);
      var names, have, typed; // the matching names, how much of one is typed, and how to type one

      if (!before.trim()) {
        names = COMMANDS.filter(function (c) { return c.indexOf(word) === 0; });
        have = word;
        typed = function (n, whole) { return n + (whole ? " " : ""); };
      } else {
        var plain = tokenize(word + (q || ""))[0] || "";
        var slash = plain.lastIndexOf("/");
        var dirPart = slash >= 0 ? plain.slice(0, slash + 1) : "";
        var base = plain.slice(slash + 1);
        var r = resolve(dirPart || ".");
        if (!r || r.node.type !== "dir") return;
        names = FS.names(r.node, base.charAt(0) === ".").filter(function (n) { return n.indexOf(base) === 0; });
        have = base;
        typed = function (n, whole) {
          var s = (q || "") + quoteAs(q, dirPart + n);
          // inside an open quote, complete within it and close it after a file (like bash)
          return whole ? s + (r.node.children[n].type === "dir" ? "/" : (q || "") + " ") : s;
        };
      }

      if (!names.length) return;
      if (names.length === 1) {
        word = typed(names[0], true);
      } else {
        // the common prefix is taken from the plain names, then quoted, so an escape never gets cut in half
        var prefix = names[0];
        names.forEach(function (n) { while (n.indexOf(prefix) !== 0) prefix = prefix.slice(0, -1); });
        if (prefix.length > have.length) {
          word = typed(prefix, false);
        } else {
          line('<span class="prompt">' + esc(prompt()) + "</span>" + esc(v));
          line(names.map(function (n) { return "<span>" + esc(n) + "</span>"; }).join(""), "ls");
        }
      }
      input.value = before + word + tail;
      input.setSelectionRange((before + word).length, (before + word).length);
      render();
      scroll();
    }

    function start(intro) {
      session++;
      loginAt = new Date();
      disposeMode();
      screen.innerHTML = "";
      cwd = [];
      ended = false;
      live = document.createElement("div");
      live.className = "line live";
      screen.appendChild(live);
      line("Last login: " + esc(stamp(new Date(Date.now() - 36e5 * 3.2))) + " on " + TTY);
      if (panther) line("Welcome to Darwin!");
      input.value = "";
      render();
      play(intro || []);
    }

    function play(cmds) {
      var i = 0, token = session;
      busy = true;
      skip = false;

      function done() {
        busy = false;
        render();
        scroll();
        if (isActive() && !coarse) input.focus({ preventScroll: true });
      }

      function instant() {
        for (; i < cmds.length; i++) exec(cmds[i]);
        done();
      }

      (function next() {
        if (token !== session) return;
        if (skip || reduced) return instant();
        if (i >= cmds.length) return done();
        var c = cmds[i];
        var k = 0;
        setTimeout(function type() {
          if (token !== session) return;
          if (skip) return instant();
          render(c.slice(0, ++k));
          if (k < c.length) return setTimeout(type, 45 + Math.random() * 55);
          setTimeout(function () {
            if (token !== session) return;
            if (skip) return instant();
            exec(c);
            i++;
            render("");
            scroll();
            setTimeout(next, 300);
          }, 220);
        }, i === 0 ? 700 : 450);
      })();
    }

    screen.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      if (busy) { skip = true; return; }
      if (ended) return start();
      if (!window.getSelection().toString()) input.focus({ preventScroll: true });
    });

    document.addEventListener("keydown", function (e) {
      if (!isActive() || e.target === input) return;
      if (busy) { skip = true; return; }
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        input.focus({ preventScroll: true });
        setValue(input.value, e.key === "Home" ? 0 : input.value.length);
        return;
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) input.focus({ preventScroll: true });
    });

    input.addEventListener("input", function () { render(); });

    function setValue(v, caret) {
      input.value = v;
      input.setSelectionRange(caret, caret);
      render();
    }

    function historyStep(delta) {
      if (delta < 0 && hIndex > 0) { hIndex--; setValue(history[hIndex], history[hIndex].length); }
      if (delta > 0) {
        if (hIndex < history.length - 1) { hIndex++; setValue(history[hIndex], history[hIndex].length); }
        else { hIndex = history.length; setValue("", 0); }
      }
    }

    // Emacs-style readline bindings, as in bash
    var killed = "";
    function readline(e) {
      if (!e.ctrlKey || e.metaKey || e.altKey) return false;
      var v = input.value;
      var p = input.selectionStart == null ? v.length : input.selectionStart;
      switch (e.key.toLowerCase()) {
        case "a": setValue(v, 0); break;
        case "e": setValue(v, v.length); break;
        case "b": setValue(v, Math.max(0, p - 1)); break;
        case "f": setValue(v, Math.min(v.length, p + 1)); break;
        case "u": killed = v.slice(0, p); setValue(v.slice(p), 0); break;
        case "k": killed = v.slice(p); setValue(v.slice(0, p), p); break;
        case "w":
          var head = v.slice(0, p).replace(/(\S+\s*|\s+)$/, "");
          killed = v.slice(head.length, p);
          setValue(head + v.slice(p), head.length);
          break;
        case "y": setValue(v.slice(0, p) + killed + v.slice(p), p + killed.length); break;
        case "h": if (p > 0) setValue(v.slice(0, p - 1) + v.slice(p), p - 1); break;
        case "d":
          if (v) { setValue(v.slice(0, p) + v.slice(p + 1), p); break; }
          line('<span class="prompt">' + esc(prompt()) + "</span>");
          bin.exit();
          break;
        case "p": historyStep(-1); break;
        case "n": historyStep(1); break;
        case "c":
          line('<span class="prompt">' + esc(prompt()) + "</span>" + esc(v) + "^C");
          setValue("", 0);
          scroll();
          break;
        case "l": bin.clear(); break;
        default: return false;
      }
      e.preventDefault();
      return true;
    }

    input.addEventListener("keydown", function (e) {
      if (mode) { if (mode.onKey(e) !== false) e.preventDefault(); return; }
      if (busy) { skip = true; e.preventDefault(); return; }
      if (ended) { e.preventDefault(); start(); return; }
      if (readline(e)) return;

      if (e.key === "Enter") {
        e.preventDefault();
        exec(input.value);
        input.value = "";
        render();
        scroll(true);
      } else if (e.key === "Home" || e.key === "End") {
        // macOS text fields ignore Home/End, so move the caret ourselves
        e.preventDefault();
        setValue(input.value, e.key === "Home" ? 0 : input.value.length);
      } else if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        complete();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        historyStep(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        historyStep(1);
      } else if (e.metaKey && e.key === "k") {
        e.preventDefault();
        bin.clear();
      } else {
        setTimeout(render, 0); // caret moves (←, →, Home, End)
      }
    });

    // A full-screen program is torn down when its Terminal session ends
    function disposeMode() {
      if (!mode) return;
      var m = mode;
      mode = null;
      if (m._el) m._el.remove();
      if (live) live.hidden = false;
      try { if (m.onDispose) m.onDispose(); } catch (e) {}
    }

    // What add-on commands get to work with
    var api = {
      line: function (html, cls) { return line(html, cls); },
      text: function (s, cls) {
        s = String(s);
        if (s.length > 40000) s = "…\n" + s.slice(-40000);
        return line(esc(s), cls);
      },
      esc: esc,
      fs: FS,
      cwd: function () { return cwd.slice(); },
      loginTime: function () { return loginAt; },
      // fn, made to do nothing if this Terminal session has ended by the time it runs
      guard: function (fn) {
        var token = session;
        return function () { if (token === session) return fn.apply(this, arguments); };
      },
      later: function (fn, ms) { return setTimeout(api.guard(fn), ms); },
      resolve: resolve,
      era: panther ? "panther" : "mountain-lion",
      scroll: function () { scroll(); },
      // Full-screen programs: hides the prompt and routes every keydown to h.onKey(e)
      // (return false to let the browser handle it). Call the returned exit() to leave.
      takeover: function (h) {
        var el = document.createElement("div");
        el.className = "line raw";
        screen.insertBefore(el, live);
        live.hidden = true;
        mode = h;
        input.value = "";
        h._el = el;
        return {
          el: el,
          exit: function (keep) {
            mode = null;
            if (!keep) el.remove();
            live.hidden = false;
            render();
            scroll();
          }
        };
      }
    };

    start(opts.intro);

    return {
      clear: function () { if (!busy) bin.clear(); },
      // A new Terminal window is a new login session
      reset: function () { skip = true; cwd = []; start(); },
      dispose: function () { session++; disposeMode(); },
      focus: function () { if (!busy && !coarse) input.focus({ preventScroll: true }); },
      blur: function () { input.blur(); },
      // Dropping a file from the Finder types its path, like a real Terminal
      insertPath: function (path) {
        if (busy) skip = true;
        if (ended) start();
        var text = shellEscape(FS.absolute(path)) + " ";
        var v = input.value, p = input.selectionStart == null ? v.length : input.selectionStart;
        setValue(v.slice(0, p) + text + v.slice(p), p + text.length);
        if (!coarse) input.focus({ preventScroll: true });
      }
    };
  };

  window.BzShell.register = function (name, fn) {
    EXT[name] = fn;
    if (COMMANDS.indexOf(name) < 0) { COMMANDS.push(name); COMMANDS.sort(); }
  };
})();
