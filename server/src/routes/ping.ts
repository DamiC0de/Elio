import type { FastifyInstance } from 'fastify';

export async function pingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/ping', async (_request, _reply) => {
    return { pong: true };
  });
}
