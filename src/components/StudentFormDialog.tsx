import { useState } from 'react';
import { localRepo, type Student } from '../lib/localRepo';
import { buildFullName, mapBusinessError, validateStudentForm } from '../lib/ui-validation';
import { Modal } from './Modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface StudentFormDialogProps {
  /** null = создание, иначе редактирование. */
  student: Student | null;
  onClose: () => void;
  onChanged: () => void;
  onDone: (message: string, opId: null) => void;
}

function splitFullName(full: string): [string, string, string] {
  const parts = full.trim().split(/\s+/);
  return [parts[0] ?? '', parts[1] ?? '', parts.slice(2).join(' ')];
}

/** Создание / редактирование ученика. В создании — кнопка «Добавить ещё». */
export function StudentFormDialog({ student, onClose, onChanged, onDone }: StudentFormDialogProps) {
  const isEdit = student !== null;
  const initial = student
    ? student.last_name || student.first_name || student.patronymic
      ? { lastName: student.last_name, firstName: student.first_name, patronymic: student.patronymic }
      : (() => {
          const [l, f, p] = splitFullName(student.full_name);
          return { lastName: l, firstName: f, patronymic: p };
        })()
    : { lastName: '', firstName: '', patronymic: '' };

  const [lastName, setLastName] = useState(initial.lastName);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [patronymic, setPatronymic] = useState(initial.patronymic);
  const [group, setGroup] = useState(student?.group_name ?? '');
  const [phone, setPhone] = useState(student?.parent_phone ?? '');
  const [birth, setBirth] = useState(student?.birth_date ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function collect() {
    return {
      lastName,
      firstName,
      patronymic,
      group,
      phone: phone.trim(),
      birth,
      fullName: buildFullName({ lastName, firstName, patronymic, group }),
    };
  }

  function save(addMore: boolean) {
    if (submitting) return;
    const errs = validateStudentForm({ lastName, firstName, patronymic, group });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const data = collect();
    setSubmitting(true);
    setInlineError(null);
    try {
      if (isEdit && student) {
        localRepo.updateStudent(student.id, {
          last_name: lastName.trim(),
          first_name: firstName.trim(),
          patronymic: patronymic.trim(),
          full_name: data.fullName,
          group_name: group.trim(),
          parent_phone: data.phone,
          birth_date: birth,
        });
        onChanged();
        onDone('Данные ученика обновлены', null);
        onClose();
      } else {
        localRepo.createStudent({
          last_name: lastName.trim(),
          first_name: firstName.trim(),
          patronymic: patronymic.trim(),
          full_name: data.fullName,
          group_name: group.trim(),
          parent_phone: data.phone,
          birth_date: birth,
        });
        onChanged();
        onDone(`Ученик «${data.fullName}» добавлен`, null);
        if (addMore) {
          setLastName('');
          setFirstName('');
          setPatronymic('');
          setGroup('');
          setPhone('');
          setBirth('');
          setFieldErrors({});
        } else {
          onClose();
        }
      }
    } catch (e) {
      setInlineError(mapBusinessError(e instanceof Error ? e.message : 'Не удалось сохранить'));
    } finally {
      setSubmitting(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, opts: { type?: string; id: string }) => (
    <div>
      <Label className="mt-2 mb-1 block text-[13px] font-semibold" htmlFor={opts.id}>
        {label}
      </Label>
      <Input id={opts.id} type={opts.type ?? 'text'} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <Modal title={isEdit ? 'Редактировать ученика' : 'Новый ученик'} onClose={onClose}>
      {field('Фамилия', lastName, setLastName, { id: 'st-last' })}
      {field('Имя', firstName, setFirstName, { id: 'st-first' })}
      {field('Отчество', patronymic, setPatronymic, { id: 'st-patr' })}
      {fieldErrors.fullName && <p className="mt-1 text-xs text-[var(--color-danger-text)]">{fieldErrors.fullName}</p>}
      {field('Группа (до 10 символов)', group, setGroup, { id: 'st-group' })}
      {fieldErrors.group && <p className="mt-1 text-xs text-[var(--color-danger-text)]">{fieldErrors.group}</p>}
      {field('Телефон родителя', phone, setPhone, { id: 'st-phone' })}
      {field('Дата рождения', birth, setBirth, { type: 'date', id: 'st-birth' })}
      {inlineError && <p className="mt-2.5 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">{inlineError}</p>}
      <div className="mt-3.5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Отмена
        </Button>
        {!isEdit && (
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => save(true)}>
            {submitting ? 'Сохранение…' : 'Добавить ещё'}
          </Button>
        )}
        <Button type="button" disabled={submitting} onClick={() => save(false)}>
          {submitting ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Добавить'}
        </Button>
      </div>
    </Modal>
  );
}

interface ArchiveDialogProps {
  student: Student;
  mode: 'archive' | 'restore';
  onClose: () => void;
  onChanged: () => void;
  onDone: (message: string, opId: null) => void;
}

/** Подтверждение архивации / восстановления. */
export function ArchiveDialog({ student, mode, onClose, onChanged, onDone }: ArchiveDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'archive') localRepo.archiveStudent(student.id);
      else localRepo.restoreStudent(student.id);
      onChanged();
      onDone(mode === 'archive' ? `«${student.full_name}» в архиве` : `«${student.full_name}» восстановлен`, null);
      onClose();
    } catch (e) {
      setError(mapBusinessError(e instanceof Error ? e.message : 'Не удалось выполнить'));
      setSubmitting(false);
    }
  }

  return (
    <Modal title={mode === 'archive' ? 'В архив?' : 'Восстановить?'} onClose={onClose} maxWidth={400}>
      <p className="text-sm">
        {mode === 'archive' ? (
          <>
            «{student.full_name}» скроется из активного списка. Баланс ({student.balance}) и история сохранятся,
            но отмена операций станет недоступна.
          </>
        ) : (
          <>«{student.full_name}» вернётся в активный список.</>
        )}
      </p>
      {error && <p className="rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          variant={mode === 'archive' ? 'destructive' : 'default'}
        >
          {submitting ? '…' : mode === 'archive' ? 'В архив' : 'Восстановить'}
        </Button>
      </div>
    </Modal>
  );
}
