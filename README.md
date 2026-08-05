# Tamu Sansar

A matrimony and dating platform for the Gurung (Tamu) community in the United
Kingdom. Full-stack: an Express + TypeScript API over Prisma/SQLite, and a
React + Vite frontend.

The community is spread thinly across Britain — Aldershot, Farnborough,
Folkestone, Ashford, Salisbury, Tidworth, Reading, London, Manchester, Cardiff
and beyond — largely along the trail of the Brigade of Gurkhas' garrison towns.
General dating apps have never heard of a thar, and the large matrimony sites
treat every South Asian community as one. This one is built around the specifics.

---

## Running it

Requires Node 20 or newer. Nothing else — the database is a SQLite file.

```bash
npm install          # installs both workspaces
npm run setup        # generates the Prisma client, creates the DB, seeds it
npm run dev          # API on :4000, web on :5173
```

Then open <http://localhost:5173>.

The seed creates 16 fictional members plus staff accounts. Every one uses the
password `Password123`:

| Account                     | Role      |
| --------------------------- | --------- |
| `sunita.gurung@example.com` | member    |
| `bikash.gurung@example.com` | member    |
| `moderator@tamusansar.uk`   | moderator |
| `admin@tamusansar.uk`       | admin     |

Other useful commands:

```bash
npm test                              # 71 server tests
npm run build                         # typecheck + build both workspaces
npm run db:reset --workspace=server   # wipe and re-seed
```

Configuration lives in `server/.env` — copy `server/.env.example` to start.
In development, photos are auto-approved and email confirmation is skipped;
both should be switched off in production, and `JWT_SECRET` must be set (the
server refuses to boot in production with the default).

---

## What it does

**Accounts** — registration with an 18+ check, sign-in, password reset, and a
list of signed-in devices a member can revoke individually. Access tokens are
short-lived and held in memory; refresh tokens are httpOnly, rotated on use, and
only ever stored as a hash.

**Profiles** — around fifty fields spanning heritage, life in the UK, education
and work, lifestyle, family and free text. Completeness is scored 0–100 and
weighted towards what actually helps a reader (a photo and a few real sentences
count for far more than another dropdown), with specific suggestions for what to
add next.

**Discovery** — filter by age, region, distance, thar, clan grouping, ancestral
district, faith, education, diet, marital status, heritage, verification and
service-family background; free-text search across headline, work and interests.
Results are ranked by compatibility, with saved preferences applied as a
starting point on request.

**Connections** — express interest, optionally with a note. Accepting opens the
one conversation for that pair. Declining is quiet: the sender is only told
their interest was answered.

**Messaging** — gated behind a mutual accepted interest, with read receipts,
unread counts, soft deletion and the ability to close a thread.

**Photos** — up to eight per member, each with its own visibility
(everyone / members / connections only), a moderation queue, and per-photo
ordering.

**Safety** — blocking (symmetric and immediate: it withdraws pending interests
and closes the conversation), reporting, and a moderation console with a photo
queue, report handling, ID verification and account suspension.

---

## Two decisions worth explaining

### Clan is advisory, never a gate

Many Gurung families expect their children to marry outside their own thar, and
some watch the maternal line too. Practice varies between valleys and between
families, and it is not the software's place to decide.

So `sharedClanAdvisory` returns advice, not a verdict. When two profiles share a
paternal or maternal clan line, the profile says so in plain language and the
member decides. They can ask for those profiles to be excluded from search, or
for the scoring to ignore clan entirely — both directions are one checkbox.

The clan list itself (`server/src/domain/gurung.ts`) is deliberately data rather
than logic. It carries the Char Jat and Sohra Jat groupings with alternate
romanisations attached, so a search finds a clan whichever spelling someone grew
up with, and `Other / not listed` is always available. **It should be reviewed
with community elders before any real launch** — the file says so, and nothing in
the code depends on its contents being final.

Heritage is a separate field from thar for a related reason. An earlier version
inferred "is this member Gurung?" from whether they had entered a clan, which
quietly hid every member who simply had not finished their profile yet. Stating
heritage outright fixes that, and lets the site stay open to the wider Nepali
community and to partners from outside it.

### Silence is not a mismatch

`computeCompatibility` is symmetric — your score for someone equals theirs for
you, because a match that only works one way is not a match.

More importantly, any factor neither side has answered is **skipped**, not scored
as zero. A member who has not filled in their diet is not penalised for it; the
factor drops out of the weighted mean, and a separate `coverage` figure tells the
UI how much of the score rests on real answers. Every profile shows the full
breakdown, so a score is never just a number a member has to take on trust.

Hard filters live in the query layer (`buildDiscoveryWhere`), never in scoring.
Scoring ranks candidates that already passed the filters; it never silently
excludes anyone.

---

## Layout

```
server/
  prisma/schema.prisma      data model (SQLite; enums are validated in app code)
  prisma/seed.ts            16 fictional members, interests and conversations
  src/domain/               clans, districts, regions, vocabularies, scoring
  src/routes/               auth, profiles, discovery, interests, messages,
                            photos, safety, notifications, reference, admin
  src/middleware/           auth, validation, rate limiting, error handling
  tests/                    71 tests
web/
  src/lib/                  API client, auth context, reference data, formatting
  src/components/           layout, profile card, UI primitives
  src/pages/                18 routes
```

### Notes on the schema

SQLite has no enum or array types, so enum-like columns are `String` validated at
the edge by zod schemas in `src/domain/vocab.ts`, and list columns hold JSON read
through `src/lib/json.ts`. Those same constants are served to the frontend from
`/api/reference`, so a dropdown cannot offer a value the API would reject. Moving
to Postgres means changing the datasource and promoting those columns; nothing
else depends on it.

---

## Security

- Passwords are bcrypt-hashed (cost 12). Sign-in returns an identical error for
  an unknown address and a wrong password, and password reset responds
  identically whether or not the address exists — neither can enumerate accounts.
- Refresh tokens rotate on every use and are stored only as SHA-256 hashes.
  Rotation has a 30-second grace window so two tabs refreshing at once do not
  sign each other out, and a token presented long after it was retired is treated
  as a replay: every session for that account is ended.
- Uploaded images are re-encoded rather than stored as sent. That normalises the
  format and strips EXIF — including the GPS coordinates a phone photo carries.
- Only the outward part of a postcode is ever collected or shown.
- Email addresses and dates of birth are never included in another member's view
  of a profile; only age is.
- Rate limits are applied globally and tightened on auth, messaging and uploads.
- Hidden or blocked profiles return 404 rather than 403 — a 403 would confirm the
  account exists, which is exactly what someone who has just been blocked should
  not learn.

## Not built

Email delivery is stubbed: verification and reset tokens are returned in the API
response outside production so the flows are testable end to end. Real-time
messaging uses short polling rather than websockets. Payments, video calls and
horoscope matching are not implemented.
