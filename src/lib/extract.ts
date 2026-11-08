import JSZip from 'jszip';

export interface ExtractResult {
  text: string;
  pages?: number;
  hasImage?: boolean;
  imageMime?: string;
  imageData?: string;
  kind: string;
  warn?: string;
}

const asText = (buf: ArrayBuffer) => new TextDecoder('utf-8').decode(buf);

async function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

/* ------------------------------------------------------------------- PDF */

export async function extractPdf(file: File): Promise<ExtractResult> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = await readArrayBuffer(file);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as any[]) {
      if (!('str' in item)) continue;
      const y = Math.round((item.transform?.[5] ?? 0) / 3) * 3;
      const x = item.transform?.[4] ?? 0;
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push({ x, s: item.str });
    }
    const out: string[] = [];
    [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, items]) => {
        items.sort((a, b) => a.x - b.x);
        out.push(items.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim());
      });
    pages.push(out.filter(Boolean).join('\n'));
  }
  const text = pages.join('\n\n');
  if (!text.trim()) {
    return { text: '', kind: 'pdf', pages: doc.numPages, warn: 'PDF без текстового слоя — возможен скан. Добавьте скриншоты или включите ИИ-чтение изображений.' };
  }
  return { text, kind: 'pdf', pages: doc.numPages };
}

/* ------------------------------------------------------------------ DOCX */

export async function extractDocx(file: File): Promise<ExtractResult> {
  const zip = await JSZip.loadAsync(await readArrayBuffer(file));
  const file_ = zip.file('word/document.xml');
  if (!file_) throw new Error('Не найден word/document.xml — файл не похож на DOCX');
  const xml = await file_.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const lines: string[] = [];
  const ps = doc.getElementsByTagName('w:p');
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const texts = p.getElementsByTagName('w:t');
    let t = '';
    for (let j = 0; j < texts.length; j++) t += texts[j].textContent || '';
    t = t.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    let style = '';
    const st = p.getElementsByTagName('w:pStyle');
    if (st.length) style = st[0].getAttribute('w:val') || '';
    const isList = p.getElementsByTagName('w:numPr').length > 0;
    const m = style.match(/Heading\s*([1-6])/i) || style.match(/^([1-6])$/);
    if (m) lines.push('#'.repeat(Number(m[1])) + ' ' + t);
    else if (isList) lines.push('- ' + t);
    else lines.push(t);
  }
  return { text: lines.join('\n'), kind: 'docx' };
}

/* ------------------------------------------------------------------ PPTX */

export async function extractPptx(file: File): Promise<ExtractResult> {
  const zip = await JSZip.loadAsync(await readArrayBuffer(file));
  const slides = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const parts: string[] = [];
  for (const name of slides) {
    const xml = await zip.files[name].async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const ts = doc.getElementsByTagName('a:t');
    const lines: string[] = [];
    for (let i = 0; i < ts.length; i++) {
      const s = (ts[i].textContent || '').trim();
      if (s) lines.push(s);
    }
    const n = name.match(/slide(\d+)/)![1];
    parts.push(`## Слайд ${n}\n${lines.join('\n')}`);
  }
  return { text: parts.join('\n\n'), kind: 'pptx', pages: slides.length };
}

/* ------------------------------------------------------------------ XLSX */

export async function extractXlsx(file: File): Promise<ExtractResult> {
  const zip = await JSZip.loadAsync(await readArrayBuffer(file));
  const shared: string[] = [];
  const ss = zip.file('xl/sharedStrings.xml');
  if (ss) {
    const xml = await ss.async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const sis = doc.getElementsByTagName('si');
    for (let i = 0; i < sis.length; i++) {
      const ts = sis[i].getElementsByTagName('t');
      let s = '';
      for (let j = 0; j < ts.length; j++) s += ts[j].textContent || '';
      shared.push(s);
    }
  }
  const sheetFiles = Object.keys(zip.files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort();
  const out: string[] = [];
  for (const name of sheetFiles) {
    const xml = await zip.files[name].async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const rows = doc.getElementsByTagName('row');
    out.push(`### Лист ${name.match(/\d+/)![0]}`);
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].getElementsByTagName('c');
      const vals: string[] = [];
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        const type = cell.getAttribute('t');
        let v = '';
        if (type === 's') {
          const vNode = cell.getElementsByTagName('v')[0];
          const idx = Number(vNode?.textContent || 0);
          v = shared[idx] ?? '';
        } else if (type === 'inlineStr') {
          const t = cell.getElementsByTagName('t')[0];
          v = t?.textContent || '';
        } else {
          const vNode = cell.getElementsByTagName('v')[0];
          v = vNode?.textContent || '';
        }
        vals.push(v.trim());
      }
      if (vals.some((v) => v)) out.push(vals.join(' | '));
    }
  }
  return { text: out.join('\n'), kind: 'xlsx' };
}

/* ----------------------------------------------------------------- image */

export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<{ mime: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const url = canvas.toDataURL('image/jpeg', quality);
  return { mime: 'image/jpeg', data: url.split(',')[1] };
}

/* ------------------------------------------------------------------ main */

export async function extractFile(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() || '';
  if (ext === 'pdf') return extractPdf(file);
  if (ext === 'docx' || ext === 'doc') return extractDocx(file);
  if (ext === 'pptx' || ext === 'ppt') return extractPptx(file);
  if (ext === 'xlsx' || ext === 'xls') return extractXlsx(file);
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
    const img = await compressImage(file);
    return { text: '', kind: 'image', hasImage: true, imageMime: img.mime, imageData: img.data };
  }
  const buf = await readArrayBuffer(file);
  const text = asText(buf);
  return { text, kind: ext || 'txt' };
}

export const ACCEPT_ATTR = '.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp';
