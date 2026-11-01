import { ccc } from '@ckb-ccc/core'
import { listDidCkbsByLock, resolveDidCkb, type DidCkbRecord } from '@ckb-ccc/did-ckb'

import { isCkbDid } from './ckb'
import type {
  IdentityOwnershipProof,
  IdentityOwnershipResult,
  IdentityProfile,
  IdentityProvider,
  IdentitySignature,
} from './contracts'
import { JoyIdCredentials } from './JoyIdCredentials'
import { OwnershipMessage } from './OwnershipMessage'

/**
 * Reads live DID metadata cells from the chain.
 */
export interface CkbDidRecords {
  find(did: string): Promise<DidCkbRecord | undefined>
  byLock(lock: ccc.Script, limit: number): Promise<DidCkbRecord[]>
}

export type CkbNetwork = 'ckb' | 'ckb_testnet'

export interface CkbDidProviderOptions {
  records?: CkbDidRecords
  joyId?: JoyIdCredentials
  ownedLimit?: number
}

/**
 * Resolves did:ckb identities and verifies that a wallet signature comes from the lock holding the DID cell.
 */
export class CkbDidProvider implements IdentityProvider {
  readonly name = 'ckb'
  private readonly records: CkbDidRecords
  private readonly joyId: JoyIdCredentials
  private readonly ownedLimit: number

  constructor(
    readonly network: CkbNetwork,
    private readonly client: ccc.Client,
    options: CkbDidProviderOptions = {},
  ) {
    this.records = options.records ?? {
      find: (did) => resolveDidCkb({ client, did }),
      byLock: (lock, limit) => listDidCkbsByLock({ client, lock, limit }),
    }
    this.joyId = options.joyId ?? new JoyIdCredentials(network)
    this.ownedLimit = options.ownedLimit ?? 20
  }

  static open(network: CkbNetwork, options?: CkbDidProviderOptions): CkbDidProvider {
    const client = network === 'ckb' ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet()

    return new CkbDidProvider(network, client, options)
  }

  accepts(did: string): boolean {
    return isCkbDid(did)
  }

  async resolve(did: string): Promise<IdentityProfile | null> {
    if (!this.accepts(did)) return null

    const record = await this.records.find(did)

    return record ? this.profile(record) : null
  }

  async owned(address: string): Promise<readonly IdentityProfile[]> {
    const lock = await this.lockOf(address)
    if (!lock) return []

    const records = await this.records.byLock(lock, this.ownedLimit)

    return records.map((record) => this.profile(record))
  }

  message(challenge: IdentityOwnershipProof['challenge']): string {
    return OwnershipMessage.format(challenge)
  }

  async verify(proof: IdentityOwnershipProof, now = new Date()): Promise<IdentityOwnershipResult> {
    const { challenge, signature } = proof

    if (challenge.network !== this.network) return { verified: false, reason: 'network_mismatch' }
    if (Date.parse(challenge.expiresAt) <= now.getTime())
      return { verified: false, reason: 'expired' }

    const signType = CkbDidProvider.signType(signature)
    if (!signType) return { verified: false, reason: 'unsupported_signer' }

    if (!(await CkbDidProvider.signatureHolds(this.message(challenge), signature, signType))) {
      return { verified: false, reason: 'invalid_signature' }
    }

    const record = this.accepts(challenge.did) ? await this.records.find(challenge.did) : undefined
    if (!record) return { verified: false, reason: 'not_found' }

    const holder = record.cell.cellOutput.lock
    const claimed = await this.lockOf(challenge.address)
    if (!claimed?.eq(holder)) return { verified: false, reason: 'not_controller' }

    if (!(await this.signerControls(signature, signType, challenge.address, holder))) {
      return { verified: false, reason: 'not_controller' }
    }

    return { verified: true, profile: this.profile(record) }
  }

  private async signerControls(
    signature: IdentitySignature,
    signType: ccc.SignerSignType,
    address: string,
    holder: ccc.Script,
  ): Promise<boolean> {
    if (signType === ccc.SignerSignType.CkbSecp256k1) {
      const signer = new ccc.SignerCkbPublicKey(this.client, signature.identity)
      const lock = (await signer.getAddressObjSecp256k1()).script

      return lock.eq(holder)
    }

    const publicKey = CkbDidProvider.joyIdPublicKey(signature.identity)

    return publicKey ? this.joyId.owns(address, publicKey) : false
  }

  private async lockOf(address: string): Promise<ccc.Script | null> {
    try {
      return (await ccc.Address.fromString(address, this.client)).script
    } catch {
      return null
    }
  }

  private profile(record: DidCkbRecord): IdentityProfile {
    const lock = record.cell.cellOutput.lock

    return {
      did: record.did,
      network: this.network,
      controller: {
        address: ccc.Address.fromScript(lock, this.client).toString(),
        id: lock.hash(),
      },
      localId: record.data.value.localId ?? null,
      document: CkbDidProvider.plain(record.data.value.document),
    }
  }

  private static signType(signature: IdentitySignature): ccc.SignerSignType | null {
    if (signature.signType === ccc.SignerSignType.CkbSecp256k1)
      return ccc.SignerSignType.CkbSecp256k1
    if (signature.signType === ccc.SignerSignType.JoyId) return ccc.SignerSignType.JoyId

    return null
  }

  private static async signatureHolds(
    message: string,
    signature: IdentitySignature,
    signType: ccc.SignerSignType,
  ): Promise<boolean> {
    try {
      return await ccc.Signer.verifyMessage(
        message,
        new ccc.Signature(signature.signature, signature.identity, signType),
      )
    } catch {
      return false
    }
  }

  private static joyIdPublicKey(identity: string): string | null {
    try {
      const parsed = JSON.parse(identity) as { publicKey?: unknown }

      return typeof parsed.publicKey === 'string' ? parsed.publicKey : null
    } catch {
      return null
    }
  }

  /**
   * Converts a CBOR-decoded DID document into JSON-safe values.
   */
  private static plain(value: unknown): unknown {
    if (value instanceof Uint8Array) return ccc.hexFrom(value)
    if (typeof value === 'bigint') return value.toString()
    if (Array.isArray(value)) return value.map((item) => CkbDidProvider.plain(item))
    if (value && typeof value === 'object') {
      if ('asCID' in value && typeof value.toString === 'function') return value.toString()

      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, CkbDidProvider.plain(item)]),
      )
    }

    return value
  }
}
