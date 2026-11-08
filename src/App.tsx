import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Database, Flame, Home as HomeIcon, Library, LogOut, Plus, Settings as SettingsIcon, Sparkles, Star, User } from 'lucide-react';
import { StoreProvider, useStore } from './store';
import { ToastHost, Modal } from './components/ui';
import Auth from './components/Auth';
import Home from './components/Home';
import SubjectView from './components/SubjectView';
import TestRunner from './components/TestRunner';
import Flashcards from './components/Flashcards';
import NoteView from './components/NoteView';
import Review from './components/Review';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Uploader from './components/Uploader';
import Generator from './components/Generator';
import Calculator from './components/Calculator';
import BankView from './components/BankView';
import { Route } from './nav';
import { uid } from './lib/util';

function Shell() {
  const { user, data, signOut, settings, setSettings } = useStore();
  const [route, setRoute] = useState<Route>({ k: 'home' });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genSubject, setGenSubject] = useState<string>('');
  const [genPreset, setGenPreset] = useState<string[] | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(settings.calOpen);

  const go = (r: Route) => {
    setRoute(r);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!data.subjects.length) return;
    if (genSubject && !data.subjects.some((s) => s.id === genSubject)) setGenSubject(data.subjects[0].id);
    if (!genSubject) setGenSubject(data.subjects[0].id);
  }, [data.subjects, genSubject]);

  const openGenerator = (subjectId?: string, materialIds?: string[]) => {
    if (subjectId) setGenSubject(subjectId);
    else if (route.k === 'subject') setGenSubject(route.id);
    setGenPreset(materialIds);
    setGenOpen(true);
  };

  const openUploader = (subjectId?: string) => {
    if (subjectId) setGenSubject(subjectId);
    else if (route.k === 'subject') setGenSubject(route.id);
    setUploadOpen(true);
  };

  const p = data.profile;

  const page = useMemo(() => {
    switch (route.k) {
      case 'home':
        return <Home go={go} openUploader={() => openUploader()} openGenerator={() => openGenerator()} />;
      case 'subject':
        return (
          <SubjectView
            subjectId={route.id}
            tab={route.tab}
            go={go}
            openUploader={(id) => openUploader(id)}
            openGenerator={(id) => openGenerator(id)}
          />
        );
      case 'test':
        return <TestRunner testId={route.id} onExit={() => go({ k: 'subject', id: data.tests.find((t) => t.id === route.id)?.subjectId || data.subjects[0]?.id, tab: 'test' })} />;
      case 'cards':
        return <Flashcards deckId={route.id} onExit={() => go({ k: 'subject', id: data.decks.find((d) => d.id === route.id)?.subjectId || data.subjects[0]?.id, tab: 'cards' })} />;
      case 'note':
        return <NoteView noteId={route.id} onExit={() => go({ k: 'subject', id: data.notes.find((n) => n.id === route.id)?.subjectId || data.subjects[0]?.id, tab: 'note' })} />;
      case 'review':
        return <Review subjectId={(route as any).subjectId} onExit={() => go({ k: 'subject', id: (route as any).subjectId || data.subjects[0]?.id, tab: 'review' })} />;
      case 'dash':
        return <Dashboard go={go} />;
      case 'bank':
        return <BankView />;
      case 'settings':
        return <Settings />;
      default:
        return <Home go={go} openUploader={() => openUploader()} openGenerator={() => openGenerator()} />;
    }
  }, [route, data]);

  const navItem = (active: boolean, icon: React.ReactNode, label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13.5px] font-bold transition"
      style={{
        background: active ? 'linear-gradient(135deg,var(--a1),var(--a2))' : 'transparent',
        color: active ? '#06131a' : 'var(--muted)',
      }}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );

  return (
    <div className="min-h-full">
      {/* top bar */}
      <header
        className="sticky top-0 z-40 flex items-center gap-2 px-3 py-2.5 backdrop-blur-xl sm:px-5"
        style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)', borderBottom: '1px solid var(--border)' }}
      >
        <button className="flex items-center gap-2" onClick={() => go({ k: 'home' })}>
          <span className="grid h-9 w-9 place-items-center rounded-xl text-[15px] font-extrabold" style={{ background: 'linear-gradient(135deg,var(--a1),var(--a2))', color: '#06131a' }}>
            Б
          </span>
          <span className="hidden text-[15px] font-extrabold sm:inline">
            БТС <span style={{ color: 'var(--a1)' }}>AI</span>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button className="chip" onClick={() => go({ k: 'dash' })} title="Серия дней и очки">
            <Flame size={13} style={{ color: 'var(--a3)' }} />
            <span className="hidden sm:inline">{p.streak}</span>
            <Star size={12} style={{ color: 'var(--a2)' }} />
            <span className="hidden sm:inline">{p.points}</span>
          </button>
          <button className="chip" onClick={() => setMenuOpen(true)} title="Аккаунт">
            {user?.pic ? (
              <img src={user.pic} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <User size={14} />
            )}
            <span className="hidden max-w-[110px] truncate sm:inline">{user?.name}</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-4 px-3 pb-28 pt-4 sm:px-5 lg:pb-10">
        {/* desktop rail */}
        <aside className="hidden w-[210px] shrink-0 flex-col gap-1 lg:flex">
          {navItem(route.k === 'home', <HomeIcon size={17} />, 'Главная', () => go({ k: 'home' }))}
          {navItem(route.k === 'dash', <BarChart3 size={17} />, 'Прогресс', () => go({ k: 'dash' }))}
          {navItem(route.k === 'bank', <Library size={17} />, 'Банк вопросов', () => go({ k: 'bank' }))}
          {navItem(route.k === 'settings', <SettingsIcon size={17} />, 'Настройки', () => go({ k: 'settings' }))}
          <div className="my-2 h-px" style={{ background: 'var(--border)' }} />
          <div className="px-3 pb-1 text-[10.5px] font-extrabold uppercase tracking-[.14em]" style={{ color: 'var(--muted)' }}>
            Предметы
          </div>
          {data.subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => go({ k: 'subject', id: s.id, tab: 'test' })}
              className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-[13px] font-semibold transition hover:bg-[var(--surface2)]"
              style={{ color: route.k === 'subject' && route.id === s.id ? s.color : 'var(--muted)' }}
            >
              <span className="text-base">{s.emoji}</span>
              <span className="truncate">{s.ru}</span>
            </button>
          ))}
          <button
            className="mt-1 flex items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-[13px] font-semibold"
            style={{ color: 'var(--muted)' }}
            onClick={() => setCalcOpen((v) => !v)}
          >
            <span className="text-base">🧮</span> Калькулятор
          </button>
        </aside>

        <main className="min-w-0 flex-1">{page}</main>
      </div>

      {/* mobile bottom bar */}
      <nav
        className="safe-b fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t px-2 py-1.5 backdrop-blur-xl lg:hidden"
        style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', borderColor: 'var(--border)' }}
      >
        <button onClick={() => go({ k: 'home' })} className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10.5px] font-bold" style={{ color: route.k === 'home' ? 'var(--a1)' : 'var(--muted)' }}>
          <HomeIcon size={19} />
          Главная
        </button>
        <button onClick={() => go({ k: 'dash' })} className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10.5px] font-bold" style={{ color: route.k === 'dash' ? 'var(--a1)' : 'var(--muted)' }}>
          <BarChart3 size={19} />
          Прогресс
        </button>
        <button
          onClick={() => openUploader()}
          className="grid h-12 w-12 -translate-y-4 place-items-center rounded-2xl text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg,var(--a1),var(--a2))', boxShadow: '0 10px 26px -6px var(--a2)' }}
          aria-label="Добавить файл"
        >
          <Plus size={24} />
        </button>
        <button onClick={() => openGenerator()} className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10.5px] font-bold" style={{ color: 'var(--a1)' }}>
          <Sparkles size={19} />
          ИИ
        </button>
        <button onClick={() => go({ k: 'settings' })} className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10.5px] font-bold" style={{ color: route.k === 'settings' ? 'var(--a1)' : 'var(--muted)' }}>
          <SettingsIcon size={19} />
          Ещё
        </button>
      </nav>

      {/* account menu */}
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Аккаунт">
        <div className="flex items-center gap-3">
          {user?.pic ? <img src={user.pic} alt="" className="h-12 w-12 rounded-2xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: 'var(--surface2)' }}><User size={20} /></div>}
          <div className="min-w-0">
            <div className="truncate font-extrabold">{user?.name}</div>
            <div className="truncate text-[12px]" style={{ color: 'var(--muted)' }}>
              {user?.em}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <button className="btn-ghost w-full" onClick={() => go({ k: 'settings' })}>
            <SettingsIcon size={16} /> Настройки ИИ и данных
          </button>
          <button className="btn-ghost w-full" onClick={() => go({ k: 'subject', id: data.subjects[0]?.id, tab: 'test' })}>
            <Library size={16} /> Мои предметы
          </button>
          <button className="btn-ghost w-full" onClick={() => go({ k: 'bank' })}>
            <Database size={16} /> Банк вопросов ({data.bank.length})
          </button>
          <button
            className="btn-ghost w-full"
            onClick={() => {
              setCalcOpen((v) => {
                setSettings({ calOpen: !v });
                return !v;
              });
              setMenuOpen(false);
            }}
          >
            🧮 Калькулятор
          </button>
          <button className="btn-ghost w-full" onClick={() => { signOut(); setMenuOpen(false); }}>
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </Modal>

      <Uploader
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        subjectId={genSubject}
        onSubjectChange={setGenSubject}
        onGenerate={(ids) => {
          setUploadOpen(false);
          setGenPreset(ids);
          setGenOpen(true);
        }}
      />

      <Generator
        open={genOpen}
        onClose={() => setGenOpen(false)}
        subjectId={genSubject}
        onSubjectChange={setGenSubject}
        presetMaterialIds={genPreset}
        onOpenSettings={() => {
          setGenOpen(false);
          go({ k: 'settings' });
        }}
        onDone={(kind, id) => {
          if (kind === 'test') go({ k: 'test', id });
          else if (kind === 'cards') go({ k: 'cards', id });
          else go({ k: 'note', id });
        }}
      />

      {calcOpen && <Calculator onClose={() => { setCalcOpen(false); setSettings({ calOpen: false }); }} />}
    </div>
  );
}

function Root() {
  const { user, ready } = useStore();
  if (!ready)
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--a1)' }} />
      </div>
    );
  return user ? <Shell /> : <Auth />;
}

export default function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }, []);
  return (
    <StoreProvider>
      <ToastHost>
        <Root />
      </ToastHost>
    </StoreProvider>
  );
}
