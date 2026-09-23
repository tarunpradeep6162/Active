import * as THREE from 'three';
import { state } from '../core/state';
import type { FpsGovernor } from '../core/Performance';

/**
 * Plain‑DOM diagnostics panel, created only with ?debug=1 (never for normal visitors).
 * Refreshes at 4 Hz so it doesn't perturb what it measures.
 */
export class DebugOverlay {
  private el: HTMLPreElement;
  private next = 0;
  private times: number[] = [];
  private longFrames = 0;
  private longTasks = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private camera: THREE.PerspectiveCamera,
    private target: THREE.Vector3,
    private governor: FpsGovernor,
  ) {
    this.el = document.createElement('pre');
    this.el.setAttribute('aria-hidden', 'true');
    Object.assign(this.el.style, {
      position: 'fixed', left: '8px', top: '8px', zIndex: '99', margin: '0', padding: '8px 10px',
      font: '11px/1.45 ui-monospace, monospace', color: '#b8ffe8', background: 'rgba(0,0,0,.72)',
      border: '1px solid rgba(120,255,210,.25)', pointerEvents: 'none', whiteSpace: 'pre',
    });
    document.body.appendChild(this.el);
    try {
      new PerformanceObserver((l) => (this.longTasks += l.getEntries().length)).observe({ type: 'longtask', buffered: true });
    } catch {
      /* longtask not supported */
    }
  }

  frame(ms: number) {
    this.times.push(ms);
    if (this.times.length > 240) this.times.shift();
    if (ms > 50) this.longFrames++;
    const now = performance.now();
    if (now < this.next) return;
    this.next = now + 250;
    const sorted = this.times.slice().sort((a, b) => a - b);
    const p50 = sorted[sorted.length >> 1] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const info = this.renderer.info;
    const c = this.camera.position, t = this.target;
    const f = (v: number, d = 2) => v.toFixed(d).padStart(7);
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    this.el.textContent =
      `scroll    ${Math.round(state.scroll.position)} / ${Math.round(state.scroll.max)} px\n` +
      `progress  ${state.scroll.progress.toFixed(4)}   vel ${state.scroll.velocity.toFixed(2)} vh/s\n` +
      `scene     ${state.section} ${state.sectionProgress.toFixed(3)}   route ${state.route.name}\n` +
      `camera   ${f(c.x)}${f(c.y)}${f(c.z)}\n` +
      `target   ${f(t.x)}${f(t.y)}${f(t.z)}\n` +
      `fov       ${this.camera.fov.toFixed(1)}   transition ${state.transition.phase}\n` +
      `fps       ${(1000 / (p50 || 16.7)).toFixed(0)}  p50 ${p50.toFixed(1)}ms  p95 ${p95.toFixed(1)}ms\n` +
      `long      frames>50ms ${this.longFrames}  longtasks ${this.longTasks}\n` +
      `gpu       calls ${info.render.calls}  tris ${info.render.triangles}  pts ${info.render.points}\n` +
      `memory    geo ${info.memory.geometries}  tex ${info.memory.textures}` + (mem ? `  heap ${(mem.usedJSHeapSize / 1e6).toFixed(1)}MB` : '') + '\n' +
      `tier      ${state.performanceTier}  dpr ${state.viewport.dpr}  bench ${this.governor.benchmarkMs.toFixed(1)}ms  auto ${this.governor.enabled ? 'on' : 'off'}\n` +
      (this.governor.history.length ? `changes   ${this.governor.history.join(', ')}\n` : '');
  }
}
