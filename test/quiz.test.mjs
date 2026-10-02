import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswer, judge, makeQuiz, MAX_CALL_POOL, MIN_CHANCE_POOL } from '../risk/js/quiz.js';

test('parseAnswer accepts free-form numbers', () => {
  assert.equal(parseAnswer('25'), 25);
  assert.equal(parseAnswer(' 33,3 % '), 33.3);
  assert.equal(parseAnswer('16.5 мон.'), 16.5);
  assert.ok(Number.isNaN(parseAnswer('')));
  assert.ok(Number.isNaN(parseAnswer('много')));
});

test('judge allows answers within 0.1 of the exact value', async (t) => {
  await t.test('exact hit', () => {
    assert.deepEqual(judge(25, 25), { ok: true, exact: true });
  });

  await t.test('rounded 33.3 for 33.33… counts but is not exact', () => {
    assert.deepEqual(judge(33.3, 100 / 3), { ok: true, exact: false });
  });

  await t.test('0.1 or further off is wrong', () => {
    assert.equal(judge(25.1, 25).ok, false);
    assert.equal(judge(20, 25).ok, false);
  });
});

test('pools hold the intended answers', () => {
  for (const q of MAX_CALL_POOL) {
    const ev = (q.chance / 100) * q.pot - (1 - q.chance / 100) * q.answer;
    assert.ok(Math.abs(ev) < 1e-9, `max call ${q.answer} for pot ${q.pot} at ${q.chance}% must break even`);
  }
  for (const q of MIN_CHANCE_POOL) {
    assert.ok(Math.abs(q.answer - (100 * q.call) / (q.pot + q.call)) < 1e-9);
  }
});

test('makeQuiz asks max-call questions first, then min-chance ones, without repeats', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const quiz = makeQuiz(rand, 3);
  assert.equal(quiz.length, 6);
  assert.deepEqual(quiz.map((q) => q.kind), ['maxCall', 'maxCall', 'maxCall', 'minChance', 'minChance', 'minChance']);
  assert.equal(new Set(quiz).size, 6);
});
