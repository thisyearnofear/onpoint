/**
 * Runway sound cues — tiny WebAudio synth, no audio assets. Cues are timed
 * to the ScorePaddles flip animation (index * 350ms) and the ~900ms count-up.
 * Preference persists in localStorage; cues only play after a user gesture
 * (the AudioContext is created lazily on first play).
 */

const KEY = "runway:sound";
let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // private mode — session-only preference
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Tone { freq: number; at?: number; dur?: number; type?: OscillatorType; gain?: number }

function tone({ freq, at = 0, dur = 0.12, type = "triangle", gain = 0.1 }: Tone): void {
  if (!soundEnabled()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Three paddle "thocks" timed to the flip animation, then a two-note chime as the total lands. */
export function playReveal(): void {
  [0.14, 0.49, 0.84].forEach((at, i) => tone({ freq: 200 - i * 30, at, dur: 0.09 }));
  tone({ freq: 523.25, at: 1.15, dur: 0.3, type: "sine", gain: 0.07 });
  tone({ freq: 783.99, at: 1.3, dur: 0.4, type: "sine", gain: 0.06 });
}

/** Short rising arpeggio for a duel win or a new personal best. */
export function playWin(): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone({ freq, at: i * 0.09, dur: 0.22, type: "sine", gain: 0.07 }));
}
