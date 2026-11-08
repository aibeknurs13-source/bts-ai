import { useState } from 'react';
import { CheckCircle2, Download, Eye, EyeOff, KeyRound, Moon, Palette, RefreshCw, ShieldCheck, Sun, Trash2, Upload, Wifi } from 'lucide-react';
import { useStore } from '../store';
import { ProviderId } from '../lib/types';
import { Field, Switch, useToast } from './ui';
import { callAI, freeModels } from '../lib/ai';

const PROVIDERS: { id: ProviderId; name: string; desc: string; free: string }[] = [
  { id: 'gemini', name: 'Google Gemini', desc: 'Бесплатный tier в Google AI Studio. Лучшее качество, есть чтение изображений.', free: 'Бесплатно' },
  { id: 'openrouter', name: 'OpenRouter (free-модели)', desc: 'Модели с суффиксом :free — без оплаты и без карты.', free: 'Бесплатно' },
  { id: 'ollama', name: 'Локальный Ollama / LM Studio', desc: 'Своя модель на своём компьютере. Полностью офлайн, трафик не расходуется.', free: 'Бесплатно' },
  { id: 'openai', name: 'Другой OpenAI-совместимый API', desc: 'Groq, Together, LM Studio и любые другие, у которых есть /chat/completions.', free: 'Зависит от сервиса' },
  { id: 'local', name: 'Локальный режим (без ИИ-сети)', desc: 'Вопросы и карточки собираются из вашего материала без нейросети. Мгновенно и бесплатно.', free: 'Бесплатно' },
];

export default function Settings() {
  const { settings, setSettings, setAI, data, exportData, importData, signOut, user } = useStore();
  const toast = useToast();
  const [showKey, setShowKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);
  const [imp, setImp] = useState('');

  const ai = settings.ai;

  const check = async () => {
    setChecking(true);
    setOk(null);
    try {
      const out = await callAI(ai, { system: 'Отвечай только одним словом.', prompt: 'Скажи «готово».', maxTokens: 32 });
      setOk(!!out);
      toast(out ? 'Подключение работает ✓' : 'Пустой ответ', out ? 'ok' : 'err');
    } catch (e: any) {
      setOk(false);
      toast(e?.message || 'Ошибка подключения', 'err');
    }
    setChecking(false);
  };

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bts-ai-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-extrabold">Настройки</h1>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>
          Всё хранится только в вашем браузере. Никаких серверов, подписок и оплат.
        </p>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound size={17} style={{ color: 'var(--a1)' }} />
          <h2 className="font-extrabold">ИИ-провайдер</h2>
        </div>

        <div className="space-y-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setAI({
                  provider: p.id,
                  openaiModel: p.id === 'openrouter' ? freeModels.openrouter[0] : ai.openaiModel,
                  geminiModel: p.id === 'gemini' ? freeModels.gemini[0] : ai.geminiModel,
                });
                setOk(null);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition"
              style={{
                borderColor: ai.provider === p.id ? 'var(--a2)' : 'var(--border)',
                background: ai.provider === p.id ? 'color-mix(in srgb,var(--a2) 12%, transparent)' : 'var(--surface)',
              }}
            >
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{ background: ai.provider === p.id ? 'var(--a2)' : 'var(--surface2)', color: ai.provider === p.id ? '#fff' : 'var(--muted)' }}
              >
                {ai.provider === p.id ? <CheckCircle2 size={16} /> : <Wifi size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-extrabold">{p.name}</div>
                <div className="text-[11.5px] leading-snug" style={{ color: 'var(--muted)' }}>
                  {p.desc}
                </div>
              </div>
              <span className="chip shrink-0">{p.free}</span>
            </button>
          ))}
        </div>

        {ai.provider !== 'local' && (
          <div className="mt-4 space-y-3">
            <Field
              label={ai.provider === 'gemini' ? 'API-ключ Gemini' : 'API-ключ'}
              hint={
                ai.provider === 'gemini' ? (
                  <>
                    Получите бесплатный ключ: <b>aistudio.google.com/apikey</b> → Create API key. Бесплатный tier: 15 запросов/мин, 1500 в день.
                  </>
                ) : ai.provider === 'openrouter' ? (
                  <>
                    Ключ: <b>openrouter.ai/keys</b>. Используйте модели с суффиксом <b>:free</b>.
                  </>
                ) : ai.provider === 'ollama' ? (
                  <>
                    Локальный адрес Ollama, например <b>http://localhost:11434/v1</b>. Ключ можно оставить пустым.
                  </>
                ) : (
                  'Серверный ключ вашего провайдера.'
                )
              }
            >
              <div className="flex gap-2">
                <input
                  className="input"
                  type={showKey ? 'text' : 'password'}
                  placeholder={ai.provider === 'gemini' ? 'AIza...' : 'sk-...'}
                  value={ai.key}
                  onChange={(e) => setAI({ key: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button className="btn-ghost shrink-0" onClick={() => setShowKey((v) => !v)} aria-label="Показать ключ">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {ai.provider === 'gemini' && (
              <Field label="Модель" hint="Все перечисленные модели бесплатны. Если модель недоступна — приложение попробует следующую.">
                <select className="input" value={ai.geminiModel} onChange={(e) => setAI({ geminiModel: e.target.value })}>
                  {freeModels.gemini.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {(ai.provider === 'openrouter' || ai.provider === 'openai' || ai.provider === 'ollama') && (
              <>
                <Field label="Модель">
                  <input
                    className="input"
                    value={ai.openaiModel}
                    onChange={(e) => setAI({ openaiModel: e.target.value })}
                    placeholder={ai.provider === 'openrouter' ? freeModels.openrouter[0] : 'gpt-4o-mini'}
                  />
                </Field>
                <Field label="Базовый URL" hint="Для Ollama: http://localhost:11434/v1 · Для OpenRouter оставьте пустым.">
                  <input
                    className="input"
                    value={ai.openaiBase}
                    onChange={(e) => setAI({ openaiBase: e.target.value })}
                    placeholder={ai.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'http://localhost:11434/v1'}
                  />
                </Field>
              </>
            )}

            <button className="btn-ghost" onClick={check} disabled={checking}>
              {checking ? <RefreshCw size={15} className="spin" /> : <Wifi size={15} />}
              Проверить подключение
              {ok === true && <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />}
            </button>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-2xl border p-3 text-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <ShieldCheck size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} />
          <span>
            Ключ хранится только в вашем браузере (IndexedDB) и отправляется только выбранному провайдеру. На наш сервер он не попадает — потому что его и нет.
          </span>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Palette size={17} style={{ color: 'var(--a2)' }} />
          <h2 className="font-extrabold">Оформление и вход</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-extrabold">Светлая тема</div>
              <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                {settings.theme === 'light' ? 'Включена' : 'Выключена'} — тёмная тема выглядит эффектнее на ночном обучении
              </div>
            </div>
            {settings.theme === 'light' ? <Sun size={17} /> : <Moon size={17} />}
            <Switch on={settings.theme === 'light'} onChange={(v) => setSettings({ theme: v ? 'light' : 'dark' })} />
          </div>

          <Field label="Google Client ID" hint="Если вход через Google не работает — укажите Client ID из Google Cloud Console (Web application).">
            <input
              className="input"
              value={settings.googleClientId}
              onChange={(e) => setSettings({ googleClientId: e.target.value })}
              placeholder="000000000000-xxxx.apps.googleusercontent.com"
            />
          </Field>

          <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">Текущий аккаунт</div>
              <div className="truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
                {user?.name} · {user?.em}
              </div>
            </div>
            <button className="chip" onClick={signOut}>
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Download size={17} style={{ color: 'var(--a1)' }} />
          <h2 className="font-extrabold">Данные</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={download}>
            <Download size={15} /> Экспорт в файл
          </button>
          <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(exportData()).then(() => toast('Скопировано в буфер обмена', 'ok'))}>
            Копировать
          </button>
        </div>
        <div className="mt-3">
          <Field label="Импорт из JSON">
            <textarea className="input min-h-[90px] font-mono text-[11.5px]" placeholder='{"data": {...}, "settings": {...}}' value={imp} onChange={(e) => setImp(e.target.value)} />
          </Field>
          <button
            className="btn-ghost mt-2"
            onClick={() => {
              importData(imp);
              toast('Импортировано', 'ok');
              setImp('');
            }}
          >
            <Upload size={15} /> Загрузить
          </button>
        </div>
        <div className="mt-4 rounded-2xl border p-3 text-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          В базе вопросов: <b>{data.bank.length}</b> · тестов: <b>{data.tests.length}</b> · карточек: <b>{data.decks.reduce((a, d) => a + d.cards.length, 0)}</b> · конспектов: <b>{data.notes.length}</b> · файлов: <b>{data.materials.length}</b>
        </div>
      </div>
    </div>
  );
}
