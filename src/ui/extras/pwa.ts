import { useSyncExternalStore } from 'react';

/**
 * The garden as an app on her phone:
 *  - the service worker (public/sw.js) keeps every file she has loaded, so the next visit
 *    starts in about a second and the journey plays offline;
 *  - "Add to home screen" installs it with its own icon, opening full‑screen with no browser bar.
 * Not used while testing (?qa / ?debug) or on localhost (unless ?sw).
 */
const q = new URLSearchParams(location.search);
const enabled = 'serviceWorker' in navigator && !q.has('qa') && !q.has('debug') && (import.meta.env.PROD || q.has('sw')) && (location.hostname !== 'localhost' || q.has('sw'));

type Install = { canPrompt: boolean; installed: boolean; ios: boolean };
let st: Install = {
  canPrompt: false,
  installed: matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  ios: /iPhone|iPad|iPod/i.test(navigator.userAgent),
};
const subs = new Set<() => void>();
const set = (p: Partial<Install>) => {
  st = { ...st, ...p };
  subs.forEach((s) => s());
};
export const useInstall = () =>
  useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => st,
  );

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let deferred: PromptEvent | null = null;

/** Show the phone's own "Install" sheet (Android / Chrome). */
export async function promptInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  set({ canPrompt: false, installed: outcome === 'accepted' || st.installed });
  return outcome === 'accepted';
}

/** Hand the service worker every file this visit has loaded, so all of it is kept. */
export function warmCache() {
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return;
  const urls = new Set<string>();
  for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
    try {
      const u = new URL(e.name);
      if (u.origin === location.origin && !u.pathname.startsWith('/@') && !u.pathname.endsWith('.map')) urls.add(u.pathname + u.search);
    } catch {
      /* ignore */
    }
  }
  sw.postMessage({ type: 'warm', urls: [...urls] });
}

export function startPwa() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    set({ canPrompt: true });
  });
  addEventListener('appinstalled', () => set({ installed: true, canPrompt: false }));
  if (!enabled) return;
  const register = () =>
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* private mode or blocked: the site simply works online */
    });
  if (document.readyState === 'complete') register();
  else addEventListener('load', register);
  // once the garden is up (and again whenever she leaves the tab), keep what was loaded
  setTimeout(warmCache, 15000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && warmCache());
}
