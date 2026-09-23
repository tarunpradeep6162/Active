# Meridian Field — realtime web experience

An independent, high‑fidelity recreation of the *interaction language* of
[activetheory.net](https://activetheory.net): one persistent WebGL world travelled by
scroll, with pointer trails, a deforming pill nav, spatial project browsing and
continuous transitions. All content, geometry, shaders, copy and audio here are original.
The studio, projects and clients are fictional placeholders.

- `REFERENCE_AUDIT.md`: what was observed on the reference, and how each part is reproduced
- `REFERENCE_AUDIT_V2.md`: completion‑pass audit, with measurements, differences and fixes
- `COMPARISON.md`: side‑by‑side comparison rounds, motion notes and validation results
- `BIRTHDAY.md`: the 14 birthday chapters in the Work section, and how to fill them in and encrypt them

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build → dist/
npm run preview      # serve dist/
```

Optional shared trails between visitors:

```bash
npm run realtime                                   # ws://localhost:8787
open "http://localhost:5173/?realtime=ws://localhost:8787"
# or build with VITE_REALTIME_URL=wss://your-relay
```

URL flags:

- `?tier=high|medium|low` forces a tier and turns off automatic tiering.
- `?debug=1` shows the diagnostics overlay: scroll, scene, camera and target, FOV, FPS
  and p95, draw calls, triangles, memory, and tier with its change history.
- `?qa=1` is for the QA harness only. It exposes `window.__state` / `window.__exp`, skips
  the intro choreography and allows deterministic time stepping (`__exp.qaStep(ms)`).

### QA harness (`qa/`)

```bash
npm run build && npx vite preview --port 4173 &
RECREATION_URL=http://localhost:4173/ node qa/compare.mjs 1440 900            # 22 samples, both sites
RECREATION_URL=http://localhost:4173/ node qa/compare.mjs 390 844 mobile quick
RECREATION_URL=http://localhost:4173/ node qa/states.mjs ours 1440 900          # nav, /work landing, open timeline…
RECREATION_URL=http://localhost:4173/ node qa/validate.mjs                      # context loss, 50 cycles, tiers, history…
```

Frames, side‑by‑sides, diffs and JSON summaries go to `qa/out/`. That folder is
git‑ignored; reference frames are third‑party imagery and must never be committed or
served.

Routes: `/`, `/work`, `/work/<slug>`, `/contact` (History API; back/forward supported;
`Esc` closes a project or the contact overlay). The host must serve `index.html` for
unknown paths (SPA fallback).

## Architecture

```
src/
  main.tsx                 WebGL2 check, mounts React UI, lazy‑loads the runtime
  core/
    state.ts               single mutable ExperienceState + coarse UI store + event bus
    Experience.ts          boot, render loop, resize, tiers, context loss, input routing
    AssetManager.ts        weighted real progress (fonts, worker, textures, shader compile)
    Performance.ts         tier detection, per‑tier settings, FPS governor
  renderer/Renderer.ts     persistent WebGLRenderer, viewport reading
  post/PostFX.ts           HalfFloat MSAA target → threshold → dual‑filter bloom → composite
                           (ACES, corner glow, vignette, velocity chromatic, grain, blur)
  scroll/ScrollEngine.ts   native document scroll + measured section spacers → smoothed
                           position, velocity, direction, progress
  interaction/             Pointer (mouse + touch, velocity) and optional Multiuser client
  camera/                  cameraPath (time‑aware Hermite keys) + CameraRig (the only
                           place the camera changes: path + parallax + velocity + focus +
                           micro‑motion, damped)
  transitions/             TransitionController: IDLE → EXITING → SWITCHING → ENTERING,
                           one pending slot so rapid navigation never overlaps
  world/                   World (set pieces, culling, palettes per section), journey map,
                           shared uniforms
  scenes/                  Emblem, WorkSpine, ProjectCards, Lab, HexPortal, Backdrop,
                           PreloaderPortal, shared materials
  particles/               GPU ParticleField, billboard Nebula, Streaks, pooled Sparks
  trails/                  Ribbon (fixed‑capacity world‑space strip) + TrailSystem
  fluid/Water.ts           environmental water: lab floor (reflective, rippled) + caustic surface from below
  shaders/chunks.ts        hash, value/simplex noise, fbm, curl‑ish field, rotation,
                           easing, palette, HSV, thin‑film iridescence, fog
  workers/                 particle buffer generation off the main thread
  audio/AudioEngine.ts     generative ambient bed (Web Audio), off by default
  ui/                      React DOM interface; UIDriver and NavFX write CSS variables
                           and SVG paths every frame without React re‑renders
server/realtime.mjs        WebSocket relay for shared trails (rate‑limited, rooms of 24)
```

### Principles

- **One renderer, one scene, one loop.** The preloader, world, trails and post chain all
  share the same WebGL context. Nothing is torn down between routes.
- **State flows one way.** Input and scroll write to `state`, the loop derives everything
  else, and uniforms that many materials share are single objects (`world/uniforms.ts`)
  written once per frame. React only re‑renders on coarse changes such as route, section
  or load progress.
- **No per‑frame allocations.** Vectors, colours, typed arrays and trail and spark buffers
  are pre‑allocated and reused. Particles animate in the vertex shader from per‑point
  seeds.
- **Loading shows real progress.** Progress comes from font bytes streamed with
  `fetch`, the worker finishing, texture rasterisation, `renderer.compileAsync` and
  offscreen warm‑up renders at six journey positions, so the first scroll doesn't stall
  on shader compiles.
- **Accessible by default.** The page uses the document's own scroll, so keyboard,
  scrollbar and screen readers work. Visible text is real DOM text. Links have hrefs,
  and focus is managed on overlays. `prefers-reduced-motion` turns off trails,
  micro‑motion and velocity effects, and shortens transitions.

### Performance tiers

| Tier | DPR (desktop / mobile) | Particles | Bloom levels | MSAA | Trail strands |
|---|---|---|---|---|---|
| high | 1.5–1.75 / 1.25–1.5 | 100 % | 5 | 4× | 3 |
| medium | ≤1.25 / ≤1.25 | 60 % | 4 | – | 2 |
| low | 1.0 | 30 % | 3 | – | 1 |

Tier detection starts from the GPU renderer string, core count, device memory and touch.
After reveal:

1. A benchmark takes the median of the first 90 frames and steps down once if it is
   badly over budget.
2. Rolling one‑second windows step down after three slow windows.
3. A cooldown follows every change.
4. At most one step back up is allowed, and only after a benchmark‑caused drop.

Tiers change rendering cost only (DPR, particle and nebula counts, MSAA, bloom levels,
trail strands, hex density), never layout.

## Typography

The reference's proprietary display face is replaced with **Tourney Variable**, using its
two‑axis file at **wdth 112 / wght 480**. Its inline letterforms are the closest legally
available match, and at these settings the width‑to‑cap‑height ratio is about 7.5, against
the reference's 7.3 (see `REFERENCE_AUDIT_V2.md` §4). UI and
body text use **Share Tech Mono**. Both are OFL fonts, bundled through Fontsource and
loaded with the `FontFace` API so they count toward loading progress.
