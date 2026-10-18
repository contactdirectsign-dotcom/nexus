import type { ButtonHTMLAttributes, ReactNode } from 'react';

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Glass panel with an optional title. The basic building block for cards. */
export function Panel({
  title,
  action,
  children,
  className,
  glow,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <section className={cx('nx-glass p-4 sm:p-5', glow && 'nx-glow', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-nx-muted">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Button({ variant = 'ghost', className, type = 'button', ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-nx-pink text-black font-semibold hover:bg-nx-magenta',
    ghost: 'border border-nx-line text-nx-text hover:border-nx-pink hover:text-nx-pink',
    danger: 'border border-red-500/60 text-red-300 hover:bg-red-500/10',
  }[variant];
  return (
    <button
      type={type}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        styles,
        className,
      )}
      {...rest}
    />
  );
}

export function Badge({
  tone = 'muted',
  children,
}: {
  tone?: 'muted' | 'pink' | 'ok' | 'warn';
  children: ReactNode;
}) {
  const tones = {
    muted: 'border-nx-line text-nx-muted',
    pink: 'border-nx-pink/60 text-nx-pink',
    ok: 'border-nx-ok/60 text-nx-ok',
    warn: 'border-nx-warn/60 text-nx-warn',
  }[tone];
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs', tones)}>
      {children}
    </span>
  );
}

/** Honest empty state: says what is missing and what to do about it. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-nx-line p-4">
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="text-sm text-nx-muted">{children}</p>
      {action}
    </div>
  );
}
