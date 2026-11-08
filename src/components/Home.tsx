import { useMemo } from 'react';
import { ArrowRight, Flame, FolderOpen, GraduationCap, LayoutDashboard, Library, Plus, Sparkles, Star, Target } from 'lucide-react';
import { useStore } from '../store';
import { Route } from '../nav';
import { Empty, LevelBadge, Stat } from './ui';
import { fmtDate, formatBytes } from '../lib/util';

export default function Home({ go, openUploader, openGenerator }: { go: (r: Route) => void; openUploader: () => void; openGenerator: (subjectId?: string) => void }) {
  const { data, mastery, user } = useStore();
  const p = data.profile;

  const totals = useMemo(() => {
    const tests = data.tests.filter((t) => t.finishedAt);
    const q = tests.reduce((a, t) => a + t.questions.length, 0);
    const ok = tests.reduce((a, t) => a + t.questions.filter((qq, i) => t.answers[i] === qq.answer).length, 0);
    return { tests: tests.length, q, acc: q ? Math.round((ok / q) * 100) : 0 };
  }, [data.tests]);

  const recentTest = data.tests.find((t) => !t.finishedAt) || data.tests[0];
  const recentMat = data.materials.slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-4 !p-5">
        <div className="min-w-0">
          <div className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
            С возвращением{user && user.name !== 'Гость' ? ', ' + user.name : ''} 👋
          </div>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Готов к экзамену?</h1>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--muted)' }}>
            Загрузи материалы — ИИ сделает тесты, карточки и конспект. Без повторов, три уровня сложности.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn" onClick={() => openGenerator()}>
            <Sparkles size={16} /> ИИ-генератор
          </button>
          <button className="btn-ghost" onClick={openUploader}>
            <Plus size={16} /> Добавить файл
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Flame size={18} />} value={p.streak} label="дней подряд" accent="var(--a3)" />
        <Stat icon={<Star size={18} />} value={p.points} label="очков" accent="var(--a2)" />
        <Stat icon={<Target size={18} />} value={`${totals.acc}%`} label="точность" accent="var(--a1)" />
        <Stat icon={<GraduationCap size={18} />} value={totals.tests} label="тестов пройдено" accent="var(--ok)" />
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-extrabold">Предметы</h2>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {data.subjects.length}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.subjects.map((s) => {
            const mats = data.materials.filter((m) => m.subjectId === s.id).length;
            const tests = data.tests.filter((t) => t.subjectId === s.id);
            const done = tests.filter((t) => t.finishedAt);
            const acc = done.length ? Math.round(done.reduce((a, t) => a + (t.score || 0), 0) / done.length) : null;
            return (
              <button
                key={s.id}
                onClick={() => go({ k: 'subject', id: s.id, tab: 'test' })}
                className="card group text-left transition hover:-translate-y-0.5"
                style={{ borderColor: `color-mix(in srgb,${s.color} 35%, var(--border))` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl"
                    style={{ background: `color-mix(in srgb,${s.color} 20%, transparent)`, color: s.color }}
                  >
                    {s.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-extrabold">{s.ru}</div>
                    <div className="truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
                      {s.name}
                    </div>
                  </div>
                  <ArrowRight size={16} className="ml-auto shrink-0 opacity-0 transition group-hover:opacity-70" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="chip">
                    <FolderOpen size={11} /> {mats} файлов
                  </span>
                  <span className="chip">
                    <Library size={11} /> {tests.length} тестов
                  </span>
                  {acc !== null && <span className="chip">{acc}%</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-extrabold">Продолжить</h3>
          </div>
          {recentTest ? (
            <button className="w-full text-left" onClick={() => go({ k: 'test', id: recentTest.id })}>
              <div className="flex items-center gap-2">
                <b>{recentTest.title}</b>
                <span className="chip ml-auto">{recentTest.finishedAt ? `${recentTest.score}%` : 'в процессе'}</span>
              </div>
              <div className="mt-1 text-[11.5px]" style={{ color: 'var(--muted)' }}>
                {recentTest.questions.length} вопросов · {fmtDate(recentTest.createdAt)}
              </div>
            </button>
          ) : (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              Тестов пока нет — сгенерируйте первый.
            </div>
          )}
          {data.mistakes.length > 0 && (
            <button className="mt-3 w-full rounded-2xl border px-3.5 py-3 text-left text-sm transition" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} onClick={() => go({ k: 'review' })}>
              🔁 Повторить ошибки: {data.mistakes.length} в очереди
            </button>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-extrabold">Уровни</h3>
            <button className="chip ml-auto" onClick={() => go({ k: 'dash' })}>
              <LayoutDashboard size={12} /> Прогресс
            </button>
          </div>
          <div className="space-y-2">
            {(['A', 'B', 'C'] as const).map((l) => {
              const m = mastery.byLevel[l];
              const total = m.right + m.wrong;
              const pct = total ? Math.round((m.right / total) * 100) : 0;
              return (
                <div key={l} className="flex items-center gap-3">
                  <LevelBadge level={l} />
                  <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface3)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: l === 'A' ? 'var(--lA)' : l === 'B' ? 'var(--lB)' : 'var(--lC)' }} />
                  </div>
                  <span className="w-14 text-right text-[12px] font-bold" style={{ color: 'var(--muted)' }}>
                    {total ? `${pct}% (${total})` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-extrabold">Материалы</h3>
          <button className="chip ml-auto" onClick={openUploader}>
            <Plus size={12} /> Добавить
          </button>
        </div>
        {recentMat.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {recentMat.map((m) => (
              <button
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                onClick={() => go({ k: 'subject', id: m.subjectId, tab: 'note' })}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold uppercase" style={{ background: 'var(--surface2)' }}>
                  {m.kind.slice(0, 4)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold">{m.name}</div>
                  <div className="truncate text-[11px]" style={{ color: 'var(--muted)' }}>
                    {formatBytes(m.size)} · {m.text ? `${m.text.length} симв.` : 'изображение'} · {fmtDate(m.createdAt)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            icon={<FolderOpen size={24} />}
            title="Файлов пока нет"
            text="Нажмите «+» или «Добавить файл», чтобы загрузить PDF, DOCX, презентацию или таблицу — ИИ прочитает их целиком."
            action={
              <button className="btn" onClick={openUploader}>
                <Plus size={16} /> Загрузить файл
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
