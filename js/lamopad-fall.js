(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── CSS ── */
  if (!document.getElementById('lamopad-fall-style')) {
    const s = document.createElement('style');
    s.id = 'lamopad-fall-style';
    s.textContent = [
      '.lamopad-canvas{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;}',
      '.lama{position:absolute;top:-80px;line-height:1;user-select:none;will-change:transform,opacity;',
        'animation:lama-fall linear forwards;pointer-events:auto;cursor:grab;touch-action:none;}',
      '.lama.dragging{cursor:grabbing;}',
      '@keyframes lama-fall{',
        '0%{opacity:0;transform:translateY(0) rotate(var(--rot-start));}',
        '8%{opacity:var(--opacity);}',
        '88%{opacity:var(--opacity);}',
        '100%{opacity:0;transform:translateY(var(--fall-dist)) rotate(var(--rot-end));}',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── canvas ── */
  const canvas = document.createElement('div');
  canvas.className = 'lamopad-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);

  /* ── helpers ── */
  function rand(a, b) { return a + Math.random() * (b - a); }

  const BAG_FILTER = 'sepia(1) saturate(4) hue-rotate(300deg) brightness(0.85)';

  /* ── presets ── */
  const PRESETS = {
    subtle: {
      items: [
        { emoji: '🦙', minSize: 8,  maxSize: 18, minDur: 9,  maxDur: 18, minOpacity: 0.06, maxOpacity: 0.16, interval: 6000,  initMin: 500,  initMax: 2500, initCount: 1 },
        { emoji: '🎒', minSize: 7,  maxSize: 14, minDur: 10, maxDur: 20, minOpacity: 0.07, maxOpacity: 0.15, interval: 17000, initMin: 2000, initMax: 5000, initCount: 1, filter: BAG_FILTER },
        { emoji: '🕶️', minSize: 6,  maxSize: 13, minDur: 11, maxDur: 22, minOpacity: 0.05, maxOpacity: 0.13, interval: 24000, initMin: 3000, initMax: 7000, initCount: 1 },
      ],
    },
    full: {
      items: [
        { emoji: '🦙', minSize: 18, maxSize: 40, minDur: 6,  maxDur: 14, minOpacity: 0.10, maxOpacity: 0.22, interval: 2700,  initMin: 0,    initMax: 2000, initCount: 2 },
        { emoji: '🎒', minSize: 14, maxSize: 30, minDur: 7,  maxDur: 16, minOpacity: 0.10, maxOpacity: 0.20, interval: 7500,  initMin: 500,  initMax: 3000, initCount: 1, filter: BAG_FILTER },
        { emoji: '🕶️', minSize: 12, maxSize: 26, minDur: 8,  maxDur: 18, minOpacity: 0.09, maxOpacity: 0.18, interval: 10500, initMin: 1000, initMax: 3500, initCount: 1 },
      ],
    },
  };

  const preset = PRESETS[window.lamopadFallConfig] || PRESETS.subtle;

  /* ── spawn ── */
  function spawnItem(cfg) {
    const el = document.createElement('span');
    el.className = 'lama';
    el.textContent = cfg.emoji;

    const size      = rand(cfg.minSize, cfg.maxSize);
    const dur       = rand(cfg.minDur, cfg.maxDur);
    const totalDist = window.innerHeight + 160;
    const opacity   = rand(cfg.minOpacity, cfg.maxOpacity);

    el.style.cssText = [
      'left:' + rand(-2, 100) + 'vw;',
      'font-size:' + size + 'px;',
      'animation-duration:' + dur + 's;',
      '--fall-dist:' + totalDist + 'px;',
      '--rot-start:' + rand(-25, 25) + 'deg;',
      '--rot-end:' + rand(-180, 180) + 'deg;',
      '--opacity:' + opacity + ';',
      cfg.filter ? 'filter:' + cfg.filter + ';' : '',
    ].join('');

    canvas.appendChild(el);
    el.addEventListener('animationend', () => el.remove());

    /* drag */
    const pxPerMs = totalDist / (dur * 1000);
    let startMX, startMY, startEL, startET, fallAnim = null, dragging = false;

    function beginDrag(cx, cy) {
      const r = el.getBoundingClientRect();
      el.style.animation = 'none';
      el.style.opacity   = opacity;
      el.style.transform = 'none';
      el.style.top  = r.top  + 'px';
      el.style.left = r.left + 'px';
      if (fallAnim) { fallAnim.cancel(); fallAnim = null; }
      startMX = cx; startMY = cy; startEL = r.left; startET = r.top;
      el.classList.add('dragging');
      document.body.style.userSelect = 'none';
    }

    function moveDrag(cx, cy) {
      el.style.left = (startEL + cx - startMX) + 'px';
      el.style.top  = (startET + cy - startMY) + 'px';
    }

    function endDrag() {
      el.classList.remove('dragging');
      document.body.style.userSelect = '';
      const curTop    = parseFloat(el.style.top);
      const remaining = window.innerHeight + 160 - curTop;
      if (remaining <= 0) { el.remove(); return; }
      fallAnim = el.animate(
        [
          { transform: 'translateY(0) rotate(0deg)', opacity: opacity },
          { transform: 'translateY(' + remaining + 'px) rotate(' + rand(-200, 200) + 'deg)', opacity: 0 },
        ],
        { duration: remaining / pxPerMs, easing: 'linear', fill: 'forwards' }
      );
      fallAnim.addEventListener('finish', () => el.remove());
    }

    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      dragging = true;
      beginDrag(e.clientX, e.clientY);
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    });
    el.addEventListener('pointerup',     function () { if (!dragging) return; dragging = false; endDrag(); });
    el.addEventListener('pointercancel', function () { if (!dragging) return; dragging = false; endDrag(); });
  }

  /* ── schedule ── */
  preset.items.forEach(function (cfg) {
    for (let i = 0; i < cfg.initCount; i++) {
      setTimeout(function () { spawnItem(cfg); }, rand(cfg.initMin, cfg.initMax));
    }
    setInterval(function () { spawnItem(cfg); }, cfg.interval);
  });
})();
