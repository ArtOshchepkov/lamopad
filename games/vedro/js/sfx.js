// ─── Звуки: синтезируем на лету, без единого mp3 ─────────────────────────────
// Денди-игре идут пищалки, а ржавому ведру — скрип и грохот. Всё через
// мастер-гейн, чтобы мут SFX работал одной точкой и не зависел от Phaser.
export const Sfx = {
  ctx: null,
  master: null,
  muted: false,
  _creak: null,

  /** Подключаемся к аудиоконтексту Phaser — он уже разлочен первым жестом. */
  init(game) {
    this.ctx = game.sound && game.sound.context ? game.sound.context : null;
    if (!this.ctx) return;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  },

  setMuted(v) {
    this.muted = v;
    if (this.master) this.master.gain.value = v ? 0 : 0.5;
  },

  _ready() {
    if (!this.ctx || this.muted) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  },

  /** Короткий тон с огибающей. type: square/triangle/sawtooth/sine. */
  tone(freq, dur, { type = 'square', vol = 0.3, to = null, delay = 0 } = {}) {
    if (!this._ready()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  /** Шумовой всплеск: шаги, грохот, гул толпы. */
  noise(dur, { vol = 0.25, freq = 900, q = 1, sweepTo = null, delay = 0 } = {}) {
    if (!this._ready()) return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  },

  step()  { this.noise(0.05, { vol: 0.1, freq: 1600, q: 2 }); },
  join()  { this.tone(520, 0.07, { vol: 0.16 }); this.tone(780, 0.07, { vol: 0.14, delay: 0.06 }); },
  grunt() { this.noise(0.13, { vol: 0.16, freq: 380, q: 4, sweepTo: 180 }); },

  /** Скрип ржавого металла — чем сильнее наклон, тем выше и надсаднее. */
  creak(strength) {
    if (!this._ready()) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150 + strength * 220, t0);
    lfo.type = 'square';
    lfo.frequency.value = 24 + strength * 30;       // дребезг
    lfoG.gain.value = 60 + strength * 90;
    lfo.connect(lfoG).connect(osc.frequency);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06 + strength * 0.07, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    osc.connect(f).connect(g).connect(this.master);
    osc.start(t0); lfo.start(t0);
    osc.stop(t0 + 0.45); lfo.stop(t0 + 0.45);
  },

  /** Ведро падает в пропасть: скрежет, затем гулкий удар где-то внизу. */
  topple() {
    this.creak(1);
    this.noise(0.9, { vol: 0.4, freq: 2600, q: 0.8, sweepTo: 140 });
    this.tone(220, 1.1, { type: 'sawtooth', vol: 0.3, to: 40 });
    this.noise(0.7, { vol: 0.35, freq: 220, q: 0.6, sweepTo: 60, delay: 1.05 });
    this.tone(90, 0.8, { type: 'triangle', vol: 0.3, to: 35, delay: 1.05 });
  },

  /** Вознесение: мажорный аккорд, расходящийся вверх, и светлый гул. */
  ascend() {
    this.noise(2.2, { vol: 0.14, freq: 500, q: 0.4, sweepTo: 3400 });
    [262, 330, 392, 523, 659, 784].forEach((f, i) => {
      this.tone(f, 2.4 - i * 0.2, { type: 'triangle', vol: 0.13, delay: i * 0.18 });
      this.tone(f * 2, 1.6, { type: 'sine', vol: 0.07, delay: 0.5 + i * 0.18 });
    });
  },

  /** Ликование толпы + победная денди-фанфара. */
  cheer() {
    this.noise(1.4, { vol: 0.22, freq: 900, q: 0.5, sweepTo: 2200 });
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone(f, 0.16, { vol: 0.2, delay: 0.1 + i * 0.11 }));
    this.tone(1047, 0.5, { vol: 0.22, delay: 0.56 });
  },
};
