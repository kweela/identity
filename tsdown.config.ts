import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/contracts.ts',
    'src/IdentityProviderRegistry.ts',
    'src/ckb.ts',
    'src/CkbDidProvider.ts',
    'src/JoyIdCredentials.ts',
    'src/OwnershipMessage.ts',
    'src/plugin.ts',
  ],
  dts: true,
  exports: true,
})
