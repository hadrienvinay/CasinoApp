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

// --- MP3 playback ---

const mp3Cache: Record<string, HTMLAudioElement> = {};

function preload(src: string): HTMLAudioElement {
  if (!mp3Cache[src]) {
    const el = new Audio(src);
    el.preload = 'auto';
    mp3Cache[src] = el;
  }
  return mp3Cache[src];
}

function playMp3(src: string, volume = 1.0) {
  if (typeof window === 'undefined') return;
  const base = preload(src);
  // Clone so rapid successive calls overlap cleanly
  const audio = base.cloneNode() as HTMLAudioElement;
  audio.volume = Math.min(1, masterVolume * volume);
  audio.play().catch(() => {});
}

export function setVolume(v: number) {
  masterVolume = Math.max(0, Math.min(1, v));
}

export function getVolume(): number {
  return masterVolume;
}

function gainNode(ctx: AudioContext, volume: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = volume * masterVolume;
  return g;
}

// --- Sound effects ---

/** Card sliding from deck — uses deal.mp3 */
export function playCardDeal() {
  playMp3('/assets/cards/deal.mp3', 0.5);
}

/** Card flip — uses turn.mp3 */
export function playCardFlip() {
  playMp3('/assets/cards/turn.mp3', 0.5);
}

/** Chip bet / call — uses bet.mp3 */
export function playChipBet() {
  playMp3('/assets/chips/bet.mp3', 0.25);
}

/** Raise — uses raise.mp3 */
export function playRaise() {
  playMp3('/assets/chips/raise.mp3', 0.5);
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
  playMp3('/assets/cards/check2.mp3', 0.7);

  /*const ctx = getCtx();
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
    */
  }

/** Fold — uses fold.mp3 */
export function playFold() {
  playMp3('/assets/cards/fold.mp3', 0.3);
}

/** All-in (aggressive) — uses all-in.mp3 */
export function playAllIn() {
  playMp3('/assets/ui/all-in.mp3', 0.5);
}

/** Call an all-in — uses call-all-in.mp3 */
export function playCallAllIn() {
  playMp3('/assets/ui/call-all-in.mp3', 0.5);
}

/** Game start — multiplayer */
export function playGameStart() {
  playMp3('/assets/ui/hawai.mp3', 0.8);
}

/** Defeat — player eliminated */
export function playDefeat() {
  playMp3('/assets/ui/perdu.mp3', 0.8);
}

/** Con — human wins all-in and eliminates an opponent */
export function playCon() {
  playMp3('/assets/ui/con.mp3', 0.8);
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
