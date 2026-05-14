// Minimal IndexedDB wrapper for Apertures.
// Stores: entries, photos, plan, settings.

const DB_NAME = 'apertures';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('byObject', 'object');
        s.createIndex('byCreated', 'createdAt');
      }
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cities')) {
        const s = db.createObjectStore('cities', { keyPath: 'id' });
        s.createIndex('byOrder', 'order');
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let _db;
async function db() {
  if (!_db) _db = await openDB();
  return _db;
}

function txStore(storeName, mode = 'readonly') {
  return db().then((d) => d.transaction(storeName, mode).objectStore(storeName));
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- Generic kv ------------------------------------------------------------
export async function kvGet(key, fallback = null) {
  const store = await txStore('kv');
  const row = await promisify(store.get(key));
  return row ? row.value : fallback;
}
export async function kvSet(key, value) {
  const store = await txStore('kv', 'readwrite');
  await promisify(store.put({ key, value }));
  return value;
}
export async function kvDelete(key) {
  const store = await txStore('kv', 'readwrite');
  await promisify(store.delete(key));
}

// ---- Entries ---------------------------------------------------------------
export async function getEntries(object) {
  const store = await txStore('entries');
  const idx = store.index('byObject');
  return promisify(idx.getAll(object));
}
export async function getEntry(id) {
  const store = await txStore('entries');
  return promisify(store.get(id));
}
export async function putEntry(entry) {
  const store = await txStore('entries', 'readwrite');
  await promisify(store.put(entry));
  return entry;
}
export async function deleteEntry(id) {
  const entry = await getEntry(id);
  if (entry && Array.isArray(entry.photoIds)) {
    for (const pid of entry.photoIds) await deletePhoto(pid);
  }
  const store = await txStore('entries', 'readwrite');
  await promisify(store.delete(id));
}
export async function getAllEntries() {
  const store = await txStore('entries');
  return promisify(store.getAll());
}
export async function countEntriesByObject() {
  const all = await getAllEntries();
  return all.reduce((acc, e) => { acc[e.object] = (acc[e.object] || 0) + 1; return acc; }, {});
}

// ---- Photos ----------------------------------------------------------------
export async function getPhoto(id) {
  const store = await txStore('photos');
  return promisify(store.get(id));
}
export async function putPhoto(photo) {
  const store = await txStore('photos', 'readwrite');
  await promisify(store.put(photo));
  return photo;
}
export async function deletePhoto(id) {
  const store = await txStore('photos', 'readwrite');
  await promisify(store.delete(id));
}
export async function getAllPhotos() {
  const store = await txStore('photos');
  return promisify(store.getAll());
}

// ---- Cities ----------------------------------------------------------------
export async function getCities() {
  const store = await txStore('cities');
  const all = await promisify(store.getAll());
  return all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export async function putCity(city) {
  const store = await txStore('cities', 'readwrite');
  await promisify(store.put(city));
  return city;
}
export async function deleteCity(id) {
  const store = await txStore('cities', 'readwrite');
  await promisify(store.delete(id));
}

// ---- Wipe & dump -----------------------------------------------------------
export async function wipeAll() {
  const d = await db();
  const tx = d.transaction(['entries', 'photos', 'cities', 'kv'], 'readwrite');
  tx.objectStore('entries').clear();
  tx.objectStore('photos').clear();
  tx.objectStore('cities').clear();
  tx.objectStore('kv').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dumpAll() {
  const [entries, photos, cities, d] = await Promise.all([
    getAllEntries(),
    getAllPhotos(),
    getCities(),
    db()
  ]);
  // Pull all kv as a single object
  const kv = await new Promise((resolve, reject) => {
    const out = {};
    const store = d.transaction('kv').objectStore('kv');
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { out[cur.value.key] = cur.value.value; cur.continue(); }
      else resolve(out);
    };
    req.onerror = () => reject(req.error);
  });

  // photos store { id, blob }; serialize blob to base64
  const photoBlobs = await Promise.all(photos.map(async (p) => ({
    id: p.id,
    mime: p.blob.type || 'image/jpeg',
    data: await blobToDataUrl(p.blob),
    width: p.width,
    height: p.height,
    thumbData: p.thumb ? await blobToDataUrl(p.thumb) : null
  })));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries, cities, kv,
    photos: photoBlobs
  };
}

export async function restoreAll(payload) {
  if (!payload || payload.version !== 1) throw new Error('Unsupported file format');
  await wipeAll();
  // entries
  for (const e of payload.entries || []) await putEntry(e);
  // cities
  for (const c of payload.cities || []) await putCity(c);
  // kv
  for (const [k, v] of Object.entries(payload.kv || {})) await kvSet(k, v);
  // photos
  for (const p of payload.photos || []) {
    const blob = await dataUrlToBlob(p.data);
    const thumb = p.thumbData ? await dataUrlToBlob(p.thumbData) : null;
    await putPhoto({ id: p.id, blob, thumb, width: p.width, height: p.height });
  }
}

// ---- helpers ---------------------------------------------------------------
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}
