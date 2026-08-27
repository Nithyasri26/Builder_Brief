import Link from 'next/link';
import { Landmark, ShieldCheck, FileCheck2, MessagesSquare } from 'lucide-react';
import { PRODUCT, DEMO_LONG_NOTICE } from '@/lib/config';

/**
 * The framed, two-column surface both auth pages share. Left is a calm brand
 * panel that sets the "public-service" tone and states plainly that this is an
 * independent practice app (never impersonating a real government portal).
 * Right is the form.
 */
export function AuthShell({
  children,
  heading,
  subheading,
  footer,
}: {
  children: React.ReactNode;
  heading: string;
  subheading: string;
  footer?: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto grid min-h-dvh max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Brand panel */}
        <section className="relative hidden flex-col justify-between bg-accent p-10 text-white lg:flex">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-white/15">
                <Landmark className="size-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-semibold tracking-tight">{PRODUCT.name}</span>
            </div>
            <h1 className="mt-12 max-w-sm text-3xl font-semibold leading-tight tracking-tight">
              {PRODUCT.tagline}
            </h1>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/80">
              {PRODUCT.subline}
            </p>

            <ul className="mt-10 space-y-4 text-[15px] text-white/90">
              <TrustPoint icon={<ShieldCheck className="size-5" aria-hidden="true" />}>
                Verify with any government ID — Aadhaar, PAN, passport, voter ID or licence.
              </TrustPoint>
              <TrustPoint icon={<FileCheck2 className="size-5" aria-hidden="true" />}>
                Your details fill in automatically, so you never re-type the same thing twice.
              </TrustPoint>
              <TrustPoint icon={<MessagesSquare className="size-5" aria-hidden="true" />}>
                Then just talk — one conversation for every public service.
              </TrustPoint>
            </ul>
          </div>

          <p className="max-w-sm text-xs leading-relaxed text-white/70">{DEMO_LONG_NOTICE}</p>
        </section>

        {/* Form panel */}
        <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <span className="grid size-9 place-items-center rounded-lg bg-accent text-white">
                <Landmark className="size-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-semibold tracking-tight text-ink">{PRODUCT.name}</span>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-ink">{heading}</h2>
            <p className="mt-1.5 text-[15px] text-ink-muted">{subheading}</p>

            <div className="mt-8">{children}</div>

            {footer ? <div className="mt-6 text-sm text-ink-muted">{footer}</div> : null}

            <p className="mt-10 text-center text-xs text-ink-subtle lg:hidden">
              Independent practice app · not a real government portal.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function TrustPoint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-white/90">{icon}</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-accent hover:underline">
      {children}
    </Link>
  );
}
