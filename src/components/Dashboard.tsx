import { useMemo } from 'react';
import { BrainCircuit, Flame, LayoutDashboard, Star, Target, TrendingUp } from 'lucide-react';
import { useStore } from '../store';
import { Route } from '../nav';
import { LevelBadge, Ring } from './ui';
import { Level } from '../lib/types';

export default function Dashboard({ go }: { go: (r: Route) => void }) {
  const { data, mastery } = useStore();
  const p = data.profile;

  const perSubject = useMemo(
    () =>
      data.subjects.map((s) => {
        const tests = data.tests.filter((t) => t.subjectId === s.id && t.finishedAt);
        const qs = tests.reduce((a, t) => a + t.questions.length, 0);
        const ok = tests.reduce((a, t) => a + t.questions.filter((qq, i) => t.answers[i] === qq.answer).length, 0);
        const wrong = data.mistakes.filter((m) => m.subjectId === s.id).length;
        const decks = data.decks.filter((d) => d.subjectId === s.id);
        const notes = data.notes.filter((n) => n.subjectId === s.id);
        return { s, tests: tests.length, acc: qs ? Math.round((ok / qs) * 100) : 0, wrong, decks: decks.length, notes: notes.length };
      }),
    [data],
  );

  const history = data.tests.filter((t) => t.finishedAt).slice(0, 12).reverse();

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-5">
        <Ring value={mastery.byLevel.C.right / Math.max(1, mastery.byLevel.C.right + mastery.byLevel.C.wrong)} size={110} stroke={10} label={`${Math.round(mastery.acc.C * 100)}%`} />
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold">Прогресс</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>
            Очки и серия общие для всех предметов. Кольцо показывает освоение уровня C — самого сложного.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip">
              <Flame size={12} style={{ color: 'var(--a3)' }} /> {p.streak} дней
            </span>
            <span className="chip">
              <Star size={12} style={{ color: 'var(--a2)' }} /> {p.points} очков
            </span>
            <span className="chip">
              <Target size={12} style={{ color: 'var(--ok)' }} /> лучшая серия {p.best}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['A', 'B', 'C'] as Level[]).map((l) => {
          const m = mastery.byLevel[l];
          const total = m.right + m.wrong;
          const pct = total ? Math.round((m.right / total) * 100) : 0;
          return (
            <div key={l} className="card">
              <div className="flex items-center gap-2">
                <LevelBadge level={l} />
                <b>Уровень {l}</b>
                <span className="ml-auto text-lg font-extrabold" style={{ color: l === 'A' ? 'var(--lA)' : l === 'B' ? 'var(--lB)' : 'var(--lC)' }}>
                  {total ? `${pct}%` : '—'}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface3)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: l === 'A' ? 'var(--lA)' : l === 'B' ? 'var(--lB)' : 'var(--lC)' }} />
              </div>
              <div className="mt-1.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>
                верно {m.right} · ошибок {m.wrong}
              </div>
            </div>
          );
        })}
      </div>

      {mastery.weakTopics.length > 0 && (
        <div className="card">
          <div className="mb-2 flex items-center gap-2">
            <BrainCircuit size={16} style={{ color: 'var(--a3)' }} />
            <b>Слабые места</b>
          </div>
          <div className="flex flex-wrap gap-2">
            {mastery.weakTopics.map((t) => (
              <span key={t} className="chip" style={{ borderColor: 'color-mix(in srgb,var(--warn) 45%, transparent)', color: 'var(--warn)' }}>
                {t}
              </span>
            ))}
          </div>
          <div className="mt-3 text-[12.5px]" style={{ color: 'var(--muted)' }}>
            В адаптивном режиме ИИ добавит вопросы именно по этим темам.
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-extrabold">По предметам</h3>
          </div>
          <div className="space-y-2">
            {perSubject.map(({ s, tests, acc, wrong, decks, notes }) => (
              <button
                key={s.id}
                onClick={() => go({ k: 'subject', id: s.id, tab: 'test' })}
                className="flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb,${s.color} 20%, transparent)`, color: s.color }}>
                  {s.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-extrabold">{s.ru}</div>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    тестов {tests} · карточек {decks} · конспектов {notes} · ошибок {wrong}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-extrabold" style={{ color: 'var(--muted)' }}>
                  {tests ? `${acc}%` : '—'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={16} style={{ color: 'var(--a1)' }} />
            <h3 className="font-extrabold">История тестов</h3>
          </div>
          {history.length ? (
            <div className="flex items-end gap-1.5" style={{ height: 130 }}>
              {history.map((t) => (
                <div key={t.id} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max(6, (t.score || 0) * 0.95)}px`,
                      background: 'linear-gradient(180deg,var(--a1),var(--a2))',
                      opacity: 0.85,
                    }}
                    title={`${t.score}%`}
                  />
                  <span className="text-[9.5px]" style={{ color: 'var(--muted)' }}>
                    {t.score}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm" style={{ color: 'var(--muted)' }}>
              <LayoutDashboard size={18} className="mr-2" /> Здесь появится история ваших тестов
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
