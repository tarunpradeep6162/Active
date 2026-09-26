import { events, state, store } from '../core/state';

const PREF = 'bday-sound';

/**
 * Original generative sound (no audio files, no existing melodies), all synthesised live:
 *
 * - **A score that follows the journey.** A music box improvises over a gentle four‑chord loop
 *   in D major with a soft pad beneath. Each world changes its colour: sparse and airy under
 *   the opening stars, fuller in the garden, warm and slower by candlelight with a faint
 *   crackle, a lapping lake and wide pad over the lanterns, and a swelling, brighter pad as the
 *   sun rises in the finale.
 * - **Sound for the moments**: a chapter opening, a wax seal breaking, a gift's lid lifting,
 *   candles snuffed, a lantern rising, Door 25 opening, a star touched, light leaks, and the
 *   pops and crackle of fireworks (in the finale and at midnight on her birthday).
 *
 * Off by default; only ever starts from her gesture. If she turned it on, it is remembered for
 * this browser session and resumes on her next tap.
 */

/** named sound effects (see `events.emit('sfx', …)`) */
export type Sfx = 'open' | 'seal' | 'gift' | 'snuff' | 'lantern' | 'door' | 'star' | 'leak' | 'firework' | 'wrong';

/** how each world sounds: tempo, music box and pad levels, pad brightness, ambience */
const MIX: Record<string, { tempo: number; box: number; pad: number; bright: number; water: number; crackle: number; air: number }> = {
  intro: { tempo: 0.7, box: 0.55, pad: 0.026, bright: 1400, water: 0, crackle: 0, air: 0.5 },
  manifesto: { tempo: 0.8, box: 0.7, pad: 0.024, bright: 1200, water: 0, crackle: 0, air: 0.35 },
  work: { tempo: 1, box: 0.9, pad: 0.018, bright: 900, water: 0, crackle: 0, air: 0.15 },
  lab: { tempo: 0.82, box: 0.7, pad: 0.022, bright: 650, water: 0, crackle: 1, air: 0 },
  portal: { tempo: 0.75, box: 0.6, pad: 0.03, bright: 1100, water: 1, crackle: 0, air: 0.25 },
  outro: { tempo: 0.9, box: 0.8, pad: 0.034, bright: 1500, water: 0.55, crackle: 0, air: 0.4 },
};
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
  private padLp: BiquadFilterNode | null = null;
  private water: GainNode | null = null;
  private air: GainNode | null = null;
  private fx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private section = '';
  private tempo = 1;
  private crackle = 0;
  private nextCrackle = 0;
  private nextPop = 0;

  constructor() {
    // chimes for the big moments (only heard while the music is on)
    events.on('lanternWish', () => this.chime(0));
    events.on('blowCandles', () => this.chime(1));
    events.on('wishLight', () => this.chime(2));
    events.on('birthdayMidnight', () => {
      this.chime(2);
      window.setTimeout(() => this.chime(1), 900);
      for (let i = 0; i < 9; i++) window.setTimeout(() => this.sfx('firework'), 2600 + i * 1100 + Math.random() * 500);
    });
    events.on('blowCandles', () => this.sfx('snuff'));
    events.on('lanternWish', () => this.sfx('lantern'));
    events.on('sfx', (k) => this.sfx(k));
    // slow motion: the sound stretches with the picture
    events.on('slowmo', () => this.stretch());
    events.on('blowCandles', () => this.stretch());
    // the film's score: the music follows the shots, and steps back under your voice
    events.on('filmCue', (k) => this.cue(k));
    events.on('duck', (on) => ((this.duckLevel = on ? 0.3 : 1), this.applyLevel(on ? 0.25 : 0.8)));
    events.on('blowCandles', () => {
      if (this.cueLevel < 1) setTimeout(() => ((this.cueLevel = 1.1), this.applyLevel(0.5)), 1200);
    });
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
    this.padLp = padLp;

    // shared noise for the ambiences and the effects
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      brown = (brown + 0.02 * w) / 1.02;
      nd[i] = i % 2 ? w * 0.5 : brown * 3.5; // alternating white and brown: a soft, full noise
    }
    const loop = (filter: BiquadFilterType, f: number, q: number) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      const bq = ctx.createBiquadFilter();
      bq.type = filter;
      bq.frequency.value = f;
      bq.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      s.connect(bq).connect(g);
      s.start();
      return { g, bq };
    };
    // the lake: low water lapping, its level breathing slowly
    const water = loop('lowpass', 420, 0.7);
    const lap = ctx.createOscillator();
    lap.frequency.value = 0.18;
    const lapDepth = ctx.createGain();
    lapDepth.gain.value = 0.35;
    lap.connect(lapDepth).connect(water.bq.frequency);
    lap.start();
    water.g.connect(master);
    this.water = water.g;
    // air: a high, faint shimmer under the stars
    const air = loop('bandpass', 6200, 0.6);
    air.g.connect(master);
    air.g.connect(send);
    this.air = air.g;
    // effects bus (through the room)
    this.fx = ctx.createGain();
    this.fx.gain.value = 1;
    this.fx.connect(master);
    this.fx.connect(send);
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
    const beat = 60 / 66 / 2 / (this.tempo * this.stretchK); // eighth notes at 66 bpm, slower in the quieter worlds
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
    // candlelight: a faint crackle of wicks
    while (this.crackle > 0.01 && this.nextCrackle < ctx.currentTime + 0.25) {
      if (this.nextCrackle < ctx.currentTime) this.nextCrackle = ctx.currentTime;
      this.click(this.nextCrackle, 0.018 * this.crackle * (0.4 + Math.random()));
      this.nextCrackle += 0.08 + Math.random() * Math.random() * 0.9;
    }
    // the finale's fireworks, once her name has formed
    if (state.section === 'outro' && state.finaleLocal > 0.73 && ctx.currentTime > this.nextPop) {
      this.sfx('firework');
      this.nextPop = ctx.currentTime + 1.1 + Math.random() * 1.2;
    }
  }

  /** the mix of the world she is in: crossfaded over a couple of seconds */
  private setSection(id: string) {
    if (id === this.section || !this.ctx) return;
    this.section = id;
    const m = MIX[id] ?? MIX.work;
    const t = this.ctx.currentTime;
    this.tempo = m.tempo;
    this.crackle = m.crackle;
    this.box!.gain.setTargetAtTime(m.box, t, 1.2);
    this.padBus!.gain.setTargetAtTime(m.pad, t, 1.6);
    this.padLp!.frequency.setTargetAtTime(m.bright, t, 1.6);
    this.water!.gain.setTargetAtTime(m.water * 0.09, t, 2);
    this.air!.gain.setTargetAtTime(m.air * 0.012, t, 2);
  }

  /** a tiny wick crackle */
  private click(t: number, v: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const bq = ctx.createBiquadFilter();
    bq.type = 'highpass';
    bq.frequency.value = 2400 + Math.random() * 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.03);
    s.connect(bq).connect(g).connect(this.master!);
    s.start(t, Math.random() * 1.5, 0.06);
  }

  /** a burst of filtered noise with an envelope (the basis of most effects) */
  private hiss(t: number, dur: number, filter: BiquadFilterType, f0: number, f1: number, vol: number, q = 0.8) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bq).connect(g).connect(this.fx!);
    s.start(t, Math.random() * 1.2, dur + 0.1);
  }
  /** a soft sine thump or glide */
  private tone(t: number, f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine') {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.fx!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** the moments' sounds (heard only while the sound is on) */
  sfx(kind: Sfx) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    switch (kind) {
      case 'open': // a chapter unfolding: a soft rising breath of air and a low bloom
        this.hiss(t, 1.1, 'bandpass', 500, 3200, 0.05, 0.9);
        this.tone(t + 0.05, 110, 165, 1.2, 0.05);
        break;
      case 'leak': // light spilling in: a faint high shimmer
        this.hiss(t, 1.6, 'bandpass', 5200, 8800, 0.012, 1.4);
        break;
      case 'seal': // wax cracking: two sharp snaps and a paper rustle
        this.hiss(t, 0.05, 'highpass', 1800, 1500, 0.35);
        this.hiss(t + 0.07, 0.04, 'highpass', 2600, 2200, 0.25);
        this.hiss(t + 0.15, 0.7, 'bandpass', 3800, 1600, 0.04, 0.7);
        break;
      case 'gift': // ribbon slipping, then the lid lifting away with a bright chime
        this.hiss(t, 0.45, 'bandpass', 2800, 5200, 0.05, 1.2);
        this.tone(t + 0.35, 180, 120, 0.25, 0.05);
        this.chime(0);
        break;
      case 'snuff': // candles blown out: a breath, a soft puff
        this.hiss(t, 0.9, 'lowpass', 1400, 300, 0.12);
        this.tone(t + 0.05, 90, 55, 0.4, 0.05);
        break;
      case 'lantern': // a lantern letting go: a warm upward whoosh
        this.hiss(t, 1.4, 'bandpass', 400, 1600, 0.05, 1.1);
        break;
      case 'door': // Door 25: a low wooden give, then light pouring through
        this.tone(t, 70, 58, 0.9, 0.09, 'triangle');
        this.hiss(t + 0.1, 0.5, 'bandpass', 900, 500, 0.05, 3);
        this.hiss(t + 0.6, 3, 'bandpass', 1500, 7000, 0.03, 0.6);
        this.chime(2);
        break;
      case 'star': // a star touched
        this.tine(93 + ((Math.random() * 3) | 0) * 2, t, 0.5);
        break;
      case 'wrong': // not quite: a soft low double knock
        this.tone(t, 150, 120, 0.12, 0.06, 'triangle');
        this.tone(t + 0.13, 140, 110, 0.14, 0.05, 'triangle');
        break;
      case 'firework': { // a distant launch, a soft pop, then a sparkle of crackle
        const p = t + 0.6 + Math.random() * 0.3;
        this.hiss(t, 0.6, 'bandpass', 700, 2600, 0.02, 1.4);
        this.tone(p, 120, 45, 0.5, 0.11);
        this.hiss(p, 0.25, 'lowpass', 1800, 300, 0.1);
        for (let i = 0; i < 12; i++) this.click(p + 0.25 + Math.random() * 1.1, 0.02 + Math.random() * 0.03);
        break;
      }
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
    this.master!.gain.setTargetAtTime(this.on ? 0.9 * this.cueLevel * this.duckLevel : 0, t, 0.5);
    store.set({ audioOn: this.on });
    if (!this.on) setTimeout(() => !this.on && ctx.suspend(), 1800);
  }

  private stretchK = 1;
  /** time slows: the notes spread out and the room goes muffled, then it all comes back */
  private stretch() {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const m = MIX[this.section] ?? MIX.work;
    this.stretchK = 0.45;
    this.padLp!.frequency.setTargetAtTime(380, t, 0.12);
    this.padLp!.frequency.setTargetAtTime(m.bright, t + 1.7, 0.5);
    setTimeout(() => (this.stretchK = 1), 2200);
  }

  private cueLevel = 1;
  private duckLevel = 1;
  private applyLevel(tc = 0.6) {
    if (!this.ctx || !this.on) return;
    this.master!.gain.setTargetAtTime(0.9 * this.cueLevel * this.duckLevel, this.ctx.currentTime, tc);
  }

  /**
   * A cue from the film: rise (the music gathers as the cage opens) · hush (a held breath
   * before the candles) · swell (the sunrise) · end (the credits) · reset (the film stopped).
   */
  cue(k: 'rise' | 'hush' | 'swell' | 'end' | 'reset') {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime + 0.5;
    const m = MIX[this.section] ?? MIX.work;
    if (k === 'rise') {
      this.cueLevel = 1.1;
      this.padBus!.gain.setTargetAtTime(m.pad * 2.2, t, 2.5);
      this.padLp!.frequency.setTargetAtTime(Math.max(m.bright, 2200), t, 2.5);
    } else if (k === 'hush') {
      this.cueLevel = 0.22;
    } else if (k === 'swell') {
      this.cueLevel = 1.2;
      this.padBus!.gain.setTargetAtTime(m.pad * 3, t, 4);
      this.padLp!.frequency.setTargetAtTime(3200, t, 4);
      this.chime(2);
    } else if (k === 'end') {
      this.cueLevel = 0.75;
      this.padLp!.frequency.setTargetAtTime(1200, t, 3);
    } else {
      this.cueLevel = 1;
      this.section = '';
    }
    this.applyLevel(k === 'hush' ? 0.35 : 1.2);
  }

  update(_dt?: number) {
    if (!this.on || !this.analyser || !this.data || !this.ctx) {
      state.audioLevel *= 0.9;
      return;
    }
    // quieter when the tab is hidden is automatic (the context throttles); keep the box going
    this.setSection(state.section);
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
