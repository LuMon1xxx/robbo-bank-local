import { useState } from 'react';
import { localRepo, type Operation, type Student } from '../lib/localRepo';
import { formatMSK, mapBusinessError } from '../lib/ui-validation';
import { Modal } from './Modal';
import { Button } from '../ui/button';

interface ReverseDialogProps {
  operation: Operation;
  student: Student;
  reasonLabel: (id: number | null) => string;
  authorName: string;
  onClose: () => void;
  onChanged: () => void;
  onDone: (message: string, opId: null) => void;
}

/** Подтверждение отмены: показ эффекта и баланса после. */
export function ReverseDialog({ operation, student, reasonLabel, authorName, onClose, onChanged, onDone }: ReverseDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delta = operation.op_type === 'accrual' ? -operation.amount : operation.amount;
  const balanceAfter = student.balance + delta;
  const goesToDebt = balanceAfter < 0;

  function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      localRepo.reverseOperation(operation.id, authorName);
      onChanged();
      onDone('Операция отменена', null);
      onClose();
    } catch (e) {
      setError(mapBusinessError(e instanceof Error ? e.message : 'Не удалось отменить операцию'));
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Отменить операцию?" onClose={onClose} maxWidth={420}>
      <p className="mt-0 mb-2 text-sm">
        {operation.op_type === 'accrual' ? 'Начисление' : 'Списание'} {operation.amount} ·{' '}
        {reasonLabel(operation.reason_id)}
        {operation.comment ? ` — ${operation.comment}` : ''}. Баланс изменится на{' '}
        <b>
          {delta > 0 ? '+' : '−'}
          {operation.amount}
        </b>
        , станет <b>{balanceAfter}</b>.
      </p>
      <p className="mt-0 mb-2 text-xs text-[var(--color-muted-fg)]">
        {formatMSK(operation.created_at)} · {operation.author_name || '—'}
      </p>
      {goesToDebt && (
        <p className="mb-2 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">
          После отмены баланс станет отрицательным ({balanceAfter}) — ученик окажется в долге.
        </p>
      )}
      {error && <p className="mb-2 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Не отменять
        </Button>
        <Button type="button" variant="destructive" onClick={handleConfirm} disabled={submitting}>
          {submitting ? 'Отмена…' : 'Отменить операцию'}
        </Button>
      </div>
    </Modal>
  );
}
