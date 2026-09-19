import { describe, expect, it } from 'vitest';
import { filterHistoryOps } from './reports';
import type { Operation } from './localRepo';

function op(partial: Partial<Operation> & { id: string }): Operation {
  return {
    student_id: 's1',
    op_type: 'accrual',
    amount: 10,
    reason_id: null,
    comment: '',
    author_name: '',
    source_op_type: null,
    idempotency_key: `k-${partial.id}`,
    correction_of_id: null,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

const REASONS = new Map<number, string>([
  [1, 'За занятие'],
  [7, 'Штраф'],
]);

describe('filterHistoryOps · поиск и тип', () => {
  it('пустой запрос + all возвращает всё в том же порядке', () => {
    const ops = [op({ id: 'a' }), op({ id: 'b' })];
    expect(filterHistoryOps(ops, '', 'all', REASONS).map((o) => o.id)).toEqual(['a', 'b']);
    expect(filterHistoryOps(ops, '   ', 'all', REASONS)).toHaveLength(2);
  });

  it('фильтр по типу: accrual / write_off / reversal', () => {
    const ops = [
      op({ id: 'a', op_type: 'accrual' }),
      op({ id: 'w', op_type: 'write_off' }),
      op({ id: 'r', op_type: 'reversal', source_op_type: 'accrual' }),
    ];
    expect(filterHistoryOps(ops, '', 'accrual', REASONS).map((o) => o.id)).toEqual(['a']);
    expect(filterHistoryOps(ops, '', 'write_off', REASONS).map((o) => o.id)).toEqual(['w']);
    expect(filterHistoryOps(ops, '', 'reversal', REASONS).map((o) => o.id)).toEqual(['r']);
  });

  it('поиск по лейблу причины (reason_id→label)', () => {
    const ops = [
      op({ id: 'a', reason_id: 1 }),
      op({ id: 'b', reason_id: 7 }),
    ];
    expect(filterHistoryOps(ops, 'занятие', 'all', REASONS).map((o) => o.id)).toEqual(['a']);
    expect(filterHistoryOps(ops, 'ШТРАФ', 'all', REASONS).map((o) => o.id)).toEqual(['b']);
  });

  it('поиск по комментарию (case-insensitive, trim)', () => {
    const ops = [
      op({ id: 'a', comment: 'За отличную работу' }),
      op({ id: 'b', comment: 'опоздание' }),
    ];
    expect(filterHistoryOps(ops, '  отличную ', 'all', REASONS).map((o) => o.id)).toEqual(['a']);
  });

  it('поиск по автору', () => {
    const ops = [
      op({ id: 'a', author_name: 'Учитель 1' }),
      op({ id: 'b', author_name: 'Учитель 2' }),
    ];
    expect(filterHistoryOps(ops, 'учитель 2', 'all', REASONS).map((o) => o.id)).toEqual(['b']);
  });

  it('комбинирует query + type (И-логика)', () => {
    const ops = [
      op({ id: 'a', op_type: 'accrual', comment: 'конкурс победа' }),
      op({ id: 'b', op_type: 'write_off', comment: 'конкурс штраф' }),
    ];
    expect(filterHistoryOps(ops, 'конкурс', 'accrual', REASONS).map((o) => o.id)).toEqual(['a']);
    expect(filterHistoryOps(ops, 'конкурс', 'reversal', REASONS)).toHaveLength(0);
  });

  it('принимает Record-словарь и неизвестный reason_id не роняет', () => {
    const ops = [op({ id: 'a', reason_id: 999, comment: 'хвост' })];
    const dict = { 1: 'За занятие' };
    expect(filterHistoryOps(ops, 'хвост', 'all', dict).map((o) => o.id)).toEqual(['a']);
    expect(filterHistoryOps(ops, 'занятие', 'all', dict)).toHaveLength(0);
  });

  it('пустой вход → пустой выход', () => {
    expect(filterHistoryOps([], 'что-то', 'accrual', REASONS)).toEqual([]);
  });
});
