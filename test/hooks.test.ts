import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InboxPage, MessagePage } from '@convokitapp/sdk'

const react = vi.hoisted(() => ({ cleanups: [] as Array<() => void> }))

vi.mock('react', () => ({
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect()
    if (cleanup) react.cleanups.push(cleanup)
  },
  useRef: <T>(value: T) => ({ current: value }),
  useState: <T>(value: T | (() => T)) => [
    typeof value === 'function' ? (value as () => T)() : value,
    vi.fn(),
  ],
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}))

import { useInbox, useMessages } from '../src/hooks'
import type { ConvoKitClient } from '../src/client'

afterEach(() => {
  for (const cleanup of react.cleanups.splice(0)) cleanup()
})

describe('useInbox', () => {
  it('uses the activity-ordered inbox endpoint and both invalidation streams', async () => {
    const page: InboxPage = { entries: [], nextCursor: null }
    const changedUnsubscribe = vi.fn(async () => {})
    const activityUnsubscribe = vi.fn(async () => {})
    const client = {
      clientId: 'client-1',
      sessionState: { status: 'connected', currentUserId: 'user-1', sessionId: 1 },
      subscribeSession: vi.fn(() => () => {}),
      listInbox: vi.fn(async () => page),
      getConversations: vi.fn(() => { throw new Error('useInbox must not use creation ordering') }),
      realtime: {
        onInboxChanged: vi.fn(() => ({ closed: false, unsubscribe: changedUnsubscribe })),
        onInboxActivity: vi.fn(() => ({ closed: false, unsubscribe: activityUnsubscribe })),
      },
    }

    useInbox(client as unknown as ConvoKitClient, { pageSize: 25 })
    await vi.waitFor(() => expect(client.listInbox).toHaveBeenCalledWith({ limit: 25 }))

    expect(client.getConversations).not.toHaveBeenCalled()
    expect(client.realtime.onInboxChanged).toHaveBeenCalledTimes(1)
    expect(client.realtime.onInboxActivity).toHaveBeenCalledTimes(1)

    for (const cleanup of react.cleanups.splice(0)) cleanup()
    expect(changedUnsubscribe).toHaveBeenCalledTimes(1)
    expect(activityUnsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe('useMessages', () => {
  it('uses opaque message pages instead of constructing cursor fields', async () => {
    const page: MessagePage = { messages: [], nextCursor: null }
    const unsubscribe = vi.fn(async () => {})
    const client = {
      sessionState: { status: 'connected', currentUserId: 'user-1', sessionId: 1 },
      subscribeSession: vi.fn(() => () => {}),
      listMessages: vi.fn(async () => page),
      getMessages: vi.fn(() => { throw new Error('useMessages must use opaque message pages') }),
      realtime: {
        onMessage: vi.fn(() => ({ closed: false, unsubscribe })),
        onMessageDeleted: vi.fn(() => ({ closed: false, unsubscribe })),
      },
    }

    useMessages(client as unknown as ConvoKitClient, 'conversation-1', { pageSize: 25 })
    await vi.waitFor(() => expect(client.listMessages).toHaveBeenCalledWith({
      conversationId: 'conversation-1', limit: 25,
    }))
    expect(client.getMessages).not.toHaveBeenCalled()
  })
})
