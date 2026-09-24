import type { Route } from '../core/state';
import { projectBySlug } from './projects';

/**
 * Paths: /garden (the tulip garden), /garden/<chapter>, /for-you. The old /work and /contact
 * paths still resolve so earlier links keep working.
 */
export function parseRoute(pathname: string): Route {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/garden' || p === '/work') return { name: 'work' };
  if (p === '/for-you' || p === '/contact') return { name: 'contact' };
  const m = p.match(/^\/(?:garden|work)\/([a-z0-9-]+)$/);
  if (m && projectBySlug(m[1])) return { name: 'project', slug: m[1] };
  return { name: 'home' };
}

/** True when a path is one of ours (anything else shows the "wandered out of the garden" note). */
export function isKnownPath(pathname: string) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return true;
  const r = parseRoute(p);
  return r.name !== 'home';
}

export function routePath(r: Route) {
  switch (r.name) {
    case 'work':
      return '/garden';
    case 'contact':
      return '/for-you';
    case 'project':
      return `/garden/${r.slug}`;
    default:
      return '/';
  }
}

export const sameRoute = (a: Route, b: Route) =>
  a.name === b.name && (a.name !== 'project' || (b.name === 'project' && a.slug === b.slug));
