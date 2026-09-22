# `@convokitapp/react-native`

React Native facade over `@convokitapp/sdk`. It intentionally excludes the
server client and adds URI-based upload helpers.

```ts
import { ConvoKitClient, useConvoKitSession } from '@convokitapp/react-native'

const client = new ConvoKitClient({ clientId, tokenProvider })
await client.connectUser(appUserId)
```

Connection state is reactive through `useConvoKitSession`:

```ts
import { useEffect } from 'react'

const session = useConvoKitSession(client)

useEffect(() => {
  if (session.status === 'disconnected' && session.requiresReauthentication) {
    void logOut()
  }
}, [session])
```

The hook covers connecting, connected, manual disconnect, user replacement and
terminal token renewal. Every connection attempt has a distinct `sessionId`, so
reconnecting the same user also restarts the data hooks. `useMessages`,
`useInbox` and `useTyping` clear retired-session state immediately and no longer
poll `client.connected`. Realtime channel interruptions remain a separate API.

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
re-exported here. Against a backend without the message-edits deployment the
`/own` calls match no route and fail with status 404 and `HTTP_ERROR` (an HTML
body without a JSON `code`), which must never be treated as a deleted message,
and rows parse with `revision: 0`.

Quoted replies and jump-to-message follow the shared SDK as well:
`sendMessage({ conversationId, text, replyToMessageId })` quotes a message that
is already in the same room. The key is omitted from the request when unset, so
a send without a quote is byte-identical to 0.8; a target that is not in this
conversation fails with 404 and `code === 'MESSAGE_NOT_FOUND'`. The reference is
write-once — neither edit path can change it, and a retry carrying the same
`clientMessageId` must repeat the same target or it fails with 409, while a
retry with the same target succeeds with the original row even after the quoted
message was deleted. Every `Message` may now carry `replyToMessageId?: string`
as an optional member (consumer-built literals need no change): it holds one
state for "not a reply" covering both wire shapes, since a missing key (0.8
backends, Postgres row images) and the explicit `null` a 0.9 backend sends on
every non-reply row both parse as absent, so `'replyToMessageId' in message` and
a truthiness check agree and a present value is always a non-empty string.
Anything that rebuilds a row field by field must copy it, or the quote
disappears silently. `getReplyPreviews(conversationId, messageIds)` resolves the
quoted parents of a whole page of replies in one round trip and returns
`ReplyPreview[]` (`{ id, conversationId, appUserId, text, textTruncated,
createdAt, revision, mediaCount }`, where `text` is the first 500 characters);
the SDK trims the IDs, drops duplicates keeping the first occurrence, and splits
the distinct list into requests of 50 that it merges in that order, so never
chunk by hand. An empty list, a blank ID or an ID longer than 64 characters
rejects with `INVALID_ARGUMENT` before any request. The chunking is invisible
and all-or-nothing: a rejection returns nothing and says nothing about which IDs
exist, so only absence from a *resolved* result means the quoted message is
gone, was never in this room, or belongs to another app — render an unavailable
placeholder, keep the reply and its reference, and never re-request that ID.
`getMessageContext(conversationId, options)` returns a `MessageContextPage
{ messages, olderCursor, newerCursor }`: one newest-first window centred on
`options.messageId`, or continued from a previous window's `olderCursor` or
`newerCursor`. Exactly one of the three selectors must be present and `limit`
must be an integer in 1..100 (default 30), both checked before any request, so a
caller never believes it holds a complete window; both cursors come back on
every page and are `null` at that end of the history, and a `null` `newerCursor`
means only that the window touched the live tail when the server read it. An
unknown, deleted or out-of-room `messageId` fails with 404 and
`MESSAGE_NOT_FOUND`; a malformed cursor with 400 and `INVALID_CURSOR`. Both
calls are conversation-scoped reads authorized on membership before any message
id is read, so a non-member, a departed member or a room in another app answers
404 `Conversation not found` — an uncoded 404, `code === 'HTTP_ERROR'` — while
an active `READ` member may call both and neither ever answers 403. All of this
is inherited unchanged; `ReplyPreview`, `MessageContextPage` and
`MessageContextOptions` are re-exported here. Version 0.9.0 requires
`@convokitapp/sdk` 0.9.x and the backend quoted-replies deployment; against a
0.8 backend both new calls match no route and fail the same way, with status
404 and `HTTP_ERROR` (an HTML body without a JSON `code`). An uncoded 404 is
therefore a missing deployment *or* a room this caller may no longer read, and
in neither case a deleted message or an empty result; rows from a 0.8 backend
parse with no `replyToMessageId`.

Tested matrix: Node 22, React 19.2, React Native 0.86–0.87, Hermes, and the New
Architecture. Publish `@convokitapp/sdk` before this package.
