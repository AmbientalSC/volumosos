import { Client } from 'minio';
import { env } from '../../config/env.js';

export const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

// Cliente configurado com o endpoint público para gerar URLs pré-assinadas
// com assinatura correta (Host header = domínio público)
const publicBaseUrl = new URL(env.MINIO_PUBLIC_BASE_URL);
const minioPublicClient = new Client({
  endPoint: publicBaseUrl.hostname,
  port: publicBaseUrl.port ? Number(publicBaseUrl.port) : (publicBaseUrl.protocol === 'https:' ? 443 : 80),
  useSSL: publicBaseUrl.protocol === 'https:',
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export const BUCKET = env.MINIO_BUCKET;

const PRESIGNED_PUT_EXPIRY_SECONDS = 15 * 60;

export function toPublicUrl(imageKey: string): string {
  return `${env.MINIO_PUBLIC_BASE_URL}/${BUCKET}/${imageKey}`;
}

export async function getPresignedPutUrl(imageKey: string): Promise<string> {
  return minioPublicClient.presignedPutObject(BUCKET, imageKey, PRESIGNED_PUT_EXPIRY_SECONDS);
}

export async function deleteImage(imageKey: string): Promise<void> {
  try {
    await minioClient.removeObject(BUCKET, imageKey);
  } catch (err) {
    // Tolera "não encontrado", replicando o comportamento que o app já tinha com o Firebase Storage.
    console.warn(`Falha ao remover objeto ${imageKey} do MinIO (ignorado):`, err);
  }
}
