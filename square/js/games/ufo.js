// ─── Пролётные НЛО для неба качелей ──────────────────────────────────────────
//
// Само НЛО никто не видит: это прямоугольник цензуры — мозаика из квадратов
// разных оттенков (см. censor.js). Понять, что там, нельзя, но что-то явно
// несётся и оставляет за собой белый след, как самолёт.
//
// РУЧКИ: GAP — как часто (сек между вылетами), CROSS — за сколько секунд
// пересекает панель, TRAIL_LIFE — как долго тянется след, CELL — крупность
// мозаики (больше — грубее).
import { PAL, px } from './pal.js';
import { censored, moodTint } from './censor.js';

const SRC_W = 48, SRC_H = 20;   // размер спрятанной картинки до порчи
const CELL = 5;
const GAP = [0.7, 2.6];
const CROSS = [0.55, 1.1];
const TRAIL_LIFE = 1.4;
export const MAX_AT_ONCE = 3;
const SKY_PATCH = '#4a78c8';    // фон под предметом: цензура закрывает и небо

// ── что спрятано под цензурой (все рисунки смотрят вправо) ──
const lamp = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 2, 2); };

function saucer(g, llama) {
  g.fillStyle = '#5d6578';
  g.beginPath(); g.ellipse(24, 13, 20, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#aab2c0';
  g.beginPath(); g.ellipse(24, 12, 20, 4.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#bfe8ff';
  g.beginPath(); g.ellipse(24, 9, 8, 6, 0, Math.PI, 0); g.fill();
  if (llama) {                                     // в куполе кто-то есть
    g.fillStyle = PAL.llama;
    g.fillRect(20, 6, 9, 4); g.fillRect(27, 2, 2, 5); g.fillRect(27, 1, 4, 2);
    g.fillStyle = PAL.red;
    g.fillRect(21, 5, 3, 3);
  }
  ['#d02c1c', '#ffd93f', '#3fa64c', '#ffd93f', '#d02c1c']
    .forEach((c, i) => lamp(g, 7 + i * 8, 12, c));
}

function triangle(g) {
  g.fillStyle = '#2a2c34';
  g.beginPath(); g.moveTo(24, 1); g.lineTo(45, 18); g.lineTo(3, 18); g.closePath(); g.fill();
  lamp(g, 5, 15, '#ffffff'); lamp(g, 41, 15, '#ffffff'); lamp(g, 23, 2, '#ffffff');
  lamp(g, 23, 12, '#d02c1c');
}

function cigar(g) {
  g.fillStyle = '#c9cfd8';
  g.beginPath(); g.ellipse(24, 10, 22, 5, 0, 0, Math.PI * 2); g.fill();
  for (let x = 8; x < 42; x += 5) lamp(g, x, 9, '#ffb030');
}

const PAINTERS = [
  (g) => saucer(g, false),
  (g) => saucer(g, true),
  triangle,
  cigar,
];

/** Готовит цензурные плашки; каждая появляется в out по мере декодирования. */
function bakeAll(out) {
  for (const paint of PAINTERS) {
    censored(paint, { w: SRC_W, h: SRC_H, cell: CELL, bg: SKY_PATCH }, (img) => out.push(img));
  }
}

export class UfoTraffic {
  /** imgs и rand подставляют тесты: в node нет ни canvas, ни Image. */
  constructor({ imgs, rand = Math.random } = {}) {
    this.rand = rand;
    this.imgs = imgs ?? [];
    this.flying = [];
    this.wait = 0.5;
    if (!imgs) bakeAll(this.imgs);
  }

  update(dt, w, h, u) {
    this.wait -= dt;
    if (this.wait <= 0) {
      this.wait = GAP[0] + this.rand() * (GAP[1] - GAP[0]);
      if (this.imgs.length && this.flying.length < MAX_AT_ONCE) this._launch(w, h, u);
    }
    for (const f of this.flying) f.x += f.v * dt;
    // тело давно за краем, а след от него тянулся не дальше TRAIL_LIFE
    this.flying = this.flying.filter((f) => (f.x - f.x0) * f.dir < w + f.bw * 2 + Math.abs(f.v) * TRAIL_LIFE);
  }

  _launch(w, h, u) {
    const r = this.rand;
    const dir = r() < 0.5 ? -1 : 1;
    const bw = u * (9 + r() * 5);
    const x0 = dir > 0 ? -bw : w + bw;
    this.flying.push({
      img: this.imgs[Math.floor(r() * this.imgs.length)],
      dir, bw, bh: bw * SRC_H / SRC_W,
      x0, x: x0,
      v: dir * w / (CROSS[0] + r() * (CROSS[1] - CROSS[0])),
      y0: h * (0.14 + r() * 0.26),
      slope: (r() - 0.5) * 0.12,   // летят не строго по горизонтали
    });
  }

  /** light/gloom — настроение неба: цензурная плашка красится вместе с ним. */
  draw(ctx, w, u, light, gloom) {
    for (const f of this.flying) {
      this._trail(ctx, f, w, u);
      const y = f.y0 + (f.x - f.x0) * f.slope;
      ctx.save();
      ctx.translate(Math.round(f.x), Math.round(y));
      ctx.scale(f.dir, 1);
      ctx.drawImage(f.img, -f.bw / 2, -f.bh / 2, f.bw, f.bh);
      moodTint(ctx, -f.bw / 2, -f.bh / 2, f.bw, f.bh, light, gloom);
      ctx.restore();
    }
  }

  /** Двойной инверсионный след: у носа две тонкие струи, дальше они шире и бледнее. */
  _trail(ctx, f, w, u) {
    const speed = Math.abs(f.v), len = speed * TRAIL_LIFE;
    const reach = Math.min(len, Math.abs(f.x - f.x0));   // дальше точки вылета следа нет
    const step = Math.max(2, Math.round(u * 0.8));
    for (let d = f.bw * 0.5; d < reach; d += step) {
      const k = d / len;
      const x = f.x - f.dir * d;
      if (x < -step || x > w + step) continue;
      const y = f.y0 + (x - f.x0) * f.slope;
      const gap = u * (0.7 + k * 1.4), th = u * (0.3 + k * 0.9);
      ctx.globalAlpha = 0.85 * (1 - k) ** 1.4;
      px(ctx, x, y - gap / 2 - th / 2, step + 1, th, PAL.paper);
      px(ctx, x, y + gap / 2 - th / 2, step + 1, th, PAL.paper);
    }
    ctx.globalAlpha = 1;
  }
}
