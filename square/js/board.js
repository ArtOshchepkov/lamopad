// ─── Доска: четыре панели идут одновременно и слушают одну клавиатуру ───────
//
// ГЛАВНОЕ ПРАВИЛО ВВОДА. Клавиатура общая: одно нажатие уходит во ВСЕ панели
// сразу. Нажал стрелку — и человечки налегают на плиту, и лама толкает
// яблоко, и качели получают толчок. Поэтому НИКТО из панелей не зовёт
// preventDefault: Phaser слушает ту же клавиатуру и молча отбрасывает
// события с defaultPrevented — одна вежливая панель обесточила бы соседнюю. Указатель, наоборот, адресный: клик
// достаётся той панели, по которой попали, и она одна подсвечена рамкой.
// Гасим панели только целиком вместе со страницей (вкладка ушла, окно
// потеряло фокус) — на этом держится откат у SISYPHUS.
//
// РОСТЕР. Порядок в PANES = порядок ячеек в сетке (css #board).
//   square    — Phaser-сцена (js/scenes, js/objects). Толпа налегает на плиту
//               у обрыва: держишь ←/→, человечки сбегаются, плита кренится.
//               Набрал толпу — плита валится в пропасть; вышло время — плита
//               уходит вверх. Дальше панель молча перезапускается (main.js).
//   hill      — SISYPHUS: лама катит яблоко на готическую гору. Держишь клавишу
//               или палец - минута ровного хода до вершины; частые тапы
//               (ТАПАЛКА) - вдвое-втрое быстрее. Отпустил - сползает,
//               докатил или страница ушла — скатывается с разгоном.
//   swing     — качели-маятник. Клик/клавиша добавляет размаха, размах
//               гаснет сам. Сторона маха красит панель: вправо солнце,
//               влево дождь, снег и гроза.
//   writer    — печатная машинка. Клавиатура и клики по клавишам на корпусе
//               кладут на бумагу ровный блок, пробел остаётся пробелом.
//               После десятой буквы её иногда перебивает красное зацензуренное
//               уведомление: пищит, пока не закроешь (правила — games/notes.js).
//
// СВЕТ. Поверх всех панелей лежит общий дискотечный слой (disco-overlay.js):
// он один на доску, светит в такт треку и трясёт доску на басах. Такт считает сама доска — Beat.update
// зовётся здесь раз в кадр и только здесь, остальные его лишь читают.
//
// КУДА РАСТИ. Новая панель = файл в js/games с наследником Panel + строка в
// PANES + ячейка в сетке. Все панели переиспользуемы поодиночке: им нужен
// только контейнер и tick() в чьём-нибудь rAF.
import { Beat } from './beat.js';
import { DiscoOverlay } from './disco-overlay.js';
import { Focus } from './focus.js';
import { Sisyphus } from './games/sisyphus.js';
import { Swing } from './games/swing.js';
import { Typewriter } from './games/typewriter.js';

// Квадрат живёт на Phaser и мостится отдельно: здесь он только ячейка доски
const PANES = [
  { key: 'square', id: 'pane-square', make: null },
  { key: 'hill', id: 'pane-hill', make: (el) => new Sisyphus(el) },
  { key: 'swing', id: 'pane-swing', make: (el) => new Swing(el) },
  { key: 'writer', id: 'pane-writer', make: (el) => new Typewriter(el) },
];

export function mountBoard() {
  const panes = [];
  // свет лежит поверх страницы, а трясётся в такт сама доска под ним
  const disco = new DiscoOverlay(document.body, document.getElementById('board'));

  for (const def of PANES) {
    const el = document.getElementById(def.id);
    if (!el) continue;
    const pane = { key: def.key, el, panel: def.make ? def.make(el) : null };
    panes.push(pane);

    el.addEventListener('pointerdown', (e) => {
      Focus.setPointer(pane.key);
      if (!pane.panel) return;
      const r = el.getBoundingClientRect();
      pane.panel.held = true;
      pane.panel.onPointerDown(e.clientX - r.left, e.clientY - r.top);
    });
    el.addEventListener('pointermove', (e) => {
      if (!pane.panel || !pane.panel.held) return;
      const r = el.getBoundingClientRect();
      pane.panel.onPointerMove(e.clientX - r.left, e.clientY - r.top);
    });
  }

  const release = () => {
    for (const p of panes) {
      if (p.panel && p.panel.held) { p.panel.held = false; p.panel.onPointerUp(); }
    }
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // Клавиатура общая: событие получают все панели, каждая решает сама.
  // Событие не гасим и не трогаем — его ещё слушает Phaser-сцена квадрата
  window.addEventListener('keydown', (e) => {
    for (const p of panes) if (p.panel) p.panel.onKeyDown(e);
  });
  window.addEventListener('keyup', (e) => {
    for (const p of panes) if (p.panel) p.panel.onKeyUp(e);
  });

  // страница ушла из виду — спит вся доска разом
  document.addEventListener('visibilitychange', () => Focus.setPage(!document.hidden));
  window.addEventListener('blur', () => Focus.setPage(false));
  window.addEventListener('focus', () => Focus.setPage(!document.hidden));

  Focus.on(() => {
    for (const p of panes) {
      const pointed = Focus.pointer === p.key;
      p.el.classList.toggle('pointed', pointed);
      if (!p.panel) continue;
      p.panel.pointed = pointed;
      p.panel.setAwake(Focus.page);
    }
  });
  Focus.setPointer('square');

  let prev = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    Beat.update(now, dt);                 // единственный на странице тик такта
    for (const p of panes) if (p.panel) p.panel.tick(dt);
    disco.tick(dt);                       // свет рисуем последним, поверх всех
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  window.__focus = Focus;                 // отладка: что доска думает о внимании
  window.__disco = disco;                 // отладка: свет можно зажечь руками
  window.__panes = panes;                 // отладка: достучаться до панели из консоли
  return { panes, disco };
}
