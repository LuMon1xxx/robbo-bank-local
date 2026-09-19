import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { localRepo } from '../lib/localRepo';
import { mapBusinessError } from '../lib/ui-validation';
import {
  cleanCell,
  hasName,
  mapHeaderCell,
  normalizeDate,
  rowFullName,
  type ImportReportItem,
  type ImportRow,
} from '../lib/importStudents';
import { Modal } from './Modal';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface ImportStudentsDialogProps {
  onClose: () => void;
  onChanged: () => void;
  onDone: (message: string) => void;
}

/**
 * Импорт учеников из Excel (.xlsx). exceljs лениво.
 */
export function ImportStudentsDialog({ onClose, onChanged, onDone }: ImportStudentsDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReportItem[] | null>(null);

  async function onPick(file: File | null) {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setReport(null);
    try {
      const buffer = await file.arrayBuffer();
      const { Workbook } = await import('exceljs');
      const wb = new Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('В файле нет листов');

      const header = new Map<import('../lib/importStudents').ImportRowKey, number>();
      ws.getRow(1).eachCell((cell, col) => {
        const key = mapHeaderCell(cell.value);
        if (key && !header.has(key)) header.set(key, col);
      });
      if (!header.has('lastName') && !header.has('firstName') && !header.has('patronymic')) {
        throw new Error('Не найдены колонки ФИО. Нужны заголовки: Фамилия / Имя / Отчество');
      }

      const parsed: ImportRow[] = [];
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const getText = (k: keyof ImportRow): string | null => {
          const col = header.get(k);
          if (!col) return null;
          return cleanCell(row.getCell(col).value);
        };
        const birthRaw = (() => {
          const col = header.get('birthDate');
          if (!col) return null;
          return row.getCell(col).value as unknown;
        })();
        const candidate: ImportRow = {
          lastName: getText('lastName'),
          firstName: getText('firstName'),
          patronymic: getText('patronymic'),
          groupName: getText('groupName'),
          parentPhone: getText('parentPhone'),
          birthDate: normalizeDate(birthRaw),
        };
        if (hasName(candidate)) parsed.push(candidate);
      });
      if (parsed.length === 0) throw new Error('В файле нет строк с ФИО');
      setFileName(file.name);
      setRows(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Не удалось прочитать файл');
      setRows(null);
      setFileName('');
    } finally {
      setParsing(false);
    }
  }

  function runImport() {
    if (!rows || importing) return;
    setImporting(true);
    const items: ImportReportItem[] = [];
    let ok = 0;
    rows.forEach((r, i) => {
      const fullName = rowFullName(r) || `Строка ${i + 2}`;
      try {
        if (r.groupName && r.groupName.length > 10) throw new Error('group_name must be at most 10 characters');
        localRepo.createStudent({
          last_name: r.lastName ?? '',
          first_name: r.firstName ?? '',
          patronymic: r.patronymic ?? '',
          full_name: fullName,
          group_name: r.groupName ?? '',
          parent_phone: r.parentPhone ?? '',
          birth_date: r.birthDate ?? '',
        });
        ok += 1;
        items.push({ rowNumber: i + 2, ok: true, fullName });
      } catch (e) {
        items.push({
          rowNumber: i + 2,
          ok: false,
          fullName,
          error: mapBusinessError(e instanceof Error ? e.message : 'Ошибка'),
        });
      }
    });
    const failed = items.length - ok;
    setReport(items);
    setImporting(false);
    onChanged();
    onDone(`Импорт: добавлено ${ok}${failed ? `, ошибок ${failed}` : ''}`);
  }

  const okCount = report?.filter((r) => r.ok).length ?? 0;
  const failCount = report ? report.length - okCount : 0;

  return (
    <Modal title="Импорт учеников из Excel" subtitle="Заголовки: Фамилия, Имя, Отчество, Группа, Телефон, Дата рождения" onClose={onClose} maxWidth={560}>
      <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
        <FileUp className="size-4" aria-hidden="true" />
        {parsing ? 'Читаем файл…' : fileName ? `📄 ${fileName}` : 'Выбрать файл .xlsx'}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
      />

      {parseError && <p className="mt-2.5 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">{parseError}</p>}

      {rows && (
        <Card className="mt-2.5 p-2.5">
          <p className="mt-0 mb-1.5 text-[13px]">
            Распознано строк: <b>{rows.length}</b>. Первые 5:
          </p>
          <ul className="m-0 pl-[18px] text-xs text-[var(--color-muted-fg)]">
            {rows.slice(0, 5).map((r, i) => (
              <li key={i}>
                {rowFullName(r)}
                {r.groupName ? ` · ${r.groupName}` : ''}
                {r.birthDate ? ` · ${r.birthDate}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 mb-0 text-xs text-[var(--color-muted-fg)]">
            Группа длиннее 10 символов будет отклонена построчно (остальные добавятся).
          </p>
        </Card>
      )}

      {report && (
        <div className="mt-2.5 text-[13px]">
          <b>
            Отчёт: добавлено {okCount}
            {failCount > 0 ? `, ошибок ${failCount}` : ''}
          </b>
          {failCount > 0 && (
            <ul className="mt-1.5 max-h-36 overflow-y-auto pl-[18px] text-xs text-[var(--color-danger-text)]">
              {report
                .filter((r) => !r.ok)
                .slice(0, 20)
                .map((r) => (
                  <li key={r.rowNumber}>
                    Строка {r.rowNumber} ({r.fullName}): {r.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3.5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Закрыть
        </Button>
        <Button type="button" onClick={runImport} disabled={!rows || importing}>
          {importing ? 'Импортируем…' : `Импортировать${rows ? ` (${rows.length})` : ''}`}
        </Button>
      </div>
    </Modal>
  );
}
