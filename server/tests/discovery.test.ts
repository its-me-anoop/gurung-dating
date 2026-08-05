import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createMember, resetDatabase, type TestMember } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

/** Fills in the fields discovery filters on, straight through the API. */
async function setProfile(member: TestMember, patch: Record<string, unknown>) {
  const res = await request(app).patch('/api/profiles/me').set(auth(member.token)).send(patch);
  if (res.status !== 200) {
    throw new Error(`Profile update failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.profile;
}

describe('search', () => {
  beforeEach(resetDatabase);

  it('shows the opposite gender by default', async () => {
    const man = await createMember({ gender: 'MALE' });
    const woman = await createMember({ gender: 'FEMALE' });
    const anotherMan = await createMember({ gender: 'MALE' });

    const res = await request(app).get('/api/discovery/search').set(auth(man.token));
    const ids = res.body.results.map((r: { userId: string }) => r.userId);

    expect(ids).toContain(woman.userId);
    expect(ids).not.toContain(anotherMan.userId);
    expect(ids).not.toContain(man.userId);
  });

  it('honours an explicit gender filter', async () => {
    const searcher = await createMember({ gender: 'MALE' });
    const otherMan = await createMember({ gender: 'MALE' });

    const res = await request(app)
      .get('/api/discovery/search?gender=MALE')
      .set(auth(searcher.token));

    expect(res.body.results.map((r: { userId: string }) => r.userId)).toContain(otherMan.userId);
  });

  it('filters by region', async () => {
    const searcher = await createMember({ gender: 'MALE' });
    const hampshire = await createMember({ gender: 'FEMALE', ukRegion: 'hampshire' });
    const scotland = await createMember({ gender: 'FEMALE', ukRegion: 'central-scotland' });

    const res = await request(app)
      .get('/api/discovery/search?regions=hampshire')
      .set(auth(searcher.token));
    const ids = res.body.results.map((r: { userId: string }) => r.userId);

    expect(ids).toContain(hampshire.userId);
    expect(ids).not.toContain(scotland.userId);
  });

  it('filters by age range', async () => {
    const searcher = await createMember({ gender: 'MALE' });
    const young = await createMember({ gender: 'FEMALE', age: 23 });
    const older = await createMember({ gender: 'FEMALE', age: 45 });

    const res = await request(app)
      .get('/api/discovery/search?ageMin=20&ageMax=30')
      .set(auth(searcher.token));
    const ids = res.body.results.map((r: { userId: string }) => r.userId);

    expect(ids).toContain(young.userId);
    expect(ids).not.toContain(older.userId);
  });

  it('filters by clan', async () => {
    const searcher = await createMember({ gender: 'MALE' });
    const ghale = await createMember({ gender: 'FEMALE', clan: 'ghale' });
    const toju = await createMember({ gender: 'FEMALE', clan: 'toju' });

    const res = await request(app)
      .get('/api/discovery/search?clans=ghale')
      .set(auth(searcher.token));
    const ids = res.body.results.map((r: { userId: string }) => r.userId);

    expect(ids).toContain(ghale.userId);
    expect(ids).not.toContain(toju.userId);
  });

  it('ignores a clan slug that does not exist instead of returning nothing', async () => {
    const searcher = await createMember({ gender: 'MALE' });
    await createMember({ gender: 'FEMALE', clan: 'ghale' });

    const res = await request(app)
      .get('/api/discovery/search?clans=not-a-real-clan')
      .set(auth(searcher.token));

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  it('filters on stated heritage, not on whether a thar has been entered', async () => {
    const searcher = await createMember({ gender: 'MALE' });

    // Gurung, but has not got round to filling in their thar.
    const unfinished = await createMember({ gender: 'FEMALE' });
    const partGurung = await createMember({ gender: 'FEMALE' });
    await setProfile(partGurung, { heritage: 'PART_GURUNG' });
    const notNepali = await createMember({ gender: 'FEMALE' });
    await setProfile(notNepali, { heritage: 'NOT_NEPALI' });

    await request(app)
      .put('/api/profiles/me/preferences')
      .set(auth(searcher.token))
      .send({ gurungHeritageOnly: true });

    const res = await request(app)
      .get('/api/discovery/search?usePreferences=true')
      .set(auth(searcher.token));
    const ids = res.body.results.map((r: { userId: string }) => r.userId);

    expect(ids).toContain(unfinished.userId);
    expect(ids).toContain(partGurung.userId);
    expect(ids).not.toContain(notNepali.userId);
  });

  it('searches free text across headline, work and interests', async () => {
    const searcher = await createMember({ gender: 'MALE' });
    const nurse = await createMember({ gender: 'FEMALE' });
    const designer = await createMember({ gender: 'FEMALE' });

    await setProfile(nurse, { occupation: 'Staff nurse, NHS' });
    await setProfile(designer, { occupation: 'Graphic designer' });

    const res = await request(app).get('/api/discovery/search?q=nurse').set(auth(searcher.token));
    const ids = res.body.results.map((r: { userId: string }) => r.userId);

    expect(ids).toContain(nurse.userId);
    expect(ids).not.toContain(designer.userId);
  });

  it('excludes members who are not active', async () => {
    const searcher = await createMember({ gender: 'MALE' });
    const suspended = await createMember({ gender: 'FEMALE' });
    await prisma.user.update({ where: { id: suspended.userId }, data: { status: 'SUSPENDED' } });

    const res = await request(app).get('/api/discovery/search').set(auth(searcher.token));
    expect(res.body.results.map((r: { userId: string }) => r.userId)).not.toContain(
      suspended.userId,
    );
  });

  it('excludes members who set their profile to connections only', async () => {
    const searcher = await createMember({ gender: 'MALE' });
    const private_ = await createMember({ gender: 'FEMALE' });
    await setProfile(private_, { visibility: 'CONNECTIONS_ONLY' });

    const res = await request(app).get('/api/discovery/search').set(auth(searcher.token));
    expect(res.body.results.map((r: { userId: string }) => r.userId)).not.toContain(private_.userId);
  });

  it('sorts by compatibility, highest first', async () => {
    const searcher = await createMember({ gender: 'MALE', ukRegion: 'hampshire' });
    await setProfile(searcher, {
      religion: 'BUDDHIST',
      interests: ['hiking', 'cooking', 'travel'],
      intent: 'MARRIAGE',
    });

    const near = await createMember({ gender: 'FEMALE', ukRegion: 'hampshire' });
    await setProfile(near, {
      religion: 'BUDDHIST',
      interests: ['hiking', 'cooking', 'travel'],
      intent: 'MARRIAGE',
    });

    const far = await createMember({ gender: 'FEMALE', ukRegion: 'north-scotland' });
    await setProfile(far, {
      religion: 'CHRISTIAN',
      interests: ['darts'],
      intent: 'FRIENDSHIP_FIRST',
    });

    const res = await request(app)
      .get('/api/discovery/search?sort=compatibility')
      .set(auth(searcher.token));

    const scores = res.body.results.map((r: { compatibility: number }) => r.compatibility);
    expect(scores).toEqual([...scores].sort((a: number, b: number) => b - a));
    expect(res.body.results[0].userId).toBe(near.userId);
    expect(res.body.results.at(-1).userId).toBe(far.userId);
  });

  it('paginates', async () => {
    const searcher = await createMember({ gender: 'MALE' });
    for (let i = 0; i < 5; i += 1) await createMember({ gender: 'FEMALE' });

    const first = await request(app)
      .get('/api/discovery/search?perPage=2&page=1')
      .set(auth(searcher.token));
    const second = await request(app)
      .get('/api/discovery/search?perPage=2&page=2')
      .set(auth(searcher.token));

    expect(first.body.results).toHaveLength(2);
    expect(second.body.results).toHaveLength(2);
    expect(first.body.total).toBe(5);
    expect(first.body.totalPages).toBe(3);

    const firstIds = first.body.results.map((r: { userId: string }) => r.userId);
    const secondIds = second.body.results.map((r: { userId: string }) => r.userId);
    expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
  });

  it('needs a signed-in member', async () => {
    const res = await request(app).get('/api/discovery/search');
    expect(res.status).toBe(401);
  });
});

describe('recommendations', () => {
  beforeEach(resetDatabase);

  it('leaves out anyone already dealt with', async () => {
    const me = await createMember({ gender: 'MALE' });
    const fresh = await createMember({ gender: 'FEMALE' });
    const alreadyContacted = await createMember({ gender: 'FEMALE' });

    await request(app)
      .post('/api/interests')
      .set(auth(me.token))
      .send({ receiverId: alreadyContacted.userId });

    const res = await request(app).get('/api/discovery/recommendations').set(auth(me.token));
    const ids = res.body.recommendations.map((r: { userId: string }) => r.userId);

    expect(ids).toContain(fresh.userId);
    expect(ids).not.toContain(alreadyContacted.userId);
  });

  it('respects the limit', async () => {
    const me = await createMember({ gender: 'MALE' });
    for (let i = 0; i < 6; i += 1) await createMember({ gender: 'FEMALE' });

    const res = await request(app)
      .get('/api/discovery/recommendations?limit=3')
      .set(auth(me.token));

    expect(res.body.recommendations).toHaveLength(3);
  });
});

describe('profile visibility', () => {
  beforeEach(resetDatabase);

  it('returns compatibility and the clan advisory to a signed-in viewer', async () => {
    const viewer = await createMember({ gender: 'MALE', clan: 'ghale' });
    const target = await createMember({ gender: 'FEMALE', clan: 'ghale' });

    const res = await request(app).get(`/api/profiles/${target.userId}`).set(auth(viewer.token));

    expect(res.status).toBe(200);
    expect(res.body.compatibility.score).toBeGreaterThanOrEqual(0);
    expect(res.body.advisory.shared).toBe(true);
    expect(res.body.advisory.kind).toBe('PATERNAL');
  });

  it('records the view for the person who was looked at', async () => {
    const viewer = await createMember({ gender: 'MALE' });
    const target = await createMember({ gender: 'FEMALE' });

    await request(app).get(`/api/profiles/${target.userId}`).set(auth(viewer.token));

    const viewers = await request(app).get('/api/profiles/me/viewers').set(auth(target.token));
    expect(viewers.body.viewers).toHaveLength(1);
    expect(viewers.body.viewers[0].profile.userId).toBe(viewer.userId);
  });

  it('turns a signed-out visitor away from a members-only profile', async () => {
    const member = await createMember();
    const res = await request(app).get(`/api/profiles/${member.userId}`);
    expect(res.status).toBe(403);
  });

  it('never exposes the email address on a public profile', async () => {
    const viewer = await createMember({ gender: 'MALE' });
    const target = await createMember({ gender: 'FEMALE' });

    const res = await request(app).get(`/api/profiles/${target.userId}`).set(auth(viewer.token));
    expect(JSON.stringify(res.body)).not.toContain(target.email);
  });
});

describe('profile editing', () => {
  beforeEach(resetDatabase);

  it('recomputes completeness as the profile fills up', async () => {
    const member = await createMember();

    const before = await request(app).get('/api/profiles/me').set(auth(member.token));
    const start = before.body.profile.completeness;

    await setProfile(member, {
      about: 'A'.repeat(200),
      headline: 'Something reasonably descriptive',
      lookingFor: 'B'.repeat(100),
      interests: ['hiking', 'cooking', 'reading'],
      clan: 'ghale',
      ukRegion: 'hampshire',
      city: 'Aldershot',
      occupation: 'Nurse',
      education: 'BACHELORS',
    });

    const after = await request(app).get('/api/profiles/me').set(auth(member.token));
    expect(after.body.profile.completeness).toBeGreaterThan(start);
  });

  it('derives the clan group rather than trusting the client', async () => {
    const member = await createMember();
    await setProfile(member, { clan: 'kromchhe' });

    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: member.userId } });
    expect(profile.clanGroup).toBe('SOHRA_JAT');
  });

  it('rejects an invalid postcode area', async () => {
    const member = await createMember();
    const res = await request(app)
      .patch('/api/profiles/me')
      .set(auth(member.token))
      .send({ postcodeArea: 'SW19 3AB' });

    expect(res.status).toBe(400);
  });

  it('rejects a preference range that is the wrong way round', async () => {
    const member = await createMember();
    const res = await request(app)
      .put('/api/profiles/me/preferences')
      .set(auth(member.token))
      .send({ ageMin: 40, ageMax: 25 });

    expect(res.status).toBe(400);
  });

  it('saves preference lists and reads them back', async () => {
    const member = await createMember();
    const res = await request(app)
      .put('/api/profiles/me/preferences')
      .set(auth(member.token))
      .send({
        religions: ['BUDDHIST', 'HINDU'],
        ukRegions: ['hampshire', 'kent'],
        observeClanExogamy: false,
        maxDistanceMiles: 60,
      });

    expect(res.status).toBe(200);
    expect(res.body.preference.religions).toEqual(['BUDDHIST', 'HINDU']);
    expect(res.body.preference.ukRegions).toEqual(['hampshire', 'kent']);
    expect(res.body.preference.observeClanExogamy).toBe(false);
    expect(res.body.preference.maxDistanceMiles).toBe(60);
  });
});
