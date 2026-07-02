// ─── Платформы: пул + data-driven спавн по зонам высот ───────────────────────
import { CONF } from '../config.js';

const R = Phaser.Math.Between;
const RF = Phaser.Math.FloatBetween;

export class PlatformField {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.active = [];   // платформы в мире
    this.pool = [];     // спрайты на переиспользование
    this.lastY = 0;     // docka последнего спавна (мир, вверх = минус)
    this.spawnTutorial();
  }

  // Стартовая лесенка: широкие статичные облака, чтобы освоиться
  spawnTutorial() {
    this.place('cloud', CONF.width / 2, 0, { wide: 1.6 });
    const xs = [140, 340, 110, 360, 240];
    xs.forEach((x, i) => this.place('cloud', x, -(i + 1) * 86, { wide: i < 2 ? 1.3 : 1 }));
    this.lastY = -xs.length * 86;
  }

  zoneFor(m) {
    let z = CONF.zones[0];
    for (const zone of CONF.zones) if (m >= zone.fromM) z = zone;
    return z;
  }

  pickType(zone) {
    let total = 0;
    for (const t in zone.types) total += zone.types[t];
    let roll = Math.random() * total;
    for (const t in zone.types) {
      roll -= zone.types[t];
      if (roll <= 0) return t;
    }
    return 'cloud';
  }

  /** Догенерировать мир вверх до worldY (отрицательного). */
  ensure(worldY) {
    while (this.lastY > worldY) {
      const m = -this.lastY / CONF.pxPerM;
      const zone = this.zoneFor(m);
      this.lastY -= R(zone.gap[0], zone.gap[1]);
      const def = CONF.platforms[this.pickType(zone)];
      const margin = def.w / 2 + 14;
      this.place(this.typeKey(def), R(margin, CONF.width - margin), this.lastY);
    }
  }

  typeKey(def) {
    for (const key in CONF.platforms) if (CONF.platforms[key] === def) return key;
    return 'cloud';
  }

  place(type, x, y, opts = {}) {
    const def = CONF.platforms[type];
    let sprite = this.pool.pop();
    if (!sprite) sprite = this.scene.add.image(0, 0, def.tex).setDepth(5);
    sprite.setTexture(def.tex).setActive(true).setVisible(true)
      .setPosition(x, y).setAlpha(1).setAngle(0);
    sprite.setScale(opts.wide || 1, 1);
    sprite.setTint(def.tint || 0xffffff);
    if (def.tint === undefined) sprite.clearTint();

    const p = {
      type, sprite, x, y,
      w: def.w * (opts.wide || 1),
      h: def.h,
      dead: false,
      vx: 0,
    };
    if (type === 'cloudMove') {
      p.vx = RF(def.speed[0], def.speed[1]) * (Math.random() < 0.5 ? -1 : 1);
    }
    this.active.push(p);
    return p;
  }

  /** Движение дрейфующих облаков + чистка улетевших вниз. */
  update(dt, camBottomY) {
    const limit = camBottomY + CONF.spawn.despawnBelow;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (p.vx !== 0 && !p.dead) {
        p.x += p.vx * dt;
        const edge = p.w / 2 + 8;
        if (p.x < edge) { p.x = edge; p.vx = Math.abs(p.vx); }
        else if (p.x > CONF.width - edge) { p.x = CONF.width - edge; p.vx = -Math.abs(p.vx); }
        p.sprite.x = p.x;
      }
      if (p.y > limit) this.release(i);
    }
  }

  release(i) {
    const p = this.active[i];
    // твин слома стикера может ещё идти — иначе он «догонит» переиспользованный
    // спрайт и сделает живую платформу невидимой
    this.scene.tweens.killTweensOf(p.sprite);
    p.sprite.setActive(false).setVisible(false);
    this.pool.push(p.sprite);
    this.active.splice(i, 1);
  }

  /**
   * Свип-проверка приземления: ступни пересекли верх платформы сверху вниз.
   * Возвращает платформу или null.
   */
  landing(player) {
    if (player.vy <= 0) return null;
    const x = player.x;
    for (const p of this.active) {
      if (p.dead) continue;
      const top = p.y - p.h / 2;
      if (player.prevFeetY <= top + 1 && player.feetY >= top &&
          Math.abs(x - p.x) < p.w / 2 + CONF.player.halfW * 0.8) {
        return p;
      }
    }
    return null;
  }

  /** Стикер отклеивается после одного прыжка. */
  breakSticker(p) {
    p.dead = true;
    this.scene.tweens.add({
      targets: p.sprite,
      y: p.sprite.y + 70,
      angle: Phaser.Math.Between(-40, 40),
      alpha: 0,
      duration: 550,
      ease: 'Cubic.easeIn',
    });
  }
}
