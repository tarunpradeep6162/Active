/**
 * The letter turns into stars: its edges catch a soft golden light and curl away, and every
 * word lifts off the page as a handful of sparks that rise into the dark. Frame by frame (so
 * it keeps time with the world); resolves when the last spark has gone.
 */
export function letterToStars(paper: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.className = 'bd-sparks';
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    document.body.appendChild(cv);
    const g = cv.getContext('2d')!;
    g.scale(dpr, dpr);
    // every word on the page becomes sparks
    type Spark = { x: number; y: number; vx: number; vy: number; life: number; delay: number; r: number };
    const sparks: Spark[] = [];
    const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const top = paper.getBoundingClientRect().top;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? '';
      const re = /\S+/g;
      for (let m = re.exec(text); m; m = re.exec(text)) {
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        for (const rc of Array.from(range.getClientRects())) {
          const per = Math.min(6, 1 + Math.round(rc.width / 14));
          for (let k = 0; k < per; k++)
            sparks.push({
              x: rc.left + Math.random() * rc.width,
              y: rc.top + rc.height * (0.3 + Math.random() * 0.5),
              vx: (Math.random() - 0.5) * 30,
              vy: -40 - Math.random() * 70,
              life: 1.6 + Math.random() * 1.6,
              // the words go from the top of the page down, like a flame travelling
              delay: 0.5 + ((rc.top - top) / Math.max(1, paper.offsetHeight)) * 1.4 + Math.random() * 0.25,
              r: 0.8 + Math.random() * 1.4,
            });
        }
      }
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      // the paper: a golden edge, then it curls back and fades as its words leave
      const glow = Math.min(1, t / 0.5);
      const fade = Math.min(1, Math.max(0, (t - 0.6) / 2.4));
      paper.style.boxShadow = `inset 0 0 ${30 + 50 * glow}px rgba(255, 190, 110, ${0.55 * glow * (1 - fade)}), 0 0 ${60 * glow}px rgba(255, 170, 90, ${0.35 * glow * (1 - fade)})`;
      paper.style.color = `rgba(59, 38, 32, ${1 - fade})`;
      paper.style.transform = `perspective(900px) rotateX(${fade * 14}deg) translateY(${-fade * 30}px) scale(${1 - fade * 0.06})`;
      paper.style.opacity = String(1 - Math.max(0, (t - 2) / 1.4));
      g.clearRect(0, 0, innerWidth, innerHeight);
      g.globalCompositeOperation = 'lighter';
      let alive = 0;
      for (const s of sparks) {
        const a = t - s.delay;
        if (a < 0) {
          alive++;
          continue;
        }
        if (a > s.life) continue;
        alive++;
        const k = a / s.life;
        const x = s.x + s.vx * a + Math.sin(a * 3 + s.x) * 6;
        const y = s.y + s.vy * a - 18 * a * a;
        const o = Math.min(1, a / 0.15) * (1 - k);
        const grd = g.createRadialGradient(x, y, 0, x, y, s.r * 5);
        grd.addColorStop(0, `rgba(255, 244, 214, ${o})`);
        grd.addColorStop(0.35, `rgba(255, 200, 120, ${o * 0.6})`);
        grd.addColorStop(1, 'rgba(255, 170, 90, 0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, s.r * 5, 0, Math.PI * 2);
        g.fill();
      }
      if (alive > 0 && t < 8) requestAnimationFrame(tick);
      else {
        cv.remove();
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}
