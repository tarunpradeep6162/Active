# QA

Playwright scripts that drive the real site in headless Chromium (software WebGL) and save
screenshots to `qa/out/` (git‑ignored). Build and serve first, then point them at it:

```bash
npm run build && npx vite preview --port 4173 &
export RECREATION_URL=http://localhost:4173/     # omit to test the live site
```

| Script | Checks |
|---|---|
| `bdplay.mjs [w h]` | **the main one**: plays all 14 chapters through the real UI, finds every hidden heart, opens Door 25, runs the finale; fails on any console error |
| `sweep.mjs [w h]` | scrolls the whole journey down and back up, then every route and the 404 |
| `chapter.mjs <slug> [w h]` | one chapter's 3D scene step by step (`STILL=1` for final framing, `DONE=all` to unlock Door 25) |
| `opening.mjs`, `journey.mjs <section>`, `garden.mjs` | loader, opening, threshold and garden frames |
| `cake.mjs`, `lanterns.mjs`, `finale.mjs` | the cake (and that the microphone is never asked for unprompted), a real lantern tap, the finale sky |
| `gift.mjs`, `foryou.mjs`, `keepsakes.mjs` | the gift boxes; the For you page; that the PNG card and letter PDF are valid files |
| `manor.mjs`, `manorposter.mjs` | the manor scene; regenerates its poster stills |
| `perf.mjs` | draw calls, triangles and frame time per section (compare runs, don't trust the ms) |
| `workreverse.mjs` | scroll determinism: forward and reverse must match |
| `validate.mjs` | context loss and restore, 50 route cycles, tiers, history |
| `vaultcheck.mjs`, `privatepeek.mjs` | with a vault: wrong passphrase rejected, right one decrypts (local only) |
| `beginning.mjs`, `memories.mjs`, `letter.mjs`, `reasons.mjs`, `unfold.mjs`, `moments.mjs`, `emblem.mjs`, `bdtour.mjs`, `sheet.mjs` | older focused captures and helpers |

`browser.mjs` is the shared launcher (software GL flags, a cache for remote assets).
