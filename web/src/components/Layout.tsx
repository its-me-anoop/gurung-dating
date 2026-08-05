import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { OwnProfile } from '../lib/types';
import { Avatar } from './ProfileCard';
import { LinkButton, cx } from './ui';

function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2.5', className)}>
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-crimson-700 text-lg text-white"
        aria-hidden="true"
      >
        🏔️
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold text-crimson-800">Tamu Sansar</span>
        <span className="block text-[11px] tracking-wide text-ink-400 uppercase">
          Gurung community · UK
        </span>
      </span>
    </Link>
  );
}

interface Counts {
  pendingReceived: number;
  connections: number;
}

const NAV = [
  { to: '/dashboard', label: 'Home' },
  { to: '/browse', label: 'Browse' },
  { to: '/interests', label: 'Interests', badge: 'interests' as const },
  { to: '/messages', label: 'Messages', badge: 'messages' as const },
  { to: '/shortlist', label: 'Shortlist' },
];

export function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const signedIn = Boolean(user);

  const { data: counts } = useQuery({
    queryKey: ['interest-summary'],
    queryFn: () => api<Counts>('/interests/summary'),
    enabled: signedIn,
    refetchInterval: 60_000,
  });

  const { data: unread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => api<{ unread: number }>('/unread-count'),
    enabled: signedIn,
    refetchInterval: 30_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<{ unread: number }>('/notifications?unreadOnly=true&limit=1'),
    enabled: signedIn,
    refetchInterval: 60_000,
  });

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api<{ profile: OwnProfile }>('/profiles/me').then((r) => r.profile),
    enabled: signedIn,
  });

  const badgeFor = (kind?: 'interests' | 'messages') => {
    if (kind === 'interests') return counts?.pendingReceived ?? 0;
    if (kind === 'messages') return unread?.unread ?? 0;
    return 0;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-paper-200 bg-paper-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Logo />

          {signedIn ? (
            <>
              <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
                {NAV.map((item) => {
                  const count = badgeFor(item.badge);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cx(
                          'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-crimson-50 text-crimson-800'
                            : 'text-ink-600 hover:bg-paper-200',
                        )
                      }
                    >
                      {item.label}
                      {count > 0 && (
                        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson-700 px-1.5 text-[11px] font-semibold text-white">
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="flex items-center gap-2">
                <Link
                  to="/notifications"
                  className="relative rounded-lg p-2 text-ink-500 hover:bg-paper-200"
                  aria-label="Notifications"
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M10 2a6 6 0 00-6 6v3.6l-1.3 2.6A1 1 0 003.6 16h12.8a1 1 0 00.9-1.8L16 11.6V8a6 6 0 00-6-6zM8 17a2 2 0 104 0H8z" />
                  </svg>
                  {(notifications?.unread ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-crimson-600 ring-2 ring-paper-50" />
                  )}
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex items-center gap-2 rounded-full p-0.5 hover:bg-paper-200"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                  >
                    <Avatar
                      name={profile?.displayName ?? 'Me'}
                      photoUrl={profile?.primaryPhoto?.url}
                      thumbnail={profile?.primaryPhoto?.thumbnail}
                      size="sm"
                    />
                  </button>

                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpen(false)}
                        aria-hidden="true"
                      />
                      <div
                        className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-paper-200 bg-white py-1.5 shadow-lg"
                        role="menu"
                      >
                        <div className="border-b border-paper-200 px-4 py-2">
                          <p className="truncate text-sm font-medium">{profile?.displayName}</p>
                          <p className="truncate text-xs text-ink-400">{user?.email}</p>
                        </div>
                        {[
                          { to: '/profile', label: 'My profile' },
                          { to: '/profile/photos', label: 'Photos' },
                          { to: '/preferences', label: 'Match preferences' },
                          { to: '/settings', label: 'Settings' },
                          ...(user?.role === 'ADMIN' || user?.role === 'MODERATOR'
                            ? [{ to: '/admin', label: 'Moderation' }]
                            : []),
                        ].map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                            className="block px-4 py-2 text-sm text-ink-700 hover:bg-paper-100"
                          >
                            {item.label}
                          </Link>
                        ))}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleSignOut}
                          className="block w-full border-t border-paper-200 px-4 py-2 text-left text-sm text-ink-700 hover:bg-paper-100"
                        >
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <LinkButton to="/login" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton to="/register" size="sm">
                Join free
              </LinkButton>
            </div>
          )}
        </div>

        {/* Mobile navigation */}
        {signedIn && (
          <nav
            className="flex overflow-x-auto border-t border-paper-200 px-2 md:hidden"
            aria-label="Main"
          >
            {NAV.map((item) => {
              const count = badgeFor(item.badge);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cx(
                      'flex-1 border-b-2 px-3 py-2.5 text-center text-xs font-medium whitespace-nowrap',
                      isActive
                        ? 'border-crimson-700 text-crimson-800'
                        : 'border-transparent text-ink-500',
                    )
                  }
                >
                  {item.label}
                  {count > 0 && (
                    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson-700 px-1 text-[10px] text-white">
                      {count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-paper-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-ink-500">
              A matrimony and dating community built for Gurungs living in the United Kingdom —
              clan-aware, moderated, and free to join.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Community</h3>
            <ul className="space-y-2 text-sm text-ink-500">
              <li>
                <Link to="/about" className="hover:text-crimson-700">
                  About Tamu Sansar
                </Link>
              </li>
              <li>
                <Link to="/safety" className="hover:text-crimson-700">
                  Safety &amp; guidelines
                </Link>
              </li>
              <li>
                <Link to="/browse" className="hover:text-crimson-700">
                  Browse members
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Support</h3>
            <ul className="space-y-2 text-sm text-ink-500">
              <li>
                <Link to="/safety" className="hover:text-crimson-700">
                  Report a member
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-crimson-700">
                  Account settings
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">A note on clans</h3>
            <p className="text-sm text-ink-500">
              Thar names and their groupings vary between valleys and lineages. Our list is a
              starting point — tell us if yours is missing or spelt differently and we will add it.
            </p>
          </div>
        </div>

        <div className="border-t border-paper-200 px-4 py-5 text-center text-xs text-ink-400">
          © {new Date().getFullYear()} Tamu Sansar · Made for the Gurung community in the UK
        </div>
      </footer>
    </div>
  );
}
