import type { HskRange, OverviewCharacter, ProjectedCharacter, SphereRotation } from '../types/vocabulary';
import type { DbCharacter } from './database';
import { truncateGloss } from './database';
import { HSK_COLORS } from './graphEngine';

export const INITIAL_CHAR_BATCH = 100;
export const LOAD_MORE_BATCH = 100;
export const DEFAULT_SPHERE_ZOOM = 1.35 * 1.2;
export const SPHERE_GLOBE_RADIUS = 108 * 1.2;
export const SPHERE_SPREAD = 118 * 1.2;

const SPHERE_RADIUS = 1;

export function getSortedCharactersForRange(
  characters: DbCharacter[],
  range: HskRange,
  wordCountInRange: Map<string, number>,
): DbCharacter[] {
  return characters
    .filter((item) => (wordCountInRange.get(item.char) ?? 0) > 0)
    .sort(
      (a, b) =>
        a.minHsk - b.minHsk ||
        (wordCountInRange.get(b.char) ?? 0) - (wordCountInRange.get(a.char) ?? 0),
    );
}

/** Evenly distribute up to 100+ nodes on a full sphere (orbit to see all). */
function fibonacciSphere(count: number): Array<{ x: number; y: number; z: number }> {
  if (count === 0) return [];
  if (count === 1) return [{ x: 0, y: 0, z: SPHERE_RADIUS }];

  const points: Array<{ x: number; y: number; z: number }> = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const inclination = Math.acos(1 - 2 * t);
    const azimuth = (2 * Math.PI * i) / goldenRatio;

    points.push({
      x: SPHERE_RADIUS * Math.sin(inclination) * Math.cos(azimuth),
      y: SPHERE_RADIUS * Math.sin(inclination) * Math.sin(azimuth),
      z: SPHERE_RADIUS * Math.cos(inclination),
    });
  }

  return points;
}

export function dbCharactersToOverviewSphere(
  sorted: DbCharacter[],
  wordCountInRange: Map<string, number>,
  loadedCount: number,
): OverviewCharacter[] {
  const slice = sorted.slice(0, loadedCount);
  const positions = fibonacciSphere(slice.length);

  return slice.map((item, index) => ({
    char: item.char,
    wordCount: wordCountInRange.get(item.char) ?? item.wordCount,
    minHsk: item.minHsk,
    sampleWord: item.sampleWordId.split('::')[0],
    english: item.english,
    thai: item.thai,
    ...positions[index],
  }));
}

function rotatePoint(
  point: { x: number; y: number; z: number },
  rotation: SphereRotation,
): { x: number; y: number; z: number } {
  const cosY = Math.cos(rotation.yaw);
  const sinY = Math.sin(rotation.yaw);
  const cosX = Math.cos(rotation.pitch);
  const sinX = Math.sin(rotation.pitch);

  const x1 = point.x * cosY + point.z * sinY;
  const z1 = -point.x * sinY + point.z * cosY;

  const y2 = point.y * cosX - z1 * sinX;
  const z2 = point.y * sinX + z1 * cosX;

  return { x: x1, y: y2, z: z2 };
}

function cardScaleForCount(count: number): number {
  if (count <= 12) return 1;
  if (count <= 30) return 0.82;
  if (count <= 60) return 0.68;
  return 0.55;
}

export function projectCharacters(
  characters: OverviewCharacter[],
  rotation: SphereRotation,
  viewport: { width: number; height: number },
  zoom: number,
): ProjectedCharacter[] {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const focal = 320 / zoom;
  const densityScale = cardScaleForCount(characters.length);
  const spread = SPHERE_SPREAD * densityScale;

  return characters
    .map((item) => {
      const rotated = rotatePoint(item, rotation);
      const depth = rotated.z;
      const perspective = focal / (focal - depth * 110);
      const visible = depth > -0.42;

      return {
        char: item.char,
        wordCount: item.wordCount,
        minHsk: item.minHsk,
        sampleWord: item.sampleWord,
        english: item.english,
        thai: item.thai,
        screenX: cx + rotated.x * spread * perspective,
        screenY: cy + rotated.y * spread * perspective,
        scale: Math.max(0.42, Math.min(1.15, perspective * densityScale * 0.92)),
        depth,
        visible,
      };
    })
    .sort((a, b) => a.depth - b.depth);
}

export function getCharacterColor(hskLevel: number): string {
  return HSK_COLORS[hskLevel] ?? '#64748b';
}

export function buildCharacterLinks(characters: OverviewCharacter[]): Array<[string, string]> {
  const links: Array<[string, string]> = [];
  const charSet = new Set(characters.map((item) => item.char));

  for (let i = 0; i < characters.length; i += 1) {
    for (let j = i + 1; j < characters.length; j += 1) {
      if (Math.abs(characters[i].minHsk - characters[j].minHsk) <= 1) {
        links.push([characters[i].char, characters[j].char]);
      }
    }
  }

  return links.filter(([a, b]) => charSet.has(a) && charSet.has(b)).slice(0, 120);
}

export function clampZoom(zoom: number): number {
  return Math.max(0.85, Math.min(2.8, zoom));
}

/** Orbit sensitivity — drag/wheel deltas map to radians (unlimited full spins). */
export const ORBIT_DRAG_SENSITIVITY = 0.007;
export const ORBIT_WHEEL_SENSITIVITY = 0.004;

export { truncateGloss };
