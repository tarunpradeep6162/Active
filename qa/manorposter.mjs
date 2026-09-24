// Renders the manor backdrop stills (shown instantly, before the live scene is ready).
// Usage: RECREATION_URL=http://localhost:4173/ node qa/manorposter.mjs <w> <h> <out.jpg>
import sharp from 'sharp';
import { openSite } from './browser.mjs';
const [w, h, out] = [+process.argv[2], +process.argv[3], process.argv[4]];
const { browser, page } = await openSite('recreation', { width: w, height: h, mobile: w < 600, query: 'qa=1&tier=high' });
await page.evaluate(() => { history.pushState({}, '', '/garden/future-universe'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForSelector('.bd-manorbg.is-live', { timeout: 300000 });
await page.addStyleTag({ content: '.bd-chapter__head,.bd-chapter__foot,.bd-manor__caption,.bd-orbs,.bd-sphere,.bd-future__wish,.bd-heart,.nav,.ticker,.audio-toggle,.skip-link{visibility:hidden!important}.bd-manorbg::after{display:none!important}.bd-chapter::before{display:none}' });
await page.waitForTimeout(+process.env.SETTLE || 35000);
const png = await page.screenshot();
await sharp(png).jpeg({ quality: 80, mozjpeg: true }).toFile(out);
console.log(out, (await sharp(out).metadata()).width);
await browser.close();
