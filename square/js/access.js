// ─── Рулетка доступов: страница то и дело просит что-нибудь у браузера ──────
//
// Геймплей: после старта в случайные моменты всплывает запрос доступа - к камере,
// микрофону, геопозиции, MIDI, устройствам. Первый приходит через 0-2 сек,
// каждый следующий - не позже чем через минуту после предыдущего.
// Первые три всегда одни и те же: камера, микрофон, геопозиция. Дальше - жребий.
// Больше страница ничего не делает: потоки гасятся сразу, координаты и
// прочее выбрасываются, ответ никуда не уходит.
//
// Roulette - чистая логика, браузер в неё приходит снаружи:
// REQUESTS - что просить, startAccessRoulette - проводка.

export const FIRST_MAX = 2000;    // первый запрос: 0-2 сек после старта
export const NEXT_MAX = 60000;    // следующие: 0-60 сек после предыдущего
export const OPENING = ['camera', 'microphone', 'geolocation'];   // порядок первых трёх

const stop = (stream) => stream.getTracks().forEach((t) => t.stop());
const media = async (constraints) => stop(await navigator.mediaDevices.getUserMedia(constraints));

// Поля запроса:
//   permission - что спросить у Permissions API, чтобы не дёргать уже решённое
//   gesture    - API требует свежего клика или клавиши (пикеры устройств и т.п.)
//   repeat     - у ответа нет состояния (пикер): спрашиваем снова и снова,
//                иначе - пока браузер готов показывать запрос (state "prompt")
export const REQUESTS = [
  { name: 'camera', permission: { name: 'camera' },
    supported: () => !!navigator.mediaDevices?.getUserMedia,
    run: () => media({ video: true }) },
  { name: 'microphone', permission: { name: 'microphone' },
    supported: () => !!navigator.mediaDevices?.getUserMedia,
    run: () => media({ audio: true }) },
  { name: 'geolocation', permission: { name: 'geolocation' },
    supported: () => !!navigator.geolocation,
    run: () => navigator.geolocation.getCurrentPosition(() => {}, () => {}) },
  { name: 'notifications', permission: { name: 'notifications' }, gesture: true,
    supported: () => typeof Notification !== 'undefined',
    run: () => Notification.requestPermission() },
  { name: 'clipboard', permission: { name: 'clipboard-read' }, gesture: true,
    supported: () => !!navigator.clipboard?.readText,
    run: () => navigator.clipboard.readText() },
  { name: 'midi', permission: { name: 'midi', sysex: true },
    supported: () => !!navigator.requestMIDIAccess,
    run: () => navigator.requestMIDIAccess({ sysex: true }) },
  { name: 'screens', permission: { name: 'window-management' },
    supported: () => !!globalThis.getScreenDetails,
    run: () => window.getScreenDetails() },
  { name: 'fonts', permission: { name: 'local-fonts' }, gesture: true,
    supported: () => !!globalThis.queryLocalFonts,
    run: () => window.queryLocalFonts() },
  // iOS: один запрос на датчики движения и ориентации сразу
  { name: 'motion', gesture: true,
    supported: () => typeof DeviceMotionEvent !== 'undefined' && !!DeviceMotionEvent.requestPermission,
    run: () => DeviceMotionEvent.requestPermission() },
  { name: 'screen-capture', gesture: true, repeat: true,
    supported: () => !!navigator.mediaDevices?.getDisplayMedia,
    run: () => navigator.mediaDevices.getDisplayMedia({ video: true }).then(stop) },
  { name: 'bluetooth', gesture: true, repeat: true,
    supported: () => !!navigator.bluetooth?.requestDevice,
    run: () => navigator.bluetooth.requestDevice({ acceptAllDevices: true }) },
  { name: 'usb', gesture: true, repeat: true,
    supported: () => !!navigator.usb?.requestDevice,
    run: () => navigator.usb.requestDevice({ filters: [] }) },
  { name: 'serial', gesture: true, repeat: true,
    supported: () => !!navigator.serial?.requestPort,
    run: () => navigator.serial.requestPort() },
  { name: 'hid', gesture: true, repeat: true,
    supported: () => !!navigator.hid?.requestDevice,
    run: () => navigator.hid.requestDevice({ filters: [] }) },
];

const shuffled = (list, rand) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export class Roulette {
  constructor({
    requests, opening = [], rand = Math.random,
    later = (fn, ms) => setTimeout(fn, ms),
    state = async () => null,             // 'prompt' | 'granted' | 'denied' | null (не знаем)
    hasGesture = () => false,
    onGesture = () => {},                 // вызвать fn на ближайшем вводе пользователя
  }) {
    Object.assign(this, { requests, rand, later, state, hasGesture, onGesture });
    this.opening = [...opening];
    // остальные - в случайном порядке; открывающие вернутся в колоду со второго круга
    this.deck = shuffled(requests.filter((r) => !opening.includes(r)), rand);
    this.spent = new Set();
  }

  start() {
    this.later(() => this.fire(), this.rand() * FIRST_MAX);
  }

  async fire() {
    const req = await this.draw();
    if (!req) return;                     // спрашивать больше нечего - рулетка стоп
    this.spent.add(req);
    if (req.gesture && !this.hasGesture()) this.onGesture(() => this.ask(req));
    else this.ask(req);
  }

  // Ответа не ждём: если игрок игнорирует запрос, промис не завершится никогда,
  // а следующий должен прийти в срок. Таймер запускаем от самого запроса
  ask(req) {
    try { Promise.resolve(req.run()).catch(() => {}); } catch (e) { /* отказ на месте */ }
    this.later(() => this.fire(), this.rand() * NEXT_MAX);
  }

  // Колода тасуется заново, когда кончилась: все виды запросов по разу, потом
  // по кругу. Пустой полный круг - значит, просить больше нечего.
  // Пока свежего ввода нет, запросы с жестом откладываем на потом: срок
  // важнее, ждать клавишу приходится, только если больше ничего не осталось
  async draw() {
    while (this.opening.length) {           // начало игры не бросает жребий
      const req = this.opening.shift();
      if (await this.eligible(req)) return req;
    }
    const fresh = this.hasGesture();
    for (let pass = 0; pass < 2; pass++) {
      if (!this.deck.length) this.deck = shuffled(this.requests, this.rand);
      const held = [];
      let pick = null;
      while (this.deck.length && !pick) {
        const req = this.deck.pop();
        if (!(await this.eligible(req))) continue;
        if (req.gesture && !fresh) held.push(req); else pick = req;
      }
      pick = pick || held.pop() || null;
      this.deck.unshift(...held);
      if (pick) return pick;
    }
    return null;
  }

  // Решённое (granted/denied) браузер повторно не покажет - зря тратить слот
  // не будем. Состояния не знаем - спрашиваем один раз
  async eligible(req) {
    if (!req.supported()) return false;
    if (req.repeat) return true;
    const state = await this.state(req);
    return state ? state === 'prompt' : !this.spent.has(req);
  }
}

async function queryState(req) {
  if (!req.permission) return null;
  try { return (await navigator.permissions.query(req.permission)).state; } catch (e) { return null; }
}

// Ввод, дающий право на запросы с жестом. Esc и одинокие модификаторы
// активации не дают - тогда ждём следующий
function onGesture(fn) {
  const events = ['keydown', 'pointerdown', 'pointerup', 'touchend'];
  const go = () => {
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    events.forEach((t) => window.removeEventListener(t, go, true));
    fn();
  };
  events.forEach((t) => window.addEventListener(t, go, true));
}

export function startAccessRoulette() {
  new Roulette({
    requests: REQUESTS,
    opening: OPENING.map((name) => REQUESTS.find((r) => r.name === name)),
    state: queryState,
    hasGesture: () => !!navigator.userActivation?.isActive,
    onGesture,
  }).start();
}
