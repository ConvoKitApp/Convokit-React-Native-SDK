# `@convokitapp/react-native`

React Native facade over `@convokitapp/sdk`. It intentionally excludes the
server client and adds URI-based upload helpers.

```ts
import { ConvoKitClient } from '@convokitapp/react-native'

const client = new ConvoKitClient({ clientId, tokenProvider })
await client.connectUser(appUserId)
```

Expo applications may import `ConvoKitClient` from
`@convokitapp/react-native/expo` to use the Expo FileSystem adapter.

URI uploads accept `{ uri, fileName, contentType?, size? }`; the original
`Blob`, `ArrayBuffer`, and typed-array APIs remain available from the shared
JavaScript SDK client. The default entry installs mobile-safe URL, random,
base64, and text-encoding fallbacks. The Expo entry uses Expo Crypto and
FileSystem without making Expo a dependency of bare React Native consumers.

Tested matrix: Node 22, React 19.2, React Native 0.86–0.87, Hermes, and the New
Architecture. Publish `@convokitapp/sdk` before this package.
