#!/usr/bin/env node
/**
 * Import HSK vocabulary from Google Sheets CSV export.
 *
 * Usage:
 *   node scripts/import-sheet.mjs [csv-path-or-url]
 *
 * Default URL (sheet must be shared as "Anyone with the link can view"):
 *   https://docs.google.com/spreadsheets/d/1W2Id7ylps6RS8gZTxAgnnVb-JPocdi2eCUQU65avRC0/export?format=csv
 *
 * Expected columns:
 *   Simplified | Traditional | Pinyin | English Translation | HSK Level | Thai (optional)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_URL =
  'https://docs.google.com/spreadsheets/d/1W2Id7ylps6RS8gZTxAgnnVb-JPocdi2eCUQU65avRC0/export?format=csv';
const OUTPUT = path.join(__dirname, '../src/data/vocabulary.json');

function parseHskLevel(raw) {
  const match = String(raw ?? '').match(/(\d+)/);
  return match ? Math.min(8, Math.max(1, Number(match[1]))) : 1;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field.trim());
      field = '';
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

function rowsToVocabulary(rows) {
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.toLowerCase());
  const idx = {
    simplified: header.findIndex((h) => h.includes('simplified')),
    traditional: header.findIndex((h) => h.includes('traditional')),
    pinyin: header.findIndex((h) => h.includes('pinyin')),
    english: header.findIndex((h) => h.includes('english')),
    hsk: header.findIndex((h) => h.includes('hsk')),
    thai: header.findIndex((h) => h.includes('thai') || h.includes('ภาษาไทย')),
  };

  const words = [];

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    const simplified = cells[idx.simplified] ?? cells[0];
    if (!simplified || simplified.toLowerCase() === 'simplified') continue;

    words.push({
      id: simplified,
      simplified,
      traditional: cells[idx.traditional] ?? simplified,
      pinyin: cells[idx.pinyin] ?? '',
      english: cells[idx.english] ?? '',
      thai: idx.thai >= 0 ? (cells[idx.thai] ?? '') : '',
      hskLevel: parseHskLevel(cells[idx.hsk]),
    });
  }

  return words;
}

async function loadCsv(source) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch sheet (${res.status}). Share the sheet publicly or pass a local CSV path.`);
    }
    return res.text();
  }
  return fs.readFileSync(source, 'utf8');
}

async function main() {
  const source = process.argv[2] ?? DEFAULT_URL;
  console.log(`Importing from: ${source}`);

  const csv = await loadCsv(source);
  const rows = parseCsv(csv);
  const words = rowsToVocabulary(rows);

  if (words.length === 0) {
    throw new Error('No vocabulary rows found. Check CSV format and sharing settings.');
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(words, null, 2)}\n`);
  console.log(`Wrote ${words.length} words to ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
