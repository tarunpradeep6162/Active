/** Seconds since the scene started (three's Clock is deprecated; this is all the scenes need). */
export class SceneClock {
  private t0 = performance.now();
  getElapsedTime() {
    return (performance.now() - this.t0) / 1000;
  }
}
