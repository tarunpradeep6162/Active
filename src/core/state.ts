import type { PerformanceTier } from './Performance';

export type Route =
  | { name: 'home' }
  | { name: 'work' }
  | { name: 'project'; slug: string }
  | { name: 'contact' };

export type SectionId = 'intro' | 'manifesto' | 'work' | 'lab' | 'portal' | 'outro';

/**
 * The single mutable runtime state. The render loop writes continuous values
 * (scroll, pointer, camera …) every frame without allocations; React only
 * subscribes to the coarse `ui` slice through `store`.
 */
export const state = {
  time: 0,
  delta: 0,
  frame: 0,

  route: { name: 'home' } as Route,
  section: 'intro' as SectionId,
  /** 0..1 progress inside the current section */
  sectionProgress: 0,

  scroll: {
    /** raw document scroll in px */
    target: 0,
    /** smoothed scroll in px */
    position: 0,
    /** smoothed normalised journey progress 0..1 */
    progress: 0,
    targetProgress: 0,
    /** viewport heights per second, signed */
    velocity: 0,
    direction: 0 as -1 | 0 | 1,
    max: 1,
  },

  pointer: {
    /** normalised -1..1 (y up) */
    x: 0,
    y: 0,
    /** smoothed target used by camera */
    targetX: 0,
    targetY: 0,
    /** css px */
    px: 0,
    py: 0,
    /** normalised units per second */
    vx: 0,
    vy: 0,
    speed: 0,
    down: false,
    active: false,
    isTouch: false,
    lastMove: 0,
  },

  viewport: { width: 1, height: 1, aspect: 1, dpr: 1, portrait: false, mobile: false },
  performanceTier: 'high' as PerformanceTier,
  reducedMotion: false,

  transition: { progress: 0, phase: 'IDLE' as 'IDLE' | 'EXITING' | 'SWITCHING' | 'ENTERING' },
  /** 0..1 focus on an opened project */
  focus: 0,
  /** 0..1 contact overlay amount */
  overlay: 0,
  /** 0..1 how far an open chapter's veil steps aside so the garden shows (wish, finale) */
  veilThin: 0,
  /** screen position (px) of the open chapter's tulip — chapters grow out of it */
  bloomX: 0,
  bloomY: 0,
  /** 0..1 while the wish button is held: the wish tulip gathers light */
  wishHold: 0,
  /** 0..1 how hard she is blowing at the cake's candles (hold button or microphone) */
  cakeBlow: 0,
  /** 0…1 progress through the finale sky (outro) */
  finaleLocal: 0,
  /** wish lanterns already turned into stars */
  starsLit: 0,
  /** the cage has been opened */
  cageOpen: false,
  /** the cake is out of its cage and its candles are burning */
  cakeReady: false,
  /** 0..1 the room going dark after the candles go out */
  cakeDark: 0,
  /** 0..1 intro reveal after preload */
  reveal: 0,
  audioLevel: 0,
  loaded: false,
};

export type ExperienceState = typeof state;

/* ------------------------------------------------------------------ */
/* Coarse UI store (React subscribes with useSyncExternalStore)        */
/* ------------------------------------------------------------------ */

export interface UIState {
  loadProgress: number;
  loaded: boolean;
  revealed: boolean;
  route: Route;
  section: SectionId;
  hoveredProject: string | null;
  activeCategory: string | null;
  audioOn: boolean;
  multiuserPeers: number;
  webglLost: boolean;
  tier: PerformanceTier;
  atEnd: boolean;
}

let ui: UIState = {
  loadProgress: 0,
  loaded: false,
  revealed: false,
  route: { name: 'home' },
  section: 'intro',
  hoveredProject: null,
  activeCategory: null,
  audioOn: false,
  multiuserPeers: 0,
  webglLost: false,
  tier: 'high',
  atEnd: false,
};
const listeners = new Set<() => void>();

export const store = {
  get: () => ui,
  set(patch: Partial<UIState>) {
    let changed = false;
    for (const k in patch) {
      const key = k as keyof UIState;
      if (ui[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    ui = { ...ui, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/* Tiny typed event bus for imperative commands between UI and runtime. */
type Events = {
  navigate: Route;
  jumpToProject: string;
  openCage: void;
  /** the candles are blown out */
  blowCandles: void;
  /** a wish lantern was let go (index into the wishes; screen position for its words) */
  lanternWish: { index: number; x: number; y: number };
  /** let the next waiting wish lantern go (button / keyboard path) */
  releaseNextLantern: void;
  /** the wish in chapter 11: light climbs the whole garden */
  wishLight: void;
  /** the finale's pull‑back reveal of the whole garden */
  gardenReveal: boolean;
  /** a small golden pulse up the stem (a clue solved) */
  gardenPulse: void;
  filter: string | null;
  toggleAudio: void;
  scrollTo: number;
};
type Handler<T> = (payload: T) => void;
const bus = new Map<keyof Events, Set<Handler<unknown>>>();
export const events = {
  on<K extends keyof Events>(k: K, h: Handler<Events[K]>) {
    if (!bus.has(k)) bus.set(k, new Set());
    bus.get(k)!.add(h as Handler<unknown>);
    return () => bus.get(k)!.delete(h as Handler<unknown>);
  },
  emit<K extends keyof Events>(k: K, payload: Events[K]) {
    bus.get(k)?.forEach((h) => h(payload));
  },
};
