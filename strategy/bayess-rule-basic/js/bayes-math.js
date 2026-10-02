/**
 * Теорема Байеса на истории «зайди ко мне в кабинет».
 * hit        - P(позвали так | увольняют): «если увольняют, то обычно так»
 * falseAlarm - P(позвали так | не увольняют): «а бывало наоборот?»
 * prior      - P(увольняют): как часто такой вызов вообще кончается увольнением
 */
export function posterior({ hit, falseAlarm, prior }) {
  const fired = hit * prior;
  const calm = falseAlarm * (1 - prior);
  return { fired, calm, p: fired + calm > 0 ? fired / (fired + calm) : null };
}

/**
 * Формула одна на все шаги. Неизвестное на шаге тревожка подставляет молча:
 * на шаге 1 «не увольняют - значит, зовут в остальных 1 − hit случаях»,
 * на шагах 1-2 «либо уволят, либо нет - 50 на 50». С такими подстановками
 * формула выдаёт ровно hit, то есть перевёрнутое «если увольняют, то зовут».
 */
export function stepInputs(step, { hit, falseAlarm, prior }) {
  return {
    hit,
    falseAlarm: step >= 2 ? falseAlarm : 1 - hit,
    prior: step >= 3 ? prior : 0.5,
  };
}

/** Доля из счёта «part из whole»; пустой счёт ничего не говорит, поэтому null, а не 0 / 0. */
export function share(part, whole) {
  return whole > 0 ? Math.min(part, whole) / whole : null;
}

/**
 * Правило Лапласа: к увиденному добавляем по одному воображаемому случаю каждого исхода.
 * Малая выборка «0 из 10» не превращается в «никогда», «10 из 10» - в «всегда»,
 * а пустая - в 0 / 0. Чем больше увидено, тем меньше поправка.
 */
export function laplace(part, whole) {
  return (Math.min(part, whole) + 1) / (whole + 2);
}

/**
 * Доля из своей выборки. Честнее всегда сглаживать по Лапласу, но для наглядности
 * страница берёт простую долю и включает Лапласа только на нуле, который обнулил бы весь ответ.
 */
export function seenShare(part, whole) {
  return part > 0 ? { p: share(part, whole), smoothed: false } : { p: laplace(part, whole), smoothed: true };
}

/**
 * Доля уволенных, если calm из whole выходят нормально. Здесь обнуляет ответ любой край:
 * 0 уволенных даёт шанс ровно 0, 0 нормальных - ровно 1, поэтому Лаплас на обоих.
 */
export function baseRate(calm, whole) {
  const fired = whole - calm;
  return fired > 0 && calm > 0 ? { p: fired / whole, smoothed: false } : { p: laplace(fired, whole), smoothed: true };
}
