/** Small guarded localStorage helpers (her keepsakes live only on her phone). */
export const local = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  },
};

const VISITS = 'bday-visit-days';
/** Notes today as a day she came to the garden (the tulip she plants grows with her visits). */
export function recordVisit() {
  const days = local.get<string[]>(VISITS, []);
  const today = new Date().toDateString();
  if (days[days.length - 1] !== today) local.set(VISITS, [...days, today].slice(-60));
}
export const visitDays = () => local.get<string[]>(VISITS, []);
