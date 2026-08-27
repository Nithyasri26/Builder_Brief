import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PRODUCT } from '@/lib/config';

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    template: `%s · ${PRODUCT.name}`,
  },
  description:
    "A conversational citizen layer that helps people discover, understand, complete and track India's existing public services. Independent prototype with simulated government integrations.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12607b',
};

/**
 * Root layout is intentionally thin: it owns the document shell only. The
 * signed-in application chrome (sidebar, header, live data) lives in the (app)
 * route group's layout, so the login and register pages render clean, without
 * a sidebar or any citizen data being fetched.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
