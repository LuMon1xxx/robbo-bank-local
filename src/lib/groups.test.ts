import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalRepo, type LocalRepo } from './localRepo';

let repo: LocalRepo;

beforeEach(() => {
  repo = createLocalRepo();
  repo.reset();
});

describe('localRepo groups (WP2)', () => {
  it('createGroup + listGroups с числом учеников', () => {
    repo.createGroup('А-1');
    repo.createStudent({ full_name: 'Иванов Иван', group_name: 'А-1' });
    repo.createStudent({ full_name: 'Петров Пётр', group_name: 'А-1' });
    const archived = repo.createStudent({ full_name: 'Сидоров Сидор', group_name: 'А-1' });
    repo.archiveStudent(archived.id);
    const groups = repo.listGroups();
    expect(groups.find((g) => g.name === 'А-1')).toMatchObject({ name: 'А-1', count: 2 });
  });

  it('createGroup валидирует: пусто/длинно/дубликат', () => {
    expect(() => repo.createGroup('   ')).toThrow();
    expect(() => repo.createGroup('12345678901')).toThrow();
    repo.createGroup('Б-2');
    expect(() => repo.createGroup('Б-2')).toThrow();
  });

  it('renameGroup двигает учеников и group_members', () => {
    const s = repo.createStudent({ full_name: 'Иванов Иван', group_name: 'А-1' });
    repo.renameGroup('А-1', 'А-2');
    expect(repo.getStudent(s.id)?.group_name).toBe('А-2');
    expect(repo.listGroups().some((g) => g.name === 'А-1')).toBe(false);
    expect(repo.listGroups().some((g) => g.name === 'А-2')).toBe(true);
  });

  it('deleteGroup сбрасывает group_name, ученики остаются', () => {
    const s = repo.createStudent({ full_name: 'Иванов Иван', group_name: 'А-1' });
    repo.deleteGroup('А-1');
    expect(repo.getStudent(s.id)?.group_name).toBe('');
    expect(repo.getStudent(s.id)).not.toBeNull();
  });

  it('addGroupMember/removeGroupMember/moveStudent держат group_name', () => {
    const s = repo.createStudent({ full_name: 'Иванов Иван' });
    repo.addGroupMember(s.id, 'В-1');
    expect(repo.getStudent(s.id)?.group_name).toBe('В-1');
    repo.moveStudent(s.id, 'В-2');
    expect(repo.getStudent(s.id)?.group_name).toBe('В-2');
    repo.removeGroupMember(s.id);
    expect(repo.getStudent(s.id)?.group_name).toBe('');
  });

  it('bulk по группе атомарен: один плохой id → никому ничего', () => {
    const a = repo.createStudent({ full_name: 'Иванов Иван', group_name: 'А-1' });
    expect(() =>
      repo.bulkAccrual([
        { student_id: a.id, amount: 10 },
        { student_id: 'no-such-id', amount: 10 },
      ]),
    ).toThrow();
    expect(repo.getStudent(a.id)?.balance).toBe(0);
    expect(repo.listOperations()).toHaveLength(0);
  });

  it('export/import хранит группы и состав', () => {
    const s = repo.createStudent({ full_name: 'Иванов Иван', group_name: 'А-1' });
    const dump = repo.exportJson();
    const repo2 = createLocalRepo();
    repo2.importJson(dump);
    expect(repo2.listGroups().some((g) => g.name === 'А-1')).toBe(true);
    expect(repo2.getStudent(s.id)?.group_name).toBe('А-1');
  });

  it('createGroup с расписанием: день + время видны в listGroups', () => {
    repo.createGroup('А-1', { weekday: 'Пн', time: '18:00' });
    expect(repo.listGroups().find((g) => g.name === 'А-1')).toMatchObject({
      weekday: 'Пн',
      time: '18:00',
    });
  });

  it('расписание необязательно: без него пустые строки', () => {
    repo.createGroup('Б-2');
    expect(repo.listGroups().find((g) => g.name === 'Б-2')).toMatchObject({ weekday: '', time: '' });
  });

  it('расписание валидируется: левый день и время — ошибка', () => {
    expect(() => repo.createGroup('В-1', { weekday: 'Фундень' })).toThrow();
    expect(() => repo.createGroup('В-1', { time: '25:99' })).toThrow();
    expect(() => repo.createGroup('В-1', { time: '18-00' })).toThrow();
  });

  it('setGroupSchedule меняет расписание, renameGroup его не теряет', () => {
    repo.createGroup('А-1');
    repo.setGroupSchedule('А-1', { weekday: 'Ср', time: '17:30' });
    expect(repo.listGroups().find((g) => g.name === 'А-1')).toMatchObject({
      weekday: 'Ср',
      time: '17:30',
    });
    repo.renameGroup('А-1', 'А-2');
    expect(repo.listGroups().find((g) => g.name === 'А-2')).toMatchObject({
      weekday: 'Ср',
      time: '17:30',
    });
  });

  it('export/import хранит расписание групп', () => {
    repo.createGroup('А-1', { weekday: 'Пн', time: '18:00' });
    const repo2 = createLocalRepo();
    repo2.importJson(repo.exportJson());
    expect(repo2.listGroups().find((g) => g.name === 'А-1')).toMatchObject({
      weekday: 'Пн',
      time: '18:00',
    });
  });
});
