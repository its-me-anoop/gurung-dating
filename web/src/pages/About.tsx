import { LinkButton } from '../components/ui';

export function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl font-bold">About Tamu Sansar</h1>

      <div className="mt-8 space-y-6 leading-relaxed text-ink-700">
        <p className="text-lg">
          Tamu Sansar is a matrimony and dating community for Gurungs living in the United Kingdom.
          It exists because the alternatives do not quite fit: general dating apps have never heard
          of a thar, and the big matrimony sites treat every South Asian community as one thing.
        </p>

        <h2 className="pt-4 font-display text-2xl font-bold">Why a site just for us</h2>
        <p>
          There are Gurung families settled all over Britain — around Aldershot and Farnborough,
          Folkestone and Ashford, Salisbury and Tidworth, Reading, London, Manchester, Cardiff and
          well beyond. Many arrived through generations of service with the Brigade of Gurkhas;
          many others came for study or work. What they have in common is a community that is
          spread thin across a large country, where the old ways of meeting someone — through
          family, through the village, through a Lhosar gathering — reach only so far.
        </p>
        <p>
          This is meant to extend that reach, not replace it. Parents and siblings are welcome to
          manage a profile on someone's behalf; there is a field that says so plainly, because it
          is common and there is nothing to hide about it.
        </p>

        <h2 className="pt-4 font-display text-2xl font-bold">On thar, and getting it wrong</h2>
        <p>
          Gurung clan names are recorded differently depending on who is writing them down and
          where their family is from. The same clan appears as Ghale or Kle; as Lamichhane, Lemgi or
          Lem; as Kromchhe, Kromche or Kromje. Whether a particular thar sits in the Char Jat or the
          Sohra Jat is not settled either, and honest sources disagree.
        </p>
        <p>
          So we have taken a clear position: our clan list is a starting point, not an authority. It
          carries alternate spellings so that searching works whichever version you grew up with,
          and "Other / not listed" is always there. If your thar is missing, or written in a way your
          family would not recognise, tell us and we will add it.
        </p>
        <p>
          The same restraint applies to marrying outside one's clan. Many families expect it, some
          watch the maternal line as well, and practice varies. We flag when two profiles share a
          clan line, say so in plain language on the profile, and stop there. You can ask us to
          leave those profiles out of your search, or to stop mentioning it at all. What we will not
          do is decide for you.
        </p>

        <h2 className="pt-4 font-display text-2xl font-bold">How matching works</h2>
        <p>
          Every profile you see carries a compatibility score, and every score can be opened up to
          show exactly what went into it. Two things are worth knowing about how it is calculated.
        </p>
        <p>
          It is symmetric: your score for someone is the same as their score for you, because a
          match that only works in one direction is not a match. And anything neither of you has
          filled in is left out of the calculation rather than counted as a mismatch — a blank field
          is not a red flag, it is just a blank field. The "based on X% of what you have both filled
          in" line under each score tells you how much of it rests on real answers.
        </p>

        <h2 className="pt-4 font-display text-2xl font-bold">Who runs it</h2>
        <p>
          Photos are reviewed before anyone else sees them. Members can ask to have their ID checked
          and earn a verified badge. Every profile can be blocked or reported in two taps, and
          reports go to moderators from the community, never to the person reported.
        </p>
        <p>
          Nobody can send you a message until you have accepted their interest. That single rule
          does more for the tone of a site like this than any amount of moderation after the fact.
        </p>
      </div>

      <div className="mt-10 flex gap-3">
        <LinkButton to="/register" size="lg">
          Create your profile
        </LinkButton>
        <LinkButton to="/safety" variant="secondary" size="lg">
          Safety guidelines
        </LinkButton>
      </div>
    </div>
  );
}
