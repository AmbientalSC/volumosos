import { Client } from 'minio';
import { env } from '../../config/env.js';

export const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export const BUCKET = env.MINIO_BUCKET;

const PRESIGNED_PUT_EXPIRY_SECONDS = 15 * 60;

export function toPublicUrl(imageKey: string): string {
  return `${env.MINIO_PUBLIC_BASE_URL}/${BUCKET}/${imageKey}`;
}

export async function getPresignedPutUrl(imageKey: string): Promise<string> {
  const internalBase = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;
  const externalBase = env.MINIO_PUBLIC_BASE_URL;
  const url = await minioClient.presignedPutObject(BUCKET, imageKey, PRESIGNED_PUT_EXPIRY_SECONDS);
  return url.replace(internalBase, externalBase);
}

export async function deleteImage(imageKey: string): Promise<void> {
  try {
    await minioClient.removeObject(BUCKET, imageKey);
  } catch (err) {
    // Tolera "não encontrado", replicando o comportamento que o app já tinha com o Firebase Storage.
    console.warn(`Falha ao remover objeto ${imageKey} do MinIO (ignorado):`, err);
  }
}
