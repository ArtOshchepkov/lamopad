// ─── Панель SISYPHUS: лама катит яблоко на готическую гору ──────────────────
//
// МЕХАНИКА. Два способа лезть, они складываются:
//   ХОЛД  - держишь клавишу (любую из PUSH_KEYS - клавиатура на доске общая,
//           так что те же стрелки одновременно двигают и соседние панели)
//           или палец на панели: ровный ход, CLIMB_SEC секунд до вершины.
//   ТАПАЛКА - быстро жмёшь/тапаешь: каждое нажатие даёт рывок (drive), он
//           гаснет за доли секунды, но частые нажатия накапливаются в скорость.
//           6-8 тапов в секунду - вершина в 2-3 раза быстрее холда. Автоповтор
//           клавиши тапом не считается: зажатая клавиша - это холд.
// Отпустил и не тапаешь - медленно сползает. Докатил до вершины - удар молнии,
// миг на вершине и скат с разгоном. Страница ушла из виду - скат сразу:
// держать стало некому.
//
// СОСТОЯНИЯ: push → crest → roll → push. Вся позиция - одно число p (0..1)
// вдоль кривой at(t); лама тянется за яблоком с отставанием, поэтому на
// скате видно, как она остаётся наверху одна.
//
// ВИД. Мир нарочно мёртвый: чёрное небо, дохлая луна, голые деревья на
// склоне, руины собора на вершине, вороньё над ними, туман и ливень - тоска.
// Гроза настоящая: зигзаг молнии, стробящая вспышка, гром трясёт кадр. Из
// тёплого только яблоко, огоньки в окнах и лама. Палитра G своя, не общая
// PAL: у остальных панелей небо остаётся синим.
//
// РУЧКИ: CLIMB_SEC - длина мучения, TAP_* - насколько щедра тапалка, SLIP -
// сползание без толчка, ROLL_* - характер ската, at() - профиль горы (пологий
// низ, крутая середина, плато на вершине и обрыв за ней).
import { Panel } from './panel.js';
import { mix, px, rnd, sprite } from './pal.js';

const CLIMB_SEC = 60;       // столько держать, чтобы дойти до верха
const SLIP = 0.055;         // сползание, пока просто не толкают
const ROLL_V0 = 0.22;       // с чего начинается скат
const ROLL_ACC = 2.1;       // и как он разгоняется
const CREST_HOLD = 0.7;     // миг триумфа на вершине

// Тапалка. Один тап - TAP_KICK/TAP_DECAY ≈ 0.7% пути (около 0.4 с холда),
// 6 тапов в секунду держат скорость ≈ 0.04/с (25 с до вершины), потолок
// MAX_DRIVE - около 13 с для сверхчеловека
const TAP_KICK = 0.03;      // прибавка скорости (доля пути в секунду) за тап
const TAP_DECAY = 4.5;      // как быстро рывок гаснет, 1/с
const MAX_DRIVE = 0.075;
const COAST_MIN = 0.004;    // ниже этой скорости рывка яблоко уже сползает

// Те же клавиши, что двигают толпу на соседней панели: доска слушает всё
// сразу, и одно нажатие должно доставаться обоим
const PUSH_KEYS = new Set([
  'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Space', 'KeyD', 'KeyW', 'KeyA',
]);

const G = {
  skyTop:  '#060509',
  skyMid:  '#100c17',
  skyLow:  '#211926',
  haze:    '#37313d',
  moon:    '#a9abb8',
  moonPit: '#7d7f90',
  cloud:   '#17111e',
  cloudHi: '#231b2a',
  farA:    '#150f1c',
  farB:    '#0c0812',
  ruin:    '#050408',
  rock:    '#19151f',
  rockDeep:'#0f0c14',
  strata:  '#0b090f',
  rim:     '#4b465e',
  fog:     '#9a94ac',
  rain:    'rgba(150,160,190,0.3)',
  bolt:    '#f4f4ff',
  boltGlow:'rgba(170,180,255,0.3)',
  cloudLit:'#7a7ea8',
  cloudHiLit:'#b0b4d8',
  rimLit:  '#b8bce0',
  candle:  ['#3a3320', '#a58f3c'],       // окно тусклое ... окно горит
  red:     '#c42a1c',
  redDark: '#7a140c',
  redHi:   '#e05a48',
  stem:    '#0c0a10',
  leaf:    '#5d6b2c',
  llama:   '#cfc6bd',                    // лунный свет вместо солнца
  llamaDark: '#8f8896',
};

// Руины на вершине. w - окно, оно мерцает как свеча
const RUIN = [
  '.....#........',
  '.....#........',
  '....###...#...',
  '....###..###..',
  '....###..###..',
  '...#####.#w#..',
  '...##w##.###..',
  '...##w##.###..',
  '#..#####.###..',
  '##.#####.#####',
  '##.##w#####w##',
  '####w#########',
  '##############',
  '##############',
  '##############',
  '##############',
];
const TREE = [
  '#.#...#.#',
  '.##.#.##.',
  '..##.##..',
  '...###...',
  '....#....',
  '....#....',
  '....#....',
  '....#....',
  '...###...',
];
// Голые деревья на склоне: k - где по пути стоят, sc - во сколько раз крупнее
const PROPS = [
  { k: 0.15, sc: 1 }, { k: 0.36, sc: 1.5 }, { k: 0.58, sc: 1 }, { k: 0.78, sc: 1.5 },
];

/** Заливка столбиками по высотам yAt(i): пиксельный край без сглаживания. */
function columns(ctx, n, step, yAt, bottom, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const y = Math.round(yAt(i));
    ctx.fillRect(i * step, y, step, bottom - y);
  }
}

/** Зубчатый хребет: то острые пики, то редкие шпили в две колонки. */
function ridge(n, base, amp, r) {
  const ys = new Float32Array(n);
  let i = 0;
  let y0 = base - amp * r();
  while (i < n) {
    const spire = r() < 0.14;
    const len = spire ? 2 : 3 + Math.floor(r() * 7);
    const y1 = base - amp * (spire ? 1.5 + r() * 0.4 : 0.1 + r() * r());
    for (let j = 0; j < len && i < n; j++, i++) ys[i] = y0 + (y1 - y0) * ((j + 1) / len);
    y0 = y1;
  }
  return ys;
}

function disc(ctx, cx, cy, R, step, color) {
  for (let dy = -R; dy < R; dy += step) {
    const half = Math.sqrt(Math.max(0, R * R - dy * dy));
    px(ctx, cx - half, cy + dy, half * 2, step, color);
  }
}

const cellNoise = (ix, iy) => {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/**
 * Телевизионная цензура: экранная сетка крупных клеток. sample(x, y, noise)
 * даёт цвет клетки или null, если она мимо закрываемого. Сетка не едет вместе
 * с объектом, поэтому при движении клетки перекрашиваются, как на телевизоре.
 */
function mosaic(ctx, x0, y0, x1, y1, c, sample) {
  for (let iy = Math.floor(y0 / c); iy * c < y1; iy++) {
    for (let ix = Math.floor(x0 / c); ix * c < x1; ix++) {
      const col = sample((ix + 0.5) * c, (iy + 0.5) * c, cellNoise(ix, iy));
      if (col) px(ctx, ix * c, iy * c, c, c, col);
    }
  }
}

export class Sisyphus extends Panel {
  constructor(host) {
    super(host);
    this.p = 0;               // где яблоко на склоне, 0..1
    this.llamaP = 0;          // лама тянется за яблоком с отставанием
    this.state = 'push';      // push | crest | roll
    this.v = 0;
    this.drive = 0;           // скорость от тапов, доля пути в секунду
    this.speed = 0;           // полная скорость подъёма: для анимации ламы
    this.gait = 0;            // фаза шага, растёт быстрее с скоростью
    this.spin = 0;
    this.crestT = 0;
    this.keyHeld = false;
    this.flashAge = Infinity; // секунд с последнего удара молнии
    this.bolt = [];           // прямоугольники зигзага, собираются при ударе
    this.thunderIn = 0;       // гром идёт медленнее света
    this.shake = 0;           // дрожь кадра от грома, секунды
    this.nextFlash = 2 + Math.random() * 3;
    this.puffs = [];
    const r = rnd(20260921);
    this.clouds = [0, 1, 2, 3, 4, 5, 6].map(() => ({
      x: r(), y: 0.05 + r() * 0.3, s: 0.8 + r() * 1, v: 0.01 + r() * 0.014,
    }));
    // вороньё: у каждого свой круг, своя скорость и свой взмах
    this.ravens = Array.from({ length: 14 }, () => ({
      rx: 6 + r() * 16, ry: 1.5 + r() * 5, ph: r() * 6.28, ph2: r() * 6.28,
      v: (0.25 + r() * 0.4) * (r() < 0.5 ? -1 : 1), flap: 6 + r() * 4, big: r() < 0.3,
    }));
    // туман: сзади ползёт над склоном, спереди застилает подножие
    this.fog = [0, 1, 2, 3].map((i) => ({
      x: r(), y: i < 2 ? 0.55 + r() * 0.2 : 0.86 + r() * 0.08,
      s: 0.6 + r() * 0.8, v: 0.014 + r() * 0.012, front: i >= 2,
    }));
  }

  layout(w, h) {
    this.x0 = w * 0.05; this.y0 = h * 0.88;
    this.x1 = w * 0.86; this.y1 = h * 0.22;
    this.farY = h * 0.66;                 // дальний склон: за вершиной всё вниз
    this.unit = Math.max(2, Math.round(Math.min(w, h) / 44));
    this.step = Math.max(2, Math.round(this.unit / 2));   // размер "пикселя" мира

    // Статика по столбцам: хребет с обломками, две дальние гряды.
    // Обломки только вверх от линии: яблоко катится по линии, не тонет
    const n = Math.ceil(w / this.step) + 1;
    const r = rnd(666);
    this.cols = n;
    this.topY = new Float32Array(n);
    this.ridgeY = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const y = this._ridge(i * this.step + this.step / 2);
      const crag = r() < 0.22 ? Math.round(r() * this.unit * 0.9 / this.step) * this.step : 0;
      this.ridgeY[i] = y;
      this.topY[i] = y - crag;
    }
    this.farA = ridge(n, h * 0.5, h * 0.2, rnd(13));
    this.farB = ridge(n, h * 0.66, h * 0.14, rnd(29));

    // ливень: плотность от площади панели
    const rr = rnd(77);
    const drops = Math.max(60, Math.min(170, Math.round(w * h / 3000)));
    this.rain = Array.from({ length: drops }, () => ({
      x: rr() * w, y: rr() * h, v: h * (1.1 + rr() * 0.7), len: this.unit * (1.2 + rr() * 1.2),
    }));

    // виньетка: края темнее, взгляд падает в середину
    const R = Math.max(w, h) * 0.75;
    this.vig = this.ctx.createRadialGradient(w / 2, h / 2, R * 0.35, w / 2, h / 2, R);
    this.vig.addColorStop(0, 'rgba(0,0,0,0)');
    this.vig.addColorStop(1, 'rgba(0,0,0,0.6)');
  }

  /** Гладкая линия хребта по иксу: подножие, склон, обрыв за вершиной. */
  _ridge(x) {
    if (x <= this.x0) return this.y0;
    if (x >= this.x1) return this.y1 + (this.farY - this.y1) * (x - this.x1) / (this.w - this.x1);
    return this.at((x - this.x0) / (this.x1 - this.x0)).y;
  }

  /** Точка склона: пологое подножие, крутая середина, плато у вершины. */
  at(t) {
    const k = Math.max(0, Math.min(1, t));
    const s = k * k * (3 - 2 * k);
    return { x: this.x0 + (this.x1 - this.x0) * k, y: this.y0 + (this.y1 - this.y0) * s };
  }

  slope(t) {
    const a = this.at(t - 0.02), b = this.at(t + 0.02);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  get pushing() { return this.awake && (this.keyHeld || this.held); }

  /** Лама реально идёт вверх: держат или ещё не погас рывок от тапов. */
  get climbing() {
    return this.state === 'push' && (this.pushing || this.drive > COAST_MIN);
  }

// НЕ ЗВАТЬ preventDefault. Клавиатуру доски слушают все панели и Phaser-сцена
// соседней ячейки, а она игнорирует события с defaultPrevented — погасив
// событие здесь, панель ослепила бы соседей. Мы гости на общей клавиатуре.
  onKeyDown(e) {
    if (!PUSH_KEYS.has(e.code)) return;
    this.keyHeld = true;
    if (!e.repeat) this._tap();       // автоповтор - это холд, а не тапы
  }
  onKeyUp(e) { if (PUSH_KEYS.has(e.code)) this.keyHeld = false; }
  onPointerDown() { this.held = true; this._tap(); }
  onPointerUp() { this.held = false; }

  onAwake(v) {
    this.keyHeld = false;
    this.drive = 0;
    // страница ушла — держаться не за что
    if (!v && this.state === 'push' && this.p > 0) this._roll();
  }

  /** Тапалка: рывок вверх, гаснет сам, копится при частых нажатиях. */
  _tap() {
    if (!this.awake || this.state !== 'push') return;
    this.drive = Math.min(MAX_DRIVE, this.drive + TAP_KICK);
    this._puff(2);
  }

  _crest() {
    this.state = 'crest';
    this.crestT = 0;
    this.drive = 0;
    this._strike(this.x1 - this.unit * 3);   // молния бьёт ровно в руины
  }

  /** Удар: собирает зигзаг сверху вниз до земли в колонке x, с парой ответвлений. */
  _strike(x) {
    const s = this.step, top = -s;
    const col = Math.max(0, Math.min(this.cols - 1, Math.floor(x / s)));
    const ground = this.topY[col];
    const bolt = [];
    const walk = (bx, by, stepsMax, spread, lean) => {
      for (let i = 0; i < stepsMax && by < ground; i++) {
        const h = s * (2 + Math.floor(Math.random() * 3));
        const nx = bx + Math.round((Math.random() - 0.5 + lean) * spread) * s;
        bolt.push({ x: bx, y: by, w: s, h });
        if (nx !== bx) bolt.push({ x: Math.min(bx, nx), y: by + h, w: Math.abs(nx - bx) + s, h: s });
        bx = nx; by += h;
      }
      return [bx, by];
    };
    let bx = Math.round(x / s) * s, by = top, branches = 0;
    while (by < ground) {
      [bx, by] = walk(bx, by, 4, 4, 0);
      if (branches < 3 && Math.random() < 0.6) {          // ответвление в сторону
        branches++;
        walk(bx, by, 3 + Math.floor(Math.random() * 3), 3, Math.random() < 0.5 ? -0.8 : 0.8);
      }
    }
    this.bolt = bolt;
    this.flashAge = 0;
    this.thunderIn = 0.12 + Math.random() * 0.25;
  }

  /** Яркость вспышки: строб - вспыхнуло, погасло, вспыхнуло, затухает. */
  _flashLevel() {
    const t = this.flashAge;
    if (t < 0.06) return 1;
    if (t < 0.13) return 0.2;
    if (t < 0.22) return 0.9;
    if (t < 0.29) return 0.3;
    return 0.25 * Math.exp(-(t - 0.29) * 4);
  }

  _roll() {
    this.state = 'roll';
    this.v = ROLL_V0;
    this.drive = 0;
  }

  update(dt) {
    // рывок гаснет по экспоненте; пройденный им путь берём интегралом,
    // чтобы результат не зависел от частоты кадров
    const decay = Math.exp(-TAP_DECAY * dt);
    const coasted = this.drive * (1 - decay) / TAP_DECAY;
    this.drive *= decay;

    if (this.state === 'push') {
      this.p += (this.pushing ? dt / CLIMB_SEC : 0) + coasted;
      if (this.p >= 1) { this.p = 1; this._crest(); }
      else if (!this.climbing) this.p = Math.max(0, this.p - SLIP * dt);
    } else if (this.state === 'crest') {
      this.crestT += dt;
      if (this.crestT > CREST_HOLD) this._roll();
    } else {
      this.v += ROLL_ACC * dt;
      this.p -= this.v * dt;
      this.spin += this.v * dt * 14;
      if (this.p <= 0) { this.p = 0; this.v = 0; this.state = 'push'; this._puff(6); }
    }

    this.speed = this.climbing ? (this.pushing ? 1 / CLIMB_SEC : 0) + this.drive : 0;
    const rate = this.state === 'roll' ? 22 : this.climbing ? 8 + Math.min(this.speed, 0.08) * 170 : 0;
    this.gait += rate * dt;

    // лама идёт следом, но не телепортируется: на скате её видно отдельно
    const target = Math.max(0, this.p - 0.055);
    this.llamaP += (target - this.llamaP) * Math.min(1, dt * 3.2);

    if (this.climbing && Math.random() < dt * (3 + this.speed * 150)) this._puff(1);
    for (const f of this.puffs) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; }
    this.puffs = this.puffs.filter((f) => f.life > 0);

    for (const c of this.clouds) { c.x -= c.v * dt; if (c.x < -0.5) c.x = 1.2; }
    for (const f of this.fog) { f.x -= f.v * dt; if (f.x < -0.75) f.x = 1.1; }

    // гроза: удары то редкие, то очередью
    this.flashAge += dt;
    this.nextFlash -= dt;
    if (this.nextFlash < 0) {
      this._strike((0.08 + Math.random() * 0.84) * this.w);
      this.nextFlash = Math.random() < 0.35 ? 0.4 + Math.random() * 0.6 : 2.5 + Math.random() * 5.5;
    }
    if (this.thunderIn > 0 && (this.thunderIn -= dt) <= 0) this.shake = 0.6;
    this.shake = Math.max(0, this.shake - dt);

    for (const d of this.rain) {
      d.y += d.v * dt;
      d.x -= d.v * 0.25 * dt;
      if (d.y > this.h) { d.y = -d.len; d.x = Math.random() * (this.w + this.h * 0.3); }
      if (d.x < 0) d.x += this.w;
    }
  }

  _puff(n) {
    const a = this.at(this.p);
    for (let i = 0; i < n; i++) {
      this.puffs.push({
        x: a.x, y: a.y, life: 0.4 + Math.random() * 0.4,
        vx: -20 - Math.random() * 50, vy: -10 - Math.random() * 40,
      });
    }
  }

  draw(ctx, w, h) {
    const u = this.unit, s = this.step, n = this.cols;
    const lit = this._flashLevel();

    // гром трясёт кадр; небо шире кадра, чтобы дрожь не открывала щель
    ctx.save();
    if (this.shake > 0) {
      const a = u * 0.5 * (this.shake / 0.6);
      ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    }

    // небо полосами, у горизонта - грязная дымка
    px(ctx, -u, -u, w + u * 2, h * 0.45 + u, G.skyTop);
    px(ctx, -u, h * 0.45, w + u * 2, h * 0.3, G.skyMid);
    px(ctx, -u, h * 0.75, w + u * 2, h * 0.25 + u, G.skyLow);
    px(ctx, -u, h * 0.62, w + u * 2, h * 0.06, G.haze);

    // молния заливает небо, а горы и руины остаются чёрными силуэтами
    if (lit > 0.01) {
      px(ctx, -u, -u, w + u * 2, h + u * 2, `rgba(200,205,255,${(0.6 * lit).toFixed(3)})`);
    }

    // мёртвая луна в дымке
    const mx = w * 0.5, my = h * 0.13, mr = u * 3;
    disc(ctx, mx, my, mr * 2.4, s, 'rgba(150,150,190,0.04)');
    disc(ctx, mx, my, mr * 1.7, s, 'rgba(150,150,190,0.06)');
    disc(ctx, mx, my, mr * 1.3, s, 'rgba(150,150,190,0.08)');
    disc(ctx, mx, my, mr, s, G.moon);
    px(ctx, mx - mr * 0.5, my - mr * 0.3, s * 2, s * 2, G.moonPit);
    px(ctx, mx + mr * 0.2, my + mr * 0.3, s * 3, s * 2, G.moonPit);
    px(ctx, mx + mr * 0.1, my - mr * 0.6, s * 2, s, G.moonPit);

    // рваные тучи ползут поверх луны; вспышка подсвечивает их изнутри
    const cloud = lit > 0.01 ? mix(G.cloud, G.cloudLit, lit * 0.7) : G.cloud;
    const cloudHi = lit > 0.01 ? mix(G.cloudHi, G.cloudHiLit, lit) : G.cloudHi;
    for (const c of this.clouds) {
      const cx = c.x * w, cy = c.y * h, cw = u * 12 * c.s;
      px(ctx, cx, cy, cw, u * 1.8, cloud);
      px(ctx, cx + cw * 0.15, cy - u * 1.2, cw * 0.55, u * 1.4, cloud);
      px(ctx, cx + cw * 0.3, cy - u * 1.2, cw * 0.2, s, cloudHi);
      px(ctx, cx + cw * 0.05, cy + u * 1.8, cw * 0.5, s, cloud);
    }

    // дальние гряды с зубцами-шпилями
    columns(ctx, n, s, (i) => this.farA[i], h, G.farA);
    columns(ctx, n, s, (i) => this.farB[i], h, G.farB);

    // зигзаг молнии виден только в яркие фазы строба: за руинами и склоном
    if (lit >= 0.9) {
      for (const b of this.bolt) px(ctx, b.x - s, b.y, b.w + s * 2, b.h, G.boltGlow);
      for (const b of this.bolt) px(ctx, b.x, b.y, b.w, b.h, G.bolt);
    }

    // руины на плато вершины: свечи в окнах живые, у каждого свой ритм
    const rw = RUIN[0].length * s;
    const rx = Math.min(this.x1 - u * 3 - rw * 0.5, w - rw);
    const ry = this.y1 + u - RUIN.length * s;
    const cand = mix(G.candle[0], G.candle[1], 0.5 + 0.5 * Math.sin(this.time * 5.3));
    sprite(ctx, RUIN, rx, ry, s, { '#': G.ruin, w: cand });
    this._ravens(ctx, rx + rw * 0.5, ry, u, s);

    // склон: столбики с обломками, кромка в лунном свете, слоистая порода
    columns(ctx, n, s, (i) => this.topY[i], h, G.rock);
    const rim = Math.max(1, Math.round(u * 0.3));
    ctx.fillStyle = lit > 0.01 ? mix(G.rim, G.rimLit, lit * 0.8) : G.rim;
    for (let i = 0; i < n; i++) ctx.fillRect(i * s, Math.round(this.topY[i]), s, rim);
    ctx.fillStyle = G.strata;
    const thick = Math.max(1, Math.round(u * 0.25));
    for (let j = 1; j <= 6; j++) {
      const off = Math.round(u * 2.4 * j);
      for (let i = 0; i < n; i++) {
        if ((i * 7 + j * 13) % 9 < 6) ctx.fillRect(i * s, Math.round(this.ridgeY[i]) + off, s, thick);
      }
    }
    px(ctx, 0, h * 0.92, w, h * 0.08, G.rockDeep);

    // голые деревья на склоне
    const dead = { '#': G.ruin };
    for (const pr of PROPS) {
      const a = this.at(pr.k);
      const ts = Math.round(s * pr.sc);
      sprite(ctx, TREE, a.x - TREE[0].length * ts * 0.5, a.y + ts - TREE.length * ts, ts, dead);
    }

    this._fog(ctx, w, h, false);

    for (const f of this.puffs) {
      px(ctx, f.x, f.y, u, u, mix(G.rim, G.skyLow, 1 - f.life));
    }

    const lp = this.at(this.llamaP);
    this._llama(ctx, lp.x, lp.y, u, this.slope(this.llamaP));

    const ap = this.at(this.p);
    this._apple(ctx, ap.x, ap.y, u);

    this._fog(ctx, w, h, true);

    // ливень, гонимый ветром
    ctx.strokeStyle = G.rain;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of this.rain) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.25, d.y + d.len); }
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = this.vig;
    ctx.fillRect(0, 0, w, h);
  }

  /** Туман: бледные полосы почти без плотности, сзади и спереди актёров. */
  _fog(ctx, w, h, front) {
    const u = this.unit;
    ctx.globalAlpha = front ? 0.06 : 0.09;
    for (const f of this.fog) {
      if (f.front !== front) continue;
      const cw = w * 0.5 * f.s, x = f.x * w, y = f.y * h;
      px(ctx, x, y, cw, u * 1.4, G.fog);
      px(ctx, x + cw * 0.2, y - u * 0.9, cw * 0.6, u, G.fog);
    }
    ctx.globalAlpha = 1;
  }

  /** Вороньё кружит над руинами широкими кругами: чёрная галочка, крылья через такт. */
  _ravens(ctx, cx, cy, u, s) {
    for (const r of this.ravens) {
      const a = this.time * r.v + r.ph;
      const x = cx + Math.cos(a) * u * r.rx;
      const y = Math.max(u, cy + u + Math.sin(a * 1.3 + r.ph2) * u * r.ry);
      const q = r.big ? Math.round(s * 1.5) : s;
      const up = Math.sin(this.time * r.flap + r.ph2) > 0 ? -q : q;
      px(ctx, x - q * 2, y + up, q, q, G.ruin);
      px(ctx, x - q, y, q, q, G.ruin);
      px(ctx, x, y + q * 0.5, q, q, G.ruin);
      px(ctx, x + q, y, q, q, G.ruin);
      px(ctx, x + q * 2, y + up, q, q, G.ruin);
    }
  }

  /** Яблоко под цензурой: мозаика клеток, блик и тень катятся вместе с ним; черенок и лист торчат. */
  _apple(ctx, x, y, u) {
    const R = u * 2.4, cx = x, cy = y - R, c = Math.max(2, Math.round(u * 0.9));
    const ang = this.state === 'roll' ? -this.spin : this.p * 6;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    mosaic(ctx, cx - R * 1.2, cy - R * 1.2, cx + R * 1.2, cy + R * 1.2, c, (sx, sy, n) => {
      const dx = sx - cx, dy = sy - cy;
      if (dx * dx + dy * dy > R * R * 1.17) return null;
      const lx = ca * dx + sa * dy, ly = -sa * dx + ca * dy;
      const t = (-lx * 0.6 - ly * 0.8) / R + (n - 0.5) * 0.5;   // 1 - к блику, -1 - к тени
      return t > 0.75 ? G.redHi : t > 0.05 ? G.red : G.redDark;
    });
    px(ctx, x - u * 0.25, y - R * 2.1, u * 0.5, u * 0.9, G.stem);   // черенок
    px(ctx, x + u * 0.2, y - R * 2.3, u * 1.2, u * 0.6, G.leaf);    // увядший лист
  }

  /** Лама: горб, длинная шея, четыре ноги. На ходу ноги переступают. */
  _llama(ctx, x, y, u, ang) {
    const walk = this.climbing || this.state === 'roll';
    const step = walk ? Math.sin(this.gait) : 0;
    // чем быстрее рывок, тем сильнее лама ложится на подъём
    const lean = this.climbing ? 0.1 + Math.min(this.speed / 0.07, 1) * 0.14 : 0;
    ctx.save();
    ctx.translate(x, y);
    const tilt = ang + lean;
    ctx.rotate(tilt);
    ctx.translate(-u * 5.6, 0);                     // морда — ровно в яблоко
    const L = G.llama, D = G.llamaDark;
    // ноги
    px(ctx, -u * 3.2, -u * 2.6, u, u * 2.6 + step * u * 0.6, D);
    px(ctx, -u * 1.6, -u * 2.6, u, u * 2.6 - step * u * 0.6, L);
    px(ctx, u * 0.4, -u * 2.6, u, u * 2.6 - step * u * 0.6, D);
    px(ctx, u * 1.8, -u * 2.6, u, u * 2.6 + step * u * 0.6, L);
    // корпус
    px(ctx, -u * 3.6, -u * 5.2, u * 6.8, u * 2.8, L);
    px(ctx, -u * 3.6, -u * 5.2, u * 6.8, u * 0.8, D);
    px(ctx, -u * 4.2, -u * 4.4, u * 0.8, u * 1.6, L);           // хвост
    // шея и голова
    px(ctx, u * 1.8, -u * 8.4, u * 1.5, u * 3.4, L);
    px(ctx, u * 1.8, -u * 9.6, u * 3.0, u * 1.5, L);
    ctx.restore();
    this._censorHead(ctx, x, y, u, tilt);
  }

  /** Морда ламы закрыта мозаикой: глаз и профиль под ней уже не разобрать. */
  _censorHead(ctx, x, y, u, tilt) {
    const c = Math.max(2, Math.round(u * 0.9));
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    // клетки экранные, а голова повёрнута: проверяем клетку в системе ламы
    mosaic(ctx, x - u * 6, y - u * 15, x + u * 4, y - u * 3, c, (sx, sy, n) => {
      const dx = sx - x, dy = sy - y;
      const lx = ct * dx + st * dy + u * 5.6, ly = -st * dx + ct * dy;
      if (lx < u * 1.6 || lx > u * 5.1 || ly < -u * 11.6 || ly > -u * 8) return null;
      const t = (lx - u * 1.6) / (u * 3.5) + (n - 0.5) * 0.9;   // к морде темнеет
      return t > 0.8 ? G.llamaDark : t > 0.25 ? G.llama : mix(G.llama, G.llamaDark, 0.3);
    });
  }
}
