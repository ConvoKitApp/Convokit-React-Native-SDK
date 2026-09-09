import { readFile, readdir } from 'node:fs/promises'

const files = (await readdir(new URL('../src/', import.meta.url))).filter(name => name.endsWith('.ts') && name !== 'expo.ts')
for (const name of files) {
  const source = await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')
  if (/from ['"]expo(?:-|\/|['"])/.test(source)) throw new Error(`${name} imports Expo from the bare entry graph`)
  if (name === 'exports.ts' && /ConvoKitServerClient/.test(source)) throw new Error('The server client must not be exported')
}
