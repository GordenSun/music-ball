import { mulberry32 } from './level.js';

// partials: [frequency ratio, amplitude, decay seconds]
const INST = {
  keys: { gain: 0.5, att: 0.004, p: [[1, 1, 1.5], [2, 0.42, 1.1], [3, 0.17, 0.75], [4, 0.08, 0.5], [6, 0.03, 0.3]] },
  musicbox: { gain: 0.5, att: 0.002, p: [[1, 1, 1.7], [2, 0.18, 0.9], [4, 0.3, 0.4], [5.4, 0.1, 0.22]] },
  glass: { gain: 0.55, att: 0.003, p: [[1, 1, 1.2], [3, 0.26, 0.55], [6.2, 0.09, 0.28]] },
  bell: { gain: 0.42, att: 0.002, p: [[1, 1, 2.0], [2.76, 0.36, 1.1], [5.4, 0.16, 0.55], [8.9, 0.06, 0.3]] },
  pluck: { gain: 0.5, att: 0.003, p: [[1, 1, 0.8], [2, 0.5, 0.5], [3, 0.3, 0.32], [4, 0.16, 0.22], [5, 0.08, 0.16]] },
  marimba: { gain: 0.7, att: 0.003, p: [[1, 1, 0.6], [4, 0.32, 0.16], [10, 0.06, 0.07]] },
};

function noiseBuffer(ctx, seconds, seed, shape) {
  const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  const rnd = mulberry32(seed);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * shape(i / n);
  }
  return buf;
}

export class Synth {
  constructor(ctx) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.volume = ctx.createGain();
    this.volume.gain.value = 1.15;
    comp.connect(this.volume).connect(ctx.destination);
    this.dry = ctx.createGain();
    this.dry.connect(comp);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = noiseBuffer(ctx, 1.8, 20261, (u) => Math.pow(1 - u, 2.6));
    const wet = ctx.createGain();
    wet.gain.value = 0.2;
    this.reverb.connect(wet).connect(comp);
    this.noise = noiseBuffer(ctx, 1.5, 977, () => 1);
  }

  bus() {
    const g = this.ctx.createGain();
    g.connect(this.dry);
    g.connect(this.reverb);
    return g;
  }

  play(ev, when, bus) {
    if (ev.type === 'note') this.note(ev, when, bus);
    else this.roll(ev, when, bus);
  }

  note(ev, when, bus) {
    const ctx = this.ctx, I = INST[ev.inst], f = 440 * Math.pow(2, (ev.midi - 69) / 12);
    const out = ctx.createGain();
    out.gain.value = I.gain * ev.vel * 0.42;
    out.connect(bus);
    const ds = Math.pow(440 / f, 0.35);
    for (const [ratio, amp, dec] of I.p) {
      const fr = f * ratio;
      if (fr > 11000) continue;
      const osc = ctx.createOscillator(), env = ctx.createGain(), d = dec * ds;
      osc.frequency.value = fr;
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(amp, when + I.att);
      env.gain.setTargetAtTime(0, when + I.att, d / 4.5);
      osc.connect(env).connect(out);
      osc.start(when);
      osc.stop(when + d * 1.7 + 0.05);
    }
    const tick = ctx.createBufferSource(), tf = ctx.createBiquadFilter(), tg = ctx.createGain();
    tick.buffer = this.noise;
    tf.type = 'bandpass'; tf.frequency.value = 2600; tf.Q.value = 0.9;
    tg.gain.setValueAtTime(0.5 * ev.vel, when);
    tg.gain.exponentialRampToValueAtTime(0.001, when + 0.035);
    tick.connect(tf).connect(tg).connect(out);
    tick.start(when, (ev.midi * 0.013) % 1, 0.05);
  }

  roll(ev, when, bus) {
    const ctx = this.ctx, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true;
    bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(500, when);
    bp.frequency.linearRampToValueAtTime(1300, when + ev.dur * 0.55);
    bp.frequency.linearRampToValueAtTime(800, when + ev.dur);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.075, when + 0.06);
    g.gain.setValueAtTime(0.075, when + ev.dur - 0.05);
    g.gain.linearRampToValueAtTime(0, when + ev.dur + 0.04);
    src.connect(bp).connect(g).connect(bus);
    src.start(when);
    src.stop(when + ev.dur + 0.06);
  }
}

// Realtime player: the audio clock is the master clock.
export class Player {
  constructor(level) {
    this.level = level;
    this.rate = 1;
    this.playing = false;
    this.tau = 0;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.synth = new Synth(this.ctx);
      this.synth.volume.gain.value = this.muted ? 0 : 1.15;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setLevel(level) { this.level = level; this.seek(0); }

  setMuted(m) {
    this.muted = m;
    if (this.synth) this.synth.volume.gain.setTargetAtTime(m ? 0 : 1.15, this.ctx.currentTime, 0.02);
  }

  setRate(r) { const t = this.now(); this.rate = r; this.seek(t); }

  play() {
    this.ensure();
    this.playing = true;
    this.anchor(this.tau);
  }

  pause() {
    this.tau = this.now();
    this.playing = false;
    this.cut();
  }

  seek(tau) {
    const T = this.level.T;
    this.tau = ((tau % T) + T) % T;
    if (this.playing) this.anchor(this.tau);
  }

  cut() {
    if (!this.busNode) return;
    const g = this.busNode, t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0, t, 0.015);
    setTimeout(() => g.disconnect(), 250);
    this.busNode = null;
  }

  anchor(tau) {
    this.cut();
    this.busNode = this.synth.bus();
    this.t0 = this.ctx.currentTime + 0.06;
    this.s0 = tau;
    const ev = this.level.events;
    this.next = ev.findIndex(e => e.t >= tau - 1e-6);
    this.cycle = 0;
    if (this.next < 0) { this.next = 0; this.cycle = 1; }
  }

  // Unwrapped song time (seconds since anchor point, in level time).
  now() {
    if (!this.playing) return this.tau;
    const T = this.level.T;
    const s = this.s0 + Math.max(0, this.ctx.currentTime - this.t0) * this.rate;
    return s % T;
  }

  // Call every frame: schedules upcoming events and returns current tau.
  tick() {
    if (!this.playing) return this.tau;
    const T = this.level.T, ev = this.level.events;
    const s = this.s0 + (this.ctx.currentTime - this.t0) * this.rate;
    const horizon = s + 0.3 * this.rate;
    for (let guard = 0; guard < 64; guard++) {
      const e = ev[this.next], abs = this.cycle * T + e.t;
      if (abs > horizon) break;
      this.synth.play(e, this.t0 + (abs - this.s0) / this.rate, this.busNode);
      if (++this.next >= ev.length) { this.next = 0; this.cycle++; }
    }
    return Math.max(0, s) % T;
  }
}

function wav(channels, sampleRate) {
  const n = channels[0].length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 2; c++) {
      v.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, channels[c][i])) * 32767, true);
    }
  }
  return new Uint8Array(buf);
}

// Offline render of exactly one loop, starting at tauStart. Two cycles are rendered and the
// second one is kept so the tail of the last note carries over the loop point.
export async function renderLoop(level, tauStart = 0, sampleRate = 48000) {
  const T = level.T, start = T + tauStart;
  const ctx = new OfflineAudioContext(2, Math.ceil((start + T) * sampleRate), sampleRate);
  const synth = new Synth(ctx), bus = synth.bus();
  for (let c = 0; c < 3; c++) {
    for (const e of level.events) {
      const when = c * T + e.t;
      if (when < start + T) synth.play(e, when, bus);
    }
  }
  const out = await ctx.startRendering();
  const a = Math.round(start * sampleRate), n = Math.round(T * sampleRate);
  return wav([out.getChannelData(0).subarray(a, a + n), out.getChannelData(1).subarray(a, a + n)], sampleRate);
}
