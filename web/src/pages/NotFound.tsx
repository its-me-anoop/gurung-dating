import { LinkButton } from '../components/ui';

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <span className="text-6xl" aria-hidden="true">
        🏔️
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold">This page does not exist</h1>
      <p className="mt-3 text-ink-500">
        The link may be out of date, or the profile may no longer be available.
      </p>
      <div className="mt-8 flex gap-3">
        <LinkButton to="/">Go home</LinkButton>
        <LinkButton to="/browse" variant="secondary">
          Browse members
        </LinkButton>
      </div>
    </div>
  );
}
