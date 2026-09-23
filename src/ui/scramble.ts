const GLYPHS = '/\\|<>-_=+*#01[]{}';

/** Glyph scramble that resolves left→right; returns a cancel fn. */
export function scramble(el: HTMLElement, text: string, duration = 420, reduced = false) {
  if (reduced) {
    el.textContent = text;
    return () => {};
  }
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const reveal = i / text.length;
      if (ch === ' ' || t > reveal * 0.7 + 0.3) out += ch;
      else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (t < 1) raf = requestAnimationFrame(tick);
    else el.textContent = text;
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    el.textContent = text;
  };
}
