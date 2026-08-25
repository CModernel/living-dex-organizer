/**
 * Pure, no-I/O rules used by generate-living-form-full.js: CSV row parsing, the
 * PokeAPI form exclusion list, evolution-stage/region/gender classification, and the
 * name-based CSV-row-to-PokeAPI-candidate pairing. Kept separate from the network/IO
 * orchestration in generate-living-form-full.js so this logic is unit-testable
 * (see generate-rules.test.js) without hitting disk or PokeAPI.
 */

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else current += char;
  }
  fields.push(current.trim());
  return fields;
}

// The sheet files Passimian under Oranguru's dex number; PokeAPI has it at 0766.
const CSV_DEX_CORRECTIONS = { passimian: '0766' };

// Species where PokeAPI models the two sexes as separate forms (-male / -female)
// rather than as female sprites on one form. Their sheet "-f" row is a real form row
// that consumes the -female candidate, not a sprite expansion.
const SEPARATE_SEX_FORM_DEX = new Set(['0592', '0593', '0668', '0678', '0876', '0902', '0916']);

/**
 * Parse the normalized 5-column sheet format produced by normalize-sheet.js
 * (dex,name,formName,genderSuffix,keyword — not the original vendor spreadsheet
 * layout) into CSV rows grouped by dex ID, preserving row order.
 *
 * Structural facts about this sheet:
 *  - 8 rows are generation separators (Name="Gen", no Dex) — not Pokémon. Skipped.
 *  - The "-Gender" column is overloaded: it marks true female variants (-f) but is
 *    also reused as a second form axis (Alcremie decorations, Shellos/Gastrodon East
 *    Sea). A row is only a female variant when it carries -f AND repeats the
 *    previous row's Form name — except for SEPARATE_SEX_FORM_DEX, where even that
 *    row is a distinct form.
 */
function parseSheetRows(csvText) {
  const lines = csvText.split('\n');
  const byDex = {};
  let separatorRows = 0;

  lines.forEach((line, idx) => {
    if (idx === 0 || !line.trim()) return;
    const [dexField, name, formName, genderSuffix, keywordField] = parseCsvLine(line);
    const keyword = keywordField?.trim();
    let dex = dexField?.trim();

    if (!dex || !keyword) { separatorRows++; return; }
    if (CSV_DEX_CORRECTIONS[keyword]) dex = CSV_DEX_CORRECTIONS[keyword];

    if (!byDex[dex]) byDex[dex] = [];
    byDex[dex].push({
      name: name?.trim(),
      dex,
      formName: formName?.trim(),
      genderSuffix: genderSuffix?.trim(),
      keyword,
    });
  });

  Object.entries(byDex).forEach(([dex, rows]) => {
    rows.forEach((row, i) => {
      const prev = i > 0 ? rows[i - 1] : null;
      row.isFemaleVariant = row.genderSuffix === '-f' &&
        !!prev && prev.formName === row.formName &&
        !SEPARATE_SEX_FORM_DEX.has(dex);
    });
  });

  return { byDex, separatorRows };
}

// ---------------------------------------------------------------------------
// Form exclusion
// ---------------------------------------------------------------------------

function isExcludedForm(name) {
  if (name.includes('-mega')) return true;
  if (name.includes('-gmax')) return true;
  if (name.endsWith('-primal')) return true;
  if (name === 'necrozma-ultra') return true;
  // Arceus/Silvally have no plain base form in PokeAPI, only per-type forms.
  // Keep the Normal-type form as the single entry the sheet asks for.
  if (name.startsWith('arceus-') && name !== 'arceus-normal') return true;
  if (name.startsWith('silvally-') && name !== 'silvally-normal') return true;
  if (['genesect-douse', 'genesect-shock', 'genesect-burn', 'genesect-chill'].includes(name)) return true;
  if (['zacian-crowned', 'zamazenta-crowned'].includes(name)) return true;
  if (name.includes('-totem')) return true;
  if (name === 'greninja-ash') return true;
  if (name === 'mimikyu-busted') return true;
  if (name === 'wishiwashi-solo') return true;
  if (name.includes('minior-') && name.includes('-meteor')) return true;
  if (name === 'koraidon-limited-build' || name === 'koraidon-sprinting-build' ||
      name === 'koraidon-swimming-build' || name === 'koraidon-gliding-build') return true;
  if (name === 'miraidon-low-power-mode' || name === 'miraidon-drive-mode' ||
      name === 'miraidon-aquatic-mode' || name === 'miraidon-glide-mode') return true;
  if (name.includes('ogerpon-') && !name.startsWith('ogerpon ')) return true;
  if (name === 'terapagos-terastal' || name === 'terapagos-stellar') return true;
  if (name === 'castform-sunny' || name === 'castform-rainy' || name === 'castform-snowy') return true;
  if (name === 'cherrim-sunshine') return true;
  if (name === 'dialga-origin' || name === 'palkia-origin') return true;
  if (name === 'giratina-origin') return true;
  if (name === 'darmanitan-zen' || name === 'darmanitan-galar-zen') return true;
  // Mothim/Xerneas: the sheet lists one row; keep PokeAPI's first form, drop the rest.
  if (name === 'mothim-sandy' || name === 'mothim-trash') return true;
  if (name === 'xerneas-neutral') return true;
  if (name === 'kyurem-black' || name === 'kyurem-white') return true;
  if (name === 'meloetta-pirouette') return true;
  if (name === 'greninja-battle-bond') return true;
  if (name === 'zygarde-10-power-construct' || name === 'zygarde-50-power-construct' ||
      name === 'zygarde-complete') return true;
  if (name === 'rockruff-own-tempo') return true;
  if (name === 'necrozma-dusk' || name === 'necrozma-dawn') return true;
  if (name === 'cramorant-gulping' || name === 'cramorant-gorging') return true;
  if (name === 'eiscue-noice') return true;
  if (name === 'morpeko-hangry') return true;
  if (name === 'eternatus-eternamax') return true;
  if (name === 'calyrex-ice' || name === 'calyrex-shadow') return true;
  if (name === 'palafin-hero') return true;
  if (name === 'eevee-starter') return true;
  if (name === 'pichu-spiky-eared') return true;
  if (name === 'pikachu-rock-star' || name === 'pikachu-belle' || name === 'pikachu-pop-star' ||
      name === 'pikachu-phd' || name === 'pikachu-libre' || name === 'pikachu-cosplay' ||
      name === 'pikachu-starter') return true;
  if (name === 'aegislash-blade') return true;
  return false;
}

// ---------------------------------------------------------------------------
// Filter metadata
// ---------------------------------------------------------------------------

// PokeAPI's evolution chain is species-wide and can't express "only this ONE form of
// the species can undergo this evolution" — so the species-level lookup marks every
// form of these species as non-final, when only one specific form actually evolves.
// Verified against real game mechanics.
const FORM_LOCKED_EVOLUTION_OVERRIDE = {
  farfetchd: 'final',               // only Galarian Farfetch'd evolves, into Sirfetch'd
  'mr-mime': 'final',                // only Galarian Mr. Mime evolves, into Mr. Rime
  qwilfish: 'final',                 // only Hisuian Qwilfish evolves, into Overqwil
  corsola: 'final',                  // only Galarian Corsola evolves, into Cursola
  linoone: 'final',                  // only Galarian Linoone evolves, into Obstagoon
  'basculin-red-striped': 'final',   // only White Stripe Basculin evolves, into Basculegion
  'basculin-blue-striped': 'final',
  'floette-eternal': 'final',        // every other Floette color evolves into Florges; this can't
  // PokeAPI's evolution-chain data doesn't model Meltan's GO-transfer evolution into
  // Melmetal at all (its chain has an empty evolves_to) — it isn't really final-stage.
  meltan: 'pre',
};

function resolveEvolutionStage(slug, speciesStage) {
  return FORM_LOCKED_EVOLUTION_OVERRIDE[slug] || speciesStage;
}

const REGION_PATTERN = /-(alola|galar|hisui|paldea)(-|$)/;

function detectRegion(slug) {
  // Pikachu's cap forms are named after regions (pikachu-alola-cap) but aren't
  // regional forms — they're a cosmetic cosplay theme with no regional origin.
  if (slug.endsWith('-cap')) return null;
  return REGION_PATTERN.exec(slug)?.[1] || null;
}

function sameTypesAndStats(a, b) {
  if (!a || !b) return false;
  if (a.types.length !== b.types.length || a.types.some((t, i) => t !== b.types[i])) return false;
  return Object.keys(a.stats).every(k => a.stats[k] === b.stats[k]);
}

// The current-generation regional Pokedexes worth tracking (each game/DLC's own
// numbering, distinct from the National dex in `dex`) — see TODO.md #2. Deliberately
// NOT the sheet's own SwSh/BDSP/PLA/SV/PLZA column grouping (a letter-prefix hack
// bundling e.g. galar+isle-of-armor+crown-tundra under one "SwSh" column): PokeAPI's
// own pokedex names are the generic, vendor-agnostic source of truth.
const REGIONAL_POKEDEXES = [
  'galar', 'isle-of-armor', 'crown-tundra',
  'extended-sinnoh',
  'hisui',
  'paldea', 'kitakami', 'blueberry',
  'lumiose-city',
];

/**
 * Filter a PokemonSpecies' `pokedex_numbers` array (species-level — shared by every
 * form of that species, same as the National `dex` field) down to the regional
 * dexes above. Returns a sparse { pokedexName: entryNumber } map; a species absent
 * from a given dex simply has no key for it, rather than a null placeholder.
 */
function extractRegionalDex(pokedexNumbers) {
  const regionalDex = {};
  for (const entry of pokedexNumbers || []) {
    if (REGIONAL_POKEDEXES.includes(entry.pokedex.name)) {
      regionalDex[entry.pokedex.name] = entry.entry_number;
    }
  }
  return regionalDex;
}

// ---------------------------------------------------------------------------
// Name-based pairing
// ---------------------------------------------------------------------------

// Sheet vocabulary → PokeAPI vocabulary
const FORM_WORD_SYNONYMS = {
  alolan: 'alola', galarian: 'galar', hisuian: 'hisui', paldean: 'paldea',
  fall: 'autumn', pokeball: 'original',
};

function normalizeWords(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function formTokens(formName) {
  return normalizeWords(formName).split(' ')
    .map(t => FORM_WORD_SYNONYMS[t] || t)
    .filter(t => t.length > 2);
}

/**
 * Pair a species' CSV rows to its PokeAPI candidates.
 *
 * A pure positional zip is wrong whenever PokeAPI's form order differs from the
 * sheet's: Vivillon starts at its default (Meadow) rather than Icy Snow, and
 * Alcremie is ordered decoration-major while the sheet is flavor-major, which
 * transposes all 63 rows. So pair by name first — greedily, strongest match
 * first — and fall back to position only for rows whose Form name carries no
 * usable signal ("Original", blank, or vocabulary PokeAPI doesn't share).
 *
 * Returns an array parallel to `rows`: the candidate for each row, or null.
 */
function pairRowsToCandidates(rows, candidates) {
  const result = new Array(rows.length).fill(null);
  const rowTaken = new Array(rows.length).fill(false);
  const candTaken = new Array(candidates.length).fill(false);

  const scored = [];
  rows.forEach((row, i) => {
    const toks = formTokens(row.formName);
    if (!toks.length) return;
    candidates.forEach((cand, j) => {
      const hay = normalizeWords(cand.slug).replace(/\s/g, '-');
      const score = toks.filter(t => hay.includes(t)).length;
      if (score > 0) scored.push({ i, j, score });
    });
  });

  // Strongest matches win; ties broken deterministically by sheet order
  scored.sort((a, b) => b.score - a.score || a.i - b.i || a.j - b.j);
  for (const { i, j } of scored) {
    if (rowTaken[i] || candTaken[j]) continue;
    rowTaken[i] = true;
    candTaken[j] = true;
    result[i] = candidates[j];
  }

  // Positional fill for whatever is left, preserving both orders
  const freeCandidates = candidates.filter((_, j) => !candTaken[j]);
  let next = 0;
  rows.forEach((_, i) => {
    if (rowTaken[i]) return;
    if (next < freeCandidates.length) result[i] = freeCandidates[next++];
  });

  return result;
}

module.exports = {
  parseCsvLine,
  CSV_DEX_CORRECTIONS,
  SEPARATE_SEX_FORM_DEX,
  parseSheetRows,
  isExcludedForm,
  FORM_LOCKED_EVOLUTION_OVERRIDE,
  resolveEvolutionStage,
  REGION_PATTERN,
  detectRegion,
  sameTypesAndStats,
  REGIONAL_POKEDEXES,
  extractRegionalDex,
  FORM_WORD_SYNONYMS,
  normalizeWords,
  formTokens,
  pairRowsToCandidates,
};
