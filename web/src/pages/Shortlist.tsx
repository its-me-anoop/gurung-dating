import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileCard } from '../components/ProfileCard';
import { Button, EmptyState, LinkButton, PageLoader } from '../components/ui';
import { api } from '../lib/api';
import type { ProfileCard as Card } from '../lib/types';

interface Item {
  note: string | null;
  addedAt: string;
  profile: Card;
}

export function Shortlist() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['shortlist'],
    queryFn: () => api<{ items: Item[] }>('/shortlist').then((r) => r.items),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['shortlist'] });

  const remove = useMutation({
    mutationFn: (userId: string) => api(`/shortlist/${userId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const sendInterest = useMutation({
    mutationFn: (userId: string) =>
      api('/interests', { method: 'POST', body: { receiverId: userId } }),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['interest-summary'] });
    },
  });

  if (listQuery.isLoading) return <PageLoader />;

  const items = listQuery.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Your shortlist</h1>
      <p className="mt-2 text-ink-500">
        Profiles you have saved to come back to. Nobody is told they have been shortlisted.
      </p>

      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState
            icon="⭐"
            title="Your shortlist is empty"
            description="Tap the star on any profile to keep it here while you think it over."
            action={<LinkButton to="/browse">Browse members</LinkButton>}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <div key={item.profile.userId}>
                <ProfileCard
                  profile={item.profile}
                  actions={
                    <>
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={Boolean(item.profile.interestStatus) || sendInterest.isPending}
                        onClick={() => sendInterest.mutate(item.profile.userId)}
                      >
                        {item.profile.interestStatus ? 'Interest sent' : 'Express interest'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove.mutate(item.profile.userId)}
                        aria-label={`Remove ${item.profile.displayName} from shortlist`}
                      >
                        Remove
                      </Button>
                    </>
                  }
                />
                {item.note && (
                  <p className="mt-2 rounded-lg bg-paper-100 px-3 py-2 text-xs text-ink-600 italic">
                    Your note: {item.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
