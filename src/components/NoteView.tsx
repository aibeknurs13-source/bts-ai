import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Lightbulb, PenLine, Printer, RotateCcw, XCircle } from 'lucide-react';
import { useStore } from '../store';
import { MiniTest, Question } from '../lib/types';
import { md, renderMath } from '../lib/markdown';
import { LevelBadge } from './ui';
import DrawingOverlay from './DrawingOverlay';

function MiniQuiz({ mt }: { mt: MiniTest }) {
  const { data, updateMini, addMistake, bump } = useStore();
  const st = data.mini[mt.id] || { a: {}, h: {}, best: 0, tries: 0 };
  const answered = Object.keys(st.a).length;

  const pick = (i: number, k: number) => {
    if (st.a[i] !== undefined) return;
    const ok = k === mt.questions[i].answer;
    updateMini(mt.id, (m) => {
      const next = { ...m, a: { ...m.a, [i]: k } };
      if (Object.keys(next.a).length === mt.questions.length) {
        const sc = mt.questions.filter((q, j) => next.a[j] === q.answer).length;
        next.best = Math.max(next.best || 0, Math.round((sc / mt.questions.length) * 100));
        next.tries = (next.tries || 0) + 1;
      }
      return next;
    });
    if (ok) bump(Math.max(2, 10 - 3 * (st.h[i] || 0)));
    else addMistake(mt.questions[i], '');
  };

  const hint = (i: number) =>
    updateMini(mt.id, (m) => ({ ...m, h: { ...m.h, [i]: Math.min(2, (m.h[i] || 0) + 1) } }));

  const done = answered === mt.questions.length;
  const score = mt.questions.filter((q, i) => st.a[i] === q.answer).length;

  return (
    <div className="card" style={{ borderColor: 'color-mix(in srgb,var(--a2) 45%, var(--border))', background: 'color-mix(in srgb,var(--a2) 6%, var(--surface))' }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <b>📝 {mt.title}</b>
        <span className="chip">
          {answered}/{mt.questions.length}
        </span>
        {st.best ? <span className="chip">лучший {st.best}%</span> : null}
      </div>
      {mt.questions.map((q: Question, i: number) => {
        const sel = st.a[i];
        const locked = sel !== undefined;
        return (
          <div key={q.id + i} className="border-t py-3 first:border-t-0" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-2 flex items-center gap-2">
              <LevelBadge level={q.level} size="sm" />
              <span className="text-[12.5px] font-semibold leading-snug">{q.q}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {['A', 'B', 'C', 'D'].map((L, k) => {
                const isRight = k === q.answer;
                const isSel = sel === k;
                return (
                  <button
                    key={L}
                    disabled={locked}
                    onClick={() => pick(i, k)}
                    className="flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition"
                    style={{
                      borderColor: locked ? (isRight ? 'var(--ok)' : isSel ? 'var(--bad)' : 'var(--border)') : 'var(--border)',
                      background: locked ? (isRight ? 'color-mix(in srgb,var(--ok) 12%, transparent)' : isSel ? 'color-mix(in srgb,var(--bad) 12%, transparent)' : 'transparent') : 'var(--surface)',
                      opacity: locked && !isRight && !isSel ? 0.5 : 1,
                    }}
                  >
                    <b style={{ color: 'var(--muted)' }}>{L}</b>
                    <span>{q.options[k]}</span>
                  </button>
                );
              })}
            </div>
            {locked && (
              <div className="mt-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>
                {sel === q.answer ? <CheckCircle2 size={14} className="mr-1 inline" style={{ color: 'var(--ok)' }} /> : <XCircle size={14} className="mr-1 inline" style={{ color: 'var(--bad)' }} />}
                {q.explanation}
              </div>
            )}
            {!locked && q.hint && (st.h[i] || 0) > 0 && (
              <div className="mt-2 text-[12.5px]" style={{ color: 'var(--warn)' }}>
                💡 {q.hint}
              </div>
            )}
            {!locked && q.hint && (st.h[i] || 0) === 0 && (
              <button className="chip mt-2" onClick={() => hint(i)}>
                <Lightbulb size={12} /> Подсказка
              </button>
            )}
          </div>
        );
      })}
      {done && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <b>
            {score}/{mt.questions.length} ({Math.round((score / mt.questions.length) * 100)}%)
          </b>
          <button
            className="chip"
            onClick={() => updateMini(mt.id, () => ({ a: {}, h: {}, best: st.best, tries: st.tries }))}
          >
            <RotateCcw size={12} /> Пройти заново
          </button>
        </div>
      )}
    </div>
  );
}

function MarkdownBlock({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => md(text), [text]);
  useEffect(() => {
    renderMath(ref.current);
  }, [html]);
  return <div ref={ref} className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function NoteView({ noteId, onExit }: { noteId: string; onExit: () => void }) {
  const { data, removeNote } = useStore();
  const note = data.notes.find((n) => n.id === noteId);
  const [drawing, setDrawing] = useState(false);

  const segments = useMemo(() => {
    if (!note) return [] as any[];
    const out: any[] = [];
    const re = /```quiz\n([\s\S]*?)```/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(note.markdown))) {
      if (m.index > last) out.push({ type: 'md', text: note.markdown.slice(last, m.index) });
      try {
        const parsed = JSON.parse(m[1]);
        const qs = (parsed.questions || []).map((q: any, i: number) => ({
          id: `mq${i}_${Math.random().toString(36).slice(2, 7)}`,
          q: q.q,
          options: q.options || [],
          answer: typeof q.answer === 'string' ? ['A', 'B', 'C', 'D'].indexOf(q.answer) : q.answer,
          explanation: q.explanation || '',
          hint: q.hint,
          level: q.level || 'A',
          topic: parsed.title || 'Тема',
        }));
        out.push({ type: 'quiz', id: parsed.id || parsed.title || 'mt', title: parsed.title || 'Мини-тест', questions: qs });
      } catch {
        /* ignore */
      }
      last = m.index + m[0].length;
    }
    if (last < note.markdown.length) out.push({ type: 'md', text: note.markdown.slice(last) });
    return out;
  }, [note]);

  if (!note) {
    return (
      <div className="card">
        Конспект не найден.
        <button className="btn-ghost mt-3" onClick={onExit}>
          Назад
        </button>
      </div>
    );
  }

  const extra = note.miniTests || [];

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 !py-3">
        <div className="min-w-0">
          <div className="truncate font-extrabold">{note.title}</div>
          <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
            {new Date(note.createdAt).toLocaleDateString('ru-RU')} · {extra.length} мини-тест(ов)
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="chip" onClick={() => setDrawing((v) => !v)} style={drawing ? { background: 'var(--a1)', color: '#06131a', borderColor: 'transparent' } : undefined}>
            <PenLine size={13} /> Рисовать
          </button>
          <button className="chip" onClick={() => window.print()}>
            <Printer size={13} /> Печать
          </button>
          <button
            className="chip"
            onClick={() => {
              if (confirm('Удалить конспект?')) {
                removeNote(note.id);
                onExit();
              }
            }}
          >
            Удалить
          </button>
        </div>
      </div>

      <div className="card">
        {segments.map((s, i) =>
          s.type === 'md' ? (
            <MarkdownBlock key={i} text={s.text} />
          ) : (
            <MiniQuiz key={'q' + i} mt={{ id: 'note_' + s.id, title: s.title, questions: s.questions }} />
          ),
        )}
        {extra.map((mt) => (
          <MiniQuiz key={mt.id} mt={mt} />
        ))}
      </div>

      <div className="flex justify-center">
        <button className="chip" onClick={onExit}>
          К списку конспектов
        </button>
      </div>

      <DrawingOverlay enabled={drawing} onToggle={setDrawing} storeKey={note.id} />
    </div>
  );
}
