// ─── Игрок: ходит влево-вправо, у ведра упирается и толкает ──────────────────
import { CONF } from '../config.js';
import { Person } from './person.js';
import { HERO } from './textures.js';
import { Sfx } from '../sfx.js';

export class Player {
  constructor(scene, groundY, bucketLeft) {
    this.scene = scene;
    this.bucketLeft = bucketLeft;
    this.pushX = bucketLeft - 2;                  // ближе уже не подойти
    this.person = new Person(scene, CONF.player.startX, groundY, {
      variant: HERO, scale: CONF.px.person,
    });
    this.person.sprite.setDepth(30);
    this.pushing = false;
    this.stepT = 0;
  }

  get x() { return this.person.x; }

  /** dir: -1 | 0 | 1. Возвращает true, если в этом кадре толкаем ведро. */
  update(dt, dir) {
    const p = this.person;
    const atBucket = p.x >= this.pushX;
    this.pushing = atBucket && dir > 0;

    if (this.pushing) {
      p.x = this.pushX;
      p.setFrame('push');
      p.sprite.flipX = false;
      p.update(dt, false);
      return true;
    }

    if (dir !== 0) {
      p.x = Phaser.Math.Clamp(p.x + dir * CONF.player.speed * dt, 14, this.pushX);
      p.sprite.flipX = dir < 0;
      p.update(dt, true);
      this.stepT += dt;
      if (this.stepT > 0.26) { this.stepT = 0; Sfx.step(); }
    } else {
      p.setFrame('stand');
      p.update(dt, false);
    }
    return false;
  }
}
