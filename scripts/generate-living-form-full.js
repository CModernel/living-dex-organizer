/**
 * Living Form Full generator: row-level 1:1 mapping between Austin John's Living Dex
 * sheet and PokeAPI, keyed by PokeAPI slug (see CSV_DEX_CORRECTIONS and
 * SEPARATE_SEX_FORM_DEX in ./lib/generate-rules for the sheet quirks this accounts for).
 *
 * Each entry also carries filter metadata (evolutionStage, isAlternateForm,
 * isGenderVariant, isRegionalForm/region, hasStatOrTypeDifference, sortIndex) so a
 * client can build its own filtered views — e.g. approximating Austin John's other
 * tiers (Living Lite, Living Form, Final Form...) — without this script needing to
 * know about them. Mega/Gigantamax/Primal forms are excluded outright, not tagged:
 * they're out of scope for this dataset. Box/page/slot positions are deliberately NOT
 * computed here — they depend on which entries a given view includes, so a client
 * derives them from `sortIndex` (chunk the filtered, sorted list into boxes of 30).
 *
 * The row-matching/exclusion/classification rules live in ./lib/generate-rules.js
 * (pure, unit-tested — see generate-rules.test.js); this file is I/O and orchestration.
 *
 * Usage: node generate-living-form-full.js [path-to-csv]
 */
const fs = require('fs');
const path = require('path');
const {
  parseSheetRows,
  isExcludedForm,
  resolveEvolutionStage,
  detectRegion,
  sameTypesAndStats,
  extractRegionalDex,
  pairRowsToCandidates,
  SEPARATE_SEX_FORM_DEX,
} = require('./lib/generate-rules');
const {
  SPRITE_BASE_URL,
  SPRITE_VARIANTS,
  deriveSpriteId,
  hasFemaleSprite,
  hasShinyFemaleSprite,
} = require('./lib/sprite-url');
const {
  POKEJUNGLE_BASE_URL,
  POKEJUNGLE_VARIANTS,
  SHINY_LOCKED,
  derivePokeJungleIds,
  deriveShinyOverrides,
} = require('./lib/pokejungle-sprite');

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'v1', 'living-form-full-data.json');
const REPORT_FILE = path.join(__dirname, '..', 'data', 'v1', 'living-form-full-mapping-report.json');
const CACHE_FILE = path.join(__dirname, '.pokeapi-candidates-cache.json');
const EVOLUTION_CACHE_FILE = path.join(__dirname, '.pokeapi-evolution-chains-cache.json');
// Bump this when the candidate shape *or* fetching logic changes, so a stale on-disk
// cache is rejected instead of silently keeping outdated/incorrect data (e.g. fields
// added later, the v3 fix for shared sprites on multi-form species, or the v4
// addition of regionalDex).
const CANDIDATE_CACHE_VERSION = 4;

// Deliberately stays on Austin John's own 1.4 rather than the fan-made 1.4.1: 1.4.1 drops
// Eternal Flower Floette (floette-5), which is obtainable in Legends Z-A and transferable
// through HOME to Champions. Austin John's 1.4 changelog says it belongs in every section,
// and his sheet already assigns it a Z-A dex slot (039), so 1.4.1 losing it is a regression.
const DEFAULT_CSV = 'Living Form Full.csv';
const CSV_FILE = process.argv[2] || path.join(__dirname, '..', 'sheets', DEFAULT_CSV);

const BATCH = 30;
const BATCH_DELAY_MS = 800;
const delay = ms => new Promise(r => setTimeout(r, ms));

function loadCsvByDex() {
  const csv = fs.readFileSync(CSV_FILE, 'utf-8');
  return parseSheetRows(csv);
}

// ---------------------------------------------------------------------------
// PokeAPI helpers
// ---------------------------------------------------------------------------

function getStatsMap(stats) {
  const map = {};
  stats.forEach(s => { map[s.stat.name] = s.base_stat; });
  return map;
}

function getSpriteUrls(sprites) {
  if (!sprites) return {};
  return {
    front_default: sprites.front_default,
    front_female: sprites.front_female,
    back_default: sprites.back_default,
    back_female: sprites.back_female,
    front_shiny: sprites.front_shiny,
    front_shiny_female: sprites.front_shiny_female,
    back_shiny: sprites.back_shiny,
    back_shiny_female: sprites.back_shiny_female,
  };
}

// The full 8-sprite set above is kept on the fetched candidate (collectCandidates
// caches it) because the back_female/back_shiny_female fields are still needed to
// detect species whose only female-distinct sprite is a back view (see the
// hasAnyFemaleSprite check below, which is broader than lib/sprite-url's
// hasFemaleSprite — that one only looks at the front variants we actually persist).
function hasAnyFemaleSprite(sprites) {
  return !!(sprites?.front_female || sprites?.back_female ||
            sprites?.front_shiny_female || sprites?.back_shiny_female);
}

// Persisted entries only need a derived { id, hasFemale, hasShinyFemale } — see
// lib/sprite-url.js for why storing 4 full URLs per entry is redundant (the id
// token is shared).
function spriteRefForOutput(sprites) {
  return {
    id: deriveSpriteId(sprites),
    hasFemale: hasFemaleSprite(sprites),
    hasShinyFemale: hasShinyFemaleSprite(sprites),
  };
}

// ---------------------------------------------------------------------------
// PokeAPI fetching
// ---------------------------------------------------------------------------

async function fetchWithRetry(url, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`${res.status}`);
      }
      return await res.json();
    } catch (e) {
      if (i === maxRetries - 1) return null;
      await delay(300);
    }
  }
}

/**
 * Fetch every pokémon + its forms, keeping PokeAPI's own encounter order.
 * Cached to disk — the fetch takes a few minutes, so caching lets the matching
 * rules above be iterated on without re-hitting the API. Delete the cache file
 * to force a refetch.
 */
async function collectCandidates() {
  if (fs.existsSync(CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (cached.version === CANDIDATE_CACHE_VERSION) {
      console.log('📦 Loading PokeAPI candidates from cache...');
      console.log(`   ${cached.candidates.length} raw candidates cached\n`);
      return cached.candidates;
    }
    console.log('📦 Candidate cache is stale (schema changed) — refetching...\n');
  }

  console.log('📥 Fetching all pokémon from PokeAPI...');
  const pokemonList = await fetchWithRetry('https://pokeapi.co/api/v2/pokemon/?limit=2000');
  if (!pokemonList) {
    console.error('Failed to fetch pokemon list');
    process.exit(1);
  }
  console.log(`   Found ${pokemonList.results.length} pokémon\n`);

  const candidates = [];
  console.log('🔄 Collecting candidates (this takes a few minutes; cached afterwards)...');
  for (let i = 0; i < pokemonList.results.length; i += BATCH) {
    const batch = pokemonList.results.slice(i, i + BATCH);
    console.log(`   Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(pokemonList.results.length / BATCH)}`);

    for (const result of batch) {
      const pokemon = await fetchWithRetry(result.url);
      if (!pokemon) continue;

      let dexId = null, generation = 1, evolutionChainUrl = null, speciesName = null;
      let regionalDex = {};
      if (pokemon.species?.url) {
        // Same species fetch already covers regional Pokedex numbers (TODO #2) — no
        // extra request needed, they're just another field on this response.
        const species = await fetchWithRetry(pokemon.species.url);
        if (species) {
          if (species.generation?.url) {
            generation = parseInt(species.generation.url.split('/').slice(-2)[0]);
          }
          dexId = species.id ? String(species.id).padStart(4, '0') : null;
          evolutionChainUrl = species.evolution_chain?.url || null;
          speciesName = species.name;
          regionalDex = extractRegionalDex(species.pokedex_numbers);
        }
      }
      if (!dexId) continue;

      const statsMap = getStatsMap(pokemon.stats);
      const forms = pokemon.forms?.length ? pokemon.forms : [{ name: pokemon.name }];

      // Purely cosmetic form families (Unown's 28 letters, Vivillon's 20 patterns,
      // Alcremie's 63 combinations, Furfrou's 10 trims, Flabébé/Floette/Florges'
      // colors...) are modeled by PokeAPI as multiple `/pokemon-form/` entries under
      // ONE `/pokemon/` resource, not as separate top-level `/pokemon/` entries. Their
      // types/stats are genuinely identical across forms (fine to share), but each
      // form has its OWN distinct sprite — reusing the parent's `pokemon.sprites` for
      // all of them would show every letter/pattern/color as the same picture. Only
      // pay for the extra per-form fetch when there's more than one form to tell apart.
      for (const formRef of forms) {
        let sprites = getSpriteUrls(pokemon.sprites);
        if (forms.length > 1) {
          const form = await fetchWithRetry(formRef.url);
          if (form) sprites = getSpriteUrls(form.sprites);
        }
        candidates.push({
          slug: formRef.name,
          dexId,
          speciesName,
          generation,
          evolutionChainUrl,
          regionalDex,
          types: pokemon.types.map(t => t.type.name),
          stats: {
            hp: statsMap.hp,
            atk: statsMap.attack,
            def: statsMap.defense,
            spatk: statsMap['special-attack'],
            spdef: statsMap['special-defense'],
            spe: statsMap.speed,
          },
          sprites,
        });
      }
    }

    if (i + BATCH < pokemonList.results.length) await delay(BATCH_DELAY_MS);
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify({ version: CANDIDATE_CACHE_VERSION, candidates }, null, 2));
  console.log(`   Cached ${candidates.length} raw candidates to ${path.basename(CACHE_FILE)}\n`);
  return candidates;
}

/**
 * Classify each dex ID as 'pre' (base of its evolution line), 'mid', or 'final' (no
 * further evolution — including species that never evolve at all).
 *
 * Regional forms share their base species' evolution chain (Alolan Raichu's `species`
 * still points at dex 0026), so this only needs to run once per distinct chain, not
 * once per candidate.
 */
async function computeEvolutionStages(candidates) {
  const chainUrlByDex = new Map();
  const speciesNameByDex = new Map();
  candidates.forEach(c => {
    if (c.evolutionChainUrl) chainUrlByDex.set(c.dexId, c.evolutionChainUrl);
    if (c.speciesName) speciesNameByDex.set(c.dexId, c.speciesName);
  });
  const distinctUrls = [...new Set(chainUrlByDex.values())];

  let chains;
  if (fs.existsSync(EVOLUTION_CACHE_FILE)) {
    console.log('📦 Loading evolution chains from cache...');
    chains = JSON.parse(fs.readFileSync(EVOLUTION_CACHE_FILE, 'utf-8')).chains;
  } else {
    console.log(`🔄 Fetching ${distinctUrls.length} distinct evolution chains...`);
    chains = [];
    for (const url of distinctUrls) {
      const chain = await fetchWithRetry(url);
      if (chain) chains.push(chain);
    }
    fs.writeFileSync(EVOLUTION_CACHE_FILE, JSON.stringify({ chains }, null, 2));
    console.log(`   Cached ${chains.length} chains to ${path.basename(EVOLUTION_CACHE_FILE)}\n`);
  }

  const stageByName = new Map();
  const walk = (node, hasParent) => {
    // Some chain links (e.g. Phione -> Manaphy) carry no evolution_details at all —
    // PokeAPI groups them by breeding relationship, not an actual evolution trigger.
    // Only a child with a real trigger counts toward "this species evolves further".
    const realChildren = node.evolves_to.filter(c => c.evolution_details.length > 0);
    const stage = realChildren.length === 0 ? 'final' : hasParent ? 'mid' : 'pre';
    stageByName.set(node.species.name, stage);
    node.evolves_to.forEach(child => walk(child, true));
  };
  chains.forEach(c => walk(c.chain, false));

  const stageByDex = new Map();
  for (const [dexId, speciesName] of speciesNameByDex) {
    if (stageByName.has(speciesName)) stageByDex.set(dexId, stageByName.get(speciesName));
  }
  return stageByDex;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Living Form Full Generator (row-level 1:1 CSV ↔ PokeAPI) ===\n');

  const { byDex: csvByDex, separatorRows } = loadCsvByDex();
  const allCsvRows = Object.values(csvByDex).flat();
  const csvMainRows = allCsvRows.filter(r => !r.isFemaleVariant);
  const csvFemaleRows = allCsvRows.filter(r => r.isFemaleVariant);

  console.log('📖 CSV ground truth:');
  console.log(`   Species groups:            ${Object.keys(csvByDex).length}`);
  console.log(`   "Gen" separator rows:      ${separatorRows} (skipped — not Pokémon)`);
  console.log(`   Real Pokémon rows:         ${allCsvRows.length}`);
  console.log(`     MAIN (needs candidate):  ${csvMainRows.length}`);
  console.log(`     FEMALE (-f expansion):   ${csvFemaleRows.length}\n`);

  const rawCandidates = await collectCandidates();

  // Group candidates by dex, applying business-rule exclusions and deduping
  const candidatesByDex = {};
  let excluded = 0;
  const seen = new Set();
  for (const c of rawCandidates) {
    if (isExcludedForm(c.slug)) { excluded++; continue; }
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);

    // Scatterbug/Spewpa have no base form in PokeAPI, only 20 cosmetic patterns each,
    // while the sheet lists a single row. Take the first pattern as the stand-in base.
    const isPatternOnly = c.slug.startsWith('scatterbug-') || c.slug.startsWith('spewpa-');
    if (isPatternOnly && candidatesByDex[c.dexId]?.length > 0) continue;

    if (!candidatesByDex[c.dexId]) candidatesByDex[c.dexId] = [];
    candidatesByDex[c.dexId].push(c);
  }
  const candidateCount = Object.values(candidatesByDex).reduce((n, a) => n + a.length, 0);
  console.log('🧮 Candidates after exclusion rules:');
  console.log(`   Kept:     ${candidateCount}`);
  console.log(`   Excluded: ${excluded}`);
  console.log(`   vs CSV MAIN rows needed: ${csvMainRows.length}  (delta ${candidateCount - csvMainRows.length})\n`);

  const evolutionStageByDex = await computeEvolutionStages(rawCandidates);

  // ---- Row-level matching -------------------------------------------------
  console.log('🔗 Matching CSV rows ↔ PokeAPI candidates...');
  const entries = {};
  const matched = [];
  const unmatchedMain = [];
  const unmatchedFemale = [];
  const orphans = [];

  const allDex = [...new Set([...Object.keys(csvByDex), ...Object.keys(candidatesByDex)])].sort();
  // Stable global order for building box-position UIs from: dex-major, then each
  // species' CSV row order. Box/slot numbers are NOT stored here — they depend on
  // which entries a given view includes, so they're derived client-side from this.
  let sortIndex = 0;

  for (const dex of allDex) {
    const rows = csvByDex[dex] || [];
    const candidates = candidatesByDex[dex] || [];
    const mainRows = rows.filter(r => !r.isFemaleVariant);
    const evolutionStage = evolutionStageByDex.get(dex) || 'final';

    // Pair MAIN rows to candidates by name (falling back to position), then key each
    // JSON entry by the PokeAPI slug itself — it's globally unique and URL-safe, unlike
    // the sheet's own keyword (accents, spaces, ♀/♂). The sheet keyword is kept as
    // `csvKeyword` on the entry so the 1:1 correspondence stays traceable.
    const pairing = pairRowsToCandidates(mainRows, candidates);
    const pairedByFormName = new Map();
    let baseline = null; // first matched candidate's types/stats, for hasStatOrTypeDifference
    mainRows.forEach((row, i) => {
      const candidate = pairing[i];
      if (!candidate) {
        unmatchedMain.push({ dex, keyword: row.keyword, csvForm: row.formName,
          reason: `CSV MAIN row #${i + 1} but only ${candidates.length} candidate(s) for this species` });
        return;
      }

      const key = candidate.slug;
      if (entries[key]) {
        unmatchedMain.push({ dex, keyword: row.keyword, csvForm: row.formName,
          reason: `key collision on "${key}"` });
        return;
      }
      if (i === 0) baseline = candidate;

      const isAlternateForm = i > 0;
      const region = detectRegion(candidate.slug);
      // For SEPARATE_SEX_FORM_DEX species, the "female" half is a real PokeAPI form
      // (not a sprite expansion) but is still a gender variant for filtering purposes —
      // Living Form and its siblings exclude it exactly like the sprite-based ones.
      const isSeparateSexFemale = SEPARATE_SEX_FORM_DEX.has(dex) && candidate.slug.endsWith('-female');
      entries[key] = {
        slug: key,
        pokeapiSlug: candidate.slug,
        csvKeyword: row.keyword,
        name: row.formName ? `${row.name} (${row.formName})` : row.name,
        species: row.name,
        dex,
        types: candidate.types,
        generation: candidate.generation,
        regionalDex: candidate.regionalDex,
        sprites: spriteRefForOutput(candidate.sprites),
        evolutionStage: resolveEvolutionStage(candidate.slug, evolutionStage),
        isAlternateForm,
        isGenderVariant: isSeparateSexFemale,
        isRegionalForm: region !== null,
        region,
        hasStatOrTypeDifference: isAlternateForm ? !sameTypesAndStats(candidate, baseline) : false,
        sortIndex: sortIndex++,
      };
      matched.push({ dex, keyword: row.keyword, key });
      pairedByFormName.set(row.formName, { candidate, key });
    });

    // Female rows are the -f sprite expansion of the MAIN row sharing their Form name
    rows.filter(r => r.isFemaleVariant).forEach(row => {
      const pair = pairedByFormName.get(row.formName);
      if (!pair) {
        unmatchedFemale.push({ dex, keyword: row.keyword, csvForm: row.formName,
          reason: 'no matched MAIN row with the same Form name' });
        return;
      }
      const { candidate } = pair;
      if (!hasAnyFemaleSprite(candidate.sprites)) {
        unmatchedFemale.push({ dex, keyword: row.keyword, csvForm: row.formName,
          reason: `PokeAPI has no female sprite for ${candidate.slug}` });
        return;
      }
      const key = `${candidate.slug}-f`;
      if (entries[key]) {
        unmatchedFemale.push({ dex, keyword: row.keyword, csvForm: row.formName,
          reason: `key collision on "${key}"` });
        return;
      }
      const base = entries[pair.key];
      entries[key] = {
        slug: key,
        pokeapiSlug: candidate.slug,
        csvKeyword: row.keyword,
        name: `${base.name} ♀`,
        species: base.species,
        dex,
        types: candidate.types,
        generation: candidate.generation,
        regionalDex: candidate.regionalDex,
        sprites: spriteRefForOutput(candidate.sprites),
        evolutionStage: resolveEvolutionStage(candidate.slug, evolutionStage),
        isAlternateForm: base.isAlternateForm,
        isGenderVariant: true,
        isRegionalForm: base.isRegionalForm,
        region: base.region,
        hasStatOrTypeDifference: false,
        sortIndex: sortIndex++,
      };
      matched.push({ dex, keyword: row.keyword, key });
    });

    // Candidates the CSV had no row for
    const consumed = new Set(pairing.filter(Boolean).map(c => c.slug));
    candidates.forEach(c => {
      if (!consumed.has(c.slug)) orphans.push({ dex, slug: c.slug });
    });
  }

  // PokeJungle sprite ids. Runs as a pass over the finished entries rather than inside
  // the loop above because the rule is positional — it needs a species' complete form
  // list, which only exists once every row has been matched.
  const entriesByDex = {};
  Object.values(entries)
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .forEach(e => { (entriesByDex[e.dex] = entriesByDex[e.dex] || []).push(e); });
  for (const speciesEntries of Object.values(entriesByDex)) {
    const pokejungleIds = derivePokeJungleIds(speciesEntries);
    speciesEntries.forEach(e => { e.sprites.pokejungleId = pokejungleIds[e.slug]; });
  }
  // Only set where it actually differs from pokejungleId (currently just Minior and
  // Alcremie — see deriveShinyOverrides's own comment for why) — everyone else's
  // normal-variant id is already correct for shiny too.
  const shinyOverrides = deriveShinyOverrides(Object.values(entries));
  for (const [slug, shinyId] of Object.entries(shinyOverrides)) {
    entries[slug].sprites.pokejungleShinyId = shinyId;
  }
  // Entries with NO shiny art at all on PokeJungle (real 404, or the lock-icon 200 —
  // see SHINY_LOCKED's own comment) — a consumer must skip PokeJungle for these
  // entirely rather than trust the request "succeeding".
  for (const slug of SHINY_LOCKED) {
    if (entries[slug]) entries[slug].sprites.pokejungleShinyUnavailable = true;
  }

  const finalCount = Object.keys(entries).length;
  console.log('\n📊 Mapping results:');
  console.log(`   CSV rows matched:        ${matched.length} / ${allCsvRows.length}`);
  console.log(`   MAIN rows unmatched:     ${unmatchedMain.length}`);
  console.log(`   FEMALE rows unmatched:   ${unmatchedFemale.length}`);
  console.log(`   Orphan candidates:       ${orphans.length}`);
  console.log(`   Final JSON entries:      ${finalCount}\n`);

  const show = (label, list, fmt) => {
    if (!list.length) return;
    console.log(`${label} (${list.length}):`);
    list.slice(0, 25).forEach(x => console.log(`   ${fmt(x)}`));
    if (list.length > 25) console.log(`   ... +${list.length - 25} more (full list in the report file)`);
    console.log();
  };
  show('❌ Unmatched CSV MAIN rows', unmatchedMain, x => `${x.dex} ${x.keyword} "${x.csvForm}" — ${x.reason}`);
  show('⚠️  Unmatched CSV FEMALE rows', unmatchedFemale, x => `${x.dex} ${x.keyword} "${x.csvForm}" — ${x.reason}`);
  show('⚠️  Orphan PokeAPI candidates', orphans, x => `${x.dex} ${x.slug}`);

  console.log('🔍 Exclusion sanity checks (all expect 0):');
  ['-mega', '-gmax', '-primal', '-crowned'].forEach(pat => {
    console.log(`   ${pat.padEnd(9)}: ${Object.keys(entries).filter(k => k.includes(pat)).length}`);
  });

  console.log('\n🏷️  Filter metadata:');
  const values = Object.values(entries);
  ['pre', 'mid', 'final'].forEach(stage =>
    console.log(`   evolutionStage=${stage.padEnd(5)}: ${values.filter(e => e.evolutionStage === stage).length}`));
  console.log(`   isAlternateForm=true    : ${values.filter(e => e.isAlternateForm).length}`);
  console.log(`   isGenderVariant=true    : ${values.filter(e => e.isGenderVariant).length}`);
  console.log(`   isRegionalForm=true     : ${values.filter(e => e.isRegionalForm).length}`);
  console.log(`   hasStatOrTypeDifference : ${values.filter(e => e.hasStatOrTypeDifference).length}`);

  console.log('\n🎯 Known families (JSON vs CSV, counted by dex):');
  [['Unown', '0201'], ['Vivillon', '0666'], ['Alcremie', '0869'], ['Furfrou', '0676'],
   ['Flabébé', '0669'], ['Floette', '0670'], ['Florges', '0671'], ['Pikachu', '0025'],
   ['Scatterbug', '0664'], ['Spewpa', '0665']].forEach(([label, dex]) => {
    const got = Object.values(entries).filter(e => e.dex === dex).length;
    const want = (csvByDex[dex] || []).length;
    console.log(`   ${label.padEnd(11)} ${String(got).padStart(3)} / ${want} ${got === want ? '✓' : '✗'}`);
  });

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // `baseUrl`/`variants` stay at the top level (PokeAPI, the original and still the
  // fallback source); `sources` is additive, so a client pinned to the older shape keeps
  // working and can adopt PokeJungle whenever it's ready.
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    count: finalCount,
    sprite: {
      baseUrl: SPRITE_BASE_URL,
      variants: SPRITE_VARIANTS,
      sources: {
        pokejungle: { baseUrl: POKEJUNGLE_BASE_URL, variants: POKEJUNGLE_VARIANTS },
      },
    },
    pokemon: entries,
  }, null, 2));
  fs.writeFileSync(REPORT_FILE, JSON.stringify({
    csvTotalRows: allCsvRows.length,
    csvMainRows: csvMainRows.length,
    csvFemaleRows: csvFemaleRows.length,
    separatorRowsSkipped: separatorRows,
    candidatesKept: candidateCount,
    finalEntries: finalCount,
    matched, unmatchedMain, unmatchedFemale, orphans,
  }, null, 2));

  console.log(`\n💾 Wrote ${finalCount} entries to ${path.basename(OUTPUT_FILE)}`);
  console.log(`💾 Wrote mapping report to ${path.basename(REPORT_FILE)}`);
  if (finalCount === allCsvRows.length && !unmatchedMain.length && !unmatchedFemale.length && !orphans.length) {
    console.log('\n✅ Exact 1:1 mapping achieved.\n');
  } else {
    console.log('\n⚠️  Not yet exact — see the lists above.\n');
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
