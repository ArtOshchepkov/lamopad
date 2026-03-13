// ── Constants ─────────────────────────────────────────────────────────────────
const GW = 800;
const GH = 380;
const GROUND_Y = 310;
const PLAYER_X = 110;
const PW = 92;   // player width
const PH = 58;   // player body height (wheels add ~14px below)
const WR = 13;   // wheel radius
const GRAVITY  = 0.65;
const JUMP_V   = -13.5;
const INIT_SPD = 3.0;
const SPD_INC  = 0.0004;

const LYRICS = [
  'Я САМОСВАЛ',
  'ЭКЗИСТЕНС ИЗ ПЕЙН',
  'ЭКЗИСТЕНС ИЗ СТРЕЙНДЖ',
  'ДОКТОР?',
  'НЕТ',
  'Я ЗАВОЖУСЬ',
  'ХО-ХО ХО-ХО',
  'МНЕ НУЖЕН МЕХАНИК!',
  'САМОСВАЛ',
  'МАКС, ТЫ ДЕБИЛ?',
];

const OBS_LABELS = ['?', 'ДОКТОР', '!', 'МЕХ', 'ЭКЗ', 'НЕТ'];

const LYRIC_COLORS = ['#f0e6ff', '#ff69b4', '#cc88ff', '#ffdd00', '#88ffdd'];

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

canvas.width  = GW;
canvas.height = GH;

// ── State ─────────────────────────────────────────────────────────────────────
let mode; // 'intro' | 'play' | 'dead'
let player, obstacles, floaties;
let score, speed, frame, bgX, wheelAngle;
let nextObs, nextLyric;

function reset() {
  player = {
    x:        PLAYER_X,
    y:        GROUND_Y - PH,
    vy:       0,
    grounded: true,
    tilt:     0,  // llama head tilt (0..1 fades after jump)
  };
  obstacles   = [];
  floaties    = [];
  score       = 0;
  speed       = INIT_SPD;
  frame       = 0;
  bgX         = 0;
  wheelAngle  = 0;
  nextObs     = 120;
  nextLyric   = 60;
  document.getElementById('score').textContent = '0';
}

// ── Input ─────────────────────────────────────────────────────────────────────
function interact() {
  if (mode === 'intro') { startGame(); return; }
  if (mode === 'dead')  { startGame(); return; }
  if (player.grounded) {
    player.vy       = JUMP_V;
    player.grounded = false;
    player.tilt     = 1;
  }
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); interact(); }
});
document.addEventListener('touchstart', e => { e.preventDefault(); interact(); }, { passive: false });
canvas.addEventListener('click', interact);

// ── Start ─────────────────────────────────────────────────────────────────────
function startGame() {
  reset();
  mode = 'play';
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('dead').classList.add('hidden');

  const audio = document.getElementById('audio');
  if (audio) audio.play().catch(() => {});

  requestAnimationFrame(loop);
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function glow(color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur  = blur;
}
function noGlow() { ctx.shadowBlur = 0; }

// ── Background ────────────────────────────────────────────────────────────────
function drawBg() {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#06000f');
  sky.addColorStop(1, '#130025');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GW, GROUND_Y);

  // Underground strip
  ctx.fillStyle = '#090018';
  ctx.fillRect(0, GROUND_Y, GW, GH - GROUND_Y);

  // Scrolling perspective grid
  ctx.save();
  const step   = 80;
  const offset = bgX % step;
  const vpX    = GW / 2;
  const horizon = GROUND_Y - 55;

  ctx.strokeStyle = 'rgba(110, 0, 180, 0.22)';
  ctx.lineWidth = 1;
  for (let x = -offset; x < GW + step; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(vpX + (x - vpX) * 0.35, horizon);
    ctx.stroke();
  }

  // Horizontal grid lines (ground)
  for (let i = 1; i <= 5; i++) {
    const y = GROUND_Y + i * 10;
    if (y > GH) break;
    ctx.strokeStyle = `rgba(100, 0, 160, ${0.1 + i * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(GW, y);
    ctx.stroke();
  }
  ctx.restore();

  // Neon ground line
  ctx.save();
  glow('#ff006e', 18);
  ctx.strokeStyle = '#ff006e';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y); ctx.lineTo(GW, GROUND_Y);
  ctx.stroke();
  noGlow();
  ctx.restore();
}

// ── Wheel ─────────────────────────────────────────────────────────────────────
function drawWheel(cx, cy) {
  ctx.save();
  glow('#ff006e', 10);
  // Tyre
  ctx.fillStyle = '#1c1c28';
  ctx.beginPath();
  ctx.arc(cx, cy, WR, 0, Math.PI * 2);
  ctx.fill();
  // Rim
  ctx.strokeStyle = '#ff006e';
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, WR, 0, Math.PI * 2);
  ctx.stroke();
  // Spokes
  ctx.translate(cx, cy);
  ctx.rotate(wheelAngle);
  ctx.strokeStyle = 'rgba(255, 80, 140, 0.55)';
  ctx.lineWidth   = 1.5;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (WR - 2), Math.sin(a) * (WR - 2));
    ctx.stroke();
  }
  ctx.restore();
}

// ── Player (llama-truck) ──────────────────────────────────────────────────────
function drawPlayer() {
  const { x, y, tilt } = player;
  const WHEEL_Y = GROUND_Y - WR;

  ctx.save();

  // Truck bed (left)
  glow('#9900ff', 14);
  ctx.fillStyle = '#4d00aa';
  ctx.fillRect(x, y + 14, 54, PH - 14);

  // Bed back plate
  ctx.fillStyle = '#36007a';
  ctx.fillRect(x, y + 14, 7, PH - 14);

  // Cab (right)
  ctx.fillStyle = '#6611bb';
  ctx.fillRect(x + 50, y + 4, 42, PH - 4);

  // Windshield
  glow('#00ddff', 8);
  ctx.fillStyle   = 'rgba(0, 210, 255, 0.22)';
  ctx.strokeStyle = 'rgba(0, 210, 255, 0.45)';
  ctx.lineWidth   = 1;
  ctx.fillRect(x + 54, y + 9, 27, PH * 0.44);
  ctx.strokeRect(x + 54, y + 9, 27, PH * 0.44);

  // Headlight
  glow('#ffdd00', 22);
  ctx.fillStyle = '#ffdd00';
  ctx.fillRect(x + 90, y + PH - 20, 5, 9);

  // Wheels
  noGlow();
  drawWheel(x + 20,      WHEEL_Y);
  drawWheel(x + PW - 18, WHEEL_Y);

  // ── Llama neck + head ──────────────────────────────────
  const neckX    = x + 16;
  const neckTopY = y - 28;
  const headTilt = -0.18 * tilt;   // tilts back on jump

  ctx.save();
  ctx.translate(neckX, y + 14);
  ctx.rotate(headTilt * 0.3);

  // Neck
  glow('rgba(180, 140, 80, 0.3)', 6);
  ctx.fillStyle = '#b8905a';
  ctx.fillRect(-5, neckTopY - y - 14, 12, 36);

  // Head pivot at top of neck
  ctx.translate(1, neckTopY - y - 14);
  ctx.rotate(headTilt);

  // Head
  ctx.fillStyle = '#cfab78';
  ctx.beginPath();
  ctx.ellipse(0, -14, 12, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#b8905a';
  ctx.beginPath();
  ctx.ellipse(5, -7, 7, 5, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Nostrils
  ctx.fillStyle = '#8a6030';
  ctx.beginPath(); ctx.ellipse(3,  -5, 1.5, 1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7,  -5, 1.5, 1, 0, 0, Math.PI * 2); ctx.fill();

  // Ears
  ctx.fillStyle = '#a07040';
  ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(-13, -36); ctx.lineTo(-3, -26); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(7,  -24); ctx.lineTo(13,  -36); ctx.lineTo(4,  -26); ctx.closePath(); ctx.fill();

  // Eye
  noGlow();
  ctx.fillStyle = '#1a0800';
  ctx.beginPath(); ctx.arc(4, -16, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(5.2, -17, 1.2, 0, Math.PI * 2); ctx.fill();

  ctx.restore(); // head pivot
  ctx.restore(); // neck base

  noGlow();
  ctx.restore();
}

// ── Obstacle ──────────────────────────────────────────────────────────────────
function drawObstacle(o) {
  ctx.save();
  glow('#ff0044', 14);
  ctx.fillStyle = '#770022';
  ctx.fillRect(o.x, o.y, o.w, o.h);

  // Stripe detail
  ctx.fillStyle = '#990033';
  for (let ry = o.y + 5; ry < o.y + o.h - 5; ry += 11) {
    ctx.fillRect(o.x + 4, ry, o.w - 8, 5);
  }

  // Label
  noGlow();
  glow('#ff88bb', 6);
  ctx.fillStyle     = '#ffaad0';
  ctx.font          = `${Math.max(7, Math.min(10, o.w * 0.22))}px 'Press Start 2P', monospace`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText(o.label, o.x + o.w / 2, o.y + o.h / 2);
  noGlow();
  ctx.restore();
}

// ── Floating lyric ────────────────────────────────────────────────────────────
function drawFloatie(f) {
  ctx.save();
  ctx.globalAlpha = f.alpha;
  glow('#bb33ff', 14);
  ctx.fillStyle    = f.color;
  ctx.font         = `${f.size}px 'Press Start 2P', monospace`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(f.text, f.x, f.y);
  noGlow();
  ctx.restore();
}

// ── Spawn obstacle ────────────────────────────────────────────────────────────
function spawnObs() {
  const h = 34 + Math.random() * 26;
  obstacles.push({
    x:     GW + 10,
    y:     GROUND_Y - h,
    w:     30 + Math.random() * 16,
    h,
    label: OBS_LABELS[Math.floor(Math.random() * OBS_LABELS.length)],
  });
}

// ── Spawn lyric ───────────────────────────────────────────────────────────────
function spawnLyric() {
  floaties.push({
    text:  LYRICS[Math.floor(Math.random() * LYRICS.length)],
    x:     GW * 0.2 + Math.random() * GW * 0.55,
    y:     16 + Math.random() * (GROUND_Y - 90),
    vy:    -0.22 - Math.random() * 0.18,
    life:  0,
    alpha: 0,
    size:  9 + Math.floor(Math.random() * 5),
    color: LYRIC_COLORS[Math.floor(Math.random() * LYRIC_COLORS.length)],
  });
}

// ── Collision ─────────────────────────────────────────────────────────────────
function hitTest() {
  const px1 = player.x + 16,  px2 = player.x + PW - 10;
  const py1 = player.y + 6,   py2 = player.y + PH - 2;
  return obstacles.some(o =>
    px2 > o.x + 4 && px1 < o.x + o.w - 4 &&
    py2 > o.y + 4 && py1 < o.y + o.h
  );
}

// ── Game loop ─────────────────────────────────────────────────────────────────
function loop() {
  if (mode !== 'play') return;

  frame++;
  score += 0.1;
  speed  = INIT_SPD + frame * SPD_INC;
  bgX   += speed;
  wheelAngle += speed * 0.07;

  // Physics
  player.vy += GRAVITY;
  player.y  += player.vy;
  if (player.tilt > 0) player.tilt = Math.max(0, player.tilt - 0.04);

  if (player.y >= GROUND_Y - PH) {
    player.y       = GROUND_Y - PH;
    player.vy      = 0;
    player.grounded = true;
  }

  // Score DOM update (every 6 frames)
  if (frame % 6 === 0) {
    document.getElementById('score').textContent = Math.floor(score);
  }

  // Obstacles
  if (frame >= nextObs) {
    spawnObs();
    const gap = Math.max(70, 130 - Math.floor(frame / 400) * 8);
    nextObs   = frame + gap + Math.floor(Math.random() * 55);
  }
  obstacles.forEach(o => { o.x -= speed; });
  obstacles = obstacles.filter(o => o.x + o.w > -20);

  // Lyrics
  if (frame >= nextLyric) {
    spawnLyric();
    nextLyric = frame + 85 + Math.floor(Math.random() * 75);
  }
  floaties.forEach(f => {
    f.life  += 0.013;
    f.y     += f.vy;
    f.alpha  = f.life < 0.15
      ? f.life / 0.15
      : f.life > 0.75
        ? (1 - f.life) / 0.25
        : 1;
  });
  floaties = floaties.filter(f => f.life < 1);

  // Collision
  if (hitTest()) { die(); return; }

  // Draw
  drawBg();
  floaties.forEach(drawFloatie);
  obstacles.forEach(drawObstacle);
  drawPlayer();

  requestAnimationFrame(loop);
}

// ── Death ─────────────────────────────────────────────────────────────────────
function die() {
  mode = 'dead';
  const audio = document.getElementById('audio');
  if (audio) audio.pause();
  document.getElementById('final-score').textContent = Math.floor(score);
  document.getElementById('dead').classList.remove('hidden');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
mode = 'intro';
reset();
// Draw a static frame so canvas isn't blank behind the intro overlay
drawBg();
drawPlayer();
