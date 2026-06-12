/**
 * soundDesign — tiny cinematic UI sound layer.
 *
 * Off by default; opt-in via the `sb.sound_on` localStorage flag (toggled
 * from Settings → Preferences). When enabled, plays subtle stings on key
 * product moments: shutter on screenshot, dailies-tick on take completion,
 * low chime on project finish, scrubber thunk on slate clap.
 *
 * Designed so adding a new "moment" is one line: `playSound('slate')`.
 *
 * All sources are tiny base64-encoded sine/triangle waveforms generated at
 * load time so we don't ship audio assets. They sound *premium* because
 * they're short, soft, and tuned to the brand musical key (D minor).
 */

type Moment =
  | 'slate'         // brief clapboard tick — used on Production Slate enters / take-card landings
  | 'dailies-tick'  // soft kick when a take completes
  | 'render-done'   // low chime on final video completion
  | 'shutter'       // camera shutter for share / screenshot
  | 'whoosh';       // soft cinematic transition

const KEY = 'smallbridges.sound_on';

let _ctx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return _ctx;
}

export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {}
}

interface ToneSpec {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  decay?: number;
}

const MOMENTS: Record<Moment, ToneSpec[]> = {
  slate: [
    { freq: 880, duration: 0.05, type: 'square', gain: 0.08, decay: 0.05 },
    { freq: 440, duration: 0.06, type: 'square', gain: 0.06, decay: 0.08 },
  ],
  'dailies-tick': [
    { freq: 1320, duration: 0.06, type: 'sine', gain: 0.05, decay: 0.06 },
  ],
  'render-done': [
    { freq: 587.33, duration: 0.18, type: 'sine', gain: 0.06, decay: 0.18 },
    { freq: 880, duration: 0.18, type: 'sine', gain: 0.06, decay: 0.2 },
    { freq: 1175, duration: 0.24, type: 'sine', gain: 0.05, decay: 0.3 },
  ],
  shutter: [
    { freq: 220, duration: 0.04, type: 'triangle', gain: 0.08, decay: 0.04 },
    { freq: 110, duration: 0.05, type: 'triangle', gain: 0.07, decay: 0.06 },
  ],
  whoosh: [
    { freq: 660, duration: 0.18, type: 'sawtooth', gain: 0.04, decay: 0.2 },
    { freq: 220, duration: 0.18, type: 'sawtooth', gain: 0.04, decay: 0.22 },
  ],
};

export function playSound(moment: Moment): void {
  if (!isSoundOn()) return;
  try {
    const ac = ctx();
    if (ac.state === 'suspended') void ac.resume();
    const now = ac.currentTime;
    MOMENTS[moment].forEach((spec, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = spec.type ?? 'sine';
      osc.frequency.value = spec.freq;
      const start = now + i * 0.04;
      const end = start + spec.duration + (spec.decay ?? 0.1);
      g.gain.setValueAtTime(spec.gain ?? 0.06, start);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    });
  } catch {
    // Audio context not allowed yet (no user gesture) — silently no-op.
  }
}
