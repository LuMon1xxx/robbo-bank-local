import * as React from 'react';
import { cn } from '../lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-[var(--radius-m)] border border-[var(--color-border-color)] bg-transparent px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--color-fg)] placeholder:text-[var(--color-muted-fg)] focus-visible:border-[var(--color-primary-300)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)]/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--color-muted-fg)/10] disabled:opacity-50 aria-invalid:border-[var(--color-danger-fill)] aria-invalid:ring-2 aria-invalid:ring-[var(--color-danger-fill)]/20',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
