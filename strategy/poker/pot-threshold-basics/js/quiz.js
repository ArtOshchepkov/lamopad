/**
 * Мини-квиз: «какая максимальная ставка имеет смысл» и «с какой вероятностью
 * имеет смысл поставить 50». Числа подобраны так, чтобы ответы были круглыми,
 * кроме одного 33,33…%, на котором видно правило округления.
 */
const TOLERANCE = 0.1;
const QUIZ_CALL = 50;

const maxCall = (pot, chance) => ({ kind: 'maxCall', pot, chance, answer: (chance * pot) / (100 - chance) });
const minChance = (pot) => ({ kind: 'minChance', pot, call: QUIZ_CALL, answer: (100 * QUIZ_CALL) / (pot + QUIZ_CALL) });

export const MAX_CALL_POOL = [
  maxCall(100, 20), // 25
  maxCall(300, 25), // 100
  maxCall(90, 40),  // 60
  maxCall(200, 50), // 200
  maxCall(180, 10), // 20
  maxCall(80, 60),  // 120
];

export const MIN_CHANCE_POOL = [
  minChance(150), // 25%
  minChance(200), // 20%
  minChance(450), // 10%
  minChance(50),  // 50%
  minChance(75),  // 40%
  minChance(100), // 33,33…%
];

/** Число из свободного ввода: «33,3 %», «16.5 мон.»; NaN, если числа нет. */
export function parseAnswer(text) {
  const m = String(text).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

export function judge(answer, exact) {
  const diff = Math.abs(answer - exact);
  return { ok: diff < TOLERANCE - 1e-9, exact: diff < 1e-9 };
}

function pick(pool, n, rand) {
  const rest = [...pool];
  return Array.from({ length: Math.min(n, rest.length) }, () => rest.splice(Math.floor(rand() * rest.length), 1)[0]);
}

export function makeQuiz(rand = Math.random, perKind = 3) {
  return [...pick(MAX_CALL_POOL, perKind, rand), ...pick(MIN_CHANCE_POOL, perKind, rand)];
}

/**
 * Ответ того, кто забыл, что при победе ставка возвращается, и сравнил
 * ставку со всем куском банка: p · банк вместо p · банк / (1 − p),
 * ставка / банк вместо ставка / (банк + ставка).
 */
export function naiveAnswer(q) {
  return q.kind === 'maxCall' ? (q.chance * q.pot) / 100 : (100 * q.call) / q.pot;
}

/** 'stakeBack', если ответ похож на naiveAnswer (до 1 ниже него, с учётом округления), иначе null. */
export function diagnose(q, answer) {
  if (judge(answer, q.answer).ok) return null;
  const naive = naiveAnswer(q);
  return answer >= naive - 1 - 1e-9 && answer < naive + TOLERANCE ? 'stakeBack' : null;
}
