import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, Flag, Lightbulb, RotateCcw, XCircle } from 'lucide-react';
import { useStore } from '../store';
import { Level, Question, TestRun } from '../lib/types';
import { LevelBadge, Ring } from './ui';
import { fig } from '../lib/markdown';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function TestRunner({ testId, onExit }: { testId: string; onExit: () => void }) {
  const { data, updateTest, addMistake, bump } = useStore();
  const test = data.tests.find((t) => t.id === testId);
  const [filter, setFilter] = useState<'ALL' | Level>('ALL');
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [showRes, setShowRes] = useState(!!test?.finishedAt);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    started.current = Date.now();
  }, [testId]);

  const questions = useMemo(() => (test ? test.questions : []), [test]);
  const answers = test?.answers || [];
  const hints = test?.hints || [];

  const visible = useMemo(() => {
    let list = questions;
    if (filter !== 'ALL') list = list.filter((q) => q.level === filter);
    if (onlyWrong && test?.finishedAt) list = list.filter((q) => questions.indexOf(q) >= 0 && answers[questions.indexOf(q)] !== q.answer);
    return list;
  }, [questions, filter, onlyWrong, test?.finishedAt, answers]);

  const [cur, setCur] = useState(0);

  if (!test) {
    return (
      <div className="card">
        Тест не найден.
        <button className="btn-ghost mt-3" onClick={onExit}>
          Назад
        </button>
      </div>
    );
  }

  const activeIdx = visible.length ? Math.min(cur, visible.length - 1) : -1;
  const q: Question | undefined = activeIdx >= 0 ? visible[activeIdx] : undefined;
  const realIdx = q ? questions.findIndex((x) => x.id === q.id) : -1;
  const answeredCount = answers.filter((a) => a !== null).length;

  const answer = (k: number) => {
    if (test.finishedAt) return;
    updateTest(test.id, { answers: answers.map((a, i) => (i === realIdx ? k : a)) });
  };

  const useHint = () => {
    if (test.finishedAt || !q?.hint) return;
    updateTest(test.id, { hints: hints.map((h, i) => (i === realIdx ? (h || 0) + 1 : h)) });
  };

  const finish = () => {
    const ok = questions.filter((qq, i) => answers[i] === qq.answer).length;
    let pts = 0;
    questions.forEach((qq, i) => {
      if (answers[i] === qq.answer) pts += Math.max(1, 5 - 2 * (hints[i] || 0));
      else if (answers[i] !== null) addMistake(qq, test.subjectId);
    });
    const wasPaid = (test as any).paid;
    updateTest(test.id, {
      finishedAt: Date.now(),
      score: Math.round((ok / questions.length) * 100),
      points: wasPaid ? test.points : pts,
      ...(wasPaid ? {} : { paid: 1 }),
    } as any);
    if (!wasPaid) bump(pts);
    setConfirmFinish(false);
    setShowRes(true);
    setCur(0);
  };

  if (showRes && test.finishedAt) {
    const ok = questions.filter((qq, i) => answers[i] === qq.answer).length;
    const mins = Math.max(1, Math.round((test.finishedAt - test.createdAt) / 60000));
    return (
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-3 py-8 text-center">
          <Ring value={ok / Math.max(1, questions.length)} size={128} stroke={11} />
          <div className="text-lg font-extrabold">
            {ok} из {questions.length} верно · {Math.round((ok / Math.max(1, questions.length)) * 100)}%
          </div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            {mins} мин · +{test.points || 0} ⭐ {test.adaptiveReason ? `· ${test.adaptiveReason}` : ''}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {(['A', 'B', 'C'] as Level[]).map((l) => {
              const sub = questions.filter((x) => x.level === l);
              if (!sub.length) return null;
              const r = sub.filter((x, i) => answers[questions.indexOf(x)] === x.answer).length;
              return (
                <span key={l} className="chip">
                  <LevelBadge level={l} size="sm" /> {r}/{sub.length}
                </span>
              );
            })}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />
            Показать только ошибки
          </label>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button className="btn" onClick={onExit}>
              К списку тестов
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                updateTest(test.id, { answers: questions.map(() => null), hints: questions.map(() => 0), finishedAt: undefined, score: undefined });
                setShowRes(false);
                setCur(0);
                started.current = Date.now();
              }}
            >
              <RotateCcw size={15} /> Пройти заново
            </button>
          </div>
        </div>

        {visible.map((qq) => {
          const i = questions.findIndex((x) => x.id === qq.id);
          const good = answers[i] === qq.answer;
          return (
            <div key={qq.id} className="card" style={{ borderColor: good ? 'color-mix(in srgb,var(--ok) 40%, var(--border))' : 'color-mix(in srgb,var(--bad) 40%, var(--border))' }}>
              <div className="mb-2 flex items-center gap-2">
                <LevelBadge level={qq.level} size="sm" />
                <span className="text-[11.5px] font-bold" style={{ color: 'var(--muted)' }}>
                  {i + 1}. {qq.topic}
                </span>
                {good ? (
                  <CheckCircle2 size={16} className="ml-auto" style={{ color: 'var(--ok)' }} />
                ) : (
                  <XCircle size={16} className="ml-auto" style={{ color: 'var(--bad)' }} />
                )}
              </div>
              <div className="text-[15px] font-semibold leading-snug">{qq.q}</div>
              {qq.figure && <div className="mt-2" dangerouslySetInnerHTML={{ __html: fig(qq.figure) }} />}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {LETTERS.map((L, k) => (
                  <div
                    key={L}
                    className="rounded-xl border px-3 py-2 text-[13px]"
                    style={{
                      borderColor: k === qq.answer ? 'var(--ok)' : answers[i] === k ? 'var(--bad)' : 'var(--border)',
                      background: k === qq.answer ? 'color-mix(in srgb,var(--ok) 12%, transparent)' : answers[i] === k ? 'color-mix(in srgb,var(--bad) 12%, transparent)' : 'var(--surface)',
                    }}
                  >
                    <b style={{ color: 'var(--muted)' }}>{L}.</b> {qq.options[k]}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[13px]" style={{ color: 'var(--muted)' }}>
                💡 {qq.explanation || 'Объяснение не указано'}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 !py-3">
        <div className="min-w-0">
          <div className="truncate font-extrabold">{test.title}</div>
          <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
            {answeredCount} / {questions.length} · {visible.length} в фильтре
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(['ALL', 'A', 'B', 'C'] as const).map((f) => (
            <button key={f} className="chip" onClick={() => { setFilter(f as any); setCur(0); }} style={filter === f ? { background: 'linear-gradient(135deg,var(--a1),var(--a2))', color: '#06131a', borderColor: 'transparent' } : undefined}>
              {f === 'ALL' ? 'Все' : <LevelBadge level={f} size="sm" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            onClick={() => {
              const idx = visible.findIndex((v) => v.id === qq.id);
              if (idx >= 0) setCur(idx);
            }}
            className="grid h-8 w-8 place-items-center rounded-lg text-[11px] font-extrabold transition"
            style={{
              background:
                test.finishedAt === undefined && answers[i] !== null
                  ? 'color-mix(in srgb,var(--ok) 26%, transparent)'
                  : 'var(--surface2)',
              border: `1px solid ${qq.level === 'C' ? 'color-mix(in srgb,var(--lC) 55%, transparent)' : qq.level === 'B' ? 'color-mix(in srgb,var(--lB) 45%, transparent)' : 'color-mix(in srgb,var(--lA) 40%, transparent)'}`,
              color: answers[i] !== null && !test.finishedAt ? 'var(--ok)' : 'var(--muted)',
              opacity: filter !== 'ALL' && qq.level !== filter ? 0.4 : 1,
            }}
            title={`Уровень ${qq.level}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {q ? (
        <div className="card">
          <div className="mb-2 flex items-center gap-2">
            <LevelBadge level={q.level} size="sm" />
            <span className="text-[11.5px] font-bold" style={{ color: 'var(--muted)' }}>
              {realIdx + 1} · {q.topic}
            </span>
          </div>
          <div className="text-[17px] font-semibold leading-snug">{q.q}</div>
          {q.figure && <div className="mt-3" dangerouslySetInnerHTML={{ __html: fig(q.figure) }} />}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {LETTERS.map((L, k) => {
              const sel = answers[realIdx] === k;
              return (
                <button
                  key={L}
                  data-opt={L}
                  onClick={() => answer(k)}
                  className="opt-btn flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left transition active:scale-[.99]"
                  style={{
                    borderColor: sel ? 'var(--a2)' : 'var(--border)',
                    background: sel ? 'color-mix(in srgb,var(--a2) 14%, transparent)' : 'var(--surface)',
                  }}
                >
                  <b className="shrink-0" style={{ color: sel ? 'var(--a2)' : 'var(--muted)' }}>
                    {L}
                  </b>
                  <span className="text-[14px] leading-snug">{q.options[k]}</span>
                </button>
              );
            })}
          </div>

          {hints[realIdx] > 0 && (
            <div className="mt-3 rounded-2xl border p-3 text-[13px]" style={{ borderColor: 'color-mix(in srgb,var(--warn) 45%, transparent)', background: 'color-mix(in srgb,var(--warn) 10%, transparent)' }}>
              💡 {q.hint}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {q.hint && hints[realIdx] === 0 && (
              <button className="btn-ghost" onClick={useHint}>
                <Lightbulb size={15} /> Подсказка
              </button>
            )}
            {hints[realIdx] > 0 && (
              <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                подсказки уменьшают очки
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button data-nav="prev" className="btn-ghost" disabled={activeIdx <= 0} onClick={() => setCur((c) => Math.max(0, c - 1))}>
                <ChevronLeft size={16} /> Назад
              </button>
              <button data-nav="next" className="btn" disabled={activeIdx >= visible.length - 1} onClick={() => setCur((c) => Math.min(visible.length - 1, c + 1))}>
                Далее <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center" style={{ color: 'var(--muted)' }}>
          Нет вопросов для этого фильтра.
        </div>
      )}

      {!confirmFinish ? (
        <button className="btn w-full" onClick={() => setConfirmFinish(true)}>
          <Flag size={16} /> Завершить тест
        </button>
      ) : (
        <div className="card flex flex-wrap items-center gap-3">
          <div className="text-sm">
            Без ответа: <b>{questions.length - answeredCount}</b>. Завершить тест?
          </div>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={() => setConfirmFinish(false)}>
              Отмена
            </button>
            <button className="btn" onClick={finish}>
              Завершить
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button className="chip" onClick={onExit}>
          <Eye size={13} /> Выйти к списку
        </button>
      </div>
    </div>
  );
}
