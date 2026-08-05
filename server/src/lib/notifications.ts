import { prisma } from './prisma.js';

interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Creates an in-app notification. Failures are swallowed on purpose: a
 * notification is a side effect of the action the member actually asked for,
 * and it should never be the reason their interest or message fails.
 *
 * When email delivery is added, it hangs off here — the call sites stay put.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    });
  } catch {
    // Intentionally ignored — see above.
  }
}
