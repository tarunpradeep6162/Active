import type { Route } from '../core/state';
import { projectBySlug } from './projects';

export function parseRoute(pathname: string): Route {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/work') return { name: 'work' };
  if (p === '/contact') return { name: 'contact' };
  const m = p.match(/^\/work\/([a-z0-9-]+)$/);
  if (m && projectBySlug(m[1])) return { name: 'project', slug: m[1] };
  return { name: 'home' };
}

export function routePath(r: Route) {
  switch (r.name) {
    case 'work':
      return '/work';
    case 'contact':
      return '/contact';
    case 'project':
      return `/work/${r.slug}`;
    default:
      return '/';
  }
}

export const sameRoute = (a: Route, b: Route) =>
  a.name === b.name && (a.name !== 'project' || (b.name === 'project' && a.slug === b.slug));
