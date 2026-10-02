/**
 * Квадрат всех вызовов в кабинет: слева столбец уволенных шириной prior,
 * справа остальные; снизу яркая часть - кого звали тревожно.
 * Координаты в долях квадрата, y считается снизу.
 */
export function mosaicParts({ hit, falseAlarm, prior }) {
  const column = (x, w, called, fired) => [
    { key: fired ? 'firedCalled' : 'calmCalled', x, w, y: 0, h: called, solid: true, left: fired },
    { key: fired ? 'firedQuiet' : 'calmQuiet', x, w, y: called, h: 1 - called, solid: false, left: fired },
  ];
  return [...column(0, prior, hit, true), ...column(prior, 1 - prior, falseAlarm, false)];
}

const PAD_X = 8;
const PAD_Y = 6;

/**
 * Куда ставить подпись части размером part (px), если сама подпись label (px).
 * Не влезла по ширине - выносим вбок, в соседний столбец; по высоте - на границу
 * с соседней частью того же столбца, которая при этом заведомо большая.
 */
export function placeLabel(part, label, { left, solid }) {
  if (part.w < 1 || part.h < 1) return 'none';
  if (label.w + PAD_X <= part.w && label.h + PAD_Y <= part.h) return 'in';
  if (label.w + PAD_X > part.w) return left ? 'right' : 'left';
  return solid ? 'up' : 'down';
}
