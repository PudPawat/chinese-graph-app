export interface VocabularyWord {
  id: string;
  simplified: string;
  traditional: string;
  pinyin: string;
  english: string;
  thai: string;
  hskLevel: number;
}

export interface GraphNode {
  id: string;
  word: VocabularyWord;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sharedChar: string;
}

export interface VocabularyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootId: string;
}

export interface HskRange {
  min: number;
  max: number;
}

export interface OverviewCharacter {
  char: string;
  wordCount: number;
  minHsk: number;
  sampleWord: string;
  english: string;
  thai: string;
  x: number;
  y: number;
  z: number;
}

export interface ProjectedCharacter {
  char: string;
  wordCount: number;
  minHsk: number;
  sampleWord: string;
  english: string;
  thai: string;
  screenX: number;
  screenY: number;
  scale: number;
  depth: number;
  visible: boolean;
}

export interface SphereRotation {
  yaw: number;
  pitch: number;
}

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface NavSlot {
  word: VocabularyWord;
  sharedChar: string;
}

export type DirectionalNav = Record<NavDirection, NavSlot | null>;
