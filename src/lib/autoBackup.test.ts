import { describe, expect, it } from 'vitest';
import {
  BACKUP_PREFIX,
  backupFileName,
  lastBackupAt,
  selectBackupsToKeep,
  writeAutoBackup,
} from './autoBackup';

function name(day: number, hm: string): string {
  return `${BACKUP_PREFIX}2026-01-${String(day).padStart(2, '0')}-${hm}.json`;
}

describe('autoBackup · selectBackupsToKeep', () => {
  it('пустой список → пустой', () => {
    expect(selectBackupsToKeep([])).toEqual([]);
  });

  it('меньше 10 — ничего не удаляем (возвращаем всё)', () => {
    const files = [name(1, '1000'), name(2, '1000'), name(3, '1000')];
    expect(selectBackupsToKeep(files)).toEqual([...files].sort());
  });

  it('ровно 10 — keep все', () => {
    const files = Array.from({ length: 10 }, (_, i) => name(i + 1, '1200'));
    expect(selectBackupsToKeep(files)).toHaveLength(10);
  });

  it('ротация 12→10: удаляем 2 самых старых', () => {
    const files = Array.from({ length: 12 }, (_, i) => name(i + 1, '1200'));
    const keep = selectBackupsToKeep(files);
    expect(keep).toHaveLength(10);
    expect(keep).not.toContain(name(1, '1200'));
    expect(keep).not.toContain(name(2, '1200'));
    expect(keep).toContain(name(12, '1200'));
  });

  it('сортировка имён = хронология: вход вразнобой, keep самые свежие', () => {
    const files = [name(12, '1200'), name(1, '1200'), name(6, '1200'), name(3, '1000')];
    const keep = selectBackupsToKeep(files);
    expect(keep).toEqual([...files].sort());
    // Самый свежий — последний в отсортированном.
    expect(keep[keep.length - 1]).toBe(name(12, '1200'));
  });

  it('вход не мутирует', () => {
    const files = [name(3, '1000'), name(1, '1000')];
    const snapshot = [...files];
    selectBackupsToKeep(files);
    expect(files).toEqual(snapshot);
  });
});

describe('autoBackup · имя файла', () => {
  it('формат robbo-autobackup-YYYY-MM-DD-HHmm.json', () => {
    const d = new Date(2026, 0, 5, 9, 7); // локальное время
    expect(backupFileName(d)).toBe(`${BACKUP_PREFIX}2026-01-05-0907.json`);
  });

  it('имена сортируются лексикографически = хронологически', () => {
    const a = backupFileName(new Date(2026, 0, 5, 9, 7));
    const b = backupFileName(new Date(2026, 0, 5, 10, 0));
    expect(a < b).toBe(true);
  });
});

describe('autoBackup · writeAutoBackup вне Tauri', () => {
  it('no-op в браузере/node: резолвится, lastBackupAt null', async () => {
    await expect(writeAutoBackup()).resolves.toBeUndefined();
    expect(lastBackupAt()).toBeNull();
  });
});
