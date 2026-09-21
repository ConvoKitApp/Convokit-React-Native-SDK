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
`ClearConversationUnreadOptions` are re-exported here. Against a backend
without the mark-unread deployment the `/unread` calls fail with status 404,
acknowledgements never clear a marker and `getConversation()` returns no
`membership`.

Author edits and deletes follow the shared SDK as well:
`editMessage(messageId, { text, revision })` replaces the text of one of the
caller's own messages, or clears the caption of a message with attachments
when `text` is `null`, and returns the updated `Message`; attachments are never
changed by an edit. `deleteMessage(messageId)` removes the caller's own message
for every member and resolves with no value; the deletion cannot be undone,
other devices learn through `realtime.onMessageDeleted`, and files already
received or downloaded are not retracted (stored files are reclaimed by the
existing user or app deletion cleanup, not by the message deletion). Both are
the author operations; the administrative `updateMessage` / `deleteMessage`
live on the server client, which this package does not export. Every `Message`
now carries `revision` as a required member (consumer-built literals gain it):
0 when sent and +1 on every author or administrative edit, media-only
administrative edits included. `isEditedMessage(message)` (`revision > 0`) is
the only "edited" signal; never derive it from `updatedAt`, which is set on
creation and by other writes. Send the row's `revision` with every edit: a
stale value fails with status 409 and `ConvoKitError.code ===
'REVISION_CONFLICT'` and nothing is written, so reload the row with
`getMessage()`, show the current text and retry with its revision. Another
member's message or a `READ` role fails with 403; a message the caller cannot
see (unknown, deleted, in another app or in a room they are not a member of)
with 404 and `code === 'MESSAGE_NOT_FOUND'`. The edit body always carries both
keys (`text: null` is sent as JSON `null`, never omitted); a missing `text`, a
non-string non-null `text`, or a `revision` outside the integers
0..2147483647 rejects with `INVALID_ARGUMENT` before any request. Consumers
that merge rows from REST responses, history pages and live `update` row
images keep the higher `revision` and fall back to `updatedAt ?? createdAt` on
equal revisions or when neither row has one, and keep a deletion marker so a
late edit response or row image cannot restore a deleted message. All of this
is inherited unchanged; `EditMessageInput` and `isEditedMessage` are
re-exported here. Version 0.8.0 requires `@convokitapp/sdk` 0.8.x and the
backend message-edits deployment; against a 0.7 backend the `/own` calls match
no route and fail with status 404 and `HTTP_ERROR` (an HTML body without a
JSON `code`), which must never be treated as a deleted message, and rows
parse with `revision: 0`.

Tested matrix: Node 22, React 19.2, React Native 0.86–0.87, Hermes, and the New
Architecture. Publish `@convokitapp/sdk` before this package.
