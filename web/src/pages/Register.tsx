import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, Field, Input, Select, cx } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { groupOptions, useReference } from '../lib/reference';

/** The oldest date of birth that still means "18 or over" today. */
function maxDateOfBirth(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { data: reference } = useReference();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    displayName: '',
    gender: '',
    dateOfBirth: '',
    clan: '',
    ukRegion: '',
    email: '',
    password: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const stepOneComplete = form.displayName.trim().length >= 2 && form.gender && form.dateOfBirth;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
        gender: form.gender,
        dateOfBirth: new Date(form.dateOfBirth).toISOString(),
        ...(form.clan ? { clan: form.clan } : {}),
        ...(form.ukRegion ? { ukRegion: form.ukRegion } : {}),
        acceptedTerms: true,
      });
      // Straight into the profile editor — an empty profile helps nobody.
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Something went wrong.'));
      setSubmitting(false);
    }
  };

  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : undefined;

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <h1 className="text-center font-display text-3xl font-bold">Create your profile</h1>
      <p className="mt-2 text-center text-ink-500">
        Two short steps. You can fill in the rest whenever you like.
      </p>

      {/* Step indicator */}
      <ol className="mt-8 flex items-center justify-center gap-3" aria-label="Progress">
        {[1, 2].map((n) => (
          <li key={n} className="flex items-center gap-3">
            <span
              className={cx(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                step >= n ? 'bg-crimson-700 text-white' : 'bg-paper-200 text-ink-400',
              )}
              aria-current={step === n ? 'step' : undefined}
            >
              {n}
            </span>
            {n === 1 && <span className="h-px w-10 bg-paper-300" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
        {error && (
          <Alert tone="error">
            {error.message}
            {error instanceof ApiError && error.details && error.details.length > 0 && (
              <ul className="mt-2 list-inside list-disc">
                {error.details.map((d) => (
                  <li key={`${d.field}-${d.message}`}>{d.message}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {step === 1 ? (
          <>
            <Field
              label="What should we call you?"
              htmlFor="displayName"
              required
              hint="A first name is fine. Your surname is never shown."
              error={fieldError('displayName')}
            >
              <Input
                id="displayName"
                required
                minLength={2}
                maxLength={60}
                value={form.displayName}
                onChange={(e) => set('displayName')(e.target.value)}
                placeholder="Sunita"
              />
            </Field>

            <Field label="I am" htmlFor="gender" required error={fieldError('gender')}>
              <Select
                id="gender"
                required
                value={form.gender}
                onChange={(e) => set('gender')(e.target.value)}
                options={reference?.genders ?? []}
                placeholder="Select…"
              />
            </Field>

            <Field
              label="Date of birth"
              htmlFor="dateOfBirth"
              required
              hint="Members must be 18 or over. We show your age, never your date of birth."
              error={fieldError('dateOfBirth')}
            >
              <Input
                id="dateOfBirth"
                type="date"
                required
                max={maxDateOfBirth()}
                value={form.dateOfBirth}
                onChange={(e) => set('dateOfBirth')(e.target.value)}
              />
            </Field>

            <Button
              type="button"
              fullWidth
              size="lg"
              disabled={!stepOneComplete}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </>
        ) : (
          <>
            <Field
              label="Your thar (clan)"
              htmlFor="clan"
              hint="Optional, and you can change it later. It powers clan-aware matching."
            >
              <select
                id="clan"
                className="input"
                value={form.clan}
                onChange={(e) => set('clan')(e.target.value)}
              >
                <option value="">Prefer to add this later</option>
                {groupOptions(reference?.clans ?? []).map(([group, options]) => (
                  <optgroup key={group} label={group}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                        {o.aka && o.aka.length > 0 ? ` (${o.aka.join(', ')})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <Field label="Where in the UK do you live?" htmlFor="ukRegion">
              <select
                id="ukRegion"
                className="input"
                value={form.ukRegion}
                onChange={(e) => set('ukRegion')(e.target.value)}
              >
                <option value="">Prefer to add this later</option>
                {groupOptions(reference?.ukRegions ?? []).map(([nation, options]) => (
                  <optgroup key={nation} label={nation}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <Field label="Email address" htmlFor="email" required error={fieldError('email')}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => set('email')(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              required
              hint="At least 10 characters, with a letter and a number."
              error={fieldError('password')}
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={form.password}
                onChange={(e) => set('password')(e.target.value)}
              />
            </Field>

            <Checkbox
              checked={acceptedTerms}
              onChange={setAcceptedTerms}
              label="I am 18 or over and accept the community guidelines"
              hint="Be honest, be respectful, and never send money to anyone you meet here."
            />

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={submitting}
                disabled={!acceptedTerms}
              >
                Create my profile
              </Button>
            </div>
          </>
        )}

        <p className="text-center text-sm text-ink-500">
          Already a member?{' '}
          <Link to="/login" className="font-medium text-crimson-700 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
