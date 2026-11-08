const DB_NAME = 'bts-ai';
const DB_VER = 1;
const STORE = 'kv';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const v = await tx<T>('readonly', (s) => s.get(key) as IDBRequest<T>);
    return v ?? null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(value, key));
  } catch (e) {
    // Fallback to localStorage when IndexedDB is unavailable (private mode etc.)
    try {
      localStorage.setItem('bts:' + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }
}

export async function kvDel(key: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(key));
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem('bts:' + key);
  } catch {
    /* ignore */
  }
}

export async function kvGetAny<T>(key: string): Promise<T | null> {
  const v = await kvGet<T>(key);
  if (v !== null) return v;
  try {
    const raw = localStorage.getItem('bts:' + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const stateKey = (uid: string) => `state:${uid}`;
