import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCall, evLine, ceilingSeries } from '../risk/js/bet-math.js';

const near = (got, want, tol = 1e-9) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ~${want}, got ${got}`);

test('assessCall', async (t) => {
  await t.test('losing call: pot 100, call 50, 20% to win', () => {
    const r = assessCall({ pot: 100, call: 50, winChance: 0.2 });
    near(r.ev, -20);
    near(r.evPerCoin, -0.4);
    near(r.breakEvenChance, 50 / 150);
    near(r.maxCall, 25);
    assert.equal(r.verdict, 'no');
  });

  await t.test('winning call: pot 300, call 30, 10% to win', () => {
    const r = assessCall({ pot: 300, call: 30, winChance: 0.1 });
    near(r.ev, 0.1 * 300 - 0.9 * 30);
    near(r.maxCall, 300 / 9);
    assert.equal(r.verdict, 'yes');
  });

  await t.test('exact break-even is neither yes nor no', () => {
    const r = assessCall({ pot: 100, call: 25, winChance: 0.2 });
    near(r.ev, 0);
    assert.equal(r.verdict, 'even');
  });

  await t.test('coin flip pays off only while the call is below the pot', () => {
    assert.equal(assessCall({ pot: 100, call: 99, winChance: 0.5 }).verdict, 'yes');
    const r = assessCall({ pot: 100, call: 1000, winChance: 0.5 });
    near(r.ev, -450);
    near(r.maxCall, 100);
  });

  await t.test('free call has no per-coin ratio but is never a loss', () => {
    const r = assessCall({ pot: 100, call: 0, winChance: 0.3 });
    near(r.ev, 30);
    assert.equal(r.evPerCoin, null);
    assert.equal(r.verdict, 'yes');
  });

  await t.test('sure win allows an unlimited call', () => {
    assert.equal(assessCall({ pot: 100, call: 10, winChance: 1 }).maxCall, Infinity);
  });
});

test('evLine: EV as a function of the call is a falling line', async (t) => {
  await t.test('starts at p · pot, falls by 1 − p per coin, crosses zero at the max call', () => {
    const l = evLine(100, 0.2);
    near(l.top, 20);
    near(l.slope, -0.8);
    near(l.zero, 25);
    near(l.at(l.zero), 0);
    near(l.at(10), assessCall({ pot: 100, call: 10, winChance: 0.2 }).ev);
  });

  await t.test('the pot only rescales the triangle, its shape depends on p alone', () => {
    const a = evLine(100, 0.3), b = evLine(700, 0.3);
    near(b.top / a.top, 7);
    near(b.zero / a.zero, 7);
    near(b.slope, a.slope);
  });

  await t.test('odds against: the max call is the pot divided by them', () => {
    near(evLine(100, 0.2).oddsAgainst, 4);
    near(evLine(90, 0.25).zero, 90 / 3);
    near(evLine(100, 0.5).zero, 100);
  });

  await t.test('a sure win has no ceiling', () => {
    assert.equal(evLine(100, 1).zero, Infinity);
  });
});

test('ceilingSeries: p + p² + … approximates the ceiling p / (1 − p)', async (t) => {
  await t.test('sums the first terms', () => {
    near(ceilingSeries(0.2, 1), 0.2);
    near(ceilingSeries(0.2, 2), 0.24);
    near(ceilingSeries(0.2, 3), 0.248);
  });

  await t.test('relative error is exactly p to the n, always from below', () => {
    for (const p of [0.05, 0.2, 0.5, 0.8]) {
      const exact = evLine(1, p).zero;
      for (const n of [1, 2, 3]) {
        near(1 - ceilingSeries(p, n) / exact, p ** n);
      }
    }
  });

  await t.test('fractional n blends towards the next term for smooth morphing', () => {
    near(ceilingSeries(0.2, 1.5), 0.2 + 0.5 * 0.04);
  });
});
