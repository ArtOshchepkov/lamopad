// ─── Игровая сцена: мир, физика, камера, вехи ────────────────────────────────
import { CONF, MILESTONES, LYRICS, LYRIC_STEP_M, LYRIC_CLEAR_M, GRUMBLE } from '../config.js';
import { Player } from '../objects/player.js';
import { PlatformField } from '../objects/platforms.js';
import { Background } from '../objects/background.js';

const LOW_GFX = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    this.state = 'ready'; // ready → run → over
    this.maxM = 0;
    this.shownM = -1;
    this.startBest = this.loadBest();
    this.recordBeaten = false;

    // камера — до фона: параллакс-слои позиционируются от стартового скролла
    this.cameras.main.setScroll(0, -(CONF.height - 150));

    this.bg = new Background(this, LOW_GFX);
    this.field = new PlatformField(this);
    this.player = new Player(this, CONF.player.startX, CONF.player.startY);

    this.buildRecordLine();
    this.buildLyricMarkers();
    this.milestoneIdx = 0;

    // флажки вех в мире: чередуем стороны
    this.flagMarkers = MILESTONES.map((m, i) => ({
      y: -m.m * CONF.pxPerM, m, left: i % 2 === 0,
    }));
    this.flagIdx = 0;

    this.isShroom = false; // ГРИБОК после блока «?»
    this.buildOffice();    // серое утро, из которого мы сбежим

    // ворчание засиженного облака и причина смерти
    this.lastPlat = null;
    this.samePlatCount = 0;
    this.grumbleIdx = 0;
    this.deathCause = null;
    this.suitcaseBlame = false;

    // реактивные ранцы
    this.jets = [];
    this.nextJetM = CONF.jet.fromM;
    this.jetTime = 0;
    this.jetSprite = null;
    this.flameAcc = 0;

    // управление
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D');
    this.input.on('pointerdown', () => this.startRun());
    // чит-коды: набери fire — светлячки, plane — самолёт
    this.cheatBuf = '';
    this.input.keyboard.on('keydown', (e) => {
      this.startRun();
      if (e.key && e.key.length === 1) {
        this.cheatBuf = (this.cheatBuf + e.key.toLowerCase()).slice(-8);
        if (this.cheatBuf.endsWith('fire')) { this.bg.spawnFireflies(true); this.cheatBuf = ''; }
        else if (this.cheatBuf.endsWith('plane')) { this.bg.spawnPlane(); this.cheatBuf = ''; }
        else if (this.cheatBuf.endsWith('snake')) {
          const cam = this.cameras.main;
          this.field.place('snake',
            Phaser.Math.Between(70, CONF.width - 70), cam.scrollY + 200);
          this.cheatBuf = '';
        }
        else if (this.cheatBuf.endsWith('jet')) { this.spawnJetOnCloud(); this.cheatBuf = ''; }
        else if (this.cheatBuf.endsWith('light')) {
          this.field.place('storm',
            Phaser.Math.Between(80, CONF.width - 80), this.cameras.main.scrollY + 200);
          this.cheatBuf = '';
        }
        else if (this.cheatBuf.endsWith('mario')) {
          this.field.place('mario',
            Phaser.Math.Between(70, CONF.width - 70), this.cameras.main.scrollY + 180);
          this.cheatBuf = '';
        }
      }
    });

    this.game.events.emit('scg-height', { cur: 0, best: this.startBest });
  }

  loadBest() {
    try { return parseInt(localStorage.getItem(CONF.storage.best), 10) || 0; }
    catch (e) { return 0; }
  }

  saveBest(v) {
    try { localStorage.setItem(CONF.storage.best, String(v)); } catch (e) { /* приватный режим */ }
  }

  // Золотой пунктир «прошлый ты» на высоте рекорда
  buildRecordLine() {
    if (this.startBest <= 0) return;
    const y = -this.startBest * CONF.pxPerM;
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(3, 0xffcf3f, 0.85);
    for (let x = 6; x < CONF.width - 6; x += 26) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 13, y); g.strokePath();
    }
    this.add.text(CONF.width - 12, y - 8, `прошлый ты · ${this.startBest} м`, {
      fontFamily: 'Nunito, sans-serif', fontStyle: 'italic',
      fontSize: '14px', color: CONF.colors.gold,
    }).setOrigin(1, 1).setDepth(2).setAlpha(0.9).setResolution(this.dpr());
  }

  // Строчки песни, парящие в мире между вехами
  buildLyricMarkers() {
    this.lyricMarkers = [];
    this.lyricIdx = 0;
    const maxM = MILESTONES[MILESTONES.length - 1].m + 2500;
    let li = 0;
    for (let m = LYRIC_STEP_M; m < maxM; m += LYRIC_STEP_M) {
      if (MILESTONES.some(ms => Math.abs(ms.m - m) < LYRIC_CLEAR_M)) continue;
      this.lyricMarkers.push({ y: -m * CONF.pxPerM, text: LYRICS[li % LYRICS.length] });
      li++;
    }
  }

  startRun() {
    if (this.state !== 'ready') return;
    this.state = 'run';
    this.player.bounce(CONF.physics.bounceVy);
    this.game.events.emit('scg-start');
  }

  inputDir() {
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    if (left && !right) return -1;
    if (right && !left) return 1;
    const p = this.input.activePointer;
    if (p.isDown) return p.x < CONF.width / 2 ? -1 : 1;
    return 0;
  }

  update(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, CONF.physics.maxDt);
    const cam = this.cameras.main;
    const curM = Math.max(0, Math.round(-this.player.y / CONF.pxPerM));
    this.bg.update(curM, this.maxM, this.player);
    if (this.state !== 'run') return;

    this.player.update(dt, this.inputDir());

    // первый рывок вверх проламывает офисный потолок
    if (!this.ceilingBroken && this.player.y < this.officeCeilingY + 10) this.breakCeiling();

    // реактивный ранец: взлёт мимо всех препятствий
    if (this.jetTime > 0) this.updateJet(dt);

    // приземление (в полёте на ранце коллизий нет)
    const plat = this.jetTime > 0 ? null : this.field.landing(this.player);
    if (plat) this.onLand(plat);

    // камера тянется только вверх
    const target = this.player.y - CONF.height * CONF.camera.lookAhead;
    if (target < cam.scrollY) cam.scrollY = target;

    // генерация и чистка мира
    this.field.ensure(cam.scrollY - CONF.spawn.ahead);
    this.field.update(dt, cam.scrollY + CONF.height, this.player);
    this.spawnLyrics(cam);
    this.spawnFlags(cam);
    this.updateJetPickups(cam);

    // высота
    if (curM > this.maxM) {
      this.maxM = curM;
      this.checkMilestones();
      if (!this.recordBeaten && this.startBest > 0 && this.maxM > this.startBest) {
        this.recordBeaten = true;
        this.game.events.emit('scg-newrecord');
      }
    }
    if (curM !== this.shownM) {
      this.shownM = curM;
      this.game.events.emit('scg-height', {
        cur: curM,
        best: Math.max(this.startBest, this.maxM),
      });
    }

    // падение
    if (this.player.y > cam.scrollY + CONF.height + CONF.camera.deathMargin) this.die();
  }

  onLand(plat) {
    const P = CONF.physics;

    // засиделся на одном облаке — оно начинает ворчать
    if (plat === this.lastPlat) {
      this.samePlatCount++;
      if (this.samePlatCount >= 7 && (this.samePlatCount - 7) % 3 === 0) {
        this.field.shout(plat, GRUMBLE[this.grumbleIdx++ % GRUMBLE.length]);
      }
    } else {
      this.lastPlat = plat;
      this.samePlatCount = 1;
    }
    this.suitcaseBlame = plat.type === 'suitcase'; // упал после чемодана — виноват он

    switch (plat.type) {
      case 'sticker':
        this.player.bounce(P.stickerVy, 0.16);
        this.field.breakSticker(plat);
        break;
      case 'backpack':
        this.player.bounce(P.springVy, 0.34);
        this.field.react(plat);
        break;
      case 'llama':
        this.player.bounce(P.llamaVy, 0.42);
        this.field.react(plat);
        break;
      case 'sunset':
        this.player.bounce(P.bounceVy * 1.08, 0.2);
        this.field.react(plat);
        break;
      case 'bird':
        this.player.bounce(P.bounceVy * 1.15, 0.24);
        this.sound.play('seagull');
        this.field.react(plat);
        break;
      case 'suitcase':
        this.field.crumble(plat); // отскока нет — проваливаемся
        break;
      case 'croc':
      case 'snake':
        this.eaten(plat);
        break;
      case 'mario':
        this.player.bounce(P.springVy * 0.95, 0.3);
        this.field.react(plat);
        this.becomeShroom();
        break;
      case 'storm':
        this.player.bounce(P.bounceVy * 0.95, 0.2);
        this.field.react(plat);
        this.field.strikeLightning(plat);
        break;
      default: // облака
        this.player.bounce(P.bounceVy);
        this.field.react(plat);
    }
  }

  spawnLyrics(cam) {
    const bound = cam.scrollY - CONF.spawn.ahead;
    while (this.lyricIdx < this.lyricMarkers.length &&
           this.lyricMarkers[this.lyricIdx].y >= bound) {
      const mk = this.lyricMarkers[this.lyricIdx++];
      this.add.text(CONF.width / 2, mk.y, mk.text, {
        fontFamily: 'Nunito, sans-serif', fontStyle: 'italic',
        fontSize: '15px', color: CONF.colors.text, align: 'center',
        wordWrap: { width: 330 },
      }).setOrigin(0.5).setDepth(2).setAlpha(0.55).setResolution(this.dpr());
      // тексты позади нас чистит сборщик вместе с камерой — их мало, не пулим
    }
  }

  // Флажок вехи у края: пролетаешь мимо него физически
  spawnFlags(cam) {
    const bound = cam.scrollY - CONF.spawn.ahead;
    while (this.flagIdx < this.flagMarkers.length &&
           this.flagMarkers[this.flagIdx].y >= bound) {
      const mk = this.flagMarkers[this.flagIdx++];
      const x = mk.left ? 22 : CONF.width - 22;
      this.add.image(x, mk.y - 16, 'flag').setDepth(2).setFlipX(!mk.left).setAlpha(0.95);
      this.add.text(mk.left ? 38 : CONF.width - 38, mk.y - 12, `${mk.m.m} м`, {
        fontFamily: 'Unbounded, sans-serif', fontSize: '12px', fontStyle: '700',
        color: CONF.colors.gold, stroke: '#3a0d18', strokeThickness: 4,
      }).setOrigin(mk.left ? 0 : 1, 0.5).setDepth(2).setAlpha(0.9).setResolution(this.dpr());
    }
  }

  /** Серый офис вокруг старта: стены, пол, реквизит и потолок на слом. */
  buildOffice() {
    const W = CONF.width;
    this.add.rectangle(W / 2, -104, W, 296, 0x44444e).setDepth(-3);   // стены
    this.add.rectangle(W / 2, 46, W, 90, 0x35353d).setDepth(-2.95);   // пол
    this.add.rectangle(W / 2, 2, W, 4, 0x2e2e36).setDepth(-2.9);      // плинтус

    const props = this.add.graphics().setDepth(-2.9);
    // часы — вечные 10:10
    props.fillStyle(0xd8d4dc); props.fillCircle(70, -180, 16);
    props.lineStyle(2, 0x44444e);
    props.beginPath(); props.moveTo(70, -180); props.lineTo(63, -187); props.strokePath();
    props.beginPath(); props.moveTo(70, -180); props.lineTo(77, -187); props.strokePath();
    // доска, обклеенная стикерами-тасками
    props.fillStyle(0x55505c); props.fillRoundedRect(310, -205, 110, 74, 4);
    props.fillStyle(0xffd94b);
    [[320, -196], [352, -198], [384, -194], [322, -168], [356, -170], [388, -166]]
      .forEach(([x, y]) => props.fillRect(x, y, 22, 18));
    // тумба с монитором: таски и там
    props.fillStyle(0x3a3a42); props.fillRect(380, -34, 70, 44);
    props.fillStyle(0x22222a); props.fillRoundedRect(388, -74, 54, 38, 4);
    props.fillStyle(0x3a5a8c); props.fillRoundedRect(392, -70, 46, 30, 2);
    props.fillStyle(0x8ab0d8);
    props.fillRect(396, -66, 30, 3); props.fillRect(396, -58, 38, 3); props.fillRect(396, -50, 24, 3);
    // кактус — единственное живое
    props.fillStyle(0xb05a3a); props.fillRect(52, -6, 26, 16);
    props.fillStyle(0x4a7a3a); props.fillEllipse(65, -18, 14, 26); props.fillEllipse(56, -20, 8, 12);

    // потолок из плит — их и будем ломать
    this.officeCeilingY = -252;
    this.ceilingBroken = false;
    this.ceilingPieces = [];
    let cx = 0;
    while (cx < W) {
      const w = Math.min(Phaser.Math.Between(52, 88), W - cx);
      this.ceilingPieces.push(
        this.add.rectangle(cx + w / 2, this.officeCeilingY, w - 3, 24, 0x3a3a42).setDepth(-2.8),
      );
      cx += w;
    }
  }

  /** Первый рывок вверх: плиты разлетаются, в пролом бьёт тёплый свет. */
  breakCeiling() {
    this.ceilingBroken = true;
    for (const p of this.ceilingPieces) {
      this.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-140, 140),
        y: p.y - Phaser.Math.Between(80, 260),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(600, 1000),
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
    // тёплый свет из пролома
    const light = this.add.image(this.player.x, this.officeCeilingY, 'glowball')
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb322)
      .setScale(3).setAlpha(0.9).setDepth(-2.7);
    this.tweens.add({
      targets: light, scale: 6.5, alpha: 0, duration: 900,
      onComplete: () => light.destroy(),
    });
    // пыль
    for (let i = 0; i < 12; i++) {
      const d = this.add.image(
        Phaser.Math.Between(20, CONF.width - 20), this.officeCeilingY, 'dot',
      ).setDepth(-2.7).setTint(0x9a9aa8).setScale(Phaser.Math.FloatBetween(1.2, 2.4));
      this.tweens.add({
        targets: d,
        y: d.y + Phaser.Math.Between(30, 120),
        alpha: 0,
        duration: Phaser.Math.Between(500, 900),
        onComplete: () => d.destroy(),
      });
    }
    this.cameras.main.shake(130, 0.004);
    this.field.shout({ x: this.player.x, y: this.officeCeilingY + 34 }, 'К чёрту потолок!');
  }

  /** Прыжок на блок «?»: герой становится ГРИБКОМ до конца забега. */
  becomeShroom() {
    if (this.isShroom) return;
    this.isShroom = true;
    // мир наводняется марио — уже бесполезными — на ближайшие 1500 м
    this.field.marioFeverUntilM = this.maxM + CONF.mario.feverLengthM;
    this.player.sprite.setTexture('shroom');
    this.field.shout({ x: this.player.x, y: this.player.y - 26 }, 'ГРИБОК!');
    // разноцветные споры превращения
    for (let i = 0; i < 12; i++) {
      const d = this.add.image(this.player.x, this.player.y, 'dot').setDepth(11)
        .setTint(Phaser.Utils.Array.GetRandom([0xd42222, 0xffffff, 0xffd93b, 0xffb8dd]))
        .setScale(Phaser.Math.FloatBetween(1.2, 2.4));
      const a = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: d,
        x: d.x + Math.cos(a) * Phaser.Math.Between(40, 90),
        y: d.y + Math.sin(a) * Phaser.Math.Between(40, 90),
        alpha: 0,
        duration: Phaser.Math.Between(400, 700),
        ease: 'Cubic.easeOut',
        onComplete: () => d.destroy(),
      });
    }
  }

  // ─── Реактивный ранец ────────────────────────────────────────────────────

  /** Спавн подбираемых ранцев по высоте + проверка подбора + чистка. */
  updateJetPickups(cam) {
    if (this.maxM >= this.nextJetM) {
      this.nextJetM = this.maxM +
        Phaser.Math.Between(CONF.jet.intervalM[0], CONF.jet.intervalM[1]);
      const s = this.add.image(
        Phaser.Math.Between(60, CONF.width - 60),
        cam.scrollY - Phaser.Math.Between(200, 500),
        'jetpack',
      ).setDepth(4).setScale(0.9);
      this.tweens.add({ // парит и манит
        targets: s, y: s.y - 10, angle: 4,
        yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut',
      });
      this.jets.push(s);
    }
    for (let i = this.jets.length - 1; i >= 0; i--) {
      const s = this.jets[i];
      if (Math.abs(this.player.x - s.x) < 44 && Math.abs(this.player.y - s.y) < 48) {
        this.tweens.killTweensOf(s);
        s.destroy();
        this.jets.splice(i, 1);
        this.startJet();
      } else if (s.y > cam.scrollY + CONF.height + 300) {
        this.tweens.killTweensOf(s);
        s.destroy();
        this.jets.splice(i, 1);
      }
    }
  }

  /** Чит-код: положить ранец на видимое облачко над игроком. */
  spawnJetOnCloud() {
    const cam = this.cameras.main;
    const clouds = this.field.active.filter(p =>
      p.type === 'cloud' && !p.dead &&
      p.y > cam.scrollY + 80 && p.y < this.player.y - 40);
    const plat = clouds.length ? Phaser.Utils.Array.GetRandom(clouds) : null;
    const x = plat ? plat.x : Phaser.Math.Between(60, CONF.width - 60);
    const y = plat ? plat.y - plat.h / 2 - 26 : cam.scrollY + 160;
    const s = this.add.image(x, y, 'jetpack').setDepth(4).setScale(0.9);
    this.tweens.add({
      targets: s, y: y - 10, angle: 4,
      yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut',
    });
    this.jets.push(s);
  }

  /** Взлёт: ранец на спине, тёплый огонь из сопел. */
  startJet() {
    if (this.state !== 'run') return;
    this.jetTime = CONF.jet.duration;
    if (!this.jetSprite) {
      this.jetSprite = this.add.image(this.player.x, this.player.y + 14, 'jetpack')
        .setDepth(9.6).setScale(0.8);
      // живой свет, вырывающийся из сопел
      this.jetGlow = this.add.image(this.player.x, this.player.y + 46, 'glowball')
        .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa322)
        .setDepth(9.4).setScale(1.8);
      this.field.shout({ x: this.player.x, y: this.player.y - 20 }, 'ВЖ-Ж-Ж!');
    }
  }

  updateJet(dt) {
    this.jetTime -= dt;
    this.player.vy = -CONF.jet.speed;
    this.jetSprite.setPosition(this.player.x, this.player.y + 14);

    // свет полыхает и дрожит
    this.jetGlow.setPosition(this.player.x, this.player.y + 48)
      .setAlpha(0.55 + Math.random() * 0.35)
      .setScale(1.6 + Math.random() * 0.7);

    // рвущееся пламя из двух сопел: аддитивное, с бело-жарким ядром
    this.flameAcc += dt;
    const step = LOW_GFX ? 0.04 : 0.022;
    while (this.flameAcc >= step) {
      this.flameAcc -= step;
      const hot = Math.random() < 0.3; // жаркое ядро — почти белое
      const nozzleX = this.player.x + (Math.random() < 0.5 ? -9 : 9);
      const f = this.add.image(nozzleX, this.player.y + 38, 'dot')
        .setDepth(9.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(hot
          ? 0xfff2b0
          : Phaser.Utils.Array.GetRandom([0xffd93b, 0xffb322, 0xff7d1e, 0xff4d1c]))
        .setScale(hot
          ? Phaser.Math.FloatBetween(1.8, 2.6)
          : Phaser.Math.FloatBetween(2.6, 4.4));
      this.tweens.add({
        targets: f,
        y: f.y + Phaser.Math.Between(55, 115),
        x: f.x + Phaser.Math.Between(-14, 14),
        alpha: 0,
        scale: 0.4,
        duration: Phaser.Math.Between(300, 520),
        ease: 'Cubic.easeOut',
        onComplete: () => f.destroy(),
      });
    }

    if (this.jetTime <= 0) this.endJet();
  }

  endJet() {
    this.jetTime = 0;
    this.player.vy = -260; // мягкая передача в обычную физику
    if (this.jetGlow) {
      const glow = this.jetGlow;
      this.jetGlow = null;
      this.tweens.add({
        targets: glow, alpha: 0, scale: 0.4, duration: 300,
        onComplete: () => glow.destroy(),
      });
    }
    if (this.jetSprite) {
      const s = this.jetSprite;
      this.jetSprite = null;
      this.tweens.add({ // отработавший ранец отваливается
        targets: s, y: s.y + 90, angle: 140, alpha: 0,
        duration: 700, ease: 'Cubic.easeIn',
        onComplete: () => s.destroy(),
      });
    }
  }

  checkMilestones() {
    while (this.milestoneIdx < MILESTONES.length &&
           this.maxM >= MILESTONES[this.milestoneIdx].m) {
      const milestone = MILESTONES[this.milestoneIdx];
      this.game.events.emit('scg-milestone', milestone);
      if(milestone.sound) {
        this.sound.play(milestone.sound);
      }
      this.milestoneIdx++;
    }
  }

  /** Съеден хищником: выпад, очки утягиваются в пасть, затем экран смерти. */
  eaten(plat) {
    if (this.state !== 'run') return;
    this.state = 'eaten'; // физика и управление замирают
    this.deathCause = plat.type;
    const cry = plat.type === 'snake' ? 'Ш-ШШ!' : 'АМ!';
    const tint = plat.type === 'snake' ? 0xa04ab0 : 0x55a03c;
    this.field.lunge(plat, this.player.x, cry, tint);
    const mouth = plat.deco || plat.sprite;
    this.tweens.add({
      targets: this.player.sprite,
      x: mouth.x,
      y: mouth.y - 4,
      scale: 0,
      angle: 220,
      duration: 420,
      ease: 'Cubic.easeIn',
    });
    this.time.delayedCall(800, () => this.die());
  }

  die() {
    this.state = 'over';
    const isNew = this.maxM > this.startBest;
    const best = Math.max(this.startBest, this.maxM);
    if (isNew) this.saveBest(best);
    const cause = this.deathCause || (this.suitcaseBlame ? 'suitcase' : 'fall');
    this.game.events.emit('scg-death', { height: this.maxM, best, isNew, cause });
  }

  dpr() { return Math.min(window.devicePixelRatio || 1, 2); }
}
