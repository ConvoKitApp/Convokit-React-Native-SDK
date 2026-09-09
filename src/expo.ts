import 'react-native-url-polyfill/auto'
import * as ExpoCrypto from 'expo-crypto'
import * as FileSystem from 'expo-file-system'

import { ConvoKitClient as BaseClient, type ReactNativeClientOptions } from './client'
import { installEncodingPolyfills } from './encoding'
import type { DownloadedMediaInput, NativeFileInput, ReactNativeRuntimeAdapter } from './runtime'

installEncodingPolyfills()

if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  const current = globalThis.crypto ?? ({} as Crypto)
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: Object.assign(current, { getRandomValues: ExpoCrypto.getRandomValues }),
  })
}

export const expoRuntimeAdapter: ReactNativeRuntimeAdapter = {
  async readFile(input: NativeFileInput) {
    const file = new FileSystem.File(input.uri)
    return file.arrayBuffer()
  },
  async saveDownload(input: DownloadedMediaInput) {
    if (!input.destinationUri) throw new Error('destinationUri is required by the Expo adapter')
    const file = new FileSystem.File(input.destinationUri)
    file.write(new Uint8Array(await input.blob.arrayBuffer()))
    return file.uri
  },
}

export class ConvoKitClient extends BaseClient {
  constructor(options: ReactNativeClientOptions) {
    super({ ...options, runtimeAdapter: options.runtimeAdapter ?? expoRuntimeAdapter })
  }
}

export * from './exports'
