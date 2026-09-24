import { events, state, store } from '../core/state';

const PREF = 'bday-sound';

/**
 * Original generative music (no audio files, no existing melodies): a slow music box that
 * improvises arpeggios over a gentle four‑chord loop in D major, a soft sine pad underneath,
 * and small chimes for the moments that deserve one (a lantern let go, candles blown out,
 * the wish). Off by default; only ever starts from her gesture. If she turned it on, it is
 * remembered for this browser session and resumes on her next tap.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private box: GainNode | null = null;
  private padBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;
  private pads: OscillatorNode[] = [];
  private on = false;
  /** music‑box scheduler: next note time (ctx seconds) and step */
  private next = 0;
  private step = 0;
  private lastNote = 74;

  constructor() {
    // chimes for the big moments (only heard while the music is on)
    events.on('lanternWish', () => this.chime(0));
    events.on('blowCandles', () => this.chime(1));
    events.on('wishLight', () => this.chime(2));
    // she turned the music on earlier in this session: resume on her next gesture
    if (readPref()) {
      const resume = () => {
        removeEventListener('pointerdown', resume);
        removeEventListener('keydown', resume);
        if (!this.on) this.toggle();
      };
      addEventListener('pointerdown', resume, { once: true });
      addEventListener('keydown', resume, { once: true });
    }
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    master.connect(analyser).connect(ctx.destination);
    this.master = master;
    this.analyser = analyser;
    this.data = new Uint8Array(analyser.frequencyBinCount);

    // a soft room: two tapped delays feeding back through a low‑pass, like a small hall
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    const d1 = ctx.createDelay(2);
    d1.delayTime.value = 0.37;
    const d2 = ctx.createDelay(2);
    d2.delayTime.value = 0.53;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2600;
    d1.connect(damp);
    d2.connect(damp);
    damp.connect(fb);
    fb.connect(d1);
    fb.connect(d2);
    damp.connect(wet).connect(master);
    const send = ctx.createGain();
    send.connect(d1);
    send.connect(d2);

    this.box = ctx.createGain();
    this.box.gain.value = 0.9;
    this.box.connect(master);
    this.box.connect(send);

    // pad: quiet sines on the current chord, a slow swell
    this.padBus = ctx.createGain();
    this.padBus.gain.value = 0.018;
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.value = 900;
    this.padBus.connect(padLp).connect(master);
    padLp.connect(send);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.connect(this.padBus);
      o.start();
      this.pads.push(o);
    }
  }

  /** a music‑box tine: bright attack, a metallic partial, long soft decay */
  private tine(midi: number, t: number, vel: number) {
    const ctx = this.ctx!;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    g.connect(this.box!);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 4.02; // inharmonic tine partial
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.35, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o1.connect(g);
    o2.connect(g2).connect(g);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 2.7);
    o2.stop(t + 0.4);
  }

  /** a small chime cluster for a moment (0 lantern · 1 candles · 2 wish) */
  private chime(kind: number) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const sets = [
      [86, 90, 93],
      [81, 85, 88, 93],
      [74, 81, 86, 90, 93, 98],
    ];
    sets[kind].forEach((m, i) => this.tine(m, t + i * 0.11, 0.7));
  }

  // D major: D – Bm – G – A, two bars each (an ordinary progression; the melody is improvised)
  private static CHORDS = [
    [62, 66, 69],
    [59, 62, 66],
    [55, 59, 62],
    [57, 61, 64],
  ];

  private schedule() {
    const ctx = this.ctx!;
    const beat = 60 / 66 / 2; // eighth notes at 66 bpm
    while (this.next < ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 8);
      const chord = AudioEngine.CHORDS[Math.floor(bar / 2) % 4];
      const inBar = this.step % 8;
      if (inBar === 0 && bar % 2 === 0) {
        // new chord: glide the pad
        chord.forEach((m, i) => this.pads[i].frequency.setTargetAtTime(220 * Math.pow(2, (m - 57) / 12), this.next, 0.6));
      }
      // arpeggio low in the box, a melody note on some steps, rests to breathe
      const rest = Math.random() < 0.18 && inBar % 2 === 1;
      if (!rest) {
        if (inBar % 2 === 0) {
          const tone = chord[(inBar / 2) % 3] + 12;
          this.tine(tone, this.next, 0.55);
        } else {
          // melody: a step toward a chord tone in the upper octave, staying in range
          const targets = chord.map((m) => m + 24).concat(chord.map((m) => m + 12));
          const pentatonic = [0, 2, 4, 7, 9].map((d) => 62 + 12 + d).concat([0, 2, 4, 7, 9].map((d) => 62 + 24 + d));
          const pool = Math.random() < 0.6 ? targets : pentatonic;
          let best = pool[0];
          for (const m of pool) if (Math.abs(m - this.lastNote) < Math.abs(best - this.lastNote) && m !== this.lastNote) best = m;
          if (Math.random() < 0.3) best = pool[(Math.random() * pool.length) | 0];
          this.lastNote = Math.max(71, Math.min(93, best));
          this.tine(this.lastNote, this.next, 0.8);
        }
      }
      this.next += beat * (1 + (Math.random() - 0.5) * 0.04);
      this.step++;
    }
  }

  async toggle() {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    this.on = !this.on;
    writePref(this.on);
    if (this.on) {
      await ctx.resume();
      this.next = ctx.currentTime + 0.1;
    }
    const t = ctx.currentTime;
    this.master!.gain.cancelScheduledValues(t);
    this.master!.gain.setTargetAtTime(this.on ? 0.9 : 0, t, 0.5);
    store.set({ audioOn: this.on });
    if (!this.on) setTimeout(() => !this.on && ctx.suspend(), 1800);
  }

  update(_dt?: number) {
    if (!this.on || !this.analyser || !this.data || !this.ctx) {
      state.audioLevel *= 0.9;
      return;
    }
    // quieter when the tab is hidden is automatic (the context throttles); keep the box going
    this.schedule();
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.data.length);
    state.audioLevel += (Math.min(1, rms * 6) - state.audioLevel) * 0.2;
  }
}

function readPref() {
  try {
    return sessionStorage.getItem(PREF) === 'on';
  } catch {
    return false;
  }
}
function writePref(on: boolean) {
  try {
    sessionStorage.setItem(PREF, on ? 'on' : 'off');
  } catch {
    /* no storage: fine */
  }
}
