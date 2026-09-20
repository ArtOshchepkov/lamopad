// ─── Процедурные денди-текстуры: рисуем пикселями, без бинарных ассетов ──────
// Всё рисуется в «пиксельных» координатах (8×12 человечек, 90×90 квадрат),
// а на сцене увеличивается целым числом — отсюда честный NES-вид.
import { CONF, FOLK, PAL } from '../config.js';

/** Детерминированный шум: ржавчина должна быть одинаковой между запусками. */
function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(scene, key, w, h) {
  if (scene.textures.exists(key)) return null;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  return {
    tex,
    ctx,
    ox: 0,
    oy: 0,
    /** Пиксельный прямоугольник — со сдвигом текущей клетки атласа. */
    r(x, y, w2, h2, color) {
      if (!color) throw new Error('нет цвета для ' + key + ' @ ' + x + ',' + y);
      ctx.fillStyle = color;
      ctx.fillRect(this.ox + x, this.oy + y, w2, h2);
    },
    done() { tex.refresh(); },
  };
}

// ─── Человечек: 8×12, лицом вправо. Три кадра: стоит / шагает / толкает ─────
const PERSON_FRAMES = {
  stand: (p, f) => {
    if (f.pack) p.r(0, 4, 2, 3, f.pack);
    p.r(2, 0, 3, 2, f.hair);
    p.r(2, 2, 3, 2, f.skin);
    p.r(4, 2, 1, 1, PAL.ink);                      // глаз
    p.r(1, 4, 5, 2, f.shirt);
    p.r(2, 6, 3, 2, f.shirt);
    p.r(5, 5, 1, 2, f.skin);                       // рука
    p.r(2, 8, 3, 2, PAL.pants);
    p.r(2, 10, 1, 1, PAL.pants); p.r(4, 10, 1, 1, PAL.pants);
    p.r(2, 11, 1, 1, f.shoe);    p.r(4, 11, 1, 1, f.shoe);
  },
  walk: (p, f) => {
    if (f.pack) p.r(0, 4, 2, 3, f.pack);
    p.r(2, 0, 3, 2, f.hair);
    p.r(2, 2, 3, 2, f.skin);
    p.r(4, 2, 1, 1, PAL.ink);
    p.r(1, 4, 5, 2, f.shirt);
    p.r(2, 6, 3, 2, f.shirt);
    p.r(6, 4, 1, 2, f.skin);                     // рука вперёд на ходу
    p.r(2, 8, 3, 2, PAL.pants);
    p.r(1, 10, 1, 1, PAL.pants); p.r(5, 10, 1, 1, PAL.pants);
    p.r(1, 11, 2, 1, f.shoe);    p.r(4, 11, 2, 1, f.shoe);
  },
  push: (p, f) => {
    if (f.pack) p.r(1, 4, 2, 3, f.pack);
    p.r(3, 0, 3, 2, f.hair);
    p.r(3, 2, 3, 2, f.skin);
    p.r(5, 2, 1, 1, PAL.ink);
    p.r(2, 4, 4, 2, f.shirt);
    p.r(3, 6, 2, 2, f.shirt);
    p.r(6, 4, 2, 1, f.skin);                     // обе руки в квадрат
    p.r(2, 8, 3, 2, PAL.pants);
    p.r(0, 10, 2, 1, PAL.pants);                   // задняя нога в упоре
    p.r(4, 10, 1, 1, PAL.pants);
    p.r(0, 11, 2, 1, f.shoe);    p.r(4, 11, 2, 1, f.shoe);
  },
};

// ─── Герой: дреды, пончо, красный рюкзак — его видно даже в давке ───────────
const HERO_FRAMES = {
  stand: (p) => {
    p.r(0, 1, 2, 5, PAL.hair);                     // дреды за спиной
    p.r(2, 0, 4, 2, PAL.hair);
    p.r(2, 2, 3, 2, PAL.skin);
    p.r(4, 2, 1, 1, PAL.ink);
    p.r(1, 4, 6, 4, PAL.shoe);                     // пончо
    p.r(1, 6, 6, 1, PAL.pack);
    p.r(1, 5, 6, 1, PAL.ponchoHi);
    p.r(2, 8, 3, 2, PAL.pants);
    p.r(2, 10, 1, 1, PAL.pants); p.r(4, 10, 1, 1, PAL.pants);
    p.r(2, 11, 1, 1, PAL.shoe);  p.r(4, 11, 1, 1, PAL.shoe);
  },
  walk: (p) => {
    p.r(0, 0, 2, 5, PAL.hair);                     // дреды подлетают на ходу
    p.r(2, 0, 4, 2, PAL.hair);
    p.r(2, 2, 3, 2, PAL.skin);
    p.r(4, 2, 1, 1, PAL.ink);
    p.r(1, 4, 6, 4, PAL.shoe);
    p.r(1, 6, 6, 1, PAL.pack);
    p.r(1, 5, 6, 1, PAL.ponchoHi);
    p.r(2, 8, 3, 2, PAL.pants);
    p.r(1, 10, 1, 1, PAL.pants); p.r(5, 10, 1, 1, PAL.pants);
    p.r(1, 11, 2, 1, PAL.shoe);  p.r(4, 11, 2, 1, PAL.shoe);
  },
  push: (p) => {
    p.r(0, 2, 3, 4, PAL.hair);
    p.r(3, 0, 3, 2, PAL.hair);
    p.r(3, 2, 3, 2, PAL.skin);
    p.r(5, 2, 1, 1, PAL.ink);
    p.r(2, 4, 5, 4, PAL.shoe);
    p.r(2, 6, 5, 1, PAL.pack);
    p.r(2, 5, 5, 1, PAL.ponchoHi);
    p.r(6, 4, 2, 1, PAL.skin);                     // руки в квадрат
    p.r(2, 8, 3, 2, PAL.pants);
    p.r(0, 10, 2, 1, PAL.pants); p.r(4, 10, 1, 1, PAL.pants);
    p.r(0, 11, 2, 1, PAL.shoe);  p.r(4, 11, 2, 1, PAL.shoe);
  },
};

export const HERO = 'h';

export const PEOPLE_TEX = 'people';
const PW = 8, PH = 12;
export function personKey(variant, frame) { return `${variant}_${frame}`; }

function makePeople(scene) {
  const frames = Object.keys(PERSON_FRAMES);
  const rows = [[HERO, null], ...FOLK.map((f, i) => [i, f])];
  const PAD = 1;                                    // кадры не должны «течь» друг в друга
  const cw = PW + PAD * 2, ch = PH + PAD * 2;
  const p = canvas(scene, PEOPLE_TEX, frames.length * cw, rows.length * ch);
  if (!p) return;
  rows.forEach(([variant, folk], row) => {
    frames.forEach((frame, col) => {
      p.ox = col * cw + PAD;
      p.oy = row * ch + PAD;
      if (folk === null) HERO_FRAMES[frame](p);
      else PERSON_FRAMES[frame](p, folk);
      p.tex.add(personKey(variant, frame), 0, p.ox, p.oy, PW, PH);
    });
  });
  p.ox = p.oy = 0;
  p.done();
}

// ─── Квадрат: 90×90, чернота и кракелюр ─────────────────────────────────────
// Никакой фактуры сверх необходимого: это плоская чёрная плоскость, которую
// выдаёт только сеть трещин по краске — иначе на экране читается дыра.
function makeSquare(scene) {
  const { texW: W, texH: H } = CONF.square;
  const p = canvas(scene, 'square', W, H);
  if (!p) return;
  p.r(0, 0, W, H, PAL.ink0);

  const rand = rnd(20260920);
  // трещины: ломаные, ползущие от случайной точки в случайную сторону
  for (let i = 0; i < 26; i++) {
    let x = Math.floor(rand() * W), y = Math.floor(rand() * H);
    let dx = rand() < 0.5 ? 1 : -1, dy = rand() < 0.5 ? 1 : -1;
    const len = 6 + Math.floor(rand() * 20);
    for (let k = 0; k < len; k++) {
      if (x < 1 || y < 1 || x > W - 2 || y > H - 2) break;
      p.r(x, y, 1, 1, rand() < 0.4 ? PAL.crack : PAL.ink2);
      if (rand() < 0.35) { dx = -dx; }
      if (rand() < 0.35) { dy = -dy; }
      if (rand() < 0.6) x += dx; else y += dy;
    }
  }
  // едва заметные пятна выработки, чтобы плоскость не была мёртвой
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rand() * (W - 3)), y = Math.floor(rand() * (H - 3));
    p.r(x, y, 1 + Math.floor(rand() * 3), 1 + Math.floor(rand() * 2), PAL.ink1);
  }
  // грани: левая чуть светлее, правая и низ тонут
  for (let y = 0; y < H; y++) p.r(0, y, 1, 1, PAL.ink2);
  for (let x = 0; x < W; x++) p.r(x, 0, 1, 1, PAL.ink2);
  for (let y = 0; y < H; y++) p.r(W - 1, y, 1, 1, '#050506');
  for (let x = 0; x < W; x++) p.r(x, H - 1, 1, 1, '#050506');
  p.done();
}

// ─── Лама: 14×13. Пасхалка и лучший толкатель в игре ────────────────────────
function makeLlama(scene) {
  const p = canvas(scene, 'llama', 14, 13);
  if (!p) return;
  p.r(2, 5, 9, 4, PAL.llama);                       // туловище
  p.r(2, 8, 9, 1, PAL.llamaDark);
  p.r(9, 1, 3, 5, PAL.llama);                       // шея
  p.r(9, 0, 4, 2, PAL.llama);                       // голова
  p.r(12, 1, 1, 1, PAL.ink);                        // глаз
  p.r(9, 0, 1, 1, PAL.llamaDark); p.r(11, 0, 1, 1, PAL.llamaDark);
  p.r(3, 9, 2, 4, PAL.llama);  p.r(8, 9, 2, 4, PAL.llama);
  p.r(3, 12, 2, 1, PAL.llamaDark); p.r(8, 12, 2, 1, PAL.llamaDark);
  p.r(0, 5, 2, 2, PAL.llama);                       // хвост
  p.r(3, 3, 5, 2, PAL.pack);                        // красный рюкзак
  p.done();
}

// ─── Земля: плита у края пропасти, 720×110 ──────────────────────────────────
function makeGround(scene) {
  const W = CONF.cliffX, H = CONF.groundH;
  const p = canvas(scene, 'ground', W, H);
  if (!p) return;
  p.r(0, 0, W, H, PAL.ground);
  p.r(0, 0, W, 6, PAL.groundTop);
  p.r(0, 6, W, 3, PAL.groundDim);
  p.r(0, H - 18, W, 18, PAL.groundDark);
  const rand = rnd(777);
  for (let i = 0; i < 260; i++) {                   // камушки и трещины
    const x = Math.floor(rand() * W), y = 10 + Math.floor(rand() * (H - 28));
    const w = 3 + Math.floor(rand() * 6);
    p.r(x, y, w, 3, rand() < 0.5 ? PAL.groundDim : PAL.groundDark);
  }
  for (let i = 0; i < 40; i++) {                    // травинки на кромке
    const x = Math.floor(rand() * W);
    p.r(x, -0, 2, 3, PAL.groundTop);
  }
  // обрыв справа: кромка осыпается ступеньками
  for (let y = 0; y < H; y++) {
    const cut = Math.round(Math.sin(y * 0.28) * 3 + y * 0.12);
    p.r(W - cut - 2, y, cut + 2, 1, PAL.groundDark);
  }
  p.done();
}

// ─── Облако: 24×9 ───────────────────────────────────────────────────────────
function makeCloud(scene) {
  const p = canvas(scene, 'cloud', 24, 9);
  if (!p) return;
  p.r(4, 3, 16, 5, PAL.cloud);
  p.r(2, 5, 20, 3, PAL.cloud);
  p.r(7, 1, 6, 3, PAL.cloud);
  p.r(13, 2, 5, 2, PAL.cloud);
  p.r(2, 7, 20, 1, '#dcd0bc');
  p.done();
}

// ─── Солнце: 18×18, денди-кружок с лучами ───────────────────────────────────
function makeSun(scene) {
  const p = canvas(scene, 'sun', 18, 18);
  if (!p) return;
  for (let y = 0; y < 18; y++) {
    const dy = y - 8.5, hw = Math.sqrt(Math.max(0, 64 - dy * dy));
    p.r(Math.round(8.5 - hw), y, Math.round(hw * 2), 1, PAL.sun);
  }
  p.r(6, 3, 6, 2, '#fff0a0');
  p.done();
}

// ─── Божественный свет: мягкое ядро и лучи великой мудрости ────────────────
function makeGlow(scene) {
  if (!scene.textures.exists('glow')) {
    const tex = scene.textures.createCanvas('glow', 160, 160);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(80, 80, 0, 80, 80, 80);
    g.addColorStop(0, 'rgba(255,248,210,1)');
    g.addColorStop(0.35, 'rgba(255,214,110,0.55)');
    g.addColorStop(1, 'rgba(255,190,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 160, 160);
    tex.refresh();
  }
  if (scene.textures.exists('rays')) return;
  const tex = scene.textures.createCanvas('rays', 256, 256);
  const ctx = tex.getContext();
  const R = 128;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const w = 0.052 + (i % 2) * 0.03;               // лучи разной толщины
    const g = ctx.createLinearGradient(R, R, R + Math.cos(a) * R, R + Math.sin(a) * R);
    g.addColorStop(0, 'rgba(255,245,200,0.75)');
    g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(R, R);
    ctx.arc(R, R, R, a - w, a + w);
    ctx.closePath();
    ctx.fill();
  }
  tex.refresh();
}

export function buildTextures(scene) {
  makeGlow(scene);
  makePeople(scene);
  makeSquare(scene);
  makeLlama(scene);
  makeGround(scene);
  makeCloud(scene);
  makeSun(scene);
}
