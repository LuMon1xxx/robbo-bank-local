import { describe, expect, it } from 'vitest';
import {
  cleanCell,
  hasName,
  mapHeaderCell,
  normalizeDate,
  rowFullName,
} from './importStudents';

describe('importStudents · заголовки', () => {
  it('маппит все 6 заголовков, регистр/пробелы игнорируются', () => {
    expect(mapHeaderCell('Фамилия')).toBe('lastName');
    expect(mapHeaderCell('  ИМЯ  ')).toBe('firstName');
    expect(mapHeaderCell('Отчество')).toBe('patronymic');
    expect(mapHeaderCell('Группа')).toBe('groupName');
    expect(mapHeaderCell('Телефон')).toBe('parentPhone');
    expect(mapHeaderCell('Телефон родителя')).toBe('parentPhone');
    expect(mapHeaderCell('Дата рождения')).toBe('birthDate');
    expect(mapHeaderCell('ДР')).toBe('birthDate');
  });

  it('неизвестный заголовок → null', () => {
    expect(mapHeaderCell('Город')).toBeNull();
    expect(mapHeaderCell('')).toBeNull();
    expect(mapHeaderCell(null)).toBeNull();
  });
});

describe('importStudents · normalizeDate', () => {
  it('Date → yyyy-mm-dd (локальная дата)', () => {
    expect(normalizeDate(new Date(2026, 0, 15))).toBe('2026-01-15');
  });

  it('дд.мм.гггг с паддингом', () => {
    expect(normalizeDate('15.01.2026')).toBe('2026-01-15');
    expect(normalizeDate('5.3.2024')).toBe('2024-03-05');
    expect(normalizeDate('  01.09.2020  ')).toBe('2020-09-01');
  });

  it('гггг-мм-дд (обрезает время)', () => {
    expect(normalizeDate('2026-01-15')).toBe('2026-01-15');
    expect(normalizeDate('2026-01-15T10:00:00.000Z')).toBe('2026-01-15');
  });

  it('Excel serial: 1 → 1899-12-31', () => {
    expect(normalizeDate(1)).toBe('1899-12-31');
  });

  it('мусор → null', () => {
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate('hello')).toBeNull();
    expect(normalizeDate('32.13.2020')).toBeNull();
    expect(normalizeDate('30.02.2024')).toBeNull();
    expect(normalizeDate('2026-13-01')).toBeNull();
  });
});

describe('importStudents · строки', () => {
  it('rowFullName склеивает ФИО', () => {
    expect(rowFullName({ lastName: 'Иванов', firstName: 'Иван', patronymic: 'Иванович' })).toBe(
      'Иванов Иван Иванович',
    );
    expect(rowFullName({ lastName: 'Иванов', firstName: null, patronymic: null })).toBe('Иванов');
  });

  it('hasName: пустая строка без ФИО отсеивается', () => {
    expect(hasName({ lastName: null, firstName: null, patronymic: null })).toBe(false);
    expect(hasName({ lastName: null, firstName: 'Иван', patronymic: null })).toBe(true);
  });

  it('cleanCell: trim, пусто → null, richText → text', () => {
    expect(cleanCell('  А-1  ')).toBe('А-1');
    expect(cleanCell('   ')).toBeNull();
    expect(cleanCell(null)).toBeNull();
    expect(cleanCell({ text: '  hello  ' })).toBe('hello');
  });
});
