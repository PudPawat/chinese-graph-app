import type { NavDirection, DirectionalNav, NavSlot, VocabularyGraph, VocabularyWord } from '../types/vocabulary';
import { extractChineseChars, getSharedCharacters, scoreRelatedWord } from './graphEngine';

const DIRECTIONS: NavDirection[] = ['up', 'down', 'left', 'right'];

function emptyNav(): DirectionalNav {
  return { up: null, down: null, left: null, right: null };
}

function angleToDirection(dx: number, dy: number): NavDirection {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle >= -45 && angle < 45) return 'right';
  if (angle >= 45 && angle < 135) return 'down';
  if (angle >= -135 && angle < -45) return 'up';
  return 'left';
}

function nodeCenter(node: { x: number; y: number; width: number; height: number }) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function assignFromGraph(
  current: VocabularyWord,
  graph: VocabularyGraph,
): { nav: DirectionalNav; usedIds: Set<string> } {
  const nav = emptyNav();
  const usedIds = new Set<string>([current.id]);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const center = nodeById.get(current.id);
  if (!center) return { nav, usedIds };

  const cc = nodeCenter(center);
  const bestDist: Partial<Record<NavDirection, number>> = {};

  for (const edge of graph.edges) {
    if (edge.source !== current.id && edge.target !== current.id) continue;

    const neighborId = edge.source === current.id ? edge.target : edge.source;
    const neighbor = nodeById.get(neighborId);
    if (!neighbor) continue;

    const nc = nodeCenter(neighbor);
    const dx = nc.x - cc.x;
    const dy = nc.y - cc.y;
    const dir = angleToDirection(dx, dy);
    const dist = dx * dx + dy * dy;

    if (bestDist[dir] !== undefined && bestDist[dir]! <= dist) continue;

    bestDist[dir] = dist;
    nav[dir] = {
      word: neighbor.word,
      sharedChar: edge.sharedChar,
    };
    usedIds.add(neighborId);
  }

  return { nav, usedIds };
}

function sharedLabel(a: VocabularyWord, b: VocabularyWord): string {
  return getSharedCharacters(a.simplified, b.simplified)[0] ?? '';
}

function pickByHeuristic(
  dir: NavDirection,
  current: VocabularyWord,
  candidates: VocabularyWord[],
): VocabularyWord | null {
  const currentChars = extractChineseChars(current.simplified);

  const scored = candidates
    .map((word) => {
      const shared = getSharedCharacters(current.simplified, word.simplified);
      const wordChars = extractChineseChars(word.simplified);
      let bias = scoreRelatedWord(current, word);

      if (dir === 'up') {
        if (wordChars[0] === currentChars[0]) bias += 20;
        bias += (current.simplified.length - word.simplified.length) * 3;
        bias += (current.hskLevel - word.hskLevel) * 2;
      } else if (dir === 'down') {
        if (wordChars[0] === currentChars[0]) bias += 20;
        bias += (word.simplified.length - current.simplified.length) * 3;
        bias += (word.hskLevel - current.hskLevel) * 2;
      } else if (dir === 'left') {
        if (wordChars[wordChars.length - 1] === currentChars[currentChars.length - 1]) bias += 30;
        bias += shared.length * 5;
      } else if (dir === 'right') {
        if (wordChars[0] === currentChars[0] && word.simplified.length !== current.simplified.length) {
          bias += 25;
        }
        bias += shared.length * 5;
      }

      return { word, bias };
    })
    .sort((a, b) => b.bias - a.bias);

  return scored[0]?.word ?? null;
}

function fillEmptySlots(
  nav: DirectionalNav,
  usedIds: Set<string>,
  current: VocabularyWord,
  pool: VocabularyWord[],
): DirectionalNav {
  const candidates = pool
    .filter((word) => word.id !== current.id && !usedIds.has(word.id))
    .filter((word) => getSharedCharacters(current.simplified, word.simplified).length > 0);

  const result = { ...nav };

  for (const dir of DIRECTIONS) {
    if (result[dir]) continue;
    const picked = pickByHeuristic(dir, current, candidates.filter((w) => !usedIds.has(w.id)));
    if (!picked) continue;

    result[dir] = {
      word: picked,
      sharedChar: sharedLabel(current, picked),
    };
    usedIds.add(picked.id);
  }

  return result;
}

export function getRelatedPool(current: VocabularyWord, pool: VocabularyWord[]): VocabularyWord[] {
  return pool
    .filter(
      (word) =>
        word.id !== current.id &&
        getSharedCharacters(current.simplified, word.simplified).length > 0,
    )
    .sort((a, b) => scoreRelatedWord(current, b) - scoreRelatedWord(current, a));
}

export function buildDirectionalNav(
  current: VocabularyWord,
  pool: VocabularyWord[],
  graph: VocabularyGraph | null,
): DirectionalNav {
  let nav = emptyNav();
  let usedIds = new Set<string>([current.id]);

  if (graph?.nodes.some((node) => node.id === current.id)) {
    const fromGraph = assignFromGraph(current, graph);
    nav = fromGraph.nav;
    usedIds = fromGraph.usedIds;
  }

  return fillEmptySlots(nav, usedIds, current, pool);
}

export function directionFromSwipe(dx: number, dy: number, threshold = 48): NavDirection | null {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

export function getNeighborInDirection(nav: DirectionalNav, dir: NavDirection): NavSlot | null {
  return nav[dir];
}

export const DIRECTION_ARROWS: Record<NavDirection, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

export const OPPOSITE_DIRECTION: Record<NavDirection, NavDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};
