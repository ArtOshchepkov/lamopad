// ─── Цензура «как в интервью»: мозаика из квадратов + плохой jpeg ────────────
//
// Картинка рисуется на крохотном холсте, сжимается до редкой сетки клеток (у
// каждой клетки свой оттенок — среднее по куску), раздувается обратно без
// сглаживания и напоследок прогоняется через настоящий jpeg с ничтожным
// качеством: блоки 8×8 и размазанный цвет получаются честными, без имитации.
// Разобрать, что там нарисовано, нельзя — видно только, что что-то есть.
import { PAL, px } from './pal.js';

/** Ужимает вдвое за проход: одним махом браузер берёт лишь пару точек и рвёт цвет. */
function shrink(src, w, h) {
  let cur = src;
  while (cur.width > w * 2 || cur.height > h * 2) {
    const nw = Math.max(w, Math.ceil(cur.width / 2)), nh = Math.max(h, Math.ceil(cur.height / 2));
    const next = document.createElement('canvas');
    next.width = nw; next.height = nh;
    next.getContext('2d').drawImage(cur, 0, 0, nw, nh);
    cur = next;
  }
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').drawImage(cur, 0, 0, w, h);
  return out;
}

/**
 * @param {(g: CanvasRenderingContext2D) => void} paint — что спрятано под цензурой
 * @param {{w:number,h:number,cell:number,bg:string,quality?:number}} o
 *   cell — сторона клетки мозаики в пикселях исходника; quality — качество jpeg
 * @param {(img: HTMLImageElement) => void} onReady — jpeg декодируется не сразу
 */
export function censored(paint, { w, h, cell, bg, quality = 0.05 }, onReady) {
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const g = src.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  paint(g);

  const small = shrink(src, Math.max(1, Math.round(w / cell)), Math.max(1, Math.round(h / cell)));
  g.imageSmoothingEnabled = false;
  g.drawImage(small, 0, 0, w, h);

  const img = new Image();
  img.onload = () => onReady(img);
  img.src = src.toDataURL('image/jpeg', quality);
}

/** Красит плашку под небо: в грозу темнее, на свету золотит. */
export function moodTint(ctx, x, y, w, h, light, gloom) {
  if (gloom > 0.02) {
    ctx.globalAlpha = gloom * 0.55;
    px(ctx, x, y, w, h, '#0b0d18');
  } else if (light > 0.02) {
    ctx.globalAlpha = light * 0.35;
    px(ctx, x, y, w, h, PAL.sun);
  }
  ctx.globalAlpha = 1;
}
