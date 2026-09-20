// ─── HUD: счётчик толпы, шкала наклона, подсказки, тач-стрелки ──────────────
// Phaser Text не трогаем каждый кадр — только когда значения реально меняются.
import { CONF, PAL } from '../config.js';
import { Debug } from '../debug.js';

const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;
const FONT = '"Courier New", ui-monospace, monospace';
const SEGS = 16;

export class UIScene extends Phaser.Scene {
  constructor() { super('ui'); }

  create() {
    this.touch = this.sys.game.device.input.touch;
    this.throttle = this.touch ? CONF.hud.throttleTouch : CONF.hud.throttleDesktop;
    this.lastAt = 0;
    this.shown = { count: -1, seg: -1, hint: '', left: -1 };

    const style = { fontFamily: FONT, fontSize: '26px', color: PAL.paper, fontStyle: 'bold' };
    this.countText = this.add.text(18, 14, 'НАС: 1', style)
      .setShadow(3, 3, '#000', 0, true, true).setDepth(100);

    // шкала напряжения — сегментами, как полоска здоровья на денди.
    // Слева под счётчиком: справа в портрете её закрывают кнопки звука
    this.meter = this.add.graphics().setDepth(100);
    this.meterX = 18;
    this.meterY = 52;
    this._drawMeter(0);

    // обратный отсчёт по центру — как в аркадном автомате
    this.timeText = this.add.text(this.scale.width / 2, 12, '', {
      fontFamily: FONT, fontSize: '34px', color: PAL.paper, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setShadow(3, 3, '#000', 0, true, true).setDepth(100);

    this.hintText = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontFamily: FONT, fontSize: '22px', color: PAL.paper, fontStyle: 'bold',
    }).setOrigin(0.5, 1).setShadow(3, 3, '#000', 0, true, true).setDepth(100);
    this.tweens.add({ targets: this.hintText, alpha: 0.45, duration: 620, yoyo: true, repeat: -1 });

    if (this.touch) this._touchArrows();

    Debug.mount(this);
  }

  /** Крупные пиксельные стрелки — на телефоне надо видеть, куда жать. */
  _touchArrows() {
    const y = this.scale.height - 56;
    for (const [x, dir] of [[76, -1], [this.scale.width - 76, 1]]) {
      const g = this.add.graphics().setDepth(99).setAlpha(0.5);
      g.fillStyle(hex(PAL.paper), 1);
      for (let i = 0; i < 7; i++) {
        g.fillRect(x + dir * (18 - i * 6), y - (i + 1) * 4, 6, (i + 1) * 8);
      }
    }
  }

  _drawMeter(progress) {
    const filled = Math.round(progress * SEGS);
    this.meter.clear();
    for (let i = 0; i < SEGS; i++) {
      const x = this.meterX + i * 14;
      this.meter.fillStyle(hex('#000'), 0.45);
      this.meter.fillRect(x, this.meterY, 12, 16);
      if (i < filled) {
        const near = i >= SEGS - 3;
        this.meter.fillStyle(hex(near ? PAL.shoe : PAL.rustLite), 1);
        this.meter.fillRect(x + 2, this.meterY + 2, 8, 12);
      }
    }
  }

  update(time) {
    Debug.update(time);
    if (time - this.lastAt < this.throttle) return;
    this.lastAt = time;

    const gs = this.scene.get('game');
    if (!gs || !gs.bucket) return;

    const count = gs.crowd.size + 1;
    if (count !== this.shown.count) {
      this.shown.count = count;
      this.countText.setText('НАС: ' + (count * CONF.crowd.countMul).toLocaleString('ru-RU'));
    }

    // на финале таймер убираем: он своё отсчитал
    const left = gs.state === 'win' ? -1 : Math.ceil(gs.left);
    if (left !== this.shown.left) {
      this.shown.left = left;
      this.timeText.setText(left < 0 ? '' : String(left));
      this.timeText.setColor(left <= 8 ? '#ff5a3c' : PAL.paper);
    }

    // на финале шкала своё отработала — она только зашумляет кадр
    const seg = gs.state === 'win' ? -1 : Math.round(gs.bucket.progress * SEGS);
    if (seg !== this.shown.seg) {
      this.shown.seg = seg;
      if (seg < 0) this.meter.clear();
      else this._drawMeter(gs.bucket.progress);
    }

    const hint = gs.state === 'play' ? gs.hint : '';
    if (hint !== this.shown.hint) {
      this.shown.hint = hint;
      this.hintText.setText(hint);
    }
  }
}
