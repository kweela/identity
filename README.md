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
