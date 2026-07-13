// ─── Звуки по папкам: случайный сэмпл из папки, без привязки к именам файлов ──
// Реестр наполняется один раз в BootScene из sounds/manifest.json.

let keysByFolder = {};
const lastKeyByFolder = {};

/** folder -> [cacheKey, ...], вызывается один раз из BootScene после загрузки. */
export function registerSoundFolders(map) {
  keysByFolder = map;
}

/** Играет случайный сэмпл из папки folder; не повторяет подряд один и тот же. */
// НЕ «оптимизировать» ранним выходом по scene.sound.mute: getter mute в Phaser
// читает gain.value, который не отражает setValueAtTime (проверено в Chrome) —
// после мут→анмут залипает и звуки пропадают насовсем
export function playRandom(scene, folder, config) {
  const keys = keysByFolder[folder];
  if (!keys || !keys.length) return;
  let key = keys[0];
  if (keys.length > 1) {
    do { key = keys[Phaser.Math.Between(0, keys.length - 1)]; }
    while (key === lastKeyByFolder[folder]);
  }
  lastKeyByFolder[folder] = key;
  scene.sound.play(key, config);
}
