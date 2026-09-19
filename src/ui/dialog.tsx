import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

/** Простой диалог без radix: fixed overlay + панель на токенах. */
function Dialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      data-slot="dialog-overlay"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        data-slot="dialog-content"
        onClick={(e) => e.stopPropagation()}
        className="relative grid w-full max-w-lg gap-4 border border-[var(--color-border-color)] bg-[var(--color-card-bg)] p-6 shadow-[var(--shadow-hover)] rounded-[var(--radius-xl)]"
      >
        {children}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-[var(--radius-m)] text-[var(--color-muted-fg)] transition-opacity hover:text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-300)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-[var(--color-fg)]',
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-[var(--color-muted-fg)]', className)} {...props} />;
}

export { Dialog, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
