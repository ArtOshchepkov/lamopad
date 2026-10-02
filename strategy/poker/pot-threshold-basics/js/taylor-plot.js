/**
 * Ряд p + p² + p³ поверх точного потолка p / (1 − p). Зазор между ними - ошибка
 * приближения; он всегда сверху, то есть приближение никогда не советует лишнего.
 * Число членов n меняется плавно, чтобы кривая перетекала, а не прыгала.
 */
import { evLine, ceilingSeries } from './bet-math.js';
import { C, fmt, sig, createScene } from './manim.js';

const PAD = { left: 52, right: 16, top: 24, bottom: 28 };
const X_MAX = 0.7, Y_MAX = 2.4;
const TERMS = ['p', 'p + p²', 'p + p² + p³'];
const exact = (p) => evLine(1, p).zero;

function draw({ ctx, label, arrow, dot, dashed, pill }, { p, n }, { w, h }) {
  const x0 = PAD.left, y0 = h - PAD.bottom;
  const pw = w - PAD.left - PAD.right, ph = y0 - PAD.top;
  const X = (q) => x0 + (q / X_MAX) * pw, Y = (r) => y0 - (r / Y_MAX) * ph;

  ctx.lineWidth = 1;
  ctx.strokeStyle = C.grid;
  for (let i = 1; i * 0.1 <= X_MAX + 1e-9; i++) {
    ctx.beginPath(); ctx.moveTo(X(i / 10), PAD.top); ctx.lineTo(X(i / 10), y0); ctx.stroke();
    if (i % 2 === 0) label(i * 10 + '%', X(i / 10), y0 + 6, { color: C.grey, align: 'center', base: 'top', px: 12 });
  }
  for (let i = 1; i * 0.4 <= Y_MAX + 1e-9; i++) {
    ctx.beginPath(); ctx.moveTo(x0, Y(i * 0.4)); ctx.lineTo(X(X_MAX), Y(i * 0.4)); ctx.stroke();
    label(fmt(i * 0.4), x0 - 6, Y(i * 0.4), { color: C.grey, align: 'right', base: 'middle', px: 12 });
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(x0, PAD.top, pw, ph); ctx.clip();
  const qs = Array.from({ length: 201 }, (_, i) => (i / 200) * X_MAX);
  const exactPts = qs.map((q) => [X(q), Math.max(Y(exact(q)), -h)]);
  const approxPts = qs.map((q) => [X(q), Y(ceilingSeries(q, n))]);

  // зазор = ошибка приближения
  ctx.fillStyle = 'rgba(255,255,0,0.16)';
  ctx.beginPath();
  exactPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  [...approxPts].reverse().forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath(); ctx.fill();

  const stroke = (pts, color, width) => {
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  stroke(exactPts, 'rgba(88,196,221,0.45)', 6);   // точная кривая фоном
  stroke(approxPts, C.yellow, 3);                  // частичная сумма ряда

  const ex = exact(p), ap = ceilingSeries(p, n);
  dashed([[X(p), y0], [X(p), Y(Math.min(ex, Y_MAX))]], 'rgba(255,255,255,0.5)', 1.2);
  dot(X(p), Y(Math.min(ex, Y_MAX)), C.blue, 5);
  dot(X(p), Y(Math.min(ap, Y_MAX)), C.yellow, 5);
  ctx.restore();

  ctx.lineWidth = 2;
  arrow(x0, y0, w - 4, y0, C.axis);
  arrow(x0, y0, x0, 8, C.axis);
  label('ставка / банк', x0 + 8, 18, { px: 14, italic: true, color: C.axis });
  label('шанс победы p', w - 8, y0 - 8, { align: 'right', px: 14, italic: true, color: C.axis, halo: true });

  // формула текущего приближения и обе величины плашками на оси Y
  label(TERMS[Math.round(n) - 1], x0 + 14, PAD.top + 24, { color: C.yellow, px: 18, italic: true, halo: true });
  label('p / (1 − p)', x0 + 14, PAD.top + 46, { color: C.blue, px: 16, italic: true, halo: true });
  const yEx = Y(Math.min(ex, Y_MAX)), yAp = Y(Math.min(ap, Y_MAX));
  const apart = Math.abs(yEx - yAp) > 22;
  pill(sig(ex), x0 + 4, apart ? yEx : Math.min(yEx, yAp) - 11, { align: 'right', px: 13, fill: C.blue });
  pill(sig(ap), x0 + 4, apart ? yAp : Math.max(yEx, yAp) + 11, { align: 'right', px: 13 });
  pill(fmt(p * 100) + '%', Math.min(X(p), w - 26), y0 + 13, { px: 12, fill: C.bg, color: C.yellow });
}

export function createTaylorPlot(canvas) {
  return createScene(canvas, { aspect: 0.72, initial: { p: 0.2, n: 2 }, draw });
}
