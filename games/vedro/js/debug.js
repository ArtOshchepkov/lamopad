// ─── Debug-оверлей: ?debug=true в URL — FPS + произвольные значения из игры ──
// Использование:
//   Debug.init()               — один раз в main.js, до старта Phaser
//   Debug.mount(scene)         — один раз в сцене, которая всегда на экране (UI)
//   Debug.update(time)         — каждый кадр из update() той же сцены
//   Debug.set('ключ', значение) — откуда угодно, сколько угодно часто —
//                                  сама перерисовка троттлится, лишнего не тормозит
export const Debug = {
  enabled: false,
  lines: new Map(),
  text: null,
  scene: null,
  lastDrawAt: 0,

  init() {
    const params = new URLSearchParams(window.location.search);
    this.enabled = params.get('debug') === 'true' || params.get('debug') === '1';
  },

  set(key, value) {
    if (!this.enabled) return;
    this.lines.set(key, value);
  },

  mount(scene) {
    if (!this.enabled) return;
    this.scene = scene;
    this.text = scene.add.text(6, 6, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#7fff9a',
      backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 6, y: 4 },
      lineSpacing: 2,
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(9999);
  },

  /** Вызывать раз в кадр из update() сцены, где вызван mount(). */
  update(time) {
    if (!this.enabled || !this.text) return;
    if (time - this.lastDrawAt < 200) return; // не чаще 5 раз/сек — сам дебаг не должен тормозить
    this.lastDrawAt = time;
    const fps = Math.round(this.scene.game.loop.actualFps);
    let out = `FPS: ${fps}`;
    for (const [k, v] of this.lines) out += `\n${k}: ${v}`;
    this.text.setText(out);
  },
};
