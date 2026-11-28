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

/** A level the application has confirmed an account reached. */
export interface LevelAchievement {
  accountId: string
  profileSlug: string
  level: number
  levelPolicyVersion: string
}

/** A signed credential, ready to submit and saved by the application before it is. */
export interface PreparedCredential {
  /** Where the credential is recorded once submitted, such as a transaction hash. */
  reference: string
  /** The credential's own identifier. */
  credentialId: string
  /** The signed submission, opaque to the application. */
  submission: string
}

export type CredentialSubmissionStatus =
  | { state: 'confirmed'; confirmations: number }
  | { state: 'pending' }
  | { state: 'rejected'; reason: string | null }
  | { state: 'unknown' }

/**
 * Issues credentials about a DID as the platform's own issuer identity.
 *
 * It signs and submits but keeps no state: the application decides eligibility, stores every
 * prepared submission before sending it, and owns retries.
 */
export interface IdentityCredentialIssuer {
  /** The issuer's DID. */
  readonly issuer: string
  /** A stable key for one account reaching one level, the same on every attempt. */
  levelKey(achievement: LevelAchievement): string
  prepareLevel(input: {
    subject: string
    achievement: LevelAchievement
    issuedAt: Date
  }): Promise<PreparedCredential>
  /** Sends a prepared submission and returns its reference. Sending it again is harmless. */
  submit(submission: string): Promise<string>
  status(reference: string): Promise<CredentialSubmissionStatus>
}

export interface IdentityProvider {
  /** The plugin name that built this provider. */
  readonly name: string
  readonly network: IdentityNetwork
  /** Present when the provider is configured to issue credentials. */
  readonly credentials?: IdentityCredentialIssuer | null
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
