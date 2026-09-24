import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App } from './ui/App';
import { state } from './core/state';
import { FallbackStory } from './birthday/ui/FallbackStory';
import './birthday/ui/birthday.css';

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
  // no 3D here: the story still arrives, as a quiet page
  document.documentElement.classList.add('no-webgl');
  createRoot(mount).render(<FallbackStory />);
} else {
  const root = createRoot(mount);
  root.render(<App />);
  import('./core/Experience').then(({ Experience }) => {
    const exp = new Experience(document.getElementById('experience') as HTMLCanvasElement);
    exp.boot().catch((err) => {
      console.error(err);
      document.documentElement.classList.add('no-webgl');
      root.render(<FallbackStory />);
    });
    const q = new URLSearchParams(location.search);
    if (import.meta.env.DEV || q.has('debug') || q.has('qa'))
      Object.assign(window, { __exp: exp, __state: state });
  });
}
