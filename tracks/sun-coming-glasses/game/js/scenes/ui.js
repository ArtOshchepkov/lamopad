// ─── UI-сцена поверх игры: высота, рекорд, плашки вех ────────────────────────
import { CONF } from '../config.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('ui'); }

  create() {
    const res = Math.min(window.devicePixelRatio || 1, 2);
    const cx = CONF.width / 2;

    // текущая высота — крупно
    this.heightText = this.add.text(cx, 46, '0 м', {
      fontFamily: 'Unbounded, sans-serif', fontSize: '40px', fontStyle: '900',
      color: CONF.colors.white, stroke: '#2a0d3e', strokeThickness: 7,
    }).setOrigin(0.5, 0).setResolution(res);

    // рекорд — мелко под ней
    this.bestText = this.add.text(cx, 96, '', {
      fontFamily: 'Nunito, sans-serif', fontSize: '15px', fontStyle: '700',
      color: CONF.colors.gold, stroke: '#2a0d3e', strokeThickness: 4,
    }).setOrigin(0.5, 0).setResolution(res);

    // стартовая подсказка
    this.hint = this.add.container(cx, CONF.height * 0.56, [
      this.add.text(0, 0, 'Тапни или жми клавишу — и наверх!', {
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
    this.h4 = () => this.flash('НОВЫЙ РЕКОРД!');
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
    this.heightText.setText(cur + ' м');
    this.bestText.setText(best > 0 ? 'рекорд · ' + best + ' м' : '');
  }

  hideHint() {
    this.tweens.killTweensOf(this.hint);
    this.tweens.add({ targets: this.hint, alpha: 0, duration: 300 });
  }

  flash(msg) {
    const res = Math.min(window.devicePixelRatio || 1, 2);
    const t = this.add.text(CONF.width / 2, 150, msg, {
      fontFamily: 'Unbounded, sans-serif', fontSize: '24px', fontStyle: '900',
      color: CONF.colors.gold, stroke: '#2a0d3e', strokeThickness: 7,
    }).setOrigin(0.5).setScale(0.4).setResolution(res);
    this.tweens.add({
      targets: t, scale: 1, duration: 380, ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({
        targets: t, alpha: 0, y: 120, delay: 1300, duration: 500,
        onComplete: () => t.destroy(),
      }),
    });
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

    const title = this.add.text(0, -18, `${m.m} м · ${m.title}`, {
      fontFamily: 'Unbounded, sans-serif', fontSize: '17px', fontStyle: '700',
      color: CONF.colors.gold, align: 'center', wordWrap: { width: 380 },
    }).setOrigin(0.5).setResolution(res);
    const sub = this.add.text(0, 14, m.sub, {
      fontFamily: 'Nunito, sans-serif', fontSize: '14px', fontStyle: 'italic',
      color: CONF.colors.text, align: 'center', wordWrap: { width: 380 },
    }).setOrigin(0.5).setResolution(res);

    const plate = this.add.container(cx, 218, [
      this.add.image(0, 0, 'plate').setScale(0.98, 1),
      title, sub,
    ]).setAlpha(0).setScale(0.92);

    const hold = m.ach ? 3400 : 2400; // ачивки читаем дольше
    this.tweens.add({
      targets: plate, alpha: 1, scale: 1, duration: 320, ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({
        targets: plate, alpha: 0, y: 190, delay: hold, duration: 420,
        onComplete: () => {
          plate.destroy();
          this.plateBusy = false;
          this.drainPlates();
        },
      }),
    });
  }
}
