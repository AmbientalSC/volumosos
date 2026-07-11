import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { corsAllowedOrigins } from '../config/env.js';

export default fp(async (fastify) => {
  await fastify.register(cors, {
    origin(origin, callback) {
      // Requisições sem Origin (apps nativos/Capacitor sem WebView, curl, etc.) não são
      // sujeitas a CORS pelo navegador — deixamos passar e confiamos na verificação do token.
      if (!origin || corsAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'), false);
    },
  });
});
