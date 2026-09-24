# For Dheepika — how to fill in the Work chapters

The Work helix now carries 14 birthday chapters, one per card, in order. Everything outside
Work (intro, headline, lab, tunnel, ending) is unchanged.

| # | Chapter | What she does | Extras folded in |
|---|---|---|---|
| 1 | 25 · 11 | wakes one star → date → your line | |
| 2 | Memory Universe | opens floating photos (caption, date, place) | Polaroid camera, photo puzzle |
| 3 | The Letter | opens a sealed envelope; the letter writes itself | |
| 4 | 14 Things | touches 14 stars, one reason each | Constellation of Her (a memory per letter) |
| 5 | Catch My Heart | catches 14 hearts, dodges clouds (skippable) | |
| 6 | Know Us? | quiz with gentle reactions | This‑or‑That → "our next date" card |
| 7 | Our Secret | answers clues → symbols of a code | scratch‑to‑reveal |
| 8 | Music Room | picks songs on a record player; your note for each | |
| 9 | Our Timeline | Before Us → … → What Comes Next | the Empty Frame |
| 10 | Choose a Gift | opens one of three boxes | |
| 11 | Make a Wish | holds (or blows into the mic) to put out the candle | |
| 12 | Future Universe | opens possibility orbs | 365 Wishes sphere |
| 13 | Our Little Movie | a montage, then fade to black | |
| 14 | For Dheepika | Door 25: opens after chapters 1–13 → finale | Voice From Me, hidden hearts → secret ending |

A small hidden heart sits in every chapter. Finding all 14 adds the secret ending to the
finale. Progress (chapters opened, hearts, gift choice, This‑or‑That picks) stays in her
browser only.

## Filling it in

Nothing personal is ever committed.

1. Copy the template: `cp -r birthday-private.example birthday-private`. The
   `birthday-private/` folder is git‑ignored.
2. Edit `birthday-private/content.json`:
   - Replace every `[bracketed]` placeholder with your own words.
   - Lines without brackets are the ones you wrote in the brief; change them freely.
   - `reasons` needs exactly 14 entries, and `nameLetters` one entry per letter of her name.
   - For quiz questions, `answer` is the index of your answer, or `null` when any answer is
     lovely. Keep both reactions kind.
   - Secret clue answers are matched ignoring case, spaces and punctuation. List every
     spelling you'd accept.
   - For songs, write your note about what the song means to you. Don't paste lyrics. Add
     `audio` only for files you have the right to use.
3. Put photos, videos and audio in `birthday-private/media/` and reference them as
   `{ "src": "media/file.jpg", "type": "image", "alt": "…" }` (`type` is `image`, `video` or
   `audio`). Compress large videos first; each file is loaded when its chapter needs it.
4. Encrypt: `npm run vault -- --pass "a passphrase only she would know" --hint "an optional hint"`
5. `npm run build`, then commit `public/vault/` and deploy as usual.

## How the protection works

- `public/vault/` holds only AES‑GCM‑encrypted files. The key is derived from the
  passphrase with PBKDF2‑SHA256 at 600,000 iterations. Without the passphrase, the photos,
  the letter and your final message are unreadable, even though the site and repo are
  public.
- It is exactly as strong as the passphrase. Use a phrase (several words), not a short PIN.
  A hint is shown on the gate, so don't make the hint give it away.
- After she unlocks, the passphrase is remembered for that browser tab only
  (`sessionStorage`). Closing the tab forgets it.
- Keep the GitHub repo private anyway, as you chose. It hides even the encrypted files and
  the placeholder structure.
- Re‑running `npm run vault` replaces the whole vault. Deleting `public/vault/` returns the
  site to placeholder preview mode.

## Checking it

- `npm run build && npx vite preview`, then open `/garden/the-beginning`.
- Without a vault the footer shows "Preview — placeholder content". With a vault the
  passcode gate appears first.
- `RECREATION_URL=http://localhost:4173/ node qa/bdtour.mjs 1280 800` (or `390 844`)
  screenshots every chapter to `qa/out/`.

## The cake in the lab

After Work, the lab's cage now holds a 3D birthday cake. It's procedural, in
`src/scenes/BirthdayCake.ts`: a gold stand, three rose tiers, berry glaze drips, pearls,
berries, spiral candles and a gold heart topper.

When she touches the cage or the cake, or presses **Open the cage**:
1. The padlock pops.
2. The bars and cables slide up into the housing.
3. The cake rises and comes forward, turning.
4. The candles light one by one and sparkles burst.

The unlock sequence lives in `Lab.update()`. Check it with `node qa/cake.mjs 1280 800`.

## The tulip garden (Work)

The old central column is gone. In its place stands a living tulip garden, built
procedurally in `src/scenes/TulipGarden.ts`. It takes over the column's role in the
same world: the measured camera still orbits and descends around it, and scrolling feels
exactly as before.

- **25 significant blooms, for 25 · 11:**
  - 14 chapter tulips standing where the chapters are, each with its name glowing beneath
    it. Tap a tulip to open its chapter.
  - 11 blooms along a central stem that weaves left, centre and right through depth.
  - The last chapter tulip is the largest and stays closed until the end.
- **Scroll means blooming:**
  - Every flower starts as a closed bud and opens petal by petal as the camera arrives. It
    closes again if she scrolls back.
  - At the entry the garden grows up from the bottom. At the exit everything dissolves
    except the final tulip.
- **Light:** it shifts from midnight blue at the top to sunset amber at the bottom.
- **Also in the garden:** buds, arching stems out to every chapter, leaves, a translucent
  silk ribbon, drifting petals and gold light.
- **Make a Wish:** when the candle goes out, the veil steps aside and a light climbs the
  whole plant. Chapters she has already opened glow a little brighter.
- **Finale:** after "HAPPY BIRTHDAY, DHEEPIKA." the camera pulls far back to show the whole
  garden at once, every flower open.

Check it with:
- `node qa/garden.mjs 1280 800` (frames through the garden);
- `node qa/moments.mjs 1280 800` (the wish and the finale reveal).

The old column (`WorkSpine.ts`) remains in git history if you ever need to roll back.

### Chapters that grow out of the garden

- **Opening a tulip:** the chapter unfolds out of that flower, as a circle of light growing
  from the tulip's place on screen with a warm burst. Closing folds it back into the flower.
- **Catch My Heart:** petals escape the flower and she catches them. Golden petals count
  double; clouds steal one. At the end: "You caught them all." Then: "But you already
  caught my heart."
- **The Letter:** a sealed letter with an **Open my letter** button.
- **Our Secret:** every correct clue sends a small golden light up the stem.
- **Make a Wish:** while she holds the button, the wish tulip gathers golden light. When the
  candle goes out, the light climbs the whole plant.
- **Finale:** the text arrives in order: 25 · 11, a pause, DHEEPIKA, a pause,
  HAPPY BIRTHDAY. Then the camera pulls back to show the whole garden in bloom.
- **Phones and low-end devices:** the garden uses lighter petals, stems, leaves and ribbon
  (fewer triangles, same shape) and fewer drifting petals.
