// ─── Основная сцена: плита, пропасть, квадрат и растущая толпа ────────────────
import { CONF, DEPTH, PAL } from '../config.js';
import { Beat } from '../beat.js';
import { Debug } from '../debug.js';
import { Sfx } from '../sfx.js';
import { Disco, tripLevel } from '../objects/disco.js';
import { Square } from '../objects/square.js';
import { Crowd } from '../objects/crowd.js';
import { Player } from '../objects/player.js';

const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.groundY = H - CONF.groundH;
    this.touch = this.sys.game.device.input.touch;

    this._buildWorld(W, H);

    this.square = new Square(this, this.groundY);
    this.player = new Player(this, this.groundY, this.square.footLeft);
    this.crowd = new Crowd(this, this.groundY, this.square.footLeft);
    // На узком экране рядов меньше, чем нужно под полную цель: тогда снижаем
    // её, иначе забег станет непроходимым. Запас — на бегущих в этот момент
    this.needed = Math.min(CONF.crowd.needed, Math.floor(this.crowd.capacity / 1.15));
    this.square.needed = this.needed;

    // состояние забега
    this.state = 'play';                            // play | win
    this.ending = null;                             // 'topple' | 'ascend'
    this.elapsed = 0;
    this.left = CONF.timeLimit;                     // сколько секунд осталось
    this.started = false;
    this.peak = 1;
    this.hint = CONF.hints.move;
    this.soloSeen = false;
    this.dustT = 0;
    this.lastForce = 0;
    // scene.restart() переиспользует сам объект сцены, но убивает её детей:
    // всё, что живёт между забегами, обнуляем руками
    this.reported = false;
    this.glow = this.rays = this.dim = this.credo = null;

    // ─── дискотека ───
    this.trip = 0;
    this.huePhase = 0;
    this.hue = 0;
    this.disco = this.registry.get('disco') ? new Disco(this, this.groundY) : null;
    this._mountTrip();

    this._bindInput();
  }

  /**
   * Кислотный пост-эффект вешаем на камеру ЭТОЙ сцены: HUD рисует сцена ui,
   * её камера остаётся трезвой, и цифры на экране читаются.
   */
  _mountTrip() {
    this.tripFx = null;
    const cam = this.cameras.main;
    cam.resetPostPipeline();                        // после restart() старый остаётся
    cam.setZoom(1);
    if (!this.disco || this.game.renderer.type !== Phaser.WEBGL) return;
    cam.setPostPipeline('Trip');
    this.tripFx = cam.getPostPipeline('Trip') || null;
  }

  /** Раз в кадр: слушаем трек и раздуваем мир в такт. */
  _disco(dt, time) {
    if (!this.disco) return;
    Beat.update(time, dt);
    const target = tripLevel(this.square.progress);
    this.trip += (target - this.trip) * Math.min(1, dt * 1.5);
    this.disco.update(dt, this.trip);
    // Цвет не крутим по кругу, а РАСКАЧИВАЕМ: размах маятника растёт вместе
    // с толпой. Вначале мир лишь слегка отливает в сторону и возвращается,
    // под конец уходит на полный круг. Если крутить — даже слабый приход
    // за пару секунд утащит всю палитру, и нарастания не почувствуешь
    this.huePhase += dt * (0.35 + Beat.energy * 0.5 + this.trip * 0.9);
    this.hue = Math.sin(this.huePhase) * Math.PI * this.trip;
    if (this.tripFx) {
      this.tripFx.trip = this.trip;
      this.tripFx.beat = Beat.beat;
      this.tripFx.energy = Beat.energy;
      this.tripFx.hue = this.hue;
    }
    this.cameras.main.setZoom(Disco.pulse(this.trip, CONF.disco.camPulse));
    if (this.square.state === 'stand') {
      this.square.sprite.setScale(CONF.px.square * Disco.pulse(this.trip, CONF.disco.squarePulse));
    }
    const heave = Beat.beat * CONF.disco.crowdHeave * this.trip;
    this.crowd.heave(heave);
    this.player.person.sprite.y = this.groundY - Math.round(heave);
  }

  // ── мир: небо полосами, солнце, облака, плита и чернота за краем ──────────
  _buildWorld(W, H) {
    const horizon = this.groundY;
    const g = this.add.graphics().setDepth(DEPTH.sky);
    const bands = [
      [PAL.skyTop, 0.00], [PAL.skyMid, 0.42], [PAL.skyLow, 0.78],
    ];
    for (let i = 0; i < bands.length; i++) {
      const y0 = Math.round(horizon * bands[i][1]);
      const y1 = i + 1 < bands.length ? Math.round(horizon * bands[i + 1][1]) : horizon;
      g.fillStyle(hex(bands[i][0]), 1);
      g.fillRect(0, y0, W, y1 - y0);
    }
    // дизеринг на стыках полос — честный NES-градиент
    for (let i = 1; i < bands.length; i++) {
      const y = Math.round(horizon * bands[i][1]);
      g.fillStyle(hex(bands[i - 1][0]), 1);
      for (let row = 0; row < 3; row++) {
        for (let x = (row % 2) * 8; x < W; x += 16) g.fillRect(x, y + row * 4, 8, 4);
      }
    }

    // солнце и облака — долями от высоты неба: в портрете его сильно больше
    this.add.image(0.33 * W, 0.2 * horizon, 'sun').setScale(5).setDepth(DEPTH.sky).setAlpha(0.95);
    this.clouds = [];
    for (const [fx, fy, s] of [[0.27, 0.12, 4], [0.58, 0.26, 3], [0.86, 0.09, 5],
                               [0.44, 0.40, 2], [0.14, 0.55, 3], [0.72, 0.62, 2]]) {
      const c = this.add.image(fx * W, fy * horizon, 'cloud').setScale(s).setDepth(DEPTH.sky).setAlpha(0.9);
      this.clouds.push({ img: c, speed: 4 + s * 2 });
    }

    // дальние холмы у горизонта — та сторона пропасти, до которой не дойти
    const hills = this.add.graphics().setDepth(DEPTH.hills);
    for (let x = 0; x < W; x += 8) {
      const top = horizon - 34 - Math.abs(Math.sin(x * 0.011)) * 30 - Math.sin(x * 0.027) * 12;
      hills.fillStyle(hex(PAL.haze), 1);
      hills.fillRect(x, top, 8, horizon - top);
      hills.fillStyle(hex(PAL.hazeDark), 1);
      hills.fillRect(x, top, 8, 4);
    }

    // пропасть: за краем плиты — только темнота
    const ab = this.add.graphics().setDepth(DEPTH.abyss);
    ab.fillStyle(hex(PAL.abyss), 1);
    ab.fillRect(CONF.cliffX, horizon, W - CONF.cliffX, H - horizon);
    ab.fillStyle(hex('#181624'), 1);
    ab.fillRect(CONF.cliffX, horizon, W - CONF.cliffX, 10);
    // дальний берег — чтобы пропасть читалась как пропасть
    ab.fillStyle(hex(PAL.groundDark), 1);
    ab.fillRect(W - 34, horizon + 26, 34, H - horizon - 26);
    ab.fillStyle(hex(PAL.groundDim), 1);
    ab.fillRect(W - 34, horizon + 26, 34, 6);

    this.add.image(0, horizon, 'ground').setOrigin(0, 0).setDepth(DEPTH.ground);
  }

  // ── ввод: клавиши, половинки экрана для тача, чит-коды ────────────────────
  _bindInput() {
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.touchDir = 0;
    const fromPointer = (p) => (p.x < this.scale.width / 2 ? -1 : 1);
    this.input.on('pointerdown', (p) => { this.touchDir = fromPointer(p); });
    this.input.on('pointermove', (p) => { if (p.isDown) this.touchDir = fromPointer(p); });
    this.input.on('pointerup', () => { this.touchDir = 0; });
    this.input.on('gameout', () => { this.touchDir = 0; });

    // чит-коды: копим последние нажатия по e.code — не зависит от раскладки
    this.buf = '';
    this.input.keyboard.on('keydown', (e) => {
      const m = /^Key([A-Z])$/.exec(e.code);
      if (!m) return;
      this.buf = (this.buf + m[1].toLowerCase()).slice(-8);
      if (this.buf.endsWith('lama')) { this.crowd.add(true); this.buf = ''; }
      else if (this.buf.endsWith('square')) { for (let i = 0; i < 40; i++) this.crowd.add(); this.buf = ''; }
      else if (this.buf.endsWith('padai')) { this._win(); this.buf = ''; }
      else if (this.buf.endsWith('dead')) { this._ascend(); this.buf = ''; }
    });
  }

  _dir() {
    if (!window.__squareReady || this.state !== 'play') return 0;
    const k = this.keys;
    if (k.left.isDown || k.a.isDown) return -1;
    if (k.right.isDown || k.d.isDown) return 1;
    return this.touchDir;
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);        // защита от возврата на вкладку

    for (const c of this.clouds) {                  // облакам всё равно
      c.img.x -= c.speed * dt;
      if (c.img.x < -60) c.img.x = this.scale.width + 60;
    }

    this._disco(dt, time);

    if (this.state === 'win') {
      // пока идёт пауза на толпу, квадрат продолжает трястись от натуги,
      // а не расслабляется на глазах
      this.square.update(dt, this.square.state === 'stand' ? this.lastForce : 0);
      this.crowd.party(dt);
      if (this.glow) this._shine(dt);
      if (this.square.gone && !this.reported) {
        this.reported = true;                       // дать полюбоваться финалом
        this.time.delayedCall(this.ending === 'ascend' ? 4200 : 2200, () => this._report());
      }
      return;
    }

    const dir = this._dir();
    if (dir !== 0) this.started = true;
    if (this.started) {
      this.elapsed += dt;
      this.left = Math.max(0, CONF.timeLimit - this.elapsed);
      if (this.left === 0) this._ascend();
    }

    const pushing = this.player.update(dt, dir);
    this.crowd.update(dt, pushing);
    const force = pushing ? 1 + this.crowd.force : 0;
    this.lastForce = force;
    this.peak = Math.max(this.peak, this.crowd.size + 1);

    this.square.update(dt, force);

    // крошка из-под точки опоры, пока квадрат ворочается
    if (this.square.progress > 0.15) {
      this.dustT += dt;
      if (this.dustT > (0.22 - this.square.progress * 0.16) * (this.touch ? 2 : 1)) {
        this.dustT = 0;
        this.square.dust();
      }
    }

    if (force >= this.needed) this._win();

    this._hint(pushing, force);
    Debug.set('состояние', this.state);
    Debug.set('толпа', this.crowd.size);
    Debug.set('сила', force);
    Debug.set('наклон', this.square.tilt.toFixed(1));
    Debug.set('напряжение', (this.square.progress * 100).toFixed(0) + '%');
    Debug.set('цель', this.needed + ' из ' + this.crowd.capacity);
    Debug.set('время', this.elapsed.toFixed(1));
    Debug.set('осталось', this.left.toFixed(1));
    Debug.set('приход', this.trip.toFixed(2) + ' / бит ' + Beat.beat.toFixed(2)
      + ' / энергия ' + Beat.energy.toFixed(2));
  }

  _hint(pushing, force) {
    const C = CONF.hints;
    if (this.left <= 8 && this.started) this.hint = C.hurry;
    else if (this.crowd.size >= 30) this.hint = C.horde;
    else if (pushing && this.crowd.size > 0) this.hint = C.keep;
    else if (pushing) { this.hint = C.solo; this.soloSeen = true; }
    else if (this.player.x >= this.square.footLeft - 80) this.hint = C.push;
    else this.hint = this.soloSeen ? C.keep : C.move;
  }

  /** Финал первый: навалились и уронили. */
  _win() { this._finish('topple'); }

  /** Финал второй: квадрат устало стоять и вознеслось. */
  _ascend() { this._finish('ascend'); }

  /**
   * Общий сценарий финала: сперва пауза на замерший от натуги народ —
   * ради него всё и затевалось, — и только потом квадрат делает своё дело.
   */
  _finish(ending) {
    if (this.state === 'win') return;
    this.state = 'win';
    this.ending = ending;
    this.peak = Math.max(this.peak, this.crowd.size + 1);
    this.crowd.freeze();
    this.player.person.setFrame('stand');
    this.time.delayedCall(CONF.holdBeat, () => {
      if (ending === 'ascend') {
        this.square.ascend();
        this._lightUp();
      } else {
        this.square.topple();
      }
      this.time.delayedCall(450, () => { this.crowd.celebrate(); Sfx.cheer(); });
    });
  }

  /** Свет великой мудрости: ядро, лучи и притихшее небо. Толпа — на свету. */
  _lightUp() {
    const b = this.square.sprite;
    // затемняем только фон: человечков (глубина 10+) свет не должен съесть
    this.dim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0a0820)
      .setOrigin(0, 0).setDepth(DEPTH.dim).setAlpha(0);
    this.tweens.add({ targets: this.dim, alpha: 0.5, duration: 1400 });

    this.credo = this.add.text(this.scale.width * 0.32, this.groundY - 300,
      'МЫ ПОЛЮБИЛИ КВАДРАТ', {
        fontFamily: '"Courier New", ui-monospace, monospace',
        fontSize: '38px', fontStyle: 'bold', color: '#fff6dc', align: 'center',
        wordWrap: { width: this.scale.width * 0.62 },
      })
      .setOrigin(0.5, 1).setDepth(DEPTH.credo).setAlpha(0).setScale(0.7)
      .setStroke('#3a1c00', 7)                    // над толпой текст иначе не прочесть
      .setShadow(0, 0, '#ffb43c', 20, false, true);
    this.tweens.add({
      targets: this.credo, alpha: 1, scale: 1, duration: 900, delay: 900, ease: 'Back.easeOut',
    });

    const cx = b.x - this.square.width * 0.45;
    this.rays = this.add.image(cx, b.y - b.displayHeight * 0.45, 'rays')
      .setDepth(DEPTH.rays).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0);
    this.glow = this.add.image(cx, b.y - b.displayHeight * 0.45, 'glow')
      .setDepth(DEPTH.glow).setBlendMode(Phaser.BlendModes.ADD).setScale(1).setAlpha(0);
    this.tweens.add({ targets: this.rays, scale: 5.5, alpha: 0.85, duration: 1600, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.glow, scale: 4.5, alpha: 0.95, duration: 1200, ease: 'Quad.easeOut' });
  }

  /** Сияние живёт своей жизнью: лучи крутятся, ядро дышит, всё едет за квадратм. */
  _shine(dt) {
    const b = this.square.sprite;
    const cx = b.x - this.square.width * 0.45;
    const cy = b.y - b.displayHeight * 0.45;
    this.rays.setPosition(cx, cy);
    this.glow.setPosition(cx, cy);
    this.rays.rotation += 0.25 * dt;
    this.glow.setAlpha(0.8 + Math.sin(this.time.now / 260) * 0.15);
  }

  _report() {
    this.game.events.emit('square-win', {
      ending: this.ending,
      count: this.peak,
      seconds: Math.max(1, Math.round(this.elapsed)),
    });
  }
}
