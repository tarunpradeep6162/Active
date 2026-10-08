// Renders the home-screen icons (public/icons) from one SVG: the rose heart holding a golden D on
// the night sky, with a few stars. Usage: node scripts/icons.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const svg = (pad) => {
  // pad: share of the icon kept clear around the emblem (maskable icons need ~20%)
  const s = 512, k = 1 - pad * 2, o = (s * pad);
  const stars = [[80, 96, 2.2], [420, 70, 1.8], [450, 180, 1.4], [60, 300, 1.6], [130, 440, 1.3], [400, 430, 2], [250, 52, 1.2], [470, 330, 1.2]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff4d6" opacity=".75"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="sky" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#241a3c"/><stop offset=".55" stop-color="#11162a"/><stop offset="1" stop-color="#070914"/></radialGradient>
    <linearGradient id="rose" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6c3cf"/><stop offset="1" stop-color="#d98b9d"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c4"/><stop offset="1" stop-color="#d6b46a"/></linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#sky)"/>
  ${stars}
  <g transform="translate(${o} ${o}) scale(${k})" filter="url(#glow)">
    <path d="M256 418 C146 340 88 276 88 206 C88 158 125 122 170 122 C205 122 237 145 256 177 C275 145 307 122 342 122 C387 122 424 158 424 206 C424 276 366 340 256 418 Z" fill="none" stroke="url(#rose)" stroke-width="22" stroke-linejoin="round"/>
    <path d="M211 196 h37 a57 57 0 0 1 0 114 h-37 z" fill="none" stroke="url(#gold)" stroke-width="20" stroke-linejoin="round"/>
  </g>
</svg>`;
};

fs.mkdirSync('public/icons', { recursive: true });
const out = [
  ['icon-192.png', 192, 0.06],
  ['icon-512.png', 512, 0.06],
  ['maskable-512.png', 512, 0.2],
  ['apple-touch-icon.png', 180, 0.1],
];
for (const [name, size, pad] of out) await sharp(Buffer.from(svg(pad))).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icons/${name}`);
console.log('icons written');
