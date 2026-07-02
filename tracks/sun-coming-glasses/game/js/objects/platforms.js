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
        this.place('cloud', this.apartX(x), this.lastY - R(4, 18));
      }
      // хищное облако — добавка к ярусу: честный путь не занимает
      if (type !== 'suitcase' && m > CONF.enemy.fromM && Math.random() < CONF.enemy.chance) {
        const enemy = Phaser.Utils.Array.GetRandom(CONF.enemy.types);
        this.place(enemy, this.apartX(x), this.lastY - R(4, 16));
      }
      // мега-редкий блок «?» — тоже добавка
      if (m > CONF.mario.fromM && Math.random() < CONF.mario.chance) {
        this.place('mario', this.apartX(x), this.lastY - R(20, 50));
      }
    }
  }

  /** X на том же ярусе, гарантированно в стороне от занятого. */
  apartX(x) {
    let nx = x > CONF.width / 2 ? x - R(150, 220) : x + R(150, 220);
    return Phaser.Math.Clamp(nx, 60, CONF.width - 60);
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

    // декор поверх платформы (хищник на облаке); редкий — не пулим
    if (def.deco) {
      p.deco = this.scene.add.image(x, y - p.h / 2 - 12, def.deco)
        .setDepth(6).setFlipX(Math.random() < 0.5);
      this.scene.tweens.add({ // лениво покачивает хвостом
        targets: p.deco, angle: 2.5, yoyo: true, repeat: -1,
        duration: R(900, 1400), ease: 'Sine.easeInOut',
      });
      // зрачок хищника — отдельный спрайт, следит за игроком
      if (def.eye) {
        p.pupil = this.scene.add.image(x, y, 'dot')
          .setDepth(6.1).setTint(0x1a1a1a).setScale(def.eye.s);
      }
      // язык змеи: высовывается, дрожит и прячется — как в природе
      if (def.tongue) {
        const dir = p.deco.flipX ? 1 : -1;
        p.tongue = this.scene.add.image(
          p.deco.x + def.tongue.x * -dir,
          p.deco.y + def.tongue.y,
          'tongue',
        ).setOrigin(0, 0.5).setDepth(6.05).setScale(0, 1);
        this.scene.tweens.add({
          targets: p.tongue,
          scaleX: dir,
          duration: 100,
          yoyo: true,
          hold: 170,          // подрожать снаружи
          repeat: -1,
          repeatDelay: R(700, 2200), // пауза между высовываниями
          ease: 'Quad.easeOut',
        });
      }
    }
    this.active.push(p);
    return p;
  }

  /** Поведение платформ + чистка улетевших вниз. */
  update(dt, camBottomY, player) {
    const limit = camBottomY + CONF.spawn.despawnBelow;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (!p.dead) {
        if (p.vx !== 0) this.drift(p, dt);
        if (p.type === 'bird') this.flap(p, dt);
        if (p.type === 'sunset') this.shyCycle(p, dt);
        if (p.pupil && player) this.trackEye(p, player);
      }
      if (p.baseY > limit) this.release(i);
    }
  }

  // Зрачок хищника следит за игроком (смещение глаза — в def.eye)
  trackEye(p, player) {
    const eye = p.def.eye;
    const ex = p.deco.x + (p.deco.flipX ? -eye.x : eye.x);
    const ey = p.deco.y + eye.y;
    const dx = player.x - ex, dy = player.y - ey;
    const len = Math.hypot(dx, dy) || 1;
    p.pupil.setPosition(ex + (dx / len) * 1.5, ey + (dy / len) * 1.5);
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
    if (p.deco) {
      this.scene.tweens.killTweensOf(p.deco);
      p.deco.destroy();
      p.deco = null;
    }
    if (p.pupil) {
      p.pupil.destroy();
      p.pupil = null;
    }
    if (p.tongue) {
      this.scene.tweens.killTweensOf(p.tongue);
      p.tongue.destroy();
      p.tongue = null;
    }
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
      case 'mario': // блок подпрыгивает, как в оригинале
        this.hop(p);
        this.puff(p, 0xffd93b, 9);
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

  /** Хищник делает выпад к добыче. */
  lunge(p, px, cry, tint) {
    if (!p.deco) return;
    this.scene.tweens.killTweensOf(p.deco);
    p.deco.setFlipX(px > p.deco.x); // мордой к жертве (морда слева в текстуре)
    this.scene.tweens.add({
      targets: p.deco,
      y: p.deco.y - 10,
      scaleX: 1.18, scaleY: 1.22,
      duration: 130, yoyo: true, ease: 'Quad.easeOut',
    });
    this.shout(p, cry);
    this.puff(p, tint, 6);
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
