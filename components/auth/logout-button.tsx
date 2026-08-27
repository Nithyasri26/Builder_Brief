'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Spinner } from '@/components/ui';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch('/api/auth/logout', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          window.location.href = data.redirect ?? '/login';
        } catch {
          setBusy(false);
        }
      }}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-stop hover:text-stop disabled:cursor-not-allowed"
    >
      {busy ? <Spinner /> : <LogOut className="size-4" aria-hidden="true" />}
      Log out
    </button>
  );
}
