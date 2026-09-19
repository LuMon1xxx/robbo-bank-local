/**
 * robbo-bank-local · Tauri bootstrap (WP1: SQLite — долговременное хранилище).
 *
 * Write-through кэш:
 * - загрузка: schema.sql постстейтментно → loadSnapshot(sqlite) +
 *   чтение localStorage (STORAGE_KEY) → mergeOnBoot → при миграции
 *   local→sqlite сразу saveSnapshot → localRepo.replaceAll(итог) →
 *   setExternalFlusher((s) => queueFlush(db, s)).
 * - работа: память синхронно (localRepo) + дебаунс-флаш в SQLite (500мс).
 * - выход: flushStorageNow() (сброс очереди, окно потери закрыто).
 *
 * В браузере / dev — 'browser-storage', данные только в localStorage.
 * Соединение НЕ закрывается (синглтон getDb()).
 */
import schemaSql from './schema.sql?raw';
import {
  localRepo,
  setExternalFlusher,
  STORAGE_KEY,
  type DbState,
} from './localRepo';
import {
  flushNow,
  loadSnapshot,
  mergeOnBoot,
  queueFlush,
  saveSnapshot,
  splitSqlStatements,
  type SqliteDb,
} from './sqliteSync';

let dbInstance: SqliteDb | null = null;

/** Синглтон открытого соединения (null до bootStorage / вне Tauri). */
export function getDb(): SqliteDb | null {
  return dbInstance;
}

/**
 * Синхронно-ожидаемый сброс очереди записи. Для автобэкапа (п.2):
 * вызвать перед чтением robbo.db, чтобы файл содержал свежие данные.
 */
export async function flushStorageNow(): Promise<void> {
  await flushNow();
}

/**
 * NOTE: НЕ детектим Tauri через window.__TAURI__ — в Tauri v2 этого глобала
 * по умолчанию нет (withGlobalTauri: false). Вместо этого пробуем открыть
 * БД: вне Tauri Database.load() кидает → ловим и уходим в browser-storage.
 */

/** Пустой снапшот-заглушка (решение mergeOnBoot смотрит только на counts). */
function emptySnapshot(): DbState {
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

/** Читает localStorage напрямую (сырой STORAGE_KEY, без синглтона). */
function readLocalSnapshot(): DbState {
  try {
    if (typeof localStorage === 'undefined') return localRepo.getSnapshot();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySnapshot();
    const parsed = JSON.parse(raw) as DbState;
    if (!Array.isArray(parsed.students) || !Array.isArray(parsed.operations)) {
      return emptySnapshot();
    }
    return {
      students: parsed.students,
      operations: parsed.operations,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      group_members: Array.isArray(parsed.group_members) ? parsed.group_members : [],
      presets: Array.isArray(parsed.presets) ? parsed.presets : [],
    };
  } catch {
    return emptySnapshot();
  }
}

export async function bootStorage(): Promise<'tauri-sqlite' | 'browser-storage'> {
  if (typeof window === 'undefined') return 'browser-storage';
  try {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    const db = (await Database.load('sqlite:robbo.db')) as unknown as SqliteDb;
    dbInstance = db;

    // Схема + идемпотентные сиды — по одному стейтменту.
    for (const stmt of splitSqlStatements(schemaSql)) {
      await db.execute(stmt);
    }

    // Миграция v1 → v2: расписание групп. CREATE TABLE IF NOT EXISTS
    // не добавляет колонки в существующие базы, поэтому ALTER отдельно.
    // Повторный запуск: колонки уже есть → ловим duplicate column и молчим.
    for (const ddl of [
      "ALTER TABLE groups ADD COLUMN weekday TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE groups ADD COLUMN time TEXT NOT NULL DEFAULT ''",
    ]) {
      try {
        await db.execute(ddl);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/duplicate column/i.test(msg)) throw e;
      }
    }

    const sqlite = await loadSnapshot(db);
    const local = readLocalSnapshot();
    const merged = mergeOnBoot(sqlite, local);
    if (merged === local) {
      // Разовая миграция localStorage → SQLite.
      await saveSnapshot(db, merged);
    }
    localRepo.replaceAll(merged);
    setExternalFlusher((s: DbState) => queueFlush(db, s));
    return 'tauri-sqlite';
  } catch (e) {
    console.warn('[tauri-bootstrap] SQLite init failed, fallback to browser storage:', e);
    dbInstance = null;
    return 'browser-storage';
  }
}

/** @deprecated используйте bootStorage (оставлен для совместимости). */
export const initTauriDb: () => Promise<'tauri-sqlite' | 'browser-storage'> = bootStorage;
