import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { localRepo } from '../lib/localRepo';
import { parseAmountText } from '../lib/ui-validation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';

interface BulkAccrualBarProps {
  selectedIds: string[];
  studentName: (id: string) => string;
  authorName: string;
  onDone: (message: string) => void;
  onError: (message: string) => void;
  onApplied: () => void;
}

/**
 * BulkAccrualBar: выбор чекбоксами выше → причина + сумма → Подтвердить (all-or-nothing).
 */
export function BulkAccrualBar({ selectedIds, studentName, authorName, onDone, onError, onApplied }: BulkAccrualBarProps) {
  const reasons = useMemo(
    () => localRepo.listReasons().filter((r) => r.is_active && (r.kind === 'accrual' || r.kind === 'any')),
    [],
  );
  const [reasonId, setReasonId] = useState<string>(() => String(reasons[0]?.id ?? ''));
  const [amountText, setAmountText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failedNames, setFailedNames] = useState<string[] | null>(null);

  const activeReason = reasons.find((r) => String(r.id) === reasonId) ?? null;
  const amount = amountText.trim() === '' ? (activeReason?.default_amount || 10) : parseAmountText(amountText);

  function handleConfirm() {
    if (submitting || selectedIds.length === 0) return;
    if (!activeReason) {
      onError('Выберите причину начисления');
      return;
    }
    if (amount == null) {
      onError('Сумма должна быть целым числом от 1 до 100 000');
      return;
    }
    setSubmitting(true);
    setFailedNames(null);
    try {
      const ops = localRepo.bulkAccrual(
        selectedIds.map((student_id) => ({
          student_id,
          amount,
          reason_id: activeReason.id,
          author_name: authorName,
        })),
      );
      onApplied();
      onDone(`Начислено ${ops.length} × ${amount} (${activeReason.label})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось начислить';
      const m = /unknown student_id:\s*(\S+)/.exec(msg);
      const denied = m ? [studentName(m[1])] : selectedIds.map(studentName);
      setFailedNames(denied);
      onError(`Не начислено никому (all-or-nothing): ${msg}. Отказано: ${denied.slice(0, 5).join(', ')}${denied.length > 5 ? ` и ещё ${denied.length - 5}` : ''}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-[5] mt-3 flex flex-wrap items-end gap-2 rounded-[var(--radius-l)] border border-[var(--color-border-color)] bg-[var(--color-card-bg)] p-3 shadow-[var(--shadow-hover)]">
      <div className="w-full text-[13px] font-bold text-[var(--color-fg)]">
        Выбрано: {selectedIds.length} · Начислить {selectedIds.length} × {amount ?? '—'} ={' '}
        {amount != null ? selectedIds.length * amount : '—'} монет (атомарно: всем или никому)
      </div>
      <Label className="min-w-40 flex-[2] text-xs text-[var(--color-muted-fg)]">
        Причина
        <Select value={reasonId} onChange={(e) => setReasonId(e.target.value)} className="mt-1">
          {reasons.map((r) => (
            <option key={r.id} value={String(r.id)}>
              {r.label} · {r.default_amount}
            </option>
          ))}
        </Select>
      </Label>
      <Label className="min-w-28 flex-1 text-xs text-[var(--color-muted-fg)]">
        Сумма каждому {activeReason ? `(шаблон: ${activeReason.default_amount})` : ''}
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          step={1}
          placeholder={String(activeReason?.default_amount ?? '')}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          disabled={submitting}
          aria-label="Сумма начисления каждому ученику"
          className="mt-1"
        />
      </Label>
      <Button type="button" onClick={handleConfirm} disabled={submitting || selectedIds.length === 0}>
        {submitting ? 'Начисляем…' : 'Подтвердить'}
      </Button>
      <Button type="button" variant="outline" size="icon" onClick={onApplied} title="Обновить список">
        <RefreshCw className="size-4" aria-hidden="true" />
      </Button>
      {failedNames && failedNames.length > 0 && (
        <p className="w-full rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">
          Отказано (ничего не начислено): {failedNames.slice(0, 5).join(', ')}
          {failedNames.length > 5 ? ` и ещё ${failedNames.length - 5}` : ''}
        </p>
      )}
    </div>
  );
}
