// ─── Панель TYPEWRITER: машинка, которая печатает одно и то же ───────────────
//
// МЕХАНИКА. Печатать можно с клавиатуры (доска раздаёт нажатия всем панелям
// сразу) или мышью по клавишам на корпусе и по пробелу. Любой печатный
// символ кладёт на бумагу ровный чёрный блок, пробел остаётся пробелом,
// Enter переводит строку, Backspace стирает. Под блоком ничего нет: это не
// спойлер, там просто нечему быть.
//
// УВЕДОМЛЕНИЯ. После десятой буквы каждая следующая может вызвать штраф:
// тёплый казённый бланк с красной шапкой и печатью. Слова в нём зацензурены
// так же, как всё вокруг, но пунктуация (! и .) и цифры видны: сумма растёт с
// каждым писком. Он приходит редко (2% на букву после десятой), зато с тревожным
// звуком, пищит, трясётся и лежит поверх бумаги, пока его не закроют
// крестиком (или Esc). Клик по телу только злит его. Правила, таймеры и сумма
// живут в notes.js, здесь — вид.
//
// ФОН. Холодный бетон под мигающей трубкой, на нём фреска: лотос вокруг
// всевидящего глаза. Фреска облупилась, а сам глаз живой: следит за кареткой
// и моргает. На бетонной полке слева стоит смартфон с бесконечной лентой: она
// ползёт и рывками летит вниз, а в ней тоже всё зацензурировано. Окурки на полу
// закрыты мозаикой. У правого края висят часы, которые сошли с ума: стрелки
// бешено крутятся без остановки. Кроме глаза, ленты, часов и рычагов вживую
// ничего не движется.
//
// МОДЕЛЬ. lines — массив строк из BLOCK и пробелов, больше ничего не
// хранится. Строка кончилась (cols) — звоночек и перевод каретки; строк
// стало больше видимых (rowsVisible) — верхняя уезжает с листа навсегда.
//
// РИСОВАНИЕ. Неподвижное (стол, бумага, корпус, клавиши) собирается один раз
// на слои при смене размера и потом лишь копируется в кадр. Живое — буквы,
// рычаг, нажатая клавиша, глаз, звонок, уведомления — рисуется поверх.
// Порядок слоёв: пол+бумага → буквы → корпус → живое → свет → уведомления.
//
// РУЧКИ: GLYPHS — что написано на клавишах, ROWS — раскладка корпуса,
// glyph.w/h в layout() — размер блока, от него же считаются cols и rows.
import { Panel } from './panel.js';
import { Notes, DYING, fine } from './notes.js';
import { Sfx } from '../sfx.js';
import { PAL, mix, px, rnd, disc, ring, pline, sprite } from './pal.js';

const GLYPHS = '▼▪◇▲◆█○●□■◄►▫';
const ROWS = [10, 10, 9];                 // сколько клавиш в ряду
const BLOCK = '#';                        // так выглядит символ в модели строки
const BARS = 17;                          // литерных рычагов в корзине
const REST = 0.5;                         // насколько рычаг выдвинут в покое
const ENTER = 0.3;                        // сколько уведомление вылетает на лист
const FONT = '"Courier New", ui-monospace, monospace';

const BLINK = 0.18;                       // сколько длится моргание глаза
const CONCRETE = '#66696b';
const PAPER = '#ebe7d8';                  // лист серее, чем был: казённая бумага
const SLIP = '#f3deb0';                   // бланк штрафа тёплый
const OUT = '#1c1f28';                    // обводка корпуса
const DECK = '#2a2f3c';                   // утопленная панель под клавишами
const GOLD = '#d6b13a';
const GOLD_DIM = '#b8912a';
const CREAM = '#f1ebd8';

const BELL = [
  '...y...',
  '..xxx..',
  '.xxxxx.',
  '.xxxxx.',
  '.xxxxx.',
  'xxxxxxx',
  '...z...',
];

const easeOutBack = (t) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export class Typewriter extends Panel {
  constructor(host) {
    super(host);
    this.lines = [''];
    this.top = 0;                         // сколько строк уже уехало с листа
    this.leaving = null;                  // строка, уезжающая вверх
    this.feed = 0;                        // остаток сдвига листа при подаче
    this.pressed = null;                  // {i, t} — какая клавиша утоплена
    this.strike = 0;                      // отдача литерного рычага
    this.barIdx = 0;                      // какой рычаг сейчас бьёт
    this.bell = 0;                        // конец строки
    this.lever = 0;                       // рычаг возврата каретки
    this.caretT = 0;
    this.gaze = { x: 0, y: 0 };           // куда смещён зрачок глаза
    this.blink = 0;
    this.blinkNext = 2;
    this.flicker = 0;                     // трубка под потолком моргает
    this.flickerNext = 3;
    this.timeline = { y: 0, posts: [], next: 0, idx: 0 };   // лента на смартфоне
    this.spin = 0;                        // угол минутной стрелки, рад: часы крутятся без остановки
    this.notes = new Notes({
      on: {
        spawn: () => Sfx.notify(true),
        ping: () => Sfx.notify(false),
        dismiss: () => Sfx.dismiss(),
      },
    });
    const r = rnd(20260923);
    this.faces = [];
    for (const n of ROWS) {
      for (let i = 0; i < n; i++) this.faces.push(GLYPHS[Math.floor(r() * GLYPHS.length)]);
    }
    this.plate = Array.from({ length: 4 }, () => GLYPHS[Math.floor(r() * GLYPHS.length)]).join('');
  }

  // ── геометрия ── (вызывается из конструктора Panel: полей подкласса ещё нет)
  layout(w, h) {
    this.unit = Math.max(2, Math.round(Math.min(w, h) / 46));
    const u = this.unit;
    this.body = { x: w * 0.06, y: h * 0.46, w: w * 0.88, h: h * 0.5 };
    const b = this.body;
    this.platen = { x0: b.x + b.w * 0.08, x1: b.x + b.w * 0.92, y: b.y - u * 1.2, h: u * 2.6 };
    this.case = {
      top: b.y + u * 1.4, bot: b.y + b.h * 0.9,
      tl: b.x + b.w * 0.14, tr: b.x + b.w * 0.86,
      bl: b.x + b.w * 0.06, br: b.x + b.w * 0.94,
    };
    const pTop = h * 0.04;
    this.paper = { x: w * 0.2, y: pTop, w: w * 0.6, h: this.platen.y + u - pTop };
    this.glyph = { w: u * 1.9, h: u * 2.4, gap: u * 0.5 };
    const g = this.glyph;
    this.stepX = g.w + g.gap * 0.4;
    this.stepY = g.h + g.gap;
    this.textX = this.paper.x + u * 1.6;
    this.textY = this.paper.y + u * 1.6;
    this.cols = Math.max(6, Math.floor((this.paper.w - u * 3) / this.stepX));
    // последняя строка не должна лезть под прижимную планку над валиком
    const room = this.platen.y - u * 1.8 - this.textY;
    this.rowsVisible = Math.max(3, Math.floor((room + g.gap) / this.stepY));
    this._layoutKeys();
    this.layers = null;                   // перерисуем неподвижное при первом кадре
  }

  _edgeL(y) { const c = this.case; return c.tl + (c.bl - c.tl) * (y - c.top) / (c.bot - c.top); }
  _edgeR(y) { const c = this.case; return c.tr + (c.br - c.tr) * (y - c.top) / (c.bot - c.top); }

  _layoutKeys() {
    const b = this.body, u = this.unit;
    const cx = b.x + b.w / 2;
    const pad = u * 1.6;
    const shift = (r) => (r - 1) * b.w * 0.02;      // каждый ряд чуть правее верхнего
    let d = b.h * 0.145;
    // на узкой панели клавиши мельче: раздвигаем ряды, чтобы деку не оставлять пустой
    const rowsTop = b.y + b.h * 0.34, rowsBot = b.y + b.h * 0.815 - u * 0.8;
    const rowGap = () => Math.max(d * 1.08, Math.min(d * 1.9, (rowsBot - rowsTop - d) / 2));
    const rowY = (r) => rowsTop + d / 2 + r * rowGap();
    // шаг делаем по самому узкому ряду: косой корпус не должен резать клавиши
    let pitch = Infinity;
    ROWS.forEach((n, r) => {
      const y = rowY(r);
      const room = this._edgeR(y) - this._edgeL(y) - 2 * (pad + Math.abs(shift(r))) - d;
      pitch = Math.min(pitch, room / (n - 1));
    });
    d = Math.min(d, pitch * 0.9);
    this.keys = [];
    ROWS.forEach((n, r) => {
      for (let i = 0; i < n; i++) {
        const kx = cx + shift(r) + (i - (n - 1) / 2) * pitch;
        const ky = rowY(r);
        this.keys.push({ cx: kx, cy: ky, r: d / 2, x: kx - d / 2, y: ky - d / 2, w: d, h: d });
      }
    });
    this.space = { x: cx - b.w * 0.22, y: b.y + b.h * 0.815, w: b.w * 0.44, h: u * 1.7 };
  }

  _hit(k, x, y) {
    const p = k.w * 0.08;
    return x >= k.x - p && x <= k.x + k.w + p && y >= k.y - p && y <= k.y + k.h + p;
  }

  // ── ввод ──
  // НЕ ЗВАТЬ preventDefault. Клавиатуру доски слушают все панели и Phaser-сцена
  // соседней ячейки, а она игнорирует события с defaultPrevented — погасив
  // событие здесь, панель ослепила бы соседей. Мы гости на общей клавиатуре.
  onKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Escape') { this.notes.dismissNewest(); return; }
    if (e.code === 'Backspace') { this._erase(); return; }
    if (e.code === 'Enter') { this._newline(); return; }
    if (e.code === 'Space') { this.pressed = { i: -1, t: 0.12 }; this._put(' '); return; }
    if (e.key && e.key.length === 1) {
      // клавиатурный удар тоже топит клавишу на корпусе — какую-нибудь
      this.pressed = { i: Math.floor(Math.random() * this.keys.length), t: 0.12 };
      this._put(BLOCK);
    }
  }

  onPointerDown(x, y) {
    // уведомления лежат поверх листа: верхнее ловит клик первым
    const list = this.notes.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      if (n.dying > 0) continue;
      const g = this._noteGeom(n, i);
      if (this._hit(g.close, x, y)) { this.notes.dismiss(n.id); return; }
      if (this._hit(g, x, y)) { this.notes.touch(n.id); return; }
    }
    if (this._hit(this.space, x, y)) { this.pressed = { i: -1, t: 0.12 }; this._put(' '); return; }
    for (let i = 0; i < this.keys.length; i++) {
      if (this._hit(this.keys[i], x, y)) {
        this.pressed = { i, t: 0.12 };
        this._put(BLOCK);
        return;
      }
    }
  }

  _put(ch) {
    const line = this.lines[this.lines.length - 1];
    if (line.length >= this.cols) { this.bell = 0.3; this._newline(); }
    this.lines[this.lines.length - 1] += ch;
    this.strike = 0.1;
    this.barIdx = Math.floor(Math.random() * BARS);
    if (ch !== ' ') this.notes.letter();
  }

  _newline() {
    this.lines.push('');
    this.lever = 0.28;
    if (this.lines.length > this.rowsVisible) {
      this.leaving = this.lines.shift();
      this.leavingId = this.top++;
      this.feed = this.stepY;
    }
  }

  _erase() {
    const i = this.lines.length - 1;
    if (this.lines[i].length) this.lines[i] = this.lines[i].slice(0, -1);
    else if (i > 0) this.lines.pop();
  }

  update(dt) {
    this.caretT += dt;
    this.strike = Math.max(0, this.strike - dt);
    this.bell = Math.max(0, this.bell - dt);
    this.lever = Math.max(0, this.lever - dt);
    this.feed = Math.max(0, this.feed - dt * this.stepY * 10);
    this.notes.update(dt);
    this.blink = Math.max(0, this.blink - dt);
    this.blinkNext -= dt;
    if (this.blinkNext <= 0) { this.blink = BLINK; this.blinkNext = 2 + Math.random() * 4; }
    this.flicker = Math.max(0, this.flicker - dt);
    this.flickerNext -= dt;
    if (this.flickerNext <= 0) { this.flicker = 0.08 + Math.random() * 0.14; this.flickerNext = 3 + Math.random() * 7; }
    this._look(dt);
    this._scroll(dt);
    this.spin += dt * (18 + 6 * Math.sin(this.time * 3.1));   // ~3 оборота в секунду, скорость плывёт
    if (this.pressed) {
      this.pressed.t -= dt;
      if (this.pressed.t <= 0) this.pressed = null;
    }
  }

  // ── кадр ──
  draw(ctx, w, h) {
    if (!this.layers) this._paintLayers(w, h);
    const L = this.layers, u = this.unit;
    ctx.drawImage(L.desk, 0, 0, w, h);
    this._text(ctx, u);
    ctx.drawImage(L.machine, 0, 0, w, h);
    this._live(ctx, u);
    ctx.drawImage(L.fx, 0, 0, w, h);
    if (this.flicker > 0 && Math.floor(this.time * 30) % 2 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.fillRect(0, 0, w, h);
    }
    const list = this.notes.list;
    for (let i = 0; i < list.length; i++) this._note(ctx, list[i], i);
  }

  /** Слой = канва под размер панели с тем же пиксельным масштабом. */
  _layer(paint) {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.setTransform(c.width / this.w, 0, 0, c.height / this.h, 0, 0);
    g.imageSmoothingEnabled = false;
    paint(g);
    return c;
  }

  _paintLayers(w, h) {
    const u = this.unit;
    this.layers = {
      desk: this._layer((g) => this._paintDesk(g, w, h, u)),
      machine: this._layer((g) => this._paintMachine(g, u)),
      fx: this._layer((g) => this._paintFx(g, w, h, u)),
    };
  }

  // ─── бетонный пол, вещи на нём, фреска и бумага ───────────────────────────
  _paintDesk(ctx, w, h, u) {
    const r = rnd(20260924);
    this._concrete(ctx, w, h, u, r);
    this._mural(ctx, w * 0.9, h * 0.19, Math.min((w * 0.2 - u * 2) / 2, h * 0.19), u, r);

    // полка со смартфоном и мусор слева от листа
    this._ball(ctx, w * 0.07, h * 0.06, u * 1.9, r);
    this._ball(ctx, w * 0.15, h * 0.115, u * 1.4, r);
    this._shelf(ctx, w * 0.045, h * 0.3, u);
    for (const [bx, by] of [[0.17, 0.19], [0.155, 0.265]]) {
      this._butt(ctx, w * bx, h * by, u);
      this._mosaic(ctx, w * bx - u * 1.2, h * by - u * 0.9, u * 4, u * 2.4, u * 1.2);
    }
    this._clock(ctx, w, h, u);
    this._tube(ctx, w, u);

    // тень корпуса на полу
    this._rows((y, t, L, R) => px(ctx, L + u * 0.9, y + u * 1.1, R - L, 1, 'rgba(0,0,0,0.42)'));
    this._paper(ctx, u);
  }

  /** Шершавая плита: сырые пятна, швы со сколами, крупа, каверны, трещины, ржавые подтёки. */
  _concrete(ctx, w, h, u, r) {
    px(ctx, 0, 0, w, h, CONCRETE);
    for (let i = 0; i < 30; i++) {
      disc(ctx, r() * w, r() * h, u * (3 + r() * 9), r() < 0.55 ? 'rgba(20,24,26,0.09)' : 'rgba(200,210,210,0.05)');
    }
    for (let i = 0; i < 5; i++) disc(ctx, r() * w, r() * h, u * (4 + r() * 7), 'rgba(24,34,38,0.13)');
    for (const f of [0.17, 0.83]) {                                // швы между плитами
      let x = w * f;
      for (let y = 0; y < h; y++) {
        if (r() < 0.06) x += r() < 0.5 ? -1 : 1;
        px(ctx, x, y, 2, 1, '#2b2e30');
        px(ctx, x + 2, y, 1, 1, 'rgba(210,216,216,0.16)');
        if (r() < 0.05) px(ctx, x - r() * u * 0.8, y, u * (0.4 + r() * 0.8), 1 + r() * 2, '#33373a');   // скол
      }
    }
    for (let i = 0, n = (w * h) / 55; i < n; i++) {                // крупа и каверны
      const x = r() * w, y = r() * h, k = r();
      if (k < 0.5) px(ctx, x, y, r() < 0.3 ? 2 : 1, 1, 'rgba(20,24,26,0.35)');
      else if (k < 0.88) px(ctx, x, y, 1, 1, 'rgba(205,210,210,0.22)');
      else { px(ctx, x, y, 2, 2, '#34383a'); px(ctx, x, y + 2, 2, 1, 'rgba(210,216,216,0.2)'); }
    }
    for (let i = 0; i < 7; i++) this._crack(ctx, r() * w, r() * h, 40 + r() * 90, r);
    for (let i = 0; i < 5; i++) {                                  // ржавые подтёки сверху
      const x = r() * w, len = h * (0.08 + r() * 0.22);
      for (let y = 0; y < len; y++) {
        px(ctx, x + Math.sin(y * 0.15 + i) * 1.2, y, 2, 1, `rgba(128,72,36,${0.32 * (1 - y / len)})`);
      }
    }
  }

  /** Трещина: блуждание с редкими ответвлениями. */
  _crack(ctx, x, y, len, r) {
    let a = r() * 6.28;
    for (let i = 0; i < len; i++) {
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a);
      y += Math.sin(a);
      px(ctx, x, y, 1, 1, '#25282a');
      if (len > 30 && r() < 0.02) this._crack(ctx, x, y, len * 0.4, r);
    }
  }

  /** Лепесток лотоса: цепочка кружков, сужающаяся к обоим концам. */
  _petal(ctx, cx, cy, ang, r0, r1, wid, fill, edge) {
    const n = Math.max(6, Math.round(r1 - r0));
    for (const pass of [0, 1]) {
      for (let i = 0; i <= n; i++) {
        const t = i / n, rr = r0 + (r1 - r0) * t;
        const hw = wid * Math.sin(Math.PI * Math.pow(t, 0.75)) + (pass === 0 ? 1 : 0);
        disc(ctx, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, Math.max(1, hw), pass === 0 ? edge : fill);
      }
    }
  }

  /**
   * Фреска на бетоне: лучи, два круга лотоса и пустая глазница в центре.
   * Глаз в глазницу рисует _eye() вживую. Краска облупилась: поверх набросаны
   * зёрна цвета бетона, а из-под века течёт красное.
   */
  _mural(ctx, cx, cy, R, u, r) {
    const maroon = '#7d211a', saffron = '#c9832a', teal = '#3a7a76', dark = '#160a08', edge = '#2a0d08';
    this.eye = { cx, cy, R, a: R * 0.5, b: R * 0.22 };
    const E = this.eye;
    for (let i = 0; i < 24; i++) {                                 // солнечные лучи
      const a = i * Math.PI / 12, len = i % 2 === 0 ? 1.04 : 0.98;
      pline(ctx, cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9,
        cx + Math.cos(a) * R * len, cy + Math.sin(a) * R * len, 1, saffron);
    }
    disc(ctx, cx, cy, R * 0.92, edge);
    for (let i = 0; i < 12; i++) {                                 // внешний круг лепестков
      this._petal(ctx, cx, cy, i * Math.PI / 6, R * 0.66, R * 0.92, R * 0.085, i % 2 ? saffron : maroon, edge);
    }
    disc(ctx, cx, cy, R * 0.68, edge);
    for (let i = 0; i < 12; i++) {                                 // внутренний, мельче и со сдвигом
      this._petal(ctx, cx, cy, (i + 0.5) * Math.PI / 6, R * 0.54, R * 0.7, R * 0.05, i % 2 ? teal : saffron, edge);
    }
    disc(ctx, cx, cy, R * 0.54, dark);                             // глазница
    ring(ctx, cx, cy, R * 0.54, 1, saffron);
    pline(ctx, cx, cy - R * 0.5, cx, cy - R * 0.32, Math.max(2, R * 0.04), '#b3271a');   // тилака
    disc(ctx, cx, cy - R * 0.4, Math.max(1.5, R * 0.05), '#d4381f');
    for (const f of [-0.22, 0.04, 0.27]) {                         // подтёки из-под века
      const x = cx + R * f, k = R * f / E.a;
      const y0 = cy + E.b * Math.pow(Math.max(0, 1 - k * k), 0.75);
      const len = R * (0.25 + r() * 0.4);
      px(ctx, x, y0, 2, len, '#8a1a12');
      disc(ctx, x + 1, y0 + len, 2, '#8a1a12');
    }
    for (let i = 0, n = R * R * 0.28; i < n; i++) {                // облупившаяся краска
      const a = r() * 6.28, d = Math.sqrt(r()) * R * 1.06;
      px(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r() < 0.4 ? 2 : 1, r() < 0.4 ? 2 : 1,
        r() < 0.75 ? 'rgba(102,105,107,0.8)' : 'rgba(20,20,22,0.3)');
    }
    for (let i = 0; i < 6; i++) {                                  // целые проплешины
      const a = r() * 6.28, d = R * (0.7 + r() * 0.4);
      disc(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, u * (0.3 + r() * 0.6), 'rgba(102,105,107,0.85)');
    }
    this._crack(ctx, cx - R * 1.1, cy + (r() - 0.5) * R, 90, r);
  }

  _ball(ctx, cx, cy, r, rand) {
    disc(ctx, cx + r * 0.3, cy + r * 0.4, r, 'rgba(0,0,0,0.38)');
    disc(ctx, cx, cy, r, '#d3cfc2');
    disc(ctx, cx - r * 0.25, cy - r * 0.3, r * 0.55, '#e6e2d4');
    for (let i = 0; i < 4; i++) {
      const a = rand() * 6.28, b = a + 1 + rand();
      pline(ctx, cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8,
        cx + Math.cos(b) * r * 0.5, cy + Math.sin(b) * r * 0.5, 1, 'rgba(80,80,70,0.55)');
    }
  }

  _butt(ctx, x, y, u) {
    px(ctx, x + u * 0.2, y + u * 0.4, u * 1.9, u * 0.4, 'rgba(0,0,0,0.38)');
    px(ctx, x, y, u * 1.9, u * 0.5, '#d8d2c0');
    px(ctx, x + u * 1.3, y, u * 0.6, u * 0.5, '#a9762f');         // фильтр
    px(ctx, x - u * 0.3, y + u * 0.1, u * 0.3, u * 0.3, '#3a3a3c');   // пепел
    px(ctx, x - u * 0.9, y + u * 0.35, u * 0.5, 1, 'rgba(20,20,20,0.3)');
  }

  /**
   * Цензурная мозаика поверх уже нарисованного: усредняет цвет по клеткам.
   * Слой непрозрачный, поэтому усреднять достаточно одни только RGB.
   */
  _mosaic(ctx, x, y, w, h, cell) {
    const d = ctx.getTransform().a;                  // масштаб слоя: css → пиксели канвы
    const X = Math.round(x * d), Y = Math.round(y * d), W = Math.round(w * d), H = Math.round(h * d);
    const c = Math.max(1, Math.round(cell * d));
    const px8 = ctx.getImageData(X, Y, W, H).data;
    for (let cy = 0; cy < H; cy += c) {
      for (let cx = 0; cx < W; cx += c) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let yy = cy; yy < Math.min(H, cy + c); yy++) {
          for (let xx = cx; xx < Math.min(W, cx + c); xx++) {
            const i = (yy * W + xx) * 4;
            r += px8[i]; g += px8[i + 1]; b += px8[i + 2]; n++;
          }
        }
        ctx.fillStyle = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
        ctx.fillRect((X + cx) / d, (Y + cy) / d, Math.min(c, W - cx) / d, Math.min(c, H - cy) / d);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';            // рамка, чтобы цензура читалась как цензура
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
  }

  /** Полка: бетонный выступ, на нём стоит смартфон. Экран живой: его рисует _phone(). */
  _shelf(ctx, x, by, u) {
    const pw = u * 5, ph = u * 8.6, ledgeW = pw + u * 2;
    const phx = x + u, phy = by - ph, b = Math.max(1, Math.round(u * 0.35));
    const S = { x: phx + b, y: phy + Math.round(b * 1.8), w: pw - 2 * b, h: ph - Math.round(b * 3.2) };
    // холодный свет экрана ложится на бетон пиксельными кольцами
    for (const [k, a] of [[0.95, 0.03], [0.72, 0.035], [0.5, 0.04]]) {
      disc(ctx, phx + pw / 2, phy + ph / 2, ph * k, `rgba(120,170,200,${a})`);
    }
    px(ctx, x - 1, by + 1, ledgeW + 2, u * 0.9, 'rgba(0,0,0,0.45)');
    px(ctx, x, by, ledgeW, u * 1.1, '#54585a');
    px(ctx, x, by, ledgeW, Math.max(1, u * 0.3), '#7d8284');
    px(ctx, phx + pw, phy + u, u * 0.5, ph - u, 'rgba(0,0,0,0.35)');   // тень телефона
    px(ctx, phx, phy, pw, ph, '#2b2e35');                                // ободок корпуса
    px(ctx, phx + 1, phy + 1, pw - 2, ph - 2, '#08090b');
    px(ctx, phx + pw / 2 - u * 0.7, phy + Math.max(1, b * 0.5), u * 1.4, 1, '#2f333a');   // динамик
    px(ctx, phx + pw / 2 + u * 1.1, phy + Math.max(1, b * 0.4), 2, 2, '#1b2a38');          // камера
    px(ctx, phx + pw, phy + ph * 0.25, 1, u * 1.3, '#3a3f47');                             // боковая кнопка
    // трещины на стекле: блуждание от правого верхнего угла, рисуются поверх ленты
    const cr = rnd(555), cracks = [];
    let cx = S.x + S.w * 0.9, cy = S.y + S.h * 0.08;
    for (let i = 0; i < 12; i++) {
      const nx = cx - S.w * (0.03 + cr() * 0.09), ny = cy + S.h * (0.03 + cr() * 0.06);
      cracks.push([cx, cy, nx, ny]);
      if (cr() < 0.35) cracks.push([cx, cy, cx + S.w * cr() * 0.1, cy + S.h * (0.02 + cr() * 0.06)]);
      cx = nx;
      cy = ny;
    }
    this.phone = { x: phx, y: phy, w: pw, h: ph, S, cracks, cs: Math.max(1, Math.floor(S.w / 28)) };
  }

  // ─── лента на смартфоне ───────────────────────────────────────────────────
  /** Лента то ползёт, то рывками летит вниз, как у того, кто не может оторваться. */
  _scroll(dt) {
    const P = this.phone, F = this.timeline;
    if (!P) return;
    F.y += dt * (16 + 70 * Math.pow(Math.max(0, Math.sin(this.time * 0.8)), 10));
    const rows = Math.ceil(P.S.h / P.cs) + 2;
    while (F.next < F.y + rows) {                      // досыпаем посты снизу, пока экран не заполнен
      const r = rnd(7000 + F.idx * 31), k = r();
      const type = k < 0.55 ? 'text' : k < 0.85 ? 'image' : 'alert';
      const lines = 2 + Math.floor(r() * 2);
      const h = type === 'alert' ? 16 : type === 'image' ? 30 : 15 + lines * 6;
      F.posts.push({ y: F.next, h, type, lines, seed: 9000 + F.idx * 17 });
      F.next += h;
      F.idx++;
    }
    while (F.posts.length && F.posts[0].y + F.posts[0].h < F.y - 1) F.posts.shift();
  }

  /**
   * Один пост. Единица измерения — клетка cs; всё зацензурено: лица чёрные дыры,
   * слова серые плашки, картинки мозаика в потёмках. Видна только пунктуация.
   */
  _post(ctx, p, sx, sy, cs, Wc) {
    const c = (x, y, w, h, col) => px(ctx, sx + x * cs, sy + y * cs, w * cs, h * cs, col);
    const r = rnd(p.seed);
    const DIM = '#343b44', MID = '#525b66', MARK = '#8d95a0', RED = '#c3342a';
    const line = (x, y, room) => {
      let bx = x;
      for (let wd = 0; wd < 6; wd++) {
        const len = 3 + Math.floor(r() * 5);
        if (bx + len > x + room) break;
        c(bx, y, len, 4, DIM);
        bx += len;
        const k = r();
        if (k < 0.3) { c(bx + 1, y, 1, 2, MARK); c(bx + 1, y + 3, 1, 1, MARK); bx += 3; }   // «!»
        else if (k < 0.55) { c(bx + 1, y + 3, 1, 1, MARK); bx += 3; }                       // «.»
        else bx += 2;
      }
    };
    const head = () => {
      c(1, 2, 5, 5, '#2a3038');
      c(2, 3, 3, 3, '#05070a');                        // вместо лица чёрная дыра
      c(8, 2, 8 + Math.floor(r() * 4), 2, MID);
      c(8, 5, 6, 1, DIM);
    };
    const icons = (y) => { c(1, y, 3, 3, '#7d1f19'); c(7, y, 3, 3, DIM); c(13, y, 3, 3, DIM); };
    c(0, 0, Wc, 1, '#14181d');                         // разделитель между постами
    if (p.type === 'alert') {
      c(0, 1, 1, p.h - 1, '#a3241a');
      c(3, 3, 3, 6, RED);                              // большой «!»
      c(3, 11, 3, 3, RED);
      line(9, 3, Wc - 11);
      line(9, 9, Wc - 11);
    } else if (p.type === 'image') {
      head();
      const tone = ['#0a0c0f', '#12161b', '#1b2128', '#281514', '#0d1a1f'];
      for (let iy = 0; iy < 14; iy += 3) {
        for (let ix = 0; ix < Wc - 2; ix += 3) {
          c(1 + ix, 9 + iy, Math.min(3, Wc - 2 - ix), Math.min(3, 14 - iy), tone[Math.floor(r() * tone.length)]);
        }
      }
      c(1 + Math.floor(r() * Math.max(1, Wc - 14)), 14, 12, 4, '#000');   // сверху ещё чёрная плашка
      c(Wc - 5, 10, 2, 2, '#a3241a');
      icons(24);
    } else {
      head();
      for (let i = 0; i < p.lines; i++) line(1, 9 + i * 6, Wc - 3);
      icons(10 + p.lines * 6);
    }
  }

  /** Экран смартфона: лента под строкой состояния, стекло с бликом и трещинами. */
  _phone(ctx, u) {
    const P = this.phone;
    if (!P) return;
    const S = P.S, cs = P.cs, F = this.timeline;
    const Wc = Math.floor(S.w / cs), Hc = Math.floor(S.h / cs);
    const sc = (x, y, w, h, col) => px(ctx, S.x + x * cs, S.y + y * cs, w * cs, h * cs, col);
    ctx.save();
    ctx.beginPath();
    ctx.rect(S.x, S.y, S.w, S.h);
    ctx.clip();
    px(ctx, S.x, S.y, S.w, S.h, '#090b0e');
    const off = Math.round(F.y * cs);
    for (const p of F.posts) this._post(ctx, p, S.x, S.y + p.y * cs - off, cs, Wc);
    sc(0, 0, Wc, 4, '#090b0e');                        // строка состояния: время, батарея, тревога
    sc(1, 1, 5, 2, '#525b66');
    sc(Wc - 9, 1, 7, 3, '#525b66');
    sc(Wc - 8, 2, 5, 1, '#1a1e24');
    sc(Wc - 8, 2, 1, 1, '#a3241a');                    // почти разряжен
    if (this.notes.list.length > 0 && Math.floor(this.time * 3) % 2 === 0) sc(Wc - 13, 1, 2, 2, '#e0301a');
    sc(0, Hc - 3, Wc, 3, '#090b0e');
    sc(Math.floor(Wc / 2) - 6, Hc - 2, 12, 1, '#39414b');
    for (const [x0, y0, x1, y1] of P.cracks) pline(ctx, x0, y0, x1, y1, 1, 'rgba(200,215,230,0.4)');
    pline(ctx, S.x + S.w * 0.05, S.y + S.h * 0.55, S.x + S.w * 0.75, S.y + S.h * 0.02, Math.max(2, u * 0.5), 'rgba(255,255,255,0.05)');
    ctx.restore();
  }

  /**
   * Часы у правого края, в свободном углу рядом с косым корпусом. Здесь только
   * циферблат: набросок, без цифр. Стрелки рисует _hands() вживую.
   */
  _clock(ctx, w, h, u) {
    const cy = h * 0.72;
    const R = Math.min(u * 4.2, (w - this._edgeR(cy) - u * 2.4) / 2);
    if (R < u * 1.8) return;                        // на узкой панели места нет
    const cx = w - R - u * 0.9;
    disc(ctx, cx + u * 0.5, cy + u * 0.6, R, 'rgba(0,0,0,0.4)');
    disc(ctx, cx, cy, R, '#15181c');                // корпус
    disc(ctx, cx, cy, R * 0.93, '#3a3f46');
    disc(ctx, cx, cy, R * 0.85, '#c9c5b6');         // серый от грязи циферблат
    ring(ctx, cx, cy, R * 0.85, 1, '#8a8678');
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, q = i % 3 === 0;
      pline(ctx, cx + Math.sin(a) * R * (q ? 0.6 : 0.7), cy - Math.cos(a) * R * (q ? 0.6 : 0.7),
        cx + Math.sin(a) * R * 0.78, cy - Math.cos(a) * R * 0.78, q ? Math.max(2, u * 0.35) : 1, '#1c1f24');
    }
    for (let i = 0; i < 40; i++) {                  // грязь и разводы на стекле
      const a = i * 2.4, d = (0.15 + (i * 0.37) % 0.7) * R;
      px(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1, 1, 'rgba(60,54,40,0.35)');
    }
    for (const dx of [-0.25, 0.3]) {                // ржавые подтёки из-под корпуса
      const x = cx + R * dx, len = u * (3 + Math.abs(dx) * 6);
      for (let y = 0; y < len; y++) px(ctx, x, cy + R * 0.95 + y, 2, 1, `rgba(128,72,36,${0.4 * (1 - y / len)})`);
    }
    this.clock = { cx, cy, R };
  }

  /** Стрелки: пока секундная делает шесть оборотов в секунду, хвост из призраков показывает скорость. */
  _hands(ctx, u) {
    const C = this.clock;
    if (!C) return;
    const A = this.spin;
    const hand = (ang, len, t, col, tail = 0) => pline(ctx,
      C.cx - Math.sin(ang) * tail, C.cy + Math.cos(ang) * tail,
      C.cx + Math.sin(ang) * len, C.cy - Math.cos(ang) * len, t, col);
    for (let k = 3; k >= 1; k--) hand(A - k * 0.22, C.R * 0.78, Math.max(1, u * 0.3), `rgba(20,20,22,${0.34 - k * 0.09})`);
    for (let k = 2; k >= 1; k--) hand(A * 2.05 - k * 0.3, C.R * 0.84, 1, `rgba(195,52,42,${0.4 - k * 0.15})`, C.R * 0.2);
    hand(A / 12, C.R * 0.5, Math.max(2, u * 0.5), '#141416');
    hand(A, C.R * 0.78, Math.max(2, u * 0.32), '#141416');
    hand(A * 2.05, C.R * 0.84, 1, '#c3342a', C.R * 0.2);
    disc(ctx, C.cx, C.cy, Math.max(1.5, C.R * 0.09), '#c3342a');
  }

  /** Люминесцентная трубка на потолке: единственный свет в комнате. */
  _tube(ctx, w, u) {
    const x = w * 0.3, tw = w * 0.4;
    px(ctx, x, 0, tw, u * 1.1, '#23262a');
    px(ctx, x, u * 1.1 - 1, tw, 1, '#4a4f55');
    px(ctx, x + u, u * 0.25, tw - u * 2, u * 0.55, '#e6f2ee');
    px(ctx, x + u, u * 0.25, tw - u * 2, 1, '#ffffff');
    px(ctx, x + u * 3.5, u * 0.25, u * 0.4, u * 0.55, '#a9b6b2');           // тёмное пятно на трубке
    px(ctx, x + tw - u * 1.6, u * 0.25, u * 0.6, u * 0.55, '#2a2d30');
    this.tube = { x: w * 0.5, y: u * 0.6 };
  }

  _paper(ctx, u) {
    const p = this.paper, r = rnd(31337), bottom = this.platen.y;
    px(ctx, p.x + u * 0.7, p.y + u * 0.7, p.w, p.h, 'rgba(0,0,0,0.38)');
    px(ctx, p.x, p.y, p.w, p.h, PAPER);
    // круглое пятно от чего-то мокрого и с потёкшей каплей
    const sx = p.x + p.w * 0.83, sy = p.y + p.h * 0.6, R = u * 3.4;
    disc(ctx, sx, sy, R, 'rgba(110,96,74,0.22)');
    disc(ctx, sx, sy, R - u * 0.6, PAPER);
    disc(ctx, sx + R * 1.1, sy + R * 0.5, u * 0.55, 'rgba(110,96,74,0.28)');
    for (let i = 0; i < 120; i++) {
      px(ctx, p.x + r() * p.w, p.y + r() * (bottom - p.y), u * (0.6 + r() * 3), 1,
        r() < 0.6 ? 'rgba(130,120,96,0.16)' : 'rgba(255,255,255,0.5)');
    }
    px(ctx, p.x, p.y, p.w, 1, '#f7f5ea');
    px(ctx, p.x, p.y, Math.max(1, u * 0.5), p.h, 'rgba(120,90,50,0.10)');
    px(ctx, p.x + p.w - u * 0.5, p.y, Math.max(1, u * 0.5), p.h, 'rgba(120,90,50,0.14)');
    const fold = p.y + p.h * 0.5;                                  // след от сложенного листа
    px(ctx, p.x, fold, p.w, 1, 'rgba(120,90,50,0.2)');
    px(ctx, p.x, fold + 1, p.w, 1, 'rgba(255,255,255,0.6)');
    for (let k = 0; k < 6; k++) {                                  // лист огибает валик
      px(ctx, p.x, bottom - u * 0.6 * (6 - k), p.w, u * 0.6, `rgba(90,60,30,${0.03 + k * 0.035})`);
    }
  }

  // ─── буквы на листе ───────────────────────────────────────────────────────
  _text(ctx, u) {
    const p = this.paper, g = this.glyph;
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, this.platen.y - p.y);
    ctx.clip();
    const y0 = this.textY + this.feed;
    if (this.feed > 0 && this.leaving) this._line(ctx, this.leaving, this.leavingId, y0 - this.stepY);
    for (let r = 0; r < this.lines.length; r++) this._line(ctx, this.lines[r], this.top + r, y0 + r * this.stepY);

    // каретка: где будет следующий блок
    const cr = this.lines.length - 1, cc = this.lines[cr].length;
    if (Math.floor(this.caretT * 2) % 2 === 0 || this.strike > 0) {
      px(ctx, this.textX + cc * this.stepX, y0 + cr * this.stepY + g.h - u * 0.5, g.w, u * 0.5, PAL.ink2);
    }
    // свежий блок ещё влажный: чернильный ореол
    if (this.strike > 0 && cc > 0 && this.lines[cr][cc - 1] !== ' ') {
      const hx = this.textX + (cc - 1) * this.stepX, hy = y0 + cr * this.stepY;
      px(ctx, hx - 1, hy - 1, g.w + 2, g.h + 2, 'rgba(10,10,12,0.3)');
    }
    ctx.restore();
  }

  /** Строка блоков. Оттиск чуть гуляет и светится неравномерно, как настоящий. */
  _line(ctx, line, id, y) {
    const g = this.glyph, ink = [PAL.ink0, PAL.ink0, PAL.ink1, PAL.ink2];
    for (let c = 0; c < line.length; c++) {
      if (line[c] === ' ') continue;
      const hsh = (Math.imul(c + 1, 73856093) ^ Math.imul(id + 7, 19349663)) >>> 0;
      const jy = ((hsh >>> 4) % 3 - 1) * 0.5;
      px(ctx, this.textX + c * this.stepX, y + jy, g.w, g.h, ink[hsh % 4]);
    }
  }

  // ─── корпус: строим построчно, чтобы косые края были пиксельными ──────────
  _rows(fn) {
    const c = this.case;
    for (let y = Math.ceil(c.top); y < Math.floor(c.bot); y++) {
      fn(y, (y - c.top) / (c.bot - c.top), this._edgeL(y), this._edgeR(y));
    }
  }

  _paintMachine(ctx, u) {
    const b = this.body, c = this.case, p = this.platen;
    const e = Math.max(1, Math.round(u * 0.3));
    const ins = e + Math.max(2, Math.round(u * 0.7));
    const deckIn = ins + Math.max(2, Math.round(u * 0.7));
    const deckTop = Math.round(b.y + b.h * 0.315), deckBot = Math.round(b.y + b.h * 0.79);
    const cx = b.x + b.w / 2;

    // основание и ножки
    px(ctx, c.bl - u * 0.3, c.bot, c.br - c.bl + u * 0.6, u * 1.1, '#2b303c');
    px(ctx, c.bl - u * 0.3, c.bot, c.br - c.bl + u * 0.6, Math.max(1, u * 0.2), '#59627a');
    px(ctx, c.bl + u * 0.6, c.bot + u * 1.1, u * 2.6, u * 0.8, PAL.ink1);
    px(ctx, c.br - u * 3.2, c.bot + u * 1.1, u * 2.6, u * 0.8, PAL.ink1);

    this._rows((y, t, L, R) => {
      const shade = mix('#9ba5bb', '#465064', Math.floor(t * 8) / 8);
      const edge = y < c.top + e || y >= c.bot - e;
      px(ctx, L, y, R - L, 1, OUT);
      if (edge) return;
      px(ctx, L + e, y, R - L - 2 * e, 1, shade);
      px(ctx, L + e, y, 1, 1, '#c9d1e2');                           // блик по левой кромке
      px(ctx, R - e - 1, y, 1, 1, '#2c3240');
      if (y > c.top + ins && y < c.bot - ins) {
        px(ctx, L + ins, y, 1, 1, GOLD_DIM);                        // золотая полоска
        px(ctx, R - ins - 1, y, 1, 1, GOLD_DIM);
      }
      if (y === Math.round(c.top + ins) || y === Math.round(c.bot - ins - 1)) {
        px(ctx, L + ins, y, R - L - 2 * ins, 1, GOLD_DIM);
      }
      if (y >= deckTop && y < deckBot) px(ctx, L + deckIn, y, R - L - 2 * deckIn, 1, DECK);
      if (y === deckTop) px(ctx, L + deckIn, y, R - L - 2 * deckIn, 1, '#12151c');
      if (y === deckBot - 1) px(ctx, L + deckIn, y, R - L - 2 * deckIn, 1, '#7b869b');
    });

    // шкала под валиком
    const sy = c.top + e, sx0 = c.tl + u * 1.6, sx1 = c.tr - u * 1.6;
    px(ctx, sx0, sy, sx1 - sx0, u * 0.9, '#e8e1cf');
    px(ctx, sx0, sy + u * 0.9, sx1 - sx0, 1, OUT);
    for (let i = 0, x = sx0 + u * 0.4; x < sx1 - u * 0.4; i++, x += u * 0.8) {
      px(ctx, x, sy, 1, i % 5 === 0 ? u * 0.75 : u * 0.4, '#3c4250');
    }

    // окно корзины и рычаги в покое
    const win = { x: cx - b.w * 0.24, y: c.top + u * 1.6, w: b.w * 0.48, h: b.y + b.h * 0.29 - (c.top + u * 1.6) };
    px(ctx, win.x - 1, win.y - 1, win.w + 2, win.h + 2, OUT);
    px(ctx, win.x, win.y, win.w, win.h, '#0f1116');
    px(ctx, win.x, win.y, win.w, Math.max(1, win.h * 0.25), '#171a22');
    px(ctx, win.x - 1, win.y + win.h, win.w + 2, 1, '#7b869b');
    this._bars(ctx, win, u);

    // фирменная плашка (цензура, как всё вокруг) и красный значок
    const pl = { x: b.x + b.w * 0.165, y: c.top + u * 2.0, w: b.w * 0.075, h: u * 2.4 };
    px(ctx, pl.x - 1, pl.y - 1, pl.w + 2, pl.h + 2, '#6b510d');
    px(ctx, pl.x, pl.y, pl.w, pl.h, GOLD);
    px(ctx, pl.x, pl.y, pl.w, 1, '#f3dc7a');
    ctx.font = `${Math.max(6, Math.round(u * 1.3))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3b2a06';
    ctx.fillText(this.plate, pl.x + pl.w / 2, pl.y + pl.h / 2 + 1);
    const bx = b.x + b.w * 0.8, by = c.top + u * 3.2;
    disc(ctx, bx, by, u * 2.1, OUT);
    disc(ctx, bx, by, u * 1.8, GOLD);
    disc(ctx, bx, by, u * 1.4, PAL.red);
    disc(ctx, bx - u * 0.4, by - u * 0.5, u * 0.4, '#f0503a');

    // винты по углам
    const y1 = c.top + ins + u * 1.3, y2 = c.bot - ins - u * 1.3;
    for (const y of [y1, y2]) {
      for (const x of [this._edgeL(y) + ins + u * 1.3, this._edgeR(y) - ins - u * 1.3]) {
        disc(ctx, x, y, u * 0.55, '#c8d0e0');
        px(ctx, x - u * 0.35, y, u * 0.7, 1, '#3c4250');
      }
    }

    this._paintPlaten(ctx, u);

    // клавиши: в покое рисуются сразу в слой, нажатую перерисовываем поверх
    this.keys.forEach((k, i) => this._key(ctx, k, this.faces[i], false));
    this._space(ctx, false);

    // прижимная планка над бумагой
    const rodY = p.y - u * 1.1, rodX = this.paper.x - u * 0.6, rodW = this.paper.w + u * 1.2;
    px(ctx, rodX, rodY, u * 0.5, p.y + u * 0.5 - rodY, '#8b95a9');
    px(ctx, rodX + rodW - u * 0.5, rodY, u * 0.5, p.y + u * 0.5 - rodY, '#8b95a9');
    px(ctx, rodX, rodY, rodW, Math.max(2, u * 0.5), '#aeb7c9');
    px(ctx, rodX, rodY, rodW, 1, '#e8edf6');
    for (const f of [0.22, 0.5, 0.78]) {
      disc(ctx, this.paper.x + this.paper.w * f, rodY + u * 0.25, u * 0.75, PAL.ink1);
      px(ctx, this.paper.x + this.paper.w * f - u * 0.3, rodY - u * 0.2, u * 0.4, 1, '#59627a');
    }
  }

  _paintPlaten(ctx, u) {
    const p = this.platen, c = this.case, wid = p.x1 - p.x0;
    const cap = u * 1.3;
    // резиновый валик с бликами
    px(ctx, p.x0, p.y, wid, p.h, '#171920');
    px(ctx, p.x0, p.y + p.h * 0.16, wid, Math.max(1, u * 0.45), '#3b4050');
    px(ctx, p.x0, p.y + p.h * 0.16, wid, 1, '#59607a');
    px(ctx, p.x0, p.y + p.h * 0.34, wid, Math.max(1, u * 0.25), '#262a35');
    px(ctx, p.x0, p.y + p.h * 0.78, wid, p.h * 0.22, '#0a0b0e');
    // торцевые крышки, оси и рифлёные ручки
    for (const dir of [-1, 1]) {
      const ex = dir < 0 ? p.x0 - cap : p.x1;
      px(ctx, ex, p.y - u * 0.5, cap, p.h + u, '#3c4250');
      px(ctx, ex, p.y - u * 0.5, cap, Math.max(1, u * 0.3), '#8b95a9');
      px(ctx, ex, p.y + p.h + u * 0.5 - Math.max(1, u * 0.3), cap, Math.max(1, u * 0.3), '#232733');
      const shaft = u * 0.9, kw = u * 1.9, kh = u * 4.4;
      const sx = dir < 0 ? ex - shaft : ex + cap;
      const kx = dir < 0 ? sx - kw : sx + shaft;
      const ky = p.y + p.h / 2 - kh / 2;
      px(ctx, sx, p.y + p.h / 2 - u * 0.5, shaft, u, PAL.steel);
      px(ctx, kx, ky + u * 0.3, kw, kh - u * 0.6, PAL.steel);
      px(ctx, kx + u * 0.3, ky, kw - u * 0.6, u * 0.3, PAL.steel);
      px(ctx, kx + u * 0.3, ky + kh - u * 0.3, kw - u * 0.6, u * 0.3, PAL.steelDim);
      for (let x = kx + u * 0.2; x < kx + kw; x += u * 0.42) {
        px(ctx, x, ky + u * 0.3, Math.max(1, u * 0.2), kh - u * 0.6, PAL.steelDim);
      }
      px(ctx, kx, ky + u * 0.3, Math.max(1, u * 0.25), kh - u * 0.6, PAL.steelHi);
    }
    // красно-чёрная лента у места удара
    const gx = this.body.x + this.body.w / 2 - u * 2.1, gy = c.top + u * 0.35;
    px(ctx, gx, gy, u * 4.2, u * 0.4, PAL.red);
    px(ctx, gx, gy + u * 0.4, u * 4.2, u * 0.4, PAL.ink0);
    px(ctx, gx - u * 0.3, gy - 1, u * 4.8, 1, '#8b95a9');
  }

  /** Рычаг: pivot внизу окна, кончик сходится в точку удара. k: 0 — лежит, 1 — бьёт. */
  _bar(ctx, i, k, u, win) {
    const mid = (BARS - 1) / 2, f = (i - mid) / mid;
    const pvx = win.x + win.w / 2 + f * (win.w / 2 - u * 1.2);
    const pvy = win.y + win.h - u * 1.7 + f * f * u * 1.1;      // края дуги ниже середины, но в окне
    const tx = win.x + win.w / 2 + (i - mid) * u * 0.3, ty = win.y + u * 0.4;
    const ex = pvx + (tx - pvx) * k, ey = pvy + (ty - pvy) * k;
    pline(ctx, pvx, pvy, ex, ey, Math.max(1, u * 0.28), '#aeb7c9');
    px(ctx, ex - u * 0.4, ey - u * 0.5, u * 0.8, u * 1.0, CREAM);   // литера на конце
    px(ctx, ex - u * 0.15, ey - u * 0.2, Math.max(1, u * 0.3), Math.max(1, u * 0.4), PAL.ink0);
  }

  _bars(ctx, win, u) {
    this.win = win;
    for (let i = 0; i < BARS; i++) this._bar(ctx, i, REST, u, win);
  }

  // ─── клавиши ──────────────────────────────────────────────────────────────
  _key(ctx, k, face, down) {
    const u = this.unit, r = k.r;
    const dy = down ? u * 0.5 : 0, depth = down ? u * 0.12 : u * 0.6;
    if (down) {                                                // стираем «поднятую» клавишу
      disc(ctx, k.cx, k.cy + u * 0.3, r + 1, DECK);
      disc(ctx, k.cx, k.cy + u * 0.6, r + 1, DECK);
    }
    disc(ctx, k.cx, k.cy + dy + depth, r, '#14161c');
    disc(ctx, k.cx, k.cy + dy, r, '#dfe5f0');
    disc(ctx, k.cx, k.cy + dy, r - u * 0.32, '#8b95a9');
    disc(ctx, k.cx, k.cy + dy, r - u * 0.6, down ? '#e0d8c4' : CREAM);
    px(ctx, k.cx - r * 0.62, k.cy + dy - r * 0.68, 2, 1, '#ffffff');
    ctx.fillStyle = PAL.ink0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(6, Math.round(r * 1.15))}px ${FONT}`;
    ctx.fillText(face, k.cx, k.cy + dy + 1);
  }

  _space(ctx, down) {
    const u = this.unit, s = this.space, dy = down ? u * 0.5 : 0;
    if (down) px(ctx, s.x - 1, s.y - 1, s.w + 2, s.h + u * 1.2, DECK);
    px(ctx, s.x, s.y + dy + (down ? u * 0.12 : u * 0.6), s.w, s.h, '#14161c');
    px(ctx, s.x, s.y + dy, s.w, s.h, '#dfe5f0');
    px(ctx, s.x + u * 0.3, s.y + dy + u * 0.3, s.w - u * 0.6, s.h - u * 0.6, down ? '#e0d8c4' : CREAM);
    px(ctx, s.x + u * 0.3, s.y + dy + s.h - u * 0.6, s.w - u * 0.6, Math.max(1, u * 0.3), '#8b95a9');
    px(ctx, s.x, s.y + dy, s.w, 1, '#ffffff');
  }

  // ─── живое поверх корпуса ─────────────────────────────────────────────────
  _live(ctx, u) {
    const p = this.platen;

    // бьющий рычаг: выезжает из покоя до самой бумаги и возвращается
    if (this.strike > 0 && this.win) {
      const k = REST + (1 - REST) * Math.sin(Math.PI * (1 - this.strike / 0.1));
      this._bar(ctx, this.barIdx, k, u, this.win);
    }

    // нажатая клавиша утопает
    if (this.pressed) {
      if (this.pressed.i === -1) this._space(ctx, true);
      else this._key(ctx, this.keys[this.pressed.i], this.faces[this.pressed.i], true);
    }

    // рычаг возврата каретки: слева, отлетает вправо и возвращается
    const k = this.lever > 0 ? Math.sin(Math.PI * (1 - this.lever / 0.28)) : 0;
    const px0 = p.x0 - u * 0.7, py0 = p.y - u * 0.4;
    const tx = px0 + u * (-2.4 + 8 * k), ty = py0 - u * (3.6 - 1.6 * k);
    pline(ctx, px0, py0, tx, ty, Math.max(2, u * 0.6), '#aeb7c9');
    pline(ctx, px0, py0 + 1, tx, ty + 1, 1, '#59627a');
    disc(ctx, tx, ty, u * 0.95, PAL.ink0);
    px(ctx, tx - u * 0.4, ty - u * 0.5, u * 0.35, u * 0.35, '#59627a');

    // звонок на правом торце: дребезжит и светит кольцами, когда строка кончилась
    const bx = p.x1 - u * 3.2, by = p.y + u * 0.2, br = u * 1.5;
    const sh = this.bell > 0 ? Math.round(Math.sin(this.time * 70) * u * 0.25) : 0;
    px(ctx, bx - u * 0.4, by - u * 0.5, u * 0.8, u * 0.7, PAL.steelDim);
    for (let dy = 0; dy < br; dy++) {
      const half = Math.round(Math.sqrt(br * br - dy * dy));
      px(ctx, bx - half + sh, by - u * 0.5 - dy - 1, half * 2, 1, dy > br * 0.6 ? '#f3dc7a' : GOLD);
    }
    px(ctx, bx - br + sh, by - u * 0.5 - 1, br * 2, 1, '#8a6d14');
    if (this.bell > 0) {
      const a = Math.min(1, this.bell * 4);
      for (const s of [-1, 1]) {
        for (let i = 1; i <= 2; i++) {
          px(ctx, bx + s * (br + i * u * 0.8), by - u * 1.9 + i * u * 0.3, 1, u * (1.6 - i * 0.4), `rgba(243,220,122,${a})`);
        }
      }
    }

    this._eye(ctx);
    this._phone(ctx, u);
    this._hands(ctx, u);
  }

  /** Глаз следит за кареткой: взгляд плавно догоняет место, где ляжет следующий блок. */
  _look(dt) {
    const E = this.eye;
    if (!E) return;
    const cr = this.lines.length - 1;
    const dx = this.textX + this.lines[cr].length * this.stepX - E.cx;
    const dy = this.textY + cr * this.stepY - E.cy;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, dt * 7);
    this.gaze.x += (dx / d * E.a * 0.38 - this.gaze.x) * k;
    this.gaze.y += (dy / d * E.b * 0.45 - this.gaze.y) * k;
  }

  /**
   * Единственное живое на фреске: белок, радужка, зрачок и веки. Рисуем
   * столбиками по одному пикселю, чтобы миндалевидный контур остался пиксельным.
   */
  _eye(ctx) {
    const E = this.eye;
    if (!E) return;
    const open = this.blink > 0 ? 1 - Math.sin(Math.PI * (1 - this.blink / BLINK)) : 1;
    const gx = E.cx + this.gaze.x, gy = E.cy + this.gaze.y;
    const ri = E.b * 0.95, rp = ri * (this.strike > 0 ? 0.55 : 0.42);
    const lid = '#160a08';
    const half = (x) => {
      const k = x / E.a;
      return E.b * open * Math.pow(Math.max(0, 1 - k * k), 0.75);
    };
    // круг, обрезанный веками: заливка одной колонки
    const disk = (x, rad, color) => {
      const dx = E.cx + x - gx;
      if (Math.abs(dx) >= rad) return;
      const v = Math.sqrt(rad * rad - dx * dx), H = half(x);
      const y0 = Math.max(E.cy - H, gy - v), y1 = Math.min(E.cy + H, gy + v);
      if (y1 > y0) px(ctx, E.cx + x, y0, 1, y1 - y0, color);
    };
    const a = Math.floor(E.a);
    for (let x = -a; x <= a; x++) {
      const H = half(x);
      if (H >= 0.5) px(ctx, E.cx + x, E.cy - H, 1, H * 2, '#e8dcc0');
    }
    const cornerY = E.cy - E.b * 0.1;
    for (const s of [-1, 1]) {                                      // красные прожилки от уголков
      pline(ctx, E.cx + s * E.a * 0.96, E.cy, E.cx + s * E.a * 0.55, E.cy - E.b * 0.25 * open, 1, 'rgba(176,40,30,0.6)');
      pline(ctx, E.cx + s * E.a * 0.9, E.cy + E.b * 0.1, E.cx + s * E.a * 0.6, E.cy + E.b * 0.3 * open, 1, 'rgba(176,40,30,0.5)');
    }
    for (let x = -a; x <= a; x++) {
      disk(x, ri, '#8c2a12');
      disk(x, ri * 0.74, '#d9702a');
      disk(x, rp, PAL.ink0);
    }
    for (let x = -a; x <= a; x++) {                                 // ресницы: контур век
      const H = half(x);
      px(ctx, E.cx + x, E.cy - H - 1, 1, 2, lid);
      px(ctx, E.cx + x, E.cy + H - 1, 1, 2, lid);
    }
    for (const s of [-1, 1]) {                                      // стрелки подводки
      pline(ctx, E.cx + s * E.a, cornerY + E.b * 0.1, E.cx + s * (E.a + E.R * 0.16), cornerY - E.R * 0.05, 2, lid);
    }
    if (open > 0.5) px(ctx, gx - ri * 0.4, gy - ri * 0.45, 2, 2, '#ffffff');   // блик
  }

  // ─── свет трубки и виньетка ───────────────────────────────────────────────
  _paintFx(ctx, w, h, u) {
    const t = this.tube || { x: w / 2, y: 0 };
    const R = Math.max(w, h);
    const cold = ctx.createRadialGradient(t.x, t.y, u, t.x, t.y, R * 0.8);
    cold.addColorStop(0, 'rgba(190,226,220,0.2)');
    cold.addColorStop(1, 'rgba(190,226,220,0)');
    ctx.fillStyle = cold;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(22,32,42,0.2)';                            // общий холодный тон
    ctx.fillRect(0, 0, w, h);
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, R * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // ─── уведомления: штраф на тёплом бланке ─────────────────────────────────
  /** Прямоугольник уведомления с учётом вылета, тряски и ухода; тот же для кликов. */
  _noteGeom(n, i) {
    const p = this.paper, u = this.unit;
    const w = Math.min(p.w * 0.72, u * 38), h = u * 9.6;
    let x = p.x + p.w - w - u - i * u * 1.6;
    let y = p.y + u + i * u * 2.6;
    if (n.dying > 0) {
      const q = 1 - n.dying / DYING;
      y -= q * q * (h + u * 2);
    } else if (n.age < ENTER) {
      y -= (1 - easeOutBack(n.age / ENTER)) * (y + h);
    }
    x += Math.sin(this.time * 80) * u * 0.35 * n.shake;
    y += Math.cos(this.time * 67) * u * 0.2 * n.shake;
    const bs = u * 1.8;
    return { x, y, w, h, close: { x: x + w - bs - u * 0.3, y: y + u * 0.3, w: bs, h: bs } };
  }

  /** Видимая пунктуация среди цензуры: точка или восклицательный знак. Возвращает ширину. */
  _mark(ctx, x, y, u, bang, color) {
    const t = Math.max(1, Math.round(u * 0.42)), bottom = y + u * 1.15;
    px(ctx, x, bottom - t, t, t, color);
    if (bang) px(ctx, x, y, t, u * 0.65, color);
    return t + u * 0.45;
  }

  /** Строка из чёрных плашек вместо слов; концы слов иногда ! или ., конец строки всегда. */
  _censored(ctx, x, y, limit, u, r) {
    let bx = x;
    const step = u * 1.05;
    for (let wd = 0; wd < 8; wd++) {
      const len = 2 + Math.floor(r() * 4);
      if (bx + len * step + u * 0.9 > limit) break;
      for (let c = 0; c < len; c++) px(ctx, bx + c * step, y, u * 0.85, u * 1.15, PAL.ink0);
      bx += len * step;
      const k = r();
      if (k < 0.28) bx += this._mark(ctx, bx, y, u, true, '#3a1a0c');
      else if (k < 0.5) bx += this._mark(ctx, bx, y, u, false, '#3a1a0c');
      if (k < 0.07) bx += this._mark(ctx, bx, y, u, true, '#3a1a0c');       // иногда «!!»
      bx += u * 0.7;
    }
    if (bx > x + u * 2) this._mark(ctx, bx - u * 0.3, y, u, r() < 0.6, '#3a1a0c');
  }

  _note(ctx, n, i) {
    const u = this.unit, { x, y, w, h, close } = this._noteGeom(n, i);
    const e = Math.max(1, Math.round(u * 0.3)), hh = u * 2.4;
    const r = rnd(n.seed), f = fine(n);
    const blink = n.flash > 0 && Math.floor(this.time * 14) % 2 === 0;
    const red = blink ? '#e0301a' : '#b02a18';
    ctx.save();
    if (n.dying > 0) ctx.globalAlpha = Math.max(0, n.dying / DYING);

    px(ctx, x + u * 0.6, y + u * 0.7, w, h, 'rgba(0,0,0,0.45)');
    px(ctx, x - e, y - e, w + 2 * e, h + 2 * e, '#4a1208');
    px(ctx, x, y, w, h, SLIP);
    const m = Math.round(u * 0.45), fy = y + hh + m, fh = h - hh - 2 * m;    // тонкая рамка бланка
    ctx.fillStyle = '#c9634a';
    ctx.fillRect(Math.round(x + m), Math.round(fy), Math.round(w - 2 * m), 1);
    ctx.fillRect(Math.round(x + m), Math.round(fy + fh), Math.round(w - 2 * m), 1);
    ctx.fillRect(Math.round(x + m), Math.round(fy), 1, Math.round(fh));
    ctx.fillRect(Math.round(x + w - m), Math.round(fy), 1, Math.round(fh) + 1);

    // шапка: звонок, имя ведомства (цензура и «!»), крестик
    px(ctx, x, y, w, hh, red);
    px(ctx, x, y + hh, w, e, '#4a1208');
    const cell = Math.max(1, Math.round(u * 0.3));
    const swing = Math.sin(this.time * 40) * u * 0.3 * n.flash;
    sprite(ctx, BELL, x + u * 0.8 + swing, y + hh / 2 - cell * 3.5, cell, { x: '#ffd93f', y: '#8a6d14', z: '#8a6d14' });
    let title = '';
    for (let k = 0; k < 4; k++) title += GLYPHS[Math.floor(r() * GLYPHS.length)];
    ctx.font = `${Math.max(6, Math.round(u * 1.3))}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe9c4';
    ctx.fillText(`${title}!`, x + u * 3.2, y + hh / 2 + 1);
    px(ctx, close.x, close.y, close.w, close.h, SLIP);
    px(ctx, close.x, close.y + close.h - 1, close.w, 1, '#c9a86a');
    const c = u * 0.45;
    pline(ctx, close.x + c, close.y + c, close.x + close.w - c, close.y + close.h - c, Math.max(1, u * 0.28), '#8c1c10');
    pline(ctx, close.x + close.w - c, close.y + c, close.x + c, close.y + close.h - c, Math.max(1, u * 0.28), '#8c1c10');

    // левая колонка: три строки цензуры с пунктуацией и линейки под ними
    const tx = x + u * 1.3, tl = x + w * 0.57;
    for (let line = 0; line < 3; line++) {
      const ty = y + hh + u * 1.1 + line * u * 1.65;
      px(ctx, tx, ty + u * 1.4, tl - tx, 1, '#dcc48e');
      this._censored(ctx, tx, ty, tl, u, r);
    }
    ctx.font = `${Math.max(6, Math.round(u * 1.05))}px ${FONT}`;
    ctx.fillStyle = '#7a5a3a';
    ctx.fillText(`№ ${f.serial}`, tx, y + h - u * 1.3);

    // правая колонка: сумма к оплате и набежавшая пеня
    const bx = x + w * 0.6, by = y + hh + u * 1.0, bw = w * 0.4 - u * 1.3, bh = u * 5.3;
    px(ctx, bx - e, by - e, bw + 2 * e, bh + 2 * e, '#7a1d16');
    px(ctx, bx, by, bw, bh, blink ? '#ffe2cf' : '#fbefcf');
    for (let k = 0; k < 4; k++) px(ctx, bx + u * 0.6 + k * u * 0.8, by + u * 0.5, u * 0.6, u * 0.8, PAL.ink0);
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.max(7, Math.round(Math.min(u * 2.6, bw / 3.9)))}px ${FONT}`;   // шесть знаков должны влезть в рамку
    ctx.fillStyle = '#8c1c10';
    ctx.fillText(f.total, bx + bw / 2, by + u * 2.9);
    ctx.font = `${Math.max(6, Math.round(u * 1.05))}px ${FONT}`;
    ctx.fillStyle = n.pings > 0 ? '#b02a18' : '#b7a07a';
    ctx.fillText(`+${f.penalty}`, bx + bw / 2, by + bh - u * 0.9);

    // печать поверх бланка: кольцо, три цензурных знака и две точки
    const sx = x + w * 0.5, sy = y + h * 0.68, sr = u * (2.3 + 0.25 * n.flash);
    const ink = 'rgba(176,42,24,0.72)';
    ring(ctx, sx, sy, sr, u * 0.35, ink);
    ring(ctx, sx, sy, sr - u * 0.75, 1, ink);
    let seal = '';
    for (let k = 0; k < 3; k++) seal += GLYPHS[Math.floor(r() * GLYPHS.length)];
    ctx.font = `${Math.max(6, Math.round(u * 1.1))}px ${FONT}`;
    ctx.fillStyle = ink;
    ctx.fillText(seal, sx, sy + 1);
    px(ctx, sx - sr - u * 0.3, sy, u * 0.4, u * 0.4, ink);
    px(ctx, sx + sr - u * 0.1, sy, u * 0.4, u * 0.4, ink);

    // сгорающая полоска терпения
    px(ctx, x, y + h - u * 0.5, w * Math.max(0, n.life / this.notes.life), u * 0.5, red);
    ctx.restore();
  }

  onPointerUp() { /* клавиша сама отпустится по таймеру */ }
}
