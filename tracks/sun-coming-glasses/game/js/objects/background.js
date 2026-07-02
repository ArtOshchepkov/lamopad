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

    // ── солнце: дышит внизу и медленно отстаёт при подъёме ──
    // маленький scrollFactor = сильный параллакс: тонет в ~7 раз медленнее мира
    const sunSf = 0.14;
    const sunScreenY = CONF.height - 165; // где солнце висит на старте
    this.sun = scene.add.image(
      CONF.width / 2,
      sunScreenY + scene.cameras.main.scrollY * sunSf,
      'bigsun',
    ).setScrollFactor(1, sunSf).setDepth(-9).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: this.sun, scale: 1.08, yoyo: true, repeat: -1,
      duration: 2600, ease: 'Sine.easeInOut',
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

  update(curM, maxM) {
    const cam = this.scene.cameras.main;

    // окно градиента: снизу (офис) к верху (космос)
    const t = Phaser.Math.Clamp(curM / SKY_MAX_M, 0, 1);
    this.sky.y = (CONF.height - SKY_TEX_H) * (1 - t);

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

    // лама с валуном на склоне: прогресс растёт с каждым появлением
    this.sisProgress = Math.min(1, this.sisProgress + 0.11);
    // склон текстуры: от подножия (-64, 62) к вершине (8, -66) в локальных координатах
    const lx = Phaser.Math.Linear(-64, 8, this.sisProgress) * (onLeft ? 1 : -1);
    const ly = Phaser.Math.Linear(62, -58, this.sisProgress);
    const llama = scene.add.image(lx, ly, 'p-llama').setScale(0.28).setTint(0x140a28);
    const boulder = scene.add.image(lx + (onLeft ? 13 : -13), ly - 2, 'boulder').setTint(0x140a28);

    const group = scene.add.container(cx, cam.scrollY - 60, [mountain, llama, boulder])
      .setDepth(1).setAlpha(0);

    scene.tweens.add({ targets: group, alpha: 0.42, duration: 1400 });
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
