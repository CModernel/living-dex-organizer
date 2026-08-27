/**
 * PokeJungle sprite id derivation.
 *
 * Austin John's sheet illustrates every row with a sprite from pokejungle.net, whose
 * URLs are built from one id token under a per-variant folder:
 *
 *   https://pokejungle.net/sprites/{normal|shiny}/{natDex}{formId}{genderId}.png
 *
 * The id is `natDex` (already 4-digit zero-padded on every entry) plus two optional
 * suffixes. `formId` is simply the entry's position among its species' forms — ''
 * for the first, '-1' for the second, and so on — and `genderId` is '-f' for a female
 * variant. Two species need explicit rules (see the tables below); everything else
 * follows the positional rule. Verified against the sheet's own sprite export:
 * 1387/1387 ids reproduced exactly (scripts/verify.js re-checks this on every run).
 *
 * NOTE this deliberately derives from OUR entry order, not PokeAPI's raw form order.
 * PokeAPI's order disagrees for 7 species — it includes Mega/Zen/meteor forms the
 * sheet drops, and orders Vivillon's patterns differently. Our order comes from the
 * sheet, which shares an origin with PokeJungle's numbering, so the two line up.
 *
 * Kept pure (no I/O) so it's unit-testable — same split as ./generate-rules.js.
 */

const POKEJUNGLE_BASE_URL = 'https://pokejungle.net/sprites/';

// PokeJungle mirrors the whole set under /shiny/ using the identical id, so one token
// serves both variants. Coverage isn't total though: the per-combination Alcremie and
// Minior shinies 404 (~5% of entries), so a consumer must tolerate a missing image
// rather than assume every shiny URL resolves.
const POKEJUNGLE_VARIANTS = { normal: 'normal/', shiny: 'shiny/' };

// ---------------------------------------------------------------------------
// Per-species rules
// ---------------------------------------------------------------------------

// PokeJungle numbers Pikachu's Let's Go partner form (PokeAPI's `pikachu-starter`) as
// -8, but the sheet has no row for it — so our 9th kept form lands on -9, not -8, and
// everything after it shifts by one too. Confirmed against the live site: 0025-8
// resolves (it exists, we just never reference it) and 0025-10 is a 404, so -9 is the
// last id this species uses.
const PIKACHU_DEX = '0025';
const PIKACHU_RESERVED_INDEX = 8;

// Alcremie is the one species that isn't a flat list: it's a 9 creams x 7 sweets grid,
// and PokeJungle splits it across BOTH suffixes — formId picks the cream, genderId the
// sweet. So here '-f' means "ribbon sweet", not "female"; treating it as a gender
// suffix silently produces 8 wrong URLs. Both orders below are PokeAPI's own, which is
// what the sheet followed.
const ALCREMIE_DEX = '0869';
const ALCREMIE_CREAMS = [
  'vanilla-cream', 'ruby-cream', 'matcha-cream', 'mint-cream', 'lemon-cream',
  'salted-cream', 'ruby-swirl', 'caramel-swirl', 'rainbow-swirl',
];
const ALCREMIE_SWEETS = [
  'strawberry', 'berry', 'love', 'star', 'clover', 'flower', 'ribbon',
];

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/** '' for the first form, '-1' for the second, ... */
function formSuffix(index) {
  return index === 0 ? '' : `-${index}`;
}

/** '' for the first sweet, then '-a'..'-f'. */
function sweetSuffix(index) {
  return index === 0 ? '' : `-${String.fromCharCode(96 + index)}`;
}

function deriveAlcremieIds(entries) {
  const ids = {};
  for (const entry of entries) {
    const match = /^alcremie-(.+)-(\w+)-sweet$/.exec(entry.slug);
    if (!match) throw new Error(`Unexpected Alcremie slug: ${entry.slug}`);
    const cream = ALCREMIE_CREAMS.indexOf(match[1]);
    const sweet = ALCREMIE_SWEETS.indexOf(match[2]);
    if (cream === -1) throw new Error(`Unknown Alcremie cream: ${match[1]}`);
    if (sweet === -1) throw new Error(`Unknown Alcremie sweet: ${match[2]}`);
    ids[entry.slug] = `${entry.dex}${formSuffix(cream)}${sweetSuffix(sweet)}`;
  }
  return ids;
}

/**
 * Derive the PokeJungle sprite id for every entry of ONE species, given that species'
 * entries in dataset (sortIndex) order. Returns { [slug]: spriteId }.
 *
 * Throws rather than guessing if a female variant's base form can't be located — a
 * wrong id still returns HTTP 200 (it's just someone else's sprite), so a silent
 * fallback here would be invisible in every check except a human looking at the page.
 */
function derivePokeJungleIds(entries) {
  if (!entries.length) return {};

  const dex = entries[0].dex;
  if (dex === ALCREMIE_DEX) return deriveAlcremieIds(entries);

  const ids = {};
  const mains = entries.filter(e => !e.isGenderVariant);
  mains.forEach((entry, index) => {
    const shifted = dex === PIKACHU_DEX && index >= PIKACHU_RESERVED_INDEX ? index + 1 : index;
    ids[entry.slug] = `${dex}${formSuffix(shifted)}`;
  });

  for (const entry of entries.filter(e => e.isGenderVariant)) {
    // Two shapes of female entry: a sprite expansion, whose pokeapiSlug points at the
    // base form it was expanded from ("venusaur-f" -> "venusaur"); and the 7 species
    // PokeAPI models as separate -male/-female forms, where pokeapiSlug is the female
    // form itself and the counterpart male is the base ("indeedee-female" ->
    // "indeedee-male"). Either way the female reuses its base form's number.
    const base = ids[entry.pokeapiSlug] ?? ids[entry.pokeapiSlug.replace(/-female$/, '-male')];
    if (base === undefined) throw new Error(`No base form for gender variant: ${entry.slug}`);
    ids[entry.slug] = `${base}-f`;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Shiny-only overrides
// ---------------------------------------------------------------------------

// Minior and Alcremie are visually redundant once shiny: the games themselves don't
// distinguish the trait that normally sets their forms apart. Shiny Minior is always
// the same dark core regardless of which color was caught; shiny Alcremie is always
// the same body color, differing only by its 7 decorative sweets, never by cream. So
// PokeJungle (like the games' own box/menu art) only ever produced ONE shiny image per
// case that's actually visually distinct, not one per form — using the per-form
// NORMAL-variant id for these two species' shiny URLs 404s.
//
// Verified live against every id: for dex 0774 (all 7 colors), only bare "0774"
// resolves; for dex 0869 (all 63 cream x sweet combos), only the 7
// "0869"/"0869-1".."0869-6" (sweet only, cream ignored, numeric suffix — NOT the
// lettered "-a".."-f" scheme the normal variant uses) resolve.
const MINIOR_DEX = '0774';

/**
 * The shiny sprite id to use INSTEAD of the entry's normal-variant id, or undefined
 * when the normal id is already correct for shiny too (true for every species except
 * the two above — confirmed live: 1324/1387 shiny ids matched their normal id exactly,
 * and the 62 that didn't were entirely these two families).
 */
function deriveShinyOverrideId(entry) {
  if (entry.dex === MINIOR_DEX) return MINIOR_DEX;
  if (entry.dex === ALCREMIE_DEX) {
    const match = /^alcremie-(?:.+?)-(\w+)-sweet$/.exec(entry.slug);
    if (!match) throw new Error(`Unexpected Alcremie slug: ${entry.slug}`);
    const sweet = ALCREMIE_SWEETS.indexOf(match[1]);
    if (sweet === -1) throw new Error(`Unknown Alcremie sweet: ${match[1]}`);
    return `${ALCREMIE_DEX}${sweet === 0 ? '' : `-${sweet}`}`;
  }
  return undefined;
}

/**
 * Shiny id overrides for a batch of entries (any species mix), as { [slug]: spriteId }
 * — only for entries where the shiny id actually differs from the normal one, so a
 * consumer can fall back to the normal id by default and only special-case the few
 * that need it (matches how the generated dataset stores this: pokejungleShinyId is
 * only set where it disagrees with pokejungleId).
 */
function deriveShinyOverrides(entries) {
  const overrides = {};
  for (const entry of entries) {
    const shinyId = deriveShinyOverrideId(entry);
    if (shinyId !== undefined) overrides[entry.slug] = shinyId;
  }
  return overrides;
}

// ---------------------------------------------------------------------------
// Genuinely shiny-locked entries
// ---------------------------------------------------------------------------

// Distinct from the collapse cases above: these entries have NO shiny art on
// PokeJungle at all — either the site returns a real HTTP 404, or (more dangerously)
// it returns HTTP 200 with the SAME small lock-icon image (128x128px, exactly 2051
// bytes) it uses everywhere a Pokemon's shiny genuinely can't be obtained in-game.
// That 200 defeats a plain "does the request succeed" or even an <img onError> check —
// the request DOES succeed, it just isn't the sprite. Detected instead by fetching
// every entry's shiny URL and flagging that exact byte size (verified zero false
// positives: every real shiny sprite in the dataset has a distinct content-length,
// ranging ~19KB-205KB — nothing else is anywhere near 2051 bytes).
//
// The result lines up with real game mechanics almost perfectly — nearly every one is
// a known shiny-locked Mythical, event-exclusive Legendary, or cosmetic-only form
// (Victini, Magearna, Marshadow, Zarude, Kubfu/Urshifu, Glastrier/Spectrier/Calyrex,
// every Gen 9 DLC "Loyal Three"/Paradox/Ogerpon/Pecharunt/Terapagos, Cosmog/Cosmoem,
// Floette's Eternal Flower, Vivillon's Poke Ball pattern, and every Pikachu cap form
// except Original Cap). Hoopa is the one species split across both failure modes —
// Confined returns the lock icon, Unbound returns a real 404 — included here together
// since both represent the same underlying fact (Hoopa can't be shiny in either forme).
//
// Verified live, 2026-08-27, against every entry's PokeJungle shiny URL.
const SHINY_LOCKED = new Set([
  'pikachu-hoenn-cap', 'pikachu-sinnoh-cap', 'pikachu-unova-cap', 'pikachu-kalos-cap',
  'pikachu-alola-cap', 'pikachu-partner-cap', 'pikachu-world-cap', // NOT pikachu-original-cap
  'victini',
  'vivillon-poke-ball',
  'floette-eternal',
  'hoopa', 'hoopa-unbound',
  'cosmog', 'cosmoem',
  'magearna', 'magearna-original',
  'marshadow',
  'kubfu', 'urshifu-single-strike', 'urshifu-rapid-strike',
  'zarude', 'zarude-dada',
  'glastrier', 'spectrier', 'calyrex',
  'ursaluna-bloodmoon',
  'walking-wake', 'iron-leaves', 'okidogi', 'munkidori', 'fezandipiti',
  'ogerpon', 'gouging-fire', 'raging-bolt', 'iron-boulder', 'iron-crown',
  'terapagos', 'pecharunt',
]);

/** Rebuild a full PokeJungle URL from a derived id + variant name, or null if absent. */
function buildPokeJungleUrl(spriteId, variant = 'normal') {
  if (!spriteId) return null;
  const folder = POKEJUNGLE_VARIANTS[variant];
  if (folder === undefined) throw new Error(`Unknown PokeJungle variant: ${variant}`);
  return `${POKEJUNGLE_BASE_URL}${folder}${spriteId}.png`;
}

module.exports = {
  POKEJUNGLE_BASE_URL,
  POKEJUNGLE_VARIANTS,
  PIKACHU_DEX,
  PIKACHU_RESERVED_INDEX,
  ALCREMIE_DEX,
  ALCREMIE_CREAMS,
  ALCREMIE_SWEETS,
  MINIOR_DEX,
  SHINY_LOCKED,
  derivePokeJungleIds,
  deriveShinyOverrides,
  buildPokeJungleUrl,
};
