import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import config from '../config/environment';
import { AppError } from '../utils/errors';
import { Request, Response, NextFunction } from 'express';

/**
 * Resolves the absolute directory path where evidence files are stored.
 */
export function getEvidenceStorageDir(): string {
  const candidates = [
    path.resolve(process.cwd(), config.evidenceStoragePath),
    path.resolve(process.cwd(), '..', config.evidenceStoragePath),
    path.resolve(__dirname, '../../../', config.evidenceStoragePath),
    path.resolve(__dirname, '../../', config.evidenceStoragePath),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  const defaultDir = path.resolve(process.cwd(), config.evidenceStoragePath);
  fs.mkdirSync(defaultDir, { recursive: true });
  return defaultDir;
}

/**
 * Disk storage engine for evidence files.
 * Files are always saved with server-generated UUID names (<uuid>.bin)
 * to completely eliminate path traversal and file collision attacks.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const dir = getEvidenceStorageDir();
      cb(null, dir);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req, _file, cb) => {
    const fileUuid = crypto.randomUUID();
    cb(null, `${fileUuid}.bin`);
  },
});

const maxBytes = config.maxEvidenceFileSizeMb * 1024 * 1024;

const uploader = multer({
  storage,
  limits: {
    fileSize: maxBytes,
    files: 1,
  },
});

/**
 * Express middleware for single evidence file upload ('file' field)
 * with robust error translation for file size limits and malformed multipart streams.
 */
export function uploadEvidenceFile(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  uploader.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              `File size exceeds maximum allowed limit of ${config.maxEvidenceFileSizeMb}MB`,
              413
            )
          );
        }
        return next(new AppError(`File upload error: ${err.message}`, 400));
      }
      return next(err);
    }
    next();
  });
}
