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
    this.field.onLightning = (pts) => this.boltHits(pts);
    this.player = new Player(this, CONF.player.startX, CONF.player.startY);

    // декор мира (строчки, флажки, черепки): копится за спиной — чистим пачкой
    this.worldDecor = [];
    this.decorSweepAt = 0;

    this.deaths = this.loadDeaths();
    this.buildDeathMarks();
    this.buildRecordLine();
    this.buildLyricMarkers();
    this.milestoneIdx = 0;

    // флажки вех в мире: чередуем стороны
    this.flagMarkers = MILESTONES.map((m, i) => ({
      y: -m.m * CONF.pxPerM, m, left: i % 2 === 0,
    }));
    this.flagIdx = 0;

    this.isShroom = false; // ГРИБОК после блока «?»
    this.shroomLockUntilM = 0; // до этой высоты — «остывание» после лихорадки
    this.idleT = 0; // секретная концовка: простой без прорыва потолка
    this.idleFading = false;
    this.buildOffice();    // серое утро, из которого мы сбежим

    // дождевой пояс: случайное начало, километр ливня и грозовых туч
    const rainFrom = Phaser.Math.Between(CONF.rain.minStartM, CONF.rain.maxStartM);
    this.rainBand = { from: rainFrom, to: rainFrom + CONF.rain.lengthM };
    this.field.rainBand = this.rainBand;
    this.bg.rainBand = this.rainBand;

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

    // мыльные пузыри
    this.bubbles = [];
    this.nextBubbleM = CONF.bubble.fromM;
    this.bubbleTime = 0;
    this.bubbleSprite = null;

    // управление
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D');
    this.input.on('pointerdown', () => {
      this.startRun();
      if (this.bubbleTime > 0) this.popBubble(); // свежий тап лопает пузырь
    });
    // чит-коды: набери fire — светлячки, plane — самолёт,
    // height1..height9 — телепорт на N километров
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
        else if (this.cheatBuf.endsWith('croco')) {
          const cam = this.cameras.main;
          this.field.place('croc',
            Phaser.Math.Between(70, CONF.width - 70), cam.scrollY + 200);
          this.cheatBuf = '';
        }
        else if (this.cheatBuf.endsWith('jet')) { this.spawnJetOnCloud(); this.cheatBuf = ''; }
        else if (this.cheatBuf.endsWith('rain')) {
          // ливень прямо здесь и на километр вверх
          const curM = Math.max(0, Math.round(-this.player.y / CONF.pxPerM));
          this.rainBand.from = Math.max(0, curM - CONF.rain.edgeM);
          this.rainBand.to = curM + CONF.rain.lengthM;
          this.cheatBuf = '';
        }
        else if (this.cheatBuf.endsWith('bubble')) {
          this.spawnBubble(this.cameras.main.scrollY + 200);
          this.cheatBuf = '';
        }
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
        else {
          const hm = this.cheatBuf.match(/height([1-9])$/);
          if (hm) { this.teleportToHeight(parseInt(hm[1], 10) * 1000); this.cheatBuf = ''; }
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

  loadDeaths() {
    try {
      const v = JSON.parse(localStorage.getItem(CONF.storage.deaths));
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  saveDeath(m) {
    this.deaths.push(m);
    if (this.deaths.length > 60) this.deaths = this.deaths.slice(-60);
    try { localStorage.setItem(CONF.storage.deaths, JSON.stringify(this.deaths)); }
    catch (e) { /* приватный режим */ }
  }

  // Черепки у левого края на высотах прошлых смертей: гиблые места видно сразу.
  // Смерти группируются по ~10 м — вместо кучи меток один черепок со счётом
  buildDeathMarks() {
    const groups = new Map();
    for (const m of this.deaths) {
      if (m < 10) continue; // офисную возню не отмечаем
      const key = Math.round(m / 10) * 10;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    for (const [m, n] of groups) {
      this.worldDecor.push(this.add.text(6, -m * CONF.pxPerM, n > 1 ? `💀×${n}` : '💀', {
        fontFamily: 'Nunito, sans-serif', fontSize: '15px', fontStyle: '700',
        color: '#ff5040', stroke: '#2a0d3e', strokeThickness: 3,
      }).setOrigin(0, 0.5).setDepth(2).setAlpha(0.9).setResolution(this.dpr()));
    }
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
    if (!window.__scgReady) return; // стартовый экран ещё не закрыт
    if (this.state !== 'ready') return;
    this.state = 'run';
    this.player.sprite.clearTint().setAlpha(1); // если успел подрастаять в серости
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
    this.bg.update(curM, this.maxM, this.player, dt);

    // секретная концовка: 5 сек простоя без прорыва потолка — комната гаснет
    // в почти чёрную серость, и сам игрок постепенно растворяется в ней
    // (setTint, а не setTintFill — иначе цвет прыгает в сплошной силуэт разом);
    // ещё 5 сек — смерть
    if (this.state === 'ready' && !this.ceilingBroken) {
      this.idleT += dt;
      const k = this.idleT > 5 ? Math.min(1, (this.idleT - 5) / 5) : 0;
      this.idleOverlay.setAlpha(k * 0.97);
      if (k > 0) {
        this.idleFading = true;
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          { r: 255, g: 255, b: 255 }, { r: 20, g: 20, b: 24 }, 100, k * 100,
        );
        this.player.sprite.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
        this.player.sprite.setAlpha(1 - k * 0.97);
      }
      if (this.idleT >= 10) {
        this.deathCause = 'boredom';
        this.die();
        return;
      }
    } else if (this.idleFading) {
      // самовосстановление: ушли из простоя (начали забег/сломали потолок)
      // с недорастаявшим видом — гарантированно возвращаем обычный. Флаг,
      // а не общая проверка alpha/tint — иначе конфликт с другими анимациями
      // смерти (падение, поджарка), у которых свои тени/альфа
      this.idleFading = false;
      this.player.sprite.clearTint().setAlpha(1);
      this.idleOverlay.setAlpha(0);
    }
    if (this.state !== 'run') return;

    this.player.update(dt, this.inputDir());

    // первый рывок вверх проламывает офисный потолок
    if (!this.ceilingBroken && this.player.y < this.officeCeilingY + 10) this.breakCeiling();

    // реактивный ранец: взлёт мимо всех препятствий
    if (this.jetTime > 0) this.updateJet(dt);
    // пузырь: плавный подъём
    if (this.bubbleTime > 0) this.updateBubble(dt);

    // приземление (в ранце и пузыре коллизий нет)
    const plat = (this.jetTime > 0 || this.bubbleTime > 0)
      ? null : this.field.landing(this.player);
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
    this.updateBubblePickups(cam);

    // раз в секунду сносим декор, ушедший под нижнюю кромку
    if (time > this.decorSweepAt) {
      this.decorSweepAt = time + 1000;
      const decorLimit = cam.scrollY + CONF.height + 300;
      for (let i = this.worldDecor.length - 1; i >= 0; i--) {
        if (this.worldDecor[i].y > decorLimit) {
          this.worldDecor[i].destroy();
          this.worldDecor.splice(i, 1);
        }
      }
    }

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

    // грибная лихорадка кончилась — герой снова в очках, и на cooldownM
    // метров нельзя обратно (иначе отскок на залежавшийся марио — имба)
    if (this.isShroom && this.maxM >= this.field.marioFeverUntilM) {
      this.isShroom = false;
      this.player.sprite.setTexture('glasses');
      this.shroomLockUntilM = this.maxM + CONF.mario.cooldownM;
    }

    // падение
    if (this.player.y > cam.scrollY + CONF.height + CONF.camera.deathMargin) this.fallDeath();
  }

  /** Обычное падение мимо всех платформ: кувырок вниз и затемнение, потом экран смерти. */
  fallDeath() {
    if (this.state !== 'run') return;
    this.state = 'falling'; // физика и управление замирают
    const s = this.player.sprite;
    const spin = this.player.vx < 0 ? -1 : 1; // кувырок в сторону последнего движения
    this.field.shout({ x: this.player.x, y: this.player.y - 20 }, 'А-А-А!');
    this.tweens.add({
      targets: s,
      y: s.y + 320,
      x: s.x + spin * 60,
      angle: spin * 480,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeIn',
    });
    this.cameras.main.shake(160, 0.003);
    this.time.delayedCall(700, () => this.die());
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
        // свой разряд бьёт вниз и игрока не достаёт, а вот хищникам — достаётся
        this.boltHits(this.field.strikeLightning(plat));
        break;
      default: // облака
        this.player.bounce(P.bounceVy);
        this.field.react(plat);
    }
  }

  /** Чит: телепорт на заданную высоту (м) — догенерирует мир под ногами. */
  teleportToHeight(m) {
    const y = -m * CONF.pxPerM;
    this.player.sprite.setPosition(this.player.sprite.x, y);
    this.player.vy = 0;
    this.field.ensure(y - CONF.spawn.ahead);
  }

  spawnLyrics(cam) {
    const bound = cam.scrollY - CONF.spawn.ahead;
    while (this.lyricIdx < this.lyricMarkers.length &&
           this.lyricMarkers[this.lyricIdx].y >= bound) {
      const mk = this.lyricMarkers[this.lyricIdx++];
      this.worldDecor.push(this.add.text(CONF.width / 2, mk.y, mk.text, {
        fontFamily: 'Nunito, sans-serif', fontStyle: 'italic',
        fontSize: '15px', color: CONF.colors.text, align: 'center',
        wordWrap: { width: 330 },
      }).setOrigin(0.5).setDepth(2).setAlpha(0.55).setResolution(this.dpr()));
    }
  }

  // Флажок вехи у края: пролетаешь мимо него физически
  spawnFlags(cam) {
    const bound = cam.scrollY - CONF.spawn.ahead;
    while (this.flagIdx < this.flagMarkers.length &&
           this.flagMarkers[this.flagIdx].y >= bound) {
      const mk = this.flagMarkers[this.flagIdx++];
      const x = mk.left ? 22 : CONF.width - 22;
      this.worldDecor.push(
        this.add.image(x, mk.y - 16, 'flag').setDepth(2).setFlipX(!mk.left).setAlpha(0.95),
        this.add.text(mk.left ? 38 : CONF.width - 38, mk.y - 12, `${mk.m.m} м`, {
          fontFamily: 'Unbounded, sans-serif', fontSize: '12px', fontStyle: '700',
          color: CONF.colors.gold, stroke: '#3a0d18', strokeThickness: 4,
        }).setOrigin(mk.left ? 0 : 1, 0.5).setDepth(2).setAlpha(0.9).setResolution(this.dpr()),
      );
    }
  }

  /** Серый офис вокруг старта: стены, пол, реквизит и потолок на слом. */
  buildOffice() {
    const W = CONF.width;
    this.add.rectangle(W / 2, -104, W, 296, 0x44444e).setDepth(-3);   // стены
    this.add.rectangle(W / 2, 46, W, 90, 0x35353d).setDepth(-2.95);   // пол
    this.add.rectangle(W / 2, 2, W, 4, 0x2e2e36).setDepth(-2.9);      // плинтус

    const props = this.add.graphics().setDepth(-2.9);
    // часы — показывают настоящее время (обновляются раз в полминуты)
    this.clockGfx = this.add.graphics().setDepth(-2.88);
    this.drawClock();
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this.drawClock() });
    props.fillStyle(0xd8d4dc); props.fillCircle(70, -180, 16);
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

    // секретная концовка: если просидеть тут не начиная забег, комната гаснет
    // в почти чёрную серость (и герой вместе с ней) — alpha копится в update()
    this.idleOverlay = this.add.rectangle(W / 2, -104, W, 296, 0x151518)
      .setDepth(-2.6).setAlpha(0);
  }

  /** Стрелки офисных часов — по настоящему времени. */
  drawClock() {
    const cx = 70, cy = -180;
    const now = new Date();
    const mA = (now.getMinutes() / 60) * Math.PI * 2;
    const hA = (((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2;
    const g = this.clockGfx;
    g.clear();
    g.lineStyle(2, 0x44444e);
    g.beginPath(); g.moveTo(cx, cy); // минутная
    g.lineTo(cx + Math.sin(mA) * 12, cy - Math.cos(mA) * 12); g.strokePath();
    g.lineStyle(3, 0x44444e);
    g.beginPath(); g.moveTo(cx, cy); // часовая
    g.lineTo(cx + Math.sin(hA) * 8, cy - Math.cos(hA) * 8); g.strokePath();
    g.fillStyle(0x44444e); g.fillCircle(cx, cy, 2);
  }

  /** Первый рывок вверх: плиты разлетаются, в пролом бьёт тёплый свет. */
  breakCeiling() {
    this.ceilingBroken = true;
    this.tweens.add({ targets: this.idleOverlay, alpha: 0, duration: 400 });
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

  /** Прыжок на блок «?»: герой становится ГРИБКОМ на CONF.mario.feverLengthM метров. */
  becomeShroom() {
    if (this.isShroom) return; // пока грибок — повторные блоки «?» лихорадку не продлевают
    if (this.maxM < this.shroomLockUntilM) return; // остывание — залежавшийся марио не считается
    this.isShroom = true;
    // мир наводняется марио — уже бесполезными — на те же feverLengthM метров
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

  // ─── Мыльный пузырь ──────────────────────────────────────────────────────

  /** Спавн парящих пузырей по высоте + вход игрока + чистка. */
  updateBubblePickups(cam) {
    if (this.maxM >= this.nextBubbleM) {
      this.nextBubbleM = this.maxM +
        Phaser.Math.Between(CONF.bubble.intervalM[0], CONF.bubble.intervalM[1]);
      this.spawnBubble(cam.scrollY - Phaser.Math.Between(200, 500));
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const s = this.bubbles[i];
      const inReach = Math.abs(this.player.x - s.x) < 48 &&
                      Math.abs(this.player.y - s.y) < 48;
      if (inReach && this.jetTime <= 0 && this.bubbleTime <= 0) {
        this.tweens.killTweensOf(s);
        s.destroy();
        this.bubbles.splice(i, 1);
        this.enterBubble();
      } else if (s.y > cam.scrollY + CONF.height + 300) {
        this.tweens.killTweensOf(s);
        s.destroy();
        this.bubbles.splice(i, 1);
      }
    }
  }

  spawnBubble(y) {
    const s = this.add.image(
      Phaser.Math.Between(70, CONF.width - 70), y, 'bubble',
    ).setDepth(4).setAlpha(0.9);
    this.tweens.add({ // парит и переливается
      targets: s, y: y - 14, x: s.x + Phaser.Math.Between(-18, 18),
      yoyo: true, repeat: -1, duration: Phaser.Math.Between(1600, 2400),
      ease: 'Sine.easeInOut',
    });
    this.bubbles.push(s);
  }

  /** Игрок в пузыре: плавно вверх, коллизий нет. */
  enterBubble() {
    this.bubbleTime = CONF.bubble.duration;
    this.bubbleSprite = this.add.image(this.player.x, this.player.y, 'bubble')
      .setDepth(11).setScale(0.2).setAlpha(0.95);
    this.tweens.add({ targets: this.bubbleSprite, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  updateBubble(dt) {
    this.bubbleTime -= dt;
    this.player.vy = -CONF.bubble.speed;
    // плёнка дышит
    const w = Math.sin(this.bubbleTime * 9) * 0.045;
    this.bubbleSprite.setPosition(this.player.x, this.player.y)
      .setScale(1 + w, 1 - w);
    if (this.bubbleTime <= 0) this.popBubble();
  }

  /** ПЫК! Разлёт капель, лёгкий остаточный подъём. */
  popBubble() {
    if (!this.bubbleSprite) return;
    this.bubbleTime = 0;
    this.field.shout({ x: this.player.x, y: this.player.y - 40 }, 'ПЫК!');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const d = this.add.image(this.player.x, this.player.y, 'dot').setDepth(11)
        .setTint(Phaser.Utils.Array.GetRandom([0xffffff, 0xcfe8ff, 0xffb8dd, 0xa8e8ff]))
        .setScale(Phaser.Math.FloatBetween(1, 1.8));
      this.tweens.add({
        targets: d,
        x: d.x + Math.cos(a) * Phaser.Math.Between(40, 70),
        y: d.y + Math.sin(a) * Phaser.Math.Between(40, 70),
        alpha: 0,
        duration: Phaser.Math.Between(300, 520),
        ease: 'Cubic.easeOut',
        onComplete: () => d.destroy(),
      });
    }
    this.bubbleSprite.destroy();
    this.bubbleSprite = null;
    this.player.vy = -380; // мягкий толчок, чтобы не рухнуть камнем
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
    if (this.bubbleTime > 0) this.popBubble(); // ракета рвёт пузырь
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

  // ─── Молния ──────────────────────────────────────────────────────────────

  /** Разряд прошёл по ломаной pts: жарим всех, кто на пути. */
  boltHits(pts) {
    for (const p of this.field.active) {
      if ((p.type === 'croc' || p.type === 'snake') && !p.dead && p.deco &&
          this.nearBolt(pts, p.deco.x, p.deco.y, 32)) {
        this.field.fryEnemy(p);
      }
    }
    if (this.state !== 'run' || this.jetTime > 0) return; // на ранце — мимо
    if (!this.nearBolt(pts, this.player.x, this.player.y, CONF.lightning.hitR)) return;
    if (this.bubbleTime > 0) { this.popBubble(); return; } // пузырь принял удар
    this.electrocuted();
  }

  /** Точка ближе r к какому-нибудь сегменту ломаной? */
  nearBolt(pts, x, y, r) {
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1].x, ay = pts[i - 1].y;
      const dx = pts[i].x - ax, dy = pts[i].y - ay;
      const t = Phaser.Math.Clamp(
        ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const px = ax + dx * t - x, py = ay + dy * t - y;
      if (px * px + py * py < r * r) return true;
    }
    return false;
  }

  /** Зашибло молнией: судорога, чернеем и падаем угольком. */
  electrocuted() {
    this.state = 'zapped'; // физика и управление замирают
    this.deathCause = 'lightning';
    const s = this.player.sprite;
    s.setTintFill(0x2a2126);
    this.field.shout({ x: this.player.x, y: this.player.y - 40 }, 'ЖАХ!');
    this.tweens.add({ // судорога
      targets: s, x: s.x + 5, duration: 40, yoyo: true, repeat: 6,
    });
    this.tweens.add({ // уголёк осыпается
      targets: s, y: s.y + 260, angle: 200, alpha: 0.15,
      delay: 340, duration: 600, ease: 'Cubic.easeIn',
    });
    this.time.delayedCall(1000, () => this.die());
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
    this.saveDeath(Math.max(0, Math.round(-this.player.y / CONF.pxPerM)));
    const isNew = this.maxM > this.startBest;
    const best = Math.max(this.startBest, this.maxM);
    if (isNew) this.saveBest(best);
    const cause = this.deathCause || (this.suitcaseBlame ? 'suitcase' : 'fall');
    this.game.events.emit('scg-death', { height: this.maxM, best, isNew, cause });
  }

  dpr() { return Math.min(window.devicePixelRatio || 1, 2); }
}
