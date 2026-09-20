// ─── Boot: рисуем все текстуры и уходим в игру ───────────────────────────────
import { buildTextures } from '../objects/textures.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    buildTextures(this);
    this.game.events.emit('square-booted');
    this.scene.start('game');
    this.scene.launch('ui');
  }
}
