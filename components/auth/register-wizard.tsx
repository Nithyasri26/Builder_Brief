'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Upload, ScanLine, CheckCircle2, PencilLine } from 'lucide-react';
import { Button, Field, Input, Spinner, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { INDIA_STATES } from '@/lib/geo/india-states';
import { OtpNotice } from './otp-notice';
import type { ExtractedIdentity, IdDocType, OtpStartResponse } from '@/types/auth';

type Step = 'upload' | 'details' | 'contact' | 'verify';

interface Details {
  name: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  state: string;
  city: string;
  addressLine: string;
  pincode: string;
  guardianName: string;
  idNumber: string;
  verifiedVia: IdDocType;
  docTypeLabel: string;
  idNumberLabel: string;
  confidence: number;
}

const EMPTY: Details = {
  name: '',
  dateOfBirth: '',
  gender: 'other',
  state: '',
  city: '',
  addressLine: '',
  pincode: '',
  guardianName: '',
  idNumber: '',
  verifiedVia: 'unknown',
  docTypeLabel: 'ID document',
  idNumberLabel: 'ID number',
  confidence: 0,
};

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'ID proof' },
  { key: 'details', label: 'Your details' },
  { key: 'contact', label: 'Contact' },
  { key: 'verify', label: 'Verify' },
];

export function RegisterWizard() {
  const [step, setStep] = useState<Step>('upload');
  const [details, setDetails] = useState<Details>(EMPTY);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [challenge, setChallenge] = useState<OtpStartResponse | null>(null);
  const [mobileCode, setMobileCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="space-y-7">
      <Stepper current={step} />
      {step === 'upload' && (
        <UploadStep
          busy={busy}
          setBusy={setBusy}
          error={error}
          setError={setError}
          onExtracted={(identity) => {
            setDetails({
              ...EMPTY,
              name: identity.fields.name ?? '',
              dateOfBirth: identity.fields.dateOfBirth ?? '',
              gender: identity.fields.gender ?? 'other',
              addressLine: identity.fields.address ?? '',
              pincode: identity.fields.pincode ?? '',
              guardianName: identity.fields.guardianName ?? '',
              idNumber: identity.fields.idNumber ?? '',
              verifiedVia: identity.docType,
              docTypeLabel: identity.docTypeLabel,
              idNumberLabel: identity.idNumberLabel,
              confidence: identity.confidence,
            });
            setStep('details');
          }}
          onManual={() => {
            setDetails(EMPTY);
            setStep('details');
          }}
        />
      )}

      {step === 'details' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (details.name.trim().length < 2) return setError('Please enter your full name.');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(details.dateOfBirth))
              return setError('Please enter your date of birth.');
            if (!details.state) return setError('Please choose your state.');
            if (details.city.trim().length < 2) return setError('Please enter your city or town.');
            setStep('contact');
          }}
        >
          {details.verifiedVia !== 'unknown' && (
            <div className="flex items-center gap-2 rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-sm text-ok">
              <ScanLine className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Read from your {details.docTypeLabel}. Please check every field before continuing.
              </span>
              {details.confidence > 0 && (
                <Badge tone={details.confidence >= 70 ? 'ok' : 'wait'} className="ml-auto">
                  {details.confidence}% read
                </Badge>
              )}
            </div>
          )}

          <Field label="Full name" htmlFor="name">
            <Input id="name" value={details.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth" htmlFor="dob">
              <Input
                id="dob"
                type="date"
                value={details.dateOfBirth}
                onChange={(e) => set('dateOfBirth', e.target.value)}
                required
              />
            </Field>
            <Field label="Gender" htmlFor="gender">
              <Select
                id="gender"
                value={details.gender}
                onChange={(e) => set('gender', e.target.value as Details['gender'])}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="State" htmlFor="state">
              <Select id="state" value={details.state} onChange={(e) => set('state', e.target.value)} required>
                <option value="">Select…</option>
                {INDIA_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="City / town" htmlFor="city">
              <Input id="city" value={details.city} onChange={(e) => set('city', e.target.value)} required />
            </Field>
          </div>

          <Field label="Address (optional)" htmlFor="address">
            <Input
              id="address"
              value={details.addressLine}
              onChange={(e) => set('addressLine', e.target.value)}
              placeholder="House no., street, area"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="PIN code (optional)" htmlFor="pincode">
              <Input
                id="pincode"
                inputMode="numeric"
                maxLength={6}
                value={details.pincode}
                onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            {details.verifiedVia !== 'unknown' && (
              <Field label={details.idNumberLabel} htmlFor="idnum">
                <Input id="idnum" value={details.idNumber} onChange={(e) => set('idNumber', e.target.value)} />
              </Field>
            )}
          </div>

          {error ? <p className="text-sm text-stop">{error}</p> : null}
          <div className="flex items-center gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setStep('upload')}>
              ← Back
            </Button>
            <Button type="submit" size="lg" className="flex-1">
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        </form>
      )}

      {step === 'contact' && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const digits = mobile.replace(/\D/g, '').slice(-10);
            if (digits.length !== 10 || !/^[6-9]/.test(digits))
              return setError('Please enter a valid 10-digit mobile number.');
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
              return setError('Please enter a valid email address.');
            if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
              return setError('Choose a password of at least 8 characters, with letters and numbers.');
            if (password !== confirmPassword) return setError('The two passwords do not match.');
            setBusy(true);
            try {
              const res = await fetch('/api/auth/register/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: details.name,
                  dateOfBirth: details.dateOfBirth,
                  gender: details.gender,
                  state: details.state,
                  city: details.city,
                  addressLine: details.addressLine,
                  pincode: details.pincode,
                  guardianName: details.guardianName,
                  idNumber: details.idNumber,
                  verifiedVia: details.verifiedVia,
                  mobile: digits,
                  email,
                  password,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? 'Could not send the codes.');
              setChallenge(data as OtpStartResponse);
              setStep('verify');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Something went wrong.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-ink-muted">
            We&apos;ll verify both so we can keep you updated about your applications.
          </p>
          <Field label="Mobile number" htmlFor="mobile" hint="A 6-digit code will be sent here.">
            <Input
              id="mobile"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="98765 43210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
            />
          </Field>
          <Field label="Email address" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Create a password"
            htmlFor="password"
            hint="At least 8 characters, with letters and numbers. You'll use this to log in."
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Type it again"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </Field>
          {error ? <p className="text-sm text-stop">{error}</p> : null}
          <div className="flex items-center gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setStep('details')}>
              ← Back
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={busy}>
              {busy ? <Spinner /> : <>Send codes <ArrowRight className="size-4" /></>}
            </Button>
          </div>
        </form>
      )}

      {step === 'verify' && challenge && (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const res = await fetch('/api/auth/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeId: challenge.challengeId, mobileCode, emailCode }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? 'That did not work.');
              window.location.href = data.redirect ?? '/';
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Something went wrong.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-4">
            <div>
              <OtpNotice channel="mobile" masked={challenge.maskedMobile} demoCode={challenge.demoCodes?.mobile} />
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Mobile code"
                className="mt-2 tracking-[0.4em]"
                value={mobileCode}
                onChange={(e) => setMobileCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <div>
              <OtpNotice channel="email" masked={challenge.maskedEmail} demoCode={challenge.demoCodes?.email} />
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Email code"
                className="mt-2 tracking-[0.4em]"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          </div>
          {error ? <p className="text-sm text-stop">{error}</p> : null}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={busy || mobileCode.length < 6 || emailCode.length < 6}
          >
            {busy ? <Spinner /> : <>Create my account <CheckCircle2 className="size-4" /></>}
          </Button>
          <button
            type="button"
            className="text-sm text-ink-muted hover:text-ink"
            onClick={() => setStep('contact')}
          >
            ← Change mobile or email
          </button>
        </form>
      )}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
                state === 'done' && 'bg-accent text-white',
                state === 'current' && 'bg-accent/15 text-accent ring-2 ring-accent',
                state === 'todo' && 'bg-canvas text-ink-subtle',
              )}
            >
              {state === 'done' ? <CheckCircle2 className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(
                'hidden text-xs font-medium sm:block',
                state === 'todo' ? 'text-ink-subtle' : 'text-ink',
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        );
      })}
    </ol>
  );
}

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink',
        'focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

interface TesseractLike {
  createWorker: (
    lang: string,
    oem: number,
    options: { logger?: (m: { status?: string; progress?: number }) => void },
  ) => Promise<{
    recognize: (image: File) => Promise<{ data: { text?: string; confidence?: number } }>;
    terminate: () => Promise<unknown>;
  }>;
}

declare global {
  interface Window {
    Tesseract?: TesseractLike;
  }
}

let tesseractPromise: Promise<TesseractLike> | null = null;

/** Loads Tesseract.js from a CDN once, on demand — never bundled into the app. */
function loadTesseract(): Promise<TesseractLike> {
  if (typeof window !== 'undefined' && window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = new Promise<TesseractLike>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.async = true;
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error('The reader could not start. Please enter your details manually.'));
    };
    script.onerror = () => {
      tesseractPromise = null;
      reject(new Error('Could not load the reader. Check your connection, or enter details manually.'));
    };
    document.head.appendChild(script);
  });
  return tesseractPromise;
}

function UploadStep({
  busy,
  setBusy,
  error,
  setError,
  onExtracted,
  onManual,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
  onExtracted: (identity: ExtractedIdentity) => void;
  onManual: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  function pick(f: File | null) {
    setError(null);
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  async function read() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      // Run OCR in the BROWSER. Tesseract.js is built for this, and it keeps the
      // heavy work off the server — a serverless function would time out on it.
      // The server then only parses the recognised text into fields (instant).
      // Loaded from a CDN at runtime (not bundled) so it never bloats the build.
      const Tesseract = await loadTesseract();
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      let text = '';
      let confidence = 0;
      try {
        const { data } = await worker.recognize(file);
        text = data.text ?? '';
        confidence = data.confidence ?? 0;
      } finally {
        await worker.terminate();
      }

      const res = await fetch('/api/auth/extract-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, confidence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not read that image.');
      onExtracted(data.identity as ExtractedIdentity);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not read that image. Please enter your details manually.',
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Upload a photo of any government ID — Aadhaar, PAN, passport, voter ID or driving licence. We
        read it to fill in your details; you confirm everything on the next screen.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-surface px-4 py-8 text-center transition-colors hover:border-accent',
          previewUrl && 'py-4',
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Selected ID preview" className="max-h-48 rounded-lg object-contain" />
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-accent/10 text-accent">
              <Upload className="size-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-ink">Tap to choose an image</span>
            <span className="text-xs text-ink-subtle">JPG, PNG, WebP or AVIF · up to 12 MB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      {file ? (
        <p className="truncate text-xs text-ink-subtle">
          Selected: <span className="text-ink-muted">{file.name}</span>
        </p>
      ) : null}
      {error ? <p className="text-sm text-stop">{error}</p> : null}

      <Button type="button" size="lg" className="w-full" onClick={read} disabled={!file || busy}>
        {busy ? (
          <>
            <Spinner /> Reading your ID{progress !== null ? ` … ${progress}%` : '…'}
          </>
        ) : (
          <>
            <ScanLine className="size-4" /> Read my ID
          </>
        )}
      </Button>

      <button
        type="button"
        onClick={onManual}
        className="mx-auto flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <PencilLine className="size-4" aria-hidden="true" /> Enter my details manually instead
      </button>
    </div>
  );
}
