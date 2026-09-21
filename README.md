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
here. Against a backend without the inbox deployment `listInbox()` fails with
status 404.

Private "mark unread" follows the shared SDK as well:
`markConversationUnread(conversationId)` sets a marker only the caller can see
and returns `ConversationPrivateState { conversationId, unreadMarkedAt,
privateStateVersion }`;
`clearConversationUnread(conversationId, { ifVersion? })` removes it and returns
`ClearUnreadResult` (the state plus `cleared`, which is `false` rather than an
error when nothing was marked or `ifVersion` no longer matched). Every
`InboxSummary` now carries `isUnread`, `unreadMarkedAt` and `privateStateVersion`
as required members (consumer-built literals gain the three); render the numeric
badge from `unreadCount` as before and a numberless dot (accessible name
"Unread") when `isUnread` is true while the count is 0 and not capped, never an
invented count. Capture `conversation.membership?.privateStateVersion` once when
a room opens (`getConversation` only; `undefined` on a 0.6 backend) and send it
as `privateStateVersion` with every `markConversationRead` acknowledgement of
that open, never a value from a later refresh: the marker clears only while the
version is still current, so a mark issued after the open survives that open's
acknowledgements. An empty room has nothing to acknowledge; send
`{ privateStateVersion }` alone to clear its marker, or call
`clearConversationUnread(conversationId, { ifVersion })`. Marker changes reach
other devices through `onInboxActivity`. All of this is inherited unchanged;
`ConversationMembership`, `ConversationPrivateState`, `ClearUnreadResult` and
`ClearConversationUnreadOptions` are re-exported here. Version 0.7.0 requires
`@convokitapp/sdk` 0.7.x and the backend mark-unread deployment; against a 0.6
backend the `/unread` calls fail with status 404, acknowledgements never clear
a marker and `getConversation()` returns no `membership`.

Tested matrix: Node 22, React 19.2, React Native 0.86–0.87, Hermes, and the New
Architecture. Publish `@convokitapp/sdk` before this package.
