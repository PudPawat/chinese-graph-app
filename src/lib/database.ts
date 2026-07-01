import type { HskRange, VocabularyWord } from '../types/vocabulary';
import charactersData from '../data/db/characters.json';
import wordsData from '../data/db/words.json';
import categoriesData from '../data/db/categories.json';
import manifestData from '../data/db/manifest.json';

export interface DbCharacter {
  char: string;
  traditional: string;
  english: string;
  thai: string;
  minHsk: number;
  wordCount: number;
  sampleWordId: string;
  radical: string;
}

export interface DbCategory {
  id: string;
  slug: string;
  kind: 'hsk' | 'radical' | 'character_root' | 'topic' | 'grammar';
  nameEn: string;
  nameTh: string | null;
  parentId: string | null;
  hskLevel: number | null;
  sortOrder: number;
}

export interface DbManifest {
  version: number;
  generatedAt: string;
  source: string;
  counts: {
    words: number;
    characters: number;
    categories: number;
    wordCategoryLinks: number;
    relations: number;
  };
  hskLevels: number[];
  notes: string;
}

const characters = charactersData as DbCharacter[];
const words = wordsData as VocabularyWord[];
const categories = categoriesData as DbCategory[];
const manifest = manifestData as DbManifest;

const charByGlyph = new Map(characters.map((item) => [item.char, item]));

export function getManifest(): DbManifest {
  return manifest;
}

export function getAllWords(): VocabularyWord[] {
  return words;
}

export function getAllCharacters(): DbCharacter[] {
  return characters;
}

export function getCharacter(char: string): DbCharacter | undefined {
  return charByGlyph.get(char);
}

export function getCategories(): DbCategory[] {
  return categories;
}

export function getCategoriesByKind(kind: DbCategory['kind']): DbCategory[] {
  return categories.filter((item) => item.kind === kind);
}

export function getWordsForCharacter(char: string, range: HskRange): VocabularyWord[] {
  return words.filter(
    (word) =>
      word.simplified.startsWith(char) &&
      word.hskLevel >= range.min &&
      word.hskLevel <= range.max,
  );
}

export function getOverviewCharacters(range: HskRange, limit = 96): DbCharacter[] {
  return characters
    .filter((item) => item.minHsk >= range.min && item.minHsk <= range.max)
    .sort((a, b) => a.minHsk - b.minHsk || b.wordCount - a.wordCount)
    .slice(0, limit);
}

export function searchDatabase(query: string): VocabularyWord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return words
    .filter(
      (word) =>
        word.simplified.includes(q) ||
        word.traditional.includes(q) ||
        word.pinyin.toLowerCase().includes(q) ||
        word.english.toLowerCase().includes(q) ||
        (word.thai && word.thai.includes(q)),
    )
    .slice(0, 20);
}

export function truncateGloss(text: string, maxLen = 28): string {
  const clean = text.split(/[;,(]/)[0].trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}
