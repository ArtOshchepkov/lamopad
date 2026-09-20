// ─── Зацензуренный город на горизонте ────────────────────────────────────────
//
// Дома — прямоугольники, а прямоугольник и есть цензурная плашка: каждый
// фасад — мозаика из квадратов (см. censor.js), растянутая на своё место.
// Что там за город, не разобрать; видно только, что он есть и стоит на земле.
//
// РУЧКИ: COUNT — сколько домов, HEIGHT — их высота долями панели, CELL —
// крупность мозаики. Расстановка задана зерном, поэтому город один и тот же.
import { moodTint, censored } from './censor.js';
import { rnd } from './pal.js';

const SRC_W = 24, SRC_H = 48;
const CELL = 3;
const COUNT = 7;
const HEIGHT = [0.12, 0.3];

// три фасада: бетон с тёмными окнами, кирпич, синее стекло
const FACADES = [
  { wall: '#8a92a0', win: '#3c4250', lit: '#ffd93f' },
  { wall: '#9c6b56', win: '#4a2c24', lit: '#ffb030' },
  { wall: '#5a7aa8', win: '#cfe0f4', lit: '#ffffff' },
];

const facade = (f) => (g) => {
  g.fillStyle = f.wall;
  g.fillRect(0, 0, SRC_W, SRC_H);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 4; c++) {
      g.fillStyle = (r * 7 + c * 3) % 5 === 0 ? f.lit : f.win;
      g.fillRect(2 + c * 5.5, 3 + r * 5, 3.5, 3.5);
    }
  }
};

export class Skyline {
  constructor() {
    this.imgs = new Array(FACADES.length).fill(null);
    this.houses = [];
    FACADES.forEach((f, i) => {
      censored(facade(f), { w: SRC_W, h: SRC_H, cell: CELL, bg: f.wall }, (img) => { this.imgs[i] = img; });
    });
  }

  layout(w, h, groundY, u) {
    const r = rnd(1984);
    this.houses = [];
    for (let i = 0; i < COUNT; i++) {
      const bw = u * (5 + r() * 4);
      this.houses.push({
        x: (i + 0.15 + r() * 0.7) * (w / COUNT) - bw / 2,
        w: bw,
        h: h * (HEIGHT[0] + r() * (HEIGHT[1] - HEIGHT[0])),
        face: Math.floor(r() * FACADES.length),
      });
    }
    this.groundY = groundY;
  }

  draw(ctx, light, gloom) {
    if (this.imgs.some((im) => !im)) return;   // пока jpeg декодируется, города нет
    for (const b of this.houses) {
      const y = Math.round(this.groundY - b.h);
      ctx.drawImage(this.imgs[b.face], Math.round(b.x), y, Math.round(b.w), Math.round(b.h));
      moodTint(ctx, b.x, y, b.w, b.h, light, gloom);
    }
  }
}
