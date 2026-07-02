// ─── Boot: шрифты + процедурные текстуры, затем запуск игры ──────────────────
import { CONF } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    this.loadSounds();
  }
  create() {
    this.makeTextures();
    const fonts = [
      "900 32px 'Unbounded'",
      "700 18px 'Unbounded'",
      "700 16px 'Nunito'",
      "italic 400 15px 'Nunito'",
    ];
    // Шрифты обязаны быть готовы до создания текстов; таймаут — чтобы не зависнуть без сети
    const load = Promise.all(fonts.map(f => document.fonts.load(f)));
    const timeout = new Promise(res => setTimeout(res, 2000));
    Promise.race([load, timeout]).then(() => {
      this.scene.start('game');
      this.scene.launch('ui');
      this.game.events.emit('scg-booted');
    });
  }

  /** Хелпер: нарисовать и запечь текстуру. */
  tex(key, w, h, paint) {
    const g = this.make.graphics({ add: false });
    paint(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  makeTextures() {
    // Очки-герой: красная оправа с тёмным кантом (контраст на любом небе)
    this.tex('glasses', CONF.player.texW, CONF.player.texH, (g) => {
      g.translateCanvas(3, 6); // запас под толстый кант: ничего не режется краями
      const DARK = 0x2a0616;
      // ножки: тёмный кант, потом красная линия
      const leg = (pts) => {
        for (const [w, col] of [[9, DARK], [5, 0xff2f23]]) {
          g.lineStyle(w, col);
          g.beginPath(); g.moveTo(pts[0], pts[1]); g.lineTo(pts[2], pts[3]); g.lineTo(pts[4], pts[5]); g.strokePath();
        }
      };
      leg([20, 30, 13, 43, 22, 56]);
      leg([46, 28, 53, 41, 43, 56]);
      // конверсы с кантом
      g.fillStyle(DARK); g.fillEllipse(21, 57, 17, 9); g.fillEllipse(44, 57, 17, 9);
      g.fillStyle(0xd41f1f); g.fillEllipse(21, 57, 13, 6); g.fillEllipse(44, 57, 13, 6);
      g.fillStyle(0xffffff); g.fillEllipse(19, 58.5, 8, 3); g.fillEllipse(42, 58.5, 8, 3);
      // переносица
      g.lineStyle(10, DARK);
      g.beginPath(); g.moveTo(26, 15); g.lineTo(38, 11); g.strokePath();
      g.lineStyle(6, 0xff2f23);
      g.beginPath(); g.moveTo(26, 15); g.lineTo(38, 11); g.strokePath();
      // линзы: тёмное кольцо-кант, красная оправа, тёмное стекло
      g.lineStyle(11, DARK); g.strokeCircle(18, 19, 12); g.strokeCircle(46, 15, 14);
      g.fillStyle(0x4a0f1d); g.lineStyle(6, 0xff2f23);
      g.fillCircle(18, 19, 12); g.strokeCircle(18, 19, 12);
      g.fillCircle(46, 15, 14); g.strokeCircle(46, 15, 14);
      // блики
      g.fillStyle(0xffffff, 0.95); g.fillEllipse(14, 15, 8, 5); g.fillEllipse(41, 10, 10, 6);
      // звезда на левой линзе с тёмным кантом
      g.lineStyle(4, DARK);
      g.beginPath();
      g.moveTo(6, 8); g.lineTo(9, 14); g.lineTo(15, 16); g.lineTo(10, 19); g.lineTo(8, 25);
      g.lineTo(4, 19); g.lineTo(-1, 16); g.lineTo(4, 14); g.closePath(); g.strokePath();
      g.fillStyle(0xffd000);
      g.beginPath();
      g.moveTo(6, 8); g.lineTo(9, 14); g.lineTo(15, 16); g.lineTo(10, 19); g.lineTo(8, 25);
      g.lineTo(4, 19); g.lineTo(-1, 16); g.lineTo(4, 14); g.closePath(); g.fillPath();
    });

    // Облака собираются из кругов разного размера: низ — бугристый,
    // разной глубины, чтобы силуэт был кучевым, а не ровным.

    // Облако А: классическое пухлое
    this.tex('p-cloud-a', 96, 36, (g) => {
      g.translateCanvas(0, 6); // запас сверху: макушки кругов не режутся
      g.fillStyle(0x2a0d3e, 0.35); g.fillEllipse(50, 27, 64, 6);   // мягкая тень
      g.fillStyle(0xcdb4e8);                                       // затенённые нижние бугры
      g.fillCircle(18, 19, 9); g.fillCircle(36, 19, 10);
      g.fillCircle(56, 20, 9); g.fillCircle(74, 18, 8); g.fillCircle(86, 16, 6);
      g.fillStyle(0xf6eeff);                                       // тело
      g.fillCircle(20, 12, 10); g.fillCircle(40, 10, 13);
      g.fillCircle(60, 10, 12); g.fillCircle(79, 12, 9); g.fillCircle(88, 14, 6);
      g.fillStyle(0xffffff, 0.95);                                 // солнечные блики сверху
      g.fillEllipse(44, 4, 20, 6); g.fillEllipse(66, 5, 14, 5); g.fillEllipse(22, 6, 12, 5);
    });

    // Облако Б: широкое, слоистое
    this.tex('p-cloud-b', 116, 32, (g) => {
      g.translateCanvas(0, 6);
      g.fillStyle(0x2a0d3e, 0.35); g.fillEllipse(58, 23, 82, 5);
      g.fillStyle(0xcdb4e8);
      g.fillCircle(16, 15, 8); g.fillCircle(34, 16, 9); g.fillCircle(54, 16, 9);
      g.fillCircle(74, 16, 8); g.fillCircle(94, 14, 7); g.fillCircle(105, 12, 5);
      g.fillStyle(0xf6eeff);
      g.fillCircle(18, 9, 9); g.fillCircle(36, 8, 11); g.fillCircle(58, 7, 11);
      g.fillCircle(78, 8, 9); g.fillCircle(96, 9, 7);
      g.fillStyle(0xffffff, 0.95);
      g.fillEllipse(44, 2.5, 18, 5); g.fillEllipse(72, 3, 16, 5);
    });

    // Облако В: маленькое кучевое, два горба
    this.tex('p-cloud-c', 72, 36, (g) => {
      g.translateCanvas(0, 6);
      g.fillStyle(0x2a0d3e, 0.35); g.fillEllipse(36, 27, 44, 5);
      g.fillStyle(0xcdb4e8);
      g.fillCircle(18, 19, 9); g.fillCircle(36, 20, 9); g.fillCircle(52, 18, 8);
      g.fillStyle(0xf6eeff);
      g.fillCircle(20, 11, 11); g.fillCircle(44, 10, 12); g.fillCircle(58, 14, 7);
      g.fillStyle(0xffffff, 0.95);
      g.fillEllipse(20, 4, 12, 5); g.fillEllipse(46, 3, 13, 5);
    });

    // Стесняшка-закатик: тёплое румяное облачко
    this.tex('p-sunset', 86, 38, (g) => {
      g.translateCanvas(0, 6);
      g.fillStyle(0x8f2a5e, 0.45); g.fillEllipse(44, 29, 56, 6);  // тень
      g.fillStyle(0xf7a06a);                                       // закатные нижние бугры
      g.fillCircle(18, 20, 9); g.fillCircle(36, 21, 10);
      g.fillCircle(56, 20, 9); g.fillCircle(70, 17, 7);
      g.fillStyle(0xffd0a8);                                       // тело
      g.fillCircle(20, 12, 10); g.fillCircle(40, 10, 12);
      g.fillCircle(58, 10, 10); g.fillCircle(71, 13, 7);
      g.fillStyle(0xfff0d8, 0.95);                                 // блик
      g.fillEllipse(46, 3, 18, 6);
      // смущённые щёчки и закрытые глазки
      g.fillStyle(0xff6f9c, 0.85);
      g.fillEllipse(30, 17, 9, 5); g.fillEllipse(54, 17, 9, 5);
      g.lineStyle(2, 0x8f2a5e);
      g.beginPath(); g.arc(36, 12, 4, 0.15 * Math.PI, 0.85 * Math.PI); g.strokePath();
      g.beginPath(); g.arc(48, 12, 4, 0.15 * Math.PI, 0.85 * Math.PI); g.strokePath();
    });

    // Чемодан: солидный, но ненадёжный
    this.tex('p-suitcase', 76, 34, (g) => {
      g.fillStyle(0x2a0d3e, 0.4); g.fillEllipse(38, 31, 66, 8);   // тень
      g.lineStyle(3, 0x4a2c14);
      g.strokeRoundedRect(28, 1, 20, 8, 3);                        // ручка
      g.fillStyle(0x8a5a34); g.fillRoundedRect(4, 6, 68, 24, 6);   // корпус
      g.fillStyle(0xa06a3e); g.fillRoundedRect(4, 6, 68, 10, { tl: 6, tr: 6, bl: 0, br: 0 }); // крышка
      g.fillStyle(0x5d3a1e);                                       // ремни
      g.fillRect(16, 6, 7, 24); g.fillRect(53, 6, 7, 24);
      g.lineStyle(2, 0x4a2c14); g.strokeRoundedRect(4, 6, 68, 24, 6);
      g.fillStyle(0xd8b060);                                       // уголки-заклёпки
      g.fillCircle(9, 11, 2); g.fillCircle(67, 11, 2); g.fillCircle(9, 26, 2); g.fillCircle(67, 26, 2);
    });

    // Пташка (касатик): летит боком, крыло вверх
    this.tex('p-bird', 58, 28, (g) => {
      g.fillStyle(0x2a0d3e, 0.3); g.fillEllipse(29, 25, 34, 6);   // тень
      g.fillStyle(0xfff6ec);                                       // тело
      g.fillEllipse(28, 16, 34, 15);
      g.fillTriangle(8, 14, 16, 10, 16, 20);                       // хвост
      g.fillStyle(0xffe9d2);                                       // крыло
      g.fillTriangle(24, 14, 40, 2, 38, 15);
      g.fillStyle(0xffb322);                                       // клюв
      g.fillTriangle(45, 13, 54, 16, 45, 19);
      g.fillStyle(0x3a0d18); g.fillCircle(40, 13, 1.8);            // глаз
      g.lineStyle(2, 0xcdb4e8);                                    // штрих пера
      g.beginPath(); g.moveTo(22, 18); g.lineTo(30, 19); g.strokePath();
    });

    // Стикер «нехай повисит»
    this.tex('p-sticker', 72, 30, (g) => {
      g.fillStyle(0x8f7a10, 0.5); g.fillRect(4, 6, 66, 24); // тень
      g.fillStyle(0xffd94b); g.fillRect(0, 0, 66, 26);
      g.fillStyle(0xe0b52e); g.fillTriangle(66, 26, 52, 26, 66, 13); // загнутый угол
      g.lineStyle(2, 0x8f7a10, 0.65);
      g.beginPath(); g.moveTo(8, 9); g.lineTo(52, 9); g.strokePath();
      g.beginPath(); g.moveTo(8, 16); g.lineTo(44, 16); g.strokePath();
    });

    // Рюкзак-батут
    this.tex('p-backpack', 66, 40, (g) => {
      g.fillStyle(0x5e0d12); g.fillRoundedRect(3, 6, 60, 32, 10);   // тень-контур
      g.fillStyle(0xd42222); g.fillRoundedRect(5, 4, 56, 32, 10);   // корпус
      g.fillStyle(0xff5040); g.fillRoundedRect(5, 4, 56, 14, { tl: 10, tr: 10, bl: 0, br: 0 }); // клапан
      g.fillStyle(0xffd000); g.fillRoundedRect(24, 20, 18, 13, 4);  // карман
      g.lineStyle(3, 0x5e0d12);
      g.strokeRoundedRect(5, 4, 56, 32, 10);
      g.beginPath(); g.moveTo(16, 4); g.lineTo(16, 36); g.strokePath(); // лямка
      g.beginPath(); g.moveTo(50, 4); g.lineTo(50, 36); g.strokePath();
    });

    // Лама (розовая, как на обложке)
    this.tex('p-llama', 80, 48, (g) => {
      g.fillStyle(0xffb8dd);
      g.fillRoundedRect(12, 18, 42, 18, 9);   // тело
      g.fillRoundedRect(48, 4, 10, 24, 5);    // шея
      g.fillEllipse(54, 5, 16, 10);           // голова
      g.fillTriangle(48, 0, 51, 6, 45, 6);    // ухо
      g.fillTriangle(59, 0, 62, 6, 56, 6);    // ухо
      g.fillRect(16, 34, 6, 12); g.fillRect(28, 34, 6, 12); // ноги
      g.fillRect(40, 34, 6, 12); g.fillRect(48, 32, 6, 13);
      g.fillEllipse(12, 20, 8, 8);            // хвостик
      g.fillStyle(0x8f2a5e);
      g.fillCircle(58, 4, 1.6);               // глаз
      g.fillStyle(0xffd000);                  // жёлтые пятнышки
      g.fillEllipse(24, 24, 6, 4); g.fillEllipse(40, 29, 5, 3);
    });

    // Сизифова гора: длинное прямое ребро слева — по нему идёт лама.
    // ВАЖНО: ребро (0,150)→(128,26) захардкожено в background.js (sisRidge)
    this.tex('mountain', 190, 150, (g) => {
      g.fillStyle(0x140a28);
      g.beginPath();
      g.moveTo(0, 150); g.lineTo(128, 26);           // ребро для ламы
      g.lineTo(146, 46); g.lineTo(164, 36);          // малый пик справа
      g.lineTo(190, 150); g.closePath(); g.fillPath();
      g.fillStyle(0x2a1a48); // снежная шапка чуть светлее
      g.fillTriangle(128, 26, 117, 47, 140, 47);
    });

    this.tex('boulder', 14, 14, (g) => {
      g.fillStyle(0xffffff); g.fillCircle(7, 7, 6.5);
    });

    this.tex('dot', 4, 4, (g) => {
      g.fillStyle(0xffffff); g.fillCircle(2, 2, 2);
    });

    // Крокодил (мордой влево), сидит на облаке
    this.tex('croc', 72, 32, (g) => {
      // хвост загнут вверх
      g.fillStyle(0x3e7d2a); g.fillTriangle(66, 22, 58, 12, 56, 24);
      // тело
      g.fillStyle(0x55a03c); g.fillEllipse(40, 22, 44, 14);
      // гребень на спине
      g.fillStyle(0x3e7d2a);
      g.fillTriangle(32, 16, 36, 10, 40, 16);
      g.fillTriangle(42, 16, 46, 10, 50, 16);
      // голова и морда
      g.fillStyle(0x55a03c);
      g.fillEllipse(18, 20, 26, 11); g.fillEllipse(8, 22, 16, 7);
      g.fillCircle(21, 14, 5); // надбровный бугор
      // пасть
      g.lineStyle(2, 0x2a5220);
      g.beginPath(); g.moveTo(1, 23); g.lineTo(20, 23); g.strokePath();
      // зубки
      g.fillStyle(0xffffff);
      g.fillTriangle(4, 23, 6, 20, 8, 23);
      g.fillTriangle(9, 23, 11, 20, 13, 23);
      g.fillTriangle(14, 23, 16, 20, 18, 23);
      // глазное яблоко (зрачок — отдельный спрайт, следит за игроком)
      g.fillStyle(0xffffff); g.fillCircle(21, 13, 3);
      // лапки
      g.fillStyle(0x3e7d2a); g.fillRect(28, 26, 6, 5); g.fillRect(46, 26, 6, 5);
    });

    // Змея (голова слева), свернулась кольцами на облаке
    this.tex('snake', 60, 34, (g) => {
      g.translateCanvas(4, 0); // запас слева под высунутый язык
      // кольца: широкое основание, уже кверху
      g.fillStyle(0x8e3aa0); g.fillEllipse(32, 26, 40, 13);
      g.fillStyle(0xa04ab0); g.fillEllipse(32, 19, 31, 10);
      g.fillStyle(0xb45ec4); g.fillEllipse(32, 13, 22, 8);
      // тёмные полоски на кольцах
      g.lineStyle(2, 0x5e2470);
      g.beginPath(); g.moveTo(16, 25); g.lineTo(48, 25); g.strokePath();
      g.beginPath(); g.moveTo(19, 18); g.lineTo(45, 18); g.strokePath();
      // шея тянется вверх-влево
      g.fillStyle(0xa04ab0);
      g.fillCircle(16, 14, 4); g.fillCircle(13, 10, 4);
      // голова
      g.fillEllipse(11, 7, 14, 8);
      // глазное яблоко (зрачок — отдельный следящий спрайт)
      g.fillStyle(0xffffff); g.fillCircle(9, 6, 2.6);
    });

    // Раздвоенный язык змеи: основание слева, остриё вправо (зеркалим scaleX)
    this.tex('tongue', 11, 8, (g) => {
      g.lineStyle(1.5, 0xff3b57);
      g.beginPath(); g.moveTo(0, 4); g.lineTo(7, 4); g.strokePath();
      g.beginPath(); g.moveTo(7, 4); g.lineTo(10, 2); g.strokePath();
      g.beginPath(); g.moveTo(7, 4); g.lineTo(10, 6); g.strokePath();
    });

    // Светлячок: почти пиксель
    this.tex('spark', 3, 3, (g) => {
      g.fillStyle(0xffffff); g.fillCircle(1.5, 1.5, 1.2);
    });

    // Пассажирский лайнер для фона (смотрит вправо): приглушённые цвета,
    // без жёстких контуров — далёкий силуэт, а не объект геймплея
    this.tex('plane', 76, 32, (g) => {
      // киль — стреловидный, приглушённо-красный
      g.fillStyle(0xb03448); g.fillTriangle(15, 14, 5, 3, 10, 15);
      // стабилизатор
      g.fillStyle(0xd0c0e0); g.fillTriangle(14, 15, 5, 11, 15, 17);
      // фюзеляж — длинный и узкий
      g.fillStyle(0xe6dcf2); g.fillEllipse(39, 15, 60, 9);
      // тень брюха
      g.fillStyle(0xbcaad4, 0.8); g.fillEllipse(39, 17.5, 56, 4);
      // кабина
      g.fillStyle(0x5a4a72); g.fillEllipse(63, 13.5, 7, 3);
      // крыло — стреловидное, крупное и читаемое, темнее фюзеляжа
      g.fillStyle(0xa88fc8); g.fillTriangle(45, 15, 17, 29, 50, 17);
      // двигатель под крылом
      g.fillStyle(0x9884b8); g.fillEllipse(32, 24, 12, 6);
      g.fillStyle(0x4a3a62); g.fillEllipse(26.5, 24, 2.5, 4);
    });

    this.tex('plane2', 82, 34, (g) => {
      // киль (белый)
      g.fillStyle(0xf3eefc);
      g.fillTriangle(18, 16, 7, 0, 14, 17);

      // цветная верхушка киля
      g.fillStyle(0xe06274);
      g.fillTriangle(15, 11, 9, 2, 13, 12);

      // хвостовой стабилизатор
      g.fillStyle(0xe2d8f2);
      g.fillTriangle(17, 17, 8, 12, 19, 19);

      // фюзеляж
      g.fillStyle(0xede5f8);
      g.fillEllipse(42, 16, 64, 10);

      // тень снизу
      g.fillStyle(0xb7a6cf, 0.75);
      g.fillEllipse(42, 18.5, 60, 4);

      // кабина
      g.fillStyle(0x5b4b74);
      g.fillEllipse(68, 14.5, 8, 3);

      // основное крыло
      g.fillStyle(0xa18ac3);
      g.fillTriangle(49, 16, 23, 31, 55, 18);

      // второй участок крыла
      g.fillTriangle(40, 16, 30, 11, 53, 17);

      // двигатели
      g.fillStyle(0x8c79af);
      g.fillEllipse(37, 25, 11, 5.5);
      g.fillEllipse(49, 22.5, 10, 5);

      // воздухозаборники
      g.fillStyle(0x49395f);
      g.fillEllipse(32, 25, 2.5, 3.8);
      g.fillEllipse(44, 22.5, 2.3, 3.5);
    });

    // Небольшая Cessna (смотрит вправо)
// Высокоплан с одним винтом и трёхопорным шасси.
    this.tex('cessna', 64, 36, (g) => {
      // киль
      g.fillStyle(0xf1eefb);
      g.fillTriangle(14, 17, 7, 5, 12, 18);

      // горизонтальный стабилизатор
      g.fillStyle(0xd9cdea);
      g.fillTriangle(14, 18, 6, 15, 15, 20);

      // фюзеляж
      g.fillStyle(0xe8e1f6);
      g.fillEllipse(33, 18, 34, 8);

      // нижняя тень
      g.fillStyle(0xb7a8cd, 0.75);
      g.fillEllipse(33, 20, 31, 3);

      // кабина
      g.fillStyle(0x5b4c73);
      g.fillEllipse(42, 16.5, 8, 4);

      // высокорасположенное крыло
      g.fillStyle(0xa890c7);
      g.fillTriangle(32, 13, 18, 7, 47, 15);
      g.fillTriangle(32, 13, 18, 19, 47, 15);

      // стойка крыла
      g.lineStyle(1.2, 0x8c79ad);
      g.beginPath();
      g.moveTo(28, 15);
      g.lineTo(24, 20);
      g.strokePath();

      // двигатель
      g.fillStyle(0x8e7ab0);
      g.fillEllipse(49, 18, 6, 6);

      // винт
      g.lineStyle(1.5, 0xd8d2e6, 0.7);
      g.beginPath();
      g.moveTo(53, 13);
      g.lineTo(53, 23);
      g.moveTo(50, 18);
      g.lineTo(56, 18);
      g.strokePath();

      // основные колёса
      g.fillStyle(0x6a5a82);
      g.fillCircle(24, 25, 1.5);
      g.fillCircle(35, 25, 1.5);

      // носовое колесо
      g.fillCircle(46, 24, 1.2);
    });

    this.tex('highplane', 88, 36, (g) => {
      // киль
      g.fillStyle(0xf2eef9);
      g.fillTriangle(16, 17, 9, 4, 14, 18);

      // хвостовой стабилизатор
      g.fillStyle(0xd8cdea);
      g.fillTriangle(16, 18, 8, 15, 17, 20);

      // длинный тонкий фюзеляж
      g.fillStyle(0xe9e2f7);
      g.fillEllipse(45, 18, 56, 5.5);

      // тень
      g.fillStyle(0xb5a8ca, 0.75);
      g.fillEllipse(45, 19.5, 52, 2.4);

      // кабина
      g.fillStyle(0x5a4b73);
      g.fillEllipse(61, 16.8, 6, 2.5);

      // сверхдлинное крыло
      g.fillStyle(0xa88fc8);
      g.fillTriangle(45, 17, 10, 9, 78, 17);
      g.fillTriangle(45, 17, 10, 25, 78, 17);

      // небольшие законцовки
      g.fillStyle(0x947bb6);
      g.fillRect(8, 8, 1.5, 18);
      g.fillRect(78, 8, 1.5, 18);

      // двигатель
      g.fillStyle(0x8f7ab0);
      g.fillEllipse(64, 18, 5, 4);

      // винт
      g.lineStyle(1.2, 0xe8e1f5, 0.7);
      g.beginPath();
      g.moveTo(67, 13);
      g.lineTo(67, 23);
      g.moveTo(64.5, 18);
      g.lineTo(69.5, 18);
      g.strokePath();
    });
    // Гало закатика: широкое, очень мягкое, само по себе почти незаметное
    this.tex('sunhalo', 760, 760, (g) => {
      const c = 380;
      for (let i = 0; i < 28; i++) {
        const t = i / 27;
        g.fillStyle(0xff3a4e, 0.012 + t * t * 0.05);
        g.fillCircle(c, c, 372 - t * 158); // 372 → 214, тает к краю
      }
    });

    // Стесняшка-закатик: огромное красное солнце во всю ширину поля,
    // из-за верхней кромки виден только нижний срез
    this.tex('shysun', 520, 520, (g) => {
      const c = 260;
      // мягкий край свечения
      for (let i = 0; i < 22; i++) {
        const t = i / 21;
        g.fillStyle(0xd42045, 0.012 + t * t * 0.06);
        g.fillCircle(c, c, 254 - t * 40); // 254 → 214
      }
      // тело: глубокий красный, плавно теплеющий к центру (без колец)
      g.fillStyle(0xe8304a); g.fillCircle(c, c, 212);
      for (let i = 0; i < 26; i++) {
        g.fillStyle(0xff5a3e, 0.07);
        g.fillCircle(c, c, 204 - i * 2.6); // 204 → 139
      }
      for (let i = 0; i < 22; i++) {
        g.fillStyle(0xff8a5a, 0.06);
        g.fillCircle(c, c, 130 - i * 2.6); // 130 → 75
      }
      // застенчивая мордочка на нижнем (видимом) срезе
      g.lineStyle(4, 0x7a1030);
      g.beginPath(); g.arc(216, 400, 10, 0.15 * Math.PI, 0.85 * Math.PI); g.strokePath();
      g.beginPath(); g.arc(304, 400, 10, 0.15 * Math.PI, 0.85 * Math.PI); g.strokePath();
      g.fillStyle(0xff8aa8, 0.85);
      g.fillEllipse(172, 428, 22, 12); g.fillEllipse(348, 428, 22, 12);
    });

    // Пальма — как на странице трека: серповидные листья, ствол со штрихами
    this.tex('palm', 200, 260, (g) => {
      // серповидный лист: дуга наружу + дуга обратно (полумесяц);
      // выпуклость всегда вверх — листья ниспадают фонтаном, как у настоящей пальмы
      const frond = (cx, cy, tx, ty, bulge, color) => {
        const dx = ty - cy, dy = cx - tx;
        const len = Math.hypot(dx, dy) || 1;
        let nx = dx / len, ny = dy / len;
        if (ny > 0) { nx = -nx; ny = -ny; }
        const pts = [];
        const N = 9;
        for (let i = 0; i <= N; i++) { // внешняя дуга
          const t = i / N;
          const b = bulge * 4 * t * (1 - t);
          pts.push({
            x: cx + (tx - cx) * t + nx * b,
            y: cy + (ty - cy) * t + ny * b,
          });
        }
        for (let i = N; i >= 0; i--) { // обратная дуга — площе, даёт серп
          const t = i / N;
          const b = bulge * 0.25 * 4 * t * (1 - t);
          pts.push({
            x: cx + (tx - cx) * t + nx * b,
            y: cy + (ty - cy) * t + ny * b,
          });
        }
        g.fillStyle(color);
        g.fillPoints(pts, true);
      };

      // ствол: тёмный кант, светлое тело, штрихи — вдоль изгиба к кроне
      const trunkAt = (t) => ({
        x: 16 + 88 * t * t * 0.9 + t * 24,
        y: 254 - t * 184,
        r: 10 - t * 4.5,
      });
      for (let i = 0; i <= 16; i++) {
        const p = trunkAt(i / 16);
        g.fillStyle(0x35202c); g.fillCircle(p.x, p.y, p.r + 2.5);
      }
      for (let i = 0; i <= 16; i++) {
        const p = trunkAt(i / 16);
        g.fillStyle(0x8d6b53); g.fillCircle(p.x, p.y, p.r);
      }
      g.lineStyle(3, 0x5d4436); // поперечные штрихи коры
      for (const t of [0.22, 0.42, 0.6, 0.76]) {
        const p = trunkAt(t);
        g.beginPath();
        g.moveTo(p.x - p.r * 0.9, p.y - 2);
        g.lineTo(p.x + p.r * 0.9, p.y + 2);
        g.strokePath();
      }

      // крона-фонтан: верхние листья тянутся вверх, боковые и нижние — ниспадают
      const cx = 128, cy = 66;
      frond(cx, cy, 150, 6, 16, 0x2e4d28);   // вверх
      frond(cx, cy, 188, 26, 22, 0x2e4d28);  // вверх-вправо
      frond(cx, cy, 74, 18, 22, 0x365a2e);   // вверх-влево
      frond(cx, cy, 198, 78, 24, 0x365a2e);  // вправо, дуга сверху
      frond(cx, cy, 56, 68, 24, 0x365a2e);   // влево, дуга сверху
      frond(cx, cy, 176, 120, 20, 0x27411f); // ниспадает вправо-вниз
      frond(cx, cy, 80, 124, 20, 0x27411f);  // ниспадает влево-вниз

    });

    // Лучистая вспышка за ачивкой (солнце вехи)
    this.tex('burst', 180, 180, (g) => {
      const cx = 90, cy = 90;
      g.fillStyle(0xffcf3f, 0.5);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const wing = 0.085;
        g.fillTriangle(
          cx + Math.cos(a - wing) * 24, cy + Math.sin(a - wing) * 24,
          cx + Math.cos(a + wing) * 24, cy + Math.sin(a + wing) * 24,
          cx + Math.cos(a) * 88, cy + Math.sin(a) * 88,
        );
      }
      g.fillStyle(0xffcf3f, 0.35); g.fillCircle(cx, cy, 34);
      g.fillStyle(0xffe89a, 0.5);  g.fillCircle(cx, cy, 22);
    });

    // Флажок вехи в мире
    this.tex('flag', 26, 34, (g) => {
      g.lineStyle(3, 0x3a0d18);
      g.beginPath(); g.moveTo(4, 2); g.lineTo(4, 32); g.strokePath(); // древко
      g.fillStyle(0xffcf3f);
      g.fillTriangle(6, 2, 6, 16, 24, 9);                            // вымпел
      g.lineStyle(2, 0x3a0d18);
      g.strokeTriangle(6, 2, 6, 16, 24, 9);
    });
  }

  loadSounds() {
    this.load.audio('seagull', 'sounds/' + CONF.sounds.seagull);
    this.load.audio('france', 'sounds/' + CONF.sounds.croissant);
  }
}
