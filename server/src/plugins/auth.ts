import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    firebaseUser?: { uid: string; admin: boolean };
  }
  interface FastifyInstance {
    verifyFirebaseToken: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const serviceAccount = JSON.parse(
  Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8')
);

const firebaseApp = initializeApp({ credential: cert(serviceAccount), projectId: env.FIREBASE_PROJECT_ID });
const firebaseAuth = getAuth(firebaseApp);

export default fp(async (fastify) => {
  fastify.decorateRequest('firebaseUser', undefined);

  fastify.decorate('verifyFirebaseToken', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing Authorization header' });
    }
    const token = authHeader.slice('Bearer '.length);
    try {
      const decoded = await firebaseAuth.verifyIdToken(token, true);
      request.firebaseUser = { uid: decoded.uid, admin: decoded.admin === true };
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });

  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.firebaseUser?.admin) {
      return reply.code(403).send({ error: 'Admin privileges required' });
    }
  });
});
