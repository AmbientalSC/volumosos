import Fastify from 'fastify';
import authPlugin from './plugins/auth.js';
import corsPlugin from './plugins/cors.js';
import recordsRoutes from './modules/records/records.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import { pool } from './db/pool.js';
import { minioClient, BUCKET } from './modules/storage/minio.client.js';
import { env } from './config/env.js';

const fastify = Fastify({ logger: true });

await fastify.register(corsPlugin);
await fastify.register(authPlugin);
await fastify.register(recordsRoutes);
await fastify.register(dashboardRoutes);

fastify.get('/health', async (request, reply) => {
  try {
    await pool.query('SELECT 1');
  } catch {
    return reply.code(503).send({ status: 'error', db: 'down' });
  }
  try {
    await minioClient.bucketExists(BUCKET);
  } catch {
    return reply.code(503).send({ status: 'error', storage: 'down' });
  }
  return { status: 'ok', db: 'ok', storage: 'ok' };
});

fastify.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
