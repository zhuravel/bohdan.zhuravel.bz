# vendor/toys — third-party data for the Terminal toys add-on

Everything here is either data (no executable logic of its own) or a small
library vendored verbatim, for use by `variants/toys.js`. No files here make
network requests; everything is fetched once, ahead of time, and committed.

| File | What | Source | License |
|---|---|---|---|
| `fortunes-data.js` | 80 curated BSD `fortune(6)` cookies, `window.BZ_FORTUNES` | [openbsd/src](https://raw.githubusercontent.com/openbsd/src/master/games/fortune/datfiles/fortunes), `games/fortune/datfiles/fortunes` | BSD-3-Clause (Regents of the Univ. of California / Ken Arnold) |
| `banner.c` | Upstream reference source (not loaded at runtime) | [freebsd/freebsd-src](https://raw.githubusercontent.com/freebsd/freebsd-src/main/usr.bin/banner/banner.c), commit `0b8224d1cc9dc6c9778ba04a75b2c8d47e5d7481` | BSD-3-Clause (Regents of the Univ. of California) |
| `banner-data.js` | Ported `asc_ptr`/`data_table` glyph arrays, `window.BzBannerData` | same as above | BSD-3-Clause |
| `elizajs.js` | Bundled ELIZA engine (decomp/key/linked_list/ordered_hash/responder/eliza), `window.ElizaJS` | [urbanautomaton/eliza-js](https://github.com/urbanautomaton/eliza-js), commit `a2e64737137398c138b3a26b0f96078ae835f49b` | MIT (Copyright (c) 2013 Simon Coffey) |
| `eliza-script.js` | The DOCTOR script data, `window.ELIZA_SCRIPT` | same repo, `lib/eliza/script.js` | MIT (same as above) |

Per-vendor license text and provenance notes: `LICENSE-fortunes.txt`,
`LICENSE-banner.txt`, `LICENSE-eliza.txt`.

## Why not elizabot.js?

Norbert Landsteiner's classic `elizabot.js` (masswerk.at) was considered
first, since the task suggested it. Its own page only says the code is
"free software and provided 'as is'" with no explicit permission grant
(use/copy/modify/redistribute), and its npm package (`elizabot`) lists no
SPDX license at all. That's genuinely ambiguous, so a different,
clearly-licensed implementation (urbanautomaton/eliza-js, MIT) was used
instead, per the "stop and report if a license is unclear; pick another"
instruction.

## Why no vendored Tetris library?

Researched several small JS Tetris projects (jakesgordon/javascript-tetris,
gdeb/tetris, cztomczak/jstetris, the `simple-tetris` npm package, etc). All
of the MIT-licensed ones are full games tightly coupled to their own
canvas/DOM rendering, not a logic-only engine that could be dropped behind
toys.js's own colored-`<span>` text rendering without heavy surgery. Per the
task's own fallback ("otherwise a compact implementation is acceptable, keep
it modest"), `toys.js` implements a small (~150 line) custom Tetris engine
directly (standard 7 tetrominoes, wall-kick-free rotation with a small
left/right nudge fallback, line clears, score, pause) with no vendored code.

## Notes on faithfulness

- `fortunes-data.js`: the 80 entries are reproduced verbatim (unedited) from
  the source file; only the *selection* (screened for tastefulness) is new
  work. `short` follows `fortune -s`'s convention (roughly <= 5 lines, <=
  200 chars).
- `banner-data.js` / `toys.js`'s `bannerRender()`: the decode algorithm in
  `toys.js` is a line-for-line JS port of `banner.c`'s `main()` (the part
  after "Now have message. Print it one character at a time."). Verified
  byte-for-byte (trailing whitespace trimmed) against this machine's real
  `/usr/bin/banner` for `-w 60 HI`, `-w 40 42`, `-w 50 Go`, `-w 80 "A'B"`,
  and `-w 30 Z`; undefined-character handling (`banner -w 40 '<>'`) was also
  confirmed to match the real binary's refusal-with-error behavior.
- `elizajs.js`: the six upstream `lib/eliza/*.js` files are concatenated
  unmodified behind a ~15-line local CommonJS-style `require`/`module`
  shim (so the library runs from a plain `<script>` tag with no bundler).
  The wrapper deliberately does *not* use `"use strict"`, because upstream
  `eliza.js`'s `_createResponder()` has a `for (i=0; ...)` loop missing a
  `var i` declaration -- an existing, unexercised bug that only breaks
  under strict mode. Left as-is to keep the vendored logic byte-for-byte
  faithful to upstream; see the comment in `elizajs.js`.
- `eliza-script.js`: reproduced verbatim except for one line. Upstream's
  `lib/eliza/script.js` ends with `module.exports = script;`, but the
  object built two lines earlier is named `eliza_script` -- `script` is
  never defined, so that line throws if the file is ever actually
  `require()`'d (apparently never exercised upstream, since `eliza.js`
  itself never requires `script.js`). That one line was swapped for a
  working export; no other change was made.
