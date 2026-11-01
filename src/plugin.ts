import { CkbDidProvider } from './CkbDidProvider'
import type { IdentityPlugin } from './contracts'

/**
 * Builds the did:ckb provider from application settings.
 *
 * `network` is `ckb` for mainnet; anything else selects `ckb_testnet`.
 */
export const identityPlugin: IdentityPlugin = {
  name: 'ckb',
  create: (settings) => CkbDidProvider.open(settings.network === 'ckb' ? 'ckb' : 'ckb_testnet'),
}
