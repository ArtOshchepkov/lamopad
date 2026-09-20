// ─── Общая палитра и пиксельные хелперы мини-панелей ─────────────────────────
// Денди-ограниченная палитра: те же цвета, что у большой сцены, чтобы четыре
// панели на экране читались как одна вещь, а не как четыре разные поделки.

export const PAL = {
  skyTop:    '#2a4a9c',
  skyMid:    '#5b8fe0',
  skyLow:    '#a8cdf0',
  sun:       '#ffd93f',
  cloud:     '#fdf6e8',

  groundTop: '#c07a34',
  ground:    '#8a5220',
  groundDim: '#5c3414',
  groundDark:'#38200c',

  ink0:      '#0a0a0c',
  ink1:      '#141418',
  ink2:      '#1e1e24',
  paper:     '#fff2dc',
  paperDim:  '#e0d2b4',

  red:       '#d02c1c',
  redDark:   '#8c1c10',
  leaf:      '#3fa64c',

  llama:     '#efe4cf',
  llamaDark: '#c0ae92',

  steel:     '#6f7a90',
  steelHi:   '#cfd6e4',
  steelDim:  '#3c4250',
};

const hx = (c) => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];

/** Линейная смесь двух hex-цветов: t=0 — первый, t=1 — второй. */
export function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  const A = hx(a), B = hx(b);
  const c = (i) => Math.round(A[i] + (B[i] - A[i]) * k);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}

/** Прямоугольник по целым координатам: пиксель должен быть пикселем. */
export function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** Пиксельный круг: строки-полоски вместо дуги, чтобы край не мылился. */
export function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const R = Math.max(1, Math.round(r)), X = Math.round(cx), Y = Math.round(cy);
  for (let dy = -R; dy <= R; dy++) {
    const half = Math.round(Math.sqrt(R * R + R * 0.6 - dy * dy));
    ctx.fillRect(X - half, Y + dy, half * 2 + 1, 1);
  }
}

/** Пиксельное кольцо: внутри остаётся прозрачным, поэтому годится для печати поверх текста. */
export function ring(ctx, cx, cy, r, t, color) {
  ctx.fillStyle = color;
  const R = Math.max(2, Math.round(r)), X = Math.round(cx), Y = Math.round(cy);
  const ri = Math.max(0, R - Math.max(1, Math.round(t)));
  const half = (rad, dy) => Math.round(Math.sqrt(Math.max(0, rad * rad + rad * 0.6 - dy * dy)));
  for (let dy = -R; dy <= R; dy++) {
    const ho = half(R, dy);
    if (Math.abs(dy) > ri) { ctx.fillRect(X - ho, Y + dy, ho * 2 + 1, 1); continue; }
    const hi = half(ri, dy);
    ctx.fillRect(X - ho, Y + dy, ho - hi, 1);
    ctx.fillRect(X + hi + 1, Y + dy, ho - hi, 1);
  }
}

/** Линия толщиной t из квадратиков: наклонная, но без сглаживания. */
export function pline(ctx, x0, y0, x1, y1, t, color) {
  ctx.fillStyle = color;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  const s = Math.max(1, Math.round(t)), h = s / 2;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * k - h), Math.round(y0 + (y1 - y0) * k - h), s, s);
  }
}

/** Рисует карту вида ['..xx..', '.xxxx.'] клетками размера s. */
export function sprite(ctx, map, x, y, s, colors) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const col = colors[row[c]];
      if (col) px(ctx, x + c * s, y + r * s, s, s, col);
    }
  }
}

/** Детерминированный шум: один и тот же узор между запусками. */
export function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
