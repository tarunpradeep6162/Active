/**
 * Keepsakes she can save — drawn locally on a canvas, never uploaded:
 *  - the letter as a PDF (warm paper, serif, handwritten signature, 25 · 11)
 *  - "Our next date" and "A message to future us" as PNG cards
 * The PDF is assembled here from page images (one JPEG per page) — no external library.
 */
import type { BirthdayContent } from './types';
import { SERIF } from '../utils/fonts';

const HAND = "'Caveat', 'Segoe Script', cursive";
const MONO = "'Share Tech Mono', ui-monospace, monospace";

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Word‑wraps text to a width; returns the lines. */
function wrap(g: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      const t = line ? `${line} ${w}` : w;
      if (g.measureText(t).width > width && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** A small hand‑drawn tulip, used as the keepsakes' only ornament. */
function tulip(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = color;
  g.lineWidth = 2.2 / s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 40);
  g.bezierCurveTo(-4, 20, 2, 8, 0, -2);
  g.moveTo(0, 26);
  g.bezierCurveTo(-14, 18, -18, 10, -20, 2);
  g.moveTo(-14, -6);
  g.bezierCurveTo(-16, -22, -8, -30, 0, -34);
  g.bezierCurveTo(8, -30, 16, -22, 14, -6);
  g.bezierCurveTo(8, 0, -8, 0, -14, -6);
  g.moveTo(0, -34);
  g.bezierCurveTo(-4, -22, -4, -10, 0, -2);
  g.stroke();
  g.restore();
}

function card(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#070914');
  bg.addColorStop(0.6, '#11162a');
  bg.addColorStop(1, '#2a1622');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // a few quiet stars
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(248, 241, 232, ${0.15 + Math.random() * 0.5})`;
    g.fillRect(Math.random() * w, Math.random() * h * 0.7, 1.6, 1.6);
  }
  return { c, g };
}

/** "Our next date": her This‑or‑That picks as a card. */
export function saveNextDateCard(picks: string[]) {
  const W = 1080, H = 1350;
  const { c, g } = card(W, H);
  g.textAlign = 'center';
  g.fillStyle = '#e6c989';
  g.font = `28px ${MONO}`;
  g.fillText('O U R   N E X T   D A T E', W / 2, 200);
  tulip(g, W / 2, 320, 2.2, '#e8a6b5');
  g.fillStyle = '#f8f1e8';
  g.font = `500 74px ${SERIF}`;
  picks.slice(0, 7).forEach((p, i) => g.fillText(p, W / 2, 520 + i * 104));
  g.fillStyle = '#e8a6b5';
  g.font = `28px ${MONO}`;
  g.fillText('25 · 11', W / 2, H - 110);
  c.toBlob((b) => b && download(b, 'our-next-date.png'), 'image/png');
}

/** "A message to future us" as a card. */
export function saveFutureCard(message: string) {
  const W = 1080, H = 1350;
  const { c, g } = card(W, H);
  g.textAlign = 'center';
  g.fillStyle = '#e6c989';
  g.font = `28px ${MONO}`;
  g.fillText('T O   F U T U R E   U S', W / 2, 190);
  tulip(g, W / 2, 300, 1.8, '#e8a6b5');
  g.fillStyle = '#f8f1e8';
  g.font = `italic 500 52px ${SERIF}`;
  const lines = wrap(g, message.trim() || '…', W - 220).slice(0, 14);
  lines.forEach((l, i) => g.fillText(l, W / 2, 470 + i * 66));
  g.fillStyle = '#e8a6b5';
  g.font = `28px ${MONO}`;
  g.fillText(`WRITTEN ${new Date().toLocaleDateString()}`, W / 2, H - 110);
  c.toBlob((b) => b && download(b, 'to-future-us.png'), 'image/png');
}

/** The letter as an A4 PDF (paginated). */
export async function saveLetterPdf(c: BirthdayContent) {
  const W = 1240, H = 1754; // A4 at 150 dpi
  const margin = 150;
  const pages: HTMLCanvasElement[] = [];
  const newPage = () => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    const paper = g.createLinearGradient(0, 0, W, H);
    paper.addColorStop(0, '#fbf4ea');
    paper.addColorStop(1, '#f3e6d6');
    g.fillStyle = paper;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(214, 180, 106, .5)';
    g.lineWidth = 2;
    g.strokeRect(60, 60, W - 120, H - 120);
    tulip(g, W - 150, H - 170, 1.4, 'rgba(217, 139, 157, .7)');
    g.fillStyle = '#9a6a3a';
    g.font = `24px ${MONO}`;
    g.textAlign = 'left';
    g.fillText('25 · 11', margin, H - 110);
    pages.push(cv);
    return g;
  };
  let g = newPage();
  let y = 250;
  g.fillStyle = '#3a2226';
  g.textAlign = 'left';
  g.font = `italic 500 56px ${SERIF}`;
  g.fillText(c.letter.greeting, margin, y);
  y += 110;
  g.font = `500 40px ${SERIF}`;
  for (const para of c.letter.paragraphs) {
    for (const line of wrap(g, para, W - margin * 2)) {
      if (y > H - 260) {
        g = newPage();
        g.fillStyle = '#3a2226';
        g.font = `500 40px ${SERIF}`;
        y = 220;
      }
      g.fillText(line, margin, y);
      y += 58;
    }
    y += 34;
  }
  if (y > H - 360) {
    g = newPage();
    y = 260;
  }
  g.fillStyle = '#3a2226';
  g.font = `italic 500 42px ${SERIF}`;
  g.fillText(c.letter.signoff, margin, y + 30);
  g.fillStyle = '#8a1c38';
  if (c.signatureInk) {
    // your real signature, in ink
    const ink = c.signatureInk, h = 110, k = h / ink.h;
    g.save();
    g.translate(margin, y + 60);
    g.scale(k, k);
    g.strokeStyle = '#8a1c38';
    g.lineWidth = 3 / k;
    g.lineCap = g.lineJoin = 'round';
    for (const d of ink.strokes) g.stroke(new Path2D(d));
    g.restore();
  } else {
    g.font = `72px ${HAND}`;
    g.fillText(c.signature, margin, y + 120);
  }

  const jpegs = await Promise.all(pages.map((p) => new Promise<Uint8Array>((res) => p.toBlob(async (b) => res(new Uint8Array(await b!.arrayBuffer())), 'image/jpeg', 0.9))));
  download(new Blob([pdfFromJpegs(jpegs, W, H)], { type: 'application/pdf' }), 'a-letter-for-dheepika.pdf');
}

/** Minimal PDF: one full‑page JPEG image per page (A4 points). */
function pdfFromJpegs(jpegs: Uint8Array[], pxW: number, pxH: number): ArrayBuffer {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (x: string | Uint8Array) => {
    const b = typeof x === 'string' ? enc.encode(x) : x;
    parts.push(b);
    length += b.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body();
    push('\nendobj\n');
  };
  const PW = 595.28, PH = 841.89;
  const n = jpegs.length;
  const pageIds = jpegs.map((_, i) => 3 + i * 3);
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${n} >>`));
  jpegs.forEach((jpg, i) => {
    const pid = pageIds[i], img = pid + 1, cnt = pid + 2;
    obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${cnt} 0 R >>`));
    obj(img, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
      push(jpg);
      push('\nendstream');
    });
    const draw = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(cnt, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
  });
  const xref = length;
  const total = 3 + n * 3;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(length);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out.buffer;
}

/**
 * A poster of her night (2400 × 3200, PNG): her name in the stars over the lake at dawn, the
 * constellation she drew, the wishes she let go, the date, and your signature. Made from what
 * she did, drawn locally.
 */
export function savePoster(c: BirthdayContent, mine: { stars: [number, number][][]; wishes: string[] }) {
  const W = 2400, H = 3200;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  // night into dawn, a far shore and the lake
  const sky = g.createLinearGradient(0, 0, 0, H * 0.68);
  sky.addColorStop(0, '#05060f');
  sky.addColorStop(0.55, '#1b1433');
  sky.addColorStop(0.85, '#6b3550');
  sky.addColorStop(1, '#e79a6a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H * 0.68);
  const lake = g.createLinearGradient(0, H * 0.68, 0, H);
  lake.addColorStop(0, '#6d3a4c');
  lake.addColorStop(1, '#0a0812');
  g.fillStyle = lake;
  g.fillRect(0, H * 0.68, W, H * 0.32);
  // the sun just rising, and its path on the water
  const sun = g.createRadialGradient(W / 2, H * 0.68, 0, W / 2, H * 0.68, 520);
  sun.addColorStop(0, 'rgba(255, 236, 200, .95)');
  sun.addColorStop(0.12, 'rgba(255, 190, 120, .55)');
  sun.addColorStop(1, 'rgba(255, 150, 90, 0)');
  g.fillStyle = sun;
  g.fillRect(0, H * 0.4, W, H * 0.5);
  for (let i = 0; i < 70; i++) {
    const y = H * 0.69 + i * 13, w = 260 * (1 - i / 80) * (0.6 + Math.random() * 0.6);
    g.fillStyle = `rgba(255, 200, 140, ${0.35 * (1 - i / 70)})`;
    g.fillRect(W / 2 - w / 2 + (Math.random() - 0.5) * 40, y, w, 3);
  }
  // the shore: soft hills and pines
  g.fillStyle = '#1a0f1c';
  g.beginPath();
  g.moveTo(0, H * 0.68);
  for (let x = 0; x <= W; x += 24) g.lineTo(x, H * 0.68 - 40 - Math.sin(x / 260) * 24 - Math.sin(x / 90) * 8 - (Math.random() < 0.25 ? 26 : 0));
  g.lineTo(W, H * 0.68);
  g.fill();
  // stars, thinning toward the dawn
  for (let i = 0; i < 900; i++) {
    const y = Math.random() ** 1.6 * H * 0.6;
    g.fillStyle = `rgba(255, 246, 230, ${(0.2 + Math.random() * 0.7) * (1 - y / (H * 0.62))})`;
    const r = Math.random() < 0.05 ? 3 : 1.6;
    g.fillRect(Math.random() * W, y, r, r);
  }
  // her constellation, drawn where she drew it
  const glowDot = (x: number, y: number, r: number) => {
    const d = g.createRadialGradient(x, y, 0, x, y, r * 3);
    d.addColorStop(0, 'rgba(255, 248, 230, 1)');
    d.addColorStop(0.3, 'rgba(255, 214, 150, .7)');
    d.addColorStop(1, 'rgba(255, 190, 120, 0)');
    g.fillStyle = d;
    g.beginPath();
    g.arc(x, y, r * 3, 0, Math.PI * 2);
    g.fill();
  };
  for (const s of mine.stars) {
    g.strokeStyle = 'rgba(243, 223, 167, .35)';
    g.lineWidth = 3;
    g.beginPath();
    s.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H * 0.62) : g.moveTo(x * W, y * H * 0.62)));
    g.stroke();
    s.forEach(([x, y]) => glowDot(x * W, y * H * 0.62, 9));
  }
  // her name, as stars
  g.textAlign = 'center';
  g.fillStyle = '#f3dfa7';
  g.font = `italic 400 120px ${SERIF}`;
  g.fillText('Happy birthday', W / 2, 980);
  g.font = `500 300px ${SERIF}`;
  const name = c.name.toUpperCase().split('').join(' ');
  g.shadowColor = 'rgba(255, 220, 170, .9)';
  g.shadowBlur = 60;
  g.fillStyle = '#fff6e6';
  g.fillText(name, W / 2, 1320);
  g.shadowBlur = 0;
  g.fillStyle = '#e8a6b5';
  g.font = `44px ${MONO}`;
  g.fillText(c.date.split('').join(' '), W / 2, 1450);
  // the wishes she let go, over the water
  if (mine.wishes.length) {
    g.fillStyle = 'rgba(243, 223, 167, .8)';
    g.font = `36px ${MONO}`;
    g.fillText('T H E   W I S H E S   Y O U   L E T   G O', W / 2, H * 0.76);
    g.fillStyle = '#f8f1e8';
    g.font = `italic 400 66px ${SERIF}`;
    mine.wishes.slice(0, 5).forEach((w, i) => g.fillText(w, W / 2, H * 0.76 + 110 + i * 92));
  }
  // your signature
  const sy = H - 230;
  if (c.signatureInk) {
    const ink = c.signatureInk, h = 150, k = h / ink.h;
    g.save();
    g.translate(W / 2 - (ink.w * k) / 2, sy - 110);
    g.scale(k, k);
    g.strokeStyle = '#f3dfa7';
    g.lineWidth = 3.2 / k;
    g.lineCap = g.lineJoin = 'round';
    for (const d of ink.strokes) g.stroke(new Path2D(d));
    g.restore();
  } else {
    g.fillStyle = '#f3dfa7';
    g.font = `110px ${HAND}`;
    g.fillText(c.signature, W / 2, sy);
  }
  cv.toBlob((b) => b && download(b, `${c.name.toLowerCase()}-her-night.png`), 'image/png');
}
