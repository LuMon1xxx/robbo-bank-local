import { describe, expect, it } from 'vitest';
import {
  CHANGELOG,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_CONFIGURED,
  checkForUpdates,
  downloadAndInstallUpdate,
  formatReleaseDate,
  getAppVersion,
  isNewer,
  startAutoUpdater,
} from './updater';

describe('updater helpers', () => {
  it('isNewer: старшая версия определяется', () => {
    expect(isNewer('0.2.0', '0.1.0')).toBe(true);
    expect(isNewer('0.1.1', '0.1.0')).toBe(true);
    expect(isNewer('1.0.0', '0.9.9')).toBe(true);
    expect(isNewer('v0.2.0', '0.1.0')).toBe(true);
  });

  it('isNewer: равная и младшая — false', () => {
    expect(isNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('0.1.0', '0.2.0')).toBe(false);
    expect(isNewer('0.9.9', '1.0.0')).toBe(false);
  });

  it('isNewer: разная длина сегментов', () => {
    expect(isNewer('0.1.0.1', '0.1.0')).toBe(true);
    expect(isNewer('0.1', '0.1.0')).toBe(false);
  });

  it('прод-режим: обновления включены', () => {
    expect(UPDATE_CONFIGURED).toBe(true);
  });

  it('вне Tauri: проверка не падает и не лезет в сеть с исключением', async () => {
    const st = await checkForUpdates();
    expect(typeof st.status).toBe('string');
    const dl = await downloadAndInstallUpdate();
    expect(typeof dl.status).toBe('string');
  });

  it('getAppVersion: вне Tauri возвращает константу', async () => {
    expect(await getAppVersion()).toBe('0.1.6');
  });

  it('автопроверка: интервал — раз в полдня', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('автопроверка: пока не настроено — ничего не делает, таймеров нет', () => {
    // При UPDATE_CONFIGURED === true таймер ставится — сразу останавливаем.
    const stop = startAutoUpdater({ onDownloaded: () => {} });
    expect(typeof stop).toBe('function');
    stop(); // не должно падать
  });

  it('formatReleaseDate: ISO → по-русски, мусор → пусто', () => {
    expect(formatReleaseDate('2026-09-19T10:38:12.800Z')).toContain('2026');
    expect(formatReleaseDate(null)).toBe('');
    expect(formatReleaseDate('мусор')).toBe('');
  });

  it('CHANGELOG: свежие сверху, у каждой версии есть описание', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    expect(CHANGELOG[0].version).toBe('0.1.6');
    for (const e of CHANGELOG) {
      expect(e.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(e.notes.length).toBeGreaterThan(0);
    }
  });
});
