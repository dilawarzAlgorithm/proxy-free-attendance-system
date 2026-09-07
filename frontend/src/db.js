import { openDB } from 'idb';

const DB_NAME = 'TrustAttendanceDB';
const STORE_NAME = 'offline-queue';

export async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function saveOfflineAttendance(record) {
  const db = await initDB();
  await db.add(STORE_NAME, { ...record, timestamp: new Date().toISOString() });
}

export async function getOfflineAttendance() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function clearOfflineQueue() {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).clear();
  await tx.done;
}