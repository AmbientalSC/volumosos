import { auth } from './firebase';
import type { PhotoRecord } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiRecordDto {
  id: string;
  imageUrl: string;
  address: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
}

function toPhotoRecord(dto: ApiRecordDto): PhotoRecord {
  return { ...dto, timestamp: new Date(dto.timestamp) };
}

async function authorizedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: 'Bea' + 'rer ' + token } : {}),
    },
  });

  if (response.status === 401 && retry && auth.currentUser) {
    await auth.currentUser.getIdToken(true);
    return authorizedFetch(path, init, false);
  }

  return response;
}

async function parseJsonOrThrow<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

export interface ListRecordsParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export async function listRecords(params: ListRecordsParams = {}): Promise<PaginatedResponse<PhotoRecord>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);

  const qs = searchParams.toString();
  const response = await authorizedFetch(`/api/records${qs ? `?${qs}` : ''}`);
  const data = await parseJsonOrThrow<PaginatedResponse<ApiRecordDto>>(response, 'Não foi possível carregar os registros.');
  return {
    ...data,
    data: data.data.map(toPhotoRecord),
  };
}

export async function getUploadUrl(): Promise<{ uploadUrl: string; imageKey: string }> {
  const response = await authorizedFetch('/api/records/upload-url', { method: 'POST' });
  return parseJsonOrThrow(response, 'Não foi possível preparar o envio da imagem.');
}

interface CreateRecordInput {
  imageKey: string;
  address: string;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
}

export async function createRecord(input: CreateRecordInput): Promise<PhotoRecord> {
  const response = await authorizedFetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const dto = await parseJsonOrThrow<ApiRecordDto>(response, 'Não foi possível salvar o registro.');
  return toPhotoRecord(dto);
}

export async function deleteRecord(id: string): Promise<void> {
  const response = await authorizedFetch(`/api/records/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Não foi possível excluir o registro.');
}

export interface CsvRow {
  capturedAt: string;
  address: string;
  imageUrl: string;
}

export async function exportCsvRows(startDate: string, endDate: string): Promise<CsvRow[]> {
  const params = new URLSearchParams();
  if (startDate) params.set('start', startDate);
  if (endDate) params.set('end', endDate);
  const response = await authorizedFetch(`/api/records/export?${params.toString()}`);
  return parseJsonOrThrow(response, 'Não foi possível gerar o relatório.');
}

export interface DashboardData {
  metrics: { hoje: number; semana: number; mes: number; total: number };
  bairros: { name: string; count: number }[];
  monthly: { name: string; total: number }[];
}

export async function getDashboard(): Promise<DashboardData> {
  const response = await authorizedFetch('/api/dashboard');
  return parseJsonOrThrow(response, 'Não foi possível carregar o painel.');
}
