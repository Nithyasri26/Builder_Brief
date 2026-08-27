'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import type { CitizenProfile } from '@/types/user';
import { Badge, Button, Field, Input, Spinner } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

/**
 * Lets the citizen correct their own details.
 *
 * The whole product rests on these details being right — they fill in every
 * application — so leaving them read-only would strand anyone whose address or
 * number has changed. A new mobile number needs the code first; nothing else
 * does.
 */
export function ProfileEditor({ profile }: { profile: CitizenProfile }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [otpSent, setOtpSent] = React.useState(false);
  const [otp, setOtp] = React.useState('');

  const [form, setForm] = React.useState({
    name: profile.name,
    dateOfBirth: profile.dateOfBirth,
    city: profile.city,
    state: profile.state,
    email: profile.email,
    mobile: profile.mobile,
  });

  const mobileChanged = form.mobile.trim() !== profile.mobile;

  React.useEffect(() => {
    if (!open) return;
    setForm({
      name: profile.name,
      dateOfBirth: profile.dateOfBirth,
      city: profile.city,
      state: profile.state,
      email: profile.email,
      mobile: profile.mobile,
    });
    setOtp('');
    setOtpSent(false);
    setError(null);
  }, [open, profile]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, otp: mobileChanged ? otp : undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'That could not be saved.');
      }
      setOpen(false);
      window.dispatchEvent(new CustomEvent('ns:data-changed'));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-4" aria-hidden="true" />
        Change my details
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change my details"
        description="Only change what is wrong. Everything else stays as it is."
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy || (mobileChanged && otp.length < 6)}>
              {busy ? <Spinner /> : null}
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="profile-name">
            <Input
              id="profile-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Date of birth" htmlFor="profile-dob" hint="Day, month and year">
            <Input
              id="profile-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" htmlFor="profile-city">
              <Input
                id="profile-city"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </Field>
            <Field label="State" htmlFor="profile-state">
              <Input
                id="profile-state"
                value={form.state}
                onChange={(event) => setForm({ ...form, state: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Email" htmlFor="profile-email">
            <Input
              id="profile-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          <Field
            label="Mobile"
            htmlFor="profile-mobile"
            hint="If you change this, we will check the new number is yours."
          >
            <Input
              id="profile-mobile"
              value={form.mobile}
              onChange={(event) => setForm({ ...form, mobile: event.target.value })}
            />
          </Field>

          {mobileChanged ? (
            <div className="space-y-3 rounded-lg border border-wait/30 bg-wait-soft p-3">
              <p className="text-sm text-wait">
                To keep your account safe, we need to check that {form.mobile} is yours.
              </p>
              {!otpSent ? (
                <Button variant="secondary" onClick={() => setOtpSent(true)}>
                  Send the code
                </Button>
              ) : (
                <>
                  <Badge tone="wait">Practice code: 123456</Badge>
                  <Field label="Enter the code" htmlFor="profile-otp">
                    <Input
                      id="profile-otp"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      placeholder="123456"
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                    />
                  </Field>
                </>
              )}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg bg-stop-soft px-3 py-2 text-sm text-stop">
              {error}
            </p>
          ) : null}

          <p className="text-xs text-ink-subtle">
            This is a practice app. No real message is sent and no real number is used.
          </p>
        </div>
      </Modal>
    </>
  );
}
