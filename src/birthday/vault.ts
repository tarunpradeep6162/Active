import type { BirthdayContent, MediaRef } from './types';
import { PLACEHOLDER } from '../content/dheepika';

/**
 * Encrypted content vault (built by `scripts/vault.mjs`).
 *
 *   public/vault/meta.json     { v, salt, iterations, check, hint }   — not secret
 *   public/vault/content.bin   iv ‖ AES‑GCM(content.json)
 *   public/vault/<id>.bin      iv ‖ AES‑GCM(media bytes)
 *
 * The key is PBKDF2‑SHA256(passcode, salt). Without the passcode the files are noise, so the
 * public site can carry them; the protection is exactly as strong as the passcode.
 * With no vault deployed the site runs on the shipped placeholders ("preview mode").
 */
interface Meta {
  v: 1;
  salt: string;
  iterations: number;
  check: string;
  hint?: string;
}

const BASE = `${import.meta.env.BASE_URL}vault/`;
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

let meta: Meta | null | undefined;
let key: CryptoKey | null = null;
let content: BirthdayContent = PLACEHOLDER;
const mediaCache = new Map<string, Promise<string>>();
const listeners = new Set<() => void>();

export type VaultState = 'checking' | 'preview' | 'locked' | 'open';
let vaultState: VaultState = 'checking';

function set(s: VaultState) {
  vaultState = s;
  listeners.forEach((l) => l());
}
export const getVaultState = () => vaultState;
export const getContent = () => content;
export const getHint = () => meta?.hint ?? '';
export function subscribeVault(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Look for a deployed vault once; without one the placeholders are used. */
export async function initVault() {
  if (meta !== undefined) return;
  try {
    const r = await fetch(`${BASE}meta.json`, { cache: 'no-store' });
    // a static host's SPA fallback answers 200 with index.html for a missing file
    const m = r.ok && (r.headers.get('content-type') ?? '').includes('json') ? ((await r.json()) as Partial<Meta>) : null;
    // public/vault/meta.json ships as a "no vault yet" marker (so the request never 404s)
    meta = m && typeof m.salt === 'string' && typeof m.iterations === 'number' ? (m as Meta) : null;
  } catch {
    meta = null;
  }
  if (!meta) return set('preview');
  const saved = sessionPass();
  if (saved && (await unlock(saved))) return;
  set('locked');
}

async function derive(pass: string, m: Meta) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(m.salt), iterations: m.iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function open(k: CryptoKey, bytes: Uint8Array) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, k, bytes.slice(12)));
}

/** Try a passcode. Resolves true and swaps in the real content when it is right. */
export async function unlock(pass: string): Promise<boolean> {
  if (!meta) return false;
  try {
    const k = await derive(pass, meta);
    const ok = dec.decode(await open(k, b64(meta.check)));
    if (ok !== 'dheepika-vault') return false;
    const r = await fetch(`${BASE}content.bin`, { cache: 'no-store' });
    const json = JSON.parse(dec.decode(await open(k, new Uint8Array(await r.arrayBuffer()))));
    key = k;
    content = { ...PLACEHOLDER, ...json, placeholder: false };
    try {
      // this tab only: a refresh shouldn't ask again, closing the tab forgets it
      sessionStorage.setItem('bday-pass', pass);
    } catch {
      /* storage unavailable */
    }
    set('open');
    return true;
  } catch {
    return false;
  }
}

function sessionPass() {
  try {
    return sessionStorage.getItem('bday-pass');
  } catch {
    return null;
  }
}

/** Resolve a media reference to a displayable URL (decrypting vault media on demand). */
export function mediaUrl(ref: MediaRef, px?: number): Promise<string> {
  const src = pickVariant(ref, px);
  if (!src.startsWith('vault:')) return Promise.resolve(src);
  let p = mediaCache.get(src);
  if (!p) {
    p = (async () => {
      if (!key) throw new Error('locked');
      const id = src.slice(6);
      const r = await fetch(`${BASE}${id}.bin`);
      const bytes = await open(key, new Uint8Array(await r.arrayBuffer()));
      const [mime, body] = splitHeader(bytes);
      return URL.createObjectURL(new Blob([body.slice().buffer as ArrayBuffer], { type: mime }));
    })();
    mediaCache.set(src, p);
  }
  return p;
}

/** The smallest photo variant that covers `px` device pixels (default: the screen's long edge). */
function pickVariant(ref: MediaRef, px?: number) {
  if (!ref.variants) return ref.src;
  const need = px ?? Math.min(1440, Math.max(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) * 0.8);
  const sizes = Object.keys(ref.variants).map(Number).sort((a, b) => a - b);
  const size = sizes.find((s) => s >= need) ?? sizes[sizes.length - 1];
  return ref.variants[size] ?? ref.src;
}

/** Media payload = utf‑8 mime type, NUL, bytes. */
function splitHeader(bytes: Uint8Array): [string, Uint8Array] {
  const i = bytes.indexOf(0);
  return [dec.decode(bytes.slice(0, i)), bytes.slice(i + 1)];
}
