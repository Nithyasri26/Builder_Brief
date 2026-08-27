'use client';

import { Button, EmptyState } from '@/components/ui';

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <EmptyState
        title="Something went wrong in the prototype"
        body="Nothing you started was lost. You can try that step again."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
