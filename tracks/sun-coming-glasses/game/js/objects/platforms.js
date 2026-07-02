// ─── Платформы: пул, data-driven спавн по зонам, поведение и реакции ─────────
import { CONF } from '../config.js';

const R = Phaser.Math.Between;
const RF = Phaser.Math.FloatBetween;

export class PlatformField {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.active = [];   // платформы в мире
    this.pool = [];     // спрайты на переиспользование
    this.lastY = 0;     // отметка последнего спавна (мир, вверх = минус)
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
      const type = this.pickType(zone);
      const x = this.randX(type);
      this.place(type, x, this.lastY);
      // чемодан — ловушка: на той же высоте всегда есть честная опора
      if (type === 'suitcase') {
        let cx = this.randX('cloud');
        if (Math.abs(cx - x) < 140) {
          cx = x > CONF.width / 2 ? x - 150 : x + 150;
          cx = Phaser.Math.Clamp(cx, 60, CONF.width - 60);
        }
        this.place('cloud', cx, this.lastY - R(4, 18));
      }
    }
  }

  randX(type) {
    const def = CONF.platforms[type];
    const w = def.variants ? def.variants[0].w : def.w;
    const margin = w / 2 + 14;
    return R(margin, CONF.width - margin);
  }

  place(type, x, y, opts = {}) {
    const def = CONF.platforms[type];
    const variant = def.variants ? Phaser.Utils.Array.GetRandom(def.variants) : def;

    let sprite = this.pool.pop();
    if (!sprite) sprite = this.scene.add.image(0, 0, variant.tex).setDepth(5);
    const sx = opts.wide || 1;
    sprite.setTexture(variant.tex).setActive(true).setVisible(true)
      .setPosition(x, y).setAlpha(1).setAngle(0).setFlipX(false)
      .setScale(sx, 1);
    if (def.tint) sprite.setTint(def.tint); else sprite.clearTint();

    const p = {
      type, def, sprite, x, y,
      baseY: y,
      baseScaleX: sx,
      w: variant.w * sx,
      h: variant.h,
      dead: false,
      hidden: false,
      vx: 0,
      t: RF(0, 10), // фаза для синусоид/циклов
    };
    if (type === 'cloudMove') p.vx = RF(def.speed[0], def.speed[1]) * (Math.random() < 0.5 ? -1 : 1);
    if (type === 'bird') p.vx = RF(def.speed[0], def.speed[1]) * (Math.random() < 0.5 ? -1 : 1);
    this.active.push(p);
    return p;
  }

  /** Поведение платформ + чистка улетевших вниз. */
  update(dt, camBottomY) {
    const limit = camBottomY + CONF.spawn.despawnBelow;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (!p.dead) {
        if (p.vx !== 0) this.drift(p, dt);
        if (p.type === 'bird') this.flap(p, dt);
        if (p.type === 'sunset') this.shyCycle(p, dt);
      }
      if (p.baseY > limit) this.release(i);
    }
  }

  // горизонтальный дрейф с отскоком от краёв
  drift(p, dt) {
    p.x += p.vx * dt;
    const edge = p.w / 2 + 8;
    if (p.x < edge) { p.x = edge; p.vx = Math.abs(p.vx); }
    else if (p.x > CONF.width - edge) { p.x = CONF.width - edge; p.vx = -Math.abs(p.vx); }
    p.sprite.x = p.x;
    if (p.type === 'bird') p.sprite.setFlipX(p.vx < 0);
  }

  // пташка: вертикальная синусоида (коллизия следует за спрайтом)
  flap(p, dt) {
    p.t += dt;
    const w = p.def.wobble;
    p.y = p.baseY + Math.sin(p.t * w.freq * Math.PI) * w.amp;
    p.sprite.y = p.y;
  }

  // закатик: виден → краснеет → тает → возвращается
  shyCycle(p, dt) {
    p.t += dt;
    const c = p.def.cycle;
    const total = c.visible + c.hidden;
    const tv = (p.t * 1000) % total;
    if (tv < c.visible) {
      p.hidden = false;
      const blushStart = c.visible - c.blush;
      if (tv > blushStart) {
        // смущается: дрожит и розовеет перед исчезновением
        const k = (tv - blushStart) / c.blush;
        p.sprite.setAlpha(1 - k * 0.25);
        p.sprite.setScale(p.baseScaleX * (1 + Math.sin(p.t * 26) * 0.05 * k), 1);
        p.sprite.setTint(0xffb0b8);
      } else {
        p.sprite.setAlpha(1);
        p.sprite.clearTint();
      }
    } else {
      p.hidden = true;
      const th = tv - c.visible;
      const fade = 180;
      let a = 0;
      if (th < fade) a = 1 - th / fade;
      else if (th > c.hidden - fade) a = (th - (c.hidden - fade)) / fade;
      p.sprite.setAlpha(a * 0.6);
      p.sprite.setScale(p.baseScaleX, 1);
    }
  }

  release(i) {
    const p = this.active[i];
    // твины (слом, реакция) не должны догнать переиспользованный спрайт
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
      if (p.dead || p.hidden) continue;
      const top = p.y - p.h / 2;
      if (player.prevFeetY <= top + 1 && player.feetY >= top &&
          Math.abs(x - p.x) < p.w / 2 + CONF.player.halfW * 0.8) {
        return p;
      }
    }
    return null;
  }

  // ─── Реакции платформ на прыжок ────────────────────────────────────────────

  /** Визуальный отклик платформы на отскок очков. */
  react(p) {
    switch (p.type) {
      case 'llama':
        this.hop(p);
        this.shout(p, 'Там хорошо!');
        this.puff(p, 0xffb8dd, 8);
        break;
      case 'backpack':
        this.squash(p, 1.14, 0.62);
        this.puff(p, 0xffd000, 7);
        break;
      case 'sunset':
        this.squash(p, 1.2, 0.7);
        this.puff(p, 0xffcf3f, 6);
        break;
      case 'bird':
        this.flutter(p);
        this.puff(p, 0xfff6ec, 5);
        break;
      default: // облака: продавливаются и пыхают
        this.squash(p, 1.18, 0.66);
        this.puff(p, 0xffffff, 5);
    }
  }

  /** Продавливание: сплющилось и упруго вернулось. */
  squash(p, sx, sy) {
    const s = p.sprite;
    this.scene.tweens.killTweensOf(s);
    s.setScale(p.baseScaleX, 1);
    this.scene.tweens.add({
      targets: s,
      scaleX: p.baseScaleX * sx, scaleY: sy,
      y: p.y + p.h * 0.18,
      duration: 90,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => { s.setScale(p.baseScaleX, 1); s.y = p.y; },
    });
  }

  /** Лама подпрыгивает от радости. */
  hop(p) {
    const s = p.sprite;
    this.scene.tweens.killTweensOf(s);
    this.scene.tweens.add({
      targets: s, y: p.y - 16, angle: -8,
      duration: 140, ease: 'Quad.easeOut', yoyo: true,
      onComplete: () => { s.y = p.y; s.setAngle(0); },
    });
  }

  /** Пташка возмущённо трепещет. */
  flutter(p) {
    const s = p.sprite;
    this.scene.tweens.add({
      targets: s, angle: { from: -14, to: 14 },
      duration: 70, yoyo: true, repeat: 3,
      onComplete: () => s.setAngle(0),
    });
  }

  /** Чемодан проламывается: отскока нет. */
  crumble(p) {
    p.dead = true;
    this.puff(p, 0x8a5a34, 7);
    this.scene.tweens.add({
      targets: p.sprite,
      y: p.sprite.y + 110,
      angle: R(-45, 45),
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeIn',
    });
  }

  /** Стикер отклеивается после одного прыжка. */
  breakSticker(p) {
    p.dead = true;
    this.scene.tweens.add({
      targets: p.sprite,
      y: p.sprite.y + 70,
      angle: R(-40, 40),
      alpha: 0,
      duration: 550,
      ease: 'Cubic.easeIn',
    });
  }

  /** Всплеск частиц. */
  puff(p, tint, n) {
    for (let i = 0; i < n; i++) {
      const d = this.scene.add.image(p.x, p.y - 8, 'dot').setDepth(9)
        .setTint(tint).setScale(RF(1, 2.2));
      this.scene.tweens.add({
        targets: d,
        x: d.x + R(-46, 46),
        y: d.y - R(14, 58),
        alpha: 0,
        duration: R(320, 560),
        ease: 'Cubic.easeOut',
        onComplete: () => d.destroy(),
      });
    }
  }

  /** Крик платформы: всплывающий текст в мире. */
  shout(p, text) {
    const t = this.scene.add.text(p.x, p.y - 34, text, {
      fontFamily: 'Unbounded, sans-serif', fontSize: '17px', fontStyle: '700',
      color: CONF.colors.gold, stroke: '#3a0d18', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(11)
      .setResolution(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.tweens.add({
      targets: t, y: t.y - 70, alpha: 0, duration: 1100,
      ease: 'Cubic.easeOut', onComplete: () => t.destroy(),
    });
  }
}
