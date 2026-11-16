import { ccc } from '@ckb-ccc/core'
import { argsToDid, DidCkbData, type DidCkbRecord } from '@ckb-ccc/did-ckb'
import { describe, expect, it } from 'vitest'

import {
  CkbDidProvider,
  IdentityProviderRegistry,
  JoyIdCredentials,
  identityPlugin,
  isCkbDid,
  type IdentityOwnershipChallenge,
  type IdentityProvider,
} from '../src/index'

const client = new ccc.ClientPublicTestnet()
const holder = new ccc.SignerCkbPrivateKey(client, `0x${'1'.repeat(64)}`)
const stranger = new ccc.SignerCkbPrivateKey(client, `0x${'2'.repeat(64)}`)
const id = `0x${'ab'.repeat(20)}`
const did = argsToDid(id)

async function recordFor(signer: ccc.Signer): Promise<DidCkbRecord> {
  const { script } = await signer.getRecommendedAddressObj()

  return {
    did,
    id: ccc.hexFrom(id),
    data: DidCkbData.fromV1({ document: { alsoKnownAs: ['at://example.test'] }, localId: null }),
    cell: ccc.Cell.from({
      outPoint: { txHash: `0x${'00'.repeat(32)}`, index: 0 },
      cellOutput: { capacity: 0n, lock: script },
      outputData: '0x',
    }),
  }
}

async function providerHeldBy(signer: ccc.Signer): Promise<CkbDidProvider> {
  const record = await recordFor(signer)

  return new CkbDidProvider('ckb_testnet', client, {
    records: {
      find: async (value) => (value === did ? record : undefined),
      byLock: async (lock) => (lock.eq(record.cell.cellOutput.lock) ? [record] : []),
    },
  })
}

async function challengeFor(
  signer: ccc.Signer,
  overrides: Partial<IdentityOwnershipChallenge> = {},
) {
  return {
    did,
    address: await signer.getRecommendedAddress(),
    network: 'ckb_testnet' as const,
    audience: 'Hall of Fame',
    nonce: 'nonce-1',
    issuedAt: '2026-11-01T00:00:00.000Z',
    expiresAt: '2026-11-01T00:10:00.000Z',
    ...overrides,
  }
}

const now = new Date('2026-11-01T00:05:00.000Z')

describe('identity provider registry', () => {
  it('returns a registered provider', () => {
    const provider = {} as IdentityProvider

    expect(
      new IdentityProviderRegistry().register('ckb_testnet', provider).provider('ckb_testnet'),
    ).toBe(provider)
  })

  it('refuses an unavailable network', () => {
    expect(() => new IdentityProviderRegistry().provider('ckb')).toThrow(
      'No identity provider is registered for ckb.',
    )
  })
})

describe('identity plugin', () => {
  it('builds a did:ckb provider for the configured network', async () => {
    const testnet = await identityPlugin.create({})
    const mainnet = await identityPlugin.create({ network: 'ckb' })

    expect(identityPlugin.name).toBe('ckb')
    expect([testnet.name, testnet.network, mainnet.network]).toEqual(['ckb', 'ckb_testnet', 'ckb'])
    expect(testnet.accepts(did)).toBe(true)
    expect(testnet.accepts('did:web:example.com')).toBe(false)
  })
})

describe('CKB DIDs', () => {
  it('accepts only well-formed did:ckb identifiers', () => {
    expect(isCkbDid(did)).toBe(true)
    expect(isCkbDid('did:ckb:example-1')).toBe(false)
    expect(isCkbDid('did:web:example.com')).toBe(false)
  })

  it('resolves a live DID with its controller and a JSON-safe document', async () => {
    const provider = await providerHeldBy(holder)
    const profile = await provider.resolve(did)

    expect(profile).toMatchObject({
      did,
      network: 'ckb_testnet',
      controller: { address: await holder.getRecommendedAddress() },
      document: { alsoKnownAs: ['at://example.test'] },
    })
    expect(JSON.parse(JSON.stringify(profile))).toEqual(profile)
  })

  it('lists the DIDs held by an address', async () => {
    const provider = await providerHeldBy(holder)

    expect(await provider.owned(await holder.getRecommendedAddress())).toHaveLength(1)
    expect(await provider.owned(await stranger.getRecommendedAddress())).toHaveLength(0)
    expect(await provider.owned('not-an-address')).toHaveLength(0)
  })
})

describe('DID ownership proofs', () => {
  it('verifies a signature from the lock holding the DID', async () => {
    const provider = await providerHeldBy(holder)
    const challenge = await challengeFor(holder)
    const signature = await holder.signMessage(provider.message(challenge))

    expect(await provider.verify({ challenge, signature }, now)).toMatchObject({
      verified: true,
      profile: { did },
    })
  })

  it('rejects a signature over a different message', async () => {
    const provider = await providerHeldBy(holder)
    const challenge = await challengeFor(holder)
    const signature = await holder.signMessage(provider.message({ ...challenge, nonce: 'other' }))

    expect(await provider.verify({ challenge, signature }, now)).toEqual({
      verified: false,
      reason: 'invalid_signature',
    })
  })

  it('rejects a key that does not hold the DID even when it names the holder address', async () => {
    const provider = await providerHeldBy(holder)
    const challenge = await challengeFor(holder)
    const signature = await stranger.signMessage(provider.message(challenge))

    expect(await provider.verify({ challenge, signature }, now)).toEqual({
      verified: false,
      reason: 'not_controller',
    })
  })

  it('rejects an address that does not hold the DID', async () => {
    const provider = await providerHeldBy(holder)
    const challenge = await challengeFor(stranger)
    const signature = await stranger.signMessage(provider.message(challenge))

    expect(await provider.verify({ challenge, signature }, now)).toEqual({
      verified: false,
      reason: 'not_controller',
    })
  })

  it('rejects expired, unknown, cross-network, and unsupported proofs', async () => {
    const provider = await providerHeldBy(holder)
    const proof = async (overrides: Partial<IdentityOwnershipChallenge>) => {
      const challenge = await challengeFor(holder, overrides)

      return { challenge, signature: await holder.signMessage(provider.message(challenge)) }
    }

    expect(
      await provider.verify(await proof({ expiresAt: '2026-11-01T00:01:00.000Z' }), now),
    ).toEqual({
      verified: false,
      reason: 'expired',
    })
    expect(
      await provider.verify(await proof({ did: argsToDid(`0x${'cd'.repeat(20)}`) }), now),
    ).toEqual({
      verified: false,
      reason: 'not_found',
    })
    expect(await provider.verify(await proof({ network: 'ckb' }), now)).toEqual({
      verified: false,
      reason: 'network_mismatch',
    })

    const valid = await proof({})

    expect(
      await provider.verify(
        { ...valid, signature: { ...valid.signature, signType: 'EvmPersonal' } },
        now,
      ),
    ).toEqual({ verified: false, reason: 'unsupported_signer' })
  })
})

describe('JoyID credentials', () => {
  const address =
    'ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq9kxr7vy7yknezj0vj0xptx6thk6pwyr0sxamv6q'
  const respond = (credentials: unknown) => async () => ({
    ok: true,
    json: async () => ({ credentials }),
  })

  it('matches a passkey registered to the address', async () => {
    const joyId = new JoyIdCredentials(
      'ckb_testnet',
      respond([{ ckb_address: address, public_key: '0xABCD' }]),
    )

    expect(await joyId.owns(address, 'abcd')).toBe(true)
  })

  it('matches a main key the registry lists with its uncompressed prefix', async () => {
    const coordinates = 'ab'.repeat(64)
    const joyId = new JoyIdCredentials(
      'ckb_testnet',
      respond([{ ckb_address: address, public_key: `04${coordinates}` }]),
    )

    expect(await joyId.owns(address, coordinates)).toBe(true)
  })

  it('refuses a passkey registered elsewhere or an unavailable registry', async () => {
    const elsewhere = new JoyIdCredentials(
      'ckb_testnet',
      respond([{ ckb_address: 'ckt1other', public_key: 'abcd' }]),
    )
    const down = new JoyIdCredentials('ckb_testnet', async () => ({
      ok: false,
      json: async () => ({}),
    }))

    expect(await elsewhere.owns(address, 'abcd')).toBe(false)
    expect(await down.owns(address, 'abcd')).toBe(false)
  })
})
