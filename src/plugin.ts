import { CkbDidProvider, type CkbNetwork } from './CkbDidProvider'
import type { IdentityCredentialIssuer, IdentityPlugin } from './contracts'

/**
 * Builds the did:ckb provider from application settings.
 *
 * `network` is `ckb` for mainnet; anything else selects `ckb_testnet`. `credentials` configures
 * the Vellum issuer, which loads `@usevellum/sdk` only when it is set.
 */
export const identityPlugin: IdentityPlugin = {
  name: 'ckb',
  create: async (settings) => {
    const network: CkbNetwork = settings.network === 'ckb' ? 'ckb' : 'ckb_testnet'
    const client = CkbDidProvider.clientFor(network)

    return CkbDidProvider.open(
      network,
      { credentials: await credentialIssuer(network, client, settings.credentials) },
      client,
    )
  },
}

async function credentialIssuer(
  network: CkbNetwork,
  client: ReturnType<typeof CkbDidProvider.clientFor>,
  settings: unknown,
): Promise<IdentityCredentialIssuer | null> {
  if (!settings || typeof settings !== 'object') return null

  const { VellumCredentialIssuer } = await import('./VellumCredentialIssuer')

  return VellumCredentialIssuer.fromSettings(network, client, settings as Record<string, unknown>)
}
