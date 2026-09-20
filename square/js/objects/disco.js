// ─── Дискотека: прожекторы над плитой, пульс мира в такт ────────────────────
// Всё здесь работает и без WebGL-шейдера, поэтому на слабых машинах и на
// Canvas-рендере дискотека всё равно есть, просто без кислотного пост-эффекта.
import { CONF, DEPTH } from '../config.js';
import { Beat } from '../beat.js';

const BEAMS = 3;

export class Disco {
  constructor(scene, groundY) {
    this.scene = scene;
    this.beams = [];
    for (let i = 0; i < BEAMS; i++) {
      const b = scene.add.image(
        scene.scale.width * (0.18 + i * 0.3),
        groundY + 40,                               // центр под землёй: видны только верхние лучи
        'rays',
      )
        .setDepth(DEPTH.hills + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(3.2 + i * 0.7)
        .setAlpha(0);
      b.spin = (i % 2 ? 1 : -1) * (0.09 + i * 0.05);
      b.hue = i / BEAMS;
      this.beams.push(b);
    }
    this.t = 0;
  }

  /** trip: 0..1 — насколько разошлась дискотека. */
  update(dt, trip) {
    this.t += dt;
    const on = trip > 0.02;
    for (const b of this.beams) {
      b.setVisible(on);
      if (!on) continue;
      b.rotation += b.spin * dt * (0.6 + Beat.energy);
      b.setAlpha(trip * (0.05 + Beat.beat * 0.16 + Beat.energy * 0.05));
      const hue = (b.hue + this.t * 0.06) % 1;
      b.setTint(Phaser.Display.Color.HSVToRGB(hue, 0.75, 1).color);
    }
  }

  /** Общий пульс: во сколько раз раздуть объект на этой доле. */
  static pulse(trip, amount) {
    return 1 + Beat.beat * amount * trip;
  }

  destroy() {
    for (const b of this.beams) b.destroy();
    this.beams.length = 0;
  }
}

/** Сила прихода: от размера толпы, с запасом снизу — чтобы было с чего начать. */
export function tripLevel(progress) {
  return Phaser.Math.Clamp(CONF.disco.minTrip + progress * (1 - CONF.disco.minTrip), 0, 1);
}
