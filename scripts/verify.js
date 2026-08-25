/**
 * Verification suite for the Living Form Full dataset. Two independent checks:
 *
 *  1. Semantic pairing check — the row-level matcher in generate-living-form-full.js
 *     guarantees a 1:1 COUNT with the sheet, but a positional/name-based pairing can
 *     still assign the wrong PokeAPI form to a sheet row (e.g. a whole family
 *     transposed). This checks each pair's meaning: the words in the sheet's "Form
 *     name" should show up in the PokeAPI form slug it was paired with.
 *
 *  2. Tier-derivation check — verifies that filtering our metadata-enriched dataset
 *     with a simple predicate reproduces each of Austin John's other tier sheets
 *     (Living Form, Living Lite, Final Form Full, Final Form) exactly — entry by
 *     entry (via csvKeyword), not just a matching total count. The predicates live in
 *     ./lib/tiers.js (see that file for what each tier actually means for this
 *     project — the source sheets are reference-only, not a runtime dependency, per
 *     generate-living-form-full.js's own header comment).
 *
 * Usage:
 *   node verify.js              — runs everything
 *   node verify.js semantics    — just the semantic pairing check
 *   node verify.js <tier-name>  — just that one tier (e.g. "living-lite")
 */
const fs = require('fs');
const path = require('path');
const { TIERS, KNOWN_DIVERGENCES } = require('./lib/tiers');

const JSON_FILE = path.join(__dirname, '..', 'data', 'living-form-full-data.json');
const CSV_DIR = path.join(__dirname, '..', 'sheets');

// ---------------------------------------------------------------------------
// Check 1: semantic pairing
// ---------------------------------------------------------------------------

// Sheet vocabulary → PokeAPI vocabulary
const SYNONYMS = {
  alolan: 'alola', galarian: 'galar', hisuian: 'hisui', paldean: 'paldea',
  fall: 'autumn', pokeball: 'original',
};
// Words that carry no discriminating signal. "basic" is the sheet's label for a
// species' default form, which PokeAPI spells as the bare slug with no suffix.
const STOPWORDS = new Set([
  'sea', 'flower', 'cap', 'stripe', 'form', 'forme', 'style', 'mode', 'sweet',
  'cream', 'swirl', 'size', 'original', 'normal', 'plumage', 'trim', 'family',
  'pattern', 'breed', 'plant', 'core', 'basic', 'the', 'of', 'and',
]);

function norm(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(formName) {
  return norm(formName).split(' ')
    .map(t => SYNONYMS[t] || t)
    .filter(t => t && t.length > 2 && !STOPWORDS.has(t));
}

function checkSemantics(data) {
  const entries = Object.values(data.pokemon);

  const suspicious = [];
  let checked = 0, blank = 0, ok = 0;

  for (const e of entries) {
    // Recover the sheet's Form name from the display name: "Name (Form name)"
    const m = /\(([^)]*)\)/.exec(e.name || '');
    const formName = m ? m[1] : '';
    if (!formName) { blank++; continue; }

    const toks = tokens(formName);
    if (!toks.length) { blank++; continue; }

    checked++;
    const slug = norm(e.pokeapiSlug).replace(/\s/g, '-');
    const missing = toks.filter(t => !slug.includes(t));

    if (missing.length === toks.length) {
      suspicious.push({ key: e.slug, dex: e.dex, formName, pokeapiSlug: e.pokeapiSlug, missing });
    } else {
      ok++;
    }
  }

  console.log('=== Semantic verification of CSV ↔ PokeAPI pairings ===\n');
  console.log(`   Entries total:              ${entries.length}`);
  console.log(`   No form-name to check:      ${blank}`);
  console.log(`   Checked:                    ${checked}`);
  console.log(`   Consistent:                 ${ok}`);
  console.log(`   Suspicious (no overlap):    ${suspicious.length}\n`);

  if (!suspicious.length) {
    console.log('✅ Every pairing is semantically consistent.\n');
    return true;
  }

  // Group by dex so a transposed family shows up as one block
  const byDex = {};
  suspicious.forEach(s => { (byDex[s.dex] = byDex[s.dex] || []).push(s); });
  const sorted = Object.entries(byDex).sort((a, b) => b[1].length - a[1].length);

  console.log(`⚠️  Species with suspicious pairings (${sorted.length}), worst first:\n`);
  for (const [dex, list] of sorted) {
    console.log(`   Dex ${dex} — ${list.length} suspicious pairing(s):`);
    list.slice(0, 6).forEach(s =>
      console.log(`      ${s.key.padEnd(16)} "${s.formName}"  ->  ${s.pokeapiSlug}`));
    if (list.length > 6) console.log(`      ... +${list.length - 6} more`);
    console.log();
  }
  return false;
}

// ---------------------------------------------------------------------------
// Check 2: tier derivation
// ---------------------------------------------------------------------------

function parseCsvLine(line) {
  const fields = [];
  let current = '', inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else current += ch;
  }
  fields.push(current.trim());
  return fields;
}

// Expects the normalized 5-column format produced by normalize-sheet.js:
// dex,name,formName,genderSuffix,keyword.
function loadCsvRows(file) {
  const lines = fs.readFileSync(path.join(CSV_DIR, file), 'utf-8').split('\n');
  const rows = [];
  lines.forEach((line, idx) => {
    if (idx === 0 || !line.trim()) return;
    const [dex, name, formName, , keyword] = parseCsvLine(line);
    if (dex && keyword) rows.push({ dex, name, formName, keyword });
  });
  return rows;
}

function checkTier(data, tierName) {
  const tier = TIERS[tierName];
  const entries = Object.values(data.pokemon);
  const csvRows = loadCsvRows(tier.csv);
  const csvKeywords = new Set(csvRows.map(r => r.keyword));

  const filtered = entries.filter(tier.predicate);
  const filteredKeywords = new Set(filtered.map(e => e.csvKeyword));

  const known = new Set(KNOWN_DIVERGENCES[tierName] || []);
  const extra = [...filteredKeywords].filter(k => !csvKeywords.has(k) && !known.has(k));
  const missing = [...csvKeywords].filter(k => !filteredKeywords.has(k) && !known.has(k));

  console.log(`=== ${tierName} ===`);
  console.log(`   Living Form Full total: ${entries.length}`);
  console.log(`   CSV rows:               ${csvRows.length}`);
  console.log(`   Our filter result:      ${filtered.length}`);
  console.log(`   Extra (not in CSV):     ${extra.length}`);
  console.log(`   Missing (not in ours):  ${missing.length}`);
  if (known.size) console.log(`   Known accepted divergences (excluded above): ${[...known].join(', ')}`);

  if (extra.length) {
    const byKeyword = new Map(entries.map(e => [e.csvKeyword, e]));
    console.log('\n   EXTRA — our filter includes, sheet doesn\'t:');
    extra.slice(0, 15).forEach(k => {
      const e = byKeyword.get(k);
      console.log(`      ${k}  (dex=${e.dex} species=${e.species} alt=${e.isAlternateForm} gender=${e.isGenderVariant} stage=${e.evolutionStage})`);
    });
    if (extra.length > 15) console.log(`      ... +${extra.length - 15} more`);
  }
  if (missing.length) {
    const csvByKeyword = new Map(csvRows.map(r => [r.keyword, r]));
    console.log('\n   MISSING — sheet has it, our filter excludes it:');
    missing.slice(0, 15).forEach(k => {
      const r = csvByKeyword.get(k);
      console.log(`      ${k}  (dex=${r.dex} name=${r.name} form="${r.formName}")`);
    });
    if (missing.length > 15) console.log(`      ... +${missing.length - 15} more`);
  }

  const passed = !extra.length && !missing.length;
  console.log(passed
    ? (known.size ? '\n✅ Match (within known accepted divergences).\n' : '\n✅ Perfect match.\n')
    : '\n⚠️  Not an exact match.\n');
  return passed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const arg = process.argv[2];
  const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  let allPassed = true;

  if (!arg) {
    allPassed = checkSemantics(data) && allPassed;
    for (const tierName of Object.keys(TIERS)) {
      allPassed = checkTier(data, tierName) && allPassed;
    }
  } else if (arg === 'semantics') {
    allPassed = checkSemantics(data);
  } else if (TIERS[arg]) {
    allPassed = checkTier(data, arg);
  } else {
    console.error(`Unknown check "${arg}". Known: semantics, ${Object.keys(TIERS).join(', ')}`);
    process.exit(1);
  }

  if (!allPassed) process.exitCode = 1;
}

main();
