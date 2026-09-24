import { projectBySlug } from '../app/projects';
import { state, store, type Route } from '../core/state';
import { routePath, sameRoute } from '../app/router';
import { rangeOf } from '../world/journey';
import { easeInOutCubic, easeOutCubic, easeInExpo, clamp } from '../utils/math';
import type { ScrollEngine } from '../scroll/ScrollEngine';
import type { CameraRig } from '../camera/CameraRig';
import type { World } from '../world/World';

type Phase = 'EXITING' | 'SWITCHING' | 'ENTERING';
interface Step {
  phase: Phase;
  duration: number;
  start?: () => void;
  tick?: (t: number) => void;
  end?: () => void;
}

/**
 * Every route/scene change goes through here. Steps run strictly in sequence
 * (IDLE → EXITING → SWITCHING → ENTERING → IDLE); requests that arrive mid‑flight
 * replace a single pending slot so rapid clicks never overlap.
 */
export class TransitionController {
  private queue: Step[] = [];
  private current: Step | null = null;
  private elapsed = 0;
  private pending: { route: Route; push: boolean } | null = null;

  constructor(
    private scroll: ScrollEngine,
    private rig: CameraRig,
    private world: World,
  ) {}

  get busy() {
    return this.current !== null || this.queue.length > 0;
  }

  request(route: Route, push = true) {
    if (this.busy) {
      this.pending = { route, push };
      return;
    }
    this.plan(route, push);
  }

  /** Travel to a journey position (used by category filters / search results). */
  jump(progress: number) {
    if (this.busy || state.route.name === 'project' || state.route.name === 'contact') return;
    this.queue.push(...this.jumpSteps(progress));
  }

  private dur(s: number) {
    return state.reducedMotion ? s * 0.25 : s;
  }

  private commit(route: Route, push: boolean) {
    if (sameRoute(route, state.route) && location.pathname === routePath(route)) return;
    state.route = route;
    const path = routePath(route);
    if (push && location.pathname !== path) history.pushState({}, '', path);
    store.set({ route });
    document.title =
      route.name === 'project'
        ? `${projectBySlug(route.slug)?.title ?? 'Our garden'} · For Dheepika`
        : route.name === 'contact'
          ? 'For you · For Dheepika'
          : route.name === 'work'
            ? 'Our garden · For Dheepika'
            : 'For Dheepika · 25 · 11';
  }

  private jumpSteps(progress: number): Step[] {
    const delta = Math.abs(progress - state.scroll.progress);
    if (delta < 0.004) return [];
    if (delta < 0.03 || state.reducedMotion) {
      return [
        {
          phase: 'SWITCHING',
          duration: 0,
          start: () => this.scroll.jumpTo(progress, state.reducedMotion),
        },
      ];
    }
    // warp: accelerate out, cut, decelerate in
    return [
      {
        phase: 'EXITING',
        duration: this.dur(0.42),
        start: () => this.scroll.lock(true),
        tick: (t) => {
          this.rig.warp = easeInExpo(t);
          state.transition.progress = t * 0.5;
        },
      },
      {
        phase: 'SWITCHING',
        duration: 0,
        start: () => {
          this.scroll.lock(false);
          this.scroll.jumpTo(progress, true);
          this.scroll.lock(true);
          this.rig.snap();
        },
      },
      {
        phase: 'ENTERING',
        duration: this.dur(0.8),
        tick: (t) => {
          this.rig.warp = 1 - easeOutCubic(t);
          state.transition.progress = 0.5 + t * 0.5;
        },
        end: () => {
          this.rig.warp = 0;
          this.scroll.lock(false);
          state.transition.progress = 0;
        },
      },
    ];
  }

  private plan(route: Route, push: boolean) {
    const from = state.route;
    const steps: Step[] = [];

    // 1 · leave the current state
    if (from.name === 'project' && !sameRoute(from, route)) {
      steps.push(
        { phase: 'EXITING', duration: this.dur(0.25), start: () => this.commit(route, push) },
        {
          phase: 'ENTERING',
          duration: this.dur(0.9),
          start: () => this.scroll.lock(false),
          tick: (t) => (state.focus = 1 - easeInOutCubic(t)),
          end: () => {
            state.focus = 0;
            this.world.activeSlug = null;
          },
        },
      );
    }
    if (from.name === 'contact' && route.name !== 'contact') {
      steps.push({
        phase: 'EXITING',
        duration: this.dur(0.5),
        tick: (t) => (state.overlay = 1 - easeInOutCubic(t)),
        end: () => {
          state.overlay = 0;
          this.scroll.lock(false);
        },
      });
    }

    // 2 · arrive
    switch (route.name) {
      case 'home': {
        steps.push({ phase: 'SWITCHING', duration: 0, start: () => this.commit(route, push) });
        if (from.name !== 'project' && from.name !== 'contact') steps.push(...this.jumpSteps(0));
        break;
      }
      case 'work': {
        steps.push({ phase: 'SWITCHING', duration: 0, start: () => this.commit(route, push) });
        if (from.name !== 'project' && from.name !== 'contact') {
          const r = rangeOf('work');
          // land with the first card framed, as the reference does
          const first = this.world.progressForCard(this.world.cards.cards[0].project.slug);
          const inside = state.scroll.progress >= r.start && state.scroll.progress <= r.end;
          if (!inside) steps.push(...this.jumpSteps(first));
        }
        break;
      }
      case 'contact': {
        steps.push(
          { phase: 'SWITCHING', duration: 0, start: () => { this.commit(route, push); this.scroll.lock(true); } },
          { phase: 'ENTERING', duration: this.dur(0.7), tick: (t) => (state.overlay = easeOutCubic(t)), end: () => (state.overlay = 1) },
        );
        break;
      }
      case 'project': {
        const target = this.world.progressForCard(route.slug);
        steps.push(...this.jumpSteps(target));
        let startFocus = 0;
        steps.push(
          {
            phase: 'EXITING',
            duration: this.dur(0.2),
            start: () => {
              this.world.activeSlug = route.slug;
              this.world.cards.focusFor(route.slug, this.rig.focusPos, this.rig.focusTgt, this.rig.camera.fov);
              startFocus = state.focus;
            },
            // reference: the card rushes forward immediately (void by ~100–200 ms)
            tick: (t) => (state.focus = Math.max(startFocus, 0.45 * easeOutCubic(t))),
          },
          {
            phase: 'SWITCHING',
            duration: 0,
            start: () => {
              this.commit(route, push);
              this.scroll.lock(true);
            },
          },
          {
            phase: 'ENTERING',
            duration: this.dur(0.7),
            tick: (t) => (state.focus = Math.max(state.focus, 0.45 + 0.55 * easeOutCubic(t))),
            end: () => (state.focus = 1),
          },
        );
        break;
      }
    }
    this.queue.push(...steps);
  }

  update(dt: number) {
    if (!this.current) {
      this.current = this.queue.shift() ?? null;
      this.elapsed = 0;
      if (this.current) {
        state.transition.phase = this.current.phase;
        this.current.start?.();
      } else {
        state.transition.phase = 'IDLE';
        if (this.pending) {
          const p = this.pending;
          this.pending = null;
          if (!sameRoute(p.route, state.route)) this.plan(p.route, p.push);
        }
        return;
      }
    }
    const step = this.current;
    this.elapsed += dt;
    const t = step.duration > 0 ? clamp(this.elapsed / step.duration) : 1;
    step.tick?.(t);
    if (t >= 1) {
      step.end?.();
      this.current = null;
      // zero‑duration steps chain within the same frame
      if (this.queue.length && this.queue[0].duration === 0) this.update(0);
    }
  }
}
