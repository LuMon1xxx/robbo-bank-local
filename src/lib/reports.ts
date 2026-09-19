/**
 * robbo-bank-local · WP2 отчёты (чистые helpers, тестируемые).
 *
 * Периоды считаются по Москве (Europe/Moscow = UTC+3, без DST):
 * - today: с 00:00 МСК текущего дня
 * - week:  последние 7 календарных дней МСК (включая сегодня, с 00:00)
 * - month: с 1-го числа текущего месяца МСК (00:00)
 * - all:   без фильтра
 */

import type { Operation, Student } from './localRepo';

export type ReportPeriod = 'today' | 'week' | 'month' | 'all';

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  today: 'Сегодня',
  week: 'Неделя (7 дней)',
  month: 'Месяц (календарный)',
  all: 'Всё время',
};

export const MSK_OFFSET_MS = 3 * 3600 * 1000;

/** Начало суток МСК (00:00) для момента now → UTC-метка. */
export function mskDayStart(now: Date): Date {
  const wall = new Date(now.getTime() + MSK_OFFSET_MS);
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth();
  const d = wall.getUTCDate();
  return new Date(Date.UTC(y, m, d) - MSK_OFFSET_MS);
}

/** Начало периода в UTC (null = без фильтра). */
export function periodStart(period: ReportPeriod, now: Date = new Date()): Date | null {
  const today = mskDayStart(now);
  switch (period) {
    case 'today':
      return today;
    case 'week':
      return new Date(today.getTime() - 6 * 86400000);
    case 'month': {
      const wall = new Date(now.getTime() + MSK_OFFSET_MS);
      const y = wall.getUTCFullYear();
      const m = wall.getUTCMonth();
      return new Date(Date.UTC(y, m, 1) - MSK_OFFSET_MS);
    }
    case 'all':
      return null;
  }
}

/** Операции за период (created_at >= start). Сортировка: новые сверху. */
export function filterOperationsByPeriod(
  ops: Operation[],
  period: ReportPeriod,
  now: Date = new Date(),
): Operation[] {
  const start = periodStart(period, now);
  const rows = start
    ? ops.filter((o) => new Date(o.created_at).getTime() >= start.getTime())
    : [...ops];
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Балансовый эффект операции: accrual +X, write_off −X, reversal инвертирует исход. */
export function operationEffect(op: Pick<Operation, 'op_type' | 'amount' | 'source_op_type'>): number {
  if (op.op_type === 'accrual') return op.amount;
  if (op.op_type === 'write_off') return -op.amount;
  return op.source_op_type === 'accrual' ? -op.amount : op.amount;
}

export interface ReportTotals {
  /** Σ начислений (без учёта отмен). */
  accrued: number;
  /** Σ списаний (без учёта отмен). */
  writtenOff: number;
  /** Σ отмен (reversal) по модулю эффекта: отдельно для отчётности. */
  reversed: number;
  /** Балансовый итог периода: Σ эффектов. */
  net: number;
  count: number;
}

export function summarizeOperations(ops: Operation[]): ReportTotals {
  let accrued = 0;
  let writtenOff = 0;
  let reversed = 0;
  let net = 0;
  for (const o of ops) {
    if (o.op_type === 'accrual') accrued += o.amount;
    else if (o.op_type === 'write_off') writtenOff += o.amount;
    else reversed += o.amount;
    net += operationEffect(o);
  }
  return { accrued, writtenOff, reversed, net, count: ops.length };
}

export interface BalanceMismatch {
  student_id: string;
  full_name: string;
  expected: number;
  actual: number;
  diff: number;
}

/**
 * Сверка балансов: expected = Σ эффектов операций ученика.
 * Пустой массив = расхождений нет (норма).
 */
export function reconcileBalances(students: Student[], operations: Operation[]): BalanceMismatch[] {
  const sums = new Map<string, number>();
  for (const o of operations) {
    sums.set(o.student_id, (sums.get(o.student_id) ?? 0) + operationEffect(o));
  }
  const out: BalanceMismatch[] = [];
  for (const s of students) {
    const expected = sums.get(s.id) ?? 0;
    if (expected !== s.balance) {
      out.push({
        student_id: s.id,
        full_name: s.full_name,
        expected,
        actual: s.balance,
        diff: s.balance - expected,
      });
    }
  }
  return out.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
}

// ---- CSV (UTF-8 BOM, «;», кириллица) ----

export const REPORT_CSV_COLUMNS = [
  'Дата (МСК)',
  'Ученик',
  'Группа',
  'Тип',
  'Сумма',
  'Причина',
  'Автор',
  'Комментарий',
] as const;

export const OP_TYPE_RU: Record<Operation['op_type'], string> = {
  accrual: 'Начисление',
  write_off: 'Списание',
  reversal: 'Отмена',
};

/** Экранирование ячейки CSV: кавычки удваиваются, обёртка при ; " \n \r. */
export function escapeCsvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface ReportCsvContext {
  studentName: (id: string) => string;
  studentGroup: (id: string) => string;
  reasonLabel: (id: number | null) => string;
  formatDate: (iso: string) => string;
}

/** CSV-строка отчёта. Начинается с BOM (\uFEFF) — Excel открывает кириллицу сразу. */
export function operationsToCsv(ops: Operation[], ctx: ReportCsvContext): string {
  const lines: string[] = [REPORT_CSV_COLUMNS.map(escapeCsvCell).join(';')];
  for (const o of ops) {
    lines.push(
      [
        ctx.formatDate(o.created_at),
        ctx.studentName(o.student_id),
        ctx.studentGroup(o.student_id),
        OP_TYPE_RU[o.op_type],
        o.amount,
        ctx.reasonLabel(o.reason_id),
        o.author_name,
        o.comment,
      ]
        .map(escapeCsvCell)
        .join(';'),
    );
  }
  return '\uFEFF' + lines.join('\r\n');
}

// ---- История операций в карточке ученика (поиск + фильтр типа) ----

export type HistoryOpTypeFilter = 'all' | Operation['op_type'];

function lookupReasonLabel(
  reasonLabels: ReadonlyMap<number, string> | Record<number, string>,
  id: number | null,
): string {
  if (id == null) return '';
  if (reasonLabels instanceof Map) return reasonLabels.get(id) ?? '';
  return (reasonLabels as Record<number, string>)[id] ?? '';
}

/**
 * Фильтр истории операций (чистая):
 * - type: 'all' — без фильтра, иначе строгое равенство op_type.
 * - query: подстрока (case-insensitive, trim) по трём полям:
 *   лейбл причины (через словарь reason_id→label), комментарий, автор.
 * Порядок входа сохраняется (сортирует вызыватель).
 */
export function filterHistoryOps(
  ops: Operation[],
  query: string,
  type: HistoryOpTypeFilter,
  reasonLabels: ReadonlyMap<number, string> | Record<number, string>,
): Operation[] {
  const q = query.trim().toLowerCase();
  return ops.filter((o) => {
    if (type !== 'all' && o.op_type !== type) return false;
    if (!q) return true;
    const hay = [lookupReasonLabel(reasonLabels, o.reason_id), o.comment ?? '', o.author_name ?? '']
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
