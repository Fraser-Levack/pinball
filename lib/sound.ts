// Synthesised sound effects, one per game event (see `sound` on features and g.events).
// Everything is generated with WebAudio, so there are no audio files to load.
// To give a new feature a sound, add an entry to SOUNDS and pass its name as the feature's `sound`.

type Synth = (s: Sound, t: number) => void;

const SOUNDS: Record<string, Synth> = {
  flip: (s, t) => {
    s.noise(t, 0.05, 0.18, 1800);
    s.tone(t, 0.05, 110, 60, "square", 0.12);
  },
  flipper: (s, t) => s.tone(t, 0.06, 180, 90, "triangle", 0.2),
  bumper: (s, t) => {
    s.tone(t, 0.1, 620, 240, "square", 0.14);
    s.noise(t, 0.04, 0.15, 3000);
  },
  sling: (s, t) => s.tone(t, 0.07, 340, 160, "square", 0.12),
  rollover: (s, t) => {
    s.tone(t, 0.07, 990, 990, "sine", 0.18);
    s.tone(t + 0.06, 0.09, 1320, 1320, "sine", 0.18);
  },
  target: (s, t) => s.tone(t, 0.06, 760, 700, "square", 0.12),
  drop: (s, t) => {
    s.tone(t, 0.12, 260, 90, "square", 0.16);
    s.noise(t, 0.06, 0.12, 900);
  },
  spinner: (s, t) => s.tone(t, 0.02, 2200, 1800, "triangle", 0.08),
  saucer: (s, t) => s.tone(t, 0.35, 180, 720, "sawtooth", 0.1),
  kick: (s, t) => {
    s.noise(t, 0.08, 0.2, 700);
    s.tone(t, 0.1, 140, 70, "square", 0.15);
  },
  launch: (s, t) => {
    s.noise(t, 0.25, 0.15, 1200);
    s.tone(t, 0.25, 120, 520, "sawtooth", 0.1);
  },
  kickback: (s, t) => {
    s.noise(t, 0.15, 0.25, 900);
    s.tone(t, 0.3, 150, 900, "sawtooth", 0.12);
  },
  goal: (s, t) => s.arpeggio(t, [523, 659, 784, 1047], 0.07, "square", 0.12),
  multiball: (s, t) => {
    s.arpeggio(t, [523, 659, 784, 1047, 784, 1047, 1319], 0.08, "square", 0.13);
  },
  bonus: (s, t) => s.arpeggio(t, [784, 988, 1175, 1568], 0.08, "triangle", 0.2),
  drain: (s, t) => {
    s.tone(t, 0.7, 420, 60, "sawtooth", 0.14);
    s.noise(t, 0.4, 0.08, 400);
  },
  start: (s, t) => s.arpeggio(t, [262, 330, 392, 523], 0.06, "square", 0.12),
  gameover: (s, t) => s.arpeggio(t, [523, 392, 330, 262, 196], 0.16, "triangle", 0.22),
};

const MIN_GAP = 0.03; // seconds between repeats of the same sound, so rapid hits don't pile up

export class Sound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private last = new Map<string, number>();
  muted = false;

  /** Browsers only allow audio after the player interacts with the page; call this on input. */
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.5;
      this.out.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  get ready() {
    return this.ctx?.state === "running";
  }

  play(name: string) {
    const synth = SOUNDS[name];
    if (!synth || this.muted || !this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    if (t - (this.last.get(name) ?? -1) < MIN_GAP) return;
    this.last.set(name, t);
    synth(this, t);
  }

  /** A pitch sweep from `f0` to `f1` Hz with a quick attack and exponential decay. */
  tone(t: number, dur: number, f0: number, f1: number, type: OscillatorType, vol: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.out!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A burst of filtered white noise: clicks, thumps and whooshes. */
  noise(t: number, dur: number, vol: number, cutoff: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.out!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Notes played one after another. */
  arpeggio(t: number, freqs: number[], step: number, type: OscillatorType, vol: number) {
    freqs.forEach((f, i) => this.tone(t + i * step, step * 1.6, f, f, type, vol));
  }
}
