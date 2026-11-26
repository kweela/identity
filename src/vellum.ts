import { ccc } from '@ckb-ccc/core'
import type { WriteClaimInput } from '@usevellum/sdk'

import { isCkbDid } from './ckb'

export const KWEELA_LEVEL_ACHIEVED_CLAIM_SCHEMA_ID = 'kweela.level-achieved.v1' as const
export const KWEELA_LEVEL_ACHIEVED_CLAIM_SCHEMA_HASH =
  '0x380a2dcb476db5ca1db95f282b6dfe40462054b1a0e27bb44551fba94324bb00' as const

export type KweelaLevelAchievement = {
  accountId: string
  profileSlug: string
  level: number
  levelPolicyVersion: string
  achievedAt: number
}

export type KweelaLevelAchievedClaimPayload = {
  account_id: string
  profile_slug: string
  level: number
  level_policy_version: string
  achieved_at: number
}

export type KweelaLevelClaimInputOptions = {
  subjectDid: string
  issuerDid: string
  achievement: KweelaLevelAchievement
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TOKEN_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/
const UINT32_MAX = 4_294_967_295
const NONCE_DOMAIN = `${KWEELA_LEVEL_ACHIEVED_CLAIM_SCHEMA_ID}:claim`

function requireAccountId(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError('Kweela accountId must be a canonical lowercase UUID.')
  }
  return value
}

function requireToken(value: string, field: string): string {
  if (value.length > 64 || !TOKEN_PATTERN.test(value)) {
    throw new TypeError(`${field} must be a lowercase token of 1 through 64 characters.`)
  }
  return value
}

function requireLevel(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > UINT32_MAX) {
    throw new TypeError('Kweela level must be an integer from 1 through 2^32 - 1.')
  }
  return value
}

function requireTimestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError('Kweela achievedAt must be a positive safe-integer Unix timestamp.')
  }
  return value
}

function requireDid(value: string, field: string): string {
  if (!isCkbDid(value)) throw new TypeError(`${field} must be a valid did:ckb identifier.`)
  return value
}

export function kweelaLevelClaimPayload(
  achievement: KweelaLevelAchievement,
): KweelaLevelAchievedClaimPayload {
  return {
    account_id: requireAccountId(achievement.accountId),
    profile_slug: requireToken(achievement.profileSlug, 'Kweela profileSlug'),
    level: requireLevel(achievement.level),
    level_policy_version: requireToken(achievement.levelPolicyVersion, 'Kweela levelPolicyVersion'),
    achieved_at: requireTimestamp(achievement.achievedAt),
  }
}

export function kweelaLevelClaimKey(
  achievement: Pick<KweelaLevelAchievement, 'accountId' | 'level'>,
): string {
  return `${KWEELA_LEVEL_ACHIEVED_CLAIM_SCHEMA_ID}:${requireAccountId(achievement.accountId)}:${requireLevel(achievement.level)}`
}

export function kweelaLevelClaimNonce(
  achievement: Pick<KweelaLevelAchievement, 'accountId' | 'level'>,
): ccc.Hex {
  const key = `${NONCE_DOMAIN}:${requireAccountId(achievement.accountId)}:${requireLevel(achievement.level)}`
  return ccc.hashCkb(new TextEncoder().encode(key))
}

export function buildKweelaLevelClaimInput(
  options: KweelaLevelClaimInputOptions,
): WriteClaimInput<KweelaLevelAchievedClaimPayload> {
  const payload = kweelaLevelClaimPayload(options.achievement)

  return {
    subject: { did: requireDid(options.subjectDid, 'subjectDid') },
    issuerDid: requireDid(options.issuerDid, 'issuerDid'),
    schemaHash: KWEELA_LEVEL_ACHIEVED_CLAIM_SCHEMA_HASH,
    payload,
    issuedAt: payload.achieved_at,
    nonce: kweelaLevelClaimNonce(options.achievement),
  }
}
