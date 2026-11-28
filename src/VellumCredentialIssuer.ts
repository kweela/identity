import { ccc } from '@ckb-ccc/core'
import {
  writeClaim,
  type ClaimScriptConfigLike,
  type WriteClaimProps,
  type WriteClaimResult,
} from '@usevellum/sdk'

import { isCkbDid } from './ckb'
import type {
  CredentialSubmissionStatus,
  IdentityCredentialIssuer,
  LevelAchievement,
  PreparedCredential,
} from './contracts'
import {
  buildKweelaLevelClaimInput,
  kweelaLevelClaimKey,
  type KweelaLevelAchievedClaimPayload,
} from './vellum'

export type ClaimWriter = (
  props: WriteClaimProps<KweelaLevelAchievedClaimPayload>,
) => Promise<WriteClaimResult>

/** Vellum's Claim Type and DID Lock deployment on CKB Testnet. */
export const VELLUM_TESTNET_SCRIPTS: ClaimScriptConfigLike = {
  claimType: {
    codeHash: '0xfb2757e524b3f83161d8b85b8b3e00186e2019ff04f5dfe833c5a72731e13157',
    hashType: 'type',
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash: '0xaf693346282063a5d51f79d180fc807cdba1b8ac9d7af30085ff0aa190e2686c',
            index: 0,
          },
          depType: 'code',
        },
      },
    ],
  },
  didLock: {
    codeHash: '0xe1562cc57b4bd91619ada2f7e74d63805ea7038a7b6de0b18a529d51aa883d2d',
    hashType: 'type',
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash: '0xaf693346282063a5d51f79d180fc807cdba1b8ac9d7af30085ff0aa190e2686c',
            index: 1,
          },
          depType: 'code',
        },
      },
    ],
  },
}

/**
 * Issues Kweela level claims as Vellum Claim Cells, signed by the key that controls the issuer DID.
 */
export class VellumCredentialIssuer implements IdentityCredentialIssuer {
  constructor(
    private readonly client: ccc.Client,
    private readonly signer: ccc.Signer,
    readonly issuer: string,
    private readonly scripts: ClaimScriptConfigLike,
    private readonly write: ClaimWriter = writeClaim,
  ) {}

  /**
   * Builds an issuer from provider settings, or returns null while any of them is missing.
   *
   * Vellum is deployed on testnet only, so mainnet needs its scripts configured explicitly.
   */
  static fromSettings(
    network: 'ckb' | 'ckb_testnet',
    client: ccc.Client,
    settings: Readonly<Record<string, unknown>>,
  ): VellumCredentialIssuer | null {
    const issuerDid = typeof settings.issuerDid === 'string' ? settings.issuerDid.trim() : ''
    const privateKey =
      typeof settings.issuerPrivateKey === 'string' ? settings.issuerPrivateKey.trim() : ''
    const scripts =
      (settings.scripts as ClaimScriptConfigLike | undefined) ??
      (network === 'ckb_testnet' ? VELLUM_TESTNET_SCRIPTS : undefined)

    if (!issuerDid || !privateKey || !scripts) return null

    if (!isCkbDid(issuerDid))
      throw new TypeError('The credential issuer must be a did:ckb identifier.')

    return new VellumCredentialIssuer(
      client,
      new ccc.SignerCkbPrivateKey(client, privateKey),
      issuerDid,
      scripts,
    )
  }

  levelKey(achievement: LevelAchievement): string {
    return kweelaLevelClaimKey(achievement)
  }

  async prepareLevel(input: {
    subject: string
    achievement: LevelAchievement
    issuedAt: Date
  }): Promise<PreparedCredential> {
    const claim = buildKweelaLevelClaimInput({
      subjectDid: input.subject,
      issuerDid: this.issuer,
      achievement: input.achievement,
      issuedAt: Math.floor(input.issuedAt.getTime() / 1000),
    })

    const built = await this.write({
      issuerSigner: this.signer,
      scripts: this.scripts,
      input: claim,
    })
    const reference = built.tx.hash()
    const signed = await this.signer.signOnlyTransaction(built.tx)

    if (signed.hash() !== reference) throw new Error('The signer changed the prepared transaction.')

    return { reference, credentialId: built.claimId, submission: ccc.hexFrom(signed.toBytes()) }
  }

  async submit(submission: string): Promise<string> {
    const tx = ccc.Transaction.fromBytes(submission)

    try {
      return await this.client.sendTransaction(tx)
    } catch (error) {
      // A node that already holds or committed the transaction refuses it again.
      const known = await this.client.getTransaction(tx.hash())

      if (known && known.status !== 'rejected' && known.status !== 'unknown') return tx.hash()

      throw error
    }
  }

  async status(reference: string): Promise<CredentialSubmissionStatus> {
    const response = await this.client.getTransaction(reference)

    if (!response || response.status === 'unknown') return { state: 'unknown' }

    if (response.status === 'rejected')
      return { state: 'rejected', reason: response.reason ?? null }

    if (response.status !== 'committed' || response.blockNumber === undefined)
      return { state: 'pending' }

    const tip = await this.client.getTip()

    return { state: 'confirmed', confirmations: Number(tip - response.blockNumber) + 1 }
  }
}
