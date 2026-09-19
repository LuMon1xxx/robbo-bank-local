import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

/** Нативный select, стилизованный под токены (без radix). */
function Select({
  className,
  children,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <span className={cn('relative inline-flex w-full items-center', className)}>
      <select
        data-slot="select"
        className={cn(
          'h-10 w-full appearance-none rounded-[var(--radius-m)] border border-[var(--color-border-color)] bg-transparent py-2 pr-8 pl-3 text-sm text-[var(--color-fg)] transition-colors outline-none focus-visible:border-[var(--color-primary-300)] focus-visible:ring-3 focus-visible:ring-[var(--color-primary-300)]/50 disabled:cursor-not-allowed disabled:opacity-50',
          'w-full',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 size-4 text-[var(--color-muted-fg)]"
        aria-hidden="true"
      />
    </span>
  );
}

export { Select };
