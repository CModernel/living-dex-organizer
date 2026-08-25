/**
 * Sprite URL derivation for the Living Form Full dataset. Every PokeAPI sprite
 * variant for a given form (front, shiny, female, shiny-female) shares one "sprite
 * id" token under a fixed base path — e.g. Bulbasaur is "1", Alolan Raichu is
 * "10100", Unown B is "201-b", one Alcremie combo is
 * "869-caramel-swirl-berry-sweet" — varying only by a path prefix per variant.
 * Storing that one id + a shared baseUrl/variant map once lets every full URL be
 * rebuilt on demand, instead of repeating ~90-char URLs 4 times per entry (verified:
 * this was ~260KB of the dataset's ~1.15MB before this).
 */

const SPRITE_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

const SPRITE_VARIANTS = {
  front_default: '',
  front_shiny: 'shiny/',
  front_female: 'female/',
  front_shiny_female: 'shiny/female/',
};

/**
 * Extract the shared sprite id token from a raw PokeAPI sprites object (the shape
 * returned by /pokemon/{id} or /pokemon-form/{id}'s `sprites` field). Throws instead
 * of silently guessing if a URL doesn't match the expected PokeAPI shape, or if the
 * id disagrees between variants (which would mean it can't reconstruct every URL
 * correctly) — verified against the full dataset with zero exceptions before this
 * was relied on.
 */
function deriveSpriteId(sprites) {
  let spriteId = null;
  for (const [field, prefix] of Object.entries(SPRITE_VARIANTS)) {
    const url = sprites?.[field];
    if (!url) continue;
    const expected = SPRITE_BASE_URL + prefix;
    if (!url.startsWith(expected) || !url.endsWith('.png')) {
      throw new Error(`Unexpected sprite URL shape for ${field}: ${url}`);
    }
    const id = url.slice(expected.length, -'.png'.length);
    if (spriteId === null) spriteId = id;
    else if (spriteId !== id) {
      throw new Error(`Sprite id mismatch across variants: "${spriteId}" vs "${id}" (${field})`);
    }
  }
  return spriteId;
}

// Whether this form has its own distinct female art, vs. reusing the default sprite.
// Must stay explicit rather than always building the female URL and letting it
// 404 — an empty/absent female variant is a valid, meaningful state, not an error.
//
// hasFemale and hasShinyFemale are tracked separately, not combined into one flag:
// verified against the full dataset, every entry agrees between the two except one
// (Oinkologne has a regular female sprite but no shiny-female one on PokeAPI) — a
// single combined flag would reconstruct a URL for an asset that doesn't exist.
function hasFemaleSprite(sprites) {
  return !!sprites?.front_female;
}

function hasShinyFemaleSprite(sprites) {
  return !!sprites?.front_shiny_female;
}

/** Rebuild a full sprite URL from a derived id + variant name, or null if absent. */
function buildSpriteUrl(spriteId, variant = 'front_default') {
  if (!spriteId) return null;
  const prefix = SPRITE_VARIANTS[variant];
  if (prefix === undefined) throw new Error(`Unknown sprite variant: ${variant}`);
  return SPRITE_BASE_URL + prefix + spriteId + '.png';
}

module.exports = {
  SPRITE_BASE_URL,
  SPRITE_VARIANTS,
  deriveSpriteId,
  hasFemaleSprite,
  hasShinyFemaleSprite,
  buildSpriteUrl,
};
