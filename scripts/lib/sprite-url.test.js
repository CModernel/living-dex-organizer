const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isDuplicateFemaleVariant,
  deriveSpriteId,
  hasFemaleSprite,
  hasShinyFemaleSprite,
  buildSpriteUrl,
} = require('./sprite-url');

const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

test('deriveSpriteId extracts the shared id for a plain species', () => {
  const sprites = {
    front_default: `${BASE}1.png`,
    front_shiny: `${BASE}shiny/1.png`,
    front_female: null,
    front_shiny_female: null,
  };
  assert.equal(deriveSpriteId(sprites), '1');
});

test('deriveSpriteId extracts a hyphenated id for a cosmetic form', () => {
  const sprites = {
    front_default: `${BASE}201-b.png`,
    front_shiny: `${BASE}shiny/201-b.png`,
    front_female: null,
    front_shiny_female: null,
  };
  assert.equal(deriveSpriteId(sprites), '201-b');
});

test('deriveSpriteId agrees across all four variants when present', () => {
  const sprites = {
    front_default: `${BASE}25.png`,
    front_shiny: `${BASE}shiny/25.png`,
    front_female: `${BASE}female/25.png`,
    front_shiny_female: `${BASE}shiny/female/25.png`,
  };
  assert.equal(deriveSpriteId(sprites), '25');
});

test('deriveSpriteId throws on a mismatched id between variants', () => {
  const sprites = {
    front_default: `${BASE}25.png`,
    front_female: `${BASE}female/26.png`,
  };
  assert.throws(() => deriveSpriteId(sprites));
});

test('deriveSpriteId throws on an unexpected URL shape instead of guessing', () => {
  assert.throws(() => deriveSpriteId({ front_default: 'https://example.com/25.png' }));
});

test('hasFemaleSprite is true only when a real female variant exists', () => {
  assert.equal(hasFemaleSprite({ front_default: `${BASE}25.png`, front_female: `${BASE}female/25.png` }), true);
  assert.equal(hasFemaleSprite({ front_default: `${BASE}1.png`, front_female: null }), false);
});

test('hasFemaleSprite and hasShinyFemaleSprite are tracked independently (Oinkologne case)', () => {
  // Real PokeAPI data: Oinkologne has a regular female sprite but no shiny-female one.
  const sprites = {
    front_default: `${BASE}916.png`,
    front_female: `${BASE}female/916.png`,
    front_shiny: `${BASE}shiny/916.png`,
    front_shiny_female: null,
  };
  assert.equal(hasFemaleSprite(sprites), true);
  assert.equal(hasShinyFemaleSprite(sprites), false);
});

test('deriveSpriteId treats a female field duplicating its base variant as absent (Nidoran-F, dex 29)', () => {
  // Real PokeAPI data (2026-09-10): Nidoran-F is always female (the male counterpart is a
  // wholly separate species, dex 32), so there's no distinct female art — PokeAPI points
  // front_female/front_shiny_female at the exact same URLs as front_default/front_shiny
  // instead of leaving them null.
  const sprites = {
    front_default: `${BASE}29.png`,
    front_shiny: `${BASE}shiny/29.png`,
    front_female: `${BASE}29.png`,
    front_shiny_female: `${BASE}shiny/29.png`,
  };
  assert.equal(deriveSpriteId(sprites), '29');
});

test('isDuplicateFemaleVariant is true only when the field exactly matches its base variant', () => {
  const dupe = {
    front_default: `${BASE}29.png`,
    front_female: `${BASE}29.png`,
    front_shiny: `${BASE}shiny/29.png`,
    front_shiny_female: `${BASE}shiny/29.png`,
  };
  assert.equal(isDuplicateFemaleVariant(dupe, 'front_female'), true);
  assert.equal(isDuplicateFemaleVariant(dupe, 'front_shiny_female'), true);

  const distinct = {
    front_default: `${BASE}25.png`,
    front_female: `${BASE}female/25.png`,
  };
  assert.equal(isDuplicateFemaleVariant(distinct, 'front_female'), false);

  // Not a gendered field at all — never treated as a duplicate.
  assert.equal(isDuplicateFemaleVariant(dupe, 'front_default'), false);
});

test('hasFemaleSprite and hasShinyFemaleSprite are false for a duplicated (non-distinct) female field', () => {
  const sprites = {
    front_default: `${BASE}29.png`,
    front_shiny: `${BASE}shiny/29.png`,
    front_female: `${BASE}29.png`,
    front_shiny_female: `${BASE}shiny/29.png`,
  };
  assert.equal(hasFemaleSprite(sprites), false);
  assert.equal(hasShinyFemaleSprite(sprites), false);
});

test('buildSpriteUrl reconstructs every variant from the derived id', () => {
  assert.equal(buildSpriteUrl('3', 'front_default'), `${BASE}3.png`);
  assert.equal(buildSpriteUrl('3', 'front_shiny'), `${BASE}shiny/3.png`);
  assert.equal(buildSpriteUrl('3', 'front_female'), `${BASE}female/3.png`);
  assert.equal(buildSpriteUrl('3', 'front_shiny_female'), `${BASE}shiny/female/3.png`);
});

test('buildSpriteUrl returns null for a missing id', () => {
  assert.equal(buildSpriteUrl(null), null);
});
