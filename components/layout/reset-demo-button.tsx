'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

/**
 * Puts the app back to its starting state so the walkthrough can be run again.
 * Destructive, so it always asks first.
 */
export function ResetDemoButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function reset() {
    setBusy(true);
    try {
      await fetch('/api/demo/reset', { method: 'POST' });
      window.dispatchEvent(new CustomEvent('ns:data-changed'));
      setOpen(false);
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm font-medium text-ink-muted hover:border-accent hover:text-accent"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Start again
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Clear everything and start again?"
        description="This removes everything you have done here."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              No, keep my work
            </Button>
            <Button variant="danger" onClick={reset} disabled={busy}>
              {busy ? <Spinner /> : null}
              Yes, clear it
            </Button>
          </>
        }
      >
        <ul className="space-y-2 text-[15px] text-ink-muted">
          <li>• Your conversations</li>
          <li>• Everything you have applied for</li>
          <li>• Your updates and files</li>
          <li>• Papers you added or saved</li>
        </ul>
        <p className="mt-4 text-[15px] text-ink-muted">
          Your details and your starting papers come back, so you can begin again.
        </p>
      </Modal>
    </>
  );
}
