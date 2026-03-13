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

// Surreal effect — hue-rotate degrees cycled on each lane switch
const PALETTES = [0, 90, 180, 270];

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

// ── Assets ────────────────────────────────────────────────────────────────────
const shmurdikImg = new Image();
shmurdikImg.src = 'releases/samosval/shmurdik_40px.png';

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
let surrealTimer, paletteIdx;
let exhaust;
let pills, speedBoostTimer, psychoTimer, nextPill;

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
  nextObs      = 110;
  nextLyric    = 60;
  surrealTimer   = 0;
  paletteIdx     = 0;
  exhaust        = [];
  pills          = [];
  speedBoostTimer = 0;
  psychoTimer    = 0;
  nextPill       = 900;   // first pill possible at ~15 sec
  canvas.style.filter    = '';
  canvas.style.transform = '';
  document.getElementById('score').textContent = '0';
}

// ── Input ─────────────────────────────────────────────────────────────────────
function switchLane() {
  if (mode === 'intro') { startGame(); return; }
  if (mode === 'dead')  { startGame(); return; }

  player.lane    = player.lane === 0 ? 1 : 0;
  player.targetY = LANE_Y[player.lane] - PH;
  player.switchFlash = 1;

  // Surreal effect
  paletteIdx   = (paletteIdx + 1) % PALETTES.length;
  surrealTimer = 32;

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

// ── Surreal canvas effect ─────────────────────────────────────────────────────
function tickSurreal() {
  // Psycho pill overrides everything
  if (psychoTimer > 0) {
    if (frame % 6 === 0) paletteIdx = (paletteIdx + 1) % PALETTES.length;
    const hue   = PALETTES[paletteIdx];
    const t     = psychoTimer / 300;
    const shake = 14 * t;
    canvas.style.filter    = `hue-rotate(${hue}deg) brightness(1.5) saturate(3) contrast(1.2)`;
    canvas.style.transform = `translate(${(Math.random()-0.5)*shake}px,${(Math.random()-0.5)*shake}px)`;
    psychoTimer--;
    return;
  }

  const hue = PALETTES[paletteIdx];
  if (surrealTimer > 0) {
    const t          = surrealTimer / 32;
    const shakeAmt   = 10 * t;
    const brightness = surrealTimer > 26 ? 2.5 : 1;
    canvas.style.filter    = `hue-rotate(${hue}deg) brightness(${brightness}) saturate(1.6)`;
    canvas.style.transform = `translate(${(Math.random()-0.5)*shakeAmt}px,${(Math.random()-0.5)*shakeAmt}px)`;
    surrealTimer--;
  } else {
    canvas.style.filter    = `hue-rotate(${hue}deg) saturate(1.3)`;
    canvas.style.transform = '';
  }
}

// ── Draw helpers ──────────────────────────────────────────────────────────────
function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function noGlow()           { ctx.shadowBlur = 0; }

// ── Exhaust trail ─────────────────────────────────────────────────────────────
// Pipe nozzle position (back of truck bed, bottom)
function pipePos() {
  return { x: player.x + 4, y: Math.round(player.y) + PH - 10 };
}

function spawnExhaust() {
  const { x, y } = pipePos();
  // More particles during lane switch
  const count = speedBoostTimer > 0 ? 8 : player.switchFlash > 0.1 ? 4 : 1;
  for (let i = 0; i < count; i++) {
    exhaust.push({
      x,
      y:    y + (Math.random() - 0.5) * 5,
      vx:   -(speed * 0.85 + Math.random() * 1.2),  // drifts back in world-space
      vy:   (Math.random() - 0.5) * 1.4,
      life: 1,
      decay: 0.018 + Math.random() * 0.012,
      size:  2.5 + Math.random() * 2.5,
    });
  }
}

function updateExhaust() {
  spawnExhaust();
  exhaust.forEach(p => {
    p.x   += p.vx;
    p.y   += p.vy;
    p.vy  *= 0.92;
    p.life -= p.decay;
  });
  exhaust = exhaust.filter(p => p.life > 0);
}

function drawExhaust() {
  for (const p of exhaust) {
    const r = Math.max(0.3, p.size * p.life);
    ctx.save();
    ctx.globalAlpha = p.life * 0.9;
    // hot at birth → cool purple at end
    const col = p.life > 0.6 ? '#ff88cc' : p.life > 0.3 ? '#cc44ff' : '#6600cc';
    glow(col, 16 * p.life);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    ctx.restore();
  }
}

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

  // ── 1. LLAMA — drawn first so truck body covers neck base ──
  ctx.save();
  ctx.translate(x + 22, y + 14);  // centered in truck bed

  // Neck — short woolly trapezoid
  glow('#cc8844', 8);
  ctx.fillStyle = '#c49060';
  ctx.beginPath();
  ctx.moveTo(-7, 2);
  ctx.lineTo(8, 2);
  ctx.lineTo(5, -20);
  ctx.lineTo(-3, -20);
  ctx.closePath();
  ctx.fill();

  // Wool texture
  noGlow();
  ctx.strokeStyle = '#e8c080';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (let fy = -3; fy > -17; fy -= 7) {
    ctx.beginPath(); ctx.arc(1, fy, 4, Math.PI * 0.75, Math.PI * 0.15, true); ctx.stroke();
  }

  // Head pivot at top of neck
  ctx.translate(1, -20);

  // Head
  glow('#dd9955', 6);
  ctx.fillStyle = '#dbb882';
  ctx.beginPath();
  ctx.ellipse(0, -12, 12, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head highlight
  ctx.fillStyle = 'rgba(255, 240, 190, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-3, -17, 6, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // ── Fur — soft curly bumps around head and neck ──
  // Small semicircle curls along the head outline
  ctx.strokeStyle = '#f0d4a0';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  // Each entry: [center x, center y, radius, start angle, end angle]
  [
    [-11, -19, 2.5, Math.PI * 0.9, Math.PI * 1.9],
    [-8,  -23, 2.5, Math.PI * 1.1, Math.PI * 2.1],
    [-4,  -25, 2.5, Math.PI * 1.3, Math.PI * 2.3],
    [ 0,  -26, 2.5, Math.PI * 1.5, Math.PI * 2.5],
    [ 4,  -25, 2.5, Math.PI * 1.7, Math.PI * 2.7],
    [ 8,  -23, 2.5, Math.PI * 1.9, Math.PI * 2.9],
    [11,  -19, 2.5, Math.PI * 0.1, Math.PI * 1.1],
    [13,  -13, 2.5, Math.PI * 1.8, Math.PI * 2.8],
  ].forEach(([cx, cy, r, s, e]) => {
    ctx.beginPath(); ctx.arc(cx, cy, r, s, e); ctx.stroke();
  });

  // Neck sides — small filled wool puffs
  ctx.fillStyle = '#e8c888';
  [
    [-10, 6], [-11, 0], [-10, -6], [-9, -12],
    [ 9,  6], [ 10, 0], [  9, -6], [ 8, -12],
  ].forEach(([bx, by]) => {
    ctx.beginPath(); ctx.arc(bx, by + 20, 2.2, 0, Math.PI * 2); ctx.fill();
  });

  // Back ear — banana shape (bezier)
  noGlow();
  ctx.fillStyle = '#b08050';
  ctx.beginPath();
  ctx.moveTo(-8, -21);
  ctx.bezierCurveTo(-16, -26, -16, -38, -10, -38);
  ctx.bezierCurveTo(-6,  -38, -5,  -28, -5,  -22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e87090';
  ctx.beginPath();
  ctx.moveTo(-8, -23);
  ctx.bezierCurveTo(-13, -27, -13, -35, -9, -35);
  ctx.bezierCurveTo(-7,  -35, -6,  -28, -6, -23);
  ctx.closePath();
  ctx.fill();

  // Front ear — banana shape (bezier)
  ctx.fillStyle = '#b08050';
  ctx.beginPath();
  ctx.moveTo(7, -21);
  ctx.bezierCurveTo(15, -26, 15, -38, 9,  -38);
  ctx.bezierCurveTo(5,  -38, 4,  -28, 5,  -22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e87090';
  ctx.beginPath();
  ctx.moveTo(7, -23);
  ctx.bezierCurveTo(12, -27, 12, -35, 8,  -35);
  ctx.bezierCurveTo(6,  -35, 6,  -28, 6,  -23);
  ctx.closePath();
  ctx.fill();

  // Snout — flat alpaca muzzle
  ctx.fillStyle = '#d4a878';
  ctx.beginPath();
  ctx.ellipse(4, -5, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Soft muzzle pad (slightly darker, flat front)
  ctx.fillStyle = '#c09060';
  ctx.beginPath();
  ctx.ellipse(4, -4, 3.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nostrils — small soft dots
  ctx.fillStyle = '#7a5030';
  ctx.beginPath(); ctx.arc(2.5, -4, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5.5, -4, 1, 0, Math.PI * 2); ctx.fill();

  // Cleft upper lip
  ctx.strokeStyle = '#9a6840';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, -3);
  ctx.lineTo(4, -1.5);
  ctx.stroke();

  // Smile
  ctx.strokeStyle = '#996633';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(2.5, -1, 1.8, 0, Math.PI); ctx.stroke();
  ctx.beginPath();
  ctx.arc(5.5, -1, 1.8, 0, Math.PI); ctx.stroke();

  // ── Sunglasses — two lenses, 3/4 view ──
  glow('#ff006e', 12);

  // Left lens
  ctx.fillStyle = '#080018';
  ctx.beginPath();
  ctx.ellipse(-5, -15, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff006e';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(-5, -15, 4, 3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Right lens
  ctx.fillStyle = '#080018';
  ctx.beginPath();
  ctx.ellipse(4, -15, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff006e';
  ctx.beginPath();
  ctx.ellipse(4, -15, 4, 3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Bridge
  ctx.beginPath();
  ctx.moveTo(-1, -15);
  ctx.lineTo(0, -15);
  ctx.stroke();

  // Left temple arm (going back)
  ctx.beginPath();
  ctx.moveTo(-9, -15);
  ctx.lineTo(-14, -13);
  ctx.stroke();

  // Lens shines
  noGlow();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath(); ctx.ellipse(-6, -16, 1.8, 1, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3,  -16, 1.8, 1, -0.2, 0, Math.PI * 2); ctx.fill();

  ctx.restore(); // llama

  // ── 2. EXHAUST pipe nozzle ────────────────────────────
  glow('#ff44aa', 12);
  ctx.fillStyle = '#330044';
  ctx.fillRect(x + 1, y + PH - 13, 7, 8);
  ctx.fillStyle = '#ff44aa';
  ctx.fillRect(x + 1, y + PH - 14, 7, 3);

  // ── 3. TRUCK BED — covers llama neck base ─────────────
  glow('#9900ff', 14);
  ctx.fillStyle = '#4d00aa';
  ctx.fillRect(x, y + 14, 54, PH - 14);

  // Bed back plate
  ctx.fillStyle = '#36007a';
  ctx.fillRect(x, y + 14, 7, PH - 14);

  // ── 4. CAB ────────────────────────────────────────────
  ctx.fillStyle = '#6611bb';
  ctx.fillRect(x + 50, y + 4, 42, PH - 4);

  // ── 5. WINDSHIELD ─────────────────────────────────────
  glow('#00ddff', 8);
  ctx.fillStyle   = 'rgba(0, 210, 255, 0.22)';
  ctx.strokeStyle = 'rgba(0, 210, 255, 0.45)';
  ctx.lineWidth   = 1;
  const wx = x + 54, wy = y + 9, ww = 27, wh = Math.floor(PH * 0.44);
  ctx.fillRect(wx, wy, ww, wh);

  if (shmurdikImg.complete && shmurdikImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx, wy, ww, wh);
    ctx.clip();
    ctx.filter = 'blur(1px)';
    ctx.globalAlpha = 0.75;
    const scale = wh / shmurdikImg.naturalHeight;
    const dw    = shmurdikImg.naturalWidth * scale;
    ctx.drawImage(shmurdikImg, wx + (ww - dw) / 2, wy, dw, wh);
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(0, 180, 255, 0.05)';
  ctx.fillRect(wx, wy, ww, wh);
  ctx.strokeRect(wx, wy, ww, wh);

  // ── 6. HEADLIGHT ──────────────────────────────────────
  glow('#ffdd00', 22);
  ctx.fillStyle = '#ffdd00';
  ctx.fillRect(x + 90, y + PH - 20, 5, 9);

  // ── 7. WHEELS ─────────────────────────────────────────
  noGlow();
  drawWheel(x + 20,      WHEEL_Y);
  drawWheel(x + PW - 18, WHEEL_Y);

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

// ── Pills ─────────────────────────────────────────────────────────────────────
// Pill y = llama face height for that lane
function pillY(lane) { return LANE_Y[lane] - PH - 20; }

function spawnPill() {
  const lane = Math.random() < 0.5 ? 0 : 1;
  const type = Math.random() < 0.5 ? 0 : 1;   // 0 = speed, 1 = psycho
  pills.push({ x: GW + 20, y: pillY(lane), lane, type, angle: 0 });
}

function drawPill(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  const hw = 7, r = 4;
  const c1  = p.type === 0 ? '#ffee00' : '#ff22ff';
  const c2  = p.type === 0 ? '#ff8800' : '#00ffee';
  const gc  = p.type === 0 ? '#ffbb00' : '#dd00ff';

  glow(gc, 18);

  // Left half
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.arc(-hw, 0, r, Math.PI * 0.5, Math.PI * 1.5);
  ctx.lineTo(0, -r); ctx.lineTo(0, r);
  ctx.closePath(); ctx.fill();

  // Right half
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(hw, -r);
  ctx.arc(hw, 0, r, Math.PI * 1.5, Math.PI * 0.5);
  ctx.lineTo(0, r);
  ctx.closePath(); ctx.fill();

  // Divider + shine
  noGlow();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.ellipse(-hw * 0.5, -r * 0.5, hw * 0.35, r * 0.3, -0.3, 0, Math.PI * 2); ctx.fill();

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
  const px1 = player.x + 16,  px2 = player.x + PW - 10;
  const py1 = player.y + 6,   py2 = player.y + PH - 2;
  if (speedBoostTimer > 0) {
    // Smash through — remove colliding obstacles
    obstacles = obstacles.filter(o => {
      if (o.lane !== player.lane) return true;
      const hit = px2 > o.x + 4 && px1 < o.x + o.w - 4 &&
                  py2 > o.y + 4 && py1 < o.y + o.h;
      return !hit;
    });
    return false;
  }
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
  speed = INIT_SPD + frame * SPD_INC;
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

  // Pills
  if (frame >= nextPill) {
    if (Math.random() < 0.4) spawnPill();
    nextPill = frame + 400 + Math.floor(Math.random() * 300);
  }
  pills.forEach(p => { p.x -= speed; p.angle += 0.04; });
  pills = pills.filter(p => p.x + 14 > -20);

  // Pill catch
  const faceX = player.x + 22;
  pills = pills.filter(p => {
    if (p.lane !== player.lane) return true;
    if (faceX + 20 > p.x - 14 && faceX - 10 < p.x + 14) {
      if (p.type === 0) speedBoostTimer = 240;
      else psychoTimer = 300;
      return false;
    }
    return true;
  });

  // Speed boost
  if (speedBoostTimer > 0) { speed += 2.5; speedBoostTimer--; }

  // Collision (only when close enough to target lane — not mid-switch)
  const switchProgress = Math.abs(player.y - player.targetY) / Math.abs(LANE_Y[0] - LANE_Y[1]);
  if (switchProgress < 0.4 && hitTest()) { die(); return; }

  // Draw
  tickSurreal();
  updateExhaust();
  drawBg();
  drawLaneHint();
  floaties.forEach(drawFloatie);
  pills.forEach(drawPill);
  drawExhaust();          // trail behind player
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
