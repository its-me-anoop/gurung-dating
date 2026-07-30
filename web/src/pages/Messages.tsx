import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/ProfileCard';
import { Alert, Button, EmptyState, LinkButton, PageLoader, cx } from '../components/ui';
import { api } from '../lib/api';
import { formatTime, relativeTime } from '../lib/format';
import type { ChatMessage, ConversationSummary } from '../lib/types';

export function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: () =>
      api<{ conversations: ConversationSummary[] }>('/conversations').then((r) => r.conversations),
    refetchInterval: 30_000,
  });

  const messagesQuery = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () =>
      api<{ messages: ChatMessage[]; hasMore: boolean }>(
        `/conversations/${conversationId}/messages`,
      ),
    enabled: Boolean(conversationId),
    // Short poll keeps a conversation feeling live without a websocket layer.
    refetchInterval: 10_000,
  });

  const send = useMutation({
    mutationFn: (body: string) =>
      api<{ message: ChatMessage }>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { body },
      }),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  // Reading a conversation clears its unread badge in the header.
  useEffect(() => {
    if (messagesQuery.data) {
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
    // Only when the fetched payload changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesQuery.data]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messagesQuery.data?.messages.length]);

  const conversations = conversationsQuery.data ?? [];
  const active = conversations.find((c) => c.id === conversationId);

  if (conversationsQuery.isLoading) return <PageLoader />;

  if (conversations.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon="💬"
          title="No conversations yet"
          description="Conversations open once you and another member have both accepted an interest. It is the one rule that keeps this inbox worth opening."
          action={<LinkButton to="/browse">Find someone to talk to</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl font-bold">Messages</h1>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <aside
          className={cx('card overflow-hidden', conversationId ? 'hidden lg:block' : 'block')}
          aria-label="Conversations"
        >
          <ul className="divide-y divide-paper-200">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/messages/${conversation.id}`)}
                  className={cx(
                    'flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-paper-100',
                    conversation.id === conversationId && 'bg-crimson-50',
                  )}
                >
                  <Avatar
                    name={conversation.participant.displayName}
                    photoUrl={conversation.participant.primaryPhoto?.url}
                    thumbnail={conversation.participant.primaryPhoto?.thumbnail}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium">
                        {conversation.participant.displayName}
                      </p>
                      {conversation.lastMessageAt && (
                        <span className="shrink-0 text-xs text-ink-400">
                          {relativeTime(conversation.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-ink-500">
                      {conversation.lastMessagePreview ?? 'Say hello'}
                    </p>
                  </div>
                  {conversation.unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson-700 px-1.5 text-xs font-semibold text-white">
                      {conversation.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Thread */}
        <section className={cx('card flex flex-col', conversationId ? 'flex' : 'hidden lg:flex')}>
          {!conversationId ? (
            <div className="flex flex-1 items-center justify-center p-16 text-center text-ink-400">
              Choose a conversation to read it.
            </div>
          ) : !active ? (
            <div className="flex flex-1 items-center justify-center p-16 text-center text-ink-400">
              That conversation is not available.
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-paper-200 p-4">
                <button
                  type="button"
                  onClick={() => navigate('/messages')}
                  className="rounded-lg p-1 text-ink-500 hover:bg-paper-200 lg:hidden"
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <Link to={`/members/${active.participant.userId}`} className="flex items-center gap-3">
                  <Avatar
                    name={active.participant.displayName}
                    photoUrl={active.participant.primaryPhoto?.url}
                    thumbnail={active.participant.primaryPhoto?.thumbnail}
                  />
                  <div>
                    <p className="font-medium hover:text-crimson-700">
                      {active.participant.displayName}, {active.participant.age}
                    </p>
                    <p className="text-xs text-ink-500">
                      {active.participant.city ?? active.participant.ukRegionLabel}
                    </p>
                  </div>
                </Link>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '55vh' }}>
                {messagesQuery.isLoading ? (
                  <PageLoader />
                ) : (messagesQuery.data?.messages.length ?? 0) === 0 ? (
                  <div className="py-12 text-center text-sm text-ink-400">
                    <p>You are connected. Say hello.</p>
                    <p className="mt-2">
                      Asking about where their family is from is never a bad opener.
                    </p>
                  </div>
                ) : (
                  messagesQuery.data?.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cx('flex', message.mine ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cx(
                          'max-w-[75%] rounded-2xl px-4 py-2.5',
                          message.mine
                            ? 'rounded-br-sm bg-crimson-700 text-white'
                            : 'rounded-bl-sm bg-paper-200 text-ink-800',
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">
                          {message.deleted ? (
                            <em className="opacity-70">This message was deleted</em>
                          ) : (
                            message.body
                          )}
                        </p>
                        <p
                          className={cx(
                            'mt-1 text-[11px]',
                            message.mine ? 'text-crimson-200' : 'text-ink-400',
                          )}
                        >
                          {formatTime(message.createdAt)}
                          {message.mine && message.readAt && ' · Read'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              <footer className="border-t border-paper-200 p-4">
                {active.closed ? (
                  <Alert tone="info">
                    This conversation has been closed. Neither of you can send new messages.
                  </Alert>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft.trim()) send.mutate(draft.trim());
                    }}
                    className="flex gap-2"
                  >
                    <label htmlFor="message-body" className="sr-only">
                      Your message
                    </label>
                    <textarea
                      id="message-body"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        // Enter sends, shift+enter makes a new line.
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (draft.trim()) send.mutate(draft.trim());
                        }
                      }}
                      rows={2}
                      maxLength={4000}
                      placeholder="Write a message…"
                      className="input flex-1 resize-none"
                    />
                    <Button type="submit" disabled={!draft.trim()} loading={send.isPending}>
                      Send
                    </Button>
                  </form>
                )}
                {send.isError && (
                  <p className="mt-2 text-sm text-red-600">
                    {send.error instanceof Error ? send.error.message : 'That did not send.'}
                  </p>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
