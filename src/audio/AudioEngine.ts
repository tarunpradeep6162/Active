import { state, store } from '../core/state';

/**
 * Original generative ambient bed (no audio files): detuned pad through a slowly
 * swept filter, soft noise wind and sparse bell pings into a feedback delay.
 * Off by default; only starts from a user gesture.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;
  private pingTimer = 0;
  private on = false;

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

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 3;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 380;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    const pad = ctx.createGain();
    pad.gain.value = 0.05;
    filter.connect(pad).connect(master);
    [55, 82.41, 110, 164.81].forEach((f, i) => {
      for (const d of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = f;
        o.detune.value = d + i * 2;
        o.connect(filter);
        o.start();
      }
    });
    // wind
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.012;
    noise.connect(bp).connect(ng).connect(master);
    noise.start();
    // delay for pings
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.45;
    delay.connect(fb).connect(delay);
    delay.connect(master);
    this.delay = delay;
  }
  private delay: DelayNode | null = null;

  private ping() {
    const ctx = this.ctx!;
    const scale = [440, 523.25, 587.33, 659.25, 783.99, 880];
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = scale[(Math.random() * scale.length) | 0] * (Math.random() < 0.3 ? 0.5 : 1);
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g);
    g.connect(this.master!);
    g.connect(this.delay!);
    o.start(t);
    o.stop(t + 2.3);
  }

  async toggle() {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    this.on = !this.on;
    if (this.on) await ctx.resume();
    const t = ctx.currentTime;
    this.master!.gain.cancelScheduledValues(t);
    this.master!.gain.setTargetAtTime(this.on ? 0.9 : 0, t, 0.4);
    store.set({ audioOn: this.on });
    if (!this.on) setTimeout(() => !this.on && ctx.suspend(), 1500);
  }

  update(dt: number) {
    if (!this.on || !this.analyser || !this.data) {
      state.audioLevel *= 0.9;
      return;
    }
    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.ping();
      this.pingTimer = 1.6 + Math.random() * 3.5 - Math.min(Math.abs(state.scroll.velocity), 2) * 0.6;
    }
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
