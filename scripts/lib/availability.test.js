const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SYMBOL_LEGEND,
  tokenizeAvailabilityCell,
  GAME_COLUMNS,
  parseAvailabilityLine,
  matchAvailabilityLabel,
} = require('./availability');

test('every legend symbol tokenizes to itself and its documented category', () => {
  for (const [symbol, { category }] of Object.entries(SYMBOL_LEGEND)) {
    if (symbol === '—') continue; // covered separately below (maps to no tokens)
    assert.deepEqual(tokenizeAvailabilityCell(symbol), { tokens: [symbol], category, footnote: false });
  }
});

test('em dash and empty cell both mean unobtainable with no tokens', () => {
  assert.deepEqual(tokenizeAvailabilityCell('—'), { tokens: [], category: 'unobtainable', footnote: false });
  assert.deepEqual(tokenizeAvailabilityCell(''), { tokens: [], category: 'unobtainable', footnote: false });
  assert.deepEqual(tokenizeAvailabilityCell('   '), { tokens: [], category: 'unobtainable', footnote: false });
});

test('a trailing " *" footnote marker is stripped and surfaced as its own flag', () => {
  // Bulbapedia marks a few mythicals/event legendaries (Togepi, Lugia, Celebi, Deoxys,
  // ...) with a footnote on top of an otherwise-ordinary code.
  assert.deepEqual(tokenizeAvailabilityCell('EV *'), { tokens: ['EV'], category: 'conditional', footnote: true });
  assert.deepEqual(tokenizeAvailabilityCell('C *'), { tokens: ['C'], category: 'obtainable', footnote: true });
});

test('compound codes prefer the known 2-char code over two 1-char codes', () => {
  // 'Ev' and 'E' are both real, distinct codes — 'EvE' must split as [Ev, E], not
  // [E, "v"(invalid), E].
  assert.deepEqual(tokenizeAvailabilityCell('EvE').tokens, ['Ev', 'E']);
  assert.deepEqual(tokenizeAvailabilityCell('EvB').tokens, ['Ev', 'B']);
  // 'ET' and 'TE' are each their own atomic code with a distinct meaning.
  assert.deepEqual(tokenizeAvailabilityCell('DWET').tokens, ['DW', 'ET']);
  assert.deepEqual(tokenizeAvailabilityCell('TED').tokens, ['TE', 'D']);
  // 'CC' (communication-required prefix) + a trailing 1-char code.
  assert.deepEqual(tokenizeAvailabilityCell('CCR').tokens, ['CC', 'R']);
  assert.deepEqual(tokenizeAvailabilityCell('CCD').tokens, ['CC', 'D']);
  assert.deepEqual(tokenizeAvailabilityCell('CCE').tokens, ['CC', 'E']);
  assert.deepEqual(tokenizeAvailabilityCell('CCB').tokens, ['CC', 'B']);
  // 'D' as a DLC/suffix marker after other 2-char and 1-char codes.
  assert.deepEqual(tokenizeAvailabilityCell('RD').tokens, ['R', 'D']);
  assert.deepEqual(tokenizeAvailabilityCell('ED').tokens, ['E', 'D']);
  assert.deepEqual(tokenizeAvailabilityCell('EVD').tokens, ['EV', 'D']);
  // 'DW' (Dream World) as a prefix.
  assert.deepEqual(tokenizeAvailabilityCell('DWE').tokens, ['DW', 'E']);
  assert.deepEqual(tokenizeAvailabilityCell('DWB').tokens, ['DW', 'B']);
  // 'FS'/'DS' (Friend Safari / dual-slot) as a prefix.
  assert.deepEqual(tokenizeAvailabilityCell('FSE').tokens, ['FS', 'E']);
  assert.deepEqual(tokenizeAvailabilityCell('FSB').tokens, ['FS', 'B']);
  assert.deepEqual(tokenizeAvailabilityCell('DSE').tokens, ['DS', 'E']);
  // 'EV' (event) as a prefix, distinct from 'Ev'.
  assert.deepEqual(tokenizeAvailabilityCell('EVE').tokens, ['EV', 'E']);
});

test('compound codes resolve to the worst (most restrictive) category among their parts', () => {
  // Ev = unobtainable, E = obtainable -> unobtainable wins.
  assert.equal(tokenizeAvailabilityCell('EvE').category, 'unobtainable');
  // CC = conditional, R = obtainable -> conditional wins.
  assert.equal(tokenizeAvailabilityCell('CCR').category, 'conditional');
  // R = obtainable, D = obtainable -> stays obtainable.
  assert.equal(tokenizeAvailabilityCell('RD').category, 'obtainable');
  // TE = conditional, D = obtainable -> conditional wins.
  assert.equal(tokenizeAvailabilityCell('TED').category, 'conditional');
});

test('an unrecognized code throws instead of silently misparsing', () => {
  assert.throws(() => tokenizeAvailabilityCell('Q'));
  assert.throws(() => tokenizeAvailabilityCell('C1'));
  assert.throws(() => tokenizeAvailabilityCell('Zz'));
});

test('GAME_COLUMNS has exactly 41 entries with unique gameIds', () => {
  assert.equal(GAME_COLUMNS.length, 41);
  assert.equal(new Set(GAME_COLUMNS.map((g) => g.gameId)).size, 41);
});

test('matchAvailabilityLabel splits a plain species label', () => {
  assert.deepEqual(matchAvailabilityLabel('Rattata'), { species: 'rattata', region: null });
});

test('matchAvailabilityLabel extracts a single-word regional form', () => {
  assert.deepEqual(matchAvailabilityLabel('Rattata ( Alolan Form )'), { species: 'rattata', region: 'alola' });
  assert.deepEqual(matchAvailabilityLabel('Meowth ( Galarian Form )'), { species: 'meowth', region: 'galar' });
  assert.deepEqual(matchAvailabilityLabel('Growlithe ( Hisuian Form )'), { species: 'growlithe', region: 'hisui' });
});

test('matchAvailabilityLabel disambiguates the three Paldean Tauros forms', () => {
  assert.deepEqual(matchAvailabilityLabel('Tauros ( Paldean Combat Form )'), { species: 'tauros', region: 'paldea-combat' });
  assert.deepEqual(matchAvailabilityLabel('Tauros ( Paldean Blaze Form )'), { species: 'tauros', region: 'paldea-blaze' });
  assert.deepEqual(matchAvailabilityLabel('Tauros ( Paldean Aqua Form )'), { species: 'tauros', region: 'paldea-aqua' });
});

// ---------------------------------------------------------------------------
// Fixture rows copied verbatim from sheets/availability/pokemon-availability.csv
// (see grep -n output on that file for line numbers) — the actual guardrail against
// a silent regression in the tokenizer or the game-column mapping.
// ---------------------------------------------------------------------------

test('fixture: Alolan Rattata is native from Sun/Moon onward, but absent from Sword/Shield', () => {
  const line = '0019,Rattata ( Alolan Form ),—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,C,C,C,C,R,R,—,—,—,—,—,—,—,—';
  const { availability } = parseAvailabilityLine(line);
  assert.equal(availability.red, undefined);
  assert.equal(availability.sun, 'C');
  assert.equal(availability.moon, 'C');
  assert.equal(availability['lets-go-pikachu'], 'R');
  assert.equal(availability.sword, undefined);
  assert.equal(availability['brilliant-diamond'], undefined);
});

test('fixture: Hisuian Growlithe is only obtainable starting with Legends: Arceus', () => {
  const line = '0058,Growlithe ( Hisuian Form ),—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,C,RD,RD,—';
  const { availability } = parseAvailabilityLine(line);
  assert.equal(availability['legends-arceus'], 'C');
  assert.equal(availability.scarlet, 'RD');
  assert.equal(availability['legends-za'], undefined);
  assert.equal(availability.sun, undefined);
});

test('fixture: the three Paldean Tauros forms are each exclusive to one of Scarlet/Violet, conditionally obtainable in the other', () => {
  const combat = parseAvailabilityLine(
    '0128,Tauros ( Paldean Combat Form ),—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,C,C,—',
  ).availability;
  const blaze = parseAvailabilityLine(
    '0128,Tauros ( Paldean Blaze Form ),—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,C,CC,—',
  ).availability;
  const aqua = parseAvailabilityLine(
    '0128,Tauros ( Paldean Aqua Form ),—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,CC,C,—',
  ).availability;

  assert.equal(combat.scarlet, 'C');
  assert.equal(combat.violet, 'C');

  assert.equal(blaze.scarlet, 'C'); // exclusive to Scarlet
  assert.equal(tokenizeAvailabilityCell(blaze.violet).category, 'conditional'); // requires trading from Scarlet

  assert.equal(aqua.violet, 'C'); // exclusive to Violet
  assert.equal(tokenizeAvailabilityCell(aqua.scarlet).category, 'conditional'); // requires trading from Violet
});

test('fixture: Alolan Raichu on Scarlet/Violet is only obtainable via event distribution + paid DLC', () => {
  const line = '0026,Raichu ( Alolan Form ),—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,—,E,E,E,E,R,R,RD,RD,—,—,—,EVD,EVD,R';
  const { availability } = parseAvailabilityLine(line);
  assert.equal(availability.scarlet, 'EVD');
  assert.equal(tokenizeAvailabilityCell(availability.scarlet).category, 'conditional');
  assert.equal(availability.violet, 'EVD');
});

test('parseAvailabilityRow stores raw codes, not the fully decomposed tokenizer shape', () => {
  const line = '0019,Rattata,C,C,C,C,C,C,C,T,T,C,C,T,T,T,C,C,C,C,C,B,B,C,C,T,T,C,C,T,T,T,T,C,C,—,—,C,C,—,—,—,—';
  const { availability } = parseAvailabilityLine(line);
  assert.equal(typeof availability.red, 'string');
  assert.equal(availability.red, 'C');
});
