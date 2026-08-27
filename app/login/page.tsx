import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { isAuthenticated } from '@/lib/security/session';

export const metadata: Metadata = { title: 'Log in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await isAuthenticated()) redirect('/');
  const { next } = await searchParams;

  return (
    <AuthShell
      heading="Welcome back"
      subheading="Log in with the mobile number or email you registered with."
      footer={
        <>
          New here? <AuthLink href="/register">Create an account</AuthLink>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
