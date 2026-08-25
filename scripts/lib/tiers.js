// Re-exports the canonical tier definitions from packages/tiers, so this repo's own
// scripts (scripts/verify.js) and the published package stay a single source of
// truth — see packages/tiers/README.md for why this isn't duplicated here.
module.exports = require('../../packages/tiers');
