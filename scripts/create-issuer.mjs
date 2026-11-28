// Creates the key and did:ckb identity a platform issues credentials as.
//
//   node scripts/create-issuer.mjs key        prints a new private key and its address
//   ISSUER_KEY=0x... node scripts/create-issuer.mjs did   creates a DID that key controls
//
// Pass NETWORK=ckb for mainnet; testnet is the default.
import { randomBytes } from 'node:crypto'

import { ccc } from '@ckb-ccc/core'
import { argsToDid, createDidCkb } from '@ckb-ccc/did-ckb'

const network = process.env.NETWORK === 'ckb' ? 'ckb' : 'ckb_testnet'
const client = network === 'ckb' ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet()

async function key() {
  const privateKey = ccc.hexFrom(randomBytes(32))
  const signer = new ccc.SignerCkbPrivateKey(client, privateKey)

  console.log(`IDENTITY_CREDENTIAL_ISSUER_KEY=${privateKey}`)
  console.log(`address: ${await signer.getRecommendedAddress()}`)
  console.log('Fund this address, then run the did step with ISSUER_KEY set to the key above.')
}

async function did() {
  const privateKey = process.env.ISSUER_KEY

  if (!privateKey) throw new Error('Set ISSUER_KEY to the key printed by the key step.')

  const signer = new ccc.SignerCkbPrivateKey(client, privateKey)
  const balance = await signer.getBalance()

  console.log(`address: ${await signer.getRecommendedAddress()}`)
  console.log(`balance: ${ccc.fixedPointToString(balance)} CKB`)

  const { tx, id } = await createDidCkb({ signer, data: { value: { document: {} } } })

  await tx.completeInputsByCapacity(signer)
  await tx.completeFeeBy(signer)

  const hash = await signer.sendTransaction(tx)

  console.log(`sent ${hash}, waiting for it to commit...`)
  await client.waitTransaction(hash)

  console.log(`IDENTITY_CREDENTIAL_ISSUER_DID=${argsToDid(id)}`)
}

const steps = { key, did }
const step = steps[process.argv[2]]

if (!step) {
  console.error('Usage: node scripts/create-issuer.mjs key | did')
  process.exit(1)
}

await step()
