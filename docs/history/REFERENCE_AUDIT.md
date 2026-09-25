# Reference Audit — activetheory.net

Inspected live on 2026‑09‑23 with headless Chromium (Playwright, SwiftShader WebGL2) at
1440×900 (DPR 1 and 2) and 390×844 (mobile UA, touch), plus spot checks of the
navigation, pointer, scroll, `/work`, `/work/<slug>` and contact states.

Screenshots of the reference were used only for side‑by‑side comparison during
development and are **not** committed (they contain the studio's artwork and client work).

Legend:

- **[OBSERVED]** directly visible or measured
- **[INFERRED]** likely, not verifiable from outside
- **[REIMPLEMENTATION]** how this repository reproduces it

> Note on tooling: the reference redirects to `/unsupported` when the WebGL
> `UNMASKED_RENDERER` string reports SwiftShader. The audit spoofed a desktop GPU string
> and routed asset requests through `curl` because the sandbox proxy dropped some large
> responses. Nothing else was altered.

---

## 1. Page structure

| | |
|---|---|
| [OBSERVED] | One full‑viewport `<canvas>` (`pointer-events:none`) inside `#Stage`. `html, body` are `overflow:hidden`, background `#000`. |
| [OBSERVED] | A separate fixed `.FXScroll` layer (`z-index:2`, `overflow: hidden scroll`) holds **six empty spacer blocks** whose heights define the journey: **420vh, 105vh, 1050vh, 210vh, 126vh, 420vh** (desktop total 2331vh ≈ 20 979 px at 900 px tall). |
| [OBSERVED] | On mobile (390×844) the total scroll height is 10 634 px ≈ **1260vh** — the journey is ~54 % as long. |
| [OBSERVED] | Nearly all visible UI (nav, headlines, card titles, lab label) is drawn **inside WebGL**. A hidden `.GLA11y` DOM mirror exposes links ("Toggle Audio", "Work", "Contact", project names, contact details) to assistive tech. |
| [OBSERVED] | DOM‑rendered pieces: the "What are you looking for?" chat panel, cookie banner, music player ticker, video modal. |
| [OBSERVED] | Scrolling past the end does **not** wrap: `scrollTop` stays at the max. The final section is a bookend that returns to the emblem. |
| [INFERRED] | The spacer heights drive a normalised progress per section that the WebGL scene reads. |
| [REIMPLEMENTATION] | Native document scroll with the same six section proportions (scaled ×0.54 on touch/portrait). One persistent `THREE.WebGLRenderer`; DOM overlay above it. Visible DOM text is real text (accessible by default); decorative GL text is duplicated in a visually hidden list. |

## 2. Loading / preloader

Timeline at 1440×900 (SwiftShader timings are slower than real GPUs):

| t | [OBSERVED] |
|---|---|
| 0–0.7 s | Pure black. |
| ~1.5 s | Tiny cyan monospace glyph `//1` at exact screen centre (~11 px). |
| ~3 s | A disc of ASCII hatch (`/`, `0`, `1`) fades in around centre, `>>>` in the middle. |
| ~5 s | Disc gets a thin cyan/blue glowing ring (Ø≈210 px) and ~16 teal crescent "tendrils" arranged radially around it, breathing. |
| ~8 s | Scene fades in from black: the emblem ring is seen **edge‑on** and rotates to face the camera; nav fades in at low opacity. |
| ~12 s | Emblem + two tube ribbons crossing below it in a figure‑8; `SCROLL DOWN` label (~11 px, letter‑spaced, pale cyan) ~180 px above the emblem. Nav fully visible. |

- [OBSERVED] Assets loaded before reveal: compiled shader bundle, fonts (as MSDF json), Draco/Basis decoders, ~80 geometry `.bin` and `.ktx2` textures, reel video.
- [OBSERVED] No white flash; canvas is `background: black` from the first frame.
- [INFERRED] Progress counter maps to real loaded asset count; the portal visual is WebGL.
- [REIMPLEMENTATION] `AssetManager` tracks real tasks (font files fetched via `FontFace`, particle buffers built in a Worker, card title textures rasterised, procedural textures, **`renderer.compileAsync`** for every material) and weights them. The DOM shows `//NN` at centre; the same WebGL renderer draws the ASCII disc + ring + radial tendrils which grow with progress; on completion the emblem rotates in from edge‑on.

## 3. Home / intro scene (section 1, 420vh)

- [OBSERVED] Background: near‑black blue‑grey (`#0b0f13`–`#0e1418`) with a soft teal glow bleeding from the corners (strongest right/bottom‑right), fine film grain everywhere.
- [OBSERVED] Centre: glassy iridescent ring (Ø≈200 px at 1440×900, ~22 % of viewport height) with the studio glyph extruded inside; pink/red body, cyan specular sweep along the lower rim.
- [OBSERVED] Two chrome tubes (red → pink, cyan highlights) leave the bottom of the ring and cross in an X ~300 px lower, extending off‑screen (figure‑8 / lemniscate).
- [OBSERVED] Sparse orange/red dust particles float low in the frame, depth‑of‑field sized.
- [OBSERVED] Scrolling: camera tilts/pushes so the emblem rises; at ~25–60 % the dust **erupts into a red/magenta particle storm** with horizontal light streaks and heavy bloom, the emblem dissolves inside it.
- [REIMPLEMENTATION] Original emblem (ring + notched chevron glyph, not the AT "a"), procedural iridescent thin‑film shader, lemniscate `TubeGeometry` ribbons, GPU ember field whose `uBurst` uniform is driven by section progress, additive streak sprites.

## 4. Pointer / touch trails

- [OBSERVED] Moving the mouse draws a long, persistent **silver/white trail made of many short crescent slivers** (feather‑like), lit like chrome, following the path with slight lateral scatter.
- [OBSERVED] Fast circular motion produced a trail covering ~60 % of the viewport; ~1.2 s after stopping it is still mostly visible and slowly fades from the tail.
- [OBSERVED] Pointer movement also sheds orange/red/pink sparks that drift and fall near the cursor.
- [OBSERVED] Trail lives in world space: after scrolling, the trail moves with the scene.
- [OBSERVED] `?roomqr=…` in a console URL and "multiplayer" copy suggest shared rooms.
- [INFERRED] Other visitors' trails can appear (multi‑user); could not be verified with one client.
- [REIMPLEMENTATION] `TrailSystem`: smoothed pointer → world point on a camera‑facing plane → ring buffer (96 pts) → CPU‑built camera‑facing ribbon (3 offset strands) in preallocated buffers → shader draws crescent slivers with chrome/iridescent shading; width/life scale with speed; age fades. `Sparks`: pooled CPU particles. Optional WebSocket multi‑user (`server/realtime.mjs`), throttled to 20 Hz, interpolated, max 8 remote trails, disabled when no server.

## 5. Manifesto (section 2, 105vh)

- [OBSERVED] Deep blue/indigo gradient background with blurred horizontal motion streaks.
- [OBSERVED] Large 3‑line display headline, left block starting x≈165, lines ≈ 70 px cap height, line pitch ≈105 px (≈ 0.073 vw per line), outlined/inline letterforms with pixel stair‑stepping.
- [OBSERVED] A tall glass ring seen edge‑on (≈620 px tall, 60 px wide) intersecting the headline's last line.
- [OBSERVED] Paragraph block right of the ring at x≈888, ~12 px caps, 28 px line pitch, three short paragraphs.
- [REIMPLEMENTATION] DOM headline in **Tourney** (variable, weight 300 — hollow inline letterforms, closest legal match) + mono paragraph; scramble‑in per line driven by section progress; edge‑on glass torus in GL.

## 6. Work (section 3, 1050vh) and `/work`

- [OBSERVED] Camera descends a vertical **iridescent "spine"** (stacked chrome vertebra‑like shapes) wrapped by a blue chain and clouds of pink/violet/cyan glitter particles.
- [OBSERVED] Large **rounded glass cards** (≈700×560 px at 1440 wide) float left and right of the spine at various depths, rotated ±10–25° in Y. Each shows painterly animated media with a glowing outlined title.
- [OBSERVED] Left‑bottom DOM panel: `WHAT ARE YOU LOOKING FOR?` (x=58, ~13 px), five `-> CATEGORY` rows (33 px pitch, lavender `#b9a8ff`‑ish), and an `ASK ME ANYTHING...` pill input (199×46 px, 1 px lavender border, 60 px from bottom).
- [OBSERVED] Hovering a card: it tilts toward the pointer and its title glows/scrambles.
- [OBSERVED] Clicking a card: URL → `/work/<slug>`; the card rushes toward the camera (~200 ms), then the world darkens to a dark‑teal void over ~1 s; left panel shows title, `year / client / category`, a description, `CASE STUDY` link and `<- CLOSE`; top centre label `SCROLL TO …`.
- [OBSERVED] Clicking nav `WORK` from home: URL `/work`, scroll jumps to the start of section 3 through a fast particle‑storm warp (~400 ms), then settles on the first card.
- [OBSERVED] On `/work` a mini music player (`<<  track ticker  >>`) appears under the nav.
- [REIMPLEMENTATION] Instanced spine vertebrae, instanced chain links, GPU glitter. 12 original fictional projects; each card = extruded rounded rect with a procedural "painted" media shader + canvas‑rasterised title texture. Raycast hover/click. `TransitionController` (IDLE → EXITING → SWITCHING → ENTERING) drives camera focus, `uDim`, card pull‑in and DOM detail panel. Category rows filter/jump; the ask box performs local keyword search over the projects.

## 7. Lab (sections 4–5, 210vh + 126vh)

- [OBSERVED] Dark room with a cylindrical rig of chrome rods, stacked ring platforms and hanging red cables; a glowing red/pink organic particle mass inside; wet reflective floor.
- [OBSERVED] Then camera goes under a water surface (caustic light lines, bubbles, magenta tint) and faces a wall of hexagonal mirror tiles forming concentric ripples. Label `// THE LAB ->` (display font) with a 3‑line mono description and a crosshair glyph.
- [REIMPLEMENTATION] Instanced rods, torus platforms, merged catenary cable tubes, red particle blob, glossy floor shader; caustic water plane (voronoi edge shader) seen from below, bubbles, 900+ instanced hex tiles with ripple displacement; DOM label.

## 8. Outro (section 6, 420vh)

- [OBSERVED] Red particle storm again, then the emblem returns (inverted ribbon above), a small jellyfish‑like red creature drifts, teal corner glow. Scroll stops at the end (no loop).
- [REIMPLEMENTATION] Storm reprise + second emblem framing; an end‑of‑page "BACK TO TOP" affordance instead of a fake loop.

## 9. Navigation

Measured at 1440×900 (CSS px):

| | [OBSERVED] |
|---|---|
| Box | Pill **240 × 46**, top **41**, right **40**, radius fully round. |
| Border | ~1.5 px, desaturated teal‑green `rgba(120,170,150,.55)`; fill near‑black `rgba(12,16,18,.9)`. |
| Content | `WORK` (left, starts 30 px in) — 50 px 1 px white rule — `CONTACT` (ends 30 px from right). Caps ≈ 9 px tall, outlined display face, wide tracking. |
| Glow | Soft elliptical light below the pill (≈200×40 px) with thin vertical "rain" streaks falling from it; colour shifts teal/green ↔ blue‑white. |
| Hover | Hovered label scrambles glyphs (`WORK` → `W2RK`) for ~300 ms; glow brightens and turns blue‑white. |
| Scrolling | The pill **deforms**: top edge bows, sides wobble, spring back when the scroll stops; glow intensifies with velocity. |
| Route | On `/work` and `/contact` the middle rule becomes a **wave** (`~`). |
| Mobile 390×844 | Pill **210 × 46**, top **30**, right **25**; same content. |

- [REIMPLEMENTATION] DOM `<nav>` with real links; SVG outline path regenerated every frame from a spring driven by scroll velocity (no React re‑renders); per‑label scramble on hover/focus; CSS/canvas glow + rain; divider path morphs line ↔ wave.

## 10. Contact (`/contact` overlay)

- [OBSERVED] Scene stays alive but blurred/darkened; large display row `LAX → NYC → AMS` across the viewport (≈90 px caps), `✦ REACH US ✦`‑style header, email underlined centre, socials + links bottom‑left, QR bottom‑right. Fades in ~600 ms.
- [REIMPLEMENTATION] Same layout with placeholder studio locations/links; PostFX blur + dim uniform.

## 11. Typography

| Role | [OBSERVED] | [REIMPLEMENTATION] |
|---|---|---|
| Display | Proprietary geometric grotesk (NB Architekt, loaded as MSDF) rendered with an inline/outline + pixel shader, uppercase. | **Tourney Variable** @ wght 300 (hollow inline forms), uppercase, `letter-spacing:.02em`, `clamp()` sizes. |
| UI / body | Same family, small caps sizes 11–13 px, wide tracking, uppercase. | **Share Tech Mono** uppercase, 11–13 px, `letter-spacing:.06–.12em`. |
| Glitch | Characters scramble on reveal/hover. | Shared `scramble()` util driven by rAF. |

## 12. Rendering / performance

- [OBSERVED] Canvas backing store **1.5× CSS size on a DPR‑1 desktop** (2160×1350 for 1440×900) and **1.25× on DPR‑1 mobile** (487×1055).
- [OBSERVED] Heavy bloom on hot colours only; film grain; teal vignette; chromatic fringe on bright edges.
- [OBSERVED] Four worker threads spawned (`hydra-thread.js`).
- [REIMPLEMENTATION] Tiered DPR: desktop high 1.5–1.75, medium 1.25, low 1.0; mobile 1.25 / 1.0. HalfFloat scene target → threshold → 5‑level dual‑filter bloom → composite (ACES‑ish tone map, vignette/corner glow, velocity‑scaled chromatic aberration, grain, blur for overlays). Adaptive FPS monitor steps tiers down. Particle buffers generated in a Worker.

## 13. Audio

- [OBSERVED] Hidden "Toggle Audio" link; music player with track ticker on `/work`. No autoplay observed (headless).
- [REIMPLEMENTATION] Original generative ambient pad via Web Audio (no files), **off by default**, toggled from the nav; analyser level subtly feeds particle intensity.

## 14. Visual‑state inventory

| State | Desktop ref | Mobile ref | Ours |
|---|---|---|---|
| Preloader counter / portal | ✔ | ✔ | ✔ |
| Home emblem + ribbons | ✔ | ✔ | ✔ |
| Trail drawing | ✔ | n/a (touch) | ✔ |
| Particle storm | ✔ | ✔ | ✔ |
| Manifesto | ✔ | ✔ | ✔ |
| Work spine + cards + panel | ✔ | ✔ | ✔ |
| Card hover / click / detail | ✔ | – | ✔ |
| Lab rig | ✔ | ✔ | ✔ |
| Hex wall / water | ✔ | ✔ | ✔ |
| Outro emblem | ✔ | ✔ | ✔ |
| Contact overlay | ✔ | – | ✔ |
| Nav rest / hover / scrolling / route | ✔ | ✔ | ✔ |

See `COMPARISON.md` for the side‑by‑side loop results.
