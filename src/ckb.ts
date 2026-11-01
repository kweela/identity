import { isDidCkb } from '@ckb-ccc/did-ckb'

export function isCkbDid(value: string): boolean {
  return isDidCkb(value)
}
