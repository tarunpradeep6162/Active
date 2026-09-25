# Visual & Motion Comparison Log

> **Pass 2 (completion pass)** results are at the end of this file. The detailed per‑area
> audit, with measured values, is in `REFERENCE_AUDIT_V2.md`.

Method: the reference (activetheory.net) and this build were captured with the same
headless Chromium at the same viewport and the **same normalised scroll positions**
(the journey length matches the reference to within 0.1 %), then placed side by side.
Captures are kept out of the repository because the reference frames contain third‑party
artwork. Scripts used live in the session scratchpad; the procedure is described below so
it can be repeated.

> Limits of the environment: only Chromium with SwiftShader (software WebGL) was
> available. It renders at ~2–6 fps, so frame timing, 60 fps smoothness and GPU cost
> could **not** be measured here. Firefox, Safari, Edge, iOS and Android were not
> available and were not tested. See "Open items".

## Measured parity

| Metric | Reference | Ours |
|---|---|---|
| Desktop scroll length @1440×900 | 20 979 px (20 079 scrollable) | 20 979 px (20 079 scrollable) |
| Mobile scroll length @390×844 | 10 634 px | 10 624 px |
| Section split (vh) | 420 / 105 / 1050 / 210 / 126 / 420 | identical |
| Nav pill desktop | 240×46, top 41, right 40 | 240×46, top 41, right 40 |
| Nav pill mobile | 210×46 at x 155, y 30 | 210×46 at x 155, y 30 |
| `/work` landing scrollTop | 4 745 px | 4 839 px |
| Canvas backing scale, DPR‑1 desktop | 1.5× | 1.5× (high tier) |
| Canvas backing scale, DPR‑1 mobile | 1.25× | 1.25× (high) / 1.0× (medium/low) |
| End of page | stops (no loop) | stops (no loop), "Back to the start" |
| Horizontal overflow @390 | none | none |

## Comparison rounds

### Round 1 (first full build)
| State | Discrepancy | Fix |
|---|---|---|
| Home | Frame washed teal; horizontal banding in backdrop | Removed banding noise, cut corner glow ~45 % |
| Home | Emblem ring read teal/gold; reference is pink‑red with a cyan sweep | Pinker base, narrower thin‑film range |
| Trails | Trail kept growing while the mouse was still and the page scrolled | Samples only while the pointer is actually moving |
| Storm | Only dotted streaks visible, no particle cloud | Added soft "puff" particles, brighter cores |
| Lab | Camera went *under* the floor; huge teal wall | Lab floor = portal water surface; removed wall; re‑keyed camera |
| Portal | Hex wall pastel and flat | Darker mirror tiles, gaps, env‑dominated shading |
| Warm‑up | WebGL feedback‑loop warning | Warm‑up renders into a scratch target |

### Round 2
| State | Discrepancy | Fix |
|---|---|---|
| Storm | Large point sprites unreliable (mobile caps point size) | New instanced billboard `Nebula` system |
| Storm | Nebula over‑exposed the whole frame red | Intensity cut to ~30 %, sharper density threshold |
| Work | Cards and spine smaller than the reference | Camera 8.6 → 6.6 units from the spine |
| Project open | Card covered the info column | Focus framing pushed right and back |
| `/work` | Landed above the first card | Lands on the first card's framing |
| Nav | Scramble changed label width (layout jitter) | Scramble drawn in an overlay over a fixed sizer |
| Mobile | Divider crowded labels; spine dominated portrait | 34 px divider on mobile; spine girth ×0.7 in portrait |

### Round 3
| State | Discrepancy | Fix |
|---|---|---|
| Intro 25–80 % | Reference keeps the emblem centred while particles erupt **around** it; ours flew past | Camera holds on the emblem; storms moved to surround each emblem and driven by section progress |
| Manifesto | Glass ring too neon | Dark glass, low glow |
| Lab | Rig too close/bright vs. the reference's murky room | Pulled back, darker chrome and cables, denser fog |
| Portal | Reference is a hex **tunnel** under a wide water surface | Back wall + two angled side walls; camera lower and further |
| Outro | Emblem revealed too late | Reveal window moved earlier |

## Motion comparison

| Behaviour | Reference (observed) | Ours |
|---|---|---|
| Idle | Emblem sways, dust drifts, grain moves | Same (procedural sway, drifting GPU particles, animated grain) |
| Pointer move | Chrome crescent‑sliver trail that follows the path, fades from the tail after ~1 s; orange sparks | Ribbon strands with crescent slivers, 1.1–2.5 s life scaled by speed, pooled sparks |
| Fast pointer | Longer, larger trail | Width and life scale with pointer speed |
| Scroll (slow) | Camera glides, heavy damping | Scroll damped (λ 6.5) then camera damped (λ 5.5) |
| Scroll (fast) | Particle burst, bloom flare, nav pill bends | Turbulence, bloom strength, FOV kick, chromatic fringe and pill deformation all scale with scroll velocity |
| Reverse scroll | Symmetric | Path is a pure function of progress, so reversing is exact |
| Nav → Work | ~0.4 s particle warp, cut, settle on first card | 0.42 s ease‑in warp, cut, 0.8 s settle on first card |
| Card open | Card rushes forward ~200 ms, world darkens ~1 s, info panel | 0.5 s pull‑in then 1.1 s focus; other cards/spine dim; info panel |
| Contact | Scene blurs/darkens, large city row fades in ~600 ms | 0.7 s overlay with post‑process blur + dim |
| Touch | Trail on touch; page still scrolls | Same; touch never blocks native scroll |

## Validation results (Chromium / SwiftShader)

- `npm run build` (typecheck + Vite): passes.
- Console: no errors or warnings across load, the full scroll journey, the nav, card open/close, contact, history back/forward and rapid route changes (only three.js's informational note that `KHR_parallel_shader_compile` is missing in SwiftShader).
- Reduced motion: trails off, transitions shortened, camera micro‑motion off.
- WebGL context loss: fallback message appears; after restore it disappears and rendering resumes with no warnings.
- Memory: GPU resources hold at 48 geometries / 20 textures across 32 route changes (the +6 over the first frame are lazily allocated blur targets). JS heap ≈ 13 MB.
- Draw calls: 26–34 per frame including the post chain.
- Multi‑user: two clients through `server/realtime.mjs` see each other's interpolated trails; a peer's trail is removed when they disconnect.

## Open items

- Real‑GPU frame‑rate profiling (desktop and phones) is still needed; the automatic tier governor steps down when frame time is too long, but its thresholds are untested on hardware.
- Safari, Firefox, Edge, iOS and Android are untested.
- The reference uses baked PBR scenes (tree room, jellyfish, chain‑link spine models). Here these are procedural stand‑ins, so the materials read cleaner and less organic than the reference.


---

## Pass 2 — completion pass

Harness: `qa/compare.mjs` (normalised‑scroll frames, side‑by‑side and diff images),
`qa/states.mjs`, `qa/validate.mjs` and `qa/multiuser.mjs`. Output goes to `qa/out/`, which
is git‑ignored.

### Mean per‑pixel difference vs reference (0–255, lower is closer)

Measured at 1440×900 (tier high) before the pass's final work‑column change:

| Region | Samples | v1 build | Pass 2 |
|---|---|---|---|
| Intro / storm | 0.00–0.15 | 8.8 · 10.1 · 11.9 · 20.4 · 26.6 | 9.3 · 9.1 · 11.3 · 24.9 · 23.7 |
| Headline | 0.20 | 36.6 | 39.9 |
| Work | 0.25–0.65 (9 samples) | avg 44.8 | avg 45.9 (then column tightened: see below) |
| Lab | 0.70 · 0.75 | 32.6 · 23.2 | 36.1 · 17.7 (0.70 → 16.4 after the lab approach moved earlier) |
| Tunnel | 0.80 | 24.5 | 15.3 |
| Closing storm / end | 0.85–1.00 | 19.5 · 21.5 · 18.8 · 12.4 | 23.2 · 22.0 · 22.2 · 12.4 |
| **All 22 samples** | | **31.2** | **30.9** |

Phone, 390×844 (tier medium): 41.8 before and 41.7 after.

**How to read these numbers.** Per‑pixel difference rewards matching darkness more than
matching structure. Our content is original, with different cards, text and glyph, so
a floor of about 30–45 remains even when the composition matches. The structural changes
are best judged from the `*_side.png` frames. The biggest compositional gains were:

- the emblem held centred during the storm;
- the lab framed from housing to floor;
- the tunnel low in frame under the surface;
- in the final change, large centred cards with their neighbours in frame and the spine
  behind. After it, work samples read: 0.25 55.4, 0.30 44.7, 0.35 47.0, 0.45 44.1,
  0.50 55.0, 0.60 49.9. Media was then dimmed further to close a luma gap (ours 60–85 vs
  reference 52–70).

### Measured parity (pass 2)

| Metric | Reference | Ours |
|---|---|---|
| Scroll height 1920 / 1440 / 1366 / 1024 | 25 175 / 20 979 / 17 902 / 17 902 | 25 175 / 20 979 / 17 903 / 17 903 |
| Scroll height 768×1024 (tablet) | 23 869 | 23 869 (was 12 889) |
| Scroll height 430 / 390 / 375 | 11 743 / 10 634 / 10 231 | 11 743 / 10 634 / 10 231 |
| Work landing @1440 | 4 745 px | 4 753 px (was 4 839) |
| Nav @1440 | 240 px wide at x 1160 | 240 × 46 at (1160, 41) |
| End of scroll | stops | stops |

### Validation (pass 2 final build)

See `qa/out/validate_final.json` locally; the summary is in `REFERENCE_AUDIT_V2.md` §14.
