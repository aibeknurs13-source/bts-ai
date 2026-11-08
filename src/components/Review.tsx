import { useMemo, useState } from 'react';
import { BrainCircuit, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { useStore } from '../store';
import { LevelBadge } from './ui';
import { fmtDate } from '../lib/util';

const WI = [600000, 86400000, 259200000];

export default function Review({ subjectId, onExit }: { subjectId?: string; onExit: () => void }) {
  const { data, updateMistake, clearMistake, bump } = useStore();
  const [now, setNow] = useState(Date.now());
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(
    () => data.mistakes.filter((m) => (subjectId ? m.subjectId === subjectId : true)),
    [data.mistakes, subjectId],
  );
  const due = useMemo(() => list.filter((m) => m.due <= now), [list, now]);
  const queue = showAll ? list : due;
  const item = queue[idx % Math.max(1, queue.length)];

  const pick = (k: number) => {
    if (!item || picked !== null) return;
    setPicked(k);
    const ok = k === item.question.answer;
    const boxes = item.box;
    if (ok) {
      if (boxes + 1 >= WI.length) {
        clearMistake(item.id);
      } else {
        updateMistake(item.id, { box: boxes + 1, due: Date.now() + WI[boxes + 1] });
      }
      bump(Math.max(1, 3 - boxes));
    } else {
      updateMistake(item.id, { box: 0, due: Date.now() + WI[0] });
    }
  };

  const next = () => {
    setPicked(null);
    setIdx((i) => i + 1);
  };

  if (!list.length) {
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <BrainCircuit size={34} style={{ color: 'var(--ok)' }} />
        <div className="text-lg font-extrabold">Ошибок пока нет</div>
        <div className="max-w-sm text-sm" style={{ color: 'var(--muted)' }}>
          Здесь появятся вопросы, на которых вы ошиблись. Они вернутся через 10 минут, затем через 1 день и через 3 дня — это интервальное повторение.
        </div>
        <button className="btn-ghost" onClick={onExit}>
          Назад
        </button>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <div className="text-3xl">👍</div>
        <div className="text-lg font-extrabold">Пока всё повторено</div>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          В очереди: {list.length}. Ближайший повтор: {fmtDate(Math.min(...list.map((m) => m.due)))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            className="btn"
            onClick={() => {
              list.forEach((m) => updateMistake(m.id, { due: 0 }));
              setNow(Date.now() + 1);
              setIdx(0);
            }}
          >
            <RotateCcw size={15} /> Повторить всё сейчас
          </button>
          <button className="btn-ghost" onClick={onExit}>
            Назад
          </button>
        </div>
      </div>
    );
  }

  const q = item.question;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 !py-3">
        <div>
          <div className="font-extrabold">Повтор ошибок</div>
          <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
            В очереди: {list.length} · к повтору сейчас: {due.length}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="chip" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Только к повтору' : 'Показать все'}
          </button>
          <button className="chip" onClick={onExit}>
            Выйти
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex items-center gap-2">
          <LevelBadge level={q.level} size="sm" />
          <span className="text-[11.5px] font-bold" style={{ color: 'var(--muted)' }}>
            {q.topic} · повтор {item.box + 1}/3
          </span>
        </div>
        <div className="text-[17px] font-semibold leading-snug">{q.q}</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {['A', 'B', 'C', 'D'].map((L, k) => {
            const isRight = k === q.answer;
            const isSel = picked === k;
            return (
              <button
                key={L}
                onClick={() => pick(k)}
                disabled={picked !== null}
                className="flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left transition"
                style={{
                  borderColor: picked === null ? 'var(--border)' : isRight ? 'var(--ok)' : isSel ? 'var(--bad)' : 'var(--border)',
                  background: picked === null ? 'var(--surface)' : isRight ? 'color-mix(in srgb,var(--ok) 14%, transparent)' : isSel ? 'color-mix(in srgb,var(--bad) 14%, transparent)' : 'var(--surface)',
                  opacity: picked !== null && !isRight && !isSel ? 0.55 : 1,
                }}
              >
                <b className="shrink-0" style={{ color: 'var(--muted)' }}>
                  {L}
                </b>
                <span className="text-[14px] leading-snug">{q.options[k]}</span>
              </button>
            );
          })}
        </div>

        {picked !== null && (
          <div className="mt-3 flex items-center gap-2 text-[13px]">
            {picked === q.answer ? <CheckCircle2 size={16} style={{ color: 'var(--ok)' }} /> : <XCircle size={16} style={{ color: 'var(--bad)' }} />}
            <span>
              {picked === q.answer ? 'Верно! Верный ответ: ' : 'Неверно. Верный ответ: '}
              <b>
                {['A', 'B', 'C', 'D'][q.answer]}. {q.options[q.answer]}
              </b>
            </span>
          </div>
        )}
        {q.explanation && (
          <div className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>
            💡 {q.explanation}
          </div>
        )}

        {picked !== null && (
          <button className="btn mt-4 w-full" onClick={next}>
            Дальше →
          </button>
        )}
      </div>
    </div>
  );
}
