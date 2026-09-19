import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { localRepo } from '../lib/localRepo';
import { mapBusinessError } from '../lib/ui-validation';
import { Button } from '../ui/button';

interface BackupButtonsProps {
  compact?: boolean;
  onChanged: () => void;
  onToast: (message: string) => void;
  onError: (message: string) => void;
}

/** Бэкап в топбаре: сохранить копию JSON / восстановить из JSON с подтверждением. */
export function BackupButtons({ compact, onChanged, onToast, onError }: BackupButtonsProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function save() {
    const blob = new Blob([localRepo.exportJson()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robbo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onToast('Копия JSON сохранена — положите её на флешку');
  }

  async function restore(file: File | null) {
    if (!file) return;
    const text = await file.text();
    if (!window.confirm(`Восстановить данные из «${file.name}»? Текущие данные будут заменены.`)) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    try {
      localRepo.importJson(text);
      onChanged();
      onToast('Данные восстановлены из JSON');
    } catch (e) {
      onError(mapBusinessError(e instanceof Error ? e.message : 'Не удалось восстановить'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={save}
        title="Скачать копию базы (положите файл на флешку)"
      >
        <Download className="size-3.5" aria-hidden="true" />
        {compact ? 'JSON' : 'Сохранить копию JSON'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileRef.current?.click()}
        title="Восстановить данные из файла-копии"
      >
        <Upload className="size-3.5" aria-hidden="true" />
        {compact ? 'Restore' : 'Восстановить из JSON'}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => void restore(e.target.files?.[0] ?? null)}
      />
    </span>
  );
}
