/**
 * Матожидание колла в покере.
 * pot - банк до моего колла (вместе со ставкой соперника), call - моя доплата.
 * При победе я забираю pot и возвращаю свой call, поэтому call теряется
 * только с вероятностью проигрыша: EV = p·pot − (1 − p)·call.
 */
const EPS = 1e-9;

export function assessCall({ pot, call, winChance: p }) {
  const ev = p * pot - (1 - p) * call;
  // Сравнение с допуском: на ползунках 0.2·100 − 0.8·25 даёт не ровно 0
  const verdict = Math.abs(ev) < EPS * Math.max(1, pot, call) ? 'even' : ev > 0 ? 'yes' : 'no';
  return {
    ev,
    evPerCoin: call > 0 ? ev / call : null,
    breakEvenChance: pot + call > 0 ? call / (pot + call) : 0,
    maxCall: p >= 1 ? Infinity : (p * pot) / (1 - p),
    verdict,
  };
}

/**
 * EV как функция ставки x при фиксированных банке и шансе: прямая
 * EV(x) = p·pot − (1 − p)·x. Вместе с осями она отсекает треугольник:
 * высота p·pot, наклон −(1 − p), ноль в точке максимальной ставки.
 * Форма треугольника зависит только от p, банк лишь растягивает обе оси.
 */
export function evLine(pot, p) {
  return {
    top: p * pot,
    slope: -(1 - p),
    zero: assessCall({ pot, call: 0, winChance: p }).maxCall,
    // «Шансы против»: во сколько раз проигрыш вероятнее победы; потолок ставки = pot / oddsAgainst
    oddsAgainst: p > 0 ? (1 - p) / p : Infinity,
    at: (x) => assessCall({ pot, call: x, winChance: p }).ev,
  };
}

/**
 * Первые n членов ряда p + p² + p³ + … для потолка p / (1 − p) в долях банка.
 * Сумма равна точному значению × (1 − pⁿ): ошибка всегда вниз, относительная ровно pⁿ.
 * Дробное n плавно добавляет часть следующего члена - нужно для анимации переключения.
 */
export function ceilingSeries(p, n) {
  const whole = Math.floor(n);
  let sum = 0;
  for (let k = 1; k <= whole; k++) sum += p ** k;
  return sum + (n - whole) * p ** (whole + 1);
}
