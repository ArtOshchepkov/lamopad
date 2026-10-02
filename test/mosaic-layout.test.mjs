import test from 'node:test';
import assert from 'node:assert/strict';
import { mosaicParts, placeLabel } from '../strategy/bayes-rule-basic/js/mosaic-layout.js';

test('mosaicParts: four parts tile the unit square', () => {
  const parts = mosaicParts({ hit: 0.8, falseAlarm: 0.5, prior: 0.01 });
  assert.deepEqual(parts.map((p) => p.key), ['firedCalled', 'firedQuiet', 'calmCalled', 'calmQuiet']);
  const area = parts.reduce((sum, p) => sum + p.w * p.h, 0);
  assert.ok(Math.abs(area - 1) < 1e-12);
  const fc = parts[0];
  assert.deepEqual([fc.x, fc.y, fc.solid, fc.left], [0, 0, true, true]);
  assert.ok(Math.abs(fc.w * fc.h - 0.008) < 1e-12);
  assert.equal(parts[3].y, 0.5);
});

test('placeLabel', async (t) => {
  const label = { w: 100, h: 30 };
  await t.test('fits inside', () => assert.equal(placeLabel({ w: 200, h: 100 }, label, { left: true, solid: true }), 'in'));
  await t.test('empty part has no label', () => assert.equal(placeLabel({ w: 0, h: 100 }, label, { left: true, solid: true }), 'none'));
  await t.test('narrow left column points to the right', () => assert.equal(placeLabel({ w: 3, h: 100 }, label, { left: true, solid: true }), 'right'));
  await t.test('narrow right column points to the left', () => assert.equal(placeLabel({ w: 3, h: 100 }, label, { left: false, solid: false }), 'left'));
  await t.test('short solid part labels just above itself', () => assert.equal(placeLabel({ w: 300, h: 10 }, label, { left: false, solid: true }), 'up'));
  await t.test('short pale part labels just below itself', () => assert.equal(placeLabel({ w: 300, h: 10 }, label, { left: false, solid: false }), 'down'));
});
