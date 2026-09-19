import { describe, expect, it } from 'vitest';
import {
  formatMSK,
  mapBusinessError,
  validateAmountRU,
  validateOperationForm,
  validateStudentForm,
} from './ui-validation';

describe('ui-validation RU-mapping', () => {
  it('insufficient balance -> Недостаточно монет', () => {
    expect(mapBusinessError('insufficient balance for write_off')).toBe(
      'Недостаточно монет на балансе',
    );
  });

  it('unknown student -> Ученик не найден', () => {
    expect(mapBusinessError('unknown student_id: abc')).toBe('Ученик не найден');
  });

  it('amount range -> диапазон 1..100000', () => {
    expect(mapBusinessError('amount must be between 1 and 100000')).toContain('1 до 100 000');
  });

  it('amount integer -> целое число', () => {
    expect(mapBusinessError('amount must be an integer')).toBe('Сумма должна быть целым числом');
  });

  it('full_name required -> Укажите ФИО', () => {
    expect(mapBusinessError('full_name is required')).toBe('Укажите ФИО ученика');
  });

  it('group too long -> не более 10 символов', () => {
    expect(mapBusinessError('group_name must be at most 10 characters')).toContain('10 символов');
  });

  it('already reversed -> уже отменена', () => {
    expect(mapBusinessError('operation was already reversed')).toBe('Операция уже отменена');
  });

  it('reverse of reversal -> повтор запрещён', () => {
    expect(mapBusinessError('cannot reverse a reversal operation')).toContain('повторная отмена');
  });

  it('reverse of archived -> архив', () => {
    expect(mapBusinessError('cannot reverse operation of an archived student')).toContain('архиве');
  });

  it('unknown reason -> причина не найдена', () => {
    expect(mapBusinessError('unknown reason_id: 5')).toContain('Причина');
  });

  it('reason incompatible -> не подходит', () => {
    expect(mapBusinessError('reason "Штраф" cannot be used for accrual')).toContain('не подходит');
  });

  it('unknown message passes through', () => {
    expect(mapBusinessError('какая-то другая ошибка')).toBe('какая-то другая ошибка');
  });
});

describe('validateAmountRU', () => {
  it('accepts 1..100000 ints', () => {
    expect(validateAmountRU(1)).toBeNull();
    expect(validateAmountRU(50)).toBeNull();
    expect(validateAmountRU(100000)).toBeNull();
  });

  it('rejects 0, negative, >100000, non-int', () => {
    for (const bad of [0, -5, 100001, 2.5, Number.NaN]) {
      expect(validateAmountRU(bad), `amount=${String(bad)}`).not.toBeNull();
    }
  });
});

describe('validateOperationForm', () => {
  it('requires amount and reason', () => {
    const errs = validateOperationForm({ amountText: '', reasonId: '', comment: '' });
    expect(errs.amount).toBeTruthy();
    expect(errs.reasonId).toBe('Выберите причину');
  });

  it('rejects comment > 500 chars', () => {
    const errs = validateOperationForm({ amountText: '10', reasonId: '1', comment: 'x'.repeat(501) });
    expect(errs.comment).toContain('500');
  });

  it('accepts valid form', () => {
    const errs = validateOperationForm({ amountText: '10', reasonId: '1', comment: 'ок' });
    expect(errs).toEqual({});
  });
});

describe('validateStudentForm', () => {
  it('requires ФИО and limits group to 10', () => {
    const errs = validateStudentForm({ lastName: '  ', firstName: '', patronymic: '', group: '12345678901' });
    expect(errs.fullName).toBe('Укажите ФИО ученика');
    expect(errs.group).toContain('10 символов');
  });

  it('accepts valid form', () => {
    const errs = validateStudentForm({ lastName: 'Иванов', firstName: 'Иван', patronymic: '', group: 'A-1' });
    expect(errs).toEqual({});
  });
});

describe('formatMSK', () => {
  it('formats ISO date with date and time', () => {
    const s = formatMSK(new Date('2026-01-15T10:00:00.000Z').toISOString());
    expect(s).toContain('.');
    expect(s).toContain(':');
  });
});
