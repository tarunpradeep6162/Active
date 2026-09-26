import { events } from '../core/state';

/**
 * A quiet diary of her night, kept only in this browser: when she opened the cage and blew
 * out the candles, which wishes she let go, whether she drew her own stars. The replay at the
 * end tells it back to her. (Chapters, hearts and her gift come from her progress.)
 */
const KEY = 'bday-journal-v1';

export interface Journal {
  first?: number;
  cage?: number;
  candles?: number;
  wishes: number[];
  stars?: number;
  film?: number;
  letterSky?: boolean;
}

let data: Journal = load();
function load(): Journal {
  try {
    return { wishes: [], ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { wishes: [] };
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage blocked: the diary lasts for this visit */
  }
}
export const getJournal = () => data;
export function note(patch: Partial<Journal>) {
  data = { ...data, ...patch };
  save();
}

/** start listening (once, from the app) */
export function startJournal() {
  if (!data.first) note({ first: Date.now() });
  events.on('openCage', () => !data.cage && note({ cage: Date.now() }));
  events.on('blowCandles', () => !data.candles && note({ candles: Date.now() }));
  events.on('lanternWish', ({ index }) => !data.wishes.includes(index) && note({ wishes: [...data.wishes, index] }));
  events.on('playFilm', () => note({ film: Date.now() }));
}
