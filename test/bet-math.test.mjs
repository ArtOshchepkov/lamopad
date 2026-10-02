import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCall } from '../risk/js/bet-math.js';

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
