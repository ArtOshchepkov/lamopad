(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── CSS ── */
  if (!document.getElementById('lamopad-fall-style')) {
    const s = document.createElement('style');
    s.id = 'lamopad-fall-style';
    s.textContent = [
      '.lamopad-canvas{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;}',
      '.lama{position:absolute;top:0;left:0;line-height:1;user-select:none;opacity:0;',
        'will-change:transform,opacity;pointer-events:auto;cursor:grab;touch-action:none;}',
      '.lama.dragging{cursor:grabbing;}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── canvas ── */
  const canvas = document.createElement('div');
  canvas.className = 'lamopad-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);

  /* ── helpers ── */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  const D2R = Math.PI / 180;
  const SPAWN_MARGIN = 140;  // px outside the viewport where items appear
  const KILL_MARGIN  = 220;  // px outside the viewport where they are recycled
  const FADE         = 110;  // px of edge proximity over which they fade in/out
  const GRAV_TAU     = 0.25; // s — smoothing of the sensor reading
  const TURN_TAU     = 0.45; // s — how fast a falling item swings onto a new direction
  const MAX_ITEMS    = 120;

  const BAG_FILTER = 'sepia(1) saturate(4) hue-rotate(300deg) brightness(0.85)';

  /* ── presets ── */
  const PRESETS = {
    subtle: {
      items: [
        { emoji: '🦙', minSize: 8,  maxSize: 18, minDur: 9,  maxDur: 18, minOpacity: 0.06, maxOpacity: 0.16, interval: 6000,  initMin: 500,  initMax: 2500, initCount: 1 },

        { emoji: '🎒', minSize: 7,  maxSize: 14, minDur: 10, maxDur: 20, minOpacity: 0.07, maxOpacity: 0.15, interval: 17000, initMin: 2000, initMax: 5000, initCount: 1, filter: BAG_FILTER },

        { emoji: '🕶️', minSize: 6,  maxSize: 13, minDur: 11, maxDur: 22, minOpacity: 0.05, maxOpacity: 0.13, interval: 24000, initMin: 3000, initMax: 7000, initCount: 1 },

        { emoji: '✈️', minSize: 8,  maxSize: 16, minDur: 10, maxDur: 20, minOpacity: 0.05, maxOpacity: 0.14, interval: 14000, initMin: 1500, initMax: 4500, initCount: 1 },

        { emoji: '✨', minSize: 5,  maxSize: 12, minDur: 7,  maxDur: 16, minOpacity: 0.04, maxOpacity: 0.12, interval: 5000,  initMin: 0,    initMax: 3000, initCount: 2 },

        { emoji: '🚂', minSize: 8,  maxSize: 15, minDur: 12, maxDur: 24, minOpacity: 0.05, maxOpacity: 0.13, interval: 21000, initMin: 2500, initMax: 6000, initCount: 1 },
      ],
    },

    full: {
      items: [
        { emoji: '🦙', minSize: 18, maxSize: 40, minDur: 6,  maxDur: 14, minOpacity: 0.10, maxOpacity: 0.22, interval: 1800,  initMin: 0, initMax: 200, initCount: 5 },

        { emoji: '🎒', minSize: 14, maxSize: 30, minDur: 7,  maxDur: 16, minOpacity: 0.10, maxOpacity: 0.20, interval: 4000,  initMin: 0, initMax: 200, initCount: 3, filter: BAG_FILTER },

        { emoji: '🕶️', minSize: 12, maxSize: 26, minDur: 8,  maxDur: 18, minOpacity: 0.09, maxOpacity: 0.18, interval: 5000,  initMin: 0, initMax: 200, initCount: 3 },

        { emoji: '✈️', minSize: 16, maxSize: 34, minDur: 6,  maxDur: 15, minOpacity: 0.08, maxOpacity: 0.18, interval: 3000,  initMin: 0, initMax: 200, initCount: 3 },

        { emoji: '✨', minSize: 10, maxSize: 24, minDur: 5,  maxDur: 12, minOpacity: 0.07, maxOpacity: 0.16, interval: 1500,  initMin: 0, initMax: 200, initCount: 6 },

        { emoji: '🚂', minSize: 14, maxSize: 30, minDur: 8,  maxDur: 18, minOpacity: 0.08, maxOpacity: 0.17, interval: 5000,  initMin: 0, initMax: 200, initCount: 3 },
      ],
    },
  };
  const preset = PRESETS[window.lamopadFallConfig] || PRESETS.full;

  /* ── viewport ── */
  let W = 0, H = 0, screenAngle = 0;
  function readViewport() {
    W = window.innerWidth;
    H = window.innerHeight;
    const so = screen.orientation;
    screenAngle = so && typeof so.angle === 'number'
      ? so.angle
      : (typeof window.orientation === 'number' ? (window.orientation + 360) % 360 : 0);
  }
  readViewport();
  window.addEventListener('resize', readViewport);
  window.addEventListener('orientationchange', readViewport);

  /* ── gravity ────────────────────────────────────────────────────────────────
     Unit vector in screen space (x right, y down). Without a sensor it stays
     (0,1) and everything falls straight down, exactly like before.            */
  const grav       = { x: 0, y: 1 };
  const gravTarget = { x: 0, y: 1 };
  let sensorSeen = false;
  let sensorEvents = 0, lastReading = '-', permission = 'n/a';

  // Gravity in device coords from the deviceorientation Euler angles. With
  // R = Rz(alpha)Rx(beta)Ry(gamma) mapping device -> earth, earth-down (0,0,-1)
  // becomes (sin g cos b, -sin b, -cos g cos b) in the device frame (x right,
  // y up, z out of the screen). Alpha drops out: gravity is invariant under
  // rotation about the vertical. Screen y points down, hence the flipped sign.
  function fromOrientation(beta, gamma) {
    const b = beta * D2R, g = gamma * D2R;
    return { x: Math.sin(g) * Math.cos(b), y: Math.sin(b) };
  }

  // The device frame is fixed to the hardware; the layout rotates with the UI.
  function applyScreenAngle(v) {
    const a = screenAngle * D2R, c = Math.cos(a), s = Math.sin(a);
    return { x: v.x * c + v.y * s, y: -v.x * s + v.y * c };
  }

  function pushGravity(v) {
    const m = Math.hypot(v.x, v.y);
    if (m < 0.12) return;  // device is flat: the in-plane direction is just noise, hold the last one
    sensorSeen = true;
    gravTarget.x = v.x / m;
    gravTarget.y = v.y / m;
  }

  function onDeviceOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    sensorEvents++;
    lastReading = 'orient b=' + e.beta.toFixed(0) + ' g=' + e.gamma.toFixed(0);
    pushGravity(applyScreenAngle(fromOrientation(e.beta, e.gamma)));
  }

  // Fallback for devices that expose no fused orientation. Per the W3C
  // convention accelerationIncludingGravity reports the reaction to gravity
  // (+z when lying face up), so the gravity vector is its negation; device y
  // points up, screen y down, so that sign flips back.
  const motionLP = { x: 0, y: 0 };
  let motionInit = false;
  function onDeviceMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null) return;
    sensorEvents++;
    lastReading = 'motion x=' + a.x.toFixed(1) + ' y=' + a.y.toFixed(1);
    const rx = -a.x, ry = a.y;
    if (motionInit) {
      motionLP.x += (rx - motionLP.x) * 0.08;  // raw accelerometer: heavy low-pass
      motionLP.y += (ry - motionLP.y) * 0.08;
    } else {
      motionLP.x = rx; motionLP.y = ry; motionInit = true;
    }
    pushGravity(applyScreenAngle({ x: motionLP.x / 9.81, y: motionLP.y / 9.81 }));
  }

  let sensorsOn = false;
  function enableSensors() {
    if (sensorsOn) return;
    sensorsOn = true;
    window.addEventListener('deviceorientation', onDeviceOrientation);
    setTimeout(function () {
      if (!sensorSeen) window.addEventListener('devicemotion', onDeviceMotion);
    }, 2000);
  }

  const DOE = window.DeviceOrientationEvent;
  const needsPermission = !!DOE && typeof DOE.requestPermission === 'function';
  permission = !DOE ? 'no orientation api' : needsPermission ? 'waiting for a tap' : 'not required';

  // iOS 13+ only shows the prompt from inside a user gesture, and it is picky
  // about which one — a pointerdown is rejected outright. So ask on every
  // gesture until one is accepted, and only give up once iOS actually answers.
  const GESTURES = ['touchend', 'click', 'pointerup'];
  let asking = false;
  function stopAsking() {
    GESTURES.forEach(function (t) { document.removeEventListener(t, askPermission, true); });
  }
  function askPermission() {
    if (asking || sensorsOn) return;
    asking = true;
    permission = 'asking';
    let p;
    try { p = DOE.requestPermission(); } catch (e) { asking = false; permission = 'threw: ' + e.name; return; }
    p.then(function (r) {
      asking = false;
      permission = r;
      if (r === 'granted') { stopAsking(); enableSensors(); }
      else stopAsking();          // a denial sticks for the rest of the page load
    }, function (e) {
      asking = false;             // gesture not accepted — the next one may be
      permission = 'rejected: ' + (e && e.name || e);
    });
  }

  if (needsPermission) {
    GESTURES.forEach(function (t) { document.addEventListener(t, askPermission, true); });
  } else if (DOE) {
    enableSensors();
  }

  /* ── items ── */
  const parts = [];

  function place(p, vis) {
    p.el.style.transform =
      'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0)' +
      ' rotate(' + p.rot.toFixed(1) + 'deg) translate(-50%,-50%)';
    p.el.style.opacity = (p.opacity * vis).toFixed(3);
  }

  function spawnItem(cfg) {
    const el = document.createElement('span');
    el.className = 'lama';
    el.textContent = cfg.emoji;
    el.style.fontSize = rand(cfg.minSize, cfg.maxSize) + 'px';
    if (cfg.filter) el.style.filter = cfg.filter;

    // Enter from the upwind side of the current gravity, spread across it,
    // and cross the viewport in `dur` seconds whatever the tilt.
    const gx = grav.x, gy = grav.y;
    const px = -gy, py = gx;
    const span  = Math.abs(gx) * W + Math.abs(gy) * H;  // viewport extent along gravity
    const spanP = Math.abs(px) * W + Math.abs(py) * H;  // ...and across it
    const off   = rand(-0.53, 0.53) * spanP;
    const speed = (span + 2 * SPAWN_MARGIN) / rand(cfg.minDur, cfg.maxDur);

    const p = {
      el: el,
      x: W / 2 - gx * (span / 2 + SPAWN_MARGIN) + px * off,
      y: H / 2 - gy * (span / 2 + SPAWN_MARGIN) + py * off,
      vx: gx * speed,
      vy: gy * speed,
      speed: speed,
      rot: rand(-25, 25),
      spin: rand(-30, 30),
      opacity: rand(cfg.minOpacity, cfg.maxOpacity),
      drag: null,
    };
    parts.push(p);
    canvas.appendChild(el);
    attachDrag(p);
    place(p, 0);
  }

  /* ── on-device diagnostics ──────────────────────────────────────────────────
     Add ?falldebug (or #falldebug) to any URL to see what the phone reports.
     Tapping the panel re-requests motion access.                             */
  const debugOn = /falldebug/.test(location.search + location.hash);
  let debugBox = null;
  if (debugOn) {
    debugBox = document.createElement('div');
    debugBox.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;' +
      'font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre;' +
      'background:rgba(0,0,0,.82);color:#fff;padding:8px 10px;border-radius:8px;' +
      'pointer-events:auto;max-width:calc(100vw - 16px);';
    debugBox.addEventListener('click', function () { if (needsPermission) askPermission(); });
    document.body.appendChild(debugBox);
    updateDebug();
  }
  function updateDebug() {
    debugBox.textContent = [
      'secure context : ' + window.isSecureContext,
      'orientation api: ' + (DOE ? (needsPermission ? 'yes, needs permission' : 'yes') : 'MISSING'),
      'permission     : ' + permission,
      'listening      : ' + sensorsOn,
      'sensor events  : ' + sensorEvents,
      'last reading   : ' + lastReading,
      'screen angle   : ' + screenAngle,
      'gravity        : ' + grav.x.toFixed(2) + ', ' + grav.y.toFixed(2),
      'items on screen: ' + parts.length,
      needsPermission && !sensorsOn ? '\n>> tap here to allow motion access' : '',
    ].join('\n');
  }

  /* ── drag ── */
  function attachDrag(p) {
    const el = p.el;
    let pid = null, lx = 0, ly = 0, lt = 0, fx = 0, fy = 0;

    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      pid = e.pointerId;
      p.drag = { dx: p.x - e.clientX, dy: p.y - e.clientY };
      lx = e.clientX; ly = e.clientY; lt = e.timeStamp; fx = fy = 0;
      el.classList.add('dragging');
      document.body.style.userSelect = 'none';
    });

    el.addEventListener('pointermove', function (e) {
      if (!p.drag || e.pointerId !== pid) return;
      e.preventDefault();
      p.x = e.clientX + p.drag.dx;
      p.y = e.clientY + p.drag.dy;
      const dt = (e.timeStamp - lt) / 1000;
      if (dt > 0.004) {
        fx = (e.clientX - lx) / dt; fy = (e.clientY - ly) / dt;
        lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
      }
    });

    function release() {
      if (!p.drag) return;
      p.drag = null;
      pid = null;
      el.classList.remove('dragging');
      document.body.style.userSelect = '';
      // keep the throw, capped; gravity reels it back in over TURN_TAU
      const m = Math.hypot(fx, fy), cap = p.speed * 12;
      const k = m > cap ? cap / m : 1;
      p.vx = fx * k; p.vy = fy * k;
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  /* ── schedule ── */
  const spawners = preset.items.map(function (cfg) {
    const queue = [];
    for (let i = 0; i < cfg.initCount; i++) queue.push(rand(cfg.initMin, cfg.initMax) / 1000);
    queue.sort(function (a, b) { return a - b; });
    return { cfg: cfg, queue: queue, t: 0, next: cfg.interval / 1000 };
  });

  /* ── loop ── */
  let last = 0, frames = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);  // also swallows background-tab gaps
    last = now;
    if (dt <= 0) return;

    const kg = 1 - Math.exp(-dt / GRAV_TAU);
    grav.x += (gravTarget.x - grav.x) * kg;
    grav.y += (gravTarget.y - grav.y) * kg;
    const gm = Math.hypot(grav.x, grav.y) || 1;
    grav.x /= gm; grav.y /= gm;

    for (const s of spawners) {
      s.t += dt;
      while (s.queue.length && s.queue[0] <= s.t) { s.queue.shift(); if (parts.length < MAX_ITEMS) spawnItem(s.cfg); }
      if (s.t >= s.next) { s.next += s.cfg.interval / 1000; if (parts.length < MAX_ITEMS) spawnItem(s.cfg); }
    }

    if (debugBox && (frames++ % 6 === 0)) updateDebug();

    const kv = 1 - Math.exp(-dt / TURN_TAU);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!p.drag) {
        p.vx += (grav.x * p.speed - p.vx) * kv;
        p.vy += (grav.y * p.speed - p.vy) * kv;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
      const edge = Math.min(p.x, W - p.x, p.y, H - p.y);
      if (!p.drag && edge < -KILL_MARGIN) { p.el.remove(); parts.splice(i, 1); continue; }
      place(p, clamp01((edge + FADE) / FADE));
    }
  }
  requestAnimationFrame(function (t) { last = t; requestAnimationFrame(frame); });

  /* debug / desktop testing: lamopadFall.setGravity(1, 0) tips everything right */
  window.lamopadFall = {
    gravity: grav,
    setGravity: function (x, y) { pushGravity({ x: x, y: y }); },
    fromOrientation: fromOrientation,
  };
})();
