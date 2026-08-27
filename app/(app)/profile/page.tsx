import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';
import { Badge, Card, CardBody, PageHeader } from '@/components/ui';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { formatCurrency, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const userId = await getCurrentUserId();
  const db = getDatabase();
  const [profile, connections] = await Promise.all([
    db.getProfile(userId),
    db.listConnectedServices(userId),
  ]);

  const details = [
    { label: 'Name', value: profile.name },
    { label: 'Date of birth', value: formatDate(profile.dateOfBirth) },
    { label: 'Age', value: `${profile.age}` },
    { label: 'Mobile', value: profile.mobile },
    { label: 'Email', value: profile.email },
    { label: 'State', value: profile.state },
    { label: 'City', value: profile.city },
    { label: 'Marital status', value: profile.maritalStatus },
    {
      label: 'Dependents',
      value: profile.dependents.map((d) => `${d.relation}, age ${d.age}`).join('; ') || 'None recorded',
    },
    { label: 'Employment', value: profile.employmentStatus.replace('_', ' ') },
    { label: 'Education', value: profile.education },
    { label: 'Annual household income', value: formatCurrency(profile.annualHouseholdIncome) },
    { label: 'Bank account', value: profile.bankAccountMasked },
    { label: 'Photo', value: profile.photo.available ? 'On file' : 'Not on file' },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="My details"
        description="What I already know about you, so I do not ask the same things again."
        action={<ProfileEditor profile={profile} />}
      />

      <div className="space-y-4">
        <Card>
          <CardBody>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label}>
                  <dt className="text-xs uppercase tracking-wide text-ink-subtle">{detail.label}</dt>
                  <dd className="text-[15px] text-ink">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-ink">Your numbers</h2>
            </div>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {profile.identifiers.map((identifier) => (
                <li key={identifier.key} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-ink-muted">{identifier.label}</span>
                    <span className="font-mono text-sm font-medium text-ink">{identifier.value}</span>
                  </div>
                  <p className="text-xs text-ink-subtle">{identifier.note}</p>
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-2 rounded-lg bg-canvas px-3 py-2.5 text-sm text-ink-muted">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              These are sample numbers. I will never ask you for your real Aadhaar, PAN or bank
              number.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-[15px] font-semibold text-ink">Connected services</h2>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {connections.map((connection) => (
                <li key={connection.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="min-w-[140px] flex-1">
                    <span className="block text-sm font-medium text-ink">{connection.name}</span>
                    <span className="block text-xs text-ink-subtle">{connection.description}</span>
                  </span>
                  <Badge tone={connection.status === 'connected' ? 'ok' : 'info'}>
                    {connection.status === 'connected' ? 'Connected' : 'Available'}
                  </Badge>
                </li>
              ))}
            </ul>
            <Link href="/services" className="text-sm font-medium text-accent hover:underline">
              Manage connected services
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
