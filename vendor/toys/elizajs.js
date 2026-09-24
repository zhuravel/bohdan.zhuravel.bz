/* elizajs.js — bundled from urbanautomaton/eliza-js (MIT License).
   Source: https://github.com/urbanautomaton/eliza-js
   Commit: a2e64737137398c138b3a26b0f96078ae835f49b (master, 2014-01-06), fetched 2026-09-23.
   Copyright (c) 2013 Simon Coffey. See LICENSE.txt in this directory for the full MIT text.

   This file concatenates the library's six lib/eliza/*.js modules
   (decomp.js, key.js, linked_list.js, ordered_hash.js, responder.js, eliza.js)
   unmodified, wrapped in a tiny CommonJS-style shim so they run in a browser
   with no bundler and no network access. Exposes window.ElizaJS (the Eliza
   constructor). Usage, per the upstream README:

     var client = { say: function (phrase) { ... }, quit: function () { ... } };
     var eliza = new ElizaJS(client, script); // script: see eliza-script.js
     eliza.say(userInput);
*/
(function (global) {
  // (deliberately not "use strict": upstream eliza.js._createResponder() has a missing
  // `var i` in its for-loop, an unexercised bug relying on sloppy-mode implicit globals —
  // left as-is to keep this bundle a faithful, unmodified copy of the vendored logic)
  var modules = {}, cache = {};
  function define(id, factory) { modules[id] = factory; }
  function bzRequire(id) {
    id = id.replace(/^\.\//, "");
    if (Object.prototype.hasOwnProperty.call(cache, id)) return cache[id].exports;
    var module = { exports: {} };
    cache[id] = module;
    modules[id](module, module.exports, bzRequire);
    return module.exports;
  }

  define('decomp', function (module, exports, require) {
    var Decomp = function(regex, phrases, post) {
      this._phrases      = phrases;
      this._phrase_count = phrases.length;
      this._count        = 0;
      this._regex        = regex;
      this._post         = post;
    };

    Decomp.prototype._nextPhrase = function(captures) {
      var phrase = this._phrases[this._count % this._phrase_count];
      this._count += 1;
      for (var i=0; i < captures.length; i++) {
        sub_regex = new RegExp("\\(" + (i+1) + "\\)");
        replacement = this._post(captures[i]).replace(/^\s+|\s+$/g, "");
        phrase = phrase.replace(sub_regex, replacement);
      }
      return phrase;
    };

    Decomp.prototype.match = function(phrase, responder) {
      var m = this._regex.exec(phrase);
      if (m) {
        m.shift(1);
        this._respond(this._nextPhrase(m), responder);
      } else {
        if (this.next) {
          this.next.match(phrase, responder);
        }
      }
    };

    Decomp.prototype._respond = function(phrase, responder) {
      var tokens = phrase.split(/\s+/);
      if (this._isGotoPhrase(tokens)) {
        responder.gotoKey(tokens[1]);
      } else {
        responder.respondWith(phrase);
      }
    };

    Decomp.prototype._isGotoPhrase = function(tokens) {
      return (tokens[0] === "goto" && tokens.length === 2);
    };

    var StoredDecomp = function(regex, phrases, post) {
      Decomp.call(this, regex, phrases, post);
    }
    StoredDecomp.prototype = Object.create(Decomp.prototype);
    StoredDecomp.prototype.constructor = StoredDecomp;

    StoredDecomp.prototype._respond = function(phrase, responder) {
      responder.storeResponse(phrase);
    };

    module.exports = {
      Decomp:        Decomp,
      StoredDecomp:  StoredDecomp
    };
  });

  define('key', function (module, exports, require) {
    var Key = function(word, decomps) {
      this._word    = word;
      this._regex   = new RegExp("\\b"+word+"\\b", "i");
      this._decomps = decomps;
    };

    Key.prototype.match = function(phrase, responder) {
      if (this._keywordMatch(phrase)) {
        this.blindMatch(phrase, responder);
      }
    };

    Key.prototype.blindMatch = function(phrase, responder) {
      this._decomps.first.match(phrase, responder);
    };

    Key.prototype._keywordMatch = function(phrase) {
      return !!this._regex.exec(phrase);
    }

    module.exports = Key;
  });

  define('linked_list', function (module, exports, require) {
    function LinkedList() {
      this.length = 0;
      this.first  = null;
      this.last   = null;
    };

    LinkedList.prototype.prepend = function(node) {
      if (this.first === null) {
        this.first = node;
        this.last  = node;
      } else {
        this.first.previous = node;
        node.next           = this.first;
        this.first          = node;
      }
      this.length++;
    };

    LinkedList.prototype.append = function(node) {
      if (this.first === null) {
        this.first = node;
        this.last  = node;
      } else {
        this.last.next = node;
        node.previous  = this.last;
        this.last      = node;
      }
      this.length++;
    };

    module.exports = LinkedList;
  });

  define('ordered_hash', function (module, exports, require) {
    var OrderedHash = function() {
      this.keys  = [];
      this._vals = {};
    }

    OrderedHash.prototype.push = function(k,v) {
      if(!this._vals[k]) {
        this.keys.push(k);
      }
      this._vals[k] = v;
    };

    OrderedHash.prototype.val = function(k) {
      return this._vals[k];
    };

    OrderedHash.prototype.size = function() {
      return this.keys.length;
    }

    module.exports = OrderedHash;
  });

  define('responder', function (module, exports, require) {
    var Responder         = function(pre, keys, defaults) {
      this._pre           = pre;
      this._key_hash      = keys;
      this._defaults      = defaults;
      this._default_count = 0;
      this._stored        = [];
    };

    Responder.prototype.respondTo = function(phrase, client) {
      var stripped_phrase = phrase.toLowerCase().replace(/[^\w\ ']/g,"");
      this._filtered_phrase = this._pre(stripped_phrase)
      this._matched = false;
      for (var i=0; i<this._key_hash.size(); i++) {
        var key = this._key_hash.val(this._key_hash.keys[i]);
        key.match(this._filtered_phrase, this);
        if (this._matched) {
          client.say(this._response);
          return;
        }
      }
      client.say(this._defaultResponse());
    };

    Responder.prototype.respondWith = function(response) {
      this._matched = true;
      this._response = response;
    };

    Responder.prototype.storeResponse = function(response) {
      this._stored.push(response);
    };

    Responder.prototype.gotoKey = function(word) {
      this._key_hash.val(word).blindMatch(this._filtered_phrase, this);
    }

    Responder.prototype._defaultResponse = function() {
      if (this._stored.length > 0) {
        return this._stored.shift();
      } else {
        return this._defaults[this._default_count++ % this._defaults.length];
      }
    };

    module.exports = Responder;
  });

  define('eliza', function (module, exports, require) {
    var decomps      = require('./decomp');
    var Decomp       = decomps.Decomp;
    var StoredDecomp = decomps.StoredDecomp;
    var Key          = require('./key');
    var Responder    = require('./responder');
    var LinkedList   = require('./linked_list');
    var OrderedHash  = require('./ordered_hash');

    var Eliza = function(client, script) {
      this._client    = client;
      this._script    = script;
      this._finished  = false;
      this._responder = this._createResponder(script);
      this._client.say(this._script['initial']);
    };

    Eliza.prototype.say = function(phrase) {
      if (this._isQuitMessage(phrase)) {
        this._finished = true;
        this._client.say(this._script['final']);
        this._client.quit();
      } else {
        this._responder.respondTo(phrase, this._client);
      }
    };

    Eliza.prototype._isQuitMessage = function(input) {
      return (this._script['quit'].indexOf(input) >= 0);
    };

    Eliza.prototype.isFinished = function() {
      return this._finished;
    }

    Eliza.prototype._createResponder = function(script) {
      script.keys.sort(function(a, b) { return b.weight - a.weight });

      var keys = new OrderedHash();

      for (i=0; i<script.keys.length; i++) {
        var key     = script.keys[i];
        var decomps = new LinkedList();

        for (var match_string in key.decomp) {
          if (key.decomp.hasOwnProperty(match_string)) {
            var decomp = this._createDecomp(match_string,
                                            key.decomp[match_string],
                                           this._postFilter(script));
            decomps.append(decomp);
          }
        }

        keys.push(key.word, new Key(key.word, decomps));
      }

      return new Responder(this._preFilter(script), keys, script.defaults);
    };

    Eliza.prototype._preFilter = function(script) {
      return function(phrase) {
        var tokens = phrase.split(/\s+/);
        for (var i=0; i<tokens.length; i++) {
          var replacement = script.pre[tokens[i]];
          if (typeof(replacement) !== "undefined") {
            tokens[i] = replacement;
          }
        }
        return tokens.join(" ");
      }
    };

    Eliza.prototype._postFilter = function(script) {
      return function(phrase) {
        var tokens = phrase.split(/\s+/);
        for (var i=0; i<tokens.length; i++) {
          var replacement = script.post[tokens[i]];
          if (typeof(replacement) !== "undefined") {
            tokens[i] = replacement;
          }
        }
        return tokens.join(" ");
      }
    };

    Eliza.prototype._createDecomp = function(match_string, phrases, post) {
      var synonyms = this._script.synon;
      var regex_string = match_string.replace(/\s*\*\s*/g, "(^(?:\\S+\\s+)*|(?:\\s+\\S+)*$|\\s+(?:\\S+\\s+)*|^(?:\\S+\\s+)*\\S+$)");
      for (var synon in synonyms) {
        if (synonyms.hasOwnProperty(synon)) {
          var match_block = "@" + synon;
          var replacement = "(" + [synon].concat(synonyms[synon]).join("|") + ")";
          replace_regex = new RegExp(match_block, "g");
          regex_string = regex_string.replace(replace_regex, replacement);
        }
      }
      // Detect stored decomps
      match = /^\$(.*)/.exec(regex_string);
      if (match) {
        var regex = new RegExp("^"+match[1]+"$", "i");
        return new StoredDecomp(regex, phrases, post);
      } else {
        var regex = new RegExp("^"+regex_string+"$", "i");
        return new Decomp(regex, phrases, post);
      }
    }

    module.exports = Eliza;
  });

  global.ElizaJS = bzRequire("eliza");
})(typeof window !== "undefined" ? window : this);
