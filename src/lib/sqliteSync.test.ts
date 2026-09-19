/**
 * WP1: тесты sqliteSync + snapshot-интеграции localRepo.
 * Чистые функции (splitSqlStatements, mergeOnBoot) + round-trip
 * saveSnapshot/loadSnapshot на in-memory FakeDb + getSnapshot/replaceAll.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalRepo, type DbState } from './localRepo';
import {
  flushNow,
  loadSnapshot,
  mergeOnBoot,
  queueFlush,
  saveSnapshot,
  splitSqlStatements,
  type SqliteDb,
} from './sqliteSync';
import schemaSql from './schema.sql?raw';

// ---------------------------------------------------------------------------
// In-memory FakeDb: понимает BEGIN/COMMIT/ROLLBACK, DELETE FROM, INSERT INTO
// (колонки + ?-бинды) и SELECT ... FROM <table>. Проверяет симметрию SQL
// saveSnapshot/loadSnapshot без нативного SQLite.
// ---------------------------------------------------------------------------

class FakeDb implements SqliteDb {
  rows = new Map<string, Record<string, unknown>[]>();
  backup: Map<string, Record<string, unknown>[]> | null = null;
  begins = 0;
  commits = 0;

  async execute(query: string, bindValues: unknown[] = []): Promise<unknown> {
    const q = query.trim();
    const up = q.toUpperCase();
    if (up === 'BEGIN') {
      this.begins++;
      this.backup = new Map(
        [...this.rows.entries()].map(([k, v]) => [k, v.map((r) => ({ ...r }))]),
      );
      return 0;
    }
    if (up === 'COMMIT') {
      this.commits++;
      this.backup = null;
      return 0;
    }
    if (up === 'ROLLBACK') {
      if (this.backup) {
        this.rows = this.backup;
        this.backup = null;
      }
      return 0;
    }
    const del = /^DELETE FROM\s+(\w+)/i.exec(q);
    if (del) {
      this.rows.set(del[1], []);
      return 0;
    }
    const ins = /^INSERT INTO\s+(\w+)\s*\(([^)]+)\)/i.exec(q);
    if (ins) {
      const cols = ins[2].split(',').map((c) => c.trim());
      const row: Record<string, unknown> = {};
      cols.forEach((c, i) => {
        row[c] = bindValues[i];
      });
      const arr = this.rows.get(ins[1]) ?? [];
      arr.push(row);
      this.rows.set(ins[1], arr);
      return 0;
    }
    // PRAGMA / CREATE TABLE — no-op для фейка.
    return 0;
  }

  async select<T>(query: string, _bindValues?: unknown[]): Promise<T> {
    const m = /FROM\s+(\w+)/i.exec(query);
    const arr = (m ? (this.rows.get(m[1]) ?? []) : []).map((r) => ({ ...r }));
    return arr as unknown as T;
  }
}

function emptyState(): DbState {
  return {
    students: [],
    operations: [],
    reasons: [],
    teachers: [],
    groups: [],
    group_members: [],
    presets: [],
  };
}

// ---------------------------------------------------------------------------
// splitSqlStatements
// ---------------------------------------------------------------------------

describe('splitSqlStatements', () => {
  it('бьёт реальный schema.sql: PRAGMA + CREATE + идемпотентные сиды', () => {
    const stmts = splitSqlStatements(schemaSql);
    // 2 PRAGMA + 7 CREATE + 10 сидов + user_version
    expect(stmts).toHaveLength(20);
    expect(stmts.every((s) => s.length > 0)).toBe(true);
    expect(stmts.filter((s) => s.startsWith('PRAGMA'))).toHaveLength(3);
    expect(stmts.filter((s) => s.startsWith('CREATE TABLE'))).toHaveLength(7);
    expect(stmts.filter((s) => s.startsWith('INSERT INTO'))).toHaveLength(10);
    expect(stmts).toContain('PRAGMA user_version = 1');
    expect(stmts.some((s) => s.includes('CREATE TABLE IF NOT EXISTS operation_presets'))).toBe(
      true,
    );
    // Сиды идемпотентны — без голых VALUES-INSERT.
    expect(stmts.filter((s) => s.startsWith('INSERT INTO'))).toSatisfy((arr) =>
      (arr as string[]).every((s) => s.includes('WHERE NOT EXISTS')),
    );
  });

  it('не рвёт на ";" внутри строкового литерала', () => {
    const stmts = splitSqlStatements(
      "INSERT INTO t (a) VALUES ('a;b'); SELECT 1;",
    );
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain("'a;b'");
  });

  it('не рвёт на ";" внутри -- комментария и /* */ блока', () => {
    expect(splitSqlStatements('-- foo; bar\nSELECT 1;')).toEqual(['SELECT 1']);
    expect(splitSqlStatements('/* a; b */ SELECT 1;')).toEqual(['SELECT 1']);
  });

  it("понимает ''-эскейп внутри строк", () => {
    const stmts = splitSqlStatements("SELECT 'it''s; ok'; SELECT 2;");
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toBe("SELECT 'it''s; ok'");
  });

  it('пустые фрагменты и чистые комментарии выкидывает', () => {
    expect(splitSqlStatements('')).toEqual([]);
    expect(splitSqlStatements('-- only a comment\n/* block */')).toEqual([]);
    expect(splitSqlStatements(';; SELECT 1;;')).toEqual(['SELECT 1']);
  });
});

// ---------------------------------------------------------------------------
// mergeOnBoot (4 кейса)
// ---------------------------------------------------------------------------

describe('mergeOnBoot', () => {
  const op = {
    id: 'op1',
    student_id: 's1',
    op_type: 'accrual',
    amount: 5,
    reason_id: null,
    comment: '',
    author_name: '',
    source_op_type: null,
    idempotency_key: 'k1',
    correction_of_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
  } as const;

  it('1. sqlite пуст, local непуст → миграция local→sqlite', () => {
    const local: DbState = {
      ...emptyState(),
      students: [
        {
          id: 's1',
          first_name: '',
          last_name: '',
          patronymic: '',
          full_name: 'Иванов Иван',
          group_name: '',
          parent_phone: '',
          birth_date: '',
          balance: 5,
          status: 'active',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      operations: [{ ...op }],
    };
    expect(mergeOnBoot(emptyState(), local)).toBe(local);
  });

  it('2. оба непусты → приоритет sqlite (файл — правда)', () => {
    const mkStudent = (id: string, full_name: string, balance: number): DbState['students'][number] => ({
      id,
      first_name: '',
      last_name: '',
      patronymic: '',
      full_name,
      group_name: '',
      parent_phone: '',
      birth_date: '',
      balance,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    const sqlite: DbState = { ...emptyState(), students: [mkStudent('a', 'A', 1)] };
    const local: DbState = { ...emptyState(), students: [mkStudent('b', 'B', 2)] };
    expect(mergeOnBoot(sqlite, local)).toBe(sqlite);
  });

  it('3. оба пусты → sqlite (ничего мигрировать)', () => {
    const sqlite = emptyState();
    expect(mergeOnBoot(sqlite, emptyState())).toBe(sqlite);
  });

  it('4. local пуст, sqlite полон → sqlite', () => {
    const sqlite: DbState = { ...emptyState(), operations: [{ ...op }] };
    expect(mergeOnBoot(sqlite, emptyState())).toBe(sqlite);
  });
});

// ---------------------------------------------------------------------------
// saveSnapshot / loadSnapshot round-trip на FakeDb
// ---------------------------------------------------------------------------

describe('saveSnapshot/loadSnapshot', () => {
  it('round-trip сохраняет всё состояние, is_active 1/0→bool', async () => {
    const repo = createLocalRepo();
    repo.reset();
    const s = repo.createStudent({ full_name: 'Иванов Иван Иванович', group_name: 'G1' });
    repo.addOperation({ student_id: s.id, op_type: 'accrual', amount: 10, reason_id: 1 });
    repo.createPreset({ label: 'Быстро', amount: 5, reason_id: 1 });
    const snapshot = repo.getSnapshot();

    const db = new FakeDb();
    await saveSnapshot(db, snapshot);
    expect(db.begins).toBe(1);
    expect(db.commits).toBe(1);

    const loaded = await loadSnapshot(db);
    expect(loaded).toEqual(snapshot);
  });

  it('saveSnapshot атомарен: при ошибке — ROLLBACK', async () => {
    const repo = createLocalRepo();
    repo.reset();
    const s = repo.createStudent({ full_name: 'Иванов Иван Иванович' });
    repo.addOperation({ student_id: s.id, op_type: 'accrual', amount: 7 });

    const db = new FakeDb();
    await saveSnapshot(db, repo.getSnapshot());
    const before = await loadSnapshot(db);

    const failing: SqliteDb = {
      execute: async (q: string, b?: unknown[]) => {
        if (/^INSERT INTO\s+operations/i.test(q.trim())) throw new Error('boom');
        return db.execute(q, b);
      },
      select: <T>(q: string, b?: unknown[]): Promise<T> => db.select<T>(q, b),
    };
    await expect(saveSnapshot(failing, repo.getSnapshot())).rejects.toThrow('boom');
    expect(await loadSnapshot(db)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// getSnapshot / replaceAll
// ---------------------------------------------------------------------------

describe('localRepo snapshots (WP1)', () => {
  it('round-trip: состояние сохраняется, инварианты живы после replaceAll', () => {
    const repo = createLocalRepo();
    repo.reset();
    const s = repo.createStudent({ full_name: 'Иванов Иван Иванович', group_name: 'G1' });
    repo.addOperation({ student_id: s.id, op_type: 'accrual', amount: 15, reason_id: 1 });
    repo.createPreset({ label: 'Быстро', amount: 5, reason_id: 1 });

    const snap = repo.getSnapshot();
    const repo2 = createLocalRepo();
    repo2.replaceAll(snap);

    expect(repo2.getStudent(s.id)?.balance).toBe(15);
    expect(repo2.listOperations()).toHaveLength(1);
    expect(repo2.listPresets()).toHaveLength(1);
    expect(repo2.listGroups()).toEqual([{ name: 'G1', count: 1 }]);

    // Инварианты живы: операция после replaceAll работает и пересчитывает баланс.
    repo2.addOperation({ student_id: s.id, op_type: 'write_off', amount: 5 });
    expect(repo2.getStudent(s.id)?.balance).toBe(10);
    expect(() =>
      repo2.addOperation({ student_id: s.id, op_type: 'write_off', amount: 11 }),
    ).toThrow();
  });

  it('getSnapshot — глубокая копия (мутация копии не трогает репо)', () => {
    const repo = createLocalRepo();
    repo.reset();
    const s = repo.createStudent({ full_name: 'Иванов Иван Иванович' });
    const snap = repo.getSnapshot();
    snap.students.length = 0;
    expect(repo.getStudent(s.id)).not.toBeNull();
  });

  it('replaceAll валидирует как importJson', () => {
    const repo = createLocalRepo();
    repo.reset();
    expect(() => repo.replaceAll({ students: 'x', operations: [] } as unknown as DbState)).toThrow(
      /missing students\/operations arrays/,
    );
    // Пустые reasons/teachers откатываются на сиды.
    repo.replaceAll({ ...emptyState() });
    expect(repo.listReasons().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// queueFlush / flushNow
// ---------------------------------------------------------------------------

describe('queueFlush/flushNow', () => {
  beforeEach(async () => {
    await flushNow(); // осушить очередь между тестами
    vi.useRealTimers();
  });

  it('пачка queueFlush схлопывается в один saveSnapshot, flushNow пишет сразу', async () => {
    const repo = createLocalRepo();
    repo.reset();
    const s = repo.createStudent({ full_name: 'Иванов Иван Иванович' });
    repo.addOperation({ student_id: s.id, op_type: 'accrual', amount: 9 });

    const db = new FakeDb();
    queueFlush(db, repo.getSnapshot(), 20);
    queueFlush(db, repo.getSnapshot(), 20);
    queueFlush(db, repo.getSnapshot(), 20);
    await flushNow(); // сброс до срабатывания таймера
    expect(db.begins).toBe(1);
    expect(await loadSnapshot(db)).toEqual(repo.getSnapshot());
  });

  it('дебаунс: без flushNow запись происходит один раз после паузы', async () => {
    const repo = createLocalRepo();
    repo.reset();
    repo.createStudent({ full_name: 'Петров Пётр Петрович' });
    const db = new FakeDb();
    queueFlush(db, () => repo.getSnapshot(), 10);
    queueFlush(db, () => repo.getSnapshot(), 10);
    await new Promise((r) => setTimeout(r, 60));
    expect(db.begins).toBe(1);
    expect((await loadSnapshot(db)).students).toHaveLength(1);
    await flushNow();
  });
});
