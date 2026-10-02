/**
 * Потолок ставки в долях банка от шанса победы: порог / банк = p / (1 − p).
 * Банк сокращается, поэтому одна кривая годится для любого банка.
 * Ниже кривой - ставки в плюс, выше - в минус; пунктир y = p - ловушка «ставка = p · банк».
 * До 50% показываем крупно (потолок там не больше банка), выше плавно отъезжаем.
 */
import { evLine } from './bet-math.js';
import { C, fmt, sig, stepDigits, niceStep, createScene } from './manim.js';

const PAD = { left: 52, right: 16, top: 24, bottom: 28 };
const NEAR = { xMax: 0.55, yMax: 1.2 };
const FAR = { xMax: 1, yMax: 4 };
const ratio = (p) => evLine(1, p).zero;

export const isFar = (p) => p > 0.5;

function draw({ ctx, label, arrow, dot, dashed, pill }, shown, { w, h }) {
  const { p, xMax, yMax } = shown;
  const x0 = PAD.left, y0 = h - PAD.bottom;
  const pw = w - PAD.left - PAD.right, ph = y0 - PAD.top;
  const X = (q) => x0 + (q / xMax) * pw, Y = (r) => y0 - (r / yMax) * ph;

  // сетка: подписываем столько делений, сколько помещается
  const xStep = 0.1, yStep = niceStep(yMax / 6);
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.grid;
  const every = Math.ceil(36 / ((pw * xStep) / xMax));
  for (let i = 1; i * xStep <= xMax + 1e-9; i++) {
    ctx.beginPath(); ctx.moveTo(X(i * xStep), PAD.top); ctx.lineTo(X(i * xStep), y0); ctx.stroke();
    if (i % every === 0) label(i * 10 + '%', X(i * xStep), y0 + 6, { color: C.grey, align: 'center', base: 'top', px: 12 });
  }
  for (let i = 1; i * yStep <= yMax + 1e-9; i++) {
    ctx.beginPath(); ctx.moveTo(x0, Y(i * yStep)); ctx.lineTo(X(xMax), Y(i * yStep)); ctx.stroke();
    label(fmt(i * yStep, stepDigits(yStep)), x0 - 6, Y(i * yStep), { color: C.grey, align: 'right', base: 'middle', px: 12 });
  }

  // всё содержимое режем по рамке графика: при зуме кривая уходит за край
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, PAD.top, pw, ph); ctx.clip();

  const curve = [];
  for (let i = 0; i <= 240; i++) {
    const q = Math.min(0.995, (i / 240) * Math.min(1, xMax * 1.02));
    curve.push([X(q), Math.max(Y(ratio(q)), -h)]);
  }
  const zone = (close, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    curve.forEach(([x, y]) => ctx.lineTo(x, y));
    close.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath(); ctx.fill();
  };
  zone([[w, -h], [w, y0]], 'rgba(131,193,103,0.22)'); // под кривой - в плюс
  zone([[X(0), -h]], 'rgba(252,98,85,0.12)');         // над кривой - в минус

  dashed([[x0, Y(1)], [X(xMax), Y(1)]], 'rgba(255,255,255,0.35)', 1);
  label('весь банк', x0 + 8, Y(1) - 6, { color: C.grey, px: 12, halo: true });
  dashed([[X(0), Y(0)], [X(xMax), Y(xMax)]], C.grey);
  label('p · банк', X(xMax * 0.92), Y(xMax * 0.92) + 18, { color: C.grey, align: 'right', px: 12, italic: true });

  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.blue;
  ctx.beginPath();
  curve.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();

  // текущий шанс: пунктир к осям и точка на кривой
  const r = ratio(p), inside = r <= yMax;
  const ry = Y(Math.min(r, yMax));
  dashed([[X(p), y0], [X(p), ry], [x0, ry]], C.yellow, 1.2);
  dot(X(p), ry, C.yellow, 6);
  ctx.restore();

  // оси
  ctx.lineWidth = 2;
  arrow(x0, y0, w - 4, y0, C.axis);
  arrow(x0, y0, x0, 8, C.axis);
  label('ставка / банк', x0 + 8, 18, { px: 14, italic: true, color: C.axis });
  label('шанс победы p', w - 8, y0 - 8, { align: 'right', px: 14, italic: true, color: C.axis, halo: true });

  // главное: потолок крупной плашкой на оси Y, шанс плашкой на оси X
  pill((inside ? '' : '↑ ') + sig(r), x0 + 4, ry, { align: 'right', px: 15 });
  pill(fmt(p * 100) + '%', X(p), y0 + 13, { px: 12, fill: C.bg, color: C.yellow });
}

export function createRatioPlot(canvas) {
  return createScene(canvas, {
    aspect: 0.72,
    initial: { p: 0.2 },
    goals: ({ p }) => ({ p, ...(isFar(p) ? FAR : NEAR) }),
    draw,
  });
}
