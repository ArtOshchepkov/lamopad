// ─── Состояние внимания: страница и указатель ───────────────────────────────
// Клавиатура на доске общая: одно нажатие уходит во ВСЕ панели сразу (см.
// board.js). Поэтому здесь остаётся ровно два факта:
//   page    — страница на виду и окно в фокусе. Панели, которым это важно,
//             сами решают, что делать, когда внимание ушло совсем.
//   pointer — панель, в которую сейчас летят клики и тычки. Только она
//             подсвечена: на тачe иначе непонятно, куда попадёшь пальцем.

export const Focus = {
  page: !document.hidden,
  pointer: null,
  _subs: [],

  setPage(on) {
    if (on === this.page) return;
    this.page = on;
    this._emit();
  },

  setPointer(key) {
    if (key === this.pointer) return;
    this.pointer = key;
    this._emit();
  },

  on(fn) { this._subs.push(fn); fn(); },

  _emit() { for (const fn of this._subs) fn(); },
};
