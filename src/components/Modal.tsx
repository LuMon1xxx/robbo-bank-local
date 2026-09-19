import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}

/** Центрированная модалка на токенах: Esc / клик по фону закрывают. */
export function Modal({ title, subtitle, onClose, children, maxWidth = 480 }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth }}
        className={cn(
          'max-h-[88vh] w-full overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--color-border-color)] bg-[var(--color-card-bg)] p-[18px] text-[var(--color-fg)] shadow-[var(--shadow-hover)]',
        )}
      >
        <div className="mb-1 flex items-start gap-2">
          <div className="flex-1">
            <div className="text-[17px] font-bold">{title}</div>
            {subtitle && <div className="mt-0.5 text-[13px] text-[var(--color-muted-fg)]">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="cursor-pointer rounded-[var(--radius-s)] text-[18px] leading-none text-[var(--color-muted-fg)] hover:text-[var(--color-fg)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)] focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
