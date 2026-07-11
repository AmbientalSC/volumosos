import { pool } from '../../db/pool.js';
import { RECORDS_TABLE } from '../../db/schema.js';
import { toPublicUrl } from '../storage/minio.client.js';

interface RecordRow {
  id: string;
  image_key: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  captured_at: Date;
}

export interface RecordDto {
  id: string;
  imageUrl: string;
  address: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function toDto(row: RecordRow): RecordDto {
  return {
    id: row.id,
    imageUrl: toPublicUrl(row.image_key),
    address: row.address,
    timestamp: row.captured_at.toISOString(),
    ...(row.latitude !== null && { latitude: row.latitude }),
    ...(row.longitude !== null && { longitude: row.longitude }),
  };
}

interface ListRecordsParams {
  page: number;
  limit: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export async function listRecords(params: ListRecordsParams): Promise<PaginatedResponse<RecordDto>> {
  const { page, limit, search, startDate, endDate } = params;
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (search) {
    queryParams.push(`%${search}%`);
    conditions.push(`address ILIKE $${queryParams.length}`);
  }
  if (startDate) {
    queryParams.push(`${startDate}T00:00:00`);
    conditions.push(`captured_at >= $${queryParams.length}`);
  }
  if (endDate) {
    queryParams.push(`${endDate}T23:59:59.999`);
    conditions.push(`captured_at <= $${queryParams.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Contagem total
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ${RECORDS_TABLE} ${where}`,
    queryParams,
  );
  const total = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(total / limit);

  // Dados paginados
  const offset = (page - 1) * limit;
  queryParams.push(limit);
  queryParams.push(offset);

  const { rows } = await pool.query<RecordRow>(
    `SELECT id, image_key, address, latitude, longitude, captured_at
     FROM ${RECORDS_TABLE}
     ${where}
     ORDER BY captured_at DESC
     LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
    queryParams,
  );

  return {
    data: rows.map(toDto),
    pagination: { page, limit, total, totalPages },
  };
}

interface CreateRecordParams {
  imageKey: string;
  address: string;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  createdBy: string;
}

export async function createRecord(input: CreateRecordParams): Promise<RecordDto> {
  const { rows } = await pool.query<RecordRow>(
    `INSERT INTO ${RECORDS_TABLE} (image_key, address, captured_at, latitude, longitude, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, image_key, address, latitude, longitude, captured_at`,
    [input.imageKey, input.address, input.capturedAt, input.latitude ?? null, input.longitude ?? null, input.createdBy]
  );
  return toDto(rows[0]);
}

export async function getRecordImageKey(id: string): Promise<string | null> {
  const { rows } = await pool.query<{ image_key: string }>(
    `SELECT image_key FROM ${RECORDS_TABLE} WHERE id = $1`,
    [id]
  );
  return rows[0]?.image_key ?? null;
}

export async function deleteRecord(id: string): Promise<void> {
  await pool.query(`DELETE FROM ${RECORDS_TABLE} WHERE id = $1`, [id]);
}

export interface ExportRow {
  capturedAt: string;
  address: string;
  imageUrl: string;
}

export async function exportRecords(start?: string, end?: string): Promise<ExportRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (start) {
    params.push(`${start}T00:00:00`);
    conditions.push(`captured_at >= $${params.length}`);
  }
  if (end) {
    params.push(`${end}T23:59:59.999`);
    conditions.push(`captured_at <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query<RecordRow>(
    `SELECT id, image_key, address, latitude, longitude, captured_at
     FROM ${RECORDS_TABLE}
     ${where}
     ORDER BY captured_at DESC`,
    params
  );

  return rows.map((row: RecordRow) => ({
    capturedAt: row.captured_at.toISOString(),
    address: row.address,
    imageUrl: toPublicUrl(row.image_key),
  }));
}
