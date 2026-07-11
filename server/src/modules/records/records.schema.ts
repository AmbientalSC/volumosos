import { z } from 'zod';

export const createRecordSchema = z.object({
  imageKey: z.string().min(1),
  address: z.string().min(1),
  capturedAt: z.string().datetime(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type CreateRecordInput = z.infer<typeof createRecordSchema>;

export const listRecordsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const exportQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});
