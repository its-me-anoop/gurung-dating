import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/ProfileCard';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageLoader,
  SectionHeading,
  Select,
  Textarea,
  cx,
} from '../components/ui';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import { useReference } from '../lib/reference';
import { useAuth } from '../lib/auth';
import type { FullProfile, Photo } from '../lib/types';

interface Stats {
  totalMembers: number;
  activeMembers: number;
  newThisMonth: number;
  verifiedProfiles: number;
  pendingPhotos: number;
  openReports: number;
  connections: number;
  messages: number;
  byRegion: Array<{ region: string | null; count: number }>;
}

interface PendingPhoto extends Photo {
  uploadedAt: string;
  member: { userId: string; displayName: string; verified: boolean };
}

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  resolution: string | null;
  reporter: { userId: string; displayName: string };
  reported: { userId: string; displayName: string; accountStatus: string };
}

interface Member {
  userId: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastActiveAt: string;
  profile: FullProfile | null;
}

type Tab = 'overview' | 'photos' | 'reports' | 'members';

export function Admin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: reference } = useReference();
  const [tab, setTab] = useState<Tab>('overview');
  const [memberSearch, setMemberSearch] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  const isAdmin = user?.role === 'ADMIN';

  const statsQuery = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<Stats>('/admin/stats') });

  const photosQuery = useQuery({
    queryKey: ['admin', 'photos'],
    queryFn: () => api<{ photos: PendingPhoto[] }>('/admin/photos/pending').then((r) => r.photos),
    enabled: tab === 'photos',
  });

  const reportsQuery = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => api<{ reports: Report[] }>('/admin/reports?status=OPEN').then((r) => r.reports),
    enabled: tab === 'reports',
  });

  const membersQuery = useQuery({
    queryKey: ['admin', 'members', memberSearch],
    queryFn: () =>
      api<{ members: Member[]; total: number }>(
        `/admin/members${memberSearch ? `?q=${encodeURIComponent(memberSearch)}` : ''}`,
      ),
    enabled: tab === 'members',
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin'] });

  const moderatePhoto = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: string; note?: string }) =>
      api(`/admin/photos/${id}/moderate`, { method: 'POST', body: { decision, note } }),
    onSuccess: invalidate,
  });

  const resolveReport = useMutation({
    mutationFn: ({
      id,
      status,
      action,
      resolution,
    }: {
      id: string;
      status: string;
      action: string;
      resolution?: string;
    }) => api(`/admin/reports/${id}/resolve`, { method: 'POST', body: { status, action, resolution } }),
    onSuccess: invalidate,
  });

  const setVerified = useMutation({
    mutationFn: ({ userId, verified }: { userId: string; verified: boolean }) =>
      api(`/admin/members/${userId}/verify`, { method: 'POST', body: { verified } }),
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      api(`/admin/members/${userId}/status`, { method: 'POST', body: { status } }),
    onSuccess: invalidate,
  });

  const stats = statsQuery.data;

  const TABS: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'photos', label: 'Photo queue', count: stats?.pendingPhotos },
    { id: 'reports', label: 'Reports', count: stats?.openReports },
    { id: 'members', label: 'Members' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Moderation</h1>
      <p className="mt-2 text-ink-500">
        Signed in as {isAdmin ? 'an administrator' : 'a moderator'}.
      </p>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-paper-300" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              'border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              tab === t.id
                ? 'border-crimson-700 text-crimson-800'
                : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
            {(t.count ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson-700 px-1.5 text-xs text-white">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'overview' &&
          (statsQuery.isLoading ? (
            <PageLoader />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Members', value: stats?.totalMembers },
                  { label: 'Active this week', value: stats?.activeMembers },
                  { label: 'Joined this month', value: stats?.newThisMonth },
                  { label: 'Verified profiles', value: stats?.verifiedProfiles },
                  { label: 'Connections made', value: stats?.connections },
                  { label: 'Messages sent', value: stats?.messages },
                  { label: 'Photos awaiting review', value: stats?.pendingPhotos },
                  { label: 'Open reports', value: stats?.openReports },
                ].map((stat) => (
                  <div key={stat.label} className="card p-5">
                    <p className="text-sm text-ink-500">{stat.label}</p>
                    <p className="mt-1 font-display text-3xl font-bold">{stat.value ?? 0}</p>
                  </div>
                ))}
              </div>

              <section className="card mt-6 p-6">
                <SectionHeading title="Members by region" />
                <ul className="space-y-2">
                  {(stats?.byRegion ?? []).map((row) => {
                    const max = Math.max(...(stats?.byRegion ?? []).map((r) => r.count), 1);
                    return (
                      <li key={row.region ?? 'unset'}>
                        <div className="flex justify-between text-sm">
                          <span>
                            {reference?.ukRegions.find((r) => r.value === row.region)?.label ??
                              'Not set'}
                          </span>
                          <span className="font-medium">{row.count}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-200">
                          <div
                            className="h-full rounded-full bg-crimson-600"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          ))}

        {tab === 'photos' &&
          (photosQuery.isLoading ? (
            <PageLoader />
          ) : (photosQuery.data?.length ?? 0) === 0 ? (
            <EmptyState icon="✅" title="Nothing waiting" description="The photo queue is clear." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {photosQuery.data?.map((photo) => (
                <div key={photo.id} className="card overflow-hidden">
                  <img
                    src={photo.url}
                    alt="Awaiting moderation"
                    className="aspect-square w-full bg-paper-200 object-cover"
                  />
                  <div className="space-y-3 p-4">
                    <div>
                      <Link
                        to={`/members/${photo.member.userId}`}
                        className="font-medium hover:text-crimson-700"
                      >
                        {photo.member.displayName}
                      </Link>
                      <p className="text-xs text-ink-400">
                        Uploaded {relativeTime(photo.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => moderatePhoto.mutate({ id: photo.id, decision: 'APPROVED' })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="flex-1"
                        onClick={() =>
                          moderatePhoto.mutate({
                            id: photo.id,
                            decision: 'REJECTED',
                            note: 'This photo does not meet our guidelines.',
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {tab === 'reports' &&
          (reportsQuery.isLoading ? (
            <PageLoader />
          ) : (reportsQuery.data?.length ?? 0) === 0 ? (
            <EmptyState icon="🕊️" title="No open reports" description="Nothing needs attention." />
          ) : (
            <div className="space-y-4">
              {reportsQuery.data?.map((report) => (
                <article key={report.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="crimson">
                          {reference?.reportReasons.find((r) => r.value === report.reason)?.label ??
                            report.reason}
                        </Badge>
                        <Badge>{report.reported.accountStatus}</Badge>
                      </div>
                      <p className="mt-2 text-sm">
                        <Link
                          to={`/members/${report.reported.userId}`}
                          className="font-medium hover:text-crimson-700"
                        >
                          {report.reported.displayName}
                        </Link>{' '}
                        <span className="text-ink-500">
                          reported by {report.reporter.displayName}
                        </span>
                      </p>
                      <p className="text-xs text-ink-400">{relativeTime(report.createdAt)}</p>
                    </div>
                  </div>

                  {report.details && (
                    <p className="mt-3 rounded-lg bg-paper-100 px-3 py-2 text-sm text-ink-700">
                      {report.details}
                    </p>
                  )}

                  <div className="mt-4 space-y-3">
                    <Textarea
                      rows={2}
                      placeholder="Notes on what you decided and why…"
                      value={resolutionNotes[report.id] ?? ''}
                      onChange={(e) =>
                        setResolutionNotes((n) => ({ ...n, [report.id]: e.target.value }))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          resolveReport.mutate({
                            id: report.id,
                            status: 'ACTIONED',
                            action: 'SUSPEND',
                            resolution: resolutionNotes[report.id],
                          })
                        }
                      >
                        Suspend the account
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          resolveReport.mutate({
                            id: report.id,
                            status: 'ACTIONED',
                            action: 'NONE',
                            resolution: resolutionNotes[report.id],
                          })
                        }
                      >
                        Warn, keep active
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          resolveReport.mutate({
                            id: report.id,
                            status: 'DISMISSED',
                            action: 'NONE',
                            resolution: resolutionNotes[report.id],
                          })
                        }
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ))}

        {tab === 'members' && (
          <>
            <div className="mb-5 max-w-md">
              <Field label="Find a member" htmlFor="member-search">
                <Input
                  id="member-search"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Name or email address"
                />
              </Field>
            </div>

            {membersQuery.isLoading ? (
              <PageLoader />
            ) : (
              <div className="space-y-3">
                {membersQuery.data?.members.map((member) => (
                  <article key={member.userId} className="card flex flex-wrap items-center gap-4 p-4">
                    <Avatar
                      name={member.profile?.displayName ?? member.email}
                      photoUrl={member.profile?.primaryPhoto?.url}
                    />
                    <div className="min-w-48 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/members/${member.userId}`}
                          className="font-medium hover:text-crimson-700"
                        >
                          {member.profile?.displayName ?? '(no profile)'}
                        </Link>
                        {member.profile?.verified && <Badge tone="green">Verified</Badge>}
                        {member.role !== 'MEMBER' && <Badge tone="blue">{member.role}</Badge>}
                        <Badge tone={member.status === 'ACTIVE' ? 'neutral' : 'crimson'}>
                          {member.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-400">
                        {member.email} · active {relativeTime(member.lastActiveAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setVerified.mutate({
                            userId: member.userId,
                            verified: !member.profile?.verified,
                          })
                        }
                      >
                        {member.profile?.verified ? 'Remove verification' : 'Verify'}
                      </Button>
                      {isAdmin && member.userId !== user?.id && (
                        <Select
                          aria-label={`Account status for ${member.profile?.displayName ?? member.email}`}
                          value={member.status}
                          onChange={(e) =>
                            setStatus.mutate({ userId: member.userId, status: e.target.value })
                          }
                          options={[
                            { value: 'ACTIVE', label: 'Active' },
                            { value: 'SUSPENDED', label: 'Suspended' },
                            { value: 'DEACTIVATED', label: 'Deactivated' },
                          ]}
                        />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {(moderatePhoto.isError || resolveReport.isError || setStatus.isError) && (
        <div className="mt-6">
          <Alert tone="error">That action did not go through. Please try again.</Alert>
        </div>
      )}
    </div>
  );
}
