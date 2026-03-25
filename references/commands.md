# Elytro -- Agent cheat sheet

Fast lookup: what to run, what needs user consent, and how to phrase results.

CLI errors include `error.message`, `error.data.hint`, and `suggestion` fields. Follow those directly.

---

## Commands

### Account

| Run                                                                    | Tell the user                                                                                      |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `account create -c <chainId> [-a alias] [-e email] [-l dailyLimitUsd]` | `Done: smart account created.` Include alias and address; note it is not deployed until activated. |
| `account activate [alias\|address] [--no-sponsor]`                     | `Done: account deployed on-chain.`                                                                 |
| `account list [-c <chainId>]`                                          | `Found <n> item(s).` One line per account: alias, chain, deployed yes/no.                          |
| `account info [alias\|address]`                                        | `Status:` with balance, deployment state, and security state.                                      |
| `account rename ...`                                                   | `Done: account renamed to <new>.`                                                                  |
| `account switch <alias\|address>`                                      | `Done: active account is now <alias>.` Always pass alias/address (avoid interactive pick).         |

### Transaction

| Run                                                           | Tell the user                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `tx simulate [account] --tx <spec>... [--no-sponsor]`         | Use `Preview:` template from SKILL.md.                                                 |
| `tx send [account] --tx <spec>... [--no-sponsor] [--no-hook]` | Use `Done:` or `Action needed:` template. Never send without prior simulate + user OK. |
| `tx build ...`                                                | `Done: unsigned operation prepared.`                                                   |

`--tx` shape: `to:0x...,value:0.1,data:0x...` (`to` + either `value` or `data`; repeat `--tx` for batch).

### Query

| Run                                        | Tell the user                               |
| ------------------------------------------ | ------------------------------------------- |
| `query balance [account] [--token 0xAddr]` | `Status:` with account, amount, and symbol. |
| `query tokens ...`                         | `Found <n> item(s).`                        |
| `query tx <hash>`                          | `Status:` confirmed, pending, or not found. |
| `query chain`                              | `Status: current chain is <name> (<id>).`   |
| `query address <0x...>`                    | `Status:` address type and balance.         |

### Security / OTP / config

| Run                                          | Tell the user                                             |
| -------------------------------------------- | --------------------------------------------------------- |
| `security status`                            | `Status:` hook state, email, spending limit.              |
| `security 2fa install ...` / `uninstall ...` | `Done:` with plain-language result.                       |
| `security email bind\|change <email>`        | Often returns OTP pending; use `Action needed:` template. |
| `security spending-limit [usd]`              | View: `Status:`. Set: may return OTP pending.             |
| `otp submit <id> <code>`                     | Agent runs this after user provides the code.             |
| `otp list` / `otp cancel`                    | `Found <n> item(s).` / `Done:`.                           |
| `config show\|set\|remove`                   | `Status:` for show, `Done:` for set/remove.               |
| `update check` / `update`                    | `Status:` / `Done:`. No auto-update without user OK.      |

### Recovery

| Run                                                                                   | Tell the user                                                                                |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `recovery contacts list`                                                              | `Status:` with guardian count, threshold, each address.                                      |
| `recovery contacts set <addrs> --threshold <n> [--label ...] [--privacy] [--sponsor]` | `Done: guardians updated.` Include tx hash, count, threshold.                                |
| `recovery contacts clear [--sponsor]`                                                 | `Done: all guardians cleared.` Include tx hash.                                              |
| `recovery backup export [--output <file>]`                                            | `Done: backup exported.`                                                                     |
| `recovery backup import <file>`                                                       | `Done: backup imported.`                                                                     |
| `recovery initiate <address> --chain <id> [--from-backup <file>]`                     | `Done: recovery initiated.` Show recoveryUrl prominently. Tell user to share with guardians. |
| `recovery status [--wallet <addr> --recovery-id <hex>]`                               | `Status:` with recovery phase, signature count, countdown if applicable.                     |

### x402 / Delegations

| Run                                                    | Tell the user                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `delegation list\|add\|show\|remove [--account alias]` | Delegations listed / stored / removed.                                          |
| `request --dry-run <url>`                              | Preview: paywall requires amount to payee. No funds moved.                      |
| `request <url> [--method POST --json ...]`             | Paid amount to payee. Tx hash from settlement header. Only after user approval. |

---

## Agent: user approval before running

Say what you will run, wait for explicit yes, then execute.

**Money and deploy:** `tx send`, `account activate`, `request <url>` (non-dry-run)
**Security:** `security 2fa install`, `security 2fa uninstall`, `security email bind|change`, `security spending-limit` (when setting)
**Recovery (write):** `recovery contacts set`, `recovery contacts clear`, `recovery initiate`
**OTP / config:** `otp submit` (user provides code, agent executes), `otp cancel`, `config remove`, `update`

---

## Error codes (debug only)

If the user cares about numbers: `-32602` bad parameters, `-32002` wallet/account not ready, `-32005` send failed, `-32007` hook auth / recovery blocked, `-32010` to `-32014` OTP family, `-32000` generic.
