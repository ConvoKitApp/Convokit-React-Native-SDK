import { ConvoKitClient as JavaScriptConvoKitClient } from '@convokitapp/sdk'
import { describe, expect, it } from 'vitest'
import {
  ConvoKitClient, ConvoKitRealtime, covers, readThrough,
  type Conversation, type InboxEntry, type InboxListOptions, type InboxPage, type InboxSummary,
  type MarkConversationReadOptions, type Message, type ReadPosition,
} from '../src/exports'

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
      media: [], createdAt: new Date('2026-09-21T12:00:00.000Z'), updatedAt: null,
    }
    const conversation: Conversation = {
      id: 'conversation-1', title: null, imageUrl: null, appId: 'app-1', displayTitle: 'Ana',
      description: null, participants: [], createdAt: new Date('2026-09-21T11:00:00.000Z'),
      updatedAt: new Date('2026-09-21T11:00:00.000Z'),
    }
    const summary: InboxSummary = {
      latestMessage, unreadCount: 1, unreadCountCapped: false,
      readPosition: { messageId: 'message-1', createdAt: new Date('2026-09-21T11:30:00.000Z') },
      lastReadAt: new Date('2026-09-21T11:30:00.000Z'), activityAt: latestMessage.createdAt,
    }
    const entry: InboxEntry = { ...summary, conversation }
    const page: InboxPage = { entries: [entry], nextCursor: null }
    const asSummary: InboxSummary = entry

    expect(options.cursor).toBeNull()
    expect(page.entries[0]?.conversation.id).toBe('conversation-1')
    expect(asSummary.activityAt).toBe(latestMessage.createdAt)
    expect(readThrough(entry, latestMessage)).toBe(false)
  })

  it('inherits listInbox and onInboxActivity from the shared 0.6 core without overriding them', () => {
    expect(ConvoKitClient.prototype.listInbox).toBe(JavaScriptConvoKitClient.prototype.listInbox)
    expect(typeof ConvoKitClient.prototype.listInbox).toBe('function')
    expect(typeof ConvoKitRealtime.prototype.onInboxActivity).toBe('function')
  })
})
