import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App } from './ui/App';
import { state } from './core/state';

function supportsWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

const mount = document.getElementById('interface')!;
if (!supportsWebGL2()) {
  mount.innerHTML =
    '<div class="fallback" role="alert"><p>This experience needs a browser with WebGL 2.<br/>Try the latest Chrome, Safari, Firefox or Edge.</p></div>';
} else {
  createRoot(mount).render(<App />);
  import('./core/Experience').then(({ Experience }) => {
    const exp = new Experience(document.getElementById('experience') as HTMLCanvasElement);
    exp.boot().catch((err) => {
      console.error(err);
      mount.insertAdjacentHTML('beforeend', '<div class="fallback" role="alert"><p>Something went wrong while loading.</p></div>');
    });
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug'))
      Object.assign(window, { __exp: exp, __state: state });
  });
}
