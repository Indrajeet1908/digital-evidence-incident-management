import express, { Request, Response, NextFunction } from 'express';
import routes from './routes';
import { AppError } from './utils/errors';

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
// e.g., healthRoutes → /api/health, authRoutes → /api/auth/*
app.use('/api', routes);

// ---------- 404 Handler ----------
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// ---------- Centralized Error Handling Middleware ----------
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Handle invalid JSON body syntax
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: number }).status === 400
  ) {
    res.status(400).json({
      error: 'Invalid JSON payload format',
    });
    return;
  }

  // Handle application operational errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
    return;
  }

  // Log unexpected internal errors securely without exposing stack trace to client
  console.error('Unhandled internal server error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : (err as Error)?.message || 'An internal server error occurred',
  });
});

export default app;
