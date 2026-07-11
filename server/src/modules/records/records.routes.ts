import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createRecordSchema, listRecordsQuerySchema, exportQuerySchema } from './records.schema.js';
import * as recordsRepository from './records.repository.js';
import { getPresignedPutUrl, deleteImage } from '../storage/minio.client.js';

export default async function recordsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.verifyFirebaseToken);

  fastify.get('/api/records', async (request) => {
    const { page, limit, search, startDate, endDate } = listRecordsQuerySchema.parse(request.query);
    return recordsRepository.listRecords({ page, limit, search, startDate, endDate });
  });

  fastify.post('/api/records/upload-url', async () => {
    const imageKey = `images/${randomUUID()}.jpg`;
    const uploadUrl = await getPresignedPutUrl(imageKey);
    return { uploadUrl, imageKey };
  });

  fastify.post('/api/records', async (request, reply) => {
    const input = createRecordSchema.parse(request.body);
    const record = await recordsRepository.createRecord({
      ...input,
      createdBy: request.firebaseUser!.uid,
    });
    return reply.code(201).send(record);
  });

  fastify.delete<{ Params: { id: string } }>('/api/records/:id', async (request, reply) => {
    const { id } = request.params;
    const imageKey = await recordsRepository.getRecordImageKey(id);
    if (imageKey) {
      await deleteImage(imageKey);
    }
    await recordsRepository.deleteRecord(id);
    return reply.code(204).send();
  });

  fastify.get('/api/records/export', async (request) => {
    const { start, end } = exportQuerySchema.parse(request.query);
    return recordsRepository.exportRecords(start, end);
  });
}
