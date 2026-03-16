import type { SecretProvider } from './secretProvider';

const ENV_KEY = 'ELYTRO_VAULT_SECRET';
const ENV_ALLOW = 'ELYTRO_ALLOW_ENV';

/**
 * EnvVarProvider — reads vault key from ELYTRO_VAULT_SECRET env var.
 *
 * This is a **load-only**, **CI-only** provider. It cannot store secrets
 * (env vars are ephemeral) and requires explicit opt-in via ELYTRO_ALLOW_ENV=1.
 *
 * Intended ONLY for:
 *   - CI pipelines (GitHub Actions secrets, GitLab CI variables)
 *   - Docker containers with injected secrets
 *   - Ephemeral environments where no persistent keychain is available
 *
 * NOT intended as a general-purpose fallback. On desktop Linux without a
 * Secret Service provider, use FileProvider instead.
 *
 * Security properties:
 *   - Explicit opt-in: requires both ELYTRO_VAULT_SECRET and ELYTRO_ALLOW_ENV=1
 *   - Consume-once: env var deleted from process.env after reading
 *
 * Known limitations:
 *   - /proc/PID/environ on Linux retains the original value for the entire
 *     process lifetime (kernel-level, cannot be scrubbed)
 *   - No persistence — key must be injected on every invocation
 *
 * Expected format: base64-encoded 32-byte key
 *   e.g. ELYTRO_VAULT_SECRET="K7xP2mN9qR4vB8wF3jL..."
 */
export class EnvVarProvider implements SecretProvider {
  readonly name = 'env-var';

  async available(): Promise<boolean> {
    // Require both the secret AND explicit opt-in
    return !!process.env[ENV_KEY] && process.env[ENV_ALLOW] === '1';
  }

  async store(_secret: Uint8Array): Promise<void> {
    throw new Error(
      'EnvVarProvider is read-only. Cannot store vault key in an environment variable.\n' +
        'Use a persistent provider (OS keychain or file-protected) or store the secret manually.'
    );
  }

  async load(): Promise<Uint8Array | null> {
    // Double-check opt-in at load time (defensive)
    if (process.env[ENV_ALLOW] !== '1') return null;

    const raw = process.env[ENV_KEY];
    if (!raw) return null;

    // Consume-once: scrub from process.env immediately
    delete process.env[ENV_KEY];
    delete process.env[ENV_ALLOW];

    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error(
        `${ENV_KEY} has invalid length: expected 32 bytes (base64), got ${key.length}.\n` +
          'The value must be a base64-encoded 256-bit key.'
      );
    }
    return new Uint8Array(key);
  }

  async delete(): Promise<void> {
    delete process.env[ENV_KEY];
    delete process.env[ENV_ALLOW];
  }
}
