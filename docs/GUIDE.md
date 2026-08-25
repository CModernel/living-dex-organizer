# Living Form Full Guide

Guide for building the Living Form Full entries from PokéAPI.

> This guide documents the original strategy and inclusion/exclusion rules. The actual
> implementation (`scripts/generate-living-form-full.js`) is the source of truth for
> current behavior: on top of these rules, it applies a row-by-row 1:1 mapping against
> the source sheet plus a number of manually-curated exceptions (confirmed with the
> user) documented as comments in that script and in `scripts/verify.js`.

## Endpoints

- `/pokemon-species/?limit=2000`
- `/pokemon/?limit=2000`
- `/pokemon-form/?limit=2000`
- `/pokemon/{id}/`
- `/pokemon-form/{id}/`

## Strategy

Download the full catalog and apply our own LivingForm rules layer. Don't assume every
`PokemonForm` is an entry.

## Include

- Species #001–#1013
- Alolan, Galarian, Hisuian, and Paldean regional forms
- Regional pre-evolutions
- Required permanent forms
- Unown A–Z, ! and ? (28)
- Vivillon (20 patterns)
- Flabébé (5 colors)
- Floette (5 colors + Eternal)
- Florges (5 colors)
- Furfrou (10 trims)
- Alcremie (63 combinations)
- Gender differences only when the sprite actually changes

## Exclude

- Mega Evolutions
- Gigantamax
- Dynamax
- Terastal
- Primal Reversion
- Ultra Burst / Ultra Necrozma
- Arceus by type
- Silvally by type
- Genesect Drives
- Zacian Crowned
- Zamazenta Crowned
- Pikachu Caps
- Other temporary battle states

## Initial exclusion rules

```python
def is_excluded_form(form):
    name = form["name"]

    if form["is_mega"]:
        return True
    if "-gmax" in name:
        return True
    if name.endswith("-primal"):
        return True
    if name == "necrozma-ultra":
        return True
    if name.startswith("arceus-"):
        return True
    if name.startswith("silvally-"):
        return True
    if name in {"genesect-douse", "genesect-shock", "genesect-burn", "genesect-chill"}:
        return True
    if name in {"zacian-crowned", "zamazenta-crowned"}:
        return True
    if name.startswith("pikachu-") and "cap" in name:
        return True
    return False
```

## Gender

`PokemonSpecies.has_gender_differences` identifies candidates. The female entry is only
created if a relevant female sprite actually exists.

```python
sprites = pokemon["sprites"]
has_female_sprite = any([
    sprites.get("front_female"),
    sprites.get("back_female"),
    sprites.get("front_shiny_female"),
    sprites.get("back_shiny_female"),
])
```

Gender is not another `/pokemon/` resource; it's a variant of our own entry that reuses
the same Pokémon plus the female sprite.

## Architecture

```text
PokéAPI
  ↓
Raw Pokémon Catalog
  ↓
LivingForm Rules
  ↓
LivingForm JSON
  ↓
~1387 entries
```

## Validation

The final entry count is **not a fixed constant**: it comes from mapping each row of the
source sheet (`sheets/Living Form Full.csv`) 1:1 against a PokéAPI candidate, plus a
handful of manually-curated exceptions confirmed with the user (see comments in
`generate-living-form-full.js` — e.g. Minior, Alcremie, Basculin, Floette Eternal
Flower). At the time of writing the result is **1387 entries**.

Instead of asserting against an expected number, the pipeline actively reports `EXTRA`
and `MISSING`:

- `scripts/generate-living-form-full.js` writes `data/living-form-full-mapping-report.json`
  with the unmatched rows and orphan candidates from each run.
- `scripts/verify.js` compares the generated dataset against the 5 reference sheets
  (Living Form Full, Living Form, Living Lite, Final Form Full, Final Form) and reports
  any `EXTRA`/`MISSING` outside the already-accepted divergences.

If the total changes (because PokéAPI added species/forms, or the source sheet was
updated), don't hand-tune a magic number: run both scripts and review their reports.

## Final rule

PokéAPI provides candidates; the LivingForm rules decide what's included, what's
excluded, and which special variants get expanded.
