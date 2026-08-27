'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Download,
  FileText,
  FolderOpen,
  Info,
  LayoutGrid,
  MessageSquarePlus,
  Plug,
  User,
} from 'lucide-react';
import type { Conversation } from '@/types/chat';
import { cn, dayGroup } from '@/lib/utils';
import { Badge } from '@/components/ui';
import { ResetDemoButton } from './reset-demo-button';
import { LogoutButton } from '@/components/auth/logout-button';

const NAV = [
  { href: '/', label: 'Chat', icon: MessageSquarePlus, exact: true },
  { href: '/applications', label: 'Applications', icon: LayoutGrid },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/downloads', label: 'Downloads', icon: Download },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/services', label: 'Connected services', icon: Plug },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/about', label: 'About', icon: Info },
];

const GROUP_ORDER = ['Today', 'Yesterday', 'Earlier'] as const;

export function Sidebar({
  conversations,
  unread,
  onNavigate,
}: {
  conversations: Conversation[];
  unread: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: conversations.filter((conversation) => dayGroup(conversation.updatedAt) === group),
  })).filter((entry) => entry.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-line px-4 py-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2"
          aria-label="NammaSahaay AI home"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
            NS
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-ink">NammaSahaay AI</span>
            <span className="block text-[11px] text-ink-subtle">One place for every service</span>
          </span>
        </Link>
        <Link
          href="/?new=1"
          onClick={onNavigate}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line-strong text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
        >
          <MessageSquarePlus className="size-4" aria-hidden="true" />
          New conversation
        </Link>
      </div>

      <nav className="ns-scroll flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== '/';
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors',
                    active ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-muted hover:bg-canvas hover:text-ink',
                  )}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === '/notifications' && unread > 0 ? (
                    <Badge tone="info" aria-label={`${unread} unread`}>
                      {unread}
                    </Badge>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        {grouped.length > 0 ? (
          <div className="mt-5 space-y-4">
            {grouped.map((entry) => (
              <div key={entry.group}>
                <h2 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  {entry.group}
                </h2>
                <ul className="space-y-0.5">
                  {entry.items.map((conversation) => {
                    const active = pathname === `/chat/${conversation.id}`;
                    return (
                      <li key={conversation.id}>
                        <Link
                          href={`/chat/${conversation.id}`}
                          onClick={onNavigate}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                            active
                              ? 'bg-accent-soft font-semibold text-accent'
                              : 'text-ink-muted hover:bg-canvas hover:text-ink',
                          )}
                        >
                          <FileText className="size-4 shrink-0 opacity-70" aria-hidden="true" />
                          <span className="truncate">{conversation.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </nav>

      <div className="space-y-3 border-t border-line px-4 py-4">
        <p className="px-1 text-[11px] leading-snug text-ink-subtle">
          <span className="font-semibold">DEMO MODE</span> — Government services and citizen data
          are simulated for this prototype.{' '}
          <Link href="/about" onClick={onNavigate} className="text-accent hover:underline">
            Read more
          </Link>
        </p>
        <ResetDemoButton />
        <LogoutButton />
      </div>
    </div>
  );
}
