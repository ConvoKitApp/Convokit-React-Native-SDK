# Changelog

Releases before 0.9.0 are described in `README.md`, which documents each
behaviour this package re-exports rather than a per-release history.

## 1.0.0

- Bundle `@convokitapp/sdk` 1.0.0 as a runtime dependency, so consumers do not
  need to install or align a separate copy of the shared JavaScript SDK.
- Add `useConvoKitSession`, which reactively exposes connecting, connected and
  disconnected session states, including terminal authentication failures that
  require the application to return the user to sign-in.
- Add `useMessages`, `useInbox` and `useTyping`. The data hooks reset when the
  authenticated session changes and ignore results from retired sessions.
- Make `useInbox` use the activity-ordered inbox API and opaque cursor pages.
  Message history now uses the matching `listMessages` cursor contract when
  loading older messages.
- Continue to re-export the 0.9.0 quoted-reply and message-context surface from
  the shared SDK.

## 0.9.0

- Re-export the quoted-reply surface of `@convokitapp/sdk` 0.9.0 so React
  Native code never imports the shared SDK directly: the models `ReplyPreview`
  and `MessageContextPage`, and the `MessageContextOptions` argument type
  beside the existing `MessageListOptions` / `InboxListOptions`.
- `SendMessageInput` gains an optional `replyToMessageId`, inherited unchanged.
  It is omitted from the request body when unset, so a send without a quote is
  byte-identical to 0.8. The target must be a message in the same conversation
  (404 `MESSAGE_NOT_FOUND` otherwise) and the reference is write-once: a retry
  carrying the same `clientMessageId` must repeat the same target or it fails
  with 409, while a retry with the same target still succeeds with the original
  row after the quoted message was deleted. Neither edit path can change it.
- `Message` gains an OPTIONAL member `replyToMessageId?: string`. It carries one
  state for "not a reply" and covers both wire shapes: a missing key (0.8
  backends, Postgres row images) and the explicit `null` a 0.9 backend sends on
  every non-reply row both parse as absent, so `'replyToMessageId' in message`
  and a truthiness check agree. A present value is always a non-empty string.
  The member is optional, so consumer-built `Message` literals need no change —
  but every place that rebuilds a row field by field must copy it, or the quote
  silently disappears.
- `getReplyPreviews(conversationId, messageIds)` and
  `getMessageContext(conversationId, options)` are inherited from the shared
  client without being overridden here. `getReplyPreviews` resolves the quoted
  parents of a whole page of replies in one round trip: the SDK trims the IDs,
  drops duplicates keeping the first occurrence, and splits the distinct list
  into requests of 50 that it merges in that order, so callers never chunk. An
  empty list, a blank ID or an ID longer than 64 characters rejects with
  `INVALID_ARGUMENT` before any request. The chunking is all-or-nothing, so only
  absence from a RESOLVED result means the quoted message is gone, was never in
  the room, or belongs to another app — render an unavailable placeholder, keep
  the reply and its reference, and never re-request that ID.
  `getMessageContext` returns one newest-first `MessageContextPage { messages,
  olderCursor, newerCursor }` centred on `options.messageId` or continued from a
  previous window's cursor. Exactly one of the three selectors must be given and
  `limit` must be an integer in 1..100 (default 30), both checked before any
  request; both cursors are always present and nullable, and a null
  `newerCursor` means only that the window touched the live tail when the server
  read it.
- Requires `@convokitapp/sdk` 0.9.x (peer `>=0.9.0 <0.10.0`) and the backend
  quoted-replies deployment. Both calls are conversation-scoped reads authorized
  on membership before any message id is read, so a non-member, a departed
  member or a room in another app answers an uncoded 404 (`HTTP_ERROR`) and
  neither ever answers 403, while an active `READ` member may call both. Against
  a 0.8 backend both new calls match no route and fail the same way, with status
  404 and `HTTP_ERROR` (an HTML body without a JSON `code`); an uncoded 404 is
  therefore a missing deployment or a room this caller may no longer read, and
  never a deleted message or an empty window. Rows from a 0.8 backend parse
  without `replyToMessageId`.
- No React Native runtime change: the URI upload helpers, the Expo entry and the
  encoding, URL and random polyfills are untouched.
