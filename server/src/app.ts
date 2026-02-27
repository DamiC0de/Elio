import Fastify from 'fastify';
import { registerEnv } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerRateLimit } from './plugins/rateLimit.js';
import { registerWebSocket } from './plugins/websocket.js';
import { healthRoutes } from './routes/health.js';
import { pingRoutes } from './routes/ping.js';
import { wsRoutes } from './routes/ws.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Config
  await registerEnv(app);

  // Plugins
  await registerCors(app);
  await registerRateLimit(app);
  await registerWebSocket(app);

  // Routes
  await app.register(healthRoutes);
  await app.register(pingRoutes);
  await app.register(wsRoutes);

  return app;
}
