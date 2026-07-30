import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Field, Input } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'We could not sign you in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-center font-display text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-center text-ink-500">Sign in to see who has been looking.</p>

      <form onSubmit={handleSubmit} className="card mt-8 space-y-5 p-6">
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Email address" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" htmlFor="password" required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button type="submit" fullWidth loading={submitting} size="lg">
          Sign in
        </Button>

        <p className="text-center text-sm text-ink-500">
          New here?{' '}
          <Link to="/register" className="font-medium text-crimson-700 hover:underline">
            Create a profile
          </Link>
        </p>
      </form>

      <div className="mt-6 rounded-xl border border-paper-300 bg-paper-100 p-4 text-sm text-ink-600">
        <p className="font-medium">Trying the demo?</p>
        <p className="mt-1">
          Sign in as <code className="rounded bg-white px-1.5 py-0.5">sunita.gurung@example.com</code>{' '}
          or <code className="rounded bg-white px-1.5 py-0.5">bikash.gurung@example.com</code> with
          the password <code className="rounded bg-white px-1.5 py-0.5">Password123</code>.
        </p>
      </div>
    </div>
  );
}
