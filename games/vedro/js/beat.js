// ─── Слушаем сам трек: бас, общая энергия и доли ─────────────────────────────
// <audio> подключаем к WebAudio через MediaElementSource — после этого звук
// идёт ТОЛЬКО через граф, поэтому обязательно доводим его до destination.
// Источник можно создать ровно один раз на элемент, и делать это надо в
// обработчике жеста пользователя, иначе контекст останется suspended.
//
// Если музыка выключена (или анализатор не завёлся) — отбиваем такт сами,
// чтобы дискотека не гасла: играть без музыки никто не запрещал.
const FALLBACK_BPM = 128;
const MIN_BEAT_GAP = 170;   // мс: быстрее человек долю не услышит
const BASS_BINS = 6;        // ~47..280 Гц при fftSize 1024

export const Beat = {
  ctx: null,
  analyser: null,
  data: null,
  musicOn: false,

  beat: 0,        // 0..1, вспыхивает на долю и затухает
  energy: 0,      // 0..1, сглаженная громкость
  bass: 0,        // 0..1, низ прямо сейчас

  _avg: 0,
  _last: 0,
  _fakeAt: 0,

  /** Вызывать из обработчика клика по «Поехали»: там контекст разлочен. */
  attach(game, audioEl) {
    if (this.analyser) return;
    try {
      this.ctx = game.sound && game.sound.context
        ? game.sound.context
        : new (window.AudioContext || window.webkitAudioContext)();
      const src = this.ctx.createMediaElementSource(audioEl);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.72;
      src.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      // после подключения звук идёт только через граф: спящий контекст —
      // это немая музыка, а не просто отсутствие анализа
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) {
      this.analyser = null;   // не судьба — будем отбивать такт сами
    }
  },

  setMusicOn(on) { this.musicOn = on; },

  /** Раз в кадр. now — время сцены в мс. */
  update(now, dt) {
    this.beat = Math.max(0, this.beat - dt * 3.4);   // затухание вспышки

    if (this.analyser && this.musicOn) {
      this.analyser.getByteFrequencyData(this.data);
      let bass = 0;
      for (let i = 1; i <= BASS_BINS; i++) bass += this.data[i];
      bass /= BASS_BINS * 255;
      let all = 0;
      for (let i = 0; i < this.data.length; i += 4) all += this.data[i];
      all /= (this.data.length / 4) * 255;

      this.bass = bass;
      this.energy += (Math.min(1, all * 2.4) - this.energy) * Math.min(1, dt * 6);
      this._avg += (bass - this._avg) * Math.min(1, dt * 1.6);

      // доля — когда низ заметно выпрыгнул выше собственного среднего
      if (bass > this._avg * 1.32 && bass > 0.22 && now - this._last > MIN_BEAT_GAP) {
        this._last = now;
        this.beat = 1;
      }
      if (all > 0.004) return;                       // сигнал есть, запасной такт не нужен
    }

    // тишина: ровный такт «на глаз», чтобы картинка всё равно дышала
    const step = 60000 / FALLBACK_BPM;
    if (now - this._fakeAt > step) {
      this._fakeAt = now;
      this.beat = 1;
    }
    this.energy += (0.55 - this.energy) * Math.min(1, dt * 2);
    this.bass = 0.4;
  },
};
