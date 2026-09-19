import { useMemo, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { localRepo, type Operation } from '../lib/localRepo';
import { formatMSK, mapBusinessError } from '../lib/ui-validation';
import {
  filterOperationsByPeriod,
  operationsToCsv,
  reconcileBalances,
  REPORT_CSV_COLUMNS,
  REPORT_PERIOD_LABELS,
  summarizeOperations,
  type BalanceMismatch,
  type ReportPeriod,
} from '../lib/reports';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Card } from '../ui/card';

interface ReportsPageProps {
  version: number;
  onChanged: () => void;
  onToast: (message: string) => void;
}

const PERIODS: ReportPeriod[] = ['today', 'week', 'month', 'all'];

/**
 * Отчёты: периоды, таблица операций, итоги, CSV/XLSX, сверка балансов + бэкап JSON.
 */
export function ReportsPage({ version, onChanged, onToast }: ReportsPageProps) {
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [reconcile, setReconcile] = useState<BalanceMismatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // version в зависимостях: localRepo не реактивен, пересчёт по bump из App.
  const ctx = useMemo(() => {
    void version;
    const students = localRepo.listStudents();
    const sById = new Map(students.map((s) => [s.id, s]));
    const reasons = localRepo.listReasons();
    const rById = new Map(reasons.map((r) => [r.id, r.label]));
    return {
      students,
      studentName: (id: string) => sById.get(id)?.full_name ?? '—',
      studentGroup: (id: string) => sById.get(id)?.group_name ?? '',
      reasonLabel: (id: number | null) => (id == null ? '' : (rById.get(id) ?? '')),
    };
  }, [version]);

  const ops = useMemo(() => {
    void version;
    return filterOperationsByPeriod(localRepo.listOperations(), period, new Date());
  }, [version, period]);
  const totals = useMemo(() => summarizeOperations(ops), [ops]);

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleCsv() {
    const csv = operationsToCsv(ops, {
      ...ctx,
      formatDate: formatMSK,
    });
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `robbo-report-${period}.csv`);
    onToast(`CSV скачан: ${ops.length} операций`);
  }

  async function handleXlsx() {
    setError(null);
    try {
      const { Workbook } = await import('exceljs');
      const wb = new Workbook();
      const ws = wb.addWorksheet('Отчёт');
      ws.columns = [...REPORT_CSV_COLUMNS].map((header) => ({ header, width: Math.max(14, header.length + 4) }));
      ws.getRow(1).font = { bold: true };
      for (const o of ops) {
        ws.addRow([
          formatMSK(o.created_at),
          ctx.studentName(o.student_id),
          ctx.studentGroup(o.student_id),
          o.op_type === 'accrual' ? 'Начисление' : o.op_type === 'write_off' ? 'Списание' : 'Отмена',
          o.amount,
          ctx.reasonLabel(o.reason_id),
          o.author_name,
          o.comment,
        ]);
      }
      const total = ws.addRow(['ИТОГО', '', '', '', totals.net, '', '', '']);
      total.font = { bold: true };
      const buf = await wb.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `robbo-report-${period}.xlsx`,
      );
      onToast(`XLSX скачан: ${ops.length} операций`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать XLSX');
    }
  }

  function handleReconcile() {
    const opsAll = localRepo.listOperations();
    const bad = reconcileBalances(ctx.students, opsAll);
    setReconcile(bad);
    onToast(bad.length === 0 ? 'Сверка: расхождений нет ✓' : `Сверка: расхождений ${bad.length}`);
  }

  function handleBackupSave() {
    downloadBlob(new Blob([localRepo.exportJson()], { type: 'application/json;charset=utf-8' }), `robbo-backup-${new Date().toISOString().slice(0, 10)}.json`);
    onToast('Копия JSON сохранена — положите её на флешку');
  }

  async function handleBackupFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    if (!window.confirm(`Восстановить данные из «${file.name}»? Текущие данные будут заменены.`)) return;
    try {
      localRepo.importJson(text);
      setReconcile(null);
      onChanged();
      onToast('Данные восстановлены из JSON');
    } catch (e) {
      setError(mapBusinessError(e instanceof Error ? e.message : 'Не удалось восстановить'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <Card className="mb-3 flex flex-wrap items-end gap-2 p-3">
        <Label className="min-w-40 flex-1 text-xs text-[var(--color-muted-fg)]">
          Период
          <Select value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)} className="mt-1">
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {REPORT_PERIOD_LABELS[p]}
              </option>
            ))}
          </Select>
        </Label>
        <Button type="button" variant="outline" onClick={handleCsv}>
          <Download className="size-3.5" aria-hidden="true" />
          CSV
        </Button>
        <Button type="button" variant="outline" onClick={() => void handleXlsx()}>
          <Download className="size-3.5" aria-hidden="true" />
          XLSX
        </Button>
        <Button type="button" onClick={handleReconcile}>
          Сверка балансов
        </Button>
      </Card>

      {error && (
        <p className="mb-3 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">{error}</p>
      )}

      <Card className="mb-3 flex flex-wrap gap-4 p-3 text-sm">
        <span>Начислено: <b className="money-num">{totals.accrued}</b></span>
        <span>Списано: <b className="money-num">{totals.writtenOff}</b></span>
        <span>Отмены: <b className="money-num">{totals.reversed}</b></span>
        <span>Итог периода: <b className="money-num">{totals.net}</b></span>
        <span className="text-[var(--color-muted-fg)]">Операций: {totals.count}</span>
      </Card>

      {reconcile && (
        <Card className="mb-3 p-3">
          <div className="mb-1.5 text-[13px] font-bold">
            Сверка балансов: {reconcile.length === 0 ? 'расхождений нет ✓' : `расхождений: ${reconcile.length}`}
          </div>
          {reconcile.length > 0 && (
            <ul className="m-0 list-disc pl-[18px] text-[13px]">
              {reconcile.map((m) => (
                <li key={m.student_id}>
                  {m.full_name}: в карточке {m.actual}, по операциям {m.expected} (Δ {m.diff})
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        {ops.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--color-muted-fg)]">За период операций нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-xs text-[var(--color-muted-fg)]">
                  <th className="px-3 py-2.5">Дата (МСК)</th>
                  <th className="px-3 py-2.5">Ученик</th>
                  <th className="px-3 py-2.5">Тип</th>
                  <th className="px-3 py-2.5 text-right">Сумма</th>
                  <th className="px-3 py-2.5">Причина</th>
                  <th className="px-3 py-2.5">Автор</th>
                </tr>
              </thead>
              <tbody>
                {ops.slice(0, 300).map((o: Operation) => (
                  <tr key={o.id} className="border-t border-[var(--color-border-color)]">
                    <td className="px-3 py-2 whitespace-nowrap">{formatMSK(o.created_at)}</td>
                    <td className="px-3 py-2">{ctx.studentName(o.student_id)}</td>
                    <td className="px-3 py-2">
                      {o.op_type === 'accrual' ? 'Начисление' : o.op_type === 'write_off' ? 'Списание' : 'Отмена'}
                    </td>
                    <td className="money-num px-3 py-2 text-right">
                      {o.op_type === 'write_off' ? '−' : o.op_type === 'reversal' ? '↩ ' : '+'}{o.amount}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-muted-fg)]">{ctx.reasonLabel(o.reason_id) || '—'}</td>
                    <td className="px-3 py-2 text-[var(--color-muted-fg)]">{o.author_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ops.length > 300 && (
          <p className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">Показаны первые 300 из {ops.length} — полный список в CSV/XLSX.</p>
        )}
      </Card>

      <Card className="mt-3 p-3">
        <div className="mb-1.5 text-[13px] font-bold">Бэкап (JSON)</div>
        <p className="mt-0 mb-2 text-xs text-[var(--color-muted-fg)]">
          Копия базы — файл JSON. Скачайте его и положите на флешку.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleBackupSave}>
            <Download className="size-3.5" aria-hidden="true" />
            Сохранить копию JSON
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" aria-hidden="true" />
            Восстановить из JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleBackupFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </Card>
    </div>
  );
}
