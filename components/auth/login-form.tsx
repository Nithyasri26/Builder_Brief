'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Field, Input, Spinner } from '@/components/ui';
import { OtpNotice } from './otp-notice';
import type { OtpStartResponse } from '@/types/auth';

type Stage = 'login' | 'forgot-request' | 'forgot-reset';

export function LoginForm({ next }: { next?: string }) {
  const [stage, setStage] = useState<Stage>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<OtpStartResponse | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redirectTo = next && next.startsWith('/') ? next : '/';

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
    return data;
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await post('/api/auth/login', { identifier, password });
      window.location.href = data.redirect ?? redirectTo;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  async function sendResetCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = (await post('/api/auth/forgot/start', { identifier })) as OtpStartResponse;
      setChallenge(data);
      setStage('forgot-reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword))
      return setError('Choose a password of at least 8 characters, with letters and numbers.');
    if (newPassword !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      const data = await post('/api/auth/forgot/reset', {
        challengeId: challenge.challengeId,
        emailCode: code,
        newPassword,
      });
      window.location.href = data.redirect ?? redirectTo;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  async function tryDemo() {
    setBusy(true);
    setError(null);
    try {
      const data = await post('/api/auth/demo', {});
      window.location.href = data.redirect ?? '/';
    } catch {
      setError('Could not start the demo.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {stage === 'login' && (
        <form onSubmit={login} className="space-y-4">
          <Field label="Mobile number or email" htmlFor="identifier">
            <Input
              id="identifier"
              autoComplete="username"
              placeholder="98765 43210 or you@email.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error ? <p className="text-sm text-stop">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : <>Log in <ArrowRight className="size-4" /></>}
          </Button>
          <button
            type="button"
            className="text-sm text-accent hover:underline"
            onClick={() => {
              setStage('forgot-request');
              setError(null);
            }}
          >
            Forgot your password?
          </button>
        </form>
      )}

      {stage === 'forgot-request' && (
        <form onSubmit={sendResetCode} className="space-y-4">
          <p className="text-sm text-ink-muted">
            Enter your registered mobile or email and we&apos;ll send a code to your email to reset your
            password.
          </p>
          <Field label="Mobile number or email" htmlFor="reset-id">
            <Input
              id="reset-id"
              autoComplete="username"
              placeholder="98765 43210 or you@email.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </Field>
          {error ? <p className="text-sm text-stop">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : 'Send reset code'}
          </Button>
          <button
            type="button"
            className="text-sm text-ink-muted hover:text-ink"
            onClick={() => {
              setStage('login');
              setError(null);
            }}
          >
            ← Back to log in
          </button>
        </form>
      )}

      {stage === 'forgot-reset' && challenge && (
        <form onSubmit={resetPassword} className="space-y-4">
          <OtpNotice channel="email" masked={challenge.maskedEmail} demoCode={challenge.demoCodes?.email} />
          <Field label="Code from your email" htmlFor="reset-code">
            <Input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              className="tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </Field>
          <Field label="New password" htmlFor="new-password" hint="At least 8 characters, with letters and numbers.">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
          {error ? <p className="text-sm text-stop">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 6}>
            {busy ? <Spinner /> : 'Set new password and log in'}
          </Button>
          <button
            type="button"
            className="text-sm text-ink-muted hover:text-ink"
            onClick={() => {
              setStage('login');
              setError(null);
            }}
          >
            ← Back to log in
          </button>
        </form>
      )}

      <div className="relative">
        <span className="absolute inset-x-0 top-1/2 -z-10 h-px bg-line" />
        <span className="mx-auto block w-fit bg-canvas px-3 text-xs uppercase tracking-wide text-ink-subtle">
          or
        </span>
      </div>

      <Button type="button" variant="secondary" size="lg" className="w-full" onClick={tryDemo} disabled={busy}>
        Explore the demo as a sample citizen
      </Button>
    </div>
  );
}
