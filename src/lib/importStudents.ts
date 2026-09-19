/**
 * robbo-bank-local · WP2 импорт учеников из Excel (чистые helpers, без exceljs).
 *
 * Формат: первая строка — заголовки (порядок не важен):
 *   Фамилия | Имя | Отчество | Группа | Телефон | Дата рождения
 * Обязательно хотя бы одно из ФИО в строке.
 */

export interface ImportRow {
  lastName: string | null;
  firstName: string | null;
  patronymic: string | null;
  groupName: string | null;
  parentPhone: string | null;
  /** yyyy-mm-dd или null. */
  birthDate: string | null;
}

export type ImportRowKey = keyof ImportRow;

export const IMPORT_HEADERS: Record<string, ImportRowKey> = {
  'фамилия': 'lastName',
  'имя': 'firstName',
  'отчество': 'patronymic',
  'группа': 'groupName',
  'телефон': 'parentPhone',
  'телефон родителя': 'parentPhone',
  'дата рождения': 'birthDate',
  'др': 'birthDate',
};

export const IMPORT_HEADER_TITLES = ['Фамилия', 'Имя', 'Отчество', 'Группа', 'Телефон', 'Дата рождения'] as const;

/** Заголовок ячейки → ключ строки. Регистр/пробелы игнорируются. */
export function mapHeaderCell(cell: unknown): ImportRowKey | null {
  const key = String(cell ?? '').trim().toLowerCase();
  return IMPORT_HEADERS[key] ?? null;
}

/**
 * Нормализация даты из Excel → yyyy-mm-dd.
 * Принимает Date | Excel-serial (number) | строку «дд.мм.гггг» | «гггг-мм-дд».
 * Иначе null. Невалидные календарные даты (32.13.2020, 30.02.2024) → null.
 */
export function normalizeDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial: дни с 1899-12-30 (с учётом бага 1900 leap year для v>=61).
    if (v < 1 || v > 80000) return null;
    const base = Date.UTC(1899, 11, 30);
    const ms = base + Math.floor(v) * 86400000;
    const d = new Date(ms);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  const dmy = /^(\d{1,2})[.](\d{1,2})[.](\d{4})$/.exec(s);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    const yyyy = Number(dmy[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const check = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (
      check.getUTCFullYear() !== yyyy ||
      check.getUTCMonth() !== mm - 1 ||
      check.getUTCDate() !== dd
    ) {
      return null;
    }
    return `${String(yyyy)}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const yyyy = Number(iso[1]);
    const mm = Number(iso[2]);
    const dd = Number(iso[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const check = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (
      check.getUTCFullYear() !== yyyy ||
      check.getUTCMonth() !== mm - 1 ||
      check.getUTCDate() !== dd
    ) {
      return null;
    }
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  return null;
}

/** Чистка текстовой ячейки: trim, пусто → null. RichText-объекты exceljs → text. */
export function cleanCell(v: unknown): string | null {
  if (v == null) return null;
  let s: string;
  if (typeof v === 'object' && v !== null && 'text' in (v as object)) {
    s = String((v as { text: unknown }).text);
  } else {
    s = String(v);
  }
  const t = s.trim();
  return t === '' ? null : t;
}

/** ФИО строки → full_name («Фамилия Имя Отчество», пустые пропускаются). */
export function rowFullName(r: Pick<ImportRow, 'lastName' | 'firstName' | 'patronymic'>): string {
  return [r.lastName, r.firstName, r.patronymic].filter(Boolean).join(' ');
}

/** Строка значимая (есть хоть одно ФИО) — иначе пропускаем молча. */
export function hasName(r: Pick<ImportRow, 'lastName' | 'firstName' | 'patronymic'>): boolean {
  return Boolean(r.lastName || r.firstName || r.patronymic);
}

export interface ImportReportItem {
  rowNumber: number;
  ok: boolean;
  fullName: string;
  error?: string;
}
