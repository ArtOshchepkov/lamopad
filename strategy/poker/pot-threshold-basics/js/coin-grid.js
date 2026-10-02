/**
 * Монеты квадратиками: один квадрат = unit монет.
 */
const MAX_CELLS = 50;
const EPS = 1e-9;

const clamp01 = (x) => Math.min(1, Math.max(0, Math.round(x / EPS) * EPS));

/** Наименьший «круглый» номинал (1, 2, 5, 10, 20, 50…), при котором amount влезает в MAX_CELLS квадратов. */
export function pickUnit(amount) {
  for (let pow = 1; ; pow *= 10) {
    for (const k of [1, 2, 5]) {
      if (amount / (k * pow) <= MAX_CELLS) return k * pow;
    }
  }
}

/**
 * Квадраты для amount монет, из которых закрашено filled.
 * part - какую долю квадрата занимает сумма (меньше 1 только у последнего),
 * fill - какая доля квадрата закрашена.
 */
export function cells(amount, filled, unit) {
  const count = Math.ceil(amount / unit - EPS);
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    part: clamp01(amount / unit - i),
    fill: clamp01(filled / unit - i),
  }));
}

/** Сколько квадратов в ряду, чтобы кучка из count квадратов была почти квадратной. */
export function pileCols(count) {
  return Math.max(1, Math.ceil(Math.sqrt(count)));
}

/**
 * Высота горизонтального среза кучки (в рядах снизу), под которым лежит area квадратов.
 * parts - ширины квадратов из cells(), кучка заполняется снизу рядами по cols.
 * Внутри ряда площадь растёт с высотой пропорционально ширине ряда, поэтому
 * неполный верхний ряд режется по своей ширине, а не по ширине кучки.
 */
export function cutHeight(parts, cols, area) {
  let below = 0;
  for (let row = 0; row * cols < parts.length; row++) {
    const width = parts.slice(row * cols, (row + 1) * cols).reduce((a, b) => a + b, 0);
    if (area <= below + width + EPS) return row + Math.max(0, area - below) / width;
    below += width;
  }
  return Math.ceil(parts.length / cols);
}
