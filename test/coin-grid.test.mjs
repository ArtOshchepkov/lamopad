import test from 'node:test';
import assert from 'node:assert/strict';
import { pickUnit, cells, pileCols, cutHeight } from '../strategy/poker/pot-threshold-basics/js/coin-grid.js';

test('pickUnit chooses the smallest round coin value that keeps the grid short', () => {
  assert.equal(pickUnit(0), 1);
  assert.equal(pickUnit(40), 1);
  assert.equal(pickUnit(50), 1);
  assert.equal(pickUnit(51), 2);
  assert.equal(pickUnit(240), 5);
  assert.equal(pickUnit(1000), 20);
  assert.equal(pickUnit(1001), 50);
});

test('cells split an amount into squares and shade the filled part', async (t) => {
  await t.test('whole squares, partly shaded', () => {
    assert.deepEqual(cells(30, 15, 10), [
      { part: 1, fill: 1 },
      { part: 1, fill: 0.5 },
      { part: 1, fill: 0 },
    ]);
  });

  await t.test('last square covers only the remainder', () => {
    assert.deepEqual(cells(25, 25, 10), [
      { part: 1, fill: 1 },
      { part: 1, fill: 1 },
      { part: 0.5, fill: 0.5 },
    ]);
  });

  await t.test('nothing to draw for zero', () => {
    assert.deepEqual(cells(0, 0, 10), []);
  });

  await t.test('float noise does not spawn an empty trailing square', () => {
    assert.equal(cells(0.1 * 300, 0, 10).length, 3);
  });
});

test('pileCols keeps a pile close to a square', () => {
  assert.equal(pileCols(0), 1);
  assert.equal(pileCols(1), 1);
  assert.equal(pileCols(10), 4);
  assert.equal(pileCols(16), 4);
  assert.equal(pileCols(17), 5);
  assert.equal(pileCols(50), 8);
});

test('cutHeight finds the line that leaves `area` squares below it', async (t) => {
  const full = (n) => Array(n).fill(1);

  await t.test('full rectangle: share of height equals share of area', () => {
    assert.equal(cutHeight(full(16), 4, 4), 1);
    assert.equal(cutHeight(full(16), 4, 6), 1.5);
    assert.equal(cutHeight(full(16), 4, 16), 4);
  });

  await t.test('short top row is cut by its own width', () => {
    // 10 квадратов по 4: два полных ряда и два квадрата сверху
    assert.equal(cutHeight(full(10), 4, 9), 2.5);
  });

  await t.test('narrow last square counts by its width', () => {
    assert.equal(cutHeight([1, 1, 0.5], 2, 2.25), 1.5);
  });

  await t.test('empty pile and zero area stay at the bottom', () => {
    assert.equal(cutHeight([], 1, 0), 0);
    assert.equal(cutHeight(full(4), 2, 0), 0);
  });
});
