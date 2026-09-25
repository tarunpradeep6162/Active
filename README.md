# For Dheepika · 25 · 11

A private, cinematic birthday universe for Dheepika: one persistent WebGL world travelled by
scroll. An opening under the stars, a garden of 25 tulips holding 14 chapters, a cake in a
cage, a sky of wish lanterns over a night lake, and a finale where the stars spell her name
as the sun rises. All content, geometry, shaders, copy and sound are original; the manor uses
CC0 assets (see `public/manor/CREDITS.txt`).

| Document | What it covers |
|---|---|
| `DHEEPIKA_FINAL_DELIVERY.md` | what she experiences, privacy, QA results, and the personal‑content checklist |
| `docs/CONTENT_GUIDE.md` | how to fill in the chapters and lock them with a passphrase |
| `qa/README.md` | the browser checks and how to run them |
| `docs/history/` | notes from the project's first phase (not the current site) |

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type‑check + production build → dist/
npm run preview      # serve dist/
npm run vault -- --pass "…" --hint "…"   # encrypt birthday-private/ into public/vault/
```

URL flags: `?tier=high|medium|low` forces a quality tier; `?debug=1` shows a diagnostics
overlay; `?qa=1` is for the QA scripts only (exposes `window.__state` / `window.__exp` and
skips the intro timing).

Routes: `/` (the journey), `/garden` and `/garden/<chapter>`, `/for-you`. Old `/work…` and
`/contact` links still resolve. The host serves `index.html` for unknown paths.

## Where things are

```
src/
  main.tsx                  WebGL2 check, mounts the React UI, lazy‑loads the 3D runtime
  content/dheepika.ts       every public word on the site (private content: birthday-private/)
  app/                      chapter list (projects.ts) and router
  core/                     Experience (boot, loop, resize, tiers, context loss), state + event
                            bus, asset loading, performance tiers
  renderer/ post/           the renderer; post‑processing (bloom, grade, lens streaks,
                            letterbox, vignette)
  scroll/ camera/           scroll engine; camera path and rig (the only place the camera moves)
  transitions/              route transitions (garden ⇄ chapter ⇄ For you)
  world/                    World: every set piece, culling, palettes; journey sections; shared uniforms
  scenes/                   the journey's set pieces: StarSky + Emblem (opening), PetalWreath
                            (threshold), TulipGarden + GardenSky, Lab + CakeRoom + BirthdayCake,
                            LanternSky + NightLake, Constellation (finale), shared materials
  work/                     the garden's measured camera path and chapter anchors
  particles/ trails/ fluid/ shaders/ workers/ audio/   effects, shader chunks, worker, sound
  birthday/
    ui/ChapterView.tsx      the chapter overlay (title card, film‑strip reel)
    ui/chapters/            the 14 chapters' React components
    ui/stage/               each chapter's own 3D scene (Stage base class + one file per scene)
    vault.ts progress.ts keepsakes.ts   encryption, saved progress, downloadable keepsakes
  ui/                       page UI: sections, nav, CSS, the per‑frame CSS‑variable driver
  utils/                    maths, fonts
public/                     manor assets, vault (encrypted content), robots, favicon
scripts/                    vault encryption, HDR → JPG
qa/                         Playwright checks (see qa/README.md)
```

## Principles

- **One renderer, one loop for the journey.** Each chapter's own scene is a separate small
  canvas that loads only while its chapter is open and pauses when hidden.
- **State flows one way.** Input and scroll write to `state`; the loop derives the rest;
  shared uniforms are written once per frame. React re‑renders only on coarse changes.
- **No per‑frame allocations** in the hot paths; particles animate in shaders.
- **Accessible.** Real DOM text, native scroll, keyboard paths for every 3D interaction, and
  `prefers-reduced-motion` honoured everywhere. Navigation never depends on an animation to
  be visible.
- **Adaptive.** Quality tiers (pixel ratio, particles, bloom, MSAA) step down automatically on
  slow devices; chapter scenes lower their own pixel ratio, then frame rate, if needed.
