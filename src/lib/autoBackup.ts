/**
 * robbo-bank-local · Автобэкап при выходе (п.2).
 *
 * Silent: окно закрывается → flush SQLite-очереди → exportJson →
 * AppData/backups/robbo-autobackup-YYYY-MM-DD-HHmm.json → ротация (keep 10).
 * Ошибки — только console.warn, UI не роняем.
 */

import { localRepo } from './localRepo';
import { flushStorageNow } from './tauriBootstrap';

/** Каталог бэкапов внутри AppData (ru.robbo.bank.local). */
export const BACKUP_DIR = 'backups';
/** Сколько свежих бэкапов храним. */
export const MAX_BACKUPS = 10;
export const BACKUP_PREFIX = 'robbo-autobackup-';

let lastAt: string | null = null;

/** ISO-метка последнего успешного автобэкапа в этой сессии (для тоста). */
export function lastBackupAt(): string | null {
  return lastAt;
}

/**
 * NOTE: Tauri НЕ детектим через window.__TAURI__ — в v2 этого глобала
 * по умолчанию нет. Пробуем fs-операции: вне Tauri они кидают →
 * помечаем unsupported и дальше молчим (no-op).
 */
let supported: boolean | null = null;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Имя файла: robbo-autobackup-YYYY-MM-DD-HHmm.json (локальное время). */
export function backupFileName(date: Date = new Date()): string {
  return (
    `${BACKUP_PREFIX}${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `-${pad2(date.getHours())}${pad2(date.getMinutes())}.json`
  );
}

/**
 * Чистая: какие файлы оставить. Имена сортируются лексикографически =
 * хронологически (формат YYYY-MM-DD-HHmm). Возвращает ≤10 самых свежих.
 * Вызыватель удаляет остальные.
 */
export function selectBackupsToKeep(files: string[]): string[] {
  const sorted = [...files].sort();
  if (sorted.length <= MAX_BACKUPS) return sorted;
  return sorted.slice(sorted.length - MAX_BACKUPS);
}

/**
 * Записать автобэкап. В браузере — no-op. Ошибки глотаем в console.warn.
 */
export async function writeAutoBackup(): Promise<void> {
  if (supported === false) return;
  if (typeof window === 'undefined') return;
  try {
    // Сброс очереди SQLite — иначе бэкап прочтёт несвежие данные из памяти/файла.
    await flushStorageNow();
    const json = localRepo.exportJson();
    const { mkdir, writeTextFile, readDir, remove, BaseDirectory } = await import(
      '@tauri-apps/plugin-fs'
    );
    await mkdir(BACKUP_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
    await writeTextFile(`${BACKUP_DIR}/${backupFileName()}`, json, {
      baseDir: BaseDirectory.AppData,
    });
    // Ротация: удалить всё старше 10 свежих. Ошибки листинга/удаления — не фатальны.
    try {
      const entries = await readDir(BACKUP_DIR, { baseDir: BaseDirectory.AppData });
      const names = entries
        .filter((e) => e.isFile)
        .map((e) => e.name)
        .filter((n) => n.startsWith(BACKUP_PREFIX) && n.endsWith('.json'));
      const keep = new Set(selectBackupsToKeep(names));
      for (const n of names) {
        if (keep.has(n)) continue;
        try {
          await remove(`${BACKUP_DIR}/${n}`, { baseDir: BaseDirectory.AppData });
        } catch (e) {
          console.warn('[autoBackup] remove old backup failed:', n, e);
        }
      }
    } catch (e) {
      console.warn('[autoBackup] rotation failed:', e);
    }
    lastAt = new Date().toISOString();
    if (supported === null) supported = true;
  } catch (e) {
    // Первый провал = не Tauri (браузер): запоминаем и дальше молчим.
    if (supported === null) {
      supported = false;
      return;
    }
    console.warn('[autoBackup] write failed:', e);
  }
}

/**
 * Подключить автобэкап к закрытию окна. Только в Tauri.
 * - onCloseRequested: preventDefault → backup (с таймаутом!) → destroy().
 *
 * ВАЖНО: здесь было два бага, из-за которых крестик не закрывал окно:
 * 1. win.close() внутри onCloseRequested ПОВТОРНО стреляет тем же событием
 *    → prevent → backup → close → … — бесконечный цикл. Нужен destroy(),
 *    который закрывает окно мимо события.
 * 2. await writeAutoBackup() без таймаута: зависший flush/fs = окно висит
 *    вечно. Гонка с таймером 3с — бэкап лучше потерять, чем не закрыть окно.
 * 3. win.destroy() требует пермишен core:window:allow-destroy в
 *    src-tauri/capabilities/default.json (core:window:default его НЕ даёт:
 *    там только allow-internal-toggle-maximize). Без пермишена destroy()
 *    тихо отклоняется ACL, а preventDefault уже отменил закрытие —
 *    окно висит навсегда. См. windowPermissions.test.ts.
 */
export function setupAutoBackupOnExit(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeunload', () => {
    void writeAutoBackup();
  });
  let closing = false;
  void (async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.onCloseRequested(async (event) => {
        event.preventDefault();
        if (closing) {
          // Повторный крестик во время бэкапа — закрыть немедленно.
          await win.destroy().catch(() => {});
          return;
        }
        closing = true;
        try {
          await Promise.race([
            writeAutoBackup(),
            new Promise((res) => setTimeout(res, 3000)),
          ]);
        } finally {
          await win.destroy().catch(() => {});
        }
      });
    } catch (e) {
      console.warn('[autoBackup] onCloseRequested hook failed:', e);
    }
  })();
}
