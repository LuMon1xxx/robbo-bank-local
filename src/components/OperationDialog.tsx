import { useMemo, useState } from 'react';
import { localRepo, type Student } from '../lib/localRepo';
import { mapBusinessError, parseAmountText, validateOperationForm } from '../lib/ui-validation';
import { Modal } from './Modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { cn } from '../lib/utils';

interface OperationDialogProps {
  student: Student;
  authorName: string;
  initialOpType?: 'accrual' | 'write_off';
  onClose: () => void;
  onDone: (message: string, opId: string | null) => void;
  onChanged: () => void;
}

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
}

/** Полная операция: причина (select) + сумма + комментарий, RU-валидация. */
export function OperationDialog({ student, authorName, initialOpType, onClose, onDone, onChanged }: OperationDialogProps) {
  const [opType, setOpType] = useState<'accrual' | 'write_off'>(initialOpType ?? 'accrual');
  const [reasonId, setReasonId] = useState('');
  const [amountText, setAmountText] = useState('10');
  const [comment, setComment] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reasons = useMemo(() => {
    const kinds = opType === 'accrual' ? ['accrual', 'any'] : ['write_off', 'any'];
    return localRepo.listReasons().filter((r) => r.is_active && kinds.includes(r.kind));
  }, [opType]);

  const canWriteOff = student.balance > 0;
  const inDebt = student.balance < 0;

  function pickReason(id: string) {
    setReasonId(id);
    const r = reasons.find((x) => String(x.id) === id);
    if (r) setAmountText(String(r.default_amount));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const errs = validateOperationForm({ amountText, reasonId, comment });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const amount = parseAmountText(amountText);
    if (amount == null) {
      setFieldErrors({ amount: 'Сумма должна быть от 1 до 100 000 целым числом' });
      return;
    }
    setSubmitting(true);
    setInlineError(null);
    try {
      const created = localRepo.addOperation({
        student_id: student.id,
        op_type: opType,
        amount,
        reason_id: Number(reasonId),
        comment: comment.trim(),
        author_name: authorName,
        idempotency_key: uid(),
      });
      onChanged();
      onDone(opType === 'accrual' ? `Начислено ${amount}` : `Списано ${amount}`, created.id);
      onClose();
    } catch (err) {
      setInlineError(mapBusinessError(err instanceof Error ? err.message : 'Ошибка операции'));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={opType === 'accrual' ? 'Начислить монеты' : 'Списать монеты'}
      subtitle={`${student.full_name} · Баланс: ${student.balance}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-3 flex gap-1.5 rounded-[var(--radius-m)] bg-[var(--color-muted-fg)/10] p-1">
          {(['accrual', 'write_off'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setOpType(t);
                setReasonId('');
                setFieldErrors({});
              }}
              className={cn(
                'flex-1 cursor-pointer rounded-[calc(var(--radius-s)-2px)] py-[7px] text-[13px] font-semibold',
                opType === t ? 'bg-[var(--color-primary-600)] text-white' : 'text-[var(--color-muted-fg)]',
              )}
            >
              {t === 'accrual' ? 'Начисление' : 'Списание'}
            </button>
          ))}
        </div>

        <Label className="mb-1 block text-[13px] font-semibold" htmlFor="op-reason">
          Причина
        </Label>
        <Select id="op-reason" value={reasonId} disabled={reasons.length === 0} onChange={(e) => pickReason(e.target.value)}>
          <option value="">Выберите причину</option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </Select>
        {fieldErrors.reasonId && <p className="mt-1 text-xs text-[var(--color-danger-text)]">{fieldErrors.reasonId}</p>}

        <Label className="mt-2.5 mb-1 block text-[13px] font-semibold" htmlFor="op-amount">
          Сумма
        </Label>
        <Input
          id="op-amount"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
        />
        {fieldErrors.amount && <p className="mt-1 text-xs text-[var(--color-danger-text)]">{fieldErrors.amount}</p>}

        <Label className="mt-2.5 mb-1 block text-[13px] font-semibold" htmlFor="op-comment">
          Комментарий (необязательно)
        </Label>
        <textarea
          id="op-comment"
          rows={2}
          placeholder="Комментарий…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded-[var(--radius-m)] border border-[var(--color-border-color)] bg-transparent px-3 py-2 text-base text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted-fg)] focus-visible:border-[var(--color-primary-300)] focus-visible:ring-3 focus-visible:ring-[var(--color-primary-300)]/50"
          style={{ resize: 'vertical' }}
        />
        {fieldErrors.comment && <p className="mt-1 text-xs text-[var(--color-danger-text)]">{fieldErrors.comment}</p>}

        {opType === 'write_off' && inDebt && (
          <p className="mt-2.5 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">Ученик в долге — списания недоступны.</p>
        )}
        {inlineError && <p className="mt-2.5 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">{inlineError}</p>}

        <div className="mt-3.5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={submitting || (opType === 'write_off' && !canWriteOff)}>
            {submitting ? 'Отправка…' : opType === 'accrual' ? 'Начислить' : 'Списать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
