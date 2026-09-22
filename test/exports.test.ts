import {
  ConvoKitClient as JavaScriptConvoKitClient, isEditedMessage as javaScriptIsEditedMessage,
} from '@convokitapp/sdk'
import { describe, expect, it } from 'vitest'
import {
  ConvoKitClient, ConvoKitRealtime, covers, isEditedMessage, readThrough,
  type ClearConversationUnreadOptions, type ClearUnreadResult, type Conversation,
  type ConversationMembership, type ConversationPrivateState, type EditMessageInput, type InboxEntry,
  type InboxListOptions, type InboxPage, type InboxSummary, type MarkConversationReadOptions, type Message,
  type MessageContextOptions, type MessageContextPage, type ReadPosition, type ReplyPreview,
  type SendMessageInput,
  type SessionState,
  type UseInboxResult,
  useConvoKitSession,
} from '../src/exports'

describe('session state exports', () => {
  it('forwards the shared state types and exposes the React binding', () => {
    const state: SessionState = {
      status: 'disconnected', currentUserId: null, previousUserId: 'user-1', sessionId: 1,
      reason: 'authentication-rejected', requiresReauthentication: true,
      errorCode: 'SESSION_REFRESH_REJECTED',
    }

    expect(state.requiresReauthentication).toBe(true)
    expect(typeof useConvoKitSession).toBe('function')
  })
})

describe('read position re-exports', () => {
  it('forwards the shared helpers and types from @convokitapp/sdk', () => {
    const position: ReadPosition = { messageId: 'message-2', createdAt: new Date('2026-09-03T12:00:00.000Z') }
    const message = { id: 'message-1', createdAt: new Date('2026-09-03T12:00:00.000Z') }
    const options: MarkConversationReadOptions = { throughMessageId: position.messageId }

    expect(covers(position, message)).toBe(true)
    expect(readThrough({ readPosition: position, lastReadAt: null }, message)).toBe(true)
    expect(readThrough({ lastReadAt: new Date('2026-09-03T11:00:00.000Z') }, message)).toBe(false)
    expect(options.throughMessageId).toBe('message-2')
  })

  it('inherits the targeted markConversationRead from the shared client without overriding it', () => {
    expect(ConvoKitClient.prototype.markConversationRead).toBe(JavaScriptConvoKitClient.prototype.markConversationRead)
  })
})

describe('inbox re-exports', () => {
  it('forwards the inbox types from @convokitapp/sdk', () => {
    const options: InboxListOptions = { limit: 30, cursor: null, archived: false }
    const latestMessage: Message = {
      id: 'message-2', conversationId: 'conversation-1', senderId: 'user-2', text: 'hello',
      media: [], createdAt: new Date('2026-09-21T12:00:00.000Z'), updatedAt: null, revision: 0,
    }
    const conversation: Conversation = {
      id: 'conversation-1', title: null, imageUrl: null, appId: 'app-1', displayTitle: 'Ana',
      description: null, participants: [], createdAt: new Date('2026-09-21T11:00:00.000Z'),
      updatedAt: new Date('2026-09-21T11:00:00.000Z'),
    }
    const summary: InboxSummary = {
      latestMessage, unreadCount: 1, unreadCountCapped: false,
      readPosition: { messageId: 'message-1', createdAt: new Date('2026-09-21T11:30:00.000Z') },
      lastReadAt: new Date('2026-09-21T11:30:00.000Z'), isUnread: true, unreadMarkedAt: null,
      privateStateVersion: 0, activityAt: latestMessage.createdAt,
    }
    const entry: InboxEntry = { ...summary, conversation }
    const page: InboxPage = { entries: [entry], nextCursor: null }
    const hookResult: UseInboxResult = {
      entries: [entry], loading: false, loadingMore: false, hasMore: false, error: null,
      refresh: async () => {}, loadMore: async () => {},
    }
    const asSummary: InboxSummary = entry

    expect(options.cursor).toBeNull()
    expect(page.entries[0]?.conversation.id).toBe('conversation-1')
    expect(hookResult.entries[0]?.activityAt).toBe(latestMessage.createdAt)
    expect(asSummary.activityAt).toBe(latestMessage.createdAt)
    expect(readThrough(entry, latestMessage)).toBe(false)
  })

  it('inherits listInbox and onInboxActivity from the shared 0.6 core without overriding them', () => {
    expect(ConvoKitClient.prototype.listInbox).toBe(JavaScriptConvoKitClient.prototype.listInbox)
    expect(typeof ConvoKitClient.prototype.listInbox).toBe('function')
    expect(typeof ConvoKitRealtime.prototype.onInboxActivity).toBe('function')
  })
})

describe('mark unread re-exports', () => {
  it('forwards the private unread state types from @convokitapp/sdk', () => {
    const membership: ConversationMembership = {
      role: 'READ_WRITE', lastReadAt: null, readPosition: null,
      unreadMarkedAt: new Date('2026-09-21T12:00:00.000Z'), privateStateVersion: 7,
    }
    const legacy: Conversation = {
      id: 'conversation-1', title: null, imageUrl: null, appId: 'app-1', displayTitle: 'Ana',
      description: null, participants: [], createdAt: new Date('2026-09-21T11:00:00.000Z'),
      updatedAt: new Date('2026-09-21T11:00:00.000Z'),
    }
    const conversation: Conversation = { ...legacy, membership }
    const marked: InboxSummary = {
      latestMessage: null, unreadCount: 0, unreadCountCapped: false, readPosition: null, lastReadAt: null,
      isUnread: true, unreadMarkedAt: membership.unreadMarkedAt, privateStateVersion: membership.privateStateVersion,
      activityAt: conversation.createdAt,
    }
    const state: ConversationPrivateState = {
      conversationId: conversation.id, unreadMarkedAt: membership.unreadMarkedAt, privateStateVersion: 7,
    }
    const result: ClearUnreadResult = { ...state, cleared: false }
    const clearOptions: ClearConversationUnreadOptions = { ifVersion: membership.privateStateVersion }
    const readOptions: MarkConversationReadOptions = {
      throughMessageId: 'message-2', privateStateVersion: membership.privateStateVersion,
    }
    const asState: ConversationPrivateState = result

    expect(conversation.membership?.privateStateVersion).toBe(7)
    expect(legacy.membership).toBeUndefined()
    expect(marked.isUnread).toBe(true)
    expect(marked.unreadCount).toBe(0)
    expect(result.cleared).toBe(false)
    expect(asState.privateStateVersion).toBe(state.privateStateVersion)
    expect(clearOptions.ifVersion).toBe(7)
    expect(readOptions.privateStateVersion).toBe(7)
  })

  it('inherits markConversationUnread and clearConversationUnread from the shared 0.7 core without overriding them', () => {
    expect(ConvoKitClient.prototype.markConversationUnread).toBe(JavaScriptConvoKitClient.prototype.markConversationUnread)
    expect(ConvoKitClient.prototype.clearConversationUnread).toBe(JavaScriptConvoKitClient.prototype.clearConversationUnread)
    expect(typeof ConvoKitClient.prototype.markConversationUnread).toBe('function')
    expect(typeof ConvoKitClient.prototype.clearConversationUnread).toBe('function')
  })
})

describe('message edit re-exports', () => {
  it('forwards EditMessageInput, isEditedMessage and the required Message.revision from @convokitapp/sdk', () => {
    const sent: Message = {
      id: 'message-1', conversationId: 'conversation-1', senderId: 'user-1', text: 'hello',
      media: [], createdAt: new Date('2026-09-21T12:00:00.000Z'), updatedAt: new Date('2026-09-21T12:01:00.000Z'),
      revision: 0,
    }
    const edited: Message = { ...sent, text: 'hello again', revision: sent.revision + 1 }
    const captionCleared: Message = {
      ...edited, text: null, media: [{ type: 'image', url: 'https://cdn.example/photo.jpg' }], revision: 2,
    }
    const edit: EditMessageInput = { text: 'hello again', revision: sent.revision }
    const clearCaption: EditMessageInput = { text: null, revision: edited.revision }
    // @ts-expect-error Consumer-built Message literals must carry `revision` since 0.8.0.
    const legacy: Message = {
      id: 'message-0', conversationId: 'conversation-1', senderId: 'user-1', text: 'legacy',
      media: [], createdAt: new Date('2026-09-21T11:00:00.000Z'), updatedAt: null,
    }

    // updatedAt is later than createdAt on the sent row; only the revision decides.
    expect(isEditedMessage(sent)).toBe(false)
    expect(isEditedMessage(edited)).toBe(true)
    expect(isEditedMessage(captionCleared)).toBe(true)
    expect(isEditedMessage({ ...legacy, revision: 0 })).toBe(false)
    expect(edit.revision).toBe(0)
    expect(clearCaption.text).toBeNull()
    expect(clearCaption.revision).toBe(1)
    expect(isEditedMessage).toBe(javaScriptIsEditedMessage)
  })

  it('inherits editMessage and deleteMessage from the shared 0.8 core without overriding them', () => {
    expect(ConvoKitClient.prototype.editMessage).toBe(JavaScriptConvoKitClient.prototype.editMessage)
    expect(ConvoKitClient.prototype.deleteMessage).toBe(JavaScriptConvoKitClient.prototype.deleteMessage)
    expect(typeof ConvoKitClient.prototype.editMessage).toBe('function')
    expect(typeof ConvoKitClient.prototype.deleteMessage).toBe('function')
  })
})

describe('quoted reply re-exports', () => {
  it('forwards ReplyPreview, MessageContextPage and the optional Message.replyToMessageId from @convokitapp/sdk', () => {
    const quoted: Message = {
      id: 'message-1', conversationId: 'conversation-1', senderId: 'user-1', text: 'the original',
      media: [], createdAt: new Date('2026-09-22T12:00:00.000Z'), updatedAt: null, revision: 1,
    }
    const reply: Message = {
      id: 'message-2', conversationId: 'conversation-1', senderId: 'user-2', text: 'quoting you',
      media: [], createdAt: new Date('2026-09-22T12:01:00.000Z'), updatedAt: null, revision: 0,
      replyToMessageId: quoted.id,
    }
    // The member is optional, so 0.8 literals keep compiling and "not a reply" has one state:
    // an absent key (0.8 backend) and the explicit null a 0.9 backend sends both land here.
    const notAReply: Message = {
      id: 'message-3', conversationId: 'conversation-1', senderId: 'user-2', text: 'unrelated',
      media: [], createdAt: new Date('2026-09-22T12:02:00.000Z'), updatedAt: null, revision: 0,
    }
    // @ts-expect-error `replyToMessageId` is `string | undefined`, never null, on the parsed row.
    const nulled: Message = { ...notAReply, replyToMessageId: null }
    const preview: ReplyPreview = {
      id: quoted.id, conversationId: quoted.conversationId, senderId: quoted.senderId,
      text: quoted.text, textTruncated: false, createdAt: quoted.createdAt, revision: quoted.revision,
      mediaCount: 0,
    }
    const page: MessageContextPage = {
      messages: [reply, quoted], olderCursor: 'older-cursor-1', newerCursor: null,
    }
    const centred: MessageContextOptions = { messageId: quoted.id, limit: 30 }
    const older: MessageContextOptions = { olderCursor: page.olderCursor ?? undefined }
    const send: SendMessageInput = {
      conversationId: quoted.conversationId, text: 'quoting you', replyToMessageId: quoted.id,
    }

    expect(reply.replyToMessageId).toBe('message-1')
    expect(notAReply.replyToMessageId).toBeUndefined()
    expect('replyToMessageId' in notAReply).toBe(false)
    expect(nulled.replyToMessageId).toBeNull()
    expect(preview.text).toBe('the original')
    expect(preview.textTruncated).toBe(false)
    expect(preview.mediaCount).toBe(0)
    expect(preview.revision).toBe(1)
    // A resolved window is newest-first and both cursors are always present; a null
    // `newerCursor` means it touched the live tail when the server read it.
    expect(page.messages[0]?.replyToMessageId).toBe(quoted.id)
    expect(page.newerCursor).toBeNull()
    expect(centred.limit).toBe(30)
    expect(older.olderCursor).toBe('older-cursor-1')
    expect(send.replyToMessageId).toBe(quoted.id)
  })

  it('inherits getReplyPreviews and getMessageContext from the shared 0.9 core without overriding them', () => {
    expect(ConvoKitClient.prototype.getReplyPreviews).toBe(JavaScriptConvoKitClient.prototype.getReplyPreviews)
    expect(ConvoKitClient.prototype.getMessageContext).toBe(JavaScriptConvoKitClient.prototype.getMessageContext)
    expect(typeof ConvoKitClient.prototype.getReplyPreviews).toBe('function')
    expect(typeof ConvoKitClient.prototype.getMessageContext).toBe('function')
  })
})
