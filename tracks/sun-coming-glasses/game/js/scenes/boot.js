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
    this.tex('snake', 59, 45, (g) => {
      // body (main coil, bright green)
      g.fillStyle(0x9cf73c);
      g.beginPath();
      g.moveTo(13.21, 2.06);
      g.lineTo(13.03, 2.06);
      g.lineTo(12.86, 2.06);
      g.lineTo(12.69, 2.07);
      g.lineTo(12.51, 2.09);
      g.lineTo(12.34, 2.11);
      g.lineTo(12.17, 2.13);
      g.lineTo(12, 2.16);
      g.lineTo(11.83, 2.2);
      g.lineTo(10.39, 2.67);
      g.lineTo(8.8, 3.46);
      g.lineTo(7.16, 4.5);
      g.lineTo(5.57, 5.75);
      g.lineTo(4.12, 7.14);
      g.lineTo(2.9, 8.64);
      g.lineTo(2.01, 10.18);
      g.lineTo(1.53, 11.72);
      g.lineTo(1.54, 12.81);
      g.lineTo(1.89, 13.74);
      g.lineTo(2.57, 14.51);
      g.lineTo(3.53, 15.13);
      g.lineTo(4.74, 15.6);
      g.lineTo(6.15, 15.93);
      g.lineTo(7.74, 16.13);
      g.lineTo(9.47, 16.2);
      g.lineTo(9.36, 16.89);
      g.lineTo(9.12, 18.6);
      g.lineTo(8.81, 21.03);
      g.lineTo(8.51, 23.92);
      g.lineTo(8.3, 26.97);
      g.lineTo(8.26, 29.92);
      g.lineTo(8.45, 32.47);
      g.lineTo(8.95, 34.35);
      g.lineTo(9.92, 35.84);
      g.lineTo(11.39, 37.27);
      g.lineTo(13.29, 38.49);
      g.lineTo(15.52, 39.31);
      g.lineTo(18.02, 39.56);
      g.lineTo(20.69, 39.09);
      g.lineTo(23.47, 37.71);
      g.lineTo(26.26, 35.26);
      g.lineTo(28.76, 32.86);
      g.lineTo(30.79, 31.59);
      g.lineTo(32.44, 31.25);
      g.lineTo(33.85, 31.63);
      g.lineTo(35.12, 32.53);
      g.lineTo(36.37, 33.73);
      g.lineTo(37.71, 35.02);
      g.lineTo(39.25, 36.21);
      g.lineTo(40.92, 36.98);
      g.lineTo(42.54, 37.12);
      g.lineTo(44.13, 36.62);
      g.lineTo(45.73, 35.46);
      g.lineTo(47.33, 33.63);
      g.lineTo(48.96, 31.09);
      g.lineTo(50.64, 27.85);
      g.lineTo(52.38, 23.86);
      g.lineTo(53.64, 20.54);
      g.lineTo(53.99, 18.99);
      g.lineTo(53.67, 18.82);
      g.lineTo(52.9, 19.6);
      g.lineTo(51.9, 20.93);
      g.lineTo(50.91, 22.39);
      g.lineTo(50.15, 23.57);
      g.lineTo(49.85, 24.06);
      g.lineTo(49.53, 24.49);
      g.lineTo(48.67, 25.55);
      g.lineTo(47.38, 26.89);
      g.lineTo(45.78, 28.19);
      g.lineTo(43.99, 29.09);
      g.lineTo(42.13, 29.25);
      g.lineTo(40.32, 28.33);
      g.lineTo(38.68, 26);
      g.lineTo(37.08, 23.36);
      g.lineTo(35.35, 21.72);
      g.lineTo(33.48, 20.96);
      g.lineTo(31.52, 20.98);
      g.lineTo(29.48, 21.7);
      g.lineTo(27.38, 23.01);
      g.lineTo(25.25, 24.81);
      g.lineTo(23.1, 27.01);
      g.lineTo(20.98, 28.77);
      g.lineTo(18.97, 29.43);
      g.lineTo(17.16, 29.08);
      g.lineTo(15.64, 27.83);
      g.lineTo(14.5, 25.78);
      g.lineTo(13.84, 23.03);
      g.lineTo(13.74, 19.69);
      g.lineTo(14.29, 15.87);
      g.lineTo(14.01, 15.88);
      g.lineTo(16.43, 15.43);
      g.lineTo(18.7, 14.81);
      g.lineTo(20.7, 14.02);
      g.lineTo(22.35, 13.07);
      g.lineTo(23.52, 11.98);
      g.lineTo(24.13, 10.76);
      g.lineTo(24.05, 9.41);
      g.lineTo(23.2, 7.96);
      g.lineTo(22.04, 6.69);
      g.lineTo(20.82, 5.54);
      g.lineTo(19.57, 4.53);
      g.lineTo(18.3, 3.68);
      g.lineTo(17.02, 2.99);
      g.lineTo(15.73, 2.48);
      g.lineTo(14.46, 2.16);
      g.lineTo(13.21, 2.06);
      g.closePath();
      g.fillPath();

      // shading overlay A (belly shadow)
      g.fillStyle(0x90700e, 0.173);
      g.beginPath();
      g.moveTo(52.59, 23.32);
      g.lineTo(51.89, 24.2);
      g.lineTo(50.85, 25.56);
      g.lineTo(49.55, 27.21);
      g.lineTo(48.08, 28.97);
      g.lineTo(46.52, 30.64);
      g.lineTo(44.96, 32.03);
      g.lineTo(43.49, 32.96);
      g.lineTo(42.2, 33.22);
      g.lineTo(41.02, 33.05);
      g.lineTo(39.99, 32.8);
      g.lineTo(39.09, 32.46);
      g.lineTo(38.28, 32.01);
      g.lineTo(37.54, 31.44);
      g.lineTo(36.82, 30.75);
      g.lineTo(36.1, 29.91);
      g.lineTo(35.35, 28.91);
      g.lineTo(34.58, 27.97);
      g.lineTo(33.79, 27.29);
      g.lineTo(32.99, 26.89);
      g.lineTo(32.15, 26.79);
      g.lineTo(31.26, 26.98);
      g.lineTo(30.31, 27.47);
      g.lineTo(29.29, 28.29);
      g.lineTo(28.17, 29.42);
      g.lineTo(26.96, 30.72);
      g.lineTo(25.67, 32);
      g.lineTo(24.34, 33.2);
      g.lineTo(22.97, 34.29);
      g.lineTo(21.61, 35.2);
      g.lineTo(20.28, 35.89);
      g.lineTo(19, 36.32);
      g.lineTo(17.8, 36.44);
      g.lineTo(16.64, 36.38);
      g.lineTo(15.45, 36.27);
      g.lineTo(14.27, 36.05);
      g.lineTo(13.13, 35.64);
      g.lineTo(12.04, 34.98);
      g.lineTo(11.04, 34.01);
      g.lineTo(10.14, 32.65);
      g.lineTo(9.39, 30.85);
      g.lineTo(9.39, 30.93);
      g.lineTo(9.39, 31.16);
      g.lineTo(9.41, 31.51);
      g.lineTo(9.45, 31.98);
      g.lineTo(9.5, 32.53);
      g.lineTo(9.58, 33.15);
      g.lineTo(9.69, 33.81);
      g.lineTo(9.83, 34.51);
      g.lineTo(9.85, 34.61);
      g.lineTo(9.89, 34.79);
      g.lineTo(9.93, 35.02);
      g.lineTo(9.98, 35.28);
      g.lineTo(10.03, 35.54);
      g.lineTo(10.08, 35.77);
      g.lineTo(10.12, 35.95);
      g.lineTo(10.14, 36.05);
      g.lineTo(11.43, 37.27);
      g.lineTo(13.03, 38.33);
      g.lineTo(14.89, 39.12);
      g.lineTo(16.95, 39.53);
      g.lineTo(19.17, 39.45);
      g.lineTo(21.49, 38.79);
      g.lineTo(23.87, 37.43);
      g.lineTo(26.26, 35.26);
      g.lineTo(28.76, 32.86);
      g.lineTo(30.79, 31.59);
      g.lineTo(32.44, 31.25);
      g.lineTo(33.85, 31.63);
      g.lineTo(35.12, 32.53);
      g.lineTo(36.37, 33.73);
      g.lineTo(37.71, 35.02);
      g.lineTo(39.25, 36.21);
      g.lineTo(40.92, 36.98);
      g.lineTo(42.54, 37.12);
      g.lineTo(44.13, 36.62);
      g.lineTo(45.73, 35.46);
      g.lineTo(47.33, 33.63);
      g.lineTo(48.96, 31.09);
      g.lineTo(50.64, 27.85);
      g.lineTo(52.38, 23.86);
      g.lineTo(52.42, 23.78);
      g.lineTo(52.44, 23.71);
      g.lineTo(52.47, 23.65);
      g.lineTo(52.49, 23.59);
      g.lineTo(52.51, 23.53);
      g.lineTo(52.53, 23.47);
      g.lineTo(52.56, 23.4);
      g.lineTo(52.59, 23.32);
      g.closePath();
      g.fillPath();

      // shading overlay B (scale shading)
      g.fillStyle(0x90700e, 0.173);
      g.beginPath();
      g.moveTo(23.44, 11.51);
      g.lineTo(23.3, 11.49);
      g.lineTo(22.97, 11.54);
      g.lineTo(22.48, 11.67);
      g.lineTo(21.87, 11.85);
      g.lineTo(21.17, 12.06);
      g.lineTo(20.41, 12.29);
      g.lineTo(19.63, 12.52);
      g.lineTo(18.85, 12.74);
      g.lineTo(18.61, 12.76);
      g.lineTo(18.46, 12.68);
      g.lineTo(18.38, 12.52);
      g.lineTo(18.37, 12.33);
      g.lineTo(18.38, 12.13);
      g.lineTo(18.42, 11.95);
      g.lineTo(18.46, 11.81);
      g.lineTo(18.47, 11.76);
      g.lineTo(18.31, 11.82);
      g.lineTo(17.88, 11.95);
      g.lineTo(17.27, 12.14);
      g.lineTo(16.57, 12.35);
      g.lineTo(15.85, 12.55);
      g.lineTo(15.2, 12.72);
      g.lineTo(14.72, 12.81);
      g.lineTo(14.48, 12.8);
      g.lineTo(14.39, 12.7);
      g.lineTo(14.33, 12.54);
      g.lineTo(14.27, 12.34);
      g.lineTo(14.21, 12.13);
      g.lineTo(14.14, 11.93);
      g.lineTo(14.06, 11.76);
      g.lineTo(13.96, 11.64);
      g.lineTo(13.83, 11.59);
      g.lineTo(13.66, 11.61);
      g.lineTo(13.38, 11.68);
      g.lineTo(13.01, 11.77);
      g.lineTo(12.6, 11.88);
      g.lineTo(12.19, 11.99);
      g.lineTo(11.81, 12.09);
      g.lineTo(11.52, 12.17);
      g.lineTo(11.34, 12.21);
      g.lineTo(11.3, 12.24);
      g.lineTo(11.36, 12.3);
      g.lineTo(11.48, 12.38);
      g.lineTo(11.63, 12.48);
      g.lineTo(11.78, 12.57);
      g.lineTo(11.9, 12.66);
      g.lineTo(11.95, 12.73);
      g.lineTo(11.91, 12.77);
      g.lineTo(11.72, 12.82);
      g.lineTo(11.53, 12.87);
      g.lineTo(11.33, 12.93);
      g.lineTo(11.13, 13);
      g.lineTo(10.92, 13.07);
      g.lineTo(10.71, 13.15);
      g.lineTo(10.49, 13.24);
      g.lineTo(10.26, 13.33);
      g.lineTo(10.17, 13.4);
      g.lineTo(10.1, 13.49);
      g.lineTo(10.04, 13.6);
      g.lineTo(10, 13.72);
      g.lineTo(9.95, 13.83);
      g.lineTo(9.9, 13.94);
      g.lineTo(9.83, 14.02);
      g.lineTo(9.74, 14.07);
      g.lineTo(9.59, 14.13);
      g.lineTo(9.48, 14.2);
      g.lineTo(9.4, 14.28);
      g.lineTo(9.34, 14.35);
      g.lineTo(9.28, 14.42);
      g.lineTo(9.21, 14.49);
      g.lineTo(9.11, 14.54);
      g.lineTo(8.97, 14.57);
      g.lineTo(8.62, 14.61);
      g.lineTo(8.27, 14.65);
      g.lineTo(7.92, 14.67);
      g.lineTo(7.58, 14.67);
      g.lineTo(7.26, 14.67);
      g.lineTo(6.94, 14.65);
      g.lineTo(6.65, 14.61);
      g.lineTo(6.38, 14.57);
      g.lineTo(5.66, 14.41);
      g.lineTo(5.03, 14.27);
      g.lineTo(4.5, 14.15);
      g.lineTo(4.04, 14.03);
      g.lineTo(3.66, 13.94);
      g.lineTo(3.34, 13.87);
      g.lineTo(3.07, 13.82);
      g.lineTo(2.83, 13.8);
      g.lineTo(2.78, 13.82);
      g.lineTo(2.75, 13.88);
      g.lineTo(2.74, 13.98);
      g.lineTo(2.76, 14.1);
      g.lineTo(2.8, 14.26);
      g.lineTo(2.87, 14.44);
      g.lineTo(2.96, 14.63);
      g.lineTo(3.07, 14.84);
      g.lineTo(3.07, 14.84);
      g.lineTo(3.07, 14.84);
      g.lineTo(3.07, 14.84);
      g.lineTo(3.08, 14.85);
      g.lineTo(3.08, 14.85);
      g.lineTo(3.08, 14.85);
      g.lineTo(3.08, 14.85);
      g.lineTo(3.08, 14.85);
      g.lineTo(3.08, 14.85);
      g.lineTo(3.09, 14.86);
      g.lineTo(3.09, 14.86);
      g.lineTo(3.1, 14.86);
      g.lineTo(3.1, 14.86);
      g.lineTo(3.11, 14.87);
      g.lineTo(3.11, 14.87);
      g.lineTo(3.11, 14.87);
      g.lineTo(3.24, 14.95);
      g.lineTo(3.38, 15.02);
      g.lineTo(3.51, 15.09);
      g.lineTo(3.66, 15.16);
      g.lineTo(3.8, 15.23);
      g.lineTo(3.95, 15.29);
      g.lineTo(4.1, 15.35);
      g.lineTo(4.26, 15.41);
      g.lineTo(4.26, 15.41);
      g.lineTo(4.27, 15.42);
      g.lineTo(4.27, 15.42);
      g.lineTo(4.27, 15.42);
      g.lineTo(4.28, 15.42);
      g.lineTo(4.28, 15.42);
      g.lineTo(4.28, 15.42);
      g.lineTo(4.28, 15.42);
      g.lineTo(4.29, 15.43);
      g.lineTo(4.3, 15.43);
      g.lineTo(4.3, 15.43);
      g.lineTo(4.31, 15.44);
      g.lineTo(4.32, 15.44);
      g.lineTo(4.32, 15.44);
      g.lineTo(4.33, 15.44);
      g.lineTo(4.34, 15.45);
      g.lineTo(4.34, 15.45);
      g.lineTo(4.34, 15.45);
      g.lineTo(4.35, 15.45);
      g.lineTo(4.35, 15.45);
      g.lineTo(4.35, 15.45);
      g.lineTo(4.35, 15.45);
      g.lineTo(4.36, 15.46);
      g.lineTo(4.36, 15.46);
      g.lineTo(4.52, 15.51);
      g.lineTo(4.68, 15.56);
      g.lineTo(4.84, 15.61);
      g.lineTo(5.01, 15.66);
      g.lineTo(5.18, 15.7);
      g.lineTo(5.36, 15.74);
      g.lineTo(5.53, 15.79);
      g.lineTo(5.71, 15.83);
      g.lineTo(5.72, 15.83);
      g.lineTo(5.73, 15.83);
      g.lineTo(5.74, 15.83);
      g.lineTo(5.75, 15.84);
      g.lineTo(5.76, 15.84);
      g.lineTo(5.77, 15.84);
      g.lineTo(5.78, 15.84);
      g.lineTo(5.79, 15.85);
      g.lineTo(5.8, 15.85);
      g.lineTo(5.81, 15.85);
      g.lineTo(5.81, 15.86);
      g.lineTo(5.82, 15.86);
      g.lineTo(5.83, 15.86);
      g.lineTo(5.84, 15.86);
      g.lineTo(5.85, 15.87);
      g.lineTo(5.85, 15.87);
      g.lineTo(5.86, 15.87);
      g.lineTo(5.87, 15.87);
      g.lineTo(5.87, 15.87);
      g.lineTo(5.88, 15.87);
      g.lineTo(5.89, 15.88);
      g.lineTo(5.89, 15.88);
      g.lineTo(5.9, 15.88);
      g.lineTo(5.91, 15.88);
      g.lineTo(5.98, 15.89);
      g.lineTo(6.05, 15.9);
      g.lineTo(6.12, 15.91);
      g.lineTo(6.19, 15.92);
      g.lineTo(6.27, 15.93);
      g.lineTo(6.34, 15.94);
      g.lineTo(6.41, 15.95);
      g.lineTo(6.48, 15.96);
      g.lineTo(6.49, 15.96);
      g.lineTo(6.49, 15.96);
      g.lineTo(6.49, 15.96);
      g.lineTo(6.5, 15.96);
      g.lineTo(6.5, 15.96);
      g.lineTo(6.51, 15.96);
      g.lineTo(6.51, 15.97);
      g.lineTo(6.51, 15.97);
      g.lineTo(6.86, 16.02);
      g.lineTo(7.22, 16.06);
      g.lineTo(7.57, 16.1);
      g.lineTo(7.94, 16.14);
      g.lineTo(8.31, 16.16);
      g.lineTo(8.69, 16.18);
      g.lineTo(9.08, 16.2);
      g.lineTo(9.47, 16.2);
      g.lineTo(9.46, 16.3);
      g.lineTo(9.43, 16.53);
      g.lineTo(9.38, 16.88);
      g.lineTo(9.31, 17.33);
      g.lineTo(9.24, 17.86);
      g.lineTo(9.16, 18.48);
      g.lineTo(9.07, 19.15);
      g.lineTo(8.97, 19.88);
      g.lineTo(8.97, 19.88);
      g.lineTo(8.97, 19.89);
      g.lineTo(8.97, 19.89);
      g.lineTo(8.97, 19.9);
      g.lineTo(8.97, 19.9);
      g.lineTo(8.97, 19.91);
      g.lineTo(8.96, 19.91);
      g.lineTo(8.96, 19.92);
      g.lineTo(8.96, 19.93);
      g.lineTo(8.96, 19.94);
      g.lineTo(8.96, 19.95);
      g.lineTo(8.96, 19.96);
      g.lineTo(8.96, 19.97);
      g.lineTo(8.96, 19.99);
      g.lineTo(8.95, 20);
      g.lineTo(8.95, 20.01);
      g.lineTo(8.99, 19.96);
      g.lineTo(9.1, 19.82);
      g.lineTo(9.28, 19.6);
      g.lineTo(9.5, 19.32);
      g.lineTo(9.77, 19);
      g.lineTo(10.08, 18.65);
      g.lineTo(10.4, 18.28);
      g.lineTo(10.74, 17.92);
      g.lineTo(10.86, 17.79);
      g.lineTo(10.98, 17.67);
      g.lineTo(11.1, 17.55);
      g.lineTo(11.22, 17.44);
      g.lineTo(11.33, 17.33);
      g.lineTo(11.45, 17.22);
      g.lineTo(11.56, 17.12);
      g.lineTo(11.67, 17.03);
      g.lineTo(12, 16.9);
      g.lineTo(12.31, 17.01);
      g.lineTo(12.62, 17.28);
      g.lineTo(12.91, 17.65);
      g.lineTo(13.17, 18.04);
      g.lineTo(13.41, 18.39);
      g.lineTo(13.62, 18.61);
      g.lineTo(13.78, 18.63);
      g.lineTo(13.82, 18.6);
      g.lineTo(13.84, 18.54);
      g.lineTo(13.86, 18.46);
      g.lineTo(13.87, 18.36);
      g.lineTo(13.89, 18.23);
      g.lineTo(13.9, 18.07);
      g.lineTo(13.92, 17.87);
      g.lineTo(13.96, 17.63);
      g.lineTo(13.98, 17.46);
      g.lineTo(14.01, 17.3);
      g.lineTo(14.03, 17.15);
      g.lineTo(14.05, 17.01);
      g.lineTo(14.08, 16.89);
      g.lineTo(14.1, 16.77);
      g.lineTo(14.13, 16.67);
      g.lineTo(14.16, 16.57);
      g.lineTo(14.16, 16.57);
      g.lineTo(14.17, 16.58);
      g.lineTo(14.17, 16.58);
      g.lineTo(14.17, 16.58);
      g.lineTo(14.18, 16.59);
      g.lineTo(14.18, 16.59);
      g.lineTo(14.18, 16.59);
      g.lineTo(14.18, 16.59);
      g.lineTo(14.2, 16.5);
      g.lineTo(14.21, 16.41);
      g.lineTo(14.23, 16.32);
      g.lineTo(14.24, 16.23);
      g.lineTo(14.25, 16.14);
      g.lineTo(14.26, 16.05);
      g.lineTo(14.27, 15.96);
      g.lineTo(14.29, 15.87);
      g.lineTo(14.01, 15.88);
      g.lineTo(15.46, 15.64);
      g.lineTo(16.87, 15.33);
      g.lineTo(18.21, 14.95);
      g.lineTo(19.47, 14.52);
      g.lineTo(20.62, 14.03);
      g.lineTo(21.65, 13.48);
      g.lineTo(22.53, 12.89);
      g.lineTo(23.24, 12.24);
      g.lineTo(23.28, 12.13);
      g.lineTo(23.31, 12.01);
      g.lineTo(23.35, 11.9);
      g.lineTo(23.38, 11.79);
      g.lineTo(23.41, 11.7);
      g.lineTo(23.43, 11.62);
      g.lineTo(23.44, 11.55);
      g.lineTo(23.44, 11.51);
      g.closePath();
      g.fillPath();

      // ridge / spine highlight line
      g.fillStyle(0x69663d);
      g.beginPath();
      g.moveTo(4.63, 11.61);
      g.lineTo(5.01, 12);
      g.lineTo(5.54, 12.24);
      g.lineTo(6.17, 12.36);
      g.lineTo(6.85, 12.39);
      g.lineTo(7.54, 12.35);
      g.lineTo(8.18, 12.27);
      g.lineTo(8.71, 12.17);
      g.lineTo(9.09, 12.08);
      g.lineTo(9.65, 11.95);
      g.lineTo(10.2, 11.82);
      g.lineTo(10.75, 11.7);
      g.lineTo(11.29, 11.59);
      g.lineTo(11.83, 11.48);
      g.lineTo(12.38, 11.38);
      g.lineTo(12.93, 11.28);
      g.lineTo(13.5, 11.17);
      g.lineTo(14.13, 11.06);
      g.lineTo(14.74, 10.97);
      g.lineTo(15.33, 10.88);
      g.lineTo(15.92, 10.8);
      g.lineTo(16.5, 10.72);
      g.lineTo(17.08, 10.65);
      g.lineTo(17.66, 10.58);
      g.lineTo(18.25, 10.5);
      g.lineTo(18.6, 10.45);
      g.lineTo(19.02, 10.37);
      g.lineTo(19.5, 10.26);
      g.lineTo(19.98, 10.12);
      g.lineTo(20.44, 9.94);
      g.lineTo(20.85, 9.73);
      g.lineTo(21.18, 9.47);
      g.lineTo(21.38, 9.16);
      g.lineTo(21.4, 9.12);
      g.lineTo(21.39, 9.15);
      g.lineTo(21.35, 9.24);
      g.lineTo(21.3, 9.37);
      g.lineTo(21.24, 9.52);
      g.lineTo(21.17, 9.67);
      g.lineTo(21.11, 9.81);
      g.lineTo(21.05, 9.92);
      g.lineTo(20.96, 10.09);
      g.lineTo(20.87, 10.24);
      g.lineTo(20.77, 10.38);
      g.lineTo(20.66, 10.51);
      g.lineTo(20.54, 10.63);
      g.lineTo(20.41, 10.75);
      g.lineTo(20.25, 10.86);
      g.lineTo(20.08, 10.97);
      g.lineTo(19.59, 11.23);
      g.lineTo(19.07, 11.48);
      g.lineTo(18.51, 11.71);
      g.lineTo(17.95, 11.92);
      g.lineTo(17.38, 12.11);
      g.lineTo(16.82, 12.29);
      g.lineTo(16.28, 12.44);
      g.lineTo(15.77, 12.57);
      g.lineTo(15.11, 12.72);
      g.lineTo(14.46, 12.84);
      g.lineTo(13.81, 12.94);
      g.lineTo(13.17, 13.01);
      g.lineTo(12.51, 13.06);
      g.lineTo(11.84, 13.11);
      g.lineTo(11.16, 13.15);
      g.lineTo(10.45, 13.18);
      g.lineTo(10.04, 13.22);
      g.lineTo(9.63, 13.28);
      g.lineTo(9.22, 13.35);
      g.lineTo(8.82, 13.42);
      g.lineTo(8.42, 13.48);
      g.lineTo(8.03, 13.51);
      g.lineTo(7.64, 13.5);
      g.lineTo(7.24, 13.44);
      g.lineTo(6.88, 13.36);
      g.lineTo(6.56, 13.27);
      g.lineTo(6.27, 13.18);
      g.lineTo(6, 13.08);
      g.lineTo(5.76, 12.97);
      g.lineTo(5.53, 12.83);
      g.lineTo(5.32, 12.67);
      g.lineTo(5.12, 12.48);
      g.fillPath();

      // tongue (coral red, forked)
      g.fillStyle(0xfc6650);
      g.beginPath();
      g.moveTo(11.87, 12.35);
      g.lineTo(14.05, 12.03);
      g.lineTo(14.56, 13.57);
      g.lineTo(15.41, 14.92);
      g.lineTo(16.49, 16.09);
      g.lineTo(17.69, 17.08);
      g.lineTo(18.9, 17.87);
      g.lineTo(19.99, 18.47);
      g.lineTo(20.86, 18.87);
      g.lineTo(21.38, 19.07);
      g.lineTo(21.21, 19.27);
      g.lineTo(20.82, 19.33);
      g.lineTo(20.3, 19.27);
      g.lineTo(19.72, 19.13);
      g.lineTo(19.13, 18.97);
      g.lineTo(18.63, 18.81);
      g.lineTo(18.27, 18.71);
      g.lineTo(18.14, 18.7);
      g.lineTo(18.2, 19);
      g.lineTo(18.37, 19.39);
      g.lineTo(18.61, 19.82);
      g.lineTo(18.9, 20.26);
      g.lineTo(19.18, 20.67);
      g.lineTo(19.43, 21.01);
      g.lineTo(19.61, 21.25);
      g.lineTo(19.67, 21.33);
      g.lineTo(18.57, 20.81);
      g.lineTo(17.29, 19.85);
      g.lineTo(15.94, 18.58);
      g.lineTo(14.63, 17.13);
      g.lineTo(13.45, 15.66);
      g.lineTo(12.53, 14.28);
      g.lineTo(11.97, 13.13);
      g.lineTo(11.87, 12.35);
      g.closePath();
      g.fillPath();

      // tongue shading (motion blur)
      g.fillStyle(0xa64234, 0.337);
      g.beginPath();
      g.moveTo(11.88, 12.35);
      g.lineTo(14.06, 12.03);
      g.lineTo(14.08, 12.14);
      g.lineTo(14.11, 12.27);
      g.lineTo(14.15, 12.41);
      g.lineTo(14.2, 12.56);
      g.lineTo(14.25, 12.72);
      g.lineTo(14.3, 12.88);
      g.lineTo(14.35, 13.04);
      g.lineTo(14.4, 13.2);
      g.lineTo(14.52, 13.49);
      g.lineTo(14.67, 13.79);
      g.lineTo(14.83, 14.08);
      g.lineTo(15, 14.34);
      g.lineTo(15.15, 14.57);
      g.lineTo(15.28, 14.75);
      g.lineTo(15.36, 14.87);
      g.lineTo(15.39, 14.91);
      g.lineTo(15.37, 14.9);
      g.lineTo(15.3, 14.83);
      g.lineTo(15.2, 14.7);
      g.lineTo(15.07, 14.53);
      g.lineTo(14.93, 14.32);
      g.lineTo(14.77, 14.08);
      g.lineTo(14.61, 13.82);
      g.lineTo(14.45, 13.54);
      g.lineTo(14.36, 13.37);
      g.lineTo(14.28, 13.2);
      g.lineTo(14.2, 13.02);
      g.lineTo(14.13, 12.85);
      g.lineTo(14.07, 12.7);
      g.lineTo(14.02, 12.55);
      g.lineTo(13.99, 12.43);
      g.lineTo(13.97, 12.34);
      g.lineTo(13.49, 12.44);
      g.lineTo(13.5, 12.54);
      g.lineTo(13.54, 12.7);
      g.lineTo(13.61, 12.91);
      g.lineTo(13.7, 13.16);
      g.lineTo(13.81, 13.45);
      g.lineTo(13.94, 13.75);
      g.lineTo(14.09, 14.06);
      g.lineTo(14.24, 14.38);
      g.lineTo(14.45, 14.77);
      g.lineTo(14.7, 15.17);
      g.lineTo(14.95, 15.57);
      g.lineTo(15.2, 15.93);
      g.lineTo(15.42, 16.25);
      g.lineTo(15.6, 16.49);
      g.lineTo(15.71, 16.64);
      g.lineTo(15.74, 16.68);
      g.lineTo(15.66, 16.6);
      g.lineTo(15.49, 16.42);
      g.lineTo(15.27, 16.17);
      g.lineTo(15.01, 15.86);
      g.lineTo(14.73, 15.52);
      g.lineTo(14.44, 15.16);
      g.lineTo(14.18, 14.79);
      g.lineTo(13.95, 14.44);
      g.lineTo(13.79, 14.19);
      g.lineTo(13.65, 13.92);
      g.lineTo(13.53, 13.67);
      g.lineTo(13.42, 13.42);
      g.lineTo(13.33, 13.19);
      g.lineTo(13.26, 12.98);
      g.lineTo(13.21, 12.8);
      g.lineTo(13.19, 12.65);
      g.lineTo(12.53, 12.79);
      g.lineTo(12.55, 13.05);
      g.lineTo(12.69, 13.46);
      g.lineTo(12.93, 13.96);
      g.lineTo(13.21, 14.49);
      g.lineTo(13.5, 14.99);
      g.lineTo(13.76, 15.42);
      g.lineTo(13.94, 15.72);
      g.lineTo(14.01, 15.84);
      g.lineTo(14.14, 15.98);
      g.lineTo(14.4, 16.32);
      g.lineTo(14.76, 16.8);
      g.lineTo(15.15, 17.34);
      g.lineTo(15.54, 17.87);
      g.lineTo(15.86, 18.33);
      g.lineTo(16.07, 18.65);
      g.lineTo(16.12, 18.75);
      g.lineTo(15.91, 18.56);
      g.lineTo(15.54, 18.17);
      g.lineTo(15.05, 17.63);
      g.lineTo(14.49, 16.98);
      g.lineTo(13.92, 16.29);
      g.lineTo(13.38, 15.6);
      g.lineTo(12.92, 14.96);
      g.lineTo(12.6, 14.43);
      g.lineTo(12.42, 14.1);
      g.lineTo(12.26, 13.77);
      g.lineTo(12.12, 13.45);
      g.lineTo(12, 13.16);
      g.lineTo(11.92, 12.89);
      g.lineTo(11.86, 12.67);
      g.lineTo(11.85, 12.48);
      g.lineTo(11.88, 12.35);
      g.closePath();
      g.fillPath();

      // white highlight A (snout)
      g.fillStyle(0xffffff);
      g.beginPath();
      g.moveTo(16.47, 11.58);
      g.lineTo(18.32, 11.23);
      g.lineTo(18.32, 11.33);
      g.lineTo(18.32, 11.61);
      g.lineTo(18.31, 11.99);
      g.lineTo(18.28, 12.44);
      g.lineTo(18.24, 12.89);
      g.lineTo(18.17, 13.29);
      g.lineTo(18.07, 13.58);
      g.lineTo(17.95, 13.72);
      g.lineTo(17.8, 13.77);
      g.lineTo(17.64, 13.83);
      g.lineTo(17.47, 13.84);
      g.lineTo(17.3, 13.76);
      g.lineTo(17.11, 13.54);
      g.lineTo(16.91, 13.14);
      g.lineTo(16.7, 12.5);
      g.lineTo(16.47, 11.58);
      g.closePath();
      g.fillPath();

      // white highlight B (cheek)
      g.fillStyle(0xffffff);
      g.beginPath();
      g.moveTo(8.17, 12.96);
      g.lineTo(8.2, 12.96);
      g.lineTo(8.28, 12.95);
      g.lineTo(8.4, 12.93);
      g.lineTo(8.55, 12.91);
      g.lineTo(8.74, 12.87);
      g.lineTo(8.95, 12.84);
      g.lineTo(9.17, 12.8);
      g.lineTo(9.39, 12.76);
      g.lineTo(9.55, 12.73);
      g.lineTo(9.71, 12.69);
      g.lineTo(9.86, 12.66);
      g.lineTo(10, 12.63);
      g.lineTo(10.12, 12.61);
      g.lineTo(10.22, 12.6);
      g.lineTo(10.29, 12.61);
      g.lineTo(10.33, 12.64);
      g.lineTo(10.36, 12.78);
      g.lineTo(10.38, 13.02);
      g.lineTo(10.38, 13.31);
      g.lineTo(10.37, 13.63);
      g.lineTo(10.35, 13.94);
      g.lineTo(10.33, 14.2);
      g.lineTo(10.32, 14.38);
      g.lineTo(10.31, 14.45);
      g.lineTo(10.29, 14.51);
      g.lineTo(10.24, 14.66);
      g.lineTo(10.14, 14.85);
      g.lineTo(9.99, 15.03);
      g.lineTo(9.8, 15.14);
      g.lineTo(9.56, 15.13);
      g.lineTo(9.26, 14.95);
      g.lineTo(8.91, 14.55);
      g.lineTo(8.59, 14.08);
      g.lineTo(8.36, 13.71);
      g.lineTo(8.21, 13.44);
      g.lineTo(8.13, 13.24);
      g.lineTo(8.11, 13.11);
      g.lineTo(8.11, 13.03);
      g.lineTo(8.14, 12.99);
      g.lineTo(8.17, 12.96);
      g.closePath();
      g.fillPath();

      // eye 1 sclera (white)
      g.fillStyle(0xffffff);
      g.beginPath();
      g.moveTo(5.33, 6.28);
      g.lineTo(5.31, 5.56);
      g.lineTo(5.34, 4.89);
      g.lineTo(5.43, 4.28);
      g.lineTo(5.58, 3.74);
      g.lineTo(5.82, 3.29);
      g.lineTo(6.15, 2.92);
      g.lineTo(6.59, 2.65);
      g.lineTo(7.14, 2.49);
      g.lineTo(7.71, 2.49);
      g.lineTo(8.2, 2.68);
      g.lineTo(8.6, 3.04);
      g.lineTo(8.93, 3.54);
      g.lineTo(9.19, 4.14);
      g.lineTo(9.37, 4.82);
      g.lineTo(9.49, 5.55);
      g.lineTo(9.56, 6.3);
      g.lineTo(9.56, 7.05);
      g.lineTo(9.51, 7.78);
      g.lineTo(9.4, 8.47);
      g.lineTo(9.23, 9.09);
      g.lineTo(8.99, 9.62);
      g.lineTo(8.69, 10.03);
      g.lineTo(8.33, 10.31);
      g.lineTo(7.9, 10.42);
      g.lineTo(7.43, 10.34);
      g.lineTo(6.98, 10.08);
      g.lineTo(6.56, 9.66);
      g.lineTo(6.18, 9.12);
      g.lineTo(5.85, 8.48);
      g.lineTo(5.59, 7.78);
      g.lineTo(5.41, 7.04);
      g.lineTo(5.33, 6.28);
      g.closePath();
      g.fillPath();

      // eye 1 pupil (dark)
      g.fillStyle(0x69663d);
      g.beginPath();
      g.moveTo(7.07, 6.96);
      g.lineTo(7.03, 6.51);
      g.lineTo(7.02, 6.11);
      g.lineTo(7.05, 5.77);
      g.lineTo(7.11, 5.5);
      g.lineTo(7.19, 5.27);
      g.lineTo(7.28, 5.11);
      g.lineTo(7.38, 4.99);
      g.lineTo(7.49, 4.93);
      g.lineTo(7.6, 4.92);
      g.lineTo(7.73, 4.96);
      g.lineTo(7.86, 5.05);
      g.lineTo(7.99, 5.19);
      g.lineTo(8.12, 5.41);
      g.lineTo(8.23, 5.69);
      g.lineTo(8.33, 6.05);
      g.lineTo(8.41, 6.49);
      g.lineTo(8.46, 6.98);
      g.lineTo(8.49, 7.47);
      g.lineTo(8.48, 7.94);
      g.lineTo(8.46, 8.38);
      g.lineTo(8.42, 8.77);
      g.lineTo(8.35, 9.1);
      g.lineTo(8.28, 9.34);
      g.lineTo(8.19, 9.48);
      g.lineTo(8.07, 9.5);
      g.lineTo(7.93, 9.37);
      g.lineTo(7.77, 9.13);
      g.lineTo(7.6, 8.8);
      g.lineTo(7.44, 8.39);
      g.lineTo(7.29, 7.94);
      g.lineTo(7.16, 7.45);
      g.lineTo(7.07, 6.96);
      g.closePath();
      g.fillPath();

      // eye 2 sclera (white)
      g.fillStyle(0xffffff);
      g.beginPath();
      g.moveTo(13.93, 5.23);
      g.lineTo(13.91, 4.5);
      g.lineTo(13.91, 3.82);
      g.lineTo(13.95, 3.2);
      g.lineTo(14.05, 2.64);
      g.lineTo(14.22, 2.16);
      g.lineTo(14.49, 1.78);
      g.lineTo(14.86, 1.49);
      g.lineTo(15.36, 1.33);
      g.lineTo(15.92, 1.36);
      g.lineTo(16.44, 1.66);
      g.lineTo(16.91, 2.17);
      g.lineTo(17.32, 2.82);
      g.lineTo(17.66, 3.59);
      g.lineTo(17.91, 4.41);
      g.lineTo(18.07, 5.22);
      g.lineTo(18.12, 5.99);
      g.lineTo(18.09, 6.69);
      g.lineTo(18.02, 7.32);
      g.lineTo(17.91, 7.88);
      g.lineTo(17.75, 8.35);
      g.lineTo(17.54, 8.74);
      g.lineTo(17.27, 9.03);
      g.lineTo(16.93, 9.22);
      g.lineTo(16.54, 9.3);
      g.lineTo(16.1, 9.22);
      g.lineTo(15.65, 8.97);
      g.lineTo(15.23, 8.56);
      g.lineTo(14.83, 8.04);
      g.lineTo(14.49, 7.41);
      g.lineTo(14.21, 6.72);
      g.lineTo(14.02, 5.98);
      g.lineTo(13.93, 5.23);
      g.closePath();
      g.fillPath();

      // eye 2 pupil (dark)
      g.fillStyle(0x69663d);
      g.beginPath();
      g.moveTo(15.12, 5.9);
      g.lineTo(15.06, 5.44);
      g.lineTo(15.02, 5.04);
      g.lineTo(14.99, 4.69);
      g.lineTo(15, 4.4);
      g.lineTo(15.03, 4.16);
      g.lineTo(15.11, 3.98);
      g.lineTo(15.23, 3.85);
      g.lineTo(15.41, 3.78);
      g.lineTo(15.61, 3.78);
      g.lineTo(15.78, 3.86);
      g.lineTo(15.94, 4.02);
      g.lineTo(16.08, 4.26);
      g.lineTo(16.2, 4.55);
      g.lineTo(16.3, 4.91);
      g.lineTo(16.39, 5.33);
      g.lineTo(16.46, 5.79);
      g.lineTo(16.5, 6.26);
      g.lineTo(16.52, 6.69);
      g.lineTo(16.5, 7.09);
      g.lineTo(16.47, 7.44);
      g.lineTo(16.42, 7.75);
      g.lineTo(16.35, 8);
      g.lineTo(16.27, 8.19);
      g.lineTo(16.18, 8.31);
      g.lineTo(16.08, 8.33);
      g.lineTo(15.94, 8.22);
      g.lineTo(15.78, 8);
      g.lineTo(15.62, 7.68);
      g.lineTo(15.46, 7.29);
      g.lineTo(15.32, 6.85);
      g.lineTo(15.2, 6.38);
      g.lineTo(15.12, 5.9);
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
