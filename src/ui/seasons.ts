/**
 * Seasons in the garden: each time she comes back (a new visit, not a reload) the garden has
 * moved on a season: blossom the first time, then autumn gold, then snow, and round again.
 * Counted only in her browser. For a preview: ?qa=1&season=autumn (or blossom, snow).
 */
export type Season = 0 | 1 | 2; // blossom · autumn · snow
const NAMES = ['blossom', 'autumn', 'snow'];

function visits(): number {
  try {
    let n = Number(localStorage.getItem('bday-visits') ?? '0');
    if (!sessionStorage.getItem('bday-visit-counted')) {
      n += 1;
      localStorage.setItem('bday-visits', String(n));
      sessionStorage.setItem('bday-visit-counted', '1');
    }
    return Math.max(1, n);
  } catch {
    return 1;
  }
}

export function currentSeason(): Season {
  const q = new URLSearchParams(location.search);
  if ((q.has('qa') || q.has('debug')) && q.get('season')) {
    const i = NAMES.indexOf(q.get('season')!);
    if (i >= 0) return i as Season;
  }
  return ((visits() - 1) % 3) as Season;
}
