import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, matchScore, norm, rankByName } from '../../src/logic/text.ts';
import { canMoveUnder, childrenOf, descendantIds, inheritedRestockMode, pathTo, planPath, rootOf } from '../../src/logic/tree.ts';

const cats = [
  { id: 'home', parent_id: null, name: 'My Home', sort: 0 },
  { id: 'kit', parent_id: 'home', name: 'Kitchen', sort: 0 },
  { id: 'veg', parent_id: 'kit', name: 'Vegetables', sort: 1, default_restock_mode: 'as_needed' },
  { id: 'spi', parent_id: 'kit', name: 'Spices', sort: 0, default_restock_mode: 'staple' },
  { id: 'whole', parent_id: 'spi', name: 'Whole spices', sort: 0 },
  { id: 'bath', parent_id: 'home', name: 'Bathroom', sort: 1 },
];

test('norm and cleanName tidy text', () => {
  assert.equal(norm('  Jalapeño   Peppers '), 'jalapeno peppers');
  assert.equal(cleanName('  toor   dal '), 'Toor dal');
});

test('matchScore prefers exact, then prefix, then word start, then anywhere', () => {
  assert.equal(matchScore('Onions', 'onions'), 100);
  assert.equal(matchScore('Onions', 'on'), 80);
  assert.equal(matchScore('Spring onions', 'on'), 60);
  assert.equal(matchScore('Lemons', 'mon'), 40);
  assert.equal(matchScore('Garlic', 'xyz'), 0);
  assert.equal(matchScore('Toor dal', 'arhar', ['arhar dal']), 75);
});

test('rankByName orders results and drops non-matches', () => {
  const rows = ['Lemons', 'Onions', 'Spring onions', 'Garlic'];
  assert.deepEqual(rankByName(rows, 'on', (r) => r), ['Onions', 'Spring onions', 'Lemons']);
});

test('tree: root, children sorted, path, descendants', () => {
  assert.equal(rootOf(cats)?.id, 'home');
  assert.deepEqual(childrenOf(cats, 'kit').map((c) => c.id), ['spi', 'veg']);
  assert.deepEqual(pathTo(cats, 'whole').map((c) => c.name), ['My Home', 'Kitchen', 'Spices', 'Whole spices']);
  assert.deepEqual([...descendantIds(cats, 'kit')].sort(), ['kit', 'spi', 'veg', 'whole']);
});

test('pathTo survives a loop in bad data', () => {
  const loop = [{ id: 'a', parent_id: 'b', name: 'A', sort: 0 }, { id: 'b', parent_id: 'a', name: 'B', sort: 0 }];
  assert.equal(pathTo(loop, 'a').length, 2);
});

test('restock mode is inherited from the nearest category that sets it', () => {
  assert.equal(inheritedRestockMode(cats, 'whole'), 'staple');
  assert.equal(inheritedRestockMode(cats, 'veg'), 'as_needed');
  assert.equal(inheritedRestockMode(cats, 'bath'), null);
});

test('planPath matches existing categories ignoring case and lists what is missing', () => {
  assert.deepEqual(planPath(cats, 'home', ['kitchen', 'SPICES']), { atId: 'spi', missing: [] });
  assert.deepEqual(planPath(cats, 'home', ['Kitchen', 'Dals & pulses']), { atId: 'kit', missing: ['Dals & pulses'] });
  assert.deepEqual(planPath(cats, 'home', ['Laundry', 'Detergent']), { atId: 'home', missing: ['Laundry', 'Detergent'] });
});

test('a category cannot move under itself or its own children', () => {
  assert.equal(canMoveUnder(cats, 'kit', 'whole'), false);
  assert.equal(canMoveUnder(cats, 'kit', 'kit'), false);
  assert.equal(canMoveUnder(cats, 'whole', 'bath'), true);
});
