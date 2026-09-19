/**
 * robbo-bank-local · WP1 UI helpers (pure, tested).
 *
 * RU-маппинг ошибок localRepo + валидация форм + формат даты МСК.
 */

const RU_MAP: Record<string, string> = {
  'insufficient balance for write_off': 'Недостаточно монет на балансе',
  'amount must be an integer': 'Сумма должна быть целым числом',
  'amount must be between 1 and 100000': 'Сумма должна быть от 1 до 100 000 целым числом',
  'full_name is required': 'Укажите ФИО ученика',
  'group_name must be at most 10 characters': 'Название группы — не более 10 символов',
  'operation was already reversed': 'Операция уже отменена',
  'cannot reverse a reversal operation': 'Это отмена — повторная отмена запрещена',
  'cannot reverse operation of an archived student': 'Ученик в архиве — отмена недоступна',
  'student is archived': 'Ученик в архиве — операции недоступны',
  'importjson: invalid json': 'Некорректный JSON для импорта',
  'importjson: missing students/operations arrays': 'В файле нет учеников/операций',
  'group_name is required': 'Укажите название группы',
};

/** Русское сообщение для ошибок localRepo. Неизвестные — как есть. */
export function mapBusinessError(message: string): string {
  if (RU_MAP[message]) return RU_MAP[message];
  const norm = message.trim().toLowerCase().replace(/[.\s]+$/, '');
  if (RU_MAP[norm]) return RU_MAP[norm];
  if (norm.startsWith('unknown student_id')) return 'Ученик не найден';
  if (norm.startsWith('unknown operation')) return 'Операция не найдена';
  if (norm.startsWith('unknown reason_id')) return 'Причина не найдена';
  if (norm.startsWith('unknown group')) return 'Группа не найдена';
  if (norm.startsWith('group already exists')) return 'Такая группа уже есть';
  if (norm.includes('cannot be used for')) return 'Причина не подходит для этой операции';
  if (norm.includes('group_name must be at most')) return 'Название группы — не более 10 символов';
  if (norm.includes('amount must be between')) return 'Сумма должна быть от 1 до 100 000 целым числом';
  if (norm.includes('amount must be an integer')) return 'Сумма должна быть целым числом';
  const hit = Object.entries(RU_MAP).find(([k]) => norm.includes(k));
  return hit ? hit[1] : message;
}

/** null = ок, иначе RU-текст ошибки. */
export function validateAmountRU(amount: unknown): string | null {
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    return 'Сумма должна быть целым числом';
  }
  if (amount < 1 || amount > 100000) {
    return 'Сумма должна быть от 1 до 100 000';
  }
  return null;
}

export interface OperationFormInput {
  amountText: string;
  reasonId: string;
  comment: string;
}

export function validateOperationForm(input: OperationFormInput): Record<string, string> {
  const errs: Record<string, string> = {};
  const raw = input.amountText.trim();
  if (raw === '') {
    errs.amount = 'Укажите сумму';
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      errs.amount = 'Сумма должна быть целым числом';
    } else {
      const msg = validateAmountRU(n);
      if (msg) errs.amount = msg;
    }
  }
  if (!input.reasonId) errs.reasonId = 'Выберите причину';
  if (input.comment.length > 500) errs.comment = 'Комментарий — не более 500 символов';
  return errs;
}

/** Парсит текст суммы формы: null если невалидна. */
export function parseAmountText(text: string): number | null {
  const raw = text.trim();
  if (raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (validateAmountRU(n)) return null;
  return n;
}

export interface StudentFormInput {
  lastName: string;
  firstName: string;
  patronymic: string;
  group: string;
}

export function buildFullName(input: StudentFormInput): string {
  return [input.lastName.trim(), input.firstName.trim(), input.patronymic.trim()]
    .filter(Boolean)
    .join(' ');
}

export function validateStudentForm(input: StudentFormInput): Record<string, string> {
  const errs: Record<string, string> = {};
  if (buildFullName(input).length === 0) errs.fullName = 'Укажите ФИО ученика';
  if (input.group.trim().length > 10) errs.group = 'Название группы — не более 10 символов';
  return errs;
}

const mskDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const mskTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
});

/** «15.01.2026, 13:00» по Москве. */
export function formatMSK(iso: string): string {
  const d = new Date(iso);
  return `${mskDate.format(d)}, ${mskTime.format(d)}`;
}
