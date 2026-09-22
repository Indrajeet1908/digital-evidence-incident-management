import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env file reliably whether running from project root, server/, or tests
const possibleEnvPaths = [
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

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

  /** JWT secret key used for signing and verifying tokens */
  jwtSecret: process.env.JWT_SECRET || '',

  /** JWT token expiration (e.g., '24h', '7d') */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

  /** Maximum evidence file upload size in megabytes */
  maxEvidenceFileSizeMb: parseInt(process.env.MAX_EVIDENCE_FILE_SIZE_MB || '100', 10),

  /** Filesystem path for evidence storage (relative to project root or absolute) */
  evidenceStoragePath: process.env.EVIDENCE_STORAGE_PATH || 'storage/evidence',
} as const;

if (config.nodeEnv === 'production' && !config.jwtSecret) {
  throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
}

export default config;
