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
const muteMusicBtn = $('mute-music');
const muteSfxBtn = $('mute-sfx');

game.events.once('scg-booted', () => {
  loading.classList.add('hidden');
});

// ─── Звук: музыка (стрим <audio>) и SFX (Phaser) мутятся независимо ──────────
const load = (key) => {
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
};
const save = (key, v) => {
  try { localStorage.setItem(key, v ? '1' : '0'); } catch (e) { /* ок */ }
};
let musicMuted = load(CONF.storage.muted);
let sfxMuted = load(CONF.storage.sfxMuted);

function renderMute() {
  muteMusicBtn.classList.toggle('off', musicMuted);
  muteMusicBtn.setAttribute('aria-label', musicMuted ? 'Включить музыку' : 'Выключить музыку');
  muteSfxBtn.classList.toggle('off', sfxMuted);
  muteSfxBtn.setAttribute('aria-label', sfxMuted ? 'Включить звуки' : 'Выключить звуки');
  audio.muted = musicMuted;
  game.sound.mute = sfxMuted;
}
renderMute();

muteMusicBtn.addEventListener('click', () => {
  musicMuted = !musicMuted;
  save(CONF.storage.muted, musicMuted);
  renderMute();
  if (!musicMuted && audio.paused) audio.play().catch(() => {});
});

muteSfxBtn.addEventListener('click', () => {
  sfxMuted = !sfxMuted;
  save(CONF.storage.sfxMuted, sfxMuted);
  renderMute();
});

game.events.on('scg-start', () => {
  if (audio.paused) audio.play().catch(() => {});
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.pause();
  // возобновляем, только если трек уже был запущен жестом игрока
  else if (!musicMuted && audio.currentTime > 0) audio.play().catch(() => {});
});

// ─── Экран смерти ────────────────────────────────────────────────────────────
const DEATH_REASONS = {
  croc: 'Съеден крокодилом 🐊',
  snake: 'Проглочен крайтом 🐍',
  suitcase: 'Поверил чемодану 🧳',
  fall: 'Просто закис',
};

game.events.on('scg-death', ({ height, best, isNew, cause }) => {
  $('death-reason').textContent = DEATH_REASONS[cause] || DEATH_REASONS.fall;
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
