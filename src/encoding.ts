const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function decodeBase64(value: string): string {
  const input = value.replace(/\s/g, '')
  if (input.length % 4 === 1 || /[^A-Za-z0-9+/=]/.test(input)) throw new TypeError('Invalid base64 input')
  let buffer = 0; let bits = 0; let output = ''
  for (const character of input.replace(/=+$/, '')) {
    const index = alphabet.indexOf(character)
    if (index < 0) throw new TypeError('Invalid base64 input')
    buffer = (buffer << 6) | index; bits += 6
    if (bits >= 8) { bits -= 8; output += String.fromCharCode((buffer >> bits) & 0xff) }
  }
  return output
}

function encodeBase64(value: string): string {
  let output = ''
  for (let index = 0; index < value.length; index += 3) {
    const first = value.charCodeAt(index)
    const second = index + 1 < value.length ? value.charCodeAt(index + 1) : 0
    const third = index + 2 < value.length ? value.charCodeAt(index + 2) : 0
    if (first > 255 || second > 255 || third > 255) throw new TypeError('btoa only accepts Latin-1 input')
    const packed = (first << 16) | (second << 8) | third
    output += alphabet.charAt((packed >> 18) & 63) + alphabet.charAt((packed >> 12) & 63)
    output += index + 1 < value.length ? alphabet.charAt((packed >> 6) & 63) : '='
    output += index + 2 < value.length ? alphabet.charAt(packed & 63) : '='
  }
  return output
}

class ConvoKitTextEncoder {
  encode(value = ''): Uint8Array {
    const bytes: number[] = []
    for (const character of value) {
      const codePoint = character.codePointAt(0)!
      if (codePoint <= 0x7f) bytes.push(codePoint)
      else if (codePoint <= 0x7ff) bytes.push(0xc0 | codePoint >> 6, 0x80 | codePoint & 0x3f)
      else if (codePoint <= 0xffff) bytes.push(0xe0 | codePoint >> 12, 0x80 | codePoint >> 6 & 0x3f, 0x80 | codePoint & 0x3f)
      else bytes.push(0xf0 | codePoint >> 18, 0x80 | codePoint >> 12 & 0x3f, 0x80 | codePoint >> 6 & 0x3f, 0x80 | codePoint & 0x3f)
    }
    return new Uint8Array(bytes)
  }
}

class ConvoKitTextDecoder {
  decode(input?: AllowSharedBufferSource): string {
    if (input === undefined) return ''
    let bytes: Uint8Array
    if (input instanceof ArrayBuffer ||
        (typeof SharedArrayBuffer !== 'undefined' && input instanceof SharedArrayBuffer)) {
      bytes = new Uint8Array(input)
    } else {
      const view = input as ArrayBufferView
      bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    }
    let encoded = ''
    for (const byte of bytes) encoded += `%${byte.toString(16).padStart(2, '0')}`
    try { return decodeURIComponent(encoded) } catch { return '\uFFFD' }
  }
}

/** Installs only encoding globals that the host React Native runtime does not provide. */
export function installEncodingPolyfills(): void {
  const host = globalThis as typeof globalThis & Record<string, unknown>
  if (typeof host.atob !== 'function') Object.defineProperty(host, 'atob', { configurable: true, value: decodeBase64 })
  if (typeof host.btoa !== 'function') Object.defineProperty(host, 'btoa', { configurable: true, value: encodeBase64 })
  if (typeof host.TextEncoder !== 'function') Object.defineProperty(host, 'TextEncoder', { configurable: true, value: ConvoKitTextEncoder })
  if (typeof host.TextDecoder !== 'function') Object.defineProperty(host, 'TextDecoder', { configurable: true, value: ConvoKitTextDecoder })
}
