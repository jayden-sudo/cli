import type { SecretProvider } from './secretProvider';
import { KeyringProvider } from './keyringProvider';
import { FileProvider } from './fileProvider';
import { EnvVarProvider } from './envVarProvider';

/**
 * Auto-detect the best available SecretProvider.
 *
 * Resolution order (most secure → least secure):
 *
 *   1. KeyringProvider (OS credential store)
 *      macOS: Keychain | Windows: Credential Manager | Linux: Secret Service
 *      → Best option. Encrypted at rest, managed by OS, separate security domain.
 *
 *   2. FileProvider (permission-guarded file)
 *      ~/.elytro/.vault-key, chmod 0600
 *      → Linux headless fallback (servers, containers, WSL without desktop).
 *        Same security model as SSH private keys. Only activates on Linux
 *        when no Secret Service provider is running.
 *
 *   3. EnvVarProvider (CI-only, explicit opt-in)
 *      ELYTRO_VAULT_SECRET + ELYTRO_ALLOW_ENV=1
 *      → Strictly for CI pipelines and Docker. Requires explicit opt-in flag.
 *        Known /proc/PID/environ leak. Not a general-purpose fallback.
 *
 * Returns separate providers for init (store) and runtime (load):
 *   - initProvider: must support store() — only persistent providers
 *   - loadProvider: must support load() — any available provider
 *
 * The OS credential store always takes priority even if env var is set.
 * This prevents a rogue process from injecting ELYTRO_VAULT_SECRET
 * to override the keychain-stored key.
 */
export async function resolveProvider(): Promise<{
  initProvider: SecretProvider | null;
  loadProvider: SecretProvider | null;
}> {
  const keyringProvider = new KeyringProvider();
  const fileProvider = new FileProvider();
  const envProvider = new EnvVarProvider();

  // ── Priority 1: OS credential store (all platforms) ──
  if (await keyringProvider.available()) {
    return {
      initProvider: keyringProvider,
      loadProvider: keyringProvider,
    };
  }

  // ── Priority 2: Permission-guarded file (Linux headless) ──
  // Only use FileProvider on Linux. On macOS/Windows the OS keychain should
  // always be reachable — if it isn't, something is seriously wrong and we
  // should not silently fall through to weaker storage.
  if (process.platform === 'linux' && (await fileProvider.available())) {
    return {
      initProvider: fileProvider,
      loadProvider: fileProvider,
    };
  }

  // ── Priority 3: Env var (CI-only, explicit opt-in) ──
  // EnvVarProvider is load-only, so it cannot be used for init.
  if (await envProvider.available()) {
    return {
      initProvider: null, // Cannot store via env var
      loadProvider: envProvider,
    };
  }

  // ── No provider available ──
  return { initProvider: null, loadProvider: null };
}
