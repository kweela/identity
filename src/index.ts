import type {
  CredentialSubmissionStatus,
  IdentityController,
  IdentityCredentialIssuer,
  IdentityNetwork,
  IdentityOwnershipChallenge,
  IdentityOwnershipFailure,
  IdentityOwnershipProof,
  IdentityOwnershipResult,
  IdentityPlugin,
  IdentityProfile,
  IdentityProvider,
  IdentitySignature,
  LevelAchievement,
  PortableCredential,
  PreparedCredential,
} from './contracts'

import {
  CkbDidProvider,
  type CkbDidProviderOptions,
  type CkbDidRecords,
  type CkbNetwork,
} from './CkbDidProvider'
import { IdentityProviderRegistry } from './IdentityProviderRegistry'
import { JoyIdCredentials } from './JoyIdCredentials'
import { OwnershipMessage } from './OwnershipMessage'
import { isCkbDid } from './ckb'
import { identityPlugin } from './plugin'

export {
  CkbDidProvider,
  IdentityProviderRegistry,
  JoyIdCredentials,
  OwnershipMessage,
  identityPlugin,
  isCkbDid,
}
export default identityPlugin
export type {
  CredentialSubmissionStatus,
  IdentityCredentialIssuer,
  LevelAchievement,
  PreparedCredential,
  CkbDidProviderOptions,
  CkbDidRecords,
  CkbNetwork,
  IdentityController,
  IdentityNetwork,
  IdentityOwnershipChallenge,
  IdentityOwnershipFailure,
  IdentityOwnershipProof,
  IdentityOwnershipResult,
  IdentityPlugin,
  IdentityProfile,
  IdentityProvider,
  IdentitySignature,
  PortableCredential,
}
