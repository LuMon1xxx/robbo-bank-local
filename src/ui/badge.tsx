import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-primary-600)] text-white',
        secondary:
          'bg-[var(--color-muted-fg)/10] text-[var(--color-fg)]',
        destructive:
          'bg-[var(--color-danger-fill)]/10 text-[var(--color-danger-text)] dark:bg-[var(--color-danger-fill)]/20 dark:text-[var(--color-danger-dark)]',
        success:
          'bg-[var(--color-success-fill)]/15 text-[var(--color-success-text)] dark:bg-[var(--color-success-fill)]/20 dark:text-[var(--color-success-dark)]',
        outline: 'border-[var(--color-border-color)] text-[var(--color-fg)]',
        ghost: 'text-[var(--color-muted-fg)]',
        link: 'text-[var(--color-primary-600)] underline-offset-4 hover:underline dark:text-[var(--color-primary-300)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
