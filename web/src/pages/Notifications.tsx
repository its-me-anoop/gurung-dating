import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button, EmptyState, PageLoader, cx } from '../components/ui';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import type { Notification } from '../lib/types';

const ICONS: Record<string, string> = {
  INTEREST_RECEIVED: '💌',
  INTEREST_ACCEPTED: '🤝',
  INTEREST_DECLINED: '📭',
  NEW_MESSAGE: '💬',
  PROFILE_VIEW: '👀',
  PHOTO_APPROVED: '🖼️',
  PHOTO_REJECTED: '⚠️',
  PROFILE_VERIFIED: '✅',
  SYSTEM: '🔔',
};

export function Notifications() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () =>
      api<{ notifications: Notification[]; unread: number }>('/notifications?limit=50'),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: invalidate,
  });

  if (listQuery.isLoading) return <PageLoader />;

  const notifications = listQuery.data?.notifications ?? [];
  const unread = listQuery.data?.unread ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Notifications</h1>
          {unread > 0 && <p className="mt-1 text-sm text-ink-500">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <Button variant="secondary" size="sm" onClick={() => markAllRead.mutate()}>
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="Nothing here yet"
          description="We will let you know when someone expresses interest, replies, or looks at your profile."
        />
      ) : (
        <ul className="card divide-y divide-paper-200 overflow-hidden">
          {notifications.map((notification) => {
            const content = (
              <div
                className={cx(
                  'flex gap-4 p-4 transition-colors hover:bg-paper-100',
                  !notification.readAt && 'bg-crimson-50/60',
                )}
              >
                <span className="text-2xl" aria-hidden="true">
                  {ICONS[notification.type] ?? '🔔'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx('text-sm', !notification.readAt && 'font-semibold')}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{notification.body}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-400">{relativeTime(notification.createdAt)}</p>
                </div>
                {!notification.readAt && (
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-crimson-600"
                    aria-label="Unread"
                  />
                )}
              </div>
            );

            return (
              <li key={notification.id}>
                {notification.link ? (
                  <Link
                    to={notification.link}
                    onClick={() => !notification.readAt && markRead.mutate(notification.id)}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => !notification.readAt && markRead.mutate(notification.id)}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
