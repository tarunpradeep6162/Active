// QA: the signing page (draw a signature, preview it on this device), then the letter draws it
// and the letter PDF carries it. Usage: RECREATION_URL=… node qa/signature.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/signature', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'sign', wait: false });
await page.waitForSelector('.signpad__canvas');
const b = await page.locator('.signpad__canvas').boundingBox();
// a looping signature in three strokes
const stroke = async (pts) => { await page.mouse.move(b.x + pts[0][0], b.y + pts[0][1]); await page.mouse.down(); for (const [x, y] of pts.slice(1)) await page.mouse.move(b.x + x, b.y + y, { steps: 3 }); await page.mouse.up(); };
const wave = (x0, y0, n, amp) => Array.from({ length: n }, (_, i) => [x0 + i * 9, y0 + Math.sin(i * 0.7) * amp - (i % 7 === 0 ? 18 : 0)]);
await stroke(wave(60, 150, 40, 30));
await stroke(wave(430, 140, 16, 22));
await stroke([[70, 200], [240, 190], [420, 205], [560, 185]]);
await page.waitForTimeout(400);
await page.click('text=Preview on this device');
await page.waitForTimeout(2500);
await page.screenshot({ path: `qa/out/signature/${W}-1-pad.png` });
const code = await page.evaluate(() => document.querySelector('.signpad__code')?.value);
const stored = await page.evaluate(() => localStorage.getItem('bday-signature-preview'));
// now the letter, on the same device
await page.goto(page.url().replace(/\?.*$/, '') + '?qa=1&tier=low');
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
await page.evaluate(() => { history.pushState({}, '', '/garden/the-letter'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForSelector('.bd-letter__open', { timeout: 120000 });
await page.evaluate(() => document.querySelector('.bd-letter__open').click());
await page.waitForSelector('.bd-paper__signature', { timeout: 180000 });
await page.evaluate(() => document.querySelector('.bd-paper__signature').scrollIntoView({ block: 'center' }));
await page.waitForTimeout(5000);
await page.screenshot({ path: `qa/out/signature/${W}-2-letter.png` });
const inLetter = await page.evaluate(() => ({ paths: document.querySelectorAll('.bd-paper__signature path').length, drawing: document.querySelector('.bd-paper__signature')?.classList.contains('is-drawing') }));
console.log(JSON.stringify({ W, codeChars: code?.length, stored: !!stored, strokes: stored ? JSON.parse(stored).strokes.length : 0, inLetter, errors: logs.filter((l) => /error/i.test(l)).slice(0, 3) }));
await browser.close();
