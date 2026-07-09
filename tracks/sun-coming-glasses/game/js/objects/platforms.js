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
    this.marioFeverUntilM = 0; // лихорадка: марио повсюду до этой высоты
    this.rainBand = null;      // дождевой пояс задаёт game-сцена
    this.onLightning = null;   // game-сцена вешает сюда проверку попаданий
    // самопроизвольные молнии: один общий таймер на все тучи экрана
    this.autoStrike = { t: RF(2, 4), target: null, charge: 0 };
    this.spawnTutorial();
  }

  // Стартовая лесенка: офисный диван, затем облака (первые — прямо в офисе,
  // привет Магритту), выше — обычные
  spawnTutorial() {
    this.place('couch', CONF.width / 2, 0);
    const xs = [140, 340, 110, 360, 240];
    xs.forEach((x, i) => this.place('cloud', x, -(i + 1) * 86, { wide: i < 2 ? 1.3 : 1 }));
    this.lastY = -xs.length * 86;
  }

  zoneFor(m) {
    let z = CONF.zones[0];
    for (const zone of CONF.zones) if (m >= zone.fromM) z = zone;
    return z;
  }

  /** Множитель скорости/частоты хазардов по высоте (world y, отрицательный). */
  speedMult(y) {
    const m = -y / CONF.pxPerM;
    let mult = 1;
    for (const step of CONF.speedBoost) if (m >= step.fromM) mult = step.mult;
    return mult;
  }

  /** Множитель ширины платформ по высоте (world y, отрицательный). */
  sizeMult(y) {
    const m = -y / CONF.pxPerM;
    let mult = 1;
    for (const step of CONF.sizeBoost) if (m >= step.fromM) mult = step.mult;
    return mult;
  }

  pickType(types) {
    let total = 0;
    for (const t in types) total += types[t];
    let roll = Math.random() * total;
    for (const t in types) {
      roll -= types[t];
      if (roll <= 0) return t;
    }
    return 'cloud';
  }

  /** Догенерировать мир вверх до worldY (отрицательного). */
  ensure(worldY) {
    while (this.lastY > worldY) {
      const m = -this.lastY / CONF.pxPerM;
      const zone = this.zoneFor(m);
      let gap = R(zone.gap[0], zone.gap[1]);
      // со слабой платформы большой разрыв не допрыгнуть — поджимаем
      const cap = this.prevPlat && CONF.spawn.gapCapAfter[this.prevPlat.type];
      if (cap) gap = Math.min(gap, cap);
      this.lastY -= gap;
      // в дождевом поясе грозовых туч гораздо больше
      const inRain = this.rainBand && m >= this.rainBand.from && m <= this.rainBand.to;
      const types = inRain ? { ...zone.types, storm: CONF.rain.stormWeight } : zone.types;
      let type = this.pickType(types);
      // над стикером нельзя таймиговое: он одноразовый, цикл закатика не
      // переждать, летящую чайку не подгадать — перекатываем в облако
      if ((type === 'sunset' || type === 'bird') &&
          this.prevPlat && this.prevPlat.type === 'sticker') {
        type = 'cloud';
      }
      const x = this.randX(type);
      const plat = this.place(type, x, this.lastY);
      // закатик над закатиком — бегущая волна: фаза верхнего отстаёт на 0.6с,
      // он проявляется к твоему прилёту (противофаза запирала путь наверх)
      if (type === 'sunset' && this.prevPlat && this.prevPlat.type === 'sunset') {
        const c = plat.def.cycle;
        plat.t = this.prevPlat.t + (c.visible + c.hidden) / 1000 - 0.6;
      }
      this.prevPlat = plat;
      // чемодан — ловушка: на той же высоте всегда есть честная опора
      if (type === 'suitcase') {
        this.place('cloud', this.apartX(x), this.lastY - R(4, 18));
      }
      // хищное облако — добавка к ярусу: честный путь не занимает.
      // Шанс умножается по лесенке boost — выше опаснее.
      // НЕ вешаем хищника рядом с движущейся платформой (cloudMove/
      // stormMove/bird, у них всех есть def.speed) — она за то время,
      // что игрок долетает до яруса, успевает уехать, и честной опоры
      // рядом с хищником может не остаться (прыгать реально некуда, кроме
      // как в него) — хищник и «подвижная опора» на одной высоте нечестны
      // метель 7000–7500 (см. CONF.wind): владелец просил ТОЛЬКО cloud/
      // cloudMove/плюшки на этот период — добавки (хищники, Марио) тоже
      // выключаем, а не только типы яруса, иначе список не строго «только»
      const inWindZone = m >= CONF.wind.fromM && m <= CONF.wind.toM;
      const movingTier = !!CONF.platforms[type].speed;
      if (type !== 'suitcase' && !movingTier && !inWindZone && m > CONF.enemy.fromM) {
        let mult = 1;
        for (const step of CONF.enemy.boost) if (m >= step.fromM) mult = step.mult;
        for (const enemy in CONF.enemy.chance) {
          if (Math.random() < CONF.enemy.chance[enemy] * mult) {
            this.place(enemy, this.apartX(x), this.lastY - R(4, 16));
            break;
          }
        }
      }
      // мега-редкий Марио — тоже добавка. После превращения игрока в грибка
      // Марио заполоняют небо на feverLengthM метров, хотя толку от них никакого.
      // Лихорадка бьёт мимо обычного порога fromM — иначе ранний чит-код «mario»
      // триггерит превращение, а сама лихорадка ниже 1500 м не разгоняется.
      const inFever = m < this.marioFeverUntilM;
      const marioChance = inFever ? CONF.mario.feverChance : CONF.mario.chance;
      // волшебная аэротруба 10000–10500 (см. CONF.aero): тоже только хищники
      const inAeroZone = m >= CONF.aero.fromM && m <= CONF.aero.toM;
      if (!inWindZone && !inAeroZone && (inFever || m > CONF.mario.fromM) && Math.random() < marioChance) {
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
    const sx = (opts.wide || 1) * this.sizeMult(y);
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
    if (type === 'cloudMove' || type === 'stormMove') {
      const cb = def.chaosBand;
      const m = -y / CONF.pxPerM;
      const spd = (cb && m >= cb.fromM && m <= cb.toM) ? cb.speed : def.speed;
      p.vx = RF(spd[0], spd[1]) * this.speedMult(y) * (Math.random() < 0.5 ? -1 : 1);
    }
    if (type === 'bird') p.vx = RF(def.speed[0], def.speed[1]) * this.speedMult(y) * (Math.random() < 0.5 ? -1 : 1);

    // декор поверх платформы (хищник на облаке); редкий — не пулим
    if (def.deco) {
      p.deco = this.scene.add.image(x, y - p.h / 2 - 12, def.deco)
        .setDepth(6).setFlipX(Math.random() < 0.5);
      this.scene.tweens.add({ // лениво покачивает хвостом
        targets: p.deco, angle: 2.5, yoyo: true, repeat: -1,
        duration: R(900, 1400), ease: 'Sine.easeInOut',
      });
      // зрачки хищника — отдельные спрайты, следят за игроком
      if (def.eyes) {
        p.pupils = def.eyes.map(eye => ({
          cfg: eye,
          img: this.scene.add.image(x, y, 'dot')
            .setDepth(6.1).setTint(0x1a1a1a).setScale(eye.s),
        }));
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
    this.stormTick(dt, camBottomY);
    const limit = camBottomY + CONF.spawn.despawnBelow;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (!p.dead) {
        if (p.vx !== 0) this.drift(p, dt);
        if (p.type === 'bird') this.flap(p, dt);
        if (p.type === 'sunset') this.shyCycle(p, dt);
        if (p.pupils && player) this.trackEyes(p, player);
      } else if (p.respawnT > 0) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) this.respawnSticker(p);
      }
      if (p.baseY > limit) this.release(i);
    }
  }

  // Самопроизвольные молнии: раз в interval секунд случайная туча на экране
  // мерцает telegraph секунд (успей отойти!) и бьёт. Один разряд за раз —
  // иначе дождевой пояс, где грозовых туч большинство, превращается в стробоскоп
  stormTick(dt, camBottomY) {
    const a = this.autoStrike;
    const L = CONF.lightning;
    const m = -camBottomY / CONF.pxPerM;
    const inFirst = L.denseBandFirst && m >= L.denseBandFirst.fromM && m <= L.denseBandFirst.toM;
    const inGate = L.denseBand && m >= L.denseBand.fromM && m <= L.denseBand.toM;
    const band = inFirst ? L.denseBandFirst : (inGate ? L.denseBand : null);
    const inBand = !!band;
    if (a.target) {
      const p = a.target;
      if (p.dead || !this.active.includes(p)) { a.target = null; return; }
      a.charge -= dt;
      if (a.charge > 0) { // копит заряд: нутро тревожно мерцает
        if (Math.floor(a.charge * 14) % 2 === 0) p.sprite.setTintFill(0xe8f0ff);
        else p.sprite.clearTint();
        return;
      }
      p.sprite.clearTint();
      a.target = null;
      // выше boost.fromM бьёт чаще — интервал сжимается тем же множителем;
      // в хищном гейтлете (denseBand) интервал берётся ещё короче
      const iv = inBand ? band.interval : L.interval;
      a.t = RF(iv[0], iv[1]) / this.speedMult(camBottomY);
      const pts = this.strikeLightning(p);
      if (this.onLightning) this.onLightning(pts);
    } else {
      // вход в гейтлет — режем слишком долгое ожидание, доставшееся снаружи
      if (inBand && a.t > band.interval[1]) a.t = band.interval[1];
      a.t -= dt;
      if (a.t > 0) return;
      const camTop = camBottomY - CONF.height;
      const storms = this.active.filter(p =>
        (p.type === 'storm' || p.type === 'stormMove') && !p.dead &&
        p.y > camTop + 60 && p.y < camBottomY - 90);
      if (storms.length) {
        a.target = Phaser.Utils.Array.GetRandom(storms);
        a.charge = (inBand && band.telegraph) ? band.telegraph : L.telegraph;
      } else {
        a.t = 0.4; // туч на экране нет — заглянем позже
      }
    }
  }

  // Зрачки хищника следят за игроком (смещения глаз — в def.eyes)
  trackEyes(p, player) {
    for (const pu of p.pupils) {
      const eye = pu.cfg;
      const ex = p.deco.x + (p.deco.flipX ? -eye.x : eye.x);
      const ey = p.deco.y + eye.y;
      const dx = player.x - ex, dy = player.y - ey;
      const len = Math.hypot(dx, dy) || 1;
      pu.img.setPosition(ex + (dx / len) * 1.5, ey + (dy / len) * 1.5);
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
    if (p.deco) {
      this.scene.tweens.killTweensOf(p.deco);
      p.deco.destroy();
      p.deco = null;
    }
    if (p.pupils) {
      p.pupils.forEach(pu => pu.img.destroy());
      p.pupils = null;
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

  /** Туча бьёт молнией вниз: зигзаг, вспышка, дрожь камеры. */
  strikeLightning(p) {
    const scene = this.scene;
    // туча вспыхивает белым изнутри
    p.sprite.setTintFill(0xffffff);
    scene.time.delayedCall(70, () => { if (p.sprite.active) p.sprite.clearTint(); });

    // зигзаг молнии от брюха тучи вниз
    const g = scene.add.graphics().setDepth(8);
    const pts = [{ x: p.x, y: p.y + p.h / 2 - 4 }];
    let x = p.x, y = pts[0].y;
    const segs = R(5, 7);
    for (let i = 0; i < segs; i++) {
      x += R(-26, 26);
      y += R(38, 58);
      pts.push({ x, y });
    }
    const draw = (width, color, alpha) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokePath();
    };
    draw(8, 0x9fc8ff, 0.35); // ореол
    draw(3, 0xffffff, 1);    // ядро
    scene.tweens.add({
      targets: g, alpha: 0, duration: 380, ease: 'Cubic.easeIn',
      onComplete: () => g.destroy(),
    });

    // вспышка на весь экран и дрожь
    const flash = scene.add.rectangle(
      CONF.width / 2, CONF.height / 2, CONF.width, CONF.height, 0xffffff, 0.4,
    ).setScrollFactor(0).setDepth(60);
    scene.tweens.add({
      targets: flash, alpha: 0, duration: 200,
      onComplete: () => flash.destroy(),
    });
    scene.cameras.main.shake(140, 0.0045);
    return pts; // траектория разряда — для проверки попадания
  }

  /** Молния поджарила хищника: уголёк падает, облако остаётся честным. */
  fryEnemy(p) {
    const deco = p.deco;
    p.deco = null;
    p.type = 'cloud';
    p.def = CONF.platforms.cloud;
    if (p.pupils) { p.pupils.forEach(pu => pu.img.destroy()); p.pupils = null; }
    if (p.tongue) {
      this.scene.tweens.killTweensOf(p.tongue);
      p.tongue.destroy();
      p.tongue = null;
    }
    this.shout(p, 'ПШ-Ш-Ш!');
    this.puff(p, 0x555055, 7); // дымок
    this.scene.tweens.killTweensOf(deco);
    deco.setTintFill(0x2a2126);
    this.scene.tweens.add({
      targets: deco,
      y: deco.y + 170, angle: R(120, 220), alpha: 0,
      duration: 700, ease: 'Cubic.easeIn',
      onComplete: () => deco.destroy(),
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
    this.puff(p, 0x38324a, 7);
    this.scene.tweens.add({
      targets: p.sprite,
      y: p.sprite.y + 110,
      angle: R(-45, 45),
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeIn',
    });
  }

  /** Стикер отклеивается после одного прыжка и возвращается через
   *  respawnS секунд — чтобы игрок не остался запертым без пути наверх. */
  breakSticker(p) {
    p.dead = true;
    p.respawnT = p.def.respawnS;
    this.scene.tweens.add({
      targets: p.sprite,
      y: p.sprite.y + 70,
      angle: R(-40, 40),
      alpha: 0,
      duration: 550,
      ease: 'Cubic.easeIn',
    });
  }

  /** Стикер приклеивается обратно на своё место. */
  respawnSticker(p) {
    this.scene.tweens.killTweensOf(p.sprite);
    p.dead = false;
    p.y = p.baseY;
    p.sprite.setPosition(p.x, p.baseY).setAngle(0).setAlpha(0)
      .setScale(p.baseScaleX * 0.7, 0.7);
    this.scene.tweens.add({
      targets: p.sprite,
      alpha: 1,
      scaleX: p.baseScaleX,
      scaleY: 1,
      duration: 260,
      ease: 'Back.easeOut',
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
