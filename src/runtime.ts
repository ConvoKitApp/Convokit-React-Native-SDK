import { ConvoKitError, type UploadBody } from '@convokitapp/sdk'

export interface NativeFileInput {
  uri: string
  fileName: string
  contentType?: string
  size?: number
}

export interface DownloadedMediaInput {
  blob: Blob
  fileName: string
  contentType?: string
  destinationUri?: string
}

export interface ReactNativeRuntimeAdapter {
  readFile(input: NativeFileInput): Promise<UploadBody>
  saveDownload?(input: DownloadedMediaInput): Promise<string>
}

export const fetchRuntimeAdapter: ReactNativeRuntimeAdapter = {
  async readFile(input) {
    if (!input.uri.trim()) {
      throw new ConvoKitError('uri is required', { code: 'INVALID_ARGUMENT' })
    }
    let response: Response
    try {
      response = await fetch(input.uri)
    } catch (cause) {
      throw new ConvoKitError('Could not read the selected file', {
        code: 'NATIVE_FILE_READ_FAILED',
        cause,
      })
    }
    if (!response.ok) {
      throw new ConvoKitError('Could not read the selected file', {
        code: 'NATIVE_FILE_READ_FAILED',
        status: response.status,
      })
    }
    return response.blob()
  },
}

export function assertReactNativeRuntime(): void {
  const missing = ['fetch', 'URL', 'WebSocket', 'atob', 'TextDecoder'].filter(
    key => typeof (globalThis as Record<string, unknown>)[key] === 'undefined',
  )
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    missing.push('crypto.getRandomValues')
  }
  if (missing.length) {
    throw new ConvoKitError(`React Native runtime is missing: ${missing.join(', ')}`, {
      code: 'REACT_NATIVE_RUNTIME_UNAVAILABLE',
    })
  }
}

export function requiredText(value: string, name: string): string {
  const result = value.trim()
  if (!result) throw new ConvoKitError(`${name} is required`, { code: 'INVALID_ARGUMENT' })
  return result
}
