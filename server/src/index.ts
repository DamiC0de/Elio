import { buildApp } from './app.js';

async function start() {
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: app.config.PORT,
      host: app.config.HOST,
    });
    app.log.info(`🚀 Elio API Gateway running at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
