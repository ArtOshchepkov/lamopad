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

    this.bg = new Background(this, LOW_GFX);
    this.field = new PlatformField(this);
    this.player = new Player(this, CONF.player.startX, CONF.player.startY);

    this.buildRecordLine();
    this.buildLyricMarkers();
    this.milestoneIdx = 0;

    // управление
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D');
    this.input.on('pointerdown', () => this.startRun());
    this.input.keyboard.on('keydown', () => this.startRun());

    // камера: старт так, чтобы нижняя платформа была у низа экрана
    this.cameras.main.setScroll(0, -(CONF.height - 150));

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
    this.bg.update(curM, this.maxM);
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
    this.field.update(dt, cam.scrollY + CONF.height);
    this.spawnLyrics(cam);

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
        this.puff(plat, 0xffd000);
        break;
      case 'llama':
        this.player.bounce(P.llamaVy, 0.42);
        this.shout(plat, 'Там хорошо!');
        this.puff(plat, 0xffb8dd);
        break;
      default:
        this.player.bounce(P.bounceVy);
    }
  }

  // Крик ламы: всплывающий текст в мире
  shout(plat, text) {
    const t = this.add.text(plat.x, plat.y - 34, text, {
      fontFamily: 'Unbounded, sans-serif', fontSize: '17px', fontStyle: '700',
      color: CONF.colors.gold, stroke: '#3a0d18', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(11).setResolution(this.dpr());
    this.tweens.add({
      targets: t, y: t.y - 70, alpha: 0, duration: 1100,
      ease: 'Cubic.easeOut', onComplete: () => t.destroy(),
    });
  }

  // Простенький всплеск частиц при сильном отскоке
  puff(plat, tint) {
    const n = LOW_GFX ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const d = this.add.image(plat.x, plat.y - 8, 'dot').setDepth(9)
        .setTint(tint).setScale(Phaser.Math.FloatBetween(1, 2.2));
      this.tweens.add({
        targets: d,
        x: d.x + Phaser.Math.Between(-46, 46),
        y: d.y - Phaser.Math.Between(14, 58),
        alpha: 0, duration: Phaser.Math.Between(320, 560),
        ease: 'Cubic.easeOut', onComplete: () => d.destroy(),
      });
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

  checkMilestones() {
    while (this.milestoneIdx < MILESTONES.length &&
           this.maxM >= MILESTONES[this.milestoneIdx].m) {
      this.game.events.emit('scg-milestone', MILESTONES[this.milestoneIdx]);
      this.milestoneIdx++;
    }
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
