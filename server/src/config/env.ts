import type { FastifyInstance } from 'fastify';
import fastifyEnv from '@fastify/env';

const schema = {
  type: 'object' as const,
  required: ['PORT'],
  properties: {
    PORT: { type: 'number' as const, default: 4000 },
    HOST: { type: 'string' as const, default: '0.0.0.0' },
    NODE_ENV: { type: 'string' as const, default: 'development' },
    LOG_LEVEL: { type: 'string' as const, default: 'info' },
  },
};

export async function registerEnv(app: FastifyInstance): Promise<void> {
  await app.register(fastifyEnv, { schema, dotenv: true });
}

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      HOST: string;
      NODE_ENV: string;
      LOG_LEVEL: string;
    };
  }
}
