/**
 * Synthetic sound effects using Web Audio API.
 * Softer, warmer sounds — filtered noise and low-frequency tones
 * to feel more like a real poker table than electronic beeps.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Master volume (0-1)
let masterVolume = 0.35;

export function setVolume(v: number) {
  masterVolume = Math.max(0, Math.min(1, v));
}

export function getVolume(): number {
  return masterVolume;
}

// --- Noise helpers ---

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function gainNode(ctx: AudioContext, volume: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = volume * masterVolume;
  return g;
}

// --- Sound effects ---

/** Card sliding from deck — soft paper swoosh */
export function playCardDeal() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.15);

  // Lower bandpass for a warmer paper sound
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.5;

  // Gentle lowpass to remove harsh highs
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3000;

  const g = gainNode(ctx, 0.18);
  g.gain.setValueAtTime(0.18 * masterVolume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  noise.connect(filter);
  filter.connect(lp);
  lp.connect(g);
  g.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.15);
}

/** Card flip — soft thud */
export function playCardFlip() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Soft thump instead of sharp click
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);

  const g = gainNode(ctx, 0.12);
  g.gain.setValueAtTime(0.12 * masterVolume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  // Gentle noise for texture
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.06);
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 1200;
  nf.Q.value = 0.4;
  const ng = gainNode(ctx, 0.08);
  ng.gain.setValueAtTime(0.08 * masterVolume, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(g);
  g.connect(ctx.destination);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.08);
  noise.start(now);
  noise.stop(now + 0.06);
}

/** Chip bet — soft ceramic clink */
export function playChipBet() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Lower, warmer tones for a ceramic chip feel
  const freqs = [1200, 1800];
  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2500;

    const g = gainNode(ctx, 0.08);
    g.gain.setValueAtTime(0.08 * masterVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Soft noise thud for the landing
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.04);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 1500;
  const ng = gainNode(ctx, 0.1);
  ng.gain.setValueAtTime(0.1 * masterVolume, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.04);
}

/** Chips win — gentle cascade of soft clinks */
export function playChipsWin() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  for (let i = 0; i < 5; i++) {
    const t = now + i * 0.09;
    const freq = 800 + Math.random() * 800;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2000;

    const g = gainNode(ctx, 0.07);
    g.gain.setValueAtTime(0.07 * masterVolume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}

/** Check — gentle double tap */
export function playCheck() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.12;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(250, t + 0.06);

    const g = gainNode(ctx, 0.1);
    g.gain.setValueAtTime(0.1 * masterVolume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }
}

/** Fold — very soft swoosh */
export function playFold() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.3);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1500, now);
  filter.frequency.exponentialRampToValueAtTime(150, now + 0.25);

  const g = gainNode(ctx, 0.1);
  g.gain.setValueAtTime(0.1 * masterVolume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  noise.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.3);
}

/** All-in — warm rising tone + soft thud */
export function playAllIn() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Warm rising tone (sine instead of sawtooth)
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(500, now + 0.25);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;

  const g = gainNode(ctx, 0.1);
  g.gain.setValueAtTime(0.03 * masterVolume, now);
  g.gain.linearRampToValueAtTime(0.1 * masterVolume, now + 0.18);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(lp);
  lp.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);

  // Soft low thud
  const impact = ctx.createOscillator();
  impact.type = 'sine';
  impact.frequency.setValueAtTime(120, now + 0.22);
  impact.frequency.exponentialRampToValueAtTime(50, now + 0.5);

  const ig = gainNode(ctx, 0.15);
  ig.gain.setValueAtTime(0.15 * masterVolume, now + 0.22);
  ig.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  impact.connect(ig);
  ig.connect(ctx.destination);
  impact.start(now + 0.22);
  impact.stop(now + 0.5);
}

/** Win notification — warm ascending chime */
export function playWinChime() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const notes = [392, 494, 587, 784]; // G4 B4 D5 G5 — warmer register
  notes.forEach((freq, i) => {
    const t = now + i * 0.15;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2000;

    const g = gainNode(ctx, 0.1);
    g.gain.setValueAtTime(0.1 * masterVolume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}
