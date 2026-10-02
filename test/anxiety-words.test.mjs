import test from 'node:test';
import assert from 'node:assert/strict';
import { howOften, asSeen, verdictScale } from '../strategy/bayes-rule-basic/js/anxiety-words.js';

test('howOften: «тревожился k из n» in words', () => {
  const cases = [
    [0, 0, 'ещё ни разу не звали'],
    [0, 20, 'ни разу'],
    [2, 20, 'изредка'],
    [7, 20, 'реже, чем через раз'],
    [10, 20, 'в половине случаев'],
    [13, 20, 'чаще, чем через раз'],
    [18, 20, 'почти всегда'],
    [20, 20, 'всегда'],
    [1, 1, 'всегда'],
  ];
  for (const [k, n, want] of cases) assert.equal(howOften(k, n), want, `${k} из ${n}`);
});

test('asSeen: percent as «X из Y» with the smallest round Y', () => {
  const cases = [[80, '8 из 10'], [50, '5 из 10'], [75, '3 из 4'], [25, '1 из 4'], [35, '7 из 20'], [37, '37 из 100'], [100, '10 из 10'], [1, '1 из 100']];
  for (const [pct, want] of cases) assert.equal(asSeen(pct), want, `${pct}%`);
});

test('verdictScale: caption under the final chance', () => {
  assert.equal(verdictScale(0.26), 'меньше половины');
  assert.equal(verdictScale(0.49), 'меньше половины');
  assert.equal(verdictScale(0.4999), 'меньше половины');
  assert.equal(verdictScale(0.259), '');
  assert.equal(verdictScale(0.5), '');
  assert.equal(verdictScale(null), '');
});
