import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createMember, PASSWORD, resetDatabase } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

function dobForAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setDate(d.getDate() - 3);
  return d.toISOString();
}

describe('registration', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  it('creates an account with a profile and a starting preference', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new.member@example.test',
      password: PASSWORD,
      displayName: 'Nabina',
      gender: 'FEMALE',
      dateOfBirth: dobForAge(27),
      acceptedTerms: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();

    const profile = await prisma.profile.findUnique({
      where: { userId: res.body.user.id },
      include: { preference: true },
    });
    expect(profile?.displayName).toBe('Nabina');
    expect(profile?.preference).toBeTruthy();
  });

  it('refuses anyone under 18', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'too.young@example.test',
      password: PASSWORD,
      displayName: 'Too Young',
      gender: 'MALE',
      dateOfBirth: dobForAge(16),
      acceptedTerms: true,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('at least 18');
  });

  it('refuses a weak password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'weak@example.test',
      password: 'short',
      displayName: 'Weak',
      gender: 'MALE',
      dateOfBirth: dobForAge(30),
      acceptedTerms: true,
    });

    expect(res.status).toBe(400);
  });

  it('refuses registration without accepting the terms', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'noterms@example.test',
      password: PASSWORD,
      displayName: 'No Terms',
      gender: 'MALE',
      dateOfBirth: dobForAge(30),
      acceptedTerms: false,
    });

    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email address', async () => {
    const payload = {
      email: 'duplicate@example.test',
      password: PASSWORD,
      displayName: 'First',
      gender: 'FEMALE' as const,
      dateOfBirth: dobForAge(30),
      acceptedTerms: true as const,
    };

    await request(app).post('/api/auth/register').send(payload);
    const second = await request(app).post('/api/auth/register').send(payload);

    expect(second.status).toBe(409);
  });
});

describe('sign in', () => {
  beforeEach(resetDatabase);

  it('returns a token for the right password', async () => {
    const member = await createMember();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('gives the same error for a wrong password and an unknown address', async () => {
    const member = await createMember();

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: 'CompletelyWrong1' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('refuses a suspended account', async () => {
    const member = await createMember();
    await prisma.user.update({ where: { id: member.userId }, data: { status: 'SUSPENDED' } });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('suspended');
  });

  it('brings a deactivated account back on sign in', async () => {
    const member = await createMember();
    await request(app).post('/api/profiles/me/deactivate').set(auth(member.token));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: PASSWORD });

    expect(res.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: member.userId } });
    expect(user?.status).toBe('ACTIVE');
  });
});

describe('tokens', () => {
  beforeEach(resetDatabase);

  it('rotates the refresh token, issuing a different one each time', async () => {
    const member = await createMember();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: PASSWORD });

    const cookie = login.headers['set-cookie'] as unknown as string[];
    const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();

    const rotated = refresh.headers['set-cookie'] as unknown as string[];
    expect(rotated).toBeTruthy();
    expect(rotated[0]).not.toBe(cookie[0]);

    // The old session row is retired and points at its replacement.
    const revoked = await prisma.session.findFirst({
      where: { userId: member.userId, revokedAt: { not: null } },
    });
    expect(revoked?.replacedById).toBeTruthy();
  });

  it('tolerates two refreshes racing on the same token', async () => {
    // Two tabs, or two requests that both hit an expired access token, will
    // send the same refresh cookie at once. Neither should be signed out.
    const member = await createMember();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: PASSWORD });
    const cookie = login.headers['set-cookie'];

    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    const second = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.accessToken).toBeTruthy();

    // Only the winner rotated the cookie; the straggler leaves it alone so the
    // browser keeps the one live token.
    expect(first.headers['set-cookie']).toBeTruthy();
    expect(second.headers['set-cookie']).toBeUndefined();
  });

  it('treats a long-retired token as a replay and ends every session', async () => {
    const member = await createMember();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: PASSWORD });
    const cookie = login.headers['set-cookie'];

    await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    // Push the revocation outside the grace window.
    await prisma.session.updateMany({
      where: { userId: member.userId, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 5 * 60_000) },
    });

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(replay.status).toBe(401);

    // Everything is torn down, so a stolen copy gets nothing either.
    const live = await prisma.session.findMany({
      where: { userId: member.userId, revokedAt: null },
    });
    expect(live).toHaveLength(0);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/profiles/me');
    expect(res.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const member = await createMember();
    const res = await request(app)
      .get('/api/profiles/me')
      .set(auth(`${member.token}tampered`));

    expect(res.status).toBe(401);
  });

  it('ends every session when the password is reset', async () => {
    const member = await createMember();
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: member.email });

    expect(forgot.status).toBe(200);
    const token = forgot.body.resetToken as string;
    expect(token).toBeTruthy();

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'BrandNewPass9' });
    expect(reset.status).toBe(200);

    const sessions = await prisma.session.findMany({
      where: { userId: member.userId, revokedAt: null },
    });
    expect(sessions).toHaveLength(0);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: 'BrandNewPass9' });
    expect(login.status).toBe(200);
  });

  it('does not reveal whether an address has an account', async () => {
    const known = await createMember();
    const a = await request(app).post('/api/auth/forgot-password').send({ email: known.email });
    const b = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'stranger@example.test' });

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.message).toBe(b.body.message);
  });
});
