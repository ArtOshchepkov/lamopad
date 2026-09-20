// ─── База мини-панели: свой canvas, свой размер, своё внимание ──────────────
// Панель ничего не знает ни о соседях, ни о странице: её заводят, ей дают
// такт (tick) и два внешних факта — проснулась ли страница и летят ли в неё
// клики. Поэтому любого наследника можно вынести на отдельную страницу как
// есть: достаточно контейнера и вызова tick() в своём rAF.
//
// Контракт наследника (всё необязательное):
//   layout(w, h)          — пересчитать геометрию под новый размер
//   update(dt)            — шаг логики, dt в секундах, уже с потолком
//   draw(ctx, w, h)       — кадр; рисуем в CSS-пикселях, DPR уже учтён
//   onAwake(on)           — страница ушла/вернулась
//   onKeyDown/onKeyUp(e)  — ОБЩАЯ клавиатура доски: события приходят всем.
//                           preventDefault звать нельзя: Phaser-сцена соседней
//                           ячейки отбрасывает всё с defaultPrevented, и
//                           панель погасила бы клавишу для всей доски
//   onPointerDown(x, y)   — координаты локальные, внутри панели
//   onPointerMove(x, y) / onPointerUp()
//
// Поля: this.held — палец/мышь прижаты к этой панели; this.awake — страница
// на виду; this.pointed — клики сейчас адресованы сюда (только подсветка).

export class Panel {
  /** @param {HTMLElement} host — контейнер, в который панель кладёт canvas. */
  constructor(host) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pane-canvas';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.time = 0;
    this.awake = true;
    this.pointed = false;
    this.held = false;
    this._ro = new ResizeObserver(() => this.measure());
    this._ro.observe(host);
    this.measure();
  }

  measure() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.layout(w, h);
  }

  tick(dt) {
    if (!this.w) return;
    this.time += dt;
    this.update(dt);
    this.draw(this.ctx, this.w, this.h);
  }

  setAwake(v) {
    if (v === this.awake) return;
    this.awake = v;
    if (!v) this.held = false;
    this.onAwake(v);
  }

  destroy() {
    this._ro.disconnect();
    this.canvas.remove();
  }

  // ── то, что переопределяют наследники ──
  layout() {}
  update() {}
  draw() {}
  onAwake() {}
  onKeyDown() {}
  onKeyUp() {}
  onPointerDown() {}
  onPointerUp() {}
  onPointerMove() {}
}
