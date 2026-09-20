// ─── Кислота: пост-эффект на камеру игрового мира ────────────────────────────
// Вешается ТОЛЬКО на камеру сцены game, поэтому HUD и оверлеи остаются
// трезвыми и читаемыми. Сила эффекта (uTrip) растёт вместе с толпой: в начале
// это едва заметное дыхание, под конец — полный разъём.
const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uBeat;
uniform float uEnergy;
uniform float uTrip;
uniform float uHue;
varying vec2 outTexCoord;

// поворот цвета вокруг оси серого — то самое «всё поплыло по цвету»
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735, 0.57735, 0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

void main() {
  float amp = uTrip;
  vec2 p = outTexCoord - 0.5;

  // кадр дышит на долю
  p *= 1.0 - uBeat * 0.035 * amp;

  // волны по обеим осям, разной частоты — чтобы не читалось как рябь
  float e = 0.45 + uEnergy * 0.55;
  p.x += sin(p.y * 15.0 + uTime * 2.3) * 0.011 * amp * e;
  p.y += cos(p.x * 11.0 + uTime * 1.6) * 0.008 * amp * e;

  vec2 uv = p + 0.5;

  // хроматическая аберрация: на удар цвета разъезжаются от центра
  vec2 dir = p / (length(p) + 0.001);
  float ca2 = (0.0015 + uBeat * 0.011) * amp;
  vec3 col;
  col.r = texture2D(uMainSampler, uv + dir * ca2).r;
  col.g = texture2D(uMainSampler, uv).g;
  col.b = texture2D(uMainSampler, uv - dir * ca2).b;

  col = hueShift(col, uHue);

  // вспышка на долю и лёгкое виньетирование, чтобы центр держал внимание
  col += uBeat * 0.17 * amp;
  col *= 1.0 - length(p) * 0.35 * amp;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class TripPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game) {
    super({ game, name: 'Trip', fragShader: FRAG });
    this.trip = 0;
    this.beat = 0;
    this.energy = 0;
    this.hue = 0;
  }

  onPreRender() {
    this.set1f('uTime', this.game.loop.time / 1000);
    this.set1f('uBeat', this.beat);
    this.set1f('uEnergy', this.energy);
    this.set1f('uTrip', this.trip);
    this.set1f('uHue', this.hue);
  }
}
