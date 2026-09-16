/**
 * One-off updater: adds/refreshes `.availability` on every entry in the already-generated
 * `data/v1/living-form-full-data.json`, without re-fetching anything from PokeAPI. Uses
 * the same `enrichEntriesWithAvailability` join `generate-living-form-full.js` now runs
 * automatically on a full regenerate (see TODO #31) — this script exists for updating
 * just this one field when a full regenerate isn't warranted (no PokeAPI-side data
 * changed, only the vendored availability CSV or the join/parsing logic).
 *
 * Usage: node enrich-availability.js
 */
const fs = require('fs');
const path = require('path');
const { enrichEntriesWithAvailability } = require('./lib/availability');

const DATA_FILE = path.join(__dirname, '..', 'data', 'v1', 'living-form-full-data.json');
const AVAILABILITY_CSV_FILE = path.join(__dirname, '..', 'sheets', 'availability', 'pokemon-availability.csv');

const dataset = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const csvText = fs.readFileSync(AVAILABILITY_CSV_FILE, 'utf8');

const { matched, unmatched } = enrichEntriesWithAvailability(dataset.pokemon, csvText);

fs.writeFileSync(DATA_FILE, JSON.stringify(dataset, null, 2));

console.log(`🎮 Availability: ${matched}/${dataset.count} entries matched a Bulbapedia row`);
if (unmatched.length) {
  console.log(`⚠️  ${unmatched.length} unmatched entries:`);
  unmatched.forEach((slug) => console.log(`   - ${slug}`));
} else {
  console.log('✅ Every entry matched.');
}
console.log(`💾 Updated ${path.basename(DATA_FILE)}`);
