import test from 'node:test';
import assert from 'node:assert/strict';
import { posterior, stepInputs, share, laplace, seenShare, baseRate } from '../strategy/bayes-rule-basic/js/bayes-math.js';

const near = (got, want, tol = 1e-9) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ~${want}, got ${got}`);

const STORY = { hit: 0.75, falseAlarm: 0.5, prior: 0.01 };

test('posterior', async (t) => {
  await t.test('textbook Bayes: 0.75·0.01 / (0.75·0.01 + 0.5·0.99)', () => {
    const r = posterior(STORY);
    near(r.fired, 0.0075);
    near(r.calm, 0.495);
    near(r.p, 0.0075 / 0.5025);
  });

  await t.test('equal prior reduces to hit / (hit + falseAlarm)', () => {
    near(posterior({ hit: 0.75, falseAlarm: 0.5, prior: 0.5 }).p, 0.6);
  });

  await t.test('call that never happens without firing proves the firing', () => {
    near(posterior({ hit: 0.1, falseAlarm: 0, prior: 0.01 }).p, 1);
  });

  await t.test('impossible evidence has no answer instead of NaN', () => {
    assert.equal(posterior({ hit: 0, falseAlarm: 0, prior: 0.3 }).p, null);
  });
});

test('stepInputs', async (t) => {
  await t.test('step 1: anxiety silently assumes falseAlarm = 1 − hit and 50/50', () => {
    const s = stepInputs(1, STORY);
    assert.deepEqual(s, { hit: 0.75, falseAlarm: 0.25, prior: 0.5 });
    near(posterior(s).p, 0.75);
  });

  await t.test('step 1 answer is always the flipped "if fired, then called"', () => {
    for (const hit of [0, 0.3, 0.9, 1]) near(posterior(stepInputs(1, { ...STORY, hit })).p, hit);
  });

  await t.test('step 2 keeps the 50/50 prior', () => {
    assert.deepEqual(stepInputs(2, STORY), { hit: 0.75, falseAlarm: 0.5, prior: 0.5 });
  });

  await t.test('step 3 uses everything as is', () => {
    assert.deepEqual(stepInputs(3, STORY), STORY);
  });
});

test('share: counts typed as «X из Y»', async (t) => {
  await t.test('plain fraction', () => near(share(3, 4), 0.75));
  await t.test('part above the whole is capped', () => near(share(7, 4), 1));
  await t.test('empty whole gives no share instead of 0 / 0', () => assert.equal(share(0, 0), null));
});

test('laplace: what I saw is not my whole life', async (t) => {
  await t.test('8 of 10 seen → 9 / 12', () => near(laplace(8, 10), 0.75));
  await t.test('0 of 10 is unlikely, not impossible', () => near(laplace(0, 10), 1 / 12));
  await t.test('10 of 10 is likely, not certain', () => near(laplace(10, 10), 11 / 12));
  await t.test('nothing seen yet is 50/50, no 0 / 0', () => near(laplace(0, 0), 0.5));
  await t.test('the more seen, the closer to the plain share', () => near(laplace(800, 1000), 801 / 1002));
  await t.test('part above the whole is capped', () => near(laplace(15, 10), 11 / 12));
});

test('seenShare: Laplace only where a zero would wipe out Bayes', async (t) => {
  await t.test('plain share when something was seen', () => assert.deepEqual(seenShare(8, 10), { p: 0.8, smoothed: false }));
  await t.test('full count stays plain too', () => assert.deepEqual(seenShare(10, 10), { p: 1, smoothed: false }));
  await t.test('zero switches to Laplace', () => assert.deepEqual(seenShare(0, 10), { p: 1 / 12, smoothed: true }));
});

test('seenShare: never called before', () => assert.deepEqual(seenShare(0, 0), { p: 0.5, smoothed: true }));

test('baseRate: share fired from «calm из whole вышли нормально»', async (t) => {
  await t.test('plain share inside the range', () => {
    const r = baseRate(99, 100);
    near(r.p, 0.01);
    assert.equal(r.smoothed, false);
  });
  await t.test('nobody fired is rare, not never', () => assert.deepEqual(baseRate(100, 100), { p: 1 / 102, smoothed: true }));
  await t.test('everybody fired is frequent, not always', () => assert.deepEqual(baseRate(0, 100), { p: 101 / 102, smoothed: true }));
});
