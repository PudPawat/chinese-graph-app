#!/usr/bin/env node
/**
 * Import HSK 3.0 vocabulary from drkameleon/complete-hsk-vocabulary
 * into HanGraph database JSON bundles.
 *
 * Usage: node scripts/import-hsk.mjs [--merge-sheet path.csv]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'database/raw');
const OUT_DIR = path.join(ROOT, 'database/generated');
const APP_DIR = path.join(ROOT, 'src/data/db');

const SOURCE_ID = 'drkameleon-hsk3';
const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7];
const BASE_URL =
  'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive/new';

function slugify(simplified, pinyin) {
  return `${simplified}::${pinyin.replace(/\s+/g, '-')}`;
}

function isChineseChar(char) {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

function extractChars(text) {
  return [...text].filter(isChineseChar);
}

function parseEntry(entry, hskLevel) {
  const form = entry.f?.[0];
  if (!form) return null;

  const simplified = entry.s?.trim();
  const traditional = form.t?.trim() || simplified;
  const pinyin = form.i?.y?.trim() || '';
  const pinyinNumbered = form.i?.n?.trim() || '';
  const english = (form.m?.[0] || '').trim();
  if (!simplified || !english) return null;

  return {
    id: slugify(simplified, pinyin || 'default'),
    simplified,
    traditional,
    pinyin,
    pinyinNumbered,
    english,
    thai: '',
    hskLevel,
    radical: entry.r || '',
    pos: Array.isArray(entry.p) ? entry.p.join(',') : '',
    frequencyRank: entry.q ?? null,
    sourceId: SOURCE_ID,
  };
}

async function loadLevel(level) {
  const localPath = path.join(RAW_DIR, `hsk3-exclusive-${level}.json`);
  let text;

  if (fs.existsSync(localPath)) {
    text = fs.readFileSync(localPath, 'utf8');
  } else {
    const res = await fetch(`${BASE_URL}/${level}.min.json`);
    if (!res.ok) throw new Error(`Failed to fetch HSK level ${level}`);
    text = await res.text();
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(localPath, text);
  }

  return JSON.parse(text);
}

function parseCsvThaiMap(csvText) {
  const map = new Map();
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && csvText[i + 1] === '\n') i += 1;
      row.push(field.trim());
      field = '';
      if (row.some((c) => c)) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field.trim());
    if (row.some((c) => c)) rows.push(row);
  }

  if (rows.length < 2) return map;

  const header = rows[0].map((h) => h.toLowerCase());
  const simpIdx = header.findIndex((h) => h.includes('simplified'));
  const thaiIdx = header.findIndex((h) => h.includes('thai') || h.includes('ภาษา'));

  if (simpIdx < 0 || thaiIdx < 0) return map;

  for (let i = 1; i < rows.length; i += 1) {
    const simplified = rows[i][simpIdx];
    const thai = rows[i][thaiIdx];
    if (simplified && thai) map.set(simplified, thai);
  }

  return map;
}

function mergeThaiTranslations(words, thaiMap) {
  if (thaiMap.size === 0) return words;
  return words.map((word) => {
    const thai = thaiMap.get(word.simplified);
    return thai ? { ...word, thai } : word;
  });
}

function buildCategories() {
  const categories = [];
  for (let level = 1; level <= 8; level += 1) {
    categories.push({
      id: `hsk-${level}`,
      slug: `hsk-${level}`,
      kind: 'hsk',
      nameEn: `HSK ${level}`,
      nameTh: `HSK ${level}`,
      parentId: null,
      hskLevel: level,
      sortOrder: level,
    });
  }
  return categories;
}

function buildCharacters(words) {
  const charMap = new Map();

  for (const word of words) {
    const chars = extractChars(word.simplified);
    if (chars.length === 0) continue;

    const firstChar = chars[0];
    const existing = charMap.get(firstChar);

    if (existing) {
      existing.wordCount += 1;
      existing.minHsk = Math.min(existing.minHsk, word.hskLevel);
      if (word.hskLevel < existing.sampleHsk) {
        existing.sampleWordId = word.id;
        existing.sampleHsk = word.hskLevel;
        existing.english = word.simplified.length === 1 ? word.english : existing.english;
      }
      if (word.simplified.length === 1 && !existing.standaloneEnglish) {
        existing.standaloneEnglish = word.english;
        existing.standaloneThai = word.thai;
        existing.traditional = word.traditional;
        existing.radical = word.radical;
      }
      if (word.thai && !existing.thai) existing.thai = word.thai;
    } else {
      charMap.set(firstChar, {
        char: firstChar,
        traditional: word.simplified.length === 1 ? word.traditional : firstChar,
        english: word.simplified.length === 1 ? word.english : word.english.split(/[;,(]/)[0].trim(),
        thai: word.simplified.length === 1 ? word.thai : word.thai,
        minHsk: word.hskLevel,
        wordCount: 1,
        sampleWordId: word.id,
        sampleHsk: word.hskLevel,
        radical: word.radical,
        standaloneEnglish: word.simplified.length === 1 ? word.english : null,
        standaloneThai: word.simplified.length === 1 ? word.thai : null,
      });
    }
  }

  return [...charMap.values()]
    .map(({ standaloneEnglish, standaloneThai, sampleHsk, ...rest }) => ({
      ...rest,
      english: standaloneEnglish || rest.english,
      thai: standaloneThai || rest.thai || '',
    }))
    .map((item) => {
      const related = words
        .filter((w) => w.simplified.startsWith(item.char))
        .sort((a, b) => a.hskLevel - b.hskLevel || a.simplified.length - b.simplified.length);
      const best = related.find((w) => w.simplified.length > 1) ?? related[0];
      if (!best) return item;

      const primary = best.english.split(/[;,(]/)[0].trim();
      const english =
        best.simplified === item.char
          ? best.english.split(';')[0].trim()
          : `${item.char} — ${primary}`;

      return {
        ...item,
        english,
        minHsk: Math.min(item.minHsk, ...related.map((w) => w.hskLevel)),
        wordCount: related.length,
        sampleWordId: best.id,
      };
    })
    .sort((a, b) => a.minHsk - b.minHsk || b.wordCount - a.wordCount);
}

function buildWordCategories(words, characters) {
  const links = [];

  for (const word of words) {
    links.push({ wordId: word.id, categoryId: `hsk-${Math.min(8, word.hskLevel)}` });

    const firstChar = extractChars(word.simplified)[0];
    if (firstChar) {
      links.push({ wordId: word.id, categoryId: `char-${firstChar}` });
    }

    if (word.radical) {
      links.push({ wordId: word.id, categoryId: `radical-${word.radical}` });
    }
  }

  const categories = buildCategories();
  const charCategories = characters.map((item) => ({
    id: `char-${item.char}`,
    slug: `char-${item.char}`,
    kind: 'character_root',
    nameEn: `${item.char} family (${item.wordCount} words)`,
    nameTh: item.thai ? `${item.char} (${item.thai})` : `${item.char}`,
    parentId: `hsk-${Math.min(8, item.minHsk)}`,
    hskLevel: item.minHsk,
    sortOrder: item.minHsk * 1000 + item.wordCount,
  }));

  const radicalSet = new Set(words.map((w) => w.radical).filter(Boolean));
  const radicalCategories = [...radicalSet].map((radical) => ({
    id: `radical-${radical}`,
    slug: `radical-${radical}`,
    kind: 'radical',
    nameEn: `Radical ${radical}`,
    nameTh: `部首 ${radical}`,
    parentId: null,
    hskLevel: null,
    sortOrder: 0,
  }));

  return {
    categories: [...categories, ...charCategories, ...radicalCategories],
    links,
  };
}

function buildSharedCharRelations(words, limitPerWord = 12) {
  const charToWords = new Map();

  for (const word of words) {
    for (const char of new Set(extractChars(word.simplified))) {
      if (!charToWords.has(char)) charToWords.set(char, []);
      charToWords.get(char).push(word.id);
    }
  }

  const relations = [];
  const seen = new Set();

  for (const word of words) {
    const related = new Set();
    for (const char of extractChars(word.simplified)) {
      for (const otherId of charToWords.get(char) || []) {
        if (otherId === word.id) continue;
        related.add(otherId);
      }
    }

    let count = 0;
    for (const targetId of related) {
      if (count >= limitPerWord) break;
      const key = [word.id, targetId].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);
      relations.push({
        id: key,
        sourceWordId: word.id,
        targetWordId: targetId,
        relationType: 'shared_char',
        label: '',
        weight: 1,
      });
      count += 1;
    }
  }

  return relations;
}

function toAppWord(word) {
  return {
    id: word.id,
    simplified: word.simplified,
    traditional: word.traditional,
    pinyin: word.pinyin,
    english: word.english,
    thai: word.thai,
    hskLevel: word.hskLevel,
    radical: word.radical,
    pos: word.pos,
  };
}

async function main() {
  const sheetArg = process.argv.indexOf('--merge-sheet');
  const sheetPath = sheetArg >= 0 ? process.argv[sheetArg + 1] : null;

  console.log('Importing HSK 3.0 vocabulary…');
  const wordMap = new Map();

  for (const level of HSK_LEVELS) {
    const entries = await loadLevel(level);
    let count = 0;
    for (const entry of entries) {
      const parsed = parseEntry(entry, level);
      if (!parsed) continue;
      wordMap.set(parsed.id, parsed);
      count += 1;
    }
    console.log(`  HSK ${level}: ${count} words`);
  }

  let words = [...wordMap.values()].sort((a, b) => a.hskLevel - b.hskLevel || a.simplified.localeCompare(b.simplified));

  if (sheetPath && fs.existsSync(sheetPath)) {
    const thaiMap = parseCsvThaiMap(fs.readFileSync(sheetPath, 'utf8'));
    words = mergeThaiTranslations(words, thaiMap);
    console.log(`  Merged ${thaiMap.size} Thai entries from sheet`);
  }

  const characters = buildCharacters(words);
  const { categories, links: wordCategoryLinks } = buildWordCategories(words, characters);
  const relations = buildSharedCharRelations(words);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: SOURCE_ID,
    counts: {
      words: words.length,
      characters: characters.length,
      categories: categories.length,
      wordCategoryLinks: wordCategoryLinks.length,
      relations: relations.length,
    },
    hskLevels: [1, 2, 3, 4, 5, 6, 7, 8],
    notes: 'HSK 3.0 levels 7-9 are stored as level 7. Level 8 reserved for future/custom words.',
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(APP_DIR, { recursive: true });

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, 'words.json'), `${JSON.stringify(words, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, 'characters.json'), `${JSON.stringify(characters, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, 'categories.json'), `${JSON.stringify(categories, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, 'word_categories.json'), `${JSON.stringify(wordCategoryLinks, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, 'relations.json'), `${JSON.stringify(relations, null, 2)}\n`);

  // Compact app bundle (words + characters + categories only)
  fs.writeFileSync(path.join(APP_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(APP_DIR, 'words.json'), `${JSON.stringify(words.map(toAppWord))}\n`);
  fs.writeFileSync(path.join(APP_DIR, 'characters.json'), `${JSON.stringify(characters)}\n`);
  fs.writeFileSync(path.join(APP_DIR, 'categories.json'), `${JSON.stringify(categories)}\n`);

  // Legacy compatibility for existing imports
  fs.writeFileSync(
    path.join(ROOT, 'src/data/vocabulary.json'),
    `${JSON.stringify(words.map(toAppWord), null, 2)}\n`,
  );

  console.log(`\nDone. ${words.length} words, ${characters.length} characters, ${categories.length} categories`);
  console.log(`Output: ${OUT_DIR}`);
  console.log(`App bundle: ${APP_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
