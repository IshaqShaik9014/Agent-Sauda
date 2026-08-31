import { buildApp } from './app.js';
import { env } from './config/env.js';
import { warmupDatabase } from '@agent-sauda/database';

async function start() {
  const app = buildApp();

  // Graceful shutdown signals
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info({ signal }, 'Received termination signal, shutting down gracefully...');
      try {
        await app.close();
        app.log.info('Server closed successfully.');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, 'Error during server shutdown.');
        process.exit(1);
      }
    });
  }

  try {
    // Warm up Neon Serverless PostgreSQL instance to guarantee zero cold-start failures
    app.log.info('Connecting to database and warming up Neon compute...');
    await warmupDatabase(5, 2000);
    app.log.info('✅ Database connection established.');

    const address = await app.listen({
      port: env.PORT,
      host: env.HOST
    });
    app.log.info(`🚀 Agent Sauda API listening at ${address}`);
    app.log.info(`Environment: ${env.NODE_ENV} | Log Level: ${env.LOG_LEVEL}`);
  } catch (err) {
    app.log.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
