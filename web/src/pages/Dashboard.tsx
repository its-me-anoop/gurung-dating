import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Avatar, ProfileCard } from '../components/ProfileCard';
import {
  Alert,
  Button,
  EmptyState,
  LinkButton,
  PageLoader,
  ProgressRing,
  SectionHeading,
} from '../components/ui';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import type { InterestItem, OwnProfile, ProfileCard as Card } from '../lib/types';

interface Summary {
  pendingReceived: number;
  pendingSent: number;
  connections: number;
}

export function Dashboard() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api<{ profile: OwnProfile }>('/profiles/me').then((r) => r.profile),
  });

  const recommendationsQuery = useQuery({
    queryKey: ['recommendations'],
    queryFn: () =>
      api<{ recommendations: Card[] }>('/discovery/recommendations?limit=6').then(
        (r) => r.recommendations,
      ),
  });

  const summaryQuery = useQuery({
    queryKey: ['interest-summary'],
    queryFn: () => api<Summary>('/interests/summary'),
  });

  const receivedQuery = useQuery({
    queryKey: ['interests', 'received', 'PENDING'],
    queryFn: () =>
      api<{ items: InterestItem[] }>('/interests?box=received&status=PENDING').then((r) => r.items),
  });

  const viewersQuery = useQuery({
    queryKey: ['viewers'],
    queryFn: () =>
      api<{ viewers: Array<{ viewedAt: string; profile: Card }> }>('/profiles/me/viewers').then(
        (r) => r.viewers,
      ),
  });

  const sendInterest = useMutation({
    mutationFn: (userId: string) =>
      api('/interests', { method: 'POST', body: { receiverId: userId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      void queryClient.invalidateQueries({ queryKey: ['interest-summary'] });
    },
  });

  const shortlist = useMutation({
    mutationFn: (userId: string) => api('/shortlist', { method: 'POST', body: { userId } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  if (profileQuery.isLoading) return <PageLoader />;

  const profile = profileQuery.data;
  const summary = summaryQuery.data;
  const suggestions = profile?.completenessSuggestions ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Greeting + completeness */}
      <div className="card mb-8 flex flex-wrap items-center gap-6 p-6">
        <Avatar
          name={profile?.displayName ?? ''}
          photoUrl={profile?.primaryPhoto?.url}
          thumbnail={profile?.primaryPhoto?.thumbnail}
          size="lg"
        />

        <div className="min-w-56 flex-1">
          <h1 className="font-display text-2xl font-bold">
            Namaste, {profile?.displayName?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {summary
              ? `${summary.connections} ${summary.connections === 1 ? 'connection' : 'connections'} · ${summary.pendingReceived} waiting for your reply`
              : 'Loading your activity…'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <ProgressRing
            value={profile?.completeness ?? 0}
            size={64}
            label={`Profile ${profile?.completeness ?? 0}% complete`}
            tone={(profile?.completeness ?? 0) >= 80 ? 'green' : 'marigold'}
          />
          <div>
            <p className="text-sm font-medium">Profile completeness</p>
            <Link to="/profile" className="text-sm text-crimson-700 hover:underline">
              Edit your profile →
            </Link>
          </div>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mb-8">
          <Alert tone="warning" title="A few things would make your profile stronger">
            <ul className="mt-2 list-inside list-disc space-y-1">
              {suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <LinkButton to="/profile" size="sm" variant="secondary">
                Edit profile
              </LinkButton>
              <LinkButton to="/profile/photos" size="sm" variant="secondary">
                Add photos
              </LinkButton>
            </div>
          </Alert>
        </div>
      )}

      {/* Interests waiting */}
      {(receivedQuery.data?.length ?? 0) > 0 && (
        <section className="mb-10">
          <SectionHeading
            title="Someone is interested in you"
            description="They are waiting to hear back."
            action={
              <LinkButton to="/interests" variant="secondary" size="sm">
                See all
              </LinkButton>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {receivedQuery.data?.slice(0, 3).map((item) => (
              <div key={item.id} className="card flex items-center gap-4 p-4">
                <Avatar
                  name={item.profile.displayName}
                  photoUrl={item.profile.primaryPhoto?.url}
                  thumbnail={item.profile.primaryPhoto?.thumbnail}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/members/${item.profile.userId}`}
                    className="font-medium hover:text-crimson-700"
                  >
                    {item.profile.displayName}, {item.profile.age}
                  </Link>
                  <p className="truncate text-xs text-ink-500">
                    {item.profile.city ?? item.profile.ukRegionLabel} · {relativeTime(item.createdAt)}
                  </p>
                </div>
                <LinkButton to="/interests" size="sm">
                  Reply
                </LinkButton>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      <section className="mb-10">
        <SectionHeading
          title="Suggested for you"
          description="Scored against what you both said you are looking for."
          action={
            <LinkButton to="/browse" variant="secondary" size="sm">
              Browse everyone
            </LinkButton>
          }
        />

        {recommendationsQuery.isLoading ? (
          <PageLoader />
        ) : (recommendationsQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No suggestions just yet"
            description="Widen your match preferences, or check back once more members have joined your area."
            action={
              <LinkButton to="/preferences" variant="secondary">
                Adjust preferences
              </LinkButton>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recommendationsQuery.data?.map((card) => (
              <ProfileCard
                key={card.userId}
                profile={card}
                actions={
                  <>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => sendInterest.mutate(card.userId)}
                      disabled={sendInterest.isPending}
                    >
                      Express interest
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => shortlist.mutate(card.userId)}
                      aria-label={`Shortlist ${card.displayName}`}
                    >
                      ☆
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Who viewed me */}
      <section>
        <SectionHeading title="Who looked at your profile" />
        {(viewersQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon="👀"
            title="No profile views yet"
            description="Adding photos and finishing your profile makes a big difference here."
            action={
              <LinkButton to="/profile/photos" variant="secondary">
                Add photos
              </LinkButton>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-4">
            {viewersQuery.data?.slice(0, 10).map((view) => (
              <Link
                key={view.profile.userId}
                to={`/members/${view.profile.userId}`}
                className="card flex w-40 flex-col items-center p-4 text-center transition-shadow hover:shadow-md"
              >
                <Avatar
                  name={view.profile.displayName}
                  photoUrl={view.profile.primaryPhoto?.url}
                  thumbnail={view.profile.primaryPhoto?.thumbnail}
                />
                <p className="mt-2 truncate text-sm font-medium">
                  {view.profile.displayName}, {view.profile.age}
                </p>
                <p className="text-xs text-ink-400">{relativeTime(view.viewedAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
