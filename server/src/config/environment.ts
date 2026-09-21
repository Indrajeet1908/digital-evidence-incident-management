import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the project root (one level above server/)
// process.cwd() is the server/ directory when running `npm run dev`
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

/**
 * Centralized configuration.
 * All environment variables are accessed here — never scattered across the codebase.
 * This makes it easy to see what the app needs and to validate it in one place.
 */
const config = {
  /** Current environment: 'development', 'production', or 'test' */
  nodeEnv: process.env.NODE_ENV || 'development',

  /** Port the server listens on */
  port: parseInt(process.env.PORT || '5000', 10),

  /** PostgreSQL connection string */
  databaseUrl: process.env.DATABASE_URL || '',
} as const;

export default config;
