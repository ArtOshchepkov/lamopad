// ─── UI-сцена поверх игры: высота, рекорд, плашки вех ────────────────────────
import { CONF } from '../config.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('ui'); }

  create() {
    const res = Math.min(window.devicePixelRatio || 1, 2);
    const cx = CONF.width / 2;

    // текущая высота: чистое число в стиле трека — золото-закатный градиент,
    // тёмный кант и тёплая тень, лёгкий наклон
    this.heightText = this.add.text(16, 8, '0', {
      fontFamily: 'Unbounded, sans-serif', fontSize: '38px', fontStyle: '900',
      stroke: '#3a0d18', strokeThickness: 7,
    }).setOrigin(0, 0).setResolution(res).setAngle(-2);
    const grad = this.heightText.context.createLinearGradient(0, 0, 0, 50);
    grad.addColorStop(0, '#fff6ec');
    grad.addColorStop(0.45, '#ffcf3f');
    grad.addColorStop(1, '#ff7d1e');
    this.heightText.setFill(grad);
    this.heightText.setShadow(0, 3, 'rgba(120,10,60,0.55)', 6, false, true);
    this.lastHundred = 0;
    // перерисовка Text (градиент+обводка+тень) дорогая — копим и рисуем реже;
    // на слабой графике (тач-устройства) — вдвое реже
    this.pendingCur = null;
    this.lastHudAt = 0;
    const lowGfx = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.hudInterval = lowGfx ? 90 : 45;

    // рекорд — кубок и число
    this.bestText = this.add.text(18, 56, '', {
      fontFamily: 'Nunito, sans-serif', fontSize: '15px', fontStyle: '700',
      color: CONF.colors.gold, stroke: '#2a0d3e', strokeThickness: 4,
    }).setOrigin(0, 0).setResolution(res);

    // стартовая подсказка
    this.hint = this.add.container(cx, CONF.height * 0.56, [
      this.add.text(0, 0, 'Тапни — и к чёрту потолок!', {
        fontFamily: 'Unbounded, sans-serif', fontSize: '19px', fontStyle: '700',
        color: CONF.colors.white, stroke: '#2a0d3e', strokeThickness: 6,
        align: 'center', wordWrap: { width: 360 },
      }).setOrigin(0.5).setResolution(res),
      this.add.text(0, 58, '← → / A D — или держи палец слева/справа', {
        fontFamily: 'Nunito, sans-serif', fontSize: '15px',
        color: CONF.colors.text, stroke: '#2a0d3e', strokeThickness: 4,
        align: 'center',
      }).setOrigin(0.5).setResolution(res),
    ]);
    this.tweens.add({
      targets: this.hint, alpha: 0.55, yoyo: true, repeat: -1, duration: 900,
    });

    // очередь плашек вех
    this.plateQueue = [];
    this.plateBusy = false;

    const ev = this.game.events;
    this.h1 = (d) => this.onHeight(d);
    this.h2 = () => this.hideHint();
    this.h3 = (m) => this.enqueuePlate(m);
    this.h4 = () => this.epicRecord();
    ev.on('scg-height', this.h1);
    ev.on('scg-start', this.h2);
    ev.on('scg-milestone', this.h3);
    ev.on('scg-newrecord', this.h4);
    this.events.once('shutdown', () => {
      ev.off('scg-height', this.h1);
      ev.off('scg-start', this.h2);
      ev.off('scg-milestone', this.h3);
      ev.off('scg-newrecord', this.h4);
    });
  }

  onHeight({ cur, best }) {
    this.pendingCur = cur; // отрисует update() не чаще ~11 раз/сек
    this.bestText.setText(best > 0 ? '🏆' + best + ' м' : '');
    // каждый взятый стометровый рубеж — лёгкий пульс цифры
    const hundred = Math.floor(cur / 100);
    if (hundred < this.lastHundred) this.lastHundred = hundred; // упали — рубежи снова впереди
    if (hundred > this.lastHundred) {
      this.lastHundred = hundred;
      this.tweens.killTweensOf(this.heightText);
      this.heightText.setScale(1);
      this.tweens.add({
        targets: this.heightText, scale: 1.14,
        duration: 130, yoyo: true, ease: 'Quad.easeOut',
      });
    }
  }

  update(time) {
    if (this.pendingCur === null || time - this.lastHudAt < this.hudInterval) return;
    this.lastHudAt = time;
    this.heightText.setText(String(this.pendingCur));
    this.pendingCur = null;
  }

  hideHint() {
    this.tweens.killTweensOf(this.hint);
    this.tweens.add({ targets: this.hint, alpha: 0, duration: 300 });
  }

  /** НОВЫЙ РЕКОРД: вздрог мира, ударные волны, солнце, слэм-текст, конфетти. */
  epicRecord() {
    const res = Math.min(window.devicePixelRatio || 1, 2);
    // в нижней трети: сверху надпись загораживала игрока
    const cx = CONF.width / 2, cy = CONF.height * 0.72;

    // мир вздрагивает и озаряется золотом
    const gameCam = this.scene.get('game').cameras.main;
    gameCam.shake(220, 0.005);
    gameCam.flash(180, 255, 207, 63);

    // двойная золотая ударная волна
    [0, 170].forEach((delay) => {
      const ring = this.add.circle(cx, cy, 12).setStrokeStyle(5, 0xffcf3f, 0.85);
      this.tweens.add({
        targets: ring, radius: 330, alpha: 0, delay,
        duration: 750, ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    });

    // пылающее солнце за текстом
    const burst = this.add.image(cx, cy, 'burst')
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.4);
    this.tweens.add({ targets: burst, alpha: 0.8, scale: 1.5, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: burst, angle: 120, duration: 2800 });
    this.tweens.add({
      targets: burst, alpha: 0, delay: 2100, duration: 500,
      onComplete: () => burst.destroy(),
    });

    // слэм-текст: врезается с неба, пульсирует и разбрасывает искры
    const t = this.add.text(cx, cy, 'НОВЫЙ\nРЕКОРД!', {
      fontFamily: 'Unbounded, sans-serif', fontSize: '42px', fontStyle: '900',
      stroke: '#3a0d18', strokeThickness: 10, align: 'center',
    }).setOrigin(0.5).setResolution(res).setScale(2.8).setAlpha(0).setAngle(-8);
    const grad = t.context.createLinearGradient(0, 0, 0, t.height);
    grad.addColorStop(0, '#fff6ec');
    grad.addColorStop(0.45, '#ffcf3f');
    grad.addColorStop(1, '#ff7d1e');
    t.setFill(grad);
    t.setShadow(0, 4, 'rgba(120,10,60,0.6)', 8, false, true);
    this.tweens.add({
      targets: t, scale: 1, alpha: 1, angle: -2,
      duration: 230, ease: 'Cubic.easeIn',
      onComplete: () => {
        this.sparkles(cx, cy, 26);
        this.tweens.add({
          targets: t, scale: 1.07, duration: 260, yoyo: true, repeat: 2,
          ease: 'Sine.easeInOut',
        });
      },
    });
    const sub = this.add.text(cx, cy + 76, '🏆 прошлый ты позади', {
      fontFamily: 'Nunito, sans-serif', fontSize: '17px', fontStyle: 'italic',
      color: CONF.colors.gold, stroke: '#3a0d18', strokeThickness: 4,
    }).setOrigin(0.5).setResolution(res).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, delay: 350, duration: 300 });
    this.tweens.add({
      targets: [t, sub], alpha: 0, y: '-=60', delay: 2400, duration: 450,
      ease: 'Cubic.easeIn',
      onComplete: () => { t.destroy(); sub.destroy(); },
    });

    // конфетти с неба
    const colors = [0xffcf3f, 0xfff6ec, 0xff5040, 0xffb8dd, 0x9fc8ff];
    for (let i = 0; i < 36; i++) {
      const c = this.add.rectangle(
        Phaser.Math.Between(10, CONF.width - 10), -Phaser.Math.Between(10, 130),
        7, 11, Phaser.Utils.Array.GetRandom(colors),
      ).setAngle(Phaser.Math.Between(0, 180)).setAlpha(0.95);
      this.tweens.add({
        targets: c,
        y: c.y + Phaser.Math.Between(430, 780),
        x: c.x + Phaser.Math.Between(-80, 80),
        angle: c.angle + Phaser.Math.Between(-360, 360),
        alpha: 0,
        duration: Phaser.Math.Between(1200, 2000),
        ease: 'Sine.easeIn',
        onComplete: () => c.destroy(),
      });
    }
  }

  enqueuePlate(milestone) {
    this.plateQueue.push(milestone);
    this.drainPlates();
  }

  drainPlates() {
    if (this.plateBusy || this.plateQueue.length === 0) return;
    this.plateBusy = true;
    const m = this.plateQueue.shift();
    const res = Math.min(window.devicePixelRatio || 1, 2);
    const cx = CONF.width / 2;
    // внизу экрана: сверху плашка закрывала платформы, куда прыгает игрок
    const cy = CONF.height * 0.78;

    // лучистое солнце за цифрой — полупрозрачное и ленивое, чтобы не отвлекало
    const burst = this.add.image(0, 0, 'burst').setAlpha(0.38).setScale(m.ach ? 1.25 : 1);
    this.tweens.add({ targets: burst, angle: 90, duration: 11000, repeat: -1 });

    const alt = this.add.text(0, 0, `${m.m} м`, {
      fontFamily: 'Unbounded, sans-serif', fontSize: '38px', fontStyle: '900',
      color: CONF.colors.gold, stroke: '#3a0d18', strokeThickness: 8,
    }).setOrigin(0.5).setResolution(res);

    const title = this.add.text(0, 44, m.title, {
      fontFamily: 'Unbounded, sans-serif', fontSize: '19px', fontStyle: '700',
      color: CONF.colors.white, stroke: '#3a0d18', strokeThickness: 6,
      align: 'center', wordWrap: { width: 400 },
    }).setOrigin(0.5, 0).setResolution(res);

    const sub = this.add.text(0, 50 + title.height, m.sub, {
      fontFamily: 'Nunito, sans-serif', fontSize: '15px', fontStyle: 'italic',
      color: CONF.colors.text, stroke: '#3a0d18', strokeThickness: 4,
      align: 'center', wordWrap: { width: 380 },
    }).setOrigin(0.5, 0).setResolution(res).setAlpha(0);

    const parts = [burst, alt, title, sub];
    if (m.ach) {
      const achText = this.add.text(0, -46, '★ 🏅 ★', {
        fontFamily: 'Unbounded, sans-serif', fontSize: '16px', fontStyle: '700',
        color: CONF.colors.gold, stroke: '#3a0d18', strokeThickness: 5,
      }).setOrigin(0.5).setResolution(res);
      if (achText.setLetterSpacing) achText.setLetterSpacing(4);
      parts.push(achText);
    }

    const badge = this.add.container(cx, cy, parts).setScale(0.3).setAlpha(0).setAngle(-5);

    this.sparkles(cx, cy, m.ach ? 16 : 10);

    const hold = m.ach ? 5200 : 3800; // достижения читаем дольше
    this.tweens.add({
      targets: badge, alpha: 1, scale: 1, angle: 0,
      duration: 420, ease: 'Back.easeOut',
    });
    this.tweens.add({ targets: sub, alpha: 1, delay: 380, duration: 300 });
    this.tweens.add({
      targets: badge, alpha: 0, y: cy + 60,
      delay: hold, duration: 420, ease: 'Cubic.easeIn',
      onComplete: () => {
        this.tweens.killTweensOf(burst);
        badge.destroy();
        this.plateBusy = false;
        this.drainPlates();
      },
    });
  }

  /** Разлёт золотых искр из точки. */
  sparkles(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(60, 150);
      const d = this.add.image(x, y, 'dot')
        .setTint(0xffcf3f).setScale(Phaser.Math.FloatBetween(1.2, 2.6));
      this.tweens.add({
        targets: d,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        alpha: 0,
        scale: 0.4,
        duration: Phaser.Math.Between(450, 800),
        ease: 'Cubic.easeOut',
        onComplete: () => d.destroy(),
      });
    }
  }
}
