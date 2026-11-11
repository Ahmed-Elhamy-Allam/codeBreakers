/**
 * Synthesized game effects and background music with shared mute/volume controls.
 */

type SoundName =
  | 'key'
  | 'lockIn'
  | 'submit'
  | 'wrong'
  | 'alarm'
  | 'win'
  | 'lose'
  | 'hint'
  | 'boost'
  | 'sabotage'
  | 'click'
  | 'countdown';

class SoundServiceImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;
  private _volume = 0.6;
  private music: HTMLAudioElement | null = null;

  private resumeMusic = (): void => {
    if (this.music && !this._muted && this.music.paused) {
      // Autoplay may be blocked until a click or key press; retry on interaction.
      void this.music.play().catch(() => {});
    }
  };

  startMusic(src: string): void {
    this.stopMusic();
    this.music = new Audio(src);
    this.music.loop = true;
    this.music.volume = this._volume;
    this.music.muted = this._muted;
    window.addEventListener('click', this.resumeMusic);
    window.addEventListener('keydown', this.resumeMusic);
    this.resumeMusic();
  }

  stopMusic(): void {
    window.removeEventListener('click', this.resumeMusic);
    window.removeEventListener('keydown', this.resumeMusic);
    if (this.music) {
      this.music.pause();
      this.music.removeAttribute('src');
      this.music.load();
      this.music = null;
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  get volume(): number {
    return this._volume;
  }

  /** Must be called from a user gesture to unlock audio on browsers. */
  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : this._volume;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.music) this.music.muted = muted;
    if (!muted) this.resumeMusic();
    if (this.master) {
      this.master.gain.value = muted ? 0 : this._volume;
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.music) this.music.volume = this._volume;
    if (this.master && !this._muted) this.master.gain.value = this._volume;
  }

  // ---- Low-level synth helpers ----

  private now(): number {
    return this.ctx!.currentTime;
  }

  private tone(opts: {
    freq: number;
    type?: OscillatorType;
    start?: number;
    duration: number;
    gain?: number;
    sweepTo?: number;
    attack?: number;
  }): void {
    if (!this.ctx || !this.master) return;
    const { freq, type = 'square', duration, gain = 0.3, sweepTo, attack = 0.005 } = opts;
    const start = this.now() + (opts.start ?? 0);

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (sweepTo != null) osc.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);

    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(opts: { duration: number; gain?: number; start?: number; hp?: number }): void {
    if (!this.ctx || !this.master) return;
    const { duration, gain = 0.2, hp = 1000 } = opts;
    const start = this.now() + (opts.start ?? 0);
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    src.start(start);
    src.stop(start + duration);
  }

  // ---- Public sounds ----

  play(name: SoundName): void {
    if (!this.ctx) this.init();
    if (!this.ctx || this._muted) return;
    void this.ctx.resume();

    switch (name) {
      case 'key':
        // Mechanical keyboard click: short noise burst + low thock.
        this.noise({ duration: 0.03, gain: 0.15, hp: 2500 });
        this.tone({ freq: 180, type: 'square', duration: 0.04, gain: 0.12 });
        break;

      case 'click':
        this.tone({ freq: 660, type: 'triangle', duration: 0.05, gain: 0.18 });
        break;

      case 'lockIn':
        // Sci-fi lock-in: rising beep then metallic clank.
        this.tone({ freq: 500, type: 'sawtooth', duration: 0.12, gain: 0.25, sweepTo: 1200 });
        this.tone({ freq: 1600, type: 'square', duration: 0.08, gain: 0.2, start: 0.1 });
        this.noise({ duration: 0.06, gain: 0.1, hp: 3000, start: 0.1 });
        break;

      case 'submit':
        this.tone({ freq: 400, type: 'square', duration: 0.08, gain: 0.2, sweepTo: 520 });
        break;

      case 'wrong':
        // Descending error buzz + screen-shake companion.
        this.tone({ freq: 220, type: 'sawtooth', duration: 0.25, gain: 0.28, sweepTo: 90 });
        this.tone({ freq: 160, type: 'square', duration: 0.25, gain: 0.18, sweepTo: 70 });
        break;

      case 'alarm':
        // Two-tone urgent alarm.
        this.tone({ freq: 880, type: 'square', duration: 0.18, gain: 0.22 });
        this.tone({ freq: 660, type: 'square', duration: 0.18, gain: 0.22, start: 0.2 });
        break;

      case 'countdown':
        this.tone({ freq: 1000, type: 'sine', duration: 0.1, gain: 0.25 });
        break;

      case 'hint':
        this.tone({ freq: 700, type: 'triangle', duration: 0.1, gain: 0.2, sweepTo: 1000 });
        this.tone({ freq: 1000, type: 'triangle', duration: 0.12, gain: 0.18, start: 0.1 });
        break;

      case 'boost':
        // Triumphant rising arpeggio.
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone({ freq: f, type: 'triangle', duration: 0.12, gain: 0.22, start: i * 0.07 }),
        );
        break;

      case 'sabotage':
        // Dark descending glitch.
        [700, 500, 350, 200].forEach((f, i) =>
          this.tone({ freq: f, type: 'sawtooth', duration: 0.1, gain: 0.22, start: i * 0.06 }),
        );
        this.noise({ duration: 0.3, gain: 0.08, hp: 800, start: 0.1 });
        break;

      case 'win':
        // Victory fanfare: C-E-G-C-G-C major run.
        [
          [523, 0],
          [659, 0.12],
          [784, 0.24],
          [1047, 0.36],
          [784, 0.5],
          [1047, 0.62],
          [1319, 0.78],
        ].forEach(([f, t]) =>
          this.tone({ freq: f, type: 'triangle', duration: 0.3, gain: 0.25, start: t }),
        );
        break;

      case 'lose':
        // Defeat buzzer: wah-wah-wahhh.
        [
          [330, 0],
          [294, 0.25],
          [262, 0.5],
          [196, 0.78],
        ].forEach(([f, t]) =>
          this.tone({ freq: f, type: 'sawtooth', duration: 0.35, gain: 0.26, start: t }),
        );
        break;
    }
  }
}

export const sound = new SoundServiceImpl();
