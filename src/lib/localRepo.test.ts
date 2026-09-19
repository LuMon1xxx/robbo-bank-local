import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalRepo, type LocalRepo } from './localRepo';

let repo: LocalRepo;
let studentId: string;

beforeEach(() => {
  repo = createLocalRepo();
  repo.reset();
  studentId = repo.createStudent({ full_name: 'Иванов Иван Иванович' }).id;
});

describe('localRepo invariants (WP0)', () => {
  it('1. accrual increases balance', () => {
    repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 20 });
    expect(repo.getStudent(studentId)?.balance).toBe(20);
  });

  it('2. write_off happy path decreases balance', () => {
    repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 20 });
    repo.addOperation({ student_id: studentId, op_type: 'write_off', amount: 7 });
    expect(repo.getStudent(studentId)?.balance).toBe(13);
  });

  it('3. write_off above balance fails', () => {
    repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 5 });
    expect(() =>
      repo.addOperation({ student_id: studentId, op_type: 'write_off', amount: 6 }),
    ).toThrow();
    expect(repo.getStudent(studentId)?.balance).toBe(5);
  });

  it('4. reversal restores balance', () => {
    const op = repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 20 });
    repo.reverseOperation(op.id);
    expect(repo.getStudent(studentId)?.balance).toBe(0);
  });

  it('5. double reversal fails', () => {
    const op = repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 20 });
    repo.reverseOperation(op.id);
    expect(() => repo.reverseOperation(op.id)).toThrow();
  });

  it('6. reversal of a reversal fails', () => {
    const op = repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 20 });
    const rev = repo.reverseOperation(op.id);
    expect(() => repo.reverseOperation(rev.id)).toThrow();
  });

  it('7. reversal of archived student fails', () => {
    const op = repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 20 });
    repo.archiveStudent(studentId);
    expect(() => repo.reverseOperation(op.id)).toThrow();
  });

  it('8. bulk accrual is atomic (all-or-nothing)', () => {
    const s2 = repo.createStudent({ full_name: 'Петров Пётр Петрович' }).id;
    expect(() =>
      repo.bulkAccrual([
        { student_id: studentId, amount: 10 },
        { student_id: s2, amount: 0 }, // invalid amount -> whole batch must fail
      ]),
    ).toThrow();
    expect(repo.getStudent(studentId)?.balance).toBe(0);
    expect(repo.getStudent(s2)?.balance).toBe(0);
    expect(repo.listOperations()).toHaveLength(0);
  });

  it('9. amount boundaries: 1 and 100000 ok; 0, 100001 and non-int fail', () => {
    repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 1 });
    repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 100000 });
    expect(repo.getStudent(studentId)?.balance).toBe(100001);
    for (const bad of [0, -5, 100001, 2.5, Number.NaN]) {
      expect(() =>
        repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: bad }),
      ).toThrow();
    }
  });

  it('10. reversing an accrual may drive balance negative (allowed)', () => {
    const acc = repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 10 });
    repo.addOperation({ student_id: studentId, op_type: 'write_off', amount: 10 });
    repo.reverseOperation(acc.id);
    expect(repo.getStudent(studentId)?.balance).toBe(-10);
  });

  it('11. full_name is required; group_name max 10 chars', () => {
    expect(() => repo.createStudent({ full_name: '   ' })).toThrow();
    expect(() =>
      repo.createStudent({ full_name: 'Сидоров Сидор', group_name: '12345678901' }),
    ).toThrow();
    const ok = repo.createStudent({ full_name: 'Сидоров Сидор', group_name: '1234567890' });
    expect(ok.group_name).toBe('1234567890');
  });

  it('12. export/import round-trip preserves data', () => {
    repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 15 });
    const dump = repo.exportJson();
    const repo2 = createLocalRepo();
    repo2.importJson(dump);
    expect(repo2.getStudent(studentId)?.balance).toBe(15);
    expect(repo2.listOperations()).toHaveLength(1);
  });

  it('13. accrual to archived student fails', () => {
    repo.archiveStudent(studentId);
    expect(() =>
      repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 10 }),
    ).toThrow(/archived/);
    expect(repo.listOperations()).toHaveLength(0);
  });

  it('14. write_off to archived student fails', () => {
    repo.addOperation({ student_id: studentId, op_type: 'accrual', amount: 10 });
    repo.archiveStudent(studentId);
    expect(() =>
      repo.addOperation({ student_id: studentId, op_type: 'write_off', amount: 5 }),
    ).toThrow(/archived/);
    expect(repo.getStudent(studentId)?.balance).toBe(10);
  });

  it('15. bulk with archived student fails atomically (nothing applied)', () => {
    const s2 = repo.createStudent({ full_name: 'Петров Пётр Петрович' }).id;
    repo.archiveStudent(s2);
    expect(() =>
      repo.bulkAccrual([
        { student_id: studentId, amount: 10 },
        { student_id: s2, amount: 10 },
      ]),
    ).toThrow(/archived/);
    expect(repo.getStudent(studentId)?.balance).toBe(0);
    expect(repo.listOperations()).toHaveLength(0);
  });
});
