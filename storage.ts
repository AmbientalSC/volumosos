import { openDB, IDBPDatabase } from 'idb';
import { PendingRecord } from './types';

const DB_NAME = 'volumosos-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingRecords';

interface PendingRecordDB extends PendingRecord {
  base64: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export async function loadPendingRecords(): Promise<PendingRecordDB[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.map((record: any) => ({
    ...record,
    timestamp: new Date(record.timestamp),
  }));
}

export async function savePendingRecord(record: PendingRecordDB): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, {
    ...record,
    timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp,
  });
}

export async function savePendingRecords(records: PendingRecordDB[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all([
    ...records.map(record =>
      tx.store.put({
        ...record,
        timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp,
      })
    ),
    tx.done,
  ]);
}

export async function removePendingRecord(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearAllPending(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE_NAME);
}
