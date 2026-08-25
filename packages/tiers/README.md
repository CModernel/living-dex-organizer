# @cmodernel/living-dex-tiers

Curated tier predicates for the [Living Dex Organizer](https://github.com/CModernel/living-dex-organizer)
dataset: `living-form`, `living-lite`, `final-form-full`, and `final-form`. Each
predicate filters `data/v1/living-form-full-data.json`'s entries down to that tier,
including every one-off, per-species curation exception (Tauros breeds, Basculin
stripes, Minior colors, Alcremie flavors, a CSV typo workaround) — logic a generic,
checkbox-driven filter can't reproduce, since it's not expressible as simple boolean
criteria.

These predicates are verified byte-for-byte against Austin John's reference sheets by
`scripts/verify.js` in the parent repo — this package is the single source of truth
for what each tier means, not a reimplementation.

## Usage

```js
const { TIERS, KNOWN_DIVERGENCES } = require('@cmodernel/living-dex-tiers');

const livingLiteEntries = allEntries.filter(TIERS['living-lite'].predicate);
```

A consuming app should install this instead of copy-pasting or reinventing tier
logic — when a curation rule changes upstream, bumping this package's version
carries the fix, rather than needing every consumer to notice and patch
independently.
