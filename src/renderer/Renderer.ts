import * as THREE from 'three';
import { state, store } from '../core/state';
import { quiet } from './quiet';

export function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = quiet(new THREE.WebGLRenderer({
    canvas,
    antialias: false, // MSAA lives on the scene render target
    alpha: false,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  }));
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the composite pass
  renderer.autoClear = true;
  renderer.info.autoReset = false; // reset once per frame so stats cover all passes

  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      store.set({ webglLost: true });
    },
    false,
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      store.set({ webglLost: false });
    },
    false,
  );
  return renderer;
}

/**
 * Phones: the browser toolbar slides in and out as she scrolls, changing the window height by
 * ~50–60 px each time. The scene keeps one stable height per width (the tallest seen, i.e. with the
 * toolbar hidden; the canvas is sized to 100lvh to match), so the toolbar never re‑sizes the render
 * targets or shifts the journey under her finger. A rotation (new width) starts over.
 */
const stable = { w: 0, h: 0 };
let probe: HTMLDivElement | null = null;
/** the large viewport (toolbar hidden) in CSS px, known even while the toolbar shows */
function largeViewportHeight() {
  if (typeof CSS === 'undefined' || !CSS.supports('height', '100lvh')) return 0;
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
  }
  return probe.offsetHeight;
}
function stableHeight(width: number, phone: boolean) {
  const h = Math.max(window.innerHeight, phone ? largeViewportHeight() : 0);
  if (!phone) return h;
  if (width !== stable.w) {
    stable.w = width;
    stable.h = h;
  } else stable.h = Math.max(stable.h, h);
  return stable.h;
}

export function readViewport() {
  const vv = window.visualViewport;
  const coarse = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  // phones: the layout width (a pinch‑zoom shrinks the visual viewport, not the page the canvas
  // fills; the zoom raises the drawing resolution instead, see Experience.applyResolution)
  const width = (coarse ? document.documentElement.clientWidth : Math.round(vv ? vv.width : window.innerWidth)) || window.innerWidth;
  const height = stableHeight(width, coarse);
  state.viewport.width = width;
  state.viewport.height = height;
  state.viewport.aspect = width / height;
  state.viewport.portrait = height > width;
  state.viewport.mobile = coarse || Math.min(width, height) < 600;
  return state.viewport;
}
