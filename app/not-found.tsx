import Link from 'next/link';
import { EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <EmptyState
        title="That page is not here"
        body="The link may be old, or the demo may have been reset."
        action={
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-[15px] font-medium text-white hover:bg-accent-strong"
          >
            Back to the conversation
          </Link>
        }
      />
    </div>
  );
}
