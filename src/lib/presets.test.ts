import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalRepo, type LocalRepo } from './localRepo';

let repo: LocalRepo;

beforeEach(() => {
  repo = createLocalRepo();
  repo.reset();
});

describe('operation presets (WP4)', () => {
  it('1. create + list sorted by label', () => {
    repo.createPreset({ label: 'Конкурс', amount: 50, reason_id: 4 });
    repo.createPreset({ label: 'Активность', amount: 5, reason_id: 2 });
    const labels = repo.listPresets().map((p) => p.label);
    expect(labels).toEqual(['Активность', 'Конкурс']);
  });

  it('2. duplicate label rejected (case-insensitive)', () => {
    repo.createPreset({ label: 'Конкурс', amount: 50, reason_id: 4 });
    expect(() => repo.createPreset({ label: 'конкурс', amount: 10, reason_id: 1 })).toThrow();
  });

  it('3. update + delete', () => {
    const p = repo.createPreset({ label: 'Конкурс', amount: 50, reason_id: 4 });
    const updated = repo.updatePreset(p.id, { label: 'Суперконкурс', amount: 70, reason_id: 4 });
    expect(updated.label).toBe('Суперконкурс');
    expect(updated.amount).toBe(70);
    repo.deletePreset(p.id);
    expect(repo.listPresets()).toHaveLength(0);
    expect(() => repo.deletePreset(p.id)).toThrow();
  });

  it('4. validation: amount bounds, label, reason kind', () => {
    expect(() => repo.createPreset({ label: '', amount: 10, reason_id: 1 })).toThrow();
    expect(() => repo.createPreset({ label: 'X', amount: 0, reason_id: 1 })).toThrow();
    expect(() => repo.createPreset({ label: 'X', amount: 100001, reason_id: 1 })).toThrow();
    // reason 7 = write_off kind — нельзя для пресетов начисления
    expect(() => repo.createPreset({ label: 'Штраф-пресет', amount: 5, reason_id: 7 })).toThrow();
    expect(() => repo.createPreset({ label: 'X', amount: 5, reason_id: 999 })).toThrow();
  });

  it('5. export/import round-trip preserves presets', () => {
    repo.createPreset({ label: 'Олимпиада', amount: 30, reason_id: 6 });
    const dump = repo.exportJson();
    const repo2 = createLocalRepo();
    repo2.reset();
    repo2.importJson(dump);
    expect(repo2.listPresets()).toHaveLength(1);
    expect(repo2.listPresets()[0].label).toBe('Олимпиада');
  });

  it('6. preset reason null allowed (any reason at apply time)', () => {
    const p = repo.createPreset({ label: 'Без причины', amount: 10 });
    expect(p.reason_id).toBeNull();
  });
});
