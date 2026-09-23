#!/usr/bin/env node
// Encrypts the private birthday content into public/vault/ so the public site can carry it.
//
//   birthday-private/content.json   (git‑ignored) — same shape as src/birthday/placeholder.ts;
//                                    media fields use { "src": "media/our-first-photo.jpg", "type": "image" }
//   birthday-private/media/…        (git‑ignored) — photos, videos, audio
//
// Usage:  npm run vault -- --pass "our secret words" [--hint "where we first met"]
//
// Output: public/vault/meta.json (salt, iterations, a check value, the optional hint — none of
// it secret), content.bin and one <random id>.bin per media file. Every media path in the JSON
// is rewritten to "vault:<id>". Without the passcode the .bin files are unreadable; the
// protection is exactly as strong as the passcode, so use a phrase, not a 4‑digit PIN.
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const pass = arg('--pass');
const hint = arg('--hint') ?? '';
if (!pass || pass.trim().length < 6) {
  console.error('Usage: npm run vault -- --pass "a passphrase of at least 6 characters" [--hint "…"]');
  process.exit(1);
}
const SRC = path.resolve('birthday-private');
const OUT = path.resolve('public/vault');
const contentPath = path.join(SRC, 'content.json');
if (!fs.existsSync(contentPath)) {
  console.error(`Missing ${path.relative(process.cwd(), contentPath)} — copy birthday-private.example/ to birthday-private/ and fill it in.`);
  process.exit(1);
}

const ITER = 600_000;
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey('raw', enc.encode(pass.normalize('NFC').trim()), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const seal = async (bytes) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
};
const b64 = (u8) => Buffer.from(u8).toString('base64');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

// fresh output: never leave stale encrypted files from an older passcode around
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
let files = 0;
async function walk(node) {
  if (Array.isArray(node)) { for (const x of node) await walk(x); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.src === 'string' && typeof node.type === 'string' && !node.src.startsWith('vault:') && !/^https?:/.test(node.src)) {
    const file = path.join(SRC, node.src);
    if (!fs.existsSync(file)) throw new Error(`Media not found: ${node.src}`);
    const mime = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    const body = fs.readFileSync(file);
    const payload = new Uint8Array(mime.length + 1 + body.length);
    payload.set(enc.encode(mime));
    payload[mime.length] = 0;
    payload.set(body, mime.length + 1);
    const id = Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('hex');
    fs.writeFileSync(path.join(OUT, `${id}.bin`), await seal(payload));
    node.src = `vault:${id}`;
    files++;
    return;
  }
  for (const v of Object.values(node)) await walk(v);
}
await walk(content);
fs.writeFileSync(path.join(OUT, 'content.bin'), await seal(enc.encode(JSON.stringify(content))));
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ v: 1, salt: b64(salt), iterations: ITER, check: b64(await seal(enc.encode('dheepika-vault'))), hint }, null, 1));
console.log(`Vault written to public/vault/: content + ${files} media file(s), PBKDF2 ${ITER.toLocaleString()} iterations.`);
console.log('Build and deploy as usual. Remove public/vault/ to return to placeholder preview mode.');
