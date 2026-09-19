import { useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import { localRepo, type Student } from '../lib/localRepo';
import { mapBusinessError, parseAmountText } from '../lib/ui-validation';
import { Modal } from './Modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../lib/utils';

interface QuickOperationDialogProps {
  student: Student;
  authorName: string;
  onClose: () => void;
  /** message + opId для Undo-тоста. */
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

/**
 * Быстрая операция: пресеты — начисление в 1 клик;
 * причина + своя сумма — выбор причины и кнопка «Начислить/Списать».
 */
export function QuickOperationDialog({ student, authorName, onClose, onDone, onChanged }: QuickOperationDialogProps) {
  const [opType, setOpType] = useState<'accrual' | 'write_off'>('accrual');
  const [customAmount, setCustomAmount] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = useMemo(() => {
    const kinds = opType === 'accrual' ? ['accrual', 'any'] : ['write_off', 'any'];
    return localRepo.listReasons().filter((r) => r.is_active && kinds.includes(r.kind));
  }, [opType]);

  const presets = useMemo(() => localRepo.listPresets(), []);

  const canWriteOff = student.balance > 0;
  const inDebt = student.balance < 0;

  const selectedReason = reasons.find((r) => r.id === selectedReasonId) ?? reasons[0] ?? null;
  const parsedCustom = customAmount.trim() === '' ? null : parseAmountText(customAmount.trim());
  const customInvalid = customAmount.trim() !== '' && parsedCustom == null;
  const effectiveAmount = parsedCustom ?? selectedReason?.default_amount ?? 10;

  async function submit(reasonId: number, amount: number) {
    if (submitting) return;
    if (opType === 'write_off' && !canWriteOff) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = localRepo.addOperation({
        student_id: student.id,
        op_type: opType,
        amount,
        reason_id: reasonId,
        author_name: authorName,
        idempotency_key: uid(),
      });
      onChanged();
      onDone(opType === 'accrual' ? `Начислено ${amount}` : `Списано ${amount}`, created.id);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка операции';
      setError(mapBusinessError(msg));
    } finally {
      setSubmitting(false);
    }
  }

  function handlePreset(reasonId: number | null, amount: number) {
    const rid = reasonId ?? reasons[0]?.id;
    if (rid == null) {
      setError('Нет доступных причин');
      return;
    }
    void submit(rid, amount);
  }

  /** Кнопка «Начислить/Списать»: выбранная причина + своя сумма (или сумма причины). */
  function handleSubmit() {
    if (submitting || !selectedReason) return;
    if (opType === 'write_off' && !canWriteOff) return;
    if (customInvalid) {
      setError('Введи сумму от 1 до 100 000 целым числом');
      return;
    }
    void submit(selectedReason.id, effectiveAmount);
  }

  return (
    <Modal title="Быстрая операция" subtitle={`${student.full_name} · Баланс: ${student.balance}`} onClose={onClose}>
      <div className="mb-3 flex gap-1.5 rounded-[var(--radius-m)] bg-[var(--color-muted-fg)/10] p-1">
        {(['accrual', 'write_off'] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={t === 'write_off' && !canWriteOff}
            onClick={() => {
              setOpType(t);
              setError(null);
            }}
            className={cn(
              'flex-1 cursor-pointer rounded-[calc(var(--radius-s)-2px)] py-[7px] text-[13px] font-semibold',
              opType === t ? 'bg-[var(--color-primary-600)] text-white' : 'text-[var(--color-muted-fg)]',
              t === 'write_off' && !canWriteOff && 'cursor-not-allowed opacity-50',
            )}
          >
            {t === 'accrual' ? 'Начисление' : 'Списание'}
          </button>
        ))}
      </div>

      {opType === 'accrual' && presets.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <Label className="px-1 text-xs font-medium text-[var(--color-muted-fg)]">
            Мои шаблоны
          </Label>
          <div className="flex flex-wrap gap-1.5" data-testid="preset-chips">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePreset(p.reason_id, p.amount)}
                disabled={submitting}
                data-testid={`preset-chip-${p.id}`}
                title={`Начислить ${p.amount}: ${p.label}`}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--color-primary-300)] bg-[var(--color-primary-100)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary-700)]',
                  'transition-colors hover:bg-[var(--color-primary-300)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)]',
                  'dark:bg-[var(--color-primary-800)]/40 dark:text-[var(--color-primary-300)]',
                  'disabled:opacity-50',
                )}
              >
                <Zap className="size-3" aria-hidden="true" />
                {p.label} +{p.amount}
              </button>
            ))}
          </div>
        </div>
      )}

      <Label className="mb-2.5 block text-xs text-[var(--color-muted-fg)]">
        Причина
      </Label>
      {reasons.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-[var(--color-muted-fg)]">Нет доступных причин</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Причина операции">
          {reasons.map((r) => {
            const active = selectedReason?.id === r.id;
            return (
              <Button
                key={r.id}
                type="button"
                variant={opType === 'accrual' ? 'success' : 'default'}
                disabled={submitting || (opType === 'write_off' && !canWriteOff)}
                onClick={() => {
                  setSelectedReasonId(r.id);
                  setError(null);
                }}
                aria-pressed={active}
                title={`Сумма по умолчанию: ${r.default_amount}`}
                className={cn('justify-start', active && 'ring-2 ring-[var(--color-primary-300)]')}
              >
                {r.label} {opType === 'accrual' ? '+' : '−'}{r.default_amount}
              </Button>
            );
          })}
        </div>
      )}

      <Label className="mt-3 mb-2.5 block text-xs text-[var(--color-muted-fg)]">
        Своя сумма (необязательно — иначе сумма выбранной причины)
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          step={1}
          placeholder={selectedReason ? `по причине: ${selectedReason.default_amount}` : 'сумма'}
          value={customAmount}
          disabled={submitting}
          onChange={(e) => setCustomAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          aria-label="Своя сумма операции"
          className="mt-1"
        />
      </Label>

      <Button
        type="button"
        disabled={submitting || !selectedReason || customInvalid || (opType === 'write_off' && !canWriteOff)}
        onClick={handleSubmit}
        data-testid="quick-submit"
        className="mt-1 w-full"
      >
        {submitting ? 'Сохранение…' : `${opType === 'accrual' ? 'Начислить' : 'Списать'} ${effectiveAmount}`}
      </Button>

      {opType === 'write_off' && inDebt && (
        <p className="mt-2.5 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">Ученик в долге — списания недоступны. Сначала отмени начисление.</p>
      )}
      {error && <p className="mt-2.5 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">{error}</p>}
    </Modal>
  );
}
