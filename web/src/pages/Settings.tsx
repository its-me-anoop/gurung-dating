import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Field, Input, PageLoader, SectionHeading } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, relativeTime } from '../lib/format';

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

interface BlockedMember {
  userId: string;
  reason: string | null;
  createdAt: string;
  displayName: string;
}

/** Turns a raw user-agent into something a person can recognise. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  if (/iPhone|iPad/i.test(userAgent)) return 'iPhone or iPad';
  if (/Android/i.test(userAgent)) return 'Android device';
  if (/Macintosh/i.test(userAgent)) return 'Mac';
  if (/Windows/i.test(userAgent)) return 'Windows PC';
  if (/Linux/i.test(userAgent)) return 'Linux computer';
  return 'Web browser';
}

export function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<{ sessions: Session[] }>('/auth/sessions').then((r) => r.sessions),
  });

  const blocksQuery = useQuery({
    queryKey: ['blocks'],
    queryFn: () => api<{ blocks: BlockedMember[] }>('/blocks').then((r) => r.blocks),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
    onSuccess: () => {
      setPasswordMessage('Your password has been changed.');
      setPasswordError(null);
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (err) => {
      setPasswordError(err instanceof ApiError ? err.message : 'We could not change your password.');
      setPasswordMessage(null);
    },
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const unblock = useMutation({
    mutationFn: (userId: string) => api(`/blocks/${userId}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  });

  const deactivate = useMutation({
    mutationFn: () => api('/profiles/me/deactivate', { method: 'POST' }),
    onSuccess: async () => {
      await signOut();
      navigate('/');
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => api('/profiles/me', { method: 'DELETE', body: { confirm: 'DELETE' } }),
    onSuccess: async () => {
      await signOut();
      navigate('/');
    },
  });

  if (sessionsQuery.isLoading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <section className="card p-6">
        <SectionHeading title="Account" />
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-paper-200 py-2">
            <dt className="text-ink-500">Email address</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-ink-500">Account status</dt>
            <dd className="font-medium">
              {user?.status === 'ACTIVE' ? 'Active' : 'Awaiting email confirmation'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card p-6">
        <SectionHeading title="Change password" />
        {passwordMessage && <Alert tone="success">{passwordMessage}</Alert>}
        {passwordError && <Alert tone="error">{passwordError}</Alert>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            changePassword.mutate();
          }}
          className="mt-4 space-y-4"
        >
          <Field label="Current password" htmlFor="currentPassword" required>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>

          <Field
            label="New password"
            htmlFor="newPassword"
            required
            hint="At least 10 characters, with a letter and a number."
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>

          <Button type="submit" loading={changePassword.isPending}>
            Change password
          </Button>
        </form>
      </section>

      <section className="card p-6">
        <SectionHeading
          title="Signed-in devices"
          description="Revoke anything you do not recognise."
        />
        <ul className="space-y-2">
          {(sessionsQuery.data ?? []).map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-4 border-b border-paper-200 py-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{describeDevice(session.userAgent)}</p>
                <p className="text-xs text-ink-400">
                  Signed in {relativeTime(session.createdAt)}
                  {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revokeSession.mutate(session.id)}>
                Sign out
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6">
        <SectionHeading
          title="Blocked members"
          description="Neither of you can see the other anywhere on the site."
        />
        {(blocksQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-500">You have not blocked anyone.</p>
        ) : (
          <ul className="space-y-2">
            {blocksQuery.data?.map((blocked) => (
              <li
                key={blocked.userId}
                className="flex items-center justify-between gap-4 border-b border-paper-200 py-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{blocked.displayName}</p>
                  <p className="text-xs text-ink-400">Blocked {formatDate(blocked.createdAt)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => unblock.mutate(blocked.userId)}>
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card border-marigold-200 p-6">
        <SectionHeading title="Take a break" />
        <p className="mb-4 text-sm text-ink-600">
          Hides your profile from everyone and stops all notifications. Your messages and
          connections are kept, and signing back in brings everything back exactly as it was.
        </p>
        <Button
          variant="secondary"
          loading={deactivate.isPending}
          onClick={() => {
            if (window.confirm('Hide your profile? Signing in again will restore it.')) {
              deactivate.mutate();
            }
          }}
        >
          Hide my profile
        </Button>
      </section>

      <section className="card border-red-200 p-6">
        <SectionHeading title="Delete your account" />
        <Alert tone="error" title="This cannot be undone">
          Your profile, photos, messages and connections are permanently removed.
        </Alert>

        <div className="mt-4 space-y-4">
          <Field label="Type DELETE to confirm" htmlFor="deleteConfirm">
            <Input
              id="deleteConfirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
          </Field>
          <Button
            variant="danger"
            disabled={deleteConfirm !== 'DELETE'}
            loading={deleteAccount.isPending}
            onClick={() => {
              if (window.confirm('Permanently delete your account? This cannot be undone.')) {
                deleteAccount.mutate();
              }
            }}
          >
            Delete my account permanently
          </Button>
        </div>
      </section>
    </div>
  );
}
