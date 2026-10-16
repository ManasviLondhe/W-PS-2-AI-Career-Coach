import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { pollingWorker } from './workers/pollingWorker.js';
import { seedInitialDataIfEmpty } from './config/seedData.js';

let server;

async function bootstrap() {
  try {
    console.log('--- Initializing SkillProof AI Server ---');
    await connectDatabase();
    await seedInitialDataIfEmpty();

    // Start background polling worker
    pollingWorker.start();

    server = app.listen(env.PORT, () => {
      console.log(`[Server] SkillProof AI API running on http://localhost:${env.PORT}`);
      console.log(`[Server] Environment: ${env.NODE_ENV}`);
      console.log(`[Server] LLM Provider: ${env.LLM_PROVIDER}`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down SkillProof AI...`);
  pollingWorker.stop();

  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
    });
  }

  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap();
