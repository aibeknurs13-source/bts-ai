import { AIConfig, Card, Level, LevelMode, MiniTest, Question } from './types';
import {
  GenContext,
  LEVEL_RULES,
  PlanTopic,
  generateCardsBatch,
  generateMiniTests,
  generateNote,
  generateQuestionsBatch,
  isDuplicate,
  planTopics,
  providerReady,
} from './ai';
import { localCards, localNote, localQuestions, localTopics } from './localGen';
import { adaptiveMix, adaptiveReason, MasteryInfo } from '../store';
import { hash, norm, shuffle, truncate, uid } from './util';

export interface GenProgress {
  stage: string;
  done: number;
  total: number;
}

export interface GenOptions {
  cfg: AIConfig;
  subjectName: string;
  subjectRu: string;
  subjectId: string;
  mode: LevelMode;
  count: number;
  sourceText: string;
  /** full texts of already used items — used for duplicate detection */
  avoid: string[];
  /** short stems of already used items — sent to the AI as "do not repeat" */
  avoidStems: string[];
  mastery: MasteryInfo;
  onProgress?: (p: GenProgress) => void;
}

export const LEVEL_ORDER: Level[] = ['A', 'B', 'C'];

export function splitByLevel(mode: LevelMode, count: number, mastery: MasteryInfo): Record<Level, number> {
  if (mode === 'A' || mode === 'B' || mode === 'C') return { A: 0, B: 0, C: 0, [mode]: count };
  const mix = mode === 'ADAPT' ? adaptiveMix(mastery) : { A: 0.3, B: 0.35, C: 0.35 };
  const out: Record<Level, number> = { A: 0, B: 0, C: 0 };
  let left = count;
  LEVEL_ORDER.forEach((l, i) => {
    const n = i === LEVEL_ORDER.length - 1 ? left : Math.max(mode === 'ADAPT' ? 0 : 4, Math.round(count * mix[l]));
    out[l] = Math.min(left, n);
    left -= out[l];
  });
  if (left > 0) out.C += left;
  return out;
}

function topicsFor(topics: PlanTopic[], level: Level, mastery: MasteryInfo): PlanTopic[] {
  const weak = mastery.weakTopics;
  const pool = topics.length ? topics : [{ title: 'Общие вопросы', weight: 3, levelFocus: level, keyPoints: [] }];
  const sorted = pool.slice().sort((a, b) => {
    const aw = weak.includes(a.title) ? 1 : 0;
    const bw = weak.includes(b.title) ? 1 : 0;
    if (aw !== bw) return bw - aw;
    return b.weight - a.weight;
  });
  return sorted.slice(0, 6);
}

function pickSource(text: string, topic: string | null, maxChars = 60000): string {
  const t = String(text || '').trim();
  if (!t) return '';
  if (t.length <= maxChars) return t;
  const chunks: string[] = [];
  const paras = t.split(/\n{2,}/);
  let cur = '';
  for (const p of paras) {
    if ((cur + p).length > 2600 && cur) {
      chunks.push(cur);
      cur = '';
    }
    cur += p + '\n\n';
  }
  if (cur) chunks.push(cur);
  if (!topic) {
    const step = Math.max(1, Math.floor(chunks.length / 14));
    const picked = chunks.filter((_, i) => i % step === 0).slice(0, 16);
    return picked.join('\n').slice(0, maxChars);
  }
  const words = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = chunks.map((c, i) => {
    const low = c.toLowerCase();
    const s = words.reduce((acc, w) => acc + (low.split(w).length - 1), 0);
    return { i, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored
    .slice(0, 12)
    .sort((a, b) => a.i - b.i)
    .map((x) => chunks[x.i])
    .join('\n')
    .slice(0, maxChars);
}

const BANK_LIMIT = 90;

/** Local (offline) mode is used when no AI provider is configured — the app stays fully usable for free. */
export const useLocalMode = (cfg: AIConfig) => cfg.provider === 'local' || !providerReady(cfg);

/* ------------------------------------------------------------------ test */

export interface GeneratedTest {
  questions: Question[];
  reason?: string;
  topics: PlanTopic[];
}

export async function generateTest(opts: GenOptions): Promise<GeneratedTest> {
  const { cfg, mode, count, sourceText, mastery, onProgress } = opts;
  const progress = onProgress || (() => {});

  if (!sourceText.trim()) throw new Error('Нет исходного материала — добавьте файл или вставьте текст.');

  if (useLocalMode(cfg)) {
    progress({ stage: 'Локальный анализ материала', done: 0, total: count });
    const topics = localTopics(sourceText, opts.subjectRu);
    const split = splitByLevel(mode, count, mastery);
    const out: Question[] = [];
    LEVEL_ORDER.forEach((l) => {
      const n = split[l];
      if (!n) return;
      out.push(...localQuestions(sourceText, l, n, opts.avoid));
    });
    progress({ stage: 'Готово', done: count, total: count });
    return { questions: out.slice(0, count), reason: 'Локальный режим: вопросы собраны из вашего материала без ИИ.', topics };
  }

  progress({ stage: 'Анализ материала и план тем', done: 0, total: count });
  const topics = await planTopics(cfg, { subjectName: opts.subjectName, subjectRu: opts.subjectRu, sourceText: pickSource(sourceText, null, 24000) });

  const split = splitByLevel(mode, count, mastery);
  const seen: { hash: string; text: string }[] = opts.avoid.map((a) => ({ hash: hash(norm(a)), text: a }));
  const out: Question[] = [];
  const usedTopics: string[] = [];

  for (const level of LEVEL_ORDER) {
    let need = split[level];
    if (!need) continue;
    let attempts = 0;
    while (need > 0 && attempts < 10) {
      attempts++;
      const batch = Math.min(8, need);
      progress({ stage: `Уровень ${level}: вопросы ${out.length + 1}–${out.length + batch}`, done: out.length, total: count });
      const ctx: GenContext = {
        subjectName: opts.subjectName,
        subjectRu: opts.subjectRu,
        level,
        count: batch,
        sourceText: pickSource(sourceText, topics[0]?.title || null, 40000),
        topics: topicsFor(topics, level, mastery),
        avoid: (opts.avoidStems || opts.avoid)
          .slice(-BANK_LIMIT)
          .map((s) => truncate(s, 110))
          .reverse(),
        weakness: mastery.weakTopics,
      };
      const fresh = await generateQuestionsBatch(cfg, ctx);
      let added = 0;
      for (const q of fresh) {
        if (added >= need) break;
        const full = q.q + ' ' + q.options.join(' ');
        if (isDuplicate(full, seen)) continue;
        seen.push({ hash: hash(norm(full)), text: full });
        q.level = level;
        out.push(q);
        added++;
      }
      need -= added;
      if (!added && attempts > 2) {
        // модель вернула пустой или полностью дублирующий пакет — ослабляем запрет повторов для следующего пакета
        ctx.avoid = [];
        attempts++;
      }
    }
  }

  progress({ stage: 'Готово', done: out.length, total: count });
  const reason = mode === 'ADAPT' ? adaptiveReason(mastery, adaptiveMix(mastery)) : undefined;
  return { questions: out, reason, topics };
}

/* ----------------------------------------------------------------- cards */

export async function generateCards(opts: GenOptions): Promise<Card[]> {
  const { cfg, count, sourceText, mastery, onProgress } = opts;
  const progress = onProgress || (() => {});
  if (!sourceText.trim()) throw new Error('Нет исходного материала.');

  if (useLocalMode(cfg)) {
    progress({ stage: 'Локальный сбор карточек', done: 0, total: count });
    const cards = localCards(sourceText, count);
    progress({ stage: 'Готово', done: cards.length, total: count });
    return cards;
  }

  const topics = await planTopics(cfg, { subjectName: opts.subjectName, subjectRu: opts.subjectRu, sourceText: pickSource(sourceText, null, 24000) });
  const seen: { hash: string; text: string }[] = opts.avoid.map((a) => ({ hash: hash(norm(a)), text: a }));
  const out: Card[] = [];
  let guard = 0;
  while (out.length < count && guard < 12) {
    guard++;
    const batch = Math.min(10, count - out.length);
    progress({ stage: `Карточки ${out.length + 1}–${out.length + batch}`, done: out.length, total: count });
    const ctx: GenContext = {
      subjectName: opts.subjectName,
      subjectRu: opts.subjectRu,
      level: opts.mode === 'MIX' || opts.mode === 'ADAPT' ? 'A' : (opts.mode as Level),
      count: batch,
      sourceText: pickSource(sourceText, null, 40000),
      topics: topicsFor(topics, 'A', mastery),
      avoid: (opts.avoidStems || opts.avoid).slice(-BANK_LIMIT).map((s) => truncate(s, 110)).reverse(),
      weakness: mastery.weakTopics,
    };
    const fresh = await generateCardsBatch(cfg, ctx);
    for (const c of fresh) {
      if (out.length >= count) break;
      const full = c.front + ' ' + c.back;
      if (isDuplicate(full, seen)) continue;
      seen.push({ hash: hash(norm(full)), text: full });
      out.push(c);
    }
  }
  progress({ stage: 'Готово', done: out.length, total: count });
  return out;
}

/* ------------------------------------------------------------------ note */

export interface GeneratedNote {
  title: string;
  markdown: string;
  miniTests: MiniTest[];
  topics: PlanTopic[];
}

export async function generateNoteAll(opts: GenOptions): Promise<GeneratedNote> {
  const { cfg, sourceText, onProgress } = opts;
  const progress = onProgress || (() => {});
  if (!sourceText.trim()) throw new Error('Нет исходного материала.');
  const level: Level = opts.mode === 'MIX' || opts.mode === 'ADAPT' ? 'B' : (opts.mode as Level);

  if (useLocalMode(cfg)) {
    progress({ stage: 'Локальный конспект', done: 0, total: 2 });
    const topics = localTopics(sourceText, opts.subjectRu);
    const n = localNote(sourceText, opts.subjectRu, topics);
    progress({ stage: 'Мини-тесты', done: 1, total: 2 });
    const mt: MiniTest[] = [];
    topics.slice(0, 2).forEach((t, i) => {
      const qs = localQuestions(sourceText, level, 5, []).slice(i * 2, i * 2 + 4);
      if (qs.length) mt.push({ id: uid('mt'), title: `Мини-тест: ${t.title}`, questions: qs });
    });
    progress({ stage: 'Готово', done: 2, total: 2 });
    return { ...n, miniTests: mt, topics };
  }

  progress({ stage: 'План тем', done: 0, total: 3 });
  const topics = await planTopics(cfg, { subjectName: opts.subjectName, subjectRu: opts.subjectRu, sourceText: pickSource(sourceText, null, 24000) });

  progress({ stage: 'Пишу конспект', done: 1, total: 3 });
  const note = await generateNote(cfg, {
    subjectRu: opts.subjectRu,
    sourceText: pickSource(sourceText, null, 40000),
    topics,
    level,
  });

  progress({ stage: 'Мини-тесты для конспекта', done: 2, total: 3 });
  let miniTests: MiniTest[] = [];
  try {
    miniTests = await generateMiniTests(cfg, {
      subjectRu: opts.subjectRu,
      sourceText: pickSource(sourceText, null, 30000),
      topics,
      level,
      count: level === 'C' ? 3 : 2,
    });
  } catch {
    miniTests = [];
  }
  progress({ stage: 'Готово', done: 3, total: 3 });
  return { ...note, miniTests, topics };
}

/* ------------------------------------------------------------------ misc */

export function shuffleQuestions(qs: Question[]): Question[] {
  return shuffle(qs);
}

export const makeId = (p: string) => uid(p);

export { LEVEL_RULES };
