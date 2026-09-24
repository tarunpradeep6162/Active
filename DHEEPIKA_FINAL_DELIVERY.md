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
| 1 | **Opening**: stars; *25 · 11*; "Some dates are just dates. / But one changed my world."; a shooting star she can make a wish on; her name; **Enter our garden** | `IntroHint`, the heart + D emblem in `src/scenes/Emblem.ts` |
| 2 | **Threshold**: "A garden made of memories" | `Manifesto` |
| 3 | **The tulip garden**: 25 tulips open as she scrolls, and 14 of them hold the chapters. Fireflies and a few butterflies. Each chapter unfolds out of its tulip. | `src/scenes/TulipGarden.ts`, `src/birthday/ui/*` |
| 4 | **The cake in the cage**: touch the lock; the bars rise and the cake comes forward with its candles lit. **Blow out the candles**: hold the button (or, only if she taps for it, use the microphone). The flames lean and go out, there is a moment of darkness, then gold dust and petals. The candles relight for another wish. | `src/scenes/Lab.ts`, `src/scenes/BirthdayCake.ts`, `LabLabel` |
| 5 | **The lantern sky**: a night of rising paper lanterns. Twelve hover close; touching one lets its wish go. Its words rise, and it climbs into a star that stays in her sky. | `src/scenes/LanternSky.ts`, `LanternSkyLabel` |
| 6 | **The finale**: the stars gather into *25 · 11*, then into **DHEEPIKA**. *Happy birthday* above, *25 · November* below, gentle rose and champagne fireworks, a sunrise from the horizon, the final words one at a time, then **One last thing**: your voice note and last message. | `src/scenes/Constellation.ts`, `FinaleSky` |
| + | **For you** (top‑right menu): a message to future us (kept on her device), *Our next date* as an image, the letter as a PDF | `Contact` → For you, `src/birthday/keepsakes.ts` |
| + | **Sound** (off by default): an original generative music box with chimes at the big moments | `src/audio/AudioEngine.ts` |
| + | **404**: "Looks like this path wandered out of the garden." / Return to our garden | `NotFound` |
| + | **No WebGL**: a quiet page version of the same story (opening, memories, letter, final words) | `src/birthday/ui/FallbackStory.tsx` |

Routes: `/` (the journey), `/garden` and `/garden/<chapter>`, and `/for-you`. The old `/work…` and
`/contact` links still resolve, so nothing breaks.

## Cinematic language

- **Act cards**: each world opens with a quiet title, like a film's act break: *I · Our Garden*,
  *II · Something Sweet*, *III · A Sky of Wishes*, *IV · Your Stars*.
- **Grade**: plum in the shadows and champagne in the highlights, a soft oval vignette, and gentle
  bloom. The old film grain is gone; only a faint dither remains to stop dark gradients from
  banding.
- **Letterbox**: bars slide in for the two big moments, the cake leaving its cage and her name
  forming in the stars.
- **Camera**: the lantern sky is framed level, and the finale drifts wide while the stars wander,
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

<!-- QA-RESULTS -->

Other targeted checks: `qa/opening.mjs` (loader, opening, threshold, leftover-text scan),
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
