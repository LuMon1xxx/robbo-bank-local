import { describe, expect, it } from 'vitest';
import {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_CONFIGURED,
  checkForUpdates,
  downloadAndInstallUpdate,
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

  it('не настроено: никуда не лезем, сетевых вызовов нет', async () => {
    expect(UPDATE_CONFIGURED).toBe(false);
    expect(await checkForUpdates()).toEqual({ status: 'unconfigured' });
    expect(await downloadAndInstallUpdate()).toEqual({ status: 'unconfigured' });
  });

  it('getAppVersion: вне Tauri возвращает константу', async () => {
    expect(await getAppVersion()).toBe('0.1.0');
  });

  it('автопроверка: интервал — раз в полдня', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('автопроверка: пока не настроено — ничего не делает, таймеров нет', () => {
    const stop = startAutoUpdater({ onDownloaded: () => expect.unreachable() });
    expect(typeof stop).toBe('function');
    stop(); // не должно падать
  });
});
