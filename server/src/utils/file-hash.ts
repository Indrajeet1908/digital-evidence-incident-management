import crypto from 'crypto';
import fs from 'fs';

/**
 * Calculates SHA-256 checksum for a file using a streaming pipeline.
 * This ensures low memory overhead even for large files.
 *
 * @param filePath Absolute path to the physical file
 * @returns 64-character lowercase hexadecimal SHA-256 hash string
 */
export function calculateFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Verifies whether the file on disk matches the expected SHA-256 hash.
 *
 * @param filePath Absolute path to the physical file
 * @param expectedHash Expected 64-character hexadecimal SHA-256 hash
 * @returns Object with matches boolean and current calculated hash
 */
export async function verifyFileSha256(
  filePath: string,
  expectedHash: string
): Promise<{ matches: boolean; currentHash: string }> {
  const currentHash = await calculateFileSha256(filePath);
  const matches = currentHash.toLowerCase() === expectedHash.toLowerCase();
  return { matches, currentHash };
}
