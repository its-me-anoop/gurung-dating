import { Link } from 'react-router-dom';
import { activityLabel, distanceLabel, initials } from '../lib/format';
import type { ProfileCard as ProfileCardType } from '../lib/types';
import { Badge, ProgressRing, VerifiedBadge, cx } from './ui';

export function Avatar({
  name,
  photoUrl,
  thumbnail,
  size = 'md',
  className,
}: {
  name: string;
  photoUrl?: string | null;
  thumbnail?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizes = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-20 w-20 text-lg',
    xl: 'h-28 w-28 text-2xl',
  } as const;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        // The tiny inline thumbnail shows immediately and is covered by the
        // real image the moment it decodes — no layout shift, no grey box.
        style={thumbnail ? { backgroundImage: `url(${thumbnail})`, backgroundSize: 'cover' } : undefined}
        className={cx('shrink-0 rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-crimson-100 font-semibold text-crimson-800',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

interface Props {
  profile: ProfileCardType;
  /** Rendered in the card footer — "Send interest", "Shortlist" and so on. */
  actions?: React.ReactNode;
  showCompatibility?: boolean;
}

export function ProfileCard({ profile, actions, showCompatibility = true }: Props) {
  const photo = profile.primaryPhoto;
  const distance = distanceLabel(profile.distanceMiles);

  return (
    <article className="card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link to={`/members/${profile.userId}`} className="group block">
        <div className="relative aspect-4/5 overflow-hidden bg-paper-200">
          {photo ? (
            <img
              src={photo.url}
              alt={profile.displayName}
              loading="lazy"
              style={
                photo.thumbnail
                  ? { backgroundImage: `url(${photo.thumbnail})`, backgroundSize: 'cover' }
                  : undefined
              }
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-crimson-300">
              <span className="text-5xl font-display font-semibold">
                {initials(profile.displayName)}
              </span>
              <span className="text-xs text-ink-400">No photo yet</span>
            </div>
          )}

          {showCompatibility && profile.compatibility != null && (
            <div className="absolute top-3 right-3 rounded-full bg-white/95 p-1 shadow-sm backdrop-blur">
              <ProgressRing
                value={profile.compatibility}
                size={44}
                strokeWidth={4}
                label={`${profile.compatibility}% compatibility`}
              />
            </div>
          )}

          {profile.sharesClan && (
            <div className="absolute bottom-0 w-full bg-marigold-500/95 px-3 py-1.5 text-center text-xs font-medium text-white">
              Shares a clan line with you
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg leading-tight font-semibold">
            <Link to={`/members/${profile.userId}`} className="hover:text-crimson-700">
              {profile.displayName}, {profile.age}
            </Link>
          </h3>
          {profile.verified && <VerifiedBadge />}
        </div>

        <p className="mt-1 text-sm text-ink-500">
          {[profile.city ?? profile.ukRegionLabel, profile.occupation].filter(Boolean).join(' · ')}
        </p>

        {profile.headline && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-600 italic">“{profile.headline}”</p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.clanLabel && <Badge tone="crimson">{profile.clanLabel}</Badge>}
          {profile.intentLabel && <Badge>{profile.intentLabel}</Badge>}
          {distance && <Badge>{distance}</Badge>}
        </div>

        {profile.highlights && profile.highlights.length > 0 && (
          <ul className="mt-3 space-y-1">
            {profile.highlights.slice(0, 2).map((h) => (
              <li key={h} className="flex gap-1.5 text-xs text-ink-500">
                <span aria-hidden="true" className="text-emerald-600">
                  ✓
                </span>
                {h}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-ink-400">{activityLabel(profile.lastActiveAt)}</p>

        {actions && <div className="mt-4 flex gap-2 border-t border-paper-200 pt-4">{actions}</div>}
      </div>
    </article>
  );
}
