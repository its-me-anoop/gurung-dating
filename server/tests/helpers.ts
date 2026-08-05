import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const app: Express = createApp();

export const PASSWORD = 'TestPassword1';

let counter = 0;

export interface TestMember {
  userId: string;
  email: string;
  token: string;
  displayName: string;
}

/** Registers a member and returns their id plus a ready-to-use access token. */
export async function createMember(
  overrides: Partial<{
    displayName: string;
    gender: 'MALE' | 'FEMALE';
    age: number;
    clan: string;
    ukRegion: string;
  }> = {},
): Promise<TestMember> {
  counter += 1;
  const email = `member${counter}-${Date.now()}@example.test`;
  const displayName = overrides.displayName ?? `Member ${counter}`;
  const age = overrides.age ?? 28;

  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - age);
  dob.setDate(dob.getDate() - 5);

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: PASSWORD,
      displayName,
      gender: overrides.gender ?? 'FEMALE',
      dateOfBirth: dob.toISOString(),
      ...(overrides.clan ? { clan: overrides.clan } : {}),
      ...(overrides.ukRegion ? { ukRegion: overrides.ukRegion } : {}),
      acceptedTerms: true,
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create member: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { userId: res.body.user.id, email, token: res.body.accessToken, displayName };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Wipes every row. Cascades from User cover most of it. */
export async function resetDatabase() {
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.profileView.deleteMany();
  await prisma.block.deleteMany();
  await prisma.shortlist.deleteMany();
  await prisma.interest.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.preference.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

/** Promotes a member to staff, for the admin endpoints. */
export async function makeAdmin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
}

/** A fresh token that reflects a role change made after registration. */
export async function reissueToken(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return res.body.accessToken;
}
