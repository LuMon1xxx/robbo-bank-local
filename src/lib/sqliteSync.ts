/**
 * robbo-bank-local · SQLite sync (WP1).
 *
 * Write-through кэш: память (синхронный localRepo) + SQLite-файл
 * (долговременное хранилище через @tauri-apps/plugin-sql).
 *
 * - splitSqlStatements — чистая: бьёт schema.sql на отдельные стейтменты.
 * - loadSnapshot/saveSnapshot — чтение/полная перезапись всех таблиц.
 * - mergeOnBoot — чистая: выбор стартового состояния при загрузке.
 * - queueFlush/flushNow — дебаунс записи (saveSnapshot — полный rewrite,
 *   строк сотни, это миллисекунды, но клики идут пачками).
 */
import type {
  DbState,
  Operation,
  OperationPreset,
  ReasonTemplate,
  Student,
  Teacher,
} from './localRepo';

/** Минимальный структурный интерфейс БД, совместимый с plugin-sql Database. */
export interface SqliteDb {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

// ---------------------------------------------------------------------------
// splitSqlStatements
// ---------------------------------------------------------------------------

/**
 * Разбивает SQL-текст на отдельные стейтменты по ';' вне строковых
 * литералов ('...', "...", `...`, с ''/""/``-эскейпами) и вне комментариев
 * (-- до конца строки, /* ... *\/). Сами комментарии из результата
 * выкидываются; пустые фрагменты выкидываются; ';' не возвращается.
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  const push = () => {
    const stmt = buf.trim();
    buf = '';
    if (stmt) out.push(stmt);
  };

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        buf += ch;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'") {
        if (next === "'") {
          buf += next;
          i++;
        } else {
          inSingle = false;
        }
      }
      continue;
    }
    if (inDouble) {
      buf += ch;
      if (ch === '"') {
        if (next === '"') {
          buf += next;
          i++;
        } else {
          inDouble = false;
        }
      }
      continue;
    }
    if (inBacktick) {
      buf += ch;
      if (ch === '`') {
        if (next === '`') {
          buf += next;
          i++;
        } else {
          inBacktick = false;
        }
      }
      continue;
    }
    // Вне строк и комментариев:
    if (ch === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      continue;
    }
    if (ch === '`') {
      inBacktick = true;
      buf += ch;
      continue;
    }
    if (ch === ';') {
      push();
      continue;
    }
    buf += ch;
  }
  push();
  return out;
}

// ---------------------------------------------------------------------------
// loadSnapshot
// ---------------------------------------------------------------------------

interface ReasonRow {
  id: number;
  label: string;
  kind: string;
  default_amount: number;
  is_active: number;
}

interface TeacherRow {
  id: number;
  name: string;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  full_name: string;
  group_name: string;
  parent_phone: string;
  birth_date: string;
  balance: number;
  status: string;
  created_at: string;
}

interface OperationRow {
  id: string;
  student_id: string;
  op_type: string;
  amount: number;
  reason_id: number | null;
  comment: string;
  author_name: string;
  source_op_type: string | null;
  idempotency_key: string;
  correction_of_id: string | null;
  created_at: string;
}

interface GroupRow {
  id: number;
  name: string;
  weekday: string | null;
  time: string | null;
}

interface GroupMemberRow {
  student_id: string;
  group_name: string;
}

interface PresetRow {
  id: string;
  label: string;
  amount: number;
  reason_id: number | null;
}

/** Читает все таблицы SQLite в DbState. is_active 1/0 → boolean. */
export async function loadSnapshot(db: SqliteDb): Promise<DbState> {
  const [studentRows, operationRows, reasonRows, teacherRows, groupRows, memberRows, presetRows] =
    await Promise.all([
      db.select<StudentRow[]>(
        'SELECT id, first_name, last_name, patronymic, full_name, group_name, parent_phone, birth_date, balance, status, created_at FROM students ORDER BY rowid',
      ),
      db.select<OperationRow[]>(
        'SELECT id, student_id, op_type, amount, reason_id, comment, author_name, source_op_type, idempotency_key, correction_of_id, created_at FROM operations ORDER BY rowid',
      ),
      db.select<ReasonRow[]>(
        'SELECT id, label, kind, default_amount, is_active FROM reason_templates ORDER BY rowid',
      ),
      db.select<TeacherRow[]>('SELECT id, name FROM teachers ORDER BY rowid'),
      db.select<GroupRow[]>('SELECT id, name, weekday, time FROM groups ORDER BY rowid'),
      db.select<GroupMemberRow[]>('SELECT student_id, group_name FROM group_members ORDER BY rowid'),
      db.select<PresetRow[]>(
        'SELECT id, label, amount, reason_id FROM operation_presets ORDER BY rowid',
      ),
    ]);

  const students: Student[] = studentRows.map((r) => ({
    id: r.id,
    first_name: r.first_name ?? '',
    last_name: r.last_name ?? '',
    patronymic: r.patronymic ?? '',
    full_name: r.full_name,
    group_name: r.group_name ?? '',
    parent_phone: r.parent_phone ?? '',
    birth_date: r.birth_date ?? '',
    balance: Number(r.balance),
    status: r.status as Student['status'],
    created_at: r.created_at,
  }));

  const operations: Operation[] = operationRows.map((r) => ({
    id: r.id,
    student_id: r.student_id,
    op_type: r.op_type as Operation['op_type'],
    amount: Number(r.amount),
    reason_id: r.reason_id ?? null,
    comment: r.comment ?? '',
    author_name: r.author_name ?? '',
    source_op_type: (r.source_op_type ?? null) as Operation['source_op_type'],
    idempotency_key: r.idempotency_key,
    correction_of_id: r.correction_of_id ?? null,
    created_at: r.created_at,
  }));

  const reasons: ReasonTemplate[] = reasonRows.map((r) => ({
    id: Number(r.id),
    label: r.label,
    kind: r.kind as ReasonTemplate['kind'],
    default_amount: Number(r.default_amount),
    is_active: Number(r.is_active) === 1,
  }));

  const teachers: Teacher[] = teacherRows.map((r) => ({ id: Number(r.id), name: r.name }));

  const presets: OperationPreset[] = presetRows.map((r) => ({
    id: r.id,
    label: r.label,
    amount: Number(r.amount),
    reason_id: r.reason_id ?? null,
  }));

  return {
    students,
    operations,
    reasons,
    teachers,
    groups: groupRows.map((g) => ({
      id: Number(g.id),
      name: g.name,
      weekday: g.weekday ?? '',
      time: g.time ?? '',
    })),
    group_members: memberRows.map((m) => ({ student_id: m.student_id, group_name: m.group_name })),
    presets,
  };
}

// ---------------------------------------------------------------------------
// saveSnapshot
// ---------------------------------------------------------------------------

/**
 * Полная перезапись всех таблиц в одной транзакции:
 * BEGIN → DELETE всех таблиц → INSERT всех строк → COMMIT.
 * При любой ошибке — ROLLBACK и проброс исключения.
 * Строк сотни — это миллисекунды.
 */
export async function saveSnapshot(db: SqliteDb, state: DbState): Promise<void> {
  await db.execute('BEGIN');
  try {
    // Удаление — с учётом FK: сначала дочерние таблицы.
    await db.execute('DELETE FROM operations');
    await db.execute('DELETE FROM group_members');
    await db.execute('DELETE FROM operation_presets');
    await db.execute('DELETE FROM students');
    await db.execute('DELETE FROM groups');
    await db.execute('DELETE FROM reason_templates');
    await db.execute('DELETE FROM teachers');

    // Вставка — наоборот: сначала родители (operations ссылаются
    // на students/reason_templates, presets — на reason_templates).
    for (const t of state.teachers) {
      await db.execute('INSERT INTO teachers (id, name) VALUES (?, ?)', [t.id, t.name]);
    }
    for (const r of state.reasons) {
      await db.execute(
        'INSERT INTO reason_templates (id, label, kind, default_amount, is_active) VALUES (?, ?, ?, ?, ?)',
        [r.id, r.label, r.kind, r.default_amount, r.is_active ? 1 : 0],
      );
    }
    for (const s of state.students) {
      await db.execute(
        'INSERT INTO students (id, first_name, last_name, patronymic, full_name, group_name, parent_phone, birth_date, balance, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          s.id,
          s.first_name,
          s.last_name,
          s.patronymic,
          s.full_name,
          s.group_name,
          s.parent_phone,
          s.birth_date,
          s.balance,
          s.status,
          s.created_at,
        ],
      );
    }
    for (const g of state.groups) {
      await db.execute('INSERT INTO groups (id, name, weekday, time) VALUES (?, ?, ?, ?)', [
        g.id,
        g.name,
        g.weekday ?? '',
        g.time ?? '',
      ]);
    }
    for (const m of state.group_members) {
      await db.execute('INSERT INTO group_members (student_id, group_name) VALUES (?, ?)', [
        m.student_id,
        m.group_name,
      ]);
    }
    for (const o of state.operations) {
      await db.execute(
        'INSERT INTO operations (id, student_id, op_type, amount, reason_id, comment, author_name, source_op_type, idempotency_key, correction_of_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          o.id,
          o.student_id,
          o.op_type,
          o.amount,
          o.reason_id,
          o.comment,
          o.author_name,
          o.source_op_type,
          o.idempotency_key,
          o.correction_of_id,
          o.created_at,
        ],
      );
    }
    for (const p of state.presets) {
      await db.execute(
        'INSERT INTO operation_presets (id, label, amount, reason_id) VALUES (?, ?, ?, ?)',
        [p.id, p.label, p.amount, p.reason_id],
      );
    }
    await db.execute('COMMIT');
  } catch (e) {
    try {
      await db.execute('ROLLBACK');
    } catch {
      // ROLLBACK best-effort: исходная ошибка важнее.
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// mergeOnBoot
// ---------------------------------------------------------------------------

/**
 * Чистая: выбор стартового состояния при загрузке.
 * - SQLite пустой (0 учеников И 0 операций), а local непустой
 *   (есть ученики ИЛИ операции) → вернуть local (разовая миграция
 *   localStorage → SQLite; вызыватель после этого делает saveSnapshot).
 * - Иначе → вернуть sqlite (файл — источник правды).
 * Возвращает одну из входных ссылок без копирования.
 */
export function mergeOnBoot(sqlite: DbState, local: DbState): DbState {
  const sqliteEmpty = sqlite.students.length === 0 && sqlite.operations.length === 0;
  const localNonEmpty = local.students.length > 0 || local.operations.length > 0;
  if (sqliteEmpty && localNonEmpty) return local;
  return sqlite;
}

// ---------------------------------------------------------------------------
// queueFlush / flushNow (дебаунс записи)
// ---------------------------------------------------------------------------

const DEFAULT_FLUSH_DELAY_MS = 500;

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingDb: SqliteDb | null = null;
let pendingSrc: DbState | (() => DbState) | null = null;
let flushInFlight: Promise<void> | null = null;
let dirtyWhileFlushing = false;

async function runFlush(): Promise<void> {
  const db = pendingDb;
  const src = pendingSrc;
  pendingDb = null;
  pendingSrc = null;
  if (!db || !src) return;
  const snapshot: DbState = typeof src === 'function' ? (src as () => DbState)() : src;
  flushInFlight = saveSnapshot(db, snapshot);
  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
  }
  if (dirtyWhileFlushing) {
    dirtyWhileFlushing = false;
    await runFlush();
  }
}

/**
 * Поставить запись в очередь: быстрые пачки кликов схлопываются
 * в один saveSnapshot через `delayMs` (дефолт 500мс).
 * Принимает готовый снапшот или геттер (геттер читается в момент записи).
 */
export function queueFlush(
  db: SqliteDb,
  stateOrGet: DbState | (() => DbState),
  delayMs = DEFAULT_FLUSH_DELAY_MS,
): void {
  pendingDb = db;
  pendingSrc = stateOrGet;
  if (flushInFlight) {
    dirtyWhileFlushing = true;
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void runFlush().catch((e: unknown) => {
      console.warn('[sqliteSync] deferred flush failed:', e);
    });
  }, delayMs);
}

/**
 * Синхронно-ожидаемый сброс очереди: отменяет таймер и пишет сейчас.
 * Используется на выходе из приложения (окно потери закрыто) и в
 * автобэкапе перед чтением файла. Ошибки пробрасываются вызывателю.
 */
export async function flushNow(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (flushInFlight) await flushInFlight;
  await runFlush();
}
