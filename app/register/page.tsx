import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { RegisterWizard } from '@/components/auth/register-wizard';
import { isAuthenticated } from '@/lib/security/session';

export const metadata: Metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  if (await isAuthenticated()) redirect('/');

  return (
    <AuthShell
      heading="Create your account"
      subheading="Verify once with an ID, then talk to every service in one place."
      footer={
        <>
          Already registered? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <RegisterWizard />
    </AuthShell>
  );
}
