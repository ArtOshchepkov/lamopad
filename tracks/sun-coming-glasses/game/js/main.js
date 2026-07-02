// ─── Точка входа: Phaser + связка с DOM-оверлеями и звуком ───────────────────
import { CONF } from './config.js';
import { BootScene } from './scenes/boot.js';
import { GameScene } from './scenes/game.js';
import { UIScene } from './scenes/ui.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CONF.width,
  height: CONF.height,
  backgroundColor: '#3b3b46',
  scene: [BootScene, GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, roundPixels: false },
});

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const loading = $('loading');
const deathOverlay = $('death');
const audio = $('track');
const muteBtn = $('mute');

game.events.once('scg-booted', () => {
  loading.classList.add('hidden');
});

// ─── Звук: трек стримится обычным <audio>, разлочка первым жестом ────────────
let muted = false;
try { muted = localStorage.getItem(CONF.storage.muted) === '1'; } catch (e) { /* ок */ }

function renderMute() {
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', muted ? 'Включить музыку' : 'Выключить музыку');
  audio.muted = muted;
}
renderMute();

muteBtn.addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem(CONF.storage.muted, muted ? '1' : '0'); } catch (e) { /* ок */ }
  renderMute();
  if (!muted && audio.paused) audio.play().catch(() => {});
});

game.events.on('scg-start', () => {
  if (audio.paused) audio.play().catch(() => {});
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.pause();
  // возобновляем, только если трек уже был запущен жестом игрока
  else if (!muted && audio.currentTime > 0) audio.play().catch(() => {});
});

// ─── Экран смерти ────────────────────────────────────────────────────────────
game.events.on('scg-death', ({ height, best, isNew }) => {
  $('death-height').textContent = height + ' м';
  $('death-best').textContent = 'рекорд · ' + best + ' м';
  $('death-new').classList.toggle('hidden', !isNew);
  deathOverlay.classList.remove('hidden');
});

$('restart').addEventListener('click', () => {
  deathOverlay.classList.add('hidden');
  game.scene.getScene('game').scene.restart();
  game.scene.getScene('ui').scene.restart();
});

// для отладки в консоли
window.__scg = game;
