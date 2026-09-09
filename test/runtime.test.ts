import { afterEach, describe, expect, it, vi } from 'vitest'
import { installEncodingPolyfills } from '../src/encoding'
import { fetchRuntimeAdapter, requiredText } from '../src/runtime'

afterEach(() => vi.unstubAllGlobals())

describe('React Native runtime helpers', () => {
  it('installs UTF-8 and base64 fallbacks only when missing', () => {
    vi.stubGlobal('atob', undefined); vi.stubGlobal('btoa', undefined)
    vi.stubGlobal('TextEncoder', undefined); vi.stubGlobal('TextDecoder', undefined)
    installEncodingPolyfills()
    const bytes = new TextEncoder().encode('ConvoKit 🌎')
    expect(new TextDecoder().decode(bytes)).toBe('ConvoKit 🌎')
    expect(atob(btoa('native-runtime'))).toBe('native-runtime')
  })

  it('converts a React Native URI response into an upload body', async () => {
    const blob = new Blob(['attachment'], { type: 'text/plain' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(blob)))
    await expect(fetchRuntimeAdapter.readFile({ uri: 'file:///attachment.txt', fileName: 'attachment.txt' }))
      .resolves.toEqual(blob)
  })

  it('validates identifiers before SDK calls', () => {
    expect(requiredText('  conversation-1 ', 'conversationId')).toBe('conversation-1')
    expect(() => requiredText(' ', 'conversationId')).toThrow('conversationId is required')
  })
})
