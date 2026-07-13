// ─── Скрытый режим записи (?record_mode) — для роликов TikTok/Reels/Shorts ───
// Зритель должен видеть каждый тап, как будто играет сам. Эффект тапа —
// вспышка-«солнышко» в визуальном языке игры: тёплое ядро, расходящееся
// золотое кольцо (как у вех/рекорда в ui.js) и лучи-искры; при удержании
// пальца (рулёжка) — мягкое золотое свечение, следующее за пальцем.
// Работает на DOM-уровне поверх канваса И оверлеев (старт/смерть/платформы),
// чтобы тапы читались на любом экране. Без ?record_mode модуль не делает
// НИЧЕГО — игра не затронута. Сюда же добавлять будущие фичи режима записи
// (чистый UI, скрытие промо-элементов): на body вешается класс .record-mode —
// готовый хук для таких правок в CSS.

const STYLE = `
#rec-fx {
  position: fixed; inset: 0; overflow: hidden;
  pointer-events: none; z-index: 1000;
}
.rec-tap { position: absolute; width: 0; height: 0; }
.rec-tap i { position: absolute; display: block; }
/* ядро — маленькое солнышко (палитра HUD: #fff6ec → #ffcf3f → #ff7d1e):
   плотный золотой диск с белым бликом и тёплым гало вокруг */
.rec-core {
  width: 68px; height: 68px; left: -34px; top: -34px; border-radius: 50%;
  background: radial-gradient(circle at 44% 40%,
    #fff6ec 0%, #ffe27a 26%, #ffcf3f 52%,
    rgba(255,166,48,.9) 58%, rgba(255,125,30,.45) 68%, rgba(255,125,30,0) 80%);
  animation: rec-core .5s ease-out forwards;
}
@keyframes rec-core {
  0% { transform: scale(.35); opacity: 0; }
  16% { opacity: 1; }
  62% { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(1.2); opacity: 0; }
}
/* расходящееся золотое кольцо — то же, что у вех; тёмная кромка снаружи,
   чтобы читалось и на светлом (офис, закат), и в тёмном небе */
.rec-ring {
  width: 52px; height: 52px; left: -26px; top: -26px; border-radius: 50%;
  border: 4px solid #ffcf3f;
  box-shadow: 0 0 16px rgba(255,207,63,.8), 0 0 0 1px rgba(59,59,70,.25);
  animation: rec-ring .55s cubic-bezier(.2,.7,.3,1) forwards;
}
@keyframes rec-ring {
  0% { transform: scale(.5); opacity: .95; }
  100% { transform: scale(2.4); opacity: 0; }
}
/* лучики солнышка — как на детском рисунке: торчат из диска и разлетаются */
.rec-ray {
  width: 6px; height: 24px; left: -3px; top: -12px; border-radius: 3px;
  background: linear-gradient(#fff6ec, #ffcf3f 55%, rgba(255,166,48,.9));
  animation: rec-ray .55s ease-out forwards;
}
@keyframes rec-ray {
  0% { transform: rotate(var(--a)) translateY(-32px) scaleY(.6); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: rotate(var(--a)) translateY(-74px) scaleY(.3); opacity: 0; }
}
/* свечение под удержанным пальцем: показывает рулёжку; проявляется с задержкой,
   чтобы короткий тап оставался чистой вспышкой */
.rec-hold {
  position: absolute; left: 0; top: 0;
  width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255,246,236,.9) 0%, rgba(255,207,63,.5) 42%, rgba(255,125,30,0) 70%);
  opacity: 0; transition: opacity .18s ease .12s;
}
.rec-hold.on { opacity: .8; }
`;

export function initRecordMode() {
  if (!new URLSearchParams(window.location.search).has('record_mode')) return;
  document.body.classList.add('record-mode');

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  const layer = document.createElement('div');
  layer.id = 'rec-fx';
  document.body.appendChild(layer);

  // вспышка тапа: каждый тап — свой независимый элемент (частые тапы ок)
  const burst = (x, y) => {
    const tap = document.createElement('div');
    tap.className = 'rec-tap';
    tap.style.left = `${x}px`;
    tap.style.top = `${y}px`;
    const mk = (cls, angle) => {
      const el = document.createElement('i');
      el.className = cls;
      if (angle !== undefined) el.style.setProperty('--a', `${angle}deg`);
      tap.appendChild(el);
    };
    mk('rec-ring');
    mk('rec-core');
    for (let i = 0; i < 8; i++) mk('rec-ray', i * 45 + (Math.random() * 16 - 8));
    layer.appendChild(tap);
    setTimeout(() => tap.remove(), 620);
  };

  // свечения удержания — по pointerId (мультитач: два пальца = два свечения)
  const holds = new Map();
  const moveHold = (h, e) => {
    h.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  };
  window.addEventListener('pointerdown', (e) => {
    burst(e.clientX, e.clientY);
    const h = document.createElement('div');
    h.className = 'rec-hold';
    moveHold(h, e);
    layer.appendChild(h);
    requestAnimationFrame(() => h.classList.add('on'));
    holds.set(e.pointerId, h);
  }, true);
  window.addEventListener('pointermove', (e) => {
    const h = holds.get(e.pointerId);
    if (h) moveHold(h, e);
  }, true);
  const endHold = (e) => {
    const h = holds.get(e.pointerId);
    if (!h) return;
    holds.delete(e.pointerId);
    h.style.transition = 'opacity .15s ease';
    h.classList.remove('on');
    setTimeout(() => h.remove(), 180);
  };
  window.addEventListener('pointerup', endHold, true);
  window.addEventListener('pointercancel', endHold, true);
}
