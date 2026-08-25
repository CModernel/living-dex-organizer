/**
 * Tier definitions for the Living Form Full dataset: a predicate per tier (Living
 * Form, Living Lite, Final Form Full, Final Form) that filters the full dataset down
 * to that tier, plus the CSV file each predicate is validated against and any known,
 * user-confirmed divergences from that CSV.
 *
 * This is the reference for what each tier actually means for this project — the
 * source sheets are reference-only, not a runtime dependency (see
 * generate-living-form-full.js's own header comment). scripts/verify.js imports this
 * to validate the predicates against the reference sheets; a future app would import
 * the same predicates to derive its own tier views client-side, instead of
 * reimplementing or copy-pasting this curation logic.
 */

// Expected, accepted divergences (confirmed with the user, 2026-08-24): the sheet keeps
// Floette Eternal Flower in Living Lite; we don't override for it, on the same "one
// representative form is enough at this tier" reasoning applied to Tauros's breeds below.
const KNOWN_DIVERGENCES = {
  'living-lite': ['floette-5'],
  // Final Form Full's own sheet reuses the keyword "hoopa" for both the base and
  // Unbound rows (should be "hoopa-1" for Unbound, as every other tier sheet has it)
  // — a data-entry typo in that CSV, not a real exclusion. We keep Unbound.
  //
  // That sheet also numbers Alcremie's Vanilla-flavor decorations "-1".."-6" instead
  // of the "-a".."-f" scheme every other tier sheet uses (verified 1:1 by form name —
  // Berry/Love/Star/Clover/Flower/Ribbon, same order) — a keyword-labeling difference
  // for this one family, not a content gap.
  'final-form-full': [
    'hoopa-1',
    'alcremie-a', 'alcremie-b', 'alcremie-c', 'alcremie-d', 'alcremie-e', 'alcremie-f',
    'alcremie-1', 'alcremie-2', 'alcremie-3', 'alcremie-4', 'alcremie-5', 'alcremie-6',
  ],
};

const TIERS = {
  'living-form': {
    csv: 'Living Form.csv',
    predicate: e => !e.isGenderVariant,
  },
  'living-lite': {
    // Regional forms are catchable as distinct wild Pokémon, so they survive even in
    // the most minimal tier — only cosmetic/battle-variant alternates are dropped.
    // Two manual-curation exceptions, confirmed with the user (2026-08-24):
    //  - basculin-2 (White Stripe): the only Basculin stripe that evolves into
    //    Basculegion — mechanically significant, not just cosmetic. Kept.
    //  - tauros-2/-3 (Blaze/Aqua Breed): same reclassification as tauros-1 (Combat
    //    Breed), just a different cosmetic "flavor" — like Alcremie/Vivillon, one
    //    representative is enough at the minimal tier. Dropped.
    // Floette Eternal Flower is deliberately NOT overridden: same reasoning as
    // Tauros (one Floette color represents the species at this tier) applies to it.
    csv: 'Living Lite.csv',
    predicate: e => {
      if (e.csvKeyword === 'basculin-2') return true;
      if (e.csvKeyword === 'tauros-2' || e.csvKeyword === 'tauros-3') return false;
      return !e.isGenderVariant && (!e.isAlternateForm || e.isRegionalForm);
    },
  },
  'final-form-full': {
    // Three manual-curation exceptions, confirmed with the user (2026-08-24):
    //  - Minior: core color is random on capture, not a distinct catchable variety
    //    (like Spinda's spots) — collapse to 1.
    //  - Magearna: "Original Pokéball" is a rare event recolor, same reasoning as
    //    Floette Eternal Flower — not required even at this tier.
    //  - Alcremie: only the Vanilla flavor's 7 decorations represent the species;
    //    the other 8 flavors don't add completion value at this tier.
    csv: 'Final Form Full.csv',
    predicate: e => {
      if (e.dex === '0774' && e.isAlternateForm) return false; // Minior colors
      if (e.csvKeyword === 'magearna-1') return false; // Original Pokéball
      if (e.dex === '0869' && !['alcremie', 'alcremie-a', 'alcremie-b', 'alcremie-c',
          'alcremie-d', 'alcremie-e', 'alcremie-f'].includes(e.csvKeyword)) return false;
      return !e.isGenderVariant && e.evolutionStage === 'final';
    },
  },
  'final-form': {
    // Same regional-inclusive rule as Living Lite (regional forms are distinct catchable
    // Pokémon even at the minimal tier), restricted to final-evolution-stage species.
    // Three manual-curation exceptions, confirmed with the user (2026-08-24):
    //  - tauros-2/-3 (Blaze/Aqua Breed): same "one representative flavor" reasoning as
    //    Living Lite.
    //  - floette-5 (Eternal Flower): the *opposite* of Living Lite's treatment — regular
    //    Floette evolves into Florges (kept separately, already 'mid' so excluded here
    //    by default), so Eternal Flower — the one color that can't evolve — is the only
    //    Floette entry that belongs in Final Form, same pattern as Farfetch'd/Mr. Mime
    //    keeping their non-evolving Kantonian/original form alongside the evolved one.
    //  - Basculin (all 3 stripes) is dropped entirely, keeping only Basculegion — a
    //    one-off curation choice; the sheet treats Basculin differently in every one of
    //    its 5 tiers (Full keeps Red+Blue, Lite keeps Red+White, this one keeps none),
    //    not something derivable from evolution stage or region.
    csv: 'Final Form.csv',
    predicate: e => {
      if (e.csvKeyword === 'tauros-2' || e.csvKeyword === 'tauros-3') return false;
      if (e.csvKeyword === 'basculin') return false;
      if (e.csvKeyword === 'floette-5') return true;
      return !e.isGenderVariant && e.evolutionStage === 'final' && (!e.isAlternateForm || e.isRegionalForm);
    },
  },
};

module.exports = { TIERS, KNOWN_DIVERGENCES };
