// ─── Точка входа: доска панелей + Phaser + DOM-оверлеи + звук ────────────────
// Страница — четыре мини-игры сразу; расклад и общий ввод живут в board.js,
// здесь только большая панель на Phaser, общий стартовый экран и звук.
import { startAccessRoulette } from './access.js';
import { Beat } from './beat.js';
import { mountBoard } from './board.js';
import { CONF } from './config.js';
import { Debug } from './debug.js';
import { Sfx } from './sfx.js';
import { TripPipeline } from './trip-pipeline.js';
import { BootScene } from './scenes/boot.js';
import { GameScene } from './scenes/game.js';
import { UIScene } from './scenes/ui.js';

Debug.init();
const board = mountBoard();

// Поле подгоняем под вьюпорт на момент загрузки: тянем ту сторону, которой
// у экрана в избытке, — тогда FIT не оставит чёрных полей ни в портрете, ни
// в ландшафте. На широком растёт ширина: плита и толпа становятся длиннее,
// пропасть остаётся прежней. На высоком растёт высота — это просто небо.
// Меряем свою панель доски, а не окно: сцена живёт в четверти экрана.
const pane = document.getElementById('pane-square');
const vw = pane.clientWidth, vh = pane.clientHeight;
const aspect = vw / vh;
// В портрете мир 960 шириной растягивается по высоте до двух тысяч пикселей,
// и телефон честно рисует эту прорву пустого неба — кадры падают вдвое.
// Поэтому для узких экранов мир компактнее: и пикселей втрое меньше, и всё
// на экране крупнее, потому что тот же телефон делит уже не 960, а 640
if (aspect < CONF.portraitCut) {
  CONF.baseW = 640;
  CONF.abyssW = 150;
  CONF.px.square = 3;
}
if (aspect >= CONF.baseW / CONF.baseH) {
  CONF.height = CONF.baseH;
  CONF.width = Phaser.Math.Clamp(Math.round(CONF.baseH * aspect), CONF.baseW, 1560);
} else {
  CONF.width = CONF.baseW;
  CONF.height = Phaser.Math.Clamp(Math.round(CONF.baseW / aspect), CONF.baseH, 2400);
}
CONF.cliffX = CONF.width - CONF.abyssW;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CONF.width,
  height: CONF.height,
  backgroundColor: '#2a4a9c',
  scene: [BootScene, GameScene, UIScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { pixelArt: true, roundPixels: true, antialias: false },
  pipeline: { Trip: TripPipeline },
});

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const loading = $('loading');
const startOverlay = $('start');
const audio = $('track');
audio.volume = 0.5;
const GAME_URL = 'https://lamopad.ru/square/';
const SHARE_PITCH = '◇▫◄◆◆▫ ◄█◆○▫◄◇ ▼▪◇▲◆ ◄ ◆○▫□►◆ ○▪ ○◇► ▲▫○▪';

game.events.once('square-booted', () => loading.classList.add('hidden'));

// ─── Звук: музыка (<audio>) и SFX (синтез) мутятся независимо ───────────────
const load = (key) => { try { return localStorage.getItem(key) === '1'; } catch (e) { return false; } };
const save = (key, v) => { try { localStorage.setItem(key, v ? '1' : '0'); } catch (e) { /* ок */ } };

let musicMuted = load(CONF.storage.muted);
let sfxMuted = load(CONF.storage.sfxMuted);
let fsMuted = load(CONF.storage.fsDisabled);
let discoOff = load(CONF.storage.discoOff);
// сцена читает флаг в create(), а она стартует ещё под стартовым экраном
game.registry.set('disco', !discoOff);

const muteMusicBtn = $('mute-music');
const muteSfxBtn = $('mute-sfx');

function renderMute() {
  muteMusicBtn.classList.toggle('off', musicMuted);
  muteMusicBtn.setAttribute('aria-label', musicMuted ? 'Включить музыку' : 'Выключить музыку');
  muteSfxBtn.classList.toggle('off', sfxMuted);
  muteSfxBtn.setAttribute('aria-label', sfxMuted ? 'Включить звуки' : 'Выключить звуки');
  audio.muted = musicMuted;
  Sfx.setMuted(sfxMuted);
  Beat.setMusicOn(!musicMuted);                     // нет музыки — отбиваем такт сами
}
renderMute();

// Пробел - игровая клавиша доски, а сфокусированная кнопка превращает его в
// клик и щёлкала бы музыкой. preventDefault звать нельзя (см. board.js), поэтому
// клик от пробела режем сами, а после мышиного клика ещё и снимаем фокус.
// Клик приходит синхронно сразу за keyup, так что флаг живёт до конца задачи.
let spaceClick = false;
window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return;
  spaceClick = true;
  setTimeout(() => { spaceClick = false; });
}, true);
function onToggle(btn, fn) {
  btn.addEventListener('click', (e) => {
    if (spaceClick) return;
    fn();
    if (e.detail > 0) btn.blur();
  });
}

onToggle(muteMusicBtn, () => {
  musicMuted = !musicMuted;
  save(CONF.storage.muted, musicMuted);
  renderMute();
  if (!musicMuted && audio.paused) audio.play().catch(() => {});
});
onToggle(muteSfxBtn, () => {
  sfxMuted = !sfxMuted;
  save(CONF.storage.sfxMuted, sfxMuted);
  renderMute();
});

// ─── Стартовый экран ─────────────────────────────────────────────────────────
const optMusic = $('opt-music');
const optSfx = $('opt-sfx');
const optFs = $('opt-fs');
const optDisco = $('opt-disco');
optMusic.classList.toggle('off', musicMuted);
optSfx.classList.toggle('off', sfxMuted);
optFs.classList.toggle('off', fsMuted);
optDisco.classList.toggle('off', discoOff);
[optMusic, optSfx, optFs, optDisco].forEach((b) =>
  onToggle(b, () => b.classList.toggle('off')));

const docEl = document.documentElement;
const requestFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
if (!requestFs) optFs.classList.add('hidden');

$('start-btn').addEventListener('click', () => {
  musicMuted = optMusic.classList.contains('off');
  sfxMuted = optSfx.classList.contains('off');
  fsMuted = optFs.classList.contains('off');
  const discoWas = discoOff;
  discoOff = optDisco.classList.contains('off');
  save(CONF.storage.muted, musicMuted);
  save(CONF.storage.sfxMuted, sfxMuted);
  save(CONF.storage.fsDisabled, fsMuted);
  save(CONF.storage.discoOff, discoOff);
  Sfx.init(game);
  // анализатор трека заводим ровно здесь: это жест пользователя, контекст жив
  Beat.attach(game, audio);
  renderMute();
  board.disco.setEnabled(!discoOff);                // общий свет над всей доской
  if (discoWas !== discoOff) {
    game.registry.set('disco', !discoOff);
    game.scene.getScene('game').scene.restart();    // сцена собирает эффекты в create()
  }
  if (requestFs && !fsMuted) {
    try { requestFs.call(docEl).catch(() => {}); } catch (e) { /* не судьба */ }
  }
  // квадрат на старте кренится и утаскивает экран за собой
  startOverlay.classList.add('tipping');
  setTimeout(() => {
    startOverlay.classList.add('hidden');
    window.__squareReady = true;
    startAccessRoulette();                          // игра началась: браузер начинает спрашивать
  }, 800);
  if (!musicMuted) audio.play().catch(() => {});
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { audio.pause(); return; }
  // музыка теперь идёт через WebAudio: уснувший контекст = тишина
  if (Beat.ctx && Beat.ctx.state === 'suspended') Beat.ctx.resume().catch(() => {});
  if (!musicMuted && audio.currentTime > 0) audio.play().catch(() => {});
});

// ─── Конец забега: панель просто начинает всё сначала ───────────────────────
// Отдельного экрана нет — доска не останавливается ни на секунду.
game.events.on('square-win', () => {
  setTimeout(() => {
    game.scene.getScene('game').scene.restart();
    game.scene.getScene('ui').scene.restart();
  }, 1200);
});

// ─── Поделиться: нативно, а без него — в буфер ──────────────────────────────
function bindShare(btn, makeText) {
  const label = btn.textContent;
  btn.addEventListener('click', async () => {
    const text = makeText();
    if (navigator.share) {
      try { await navigator.share({ title: '▼▪◇▲◆', text, url: GAME_URL }); }
      catch (e) { /* передумал — бывает */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${GAME_URL}`);
      btn.textContent = '✅ ▼■◆█◆▼◆◇▫▲■';
      setTimeout(() => { btn.textContent = label; }, 1800);
    } catch (e) { /* буфера нет — молчим */ }
  });
}

bindShare($('start-share'), () => SHARE_PITCH);

window.__square = game;
