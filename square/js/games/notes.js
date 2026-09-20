// ─── Уведомления печатной машинки: чистая модель, без канвы и звука ─────────
//
// Пока пишешь, тебя иногда отвлекают. После первых `after` букв каждая новая
// с шансом `chance` (редко: 2%) вызывает красное назойливое уведомление. Оно не уходит
// само: пищит каждые `repeat` секунд, пока его не закроют или пока не
// кончится `life`. Одновременно висят не больше `max` штук, умирающее
// уведомление ещё занимает место, чтобы стопка не прыгала.
//
// Уведомление — штраф: у него есть сумма, и она растёт от писка к писку.
//
// Рисует и озвучивает всё это Typewriter, сюда он подключается через `on`:
// spawn / ping / dismiss (каждый получает уведомление).

export const DYING = 0.22;                // сколько секунд уведомление уезжает

const CENTS = 99999;                      // потолок суммы: три цифры и копейки
const PING_FINE = 2500;                   // за каждый писк набегает 25.00

const money = (c) => `${String(Math.floor(c / 100)).padStart(3, '0')}.${String(c % 100).padStart(2, '0')}`;

/**
 * Что написано в штрафе. Слова цензурятся, а цифры нет: их видно всегда.
 * Сумма зависит от seed и растёт с каждым писком, пока штраф не закрыли.
 */
export function fine(n) {
  const base = 10000 + (n.seed % 50000);
  const penalty = Math.min(CENTS, n.pings * PING_FINE);
  return {
    total: money(Math.min(CENTS, base + penalty)),
    penalty: money(penalty),
    serial: `${String(n.seed % 1000).padStart(3, '0')}.${String(Math.floor(n.seed / 1000) % 100).padStart(2, '0')}`,
  };
}

export class Notes {
  constructor({
    after = 9, chance = 0.02, max = 3, life = 9, repeat = 2.2,
    rand = Math.random, on = {},
  } = {}) {
    Object.assign(this, { after, chance, max, life, repeat, rand, on });
    this.list = [];
    this.count = 0;                       // букв напечатано за всё время
    this._id = 0;
  }

  /** Вызывать на каждую напечатанную букву. Вернёт новое уведомление или null. */
  letter() {
    this.count++;
    if (this.count <= this.after) return null;
    if (this.list.length >= this.max) return null;
    if (this.rand() >= this.chance) return null;
    const n = {
      id: ++this._id,
      seed: Math.floor(this.rand() * 1e9),
      age: 0, life: this.life, pingT: this.repeat, pings: 0,
      shake: 1, flash: 1,                 // затухают в update, рисует Typewriter
      dying: 0,                           // >0 — секунд до удаления
    };
    this.list.push(n);
    if (this.on.spawn) this.on.spawn(n);
    return n;
  }

  _find(id) { return this.list.find((n) => n.id === id); }

  dismiss(id) {
    const n = this._find(id);
    if (!n || n.dying > 0) return;
    n.dying = DYING;
    if (this.on.dismiss) this.on.dismiss(n);
  }

  /** Escape: закрыть самое верхнее (последнее). */
  dismissNewest() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].dying === 0) { this.dismiss(this.list[i].id); return; }
    }
  }

  /** Ткнули в тело уведомления: оно оживает и получает новую жизнь. */
  touch(id) {
    const n = this._find(id);
    if (!n || n.dying > 0) return;
    n.life = this.life;
    this._ping(n);
  }

  _ping(n) {
    n.pings++;
    n.pingT = this.repeat;
    n.shake = 1;
    n.flash = 1;
    if (this.on.ping) this.on.ping(n);
  }

  update(dt) {
    for (const n of this.list.slice()) {
      if (n.dying > 0) {
        n.dying -= dt;
        if (n.dying <= 0) this.list.splice(this.list.indexOf(n), 1);
        continue;
      }
      n.age += dt;
      n.shake = Math.max(0, n.shake - dt * 2.5);
      n.flash = Math.max(0, n.flash - dt * 2);
      n.life -= dt;
      if (n.life <= 0) { this.dismiss(n.id); continue; }
      n.pingT -= dt;
      if (n.pingT <= 0) this._ping(n);
    }
  }
}
