const test = require('node:test');
const assert = require('node:assert/strict');
const { TIERS } = require('.');

test('living-form: excludes only gender variants', () => {
  const { predicate } = TIERS['living-form'];
  assert.equal(predicate({ isGenderVariant: false }), true);
  assert.equal(predicate({ isGenderVariant: true }), false);
});

test('living-lite: basculin-2 is kept even though it is a non-regional alternate form', () => {
  const { predicate } = TIERS['living-lite'];
  assert.equal(predicate({
    csvKeyword: 'basculin-2', isGenderVariant: false, isAlternateForm: true, isRegionalForm: false,
  }), true);
});

test('living-lite: tauros-2/-3 are dropped as redundant cosmetic breeds', () => {
  const { predicate } = TIERS['living-lite'];
  assert.equal(predicate({ csvKeyword: 'tauros-2', isGenderVariant: false, isAlternateForm: true, isRegionalForm: false }), false);
  assert.equal(predicate({ csvKeyword: 'tauros-3', isGenderVariant: false, isAlternateForm: true, isRegionalForm: false }), false);
});

test('living-lite: keeps regional alternates, drops plain cosmetic alternates', () => {
  const { predicate } = TIERS['living-lite'];
  assert.equal(predicate({ csvKeyword: 'raichu-alola', isGenderVariant: false, isAlternateForm: true, isRegionalForm: true }), true);
  assert.equal(predicate({ csvKeyword: 'vivillon-2', isGenderVariant: false, isAlternateForm: true, isRegionalForm: false }), false);
});

test('final-form-full: collapses Minior colors to the base form', () => {
  const { predicate } = TIERS['final-form-full'];
  assert.equal(predicate({ dex: '0774', isAlternateForm: true, isGenderVariant: false, evolutionStage: 'final' }), false);
  assert.equal(predicate({ dex: '0774', isAlternateForm: false, isGenderVariant: false, evolutionStage: 'final' }), true);
});

test('final-form-full: drops Magearna Original Pokéball and non-Vanilla Alcremie flavors', () => {
  const { predicate } = TIERS['final-form-full'];
  assert.equal(predicate({ dex: '0801', csvKeyword: 'magearna-1', isGenderVariant: false, evolutionStage: 'final' }), false);
  assert.equal(predicate({ dex: '0869', csvKeyword: 'alcremie-g', isGenderVariant: false, evolutionStage: 'final' }), false);
  assert.equal(predicate({ dex: '0869', csvKeyword: 'alcremie-a', isGenderVariant: false, evolutionStage: 'final' }), true);
});

test('final-form-full: falls back to evolutionStage/isGenderVariant outside the curated exceptions', () => {
  const { predicate } = TIERS['final-form-full'];
  assert.equal(predicate({ dex: '0001', isGenderVariant: false, evolutionStage: 'final' }), true);
  assert.equal(predicate({ dex: '0001', isGenderVariant: false, evolutionStage: 'mid' }), false);
  assert.equal(predicate({ dex: '0001', isGenderVariant: true, evolutionStage: 'final' }), false);
});

test('final-form: Floette Eternal Flower is kept regardless of its computed evolution stage', () => {
  const { predicate } = TIERS['final-form'];
  assert.equal(predicate({ csvKeyword: 'floette-5', evolutionStage: 'mid', isGenderVariant: false, isAlternateForm: true, isRegionalForm: false }), true);
});

test('final-form: drops Tauros extra breeds and all Basculin stripes', () => {
  const { predicate } = TIERS['final-form'];
  assert.equal(predicate({ csvKeyword: 'tauros-2', evolutionStage: 'final', isGenderVariant: false, isAlternateForm: true, isRegionalForm: false }), false);
  assert.equal(predicate({ csvKeyword: 'basculin', evolutionStage: 'final', isGenderVariant: false, isAlternateForm: false, isRegionalForm: false }), false);
});

test('final-form: keeps regional final-stage alternates, drops non-regional ones', () => {
  const { predicate } = TIERS['final-form'];
  assert.equal(predicate({ csvKeyword: 'raichu-alola', evolutionStage: 'final', isGenderVariant: false, isAlternateForm: true, isRegionalForm: true }), true);
  assert.equal(predicate({ csvKeyword: 'vivillon-2', evolutionStage: 'final', isGenderVariant: false, isAlternateForm: true, isRegionalForm: false }), false);
});

test('living-form-full: includes everything, including gender variants', () => {
  const { predicate } = TIERS['living-form-full'];
  assert.equal(predicate({ isGenderVariant: true }), true);
  assert.equal(predicate({ isGenderVariant: false }), true);
});
