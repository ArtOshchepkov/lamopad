// ─── Толпа: человечки сбегаются на помощь, пока ты толкаешь ─────────────────
// Слоты заранее разложены рядами «в глубину»: ближние ряды крупнее и ниже.
// Уходят тоже по одному — стоит бросить квадрат, и помощники теряют интерес.
import { CONF, DEPTH, FOLK } from '../config.js';
import { Person, personScale } from './person.js';
import { Sfx } from '../sfx.js';

export class Crowd {
  constructor(scene, groundY, squareLeft) {
    this.scene = scene;
    this.groundY = groundY;
    this.members = [];
    this.slots = this._makeSlots(squareLeft);
    this.capacity = this.slots.length;
    this.spawnAcc = 0;      // накопленные доли человека — приход дробный
    this.leaveT = 0;
    this.pushT = 0;
    this.partyT = 0;
    this.partying = false;
    this._heave = 0;
  }

  /**
   * Толпа — курган: передние ряды длинные, дальние короче, так что силуэт
   * заваливается от квадрата влево-вниз. Сетку нарочно портим разбросом по обеим
   * осям — иначе ровные ряды читаются ковром, а не людьми.
   */
  _makeSlots(squareLeft) {
    const { rows, rowTaper, slotGap, rowLift } = CONF.crowd;
    // сколько человечков влезает в ряд — вопрос к ширине экрана, не к конфигу
    const perRow = Math.max(12, Math.floor((squareLeft - 16) / slotGap));
    const out = [];
    let y = this.groundY;
    for (let r = 0; r < rows; r++) {
      const scale = personScale(r);
      const cols = Math.max(6, perRow - Math.floor(r * rowTaper));
      for (let i = 0; i < cols; i++) {
        const j = (r * 7 + i * 3) % 7;
        out.push({
          x: squareLeft - 2 - i * slotGap + (j - 3) * 2,
          y: y + ((j * 5) % 7) - 3,
          scale,
          // Внутри ряда левые рисуются поверх правых: сосед слева закрывает
          // спину с красным рюкзаком, и от каждого остаётся видна правая
          // половина — лицо, плечо, рука. Иначе толпа читается красным ковром
          depth: DEPTH.crowd + (rows - r) * 100 + i,
          order: r * 1000 + i,                      // сперва передний ряд, потом вглубь
          phase: (r * 3.1 + i * 1.7) % 6.283,       // разнобой в прыжках на победе
          busy: false,
        });
      }
      y -= rowLift * (personScale(r + 1) / CONF.px.person);
    }
    return out.sort((a, b) => a.order - b.order);
  }

  /** Сила толпы в «человечках»: лама толкает за десятерых. */
  get force() {
    let f = 0;
    for (const m of this.members) if (m.state === 'push') f += m.worth;
    return f;
  }

  get size() { return this.members.length; }

  add(isLlama = false) {
    // уходящие освобождают место сразу, не дойдя до края экрана
    const slot = this.slots.find((s) => !s.busy);
    if (!slot) return null;
    slot.busy = true;
    const m = {
      slot,
      state: 'run',
      worth: isLlama ? CONF.crowd.llamaWorth : 1,
      isLlama,
    };
    if (isLlama) {
      m.sprite = this.scene.add.image(-40 - Math.random() * 140, slot.y, 'llama')
        .setOrigin(0.5, 1).setScale(CONF.px.llama * (slot.scale / CONF.px.person));
      m.sprite.setDepth(slot.depth);
    } else {
      m.person = new Person(this.scene, -40 - Math.random() * 140, slot.y, {
        variant: Math.floor(Math.random() * FOLK.length),
        scale: slot.scale,
      });
      m.person.sprite.setDepth(slot.depth);
      m.sprite = m.person.sprite;
    }
    this.members.push(m);
    Sfx.join();
    return m;
  }

  /** playerPushing — игрок упёрся в квадрат. */
  update(dt, playerPushing) {
    if (this.partying) return;                      // квадрат упало, всем не до того
    const C = CONF.crowd;

    if (playerPushing) {
      this.leaveT = 0;
      this.pushT += dt * 1000;
      if (this.members.length > 0 || this.pushT >= C.joinAfter) {
        const rate = C.rateBase + C.rateK * Math.sqrt(this.members.length);
        this.spawnAcc += rate * dt;
        while (this.spawnAcc >= 1) {
          this.spawnAcc -= 1;
          if (!this.add()) { this.spawnAcc = 0; break; }
        }
      }
    } else {
      this.pushT = 0;
      this.spawnAcc = 0;
      this.leaveT += dt * 1000;
      if (this.leaveT >= C.leaveEvery) {
        this.leaveT = 0;
        this._sendOneHome();
      }
    }

    this._move(dt, playerPushing);
  }

  /** Последний пришедший уходит первым — он меньше всех успел вложиться. */
  _sendOneHome() {
    for (let i = this.members.length - 1; i >= 0; i--) {
      if (this.members[i].state !== 'leave') {
        this.members[i].state = 'leave';
        this.members[i].slot.busy = false;
        return;
      }
    }
  }

  _move(dt, playerPushing) {
    const speed = CONF.crowd.runSpeed * dt;
    for (let i = this.members.length - 1; i >= 0; i--) {
      const m = this.members[i];

      if (m.state === 'run') {
        m.sprite.x += speed;
        if (m.person) m.person.update(dt, true);
        if (m.sprite.x >= m.slot.x) {
          m.sprite.x = m.slot.x;
          m.state = 'push';
          if (m.person) m.person.setFrame('push');
          Sfx.grunt();
        }
      } else if (m.state === 'push') {
        if (!playerPushing && m.person) m.person.setFrame('stand');
        else if (m.person) m.person.setFrame('push');
      } else if (m.state === 'leave') {              // потерял интерес и побрёл восвояси
        m.sprite.x -= speed * 0.7;
        m.sprite.flipX = true;
        if (m.person) m.person.update(dt, true);
        if (m.sprite.x < -40) {
          m.sprite.destroy();
          this.members.splice(i, 1);
        }
      }
    }
  }

  /** Финал: замереть в моменте, потом прыгать от радости. */
  freeze() { this.partying = true; }

  celebrate() {
    for (const m of this.members) {
      m.state = 'cheer';
      if (m.person) m.person.setFrame('walk');
    }
  }

  /**
   * Присесть в такт: одно общее смещение на всех. Округляем до пикселя, и
   * тогда перебор спрайтов случается только когда картинка правда меняется.
   */
  heave(px) {
    const v = Math.round(px);
    if (v === this._heave) return;
    this._heave = v;
    for (const m of this.members) {
      if (m.state !== 'cheer') m.sprite.y = m.slot.y - v;
    }
  }

  /** Прыжки толпы считаем сами: 400 твинов сцена бы не поблагодарила. */
  party(dt) {
    this.partyT += dt;
    const amp = CONF.crowd.partyAmp;
    for (const m of this.members) {
      if (m.state !== 'cheer') continue;
      m.sprite.y = m.slot.y - Math.abs(Math.sin(this.partyT * 5 + m.slot.phase)) * amp;
    }
  }
}
