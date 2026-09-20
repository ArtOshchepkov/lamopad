// ─── Толпа: человечки сбегаются на помощь, пока ты толкаешь ─────────────────
// Слоты заранее разложены рядами «в глубину»: ближние ряды крупнее и ниже.
// Уходят тоже по одному — стоит бросить ведро, и помощники теряют интерес.
import { CONF, PAL, SHIRTS } from '../config.js';
import { Person, personScale } from './person.js';
import { Sfx } from '../sfx.js';

const SKY = Phaser.Display.Color.HexStringToColor(PAL.skyLow);

/** Дальние ряды подмешивают к себе небо: так глубина читается без второго атласа. */
function hazeTint(k) {
  const c = Math.round(255 - (255 - SKY.red) * k) * 0x10000
    + Math.round(255 - (255 - SKY.green) * k) * 0x100
    + Math.round(255 - (255 - SKY.blue) * k);
  return c;
}

export class Crowd {
  constructor(scene, groundY, bucketLeft) {
    this.scene = scene;
    this.groundY = groundY;
    this.members = [];
    this.slots = this._makeSlots(bucketLeft);
    this.spawnAcc = 0;      // накопленные доли человека — приход дробный
    this.leaveT = 0;
    this.pushT = 0;
    this.partyT = 0;
    this.partying = false;
  }

  /** Толпа-клин: ряды уходят в глубину, мельчают, выцветают и заходят за ведро. */
  _makeSlots(bucketLeft) {
    const C = CONF.crowd;
    const out = [];
    let y = this.groundY;
    for (let r = 0; r < C.rows; r++) {
      const scale = personScale(r);
      const k = scale / CONF.px.person;              // 1 у переднего ряда, меньше вглубь
      // дальние ряды видно из-за ведра — там ещё полпляжа свободного места
      const right = bucketLeft - 2 + Math.min(r * C.rowShift, C.rowShiftMax);
      const left = C.leftEdge + r * C.leftShift;
      let i = 0;
      for (let x = right; x >= left; x -= C.slotGap, i++) {
        out.push({
          x: x + (((r * 7 + i * 3) % 5) - 2) * 2,
          // ряд не по линеечке: ровная кромка голов выдаёт сетку
          y: y + (((r * 3 + i * 5) % 4) - 1.5) * 1.6,
          scale,
          haze: (r / C.rows) * C.rowHaze,            // дымка расстояния
          // передние ряды перед ведром, задние — за ним, и все до игрока
          depth: 26 - (r / C.rows) * 16,
          order: r * 1000 + i,                       // сперва передний ряд, потом вглубь
          phase: (r * 3.1 + i * 1.7) % 6.283,        // разнобой в прыжках на победе
          hop: 0.7 + ((r * 5 + i * 3) % 7) / 10,     // и разная высота прыжка
          busy: false,
        });
      }
      y -= C.rowLift * k;                            // подъём тоже по перспективе
    }
    this.midX = (C.leftEdge + bucketLeft) / 2;       // где у толпы середина
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
        variant: Math.floor(Math.random() * SHIRTS.length),
        scale: slot.scale,
      });
      m.person.sprite.setDepth(slot.depth);
      m.sprite = m.person.sprite;
    }
    if (slot.haze > 0.01) m.sprite.setTint(hazeTint(slot.haze));
    this.members.push(m);
    Sfx.join();
    return m;
  }

  /** playerPushing — игрок упёрся в ведро. */
  update(dt, playerPushing) {
    if (this.partying) return;                      // ведро упало, всем не до того
    const C = CONF.crowd;

    if (playerPushing) {
      this.leaveT = 0;
      this.pushT += dt * 1000;
      if (this.members.length > 0 || this.pushT >= C.joinAfter) {
        const rate = C.rateBase + this.members.length * C.rateAccel;
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
      if (m.person) m.person.setFrame('cheer');
    }
  }

  /** Прыжки толпы считаем сами: тысяча твинов сцену бы не обрадовала. */
  party(dt) {
    this.partyT += dt;
    const amp = CONF.crowd.partyAmp;
    for (const m of this.members) {
      if (m.state !== 'cheer') continue;
      const s = m.slot;
      m.sprite.y = s.y - Math.abs(Math.sin(this.partyT * 5 + s.phase)) * amp * s.hop;
    }
  }
}
