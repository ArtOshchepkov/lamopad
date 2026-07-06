// ─── Точка входа: Phaser + связка с DOM-оверлеями и звуком ───────────────────
import { CONF } from './config.js';
import { BootScene } from './scenes/boot.js';
import { GameScene } from './scenes/game.js';
import { UIScene } from './scenes/ui.js';

// Телефоны: подгоняем высоту поля под реальный вьюпорт, иначе FIT оставляет
// поля по бокам. Ширина мира не меняется — геймплей одинаковый. Страница не
// скроллится, панели браузера не прячутся, поэтому меряем окно, а не экран;
// в горизонтальной ориентации нормируем к портрету (играть лёжа не советуем)
const vw = window.innerWidth, vh = window.innerHeight;
const aspect = Math.min(vw, vh) / Math.max(vw, vh);
CONF.height = Phaser.Math.Clamp(Math.round(CONF.width / aspect), 780, 1150);

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
let fsMuted = load(CONF.storage.fsDisabled);

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

// ─── Стартовый экран: звук, полноэкранный режим, ориентация ─────────────────
const startOverlay = $('start');
const optMusic = $('opt-music');
const optSfx = $('opt-sfx');
const optFs = $('opt-fs');
optMusic.classList.toggle('off', musicMuted);
optSfx.classList.toggle('off', sfxMuted);
optFs.classList.toggle('off', fsMuted);
[optMusic, optSfx, optFs].forEach((b) =>
  b.addEventListener('click', () => b.classList.toggle('off')));

// полноэкранный режим не везде есть (iPhone — нет): прячем тумблер
const docEl = document.documentElement;
const requestFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
if (!requestFs) optFs.classList.add('hidden');

// в горизонтальной ориентации советуем перевернуть
const orientHint = $('orient-hint');
const updateOrient = () => {
  orientHint.classList.toggle('hidden', window.innerHeight >= window.innerWidth);
};
updateOrient();
window.addEventListener('resize', updateOrient);

$('start-btn').addEventListener('click', () => {
  musicMuted = optMusic.classList.contains('off');
  sfxMuted = optSfx.classList.contains('off');
  fsMuted = optFs.classList.contains('off');
  save(CONF.storage.muted, musicMuted);
  save(CONF.storage.sfxMuted, sfxMuted);
  save(CONF.storage.fsDisabled, fsMuted);
  renderMute();
  if (requestFs && !optFs.classList.contains('off')) {
    try { requestFs.call(docEl).catch(() => {}); } catch (e) { /* не судьба */ }
  }
  // взлёт: очки прыгают, экран уносится вверх — и открывается офис
  startOverlay.classList.add('takeoff');
  setTimeout(() => {
    startOverlay.classList.add('hidden');
    window.__scgReady = true; // теперь тап/клавиша запускают забег
  }, 850);
  // клик — жест пользователя: сразу разлочиваем музыку
  if (!musicMuted) audio.play().catch(() => {});
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
  lightning: 'Зашибло молнией ⚡',
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

// «добавить трек к себе» → экран благодарности с площадками
const platformsOverlay = $('platforms');
$('death-save').addEventListener('click', () => platformsOverlay.classList.remove('hidden'));
$('plat-close').addEventListener('click', () => platformsOverlay.classList.add('hidden'));

// «хочу игру под свой трек» → контакты
const orderOverlay = $('order');
$('order-open').addEventListener('click', () => orderOverlay.classList.remove('hidden'));
$('order-close').addEventListener('click', () => orderOverlay.classList.add('hidden'));

// тексты, контакты и почта-с-копированием — общий модуль /lib/order-widget.js
LamopadOrder.fill({
  openBtn: $('order-open'),
  title:   $('order-title'),
  text:    $('order-text'),
  mail:    $('order-mail'),
  tg:      $('order-tg'),
  games:   $('order-games'),
}, { ghClass: 'order-gh' });
LamopadOrder.bindMailCopy($('order-mail'));

// для отладки в консоли
window.__scg = game;
