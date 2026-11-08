export type Level = 'A' | 'B' | 'C';
export type LevelMode = 'A' | 'B' | 'C' | 'MIX' | 'ADAPT';

export interface Figure {
  img?: string;
  x?: number[];
  y?: number[];
  fn?: { f: string; d?: boolean }[];
  ci?: [number, number, number, boolean?][];
  shade?: string[];
  lx?: string;
  ly?: string;
  vl?: { v: number; d?: boolean }[];
  pl?: [number, number][][];
  pt?: [number, number][];
  ar?: [number, number, number, number, string?][];
}

export interface Question {
  id: string;
  q: string;
  options: string[];
  answer: number;
  explanation: string;
  hint?: string;
  level: Level;
  topic: string;
  subjectId?: string;
  figure?: Figure | null;
  optionsFigure?: (Figure | null)[] | null;
  source?: string;
}

export interface Card {
  id: string;
  front: string;
  back: string;
  hint?: string;
  level: Level;
  topic: string;
  subjectId?: string;
}

export interface MiniTest {
  id: string;
  title: string;
  questions: Question[];
}

export interface Note {
  id: string;
  subjectId: string;
  title: string;
  markdown: string;
  miniTests: MiniTest[];
  createdAt: number;
  source?: string;
}

export interface Material {
  id: string;
  subjectId: string;
  name: string;
  kind: string;
  size: number;
  text: string;
  pages?: number;
  hasImage?: boolean;
  imageMime?: string;
  imageData?: string;
  createdAt: number;
}

export interface TestRun {
  id: string;
  subjectId: string;
  title: string;
  mode: LevelMode;
  questions: Question[];
  answers: (number | null)[];
  hints: number[];
  createdAt: number;
  finishedAt?: number;
  score?: number;
  points?: number;
  paid?: number;
  adaptiveReason?: string;
}

export interface Deck {
  id: string;
  subjectId: string;
  title: string;
  cards: Card[];
  createdAt: number;
  learned: number;
  box: number[];
  due: number;
}

export interface Mistake {
  id: string;
  subjectId: string;
  question: Question;
  box: number;
  due: number;
  createdAt: number;
}

export interface BankItem {
  id: string;
  subjectId: string;
  topic: string;
  level: Level;
  kind: 'q' | 'c';
  /** full text of the item (question + options) — used for duplicate detection */
  text: string;
  /** short form (question stem) — sent to the AI as "already used" */
  stem: string;
  hash: string;
  createdAt: number;
}

export interface Profile {
  points: number;
  streak: number;
  best: number;
  last: string;
  totalTests: number;
  totalQuestions: number;
}

export interface Subject {
  id: string;
  name: string;
  ru: string;
  emoji: string;
  color: string;
}

export interface Mastery {
  topic: string;
  level: Level;
  right: number;
  wrong: number;
}

export interface MiniState {
  a: Record<number, number>;
  h: Record<number, number>;
  best: number;
  tries: number;
}

export interface AppData {
  subjects: Subject[];
  materials: Material[];
  tests: TestRun[];
  decks: Deck[];
  notes: Note[];
  bank: BankItem[];
  mistakes: Mistake[];
  mini: Record<string, MiniState>;
  profile: Profile;
}

export type ProviderId = 'gemini' | 'openrouter' | 'openai' | 'ollama' | 'local';

export interface AIConfig {
  provider: ProviderId;
  key: string;
  geminiModel: string;
  openaiModel: string;
  openaiBase: string;
  temperature: number;
}
