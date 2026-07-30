import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/ProfileCard';
import { Alert, Badge, Button, EmptyState, LinkButton, PageLoader, cx } from '../components/ui';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import type { ConnectionItem, InterestItem } from '../lib/types';

type Box = 'received' | 'sent' | 'connections';

const TABS: Array<{ id: Box; label: string }> = [
  { id: 'received', label: 'Received' },
  { id: 'sent', label: 'Sent' },
  { id: 'connections', label: 'Connections' },
];

export function Interests() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [box, setBox] = useState<Box>('received');
  const [showAll, setShowAll] = useState(false);

  const status = box === 'connections' ? undefined : showAll ? 'ALL' : 'PENDING';

  const listQuery = useQuery({
    queryKey: ['interests', box, status],
    queryFn: () =>
      api<{ items: (InterestItem | ConnectionItem)[] }>(
        `/interests?box=${box}${status ? `&status=${status}` : ''}`,
      ).then((r) => r.items),
  });

  const summaryQuery = useQuery({
    queryKey: ['interest-summary'],
    queryFn: () =>
      api<{ pendingReceived: number; pendingSent: number; connections: number }>(
        '/interests/summary',
      ),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['interests'] });
    void queryClient.invalidateQueries({ queryKey: ['interest-summary'] });
  };

  const respond = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' | 'withdraw' }) =>
      api(`/interests/${id}/${action}`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  const openConversation = useMutation({
    mutationFn: (userId: string) =>
      api<{ conversation: { id: string } }>('/conversations', { method: 'POST', body: { userId } }),
    onSuccess: (data) => navigate(`/messages/${data.conversation.id}`),
  });

  const items = listQuery.data ?? [];
  const summary = summaryQuery.data;

  const countFor = (id: Box) =>
    id === 'received'
      ? summary?.pendingReceived
      : id === 'sent'
        ? summary?.pendingSent
        : summary?.connections;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Interests</h1>
      <p className="mt-2 text-ink-500">
        Nobody can message you until you have accepted their interest.
      </p>

      <nav className="mt-6 flex gap-1 border-b border-paper-300" aria-label="Interest boxes">
        {TABS.map((tab) => {
          const count = countFor(tab.id) ?? 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setBox(tab.id);
                setShowAll(false);
              }}
              className={cx(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                box === tab.id
                  ? 'border-crimson-700 text-crimson-800'
                  : 'border-transparent text-ink-500 hover:text-ink-800',
              )}
              aria-current={box === tab.id ? 'page' : undefined}
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-paper-200 px-1.5 text-xs text-ink-600">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {box !== 'connections' && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="text-sm text-crimson-700 hover:underline"
          >
            {showAll ? 'Show only ones awaiting a reply' : 'Show everything, including past ones'}
          </button>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {listQuery.isLoading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <EmptyState
            icon={box === 'connections' ? '🤝' : '✉️'}
            title={
              box === 'received'
                ? 'No interests waiting'
                : box === 'sent'
                  ? 'You have not sent any interests yet'
                  : 'No connections yet'
            }
            description={
              box === 'connections'
                ? 'When you and someone else both say yes, they will appear here and you can start talking.'
                : 'Browsing is the best way to get started — a short note with your interest makes a real difference.'
            }
            action={<LinkButton to="/browse">Browse members</LinkButton>}
          />
        ) : (
          items.map((item) => {
            const isConnection = box === 'connections';
            const interest = item as InterestItem;
            const profile = item.profile;

            return (
              <article key={item.id} className="card flex flex-wrap items-center gap-4 p-4">
                <Link to={`/members/${profile.userId}`}>
                  <Avatar
                    name={profile.displayName}
                    photoUrl={profile.primaryPhoto?.url}
                    thumbnail={profile.primaryPhoto?.thumbnail}
                    size="lg"
                  />
                </Link>

                <div className="min-w-48 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/members/${profile.userId}`}
                      className="font-display text-lg font-semibold hover:text-crimson-700"
                    >
                      {profile.displayName}, {profile.age}
                    </Link>
                    {profile.verified && <Badge tone="green">Verified</Badge>}
                    {!isConnection && interest.status !== 'PENDING' && (
                      <Badge
                        tone={
                          interest.status === 'ACCEPTED'
                            ? 'green'
                            : interest.status === 'DECLINED'
                              ? 'crimson'
                              : 'neutral'
                        }
                      >
                        {interest.status === 'ACCEPTED'
                          ? 'Accepted'
                          : interest.status === 'DECLINED'
                            ? 'Declined'
                            : 'Withdrawn'}
                      </Badge>
                    )}
                  </div>

                  <p className="mt-0.5 text-sm text-ink-500">
                    {[profile.city ?? profile.ukRegionLabel, profile.occupation]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>

                  {!isConnection && interest.message && (
                    <p className="mt-2 rounded-lg bg-paper-100 px-3 py-2 text-sm text-ink-700 italic">
                      “{interest.message}”
                    </p>
                  )}

                  <p className="mt-2 text-xs text-ink-400">
                    {isConnection
                      ? `Connected ${relativeTime((item as ConnectionItem).connectedAt)}`
                      : relativeTime(interest.createdAt)}
                  </p>
                </div>

                <div className="flex gap-2">
                  {isConnection ? (
                    <Button
                      size="sm"
                      onClick={() => openConversation.mutate(profile.userId)}
                      loading={openConversation.isPending}
                    >
                      Message
                    </Button>
                  ) : box === 'received' && interest.status === 'PENDING' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => respond.mutate({ id: item.id, action: 'accept' })}
                        disabled={respond.isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => respond.mutate({ id: item.id, action: 'decline' })}
                        disabled={respond.isPending}
                      >
                        Decline
                      </Button>
                    </>
                  ) : box === 'sent' && interest.status === 'PENDING' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => respond.mutate({ id: item.id, action: 'withdraw' })}
                      disabled={respond.isPending}
                    >
                      Withdraw
                    </Button>
                  ) : interest.status === 'ACCEPTED' ? (
                    <Button size="sm" onClick={() => openConversation.mutate(profile.userId)}>
                      Message
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}

        {respond.isError && (
          <Alert tone="error">
            {respond.error instanceof Error ? respond.error.message : 'That did not work.'}
          </Alert>
        )}
      </div>

      {box === 'received' && items.length > 0 && (
        <p className="mt-6 text-center text-sm text-ink-400">
          Declining is quiet — the other person is only told their interest was answered, never that
          it was turned down.
        </p>
      )}
    </div>
  );
}
