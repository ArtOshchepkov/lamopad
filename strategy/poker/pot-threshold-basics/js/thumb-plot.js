/**
 * График EV(ставка). Масштаб осей одинаковый (1 монета по X = 1 монете по Y),
 * поэтому наклон на экране честный и его можно сравнивать с пунктиром 45°.
 * Вид подстраивается под банк, так что при смене банка картинка остаётся той же,
 * меняются только подписи осей.
 */
import { evLine } from './bet-math.js';
import { C, fmt, sig, stepDigits, niceStep, createScene } from './manim.js';

const PAD = { left: 40, right: 18, top: 26 };
const AXIS_AT = 0.66; // доля высоты, где проходит ось X

// Ширина видимой части оси X в монетах: влезает ноль прямой и вершина треугольника
function spanFor({ pot, p }, { w, h }) {
  const l = evLine(pot, p);
  const plotW = w - PAD.left - PAD.right, room = h * AXIS_AT - PAD.top;
  return Math.max(1.18 * l.zero, (l.top * plotW) / room, 1e-6);
}

function draw({ ctx, label, framed, arrow, dot, dashed }, shown, { w, h }) {
  const l = evLine(shown.pot, shown.p);
  const ox = PAD.left, oy = Math.round(h * AXIS_AT);
  const k = (w - PAD.left - PAD.right) / shown.span;
  const X = (x) => ox + x * k, Y = (y) => oy - y * k;
  const step = niceStep(shown.span / 5), tick = (v) => fmt(v, stepDigits(step));

  // сетка и подписи делений: шаг одинаковый по обеим осям; считаем по номеру деления,
  // чтобы дробный шаг не копил погрешность
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.grid;
  for (let i = 1; X(i * step) < w - PAD.right; i++) {
    ctx.beginPath(); ctx.moveTo(X(i * step), PAD.top - 10); ctx.lineTo(X(i * step), h); ctx.stroke();
    label(tick(i * step), X(i * step), oy + 5, { color: C.grey, align: 'center', base: 'top', px: 12 });
  }
  for (let i = -Math.floor((h - oy) / k / step); Y(i * step) > PAD.top - 10; i++) {
    if (i === 0) continue;
    ctx.beginPath(); ctx.moveTo(ox, Y(i * step)); ctx.lineTo(w, Y(i * step)); ctx.stroke();
    label(tick(i * step), ox - 6, Y(i * step), { color: C.grey, align: 'right', base: 'middle', px: 12 });
  }

  // треугольник выгодных ставок
  const zx = Math.min(l.zero, shown.span * 2);
  ctx.fillStyle = 'rgba(131,193,103,0.28)';
  ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(0), Y(l.top)); ctx.lineTo(X(zx), Y(0)); ctx.closePath(); ctx.fill();

  // пунктир 45°: наклон −1, нулём в p·банк
  dashed([[X(0), Y(l.top)], [X(l.top + (h - oy) / k), Y(-(h - oy) / k)]], C.grey);

  // оси
  ctx.lineWidth = 2;
  arrow(ox, oy, w - 6, oy, C.axis);
  arrow(ox, h - 4, ox, 8, C.axis);
  label('ставка x', w - 8, oy - 8, { align: 'right', px: 14, italic: true, color: C.axis });
  label('EV', ox - 8, 14, { align: 'right', px: 14, italic: true, color: C.axis });

  // прямая EV(x): синяя в плюсе, красная в минусе
  const xEnd = shown.span * 1.1;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.blue;
  ctx.beginPath(); ctx.moveTo(X(0), Y(l.top)); ctx.lineTo(X(zx), Y(0)); ctx.stroke();
  if (l.zero < xEnd) {
    ctx.strokeStyle = C.red;
    ctx.beginPath(); ctx.moveTo(X(l.zero), Y(0)); ctx.lineTo(X(xEnd), Y(l.at(xEnd))); ctx.stroke();
  }

  // ступенька наклона: +run по X, −(1 − p)·run по Y; помещается внутри треугольника
  const reach = Math.min(l.zero, shown.span);
  const run = niceStep(reach / 5), sx = reach * 0.3, sy = l.at(sx), drop = (1 - shown.p) * run;
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.yellow;
  ctx.beginPath(); ctx.moveTo(X(sx), Y(sy)); ctx.lineTo(X(sx + run), Y(sy)); ctx.lineTo(X(sx + run), Y(sy - drop)); ctx.stroke();
  label('+' + sig(run), X(sx + run / 2), Y(sy) - 6, { color: C.yellow, align: 'center', px: 13 });
  label('−' + sig(drop), X(sx + run) + 5, Y(sy - drop / 2), { color: C.yellow, base: 'middle', px: 13 });

  // ключевые точки
  dot(X(0), Y(l.top), C.yellow);
  label('p · банк = ' + sig(l.top), X(0) + 9, Y(l.top) - 9, { color: C.yellow, px: 14 });

  // главное на графике - порог выгодной ставки: крупная точка с ореолом и подпись в рамке
  if (l.zero <= shown.span) {
    const zx0 = X(l.zero);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,0,0.45)';
    ctx.beginPath(); ctx.arc(zx0, oy, 12, 0, Math.PI * 2); ctx.stroke();
    dot(zx0, oy, C.yellow, 7);
    framed('Порог выгодной ставки = ' + sig(l.zero), zx0 + 30, oy + 24, { minLeft: ox + 4, maxRight: w - 4 });
  }
}

export function createThumbPlot(canvas) {
  return createScene(canvas, {
    aspect: 0.62,
    initial: { pot: 100, p: 0.2 },
    goals: (t, size) => ({ pot: t.pot, p: t.p, span: spanFor(t, size) }),
    draw,
  });
}
