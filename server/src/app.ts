import express from 'express';
import routes from './routes';

/**
 * Creates and configures the Express application.
 *
 * Separated from server.ts so we can:
 * 1. Import the app in tests without starting a real server
 * 2. Keep configuration logic in one place
 */
const app = express();

// ---------- Built-in Middleware ----------

// Parse incoming JSON request bodies (e.g., POST /api/cases with JSON data)
app.use(express.json());

// Parse URL-encoded form data
app.use(express.urlencoded({ extended: true }));

// ---------- API Routes ----------

// All routes are prefixed with /api
// e.g., healthRoutes → /api/health
app.use('/api', routes);

export default app;
