import Fastify from 'fastify';
import { registerEnv } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerRateLimit } from './plugins/rateLimit.js';
import { registerWebSocket } from './plugins/websocket.js';
import authPlugin from './plugins/auth.js';
import monitoringPlugin from './plugins/monitoring.js';
import { accountRoutes } from './routes/account.js';
import { billingRoutes } from './routes/billing.js';
import { healthRoutes } from './routes/health.js';
import { memoriesRoutes } from './routes/memories.js';
import { pingRoutes } from './routes/ping.js';
import { settingsRoutes } from './routes/settings.js';
import { userRoutes } from './routes/user.js';
import { wsRoutes } from './routes/ws.js';
import { keyboardRoutes } from './routes/keyboard.js';

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

  // Auth & monitoring
  await app.register(authPlugin);
  await app.register(monitoringPlugin);

  // Routes
  await app.register(accountRoutes);
  await app.register(healthRoutes);
  await app.register(pingRoutes);
  await app.register(billingRoutes);
  await app.register(memoriesRoutes);
  await app.register(settingsRoutes);
  await app.register(userRoutes);
  await app.register(wsRoutes);
  await app.register(keyboardRoutes);

  return app;
}
