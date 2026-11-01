/** A provider-defined network name, such as `ckb_testnet`. */
export type IdentityNetwork = string

export interface IdentityController {
  address: string
  /** A stable identifier of whatever controls the DID; it changes when the DID is transferred. */
  id: string
}

export interface IdentityProfile {
  did: string
  network: IdentityNetwork
  controller: IdentityController
  localId: string | null
  document: unknown
}

export interface IdentityOwnershipChallenge {
  did: string
  address: string
  network: IdentityNetwork
  audience: string
  nonce: string
  issuedAt: string
  expiresAt: string
}

export interface IdentitySignature {
  signature: string
  identity: string
  signType: string
}

export interface IdentityOwnershipProof {
  challenge: IdentityOwnershipChallenge
  signature: IdentitySignature
}

export type IdentityOwnershipFailure =
  | 'expired'
  | 'network_mismatch'
  | 'not_found'
  | 'invalid_signature'
  | 'not_controller'
  | 'unsupported_signer'

export type IdentityOwnershipResult =
  | { verified: true; profile: IdentityProfile }
  | { verified: false; reason: IdentityOwnershipFailure }

export interface PortableCredential {
  id: string
  subject: string
  issuer: string
  schema: string
  issuedAt: string
  revokedAt: string | null
  claims: Readonly<Record<string, unknown>>
}

export interface IdentityProvider {
  /** The plugin name that built this provider. */
  readonly name: string
  readonly network: IdentityNetwork
  /** Whether a DID uses a method this provider resolves. */
  accepts(did: string): boolean
  resolve(did: string): Promise<IdentityProfile | null>
  owned(address: string): Promise<readonly IdentityProfile[]>
  message(challenge: IdentityOwnershipChallenge): string
  verify(proof: IdentityOwnershipProof, now?: Date): Promise<IdentityOwnershipResult>
}

/**
 * How a provider package presents itself to an application.
 *
 * It names itself and builds from settings it alone understands, so applications select a
 * provider by configuration rather than by importing it.
 */
export interface IdentityPlugin {
  readonly name: string
  create(settings: Readonly<Record<string, unknown>>): IdentityProvider | Promise<IdentityProvider>
}
