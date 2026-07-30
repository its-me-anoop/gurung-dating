import { Link } from 'react-router-dom';
import { LinkButton } from '../components/ui';

const FEATURES = [
  {
    icon: '🪢',
    title: 'Clan-aware matching',
    body: 'Tell us your thar and your maternal clan, and we will quietly flag when a match shares a clan line with you. It is an advisory note, never a block — your family, your decision.',
  },
  {
    icon: '🇬🇧',
    title: 'Built around the UK',
    body: 'Regions weighted towards Aldershot, Farnborough, Folkestone, Ashford, Reading and London, where most of the community actually lives. Distance filters that mean something.',
  },
  {
    icon: '✉️',
    title: 'No unsolicited messages',
    body: 'Nobody can write to you until you have accepted their interest. That single rule keeps the inbox usable, particularly for women.',
  },
  {
    icon: '🛡️',
    title: 'Moderated and verified',
    body: 'Photos are checked before they appear, ID verification earns a badge, and every profile can be blocked or reported in two taps.',
  },
  {
    icon: '📿',
    title: 'The details that matter',
    body: 'Ancestral district, Tamu Kyi fluency, whether yours is a service family, how your family sees things. The questions our parents would ask.',
  },
  {
    icon: '💬',
    title: 'Marriage or dating',
    body: 'Some are here for a traditional match, some for something slower. Say which, and we will match you with people looking for the same thing.',
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Create your profile',
    body: 'Takes about ten minutes. Add your thar, where you are in the UK, and a few honest sentences about yourself.',
  },
  {
    number: '2',
    title: 'See who fits',
    body: 'We score every profile against what you both said you are looking for, and show you why — not just a number.',
  },
  {
    number: '3',
    title: 'Express interest',
    body: 'If they accept, a conversation opens between you. If not, nothing happens and nobody is embarrassed.',
  },
];

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-linear-to-b from-crimson-50 via-paper-50 to-paper-50">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgba(240,181,46,0.18), transparent 45%), radial-gradient(circle at 85% 10%, rgba(198,42,88,0.14), transparent 40%)',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-crimson-800 shadow-sm ring-1 ring-crimson-100">
                <span aria-hidden="true">🏔️</span>
                For Gurungs (Tamu) across the United Kingdom
              </span>

              <h1 className="mt-6 font-display text-4xl leading-tight font-bold text-ink-900 sm:text-5xl lg:text-6xl">
                Meet someone who
                <span className="block text-crimson-800">already understands.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg text-ink-600">
                A matrimony and dating community for Gurungs living in Britain. Clan-aware,
                moderated by people from the community, and built so that the first message is
                always a welcome one.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton to="/register" size="lg">
                  Create your free profile
                </LinkButton>
                <LinkButton to="/login" variant="secondary" size="lg">
                  Sign in
                </LinkButton>
              </div>

              <p className="mt-5 text-sm text-ink-500">
                Free to join · No unsolicited messages · You control who sees your photos
              </p>
            </div>

            {/* Illustrative match card */}
            <div className="relative hidden lg:block">
              <div className="card mx-auto max-w-sm rotate-2 p-6 shadow-xl transition-transform hover:rotate-0">
                <div className="flex items-center gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-crimson-100 font-display text-xl font-bold text-crimson-800">
                    SG
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold">Sunita, 28</p>
                    <p className="text-sm text-ink-500">Aldershot · Staff nurse</p>
                  </div>
                  <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    92%
                  </span>
                </div>

                <div className="mt-5 space-y-2 border-t border-paper-200 pt-4 text-sm">
                  {[
                    'Different thars — as most families prefer',
                    'Both looking for marriage',
                    'Families 40 minutes apart',
                    'You both speak Tamu Kyi at home',
                  ].map((line) => (
                    <p key={line} className="flex gap-2 text-ink-600">
                      <span className="text-emerald-600" aria-hidden="true">
                        ✓
                      </span>
                      {line}
                    </p>
                  ))}
                </div>

                <p className="mt-4 rounded-lg bg-paper-100 px-3 py-2 text-xs text-ink-500">
                  Every match tells you <em>why</em> — never just a score.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Built for our community, not adapted for it
          </h2>
          <p className="mt-4 text-ink-600">
            General dating apps do not know what a thar is, and general matrimony sites treat every
            South Asian community as one. This one is ours.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card p-6">
              <span className="text-3xl" aria-hidden="true">
                {feature.icon}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">How it works</h2>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-crimson-700 font-display text-xl font-bold text-white">
                  {step.number}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Respectful note about clans */}
      <section className="mx-auto max-w-4xl px-4 py-20">
        <div className="card border-marigold-200 bg-marigold-50 p-8">
          <h2 className="font-display text-2xl font-bold">On thar and marrying out</h2>
          <p className="mt-4 leading-relaxed text-ink-700">
            Many Gurung families prefer that their children marry outside their own thar, and some
            pay attention to the maternal line as well. Practice varies from valley to valley and
            family to family, and it is not our place to decide for anyone.
          </p>
          <p className="mt-4 leading-relaxed text-ink-700">
            So we do the useful thing and stay out of the way: if two profiles share a clan line, we
            say so plainly on the profile, and you take it from there. You can also ask us to leave
            those profiles out of your search entirely — or to stop mentioning it. It is your call,
            both ways.
          </p>
          <p className="mt-4 text-sm text-ink-500">
            Our clan list covers the Char Jat and Sohra Jat groupings with common alternate
            spellings. If yours is missing or written differently where your family is from,{' '}
            <Link to="/about" className="font-medium text-crimson-700 underline">
              tell us and we will add it
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="bg-crimson-800 py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Your person might already be here
          </h2>
          <p className="mt-4 text-crimson-100">
            Members from Aldershot to Aberdeen. Free to join, and you can hide your profile whenever
            you like.
          </p>
          <div className="mt-8">
            <LinkButton to="/register" variant="marigold" size="lg">
              Create your profile
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
