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

Read receipts follow the shared SDK: `markConversationRead(conversationId,
{ throughMessageId })` acknowledges through the newest rendered message, and
`Participant.readPosition` / `ReadEvent.readPosition` carry the precise
position (`null` on legacy rows). `ReadPosition`, `covers` and `readThrough`
are re-exported here so React Native code does not import `@convokitapp/sdk`
directly. Mixed fleet: precise receipts need the sender and the reader on 0.5+
with the backend read-position migration; 0.4 receivers keep timestamp
semantics but keep parsing the additive payload.

Inbox previews follow the shared SDK too: `listInbox({ limit, cursor, archived })`
returns an `InboxPage` of rooms in activity order with `latestMessage`,
`unreadCount` / `unreadCountCapped`, `readPosition` and `activityAt` per entry,
and `client.realtime.onInboxActivity(clientId, handler)` signals message and
read-position activity beside `onInboxChanged`. Both are inherited unchanged;
`InboxListOptions`, `InboxSummary`, `InboxEntry` and `InboxPage` are re-exported
here. Version 0.6.0 requires `@convokitapp/sdk` 0.6.x and the backend inbox
deployment; against an older backend `listInbox()` fails with status 404.

Tested matrix: Node 22, React 19.2, React Native 0.86–0.87, Hermes, and the New
Architecture. Publish `@convokitapp/sdk` before this package.
