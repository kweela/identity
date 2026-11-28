import { ccc } from '@ckb-ccc/core'
import { argsToDid } from '@ckb-ccc/did-ckb'
import { describe, expect, it } from 'vitest'

import { identityPlugin } from '../src/plugin'
import { VellumCredentialIssuer } from '../src/VellumCredentialIssuer'

const issuerDid = argsToDid(`0x${'22'.repeat(20)}`)
const issuerPrivateKey = `0x${'01'.repeat(32)}`

/** A client answering only the reads the issuer makes after a submission. */
function clientAnswering(response: Partial<ccc.ClientTransactionResponse> | undefined, tip = 110n) {
  return {
    getTransaction: async () => response,
    getTip: async () => tip,
  } as unknown as ccc.Client
}

function issuerWith(client: ccc.Client): VellumCredentialIssuer {
  return new VellumCredentialIssuer(client, {} as ccc.Signer, issuerDid, {
    claimType: { codeHash: '0x', hashType: 'type', cellDeps: [] },
  })
}

describe('Vellum credential issuer', () => {
  it('stays off until the issuer DID and key are both configured', async () => {
    const client = testnetClient()

    expect(VellumCredentialIssuer.fromSettings('ckb_testnet', client, {})).toBeNull()
    expect(VellumCredentialIssuer.fromSettings('ckb_testnet', client, { issuerDid })).toBeNull()
    expect(
      VellumCredentialIssuer.fromSettings('ckb_testnet', client, { issuerDid, issuerPrivateKey })
        ?.issuer,
    ).toBe(issuerDid)
  })

  it('needs explicit scripts on mainnet, where Vellum is not deployed', () => {
    expect(
      VellumCredentialIssuer.fromSettings('ckb', testnetClient(), { issuerDid, issuerPrivateKey }),
    ).toBeNull()
  })

  it('refuses an issuer that is not a did:ckb identifier', () => {
    expect(() =>
      VellumCredentialIssuer.fromSettings('ckb_testnet', testnetClient(), {
        issuerDid: 'did:web:example.com',
        issuerPrivateKey,
      }),
    ).toThrow('did:ckb')
  })

  it('reports confirmations from the chain tip', async () => {
    const issuer = issuerWith(clientAnswering({ status: 'committed', blockNumber: 100n }))

    expect(await issuer.status('0x01')).toEqual({ state: 'confirmed', confirmations: 11 })
  })

  it('distinguishes pending, rejected and unknown submissions', async () => {
    expect(await issuerWith(clientAnswering({ status: 'proposed' })).status('0x01')).toEqual({
      state: 'pending',
    })
    expect(
      await issuerWith(clientAnswering({ status: 'rejected', reason: 'dead input' })).status(
        '0x01',
      ),
    ).toEqual({ state: 'rejected', reason: 'dead input' })
    expect(await issuerWith(clientAnswering(undefined)).status('0x01')).toEqual({
      state: 'unknown',
    })
  })

  it('builds the provider with an issuer only when credentials are configured', async () => {
    const plain = await identityPlugin.create({})
    const issuing = await identityPlugin.create({ credentials: { issuerDid, issuerPrivateKey } })

    expect(plain.credentials).toBeNull()
    expect(issuing.credentials?.issuer).toBe(issuerDid)
    expect(
      issuing.credentials?.levelKey({
        accountId: '123e4567-e89b-12d3-a456-426614174000',
        profileSlug: 'legacy',
        level: 5,
        levelPolicyVersion: 'kweela.levels.v1',
      }),
    ).toBe('kweela.level-achieved.v1:123e4567-e89b-12d3-a456-426614174000:5')
  })
})

function testnetClient(): ccc.Client {
  return new ccc.ClientPublicTestnet()
}
