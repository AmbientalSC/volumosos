import type { FastifyInstance } from 'fastify';
import * as dashboardRepository from './dashboard.repository.js';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.verifyFirebaseToken);
  fastify.addHook('preHandler', fastify.requireAdmin);

  fastify.get('/api/dashboard', async () => {
    const [metrics, bairros, monthly] = await Promise.all([
      dashboardRepository.getMetrics(),
      dashboardRepository.getBairros(),
      dashboardRepository.getMonthly(),
    ]);
    return { metrics, bairros, monthly };
  });
}
