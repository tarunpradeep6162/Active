# For Dheepika · 25 · 11: final delivery

The old studio site is gone. What is left is one continuous, cinematic birthday universe, travelled by
scroll, made only for her. **Every line of feeling is already written** (the letter, 14 reasons,
the name letters, quiz, clues, timeline, gifts, 24 wishes, 12 lantern wishes, the last message
and the secret ending), in a warm voice you can edit freely. Only facts that can't be invented
stay marked, like dates, places, song titles, photos, videos and your voice note (see the
**Personal content checklist** at the end).

Preview: https://meridian-field-nine.vercel.app (the Vercel project keeps its old internal name;
nothing on the page says it). To change the URL, add a domain or rename the project in Vercel.

---

## What she experiences

| # | Moment | Where in the code |
|---|--------|-------------------|
| 0 | **Loader**: a small bud gathers light, with "Gathering memories…" | `Preloader` in `src/ui/Sections.tsx` |
| 1 | **Opening**: a deep night sky with drifting rose and violet nebulae and a faint Milky Way, opened like a film (letterbox, the date's letters settling in, a slow sheen of light across her name). The mark is a rose‑gold heart holding a champagne *D*, with a warm light inside and gold dust around it, and the first tulip's gold stem and leaves beneath it. *25 · 11*; "Some dates are just dates. / But one changed my world."; a shooting star she can make a wish on; her name; **Enter our garden** | `IntroHint`, the heart + D emblem in `src/scenes/Emblem.ts` |
| 2 | **Threshold**: "A garden made of memories", framed by a wreath of tulip petals and leaves with gold light flowing round it, a doorway into the garden | `Manifesto`, `src/scenes/PetalWreath.ts` |
| 3 | **The tulip garden**: 25 tulips open as she scrolls, and 14 of them hold the chapters. Fireflies and a few butterflies. Behind them, a real sky with a horizon: hills in the haze, thin clouds, stars, and a moon that turns into a low golden sun as she descends. Soft out‑of‑focus lights drift past the lens. Each chapter unfolds out of its tulip. | `src/scenes/TulipGarden.ts`, `src/scenes/GardenSky.ts`, `src/birthday/ui/*` |
| 4 | **The cake in the cage**: a room staged like a film set: a plum velvet drape, strings of warm fairy lights out of focus, a rose‑gold cage, and a spotlight with dust turning in its beam. Touch the lock; the bars rise and the cake comes forward with its candles lit. **Blow out the candles**: hold the button (or, only if she taps for it, use the microphone). The flames lean and go out, smoke curls from every wick, there is a moment of darkness, then gold dust and petals. The candles relight for another wish. | `src/scenes/Lab.ts`, `src/scenes/CakeRoom.ts`, `src/scenes/BirthdayCake.ts`, `LabLabel` |
| 5 | **The lantern sky**: a still night lake under the Milky Way, with a far shore of hills and pines. Paper lanterns rise off the water and their light shimmers in it. Twelve hover close; touching one lets its wish go. Its words rise, and it climbs into a star that stays in her sky. | `src/scenes/LanternSky.ts`, `src/scenes/NightLake.ts`, `LanternSkyLabel` |
| 6 | **The finale**: over the same lake, the stars gather into *25 · 11*, then into **DHEEPIKA**, mirrored in the water. *Happy birthday* above, *25 · November* below, rose and champagne fireworks launched as rockets from the shore, the sun rising behind the hills right under her name with a golden path across the water, the final words one at a time, then **One last thing**: your voice note and last message. | `src/scenes/Constellation.ts`, `FinaleSky` |
| + | **Someday** (inside chapter 12, Future Universe): a photographic manor at golden hour. It's a cream villa of our own design, with arched windows that reflect the sky, classical cornices, balustraded balconies, a porch of columns and an ivy arch. Rose blossom shrubs frame a gravel path, with full trees and a real cloudy sky. It's dressed with CC0 (public‑domain) Poly Haven assets: photoscanned plaster, grass and gravel, a captured sky for the lighting, and scanned shrubs. It loads about 5 MB, only when the chapter opens (credits in `public/manor/CREDITS.txt`). | `src/birthday/ui/ManorScene.ts`, `public/manor/` |
| + | **For you** (top‑right menu): a message to future us (kept on her device), *Our next date* as an image, the letter as a PDF | `Contact` → For you, `src/birthday/keepsakes.ts` |
| + | **Sound** (off by default): an original generative music box with chimes at the big moments | `src/audio/AudioEngine.ts` |
| + | **404**: "Looks like this path wandered out of the garden." / Return to our garden | `NotFound` |
| + | **No WebGL**: a quiet page version of the same story (opening, memories, letter, final words) | `src/birthday/ui/FallbackStory.tsx` |

Routes: `/` (the journey), `/garden` and `/garden/<chapter>`, and `/for-you`. The old `/work…` and
`/contact` links still resolve, so nothing breaks.

## The fourteen chapters

Each chapter opens out of its tulip onto its own 3D scene. They live in
`src/birthday/ui/stage/`. Each loads only when its chapter opens and pauses when off screen.
Without WebGL, the earlier flat versions come back.

| # | Chapter | The scene |
|---|---------|-----------|
| 1 | 25 · 11 | One star in a nebula. Touching it twice makes it burst into a galaxy that gathers into the date. |
| 2 | Memory Universe | Polaroids orbit a glowing core that sends slow shafts of light through drifting dust. The one she touches comes forward. |
| 3 | The Letter | An envelope in candlelight. The wax seal breaks and the letter rises. |
| 4 | 14 Things | The reasons are stars. Threads of light join the ones she finds, then her name is written in stars. |
| 5 | Catch My Heart | A tulip stands behind the game, its head where the petals fall from. It begins as a closed bud. Each catch brings a petal home and opens it further, and winning makes it bloom fully in a spiral of light petals. |
| 6 | Know Us? | Two glass hearts (rose and gold) joined by a thread of light. Each answer draws them closer: a right one makes them glow, a wrong one makes them tremble. They meet above her next‑date card. |
| 7 | Our Secret | A brass cryptex with one engraved ring per clue. A right answer turns its ring to the symbol and lights it; a wrong one makes it shudder. With all five aligned it opens and light pours out. |
| 8 | Music Room | A walnut record player. Choosing a song writes the title on the label, the tonearm finds the groove, the record spins up and notes rise. |
| 9 | Our Timeline | A river of light winding into the stars, with a lantern at every date. Moving through the story carries the camera along it, and the last stop opens onto a horizon. |
| 10 | Choose a Gift | Three satin boxes. The one she chooses opens. |
| 11 | Make a Wish | One candle. Its flame leans while she holds, then goes out in a curl of smoke, and her wish climbs as a spiral of gold sparks. |
| 12 | Future Universe | The manor at golden hour, behind the possibilities. |
| 13 | Our Little Movie | A velvet cinema. The house lights dim, the curtains part and a projector beam lights the screen. Until her clips are added, the screen runs a film‑leader countdown. |
| 14 | For Dheepika | Door 25: a gold arched door whose lights count the open chapters. It swings open, hearts and light pour through, and the camera passes into the light before the finale. |

## Current state: no passphrase (until the final build)

- The site is live **without a passphrase**. It shows the shipped content. The timeline is your
  real dates and words, with only the explicit sentences removed for the public version.
- **Waiting for the final build, in the git‑ignored `birthday-private/content.json`:** your
  letter (7 paragraphs from your messages) and the full, uncut timeline. They are not on the
  public site.
- An encrypted backup of both is in git history (commit `373e08b`, `public/vault/content.bin`),
  so nothing is lost if this machine is cleared.
- **Final build:** fill in the remaining facts (photos, song titles, voice note), then run
  `npm run vault -- --pass "…" --hint "…"`, build, commit `public/vault/`, and deploy.
  Passphrases are matched ignoring capital letters and extra spaces.
- Slots still waiting for a real fact ([date], [place], song titles) are hidden on the site
  until they're filled.

## Cinematic language

- **Act cards**: each world opens with a quiet title, like a film's act break: *I · Our Garden*,
  *II · Something Sweet*, *III · A Sky of Wishes*, *IV · Your Stars*.
- **Grade**: plum in the shadows and champagne in the highlights, a soft oval vignette, and gentle
  bloom. The old film grain is gone; only a faint dither remains to stop dark gradients from
  banding.
- **Letterbox**: bars slide in for the opening title and the two big moments, the cake leaving its cage and her name
  forming in the stars.
- **Chapters as film**: each chapter opens inside letterbox bars and a soft vignette, with a
  title card (*Chapter VIII* between two lines of light, the title settling into focus and a
  sheen passing over it). A reel of fourteen film frames at the bottom shows where she is and
  which chapters are opened, and lets her jump to any of them.
- **Navigation**: a thread of gold across the top of the screen shows how far through the
  journey she is; the garden menu slides in item by item, with a line of light drawn under
  each choice.
- **Light leaks**: a warm leak of light sweeps across the frame at every change of scene and
  whenever a chapter opens (never with reduced motion).
- **Lens**: the brightest lights (candles, fairy lights, the sun) stretch into faint horizontal
  streaks, as through a cinema lens.
- **Camera**: in the cake room it pushes in slowly as the cake comes out of its cage. The lantern sky is framed level, and the finale drifts wide while the stars wander,
  then slowly pushes in as they spell DHEEPIKA.
- **Light**: soft light shafts slant through the garden and warm toward sunset as she scrolls.

## Art direction

- Palette: midnight `#070914 #0B1020 #11162A`, rose `#D98B9D #E8A6B5 #F2C1CB`, champagne
  `#D6B46A #E6C989 #F3DFA7`, soft `#F8F1E8`. The tokens are in `src/ui/styles.css`, and the 3D
  palettes per section are in `src/world/World.ts`.
- Type: Cormorant Garamond for emotion (titles, letters, wishes), Caveat only for your
  signature, and Share Tech Mono for small UI. The chapter labels in the garden use the
  italic serif.
- Desktop only: a trail of gold dust and the odd petal follows the cursor. It is off on touch
  and with reduced motion.

## Privacy: read this before sharing the link

- **A public URL is not private.** `noindex` (the meta tags, `robots.txt` and the
  `X-Robots-Tag` header) asks search engines not to list the site. It does not stop anyone
  who has the link.
- **Client‑side encryption protects the content, not the page.** Photos, the letter and
  your final message are encrypted with AES‑GCM, using a key derived from the passphrase by
  PBKDF2‑SHA256 (600,000 iterations). Anyone can load the page shell and the encrypted
  files, but they can't read them without the passphrase. The protection is exactly as
  strong as the passphrase, so use several words, not a PIN.
- The passphrase is never stored in the repo or in environment variables. After she
  unlocks, it is kept for that browser tab only (`sessionStorage`).
- For real access control, turn on **Vercel Deployment Protection** (password or Vercel
  auth) for the project, or share the link only with her.
- **The microphone** is only requested after she taps "or use the microphone". Sound is
  measured locally to detect a breath, and never recorded or uploaded. It is released as
  soon as the candles are out.
- Her message to future us, her date picks, the found hearts and the lantern stars are
  stored **only in her browser** (`localStorage`). Nothing she writes is sent anywhere.

## Photos and media pipeline

`npm run vault` now prepares every photo before encrypting it:

- auto‑orients from EXIF, then **strips all metadata** (GPS, camera, timestamps);
- resizes to 480, 768, 1080 and 1440 px on the long edge (never enlarged) and re‑encodes
  as WebP;
- encrypts every size separately. The site fetches only the size that suits her screen.

Video and audio are encrypted as they are. Export them small yourself (1080p or less, under
about 20 MB each).

## Sound and licensing

The music is generated live in the browser: a music box improvising over an ordinary D‑major
chord loop, a soft pad and a small room. It is original, uses no audio files and no existing
melody, and is off by default. If she turns it on, that choice is remembered for the session
and it resumes on her next tap. Songs in the Music Room chapter show your own notes about them,
never lyrics. Add song audio only for files you have the right to use.

## Build, check, deploy

```bash
npm install
cp -r birthday-private.example birthday-private     # once; the folder is git-ignored
# fill in birthday-private/content.json and add media to birthday-private/media/
npm run vault -- --pass "a passphrase only she would know" --hint "an optional hint"
npm run build && npx vite preview --port 4173
RECREATION_URL=http://localhost:4173/ node qa/bdplay.mjs 1280 800   # every chapter, hearts, ending
RECREATION_URL=http://localhost:4173/ node qa/sweep.mjs 390 844     # the journey, routes, 404
```

Commit `public/vault/` (encrypted only), push, and Vercel deploys. Never commit
`birthday-private/`.

## QA

Last full run, on the local build and then on the live site:

| Check | Result |
|---|---|
| `bdplay` 1280×800 and 390×844 | 14/14 chapters done, 14/14 hidden hearts, secret ending, 0 console errors |
| `sweep` 1280×800 and 390×844 (local); 1280×800 (live) | every section reached; `/garden`, `/garden/<chapter>`, `/for-you`, `/`, old `/work…` and `/contact` links all arrive; unknown path shows the 404; 0 errors |
| `workreverse` | forward and reverse scroll match (spread 0) |
| `cake` | cage opens; hold to blow; darkness, then petals; the microphone is never requested without a tap; 0 errors |
| `lanterns` | a real tap releases a wish; its words show; it becomes a star and is remembered |
| `finale` 1280×800, 390×844, 844×390 | stars → 25 · 11 → DHEEPIKA, Happy birthday, final words, One last thing; 0 errors |
| `opening` 360×800, 375×812, 412×915, 430×932, 844×390 | title *For Dheepika · 25 · 11*, no studio remnants, 0 errors |
| `keepsakes` | the PNG card and the letter PDF are valid files (PDF cross‑references checked); the music toggles |
| `manor` 1280×800 and 390×844 (local and live) | renders, 0 errors |
| Live headers | `X-Robots-Tag: noindex, nofollow, noarchive`, `Referrer-Policy: no-referrer`; `/vault/meta.json` served as JSON (no 404) |

`qa/chapter.mjs <slug> [w h]` opens one chapter and walks through its scene, capturing each
step (`STILL=1` checks the final framing with reduced motion). Other targeted checks: `qa/opening.mjs` (loader, opening, threshold, leftover-text scan),
`qa/cake.mjs` (cage, candles, blowing, darkness, burst, microphone never requested unasked),
`qa/lanterns.mjs` (a real tap on a lantern, its words, the star, persistence),
`qa/finale.mjs` (every stage of the finale sky and One last thing), and `qa/keepsakes.mjs`
(the PNG and PDF downloads are valid; the music toggles).

## Performance

- Scenes that are off screen skip their per‑frame CPU work: the garden's 25 tulips, the cake, and
  the emblem.
- The garden isn't drawn before it starts to grow or after it dissolves into the lab. Measured with
  `qa/perf.mjs` (medium tier, 1280×800): the threshold went from 83k to 30k triangles, the lab from
  158k to 110k, and the lantern sky from 50k to 15k.
- Desktop pixel ratio is capped at 1.5×. The automatic quality governor still steps down on
  slower devices.
- The last studio typeface was removed (28 KB less to download). Fonts are the serif, the
  handwriting face and the small mono.

## Known limits

- Encryption can't hide that a site exists at the URL; see Privacy above.
- The finale's constellation is sampled from the name and date in the content. A very long
  name makes the stars denser, not wider.
- Memories open in their chapters. They don't float out of the tulips as photos in 3D.
- The lantern stars and the other progress live in her browser. On a new device, the sky
  starts fresh.

---

## PERSONAL CONTENT CHECKLIST

**Written for you (read it, then edit anything that doesn't sound like you):** the opening,
threshold, letter, 14 reasons, name letters, quiz, the secret clues (answered from the garden
itself: 2 · 5 · heart · 11 · 1), song notes, timeline texts, the three gifts, the future
wishes, 24 wishes, 12 lantern wishes, final words, the last message and the secret ending.
All of it is in `src/content/dheepika.ts`, with a copy in `birthday-private.example/content.json`.
None of it claims a specific memory, date, place, nickname or promise that you didn't give me.

**Only you can add these (still marked with [brackets]):**
- [ ] `signature`: your name, as you sign it (it's "Always yours" until you change it)
- [ ] Photos for `memories[]` (8), with a real `date` and `place` for each; and the `puzzle` photo
- [ ] `timeline[]` dates for *We Met*, *Getting Closer* and *Us*, and change the texts if your story differs
- [ ] `songs[]`: the real titles and artists (the notes are written; never paste lyrics; add `audio` only if you own the rights)
- [ ] `movie.clips[]`: short videos you own
- [ ] `finale.voice`: your voice note (an audio file in `media/`)
- [ ] Optional: make the quiz answers truly yours (the `answer` index and the reactions)
- [ ] Optional: `birthday.timezone`, only if you turn on the countdown

**Before you share**
- [ ] Choose a passphrase of several words, and a hint that doesn't give it away
- [ ] `npm run vault -- --pass "…" --hint "…"`, then build, then open `/garden/the-beginning` and unlock once
- [ ] Run `qa/bdplay.mjs` at desktop and phone sizes
- [ ] Optional: turn on Vercel Deployment Protection, and add a custom domain
- [ ] Share the link with her privately
