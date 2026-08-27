import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Small shadcn-style primitives, written directly against Tailwind so the
 * prototype carries no component-library runtime. Every control is large,
 * high contrast and keyboard reachable.
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-strong disabled:bg-line-strong disabled:text-ink-subtle',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-accent hover:text-accent disabled:text-ink-subtle',
  ghost: 'bg-transparent text-ink-muted hover:bg-canvas hover:text-ink',
  danger: 'bg-stop text-white hover:opacity-90',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-12 px-5 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  as: Component = 'div',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { as?: React.ElementType }) {
  return (
    <Component
      className={cn('rounded-[var(--radius-card)] border border-line bg-surface', className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

type Tone = 'neutral' | 'ok' | 'wait' | 'stop' | 'info' | 'demo';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-muted border-line',
  ok: 'bg-ok-soft text-ok border-ok/20',
  wait: 'bg-wait-soft text-wait border-wait/20',
  stop: 'bg-stop-soft text-stop border-stop/20',
  info: 'bg-info-soft text-info border-info/20',
  demo: 'bg-wait-soft text-wait border-wait/30',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink',
          'placeholder:text-ink-subtle focus:border-accent focus:outline-none',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-line-strong bg-surface p-3 text-[15px] text-ink',
        'placeholder:text-ink-subtle focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    />
  );
});

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  );
}

export function ProgressDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="ns-dot size-1.5 rounded-full bg-accent" />
      <span className="ns-dot size-1.5 rounded-full bg-accent" />
      <span className="ns-dot size-1.5 rounded-full bg-accent" />
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardBody className="py-10 text-center">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{body}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </CardBody>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
