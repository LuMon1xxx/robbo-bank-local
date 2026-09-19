import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalRepo, type LocalRepo } from './localRepo';

let repo: LocalRepo;

beforeEach(() => {
  repo = createLocalRepo();
  repo.reset();
});

describe('localRepo student update/restore (WP1)', () => {
  it('updateStudent меняет ФИО/группу/телефон, баланс и история сохраняются', () => {
    const s = repo.createStudent({ full_name: 'Иванов Иван', group_name: 'A-1' });
    repo.addOperation({ student_id: s.id, op_type: 'accrual', amount: 20 });
    const updated = repo.updateStudent(s.id, {
      full_name: 'Петров Пётр Петрович',
      group_name: 'B-2',
      parent_phone: '+7 900 000-00-00',
    });
    expect(updated.full_name).toBe('Петров Пётр Петрович');
    expect(updated.group_name).toBe('B-2');
    expect(updated.parent_phone).toBe('+7 900 000-00-00');
    expect(updated.balance).toBe(20);
    expect(repo.listOperations({ student_id: s.id })).toHaveLength(1);
  });

  it('updateStudent валидирует ФИО и группу', () => {
    const s = repo.createStudent({ full_name: 'Иванов Иван' });
    expect(() => repo.updateStudent(s.id, { full_name: '   ' })).toThrow();
    expect(() => repo.updateStudent(s.id, { group_name: '12345678901' })).toThrow();
    expect(() => repo.updateStudent('no-such-id', { full_name: 'А Б' })).toThrow();
  });

  it('restoreStudent возвращает из архива', () => {
    const s = repo.createStudent({ full_name: 'Иванов Иван' });
    repo.archiveStudent(s.id);
    expect(repo.getStudent(s.id)?.status).toBe('archived');
    expect(repo.restoreStudent(s.id).status).toBe('active');
  });
});
