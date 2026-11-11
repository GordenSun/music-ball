# 音乐小球 (music-ball)

A marble bounces down a wall; every hit is a note of a public-domain melody. The same code drives
the interactive page (GitHub Pages) and the frame-accurate video render.

Live: https://gordensun.github.io/music-ball/

## Layout

- `index.html`, `css/`, `js/` – static site, no build step. three.js is vendored in `vendor/` (r170) and loaded through an import map.
- `js/songs.js` – melodies (`note:beats` strings), prop type and instrument per song, quiz decoys.
- `js/level.js` – deterministic level generator (pure JS, runs in node): bounce trajectories, rails, collision checks, seamless loop closure, camera path, wall text placement.
- `js/props.js`, `js/scene.js` – three.js props and stage. Everything is a pure function of time `tau`, so seeking and offline rendering are exact.
- `js/audio.js` – Web Audio synth; realtime `Player` (audio clock is the master clock) and `renderLoop` (offline WAV).
- `js/main.js` – UI, quiz, camera interaction, and the `?render=1` capture mode.
- `tools/` – node scripts (need `npm install` inside `tools/`, uses system Google Chrome via playwright-core, plus ffmpeg).

## Commands

```bash
python3 -m http.server 8000                # local preview -> http://localhost:8000
cd tools && npm install                    # once
node tools/smoke.mjs                       # headless smoke test of the page (pass a URL to test the deployed site)
node tools/render.mjs shots 0,3.5,12       # still frames -> /tmp/ballref/shots
node tools/render.mjs video                # 1080x1920@60 loop -> output/音乐小球.mp4 (+ .wav)
node tools/debug-layout.mjs 304 /tmp/layout [section]   # top-down SVG/PNG of the generated level
node tools/find-seed.mjs                   # scan seeds for compact, collision-free layouts
```

## Notes

- Default layout seed is `DEFAULT_SEED` in `js/main.js`; `?seed=N` picks another wall.
- A level must report `violations === 0` (see `buildLevel`); after changing songs or `STYLES`, re-run `find-seed.mjs`.
- The video is one full loop: last frame flows into the first. Deploy = push to `main` (Pages serves the repo root).
- `参考.mp4` and `output/` are git-ignored on purpose.
