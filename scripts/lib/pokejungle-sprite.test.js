const test = require('node:test');
const assert = require('node:assert/strict');
const { derivePokeJungleIds, buildPokeJungleUrl } = require('./pokejungle-sprite');

// Only the four fields the derivation actually reads, in dataset (sortIndex) order.
function entry(slug, dex, extra = {}) {
  return { slug, dex, pokeapiSlug: slug, isGenderVariant: false, ...extra };
}

test('forms are numbered by position: first is bare, the rest get -1, -2, ...', () => {
  const ids = derivePokeJungleIds([
    entry('rattata', '0019'),
    entry('rattata-alola', '0019'),
  ]);
  assert.deepEqual(ids, { rattata: '0019', 'rattata-alola': '0019-1' });
});

test('a female sprite expansion reuses its base form number (Venusaur)', () => {
  const ids = derivePokeJungleIds([
    entry('venusaur', '0003'),
    entry('venusaur-f', '0003', { pokeapiSlug: 'venusaur', isGenderVariant: true }),
  ]);
  assert.deepEqual(ids, { venusaur: '0003', 'venusaur-f': '0003-f' });
});

test('a female alternate form keeps its OWN form number, not the species base (Raichu)', () => {
  // Alolan Raichu is -1, so a female Raichu expanded off the base form must stay -f,
  // not pick up the Alolan number just because it comes later in the list.
  const ids = derivePokeJungleIds([
    entry('raichu', '0026'),
    entry('raichu-f', '0026', { pokeapiSlug: 'raichu', isGenderVariant: true }),
    entry('raichu-alola', '0026'),
  ]);
  assert.equal(ids['raichu-f'], '0026-f');
  assert.equal(ids['raichu-alola'], '0026-1');
});

test('separate -male/-female PokeAPI forms resolve through the male counterpart (Indeedee)', () => {
  // These 7 species aren't sprite expansions: the female is its own PokeAPI form, so
  // its pokeapiSlug is itself and the base has to be found via -female -> -male.
  const ids = derivePokeJungleIds([
    entry('indeedee-male', '0876'),
    entry('indeedee-female', '0876', { isGenderVariant: true }),
  ]);
  assert.deepEqual(ids, { 'indeedee-male': '0876', 'indeedee-female': '0876-f' });
});

test('Pikachu skips -8, which PokeJungle reserves for the Let\'s Go partner form', () => {
  const ids = derivePokeJungleIds([
    entry('pikachu', '0025'),
    entry('pikachu-original-cap', '0025'),
    entry('pikachu-hoenn-cap', '0025'),
    entry('pikachu-sinnoh-cap', '0025'),
    entry('pikachu-unova-cap', '0025'),
    entry('pikachu-kalos-cap', '0025'),
    entry('pikachu-alola-cap', '0025'),
    entry('pikachu-partner-cap', '0025'),
    entry('pikachu-world-cap', '0025'),
  ]);
  assert.equal(ids['pikachu-partner-cap'], '0025-7');
  assert.equal(ids['pikachu-world-cap'], '0025-9');
});

test('Alcremie splits across both suffixes: cream picks the number, sweet the letter', () => {
  const ids = derivePokeJungleIds([
    entry('alcremie-vanilla-cream-strawberry-sweet', '0869'),
    entry('alcremie-ruby-cream-strawberry-sweet', '0869'),
    entry('alcremie-vanilla-cream-berry-sweet', '0869'),
    entry('alcremie-matcha-cream-love-sweet', '0869'),
  ]);
  assert.equal(ids['alcremie-vanilla-cream-strawberry-sweet'], '0869');
  assert.equal(ids['alcremie-ruby-cream-strawberry-sweet'], '0869-1');
  assert.equal(ids['alcremie-vanilla-cream-berry-sweet'], '0869-a');
  assert.equal(ids['alcremie-matcha-cream-love-sweet'], '0869-2-b');
});

test('Alcremie\'s -f means ribbon sweet, NOT female', () => {
  // The one place '-f' isn't a gender suffix. Reading it as one silently mislabels
  // all 8 non-vanilla ribbon combinations.
  const ids = derivePokeJungleIds([
    entry('alcremie-vanilla-cream-ribbon-sweet', '0869'),
    entry('alcremie-ruby-cream-ribbon-sweet', '0869'),
  ]);
  assert.equal(ids['alcremie-vanilla-cream-ribbon-sweet'], '0869-f');
  assert.equal(ids['alcremie-ruby-cream-ribbon-sweet'], '0869-1-f');
});

test('derivePokeJungleIds throws instead of guessing an unknown Alcremie combination', () => {
  assert.throws(() => derivePokeJungleIds([entry('alcremie-fake-cream-strawberry-sweet', '0869')]));
  assert.throws(() => derivePokeJungleIds([entry('alcremie-vanilla-cream-fake-sweet', '0869')]));
});

test('derivePokeJungleIds throws when a female variant has no locatable base form', () => {
  // A wrong id still returns HTTP 200 (just someone else's sprite), so this must fail
  // loudly rather than fall back to the bare dex number.
  assert.throws(() => derivePokeJungleIds([
    entry('ghost-f', '0999', { pokeapiSlug: 'ghost', isGenderVariant: true }),
  ]));
});

test('derivePokeJungleIds returns an empty map for no entries', () => {
  assert.deepEqual(derivePokeJungleIds([]), {});
});

test('buildPokeJungleUrl reconstructs both variants from the derived id', () => {
  assert.equal(buildPokeJungleUrl('0003-f', 'normal'), 'https://pokejungle.net/sprites/normal/0003-f.png');
  assert.equal(buildPokeJungleUrl('0003-f', 'shiny'), 'https://pokejungle.net/sprites/shiny/0003-f.png');
});

test('buildPokeJungleUrl defaults to normal and returns null for a missing id', () => {
  assert.equal(buildPokeJungleUrl('0025-9'), 'https://pokejungle.net/sprites/normal/0025-9.png');
  assert.equal(buildPokeJungleUrl(null), null);
  assert.throws(() => buildPokeJungleUrl('0001', 'sepia'));
});
