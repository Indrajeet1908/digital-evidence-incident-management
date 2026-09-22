import argon2 from 'argon2';

/**
 * Hashes a plaintext password using Argon2id (OWASP recommended).
 *
 * Argon2 provides strong, memory-hard resistance against brute-force
 * and GPU/ASIC hardware-assisted attacks.
 *
 * Plaintext passwords are NEVER stored in the database.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB recommended by OWASP
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verifies a plaintext password against an Argon2 hash.
 * Returns false if comparison fails or if hash is malformed, without throwing.
 */
export async function verifyPassword(
  hash: string,
  plaintext: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}
