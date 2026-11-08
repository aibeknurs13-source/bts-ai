import { useCallback, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { useStore } from '../store';
import { ACCEPT_ATTR, extractFile } from '../lib/extract';
import { formatBytes, uid } from '../lib/util';
import { Modal, useToast } from './ui';

interface Parsed {
  id: string;
  file: File;
  name: string;
  kind: string;
  size: number;
  text: string;
  pages?: number;
  hasImage?: boolean;
  imageMime?: string;
  imageData?: string;
  warn?: string;
  state: 'reading' | 'done' | 'error';
  error?: string;
}

const KIND_ICON: Record<string, any> = {
  pdf: FileText,
  docx: FileText,
  doc: FileText,
  pptx: FileText,
  ppt: FileText,
  xlsx: FileText,
  xls: FileText,
  image: ImageIcon,
};

export default function Uploader({
  open,
  onClose,
  subjectId,
  onSubjectChange,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  subjectId: string;
  onSubjectChange: (id: string) => void;
  onGenerate?: (ids: string[]) => void;
}) {
  const { data, addMaterial, removeMaterial } = useStore();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Parsed[]>([]);
  const [drag, setDrag] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      for (const f of arr) {
        const id = uid('f');
        setItems((s) => [...s, { id, file: f, name: f.name, kind: (f.name.split('.').pop() || '').toLowerCase(), size: f.size, text: '', state: 'reading' }]);
        try {
          const res = await extractFile(f);
          setItems((s) => s.map((i) => (i.id === id ? { ...i, text: res.text, pages: res.pages, hasImage: res.hasImage, imageMime: res.imageMime, imageData: res.imageData, warn: res.warn, kind: res.kind, state: 'done' } : i)));
        } catch (e: any) {
          setItems((s) => s.map((i) => (i.id === id ? { ...i, state: 'error', error: e?.message || 'Не удалось прочитать файл' } : i)));
        }
      }
    },
    [],
  );

  const save = () => {
    const ready = items.filter((i) => i.state === 'done');
    if (!ready.length) {
      toast('Сначала добавьте хотя бы один файл', 'err');
      return;
    }
    const ids: string[] = [];
    ready.forEach((i) => {
      const id = uid('m');
      ids.push(id);
      addMaterial({
        id,
        subjectId,
        name: i.name,
        kind: i.kind,
        size: i.size,
        text: i.text,
        pages: i.pages,
        hasImage: i.hasImage,
        imageMime: i.imageMime,
        imageData: i.imageData,
        createdAt: Date.now(),
      });
    });
    toast(`Сохранено файлов: ${ready.length}`, 'ok');
    setItems([]);
    if (onGenerate && ids.length) onGenerate(ids);
    else onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Добавить материалы" wide>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        className="cursor-pointer rounded-3xl border-2 border-dashed px-5 py-9 text-center transition"
        style={{
          borderColor: drag ? 'var(--a2)' : 'var(--border)',
          background: drag ? 'color-mix(in srgb, var(--a2) 12%, transparent)' : 'var(--surface)',
        }}
      >
        <UploadCloud size={34} className="mx-auto" style={{ color: 'var(--a1)' }} />
        <div className="mt-3 font-extrabold">Перетащите файлы или нажмите, чтобы выбрать</div>
        <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          PDF · DOCX · PPTX · XLSX · TXT · MD · CSV · PNG · JPG — ИИ прочитает всё содержимое
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
          Предмет
        </div>
        <div className="flex flex-wrap gap-2">
          {data.subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => onSubjectChange(s.id)}
              className="chip"
              style={
                subjectId === s.id
                  ? { background: `linear-gradient(135deg,${s.color},color-mix(in srgb,${s.color} 55%, #000))`, color: '#fff', borderColor: 'transparent' }
                  : undefined
              }
            >
              {s.emoji} {s.ru}
            </button>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          {items.map((i) => {
            const Icon = KIND_ICON[i.kind] || FileText;
            return (
              <div key={i.id} className="flex items-center gap-3 rounded-2xl border px-3.5 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--surface2)' }}>
                  {i.state === 'reading' ? <Loader2 size={17} className="spin" /> : <Icon size={17} style={{ color: i.state === 'error' ? 'var(--bad)' : 'var(--a1)' }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{i.name}</div>
                  <div className="truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    {i.state === 'reading'
                      ? 'Читаю файл…'
                      : i.state === 'error'
                      ? i.error
                      : `${formatBytes(i.size)} · ${i.pages ? `${i.pages} стр.` : ''} ${i.text ? `· ${i.text.length} симв.` : ''} ${i.hasImage ? '· изображение' : ''}`}
                  </div>
                  {i.warn && (
                    <div className="mt-1 text-[11px]" style={{ color: 'var(--warn)' }}>
                      ⚠ {i.warn}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setItems((s) => s.filter((x) => x.id !== i.id))}
                  className="shrink-0 rounded-xl p-2 opacity-60 transition hover:opacity-100"
                  style={{ background: 'var(--surface2)' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {data.materials.filter((m) => m.subjectId === subjectId).length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            Уже в библиотеке предмета
          </div>
          <div className="flex flex-wrap gap-2">
            {data.materials
              .filter((m) => m.subjectId === subjectId)
              .map((m) => (
                <span key={m.id} className="chip">
                  {m.name}
                  <button onClick={() => removeMaterial(m.id)} className="ml-1 opacity-60 hover:opacity-100">
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn flex-1" onClick={save}>
          <Sparkles size={16} />
          Сохранить и сгенерировать
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            const ids = data.materials.filter((m) => m.subjectId === subjectId).map((m) => m.id);
            setItems([]);
            if (onGenerate) onGenerate(ids);
            else onClose();
          }}
        >
          Только из библиотеки
        </button>
      </div>
    </Modal>
  );
}
