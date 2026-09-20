// ─── Ведро: очень большое, очень ржавое, очень упрямое ──────────────────────
// Крутится вокруг нижнего правого угла — это точка опоры на самом краю.
// Наклон тянется к цели, которую задаёт суммарная сила толкающих: одному
// хватает только на дрожание, толпе — на опрокидывание.
import { CONF, PAL } from '../config.js';
import { Sfx } from '../sfx.js';

const CREAK_MS = 420;
const CHARGE_S = 0.9;                             // сколько ведро копит благодать перед взлётом

export class Bucket {
  constructor(scene, groundY) {
    this.scene = scene;
    this.groundY = groundY;
    // Низ ведра уже верха, поэтому точка опоры — не угол текстуры, а угол
    // самой трапеции: иначе при наклоне ведро «отрывается» от края обрыва.
    const originX = (CONF.bucket.texW - CONF.bucket.botInset) / CONF.bucket.texW;
    this.sprite = scene.add.image(CONF.cliffX, groundY + 2, 'bucket')
      .setOrigin(originX, 1)
      .setScale(CONF.px.bucket)
      .setDepth(15);
    this.width = CONF.bucket.texW * CONF.px.bucket;
    this.left = CONF.cliffX - originX * this.width;
    // Упираются в низ ведра: он на botInset правее верхней кромки, и именно
    // туда достают руки человечка ростом в одну десятую ведра.
    this.footLeft = this.left + CONF.bucket.botInset * CONF.px.bucket;
    this.tilt = 0;                                  // градусы
    this.progress = 0;                              // 0..1 — сколько набрали
    this.state = 'stand';                           // stand | topple | fall | ascend
    this.creakT = 0;
    this.wobbleT = 0;
    this.fallVX = 0;
    this.fallVY = 0;
    this.spin = 0;
    this.ascendV = 0;
    this.hovering = false;
    this.chargeT = 0;
    // Возносясь, ведро уменьшается — уходит ввысь, а не просто едет вверх.
    // Зависнуть должно над толпой, но целиком в кадре: отсюда обе границы
    this.ascendScale = CONF.px.bucket * 0.52;
    const finalH = CONF.bucket.texH * this.ascendScale;
    this.hoverY = Math.max(24 + finalH, groundY - 400);
  }

  /** force — сколько человечков реально упирается прямо сейчас. */
  update(dt, force) {
    const B = CONF.bucket;

    if (this.state === 'ascend') {
      this.tilt += (0 - this.tilt) * Math.min(1, 3 * dt);
      const target = this.hoverY + Math.sin(this.scene.time.now / 900) * 12;

      // сперва ведро набирает благодать: стоит на месте и мелко дрожит
      if (this.chargeT < CHARGE_S) {
        this.chargeT += dt;
        const k = this.chargeT / CHARGE_S;
        this.sprite.y = this.startY - k * 10;
        this.sprite.x = CONF.cliffX + Math.sin(this.chargeT * 46) * (1 + k * 4);
        this.sprite.setAngle(Math.sin(this.chargeT * 38) * (0.6 + k * 1.6));
        return;
      }
      this.sprite.x = CONF.cliffX;

      if (!this.hovering) {
        this.ascendV = Math.min(200, this.ascendV + 62 * dt);
        this.sprite.y = Math.max(target, this.sprite.y - this.ascendV * dt);
        const k = Math.min(1, (this.startY - this.sprite.y) / (this.startY - this.hoverY));
        this.sprite.setScale(CONF.px.bucket + (this.ascendScale - CONF.px.bucket) * k);
        if (this.sprite.y <= target + 1) this.hovering = true;
      } else {
        this.sprite.y += (target - this.sprite.y) * Math.min(1, 2.5 * dt);
      }
      // медленный поворот в воздухе: ведро больше никому ничего не должно
      this.sprite.setAngle(this.tilt + Math.sin(this.scene.time.now / 560) * 3.2);
      return;
    }

    if (this.state === 'fall') {
      this.fallVY += 2200 * dt;
      this.sprite.x += this.fallVX * dt;
      this.sprite.y += this.fallVY * dt;
      this.sprite.rotation += this.spin * dt;
      return;
    }

    if (this.state === 'topple') {
      this.tilt += (5 + this.tilt * 0.95) * dt;     // точка невозврата пройдена
      this.sprite.setAngle(this.tilt);
      if (this.tilt > CONF.bucket.fallAt) {
        this.state = 'fall';
        this.fallVX = 90;
        this.fallVY = 40;
        this.spin = 2.4;
      }
      return;
    }

    const prog = force > 0 ? Math.min(1, force / CONF.crowd.needed) : 0;
    this.progress = prog;
    const target = force > 0
      ? B.soloWobble + (B.maxLean - B.soloWobble) * Math.pow(prog, 1.15)
      : 0;
    const ease = force > 0 ? B.ease : B.releaseEase;
    this.tilt += (target - this.tilt) * Math.min(1, ease * dt);

    // вся драма — в дрожи: чем больше навалилось, тем сильнее ходит ведро
    this.wobbleT += dt * (7 + prog * 26);
    const amp = prog > 0 ? 0.3 + prog * 1.9 : 0;
    const wob = Math.sin(this.wobbleT * 3.1) * amp;
    this.sprite.setAngle(this.tilt + wob);
    this.sprite.x = CONF.cliffX + Math.sin(this.wobbleT * 5.3) * prog * 3;

    if (force > 0 && this.tilt > B.creakFrom) {
      this.creakT += dt * 1000;
      if (this.creakT >= CREAK_MS) {
        this.creakT = 0;
        Sfx.creak(this.progress);
      }
    }
  }

  /** Время вышло: ведро устало стоять на краю и пошло вверх. */
  ascend() {
    if (this.state !== 'stand') return;
    this.state = 'ascend';
    this.startY = this.sprite.y;
    Sfx.ascend();
  }

  topple() {
    if (this.state !== 'stand') return;
    this.state = 'topple';
    Sfx.topple();
    this.scene.cameras.main.shake(700, 0.012);
  }

  /** Ведра больше нет в кадре: упало в пропасть или ушло в небо. */
  get gone() {
    if (this.state === 'fall') {
      return this.sprite.y - this.sprite.displayHeight > this.scene.scale.height + 400;
    }
    return this.state === 'ascend' && this.hovering;
  }

  /** Пыль из-под опоры: ведро ворочается и крошит кромку. */
  dust() {
    const g = this.scene.add.rectangle(
      CONF.cliffX - 10 - Math.random() * 40,
      this.groundY - 2,
      4 + Math.random() * 6, 4, Phaser.Display.Color.HexStringToColor(PAL.groundTop).color,
    ).setDepth(16);
    this.scene.tweens.add({
      targets: g,
      y: g.y - 20 - Math.random() * 26,
      x: g.x - 14 - Math.random() * 24,
      alpha: 0,
      duration: 520,
      onComplete: () => g.destroy(),
    });
  }
}
