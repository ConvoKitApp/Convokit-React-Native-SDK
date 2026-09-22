import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InboxPage } from '@convokitapp/sdk'

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

import { useInbox } from '../src/hooks'
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
