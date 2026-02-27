import type { FastifyInstance } from 'fastify';

const startTime = Date.now();

interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  environment: string;
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      version: '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      environment: app.config.NODE_ENV,
    };
  });
}
