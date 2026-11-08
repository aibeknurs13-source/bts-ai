import { Card, Level, Question } from './types';
import { PlanTopic } from './ai';
import { hash, norm, shuffle, similarity, uid } from './util';

/**
 * Local heuristic generator — works 100% offline, no API key required.
 * It builds definition / attribution questions and term cards straight from the material.
 * The AI provider path (Gemini / OpenRouter / local Ollama) produces much richer content.
 */

const STOP = new Set(
  'и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это'.split(
    ' ',
  ),
);

export interface Block {
  topic: string;
  heading: string;
  sentences: string[];
}

export function splitBlocks(text: string): Block[] {
  const lines = String(text || '').split(/\r?\n/);
  const blocks: Block[] = [];
  let heading = '';
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (body.length > 20) {
      blocks.push({
        topic: heading || body.slice(0, 48),
        heading,
        sentences: body
          .split(/(?<=[.!?…])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 25 && s.length <= 400),
      });
    }
    buf = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const isHeading =
      /^#{1,4}\s+\S/.test(line) ||
      (line.length > 2 && line.length < 70 && !/[.!?;]$/.test(line) && /^[A-ZА-ЯЁҚҢӘҒ]/.test(line) && line.split(/\s+/).length <= 9);
    if (isHeading) {
      flush();
      heading = line.replace(/^#+\s*/, '').replace(/[:.]$/, '').slice(0, 80);
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}

export function localTopics(text: string, subjectRu: string): PlanTopic[] {
  const blocks = splitBlocks(text);
  const seen = new Set<string>();
  const topics: PlanTopic[] = [];
  for (const b of blocks) {
    const t = b.topic.slice(0, 70);
    const h = hash(norm(t));
    if (!t || seen.has(h)) continue;
    seen.add(h);
    topics.push({
      title: t,
      weight: b.sentences.length > 6 ? 5 : b.sentences.length > 3 ? 3 : 2,
      levelFocus: b.sentences.length > 5 ? 'C' : b.sentences.length > 2 ? 'B' : 'A',
      keyPoints: b.sentences.slice(0, 3).map((s) => s.slice(0, 90)),
    });
    if (topics.length >= 12) break;
  }
  if (!topics.length) topics.push({ title: subjectRu, weight: 3, levelFocus: 'B', keyPoints: [] });
  return topics;
}

/** Significant concepts of a block: markup-emphasised terms plus frequent content words. */
function keyTerms(block: Block, extraText = ''): string[] {
  const out: string[] = [];
  const push = (t: string) => {
    const s = String(t).replace(/[*_`"«»()]/g, '').replace(/[.,;:!?]$/, '').trim();
    if (s.length < 3 || s.length > 60) return;
    if (STOP.has(s.toLowerCase())) return;
    if (!/[A-Za-zА-Яа-яӘәІіҚқҢңҒғҒҮүҰұӨөҺһ]/.test(s)) return;
    if (out.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    out.push(s);
  };
  block.sentences.forEach((s) => {
    const bold: string[] = s.match(/\*\*([^*]{3,60})\*\*/g) || [];
    bold.forEach((b) => push(b.replace(/\*/g, '')));
    const quoted: string[] = s.match(/[«"]([^»"]{3,60})[»"]/g) || [];
    quoted.forEach((q) => push(q.replace(/[«»"]/g, '')));
    const def: RegExpMatchArray | null = s.match(/([А-ЯЁA-Z][а-яёa-z]{3,30})\s*[—:-]\s*([^.;]{10,140})/);
    if (def) push(def[1]);
  });
  /* frequent content words across the block */
  const freq = new Map<string, number>();
  const pool = (extraText ? extraText + ' ' : '') + block.sentences.join(' ');
  pool.split(/[^A-Za-zА-Яа-яӘәІіҚқҢңҒғҒҮүҰұӨөҺһ-]+/).forEach((w) => {
    const t = w.replace(/^-|-$/g, '');
    if (t.length < 4 || t.length > 28) return;
    if (STOP.has(t.toLowerCase())) return;
    if (!/[A-Za-zА-Яа-яӘәІіҚқҢңҒғҒҮүҰұӨөҺһ]/.test(t)) return;
    freq.set(t, (freq.get(t) || 0) + 1);
  });
  [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([w]) => push(w));
  return out.slice(0, 16);
}

export function localQuestions(text: string, level: Level, count: number, avoid: string[] = []): Question[] {
  const blocks = splitBlocks(text);
  const all = blocks.flatMap((b) => b.sentences);
  if (!all.length) return [];
  const seen = avoid.map((a) => ({ hash: hash(norm(a)), text: a }));
  const out: Question[] = [];
  const usedStems = new Set<string>();

  const push = (q: Question) => {
    const key = norm(q.q);
    if (usedStems.has(key)) return;
    if (seen.some((s) => s.hash === hash(key) || similarity(q.q, s.text) >= 0.82)) return;
    if (out.some((o) => similarity(o.q, q.q) >= 0.82)) return;
    usedStems.add(key);
    seen.push({ hash: hash(key), text: q.q });
    out.push(q);
  };

  const topicNames = blocks.map((b) => b.topic);

  const A_PHRASES = [
    (t: string) => `Что означает понятие «${t}»?`,
    (t: string) => `Дайте определение понятия «${t}».`,
    (t: string) => `Что подразумевается под термином «${t}»?`,
    (t: string) => `Раскройте содержание термина «${t}».`,
  ];
  const B_PHRASES = [
    (f: string) => `К какой теме относится утверждение «${f}»?`,
    (f: string) => `Какая тема раскрывает утверждение «${f}»?`,
    (f: string) => `В каком разделе разобрано утверждение «${f}»?`,
    (f: string) => `Определите тему утверждения: «${f}».`,
  ];
  const C_PHRASES = [
    (t1: string, t2: string, topic: string) => `Какое утверждение верно раскрывает связь понятий «${t1}» и «${t2}» в теме «${topic}»?`,
    (t1: string, t2: string, topic: string) => `Какое из утверждений верно для темы «${topic}», если речь о понятиях «${t1}» и «${t2}»?`,
    (t1: string, t2: string, topic: string) => `Что верно о взаимосвязи «${t1}» и «${t2}» в теме «${topic}»?`,
    (t1: string, t2: string, topic: string) => `Выберите утверждение, в котором понятия «${t1}» и «${t2}» связаны по теме «${topic}».`,
  ];
  const X_PHRASES = [
    (a: string, b: string) => `Какое утверждение относится одновременно к темам «${a}» и «${b}»?`,
    (a: string, b: string) => `Какая формулировка затрагивает обе темы — «${a}» и «${b}»?`,
    (a: string, b: string) => `Что верно для пересечения тем «${a}» и «${b}»?`,
    (a: string, b: string) => `В каком утверждении совместно раскрыты темы «${a}» и «${b}»?`,
  ];

  const cut = (f: string, n = 150) => (f.length > n ? f.slice(0, n) + '…' : f);

  /* ---------- level A: definition of a term ---------- */
  if (level === 'A') {
    blocks.forEach((b) => {
      const terms = keyTerms(b);
      terms.forEach((term) => {
        const def = b.sentences.find((s) => s.includes(term));
        if (!def) return;
        const others = all.filter((s) => s !== def && !s.includes(term)).slice(0, 3);
        if (others.length < 3) return;
        A_PHRASES.slice(0, 2).forEach((ph) => {
          const options = shuffle([def, ...others]);
          push({
            id: uid('q'),
            q: ph(term),
            options,
            answer: options.indexOf(def),
            explanation: `Верно: ${def}`,
            hint: `Найдите в конспекте определение «${term}».`,
            level,
            topic: b.topic,
          });
        });
      });
    });
  }

  /* ---------- level B: which topic does the statement belong to ---------- */
  if (level === 'B') {
    blocks.forEach((b) => {
      b.sentences.slice(0, 12).forEach((fact) => {
        const others = topicNames.filter((t) => t !== b.topic).slice(0, 3);
        if (others.length < 3) return;
        B_PHRASES.slice(0, 2).forEach((ph) => {
          const options = shuffle([b.topic, ...others]);
          push({
            id: uid('q'),
            q: ph(cut(fact)),
            options,
            answer: options.indexOf(b.topic),
            explanation: `Это утверждение относится к теме «${b.topic}».`,
            hint: `Вспомните раздел, где разбиралось это утверждение.`,
            level,
            topic: b.topic,
          });
        });
      });
    });
  }

  /* ---------- level C: two concepts + a linking statement ---------- */
  if (level === 'C') {
    blocks.forEach((b) => {
      const terms = keyTerms(b);
      b.sentences.forEach((fact) => {
        const inside = terms.filter((t) => fact.includes(t));
        if (inside.length < 2) return;
        const [t1, t2] = inside;
        const others = all
          .filter((s) => s !== fact && !(terms.some((t) => s.includes(t)) && s.includes(t1) && s.includes(t2)))
          .slice(0, 3);
        if (others.length < 3) return;
        C_PHRASES.slice(0, 2).forEach((ph) => {
          const options = shuffle([fact, ...others]);
          push({
            id: uid('q'),
            q: ph(t1, t2, b.topic),
            options,
            answer: options.indexOf(fact),
            explanation: `Верно: ${fact}`,
            hint: `Ищите утверждение, где эти два понятия связаны между собой.`,
            level,
            topic: b.topic,
          });
        });
      });
    });
    /* C: combined topics — one statement covering two sections */
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const t1s = keyTerms(blocks[i]);
        const t2s = keyTerms(blocks[j]);
        const both = all.find((s) => t1s.some((a) => s.includes(a)) && t2s.some((b) => s.includes(b)));
        if (!both) continue;
        const near = all.filter((s) => s !== both && (t1s.some((a) => s.includes(a)) || t2s.some((b) => s.includes(b)))).slice(0, 3);
        if (near.length < 3) continue;
        X_PHRASES.slice(0, 2).forEach((ph) => {
          const options = shuffle([both, ...near]);
          push({
            id: uid('q'),
            q: ph(blocks[i].topic, blocks[j].topic),
            options,
            answer: options.indexOf(both),
            explanation: `Только это утверждение связывает обе темы: ${both}`,
            hint: `Проверьте, какая формулировка затрагивает обе темы сразу.`,
            level,
            topic: `${blocks[i].topic} + ${blocks[j].topic}`,
          });
        });
      }
    }
  }

  /* ---------- fallback: attribution ---------- */
  if (out.length < count) {
    blocks.forEach((b) => {
      b.sentences.slice(0, 6).forEach((fact) => {
        const others = all.filter((s) => s !== fact && !b.sentences.includes(s)).slice(0, 3);
        if (others.length < 3) return;
        const options = shuffle([fact, ...others]);
        push({
          id: uid('q'),
          q: `Какое утверждение относится к теме «${b.topic}»?`,
          options,
          answer: options.indexOf(fact),
          explanation: `Верно: ${fact}`,
          hint: `Вспомните, что говорится о теме «${b.topic}».`,
          level,
          topic: b.topic,
        });
      });
    });
  }

  return shuffle(out).slice(0, count);
}

export function localCards(text: string, count: number): Card[] {
  const blocks = splitBlocks(text);
  const out: Card[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    for (const term of keyTerms(b)) {
      const h = hash(norm(term));
      if (seen.has(h)) continue;
      const def = b.sentences.find((s) => s.includes(term));
      if (!def) continue;
      seen.add(h);
      out.push({
        id: uid('c'),
        front: term,
        back: def,
        hint: `Тема: ${b.topic}`,
        level: 'A',
        topic: b.topic,
      });
      if (out.length >= count) return out;
    }
  }
  // fallback: sentence-front cards
  for (const b of blocks) {
    for (const s of b.sentences) {
      out.push({
        id: uid('c'),
        front: s.slice(0, 120),
        back: `Это утверждение относится к теме «${b.topic}».`,
        level: 'A',
        topic: b.topic,
      });
      if (out.length >= count) return out;
    }
  }
  return out.slice(0, count);
}

export function localNote(text: string, subjectRu: string, topics: PlanTopic[]): { title: string; markdown: string } {
  const blocks = splitBlocks(text);
  let md = `## Ключевые понятия\n\n`;
  const terms = Array.from(new Set(blocks.flatMap((b) => keyTerms(b)))).slice(0, 24);
  if (terms.length) md += terms.map((t) => `- **${t}**`).join('\n') + '\n\n';
  md += `## Разбор по темам\n\n`;
  for (const b of blocks.slice(0, 14)) {
    md += `### ${b.topic}\n\n`;
    md += b.sentences.slice(0, 7).map((s) => `- ${s}`).join('\n') + '\n\n';
  }
  return { title: `Конспект: ${subjectRu}`, markdown: md };
}
