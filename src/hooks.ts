import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  createClientMessageId,
  type Conversation,
  type Message,
  type SendMessageInput,
  type SessionState,
} from '@convokitapp/sdk'

import type { ConvoKitClient } from './client'

function sortByCreatedAt(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

/** Reactively observes connect, disconnect, user replacement and terminal session failures. */
export function useConvoKitSession(client: ConvoKitClient): SessionState {
  const subscribe = useCallback((listener: () => void) => client.subscribeSession(listener), [client])
  const getSnapshot = useCallback(() => client.sessionState, [client])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export interface UseMessagesOptions {
  pageSize?: number
}

export interface UseMessagesResult {
  messages: Message[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: Error | null
  loadMore: () => Promise<void>
  sendMessage: (input: Omit<SendMessageInput, 'conversationId'>) => Promise<Message>
  refresh: () => Promise<void>
}

/** Keeps one conversation's message list fetched, live-updated and deduped by id/clientMessageId. */
export function useMessages(
  client: ConvoKitClient,
  conversationId: string | null | undefined,
  options: UseMessagesOptions = {},
): UseMessagesResult {
  const pageSize = options.pageSize ?? 30
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const mergeMessage = useCallback((incoming: Message) => {
    setMessages(current => {
      const index = current.findIndex(
        existing =>
          existing.id === incoming.id ||
          (!!incoming.clientMessageId && existing.clientMessageId === incoming.clientMessageId),
      )
      if (index === -1) return sortByCreatedAt([...current, incoming])
      const next = current.slice()
      next[index] = incoming
      return next
    })
  }, [])

  const removeMessage = useCallback((id: string) => {
    setMessages(current => current.filter(existing => existing.id !== id))
  }, [])

  const session = useConvoKitSession(client)
  const connectedSessionId = session.status === 'connected' ? session.sessionId : null

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      setHasMore(false)
      return
    }
    if (connectedSessionId === null) {
      setMessages([])
      setLoading(true)
      setLoadingMore(false)
      setHasMore(true)
      setError(null)
      return
    }

    let cancelled = false
    setMessages([])
    setLoading(true)
    setLoadingMore(false)
    setHasMore(true)
    setError(null)

    let messageSub: ReturnType<ConvoKitClient['realtime']['onMessage']>
    let deletedSub: ReturnType<ConvoKitClient['realtime']['onMessageDeleted']>
    try {
      messageSub = client.realtime.onMessage(conversationId, {
        onEvent: event => mergeMessage(event.message),
        onError: setError,
      })
      deletedSub = client.realtime.onMessageDeleted(conversationId, {
        onEvent: event => removeMessage(event.id),
        onError: setError,
      })
    } catch (cause) {
      setError(toError(cause))
      setLoading(false)
      return
    }

    client
      .getMessages({ conversationId, limit: pageSize })
      .then(page => {
        if (cancelled) return
        setMessages(sortByCreatedAt(page))
        setHasMore(page.length === pageSize)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(toError(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      void messageSub.unsubscribe()
      void deletedSub.unsubscribe()
    }
  }, [client, conversationId, pageSize, connectedSessionId, mergeMessage, removeMessage])

  const loadMore = useCallback(async () => {
    if (!conversationId || loadingMore || !hasMore) return
    const oldest = messages[0]
    if (!oldest) return

    setLoadingMore(true)
    try {
      const page = await client.getMessages({
        conversationId,
        limit: pageSize,
        beforeCreatedAt: oldest.createdAt,
        beforeId: oldest.id,
      })
      setMessages(current => {
        const seen = new Set<string>()
        const merged: Message[] = []
        for (const item of [...page, ...current]) {
          if (seen.has(item.id)) continue
          seen.add(item.id)
          merged.push(item)
        }
        return sortByCreatedAt(merged)
      })
      setHasMore(page.length === pageSize)
    } catch (cause) {
      setError(toError(cause))
    } finally {
      setLoadingMore(false)
    }
  }, [client, conversationId, pageSize, loadingMore, hasMore, messages])

  const sendMessage = useCallback(
    async (input: Omit<SendMessageInput, 'conversationId'>) => {
      if (!conversationId) throw new Error('useMessages: conversationId is required to send a message')
      const message = await client.sendMessage({
        clientMessageId: createClientMessageId(),
        ...input,
        conversationId,
      })
      mergeMessage(message)
      return message
    },
    [client, conversationId, mergeMessage],
  )

  const refresh = useCallback(async () => {
    if (!conversationId) return
    setError(null)
    const page = await client.getMessages({ conversationId, limit: pageSize })
    setMessages(sortByCreatedAt(page))
    setHasMore(page.length === pageSize)
  }, [client, conversationId, pageSize])

  return { messages, loading, loadingMore, hasMore, error, loadMore, sendMessage, refresh }
}

export interface UseInboxOptions {
  pageSize?: number
  archived?: boolean
}

export interface UseInboxResult {
  conversations: Conversation[]
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/** Keeps the signed-in user's conversation list fetched and refetches it on authorized inbox changes. */
export function useInbox(client: ConvoKitClient, options: UseInboxOptions = {}): UseInboxResult {
  const { pageSize, archived } = options
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const list = await client.getConversations({
      ...(pageSize === undefined ? {} : { limit: pageSize }),
      ...(archived === undefined ? {} : { archived }),
    })
    setConversations(list)
  }, [client, pageSize, archived])

  const session = useConvoKitSession(client)
  const connectedSessionId = session.status === 'connected' ? session.sessionId : null

  useEffect(() => {
    if (connectedSessionId === null) {
      setConversations([])
      setLoading(true)
      setError(null)
      return
    }

    let cancelled = false
    setConversations([])
    let sub: ReturnType<ConvoKitClient['realtime']['onInboxChanged']>
    try {
      sub = client.realtime.onInboxChanged(client.clientId, {
        onEvent: () => {
          refresh().catch((cause: unknown) => setError(toError(cause)))
        },
        onError: setError,
      })
    } catch (cause) {
      setError(toError(cause))
      setLoading(false)
      return
    }

    setLoading(true)
    refresh()
      .catch((cause: unknown) => {
        if (!cancelled) setError(toError(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      void sub.unsubscribe()
    }
  }, [client, connectedSessionId, refresh])

  return { conversations, loading, error, refresh }
}

export interface UseTypingOptions {
  /** How long a remote user's typing indicator survives without a follow-up event. Default 3000ms. */
  remoteIdleMs?: number
  /** How long after the local caller's last `setTyping(true)` before an automatic stop is sent. Default 3000ms. */
  localIdleMs?: number
}

export interface UseTypingResult {
  typingUserIds: string[]
  setTyping: (isTyping: boolean) => void
}

/** Tracks remote typing state for a conversation and throttles/auto-stops the local user's own signal. */
export function useTyping(
  client: ConvoKitClient,
  conversationId: string | null | undefined,
  options: UseTypingOptions = {},
): UseTypingResult {
  const remoteIdleMs = options.remoteIdleMs ?? 3000
  const localIdleMs = options.localIdleMs ?? 3000
  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const remoteTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const localState = useRef<{ isTyping: boolean; idleTimeout?: ReturnType<typeof setTimeout> }>({ isTyping: false })
  const session = useConvoKitSession(client)
  const connectedSessionId = session.status === 'connected' ? session.sessionId : null

  useEffect(() => {
    const timeouts = remoteTimeouts.current
    timeouts.forEach(timeout => clearTimeout(timeout))
    timeouts.clear()
    setTypingUserIds([])
    localState.current.isTyping = false
    if (localState.current.idleTimeout) clearTimeout(localState.current.idleTimeout)
    localState.current.idleTimeout = undefined

    if (!conversationId || connectedSessionId === null) return

    let sub: ReturnType<ConvoKitClient['realtime']['onTyping']>
    try {
      sub = client.realtime.onTyping(conversationId, {
        onEvent: ({ userId, isTyping }) => {
          const existing = timeouts.get(userId)
          if (existing) clearTimeout(existing)
          timeouts.delete(userId)

          if (isTyping) {
            setTypingUserIds(current => (current.includes(userId) ? current : [...current, userId]))
            timeouts.set(
              userId,
              setTimeout(() => {
                timeouts.delete(userId)
                setTypingUserIds(current => current.filter(id => id !== userId))
              }, remoteIdleMs),
            )
          } else {
            setTypingUserIds(current => current.filter(id => id !== userId))
          }
        },
      })
    } catch {
      return
    }

    return () => {
      void sub.unsubscribe()
      timeouts.forEach(timeout => clearTimeout(timeout))
      timeouts.clear()
    }
  }, [client, conversationId, connectedSessionId, remoteIdleMs])

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationId || connectedSessionId === null) return
      const state = localState.current
      if (state.idleTimeout) clearTimeout(state.idleTimeout)
      state.idleTimeout = undefined

      const sendTyping = (value: boolean) => {
        try {
          void client.sendTyping({ conversationId, isTyping: value }).catch(() => {})
        } catch {
          // best-effort: connection dropped between the check above and this call
        }
      }

      if (isTyping) {
        if (!state.isTyping) {
          state.isTyping = true
          sendTyping(true)
        }
        state.idleTimeout = setTimeout(() => {
          state.isTyping = false
          sendTyping(false)
        }, localIdleMs)
      } else if (state.isTyping) {
        state.isTyping = false
        sendTyping(false)
      }
    },
    [client, conversationId, connectedSessionId, localIdleMs],
  )

  return { typingUserIds, setTyping }
}
