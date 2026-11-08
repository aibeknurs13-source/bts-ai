import { useEffect, useRef, useState } from 'react';
import { BookOpenCheck, BrainCircuit, FileUp, Github, Layers, Sparkles, Star } from 'lucide-react';
import { useStore } from '../store';
import { useToast } from './ui';

const jwtDecode = (t: string) => {
  const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(p)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );
  return JSON.parse(json);
};

function loadGsi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('gsi'));
    document.head.appendChild(s);
  });
}

const FEATURES = [
  { icon: Sparkles, title: 'ИИ-генератор', text: 'Тесты, карточки и конспекты по вашим файлам — без повторов' },
  { icon: Layers, title: 'Уровни A / B / C', text: 'От базовых фактов до многошаговых задач повышенной сложности' },
  { icon: FileUp, title: '+ и PDF', text: 'PDF, DOCX, PPTX, таблицы и картинки — ИИ прочитает всё' },
  { icon: BrainCircuit, title: 'Адаптивность', text: 'ИИ видит ваши ошибки и подбирает сложность и темы' },
];

export default function Auth() {
  const { signIn, settings } = useStore();
  const toast = useToast();
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [gsiError, setGsiError] = useState(false);
  const cid = settings.googleClientId;

  useEffect(() => {
    let alive = true;
    if (!cid || cid.indexOf('apps.googleusercontent.com') < 0) {
      setReady(true);
      return;
    }
    const guard = setTimeout(() => {
      if (!(window as any).google?.accounts?.id) {
        setGsiError(true);
        setReady(true);
      }
    }, 6000);
    loadGsi()
      .then(() => {
        if (!alive || !box.current) return;
        const g = (window as any).google;
        g.accounts.id.initialize({
          client_id: cid,
          callback: (r: any) => {
            try {
              const p = jwtDecode(r.credential);
              signIn({
                em: p.email,
                name: p.name || p.email.split('@')[0],
                pic: p.picture || '',
              });
              toast(`С возвращением, ${p.name || p.email.split('@')[0]}!`, 'ok');
            } catch {
              toast('Не удалось разобрать ответ Google', 'err');
            }
          },
          auto_select: false,
        });
        box.current.innerHTML = '';
        g.accounts.id.renderButton(box.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          width: 320,
          text: 'continue_with',
          locale: 'ru',
        });
        setReady(true);
      })
      .catch(() => {
        setGsiError(true);
        setReady(true);
      })
      .finally(() => clearTimeout(guard));
    return () => {
      alive = false;
      clearTimeout(guard);
    };
  }, [cid, signIn, toast]);

  const guest = () => signIn({ em: 'guest', name: 'Гость', pic: '' });

  return (
    <div className="min-h-full px-4 py-8 sm:py-14">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
        <div className="rise">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <Star size={13} style={{ color: 'var(--a3)' }} />
            Полностью бесплатно · без подписки
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.08] sm:text-5xl">
            БТС <span style={{ background: 'linear-gradient(135deg,var(--a1),var(--a2))', WebkitBackgroundClip: 'text', color: 'transparent' }}>AI</span>
            <br />
            <span className="text-3xl sm:text-4xl" style={{ color: 'var(--muted)' }}>
              умная подготовка к экзамену
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Загрузите свои материалы — ИИ прочитает PDF, презентации и документы, а затем сделает{' '}
            <b style={{ color: 'var(--text)' }}>тесты, карточки и конспект</b>. Три уровня сложности, ноль повторов, адаптация под ваши ошибки.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-center gap-2 rounded-2xl border px-3.5 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <f.icon size={16} style={{ color: 'var(--a1)' }} />
                <span className="text-[13px] font-bold">{f.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rise" style={{ animationDelay: '.08s' }}>
          <div className="card !p-6 sm:!p-8">
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl text-2xl font-extrabold" style={{ background: 'linear-gradient(135deg,var(--a1),var(--a2))', color: '#06131a' }}>
              Б
            </div>
            <h2 className="text-xl font-extrabold">Войти в приложение</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              Прогресс, тесты и карточки привязываются к вашему аккаунту и остаются с вами.
            </p>

            <div className="mt-6 flex min-h-[44px] justify-center">
              {ready && cid && cid.indexOf('apps.googleusercontent.com') >= 0 && !gsiError ? (
                <div ref={box} />
              ) : ready ? (
                <div className="w-full">
                  <div
                    className="rounded-2xl border p-3.5 text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
                  >
                    {gsiError ? (
                      <>
                        Не удалось загрузить кнопку Google (нет доступа к accounts.google.com или неверный Client ID). Продолжите как гость — все функции работают, а вход можно будет включить позже в настройках.
                      </>
                    ) : (
                      <>
                        <b>Client ID Google не задан.</b> Укажите его в настройках приложения
                        (Настройки → Google Client ID) или продолжайте как гость — все функции работают.
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="shimmer h-11 w-64 rounded-full" />
              )}
            </div>

            <button className="btn-ghost mt-3 w-full" onClick={guest}>
              Продолжить как гость →
            </button>

            <ul className="mt-6 space-y-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>
              <li className="flex gap-2">
                <BookOpenCheck size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} />
                Данные хранятся локально в браузере (IndexedDB) — можно экспортировать в файл.
              </li>
              <li className="flex gap-2">
                <Github size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--a2)' }} />
                ИИ работает на бесплатных моделях: Gemini free tier, OpenRouter free или локальный Ollama.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
