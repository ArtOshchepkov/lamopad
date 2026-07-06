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

    // Офисный диван: с него начинается побег
    this.tex('p-couch', 150, 40, (g) => {
      g.fillStyle(0x1a1a20, 0.5); g.fillEllipse(75, 37, 130, 6);  // тень
      g.fillStyle(0x2e2a34);                                       // ножки
      g.fillRect(14, 30, 8, 8); g.fillRect(128, 30, 8, 8);
      g.fillStyle(0x5a525e); g.fillRoundedRect(6, 12, 138, 22, 8); // корпус
      g.fillStyle(0x6e6672);                                       // подушки
      g.fillRoundedRect(14, 6, 58, 16, 6); g.fillRoundedRect(78, 6, 58, 16, 6);
      g.fillStyle(0x4a4450);                                       // подлокотники
      g.fillRoundedRect(0, 4, 16, 28, 6); g.fillRoundedRect(134, 4, 16, 28, 6);
      g.lineStyle(2, 0x3a3540);                                    // швы
      g.strokeRoundedRect(14, 6, 58, 16, 6); g.strokeRoundedRect(78, 6, 58, 16, 6);
    });

    // Грозовая туча: тёмная, набухшая — при прыжке бьёт молнией
    this.tex('p-storm', 90, 36, (g) => {
      g.translateCanvas(0, 6);
      g.fillStyle(0x140a28, 0.5); g.fillEllipse(46, 27, 60, 6);   // тень
      g.fillStyle(0x3a2c52);                                       // тёмное брюхо
      g.fillCircle(17, 19, 9); g.fillCircle(34, 20, 10);
      g.fillCircle(52, 20, 9); g.fillCircle(68, 18, 8); g.fillCircle(80, 16, 6);
      g.fillStyle(0x5a4878);                                       // тело
      g.fillCircle(19, 12, 10); g.fillCircle(37, 10, 13);
      g.fillCircle(56, 10, 12); g.fillCircle(73, 12, 9); g.fillCircle(82, 14, 6);
      g.fillStyle(0x7a68a0, 0.9);                                  // хмурый блик
      g.fillEllipse(40, 4, 20, 6); g.fillEllipse(62, 5, 14, 5);
      g.fillStyle(0xffd93b, 0.9);                                  // искорка внутри
      g.fillTriangle(46, 22, 42, 28, 45, 27);
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

    // Чемодан: чёрный, казённый — такому доверять не хочется
    this.tex('p-suitcase', 76, 34, (g) => {
      g.fillStyle(0x060410, 0.55); g.fillEllipse(38, 31, 66, 8);  // тень
      g.lineStyle(3, 0x0a0810);
      g.strokeRoundedRect(28, 1, 20, 8, 3);                        // ручка
      g.fillStyle(0x1a1622); g.fillRoundedRect(4, 6, 68, 24, 6);   // корпус
      g.fillStyle(0x2c2740); g.fillRoundedRect(4, 6, 68, 10, { tl: 6, tr: 6, bl: 0, br: 0 }); // холодный отлив крышки
      g.fillStyle(0x0e0c16);                                       // ремни
      g.fillRect(16, 6, 7, 24); g.fillRect(53, 6, 7, 24);
      g.lineStyle(2, 0x0a0810); g.strokeRoundedRect(4, 6, 68, 24, 6);
      g.fillStyle(0x767284);                                       // стальные заклёпки
      g.fillCircle(9, 11, 2); g.fillCircle(67, 11, 2); g.fillCircle(9, 26, 2); g.fillCircle(67, 26, 2);
      g.lineStyle(2, 0x453e58, 0.9);                               // царапины бывалого
      g.beginPath(); g.moveTo(29, 21); g.lineTo(44, 26); g.strokePath();
      g.beginPath(); g.moveTo(36, 17); g.lineTo(48, 20); g.strokePath();
      // ободранный обрывок наклейки — единственное светлое пятно
      g.fillStyle(0x8a8494, 0.75); g.fillTriangle(24, 25, 32, 20, 34, 27);
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

    // Змея: свернувшаяся кольцами, срисована по мотивам ~/Documents/snake.svg
    // (голова с двумя глазами и языком слева-сверху, тело уходит вправо-вниз)
    this.tex('snake', 110, 84, (g) => {
      // body (main coil, bright green)
      g.fillStyle(0x9cf73c);
      g.beginPath();
      g.moveTo(24.77, 3.86);
      g.lineTo(24.44, 3.86);
      g.lineTo(24.11, 3.87);
      g.lineTo(23.79, 3.89);
      g.lineTo(23.47, 3.92);
      g.lineTo(23.14, 3.95);
      g.lineTo(22.82, 4);
      g.lineTo(22.51, 4.05);
      g.lineTo(22.19, 4.12);
      g.lineTo(19.47, 5.01);
      g.lineTo(16.49, 6.48);
      g.lineTo(13.43, 8.43);
      g.lineTo(10.45, 10.77);
      g.lineTo(7.73, 13.39);
      g.lineTo(5.44, 16.2);
      g.lineTo(3.77, 19.1);
      g.lineTo(2.87, 21.97);
      g.lineTo(2.88, 24.02);
      g.lineTo(3.55, 25.76);
      g.lineTo(4.82, 27.2);
      g.lineTo(6.62, 28.37);
      g.lineTo(8.88, 29.25);
      g.lineTo(11.53, 29.88);
      g.lineTo(14.52, 30.25);
      g.lineTo(17.76, 30.38);
      g.lineTo(17.56, 31.67);
      g.lineTo(17.1, 34.87);
      g.lineTo(16.52, 39.43);
      g.lineTo(15.96, 44.85);
      g.lineTo(15.57, 50.58);
      g.lineTo(15.48, 56.1);
      g.lineTo(15.84, 60.89);
      g.lineTo(16.79, 64.41);
      g.lineTo(18.6, 67.2);
      g.lineTo(21.36, 69.89);
      g.lineTo(24.91, 72.16);
      g.lineTo(29.1, 73.7);
      g.lineTo(33.78, 74.18);
      g.lineTo(38.8, 73.29);
      g.lineTo(44, 70.7);
      g.lineTo(49.25, 66.11);
      g.lineTo(53.93, 61.61);
      g.lineTo(57.72, 59.23);
      g.lineTo(60.83, 58.59);
      g.lineTo(63.47, 59.31);
      g.lineTo(65.85, 60.98);
      g.lineTo(68.19, 63.24);
      g.lineTo(70.7, 65.67);
      g.lineTo(73.6, 67.9);
      g.lineTo(76.72, 69.33);
      g.lineTo(79.76, 69.59);
      g.lineTo(82.75, 68.66);
      g.lineTo(85.74, 66.49);
      g.lineTo(88.74, 63.05);
      g.lineTo(91.8, 58.3);
      g.lineTo(94.95, 52.21);
      g.lineTo(98.22, 44.74);
      g.lineTo(100.57, 38.51);
      g.lineTo(101.23, 35.61);
      g.lineTo(100.63, 35.29);
      g.lineTo(99.18, 36.76);
      g.lineTo(97.32, 39.25);
      g.lineTo(95.46, 41.99);
      g.lineTo(94.03, 44.2);
      g.lineTo(93.47, 45.11);
      g.lineTo(92.88, 45.91);
      g.lineTo(91.26, 47.9);
      g.lineTo(88.84, 50.43);
      g.lineTo(85.83, 52.85);
      g.lineTo(82.48, 54.54);
      g.lineTo(78.99, 54.84);
      g.lineTo(75.6, 53.13);
      g.lineTo(72.52, 48.75);
      g.lineTo(69.53, 43.81);
      g.lineTo(66.27, 40.72);
      g.lineTo(62.78, 39.29);
      g.lineTo(59.1, 39.34);
      g.lineTo(55.28, 40.69);
      g.lineTo(51.34, 43.14);
      g.lineTo(47.34, 46.52);
      g.lineTo(43.31, 50.64);
      g.lineTo(39.34, 53.95);
      g.lineTo(35.57, 55.18);
      g.lineTo(32.17, 54.53);
      g.lineTo(29.33, 52.18);
      g.lineTo(27.2, 48.33);
      g.lineTo(25.95, 43.18);
      g.lineTo(25.76, 36.92);
      g.lineTo(26.8, 29.75);
      g.lineTo(26.27, 29.77);
      g.lineTo(30.81, 28.94);
      g.lineTo(35.06, 27.77);
      g.lineTo(38.82, 26.28);
      g.lineTo(41.9, 24.51);
      g.lineTo(44.11, 22.46);
      g.lineTo(45.24, 20.17);
      g.lineTo(45.1, 17.65);
      g.lineTo(43.5, 14.93);
      g.lineTo(41.32, 12.54);
      g.lineTo(39.04, 10.39);
      g.lineTo(36.7, 8.5);
      g.lineTo(34.31, 6.9);
      g.lineTo(31.9, 5.61);
      g.lineTo(29.49, 4.65);
      g.lineTo(27.11, 4.06);
      g.lineTo(24.77, 3.86);
      g.closePath();
      g.fillPath();

      // shading overlay A (belly shadow)
      g.fillStyle(0x90700e, 0.173);
      g.beginPath();
      g.moveTo(98.6, 43.73);
      g.lineTo(97.3, 45.37);
      g.lineTo(95.35, 47.92);
      g.lineTo(92.91, 51.02);
      g.lineTo(90.15, 54.32);
      g.lineTo(87.23, 57.45);
      g.lineTo(84.31, 60.06);
      g.lineTo(81.55, 61.8);
      g.lineTo(79.13, 62.29);
      g.lineTo(76.91, 61.97);
      g.lineTo(74.99, 61.5);
      g.lineTo(73.3, 60.86);
      g.lineTo(71.78, 60.02);
      g.lineTo(70.38, 58.96);
      g.lineTo(69.04, 57.65);
      g.lineTo(67.7, 56.08);
      g.lineTo(66.29, 54.21);
      g.lineTo(64.83, 52.43);
      g.lineTo(63.36, 51.17);
      g.lineTo(61.85, 50.43);
      g.lineTo(60.28, 50.23);
      g.lineTo(58.61, 50.58);
      g.lineTo(56.83, 51.51);
      g.lineTo(54.91, 53.04);
      g.lineTo(52.82, 55.16);
      g.lineTo(50.55, 57.61);
      g.lineTo(48.14, 60);
      g.lineTo(45.63, 62.26);
      g.lineTo(43.07, 64.29);
      g.lineTo(40.52, 66);
      g.lineTo(38.02, 67.3);
      g.lineTo(35.63, 68.11);
      g.lineTo(33.38, 68.33);
      g.lineTo(31.19, 68.22);
      g.lineTo(28.97, 68.01);
      g.lineTo(26.76, 67.59);
      g.lineTo(24.61, 66.82);
      g.lineTo(22.57, 65.59);
      g.lineTo(20.69, 63.76);
      g.lineTo(19.02, 61.22);
      g.lineTo(17.6, 57.85);
      g.lineTo(17.6, 58);
      g.lineTo(17.62, 58.42);
      g.lineTo(17.65, 59.09);
      g.lineTo(17.71, 59.95);
      g.lineTo(17.82, 60.99);
      g.lineTo(17.96, 62.15);
      g.lineTo(18.17, 63.4);
      g.lineTo(18.44, 64.71);
      g.lineTo(18.47, 64.9);
      g.lineTo(18.54, 65.23);
      g.lineTo(18.62, 65.66);
      g.lineTo(18.71, 66.15);
      g.lineTo(18.8, 66.63);
      g.lineTo(18.89, 67.07);
      g.lineTo(18.97, 67.4);
      g.lineTo(19.02, 67.6);
      g.lineTo(21.44, 69.88);
      g.lineTo(24.44, 71.87);
      g.lineTo(27.91, 73.34);
      g.lineTo(31.78, 74.11);
      g.lineTo(35.93, 73.97);
      g.lineTo(40.29, 72.73);
      g.lineTo(44.76, 70.17);
      g.lineTo(49.25, 66.11);
      g.lineTo(53.93, 61.61);
      g.lineTo(57.72, 59.23);
      g.lineTo(60.83, 58.59);
      g.lineTo(63.47, 59.31);
      g.lineTo(65.85, 60.98);
      g.lineTo(68.19, 63.24);
      g.lineTo(70.7, 65.67);
      g.lineTo(73.6, 67.9);
      g.lineTo(76.72, 69.33);
      g.lineTo(79.76, 69.59);
      g.lineTo(82.75, 68.66);
      g.lineTo(85.74, 66.49);
      g.lineTo(88.74, 63.05);
      g.lineTo(91.8, 58.3);
      g.lineTo(94.95, 52.21);
      g.lineTo(98.22, 44.74);
      g.lineTo(98.28, 44.59);
      g.lineTo(98.33, 44.46);
      g.lineTo(98.38, 44.34);
      g.lineTo(98.42, 44.22);
      g.lineTo(98.46, 44.11);
      g.lineTo(98.5, 44);
      g.lineTo(98.55, 43.87);
      g.lineTo(98.6, 43.73);
      g.closePath();
      g.fillPath();

      // shading overlay B (scale shading)
      g.fillStyle(0x90700e, 0.173);
      g.beginPath();
      g.moveTo(43.94, 21.59);
      g.lineTo(43.69, 21.54);
      g.lineTo(43.07, 21.65);
      g.lineTo(42.16, 21.88);
      g.lineTo(41.01, 22.21);
      g.lineTo(39.69, 22.61);
      g.lineTo(38.27, 23.04);
      g.lineTo(36.8, 23.48);
      g.lineTo(35.35, 23.88);
      g.lineTo(34.89, 23.92);
      g.lineTo(34.61, 23.77);
      g.lineTo(34.47, 23.48);
      g.lineTo(34.43, 23.12);
      g.lineTo(34.47, 22.74);
      g.lineTo(34.54, 22.4);
      g.lineTo(34.61, 22.15);
      g.lineTo(34.64, 22.06);
      g.lineTo(34.34, 22.15);
      g.lineTo(33.53, 22.41);
      g.lineTo(32.39, 22.76);
      g.lineTo(31.06, 23.16);
      g.lineTo(29.71, 23.54);
      g.lineTo(28.51, 23.85);
      g.lineTo(27.6, 24.02);
      g.lineTo(27.15, 24.01);
      g.lineTo(26.99, 23.81);
      g.lineTo(26.86, 23.5);
      g.lineTo(26.75, 23.14);
      g.lineTo(26.63, 22.75);
      g.lineTo(26.51, 22.37);
      g.lineTo(26.36, 22.05);
      g.lineTo(26.17, 21.82);
      g.lineTo(25.93, 21.73);
      g.lineTo(25.62, 21.77);
      g.lineTo(25.08, 21.89);
      g.lineTo(24.39, 22.07);
      g.lineTo(23.62, 22.28);
      g.lineTo(22.85, 22.49);
      g.lineTo(22.15, 22.68);
      g.lineTo(21.59, 22.82);
      g.lineTo(21.25, 22.89);
      g.lineTo(21.2, 22.94);
      g.lineTo(21.31, 23.06);
      g.lineTo(21.53, 23.21);
      g.lineTo(21.81, 23.39);
      g.lineTo(22.09, 23.57);
      g.lineTo(22.31, 23.74);
      g.lineTo(22.41, 23.87);
      g.lineTo(22.33, 23.94);
      g.lineTo(21.98, 24.03);
      g.lineTo(21.62, 24.13);
      g.lineTo(21.25, 24.25);
      g.lineTo(20.87, 24.37);
      g.lineTo(20.48, 24.51);
      g.lineTo(20.08, 24.66);
      g.lineTo(19.67, 24.83);
      g.lineTo(19.24, 25);
      g.lineTo(19.06, 25.12);
      g.lineTo(18.93, 25.29);
      g.lineTo(18.83, 25.5);
      g.lineTo(18.75, 25.72);
      g.lineTo(18.66, 25.93);
      g.lineTo(18.56, 26.13);
      g.lineTo(18.44, 26.28);
      g.lineTo(18.27, 26.38);
      g.lineTo(17.98, 26.5);
      g.lineTo(17.78, 26.63);
      g.lineTo(17.63, 26.77);
      g.lineTo(17.51, 26.91);
      g.lineTo(17.4, 27.04);
      g.lineTo(17.27, 27.16);
      g.lineTo(17.09, 27.25);
      g.lineTo(16.83, 27.32);
      g.lineTo(16.16, 27.4);
      g.lineTo(15.5, 27.46);
      g.lineTo(14.85, 27.5);
      g.lineTo(14.22, 27.51);
      g.lineTo(13.61, 27.5);
      g.lineTo(13.02, 27.46);
      g.lineTo(12.48, 27.4);
      g.lineTo(11.97, 27.32);
      g.lineTo(10.61, 27.03);
      g.lineTo(9.43, 26.76);
      g.lineTo(8.43, 26.52);
      g.lineTo(7.58, 26.31);
      g.lineTo(6.87, 26.14);
      g.lineTo(6.26, 26.01);
      g.lineTo(5.75, 25.92);
      g.lineTo(5.31, 25.87);
      g.lineTo(5.21, 25.91);
      g.lineTo(5.15, 26.02);
      g.lineTo(5.14, 26.2);
      g.lineTo(5.17, 26.44);
      g.lineTo(5.25, 26.74);
      g.lineTo(5.37, 27.07);
      g.lineTo(5.54, 27.43);
      g.lineTo(5.76, 27.82);
      g.lineTo(5.76, 27.83);
      g.lineTo(5.76, 27.83);
      g.lineTo(5.76, 27.83);
      g.lineTo(5.77, 27.83);
      g.lineTo(5.77, 27.84);
      g.lineTo(5.77, 27.84);
      g.lineTo(5.77, 27.84);
      g.lineTo(5.78, 27.84);
      g.lineTo(5.78, 27.85);
      g.lineTo(5.79, 27.85);
      g.lineTo(5.8, 27.86);
      g.lineTo(5.81, 27.86);
      g.lineTo(5.81, 27.87);
      g.lineTo(5.82, 27.88);
      g.lineTo(5.83, 27.88);
      g.lineTo(5.84, 27.89);
      g.lineTo(6.08, 28.03);
      g.lineTo(6.33, 28.17);
      g.lineTo(6.59, 28.3);
      g.lineTo(6.85, 28.43);
      g.lineTo(7.13, 28.55);
      g.lineTo(7.41, 28.67);
      g.lineTo(7.7, 28.79);
      g.lineTo(7.99, 28.9);
      g.lineTo(8, 28.9);
      g.lineTo(8, 28.91);
      g.lineTo(8.01, 28.91);
      g.lineTo(8.01, 28.91);
      g.lineTo(8.02, 28.91);
      g.lineTo(8.02, 28.92);
      g.lineTo(8.03, 28.92);
      g.lineTo(8.03, 28.92);
      g.lineTo(8.04, 28.93);
      g.lineTo(8.06, 28.93);
      g.lineTo(8.07, 28.94);
      g.lineTo(8.08, 28.94);
      g.lineTo(8.09, 28.95);
      g.lineTo(8.11, 28.95);
      g.lineTo(8.12, 28.96);
      g.lineTo(8.13, 28.96);
      g.lineTo(8.14, 28.96);
      g.lineTo(8.14, 28.97);
      g.lineTo(8.15, 28.97);
      g.lineTo(8.15, 28.97);
      g.lineTo(8.16, 28.97);
      g.lineTo(8.16, 28.98);
      g.lineTo(8.17, 28.98);
      g.lineTo(8.17, 28.98);
      g.lineTo(8.47, 29.08);
      g.lineTo(8.77, 29.18);
      g.lineTo(9.08, 29.27);
      g.lineTo(9.4, 29.36);
      g.lineTo(9.72, 29.44);
      g.lineTo(10.04, 29.52);
      g.lineTo(10.38, 29.6);
      g.lineTo(10.71, 29.67);
      g.lineTo(10.73, 29.68);
      g.lineTo(10.75, 29.68);
      g.lineTo(10.77, 29.69);
      g.lineTo(10.78, 29.69);
      g.lineTo(10.8, 29.7);
      g.lineTo(10.82, 29.7);
      g.lineTo(10.84, 29.71);
      g.lineTo(10.85, 29.71);
      g.lineTo(10.87, 29.72);
      g.lineTo(10.88, 29.72);
      g.lineTo(10.9, 29.73);
      g.lineTo(10.91, 29.74);
      g.lineTo(10.93, 29.74);
      g.lineTo(10.94, 29.75);
      g.lineTo(10.96, 29.75);
      g.lineTo(10.98, 29.75);
      g.lineTo(10.99, 29.76);
      g.lineTo(11, 29.76);
      g.lineTo(11.01, 29.76);
      g.lineTo(11.03, 29.76);
      g.lineTo(11.04, 29.77);
      g.lineTo(11.05, 29.77);
      g.lineTo(11.07, 29.77);
      g.lineTo(11.08, 29.77);
      g.lineTo(11.21, 29.8);
      g.lineTo(11.34, 29.82);
      g.lineTo(11.48, 29.83);
      g.lineTo(11.61, 29.85);
      g.lineTo(11.75, 29.86);
      g.lineTo(11.88, 29.88);
      g.lineTo(12.02, 29.9);
      g.lineTo(12.15, 29.92);
      g.lineTo(12.16, 29.92);
      g.lineTo(12.17, 29.92);
      g.lineTo(12.18, 29.92);
      g.lineTo(12.19, 29.93);
      g.lineTo(12.19, 29.93);
      g.lineTo(12.2, 29.93);
      g.lineTo(12.21, 29.93);
      g.lineTo(12.22, 29.94);
      g.lineTo(12.87, 30.03);
      g.lineTo(13.53, 30.12);
      g.lineTo(14.2, 30.19);
      g.lineTo(14.89, 30.25);
      g.lineTo(15.59, 30.31);
      g.lineTo(16.3, 30.35);
      g.lineTo(17.02, 30.37);
      g.lineTo(17.76, 30.38);
      g.lineTo(17.73, 30.57);
      g.lineTo(17.67, 30.99);
      g.lineTo(17.58, 31.64);
      g.lineTo(17.46, 32.49);
      g.lineTo(17.33, 33.5);
      g.lineTo(17.17, 34.65);
      g.lineTo(17, 35.91);
      g.lineTo(16.83, 37.27);
      g.lineTo(16.82, 37.28);
      g.lineTo(16.82, 37.29);
      g.lineTo(16.82, 37.3);
      g.lineTo(16.82, 37.31);
      g.lineTo(16.81, 37.32);
      g.lineTo(16.81, 37.33);
      g.lineTo(16.81, 37.34);
      g.lineTo(16.81, 37.35);
      g.lineTo(16.8, 37.37);
      g.lineTo(16.8, 37.39);
      g.lineTo(16.8, 37.41);
      g.lineTo(16.8, 37.43);
      g.lineTo(16.79, 37.45);
      g.lineTo(16.79, 37.47);
      g.lineTo(16.79, 37.49);
      g.lineTo(16.79, 37.51);
      g.lineTo(16.86, 37.42);
      g.lineTo(17.07, 37.15);
      g.lineTo(17.39, 36.75);
      g.lineTo(17.82, 36.23);
      g.lineTo(18.32, 35.63);
      g.lineTo(18.89, 34.97);
      g.lineTo(19.5, 34.28);
      g.lineTo(20.14, 33.59);
      g.lineTo(20.36, 33.36);
      g.lineTo(20.58, 33.13);
      g.lineTo(20.81, 32.91);
      g.lineTo(21.03, 32.69);
      g.lineTo(21.25, 32.49);
      g.lineTo(21.47, 32.29);
      g.lineTo(21.68, 32.1);
      g.lineTo(21.88, 31.93);
      g.lineTo(22.49, 31.69);
      g.lineTo(23.09, 31.89);
      g.lineTo(23.66, 32.41);
      g.lineTo(24.2, 33.1);
      g.lineTo(24.7, 33.83);
      g.lineTo(25.14, 34.47);
      g.lineTo(25.53, 34.89);
      g.lineTo(25.85, 34.93);
      g.lineTo(25.91, 34.87);
      g.lineTo(25.96, 34.76);
      g.lineTo(25.99, 34.62);
      g.lineTo(26.01, 34.43);
      g.lineTo(26.04, 34.18);
      g.lineTo(26.07, 33.87);
      g.lineTo(26.11, 33.5);
      g.lineTo(26.17, 33.06);
      g.lineTo(26.22, 32.74);
      g.lineTo(26.27, 32.44);
      g.lineTo(26.31, 32.16);
      g.lineTo(26.35, 31.9);
      g.lineTo(26.39, 31.67);
      g.lineTo(26.44, 31.45);
      g.lineTo(26.49, 31.25);
      g.lineTo(26.56, 31.07);
      g.lineTo(26.56, 31.08);
      g.lineTo(26.56, 31.08);
      g.lineTo(26.57, 31.09);
      g.lineTo(26.58, 31.09);
      g.lineTo(26.58, 31.1);
      g.lineTo(26.59, 31.11);
      g.lineTo(26.59, 31.11);
      g.lineTo(26.6, 31.11);
      g.lineTo(26.63, 30.94);
      g.lineTo(26.65, 30.77);
      g.lineTo(26.67, 30.6);
      g.lineTo(26.69, 30.44);
      g.lineTo(26.71, 30.27);
      g.lineTo(26.74, 30.1);
      g.lineTo(26.76, 29.93);
      g.lineTo(26.8, 29.75);
      g.lineTo(26.27, 29.77);
      g.lineTo(28.99, 29.32);
      g.lineTo(31.63, 28.74);
      g.lineTo(34.15, 28.04);
      g.lineTo(36.51, 27.23);
      g.lineTo(38.67, 26.31);
      g.lineTo(40.6, 25.28);
      g.lineTo(42.25, 24.16);
      g.lineTo(43.58, 22.95);
      g.lineTo(43.64, 22.74);
      g.lineTo(43.71, 22.52);
      g.lineTo(43.78, 22.31);
      g.lineTo(43.84, 22.11);
      g.lineTo(43.89, 21.93);
      g.lineTo(43.93, 21.78);
      g.lineTo(43.95, 21.66);
      g.lineTo(43.94, 21.59);
      g.closePath();
      g.fillPath();

      // ridge / spine highlight line
      g.fillStyle(0x69663d);
      g.beginPath();
      g.moveTo(8.69, 21.78);
      g.lineTo(9.39, 22.5);
      g.lineTo(10.38, 22.95);
      g.lineTo(11.57, 23.18);
      g.lineTo(12.85, 23.23);
      g.lineTo(14.14, 23.15);
      g.lineTo(15.33, 23);
      g.lineTo(16.34, 22.82);
      g.lineTo(17.05, 22.66);
      g.lineTo(18.1, 22.4);
      g.lineTo(19.13, 22.17);
      g.lineTo(20.15, 21.94);
      g.lineTo(21.17, 21.73);
      g.lineTo(22.18, 21.53);
      g.lineTo(23.21, 21.34);
      g.lineTo(24.25, 21.14);
      g.lineTo(25.31, 20.95);
      g.lineTo(26.49, 20.74);
      g.lineTo(27.63, 20.56);
      g.lineTo(28.75, 20.4);
      g.lineTo(29.85, 20.25);
      g.lineTo(30.94, 20.11);
      g.lineTo(32.02, 19.97);
      g.lineTo(33.11, 19.83);
      g.lineTo(34.21, 19.69);
      g.lineTo(34.87, 19.6);
      g.lineTo(35.67, 19.45);
      g.lineTo(36.55, 19.25);
      g.lineTo(37.46, 18.98);
      g.lineTo(38.33, 18.65);
      g.lineTo(39.1, 18.24);
      g.lineTo(39.71, 17.75);
      g.lineTo(40.1, 17.17);
      g.lineTo(40.13, 17.09);
      g.lineTo(40.11, 17.15);
      g.lineTo(40.04, 17.32);
      g.lineTo(39.94, 17.56);
      g.lineTo(39.82, 17.85);
      g.lineTo(39.69, 18.14);
      g.lineTo(39.57, 18.4);
      g.lineTo(39.47, 18.6);
      g.lineTo(39.3, 18.91);
      g.lineTo(39.12, 19.2);
      g.lineTo(38.94, 19.46);
      g.lineTo(38.74, 19.7);
      g.lineTo(38.52, 19.93);
      g.lineTo(38.27, 20.15);
      g.lineTo(37.98, 20.36);
      g.lineTo(37.64, 20.57);
      g.lineTo(36.73, 21.06);
      g.lineTo(35.75, 21.52);
      g.lineTo(34.72, 21.95);
      g.lineTo(33.66, 22.35);
      g.lineTo(32.59, 22.71);
      g.lineTo(31.54, 23.04);
      g.lineTo(30.52, 23.33);
      g.lineTo(29.56, 23.58);
      g.lineTo(28.33, 23.86);
      g.lineTo(27.11, 24.08);
      g.lineTo(25.9, 24.25);
      g.lineTo(24.69, 24.39);
      g.lineTo(23.46, 24.5);
      g.lineTo(22.21, 24.58);
      g.lineTo(20.92, 24.65);
      g.lineTo(19.6, 24.71);
      g.lineTo(18.82, 24.78);
      g.lineTo(18.05, 24.9);
      g.lineTo(17.29, 25.03);
      g.lineTo(16.54, 25.16);
      g.lineTo(15.8, 25.27);
      g.lineTo(15.06, 25.33);
      g.lineTo(14.32, 25.31);
      g.lineTo(13.58, 25.2);
      g.lineTo(12.9, 25.04);
      g.lineTo(12.3, 24.89);
      g.lineTo(11.75, 24.72);
      g.lineTo(11.25, 24.53);
      g.lineTo(10.8, 24.32);
      g.lineTo(10.38, 24.06);
      g.lineTo(9.98, 23.76);
      g.lineTo(9.59, 23.39);
      g.fillPath();

      // tongue (coral red, forked)
      g.fillStyle(0xfc6650);
      g.beginPath();
      g.moveTo(22.26, 23.16);
      g.lineTo(26.35, 22.55);
      g.lineTo(27.3, 25.44);
      g.lineTo(28.89, 27.98);
      g.lineTo(30.93, 30.18);
      g.lineTo(33.18, 32.02);
      g.lineTo(35.43, 33.5);
      g.lineTo(37.48, 34.62);
      g.lineTo(39.11, 35.38);
      g.lineTo(40.09, 35.75);
      g.lineTo(39.77, 36.14);
      g.lineTo(39.05, 36.24);
      g.lineTo(38.07, 36.12);
      g.lineTo(36.97, 35.87);
      g.lineTo(35.88, 35.56);
      g.lineTo(34.93, 35.27);
      g.lineTo(34.26, 35.08);
      g.lineTo(34.01, 35.06);
      g.lineTo(34.12, 35.62);
      g.lineTo(34.44, 36.35);
      g.lineTo(34.9, 37.16);
      g.lineTo(35.43, 37.99);
      g.lineTo(35.97, 38.76);
      g.lineTo(36.43, 39.4);
      g.lineTo(36.76, 39.84);
      g.lineTo(36.89, 40);
      g.lineTo(34.83, 39.02);
      g.lineTo(32.43, 37.21);
      g.lineTo(29.89, 34.83);
      g.lineTo(27.42, 32.13);
      g.lineTo(25.23, 29.35);
      g.lineTo(23.5, 26.77);
      g.lineTo(22.44, 24.62);
      g.lineTo(22.26, 23.16);
      g.closePath();
      g.fillPath();

      // tongue shading (motion blur)
      g.fillStyle(0xa64234, 0.337);
      g.beginPath();
      g.moveTo(22.27, 23.15);
      g.lineTo(26.36, 22.55);
      g.lineTo(26.4, 22.76);
      g.lineTo(26.46, 23);
      g.lineTo(26.53, 23.27);
      g.lineTo(26.62, 23.55);
      g.lineTo(26.71, 23.85);
      g.lineTo(26.81, 24.16);
      g.lineTo(26.91, 24.46);
      g.lineTo(27.01, 24.75);
      g.lineTo(27.23, 25.3);
      g.lineTo(27.5, 25.86);
      g.lineTo(27.81, 26.4);
      g.lineTo(28.12, 26.89);
      g.lineTo(28.41, 27.32);
      g.lineTo(28.65, 27.65);
      g.lineTo(28.81, 27.87);
      g.lineTo(28.87, 27.96);
      g.lineTo(28.81, 27.94);
      g.lineTo(28.68, 27.8);
      g.lineTo(28.49, 27.56);
      g.lineTo(28.26, 27.24);
      g.lineTo(27.98, 26.85);
      g.lineTo(27.69, 26.4);
      g.lineTo(27.39, 25.91);
      g.lineTo(27.1, 25.4);
      g.lineTo(26.93, 25.08);
      g.lineTo(26.77, 24.75);
      g.lineTo(26.63, 24.42);
      g.lineTo(26.49, 24.1);
      g.lineTo(26.38, 23.8);
      g.lineTo(26.29, 23.54);
      g.lineTo(26.23, 23.31);
      g.lineTo(26.2, 23.14);
      g.lineTo(25.3, 23.32);
      g.lineTo(25.31, 23.51);
      g.lineTo(25.38, 23.81);
      g.lineTo(25.51, 24.21);
      g.lineTo(25.69, 24.68);
      g.lineTo(25.9, 25.21);
      g.lineTo(26.14, 25.78);
      g.lineTo(26.41, 26.37);
      g.lineTo(26.7, 26.95);
      g.lineTo(27.1, 27.69);
      g.lineTo(27.55, 28.45);
      g.lineTo(28.03, 29.19);
      g.lineTo(28.5, 29.87);
      g.lineTo(28.91, 30.46);
      g.lineTo(29.24, 30.92);
      g.lineTo(29.45, 31.21);
      g.lineTo(29.5, 31.28);
      g.lineTo(29.35, 31.12);
      g.lineTo(29.05, 30.79);
      g.lineTo(28.64, 30.31);
      g.lineTo(28.15, 29.74);
      g.lineTo(27.62, 29.1);
      g.lineTo(27.08, 28.42);
      g.lineTo(26.58, 27.74);
      g.lineTo(26.15, 27.08);
      g.lineTo(25.86, 26.6);
      g.lineTo(25.6, 26.11);
      g.lineTo(25.37, 25.63);
      g.lineTo(25.16, 25.16);
      g.lineTo(24.99, 24.73);
      g.lineTo(24.86, 24.34);
      g.lineTo(24.77, 23.99);
      g.lineTo(24.73, 23.71);
      g.lineTo(23.49, 23.98);
      g.lineTo(23.52, 24.47);
      g.lineTo(23.8, 25.24);
      g.lineTo(24.24, 26.17);
      g.lineTo(24.77, 27.16);
      g.lineTo(25.32, 28.11);
      g.lineTo(25.8, 28.92);
      g.lineTo(26.14, 29.48);
      g.lineTo(26.28, 29.69);
      g.lineTo(26.51, 29.96);
      g.lineTo(27, 30.61);
      g.lineTo(27.67, 31.5);
      g.lineTo(28.41, 32.51);
      g.lineTo(29.13, 33.51);
      g.lineTo(29.74, 34.37);
      g.lineTo(30.14, 34.96);
      g.lineTo(30.23, 35.15);
      g.lineTo(29.83, 34.8);
      g.lineTo(29.13, 34.07);
      g.lineTo(28.21, 33.05);
      g.lineTo(27.17, 31.84);
      g.lineTo(26.1, 30.54);
      g.lineTo(25.09, 29.24);
      g.lineTo(24.23, 28.05);
      g.lineTo(23.62, 27.05);
      g.lineTo(23.29, 26.43);
      g.lineTo(22.99, 25.82);
      g.lineTo(22.73, 25.23);
      g.lineTo(22.51, 24.68);
      g.lineTo(22.34, 24.18);
      g.lineTo(22.24, 23.75);
      g.lineTo(22.21, 23.4);
      g.lineTo(22.27, 23.15);
      g.closePath();
      g.fillPath();

      // white highlight A (snout)
      g.fillStyle(0xffffff);
      g.beginPath();
      g.moveTo(30.89, 21.71);
      g.lineTo(34.35, 21.06);
      g.lineTo(34.35, 21.25);
      g.lineTo(34.35, 21.76);
      g.lineTo(34.32, 22.49);
      g.lineTo(34.28, 23.33);
      g.lineTo(34.19, 24.17);
      g.lineTo(34.07, 24.92);
      g.lineTo(33.89, 25.47);
      g.lineTo(33.65, 25.72);
      g.lineTo(33.37, 25.82);
      g.lineTo(33.07, 25.92);
      g.lineTo(32.76, 25.95);
      g.lineTo(32.43, 25.8);
      g.lineTo(32.08, 25.39);
      g.lineTo(31.71, 24.63);
      g.lineTo(31.31, 23.44);
      g.lineTo(30.89, 21.71);
      g.closePath();
      g.fillPath();

      // white highlight B (cheek)
      g.fillStyle(0xffffff);
      g.beginPath();
      g.moveTo(15.32, 24.31);
      g.lineTo(15.37, 24.3);
      g.lineTo(15.52, 24.28);
      g.lineTo(15.74, 24.24);
      g.lineTo(16.04, 24.2);
      g.lineTo(16.39, 24.14);
      g.lineTo(16.77, 24.08);
      g.lineTo(17.18, 24);
      g.lineTo(17.61, 23.93);
      g.lineTo(17.91, 23.87);
      g.lineTo(18.2, 23.8);
      g.lineTo(18.48, 23.74);
      g.lineTo(18.74, 23.69);
      g.lineTo(18.97, 23.65);
      g.lineTo(19.16, 23.63);
      g.lineTo(19.29, 23.64);
      g.lineTo(19.36, 23.69);
      g.lineTo(19.43, 23.97);
      g.lineTo(19.46, 24.41);
      g.lineTo(19.46, 24.97);
      g.lineTo(19.44, 25.56);
      g.lineTo(19.41, 26.14);
      g.lineTo(19.37, 26.63);
      g.lineTo(19.35, 26.97);
      g.lineTo(19.33, 27.1);
      g.lineTo(19.3, 27.21);
      g.lineTo(19.19, 27.5);
      g.lineTo(19.01, 27.85);
      g.lineTo(18.74, 28.18);
      g.lineTo(18.38, 28.38);
      g.lineTo(17.93, 28.36);
      g.lineTo(17.37, 28.03);
      g.lineTo(16.71, 27.28);
      g.lineTo(16.1, 26.4);
      g.lineTo(15.67, 25.71);
      g.lineTo(15.4, 25.2);
      g.lineTo(15.25, 24.83);
      g.lineTo(15.2, 24.59);
      g.lineTo(15.21, 24.43);
      g.lineTo(15.26, 24.35);
      g.lineTo(15.32, 24.31);
      g.closePath();
      g.fillPath();

      // eye 1 sclera (white)
      g.fillStyle(0xffffff);
      g.beginPath();
      g.moveTo(9.99, 11.78);
      g.lineTo(9.96, 10.42);
      g.lineTo(10.02, 9.16);
      g.lineTo(10.18, 8.02);
      g.lineTo(10.47, 7.02);
      g.lineTo(10.91, 6.17);
      g.lineTo(11.53, 5.48);
      g.lineTo(12.35, 4.98);
      g.lineTo(13.39, 4.67);
      g.lineTo(14.46, 4.67);
      g.lineTo(15.37, 5.03);
      g.lineTo(16.13, 5.71);
      g.lineTo(16.74, 6.64);
      g.lineTo(17.22, 7.77);
      g.lineTo(17.57, 9.05);
      g.lineTo(17.8, 10.42);
      g.lineTo(17.92, 11.82);
      g.lineTo(17.93, 13.23);
      g.lineTo(17.83, 14.59);
      g.lineTo(17.62, 15.88);
      g.lineTo(17.3, 17.05);
      g.lineTo(16.86, 18.04);
      g.lineTo(16.3, 18.81);
      g.lineTo(15.62, 19.33);
      g.lineTo(14.81, 19.54);
      g.lineTo(13.94, 19.39);
      g.lineTo(13.09, 18.9);
      g.lineTo(12.3, 18.12);
      g.lineTo(11.59, 17.1);
      g.lineTo(10.97, 15.91);
      g.lineTo(10.49, 14.59);
      g.lineTo(10.15, 13.19);
      g.lineTo(9.99, 11.78);
      g.closePath();
      g.fillPath();

      // eye 1 pupil (dark)
      g.fillStyle(0x69663d);
      g.beginPath();
      g.moveTo(13.26, 13.05);
      g.lineTo(13.18, 12.2);
      g.lineTo(13.17, 11.46);
      g.lineTo(13.22, 10.83);
      g.lineTo(13.33, 10.3);
      g.lineTo(13.48, 9.89);
      g.lineTo(13.65, 9.57);
      g.lineTo(13.84, 9.36);
      g.lineTo(14.04, 9.25);
      g.lineTo(14.25, 9.23);
      g.lineTo(14.49, 9.29);
      g.lineTo(14.73, 9.46);
      g.lineTo(14.98, 9.74);
      g.lineTo(15.22, 10.14);
      g.lineTo(15.44, 10.67);
      g.lineTo(15.62, 11.35);
      g.lineTo(15.77, 12.18);
      g.lineTo(15.87, 13.09);
      g.lineTo(15.91, 14.01);
      g.lineTo(15.91, 14.9);
      g.lineTo(15.86, 15.72);
      g.lineTo(15.78, 16.45);
      g.lineTo(15.66, 17.05);
      g.lineTo(15.52, 17.51);
      g.lineTo(15.35, 17.78);
      g.lineTo(15.14, 17.81);
      g.lineTo(14.87, 17.58);
      g.lineTo(14.57, 17.13);
      g.lineTo(14.25, 16.5);
      g.lineTo(13.94, 15.74);
      g.lineTo(13.66, 14.88);
      g.lineTo(13.43, 13.97);
      g.lineTo(13.26, 13.05);
      g.closePath();
      g.fillPath();

      // eye 2 sclera (white)
      g.fillStyle(0xffffff);
      g.beginPath();
      g.moveTo(26.13, 9.81);
      g.lineTo(26.08, 8.45);
      g.lineTo(26.08, 7.16);
      g.lineTo(26.15, 5.99);
      g.lineTo(26.34, 4.95);
      g.lineTo(26.66, 4.05);
      g.lineTo(27.16, 3.33);
      g.lineTo(27.87, 2.8);
      g.lineTo(28.81, 2.49);
      g.lineTo(29.85, 2.56);
      g.lineTo(30.82, 3.12);
      g.lineTo(31.71, 4.06);
      g.lineTo(32.47, 5.3);
      g.lineTo(33.11, 6.73);
      g.lineTo(33.58, 8.26);
      g.lineTo(33.88, 9.79);
      g.lineTo(33.97, 11.24);
      g.lineTo(33.91, 12.54);
      g.lineTo(33.79, 13.73);
      g.lineTo(33.58, 14.77);
      g.lineTo(33.28, 15.66);
      g.lineTo(32.88, 16.39);
      g.lineTo(32.37, 16.94);
      g.lineTo(31.75, 17.29);
      g.lineTo(31, 17.44);
      g.lineTo(30.18, 17.29);
      g.lineTo(29.35, 16.82);
      g.lineTo(28.55, 16.06);
      g.lineTo(27.81, 15.07);
      g.lineTo(27.17, 13.9);
      g.lineTo(26.65, 12.6);
      g.lineTo(26.29, 11.22);
      g.lineTo(26.13, 9.81);
      g.closePath();
      g.fillPath();

      // eye 2 pupil (dark)
      g.fillStyle(0x69663d);
      g.beginPath();
      g.moveTo(28.34, 11.06);
      g.lineTo(28.24, 10.2);
      g.lineTo(28.16, 9.45);
      g.lineTo(28.11, 8.8);
      g.lineTo(28.12, 8.25);
      g.lineTo(28.19, 7.8);
      g.lineTo(28.33, 7.46);
      g.lineTo(28.56, 7.22);
      g.lineTo(28.89, 7.08);
      g.lineTo(29.26, 7.08);
      g.lineTo(29.59, 7.24);
      g.lineTo(29.89, 7.54);
      g.lineTo(30.15, 7.98);
      g.lineTo(30.37, 8.54);
      g.lineTo(30.56, 9.21);
      g.lineTo(30.73, 9.99);
      g.lineTo(30.86, 10.86);
      g.lineTo(30.94, 11.74);
      g.lineTo(30.97, 12.55);
      g.lineTo(30.94, 13.3);
      g.lineTo(30.88, 13.96);
      g.lineTo(30.78, 14.53);
      g.lineTo(30.65, 15);
      g.lineTo(30.5, 15.35);
      g.lineTo(30.34, 15.59);
      g.lineTo(30.14, 15.62);
      g.lineTo(29.89, 15.41);
      g.lineTo(29.6, 14.99);
      g.lineTo(29.29, 14.4);
      g.lineTo(28.99, 13.68);
      g.lineTo(28.72, 12.85);
      g.lineTo(28.5, 11.97);
      g.lineTo(28.34, 11.06);
      g.closePath();
      g.fillPath();
    });

    // Сам СУПЕР МАРИО — мега-редкая платформа
    this.tex('p-mario', 44, 48, (g) => {
      // ботинки
      g.fillStyle(0x5e3a1e); g.fillEllipse(13, 44, 15, 8); g.fillEllipse(31, 44, 15, 8);
      // комбинезон
      g.fillStyle(0x2a52c8); g.fillRoundedRect(12, 29, 20, 13, 4);
      // рубашка и руки
      g.fillStyle(0xd42222); g.fillRoundedRect(8, 23, 28, 10, 4);
      // перчатки
      g.fillStyle(0xffffff); g.fillCircle(7, 31, 3.5); g.fillCircle(37, 31, 3.5);
      // нагрудник комбинезона с пуговицами
      g.fillStyle(0x2a52c8); g.fillRect(16, 25, 12, 9);
      g.fillStyle(0xffd93b); g.fillCircle(18, 27, 1.6); g.fillCircle(26, 27, 1.6);
      // голова
      g.fillStyle(0xffcc99); g.fillCircle(22, 15, 9);
      // бакенбарды и уши
      g.fillStyle(0x4a2c14); g.fillEllipse(14, 16, 4, 6); g.fillEllipse(30, 16, 4, 6);
      // нос — крупный, фирменный
      g.fillStyle(0xffbb88); g.fillEllipse(22, 18, 8, 5.5);
      // усы
      g.fillStyle(0x4a2c14); g.fillEllipse(22, 21.5, 13, 4);
      // глаза
      g.fillStyle(0x2a2a3a); g.fillEllipse(18.5, 14, 2.5, 3.5); g.fillEllipse(25.5, 14, 2.5, 3.5);
      // кепка с козырьком и эмблемой
      g.fillStyle(0xd42222);
      g.fillEllipse(22, 8, 20, 9);
      g.fillEllipse(22, 10.5, 26, 5); // козырёк
      g.fillStyle(0xffffff); g.fillCircle(22, 6.5, 3.2);
      g.fillStyle(0xd42222); // буква M — две ножки
      g.fillRect(20.6, 4.8, 1.2, 3.6); g.fillRect(22.4, 4.8, 1.2, 3.6);
    });

    // ГРИБОК: герой после блока «?» (холст и ступни — как у очков)
    this.tex('shroom', CONF.player.texW, CONF.player.texH, (g) => {
      const DARK = 0x5e0d12;
      // ножки-ботиночки
      g.fillStyle(DARK); g.fillEllipse(25, 62, 15, 8); g.fillEllipse(43, 62, 15, 8);
      g.fillStyle(0xffffff); g.fillEllipse(24, 63, 10, 4); g.fillEllipse(42, 63, 10, 4);
      // ножка гриба
      g.fillStyle(0xffe9d2); g.fillRoundedRect(21, 32, 26, 28, 9);
      g.lineStyle(3, DARK); g.strokeRoundedRect(21, 32, 26, 28, 9);
      // глазки и румянец
      g.fillStyle(0x3a2a2a); g.fillEllipse(29, 44, 4, 7); g.fillEllipse(39, 44, 4, 7);
      g.fillStyle(0xffb8dd, 0.9); g.fillEllipse(24, 50, 6, 4); g.fillEllipse(44, 50, 6, 4);
      // шляпка
      g.fillStyle(DARK); g.fillEllipse(34, 22, 54, 34);            // кант
      g.fillStyle(0xd42222); g.fillEllipse(34, 21, 50, 30);
      g.fillStyle(0xffffff);                                       // белые пятна
      g.fillCircle(20, 17, 6); g.fillCircle(38, 11, 7); g.fillCircle(48, 22, 5);
      g.fillEllipse(34, 34, 46, 6);                                // нижняя кромка шляпки
    });

    // Реактивный ранец: красный рюкзак с соплами и ручкой-петлёй сверху
    this.tex('jetpack', 48, 68, (g) => {
      g.translateCanvas(0, 6); // место под ручку над корпусом
      // ручка, как у настоящего ранца (рисуем до корпуса — он прикроет низ петли)
      g.lineStyle(4, 0x5e0d12);
      g.strokeRoundedRect(17, -5, 14, 12, 5);
      // сопла снизу: длинные, с ободком и тёмным жерлом
      g.fillStyle(0x4a4a58);
      g.fillRoundedRect(6, 38, 14, 20, 4); g.fillRoundedRect(28, 38, 14, 20, 4);
      g.fillStyle(0x6a6a7a); // ободки на срезе
      g.fillRect(6, 52, 14, 3); g.fillRect(28, 52, 14, 3);
      g.fillStyle(0x2a2a34); // жерла
      g.fillEllipse(13, 57, 12, 5); g.fillEllipse(35, 57, 12, 5);
      // корпус — фирменный красный рюкзак
      g.fillStyle(0x5e0d12); g.fillRoundedRect(2, 4, 44, 40, 12);  // кант
      g.fillStyle(0xd42222); g.fillRoundedRect(4, 2, 40, 40, 12);  // тело
      g.fillStyle(0xff5040); g.fillRoundedRect(4, 2, 40, 16, { tl: 12, tr: 12, bl: 0, br: 0 }); // клапан
      g.fillStyle(0xffd000); g.fillRoundedRect(17, 22, 14, 12, 4); // карман
      g.lineStyle(3, 0x5e0d12);
      g.strokeRoundedRect(4, 2, 40, 40, 12);
      g.beginPath(); g.moveTo(12, 2); g.lineTo(12, 42); g.strokePath(); // лямки
      g.beginPath(); g.moveTo(36, 2); g.lineTo(36, 42); g.strokePath();
    });

    // Капля дождя: тонкий штрих
    this.tex('raindrop', 3, 14, (g) => {
      g.fillStyle(0xffffff, 0.95); g.fillRect(1, 0, 1.8, 12);
    });

    // Светлячок: почти пиксель
    this.tex('spark', 3, 3, (g) => {
      g.fillStyle(0xffffff); g.fillCircle(1.5, 1.5, 1.2);
    });

    // Мыльный пузырь: тонкая плёнка с радужными бликами
    this.tex('bubble', 100, 100, (g) => {
      const c = 50, r = 46;
      g.fillStyle(0xcfe8ff, 0.09); g.fillCircle(c, c, r);        // плёнка
      g.lineStyle(2.5, 0xffffff, 0.75); g.strokeCircle(c, c, r); // контур
      // радужные переливы по ободу
      g.lineStyle(3, 0xffb8dd, 0.5);
      g.beginPath(); g.arc(c, c, r - 4, Math.PI * 0.55, Math.PI * 0.95); g.strokePath();
      g.lineStyle(3, 0xa8e8ff, 0.5);
      g.beginPath(); g.arc(c, c, r - 4, Math.PI * 1.15, Math.PI * 1.5); g.strokePath();
      // блики
      g.fillStyle(0xffffff, 0.85); g.fillEllipse(32, 26, 16, 9);
      g.fillStyle(0xffffff, 0.45); g.fillEllipse(66, 70, 8, 5);
    });

    // Мягкий светящийся шар (для огня ранца и вспышек)
    this.tex('glowball', 64, 64, (g) => {
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        g.fillStyle(0xffffff, 0.02 + t * t * 0.09);
        g.fillCircle(32, 32, 30 - t * 20);
      }
      g.fillStyle(0xffffff, 0.9); g.fillCircle(32, 32, 7);
    });

    // Пассажирский лайнер для фона (смотрит вправо): приглушённые цвета,
    // без жёстких контуров — далёкий силуэт, а не объект геймплея
    this.tex('plane', 76, 32, (g) => {
      // киль — стреловидный, приглушённо-зелёный (красный сливался с закатом)
      g.fillStyle(0x3f9e63); g.fillTriangle(15, 14, 5, 3, 10, 15);
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
