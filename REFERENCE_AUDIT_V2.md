# Reference Audit v2 — completion pass

Second audit of **activetheory.net** against the deployed recreation, done on 2026‑09‑23
with the Playwright harness in `qa/`. Everything was re‑measured; nothing is carried over
from v1 unverified.

Tags: **[OBSERVED]** visible · **[MEASURED]** number from the harness · **[INFERRED]** not
verifiable from outside · **[OURS]** our implementation · **[DIFF]** remaining difference ·
**[FIX]** change made in this pass.

## 0. Method and limits

- `qa/compare.mjs` captures both sites at the same normalised scroll positions
  (22 samples at 1440×900 and 390×844, 8 samples at 1920×1080, 1366×768, 1024×768,
  768×1024, 430×932 and 375×812). For each sample it writes `reference_*.png`, `ours_*.png`,
  `*_side.png`, `*_diff.png` and `summary.json` (mean per‑pixel difference and mean luma)
  to `qa/out/<w>x<h>/`. That folder is git‑ignored: reference frames are third‑party
  imagery and are never committed or shipped.
- `qa/states.mjs` records semantic states: nav geometry from pixels, Work landing, a
  project‑open sequence, detail, close, contact, history and end‑of‑scroll.
- `qa/validate.mjs` covers context loss, 50 open/close cycles, tiers, auto‑tiering,
  history, reduced motion and the debug overlay. `qa/multiuser.mjs` runs two clients
  against the relay.
- **Environment limits.** Only Chromium with SwiftShader (software WebGL) is available,
  at roughly 0.5–2 fps. That has three consequences:
  1. The reference redirects that renderer to `/unsupported`, so for the reference only
     the harness reports a desktop GPU string. The page itself is not altered, and no
     authentication or paywall is involved.
  2. Frame timing of the reference **cannot** be sampled at 100 ms granularity: frames
     landed 21–154 s apart. For ours, `?qa=1` exposes deterministic time stepping, so our
     transition is sampled exactly.
  3. No real‑hardware FPS numbers exist. Safari, Firefox, Edge, iOS and Android were not
     available.

## 1. Journey length and section anchoring

| Viewport | Reference scrollHeight / max | Ours before | Ours now |
|---|---|---|---|
| 1920×1080 | 25 175 / 24 095 | – | 25 175 / 24 095 |
| 1440×900 | 20 979 / 20 079 | 20 979 / 20 079 | 20 979 / 20 079 |
| 1366×768 | 17 902 / 17 134 | – | 17 903 / 17 135 |
| 1024×768 | 17 902 / 17 134 | – | 17 903 / 17 135 |
| 768×1024 | **23 869** / 22 845 | 12 889 | 23 869 (full journey) |
| 430×932 | 11 743 / 10 811 | 11 731 | 11 743 |
| 390×844 | 10 634 / 9 790 | 10 624 | 10 634 |
| 375×812 | 10 231 / 9 419 | 10 221 | 10 231 |

- **[MEASURED]** Phones play 1 259.9 vh of the desktop journey's 2 331 vh (scale 0.5405),
  at 375, 390 and 430 alike. A 768×1024 touch tablet plays the **full** desktop journey.
- **[DIFF → FIX]** We had used scale 0.54, and applied it on "touch + portrait", which
  wrongly shortened tablets. Now: scale 0.5405 on phone‑sized screens only
  (`min(w,h) < 600`).
- **[MEASURED]** Reference section boundaries sit at cumulative vh in *pixels*. For
  example, work starts at 4 725 px = 525 vh, and progress is scrollTop / (total − 1 vh).
- **[DIFF → FIX]** We had normalised boundaries by the total, which compressed every
  boundary by about 4.3 % (the intro ended at 3 618 px vs 3 780). `computeRanges()` now uses
  `cum / (TOTAL − 100)`, so boundaries land on the same pixel at every viewport. The last
  section plays to about 76 %, as on the reference.
- **[OBSERVED/MEASURED]** Scrolling past the end does **not** loop (reference and ours: the
  max stays at 20 079 after 8 wheel ticks). No infinite scroll was implemented.

## 2. Work landing

- **[MEASURED]** Reference: nav WORK → scrollTop **4 745 px**, 20 px into the work
  section, with the first card framed.
- **[OURS] before:** 4 839 px (94 px off), from a camera‑path formula.
- **[FIX]** Card placement, the work camera descent and routing now share one anchor
  function (`workLocalForCard(i)` / `workCameraY()` in `world/journey.ts`). `/work` goes
  to card 0's anchor, so the landing is semantic at every viewport.
- **[MEASURED] now:** 4 753 px at 1440×900 (8 px off; progress 0.2367 vs 0.2363). At
  1366×768 and 1024×768 it lands on 4 056 px of 17 135, the same progress. Camera,
  transition and scroll are all settled (`phase: IDLE`) when measured.

## 3. Navigation

| | Reference [MEASURED] | Ours [MEASURED] |
|---|---|---|
| 1440 desktop | left 1160, right 1399 → **240 px** wide, top ≈ 40 | DOM rect 1160, 41, **240 × 46** |
| 1366 / 1024 | – | 240 × 46, right 40, top 41 |
| 390 phone | 210 × 46 at x 155, y 30 (v1) | DOM rect 155, 30, **210 × 46** |

- **[OBSERVED]** The pill bends with scroll speed; the divider becomes a wave on
  `/work` and `/contact`; labels scramble on hover.
- **[OURS]** The SVG outline is regenerated every frame from springs fed by *filtered*
  scroll velocity (clamped ±5 vh/s). The pill settles when scrolling stops. On mobile the
  divider is 34 px, verified: labels no longer crowd.
- **[DIFF]** Pixel‑edge detection overestimates height on the reference because of the
  glow below the pill; the 46 px height is from v1's close‑up measurement.

## 4. Typography

- **[MEASURED]** Reference display word "CREATIVE": width to cap‑height ratio ≈ **7.3**,
  with thick inline strokes and pixel stair‑stepping (a shader effect).
- Candidates rendered beside the reference crop: Tourney (hollow inline), Orbitron,
  Michroma and Syncopate (plain outlines); Share Tech Mono, Space Mono, VT323 and Orbitron
  for UI.
- **[FIX]** Kept Tourney, the only legal *inline* face, but switched to its two‑axis
  file. Now **wdth 112 / wght 480**, ratio ≈ 7.5 (was 6.7, too thin). The outline families
  are visibly wrong: no inner line.
- **[OURS]** UI stays Share Tech Mono. Its line width (195 px vs 200 px) and squared forms
  are closest.
- **[FIX]** Headline motion: the reference headline travels with the camera
  (41.7 % → 29 % of vh between progress 0.188 and 0.200). It now moves 47 vh per section
  length, where before it moved ±6 vh. The phone headline is 13.6 vw (≈ reference width),
  starting at 24 vh.
- **[DIFF]** The reference's pixel stair‑step and glitch fill are not reproduced.

## 5. Intro emblem and storm

- **[MEASURED]** Reference ring diameter over the intro: ≈ 200 → 170 → 140 → 110 px at
  0 / 0.03 / 0.10 / 0.15 (1440). The emblem stays **centred**, is edge‑on by 0.06 and shows
  its mirrored back by 0.10. The storm grows to about 80 % of the frame width by 0.15, and
  the headline enters from below at 0.15.
- **[DIFF → FIX]** Our camera had flown past the emblem. The timeline now recedes to
  22.5 units while holding the emblem centred. The spin is `smoothstep(0.05,0.6)·π`. The
  ring tube is thinner (0.068) and the glass darker.
- **[FIX]** The storm is now four independent layers, each driven by section progress
  and hidden entirely when its intensity is zero (this also saves fill rate):
  1. background billboard nebula (rotated, stretched, noise‑eroded quads with varying
     opacity);
  2. mid‑distance particle cloud (30 k at the high tier);
  3. additive light streaks;
  4. bright foreground energy specks in amber, yellow and orange.
- **[MEASURED]** Mean luma at 0.15: reference 37.8, ours 29 (was 24.8).

## 6. Headline scene

- **[OBSERVED]** The chunky dark glass torus opens from edge‑on (0.188) to a ¾ view
  (0.20). The background is bright: luma 54 vs our 29.
- **[FIX]** The ring rotation is driven by section progress, the tube is 0.52 and the
  thin‑film is minimal (grey glass). The palette is lifted (luma now ≈ 41).
- **[DIFF]** The reference backdrop has a large bright teal‑white wash and blurred speed
  lines that are still brighter than ours.

## 7. Spine (highest priority)

- **[OBSERVED]** Squat, lumpy, "melted" vertebra bodies with large drooping fin‑like
  processes. Dark silver‑lilac chrome with pink/cyan/violet highlights, fine granular
  bumps, irregular spacing. It sits **behind** the cards. Glitter forms dense cauliflower
  clumps, not a haze.
- **[OURS] before:** identical stacked discs and spikes, bright neon, uniform spacing,
  216 k tris in view.
- **[FIX]**
  - Four seeded vertebra variants, melted with 3‑octave CPU noise along normals, with an
    underside droop and bigger drooping fins.
  - Irregular spacing (0.5–0.72), per‑instance scale, twist and drift.
  - Instanced and chunked by height so off‑screen segments are culled: **≈ 80 k tris in
    view**.
  - New `spineMaterial`: dark body, normal perturbed by fine noise, spatially varying
    thin film only on specular/grazing, faint cavity glow.
  - The column is scaled ×1.3 and pushed back; glitter is rebuilt as coral clusters of
    4–10 lobes.
- **[DIFF]** Still cleaner than the reference's scanned/sculpted models. There is no
  refraction and no true transparency.

## 8. Project cards and work composition

- **[OBSERVED]** Large cards (≈ 50 % of width) in front of the spine, alternating a little
  either side of centre (35–70 % x). Media is muted and photographic.
- **[DIFF → FIX]** Ours were small and off to the sides with the spine in front. Now:
  - Cards sit at x −1.0 / +1.35 in front (z 1.2–1.5), and the camera is at 9.2.
  - Media is desaturated ×0.62 and dimmed ×0.82 (work luma at 0.25 is 70 vs reference
    55: still a bit bright where our spine is lit).
  - Sheen is kept at the reduced v1 level.
- **[DIFF]** Reference card surfaces are frosted and refract their media; ours are opaque
  procedural paintings with a glass edge.

## 9. Project open / detail / close

- **[OBSERVED]** Reference sequence: the card rushes forward, and by the next captured
  frame the view is a dark teal void with the info column bottom‑left and a label at top
  centre. Escape closes to `/work`. (Wall‑clock timings are unusable, see §0.)
- **[MEASURED] ours**, with exact simulated time, as focus 0→1: 0 ms 0 · 100 ms 0.004 ·
  200 ms 0.033 · 300 ms 0.29 · 500 ms 0.71 · 750 ms 0.93 · 1000 ms 0.99 · 1500 ms 1. That
  was the ease‑in version and too slow at the start.
- **[FIX]**
  - The exit is now 0.2 s ease‑out, followed by a 0.7 s settle.
  - The backdrop sinks to a dark teal void as focus rises.
  - Other cards, spine and particles dim.
  - The card stays as the media plane.
- **[FIX] framing.** The detail camera is computed from viewport width and FOV so the
  card's left edge always clears the info column (58 px gutter, 400 px panel, 48 px
  margin). Verified at 1366×768, **1024×768 (was overlapping)**, 768×1024 and 390×844.

## 10. Lab

- **[OBSERVED]** A large dark cylindrical housing sits above the cage, with cables
  drooping from it. Hanging inside is a **crescent cocoon** of pink spheres, bright on the
  lower front. The room has leaning concrete buttresses, rocks and wet black water with
  pink reflections. Blacks dominate.
- **[FIX]**
  - Added the housing, buttresses, rocks and foreground silhouettes.
  - The cocoon is now a crescent made of 34 lobes.
  - Chrome is darker; the room material is almost black, with a faint red key and teal
    rim.
  - The camera pulls back so the frame spans from the housing down to the floor, as on the reference.
  - Luma at 0.75: reference 26.4, ours 23.5.

## 11. Water and hex tunnel

- **[OBSERVED]** Past the lab the camera goes under the surface. The rig is visible above
  through the water, the middle is a dark column with bubbles, and the hex tunnel sits
  low in frame: a back wall plus angled side walls of dark mirror tiles in concentric
  rings.
- **[FIX]** New environmental water (`fluid/Water.ts → createWaterFloor`):
  - noise‑driven normals and ring ripples from the rig;
  - fresnel reflection of a synthetic environment containing the rig's red glow;
  - depth darkening;
  - reflection clamped at grazing angles (portrait phones had turned the floor pink).
- **[FIX]** The surface seen from below is dimmer (caustics ×0.16). The tunnel moved down,
  the camera enters slower (tunnel low in frame at 0.80, as on the reference) and the
  tiles are darker (×0.6).
- **[MEASURED]** Luma at 0.80: reference 22.3, ours 27.2 (was 34.5).

## 12. Camera timeline and debug

- **[FIX]** `camera/cameraPath.ts` is an explicit timeline: each key has section/local
  time, position, target and **FOV** (per section: 40/40/42/38/44–48/40). It uses Hermite
  interpolation for position and target and smoothstep for FOV. It rebuilds when the
  section ranges change (phone journey).
- **[FIX]** The `?debug=1` overlay shows:
  - scroll px, progress, velocity;
  - scene and local progress, route;
  - camera XYZ, target, FOV, transition phase;
  - FPS with p50/p95 frame time, long frames and long tasks;
  - draw calls, triangles, points;
  - geometries, textures, heap;
  - tier, DPR, benchmark and tier changes.

  **[MEASURED]** It is not rendered without the flag.

## 13. Performance tiers and auto‑selection

- **[MEASURED]** Tiers change only rendering. At 1024×700, low/medium/high give identical
  scroll height, nav rect and camera position; only DPR (1 / 1 / 1.5) and canvas size
  differ. Nebula counts and particle draw ranges scale with the tier.
- **[FIX]** Automatic tiering:
  - Startup benchmark: median of the first 90 frames after reveal; if over 1.8× budget,
    step down once.
  - Rolling 1 s windows: 3 slow windows (over 1.45× budget) → step down.
  - Cooldown of 5 windows after any change.
  - At most one step back up per session, only if the benchmark caused the drop and 10 s
    run under 0.55× budget.
  - Disabled when `?tier=` is forced.
  - **[MEASURED]** With simulated 55 ms frames: `high ×4 → medium ×7 → low` with reasons
    logged, and no flapping when fast frames follow.
- **[MEASURED]** SwiftShader frame rate: the previous and current builds both run ≈ 1 fps
  at 1440 high, which is CPU fill‑bound. Triangles in the work view dropped from 216 k to
  80 k. A zero‑intensity storm used to cost full fill; it is now hidden.
- **[DIFF]** No real‑GPU numbers (see §0).

## 14. Robustness

- **Context loss [MEASURED]:** the fallback appears, and after restore it disappears.
  Rendering resumes (12 frames in 2 s under SwiftShader), and scroll (6 247 px) and
  section (work) are preserved, with **zero warnings**. A stale‑handle dispose warning
  found in this pass was fixed: post targets are rebuilt without deleting dead handles.
- **Memory, 50 open/close cycles [MEASURED]:**

  | | Before | After |
  |---|---|---|
  | Geometries | 62 | 62 |
  | GPU programs | 42 | 42 |
  | Event listeners | 177 | 177 |
  | JS heap | 14.3 MB | 14.3 MB |
  | Textures | 13 | 20 (lazy blur/bloom targets, one‑time; flat across repeats) |

- **History [MEASURED]:** direct `/work/kiln` opens the project (focus 1, scroll locked),
  and it survives refresh. Rapid switching through three projects ends on the last one.
  Back/forward move between projects; Escape returns to `/work` with scroll unlocked and
  focus on a button.
- **Reduced motion:** trails off, camera micro‑motion and velocity effects off,
  transitions ×0.25.
- **Multi‑user [MEASURED]:** two clients; the peer is seen and interpolated (0.540 → target
  0.543), and the peer and trail are removed on disconnect.

## 15. Ask‑me‑anything

- **[OBSERVED]** The reference offers an AI‑style chat.
- **[OURS]** Local keyword search over the 12 placeholder projects. It jumps to the best
  match and reports the match honestly. **Not identical, and not presented as AI.** No
  backend exists in this project, so no conversational system was added.

## 16. Final comparison numbers

Mean per‑pixel difference (0–255) and mean luma per sample, from
`qa/out/*/summary.json`, are in `COMPARISON.md` ("Pass 2").
