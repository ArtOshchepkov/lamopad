// ─── Панель SWING: качели между двумя погодами ───────────────────────────────
//
// МЕХАНИКА. Качели ходят сами и никогда не останавливаются (IDLE). Клик по
// панели или нажатие клавиши подбрасывает размах на KICK, размах тихо гаснет
// (DECAY). Больше игрок не может ничего — это вся игра.
//
// ПОГОДА. mood = sin(фазы) × размах, то есть −1..+1 и знак = сторона маха.
// Вправо-вверх — солнце растёт, небо золотеет; влево-вверх — тучи, дождь,
// снег на земле, молнии и тёмные края. Середина — обычный день. Отсюда
// главное следствие: чем сильнее раскачал, тем дальше уходит в ОБЕ стороны.
//
// РУЧКИ: PERIOD — скорость хода, MAX_ANG — угол при полном размахе,
// KICK/DECAY — насколько отзывчивы качели. Пороги погоды зашиты в draw()
// через gloom: 0.45 — снег, 0.72 — молнии.
import { Panel } from './panel.js';
import { PAL, mix, px, rnd } from './pal.js';
import { UfoTraffic } from './ufo.js';
import { Skyline } from './skyline.js';

const PERIOD = 3.4;             // секунд на полный ход туда-обратно
const MAX_ANG = 1.15;           // радиан в крайней точке при полном размахе
const KICK = 0.15;              // сколько добавляет один клик
const DECAY = 0.055;            // и как быстро это уходит
const IDLE = 0.1;               // сами по себе качели всё равно покачиваются

export class Swing extends Panel {
  constructor(host) {
    super(host);
    this.phase = 0;
    this.amp = IDLE;
    this.flash = 0;
    this.kickT = 0;
    this.ufos = new UfoTraffic();
    this.skyline = new Skyline();
    // Panel.measure() зовёт layout() ещё из super(), когда города не было
    if (this.w) this.skyline.layout(this.w, this.h, this.groundY, this.unit);
    const r = rnd(20260922);
    this.drops = Array.from({ length: 90 }, () => ({ x: r(), y: r(), v: 0.8 + r() * 0.9 }));
    this.flakes = Array.from({ length: 50 }, () => ({ x: r(), y: r(), v: 0.1 + r() * 0.12, d: r() * 6.28 }));
    this.clouds = [0, 1, 2, 3].map((i) => ({ x: r(), y: 0.08 + r() * 0.24, s: 0.6 + r() * 0.7, v: 0.01 + r() * 0.02 }));
  }

  layout(w, h) {
    this.unit = Math.max(2, Math.round(Math.min(w, h) / 46));
    this.pivotX = w * 0.5;
    this.pivotY = h * 0.26;
    this.groundY = h * 0.86;
    this.ropeLen = this.groundY - this.pivotY - Math.min(w, h) * 0.14;
    this.legW = Math.min(w, h) * 0.2;
    this.skyline?.layout(w, h, this.groundY, this.unit);
  }

  /** −1 — в самой темноте, 0 — посередине, +1 — на свету. */
  get mood() { return Math.sin(this.phase) * this.amp; }

  _kick() {
    this.amp = Math.min(1, this.amp + KICK);
    this.kickT = 0.18;
  }

  onPointerDown() { this._kick(); }
// НЕ ЗВАТЬ preventDefault. Клавиатуру доски слушают все панели и Phaser-сцена
// соседней ячейки, а она игнорирует события с defaultPrevented — погасив
// событие здесь, панель ослепила бы соседей. Мы гости на общей клавиатуре.
  onKeyDown(e) {
    // автоповтор пропускаем: на доске стрелку держат минутами ради соседней
    // панели, и качели иначе намертво повисли бы на максимуме
    if (e.repeat) return;
    if (['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      this._kick();
    }
  }

  update(dt) {
    this.phase += (Math.PI * 2 / PERIOD) * dt;
    this.amp = Math.max(IDLE, this.amp - DECAY * this.amp * dt - 0.004 * dt);
    this.kickT = Math.max(0, this.kickT - dt);
    this.ufos.update(dt, this.w, this.h, this.unit);

    const gloom = Math.max(0, -this.mood);
    if (gloom > 0.05) {
      for (const d of this.drops) {
        d.y += d.v * dt * (0.6 + gloom);
        if (d.y > 1) { d.y -= 1; d.x = Math.random(); }
      }
      for (const f of this.flakes) {
        f.y += f.v * dt;
        f.d += dt * 1.6;
        if (f.y > 1) { f.y -= 1; f.x = Math.random(); }
      }
      // молния бьёт только в самой глубине
      if (gloom > 0.72 && Math.random() < dt * 1.6) this.flash = 0.26;
    }
    this.flash = Math.max(0, this.flash - dt);
  }

  draw(ctx, w, h) {
    const u = this.unit;
    const m = this.mood;
    const light = Math.max(0, m), gloom = Math.max(0, -m);

    // небо: от грозовой черноты через обычный день к слепящему золоту
    const top = gloom > 0 ? mix(PAL.skyTop, '#0b0d18', gloom) : mix(PAL.skyTop, '#e8a020', light);
    const mid = gloom > 0 ? mix(PAL.skyMid, '#1b2030', gloom) : mix(PAL.skyMid, '#ffd93f', light);
    const low = gloom > 0 ? mix(PAL.skyLow, '#2a3040', gloom) : mix(PAL.skyLow, '#fff2c0', light);
    px(ctx, 0, 0, w, h * 0.42, top);
    px(ctx, 0, h * 0.42, w, h * 0.3, mid);
    px(ctx, 0, h * 0.72, w, h * 0.3, low);

    // солнце растёт вместе со светом и тонет в тучах вместе с тоской
    if (light > 0.02) {
      const R = u * (2 + light * 3);
      const sx = w * 0.78, sy = h * 0.2;
      for (let i = 0; i < 8 && light > 0.35; i++) {
        const a = i * Math.PI / 4 + this.time * 0.3;
        px(ctx, sx + Math.cos(a) * R * 2, sy + Math.sin(a) * R * 2, u, u, PAL.sun);
      }
      px(ctx, sx - R, sy - R * 0.7, R * 2, R * 1.4, PAL.sun);
      px(ctx, sx - R * 0.7, sy - R, R * 1.4, R * 2, PAL.sun);
    }

    for (const c of this.clouds) {
      c.x -= c.v * 0.02;
      if (c.x < -0.25) c.x = 1.25;
      const cx = c.x * w, cy = c.y * h, cw = u * 8 * c.s;
      const col = mix(PAL.cloud, '#2c2f3c', gloom);
      px(ctx, cx, cy, cw, u * 1.8, col);
      px(ctx, cx + cw * 0.22, cy - u * 1.6, cw * 0.55, u * 1.8, col);
    }

    this.ufos.draw(ctx, w, u, light, gloom);   // в небе, за городом, качелями и погодой
    this.skyline.draw(ctx, light, gloom);

    // земля
    px(ctx, 0, this.groundY, w, h - this.groundY, mix(PAL.ground, '#241a10', gloom * 0.8));
    px(ctx, 0, this.groundY, w, u, mix(PAL.groundTop, '#3a2a18', gloom * 0.8));
    if (gloom > 0.5) {
      // снег ложится, когда становится совсем нехорошо
      px(ctx, 0, this.groundY, w, u * (gloom - 0.5) * 4, mix(PAL.groundTop, '#e8eef6', (gloom - 0.5) * 2));
    }

    this._rig(ctx, w, h, u, gloom, { top, mid, low });
    this._weather(ctx, w, h, u, gloom);

    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.75, this.flash * 2.6);
      px(ctx, 0, 0, w, h, '#dfe6ff');
      ctx.globalAlpha = 1;
      this._bolt(ctx, w, h, u);
    }

    // по краям темнеет — панель затягивает вместе с настроением
    if (gloom > 0.15) {
      ctx.globalAlpha = gloom * 0.5;
      const b = Math.round(Math.min(w, h) * 0.14);
      px(ctx, 0, 0, w, b, '#05060a'); px(ctx, 0, h - b, w, b, '#05060a');
      px(ctx, 0, 0, b, h, '#05060a'); px(ctx, w - b, 0, b, h, '#05060a');
      ctx.globalAlpha = 1;
    }
  }

  /** Рама, верёвки, сиденье и тот, кто на нём. */
  _rig(ctx, w, h, u, gloom, sky) {   // sky — три полосы неба, нужны мозаике под цвет фона
    const wood = mix('#8a5a28', '#2e2418', gloom * 0.7);
    const woodHi = mix('#b07c3c', '#463420', gloom * 0.7);
    const px0 = this.pivotX, py = this.pivotY, L = this.ropeLen;
    const legW = this.legW;

    // А-образные стойки
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.lineWidth = u * 1.4;
      ctx.strokeStyle = wood;
      ctx.beginPath();
      ctx.moveTo(px0 + s * legW * 0.1, py);
      ctx.lineTo(px0 + s * legW, this.groundY + u);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px0 + s * legW * 0.55, py);
      ctx.lineTo(px0 + s * legW * 0.32, this.groundY + u);
      ctx.stroke();
      ctx.restore();
    }
    px(ctx, px0 - legW * 1.1, py - u, legW * 2.2, u * 1.6, woodHi);

    const a = Math.sin(this.phase) * this.amp * MAX_ANG;
    const sx = px0 + Math.sin(a) * L;
    const sy = py + Math.cos(a) * L;

    ctx.lineWidth = Math.max(1.5, u * 0.5);
    ctx.strokeStyle = mix('#d8c8a8', '#4a4438', gloom * 0.7);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(px0 + s * u * 1.6, py);
      ctx.lineTo(sx + s * u * 1.6 * Math.cos(a), sy - s * u * 1.6 * Math.sin(a));
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    px(ctx, -u * 3, 0, u * 6, u * 1.2, woodHi);              // доска
    // седок: спина, голова, ноги враскачку
    const kick = Math.cos(this.phase) * this.amp;
    const shirt = mix(PAL.red, '#4a1810', gloom * 0.6);
    px(ctx, -u * 1.2, -u * 4.4, u * 2.4, u * 3.0, shirt);
    px(ctx, u * 0.6 + kick * u * 1.4, -u * 1.4, u * 1.0, u * 2.6, mix('#3c4a6c', '#1a1e2c', gloom * 0.6));
    px(ctx, -u * 1.6 + kick * u * 1.4, -u * 1.4, u * 1.0, u * 2.6, mix('#3c4a6c', '#1a1e2c', gloom * 0.6));
    ctx.restore();

    const head = this._censorFace(ctx, u, sx, sy, a, gloom, sky);
    this._cameras(ctx, u, gloom, head);

    if (this.kickT > 0) {                                    // отклик на клик
      ctx.globalAlpha = this.kickT * 3;
      px(ctx, sx - u * 5, sy - u * 8, u * 10, u * 0.6, PAL.paper);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Лицо седока закрыто мозаикой, как у героя интервью, которого нельзя узнать.
   * Сетка привязана к экрану, а не к голове: пока качели едут, клетки под
   * ней меняют цвет — так же дрожит настоящая пикселизация.
   * Цвет клетки — то, что лежит под её центром: шевелюра, лицо, рубаха или небо
   * (sky — полосы неба, у каждой высоты свой фон).
   * @returns {{x:number,y:number}} — где голова, чтобы камерам было куда смотреть
   */
  _censorFace(ctx, u, sx, sy, a, gloom, sky) {
    const cos = Math.cos(a), sin = Math.sin(a);
    const hx = sx - (-u * 5.6) * sin, hy = sy + (-u * 5.6) * cos;   // центр головы в кадре
    const hair = mix('#2c1c14', '#101018', gloom * 0.6);
    const skin = mix('#f4b888', '#7a6250', gloom * 0.6);
    const shirt = mix(PAL.red, '#4a1810', gloom * 0.6);
    const c = Math.max(3, Math.round(u));
    const reach = u * 2.2;
    for (let gy = Math.floor((hy - reach) / c); gy * c < hy + reach; gy++) {
      for (let gx = Math.floor((hx - reach) / c); gx * c < hx + reach; gx++) {
        const dx = (gx + 0.5) * c - sx, dy = (gy + 0.5) * c - sy;
        const lx = (dx * cos + dy * sin) / u, ly = (-dx * sin + dy * cos) / u;   // назад в систему седока
        const inHair = Math.abs(lx) < 1.4 && ly > -6.9 && ly < -6.0;
        const inFace = Math.abs(lx) < 1.0 && ly >= -6.4 && ly < -4.4;
        const inShirt = Math.abs(lx) < 1.2 && ly >= -4.4 && ly < -1.4;
        const bg = dy + sy < this.h * 0.42 ? sky.top : dy + sy < this.h * 0.72 ? sky.mid : sky.low;
        px(ctx, gx * c, gy * c, c, c, inHair ? hair : inFace ? skin : inShirt ? shirt : bg);
        // у каждой клетки свой оттенок: среднее по куску никогда не бывает ровным
        ctx.globalAlpha = (((gx * 73856093) ^ (gy * 19349663)) >>> 0) % 100 / 100 * 0.16;
        px(ctx, gx * c, gy * c, c, c, '#000000');
        ctx.globalAlpha = 1;
      }
    }
    return { x: hx, y: hy };
  }

  /**
   * Пять камер на верхней перекладине. Каждая то держит человека в кадре,
   * то шарит по сторонам: доля «шарит» у всех своя и медленно гуляет, поэтому
   * камеры не ходят строем.
   */
  _cameras(ctx, u, gloom, head) {
    const beamTop = this.pivotY - u;
    const body = mix('#c9cfd8', '#4a4e5a', gloom * 0.7);
    const dark = mix('#3c4250', '#1a1e28', gloom * 0.7);
    for (let i = 0; i < 5; i++) {
      const jx = this.pivotX + (i - 2) * this.legW * 0.42;
      const jy = beamTop - u * 1.7;
      px(ctx, jx - u * 0.3, jy, u * 0.6, u * 1.7, dark);          // стойка на перекладине

      const aim = Math.atan2(head.y - jy, head.x - jx);
      const around = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(this.time * 0.33 + i * 2.1)) ** 1.5;
      const sweep = Math.sin(this.time * (0.8 + i * 0.13) + i * 1.9) * 1.5 * around;
      const t = Math.max(0.25, Math.min(Math.PI - 0.25, aim + sweep));  // вверх, в небо, не глядят

      ctx.save();
      ctx.translate(Math.round(jx), Math.round(jy));
      ctx.rotate(t);
      if (Math.cos(t) < 0) ctx.scale(1, -1);                      // чтобы козырёк оставался сверху
      px(ctx, -u * 0.9, -u * 0.75, u * 2.9, u * 1.5, body);
      px(ctx, -u * 0.6, -u * 1.05, u * 2.4, u * 0.3, dark);        // козырёк
      px(ctx, u * 2.0, -u * 0.5, u * 0.7, u, '#0c1016');           // объектив
      px(ctx, u * 2.3, -u * 0.4, u * 0.3, u * 0.3, '#7fa8d8');     // блик
      if ((this.time * 1.1 + i * 0.37) % 1 < 0.6) px(ctx, -u * 0.7, -u * 0.25, u * 0.5, u * 0.5, PAL.red);
      ctx.restore();
    }
  }

  _weather(ctx, w, h, u, gloom) {
    if (gloom < 0.05) return;
    ctx.globalAlpha = Math.min(1, gloom * 1.2);
    ctx.strokeStyle = '#9fb4d8';
    ctx.lineWidth = Math.max(1, u * 0.3);
    ctx.beginPath();
    const n = Math.round(this.drops.length * gloom);
    for (let i = 0; i < n; i++) {
      const d = this.drops[i];
      const x = d.x * w, y = d.y * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x - u * 0.8, y + u * 2.4);
    }
    ctx.stroke();
    if (gloom > 0.45) {
      const sn = Math.round(this.flakes.length * (gloom - 0.45) * 1.8);
      for (let i = 0; i < sn; i++) {
        const f = this.flakes[i];
        px(ctx, f.x * w + Math.sin(f.d) * u * 1.5, f.y * h, u * 0.8, u * 0.8, '#eef4ff');
      }
    }
    ctx.globalAlpha = 1;
  }

  _bolt(ctx, w, h, u) {
    ctx.strokeStyle = '#fffbe0';
    ctx.lineWidth = Math.max(2, u * 0.7);
    ctx.beginPath();
    let x = w * (0.15 + (this.time * 7 % 1) * 0.2), y = 0;
    ctx.moveTo(x, y);
    while (y < this.groundY) {
      y += h * 0.12;
      x += (Math.random() - 0.5) * u * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
