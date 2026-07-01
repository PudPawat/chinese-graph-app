# HanGraph — Chinese Vocabulary Learning App

Cross-platform Chinese learning app (Web, Android, iOS) built with **Expo + React Native**.

Explore HSK vocabulary as an interactive **character graph**: words that share Chinese characters are connected, so you can discover families like **打扫 → 打算 → 打字 → 打交道** from a root word or character.

## Features

- **3D character overview** — orbit a sphere of root characters with **English + Thai** labels
- **Own vocabulary database** — 10,969 HSK 3.0 words with categories and graph relations
- **Word graph drill-down** — tap a character to explore related vocabulary
- **Vocabulary graph** — nodes are words; edges show shared characters (打, 扫, etc.)
- **HSK 1–8 range filter** — tap level chips to set min/max (e.g. HSK 1–4 or 3–7)
- **Layout direction** — top ↓, bottom ↑, left ←, right →
- **Translations** — Simplified · Traditional · English · Thai
- **Pan & pinch** — drag and zoom the graph on mobile and web
- **Search** — find a root word and rebuild the graph

## Quick start

```bash
npm install
npm run web      # browser
npm run android  # Android (Expo Go or emulator)
npm run ios      # iOS (macOS + simulator or Expo Go)
```

## Import vocabulary from Google Sheets

Your sheet: [HSK Vocabulary Master List](https://docs.google.com/spreadsheets/d/1W2Id7ylps6RS8gZTxAgnnVb-JPocdi2eCUQU65avRC0/edit?usp=sharing)

### Build database from HSK 3.0 (recommended)

```bash
npm run db:build
# With Thai from your sheet CSV:
npm run db:build -- --merge-sheet ./my-sheet.csv
```

Sources: [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT). See `database/README.md` for schema, categories, and more sources.

### Legacy sheet-only import

```bash
npm run import-sheet
```

## Project structure

```
app/                    Expo Router screens
src/
  components/           Graph, HSK picker, word detail
  data/vocabulary.json  Vocabulary database
  lib/graphEngine.ts    Character graph builder + layout
  types/                TypeScript types
scripts/import-sheet.mjs  Google Sheets CSV importer
```

## Tech stack

- Expo SDK 57 + React Native (Web, iOS, Android from one codebase)
- `react-native-svg` — graph rendering
- `dagre` — automatic top/down/left/right layout
- `react-native-gesture-handler` + Reanimated — pan & zoom
