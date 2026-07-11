/**
 * Migração única: Firestore `records` + Storage `images/*.jpg` -> Postgres "operação".records + MinIO.
 *
 * Rodar manualmente uma única vez (nunca como parte do app): `npm run migrate:data`
 * Requer no ambiente: FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, FIREBASE_STORAGE_BUCKET,
 * DATABASE_URL, MINIO_ENDPOINT, MINIO_PORT, MINIO_USE_SSL, MINIO_ACCESS_KEY,
 * MINIO_SECRET_KEY, MINIO_BUCKET.
 *
 * Idempotente: reexecutar é seguro (ON CONFLICT (legacy_firestore_id) DO NOTHING).
 * Nunca escreve de volta no Firestore/Storage — a fonte original fica intacta.
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { Pool } from 'pg';
import { Client as MinioClient } from 'minio';

const RECORDS_TABLE = '"operação".records';
const BATCH_SIZE = 200;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

const serviceAccount = JSON.parse(
  Buffer.from(requireEnv('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64'), 'base64').toString('utf8')
);

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});
const firestore = getFirestore(firebaseApp);
const bucket = getStorage(firebaseApp).bucket();

const pool = new Pool({ connectionString: requireEnv('DATABASE_URL') });

const minio = new MinioClient({
  endPoint: requireEnv('MINIO_ENDPOINT'),
  port: Number(process.env.MINIO_PORT || 9000),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: requireEnv('MINIO_ACCESS_KEY'),
  secretKey: requireEnv('MINIO_SECRET_KEY'),
});
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'volumosos';

/**
 * URLs de download do Firebase Storage têm o formato:
 * https://firebasestorage.googleapis.com/v0/b/<bucket>/o/images%2F<uuid>.jpg?alt=media&token=...
 * A chave real do objeto (ex: "images/<uuid>.jpg") fica no segmento após "/o/", URL-encoded.
 */
function imageKeyFromDownloadUrl(imageUrl: string): string | null {
  const match = imageUrl.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function migrateBatch(docs: FirebaseFirestore.QueryDocumentSnapshot[]): Promise<void> {
  for (const doc of docs) {
    const data = doc.data();
    const imageKey = imageKeyFromDownloadUrl(data.imageUrl);
    if (!imageKey) {
      console.error(`[skip] doc ${doc.id}: não foi possível extrair a chave da imagem de ${data.imageUrl}`);
      continue;
    }

    try {
      const [fileBuffer] = await bucket.file(imageKey).download();
      await minio.putObject(MINIO_BUCKET, imageKey, fileBuffer, undefined, {
        'Content-Type': 'image/jpeg',
      });

      const capturedAt = data.timestamp.toDate() as Date;
      await pool.query(
        `INSERT INTO ${RECORDS_TABLE}
           (legacy_firestore_id, image_key, address, latitude, longitude, captured_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (legacy_firestore_id) DO NOTHING`,
        [doc.id, imageKey, data.address || '', data.latitude ?? null, data.longitude ?? null, capturedAt.toISOString()]
      );
      console.log(`[ok] ${doc.id} -> ${imageKey}`);
    } catch (err) {
      console.error(`[error] doc ${doc.id}:`, (err as Error).message);
    }
  }
}

async function main(): Promise<void> {
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let total = 0;

  for (;;) {
    let query = firestore.collection('records').orderBy('timestamp').limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    await migrateBatch(snapshot.docs);
    total += snapshot.docs.length;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    console.log(`Progresso: ${total} documentos processados`);
  }

  console.log(`Concluído. Total processado: ${total}`);
  await pool.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
