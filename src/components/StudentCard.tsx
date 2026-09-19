import { useMemo, useState } from 'react';
import { Pencil, Plus, Undo2, Zap } from 'lucide-react';
import { localRepo, type Operation, type Student } from '../lib/localRepo';
import { filterHistoryOps, type HistoryOpTypeFilter } from '../lib/reports';
import { formatMSK } from '../lib/ui-validation';
import { Modal } from './Modal';
import { ReverseDialog } from './ReverseDialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select } from '../ui/select';

const PAGE_SIZE = 10;

const OP_LABEL: Record<Operation['op_type'], string> = {
  accrual: 'Начисление',
  write_off: 'Списание',
  reversal: 'Отмена',
};

interface StudentCardProps {
  studentId: string;
  authorName: string;
  onClose: () => void;
  onChanged: () => void;
  onDone: (message: string, opId: string | null) => void;
  onQuickOp: (student: Student) => void;
  onFullOp: (student: Student) => void;
  onEdit: (student: Student) => void;
}

/** Карточка ученика: баланс + история операций с отменой. */
export function StudentCard({ studentId, authorName, onClose, onChanged, onDone, onQuickOp, onFullOp, onEdit }: StudentCardProps) {
  const [page, setPage] = useState(0);
  const [reverseOp, setReverseOp] = useState<Operation | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<HistoryOpTypeFilter>('all');

  const student = localRepo.getStudent(studentId);
  const reasonMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of localRepo.listReasons()) m.set(r.id, r.label);
    return m;
  }, []);
  const reasonLabel = (id: number | null) => (id == null ? '—' : (reasonMap.get(id) ?? '—'));

  const allOps = useMemo(
    () =>
      localRepo
        .listOperations({ student_id: studentId })
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studentId, student?.balance, page],
  );
  const reversedIds = useMemo(() => {
    const s = new Set<string>();
    for (const o of allOps) if (o.correction_of_id) s.add(o.correction_of_id);
    return s;
  }, [allOps]);
  const filteredOps = useMemo(
    () => filterHistoryOps(allOps, query, typeFilter, reasonMap),
    [allOps, query, typeFilter, reasonMap],
  );

  if (!student) {
    return (
      <Modal title="Ученик не найден" onClose={onClose} maxWidth={380}>
        <p className="text-sm">Ученик удалён или не существует.</p>
      </Modal>
    );
  }

  const isFiltering = query.trim() !== '' || typeFilter !== 'all';
  const archived = student.status === 'archived';
  const totalAll = allOps.length;
  const total = filteredOps.length;
  const ops = filteredOps.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  function resetFilters() {
    setQuery('');
    setTypeFilter('all');
    setPage(0);
  }

  function reverseState(op: Operation): { disabled: boolean; title: string } {
    if (op.op_type === 'reversal') return { disabled: true, title: 'Это отмена — повторная отмена запрещена' };
    if (reversedIds.has(op.id)) return { disabled: true, title: 'Операция уже отменена' };
    if (archived) return { disabled: true, title: 'Ученик в архиве — отмена недоступна' };
    return { disabled: false, title: 'Отменить операцию' };
  }

  return (
    <>
      <Modal
        title={student.full_name}
        subtitle={`${student.group_name || 'без группы'} · ${archived ? 'в архиве' : 'активен'}`}
        onClose={onClose}
        maxWidth={560}
      >
        <div className="mb-2.5 flex items-center gap-2.5 rounded-[var(--radius-m)] bg-[var(--color-primary-100)] px-3 py-2.5">
          <span className="text-[13px] text-[var(--color-muted-fg)]">Баланс</span>
          <b className="money-num text-xl text-[var(--color-fg)]">{student.balance}</b>
          {student.balance < 0 && <Badge variant="destructive">долг</Badge>}
          <span className="flex-1" />
          {!archived && (
            <>
              <Button type="button" variant="secondary" size="icon-sm" onClick={() => onQuickOp(student)} title="Быстрое начисление в 2 клика">
                <Zap className="size-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="secondary" size="icon-sm" onClick={() => onFullOp(student)} title="Начислить / списать">
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
            </>
          )}
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(student)} title="Редактировать">
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        {(student.parent_phone || student.birth_date) && (
          <p className="mt-0 mb-2 text-xs text-[var(--color-muted-fg)]">
            {[student.parent_phone, student.birth_date].filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="mb-1.5 text-[13px] font-bold">История операций</div>
        {totalAll > 0 && (
          <div className="mb-1.5 flex gap-1.5">
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Поиск: причина, комментарий, автор…"
              aria-label="Поиск по истории операций"
              className="h-8 text-[13px]"
            />
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as HistoryOpTypeFilter);
                setPage(0);
              }}
              aria-label="Тип операции"
              className="w-36 shrink-0 [&>select]:h-8 [&>select]:text-[13px]"
            >
              <option value="all">Все типы</option>
              <option value="accrual">Начисления</option>
              <option value="write_off">Списания</option>
              <option value="reversal">Отмены</option>
            </Select>
          </div>
        )}
        {isFiltering && totalAll > 0 && (
          <div className="mb-1.5 text-xs text-[var(--color-muted-fg)]">
            Показано {total} из {totalAll}
          </div>
        )}
        {totalAll === 0 ? (
          <p className="py-4 text-center text-[13px] text-[var(--color-muted-fg)]">Операций пока нет</p>
        ) : ops.length === 0 ? (
          <div className="py-4 text-center text-[13px] text-[var(--color-muted-fg)]">
            Ничего не найдено
            <div className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                Сбросить
              </Button>
            </div>
          </div>
        ) : (
          <ul className="m-0 list-none overflow-hidden rounded-[var(--radius-m)] border border-[var(--color-border-color)] p-0">
            {ops.map((op) => {
              const isReversal = op.op_type === 'reversal';
              const isPlus = op.op_type === 'accrual' || (isReversal && op.source_op_type === 'write_off');
              const st = reverseState(op);
              return (
                <li
                  key={op.id}
                  className="flex items-center gap-2 border-b border-[var(--color-border-color)] px-2.5 py-2 text-[13px] last:border-b-0"
                >
                  <Badge variant={isReversal ? 'secondary' : op.op_type === 'accrual' ? 'success' : 'destructive'}>
                    {OP_LABEL[op.op_type]}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {reasonLabel(op.reason_id)}
                      {op.comment ? ` — ${op.comment}` : ''}
                    </span>
                    <span className="text-[11px] text-[var(--color-muted-fg)]">
                      {(op.author_name || '—') + ' · ' + formatMSK(op.created_at)}
                    </span>
                  </span>
                  <b className={`money-num ${isPlus ? 'text-[var(--color-success-text)] dark:text-[var(--color-success-dark)]' : 'text-[var(--color-danger-text)] dark:text-[var(--color-danger-dark)]'}`}>
                    {isPlus ? '+' : '−'}
                    {op.amount}
                  </b>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Отменить операцию: ${isPlus ? '+' : '−'}${op.amount}`}
                    title={st.title}
                    disabled={st.disabled}
                    onClick={() => setReverseOp(op)}
                  >
                    <Undo2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-muted-fg)]">
            <span>
              {from}–{to} из {total}
            </span>
            <span className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                ‹ Назад
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage(page + 1)}
              >
                Вперёд ›
              </Button>
            </span>
          </div>
        )}
      </Modal>

      {reverseOp && student && (
        <ReverseDialog
          operation={reverseOp}
          student={student}
          reasonLabel={reasonLabel}
          authorName={authorName}
          onClose={() => setReverseOp(null)}
          onChanged={() => {
            onChanged();
            setReverseOp(null);
          }}
          onDone={onDone}
        />
      )}
    </>
  );
}
