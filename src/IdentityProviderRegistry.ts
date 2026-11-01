import type { IdentityNetwork, IdentityProvider } from './contracts'

export class IdentityProviderRegistry {
  readonly #providers = new Map<IdentityNetwork, IdentityProvider>()

  register(network: IdentityNetwork, provider: IdentityProvider): this {
    this.#providers.set(network, provider)

    return this
  }

  provider(network: IdentityNetwork): IdentityProvider {
    const provider = this.#providers.get(network)
    if (!provider) throw new Error(`No identity provider is registered for ${network}.`)

    return provider
  }
}
