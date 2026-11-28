# @kweela/identity

Portable-identity contracts and providers for Kweela applications. Product clients and APIs depend
on `IdentityProvider`; provider-specific SDK calls stay inside the provider.

The package does not store keys, persist challenges, infer access, or make entitlement decisions.

## Plugins

A provider package exports an `IdentityPlugin`: a name and a factory that builds an
`IdentityProvider` from settings only that provider understands. Applications select a provider
by configuration instead of importing it, so replacing one DID method with another needs no
application code.

```ts
const { identityPlugin } = await import('@kweela/identity')
const provider = await identityPlugin.create({ network: 'ckb_testnet' })
```

Every provider verifies ownership the same way:

1. The application issues an `IdentityOwnershipChallenge` naming the DID, the wallet address,
   the network, a nonce, and an expiry, and stores it.
2. The wallet signs `provider.message(challenge)`.
3. `provider.verify({ challenge, signature })` confirms the signature, that the address controls
   the DID, and that the signing key controls that address.

`profile.controller.id` identifies whatever controls the DID. It changes when the DID is
transferred, so an application can tell that a link no longer holds.

## did:ckb

The package's plugin is named `ckb`. It resolves `did:ckb` identities through `@ckb-ccc/did-ckb`.
Its `network` setting is `ckb` for mainnet; anything else selects `ckb_testnet`.

Supported signers are CKB secp256k1 wallets, whose lock is derived from the public key, and JoyID,
whose passkey is matched to its address through JoyID's credential registry. Other signers are
reported as `unsupported_signer`.

## Vellum level claims

The optional `@kweela/identity/vellum` entry point converts an API-authorized level achievement
into the canonical `kweela.level-achieved.v1` Vellum claim input. It validates the public evidence
and derives a stable account-and-level key and nonce for retries.

```ts
import { writeClaim } from '@usevellum/sdk'
import { buildKweelaLevelClaimInput, kweelaLevelClaimKey } from '@kweela/identity/vellum'

const achievement = {
  accountId: account.id,
  profileSlug: account.slug,
  level: account.level,
  levelPolicyVersion: 'kweela.levels.v1',
}

const key = kweelaLevelClaimKey(achievement)
const input = buildKweelaLevelClaimInput({
  subjectDid: linkedIdentity.did,
  issuerDid: configuredIssuerDid,
  achievement,
  issuedAt: issuance.createdAtSeconds,
})
const prepared = await writeClaim({ issuerSigner, scripts, input })
```

The server must obtain every `achievement` field from the authoritative Kweela API. Before calling
the adapter, it must revalidate the authenticated account, current DID controller, and achieved
level. It must reserve `key` with a database uniqueness constraint, persist the exact signed
transaction and issuance time before broadcast, and reconcile uncertain submissions by their saved
transaction and deterministic nonce. Issuance must remain disabled unless all issuer, script, RPC,
confirmation, and secret settings are present.

The adapter does not query eligibility, store state, sign transactions, broadcast transactions, or
prevent duplicates on its own. The private API owns those responsibilities. The public payload
contains no XP, mutable reputation totals, raw activity, private account data, or credentials.

## Issuing credentials

When `credentials` is set, the provider exposes `provider.credentials`, an
`IdentityCredentialIssuer` that signs level claims as the platform's issuer DID.

```ts
identityPlugin.create({
  network: 'ckb_testnet',
  credentials: {
    issuerDid: 'did:ckb:...',
    issuerPrivateKey: '0x...',
    // Optional on testnet, where Vellum's deployment is the default; required on mainnet.
    scripts: { claimType, didLock },
  },
})
```

`prepareLevel` builds and signs the claim without broadcasting it and returns the transaction hash
as `reference` with the signed bytes as `submission`. The application saves both, then calls
`submit`, which is safe to repeat, and follows the transaction with `status`. The issuer is null
while the issuer DID or key is missing, and `@usevellum/sdk` is loaded only when it is configured.
