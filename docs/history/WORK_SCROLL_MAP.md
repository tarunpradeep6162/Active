# Work / spine scroll map

This file records how the reference Work sequence moves. Every value was measured from the
live render in headless Chromium and then reproduced from those measurements. Nothing was
guessed.

The reference's frames are QA material only. They are written to the git‑ignored `qa/out/`
and are never committed or served. Everything shipped here, including the geometry, shaders,
cards, copy and media, is original. What was taken from the reference is its *motion*:
numbers that describe where the camera is and when things happen.

> **Update:** the central column is now the tulip garden (`src/scenes/TulipGarden.ts`; see
> BIRTHDAY.md). It occupies the same axis and extent, and uses the same entry-reveal and
> exit-dissolve hooks. Everything measured below still drives the camera unchanged.

## 1. Method

| Step | Tool | Notes |
|---|---|---|
| Record every 1 % of the Work section (−0.10 … 1.02, 113 frames) | `qa/workmap.mjs` | The reference's scene graph is read through its renderer: camera matrix and pivot, every card's world matrix and geometry extent, the column axis. Ours is read through `window.__exp`. |
| Settle before each read | same | ≥ 3 **newly rendered** frames with < 0.002 units of camera motion. The first run used wall‑clock waits, and at < 1 fps under SwiftShader it read the camera mid‑move (errors up to 7°). Every table in `src/work/workCameraData.ts` comes from the frame‑counted runs. |
| Build the camera table | `qa/worktable.mjs` | Rows: `[p, orbit angle (unwrapped °), height, radius, heading offset °]`. Card centres are the p where the angle crosses −50°·i (phone −35°·i). |
| Frame‑by‑frame comparison | `qa/workcompare.mjs` | Per frame, four panels (reference / ours / 50‑50 overlay / difference) plus `metrics.json`. |
| Seam timing | `qa/sheet.mjs`, `qa/headline.mjs` | Contact sheets, and headline position read from pixels (the reference draws its headline in WebGL). |
| Determinism | `qa/workreverse.mjs` | Reaches the same progress forwards, backwards and after 25 random jumps, then compares the settled camera. |

## 2. What actually moves

Each of the candidate explanations was tested against the scene graph.

| Candidate | Result |
|---|---|
| The column moves or translates up | **No.** The column's world matrix is constant for the whole section. |
| The column rotates | **No.** Each vertebra has a fixed twist of ≈ 22.95° about Y relative to the one above. That twist is built into the geometry, not animated. |
| The cards move | **No**, apart from card 0's entry (see §4). They sit on a fixed helix. |
| **The camera orbits and descends** | **Yes.** The camera sits 2 units behind a pivot. The pivot travels around the column at ≈ 7–7.6 units from the axis, so the camera orbits at a radius of 8.89 – 9.60, looks horizontally (pitch 0.00°) and descends. |

The apparent "bone scrolling up" is therefore the camera going *down* while orbiting.
Ours now does the same: the column and cards are static, and `WorkTimeline` drives
the camera.

## 3. Measured structure (1440 × 900; phone differences in §6)

- **Column:** a straight stack at the axis. Vertebra spacing is 0.65, and the column's
  world top is at 7.45 (local). Each vertebra's visible box is ≈ 1.93 × 1.16 × 1.68, twisted
  a further 22.95° per vertebra. A chain helix winds around it.
- **Cards:** 14 on a helix of radius 3.8. Consecutive cards step −50° and −0.84 in y, starting
  at (3.8, 0, 0) and facing outward. The **visible** card is 3.04 × 1.98: the transform is
  4 × 2.6, but the geometry only spans ±0.38. Our cards were 1.3× too large before this was
  measured.
- **Camera:** vertical FOV 35°, orbit total −650° (13 × 50°), height 0.51 → −11.92. The radius
  breathes between 8.9 (between cards) and 9.6 (card centred).
- **Heading:** the camera's aim leads or lags the axis by up to ±0.5°, in phase with the cards.
  That is what puts the column up to ±12 px off centre. The fifth table column reproduces
  it.
- **Orbit speed:** not constant. It is about 5° per 1 % of the section at the start, ~9° per
  1 % mid‑section, and eases to 0 by p ≈ 0.94.

Excerpt of the desktop table (full table: `WORK_CAMERA_DESKTOP`):

| p | angle ° | height | radius |
|---|---|---|---|
| 0.00 | −1.6 | 0.35 | 9.51 |
| 0.10 | −32.4 | −0.54 | 8.95 |
| 0.20 | −93.4 | −1.56 | 9.26 |
| 0.30 | −175.9 | −2.96 | 8.89 |
| 0.40 | −272.0 | −4.57 | 8.90 |
| 0.50 | −372.8 | −6.26 | 8.89 |
| 0.60 | −469.3 | −7.89 | 8.92 |
| 0.70 | −553.1 | −9.30 | 9.43 |
| 0.80 | −615.2 | −10.34 | 8.99 |
| 0.90 | −647.8 | −11.22 | 9.47 |
| 0.93 | −650.0 | −11.53 | 9.60 |

Card centres (`ProjectAnchor` = the p where the camera faces card i), desktop:
0.002, 0.1344, 0.2094, 0.2708, 0.326, 0.3778, 0.4278, 0.4773, 0.5272, 0.579, 0.634,
0.6955, 0.7704, 0.94. Each card appears about half a spacing before its centre (it enters
from the frame edge as the orbit brings it round). It is closest at its centre, where the
radius peaks at 9.6, and exits half a spacing after.

## 4. Entry seam (headline section, p −0.10 … 0)

- **The camera does not move.** It is parked on card 0: angle 0, radius 9.6, height
  1.00 → 0.65.
- **Card 0 rises alone.** Measured against its projected slot, its offset is fully hidden at
  −0.08, then 0.28 / 0.12 / 0.02 / 0 screen heights at −0.07 / −0.06 / −0.05 / −0.04. An edge
  dissolve runs with it. The neighbouring cards are already in place.
- **The column assembles bottom‑up**, from card 0 toward the top of the frame, between
  −0.045 and −0.01. The front's height above card 0 is −∞ / 0.5 / 1.7 / 2.2 / 4 / 8.5 at
  −0.05 / −0.045 / −0.04 / −0.03 / −0.02 / −0.01.
- **The headline is pinned, then scrolls away.** Its glyph top sits at 21 vh for p −0.10 …
  −0.08, then moves 42 vh per headline‑section length (4.2 vh per 1 %) and has left the top
  by −0.03. Before the section it rises in from below.
- **The headline ring does not scroll.** It holds at the frame centre, and its outer
  diameter is ≈ 68 % of the frame height. It opens from edge‑on (before the section) through
  a ¾ view toward face‑on, and dissolves over −0.038 … −0.02.

Implementation:
- the card rise and column front are `workTimeline.card0Entry` / `spineFront`, with the per‑device numbers in `SeamConfig`;
- the headline is `headlineShift` in `UIDriver`;
- the ring is `placeManifestoRing`.

## 5. Exit seam (p 0.915 … 1.0)

- The camera stays parked on the last card.
- The column crumbles away over 0.915 → 0.94.
- A **static** lab view is then revealed under a slanted edge that rises from the bottom.
  The edge's y from the top at the frame centre is 1.1 / 0.62 / 0.53 / 0.45 / 0.30 / 0.20 /
  0.05 / −0.12 at 0.93 / 0.94 / … / 1.00. It rises to the right by 18 % of the height across
  the width.
- By p = 1.0 the frame is entirely the lab and the lab section continues from there.

Implementation: during 0.93–1.0 the main camera is already on the lab framing, with a slight
push‑in. `PostFX` draws the parked Work view over it above the edge, with a depth‑only mask
blocking it below the edge. The rig snaps across that view cut so damping never produces a
visible sweep.

## 6. Phone (390 × 844)

The phone is not the desktop path scaled down. The reference uses a different rig, and ours
selects it by device class (`setWorkDevice`):

| | Desktop | Phone |
|---|---|---|
| FOV | 35° | 55° |
| Helix | start y 0, −50° / −0.84 per card | start y 4, −35° / −1.12 per card |
| Orbit | −650° | −455° |
| Card centres | see §3 | 0.002, 0.0906, 0.1647, 0.2254, 0.2799, 0.3311, 0.3804, 0.4294, 0.4787, 0.53, 0.5844, 0.6451, 0.7192, 0.88 |
| Card (visible) | 3.04 × 1.98 | 2.2 × 2.04 (0.725 × width, 1.03 × height: near square) |
| Section split (vh) | 420 / 105 / 1050 / 210 / 126 / 420 | 210 / 105 / 525 / 105 / 105 / 210 (not a uniform scale) |
| Work section | starts 4 725 px, 9 450 px long | starts 2 659 px, 4 431 px long |
| Headline section in work p | −0.10 … 0 | −0.20 … 0 (the timeline starts at −0.20) |
| Camera during the headline | parked, y 1.00 → 0.65 | parked, y 4.30 → 3.79 |
| Card 0 entry | rises from fully hidden, strong dissolve, in place by −0.045 | offsets ≈ 0.22 / 0.14 / 0.06 screen heights at −0.09 / −0.07 / −0.05, almost solid, in place by −0.035 |
| Column | assembles bottom‑up −0.045 … −0.01 | visible throughout |
| Headline | pinned at 21 vh, then 4.2 vh per 1 % | no pin, 14.7 vh at −0.10, then 1.7 vh per 1 % |
| Ring | ≈ 68 % of the height, dissolves −0.038 … −0.02 | ≈ screen width, fades −0.076 … −0.05 |
| Project list | appears −0.045 … −0.02 | appears −0.08 … −0.065 |
| Exit | crumble 0.915 – 0.94, wipe 0.93 – 1.0, slant 18 % | crumble 0.85 – 0.885, wipe 0.86 – 1.0 (edge 0.65 / 0.45 / 0.30 / 0.12 at 0.88 / 0.91 / 0.94 / 0.97), slant 4 % |

Phone metrics over the orbit, p 0 … 0.86 (87 frames):

| Metric | Mean | Max |
|---|---|---|
| Orbit angle | 0.14° | 0.4° |
| Camera height | 0.02 | 0.03 |
| Card centre x / y | 1.4 px / 1.0 px | 4 px / 2 px |
| Card width | 0.6 px | 2 px (was +117 px before the phone card shape) |
| Column x | 0.1 px | 1 px |

Over the phone headline seam (−0.19 … −0.01) the camera matches within 0.03 in height and 0.2° in angle.
`qa/workreverse.mjs 390 844` also passes, with an identical forward / backward / jitter state.

## 7. Scroll response and determinism

- The scene state is a pure function of scroll progress. The camera table, card entry,
  column front, crumble and wipe edge have no internal state.
- **Velocity** only adds temporary effects: a pull‑back along the view axis, a FOV kick, a
  little roll and bloom. All of them decay to zero when scrolling stops.
- **Smoothing:** the scroll is damped at λ 6.5 (9 on phones), then the camera is damped at
  λ 10. The reference always settled within ≈ 0.9 s. Its step response could not be fitted
  more finely, because only ~6 samples per second are possible at < 1 fps.
- `qa/workreverse.mjs` at 1440 × 900 reaches p 0, 0.1377, 0.25, 0.4346, 0.5, 0.6988, 0.85 and
  0.95 forwards, backwards and after 25 random jumps. The settled cameras are **identical**
  (spread 0.000 units). They sit 0.029 from the pure path sample: that is the frozen idle
  micro‑motion. The same holds at 390 × 844 and inside the exit wipe (p 0.95).

## 8. Error metrics (ours vs the reference, 1440 × 900, clean settle)

Measured over the orbit p 0 … 0.93 (94 frames), from `qa/out/workcompare_1440x900/metrics.json`:

| Metric | Mean | Max |
|---|---|---|
| Orbit angle | 0.05° | 0.2° |
| Camera height | 0.00 | 0.02 |
| Camera radius | 0.00 | 0.00 |
| Focused card centre x / y | 1.0 px / 0.7 px | 3 px / 2 px |
| Focused card width | 2.4 px | 8 px |
| Column x on screen | 0.3 px | 1 px |

Before this pass, the same metrics against the unsettled first run were 0.57° mean / 7° max
and 12 px on the column. The seam frames (§4, §5) are compared visually from contact sheets,
because the reference's card‑0 rise and wipe are not in its scene‑graph transforms.

## 9. Known differences and limits

- The reference's pixel‑glitch text fill, its per‑card media and its particle‑burst dissolve
  are not reproduced. Ours uses original media, a noise dissolve and a bright rim.
- The lab framing seen through the wipe is about 1.5× larger than the reference's. The lab
  scene was out of scope for this pass.
- Headless Chromium with SwiftShader only: under 1 fps, so frame timing and real‑GPU cost
  were not measured.
