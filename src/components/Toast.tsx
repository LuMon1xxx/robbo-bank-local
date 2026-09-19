import { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ToastData {
  id: number;
  message: string;
  /** id созданной операции — для кнопки «Отменить». */
  opId: string | null;
}

interface ToastHostProps {
  toast: ToastData | null;
  onUndo: (opId: string) => void;
  onClose: () => void;
}

/** Тост с кнопкой Undo (8 секунд) на токенах. */
export function ToastHost({ toast, onUndo, onClose }: ToastHostProps) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-[100] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-[var(--radius-m)] bg-[var(--color-foreground)] px-3.5 py-2.5 text-sm text-[var(--color-card-bg)] shadow-[var(--shadow-hover)] dark:bg-[var(--color-raised)] dark:text-[var(--color-fg)] dark:border dark:border-[var(--color-border-color)]">
      <span>{toast.message}</span>
      {toast.opId && (
        <button
          type="button"
          onClick={() => onUndo(toast.opId as string)}
          className="cursor-pointer rounded-[var(--radius-s)] bg-[var(--color-card-bg)] px-2.5 py-1 text-[13px] font-bold text-[var(--color-fg)]"
        >
          Отменить
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть уведомление"
        className="cursor-pointer bg-transparent text-inherit"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
