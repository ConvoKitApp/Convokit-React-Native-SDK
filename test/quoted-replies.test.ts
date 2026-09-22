import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvoKitClient, type MessageContextPage, type ReplyPreview } from '../src/exports'

// The React Native client inherits the 0.9 reads from the shared SDK; these cover the
// facade end to end, so a re-export that compiles but does not dispatch cannot ship.
// The realtime stub only keeps the cases isolated: nothing here subscribes to a channel,
// so the suite passes whether or not the mock reaches the shared client's import.
const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(), setAuth: vi.fn(), disconnect: vi.fn(),
  removeChannel: vi.fn(), channel: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: supabaseMocks.createClient }))

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}

function connectedClient(responder: (url: URL, init: RequestInit) => Response): {
  client: ConvoKitClient
  requests: URL[]
  bodies: string[]
} {
  const requests: URL[] = []
  const bodies: string[] = []
  const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(String(input))
    if (url.pathname === '/api/v1/realtime/token') {
      return jsonResponse({
        data: {
          token: jwt({ sub: 'user-1' }),
          supabaseUrl: 'https://project.supabase.co',
          supabaseKey: 'sb_publishable_test',
        },
      })
    }
    requests.push(url)
    if (init?.body !== undefined) bodies.push(String(init.body))
    return responder(url, init ?? {})
  }) as unknown as typeof fetch
  const client = new ConvoKitClient({
    backendUrl: 'https://api.example.com/',
    clientId: 'client-id',
    tokenProvider: async () => 'user-token',
    fetch: fetchMock,
  })
  return { client, requests, bodies }
}

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMocks.createClient.mockReturnValue({
    realtime: { setAuth: supabaseMocks.setAuth, disconnect: supabaseMocks.disconnect },
    removeChannel: supabaseMocks.removeChannel,
    channel: supabaseMocks.channel,
  })
})

describe('quoted replies through the React Native client', () => {
  it('sends replyToMessageId only when the caller sets it', async () => {
    const { client, bodies } = connectedClient(() => jsonResponse({
      data: {
        id: 'message-9', conversationId: 'conversation-1', appUserId: 'user-1', text: 'hello',
        media: [], createdAt: '2026-09-22T12:02:00.000Z', updatedAt: null, revision: 0,
      },
    }))
    await client.connectUser('user-1')
    try {
      await client.sendMessage({ conversationId: 'conversation-1', text: 'hello' })
      await client.sendMessage({
        conversationId: 'conversation-1', text: 'hello', replyToMessageId: 'message-1',
      })

      // A send without a quote stays byte-identical to 0.8: the key is omitted, not null.
      expect(JSON.parse(bodies[0] ?? '{}')).not.toHaveProperty('replyToMessageId')
      expect(JSON.parse(bodies[1] ?? '{}').replyToMessageId).toBe('message-1')
    } finally { await client.disconnectUser() }
  })

  it('parses all three wire shapes of Message.replyToMessageId into one absent state', async () => {
    const row = (id: string, reply: Record<string, unknown>) => ({
      id, conversationId: 'conversation-1', appUserId: 'user-2', text: id,
      media: [], createdAt: `2026-09-22T12:0${id.at(-1)}:00.000Z`, updatedAt: null, revision: 0,
      ...reply,
    })
    const { client, requests } = connectedClient(() => jsonResponse({
      // Newest-first: a string (0.9 reply), an explicit null (0.9 non-reply), a missing key (0.8).
      data: [row('message-3', { replyToMessageId: 'message-1' }), row('message-2', { replyToMessageId: null }), row('message-1', {})],
      olderCursor: 'older-cursor-1', newerCursor: null,
    }))
    await client.connectUser('user-1')
    try {
      const page: MessageContextPage = await client.getMessageContext('conversation-1', {
        messageId: 'message-1',
      })

      expect(requests[0]?.pathname).toBe('/api/v1/conversations/conversation-1/context')
      expect(requests[0]?.searchParams.get('messageId')).toBe('message-1')
      expect(requests[0]?.searchParams.get('limit')).toBe('30')
      expect(page.messages[0]?.replyToMessageId).toBe('message-1')
      expect('replyToMessageId' in (page.messages[1] ?? {})).toBe(false)
      expect('replyToMessageId' in (page.messages[2] ?? {})).toBe(false)
      expect(page.olderCursor).toBe('older-cursor-1')
      // Null means the window touched the live tail when the server read it, not "omitted".
      expect(page.newerCursor).toBeNull()
    } finally { await client.disconnectUser() }
  })

  it('refuses a context window without exactly one selector or with a limit out of range', async () => {
    const { client, requests } = connectedClient(() => jsonResponse({ data: [], olderCursor: null, newerCursor: null }))
    await client.connectUser('user-1')
    try {
      await expect(client.getMessageContext('conversation-1', {}))
        .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      await expect(client.getMessageContext('conversation-1', { messageId: 'message-1', olderCursor: 'c' }))
        .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      await expect(client.getMessageContext('conversation-1', { messageId: 'message-1', limit: 101 }))
        .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      expect(requests).toHaveLength(0)
    } finally { await client.disconnectUser() }
  })

  it('de-duplicates and chunks a page of reply targets at 50 per request', async () => {
    const requested = Array.from({ length: 120 }, (_, index) => `message-${index % 100}`)
    const { client, requests } = connectedClient((url) => jsonResponse({
      data: (url.searchParams.get('ids') ?? '').split(',').map(id => ({
        id, conversationId: 'conversation-1', appUserId: 'user-2', text: 'the original',
        textTruncated: false, createdAt: '2026-09-22T12:00:00.000Z', revision: 1, mediaCount: 0,
      })),
    }))
    await client.connectUser('user-1')
    try {
      const previews: ReplyPreview[] = await client.getReplyPreviews('conversation-1', requested)

      // 120 ids, 100 distinct: exactly two requests of 50, merged in first-seen order.
      expect(requests).toHaveLength(2)
      expect(requests[0]?.pathname).toBe('/api/v1/conversations/conversation-1/reply-previews')
      expect((requests[0]?.searchParams.get('ids') ?? '').split(',')).toHaveLength(50)
      expect((requests[1]?.searchParams.get('ids') ?? '').split(',')).toHaveLength(50)
      expect(previews.map(preview => preview.id))
        .toEqual(Array.from({ length: 100 }, (_, index) => `message-${index}`))
      expect(previews[0]?.textTruncated).toBe(false)
      expect(previews[0]?.mediaCount).toBe(0)
    } finally { await client.disconnectUser() }
  })

  it('rejects an empty list, a blank id or an over-long id without issuing a request', async () => {
    const { client, requests } = connectedClient(() => jsonResponse({ data: [] }))
    await client.connectUser('user-1')
    try {
      await expect(client.getReplyPreviews('conversation-1', []))
        .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      await expect(client.getReplyPreviews('conversation-1', ['']))
        .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      await expect(client.getReplyPreviews('conversation-1', ['m'.repeat(65)]))
        .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      expect(requests).toHaveLength(0)
    } finally { await client.disconnectUser() }
  })
})
