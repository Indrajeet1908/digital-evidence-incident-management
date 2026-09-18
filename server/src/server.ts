import app from './app';
import config from './config/environment';

/**
 * Entry point — starts the Express server.
 *
 * This file is intentionally simple: it imports the configured app
 * and starts listening on the configured port. All app configuration
 * lives in app.ts.
 */
app.listen(config.port, () => {
  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║   Digital Evidence Platform — API Server           ║
  ╠════════════════════════════════════════════════════╣
  ║   Status:      Running                             ║
  ║   Port:        ${String(config.port).padEnd(33)}║
  ║   Environment: ${config.nodeEnv.padEnd(33)}║
  ║   Health:      http://localhost:${config.port}/api/health    ║
  ╚════════════════════════════════════════════════════╝
  `);
});
