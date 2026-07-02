// ─── Boot: шрифты + процедурные текстуры, затем запуск игры ──────────────────
import { CONF } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

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
    // Очки-герой: красная оправа, звезда, дужки-ножки зигзагом
    this.tex('glasses', CONF.player.texW, CONF.player.texH, (g) => {
      // ножки
      g.lineStyle(5, 0xff2f23);
      g.beginPath(); g.moveTo(20, 30); g.lineTo(13, 43); g.lineTo(22, 56); g.strokePath();
      g.beginPath(); g.moveTo(46, 28); g.lineTo(53, 41); g.lineTo(43, 56); g.strokePath();
      // конверсы
      g.fillStyle(0xd41f1f); g.fillEllipse(21, 57, 13, 6); g.fillEllipse(44, 57, 13, 6);
      g.fillStyle(0xffffff); g.fillEllipse(19, 58.5, 8, 3); g.fillEllipse(42, 58.5, 8, 3);
      // переносица
      g.lineStyle(6, 0xff2f23);
      g.beginPath(); g.moveTo(26, 15); g.lineTo(38, 11); g.strokePath();
      // линзы
      g.fillStyle(0x4a0f1d); g.lineStyle(6, 0xff2f23);
      g.fillCircle(18, 19, 12); g.strokeCircle(18, 19, 12);
      g.fillCircle(46, 15, 14); g.strokeCircle(46, 15, 14);
      // блики
      g.fillStyle(0xffffff, 0.95); g.fillEllipse(14, 15, 8, 5); g.fillEllipse(41, 10, 10, 6);
      // звезда на левой линзе
      g.fillStyle(0xffd000);
      g.beginPath();
      g.moveTo(6, 8); g.lineTo(9, 14); g.lineTo(15, 16); g.lineTo(10, 19); g.lineTo(8, 25);
      g.lineTo(4, 19); g.lineTo(-1, 16); g.lineTo(4, 14); g.closePath(); g.fillPath();
    });

    // Облака собираются из кругов разного размера: низ — бугристый,
    // разной глубины, чтобы силуэт был кучевым, а не ровным.

    // Облако А: классическое пухлое
    this.tex('p-cloud-a', 96, 30, (g) => {
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
    this.tex('p-cloud-b', 116, 26, (g) => {
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
    this.tex('p-cloud-c', 72, 30, (g) => {
      g.fillStyle(0x2a0d3e, 0.35); g.fillEllipse(36, 27, 44, 5);
      g.fillStyle(0xcdb4e8);
      g.fillCircle(18, 19, 9); g.fillCircle(36, 20, 9); g.fillCircle(52, 18, 8);
      g.fillStyle(0xf6eeff);
      g.fillCircle(20, 11, 11); g.fillCircle(44, 10, 12); g.fillCircle(58, 14, 7);
      g.fillStyle(0xffffff, 0.95);
      g.fillEllipse(20, 4, 12, 5); g.fillEllipse(46, 3, 13, 5);
    });

    // Стесняшка-закатик: тёплое румяное облачко
    this.tex('p-sunset', 86, 32, (g) => {
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

    // Сизифова гора (силуэт)
    this.tex('mountain', 190, 150, (g) => {
      g.fillStyle(0x140a28);
      g.beginPath();
      g.moveTo(0, 150); g.lineTo(38, 78); g.lineTo(58, 96);
      g.lineTo(103, 8); g.lineTo(132, 60); g.lineTo(150, 42);
      g.lineTo(190, 150); g.closePath(); g.fillPath();
      g.fillStyle(0x2a1a48); // снежная шапка чуть светлее
      g.fillTriangle(103, 8, 92, 30, 114, 30);
    });

    this.tex('boulder', 14, 14, (g) => {
      g.fillStyle(0xffffff); g.fillCircle(7, 7, 6.5);
    });

    this.tex('dot', 4, 4, (g) => {
      g.fillStyle(0xffffff); g.fillCircle(2, 2, 2);
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
}
