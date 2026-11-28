import { argsToDid } from '@ckb-ccc/did-ckb'
import { describe, expect, it } from 'vitest'

import {
  KWEELA_LEVEL_ACHIEVED_CLAIM_SCHEMA_HASH,
  KWEELA_LEVEL_ACHIEVED_CLAIM_SCHEMA_ID,
  buildKweelaLevelClaimInput,
  kweelaLevelClaimKey,
  kweelaLevelClaimNonce,
  kweelaLevelClaimPayload,
  type KweelaLevelAchievement,
} from '../src/vellum'

const subjectDid = argsToDid(`0x${'11'.repeat(20)}`)
const issuerDid = argsToDid(`0x${'22'.repeat(20)}`)
const achievement: KweelaLevelAchievement = {
  accountId: '123e4567-e89b-12d3-a456-426614174000',
  profileSlug: 'legacy',
  level: 5,
  levelPolicyVersion: 'kweela.levels.v1',
}
const issuedAt = 2_000_000_000

describe('Kweela Vellum level claims', () => {
  it('builds the canonical claim payload from authoritative level evidence', () => {
    expect(kweelaLevelClaimPayload(achievement)).toEqual({
      account_id: achievement.accountId,
      profile_slug: achievement.profileSlug,
      level: achievement.level,
      level_policy_version: achievement.levelPolicyVersion,
    })
  })

  it('builds a typed claim input with a deterministic nonce', () => {
    const input = buildKweelaLevelClaimInput({ subjectDid, issuerDid, achievement, issuedAt })

    expect(input).toEqual({
      subject: { did: subjectDid },
      issuerDid,
      schemaHash: KWEELA_LEVEL_ACHIEVED_CLAIM_SCHEMA_HASH,
      payload: kweelaLevelClaimPayload(achievement),
      issuedAt,
      nonce: kweelaLevelClaimNonce(achievement),
    })
    expect(KWEELA_LEVEL_ACHIEVED_CLAIM_SCHEMA_ID).toBe('kweela.level-achieved.v1')
    expect(input.nonce).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('derives stable retry identifiers from the account-and-level pair', () => {
    expect(kweelaLevelClaimKey(achievement)).toBe(
      'kweela.level-achieved.v1:123e4567-e89b-12d3-a456-426614174000:5',
    )
    expect(kweelaLevelClaimNonce(achievement)).toBe(
      '0x3e9dd3a345c7abe3790a5f28b96e5c1ddbb929805c46d2758318b1a6c18201c7',
    )
    expect(kweelaLevelClaimNonce(achievement)).toBe(kweelaLevelClaimNonce({ ...achievement }))
    expect(kweelaLevelClaimNonce({ ...achievement, level: 6 })).not.toBe(
      kweelaLevelClaimNonce(achievement),
    )
    expect(
      kweelaLevelClaimNonce({
        ...achievement,
        accountId: '223e4567-e89b-12d3-a456-426614174000',
      }),
    ).not.toBe(kweelaLevelClaimNonce(achievement))
  })

  it('rejects malformed evidence and client-provided identifier variants', () => {
    for (const accountId of [
      '123E4567-E89B-12D3-A456-426614174000',
      '123e4567-e89b-12d3-a456-42661417400',
    ]) {
      expect(() => kweelaLevelClaimPayload({ ...achievement, accountId })).toThrow()
    }
    for (const profileSlug of ['', 'Legacy', '-legacy', 'legacy-', 'a'.repeat(65)]) {
      expect(() => kweelaLevelClaimPayload({ ...achievement, profileSlug })).toThrow()
    }
    for (const levelPolicyVersion of ['', 'Kweela.Levels.V1', 'v1/levels', 'x'.repeat(65)]) {
      expect(() => kweelaLevelClaimPayload({ ...achievement, levelPolicyVersion })).toThrow()
    }
    for (const level of [0, 1.5, 4_294_967_296]) {
      expect(() => kweelaLevelClaimPayload({ ...achievement, level })).toThrow()
    }
  })

  it('rejects malformed subject and issuer DIDs or issuance times', () => {
    expect(() =>
      buildKweelaLevelClaimInput({
        subjectDid: 'did:ckb:invalid',
        issuerDid,
        achievement,
        issuedAt,
      }),
    ).toThrow('subjectDid')
    expect(() =>
      buildKweelaLevelClaimInput({
        subjectDid,
        issuerDid: 'did:ckb:invalid',
        achievement,
        issuedAt,
      }),
    ).toThrow('issuerDid')
    for (const invalidIssuedAt of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        buildKweelaLevelClaimInput({
          subjectDid,
          issuerDid,
          achievement,
          issuedAt: invalidIssuedAt,
        }),
      ).toThrow('issuedAt')
    }
  })
})
