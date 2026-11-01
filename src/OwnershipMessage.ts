import type { IdentityOwnershipChallenge } from './contracts'

/**
 * The plain-text statement a wallet signs to prove it controls a DID.
 */
export class OwnershipMessage {
  static format(challenge: IdentityOwnershipChallenge): string {
    return [
      `${challenge.audience} asks you to confirm that you control this decentralized identity.`,
      '',
      `DID: ${challenge.did}`,
      `Address: ${challenge.address}`,
      `Network: ${challenge.network}`,
      `Nonce: ${challenge.nonce}`,
      `Issued at: ${challenge.issuedAt}`,
      `Expires at: ${challenge.expiresAt}`,
    ].join('\n')
  }
}
