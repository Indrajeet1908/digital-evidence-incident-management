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

// Server-side test configuration: when executing test runners, ensure NODE_ENV is 'test'
if (process.env.npm_lifecycle_event?.startsWith('test') || process.argv.some((arg) => arg.includes('test'))) {
  process.env.NODE_ENV = 'test';
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

  /** AI Provider ('gemini' | 'openai' | 'mock') */
  aiProvider: process.env.AI_PROVIDER || (process.env.NODE_ENV === 'test' ? 'mock' : 'gemini'),

  /** Google Gemini API Key (Server-side only) */
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  /** Google Gemini Model */
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',

  /** OpenAI API Key (Server-side only) */
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  /** OpenAI Model */
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  /** Maximum characters sent to AI from an evidence file for safety and token protection */
  maxAiInputCharacters: parseInt(process.env.MAX_AI_INPUT_CHARACTERS || '50000', 10),

  /** Allowed CORS Origins (comma-separated string parsed into an array) */
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
} as const;

// Production security assertions
if (config.nodeEnv === 'production') {
  if (!config.jwtSecret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
  }
  if (config.jwtSecret.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long in production for cryptographic safety.');
  }
  const weakSecrets = ['secret', 'jwtsecret', 'changeme', 'password', '1234567890'];
  if (weakSecrets.includes(config.jwtSecret.toLowerCase())) {
    throw new Error('FATAL: Insecure common JWT_SECRET detected in production environment.');
  }
}

export default config;
