// ─── Фон: градиент неба по высоте, солнце, параллакс-облака, звёзды, Сизиф ───
import { CONF } from '../config.js';

const SKY_MAX_M = CONF.sky[CONF.sky.length - 1].m; // вершина лестницы неба
const SKY_TEX_H = 2048;

export class Background {
  /** @param {Phaser.Scene} scene */
  constructor(scene, lowGfx) {
    this.scene = scene;
    this.lowGfx = lowGfx;

    // ── градиент неба: одна высокая текстура, окно едет по ней с высотой ──
    if (!scene.textures.exists('skytex')) {
      const tex = scene.textures.createCanvas('skytex', 32, SKY_TEX_H);
      const ctx = tex.getContext();
      const grad = ctx.createLinearGradient(0, 0, 0, SKY_TEX_H);
      // верх текстуры = максимальная высота
      for (const s of CONF.sky) grad.addColorStop(1 - s.m / SKY_MAX_M, s.c);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, SKY_TEX_H);
      tex.refresh();
    }
    this.sky = scene.add.image(0, 0, 'skytex')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(-10);
    this.sky.setDisplaySize(CONF.width, SKY_TEX_H);

    // ── стесняшка-закатик: во всю ширину поля, из-за кромки виден только срез ──
    // мягкое гало отдельным слоем за диском, светится аддитивно
    const halo = scene.add.image(0, 0, 'sunhalo')
      .setBlendMode(Phaser.BlendModes.ADD);
    const disc = scene.add.image(0, 0, 'shysun');
    this.sun = scene.add.container(CONF.width / 2, -108, [halo, disc])
      .setScrollFactor(0).setDepth(-9);
    // застенчиво приподнимается и прячется обратно
    scene.tweens.add({
      targets: this.sun, y: -92, yoyo: true, repeat: -1,
      duration: 3800, ease: 'Sine.easeInOut',
    });
    // гало мягко дышит
    scene.tweens.add({
      targets: halo, alpha: 0.72, yoyo: true, repeat: -1,
      duration: 5200, ease: 'Sine.easeInOut',
    });

    // ── дальние полупрозрачные облака (параллакс-слой) ──
    this.decorSf = 0.35;
    this.decor = [];
    const texKeys = ['p-cloud-a', 'p-cloud-b', 'p-cloud-c'];
    const n = lowGfx ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const c = scene.add.image(0, 0, Phaser.Utils.Array.GetRandom(texKeys))
        .setScrollFactor(1, this.decorSf).setDepth(-8)
        .setScale(Phaser.Math.FloatBetween(2.2, 3.6));
      c.baseAlpha = Phaser.Math.FloatBetween(0.1, 0.18);
      c.setAlpha(c.baseAlpha);
      this.respawnDecor(c, false);
      this.decor.push(c);
    }

    // ── звёзды: включаются в стратосфере ──
    this.stars = scene.add.group();
    const starCount = lowGfx ? 22 : 46;
    for (let i = 0; i < starCount; i++) {
      const star = scene.add.image(
        Phaser.Math.Between(8, CONF.width - 8),
        Phaser.Math.Between(8, CONF.height - 8),
        'dot',
      ).setScrollFactor(0).setDepth(-7).setAlpha(0)
       .setScale(Phaser.Math.FloatBetween(0.5, 1.4));
      this.stars.add(star);
    }
    this.starAlpha = 0;

    // ── Сизиф: следующее появление и прогресс ламы по склону ──
    this.nextSisM = CONF.sisyphus.firstM;
    this.sisProgress = 0;

    // ── пальмы: стоят на своих высотах по краям, до стратосферы ──
    this.nextPalmM = 60;
    this.palms = [];

    // ── падающие ламы: изредка кувыркаются через экран, как на странице трека ──
    this.scheduleFallingLlama();

    // ── самолётики с инверсионным следом ──
    this.schedulePlane();

    // ── светлячки: сгустки мерцающих искр, разлетаются от игрока ──
    this.fireflies = [];
    this.nextFireM = 140;

    // ── дождь: пояс задаёт game-сцена через this.rainBand ──
    this.rainBand = null;
    this.drops = [];
    const dropCount = lowGfx ? 22 : 42;
    for (let i = 0; i < dropCount; i++) {
      const d = scene.add.image(
        Phaser.Math.Between(0, CONF.width),
        Phaser.Math.Between(-CONF.height, CONF.height),
        'raindrop',
      ).setScrollFactor(0).setDepth(41)
       .setTint(0xaaccee).setAngle(-8).setAlpha(0);
      d.vy = Phaser.Math.Between(760, 1150);
      this.drops.push(d);
    }
    // сумрак ливня
    this.rainDim = scene.add.rectangle(
      CONF.width / 2, CONF.height / 2, CONF.width, CONF.height, 0x1a2238,
    ).setScrollFactor(0).setDepth(40).setAlpha(0);
  }

  /** 0..1 — насколько мы внутри дождевого пояса (с плавными краями). */
  rainIntensity(curM) {
    if (!this.rainBand) return 0;
    const { from, to } = this.rainBand;
    if (curM < from || curM > to) return 0;
    return Phaser.Math.Clamp(
      Math.min(curM - from, to - curM) / CONF.rain.edgeM, 0, 1);
  }

  /** Сгусток светлячков. inView — прямо на экране (для чит-кода). */
  spawnFireflies(inView = false) {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const cx = Phaser.Math.Between(80, CONF.width - 80);
    const cy = inView
      ? cam.scrollY + CONF.height * 0.45
      : cam.scrollY - Phaser.Math.Between(160, 420);

    const flies = [];
    const n = this.lowGfx ? 10 : 18;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.6) * 52; // гуще к центру
      const fly = scene.add.image(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 'spark')
        .setDepth(3).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(Math.random() < 0.75 ? 0xffe9a0 : 0xd8ffb0)
        .setAlpha(Phaser.Math.FloatBetween(0.4, 1));
      // мерцание
      scene.tweens.add({
        targets: fly, alpha: Phaser.Math.FloatBetween(0.1, 0.35),
        duration: Phaser.Math.Between(280, 900),
        yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 500),
      });
      // медленное блуждание
      scene.tweens.add({
        targets: fly,
        x: fly.x + Phaser.Math.Between(-9, 9),
        y: fly.y + Phaser.Math.Between(-7, 7),
        duration: Phaser.Math.Between(1400, 2800),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      flies.push(fly);
    }
    this.fireflies.push({ x: cx, y: cy, flies, scattered: false });
  }

  /** Игрок влетел в сгусток — светлячки прыскают в стороны. */
  scatterFireflies(cluster, px, py) {
    cluster.scattered = true;
    for (const fly of cluster.flies) {
      this.scene.tweens.killTweensOf(fly);
      const dx = fly.x - px, dy = fly.y - py;
      const len = Math.hypot(dx, dy) || 1;
      const dist = Phaser.Math.Between(70, 170);
      this.scene.tweens.add({
        targets: fly,
        x: fly.x + (dx / len) * dist + Phaser.Math.Between(-16, 16),
        y: fly.y + (dy / len) * dist + Phaser.Math.Between(-16, 16),
        alpha: 0,
        duration: Phaser.Math.Between(500, 1000),
        ease: 'Cubic.easeOut',
        onComplete: () => fly.destroy(),
      });
    }
    cluster.flies = [];
  }

  schedulePlane() {
    this.scene.time.addEvent({
      delay: Phaser.Math.Between(12000, 26000),
      callback: () => {
        this.spawnPlane();
        this.schedulePlane();
      },
    });
  }

  getPlaneTexture(heightMeters) {
    if (heightMeters < 500) {
      return 'cessna';
    }

    if (heightMeters < 5000) {
      return Phaser.Utils.Array.GetRandom([
        'plane',
        'plane2',
        'cessna'
      ]);
    }

    return Phaser.Utils.Array.GetRandom([
      'plane',
      'plane2',
      'cessna'
    ]);
  }

  /** Лайнер пересекает небо под углом набора/снижения, оставляя тающий след. */
  spawnPlane() {
    const scene = this.scene;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const startX = dir > 0 ? -70 : CONF.width + 70;
    const endX = dir > 0 ? CONF.width + 70 : -70;
    const scrollX = 1;
    const scrollY = 0.4;
    const startY = 150  + scrollY * this.scene.cameras.main.scrollY;

    // угол тангажа как на взлёте/посадке: ±12°, но не выводящий за экран
    let pitch = Phaser.Math.FloatBetween(0, 15);
    const dx = Math.abs(endX - startX);
    let endY = startY - Math.tan(Phaser.Math.DegToRad(pitch)) * dx;


    const curM = Math.max(0, Math.round(-this.scene.player.y / CONF.pxPerM)); // FIXME: pass it better?
    const plane = scene.add.image(startX, startY, this.getPlaneTexture(curM))
      .setScrollFactor(scrollX, scrollY).setDepth(-6.5)
      .setScale(Phaser.Math.FloatBetween(0.65, 0.95))
      .setAlpha(0.55).setFlipX(dir < 0)
      .setAngle(dir > 0 ? -pitch : pitch);

    // единичный вектор курса — след тянется строго за хвостом
    const len = Math.hypot(endX - startX, endY - startY);
    const ux = (endX - startX) / len, uy = (endY - startY) / len;
    const puffGap = this.lowGfx ? 28 : 18;
    let lastX = plane.x, lastY = plane.y;

    scene.tweens.add({
      targets: plane,
      x: endX,
      y: endY,
      duration: Phaser.Math.Between(8000, 13000),
      onUpdate: () => {
        if (Math.hypot(plane.x - lastX, plane.y - lastY) >= puffGap) {
          lastX = plane.x; lastY = plane.y;
          const s = plane.scaleX;
          const puff = scene.add.image(
            plane.x - ux * 34 * s,
            plane.y - uy * 34 * s + 1,
            'dot',
          ).setScrollFactor(scrollX, scrollY).setDepth(-6.6)
           .setAlpha(0.22).setScale(Phaser.Math.FloatBetween(1.3, 2));
          scene.tweens.add({
            targets: puff,
            alpha: 0,
            scale: puff.scale + 1.1,
            duration: Phaser.Math.Between(1600, 2400),
            onComplete: () => puff.destroy(),
          });
        }
      },
      onComplete: () => plane.destroy(),
    });
  }

  scheduleFallingLlama() {
    this.scene.time.addEvent({
      delay: Phaser.Math.Between(7000, 18000),
      callback: () => {
        this.spawnFallingLlama();
        this.scheduleFallingLlama();
      },
    });
  }

  /** Лама кувырком падает через экран — чистый фон, без коллизий. */
  spawnFallingLlama() {
    const scene = this.scene;
    const scale = Phaser.Math.FloatBetween(0.45, 0.85);
    // разброс почти во всю ширину: отступ ровно под габарит ламы
    const margin = Math.ceil(40 * scale);
    const llama = scene.add.image(
      Phaser.Math.Between(margin, CONF.width - margin),
      -60,
      'p-llama',
    ).setScrollFactor(0).setDepth(-5).setScale(scale)
     .setAlpha(0.85).setFlipX(Math.random() < 0.5);

    const dur = Phaser.Math.Between(2800, 5200);
    scene.tweens.add({
      targets: llama,
      y: CONF.height + 80,
      x: llama.x + Phaser.Math.Between(-70, 70),
      angle: (Math.random() < 0.5 ? -1 : 1) * Phaser.Math.Between(280, 620),
      duration: dur,
      ease: 'Sine.easeIn',
      onComplete: () => llama.destroy(),
    });
  }

  /** Пересадить дальнее облако: сбоку при старте или сверху при подъёме. */
  respawnDecor(c, above) {
    const scrollY = this.scene.cameras.main.scrollY;
    const screenY = above
      ? -Phaser.Math.Between(80, 700)
      : Phaser.Math.Between(0, CONF.height);
    c.y = screenY + scrollY * this.decorSf;
    c.x = Phaser.Math.Between(30, CONF.width - 30);
  }

  update(curM, maxM, player, dt = 0.016) {
    const cam = this.scene.cameras.main;

    // дождь: капли летят, пока мы в поясе
    const rain = this.rainIntensity(curM);
    this.rainDim.setAlpha(rain * 0.34); // мрачно, как перед настоящей грозой
    for (const d of this.drops) {
      if (rain <= 0.01) { if (d.alpha !== 0) d.setAlpha(0); continue; }
      d.setAlpha(rain * 0.55);
      d.y += d.vy * dt;
      d.x -= d.vy * 0.14 * dt; // лёгкий косой снос
      if (d.y > CONF.height + 16) {
        d.y = -16;
        d.x = Phaser.Math.Between(0, CONF.width + 60);
      }
    }

    // светлячки: спавн по высоте, разлёт от игрока, чистка внизу
    if (maxM >= this.nextFireM && maxM < 8000) {
      this.spawnFireflies();
      this.nextFireM = maxM + Phaser.Math.Between(280, 650);
    }
    for (let i = this.fireflies.length - 1; i >= 0; i--) {
      const c = this.fireflies[i];
      if (!c.scattered && player &&
          Math.abs(player.x - c.x) < 72 && Math.abs(player.y - c.y) < 72) {
        this.scatterFireflies(c, player.x, player.y);
      }
      if (c.y > cam.scrollY + CONF.height + 300 || (c.scattered && c.flies.length === 0)) {
        for (const fly of c.flies) { this.scene.tweens.killTweensOf(fly); fly.destroy(); }
        this.fireflies.splice(i, 1);
      }
    }

    // окно градиента: снизу (офис) к верху (космос)
    const t = Phaser.Math.Clamp(curM / SKY_MAX_M, 0, 1);
    this.sky.y = (CONF.height - SKY_TEX_H) * (1 - t);

    // закатик остаётся до стратосферы, дальше тает — в космосе закатов нет
    this.sun.setAlpha(1 - Phaser.Math.Clamp((curM - 7600) / 1200, 0, 1));

    // дальние облака: ушли вниз — вернулись сверху; в космосе тают
    const decorFade = 1 - Phaser.Math.Clamp((curM - 7500) / 1200, 0, 1);
    for (const c of this.decor) {
      const screenY = c.y - cam.scrollY * this.decorSf;
      if (screenY > CONF.height + 90) this.respawnDecor(c, true);
      c.setAlpha(c.baseAlpha * decorFade);
    }

    // звёзды проявляются после ~7500 м
    const target = Phaser.Math.Clamp((curM - 7500) / 1800, 0, 0.9);
    if (Math.abs(target - this.starAlpha) > 0.01) {
      this.starAlpha = target;
      this.stars.children.iterate(s => s && s.setAlpha(this.starAlpha * (0.4 + (s.scale % 0.5))));
    }

    if (maxM >= this.nextSisM) {
      this.spawnSisyphus();
      this.nextSisM = maxM +
        Phaser.Math.Between(CONF.sisyphus.intervalM[0], CONF.sisyphus.intervalM[1]);
    }

    if (maxM >= this.nextPalmM && maxM < 7000) {
      this.spawnPalm();
      this.nextPalmM = maxM + Phaser.Math.Between(180, 420);
    }

    // чистим пальмы, оставшиеся далеко внизу
    for (let i = this.palms.length - 1; i >= 0; i--) {
      if (this.palms[i].y > cam.scrollY + CONF.height + 400) {
        this.scene.tweens.killTweensOf(this.palms[i]);
        this.palms[i].destroy();
        this.palms.splice(i, 1);
      }
    }
  }

  /** Пальма у края на своей высоте, крона к центру — как на странице трека. */
  spawnPalm() {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const onLeft = Math.random() < 0.5;
    const scale = Phaser.Math.FloatBetween(0.85, 1.4);

    // встаёт в мир чуть выше экрана и дальше живёт на этой высоте
    const baseAngle = onLeft ? Phaser.Math.Between(2, 9) : Phaser.Math.Between(-9, -2);
    const palm = scene.add.image(
      onLeft ? 46 * scale : CONF.width - 46 * scale,
      cam.scrollY - Phaser.Math.Between(220, 420),
      'palm',
    ).setDepth(-6).setScale(scale)
     .setAlpha(Phaser.Math.FloatBetween(0.5, 0.68))
     .setFlipX(!onLeft)
     .setOrigin(0.5, 0.92) // качается вокруг основания ствола
     .setAngle(baseAngle - 1.3);

    // лёгкое покачивание, как на странице трека
    scene.tweens.add({
      targets: palm,
      angle: baseAngle + 1.3,
      duration: Phaser.Math.Between(2800, 4200),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.palms.push(palm);
  }

  /** Далёкая гора, по которой лама толкает валун. Каждый раз — чуть выше. */
  spawnSisyphus() {
    const S = CONF.sisyphus;
    const scene = this.scene;
    const cam = scene.cameras.main;
    const onLeft = Math.random() < 0.5;
    const cx = onLeft ? 92 : CONF.width - 92;

    const mountain = scene.add.image(0, 0, 'mountain');
    if (!onLeft) mountain.setFlipX(true);

    // лама с валуном: прогресс по склону растёт с каждым появлением
    this.sisProgress = Math.min(1, this.sisProgress + 0.11);
    const side = onLeft ? 1 : -1;

    // ребро горы из текстуры (см. boot.js): (0,150)→(128,26), центр текстуры (95,75)
    const A = { x: 0 - 95, y: 150 - 75 };   // подножие
    const B = { x: 128 - 95, y: 26 - 75 };  // вершина
    const t = 0.18 + this.sisProgress * 0.68; // не с самого края и не на пике
    const rx = Phaser.Math.Linear(A.x, B.x, t);
    const ry = Phaser.Math.Linear(A.y, B.y, t);
    // единичный вектор вдоль склона и перпендикуляр «от горы»
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    const ux = (B.x - A.x) / len, uy = (B.y - A.y) / len;
    const nxp = uy, nyp = -ux; // перпендикуляр вверх-влево от ребра

    // лама стоит на ребре, наклонена по склону, светлее горы
    const llama = scene.add.image((rx + nxp * 7) * side, ry + nyp * 7, 'p-llama')
      .setScale(0.32).setTint(0x8a6aa8).setFlipX(!onLeft)
      .setAngle(-24 * side);
    // валун — выше по склону, перед ламой
    const boulder = scene.add.image(
      (rx + ux * 13 + nxp * 5) * side,
      ry + uy * 13 + nyp * 5,
      'boulder',
    ).setTint(0x9a8ab8).setScale(0.95);

    const group = scene.add.container(cx, cam.scrollY - 60, [mountain, llama, boulder])
      .setDepth(1).setAlpha(0);

    scene.tweens.add({ targets: group, alpha: 0.52, duration: 1400 });
    scene.tweens.add({
      targets: group,
      y: group.y + S.driftPx,
      duration: S.lifeMs,
      onComplete: () => group.destroy(),
    });
    scene.tweens.add({
      targets: group, alpha: 0,
      delay: S.lifeMs - 2200, duration: 2200,
    });
  }
}
