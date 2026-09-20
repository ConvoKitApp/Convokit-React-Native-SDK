import { ConvoKitClient as JavaScriptConvoKitClient } from '@convokitapp/sdk'
import { describe, expect, it } from 'vitest'
import { ConvoKitClient, covers, readThrough, type MarkConversationReadOptions, type ReadPosition } from '../src/exports'

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
