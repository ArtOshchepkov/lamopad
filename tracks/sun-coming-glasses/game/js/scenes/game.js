// ─── Игровая сцена: мир, физика, камера, вехи ────────────────────────────────
import { CONF, MILESTONES, LYRICS, LYRIC_STEP_M, LYRIC_CLEAR_M } from '../config.js';
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

    // приземление
    const plat = this.field.landing(this.player);
    if (plat) this.onLand(plat);

    // камера тянется только вверх
    const target = this.player.y - CONF.height * CONF.camera.lookAhead;
    if (target < cam.scrollY) cam.scrollY = target;

    // генерация и чистка мира
    this.field.ensure(cam.scrollY - CONF.spawn.ahead);
    this.field.update(dt, cam.scrollY + CONF.height, this.player);
    this.spawnLyrics(cam);
    this.spawnFlags(cam);

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
    this.game.events.emit('scg-death', { height: this.maxM, best, isNew });
  }

  dpr() { return Math.min(window.devicePixelRatio || 1, 2); }
}
