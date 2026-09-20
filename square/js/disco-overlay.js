// ─── Общий свет над доской: одна дискотека на все панели ────────────────────
//
// Слой ничего не знает про игры под собой: он лежит поверх всей страницы,
// не ловит указатель и рисует только СВЕТ. Холст смешивается режимом screen,
// поэтому чёрное в нём прозрачно, а всё, что нарисовано, добавляется к
// картинке снизу — ни одна панель не становится темнее, чем была.
//
// Такт берётся из Beat (анализатор самого трека, js/beat.js). Обновляет Beat
// доска, здесь его только читают: beat — вспышка на долю, energy — общая
// громкость, bass — низ прямо сейчас.
//
// ЭФФЕКТЫ. Каждый дешёвый и живёт сам по себе, добавить новый — дописать
// метод и строку в _draw():
//   _wash      — два цветовых пятна по углам, дышат от низов
//   _beams     — прожекторы из-под низа экрана, водят лучами и крутят цвет
//   _edges     — полосы по краям кадра, вспыхивают на долю
//   _rings     — кольца, разлетающиеся с доли в случайной точке
//   _sparks    — пиксельные искры оттуда же
//   _flash     — общий подсвет всего кадра в цвет момента
//
// ТРЯСКА. Отдельно от света: сам слой стоит на месте, а трясётся доска под
// ним (CSS-трансформа на #board). Низы дают мелкую постоянную дрожь, доля —
// удар с откатом, плюс крошечный наезд, как будто камеру пнули. Сдвиг всегда
// целый в пикселях — иначе пиксель-арт панелей замылится.
//
// РУЧКИ: BEAMS — сколько лучей, SPARKS — искр на долю, HUE_SPIN — как быстро
// крутится цвет, SHAKE_PX и PUNCH — размах тряски и наезда, и коэффициенты
// альфы в каждом методе. Суммарная яркость держится небольшой: это
// подсветка, а не занавес.
import { Beat } from './beat.js';

const BEAMS = 5;
const SPARKS = 22;
const HUE_SPIN = 7;                 // градусов в секунду в покое
const SHAKE_PX = 11;                // максимальный сдвиг доски на удар, px
const SHAKE_HZ = 58;                // частота самой дрожи
const PUNCH = 0.013;                // наезд камеры на доле, доля от размера

export class DiscoOverlay {
  /**
   * @param {HTMLElement} host   — куда положить холст со светом
   * @param {HTMLElement} [shakeEl] — что трясти в такт (обычно сама доска)
   */
  constructor(host = document.body, shakeEl = null) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'disco-layer hidden';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.on = false;
    this.t = 0;
    this.hue = Math.random() * 360;
    this.rings = [];
    this.sparks = [];
    this.wasBeat = 0;
    this.shakeEl = shakeEl;
    this.kick = 0;                   // затухающий след удара, 0..1

    this._onResize = () => this.measure();
    window.addEventListener('resize', this._onResize);
    this.measure();
  }

  measure() {
    // свет мягкий, пиксельная честность ему не нужна — экономим на DPR
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.diag = Math.hypot(this.w, this.h);
  }

  setEnabled(on) {
    this.on = on;
    this.canvas.classList.toggle('hidden', !on);
    if (on) return;
    this.rings.length = 0;
    this.sparks.length = 0;
    this.kick = 0;
    if (this.shakeEl) this.shakeEl.style.transform = '';   // доску вернуть на место
  }

  tick(dt) {
    if (!this.on) return;
    this.t += dt;
    this.hue = (this.hue + dt * (HUE_SPIN + Beat.energy * 48)) % 360;

    // фронт доли: beat вспыхивает в единицу и затухает, ловим сам скачок
    const hit = Beat.beat > 0.8 && this.wasBeat <= 0.8;
    this.wasBeat = Beat.beat;
    if (hit) { this._pop(); this.kick = 1; }

    for (const r of this.rings) { r.r += r.v * dt; r.life -= dt * 1.5; }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const s of this.sparks) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt; s.life -= dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);

    this._shake(dt);
    this._draw();
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    if (this.shakeEl) this.shakeEl.style.transform = '';
    this.canvas.remove();
  }

  /**
   * Басовая тряска: доля бьёт, низы держат мелкую дрожь. Сдвиг округляем до
   * целого пикселя, чтобы панели не мылились, а наезд оставляем крошечным —
   * он должен чувствоваться, а не читаться.
   */
  _shake(dt) {
    if (!this.shakeEl) return;
    this.kick = Math.max(0, this.kick - dt * 6);
    const amp = SHAKE_PX * (this.kick * this.kick + Beat.bass * 0.35 * Beat.energy);
    const a = this.t * SHAKE_HZ;
    const x = Math.round(Math.sin(a) * amp);
    const y = Math.round(Math.cos(a * 1.37) * amp * 0.7);
    const zoom = 1 + (this.kick * PUNCH + Beat.bass * PUNCH * 0.4);
    this.shakeEl.style.transform = amp < 0.4 && zoom < 1.0005
      ? ''
      : `translate3d(${x}px, ${y}px, 0) scale(${zoom.toFixed(4)})`;
  }

  /** Доля: кольцо и горсть искр из одной случайной точки. */
  _pop() {
    const x = Math.random() * this.w;
    const y = Math.random() * this.h;
    // два кольца из одной точки, вдогонку друг другу: удар читается лучше
    this.rings.push({ x, y, r: this.diag * 0.02, v: this.diag * 0.5, life: 1, hue: this.hue });
    this.rings.push({ x, y, r: 0, v: this.diag * 0.32, life: 0.8, hue: (this.hue + 40) % 360 });
    for (let i = 0; i < SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 70 + Math.random() * 300;
      this.sparks.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0.45 + Math.random() * 0.55,
        hue: (this.hue + Math.random() * 90) % 360,
        s: 2 + Math.round(Math.random() * 4),
      });
    }
  }

  _draw() {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';   // свет складывается со светом
    this._wash(ctx, w, h);
    this._beams(ctx, w, h);
    this._edges(ctx, w, h);
    this._ringsDraw(ctx);
    this._sparksDraw(ctx);
    this._flash(ctx, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  _wash(ctx, w, h) {
    const amp = 0.06 + Beat.bass * 0.17;
    const spots = [
      [w * 0.12, h * 0.1, this.hue],
      [w * 0.88, h * 0.9, (this.hue + 170) % 360],
    ];
    for (const [x, y, hue] of spots) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, this.diag * 0.62);
      g.addColorStop(0, `hsla(${hue}, 95%, 58%, ${amp})`);
      g.addColorStop(1, `hsla(${hue}, 95%, 58%, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  _beams(ctx, w, h) {
    const pivot = { x: w * 0.5, y: h * 1.14 };
    const len = this.diag * 1.4;
    const k = 0.06 + Beat.beat * 0.2 + Beat.energy * 0.06;
    for (let i = 0; i < BEAMS; i++) {
      const spin = (i % 2 ? 1 : -1) * (0.13 + i * 0.05);
      const ang = -Math.PI / 2 + Math.sin(this.t * spin + i * 1.7) * 0.9;
      const half = 0.03 + (i % 3) * 0.014;
      const hue = (this.hue + i * (360 / BEAMS)) % 360;
      const ex = pivot.x + Math.cos(ang) * len;
      const ey = pivot.y + Math.sin(ang) * len;
      const g = ctx.createLinearGradient(pivot.x, pivot.y, ex, ey);
      g.addColorStop(0, `hsla(${hue}, 95%, 62%, ${k})`);
      g.addColorStop(0.6, `hsla(${hue}, 95%, 62%, ${k * 0.45})`);
      g.addColorStop(1, `hsla(${hue}, 95%, 62%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(pivot.x + Math.cos(ang - half) * len, pivot.y + Math.sin(ang - half) * len);
      ctx.lineTo(pivot.x + Math.cos(ang + half) * len, pivot.y + Math.sin(ang + half) * len);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Рампа по краям кадра: то, что на сцене светит из-за кулис. */
  _edges(ctx, w, h) {
    const k = Beat.beat * 0.3 + Beat.energy * 0.05;
    if (k < 0.01) return;
    const band = Math.max(10, Math.min(w, h) * 0.07);
    const sides = [
      [0, 0, w, band, 0, 0, 0, band, this.hue],
      [0, h - band, w, band, 0, h, 0, h - band, (this.hue + 60) % 360],
      [0, 0, band, h, 0, 0, band, 0, (this.hue + 120) % 360],
      [w - band, 0, band, h, w, 0, w - band, 0, (this.hue + 180) % 360],
    ];
    for (const [x, y, bw, bh, gx0, gy0, gx1, gy1, hue] of sides) {
      const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      g.addColorStop(0, `hsla(${hue}, 95%, 62%, ${k})`);
      g.addColorStop(1, `hsla(${hue}, 95%, 62%, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, bw, bh);
    }
  }

  _ringsDraw(ctx) {
    for (const r of this.rings) {
      ctx.strokeStyle = `hsla(${r.hue}, 95%, 64%, ${r.life * 0.4})`;
      ctx.lineWidth = 2 + r.life * 7;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _sparksDraw(ctx) {
    for (const s of this.sparks) {
      ctx.fillStyle = `hsla(${s.hue}, 95%, 68%, ${Math.min(1, s.life) * 0.7})`;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
    }
  }

  _flash(ctx, w, h) {
    const k = Beat.beat * 0.07 + Beat.energy * 0.02;
    if (k < 0.005) return;
    ctx.fillStyle = `hsla(${this.hue}, 90%, 60%, ${k})`;
    ctx.fillRect(0, 0, w, h);
  }
}
