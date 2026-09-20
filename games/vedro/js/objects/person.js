// ─── Человечек: общая основа для игрока и для толпы ──────────────────────────
import { CONF } from '../config.js';
import { PEOPLE_TEX, personKey } from './textures.js';

const WALK_MS = 130;

export class Person {
  constructor(scene, x, y, { variant = 0, scale = 1, flip = false } = {}) {
    this.variant = variant;
    this.frame = 'stand';
    this.walkT = 0;
    this.walkOn = false;
    this.sprite = scene.add.image(x, y, PEOPLE_TEX, personKey(variant, 'stand'))
      .setOrigin(0.5, 1)
      .setScale(scale);
    this.sprite.flipX = flip;
  }

  setFrame(frame) {
    if (this.frame === frame) return;
    this.frame = frame;
    this.sprite.setFrame(personKey(this.variant, frame));
  }

  /** Анимация ходьбы: переставляем ноги, пока walking. */
  update(dt, walking) {
    if (!walking) {
      this.walkT = 0;
      this.walkOn = false;
      return;
    }
    this.walkT += dt * 1000;
    if (this.walkT >= WALK_MS) {
      this.walkT -= WALK_MS;
      this.walkOn = !this.walkOn;
      this.setFrame(this.walkOn ? 'walk' : 'stand');
    }
  }

  get x() { return this.sprite.x; }
  set x(v) { this.sprite.x = v; }
  get y() { return this.sprite.y; }
  set y(v) { this.sprite.y = v; }

  destroy() { this.sprite.destroy(); }
}

export const personScale = (row) =>
  CONF.px.person * (1 - row * CONF.crowd.rowScale);
