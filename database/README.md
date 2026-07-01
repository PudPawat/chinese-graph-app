# HanGraph Database

Local vocabulary database for HSK 1–8+ with categories and graph relations.

## Structure

| File / table | Purpose |
|--------------|---------|
| `schema.sql` | SQLite schema (words, characters, categories, relations) |
| `sources.json` | Catalog of external data sources |
| `generated/` | Full export after import (not committed — run `npm run db:build`) |
| `raw/` | Downloaded source JSON caches |

### Tables

- **words** — simplified, traditional, pinyin, english, thai, HSK level, radical, POS
- **characters** — overview sphere nodes with english/thai glosses
- **categories** — HSK levels, radicals, character-root families (`char-打`), topics
- **word_categories** — many-to-many word ↔ category links
- **word_relations** — graph edges (`shared_char`, `compound`, `synonym`, …)

## Build the database

```bash
# Import HSK 3.0 from drkameleon (10,969 words)
npm run db:build

# Merge Thai translations from your Google Sheet CSV
npm run db:build -- --merge-sheet ./my-sheet.csv
```

Output goes to:
- `database/generated/` — full dataset + relations
- `src/data/db/` — app bundle (words, characters, categories)

## External sources

See [`sources.json`](./sources.json). Primary import:

| Source | Words | License |
|--------|-------|---------|
| [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) | HSK 3.0 levels 1–7 (7–9 band) | MIT |
| [krmanik/HSK-3.0-words-list](https://github.com/krmanik/HSK-3.0-words-list) | HSK 1–9 + grammar | Open |
| [ivankra/hsk30](https://github.com/ivankra/hsk30) | 11,092 terms CSV | MIT |
| Your Google Sheet | Custom + Thai column | User-owned |

## HSK level notes

- HSK 3.0 official syllabus groups levels **7–9** into one band → stored as **level 7**
- UI supports **HSK 1–8**; level 8 reserved for custom/future words
- Use **exclusive** wordlists per level (not cumulative) for correct level assignment

## Categories (auto-generated)

- `hsk-1` … `hsk-8` — curriculum levels
- `char-打` — all words starting with 打 (character-root family)
- `radical-扌` — words sharing a Kangxi radical

## Adding Thai translations

1. Add a **Thai** column to your Google Sheet
2. Export as CSV
3. Run: `npm run db:build -- --merge-sheet ./export.csv`

Thai is matched by **Simplified** column. Empty cells keep English-only until filled.
