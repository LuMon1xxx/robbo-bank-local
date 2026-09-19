import * as React from 'react';
import { cn } from '../lib/utils';

/** Card через div на классах оригинала (в оригинале card.tsx нет). */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-[var(--radius-l)] border border-[var(--color-border-color)] bg-[var(--color-card-bg)] shadow-[var(--shadow-rest)]',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col space-y-1.5 p-5 pb-0', className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3 className={cn('font-semibold leading-none text-[var(--color-fg)]', className)} {...props} />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-4', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardContent };
