// ── Constants ─────────────────────────────────────────────────────────────────
const GW = 800;
const GH = 380;

// Two lane ground Y positions: [bottom, top]
const LANE_Y  = [320, 175];
const PLAYER_X = 110;
const PW = 92;
const PH = 58;
const WR = 13;

const INIT_SPD = 3.2;
const SPD_INC  = 0.0015;
const LERP_SPD = 0.14;   // lane switch smoothness (higher = snappier)

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
    x:       PLAYER_X,
    lane:    0,          // 0 = bottom, 1 = top
    y:       LANE_Y[0] - PH,   // current visual Y (lerped)
    targetY: LANE_Y[0] - PH,
    switchFlash: 0,      // 0..1 glow on switch
  };
  obstacles  = [];
  floaties   = [];
  score      = 0;
  speed      = INIT_SPD;
  frame      = 0;
  bgX        = 0;
  wheelAngle = 0;
  nextObs    = 110;
  nextLyric  = 60;
  document.getElementById('score').textContent = '0';
}

// ── Input ─────────────────────────────────────────────────────────────────────
function switchLane() {
  if (mode === 'intro') { startGame(); return; }
  if (mode === 'dead')  { startGame(); return; }

  player.lane    = player.lane === 0 ? 1 : 0;
  player.targetY = LANE_Y[player.lane] - PH;
  player.switchFlash = 1;
}

document.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    switchLane();
  }
});
document.addEventListener('touchstart', e => { e.preventDefault(); switchLane(); }, { passive: false });
document.addEventListener('click', switchLane);

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

// ── Draw helpers ──────────────────────────────────────────────────────────────
function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function noGlow()           { ctx.shadowBlur = 0; }

// ── Background ────────────────────────────────────────────────────────────────
function drawBg() {
  // Full sky
  const sky = ctx.createLinearGradient(0, 0, 0, GH);
  sky.addColorStop(0,   '#04000c');
  sky.addColorStop(0.5, '#0e0022');
  sky.addColorStop(1,   '#06000f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GW, GH);

  // Road strip between the two lanes
  ctx.fillStyle = 'rgba(20, 0, 40, 0.6)';
  ctx.fillRect(0, LANE_Y[1], GW, LANE_Y[0] - LANE_Y[1]);

  // Scrolling vertical lane markers (dashed center line)
  ctx.save();
  const midY  = (LANE_Y[0] + LANE_Y[1]) / 2;
  const dashW = 28, dashH = 4, dashGap = 18;
  const offset = bgX % (dashW + dashGap);
  ctx.fillStyle = 'rgba(170, 60, 255, 0.35)';
  for (let x = -offset; x < GW + dashW; x += dashW + dashGap) {
    ctx.fillRect(x, midY - dashH / 2, dashW, dashH);
  }

  // Perspective grid lines (vanishing to center of road)
  const vpX    = GW * 0.5;
  const step   = 80;
  const gridOff = bgX % step;
  ctx.strokeStyle = 'rgba(110, 0, 180, 0.18)';
  ctx.lineWidth   = 1;
  for (let x = -gridOff; x < GW + step; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, LANE_Y[0]);
    ctx.lineTo(vpX + (x - vpX) * 0.3, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, LANE_Y[1]);
    ctx.lineTo(vpX + (x - vpX) * 0.3, midY);
    ctx.stroke();
  }
  ctx.restore();

  // Lane ground lines
  ctx.save();
  for (let i = 0; i < 2; i++) {
    glow(i === 0 ? '#ff006e' : '#aa44ff', 18);
    ctx.strokeStyle = i === 0 ? '#ff006e' : '#bb55ff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, LANE_Y[i]); ctx.lineTo(GW, LANE_Y[i]);
    ctx.stroke();
  }
  noGlow();
  ctx.restore();
}

// ── Wheel ─────────────────────────────────────────────────────────────────────
function drawWheel(cx, cy) {
  ctx.save();
  glow('#ff006e', 10);
  ctx.fillStyle = '#1c1c28';
  ctx.beginPath(); ctx.arc(cx, cy, WR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ff006e';
  ctx.lineWidth   = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, WR, 0, Math.PI * 2); ctx.stroke();
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
  const x       = player.x;
  const y       = Math.round(player.y);
  const WHEEL_Y = y + PH - 4;   // wheels follow body, not lane

  ctx.save();

  // Lane-switch flash (outer glow burst)
  if (player.switchFlash > 0) {
    glow('#ffffff', 30 * player.switchFlash);
  }

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

  // Wheels (always sit on the lane's ground line)
  noGlow();
  drawWheel(x + 20,      WHEEL_Y);
  drawWheel(x + PW - 18, WHEEL_Y);

  // ── Llama neck + head ──────────────────────────────────
  ctx.save();
  ctx.translate(x + 16, y + 14);

  // Neck
  glow('rgba(180, 140, 80, 0.3)', 6);
  ctx.fillStyle = '#b8905a';
  ctx.fillRect(-5, -42, 12, 36);

  // Head pivot
  ctx.translate(1, -42);

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
  ctx.beginPath(); ctx.ellipse(3, -5, 1.5, 1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, -5, 1.5, 1, 0, 0, Math.PI * 2); ctx.fill();

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

  ctx.restore(); // llama
  noGlow();
  ctx.restore(); // player
}

// ── Obstacle ──────────────────────────────────────────────────────────────────
function drawObstacle(o) {
  ctx.save();
  glow('#ff0044', 14);
  ctx.fillStyle = '#770022';
  ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.fillStyle = '#990033';
  for (let ry = o.y + 5; ry < o.y + o.h - 5; ry += 11) {
    ctx.fillRect(o.x + 4, ry, o.w - 8, 5);
  }

  noGlow();
  glow('#ff88bb', 6);
  ctx.fillStyle    = '#ffaad0';
  ctx.font         = `${Math.max(7, Math.min(10, o.w * 0.22))}px 'Press Start 2P', monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
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

// ── Lane indicator (arrows) ───────────────────────────────────────────────────
function drawLaneHint() {
  // Show small arrow pointing to the safe lane (where player isn't)
  // Only show briefly at game start (first 180 frames)
  if (frame > 180) return;
  const alpha = Math.max(0, 1 - frame / 120);
  const arrowLane = player.lane === 0 ? 1 : 0;
  const ay = LANE_Y[arrowLane] - PH / 2;
  ctx.save();
  ctx.globalAlpha = alpha * 0.7;
  glow('#ffdd00', 10);
  ctx.fillStyle = '#ffdd00';
  ctx.font = '11px Press Start 2P, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('↕ ПЕРЕКЛЮЧИТЬ', GW - 20, LANE_Y[0] - (LANE_Y[0] - LANE_Y[1]) / 2);
  noGlow();
  ctx.restore();
}

// ── Obstacle spawning ─────────────────────────────────────────────────────────
function spawnObs() {
  const lane = Math.random() < 0.5 ? 0 : 1;
  const h    = 34 + Math.random() * 26;
  obstacles.push({
    lane,
    x:     GW + 10,
    y:     LANE_Y[lane] - h,
    w:     30 + Math.random() * 16,
    h,
    label: OBS_LABELS[Math.floor(Math.random() * OBS_LABELS.length)],
  });
}

// ── Lyric spawning ────────────────────────────────────────────────────────────
function spawnLyric() {
  floaties.push({
    text:  LYRICS[Math.floor(Math.random() * LYRICS.length)],
    x:     GW * 0.2 + Math.random() * GW * 0.55,
    y:     12 + Math.random() * (LANE_Y[1] - 50),
    vy:    -0.2 - Math.random() * 0.15,
    life:  0,
    alpha: 0,
    size:  9 + Math.floor(Math.random() * 5),
    color: LYRIC_COLORS[Math.floor(Math.random() * LYRIC_COLORS.length)],
  });
}

// ── Collision ─────────────────────────────────────────────────────────────────
function hitTest() {
  // Only check obstacles in the current lane
  // Player hitbox is slightly inset
  const px1 = player.x + 16,  px2 = player.x + PW - 10;
  const py1 = player.y + 6,   py2 = player.y + PH - 2;
  return obstacles.some(o => {
    if (o.lane !== player.lane) return false;
    return px2 > o.x + 4 && px1 < o.x + o.w - 4 &&
           py2 > o.y + 4 && py1 < o.y + o.h;
  });
}

// ── Game loop ─────────────────────────────────────────────────────────────────
function loop() {
  if (mode !== 'play') return;

  frame++;
  score      += 0.1;
  speed       = INIT_SPD + frame * SPD_INC;
  bgX        += speed;
  wheelAngle += speed * 0.07;

  // Smooth lane switch (lerp)
  player.y += (player.targetY - player.y) * LERP_SPD;
  if (player.switchFlash > 0) player.switchFlash = Math.max(0, player.switchFlash - 0.06);

  // Score
  if (frame % 6 === 0) {
    document.getElementById('score').textContent = Math.floor(score);
  }

  // Obstacles
  if (frame >= nextObs) {
    spawnObs();
    const gap = Math.max(45, 130 - Math.floor(frame / 200) * 8);
    nextObs   = frame + gap + Math.floor(Math.random() * 50);
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

  // Collision (only when close enough to target lane — not mid-switch)
  const switchProgress = Math.abs(player.y - player.targetY) / Math.abs(LANE_Y[0] - LANE_Y[1]);
  if (switchProgress < 0.4 && hitTest()) { die(); return; }

  // Draw
  drawBg();
  drawLaneHint();
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
drawBg();
drawPlayer();
