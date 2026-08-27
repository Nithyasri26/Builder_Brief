import { Info } from 'lucide-react';

/**
 * Tells the citizen where a code went. In the practice app the code is also
 * shown here (there is no real SMS gateway); a real deployment simply omits
 * the demo code and the SMS/email actually arrives.
 */
export function OtpNotice({
  channel,
  masked,
  demoCode,
}: {
  channel: 'mobile' | 'email';
  masked?: string;
  demoCode?: string;
}) {
  const where = channel === 'mobile' ? 'mobile' : 'email';
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-muted">
        We sent a 6-digit code to your {where}
        {masked ? (
          <>
            {' '}
            <span className="font-medium text-ink">{masked}</span>
          </>
        ) : null}
        .
      </p>
      {demoCode ? (
        <p className="flex items-center gap-2 rounded-lg border border-wait/30 bg-wait-soft px-3 py-2 text-sm text-wait">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Practice app — no real SMS is sent. Your code is{' '}
            <span className="font-semibold tracking-wider">{demoCode}</span>.
          </span>
        </p>
      ) : null}
    </div>
  );
}
