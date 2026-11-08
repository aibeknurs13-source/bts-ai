import { AIConfig, Level, Question, Card, MiniTest } from './types';
import { hash, norm, similarity, sleep, truncate, uid } from './util';

export interface ImagePart {
  mime: string;
  data: string;
}

export interface AIRequest {
  system: string;
  prompt: string;
  json?: boolean;
  images?: ImagePart[];
  maxTokens?: number;
}

export class AIError extends Error {
  hint?: string;
  constructor(msg: string, hint?: string) {
    super(msg);
    this.hint = hint;
  }
}

/**
 * Бесплатный tier Gemini (Google AI Studio) — модели, доступные без карты и биллинга.
 * gemini-2.5-flash и gemini-2.5-pro объявлены устаревшими: с 1 декабря 2026 запросы
 * к gemini-2.5-flash автоматически перенаправляются на gemini-3.5-flash-lite.
 */
const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
];

export const freeModels = {
  gemini: GEMINI_MODELS,
  openrouter: ['google/gemma-3-27b-it:free', 'qwen/qwen3-235b-a22b:free', 'meta-llama/llama-3.3-70b-instruct:free'],
  openai: ['gpt-4o-mini', 'gpt-4o'],
  ollama: ['llama3.2', 'qwen2.5', 'gemma3'],
};

async function httpJSON(url: string, init: RequestInit, timeout = 90000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        (typeof data?.raw === 'string' ? data.raw.slice(0, 300) : '') ||
        `HTTP ${res.status}`;
      throw new AIError(msg, `HTTP ${res.status}`);
    }
    return data;
  } catch (e) {
    if (e instanceof AIError) throw e;
    if ((e as any)?.name === 'AbortError') throw new AIError('Превышено время ожидания ответа ИИ');
    throw new AIError((e as any)?.message || 'Сеть недоступна');
  } finally {
    clearTimeout(t);
  }
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String((e as any)?.message || '');
      const retryable = /429|500|502|503|504|rate|quota|timeout|timeout|Превышено/i.test(msg);
      if (!retryable || i === tries - 1) break;
      await sleep(1500 * (i + 1) * (i + 1));
    }
  }
  throw lastErr;
}

/* ---------------------------------------------------------------- Gemini */

async function callGemini(cfg: AIConfig, req: AIRequest): Promise<string> {
  const models = [cfg.geminiModel, ...GEMINI_MODELS].filter(Boolean);
  const tried = new Set<string>();
  let lastErr: any;
  for (const model of models) {
    if (tried.has(model)) continue;
    tried.add(model);
    try {
      const parts: any[] = [{ text: req.prompt }];
      for (const img of req.images || []) parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
      const body: any = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: cfg.temperature,
          maxOutputTokens: req.maxTokens || 8192,
          ...(req.json ? { responseMimeType: 'application/json' } : {}),
        },
      };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent?key=${encodeURIComponent(cfg.key)}`;
      const data = await withRetry(() => httpJSON(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map((p: any) => p.text || '')
        .join('')
        .trim();
      if (!text) {
        const blocked = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
        throw new AIError(`Модель ${model} не вернула текст${blocked ? ` (${blocked})` : ''}`);
      }
      return text;
    } catch (e) {
      lastErr = e;
      const msg = String((e as any)?.message || '');
      // Bad key or quota -> do not keep switching models
      if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(msg)) break;
      if (!/404|not found|not supported/i.test(msg)) break;
    }
  }
  throw lastErr instanceof AIError ? lastErr : new AIError(String(lastErr?.message || 'Ошибка Gemini'));
}

/* --------------------------------------------- OpenAI-compatible (OpenRouter / Ollama / any) */

function openaiBase(cfg: AIConfig): string {
  if (cfg.provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (cfg.provider === 'ollama') return (cfg.openaiBase || 'http://localhost:11434/v1').replace(/\/$/, '');
  return (cfg.openaiBase || 'https://api.openai.com/v1').replace(/\/$/, '');
}

async function callOpenAI(cfg: AIConfig, req: AIRequest, allowNoJson: boolean): Promise<string> {
  const base = openaiBase(cfg);
  const content: any = [{ type: 'text', text: req.prompt }];
  for (const img of req.images || []) {
    content.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.data}` } });
  }
  const body: any = {
    model: cfg.openaiModel || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content },
    ],
    temperature: cfg.temperature,
    max_tokens: req.maxTokens || 8192,
  };
  if (req.json) body.response_format = { type: 'json_object' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  if (cfg.provider === 'openrouter') headers['HTTP-Referer'] = window.location.origin;
  const url = `${base}/chat/completions`;
  try {
    const data = await withRetry(() => httpJSON(url, { method: 'POST', headers, body: JSON.stringify(body) }));
    const txt = data?.choices?.[0]?.message?.content ?? '';
    if (typeof txt === 'string' && txt.trim()) return txt.trim();
    throw new AIError('Пустой ответ модели');
  } catch (e) {
    if (!allowNoJson || !req.json) throw e;
    // Some free models reject response_format — retry without it.
    const body2 = { ...body };
    delete body2.response_format;
    const data = await withRetry(() => httpJSON(url, { method: 'POST', headers, body: JSON.stringify(body2) }));
    const txt = data?.choices?.[0]?.message?.content ?? '';
    if (typeof txt === 'string' && txt.trim()) return txt.trim();
    throw e;
  }
}

/* ------------------------------------------------------------------ entry */

export function providerReady(cfg: AIConfig): boolean {
  if (!cfg) return false;
  if (cfg.provider === 'local') return true;
  if (cfg.provider === 'ollama') return true;
  return !!cfg.key && cfg.key.trim().length > 8;
}

export async function callAI(cfg: AIConfig, req: AIRequest): Promise<string> {
  if (!providerReady(cfg)) {
    throw new AIError(
      'Не настроен ИИ-провайдер',
      'Добавьте бесплатный ключ Gemini в настройках или используйте локальный режим.',
    );
  }
  if (cfg.provider === 'gemini') return callGemini(cfg, req);
  if (cfg.provider === 'local') throw new AIError('Локальный режим не поддерживает произвольные запросы');
  return callOpenAI(cfg, req, true);
}

/* --------------------------------------------------------------- JSON utils */

export function parseJsonLoose(text: string): any {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    /* continue */
  }
  const start = t.search(/[[{]/);
  if (start < 0) return null;
  const open = t[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(t.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  const loose = t.slice(start).replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(loose);
  } catch {
    return null;
  }
}

export async function callJson<T>(cfg: AIConfig, req: AIRequest): Promise<T> {
  const text = await callAI(cfg, { ...req, json: true });
  const parsed = parseJsonLoose(text);
  if (!parsed) throw new AIError('ИИ вернул нечитаемый ответ', 'Попробуйте ещё раз или смените модель.');
  return parsed as T;
}

/* ---------------------------------------------------------------- prompts */

export const LEVEL_RULES: Record<Level, string> = {
  A: `УРОВЕНЬ A (базовый). Только прямое знание: определения, термины, формулы, хронология, факты. Вопрос решается за 15 секунд, без расчётов.`,
  B: `УРОВЕНЬ B (средний). Нужно применить знание: расчёт по образцу в 1-2 шага, сравнение явлений, объяснение «почему», применение формулы к конкретным данным.`,
  C: `УРОВЕНЬ C (сложный). ВСЕ вопросы этого уровня должны быть максимально сложными: многошаговые задачи, несколько тем сразу, нестандартные условия, скрытые ловушки, неочевидные выводы, задачи на грани типичных ошибок. Простой вопрос (только заученный факт) на уровне C запрещён.`,
};

const SYSTEM = `Ты — опытный методист-преподаватель, который готовит к государственному экзамену (БТС / Ұлттық тестілеу) в Казахстане.

ЖЁСТКИЕ ПРАВИЛА:
1. Ты пишешь на русском языке (термины при необходимости оставляй на языке оригинала).
2. Каждый вопрос — ровно 4 варианта ответа A, B, C, D. Ровно ОДИН вариант верный. Варианты не длиннее 1-2 предложений.
3. Правильный ответ не должен выделяться длиной, стилем или «гладкостью» формулировки — дистракторы правдоподобны и заманчивы.
4. Объяснение (explanation) — 1-3 предложения: почему верный ответ верный и почему типичные варианты неверны.
5. Подсказка (hint) — короткая наводка, НЕ раскрывающая ответ.
6. Формулы записывай в LaTeX: $x^2 + y^2 = z^2$. Не используй Markdown-заголовки в тексте вопроса.
7. Темы указывай коротко (1-4 слова), они должны точно отражать суть вопроса.
8. Никогда не повторяй ранее заданные вопросы — они перечислены в промпте как запрещённые.
9. Отвечай ТОЛЬКО валидным JSON без пояснений и без markdown-обёртки (кодовые блоки запрещены).`;

export interface PlanTopic {
  title: string;
  weight: number;
  levelFocus: Level;
  keyPoints: string[];
}

export interface GenContext {
  subjectName: string;
  subjectRu: string;
  level: Level;
  count: number;
  sourceText: string;
  topics: PlanTopic[];
  avoid: string[];
  weakness: string[];
  notes?: string;
}

export async function planTopics(cfg: AIConfig, ctx: {
  subjectName: string;
  subjectRu: string;
  sourceText: string;
}): Promise<PlanTopic[]> {
  const prompt = `Материал по предмету «${ctx.subjectRu}»:

"""
${truncate(ctx.sourceText, 14000)}
"""

Составь план тем для подготовки. 4-10 тем, покрывающих материал.
Для каждой темы укажи: title (коротко), weight (1-5, насколько тема важна), levelFocus (A/B/C — какой уровень сложности лучше подходит), keyPoints (2-4 ключевых момента темы).
Ответ строго JSON: {"topics":[{"title":"...","weight":3,"levelFocus":"B","keyPoints":["..."]}]}`;
  const res = await callJson<{ topics?: PlanTopic[] }>(cfg, {
    system: SYSTEM,
    prompt,
    maxTokens: 3000,
  });
  const topics = (res?.topics || []).filter((t) => t && t.title);
  return topics.length ? topics.slice(0, 12) : [{ title: ctx.subjectRu, weight: 3, levelFocus: 'B', keyPoints: [] }];
}

function avoidBlock(avoid: string[]): string {
  if (!avoid.length) return 'Запрещённых вопросов пока нет.';
  return 'ЗАПРЕЩЁННЫЕ (уже использованные) вопросы — не повторяй их и не перефразируй:\n' + avoid.map((a, i) => `${i + 1}. ${a}`).join('\n');
}

function topicBlock(topics: PlanTopic[]): string {
  if (!topics.length) return '';
  return (
    'ТЕМЫ (распредели вопросы между ними примерно поровну, кроме указаний по приоритету):\n' +
    topics.map((t) => `- ${t.title} (приоритет ${t.weight}/5)${t.keyPoints?.length ? ' — ' + t.keyPoints.slice(0, 4).join('; ') : ''}`).join('\n')
  );
}

function weaknessBlock(w: string[]): string {
  if (!w.length) return '';
  return `СЛАБЫЕ МЕСТА ученика (сделай по ним примерно половину вопросов, но не давай однотипных): ${w.join(', ')}.`;
}

export interface RawQuestion {
  q: string;
  options: string[];
  answer: number;
  explanation?: string;
  hint?: string;
  level?: string;
  topic?: string;
}

export async function generateQuestionsBatch(
  cfg: AIConfig,
  ctx: GenContext,
): Promise<Question[]> {
  const prompt = `СОЗДАЙ ВОПРОСЫ.

Предмет: ${ctx.subjectRu} (${ctx.subjectName}).
${LEVEL_RULES[ctx.level]}
Количество вопросов в этом пакете: ${ctx.count}. Уровень всех вопросов: ${ctx.level}.
${ctx.notes ? `ДОПОЛНИТЕЛЬНО: ${ctx.notes}` : ''}

${topicBlock(ctx.topics)}

${weaknessBlock(ctx.weakness)}

ИСХОДНЫЙ МАТЕРИАЛ (используй только его как базу знаний, можешь дополнять общеизвестными фактами):
"""
${truncate(ctx.sourceText, 22000)}
"""

${avoidBlock(ctx.avoid)}

ФОРМАТ ОТВЕТА (строго JSON):
{"questions":[{"q":"текст вопроса","options":["вариант A","вариант B","вариант C","вариант D"],"answer":0,"explanation":"почему так","hint":"наводка","level":"${ctx.level}","topic":"тема"}]}

Значение answer — индекс верного варианта (0-3). Верни только JSON.`;
  const res = await callJson<{ questions?: RawQuestion[] }>(cfg, { system: SYSTEM, prompt, maxTokens: 8192 });
  const list = res?.questions || [];
  return list
    .map((r) => normalizeQuestion(r, ctx.level, ctx.subjectName))
    .filter((q): q is Question => !!q);
}

export async function generateCardsBatch(
  cfg: AIConfig,
  ctx: GenContext,
): Promise<Card[]> {
  const prompt = `СОЗДАЙ ФЛЕШ-КАРТОЧКИ.

Предмет: ${ctx.subjectRu}.
Всего нужно: ${ctx.count} карточек (в этом пакете — ${ctx.count}).
${ctx.level !== 'A' ? LEVEL_RULES[ctx.level] : ''}
${ctx.notes ? `ДОПОЛНИТЕЛЬНО: ${ctx.notes}` : ''}

${topicBlock(ctx.topics)}
${weaknessBlock(ctx.weakness)}

ИСХОДНЫЙ МАТЕРИАЛ:
"""
${truncate(ctx.sourceText, 22000)}
"""

${avoidBlock(ctx.avoid)}

Каждая карточка: front — короткий вопрос или термин, back — развёрнутый, но ёмкий ответ (2-5 предложений или формула + пояснение).
ФОРМАТ (строго JSON): {"cards":[{"front":"...","back":"...","hint":"...","level":"${ctx.level}","topic":"..."}]}`;
  const res = await callJson<{ cards?: any[] }>(cfg, { system: SYSTEM, prompt, maxTokens: 8192 });
  return (res?.cards || [])
    .map((c, i) => ({
      id: uid('c'),
      front: String(c?.front || '').slice(0, 400),
      back: String(c?.back || '').slice(0, 2000),
      hint: c?.hint ? String(c.hint).slice(0, 300) : undefined,
      level: (['A', 'B', 'C'].includes(String(c?.level).toUpperCase()) ? String(c.level).toUpperCase() : ctx.level) as Level,
      topic: String(c?.topic || 'Общая тема').slice(0, 80),
    }))
    .filter((c) => c.front && c.back);
}

export async function generateNote(
  cfg: AIConfig,
  ctx: { subjectRu: string; sourceText: string; topics: PlanTopic[]; level: Level },
): Promise<{ title: string; markdown: string }> {
  const prompt = `НАПИШИ КОНСПЕКТ по предмету «${ctx.subjectRu}».

Требования:
- Структурированный Markdown: ## заголовки разделов, списки, таблицы там, где уместно, формулы в $...$ / $$...$$ (LaTeX).
- Опирайся на исходный материал, но сгруппируй и переформулируй его так, как это делает хороший конспект для подготовки к экзамену.
- Выдели ключевые термины, типичные формулы, «что чаще всего спрашивают» и типичные ошибки.
- Никаких вступлений вроде «Конечно!». Сразу содержание.
- Объём: ${ctx.level === 'C' ? 'подробно, с разбором сложных случаев' : ctx.level === 'B' ? 'средний, с примерами' : 'базово, но полно'}.

МАТЕРИАЛ:
"""
${truncate(ctx.sourceText, 24000)}
"""

${topicBlock(ctx.topics)}

ФОРМАТ (строго JSON): {"title":"название конспекта","markdown":"текст конспекта в Markdown"}`;
  const res = await callJson<{ title?: string; markdown?: string }>(cfg, { system: SYSTEM, prompt, maxTokens: 8192 });
  return {
    title: String(res?.title || `Конспект: ${ctx.subjectRu}`).slice(0, 160),
    markdown: String(res?.markdown || '').slice(0, 60000),
  };
}

export async function generateMiniTests(
  cfg: AIConfig,
  ctx: { subjectRu: string; sourceText: string; topics: PlanTopic[]; level: Level; count: number },
): Promise<MiniTest[]> {
  const prompt = `СОЗДАЙ МИНИ-ТЕСТЫ по предмету «${ctx.subjectRu}» — они будут встроены в конспект.
Нужно ${ctx.count} мини-тестов, в каждом 4-6 вопросов. Уровень вопросов: ${ctx.level}.
${LEVEL_RULES[ctx.level]}

МАТЕРИАЛ:
"""
${truncate(ctx.sourceText, 20000)}
"""
${topicBlock(ctx.topics)}

ФОРМАТ (строго JSON):
{"miniTests":[{"title":"название темы","questions":[{"q":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","hint":"...","level":"${ctx.level}","topic":"..."}]}]}`;
  const res = await callJson<{ miniTests?: any[] }>(cfg, { system: SYSTEM, prompt, maxTokens: 8192 });
  return (res?.miniTests || [])
    .map((mt, i) => ({
      id: uid('mt'),
      title: String(mt?.title || `Тема ${i + 1}`).slice(0, 160),
      questions: (mt?.questions || [])
        .map((r: RawQuestion) => normalizeQuestion(r, ctx.level, ctx.subjectRu))
        .filter((q): q is Question => !!q),
    }))
    .filter((mt) => mt.questions.length);
}

/* --------------------------------------------------------------- helpers */

export function normalizeQuestion(r: RawQuestion, level: Level, subjectName: string): Question | null {
  if (!r || !r.q) return null;
  let opts = (r.options || []).map((o) => String(o ?? '').trim()).filter((o) => o.length);
  if (opts.length < 2) return null;
  while (opts.length < 4) opts.push(`Вариант ${opts.length + 1}`);
  opts = opts.slice(0, 4);
  let ans = Number(r.answer);
  if (!Number.isFinite(ans) || ans < 0 || ans > 3) {
    const letter = String(r.answer ?? '').trim().toUpperCase();
    ans = ['A', 'B', 'C', 'D'].indexOf(letter);
  }
  if (ans < 0 || ans > 3) ans = 0;
  const lvl = (['A', 'B', 'C'].includes(String(r.level).toUpperCase()) ? String(r.level).toUpperCase() : level) as Level;
  return {
    id: uid('q'),
    q: String(r.q).trim().slice(0, 1200),
    options: opts,
    answer: ans,
    explanation: String(r.explanation || '').slice(0, 1200),
    hint: r.hint ? String(r.hint).slice(0, 400) : undefined,
    level: lvl,
    topic: String(r.topic || 'Общая тема').slice(0, 80),
    subjectId: undefined,
    source: subjectName,
  };
}

/** Duplicate detection across the whole bank and inside the current batch. */
export function isDuplicate(text: string, seen: { hash: string; text: string }[]): boolean {
  const h = hash(norm(text));
  for (const s of seen) {
    if (s.hash === h) return true;
  }
  for (const s of seen) {
    if (similarity(text, s.text) >= 0.82) return true;
  }
  return false;
}
