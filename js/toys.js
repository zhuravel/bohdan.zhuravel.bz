/* toys.js -- "Terminal toys" add-on for the bz pretend bash (see shell.js).
   Registers: say, fortune, banner, emacs, sudo, kill.
   Vendored third-party data lives in variants/vendor/toys/ (fortunes, ELIZA,
   banner glyphs) -- see the LICENSE-*.txt files and README.md there.
   Script tag order required: shell.js, then the vendor/toys/*.js data files,
   then this file. See the bottom of this file for the exact list.
*/
(function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  function padRight(s, w) {
    s = String(s);
    while (s.length < w) s += " ";
    return s;
  }

  // ============================================================================
  // say [-v voice] text...  (Web Speech API; ready-made, no vendoring needed)
  // ============================================================================
  var SAY_VOICE_PREF = ["Fred", "Victoria", "Ralph", "Albert"];

  function pickVoice(voices, wanted) {
    var i, w;
    if (wanted) {
      w = wanted.toLowerCase();
      for (i = 0; i < voices.length; i++) if (voices[i].name.toLowerCase() === w) return voices[i];
      for (i = 0; i < voices.length; i++) if (voices[i].name.toLowerCase().indexOf(w) >= 0) return voices[i];
      return null;
    }
    for (var p = 0; p < SAY_VOICE_PREF.length; p++) {
      w = SAY_VOICE_PREF[p].toLowerCase();
      for (i = 0; i < voices.length; i++) if (voices[i].name.toLowerCase() === w) return voices[i];
    }
    // no classic Mac voice: prefer an English default, then any English voice, then whatever exists
    for (i = 0; i < voices.length; i++) if (voices[i].default && /^en/i.test(voices[i].lang)) return voices[i];
    for (i = 0; i < voices.length; i++) if (/^en[-_]US/i.test(voices[i].lang)) return voices[i];
    for (i = 0; i < voices.length; i++) if (/^en/i.test(voices[i].lang)) return voices[i];
    for (i = 0; i < voices.length; i++) if (voices[i].default) return voices[i];
    return voices.length ? voices[0] : null;
  }

  // Approximates `say -v ?`'s three columns (name, locale, sample). Real macOS
  // ships a canned sample phrase per voice; the Web Speech API doesn't expose
  // one, so we use a generic sample rather than inventing fake canned text.
  function sayVoiceLine(v) {
    return padRight(v.name, 22) + " " + padRight(v.lang || "", 8) + " # Hello, my name is " + v.name + ".";
  }

  BzShell.register("say", function (args, api) {
    var voiceArg = null, i = 0;
    if (args[0] === "-v") { voiceArg = args[1]; i = 2; }
    var synth = window.speechSynthesis;

    if (voiceArg === "?") {
      if (!synth) { api.text("say: Text to speech is not supported in this browser."); return; }
      var voices = synth.getVoices() || [];
      if (!voices.length) { api.text("say: no voices available."); return; }
      voices.forEach(function (v) { api.text(sayVoiceLine(v)); });
      return;
    }

    var text = args.slice(i).join(" ");
    if (!text) { api.text("usage: say [-v voice] message ..."); return; }
    if (window.BzSound && window.BzSound.muted()) return; // muted: print nothing, just don't speak
    if (!synth || typeof window.SpeechSynthesisUtterance === "undefined") {
      api.text("say: Text to speech is not supported in this browser.");
      return;
    }

    function speakWith(voices) {
      var voice = pickVoice(voices, voiceArg);
      if (voiceArg && !voice) { api.text("say: voice `" + voiceArg + "' cannot be found"); return; }
      var u = new window.SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      synth.speak(u);
    }

    var have = synth.getVoices() || [];
    if (have.length || !("onvoiceschanged" in synth)) {
      speakWith(have);
    } else {
      // Voices sometimes load asynchronously on first use; wait once, then give up and speak anyway.
      var done = false;
      synth.onvoiceschanged = function () {
        if (done) return;
        done = true;
        synth.onvoiceschanged = null;
        speakWith(synth.getVoices() || []);
      };
      setTimeout(function () { if (!done) { done = true; speakWith(synth.getVoices() || []); } }, 300);
    }
  });

  // fortune and banner fetch their data the first time one of them runs,
  // so that first time the prompt may come back a moment before the output does
  function needs(urls, run) {
    return function (args, api) {
      var go = api.guard(function () { run(args, api); api.scroll(); });
      if (window.BzLazy) window.BzLazy(urls, go); else go();
    };
  }

  // ============================================================================
  // fortune [-s]  (vendored BSD fortunes subset, see vendor/toys/fortunes-data.js)
  // ============================================================================
  BzShell.register("fortune", needs(["vendor/toys/fortunes-data.js"], function (args, api) {
    var pool = window.BZ_FORTUNES;
    if (!pool || !pool.length) { api.text("fortune: no fortunes found"); return; }
    if (args.indexOf("-s") >= 0) pool = pool.filter(function (f) { return f.short; });
    if (!pool.length) { api.text("fortune: no short fortunes found"); return; }
    var f = pool[Math.floor(Math.random() * pool.length)];
    api.text(f.text);
  }));

  // ============================================================================
  // banner [-w width] message...
  // Ported from BSD/FreeBSD banner(6); glyph data vendored in vendor/toys/banner-data.js.
  // Algorithm ported from banner.c's main(): asc_ptr[char] points into data_table,
  // a run-length program of (x,y) fill-run pairs terminated by flush bytes >=128
  // (low 6 bits = row-repeat count; >192 also ends the character).
  // ============================================================================
  var BANNER_DWIDTH = 132, BANNER_NCHARS = 128;

  function bannerRender(text, width) {
    var D = window.BzBannerData;
    if (!D) return { errorLines: ["banner: glyph data not loaded"] };
    var bad = [], i, code;
    for (i = 0; i < text.length; i++) {
      code = text.charCodeAt(i);
      if (code >= BANNER_NCHARS || !D.ascPtr[code]) {
        if (bad.indexOf(text.charAt(i)) < 0) bad.push(text.charAt(i));
      }
    }
    if (bad.length) {
      return { errorLines: bad.map(function (c) { return "banner: the character '" + c + "' is not in my character set"; }) };
    }

    var print = [], k, w;
    for (k = 0; k < BANNER_DWIDTH; k++) print[k] = false;
    for (w = 0; w < width; w++) print[Math.floor(w * BANNER_DWIDTH / width)] = true;

    var lines = [];
    for (var ci = 0; ci < text.length; ci++) {
      var line = [];
      for (k = 0; k < BANNER_DWIDTH; k++) line[k] = " ";
      var pc = D.ascPtr[text.charCodeAt(ci)];
      var term = 0, max = 0, linen = 0;
      while (!term) {
        var x = D.dataTable[pc];
        if (x >= 128) {
          if (x > 192) term = 1;
          var cnt = x & 63;
          while (cnt--) {
            if (print[linen]) {
              var row = [];
              for (var j = 0; j <= max; j++) if (print[j]) row.push(line[j]);
              lines.push(row.join(""));
            }
            linen++;
          }
          for (k = 0; k < BANNER_DWIDTH; k++) line[k] = " ";
          pc++;
        } else {
          var y = D.dataTable[pc + 1];
          max = x + y;
          while (x < max) line[x++] = "#";
          pc += 2;
        }
      }
    }
    return { lines: lines };
  }

  BzShell.register("banner", needs(["vendor/toys/banner-data.js"], function (args, api) {
    // Real banner defaults to a width of 132 (line-printer paper); our Terminal
    // is 80 columns, so we default -w to 80 instead. -w still works to override.
    var width = 80, widthGiven = false, rest = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === "-w") { width = parseInt(args[++i], 10); widthGiven = true; }
      else if (/^-w\d+$/.test(a)) { width = parseInt(a.slice(2), 10); widthGiven = true; }
      else if (a === "-t" || a === "-d") { /* trace/debug: accepted, no-op */ }
      else rest.push(a);
    }
    if (widthGiven && (isNaN(width) || width <= 0 || width > BANNER_DWIDTH)) {
      api.text("banner: illegal argument for -w option");
      return;
    }
    var text = rest.join(" ");
    if (!text) { api.text("usage: banner [-w width] message ..."); return; }
    var r = bannerRender(text, width);
    if (r.errorLines) { r.errorLines.forEach(function (l) { api.text(l); }); return; }
    api.text(r.lines.join("\n"));
  }));

  // ============================================================================
  // Kernel panic easter egg + sudo password prompt + kill
  // ============================================================================
  var PANIC_MESSAGES = [
    "You need to restart your computer. Hold down the Power button for several seconds or press the Restart button.",
    "Veuillez redémarrer votre ordinateur. Maintenez la touche de démarrage enfoncée pendant plusieurs secondes ou bien appuyez sur le bouton de réinitialisation.",
    "Sie müssen Ihren Computer neu starten. Halten Sie dazu die Einschalttaste einige Sekunden gedrückt oder drücken Sie die Neustart-Taste.",
    "コンピュータを再起動する必要があります。パワーボタンを数秒間押し続けるか、リセットボタンを押してください。"
  ];

  function showKernelPanic() {
    var overlay = document.createElement("div");
    overlay.className = "panic"; // lets the desktop keep the screensaver away from a kernel panic
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText = "position:fixed;inset:0;z-index:1980;background:rgba(20,20,20,0);" +
      "transition:background 1s ease;display:flex;align-items:center;justify-content:center;" +
      "cursor:default;font-family:'Lucida Grande','Lucida Sans Unicode',Geneva,Verdana,sans-serif;";
    var power = '<svg width="260" height="260" viewBox="0 0 100 100" style="position:absolute;opacity:.25" aria-hidden="true">' +
      '<circle cx="50" cy="54" r="34" fill="none" stroke="#fff" stroke-width="9"/>' +
      '<line x1="50" y1="10" x2="50" y2="48" stroke="#fff" stroke-width="9" stroke-linecap="round"/>' +
      "</svg>";
    var msgs = PANIC_MESSAGES.map(function (m) {
      return '<p style="margin:0 0 22px;color:#fff;font-size:19px;line-height:1.45;max-width:640px">' + esc(m) + "</p>";
    }).join("");
    overlay.innerHTML = '<div style="position:relative;padding:40px;max-width:720px">' + power +
      '<div style="position:relative">' + msgs + "</div></div>";
    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.style.background = "rgba(20,20,20,.92)"; });
    });

    function restart() {
      document.removeEventListener("keydown", onKey, true);
      overlay.removeEventListener("click", restart);
      overlay.remove(); // the Mac resets immediately; the desktop then plays its own restart sequence
      if (window.BzDesktop && window.BzDesktop.power) window.BzDesktop.power("restart");
      else window.location.reload();
    }
    function onKey() { restart(); }
    overlay.addEventListener("click", restart);
    document.addEventListener("keydown", onKey, true);
  }

  BzShell.register("kill", function (args, api) {
    var pids = args.filter(function (a) { return a.charAt(0) !== "-"; });
    if (!pids.length) { api.text("usage: kill [-signal] pid ..."); return; }
    pids.forEach(function (p) {
      if (p === "1") api.text("kill: 1: Operation not permitted");
      else api.text("kill: (" + p + "): No such process");
    });
  });

  BzShell.register("sudo", function (args, api) {
    if (!args.length) { api.text("usage: sudo command"); return; }
    var handle = api.takeover({
      onKey: function (e) {
        if (e.ctrlKey && e.key.toLowerCase() === "c") { finish(true); return; }
        if (e.key === "Enter") { finish(false); return; }
        // Backspace and printable characters are swallowed silently: the
        // password prompt echoes nothing at all, just like the real thing.
      }
    });
    handle.el.innerHTML = "Password:";
    function finish(cancelled) {
      handle.exit(true);
      if (cancelled) return;
      if (args[0] === "kill" && args.length === 3 && args[1] === "-9" && args[2] === "1") showKernelPanic();
      else if (POWER_CMDS.hasOwnProperty(args[0])) powerCommand(args[0], args.slice(1), api, true);
      else api.text("bohdan is not in the sudoers file.  This incident will be reported.");
    }
  });

  // ============================================================================
  // reboot, halt, shutdown  --  root only, like Darwin; with sudo they really do it
  // ============================================================================
  var POWER_CMDS = { reboot: 1, halt: 1, shutdown: 1 };

  function power(what) {
    if (window.BzDesktop && window.BzDesktop.power) window.BzDesktop.power(what);
    else if (what === "restart") window.location.reload();
  }

  function powerCommand(cmd, args, api, root) {
    if (cmd === "shutdown") {
      var restart = args.indexOf("-r") >= 0, halt = args.indexOf("-h") >= 0 || args.indexOf("-p") >= 0;
      var when = args.filter(function (a) { return a.charAt(0) !== "-"; })[0];
      if (!when || (!restart && !halt)) {
        api.text("usage: shutdown [-] [-h | -p | -r | -k] [-o [-n]] time [warning-message ...]");
        return;
      }
      if (!root) { api.text("shutdown: NOT super-user"); return; }
      if (when !== "now" && when !== "+0") {
        api.text("shutdown: only \"now\" is supported on this Mac");
        return;
      }
      // BSD shutdown(8) announces itself, then wall(1) broadcasts the final message to every tty.
      // (halt and reboot are immediate and silent, as on a real Mac.)
      var now = new Date();
      api.text("Shutdown NOW!\nshutdown: [pid " + (300 + Math.floor(Math.random() * 400)) + "]\n\n" +
        "Broadcast Message from root@bz\n        (/dev/ttyp1) at " + now.getHours() + ":" + ("0" + now.getMinutes()).slice(-2) + " ...\n\n" +
        "*** FINAL System shutdown message from root@bz ***\n" +
        "System going down IMMEDIATELY\n");
      api.scroll();
      api.later(function () { power(restart ? "restart" : "off"); }, 3000); // long enough to read it
      return;
    }
    if (!root) { api.text(cmd + ": Operation not permitted"); return; }
    power(cmd === "reboot" ? "restart" : "off");
  }

  // finger(1): who is logged in, or one user's details and ~/.plan; the address is decoded only at run time
  BzShell.register("finger", function (args, api) {
    var who = args.filter(function (a) { return a.charAt(0) !== "-"; })[0];
    var d = api.loginTime(), names = d.toDateString().split(" "); // ["Thu", "Sep", …]
    var hm = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    var day = names[0], mon = names[1];
    if (!who) {
      api.text(padRight("Login", 9) + padRight("Name", 21) + padRight("TTY", 9) + "Idle  Login Time   Office  Phone\n" +
        padRight("bohdan", 9) + padRight("Bohdan Zhuravel", 21) + padRight("p1", 15) + day + " " + hm);
      return;
    }
    if (!/^bohdan(@bz)?$/.test(who)) { api.text("finger: " + who + ": no such user."); return; }
    var out = api.esc(padRight("Login: bohdan", 40) + "Name: Bohdan Zhuravel\n" +
      padRight("Directory: /Users/bohdan", 40) + "Shell: /bin/bash\n" +
      "On since " + day + " " + mon + " " + (" " + d.getDate()).slice(-2) + " " + hm + " on ttyp1");
    var mail = window.BzEmail;
    if (mail) out += '\nMail forwarded to <a href="' + api.esc(mail.href()) + '">' + api.esc(mail.address()) + "</a>";
    var plan = api.fs.get(["about.txt"]); // stands in for ~/.plan
    api.line(out + "\nNo Mail.\nPlan:\n" + (plan ? plan.html : "No Plan."));
  });

  Object.keys(POWER_CMDS).forEach(function (cmd) {
    BzShell.register(cmd, function (args, api) { powerCommand(cmd, args, api, false); });
  });

  // ============================================================================
  // emacs [-f function]  --  a small Emacs 21-style full-screen mode
  // ============================================================================
  var SCRATCH_INTRO = ";; This buffer is for notes you don't want to save, and for Lisp evaluation.\n" +
    ";; If you want to create a file, visit that file with C-x C-f,\n" +
    ";; then enter the text in that file's own buffer.\n\n";

  // ELIZA, fetched the first time *doctor* opens, and Emacs `doctor''s opening line,
  // in place of the ELIZA script's own greeting (see enterDoctor)
  var ELIZA_FILES = ["vendor/toys/elizajs.js", "vendor/toys/eliza-script.js"];
  var DOCTOR_OPENER = "I am the psychotherapist.  Please, describe your problems.  Each time you are finished talking, type RET twice.";

  // ---- compact text-mode Tetris (self-contained; only touches its own state) ----
  function Tetris(onChange) {
    this.onChange = onChange || function () {};
    this.board = [];
    for (var r = 0; r < 20; r++) this.board.push(Tetris.emptyRow());
    this.score = 0;
    this.lines = 0;
    this.paused = false;
    this.gameOver = false;
    this.piece = null;
    this.timer = null;
    this._spawn();
    this._startTimer();
  }

  Tetris.COLORS = { I: "#00c7c7", O: "#c7c700", T: "#a300d1", S: "#00c700", Z: "#d10000", J: "#1414d1", L: "#d17d00" };
  Tetris.SHAPES = {
    I: { size: 4, cells: [[1, 0], [1, 1], [1, 2], [1, 3]] },
    O: { size: 2, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
    T: { size: 3, cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
    S: { size: 3, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
    Z: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
    J: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [1, 2]] },
    L: { size: 3, cells: [[0, 2], [1, 0], [1, 1], [1, 2]] }
  };
  Tetris.emptyRow = function () {
    var row = [];
    for (var i = 0; i < 10; i++) row.push(null);
    return row;
  };

  Tetris.prototype._collide = function (cells, row, col) {
    for (var i = 0; i < cells.length; i++) {
      var r = row + cells[i][0], c = col + cells[i][1];
      if (c < 0 || c >= 10 || r >= 20) return true;
      if (r >= 0 && this.board[r][c]) return true;
    }
    return false;
  };

  Tetris.prototype._spawn = function () {
    var types = ["I", "O", "T", "S", "Z", "J", "L"];
    var type = types[Math.floor(Math.random() * types.length)];
    var shape = Tetris.SHAPES[type];
    var col = Math.floor((10 - shape.size) / 2);
    var cells = shape.cells.slice();
    this.piece = { type: type, cells: cells, size: shape.size, color: Tetris.COLORS[type], row: 0, col: col };
    if (this._collide(cells, 0, col)) { this.gameOver = true; this._stopTimer(); }
  };

  Tetris.prototype._lock = function () {
    var self = this;
    this.piece.cells.forEach(function (c) {
      var r = self.piece.row + c[0], cc = self.piece.col + c[1];
      if (r >= 0 && r < 20) self.board[r][cc] = self.piece.color;
    });
    var cleared = 0;
    for (var r = 19; r >= 0; r--) {
      var full = true;
      for (var c = 0; c < 10; c++) if (!this.board[r][c]) { full = false; break; }
      if (full) {
        this.board.splice(r, 1);
        this.board.unshift(Tetris.emptyRow());
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      var points = [0, 40, 100, 300, 1200];
      this.score += points[cleared] || cleared * 100;
    }
    this._spawn();
  };

  Tetris.prototype._move = function (dc) {
    if (this.paused || this.gameOver) return;
    if (!this._collide(this.piece.cells, this.piece.row, this.piece.col + dc)) this.piece.col += dc;
    this.onChange();
  };
  Tetris.prototype.moveLeft = function () { this._move(-1); };
  Tetris.prototype.moveRight = function () { this._move(1); };

  Tetris.prototype.rotate = function () {
    if (this.paused || this.gameOver) return;
    var size = this.piece.size;
    var rotated = this.piece.cells.map(function (c) { return [c[1], size - 1 - c[0]]; });
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!this._collide(rotated, this.piece.row, this.piece.col + kicks[i])) {
        this.piece.cells = rotated;
        this.piece.col += kicks[i];
        break;
      }
    }
    this.onChange();
  };

  Tetris.prototype.softDrop = function () {
    if (this.paused || this.gameOver) return;
    if (!this._collide(this.piece.cells, this.piece.row + 1, this.piece.col)) this.piece.row++;
    else this._lock();
    this.onChange();
  };

  Tetris.prototype.hardDrop = function () {
    if (this.paused || this.gameOver) return;
    while (!this._collide(this.piece.cells, this.piece.row + 1, this.piece.col)) this.piece.row++;
    this._lock();
    this.onChange();
  };

  Tetris.prototype.togglePause = function () {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.onChange();
  };

  Tetris.prototype._startTimer = function () {
    var self = this;
    this._stopTimer();
    this.timer = setInterval(function () {
      if (self.paused || self.gameOver) return;
      self.softDrop();
    }, 700);
  };
  Tetris.prototype._stopTimer = function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  };
  Tetris.prototype.destroy = function () { this._stopTimer(); };

  Tetris.prototype.renderHTML = function () {
    var display = [], r, c;
    for (r = 0; r < 20; r++) display.push(this.board[r].slice());
    if (this.piece) {
      this.piece.cells.forEach(function (cell) {
        var rr = this.piece.row + cell[0], cc = this.piece.col + cell[1];
        if (rr >= 0 && rr < 20 && cc >= 0 && cc < 10) display[rr][cc] = this.piece.color;
      }, this);
    }
    var info = ["Score: " + this.score, "Lines: " + this.lines, "",
      "←→ move   ↑ rotate", "↓ soft drop   space hard drop", "p pause   q quit"];
    var lines = [];
    for (r = 0; r < 20; r++) {
      var row = "";
      for (c = 0; c < 10; c++) {
        var cell = display[r][c];
        row += cell ? ('<span style="background:' + cell + '">  </span>') : "  ";
      }
      row += "  " + esc(info[r] || "");
      lines.push(row);
    }
    var status = this.gameOver ? "-- GAME OVER -- press q to quit" : (this.paused ? "-- PAUSED --" : "");
    return '<div style="white-space:pre">' + lines.join("\n") + "</div>" +
      (status ? '<div class="rev">' + esc(status) + "</div>" : "");
  };

  // ---- the emacs command itself ----
  BzShell.register("emacs", function (args, api) {
    var startFn = null;
    for (var i = 0; i < args.length; i++) if (args[i] === "-f") startFn = args[++i];

    var state = {
      mode: "buffer", // "buffer" | "mx" | "doctor" | "tetris"
      buffer: SCRATCH_INTRO,
      minibuffer: "",
      mx: "",
      pending: null, // null | "meta" | "ctrl-x"
      doctorInput: "",
      doctorQueue: [], // paragraphs sent before ELIZA had loaded
      eliza: null,
      tetris: null
    };

    var handle = api.takeover({ onKey: onKey, onDispose: function () { if (state.tetris) state.tetris.destroy(); } });

    function modeline() {
      if (state.mode === "doctor") return "--:**  *doctor*      (Doctor)--L1--All-----";
      if (state.mode === "tetris") return "--:**  *tetris*      (Tetris)--L1--All-----";
      return "--:--  *scratch*   (Lisp Interaction)--L1--All-----";
    }

    function render() {
      var html = '<div class="rev">' + esc(modeline()) + "</div>";
      if (state.mode === "tetris" && state.tetris) {
        html += state.tetris.renderHTML();
      } else {
        html += '<div style="white-space:pre-wrap">' + esc(state.buffer) + '<span class="cursor"> </span></div>';
      }
      var mb = state.mode === "mx" ? ("M-x " + state.mx) : state.minibuffer;
      html += "<div>" + esc(mb) + "</div>";
      handle.el.innerHTML = html;
      api.scroll();
    }

    function exitEmacs() {
      if (state.tetris) state.tetris.destroy();
      state.exited = true;
      handle.exit();
    }

    function enterMx() {
      state.mode = "mx";
      state.mx = "";
      state.minibuffer = "";
      render();
    }

    function execMx(cmd) {
      if (cmd === "doctor") { enterDoctor(); return; }
      if (cmd === "tetris") { enterTetris(); return; }
      state.mode = "buffer";
      state.minibuffer = cmd ? ("[" + cmd + " is undefined]") : "";
      render();
    }

    function enterDoctor() {
      state.mode = "doctor";
      state.buffer = "";
      state.doctorInput = "";
      state.minibuffer = "";
      state.eliza = null;
      state.doctorQueue = [];
      render();
      // the psychotherapist arrives once ELIZA has loaded, unless this visit to *doctor* is over by then
      var visit = state.doctorVisit = {};
      var begin = function () {
        if (state.doctorVisit !== visit || state.mode !== "doctor" || state.exited) return;
        if (window.ElizaJS && window.ELIZA_SCRIPT) {
          var client = {
            say: function (phrase) { state.buffer += phrase + "\n\n"; render(); },
            quit: function () {}
          };
          window.ELIZA_SCRIPT.initial = DOCTOR_OPENER; // the constructor says(initial)
          state.eliza = new window.ElizaJS(client, window.ELIZA_SCRIPT);
          state.doctorQueue.splice(0).forEach(function (para) { state.eliza.say(para); });
        } else {
          state.buffer = "[doctor: ELIZA library not available]\n\n";
        }
        render();
      };
      if (window.BzLazy) window.BzLazy(ELIZA_FILES, api.guard(begin)); else begin();
    }

    function enterTetris() {
      state.mode = "tetris";
      state.minibuffer = "";
      if (state.tetris) state.tetris.destroy();
      state.tetris = new Tetris(render);
      render();
    }

    function onKeyBuffer(e) {
      if (e.ctrlKey && e.key.toLowerCase() === "g") { render(); return; }
      if (e.key === "Enter") { state.buffer += "\n"; render(); return; }
      if (e.key === "Backspace") { state.buffer = state.buffer.slice(0, -1); render(); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { state.buffer += e.key; render(); return; }
      render();
    }

    function onKeyMx(e) {
      if (e.ctrlKey && e.key.toLowerCase() === "g") { state.mode = "buffer"; state.mx = ""; state.minibuffer = "Quit"; render(); return; }
      if (e.key === "Enter") { execMx(state.mx.replace(/^\s+|\s+$/g, "")); return; }
      if (e.key === "Backspace") { state.mx = state.mx.slice(0, -1); render(); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { state.mx += e.key; render(); return; }
      render();
    }

    // Doctor mode: type freely; a blank line (RET pressed twice) sends the
    // paragraph typed since the last reply to ELIZA, exactly like doctor.el.
    function onKeyDoctor(e) {
      if (e.ctrlKey && e.key.toLowerCase() === "g") { render(); return; }
      if (e.key === "Enter") {
        state.buffer += "\n";
        if (!state.doctorInput || /\n$/.test(state.doctorInput)) {
          var para = state.doctorInput.replace(/^\s+|\s+$/g, "");
          state.doctorInput = "";
          if (para && state.eliza) state.eliza.say(para);
          else if (para) state.doctorQueue.push(para); // ELIZA is still loading: answered when it arrives
        } else {
          state.doctorInput += "\n";
        }
        render();
        return;
      }
      if (e.key === "Backspace") {
        state.buffer = state.buffer.slice(0, -1);
        state.doctorInput = state.doctorInput.slice(0, -1);
        render();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        state.buffer += e.key;
        state.doctorInput += e.key;
        render();
        return;
      }
      render();
    }

    function onKeyTetris(e) {
      var t = state.tetris;
      var k = e.key;
      if (k === "q" || k === "Q") { if (t) t.destroy(); state.mode = "buffer"; render(); return; }
      if (k === "p" || k === "P") { if (t) t.togglePause(); return; }
      if (!t || t.gameOver) { render(); return; }
      if (k === "ArrowLeft") { t.moveLeft(); return; }
      if (k === "ArrowRight") { t.moveRight(); return; }
      if (k === "ArrowUp") { t.rotate(); return; }
      if (k === "ArrowDown") { t.softDrop(); return; }
      if (k === " " || k === "Spacebar") { t.hardDrop(); return; }
      render();
    }

    function onKey(e) {
      // Two-key prefixes (Emacs-style): C-x C-c exits; Esc x / M-x enters the minibuffer.
      if (state.pending === "ctrl-x") {
        state.pending = null;
        if (e.ctrlKey && e.key.toLowerCase() === "c") { exitEmacs(); return; }
        render();
        return;
      }
      if (state.pending === "meta") {
        state.pending = null;
        if (!e.ctrlKey && !e.altKey && e.key.toLowerCase() === "x") { enterMx(); return; }
        render();
        return;
      }
      if (e.key === "Escape") { state.pending = "meta"; return; }
      if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "x") { state.pending = "ctrl-x"; return; }
      if (e.altKey && e.code === "KeyX") { enterMx(); return; }

      if (state.mode === "mx") return onKeyMx(e);
      if (state.mode === "doctor") return onKeyDoctor(e);
      if (state.mode === "tetris") return onKeyTetris(e);
      return onKeyBuffer(e);
    }

    if (startFn === "doctor") enterDoctor();
    else if (startFn === "tetris") enterTetris();
    else render();
  });
})();

/* Host integration notes (nothing here is loaded by this file itself):
   Script tag order after shell.js, before this file:
     vendor/toys/fortunes-data.js
     vendor/toys/elizajs.js
     vendor/toys/eliza-script.js
     vendor/toys/banner-data.js
     toys.js   (this file)
   No new CSS classes are required from the host: styling reuses the existing
   .rev (reverse video) and .cursor classes already defined for the Terminal,
   plus inline styles for the Tetris blocks and the kernel-panic overlay. */
