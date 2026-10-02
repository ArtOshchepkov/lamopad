/** «Тревожился k раз из n» словами: от «ни разу» до «всегда». Границы 20% и 80% - на глаз. */
export function howOften(k, n) {
  if (n === 0) return 'ещё ни разу не звали';
  const r = k / n;
  if (r === 0) return 'ни разу';
  if (r === 1) return 'всегда';
  if (r === 0.5) return 'в половине случаев';
  if (r <= 0.2) return 'изредка';
  if (r < 0.5) return 'реже, чем через раз';
  if (r < 0.8) return 'чаще, чем через раз';
  return 'почти всегда';
}

/** Процент как увиденное «X из Y»: берём самый круглый Y, при котором X целый (80% → 8 из 10, 75% → 3 из 4). */
export function asSeen(pct) {
  const whole = [10, 4, 20, 100].find((y) => Number.isInteger((pct * y) / 100));
  return `${(pct * whole) / 100} из ${whole}`;
}

/** Подпись под итоговым шансом: 26-49% - уже «меньше половины». */
export function verdictScale(p) {
  return p !== null && p >= 0.26 && p < 0.5 ? 'меньше половины' : '';
}
