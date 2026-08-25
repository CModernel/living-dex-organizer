const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isExcludedForm,
  detectRegion,
  resolveEvolutionStage,
  sameTypesAndStats,
  pairRowsToCandidates,
  parseSheetRows,
} = require('./generate-rules');

test('isExcludedForm excludes battle/cosmetic-only forms', () => {
  assert.equal(isExcludedForm('charizard-mega-x'), true);
  assert.equal(isExcludedForm('venusaur-gmax'), true);
  assert.equal(isExcludedForm('groudon-primal'), true);
  assert.equal(isExcludedForm('zacian-crowned'), true);
  assert.equal(isExcludedForm('arceus-fire'), true);
});

test('isExcludedForm keeps regular species and the one kept Arceus/Silvally form', () => {
  assert.equal(isExcludedForm('bulbasaur'), false);
  assert.equal(isExcludedForm('raichu-alola'), false);
  assert.equal(isExcludedForm('arceus-normal'), false);
  assert.equal(isExcludedForm('silvally-normal'), false);
});

test('detectRegion finds the region in a regional form slug', () => {
  assert.equal(detectRegion('raichu-alola'), 'alola');
  assert.equal(detectRegion('ponyta-galar'), 'galar');
  assert.equal(detectRegion('qwilfish-hisui'), 'hisui');
});

test('detectRegion returns null for Pikachu cosplay caps and plain forms', () => {
  // Named after a region but not a regional form — a cosmetic cap theme.
  assert.equal(detectRegion('pikachu-alola-cap'), null);
  assert.equal(detectRegion('bulbasaur'), null);
});

test('resolveEvolutionStage applies the form-locked override', () => {
  // Only Galarian Farfetch'd evolves; the species-level lookup would otherwise mark
  // every Farfetch'd form as non-final.
  assert.equal(resolveEvolutionStage('farfetchd', 'mid'), 'final');
  assert.equal(resolveEvolutionStage('meltan', 'final'), 'pre');
});

test('resolveEvolutionStage passes through species stage when no override applies', () => {
  assert.equal(resolveEvolutionStage('bulbasaur', 'pre'), 'pre');
  assert.equal(resolveEvolutionStage('venusaur', 'final'), 'final');
});

test('sameTypesAndStats detects equal vs differing candidates', () => {
  const a = { types: ['water'], stats: { hp: 50, atk: 50 } };
  const b = { types: ['water'], stats: { hp: 50, atk: 50 } };
  const c = { types: ['water', 'flying'], stats: { hp: 50, atk: 50 } };
  const d = { types: ['water'], stats: { hp: 60, atk: 50 } };
  assert.equal(sameTypesAndStats(a, b), true);
  assert.equal(sameTypesAndStats(a, c), false);
  assert.equal(sameTypesAndStats(a, d), false);
  assert.equal(sameTypesAndStats(null, b), false);
});

test('pairRowsToCandidates matches by name even when PokeAPI order differs from the sheet', () => {
  // Mimics Vivillon: the sheet lists "Icy Snow" first, but PokeAPI's default form
  // (no discriminating form name) comes first in candidate order.
  const rows = [
    { formName: 'Icy Snow' },
    { formName: 'Meadow' },
  ];
  const candidates = [
    { slug: 'vivillon-meadow' },
    { slug: 'vivillon-icy-snow' },
  ];
  const result = pairRowsToCandidates(rows, candidates);
  assert.equal(result[0].slug, 'vivillon-icy-snow');
  assert.equal(result[1].slug, 'vivillon-meadow');
});

test('pairRowsToCandidates falls back to position for rows with no usable form name', () => {
  const rows = [{ formName: '' }, { formName: '' }];
  const candidates = [{ slug: 'a' }, { slug: 'b' }];
  const result = pairRowsToCandidates(rows, candidates);
  assert.equal(result[0].slug, 'a');
  assert.equal(result[1].slug, 'b');
});

test('parseSheetRows handles quoted commas in form names (Alcremie)', () => {
  const csv = [
    'dex,name,formName,genderSuffix,keyword',
    '0869,Alcremie,,,alcremie',
    '0869,Alcremie,"Vanilla Cream, Berry",-a,alcremie-a',
  ].join('\n');
  const { byDex } = parseSheetRows(csv);
  assert.equal(byDex['0869'].length, 2);
  assert.equal(byDex['0869'][1].formName, 'Vanilla Cream, Berry');
  assert.equal(byDex['0869'][1].keyword, 'alcremie-a');
});

test('parseSheetRows skips generation-separator rows without counting them as Pokémon', () => {
  const csv = [
    'dex,name,formName,genderSuffix,keyword',
    ',Gen 1,,,',
    '0001,Bulbasaur,,,bulbasaur',
  ].join('\n');
  const { byDex, separatorRows } = parseSheetRows(csv);
  assert.equal(separatorRows, 1);
  assert.equal(Object.keys(byDex).length, 1);
  assert.equal(byDex['0001'].length, 1);
});

test('parseSheetRows flags a -f row as a female variant only when it repeats the prior form name', () => {
  const csv = [
    'dex,name,formName,genderSuffix,keyword',
    '0003,Venusaur,,,venusaur',
    '0003,Venusaur,,-f,venusaur-f',
  ].join('\n');
  const { byDex } = parseSheetRows(csv);
  assert.equal(byDex['0003'][1].isFemaleVariant, true);
});
