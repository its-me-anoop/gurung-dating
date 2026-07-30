import { Alert, LinkButton } from '../components/ui';

const GUIDELINES = [
  {
    title: 'Be who you say you are',
    body: 'Use recent photos of yourself, give your real age, and be straight about your situation — married, separated, children, visa status. People find out eventually, and finding out late is what causes real hurt.',
  },
  {
    title: 'Never send money',
    body: 'No genuine member will ask you for money, a bank transfer, gift cards or crypto, however convincing the reason. Anyone who does is running a scam. Report them and we will act the same day.',
  },
  {
    title: 'Keep it on the site at first',
    body: 'Our messaging is moderated and does not expose your phone number or email. Move to WhatsApp when you are comfortable, not because someone pressed you to.',
  },
  {
    title: 'Meet in public, tell someone',
    body: 'For a first meeting, choose somewhere busy, make your own way there and back, and tell a friend or family member where you are going and when you expect to be home.',
  },
  {
    title: 'Take your time',
    body: 'Anyone who rushes you — into meeting, into commitment, into sharing personal details — is telling you something about themselves. There is no prize for speed.',
  },
  {
    title: 'Guard your personal details',
    body: 'Do not share your full address, workplace, bank details or copies of documents. We only ever ask for your postcode area, never the full postcode.',
  },
];

export function Safety() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl font-bold">Staying safe</h1>
      <p className="mt-4 text-lg text-ink-600">
        Most people here are exactly who they say they are. These are the habits that protect you
        from the few who are not.
      </p>

      <div className="mt-8">
        <Alert tone="error" title="If someone asks you for money, stop">
          It does not matter how long you have been talking, how plausible the emergency sounds, or
          how much they promise to pay it back. Report the profile and tell us — you will not be the
          first person they have tried it on.
        </Alert>
      </div>

      <div className="mt-10 space-y-6">
        {GUIDELINES.map((guideline, index) => (
          <section key={guideline.title} className="card p-6">
            <div className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crimson-100 font-semibold text-crimson-800">
                {index + 1}
              </span>
              <div>
                <h2 className="text-lg font-semibold">{guideline.title}</h2>
                <p className="mt-2 leading-relaxed text-ink-600">{guideline.body}</p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="card mt-10 border-marigold-200 bg-marigold-50 p-6">
        <h2 className="font-display text-2xl font-bold">Reporting someone</h2>
        <p className="mt-3 leading-relaxed text-ink-700">
          Every profile has a <strong>Report</strong> button in the sidebar. Tell us what happened
          and a moderator will look at it. Reports are confidential — the member is never told who
          reported them.
        </p>
        <p className="mt-3 leading-relaxed text-ink-700">
          Blocking is separate and instant. Block someone and you disappear from each other's
          searches, profiles and messages straight away, with nothing sent to them.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">What we do at our end</h2>
        <ul className="mt-4 space-y-3 text-ink-600">
          {[
            'Every photo is reviewed by a moderator before other members see it.',
            'Uploaded images are re-saved, which strips the hidden data phones attach — including where the photo was taken.',
            'Nobody can message you until you have accepted their interest.',
            'Members who ask for ID verification get a badge, so you can filter to only those profiles.',
            'Suspended accounts are signed out of every device immediately.',
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span className="text-emerald-600" aria-hidden="true">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10">
        <LinkButton to="/register" size="lg">
          Create your profile
        </LinkButton>
      </div>
    </div>
  );
}
