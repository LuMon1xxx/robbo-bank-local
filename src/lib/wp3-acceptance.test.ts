/**
 * WP3 smoke-приёмка: 3 ученика → начислить → bulk → отменить → сверка пустая → export/import round-trip.
 */
import { describe, expect, it } from 'vitest';
import { createLocalRepo } from './localRepo';
import { reconcileBalances } from './reports';

describe('WP3 acceptance', () => {
  it('3 students → accrue → bulk → reverse → reconcile empty → export/import round-trip', () => {
    const repo = createLocalRepo();
    repo.reset();

    const a = repo.createStudent({ full_name: 'Иванов Иван Иванович', group_name: 'G1' });
    const b = repo.createStudent({ full_name: 'Петрова Анна Сергеевна', group_name: 'G1' });
    const c = repo.createStudent({ full_name: 'Сидоров Пётр Олегович', group_name: 'G2' });

    const op1 = repo.addOperation({ student_id: a.id, op_type: 'accrual', amount: 10, reason_id: 1, author_name: 'Учитель 1' });
    expect(repo.getStudent(a.id)?.balance).toBe(10);

    const bulk = repo.bulkAccrual([
      { student_id: a.id, amount: 5, reason_id: 1, author_name: 'Учитель 1' },
      { student_id: b.id, amount: 5, reason_id: 1, author_name: 'Учитель 1' },
      { student_id: c.id, amount: 5, reason_id: 1, author_name: 'Учитель 1' },
    ]);
    expect(bulk).toHaveLength(3);
    expect(repo.getStudent(a.id)?.balance).toBe(15);

    const rev = repo.reverseOperation(op1.id, 'Учитель 1');
    expect(rev.op_type).toBe('reversal');
    expect(repo.getStudent(a.id)?.balance).toBe(5);

    const mismatches = reconcileBalances(repo.listStudents(), repo.listOperations());
    expect(mismatches).toEqual([]);

    const snapshot = repo.exportJson();
    const balancesBefore = repo.listStudents().map((s) => [s.full_name, s.balance] as const);
    repo.reset();
    expect(repo.listStudents()).toHaveLength(0);
    repo.importJson(snapshot);
    const balancesAfter = repo.listStudents().map((s) => [s.full_name, s.balance] as const);
    expect(balancesAfter).toEqual(balancesBefore);
    expect(reconcileBalances(repo.listStudents(), repo.listOperations())).toEqual([]);
  });
});
