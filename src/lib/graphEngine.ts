import dagre from 'dagre';
import type {
  GraphEdge,
  GraphNode,
  HskRange,
  VocabularyGraph,
  VocabularyWord,
} from '../types/vocabulary';

const NODE_WIDTH = 128;
const NODE_HEIGHT = 64;
export const WORDS_PER_GRAPH_PAGE = 8;
export const INITIAL_WORD_BATCH = 100;
export const LOAD_MORE_WORD_BATCH = 100;
export const DEFAULT_GRAPH_ZOOM = 1.85;

function isChineseChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

export function extractChineseChars(text: string): string[] {
  return [...text].filter(isChineseChar);
}

export function getSharedCharacters(a: string, b: string): string[] {
  const charsB = new Set(extractChineseChars(b));
  return [...new Set(extractChineseChars(a))].filter((char) => charsB.has(char));
}

export function filterByHskRange(words: VocabularyWord[], range: HskRange): VocabularyWord[] {
  return words.filter((word) => word.hskLevel >= range.min && word.hskLevel <= range.max);
}

export function searchWords(words: VocabularyWord[], query: string): VocabularyWord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return words.filter(
    (word) =>
      word.simplified.includes(q) ||
      word.traditional.includes(q) ||
      word.pinyin.toLowerCase().includes(q) ||
      word.english.toLowerCase().includes(q) ||
      word.thai.includes(q),
  );
}

function findRootWord(words: VocabularyWord[], rootQuery: string): VocabularyWord | undefined {
  const q = rootQuery.trim();
  if (!q) return words[0];

  return (
    words.find((word) => word.simplified === q || word.traditional === q) ??
    words.find((word) => word.simplified.includes(q) || word.traditional.includes(q)) ??
    words.find((word) => extractChineseChars(word.simplified).includes(q))
  );
}

export function scoreRelatedWord(root: VocabularyWord, candidate: VocabularyWord): number {
  if (root.id === candidate.id) return Number.MAX_SAFE_INTEGER;

  const shared = getSharedCharacters(root.simplified, candidate.simplified);
  if (shared.length === 0) return 0;

  const rootChars = extractChineseChars(root.simplified);
  let positionBonus = 0;

  for (const char of shared) {
    const rootIndex = rootChars.indexOf(char);
    const candidateIndex = extractChineseChars(candidate.simplified).indexOf(char);
    if (rootIndex === candidateIndex) positionBonus += 2;
    if (rootIndex === 0 || candidateIndex === 0) positionBonus += 1;
  }

  return shared.length * 10 + positionBonus - Math.abs(root.simplified.length - candidate.simplified.length);
}

function buildEdges(words: VocabularyWord[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < words.length; i += 1) {
    for (let j = i + 1; j < words.length; j += 1) {
      const shared = getSharedCharacters(words[i].simplified, words[j].simplified);
      if (shared.length === 0) continue;

      const key = [words[i].id, words[j].id].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({
        id: key,
        source: words[i].id,
        target: words[j].id,
        sharedChar: shared[0],
      });
    }
  }

  return edges;
}

function layoutGraph(
  words: VocabularyWord[],
  edges: GraphEdge[],
  rootId: string,
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB',
): GraphNode[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: 48,
    ranksep: 72,
    marginx: 32,
    marginy: 32,
  });

  for (const word of words) {
    graph.setNode(word.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return words.map((word) => {
    const node = graph.node(word.id);
    return {
      id: word.id,
      word,
      x: node.x - NODE_WIDTH / 2,
      y: node.y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });
}

export function rankWordsForRoot(
  pool: VocabularyWord[],
  range: HskRange,
  rootQuery: string,
  preferTwoChar = true,
): VocabularyWord[] {
  const filtered = filterByHskRange(pool, range);
  if (filtered.length === 0) return [];

  const root = findRootWord(filtered, rootQuery) ?? filtered[0];

  return [...filtered].sort((a, b) => {
    const scoreA =
      scoreRelatedWord(root, a) +
      (preferTwoChar && a.simplified.length === 2 ? 8 : 0) +
      (a.simplified.startsWith(root.simplified[0] ?? rootQuery) ? 4 : 0);
    const scoreB =
      scoreRelatedWord(root, b) +
      (preferTwoChar && b.simplified.length === 2 ? 8 : 0) +
      (b.simplified.startsWith(root.simplified[0] ?? rootQuery) ? 4 : 0);
    return scoreB - scoreA;
  });
}

export function totalWordPages(count: number, pageSize = WORDS_PER_GRAPH_PAGE): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function buildVocabularyGraphPage(
  pool: VocabularyWord[],
  range: HskRange,
  rootQuery: string,
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB',
  pageIndex = 0,
  pageSize = WORDS_PER_GRAPH_PAGE,
  maxLoaded?: number,
): VocabularyGraph | null {
  const ranked = rankWordsForRoot(pool, range, rootQuery);
  const limited = maxLoaded != null ? ranked.slice(0, maxLoaded) : ranked;
  const start = pageIndex * pageSize;
  const pageWords = limited.slice(start, start + pageSize);
  if (pageWords.length === 0) return null;

  const root =
    pageWords.find((word) => word.simplified === rootQuery || word.simplified.includes(rootQuery)) ??
    pageWords[0];

  const edges = buildEdges(pageWords);
  const nodes = layoutGraph(pageWords, edges, root.id, direction);

  return { nodes, edges, rootId: root.id };
}

export function buildVocabularyGraph(
  allWords: VocabularyWord[],
  range: HskRange,
  rootQuery: string,
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB',
): VocabularyGraph | null {
  return buildVocabularyGraphPage(allWords, range, rootQuery, direction, 0, WORDS_PER_GRAPH_PAGE);
}

export function getGraphBounds(nodes: GraphNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const HSK_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
  6: '#dc2626',
  7: '#9333ea',
  8: '#7c3aed',
};
