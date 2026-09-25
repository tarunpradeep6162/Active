import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App } from './ui/App';
import { state, events } from './core/state';
import { FallbackStory } from './birthday/ui/FallbackStory';
import './birthday/ui/birthday.css';
import { SignPad } from './birthday/ui/Signature';

function supportsWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

const mount = document.getElementById('interface')!;
if (new URLSearchParams(location.search).has('sign')) {
  // the private signing page: no 3D, just a pad to sign on (a plain, scrolling page)
  document.documentElement.classList.add('is-signing');
  createRoot(mount).render(<SignPad />);
} else if (!supportsWebGL2()) {
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
      Object.assign(window, { __exp: exp, __state: state, __events: events });
  });
}
