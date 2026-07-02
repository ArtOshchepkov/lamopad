// ─── Фон: небо-градиент по высоте, звёзды стратосферы, Сизиф-виньетка ────────
import { CONF } from '../config.js';

const HexToColor = (hex) => Phaser.Display.Color.HexStringToColor(hex);

export class Background {
  /** @param {Phaser.Scene} scene */
  constructor(scene, lowGfx) {
    this.scene = scene;
    this.stops = CONF.sky.map(s => ({ m: s.m, col: HexToColor(s.c) }));

    // звёзды: включаются в стратосфере
    this.stars = scene.add.group();
    const starCount = lowGfx ? 22 : 46;
    for (let i = 0; i < starCount; i++) {
      const star = scene.add.image(
        Phaser.Math.Between(8, CONF.width - 8),
        Phaser.Math.Between(8, CONF.height - 8),
        'dot',
      ).setScrollFactor(0).setDepth(1).setAlpha(0)
       .setScale(Phaser.Math.FloatBetween(0.5, 1.4));
      this.stars.add(star);
    }
    this.starAlpha = 0;

    // Сизиф: следующее появление и прогресс ламы по склону
    this.nextSisM = CONF.sisyphus.firstM;
    this.sisProgress = 0;
  }

  skyColor(m) {
    const s = this.stops;
    if (m <= s[0].m) return s[0].col.color;
    for (let i = 1; i < s.length; i++) {
      if (m < s[i].m) {
        const t = (m - s[i - 1].m) / (s[i].m - s[i - 1].m);
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          s[i - 1].col, s[i].col, 100, Math.round(t * 100));
        return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
      }
    }
    return s[s.length - 1].col.color;
  }

  update(curM, maxM) {
    this.scene.cameras.main.setBackgroundColor(this.skyColor(curM));

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
