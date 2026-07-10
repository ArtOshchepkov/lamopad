// ─── Игровая сцена: мир, физика, камера, вехи ────────────────────────────────
import { CONF, MILESTONES, LYRICS, LYRIC_STEP_M, LYRIC_CLEAR_M, GRUMBLE } from '../config.js';
import { Player } from '../objects/player.js';
import { PlatformField } from '../objects/platforms.js';
import { Background } from '../objects/background.js';
import { playRandom } from '../sound.js';
import { Debug } from '../debug.js';

const LOW_GFX = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    this.state = 'ready'; // ready → run → over
    this.maxM = 0;
    this.shownM = -1;
    this.startBest = this.loadBest();
    this.recordBeaten = false;

    // стартовый бонус-джетпак (молча): каждая every-я игра, или игра сразу
    // после нового рекорда выше recordMinM (флаг одноразовый, гасим сразу же)
    const games = this.loadGames() + 1;
    this.saveGames(games);
    const everyBonus = games % CONF.startBonus.every === 0;
    const recordBonus = this.loadRecordBonusPending();
    if (recordBonus) this.clearRecordBonusPending();
    this.startBonusJet = everyBonus || recordBonus;

    // секретный ?start=N — для тестирования: после нажатия «Погнали!»
    // сразу закидывает на высоту N метров (см. startRun())
    const startParam = parseInt(new URLSearchParams(window.location.search).get('start'), 10);
    this.debugStartM = Number.isFinite(startParam) && startParam > 0 ? startParam : null;

    // камера — до фона: параллакс-слои позиционируются от стартового скролла
    this.cameras.main.setScroll(0, -(CONF.height - 150));

    this.bg = new Background(this, LOW_GFX);
    this.field = new PlatformField(this);
    this.field.onLightning = (pts) => this.boltHits(pts);
    this.player = new Player(this, CONF.player.startX, CONF.player.startY);

    // декор мира (строчки, флажки, черепки): копится за спиной — чистим пачкой
    this.worldDecor = [];
    this.decorSweepAt = 0;

    // TEMP profiling (?debug=true) — худшие тайминги за последнюю секунду,
    // выводятся в Debug-оверлей (console недоступен на iPhone)
    this.perf = { ensure: 0, fieldUpdate: 0, landing: 0, onLand: 0, total: 0, spawned: 0 };
    this.perfReportAt = 0;

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

    // второй ливень — только визуал, над хищным гейтлетом 5200–5700.
    // Начинается на 100 м раньше самого гейтлета — дождь сгущается
    // заранее, как предвестник. Геймплейный вес гроз там уже задан в
    // zones/enemy — эту зону в "стену дождя" ensure() намеренно не
    // переводим, чтобы не сбить уже подобранный баланс croc/snake/storm/stormMove.
    // dimAlpha выше базового 0.34 — тут заметно темнее, чем в обычном ливне
    this.rainBand2 = { from: 5100, to: 5700, dimAlpha: 0.58 };
    this.bg.rainBand2 = this.rainBand2;

    // метель 7000–7500: направление решаем один раз на весь забег
    this.windDir = Math.random() < 0.5 ? -1 : 1;
    this.windAnnounced = false;
    this.bg.windDir = this.windDir;
    this.bg.windBand = { from: CONF.wind.fromM, to: CONF.wind.toM, edgeM: CONF.wind.edgeM };

    // волшебная аэротруба: разовое объявление + светлячковый поток +
    // несколько гарантированных джетов на выходе (см. updateJetPickups)
    this.aeroAnnounced = false;
    this.aeroGuaranteedJetsDone = new Set();
    this.bg.aeroBand = { from: CONF.aero.fromM, to: CONF.aero.toM, edgeM: CONF.aero.edgeM };
    // сглаженное кадрирование камеры — тянется к целевому lookAhead плавно,
    // а не скачком (см. update(): цель зависит от скорости в трубе)
    this.camLookAhead = CONF.camera.lookAhead;

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
    this.jetCoastTime = 0;
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
    // на тач-устройствах удержание пальца слева/справа = рулёжка (inputDir),
    // поэтому лопать пузырь должен именно КОРОТКИЙ тап ПО ПУЗЫРЮ, а не любой
    // pointerdown — иначе на мобиле пузырь рвётся от каждого нажатия для руления.
    // Время/координаты берём из нативных таймстемпов поинтера, а не time.now:
    // при просевших кадрах down и up могут попасть в один шаг игры
    this.input.on('pointerdown', () => this.startRun());
    this.input.on('pointerup', (p) => {
      const held = p.upTime - p.downTime;
      const dist = Phaser.Math.Distance.Between(p.downX, p.downY, p.x, p.y);
      if (this.bubbleTime > 0 && held < 220 && dist < 16 && this.tapHitsBubble(p)) {
        this.popBubble();
      }
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
        else if (this.cheatBuf.endsWith('height0')) {
          this.teleportToHeight(10000); // «0» после 1..9 — десятка, не ноль
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

  loadGames() {
    try { return parseInt(localStorage.getItem(CONF.storage.games), 10) || 0; }
    catch (e) { return 0; }
  }

  saveGames(v) {
    try { localStorage.setItem(CONF.storage.games, String(v)); } catch (e) { /* приватный режим */ }
  }

  loadRecordBonusPending() {
    try { return localStorage.getItem(CONF.storage.recordBonus) === '1'; }
    catch (e) { return false; }
  }

  clearRecordBonusPending() {
    try { localStorage.removeItem(CONF.storage.recordBonus); } catch (e) { /* приватный режим */ }
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
    if (this.debugStartM) {
      this.teleportToHeight(this.debugStartM);
      this.debugStartM = null; // разово — дальше игра обычная
    }
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
    // TEMP profiling (?debug=true) — diagnosing a jank report, remove once fixed
    const __prof = Debug.enabled;
    const __t0 = __prof ? performance.now() : 0;
    const dt = Math.min(deltaMs / 1000, CONF.physics.maxDt);
    const cam = this.cameras.main;
    const curM = Math.max(0, Math.round(-this.player.y / CONF.pxPerM));
    this.bg.update(curM, this.maxM, this.player, dt);

    // ?debug=true — живые внутренности игры поверх экрана (см. debug.js)
    Debug.set('state', this.state);
    Debug.set('height', `${curM} м (макс ${this.maxM})`);
    Debug.set('platforms', this.field.active.length);
    Debug.set('vy/vx', `${Math.round(this.player.vy)} / ${Math.round(this.player.vx)}`);
    Debug.set('jet/coast/bubble', `${Math.round(this.jetTime * 100) / 100}/${Math.round(this.jetCoastTime * 100) / 100}/${Math.round(this.bubbleTime * 100) / 100}`);

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
        playRandom(this, 'dead_of_boring');
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

    // метель 7000–7500: постоянный боковой снос, направление на весь забег.
    // Сила плавно нарастает/спадает на краях (edgeM) — без рывка на входе
    const W = CONF.wind;
    const inWind = curM >= W.fromM && curM <= W.toM;
    const windK = inWind
      ? Phaser.Math.Clamp(Math.min(curM - W.fromM, W.toM - curM) / W.edgeM, 0, 1)
      : 0;
    const windVx = W.force * this.windDir * windK;
    if (inWind && !this.windAnnounced) {
      this.windAnnounced = true;
      this.field.shout({ x: this.player.x, y: this.player.y - 20 },
        this.windDir > 0 ? 'МЕТЕЛЬ →' : '← МЕТЕЛЬ');
    }
    // волшебная аэротруба: несёт вверх сама (см. player.js liftVy).
    // ВАЖНО: тяга включена/выключена жёстко по границам зоны, БЕЗ отдельного
    // затухания к краям — плавный лерп в player.js и так сглаживает переход
    // за счёт инерции. Раньше тут была ещё и растяжка цели к 0 у краёв —
    // это гасило вертикальную скорость игрока ДО фактического выхода из
    // трубы, и на выходе он повисал в невесомости вместо того, чтобы лететь
    // по инерции дальше (баг, пойман владельцем)
    const A = CONF.aero;
    const inAero = curM >= A.fromM && curM <= A.toM;
    // скорость трубы линейно растёт по всей её длине (медленнее на входе,
    // быстрее на выходе) — aeroT заодно двигает и кадрирование камеры ниже
    const aeroT = inAero ? Phaser.Math.Clamp((curM - A.fromM) / (A.toM - A.fromM), 0, 1) : 0;
    const liftVy = inAero ? Phaser.Math.Linear(A.liftVyStart, A.liftVyMax, aeroT) : 0;
    if (inAero && !this.aeroAnnounced) {
      this.aeroAnnounced = true;
      this.field.shout({ x: this.player.x, y: this.player.y - 20 }, 'АЭРОТРУБА!');
    }
    this.player.update(dt, this.inputDir(), windVx, liftVy);

    // первый рывок вверх проламывает офисный потолок
    if (!this.ceilingBroken && this.player.y < this.officeCeilingY + 10) this.breakCeiling();

    // реактивный ранец: взлёт мимо всех препятствий
    if (this.jetTime > 0) this.updateJet(dt);
    else if (this.jetCoastTime > 0) this.updateJetCoast(dt);
    // пузырь: плавный подъём
    if (this.bubbleTime > 0) this.updateBubble(dt);

    // приземление (в ранце и пузыре коллизий нет)
    const __tLand0 = __prof ? performance.now() : 0;
    const plat = (this.jetTime > 0 || this.bubbleTime > 0)
      ? null : this.field.landing(this.player);
    const __tLand1 = __prof ? performance.now() : 0;
    if (plat) this.onLand(plat);
    if (__prof) {
      this.perf.onLand = Math.max(this.perf.onLand, performance.now() - __tLand1);
      this.perf.landing = Math.max(this.perf.landing, __tLand1 - __tLand0);
    }

    this.checkCrocProximity(dt);
    // в аэротрубе vy почти всегда отрицательный (подъём) — landing() тут не
    // сработает, поэтому редких хищников ловим отдельной проверкой близости
    if (inAero) this.checkAeroDanger();

    // камера тянется только вверх. В аэротрубе кадрирование зависит от
    // скорости трубы: медленный вход — кадр отпущен ниже (игрок «опускается»
    // к нижней трети экрана), к максимальной скорости стягивается к обычному
    // lookAhead. Сглаживаем сам lookAhead лерпом — иначе смена цели скачком
    // дёргает камеру рывком вместо плавного хода
    const wantLookAhead = inAero
      ? Phaser.Math.Linear(A.lookAheadEntry, CONF.camera.lookAhead, aeroT)
      : CONF.camera.lookAhead;
    const lak = 1 - Math.exp(-2.2 * dt);
    this.camLookAhead += (wantLookAhead - this.camLookAhead) * lak;
    const target = this.player.y - CONF.height * this.camLookAhead;
    if (target < cam.scrollY) cam.scrollY = target;

    // генерация и чистка мира
    const __tEnsure0 = __prof ? performance.now() : 0;
    const __countBefore = __prof ? this.field.active.length : 0;
    this.field.ensure(cam.scrollY - CONF.spawn.ahead);
    const __tEnsure1 = __prof ? performance.now() : 0;
    this.field.update(dt, cam.scrollY + CONF.height, this.player);
    if (__prof) {
      this.perf.ensure = Math.max(this.perf.ensure, __tEnsure1 - __tEnsure0);
      this.perf.fieldUpdate = Math.max(this.perf.fieldUpdate, performance.now() - __tEnsure1);
      this.perf.spawned = Math.max(this.perf.spawned, this.field.active.length - __countBefore);
    }
    this.spawnLyrics(cam);
    this.spawnFlags(cam);
    this.updateJetPickups(cam);
    this.updateBubblePickups(cam);

    // раз в 500ms сносим декор, ушедший под нижнюю кромку
    if (time > this.decorSweepAt) {
      this.decorSweepAt = time + 500;
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
        playRandom(this, 'new_record');
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

    if (__prof) {
      this.perf.total = Math.max(this.perf.total, performance.now() - __t0);
      // раз в секунду сбрасываем в Debug-оверлей худшие тайминги и обнуляем
      if (time > this.perfReportAt) {
        this.perfReportAt = time + 1000;
        Debug.set('perf ensure/fieldUpd', `${this.perf.ensure.toFixed(1)}/${this.perf.fieldUpdate.toFixed(1)}ms (+${this.perf.spawned})`);
        Debug.set('perf landing/onLand', `${this.perf.landing.toFixed(1)}/${this.perf.onLand.toFixed(1)}ms`);
        Debug.set('perf TOTAL (max/1s)', `${this.perf.total.toFixed(1)}ms`);
        this.perf = { ensure: 0, fieldUpdate: 0, landing: 0, onLand: 0, total: 0, spawned: 0 };
      }
    }
  }

  /** Обычное падение мимо всех платформ: кувырок вниз и затемнение, потом экран смерти. */
  fallDeath() {
    if (this.state !== 'run') return;
    this.state = 'falling'; // физика и управление замирают
    playRandom(this, 'gamer_fall');
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
        playRandom(this, 'one_time_ticket_cloud_jump_on');
        this.field.breakSticker(plat);
        break;
      case 'backpack':
        this.player.bounce(P.springVy, 0.34);
        playRandom(this, 'jump_on_red_backpack_boost_cloud');
        this.field.react(plat);
        break;
      case 'llama':
        this.player.bounce(P.llamaVy, 0.42);
        playRandom(this, 'jump_on_llama');
        this.field.useLlama(plat);
        break;
      case 'sunset':
        this.player.bounce(P.bounceVy * 1.08, 0.2);
        playRandom(this, 'jump_on_cloud');
        this.field.react(plat);
        break;
      case 'bird':
        this.player.bounce(P.bounceVy * 1.15, 0.24);
        playRandom(this, 'seagul');
        this.field.react(plat);
        break;
      case 'suitcase':
        playRandom(this, 'jump_on_one_time_boring_suitcase');
        this.field.crumble(plat); // отскока нет — проваливаемся
        break;
      case 'croc':
      case 'snake':
        this.eaten(plat);
        break;
      case 'mario':
        this.player.bounce(P.springVy * 0.95, 0.3);
        playRandom(this, 'jump_on_mario');
        this.field.react(plat);
        this.becomeShroom();
        break;
      case 'storm':
      case 'stormMove':
        this.player.bounce(P.bounceVy * 0.95, 0.2);
        this.field.react(plat);
        // свой разряд бьёт вниз и игрока не достаёт, а вот хищникам — достаётся
        this.boltHits(this.field.strikeLightning(plat));
        break;
      default: // облака
        this.player.bounce(P.bounceVy);
        playRandom(this, 'jump_on_cloud');
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
    playRandom(this, 'ceil_crush');
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
    this.field.shout({ x: this.player.x, y: this.officeCeilingY + 34 }, 'Там хорошо!');

    // стартовый бонус-джетпак — молча кладём на ближайшее облачко за потолком
    if (this.startBonusJet) {
      this.startBonusJet = false;
      this.placeBonusJet();
    }
  }

  /** Кладёт подбираемый ранец на одно из ближайших облаков сразу за потолком. */
  placeBonusJet() {
    const near = this.field.active
      .filter(p => p.type === 'cloud' && !p.dead && p.y < this.officeCeilingY)
      .sort((a, b) => b.y - a.y)
      .slice(0, 2);
    const plat = near.length ? Phaser.Utils.Array.GetRandom(near) : null;
    const x = plat ? plat.x : CONF.width / 2;
    const y = plat ? plat.y - plat.h / 2 - 26 : this.officeCeilingY - 60;
    const s = this.add.image(x, y, 'jetpack').setDepth(4).setScale(0.9);
    this.tweens.add({
      targets: s, y: y - 10, angle: 4,
      yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut',
    });
    this.jets.push(s);
  }

  /** Прыжок на блок «?»: герой становится ГРИБКОМ на CONF.mario.feverLengthM метров. */
  becomeShroom() {
    if (this.isShroom) return; // пока грибок — повторные блоки «?» лихорадку не продлевают
    if (this.maxM < this.shroomLockUntilM) return; // остывание — залежавшийся марио не считается
    this.isShroom = true;
    // мир наводняется марио — уже бесполезными — на те же feverLengthM метров
    this.field.marioFeverUntilM = this.maxM + CONF.mario.feverLengthM;
    this.player.sprite.setTexture('shroom');
    this.field.shout({ x: this.player.x, y: this.player.y - 26 }, 'ТИПА ГРИБОК!');
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
    const band = CONF.bubble.denseBand;
    const inBand = band && this.maxM >= band.fromM && this.maxM <= band.toM;
    // если следующий пузырь был запланирован ещё по редкой лесенке (до входа
    // в плотную зону), его бросок мог перескочить всю зону целиком — режем
    // план, чтобы вход в зону не остался без единого пузыря
    if (inBand && this.nextBubbleM > this.maxM + band.intervalM[1]) {
      this.nextBubbleM = this.maxM;
    }
    if (this.maxM >= this.nextBubbleM) {
      const [lo, hi] = inBand ? band.intervalM : CONF.bubble.intervalM;
      this.nextBubbleM = this.maxM + Phaser.Math.Between(lo, hi);
      this.spawnBubble(cam.scrollY - Phaser.Math.Between(200, 500));
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const s = this.bubbles[i];
      const inReach = Math.abs(this.player.x - s.x) < 48 &&
                      Math.abs(this.player.y - s.y) < 48;
      if (inReach && this.jetTime <= 0) {
        this.tweens.killTweensOf(s);
        s.destroy();
        this.bubbles.splice(i, 1);
        if (this.bubbleTime > 0) this.extendBubble();
        else this.enterBubble();
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
    playRandom(this, 'bubble_enter');
    this.bubbleTime = CONF.bubble.duration;
    this.bubbleSprite = this.add.image(this.player.x, this.player.y, 'bubble')
      .setDepth(11).setScale(0.2).setAlpha(0.95);
    this.tweens.add({ targets: this.bubbleSprite, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  /** Подобрал ещё один пузырь, уже летя в предыдущем — освежает полёт
   *  (сброс на полную длительность, БЕЗ суммирования — иначе в плотной
   *  зоне пузыри копятся и полёт растягивается на неадекватно долго).
   *  Явно сообщаем об этом. */
  extendBubble() {
    playRandom(this, 'bubble_enter');
    this.bubbleTime = CONF.bubble.duration;
    this.field.shout({ x: this.player.x, y: this.player.y - 40 }, 'ДОЛЬШЕ!');
    this.tweens.add({
      targets: this.bubbleSprite, scaleX: 1.35, scaleY: 0.75,
      duration: 140, yoyo: true, ease: 'Quad.easeOut',
    });
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

  /** Тап попал по пузырю? Радиус текстуры 50px + запас под палец. */
  tapHitsBubble(p) {
    if (!this.bubbleSprite) return false;
    const cam = this.cameras.main;
    const wx = p.x + cam.scrollX;
    const wy = p.y + cam.scrollY;
    const r = 50 * this.bubbleSprite.scaleX + 20;
    return Phaser.Math.Distance.Between(wx, wy, this.bubbleSprite.x, this.bubbleSprite.y) <= r;
  }

  /** ПЫК! Разлёт капель, лёгкий остаточный подъём. */
  popBubble() {
    if (!this.bubbleSprite) return;
    playRandom(this, 'bubble_pop');
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
  /** X подальше от ближайшего по высоте хищника — для гарантированных джетов
   *  в аэротрубе: иначе рандомная X может воткнуть джет прямо за крокодилом. */
  pickSafeJetX(y) {
    let best = Phaser.Math.Between(60, CONF.width - 60);
    let bestD = -1;
    for (let i = 0; i < 8; i++) {
      const cx = Phaser.Math.Between(60, CONF.width - 60);
      let minD = Infinity;
      for (const p of this.field.active) {
        if ((p.type !== 'croc' && p.type !== 'snake') || p.dead) continue;
        if (Math.abs(p.y - y) > 300) continue; // хищники не рядом по высоте — не считаем
        minD = Math.min(minD, Math.abs(p.x - cx));
      }
      if (minD > bestD) { bestD = minD; best = cx; }
    }
    return best;
  }

  /** Спавн одного подбираемого ранца-джетпака в мире (без проверки зон). */
  spawnJetPickup(x, y) {
    const s = this.add.image(x, y, 'jetpack').setDepth(4).setScale(0.9);
    this.tweens.add({ // парит и манит
      targets: s, y: s.y - 10, angle: 4,
      yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut',
    });
    this.jets.push(s);
  }

  updateJetPickups(cam) {
    const noJet = CONF.jet.noJetBand;
    const A = CONF.aero;
    const esc = CONF.jet.aeroEscape;
    // последние marginM метров перед выходом из трубы — джетов НАОБОРОТ
    // дофига, чтобы был явный способ вылететь на скорости
    const nearAeroExit = this.maxM >= A.toM - esc.marginM && this.maxM <= A.toM;
    // в аэротрубе джетов вообще нет — кроме самого выхода (nearAeroExit) —
    // только пузыри спасают от хищников до этого момента
    const inNoJet = !nearAeroExit && (
      (noJet && this.maxM >= noJet.fromM && this.maxM <= noJet.toM) ||
      (this.maxM >= A.fromM && this.maxM <= A.toM)
    );
    // вход в плотное окно — если план спавна был по редкой лесенке (в трубе
    // джетов не было), не ждём его, а спавним сразу
    if (nearAeroExit && this.nextJetM > this.maxM + esc.intervalM[1]) {
      this.nextJetM = this.maxM;
    }
    if (this.maxM >= this.nextJetM) {
      const [lo, hi] = nearAeroExit ? esc.intervalM : CONF.jet.intervalM;
      this.nextJetM = this.maxM + Phaser.Math.Between(lo, hi);
      if (!inNoJet) {
        this.spawnJetPickup(
          Phaser.Math.Between(60, CONF.width - 60),
          cam.scrollY - Phaser.Math.Between(200, 500),
        );
      }
    }
    // несколько гарантированных джетов на конкретных отметках перед самым
    // выходом — не полагаемся только на рандом плотного окна, иначе можно
    // застрять на 11000 без единого джета под рукой
    for (const backM of esc.guaranteedAt) {
      const atM = A.toM - backM;
      if (!this.aeroGuaranteedJetsDone.has(backM) && this.maxM >= atM) {
        this.aeroGuaranteedJetsDone.add(backM);
        // запас по высоте побольше обычного — на скорости трубы 100-250px
        // хватало впритык, джет мог оказаться уже позади игрока к моменту
        // появления. X подальше от ближайшего хищника — не за крокодилом
        const y = cam.scrollY - Phaser.Math.Between(380, 560);
        this.spawnJetPickup(this.pickSafeJetX(y), y);
      }
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
    playRandom(this, 'jet');
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
    // тяга гаснет не мгновенно, а плавным выбегом — updateJetCoast()
    this.jetCoastTime = CONF.jet.coastTime;
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

  /** Плавный выбег скорости после отключения ранца (инерция вместо резкого обрыва тяги). */
  updateJetCoast(dt) {
    this.jetCoastTime -= dt;
    const k = 1 - Math.exp(-CONF.jet.coastLerp * dt);
    this.player.vy += (-CONF.jet.coastVy - this.player.vy) * k;
    if (this.jetCoastTime <= 0) this.jetCoastTime = 0;
  }

  checkMilestones() {
    while (this.milestoneIdx < MILESTONES.length &&
           this.maxM >= MILESTONES[this.milestoneIdx].m) {
      const milestone = MILESTONES[this.milestoneIdx];
      this.game.events.emit('scg-milestone', milestone);
      if (milestone.sound) playRandom(this, milestone.sound);
      this.milestoneIdx++;
    }
  }

  // ─── Молния ──────────────────────────────────────────────────────────────

  /** Разряд прошёл по ломаной pts: жарим всех, кто на пути. */
  boltHits(pts) {
    if (pts && pts.length) playRandom(this, 'any_lighting_strike');
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
    playRandom(this, 'death_light');
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

  /** "Фух, пронесло": звук при пролёте рядом с живым крокодилом мимо пасти. */
  checkCrocProximity(dt) {
    if (this.state !== 'run') return; // не звучит поверх момента самого укуса
    if (this.maxM < CONF.enemy.fromM) return; // крокодилов ещё физически нет — нечего искать
    this.crocCloseCd = Math.max(0, (this.crocCloseCd || 0) - dt);
    if (this.crocCloseCd > 0) return; // кулдаун — иначе спамит, пока герой скачет рядом
    const r2 = CONF.crocClose.r * CONF.crocClose.r;
    for (const p of this.field.active) {
      if (p.type !== 'croc' || p.dead) continue;
      const dx = this.player.x - p.x, dy = this.player.y - p.y;
      if (dx * dx + dy * dy < r2) { // квадрат расстояния — без sqrt
        playRandom(this, 'crocodile_was_close');
        this.crocCloseCd = CONF.crocClose.cooldown;
        break;
      }
    }
  }

  /** Аэротруба: хищника не «приземляют», а задевают на лету — смерть по близости. */
  checkAeroDanger() {
    if (this.jetTime > 0 || this.bubbleTime > 0) return; // ранец/пузырь — неприкосновенность, как везде
    const r2 = CONF.aero.hitR * CONF.aero.hitR;
    for (const p of this.field.active) {
      if ((p.type !== 'croc' && p.type !== 'snake') || p.dead) continue;
      const dx = this.player.x - p.x, dy = this.player.y - p.y;
      if (dx * dx + dy * dy < r2) { this.eaten(p); return; } // квадрат расстояния — без sqrt
    }
  }

  /** Съеден хищником: выпад, очки утягиваются в пасть, затем экран смерти. */
  eaten(plat) {
    if (this.state !== 'run') return;
    this.state = 'eaten'; // физика и управление замирают
    this.deathCause = plat.type;
    playRandom(this, plat.type === 'snake' ? 'snake_ate' : 'crocodile_ate');
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
    // новый рекорд выше recordMinM — следующая игра тоже получит стартовый ранец
    if (isNew && this.maxM > CONF.startBonus.recordMinM) {
      try { localStorage.setItem(CONF.storage.recordBonus, '1'); } catch (e) { /* приватный режим */ }
    }
    const cause = this.deathCause || (this.suitcaseBlame ? 'suitcase' : 'fall');
    this.game.events.emit('scg-death', { height: this.maxM, best, isNew, cause });
  }

  dpr() { return Math.min(window.devicePixelRatio || 1, 2); }
}
