import { describe, expect, it } from 'vitest';
import {
  escapeCsvCell,
  filterOperationsByPeriod,
  mskDayStart,
  operationsToCsv,
  operationEffect,
  periodStart,
  reconcileBalances,
  summarizeOperations,
  type ReportPeriod,
} from './reports';
import type { Operation, Student } from './localRepo';

function op(partial: Partial<Operation> & { created_at?: string }): Operation {
  return {
    id: `op-${Math.random()}`,
    student_id: 's1',
    op_type: 'accrual',
    amount: 10,
    reason_id: null,
    comment: '',
    author_name: '',
    source_op_type: null,
    idempotency_key: `k-${Math.random()}`,
    correction_of_id: null,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

function student(partial: Partial<Student> = {}): Student {
  return {
    id: 's1',
    first_name: '',
    last_name: '',
    patronymic: '',
    full_name: 'Иванов Иван',
    group_name: '',
    parent_phone: '',
    birth_date: '',
    balance: 0,
    status: 'active',
    created_at: new Date().toISOString(),
    ...partial,
  };
}

// now = 15.01.2026 13:00 МСК (10:00Z)
const NOW = new Date('2026-01-15T10:00:00.000Z');

describe('reports · периоды МСК', () => {
  it('mskDayStart = 00:00 МСК (21:00Z предыдущего дня)', () => {
    expect(mskDayStart(NOW).toISOString()).toBe('2026-01-14T21:00:00.000Z');
  });

  it('today: граница 00:00 МСК — 23:59:59 вчера excluded, 00:00 сегодня included', () => {
    const ops = [
      op({ id: 'a', created_at: '2026-01-14T20:59:59.000Z' }),
      op({ id: 'b', created_at: '2026-01-14T21:00:00.000Z' }),
      op({ id: 'c', created_at: '2026-01-15T09:00:00.000Z' }),
    ];
    const ids = filterOperationsByPeriod(ops, 'today', NOW).map((o) => o.id).sort();
    expect(ids).toEqual(['b', 'c']);
  });

  it('week: последние 7 дней МСК (включая сегодня)', () => {
    const start = periodStart('week', NOW);
    expect(start?.toISOString()).toBe('2026-01-08T21:00:00.000Z');
    const ops = [
      op({ id: 'old', created_at: '2026-01-08T20:59:59.000Z' }),
      op({ id: 'edge', created_at: '2026-01-08T21:00:00.000Z' }),
    ];
    const ids = filterOperationsByPeriod(ops, 'week', NOW).map((o) => o.id);
    expect(ids).toEqual(['edge']);
  });

  it('month: с 1-го числа текущего месяца МСК', () => {
    const start = periodStart('month', NOW);
    expect(start?.toISOString()).toBe('2025-12-31T21:00:00.000Z');
    const ops = [
      op({ id: 'dec', created_at: '2025-12-31T20:59:59.000Z' }),
      op({ id: 'jan', created_at: '2025-12-31T21:00:00.000Z' }),
    ];
    const periods: ReportPeriod[] = ['month'];
    for (const p of periods) {
      expect(filterOperationsByPeriod(ops, p, NOW).map((o) => o.id)).toEqual(['jan']);
    }
  });

  it('all: без фильтра', () => {
    const ops = [op({ id: 'x', created_at: '2020-01-01T00:00:00.000Z' })];
    expect(filterOperationsByPeriod(ops, 'all', NOW)).toHaveLength(1);
  });
});

describe('reports · итоги и эффекты', () => {
  it('summarize: accrual/write_off/reversal/net', () => {
    const ops = [
      op({ id: '1', op_type: 'accrual', amount: 20 }),
      op({ id: '2', op_type: 'write_off', amount: 7 }),
      op({ id: '3', op_type: 'reversal', amount: 5, source_op_type: 'accrual' }),
    ];
    expect(summarizeOperations(ops)).toEqual({ accrued: 20, writtenOff: 7, reversed: 5, net: 8, count: 3 });
  });

  it('operationEffect: reversal списания возвращает плюс', () => {
    expect(operationEffect({ op_type: 'reversal', amount: 7, source_op_type: 'write_off' })).toBe(7);
    expect(operationEffect({ op_type: 'reversal', amount: 7, source_op_type: 'accrual' })).toBe(-7);
  });
});

describe('reports · сверка балансов', () => {
  it('пусто, когда balance == Σ эффектов', () => {
    const st = student({ id: 's1', balance: 8 });
    const ops = [
      op({ id: '1', student_id: 's1', op_type: 'accrual', amount: 20 }),
      op({ id: '2', student_id: 's1', op_type: 'write_off', amount: 7 }),
      op({ id: '3', student_id: 's1', op_type: 'reversal', amount: 5, source_op_type: 'accrual' }),
    ];
    expect(reconcileBalances([st], ops)).toEqual([]);
  });

  it('находит расхождение с diff', () => {
    const st = student({ id: 's1', full_name: 'Петров Пётр', balance: 999 });
    const ops = [op({ id: '1', student_id: 's1', op_type: 'accrual', amount: 10 })];
    const bad = reconcileBalances([st], ops);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatchObject({ student_id: 's1', expected: 10, actual: 999, diff: 989 });
  });
});

describe('reports · CSV кириллица/кавычки', () => {
  it('BOM в начале для Excel', () => {
    const csv = operationsToCsv([], { studentName: () => '', studentGroup: () => '', reasonLabel: () => '', formatDate: () => '' });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('экранирует кавычки и точку с запятой', () => {
    expect(escapeCsvCell('Иванов "Ваня" Иван')).toBe('"Иванов ""Ваня"" Иван"');
    expect(escapeCsvCell('a;b')).toBe('"a;b"');
    expect(escapeCsvCell('обычный текст')).toBe('обычный текст');
    expect(escapeCsvCell('строка\nперенос')).toBe('"строка\nперенос"');
  });

  it('строка с кириллицей и кавычками корректна целиком', () => {
    const ops = [
      op({
        id: '1',
        student_id: 's1',
        op_type: 'accrual',
        amount: 15,
        comment: 'за "отличное" занятие; молодец',
        author_name: 'Учитель 1',
      }),
    ];
    const csv = operationsToCsv(ops, {
      studentName: () => 'Иванов "Ваня" Иван',
      studentGroup: () => 'А-1',
      reasonLabel: () => 'Активность',
      formatDate: () => '15.01.2026, 13:00',
    });
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Иванов ""Ваня"" Иван"');
    expect(lines[1]).toContain('"за ""отличное"" занятие; молодец"');
  });
});
