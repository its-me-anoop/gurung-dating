import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createMember, resetDatabase } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('interests', () => {
  beforeEach(resetDatabase);

  it('sends an interest and notifies the receiver', async () => {
    const sender = await createMember({ gender: 'MALE', displayName: 'Bikash' });
    const receiver = await createMember({ gender: 'FEMALE' });

    const res = await request(app)
      .post('/api/interests')
      .set(auth(sender.token))
      .send({ receiverId: receiver.userId, message: 'Namaste' });

    expect(res.status).toBe(201);
    expect(res.body.interest.status).toBe('PENDING');

    const notifications = await prisma.notification.findMany({ where: { userId: receiver.userId } });
    expect(notifications[0]?.type).toBe('INTEREST_RECEIVED');
    expect(notifications[0]?.title).toContain('Bikash');
  });

  it('refuses a second interest towards the same person', async () => {
    const sender = await createMember({ gender: 'MALE' });
    const receiver = await createMember();

    await request(app)
      .post('/api/interests')
      .set(auth(sender.token))
      .send({ receiverId: receiver.userId });
    const second = await request(app)
      .post('/api/interests')
      .set(auth(sender.token))
      .send({ receiverId: receiver.userId });

    expect(second.status).toBe(409);
  });

  it('treats a reciprocal interest as an acceptance rather than a mirror row', async () => {
    const a = await createMember({ gender: 'MALE' });
    const b = await createMember({ gender: 'FEMALE' });

    await request(app).post('/api/interests').set(auth(a.token)).send({ receiverId: b.userId });
    const reciprocal = await request(app)
      .post('/api/interests')
      .set(auth(b.token))
      .send({ receiverId: a.userId });

    expect(reciprocal.status).toBe(200);
    expect(reciprocal.body.matched).toBe(true);

    const interests = await prisma.interest.findMany();
    expect(interests).toHaveLength(1);
    expect(interests[0]?.status).toBe('ACCEPTED');
  });

  it('opens a conversation when an interest is accepted', async () => {
    const sender = await createMember({ gender: 'MALE' });
    const receiver = await createMember();

    const sent = await request(app)
      .post('/api/interests')
      .set(auth(sender.token))
      .send({ receiverId: receiver.userId });

    const accept = await request(app)
      .post(`/api/interests/${sent.body.interest.id}/accept`)
      .set(auth(receiver.token));

    expect(accept.status).toBe(200);
    expect(await prisma.conversation.count()).toBe(1);
  });

  it('only lets the receiver accept', async () => {
    const sender = await createMember({ gender: 'MALE' });
    const receiver = await createMember();
    const stranger = await createMember({ gender: 'MALE' });

    const sent = await request(app)
      .post('/api/interests')
      .set(auth(sender.token))
      .send({ receiverId: receiver.userId });

    const bySender = await request(app)
      .post(`/api/interests/${sent.body.interest.id}/accept`)
      .set(auth(sender.token));
    const byStranger = await request(app)
      .post(`/api/interests/${sent.body.interest.id}/accept`)
      .set(auth(stranger.token));

    expect(bySender.status).toBe(404);
    expect(byStranger.status).toBe(404);
  });

  it('lets a withdrawn interest be sent again', async () => {
    const sender = await createMember({ gender: 'MALE' });
    const receiver = await createMember();

    const sent = await request(app)
      .post('/api/interests')
      .set(auth(sender.token))
      .send({ receiverId: receiver.userId });
    await request(app)
      .post(`/api/interests/${sent.body.interest.id}/withdraw`)
      .set(auth(sender.token));

    const again = await request(app)
      .post('/api/interests')
      .set(auth(sender.token))
      .send({ receiverId: receiver.userId });

    expect(again.status).toBe(200);
    expect(again.body.interest.status).toBe('PENDING');
  });

  it('rejects an interest in yourself', async () => {
    const member = await createMember();
    const res = await request(app)
      .post('/api/interests')
      .set(auth(member.token))
      .send({ receiverId: member.userId });

    expect(res.status).toBe(400);
  });
});

describe('messaging', () => {
  beforeEach(resetDatabase);

  async function connect() {
    const a = await createMember({ gender: 'MALE', displayName: 'Anil' });
    const b = await createMember({ gender: 'FEMALE', displayName: 'Sabina' });

    const sent = await request(app)
      .post('/api/interests')
      .set(auth(a.token))
      .send({ receiverId: b.userId });
    await request(app)
      .post(`/api/interests/${sent.body.interest.id}/accept`)
      .set(auth(b.token));

    const conversation = await prisma.conversation.findFirstOrThrow();
    return { a, b, conversationId: conversation.id };
  }

  it('refuses to open a conversation without a mutual connection', async () => {
    const a = await createMember({ gender: 'MALE' });
    const b = await createMember();

    const res = await request(app)
      .post('/api/conversations')
      .set(auth(a.token))
      .send({ userId: b.userId });

    expect(res.status).toBe(403);
  });

  it('lets connected members message each other', async () => {
    const { a, b, conversationId } = await connect();

    const sent = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(a.token))
      .send({ body: 'How was your week?' });
    expect(sent.status).toBe(201);

    const read = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(b.token));

    expect(read.status).toBe(200);
    expect(read.body.messages).toHaveLength(1);
    expect(read.body.messages[0].body).toBe('How was your week?');
    expect(read.body.messages[0].mine).toBe(false);
  });

  it('hides a conversation from anyone who is not in it', async () => {
    const { conversationId } = await connect();
    const outsider = await createMember({ gender: 'MALE' });

    const read = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(outsider.token));
    const write = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(outsider.token))
      .send({ body: 'Hello?' });

    expect(read.status).toBe(404);
    expect(write.status).toBe(404);
  });

  it('rejects an empty message', async () => {
    const { a, conversationId } = await connect();
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(a.token))
      .send({ body: '   ' });

    expect(res.status).toBe(400);
  });

  it('stops messages once the conversation is closed', async () => {
    const { a, b, conversationId } = await connect();
    await request(app).post(`/api/conversations/${conversationId}/close`).set(auth(b.token));

    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(a.token))
      .send({ body: 'Still there?' });

    expect(res.status).toBe(403);
  });

  it('counts unread messages for the recipient only', async () => {
    const { a, b, conversationId } = await connect();

    await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(a.token))
      .send({ body: 'One' });
    await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(a.token))
      .send({ body: 'Two' });

    const forB = await request(app).get('/api/unread-count').set(auth(b.token));
    const forA = await request(app).get('/api/unread-count').set(auth(a.token));

    expect(forB.body.unread).toBe(2);
    expect(forA.body.unread).toBe(0);
  });
});

describe('blocking', () => {
  beforeEach(resetDatabase);

  it('hides both members from each other and closes anything open', async () => {
    const a = await createMember({ gender: 'MALE' });
    const b = await createMember();

    const sent = await request(app)
      .post('/api/interests')
      .set(auth(a.token))
      .send({ receiverId: b.userId });
    await request(app)
      .post(`/api/interests/${sent.body.interest.id}/accept`)
      .set(auth(b.token));

    const block = await request(app)
      .post('/api/blocks')
      .set(auth(b.token))
      .send({ userId: a.userId, reason: 'Not comfortable' });
    expect(block.status).toBe(201);

    // Neither can open the other's profile.
    expect((await request(app).get(`/api/profiles/${a.userId}`).set(auth(b.token))).status).toBe(404);
    expect((await request(app).get(`/api/profiles/${b.userId}`).set(auth(a.token))).status).toBe(404);

    const conversation = await prisma.conversation.findFirstOrThrow();
    expect(conversation.closedAt).not.toBeNull();
  });

  it('keeps a blocked member out of search results', async () => {
    const searcher = await createMember({ gender: 'MALE', ukRegion: 'hampshire' });
    const blocked = await createMember({ gender: 'FEMALE', ukRegion: 'hampshire' });

    const before = await request(app).get('/api/discovery/search').set(auth(searcher.token));
    expect(before.body.results.some((r: { userId: string }) => r.userId === blocked.userId)).toBe(true);

    await request(app).post('/api/blocks').set(auth(searcher.token)).send({ userId: blocked.userId });

    const after = await request(app).get('/api/discovery/search').set(auth(searcher.token));
    expect(after.body.results.some((r: { userId: string }) => r.userId === blocked.userId)).toBe(false);
  });

  it('can be undone', async () => {
    const a = await createMember({ gender: 'MALE' });
    const b = await createMember();

    await request(app).post('/api/blocks').set(auth(a.token)).send({ userId: b.userId });
    const removed = await request(app).delete(`/api/blocks/${b.userId}`).set(auth(a.token));

    expect(removed.status).toBe(200);
    expect((await request(app).get(`/api/profiles/${b.userId}`).set(auth(a.token))).status).toBe(200);
  });
});

describe('shortlist', () => {
  beforeEach(resetDatabase);

  it('adds, lists and removes', async () => {
    const owner = await createMember({ gender: 'MALE' });
    const target = await createMember();

    await request(app)
      .post('/api/shortlist')
      .set(auth(owner.token))
      .send({ userId: target.userId, note: 'Come back to this one' });

    const list = await request(app).get('/api/shortlist').set(auth(owner.token));
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].note).toBe('Come back to this one');

    await request(app).delete(`/api/shortlist/${target.userId}`).set(auth(owner.token));
    const after = await request(app).get('/api/shortlist').set(auth(owner.token));
    expect(after.body.items).toHaveLength(0);
  });
});
