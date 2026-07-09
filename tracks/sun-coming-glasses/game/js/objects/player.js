// ─── Игрок: солнценаступательные очки на дужках-пружинах ─────────────────────
import { CONF } from '../config.js';

export class Player {
  /** @param {Phaser.Scene} scene */
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.add.image(x, y, 'glasses').setDepth(10);
    this.vx = 0;
    this.vy = 0;
    this.prevFeetY = this.feetY;
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get feetY() { return this.sprite.y + CONF.player.feetOffset; }

  /** dir: -1 | 0 | 1. windVx: px/s, постоянная боковая тяга (метель) */
  update(dt, dir, windVx = 0) {
    const P = CONF.physics;

    // плавное горизонтальное управление (независимо от fps).
    // Ветер прибавляется к цели, а не к самой vx — так игрок всё ещё
    // может «догнать» его или частично погасить, а не просто едет юзом
    const targetVx = dir * P.moveSpeed + windVx;
    const k = 1 - Math.exp(-P.moveLerp * dt);
    this.vx += (targetVx - this.vx) * k;

    this.prevFeetY = this.feetY;
    this.vy += P.gravity * dt;
    this.sprite.x += this.vx * dt;
    this.sprite.y += this.vy * dt;

    // лёгкий крен в сторону движения
    this.sprite.rotation = Phaser.Math.Clamp(this.vx / P.moveSpeed, -1, 1) * 0.16;

    // заворачивание за края экрана (классика жанра)
    const hw = CONF.player.halfW;
    if (this.sprite.x < -hw) this.sprite.x = CONF.width + hw;
    else if (this.sprite.x > CONF.width + hw) this.sprite.x = -hw;
  }

  /** Отскок с силой vy (px/s, положительное число) + squash-and-stretch. */
  bounce(vy, squash = 0.22) {
    this.vy = -vy;
    this.sprite.setScale(1 + squash, 1 - squash);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1, scaleY: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });
  }
}
