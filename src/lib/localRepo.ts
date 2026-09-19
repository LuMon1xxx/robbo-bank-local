/**
 * robbo-bank-local · LocalRepo (WP0)
 *
 * TODO TAURI: swap the storage adapter below to `tauri-plugin-sql`
 * (`Database.load('sqlite:robbo.db')` + `execute`/`select`) and apply
 * `src/lib/schema.sql` on bootstrap. The public interface + invariants
 * in this file MUST stay unchanged so WP1 can build on top of it.
 *
 * Current fallback: persistent `localStorage` in the browser, in-memory
 * Map when `localStorage` is unavailable (vitest / node / SSR).
 */

export type StudentStatus = 'active' | 'archived';
export type OpType = 'accrual' | 'write_off' | 'reversal';
export type ReasonKind = 'accrual' | 'write_off' | 'any';

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  full_name: string;
  group_name: string;
  parent_phone: string;
  birth_date: string;
  balance: number;
  status: StudentStatus;
  created_at: string;
}

export interface Operation {
  id: string;
  student_id: string;
  op_type: OpType;
  amount: number;
  reason_id: number | null;
  comment: string;
  author_name: string;
  source_op_type: 'accrual' | 'write_off' | null;
  idempotency_key: string;
  correction_of_id: string | null;
  created_at: string;
}

export interface ReasonTemplate {
  id: number;
  label: string;
  kind: ReasonKind;
  default_amount: number;
  is_active: boolean;
}

export interface Teacher {
  id: number;
  name: string;
}

export interface OperationPreset {
  id: string;
  label: string;
  amount: number;
  reason_id: number | null;
}

export interface CreateStudentInput {
  first_name?: string;
  last_name?: string;
  patronymic?: string;
  full_name: string;
  group_name?: string;
  parent_phone?: string;
  birth_date?: string;
}

export interface AddOperationInput {
  student_id: string;
  op_type: 'accrual' | 'write_off';
  amount: number;
  reason_id?: number | null;
  comment?: string;
  author_name?: string;
  idempotency_key?: string;
}

export interface BulkAccrualItem {
  student_id: string;
  amount: number;
  reason_id?: number | null;
  comment?: string;
  author_name?: string;
  idempotency_key?: string;
}

export interface UpdateStudentInput {
  first_name?: string;
  last_name?: string;
  patronymic?: string;
  full_name?: string;
  group_name?: string;
  parent_phone?: string;
  birth_date?: string;
}

export interface GroupInfo {
  name: string;
  /** Число активных учеников в группе. */
  count: number;
  /** День недели занятий ('' = не задан). */
  weekday: string;
  /** Время занятий HH:MM ('' = не задано). */
  time: string;
}

/** Дни недели для расписания групп. */
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

/** «Пн 18:00» / «Пн» / «18:00» / '' — для чипов и списков. */
export function formatGroupSchedule(g: Pick<GroupInfo, 'weekday' | 'time'>): string {
  return [g.weekday, g.time].filter(Boolean).join(' ');
}

export interface LocalRepo {
  createStudent(input: CreateStudentInput): Student;
  /** WP1: редактирование карточки (баланс/статус/история не трогает). */
  updateStudent(id: string, input: UpdateStudentInput): Student;
  listStudents(filter?: { status?: StudentStatus; group_name?: string }): Student[];
  getStudent(id: string): Student | null;
  archiveStudent(id: string): Student;
  /** WP1: вернуть ученика из архива. */
  restoreStudent(id: string): Student;
  addOperation(input: AddOperationInput): Operation;
  reverseOperation(operationId: string, author_name?: string): Operation;
  bulkAccrual(items: BulkAccrualItem[]): Operation[];
  listOperations(filter?: { student_id?: string; op_type?: OpType }): Operation[];
  listReasons(): ReasonTemplate[];
  /** WP4: шаблоны операций (пресеты быстрого начисления). */
  listPresets(): OperationPreset[];
  createPreset(input: { label: string; amount: number; reason_id?: number | null }): OperationPreset;
  updatePreset(id: string, input: { label: string; amount: number; reason_id?: number | null }): OperationPreset;
  deletePreset(id: string): void;
  exportJson(): string;
  importJson(json: string): void;
  /** WP1: глубокая копия всего состояния (для SQLite-снапшотов). */
  getSnapshot(): DbState;
  /** WP1: полная замена состояния с валидацией (как importJson). */
  replaceAll(state: DbState): void;
  /** Test/support helper: wipe all rows and re-seed. */
  reset(): void;
  // ---- WP2: группы (локальная single-group модель: group_name + group_members) ----
  /** Все группы (явные + встреченные в group_name), с числом активных учеников. */
  listGroups(): GroupInfo[];
  /** Создать пустую группу (название + необязательное расписание). */
  createGroup(
    name: string,
    schedule?: { weekday?: string; time?: string },
  ): { id: number; name: string; weekday: string; time: string };
  /** Расписание существующей группы (создаёт строку, если группа была виртуальной). */
  setGroupSchedule(name: string, schedule: { weekday?: string; time?: string }): void;
  /** Переименовать группу: groups + students.group_name + group_members. */
  renameGroup(oldName: string, newName: string): void;
  /** Удалить группу: ученики остаются, group_name сбрасывается в ''. */
  deleteGroup(name: string): void;
  /** Добавить ученика в группу (смена group_name + запись group_members). */
  addGroupMember(student_id: string, group_name: string): Student;
  /** Убрать ученика из группы (group_name='' + чистка group_members). */
  removeGroupMember(student_id: string): Student;
  /** Перенос ученика сменой группы ('' = без группы). */
  moveStudent(student_id: string, new_group_name: string): Student;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ---------------------------------------------------------------------------
// Seed data (mirrors schema.sql seeds; used by every adapter)
// ---------------------------------------------------------------------------

const SEED_TEACHERS: Teacher[] = [
  { id: 1, name: 'Учитель 1' },
  { id: 2, name: 'Учитель 2' },
];

const SEED_REASONS: ReasonTemplate[] = [
  { id: 1, label: 'За занятие', kind: 'accrual', default_amount: 4, is_active: true },
  { id: 2, label: 'Активность', kind: 'accrual', default_amount: 5, is_active: true },
  { id: 3, label: 'Прочее', kind: 'any', default_amount: 5, is_active: true },
  { id: 4, label: 'Конкурс', kind: 'accrual', default_amount: 20, is_active: true },
  { id: 5, label: 'Привёл друга', kind: 'accrual', default_amount: 15, is_active: true },
  { id: 6, label: 'Олимпиада', kind: 'accrual', default_amount: 30, is_active: true },
  { id: 7, label: 'Штраф', kind: 'write_off', default_amount: 5, is_active: true },
  { id: 8, label: 'Нарушение', kind: 'write_off', default_amount: 10, is_active: true },
];

export interface DbState {
  students: Student[];
  operations: Operation[];
  reasons: ReasonTemplate[];
  teachers: Teacher[];
  groups: { id: number; name: string; weekday: string; time: string }[];
  group_members: { student_id: string; group_name: string }[];
  presets: OperationPreset[];
}

function seededState(): DbState {
  return {
    students: [],
    operations: [],
    reasons: SEED_REASONS.map((r) => ({ ...r })),
    teachers: SEED_TEACHERS.map((t) => ({ ...t })),
    groups: [],
    group_members: [],
    presets: [],
  };
}

// ---------------------------------------------------------------------------
// Storage adapter (localStorage with in-memory fallback)
// TODO TAURI: replace with tauri-plugin-sql Database adapter.
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'robbo-bank-local:v1';

function loadState(): DbState {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as DbState;
      if (Array.isArray(parsed.students) && Array.isArray(parsed.operations)) {
        return {
          ...seededState(),
          ...parsed,
          reasons:
            parsed.reasons && parsed.reasons.length > 0
              ? parsed.reasons
              : seededState().reasons,
          teachers:
            parsed.teachers && parsed.teachers.length > 0
              ? parsed.teachers
              : seededState().teachers,
          presets: Array.isArray(parsed.presets) ? parsed.presets : [],
        };
      }
    }
  } catch {
    // fall through to seeded in-memory state
  }
  return seededState();
}

function saveState(state: DbState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // non-fatal: keep in-memory state only
  }
}

/** Глубокая копия снапшота (состояние JSON-сериализуемо). */
function cloneState(state: DbState): DbState {
  return JSON.parse(JSON.stringify(state)) as DbState;
}

/**
 * Нормализация входящего снапшота (общая для importJson/replaceAll):
 * students/operations обязательны, пустые reasons/teachers откатываются
 * на сиды, остальное — на []. `source` — префикс текста ошибок
 * ('importJson' — legacy-сообщения сохраняет RU-маппинг в ui-validation).
 */
function normalizeSnapshot(parsed: DbState, source: string): DbState {
  if (!Array.isArray(parsed.students) || !Array.isArray(parsed.operations)) {
    throw new ValidationError(`${source}: missing students/operations arrays`);
  }
  return {
    students: parsed.students,
    operations: parsed.operations,
    reasons:
      parsed.reasons && parsed.reasons.length > 0 ? parsed.reasons : seededState().reasons,
    teachers:
      parsed.teachers && parsed.teachers.length > 0 ? parsed.teachers : seededState().teachers,
    groups: (parsed.groups ?? []).map((g) => ({
      id: Number(g.id) || 0,
      name: typeof g.name === 'string' ? g.name : '',
      weekday: typeof g.weekday === 'string' ? g.weekday : '',
      time: typeof g.time === 'string' ? g.time : '',
    })),
    group_members: parsed.group_members ?? [],
    presets: parsed.presets ?? [],
  };
}

// ---------------------------------------------------------------------------
// Внешний флашер (WP1: write-through в SQLite-файл)
// ---------------------------------------------------------------------------

/** Дефолт — no-op: в браузере данные живут только в localStorage. */
let externalFlusher: (s: DbState) => void = () => {};

/**
 * Подключить внешний флашер. Вызывается из persist() после записи
 * в localStorage. Tauri-bootstrap ставит сюда queueFlush в SQLite.
 */
export function setExternalFlusher(fn: (s: DbState) => void): void {
  externalFlusher = fn;
}

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Invariant validators (shared by single + bulk paths)
// ---------------------------------------------------------------------------

export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 100000;
export const MAX_GROUP_LEN = 10;

export function assertAmount(amount: unknown): asserts amount is number {
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    throw new ValidationError('amount must be an integer');
  }
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    throw new ValidationError(`amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}`);
  }
}

function assertFullName(full_name: unknown): asserts full_name is string {
  if (typeof full_name !== 'string' || full_name.trim().length === 0) {
    throw new ValidationError('full_name is required');
  }
}

function assertGroupName(group_name: string): void {
  if (group_name.length > MAX_GROUP_LEN) {
    throw new ValidationError(`group_name must be at most ${MAX_GROUP_LEN} characters`);
  }
}

/** Расписание необязательно, но если задано — строго день из списка и время ЧЧ:ММ. */
function assertGroupSchedule(schedule: { weekday?: string; time?: string }): {
  weekday: string;
  time: string;
} {
  const weekday = (schedule.weekday ?? '').trim();
  const time = (schedule.time ?? '').trim();
  if (weekday !== '' && !(WEEKDAYS as readonly string[]).includes(weekday)) {
    throw new ValidationError(`group weekday must be one of ${WEEKDAYS.join(', ')}`);
  }
  if (time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new ValidationError('group time must be HH:MM');
  }
  return { weekday, time };
}

function findReason(reasons: ReasonTemplate[], reason_id: number | null): ReasonTemplate {
  const reason = reasons.find((r) => r.id === reason_id);
  if (!reason) throw new ValidationError(`unknown reason_id: ${reason_id}`);
  return reason;
}

function assertReasonCompatible(reason: ReasonTemplate, op_type: 'accrual' | 'write_off'): void {
  if (reason.kind !== 'any' && reason.kind !== op_type) {
    throw new ValidationError(
      `reason "${reason.label}" cannot be used for ${op_type}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export function createLocalRepo(): LocalRepo {
  let state: DbState = loadState();
  const persist = () => {
    saveState(state);
    externalFlusher(cloneState(state));
  };

  const getStudentOrThrow = (id: string): Student => {
    const s = state.students.find((x) => x.id === id);
    if (!s) throw new ValidationError(`unknown student_id: ${id}`);
    return s;
  };

  const ensureGroupRow = (name: string): void => {
    if (!state.groups.some((g) => g.name === name)) {
      const nextId = state.groups.reduce((m, g) => Math.max(m, g.id), 0) + 1;
      state.groups.push({ id: nextId, name, weekday: '', time: '' });
    }
  };

  /** Зеркало single-group модели в group_members: одна запись на ученика. */
  const syncMember = (student_id: string, group_name: string): void => {
    state.group_members = state.group_members.filter((m) => m.student_id !== student_id);
    if (group_name) state.group_members.push({ student_id, group_name });
  };

  function assertGroupTitle(name: string): string {
    const title = name.trim();
    if (title.length === 0) throw new ValidationError('group_name is required');
    assertGroupName(title);
    return title;
  }

  return {
    createStudent(input: CreateStudentInput): Student {
      assertFullName(input.full_name);
      const group_name = (input.group_name ?? '').trim();
      assertGroupName(group_name);
      const student: Student = {
        id: newId(),
        first_name: input.first_name ?? '',
        last_name: input.last_name ?? '',
        patronymic: input.patronymic ?? '',
        full_name: input.full_name.trim(),
        group_name,
        parent_phone: input.parent_phone ?? '',
        birth_date: input.birth_date ?? '',
        balance: 0,
        status: 'active',
        created_at: nowIso(),
      };
      state.students.push(student);
      if (group_name) {
        ensureGroupRow(group_name);
        syncMember(student.id, group_name);
      }
      persist();
      return { ...student };
    },

    listStudents(filter?: { status?: StudentStatus; group_name?: string }): Student[] {
      return state.students
        .filter((s) => (filter?.status ? s.status === filter.status : true))
        .filter((s) => (filter?.group_name ? s.group_name === filter.group_name : true))
        .map((s) => ({ ...s }));
    },

    getStudent(id: string): Student | null {
      const s = state.students.find((x) => x.id === id);
      return s ? { ...s } : null;
    },

    archiveStudent(id: string): Student {
      const s = getStudentOrThrow(id);
      s.status = 'archived';
      persist();
      return { ...s };
    },

    restoreStudent(id: string): Student {
      const s = getStudentOrThrow(id);
      s.status = 'active';
      persist();
      return { ...s };
    },

    updateStudent(id: string, input: UpdateStudentInput): Student {
      const s = getStudentOrThrow(id);
      if (input.full_name !== undefined) {
        assertFullName(input.full_name);
        s.full_name = input.full_name.trim();
      }
      if (input.first_name !== undefined) s.first_name = input.first_name;
      if (input.last_name !== undefined) s.last_name = input.last_name;
      if (input.patronymic !== undefined) s.patronymic = input.patronymic;
      if (input.group_name !== undefined) {
        const group_name = input.group_name.trim();
        assertGroupName(group_name);
        s.group_name = group_name;
        if (group_name) ensureGroupRow(group_name);
        syncMember(s.id, group_name);
      }
      if (input.parent_phone !== undefined) s.parent_phone = input.parent_phone;
      if (input.birth_date !== undefined) s.birth_date = input.birth_date;
      persist();
      return { ...s };
    },

    addOperation(input: AddOperationInput): Operation {
      assertAmount(input.amount);
      const student = getStudentOrThrow(input.student_id);
      if (student.status !== 'active') {
        throw new ValidationError('student is archived');
      }
      if (input.reason_id != null) {
        assertReasonCompatible(findReason(state.reasons, input.reason_id), input.op_type);
      }
      if (input.idempotency_key) {
        const existing = state.operations.find(
          (o) => o.idempotency_key === input.idempotency_key,
        );
        if (existing) return { ...existing };
      }
      if (input.op_type === 'write_off' && student.balance < input.amount) {
        throw new ValidationError('insufficient balance for write_off');
      }
      const op: Operation = {
        id: newId(),
        student_id: student.id,
        op_type: input.op_type,
        amount: input.amount,
        reason_id: input.reason_id ?? null,
        comment: input.comment ?? '',
        author_name: input.author_name ?? '',
        source_op_type: null,
        idempotency_key: input.idempotency_key ?? newId(),
        correction_of_id: null,
        created_at: nowIso(),
      };
      student.balance += input.op_type === 'accrual' ? input.amount : -input.amount;
      state.operations.push(op);
      persist();
      return { ...op };
    },

    reverseOperation(operationId: string, author_name?: string): Operation {
      const target = state.operations.find((o) => o.id === operationId);
      if (!target) throw new ValidationError(`unknown operation: ${operationId}`);
      if (target.op_type === 'reversal') {
        throw new ValidationError('cannot reverse a reversal operation');
      }
      const already = state.operations.find((o) => o.correction_of_id === target.id);
      if (already) {
        throw new ValidationError('operation was already reversed');
      }
      const student = getStudentOrThrow(target.student_id);
      if (student.status === 'archived') {
        throw new ValidationError('cannot reverse operation of an archived student');
      }
      // Reversal inverts the balance effect. Reversing an accrual may drive
      // the balance negative — that is allowed (no insufficient-funds check).
      const reversal: Operation = {
        id: newId(),
        student_id: student.id,
        op_type: 'reversal',
        amount: target.amount,
        reason_id: null,
        comment: `Reversal of ${target.id}`,
        author_name: author_name ?? '',
        source_op_type: target.op_type,
        idempotency_key: newId(),
        correction_of_id: target.id,
        created_at: nowIso(),
      };
      student.balance += target.op_type === 'accrual' ? -target.amount : target.amount;
      state.operations.push(reversal);
      persist();
      return { ...reversal };
    },

    bulkAccrual(items: BulkAccrualItem[]): Operation[] {
      // All-or-nothing: validate everything against a balance preview first.
      const preview = new Map<string, number>(
        state.students.map((s) => [s.id, s.balance]),
      );
      const seenKeys = new Set<string>();
      for (const item of items) {
        assertAmount(item.amount);
        if (!preview.has(item.student_id)) {
          throw new ValidationError(`unknown student_id: ${item.student_id}`);
        }
        const target = state.students.find((s) => s.id === item.student_id);
        if (target && target.status !== 'active') {
          throw new ValidationError(`student is archived: ${item.student_id}`);
        }
        if (item.reason_id != null) {
          assertReasonCompatible(findReason(state.reasons, item.reason_id), 'accrual');
        }
        if (item.idempotency_key) {
          if (seenKeys.has(item.idempotency_key)) {
            throw new ValidationError(`duplicate idempotency_key in bulk: ${item.idempotency_key}`);
          }
          seenKeys.add(item.idempotency_key);
          if (state.operations.some((o) => o.idempotency_key === item.idempotency_key)) {
            throw new ValidationError(
              `idempotency_key already exists: ${item.idempotency_key}`,
            );
          }
        }
        preview.set(item.student_id, (preview.get(item.student_id) ?? 0) + item.amount);
      }
      // All valid — apply.
      const created: Operation[] = items.map((item) => {
        const student = getStudentOrThrow(item.student_id);
        const op: Operation = {
          id: newId(),
          student_id: student.id,
          op_type: 'accrual',
          amount: item.amount,
          reason_id: item.reason_id ?? null,
          comment: item.comment ?? '',
          author_name: item.author_name ?? '',
          source_op_type: null,
          idempotency_key: item.idempotency_key ?? newId(),
          correction_of_id: null,
          created_at: nowIso(),
        };
        student.balance += item.amount;
        state.operations.push(op);
        return { ...op };
      });
      persist();
      return created;
    },

    listGroups(): GroupInfo[] {
      const names = new Set<string>();
      for (const g of state.groups) if (g.name) names.add(g.name);
      for (const s of state.students) if (s.group_name) names.add(s.group_name);
      const byName = new Map(state.groups.map((g) => [g.name, g]));
      const counts = new Map<string, number>();
      for (const s of state.students) {
        if (s.status !== 'active' || !s.group_name) continue;
        counts.set(s.group_name, (counts.get(s.group_name) ?? 0) + 1);
      }
      return [...names]
        .sort((a, b) => a.localeCompare(b, 'ru'))
        .map((name) => ({
          name,
          count: counts.get(name) ?? 0,
          weekday: byName.get(name)?.weekday ?? '',
          time: byName.get(name)?.time ?? '',
        }));
    },

    createGroup(
      name: string,
      schedule?: { weekday?: string; time?: string },
    ): { id: number; name: string; weekday: string; time: string } {
      const title = assertGroupTitle(name);
      const sched = assertGroupSchedule(schedule ?? {});
      if (state.groups.some((g) => g.name === title)) {
        throw new ValidationError(`group already exists: ${title}`);
      }
      // Группа может уже встречаться в students.group_name — просто материализуем строку.
      const nextId = state.groups.reduce((m, g) => Math.max(m, g.id), 0) + 1;
      const row = { id: nextId, name: title, ...sched };
      state.groups.push(row);
      persist();
      return { ...row };
    },

    setGroupSchedule(name: string, schedule: { weekday?: string; time?: string }): void {
      const title = name.trim();
      const sched = assertGroupSchedule(schedule);
      ensureGroupRow(title);
      const row = state.groups.find((g) => g.name === title);
      if (row) {
        row.weekday = sched.weekday;
        row.time = sched.time;
      }
      persist();
    },

    renameGroup(oldName: string, newName: string): void {
      const from = oldName.trim();
      const to = assertGroupTitle(newName);
      const exists =
        state.groups.some((g) => g.name === from) ||
        state.students.some((s) => s.group_name === from);
      if (!exists) throw new ValidationError(`unknown group: ${from}`);
      if (from !== to && state.groups.some((g) => g.name === to)) {
        throw new ValidationError(`group already exists: ${to}`);
      }
      if (from === to) return;
      const prev = state.groups.find((g) => g.name === from);
      ensureGroupRow(to);
      const target = state.groups.find((g) => g.name === to);
      if (target && prev) {
        target.weekday = prev.weekday ?? '';
        target.time = prev.time ?? '';
      }
      state.groups = state.groups.filter((g) => g.name !== from);
      for (const s of state.students) if (s.group_name === from) s.group_name = to;
      for (const m of state.group_members) if (m.group_name === from) m.group_name = to;
      persist();
    },

    deleteGroup(name: string): void {
      const title = name.trim();
      const exists =
        state.groups.some((g) => g.name === title) ||
        state.students.some((s) => s.group_name === title);
      if (!exists) throw new ValidationError(`unknown group: ${title}`);
      state.groups = state.groups.filter((g) => g.name !== title);
      state.group_members = state.group_members.filter((m) => m.group_name !== title);
      for (const s of state.students) if (s.group_name === title) s.group_name = '';
      persist();
    },

    addGroupMember(student_id: string, group_name: string): Student {
      const s = getStudentOrThrow(student_id);
      const title = assertGroupTitle(group_name);
      ensureGroupRow(title);
      s.group_name = title;
      syncMember(s.id, title);
      persist();
      return { ...s };
    },

    removeGroupMember(student_id: string): Student {
      const s = getStudentOrThrow(student_id);
      s.group_name = '';
      syncMember(s.id, '');
      persist();
      return { ...s };
    },

    moveStudent(student_id: string, new_group_name: string): Student {
      const s = getStudentOrThrow(student_id);
      const title = new_group_name.trim();
      assertGroupName(title);
      if (title) ensureGroupRow(title);
      s.group_name = title;
      syncMember(s.id, title);
      persist();
      return { ...s };
    },

    listPresets(): OperationPreset[] {
      return [...state.presets]
        .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
        .map((p) => ({ ...p }));
    },

    createPreset(input: { label: string; amount: number; reason_id?: number | null }): OperationPreset {
      const label = (input.label ?? '').trim();
      if (label.length === 0) throw new ValidationError('preset label is required');
      if (label.length > 40) throw new ValidationError('preset label must be at most 40 characters');
      assertAmount(input.amount);
      const reason_id = input.reason_id ?? null;
      if (reason_id != null) {
        assertReasonCompatible(findReason(state.reasons, reason_id), 'accrual');
      }
      if (state.presets.some((p) => p.label.toLowerCase() === label.toLowerCase())) {
        throw new ValidationError(`preset already exists: ${label}`);
      }
      const preset: OperationPreset = { id: newId(), label, amount: input.amount, reason_id };
      state.presets.push(preset);
      persist();
      return { ...preset };
    },

    updatePreset(id: string, input: { label: string; amount: number; reason_id?: number | null }): OperationPreset {
      const p = state.presets.find((x) => x.id === id);
      if (!p) throw new ValidationError(`unknown preset: ${id}`);
      const label = (input.label ?? '').trim();
      if (label.length === 0) throw new ValidationError('preset label is required');
      if (label.length > 40) throw new ValidationError('preset label must be at most 40 characters');
      assertAmount(input.amount);
      const reason_id = input.reason_id ?? null;
      if (reason_id != null) {
        assertReasonCompatible(findReason(state.reasons, reason_id), 'accrual');
      }
      if (state.presets.some((x) => x.id !== id && x.label.toLowerCase() === label.toLowerCase())) {
        throw new ValidationError(`preset already exists: ${label}`);
      }
      p.label = label;
      p.amount = input.amount;
      p.reason_id = reason_id;
      persist();
      return { ...p };
    },

    deletePreset(id: string): void {
      const idx = state.presets.findIndex((x) => x.id === id);
      if (idx === -1) throw new ValidationError(`unknown preset: ${id}`);
      state.presets.splice(idx, 1);
      persist();
    },

    listOperations(filter?: { student_id?: string; op_type?: OpType }): Operation[] {
      return state.operations
        .filter((o) => (filter?.student_id ? o.student_id === filter.student_id : true))
        .filter((o) => (filter?.op_type ? o.op_type === filter.op_type : true))
        .map((o) => ({ ...o }));
    },

    listReasons(): ReasonTemplate[] {
      return state.reasons.map((r) => ({ ...r }));
    },

    exportJson(): string {
      return JSON.stringify(state, null, 2);
    },

    importJson(json: string): void {
      let parsed: DbState;
      try {
        parsed = JSON.parse(json) as DbState;
      } catch {
        throw new ValidationError('importJson: invalid JSON');
      }
      state = normalizeSnapshot(parsed, 'importJson');
      persist();
    },

    getSnapshot(): DbState {
      return cloneState(state);
    },

    replaceAll(next: DbState): void {
      state = normalizeSnapshot(cloneState(next), 'replaceAll');
      persist();
    },

    reset(): void {
      state = seededState();
      persist();
    },
  };
}

/** Default shared instance for the app shell (WP1 screens will use this). */
export const localRepo: LocalRepo = createLocalRepo();
