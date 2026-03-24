import type { AccountInfo } from '../types';
import { outputError } from './display';

/**
 * Quick synchronous check whether an account's cached activeRecovery
 * should block a write operation.
 *
 * This is a lightweight, synchronous guard based on cached state.
 * The RecoveryService.recoveryGuard() method does the full on-chain
 * probe; this function is for immediate short-circuit checks.
 *
 * Returns true if the operation should be blocked (and outputs the
 * structured error), false if it should proceed.
 */
export function checkRecoveryBlocked(account: AccountInfo): boolean {
  if (!account.activeRecovery) {
    return false;
  }

  const output = {
    success: false,
    error: {
      code: -32007,
      message: `Account ${account.alias} (${account.address}) is being recovered. Write operations are blocked.`,
    },
    context: {
      account: account.alias,
      address: account.address,
      recoveryStatus: account.activeRecovery.status,
      newOwner: account.activeRecovery.newOwner,
    },
    suggestion: [
      { action: 'recovery status', description: 'Check the latest recovery progress' },
      { action: 'account switch <other-account>', description: 'Switch to a different account' },
    ],
  };
  console.error(JSON.stringify(output, null, 2));
  process.exitCode = 1;
  return true;
}
