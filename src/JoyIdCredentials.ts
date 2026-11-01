import type { CkbNetwork } from './CkbDidProvider'

type Fetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean
  json(): Promise<unknown>
}>

interface JoyIdCredentialRecord {
  ckb_address?: unknown
  public_key?: unknown
}

const SERVERS: Record<CkbNetwork, string> = {
  ckb: 'https://api.joy.id/api/v1',
  ckb_testnet: 'https://api.testnet.joyid.dev/api/v1',
}

/**
 * Confirms through JoyID's credential registry that a passkey belongs to a JoyID address.
 */
export class JoyIdCredentials {
  constructor(
    private readonly network: CkbNetwork,
    private readonly fetcher: Fetch = globalThis.fetch as unknown as Fetch,
    private readonly server: string = SERVERS[network],
  ) {}

  async owns(address: string, publicKey: string): Promise<boolean> {
    const response = await this.fetcher(
      `${this.server}/credentials/${encodeURIComponent(address)}`,
      {
        headers: { accept: 'application/json' },
      },
    )
    if (!response.ok) return false

    const body = (await response.json()) as { credentials?: unknown }
    if (!Array.isArray(body.credentials)) return false

    const key = JoyIdCredentials.bare(publicKey)

    return body.credentials.some((credential: JoyIdCredentialRecord) => {
      if (credential.ckb_address !== address || typeof credential.public_key !== 'string')
        return false

      return JoyIdCredentials.bare(credential.public_key) === key
    })
  }

  private static bare(key: string): string {
    return key.replace(/^0x/i, '').toLowerCase()
  }
}
