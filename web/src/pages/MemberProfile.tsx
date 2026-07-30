import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/ProfileCard';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageLoader,
  ProgressRing,
  Select,
  Textarea,
  VerifiedBadge,
  cx,
} from '../components/ui';
import { ApiError, api } from '../lib/api';
import { activityLabel, compatibilityLabel, distanceLabel, formatDate, heightLabel } from '../lib/format';
import { useReference } from '../lib/reference';
import type { ClanAdvisory, Compatibility, FullProfile } from '../lib/types';

interface Response {
  profile: FullProfile;
  compatibility: Compatibility | null;
  advisory: ClanAdvisory | null;
  viewer: {
    isSelf: boolean;
    isConnection?: boolean;
    interestStatus?: string | null;
    interestDirection?: 'SENT' | 'RECEIVED' | null;
    isShortlisted?: boolean;
  };
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  return (
    <div className="flex justify-between gap-4 border-b border-paper-200 py-2.5 last:border-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink-800">{value}</dd>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

export function MemberProfile() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: reference } = useReference();

  const [interestOpen, setInterestOpen] = useState(false);
  const [interestNote, setInterestNote] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);

  const profileQuery = useQuery({
    queryKey: ['member', userId],
    queryFn: () => api<Response>(`/profiles/${userId}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['member', userId] });
    void queryClient.invalidateQueries({ queryKey: ['interest-summary'] });
  };

  const sendInterest = useMutation({
    mutationFn: () =>
      api('/interests', {
        method: 'POST',
        body: { receiverId: userId, ...(interestNote.trim() ? { message: interestNote.trim() } : {}) },
      }),
    onSuccess: () => {
      setInterestOpen(false);
      setInterestNote('');
      setActionError(null);
      invalidate();
    },
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : 'We could not send that just now.'),
  });

  const toggleShortlist = useMutation({
    mutationFn: (on: boolean) =>
      on
        ? api('/shortlist', { method: 'POST', body: { userId } })
        : api(`/shortlist/${userId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const block = useMutation({
    mutationFn: () => api('/blocks', { method: 'POST', body: { userId } }),
    onSuccess: () => navigate('/browse'),
  });

  const report = useMutation({
    mutationFn: () =>
      api('/reports', {
        method: 'POST',
        body: { userId, reason: reportReason, details: reportDetails || undefined },
      }),
    onSuccess: () => {
      setReportOpen(false);
      setReportReason('');
      setReportDetails('');
    },
  });

  const startConversation = useMutation({
    mutationFn: () => api<{ conversation: { id: string } }>('/conversations', {
      method: 'POST',
      body: { userId },
    }),
    onSuccess: (data) => navigate(`/messages/${data.conversation.id}`),
  });

  if (profileQuery.isLoading) return <PageLoader />;

  if (profileQuery.isError) {
    const err = profileQuery.error;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon="🔒"
          title={err instanceof ApiError && err.status === 403 ? 'This profile is private' : 'Profile not available'}
          description={
            err instanceof ApiError
              ? err.message
              : 'This member may have hidden their profile or left the community.'
          }
          action={
            <Link to="/browse" className="font-medium text-crimson-700 hover:underline">
              ← Back to browsing
            </Link>
          }
        />
      </div>
    );
  }

  const data = profileQuery.data!;
  const { profile, compatibility, advisory, viewer } = data;

  if (viewer.isSelf) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon="👤"
          title="This is your profile"
          description="Head to your profile page to make changes."
          action={
            <Link to="/profile" className="font-medium text-crimson-700 hover:underline">
              Edit my profile →
            </Link>
          }
        />
      </div>
    );
  }

  const photos = profile.photos ?? [];
  const canMessage = viewer.isConnection;
  const interestSent = viewer.interestStatus === 'PENDING' && viewer.interestDirection === 'SENT';
  const interestReceived =
    viewer.interestStatus === 'PENDING' && viewer.interestDirection === 'RECEIVED';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/browse" className="mb-5 inline-block text-sm text-ink-500 hover:text-crimson-700">
        ← Back to browsing
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Photos + header */}
          <div className="card overflow-hidden">
            {photos.length > 0 ? (
              <div>
                <img
                  src={photos[activePhoto]?.url}
                  alt={`${profile.displayName}, photo ${activePhoto + 1} of ${photos.length}`}
                  className="aspect-4/3 w-full bg-paper-200 object-cover"
                />
                {photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-3">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setActivePhoto(index)}
                        className={cx(
                          'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                          index === activePhoto ? 'border-crimson-600' : 'border-transparent',
                        )}
                        aria-label={`View photo ${index + 1}`}
                      >
                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-4/3 items-center justify-center bg-paper-200">
                <Avatar name={profile.displayName} size="xl" />
              </div>
            )}

            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-3xl font-bold">
                    {profile.displayName}, {profile.age}
                  </h1>
                  <p className="mt-1 text-ink-500">
                    {[profile.city, profile.ukRegionLabel].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {profile.verified && <VerifiedBadge />}
              </div>

              {profile.headline && (
                <p className="mt-4 font-display text-lg text-ink-700 italic">“{profile.headline}”</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {profile.clanLabel && <Badge tone="crimson">{profile.clanLabel} thar</Badge>}
                {profile.intentLabel && <Badge tone="marigold">{profile.intentLabel}</Badge>}
                {profile.occupation && <Badge>{profile.occupation}</Badge>}
                {profile.serviceFamily && <Badge tone="blue">Service family</Badge>}
                {distanceLabel(profile.distanceMiles) && (
                  <Badge>{distanceLabel(profile.distanceMiles)}</Badge>
                )}
              </div>

              <p className="mt-4 text-sm text-ink-400">
                {activityLabel(profile.lastActiveAt)} · Member since {formatDate(profile.memberSince)}
              </p>
            </div>
          </div>

          {/* Clan advisory */}
          {advisory?.shared && advisory.message && (
            <Alert tone="warning" title="A note about clan">
              {advisory.message}
            </Alert>
          )}

          {profile.about && (
            <section className="card p-6">
              <h2 className="mb-3 text-lg font-semibold">About {profile.displayName}</h2>
              <p className="leading-relaxed whitespace-pre-line text-ink-700">{profile.about}</p>
            </section>
          )}

          {profile.lookingFor && (
            <section className="card p-6">
              <h2 className="mb-3 text-lg font-semibold">What they are looking for</h2>
              <p className="leading-relaxed whitespace-pre-line text-ink-700">{profile.lookingFor}</p>
            </section>
          )}

          {profile.interests.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-3 text-lg font-semibold">Interests</h2>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest) => (
                  <Badge key={interest}>{interest}</Badge>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <DetailCard title="Heritage">
              <DetailRow label="Heritage" value={profile.heritageLabel} />
              <DetailRow label="Thar (clan)" value={profile.clanLabel} />
              <DetailRow label="Mother's thar" value={profile.motherClanLabel} />
              <DetailRow
                label="Ancestral district"
                value={
                  reference?.ancestralDistricts.find((d) => d.value === profile.ancestralDistrict)
                    ?.label
                }
              />
              <DetailRow label="Faith" value={profile.religionLabel} />
              <DetailRow label="Tamu Kyi" value={profile.gurungFluencyLabel} />
              <DetailRow
                label="Languages"
                value={profile.languages
                  .map((l) => reference?.languages.find((o) => o.value === l)?.label ?? l)
                  .join(', ')}
              />
            </DetailCard>

            <DetailCard title="Life in the UK">
              <DetailRow label="Region" value={profile.ukRegionLabel} />
              <DetailRow label="City" value={profile.city} />
              <DetailRow label="Status" value={profile.residencyStatusLabel} />
              <DetailRow label="Years in the UK" value={profile.yearsInUk} />
              <DetailRow label="Grew up in" value={profile.raisedInLabel} />
              <DetailRow
                label="Open to relocating"
                value={profile.willingToRelocate ? 'Yes' : 'Prefers to stay'}
              />
            </DetailCard>

            <DetailCard title="Education & work">
              <DetailRow label="Education" value={profile.educationLabel} />
              <DetailRow label="Studied" value={profile.fieldOfStudy} />
              <DetailRow label="Work" value={profile.occupation} />
              <DetailRow label="Employment" value={profile.employmentStatusLabel} />
              <DetailRow label="Income" value={profile.incomeBandLabel} />
            </DetailCard>

            <DetailCard title="Lifestyle">
              <DetailRow label="Height" value={heightLabel(profile.heightCm)} />
              <DetailRow label="Marital status" value={profile.maritalStatusLabel} />
              <DetailRow
                label="Children"
                value={profile.hasChildren ? (profile.childrenLivingStatus === 'LIVING_WITH_ME' ? 'Yes, living with them' : 'Yes') : 'No'}
              />
              <DetailRow label="Diet" value={profile.dietLabel} />
              <DetailRow label="Smoking" value={profile.smokingLabel} />
              <DetailRow label="Drinking" value={profile.drinkingLabel} />
            </DetailCard>

            <DetailCard title="Family">
              <DetailRow label="Family type" value={profile.familyTypeLabel} />
              <DetailRow label="Values" value={profile.familyValuesLabel} />
              <DetailRow label="Based in" value={profile.familyBasedIn} />
              <DetailRow label="Father" value={profile.fatherOccupation} />
              <DetailRow label="Mother" value={profile.motherOccupation} />
              <DetailRow
                label="Siblings"
                value={
                  profile.brothers != null || profile.sisters != null
                    ? `${profile.brothers ?? 0} brothers, ${profile.sisters ?? 0} sisters`
                    : null
                }
              />
              <DetailRow
                label="Profile managed by"
                value={
                  profile.profileManagedBy === 'SELF'
                    ? null
                    : reference?.profileManagedBy.find((o) => o.value === profile.profileManagedBy)
                        ?.label
                }
              />
            </DetailCard>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
          {compatibility && (
            <section className="card p-6">
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={compatibility.score}
                  size={72}
                  strokeWidth={6}
                  tone={compatibility.score >= 70 ? 'green' : 'marigold'}
                  label={`${compatibility.score}% compatibility`}
                />
                <div>
                  <p className="font-semibold">{compatibilityLabel(compatibility.score)}</p>
                  <p className="text-xs text-ink-500">
                    Based on {compatibility.coverage}% of the things you have both filled in
                  </p>
                </div>
              </div>

              {compatibility.highlights.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-paper-200 pt-4">
                  {compatibility.highlights.map((h) => (
                    <li key={h} className="flex gap-2 text-sm text-ink-600">
                      <span className="text-emerald-600" aria-hidden="true">
                        ✓
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              )}

              <details className="mt-4 border-t border-paper-200 pt-4">
                <summary className="cursor-pointer text-sm font-medium text-crimson-700">
                  See the full breakdown
                </summary>
                <ul className="mt-3 space-y-2.5">
                  {compatibility.factors.map((factor) => (
                    <li key={factor.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-600">{factor.label}</span>
                        <span className="font-medium text-ink-500">
                          {Math.round((factor.score ?? 0) * 100)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-200">
                        <div
                          className={cx(
                            'h-full rounded-full',
                            (factor.score ?? 0) >= 0.7
                              ? 'bg-emerald-500'
                              : (factor.score ?? 0) >= 0.4
                                ? 'bg-marigold-400'
                                : 'bg-crimson-400',
                          )}
                          style={{ width: `${Math.round((factor.score ?? 0) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-400">
                  Anything neither of you has filled in is left out of the score rather than counted
                  against you.
                </p>
              </details>
            </section>
          )}

          <section className="card space-y-3 p-6">
            {actionError && <Alert tone="error">{actionError}</Alert>}

            {canMessage ? (
              <Button
                fullWidth
                size="lg"
                loading={startConversation.isPending}
                onClick={() => startConversation.mutate()}
              >
                Send a message
              </Button>
            ) : interestReceived ? (
              <>
                <Alert tone="success">
                  {profile.displayName} has expressed interest in you.
                </Alert>
                <Link to="/interests">
                  <Button fullWidth size="lg">
                    Reply to their interest
                  </Button>
                </Link>
              </>
            ) : interestSent ? (
              <Button fullWidth size="lg" disabled>
                Interest sent — waiting for a reply
              </Button>
            ) : viewer.interestStatus === 'DECLINED' ? (
              <Button fullWidth size="lg" disabled>
                Already answered
              </Button>
            ) : (
              <Button fullWidth size="lg" onClick={() => setInterestOpen(true)}>
                Express interest
              </Button>
            )}

            <Button
              fullWidth
              variant="secondary"
              onClick={() => toggleShortlist.mutate(!viewer.isShortlisted)}
              loading={toggleShortlist.isPending}
            >
              {viewer.isShortlisted ? '★ On your shortlist' : '☆ Add to shortlist'}
            </Button>

            <div className="flex gap-2 border-t border-paper-200 pt-3">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setReportOpen(true)}>
                Report
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (
                    window.confirm(
                      `Block ${profile.displayName}? You will not see each other anywhere on the site.`,
                    )
                  ) {
                    block.mutate();
                  }
                }}
              >
                Block
              </Button>
            </div>
          </section>

          <p className="px-2 text-xs text-ink-400">
            Never send money to anyone you meet here, and keep conversations on the site until you
            are comfortable.
          </p>
        </aside>
      </div>

      {/* Express interest */}
      <Modal
        open={interestOpen}
        onClose={() => setInterestOpen(false)}
        title={`Express interest in ${profile.displayName}`}
      >
        <p className="mb-4 text-sm text-ink-600">
          They will see your profile and your note. If they accept, a conversation opens between
          you — until then, neither of you can message the other.
        </p>
        <Field
          label="Add a short note (optional)"
          htmlFor="interest-note"
          hint="A sentence about why you got in touch goes a long way."
        >
          <Textarea
            id="interest-note"
            maxLength={500}
            value={interestNote}
            onChange={(e) => setInterestNote(e.target.value)}
            placeholder="Namaste — I saw we both grew up around Aldershot…"
          />
        </Field>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={() => setInterestOpen(false)}>
            Cancel
          </Button>
          <Button
            fullWidth
            loading={sendInterest.isPending}
            onClick={() => sendInterest.mutate()}
          >
            Send interest
          </Button>
        </div>
      </Modal>

      {/* Report */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this member">
        {report.isSuccess ? (
          <Alert tone="success">Thank you. A moderator will look into this.</Alert>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-600">
              Reports go to our moderators and are never shared with the member.
            </p>
            <div className="space-y-4">
              <Field label="What is the problem?" htmlFor="report-reason" required>
                <Select
                  id="report-reason"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  options={reference?.reportReasons ?? []}
                  placeholder="Select a reason…"
                />
              </Field>
              <Field label="Anything else we should know?" htmlFor="report-details">
                <Textarea
                  id="report-details"
                  maxLength={2000}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                fullWidth
                variant="danger"
                disabled={!reportReason}
                loading={report.isPending}
                onClick={() => report.mutate()}
              >
                Submit report
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
