'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Button, Card, CardBody, Field, Input, Spinner } from '@/components/ui';
import type { DocumentCategory, DocumentPurpose } from '@/types/document';

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'identity', label: 'Identity' },
  { value: 'education', label: 'Education' },
  { value: 'employment', label: 'Employment' },
  { value: 'bank', label: 'Bank' },
  { value: 'family', label: 'Family' },
  { value: 'government', label: 'Government' },
];

const PURPOSES: { value: DocumentPurpose; label: string }[] = [
  { value: 'identity_proof', label: 'Identity proof' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'dob_proof', label: 'Date of birth proof' },
  { value: 'income_proof', label: 'Income proof' },
  { value: 'bank_proof', label: 'Bank proof' },
  { value: 'child_birth_proof', label: 'Child birth proof' },
  { value: 'education_proof', label: 'Education proof' },
  { value: 'employment_proof', label: 'Employment proof' },
  { value: 'aadhaar_document', label: 'Aadhaar' },
  { value: 'birth_certificate', label: 'Birth certificate' },
];

/**
 * Uploading tells the product what the document can be used FOR, which is what
 * lets a later workflow reuse it instead of asking again.
 */
export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<DocumentCategory>('government');
  const [purposes, setPurposes] = React.useState<DocumentPurpose[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setMessage({ tone: 'error', text: 'Choose a file first.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (name.trim()) form.append('name', name.trim());
      form.append('category', category);
      for (const purpose of purposes) form.append('purposes', purpose);

      const response = await fetch('/api/documents', { method: 'POST', body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'The upload did not work.');
      }
      setMessage({ tone: 'ok', text: 'Saved. This document can now be reused across services.' });
      setFile(null);
      setName('');
      setPurposes([]);
      (event.target as HTMLFormElement).reset();
      window.dispatchEvent(new CustomEvent('ns:data-changed'));
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'The upload did not work.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Add a document</h2>
            <p className="text-sm text-ink-muted">
              PDF or image, up to 4 MB. Nothing is sent to any government system.
            </p>
          </div>

          <Field label="File" htmlFor="upload-file">
            <input
              id="upload-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-line-strong bg-surface p-2.5 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent"
            />
          </Field>

          <Field label="Name (optional)" htmlFor="upload-name">
            <Input
              id="upload-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="For example: Rent agreement"
            />
          </Field>

          <Field label="Category" htmlFor="upload-category">
            <select
              id="upload-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as DocumentCategory)}
              className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink"
            >
              {CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <fieldset>
            <legend className="mb-2 block text-sm font-semibold text-ink">
              What can this be used as?
            </legend>
            <div className="flex flex-wrap gap-2">
              {PURPOSES.map((purpose) => {
                const checked = purposes.includes(purpose.value);
                return (
                  <label
                    key={purpose.value}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                      checked
                        ? 'border-accent bg-accent-soft font-medium text-accent'
                        : 'border-line-strong text-ink-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setPurposes((current) =>
                          current.includes(purpose.value)
                            ? current.filter((value) => value !== purpose.value)
                            : [...current, purpose.value],
                        )
                      }
                    />
                    {purpose.label}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-subtle">
              This is how the assistant knows it can reuse the document instead of asking you again.
            </p>
          </fieldset>

          {message ? (
            <p
              role="status"
              className={`rounded-lg px-3 py-2 text-sm ${
                message.tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-stop-soft text-stop'
              }`}
            >
              {message.text}
            </p>
          ) : null}

          <Button type="submit" disabled={busy}>
            {busy ? <Spinner /> : <Upload className="size-4" aria-hidden="true" />}
            Upload document
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
