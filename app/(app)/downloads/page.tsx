import Link from 'next/link';
import type { Metadata } from 'next';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';
import { DownloadRow } from '@/components/cards/misc-cards';
import { EmptyState, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Downloads' };

export default async function DownloadsPage() {
  const userId = await getCurrentUserId();
  const files = await getDatabase().listDownloads(userId);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="My files" description="Everything I have made for you." />

      {files.length === 0 ? (
        <EmptyState
          title="No files yet"
          body="Ask me for something like your PF passbook and the file will be here."
          action={
            <Link
              href="/?ask=I%20need%20my%20PF%20passbook"
              className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-[15px] font-medium text-white hover:bg-accent-strong"
            >
              Get my PF passbook
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <DownloadRow key={file.id} file={file} />
          ))}
        </div>
      )}

      <p className="mt-6 text-sm text-ink-subtle">
        This is a practice app, so these files are samples. They are not issued by any government
        office.
      </p>
    </div>
  );
}
