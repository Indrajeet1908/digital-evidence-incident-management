import app from './app';
import config from './config/environment';
import prisma from './config/database';

/**
 * Entry point — starts the Express server with graceful lifecycle management.
 */
const server = app.listen(config.port, () => {
  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║   Digital Evidence Platform — API Server           ║
  ╠════════════════════════════════════════════════════╣
  ║   Status:      Running                             ║
  ║   Port:        ${String(config.port).padEnd(33)}║
  ║   Environment: ${config.nodeEnv.padEnd(33)}║
  ║   Health:      http://localhost:${config.port}/api/health    ║
  ║   Ready:       http://localhost:${config.port}/api/ready     ║
  ╚════════════════════════════════════════════════════╝
  `);
});

/**
 * Gracefully shuts down the HTTP server and database connection pool.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('[Server] HTTP connections closed.');
    try {
      await prisma.$disconnect();
      console.log('[Database] PostgreSQL connection pool disconnected.');
      process.exit(0);
    } catch (err) {
      console.error('[Database] Error disconnecting PostgreSQL:', err);
      process.exit(1);
    }
  });

  // Force shutdown after 10s if connections do not close cleanly
  setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out. Forcing process termination.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Process] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Process] Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

export default server;
