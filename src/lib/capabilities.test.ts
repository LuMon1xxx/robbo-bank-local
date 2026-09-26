/**
 * Регресс-тесты на capabilities (src-tauri/capabilities/default.json).
 *
 * 1. Баг «крестик не закрывает окно» (09-2026): setupAutoBackupOnExit делает
 *    preventDefault + win.destroy(), но core:window:default содержит только
 *    allow-internal-toggle-maximize. Без явного core:window:allow-destroy
 *    destroy() тихо отклоняется ACL — окно висит навсегда.
 *
 * 2. Баг «автобэкап никогда не пишется» (09-2026): writeAutoBackup падает с
 *    «forbidden path» на writeTextFile('backups/...'), т.к. fs:allow-app-read
 *    и fs:allow-app-write — НЕРЕКУРСИВНЫЕ сеты (scope-app: $APPDATA/*):
 *    корень AppData пишут, подкаталог backups/ — нет. Нужны
 *    fs:allow-app-read-recursive / fs:allow-app-write-recursive
 *    (scope-app-recursive: $APPDATA/**). См. app.toml плагина fs.
 */
import { describe, expect, it } from 'vitest';
import capsRaw from '../../src-tauri/capabilities/default.json?raw';

type Permission = string | { identifier?: string };

function load(): { permissions: Permission[] } {
  return JSON.parse(capsRaw) as { permissions: Permission[] };
}

describe('capabilities/default.json', () => {
  it('window: разрешён destroy (иначе крестик не закрывает окно)', () => {
    const caps = load();
    expect(caps.permissions ?? []).toContain('core:window:allow-destroy');
  });

  it('fs: рекурсивные сеты (иначе бэкап в backups/ — forbidden path)', () => {
    const caps = load();
    const perms = (caps.permissions ?? []).filter(
      (p): p is string => typeof p === 'string',
    );
    expect(perms).toContain('fs:allow-app-read-recursive');
    expect(perms).toContain('fs:allow-app-write-recursive');
    expect(perms).not.toContain('fs:allow-app-read');
    expect(perms).not.toContain('fs:allow-app-write');
  });
});
