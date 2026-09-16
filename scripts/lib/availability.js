/**
 * Rules for Bulbapedia's "List of Pokémon by availability" (see
 * `sheets/availability/`). `enrichEntriesWithAvailability` attaches a sparse
 * `{ [gameId]: rawCode }` map to each dataset entry — raw codes rather than the fully
 * decomposed `tokenizeAvailabilityCell` shape, to keep the published dataset small (the
 * decomposed shape made it ~5x heavier); call `tokenizeAvailabilityCell(rawCode)` on
 * demand for the parsed tokens/category (see TODO.md #31). It reuses
 * `generate-rules.js`'s existing CSV/name-matching helpers rather than duplicating them.
 */
const { parseCsvLine, formTokens } = require('./generate-rules');

// ---------------------------------------------------------------------------
// Symbol legend (transcribed from sheets/availability/pokemon-availability-symbols.csv)
// ---------------------------------------------------------------------------

// All codes are 1 or 2 characters. Case-sensitive: 'E', 'Ev' and 'EV' are three
// distinct codes with different meanings, not variants of one another.
const SYMBOL_LEGEND = {
  C: { category: 'obtainable', meaning: 'Caught in-game.' },
  S: { category: 'obtainable', meaning: 'Caught in-game, but only at certain non-fixed times (swarms, Trophy Garden, Island Scan, snagged in Colosseum/XD, etc).' },
  R: { category: 'obtainable', meaning: 'Received from someone (starter, fossil revival, in-game trade, gift Pokémon).' },
  E: { category: 'obtainable', meaning: 'Not catchable, but an earlier evolutionary stage can be caught and evolved into it in this game.' },
  B: { category: 'obtainable', meaning: 'Not catchable, but a later evolutionary stage can be bred to produce it in this game.' },
  CD: { category: 'obtainable', meaning: 'Caught in-game, but only through paid DLC.' },
  D: { category: 'obtainable', meaning: 'Sword/Shield: caught via a Max Raid Battle at a Pokémon Den.' },
  DA: { category: 'obtainable', meaning: "Sword/Shield Crown Tundra DLC: caught via a Dynamax Adventure in the Max Lair." },
  ET: { category: 'conditional', meaning: 'Not catchable, but an earlier evolutionary stage can be obtained and evolved into it by trading.' },
  TE: { category: 'conditional', meaning: 'Not catchable, but an earlier evolutionary stage can be obtained, transferred to another game, and evolved there.' },
  CC: { category: 'conditional', meaning: 'Obtainable in-game but requires communication with another core-series game.' },
  DS: { category: 'conditional', meaning: 'Diamond/Pearl/Platinum: caught via dual-slot mode.' },
  FS: { category: 'conditional', meaning: 'X/Y: caught only through the Friend Safari.' },
  EV: { category: 'conditional', meaning: 'Caught in-game, but only via event distribution (or an item obtained via one).' },
  PW: { category: 'unobtainable', meaning: 'Available via the Pokéwalker, transferable to HeartGold/SoulSilver.' },
  DR: { category: 'unobtainable', meaning: 'Available via Pokémon Dream Radar, transferable to Black 2/White 2.' },
  DW: { category: 'unobtainable', meaning: 'Was available via the (now shut down) Pokémon Dream World, transferable to Black/White/Black 2/White 2.' },
  Ev: { category: 'unobtainable', meaning: 'Was available via a real-life event distribution.' },
  T: { category: 'unobtainable', meaning: 'Obtainable only by trading/transferring from another game.' },
  '—': { category: 'unobtainable', meaning: 'Unobtainable in this game.' },
};

const CATEGORY_RANK = { obtainable: 0, conditional: 1, unobtainable: 2 };

function worstCategory(categories) {
  return categories.reduce((worst, c) => (CATEGORY_RANK[c] > CATEGORY_RANK[worst] ? c : worst), 'obtainable');
}

/**
 * Tokenize one cell's raw code into its constituent legend symbols. All legend
 * keys are at most 2 characters, so trying the 2-char slice before the 1-char
 * slice at each position is sufficient to prefer known compound codes (e.g. 'ET',
 * 'TE', 'CC', 'DW', 'Ev', 'EV') over misreading them as two unrelated 1-char
 * codes. Throws on any leftover character that matches no legend key, rather than
 * silently misparsing an unrecognized code.
 */
function tokenizeAvailabilityCell(cell) {
  let raw = (cell ?? '').trim();
  if (raw === '' || raw === '—') return { tokens: [], category: 'unobtainable', footnote: false };

  // Bulbapedia marks a handful of cells (mythicals/event legendaries: Togepi, Mareep,
  // Scizor, Lugia, Ho-Oh, Celebi, Deoxys in this dataset) with a trailing " *" —
  // a footnote pointing at extra caveats on the source page. It isn't one of the 21
  // legend codes, so strip it and surface it as its own flag rather than choking on it.
  const footnote = / \*$/.test(raw);
  if (footnote) raw = raw.slice(0, -2);

  const tokens = [];
  let i = 0;
  while (i < raw.length) {
    const two = raw.slice(i, i + 2);
    if (SYMBOL_LEGEND[two]) {
      tokens.push(two);
      i += 2;
      continue;
    }
    const one = raw[i];
    if (SYMBOL_LEGEND[one]) {
      tokens.push(one);
      i += 1;
      continue;
    }
    throw new Error(`Unrecognized availability code "${raw}" (stuck at "${raw.slice(i)}")`);
  }

  return { tokens, category: worstCategory(tokens.map((t) => SYMBOL_LEGEND[t].category)), footnote };
}

// ---------------------------------------------------------------------------
// Game columns
// ---------------------------------------------------------------------------

// Header order in sheets/availability/pokemon-availability.csv, columns
// 3..43 (after dex_number, pokemon). gameId is kebab-case, aligned to PokeAPI's own
// version slugs where one exists — same spirit as generate-rules.js's
// REGIONAL_POKEDEXES using PokeAPI's own names instead of the vendor's grouping.
const GAME_COLUMNS = [
  { header: 'Red', gameId: 'red' },
  { header: 'Green', gameId: 'green' },
  { header: 'Blue (Japanese)', gameId: 'blue' },
  { header: 'Yellow', gameId: 'yellow' },
  { header: 'Gold', gameId: 'gold' },
  { header: 'Silver', gameId: 'silver' },
  { header: 'Crystal', gameId: 'crystal' },
  { header: 'Ruby', gameId: 'ruby' },
  { header: 'Sapphire', gameId: 'sapphire' },
  { header: 'FireRed', gameId: 'firered' },
  { header: 'LeafGreen', gameId: 'leafgreen' },
  { header: 'Emerald', gameId: 'emerald' },
  { header: 'Colosseum', gameId: 'colosseum' },
  { header: 'XD', gameId: 'xd' },
  { header: 'Diamond', gameId: 'diamond' },
  { header: 'Pearl', gameId: 'pearl' },
  { header: 'Platinum', gameId: 'platinum' },
  { header: 'HeartGold', gameId: 'heartgold' },
  { header: 'SoulSilver', gameId: 'soulsilver' },
  { header: 'Black', gameId: 'black' },
  { header: 'White', gameId: 'white' },
  { header: 'Black 2', gameId: 'black-2' },
  { header: 'White 2', gameId: 'white-2' },
  { header: 'X', gameId: 'x' },
  { header: 'Y', gameId: 'y' },
  { header: 'Omega Ruby', gameId: 'omega-ruby' },
  { header: 'Alpha Sapphire', gameId: 'alpha-sapphire' },
  { header: 'Sun', gameId: 'sun' },
  { header: 'Moon', gameId: 'moon' },
  { header: 'Ultra Sun', gameId: 'ultra-sun' },
  { header: 'Ultra Moon', gameId: 'ultra-moon' },
  { header: "Let's Go, Pikachu!", gameId: 'lets-go-pikachu' },
  { header: "Let's Go, Eevee!", gameId: 'lets-go-eevee' },
  { header: 'Sword', gameId: 'sword' },
  { header: 'Shield', gameId: 'shield' },
  { header: 'Brilliant Diamond', gameId: 'brilliant-diamond' },
  { header: 'Shining Pearl', gameId: 'shining-pearl' },
  { header: 'Legends: Arceus', gameId: 'legends-arceus' },
  { header: 'Scarlet', gameId: 'scarlet' },
  { header: 'Violet', gameId: 'violet' },
  { header: 'Legends: Z-A', gameId: 'legends-za' },
];

/**
 * Parse one CSV data row (already split into fields, `[dex, pokemon, ...41 game cells]`)
 * into a sparse `{ [gameId]: rawCode }` map — games where the Pokémon is unobtainable
 * are simply absent, matching `extractRegionalDex`'s sparse-map convention. Stores the
 * raw Bulbapedia code as-is (e.g. `"RD"`, `"EvE"`, `"C *"`) rather than the fully
 * decomposed `tokenizeAvailabilityCell` result — the decomposed shape is ~5x heavier
 * per entry once attached to every dataset entry for 41 games, and a consumer can
 * always call `tokenizeAvailabilityCell(rawCode)` on demand for the parsed
 * tokens/category. Still runs every cell through the tokenizer here so a typo/unknown
 * code in the source CSV fails loudly at parse time instead of being stored silently.
 */
function parseAvailabilityRow(fields) {
  const cells = fields.slice(2);
  const result = {};
  GAME_COLUMNS.forEach(({ gameId }, i) => {
    const raw = (cells[i] ?? '').trim();
    tokenizeAvailabilityCell(raw); // validates; throws on an unrecognized code
    if (raw && raw !== '—') result[gameId] = raw;
  });
  return result;
}

/** Parse one raw CSV line into `{ dex, pokemon, availability }`. */
function parseAvailabilityLine(line) {
  const fields = parseCsvLine(line);
  return { dex: fields[0]?.trim(), pokemon: fields[1]?.trim(), availability: parseAvailabilityRow(fields) };
}

// ---------------------------------------------------------------------------
// Label -> species/region matching
// ---------------------------------------------------------------------------

// Bulbapedia's regional-form word -> our region key. Reuses generate-rules.js's own
// vocabulary (`alolan -> alola`, etc. via formTokens/FORM_WORD_SYNONYMS) for the
// single-word regions; the three Paldean Tauros forms aren't disambiguated by region
// alone, so they get their own compound keys here.
const LABEL_PATTERN = /^(.+?)(?:\s*\(\s*(.+?)\s*\)\s*)?$/;

function matchAvailabilityLabel(label) {
  const [, namePart, formPart] = LABEL_PATTERN.exec((label || '').trim()) || [];
  const species = (namePart || '').trim().toLowerCase();
  if (!formPart) return { species, region: null };

  const words = formPart.replace(/\bForm\b/i, '').trim();
  const toks = formTokens(words);
  if (species === 'tauros' && toks.includes('paldea')) {
    const variant = toks.find((t) => t !== 'paldea');
    return { species, region: `paldea-${variant}` };
  }
  return { species, region: toks.join('-') || null };
}

// ---------------------------------------------------------------------------
// CSV -> index -> dataset-entry enrichment
// ---------------------------------------------------------------------------

function indexKey(species, region) {
  return `${species.toLowerCase()}|${region || ''}`;
}

/** Parse the whole vendored CSV (header + 1101 data rows) into a species/region index. */
function buildAvailabilityIndex(csvText) {
  const index = new Map();
  csvText.split('\n').forEach((line, i) => {
    if (i === 0 || !line.trim()) return;
    const { pokemon, availability } = parseAvailabilityLine(line);
    const { species, region } = matchAvailabilityLabel(pokemon);
    index.set(indexKey(species, region), availability);
  });
  return index;
}

/**
 * Look up a dataset entry's availability. `region` is the single-word region already
 * on every entry (`detectRegion`'s output, e.g. 'paldea') — that alone doesn't
 * disambiguate the three Paldean Tauros forms, which share the same region and only
 * differ by slug suffix, so that one species gets special-cased here.
 */
function lookupAvailability(index, { species, region, slug }) {
  if (species?.toLowerCase() === 'tauros' && region === 'paldea') {
    const variant = ['combat', 'blaze', 'aqua'].find((v) => slug?.includes(`-${v}`));
    if (variant) return index.get(indexKey(species, `paldea-${variant}`)) ?? null;
  }
  return index.get(indexKey(species, region)) ?? null;
}

/**
 * Attach `.availability` to every entry in `entries` (a `{ [slug]: PokemonEntry }` map,
 * mutated in place) that has a matching Bulbapedia row, keyed by the entry's existing
 * `species`/`region`/`pokeapiSlug` fields — no extra PokeAPI data needed. Returns match
 * stats so a caller can log/inspect anything left unmatched.
 */
function enrichEntriesWithAvailability(entries, csvText) {
  const index = buildAvailabilityIndex(csvText);
  const unmatched = [];
  let matched = 0;
  for (const entry of Object.values(entries)) {
    const availability = lookupAvailability(index, { species: entry.species, region: entry.region, slug: entry.pokeapiSlug });
    if (availability) {
      entry.availability = availability;
      matched++;
    } else {
      unmatched.push(entry.slug);
    }
  }
  return { matched, unmatched };
}

module.exports = {
  SYMBOL_LEGEND,
  tokenizeAvailabilityCell,
  GAME_COLUMNS,
  parseAvailabilityRow,
  parseAvailabilityLine,
  matchAvailabilityLabel,
  buildAvailabilityIndex,
  lookupAvailability,
  enrichEntriesWithAvailability,
};
