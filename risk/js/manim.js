/**
 * Общая основа графиков в духе 3Blue1Brown: палитра manim, шрифт под LaTeX,
 * чёткий canvas на любом DPR и плавное перетекание значений к целевым.
 */
export const C = {
  bg: '#1C1C1C',
  axis: '#BBBBBB',
  grid: 'rgba(255,255,255,0.07)',
  blue: '#58C4DD',
  green: '#83C167',
  yellow: '#FFFF00',
  red: '#FC6255',
  grey: '#888888',
  text: '#ECECEC',
};

export const MATH = '"STIX Two Text", "Times New Roman", serif';

export const fmt = (x, digits = 1) => x.toLocaleString('ru-RU', { maximumFractionDigits: digits }).replace('-', '−');

/** Три значащие цифры: 25, 5,26, 0,001 - для величин, которые бывают и крошечными. */
export const sig = (x) => x.toLocaleString('ru-RU', { maximumSignificantDigits: 3 }).replace('-', '−');

/** Сколько знаков после запятой нужно подписям делений с шагом step (0,05 → 2). */
export const stepDigits = (step) => Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));

export function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= raw);
}

function kit(ctx) {
  return {
    ctx,
    // halo - тёмная обводка под текстом, как background stroke в manim: линии не режут подпись
    label(text, x, y, { color = C.text, align = 'left', base = 'alphabetic', px = 15, italic = false, halo = false } = {}) {
      ctx.font = `${italic ? 'italic ' : ''}${px}px ${MATH}`;
      ctx.textAlign = align;
      ctx.textBaseline = base;
      if (halo) {
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = C.bg;
        ctx.strokeText(text, x, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    },
    textWidth(text, px, italic = false) {
      ctx.font = `${italic ? 'italic ' : ''}${px}px ${MATH}`;
      return ctx.measureText(text).width;
    },
    // Значение в плашке на оси: залитый прямоугольник со скруглением и тёмным текстом
    pill(text, x, y, { align = 'center', fill = C.yellow, color = C.bg, px = 14 } = {}) {
      ctx.font = `700 ${px}px ${MATH}`;
      const tw = ctx.measureText(text).width, pw = tw + 12, ph = px + 8;
      const left = align === 'right' ? x - pw : align === 'left' ? x : x - pw / 2;
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.roundRect(left, y - ph / 2, pw, ph, 4); ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, left + pw / 2, y + 1);
      return pw;
    },
    // Рамка вокруг подписи, как SurroundingRectangle в manim. Правый край рамки - right,
    // но рамка целиком остаётся между minLeft и maxRight
    framed(text, right, y, { minLeft = 0, maxRight = Infinity, color = C.yellow, px = 17 } = {}) {
      ctx.font = `700 ${px}px ${MATH}`;
      const tw = ctx.measureText(text).width, bw = tw + 16, bh = px + 12;
      const left = Math.max(minLeft, Math.min(right, maxRight) - bw);
      ctx.fillStyle = C.bg;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(left, y, bw, bh, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, left + bw / 2, y + bh / 2 + 1);
      return bw;
    },
    arrow(x1, y1, x2, y2, color) {
      const a = Math.atan2(y2 - y1, x2 - x1), s = 7;
      ctx.strokeStyle = ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4));
      ctx.lineTo(x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4));
      ctx.fill();
    },
    dot(x, y, color, r = 4.5) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    },
    dashed(points, color, width = 1.5) {
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.setLineDash([]);
    },
  };
}

/**
 * Сцена: target задаёт set(), goals(target, size) превращает его в числа для анимации,
 * draw(kit, shown, size) рисует текущие (плавно догоняющие) значения.
 */
export function createScene(canvas, { aspect, initial, goals = (t) => t, draw }) {
  const ctx = canvas.getContext('2d');
  const k = kit(ctx);
  const target = { ...initial };
  const shown = {};
  let size = { w: 0, h: 0 }, raf = 0, last = 0;

  function frame(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    const a = 1 - Math.exp(-dt * 9);
    let moving = false;
    for (const [key, to] of Object.entries(goals(target, size))) {
      const from = shown[key] ?? to;
      const next = from + (to - from) * a;
      const done = Math.abs(to - next) <= Math.max(Math.abs(to), 1e-9) * 1e-3;
      shown[key] = done ? to : next;
      moving ||= !done;
    }
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, size.w, size.h);
    draw(k, shown, size);
    raf = moving ? requestAnimationFrame(frame) : 0;
    if (!moving) last = 0;
  }

  function kick() {
    if (!raf && size.w) raf = requestAnimationFrame(frame);
  }

  new ResizeObserver(() => {
    const w = canvas.clientWidth, h = Math.round(w * aspect), dpr = window.devicePixelRatio || 1;
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = { w, h };
    kick();
  }).observe(canvas);
  document.fonts?.load(`italic 15px ${MATH}`).then(kick);

  return {
    set(next) {
      Object.assign(target, next);
      kick();
    },
  };
}
