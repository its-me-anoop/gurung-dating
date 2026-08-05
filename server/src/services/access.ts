import { forbidden, notFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

/**
 * A block is symmetric in effect: whichever direction it was created, neither
 * side sees the other anywhere on the site.
 */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { ownerId: a, targetId: b },
        { ownerId: b, targetId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

/** Every user id this member has blocked or been blocked by. */
export async function blockedUserIds(userId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ ownerId: userId }, { targetId: userId }] },
    select: { ownerId: true, targetId: true },
  });
  const ids = new Set<string>();
  for (const b of blocks) ids.add(b.ownerId === userId ? b.targetId : b.ownerId);
  return [...ids];
}

/** Two members are connected once an interest between them has been accepted. */
export async function areConnected(a: string, b: string): Promise<boolean> {
  const interest = await prisma.interest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: a, receiverId: b },
        { senderId: b, receiverId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(interest);
}

export interface ViewerContext {
  /** null for a signed-out visitor. */
  viewerId: string | null;
  isConnection: boolean;
  isSelf: boolean;
  isStaff: boolean;
}

/**
 * Resolves whether `viewer` may see `targetUserId`'s profile, and with how much
 * detail. Throws 404 rather than 403 when a profile is hidden or blocked — a
 * 403 would confirm the account exists, which is exactly what someone who has
 * just been blocked should not learn.
 */
export async function resolveProfileAccess(
  targetUserId: string,
  viewer: { id: string; role: string } | undefined,
): Promise<ViewerContext> {
  const viewerId = viewer?.id ?? null;
  const isSelf = viewerId === targetUserId;
  const isStaff = viewer?.role === 'ADMIN' || viewer?.role === 'MODERATOR';

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, status: true, profile: { select: { visibility: true } } },
  });

  if (!target || !target.profile) throw notFound('That profile is not available.');
  if (isSelf || isStaff) {
    return { viewerId, isConnection: true, isSelf, isStaff };
  }

  if (target.status !== 'ACTIVE' && target.status !== 'PENDING_VERIFICATION') {
    throw notFound('That profile is not available.');
  }

  if (viewerId && (await isBlockedBetween(viewerId, targetUserId))) {
    throw notFound('That profile is not available.');
  }

  const isConnection = viewerId ? await areConnected(viewerId, targetUserId) : false;
  const visibility = target.profile.visibility;

  if (visibility === 'MEMBERS_ONLY' && !viewerId) {
    throw forbidden('Sign in to view this profile.');
  }
  if (visibility === 'CONNECTIONS_ONLY' && !isConnection) {
    throw forbidden('This member only shows their profile to people they have connected with.');
  }

  return { viewerId, isConnection, isSelf, isStaff };
}

/** The canonical member ordering used by the one-row-per-pair conversation table. */
export function conversationPair(a: string, b: string): { memberAId: string; memberBId: string } {
  return a < b ? { memberAId: a, memberBId: b } : { memberAId: b, memberBId: a };
}
