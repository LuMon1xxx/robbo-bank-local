import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--btn-radius,var(--radius-m))] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-[var(--color-primary-300)] focus-visible:ring-3 focus-visible:ring-[var(--color-primary-300)]/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-[var(--color-danger-fill)] aria-invalid:ring-3 aria-invalid:ring-[var(--color-danger-fill)]/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]',
        outline:
          'border-[var(--color-border-color)] bg-transparent hover:bg-[var(--color-muted-fg)/10] hover:text-[var(--color-fg)]',
        secondary:
          'bg-[var(--color-muted-fg)/10] text-[var(--color-fg)] hover:bg-[var(--color-muted-fg)/20]',
        ghost: 'hover:bg-[var(--color-muted-fg)/10] hover:text-[var(--color-fg)]',
        destructive:
          'bg-[var(--color-danger-light)] text-[var(--color-danger-text)] hover:bg-[var(--color-danger-fill)] hover:text-white',
        success: 'bg-[var(--color-success-fill)] text-white hover:bg-[var(--color-success-text)]',
        link: 'text-[var(--color-primary-600)] underline-offset-4 hover:underline dark:text-[var(--color-primary-300)]',
      },
      size: {
        default: 'h-10 gap-1.5 px-4',
        xs: "h-7 gap-1 rounded-[var(--btn-radius,var(--radius-s))] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[var(--btn-radius,var(--radius-m))] px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-4 [&_svg:not([class*='size-'])]:size-4",
        icon: 'size-10',
        'icon-xs': "size-7 rounded-[var(--btn-radius,var(--radius-s))] [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': "size-8 rounded-[var(--btn-radius,var(--radius-s))] [&_svg:not([class*='size-'])]:size-3.5",
        'icon-lg': "size-11 [&_svg:not([class*='size-'])]:size-4.5",
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      data-slot="button"
      data-variant={variant ?? 'default'}
      data-size={size ?? 'default'}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
