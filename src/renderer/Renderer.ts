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

export function readViewport() {
  const vv = window.visualViewport;
  const width = Math.round(vv ? vv.width : window.innerWidth) || window.innerWidth;
  const height = window.innerHeight;
  state.viewport.width = width;
  state.viewport.height = height;
  state.viewport.aspect = width / height;
  state.viewport.portrait = height > width;
  state.viewport.mobile =
    matchMedia('(pointer: coarse)').matches || Math.min(width, height) < 600 || /Android|iPhone|iPad/i.test(navigator.userAgent);
  return state.viewport;
}
