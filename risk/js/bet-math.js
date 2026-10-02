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
