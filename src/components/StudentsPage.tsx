import { useMemo, useState } from 'react';
import { Archive, Minus, Pencil, Plus, Upload, Zap } from 'lucide-react';
import { localRepo, type Student } from '../lib/localRepo';
import { ImportStudentsDialog } from './ImportStudentsDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';

const PAGE_SIZE = 50;

interface StudentsPageProps {
  version: number;
  onOpenCard: (student: Student) => void;
  onQuickOp: (student: Student) => void;
  onFullOp: (student: Student) => void;
  onEdit: (student: Student) => void;
  onArchive: (student: Student, mode: 'archive' | 'restore') => void;
  onCreate: () => void;
  onChanged: () => void;
  onToast: (message: string) => void;
}

/** Ученики: поиск, фильтры, таблица, пагинация по 50, импорт Excel. */
export function StudentsPage({ version, onOpenCard, onQuickOp, onFullOp, onEdit, onArchive, onCreate, onChanged, onToast }: StudentsPageProps) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  const groups = useMemo(() => {
    const s = new Set<string>();
    void version;
    for (const st of localRepo.listStudents()) if (st.group_name) s.add(st.group_name);
    return [...s].sort();
  }, [version]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    void version;
    return localRepo
      .listStudents()
      .filter((st) => (status === 'all' ? true : st.status === status))
      .filter((st) => (group ? st.group_name === group : true))
      .filter((st) => (q ? st.full_name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
  }, [version, search, group, status]);

  const total = filtered.length;
  const rows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  function reset() {
    setSearch('');
    setGroup('');
    setStatus('active');
    setPage(0);
  }

  return (
    <div>
      <Card className="mb-3 flex flex-wrap items-end gap-2 p-3">
        <Label className="flex-2 min-w-44 text-xs text-[var(--color-muted-fg)]">
          Поиск по ФИО
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Иванов…"
            className="mt-1"
          />
        </Label>
        <Label className="min-w-30 flex-1 text-xs text-[var(--color-muted-fg)]">
          Группа
          <Select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setPage(0);
            }}
            className="mt-1"
          >
            <option value="">Все</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Label>
        <Label className="min-w-30 flex-1 text-xs text-[var(--color-muted-fg)]">
          Статус
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(0);
            }}
            className="mt-1"
          >
            <option value="active">Активные</option>
            <option value="archived">Архив</option>
            <option value="all">Все</option>
          </Select>
        </Label>
        <Button type="button" variant="outline" onClick={reset}>
          Сбросить
        </Button>
        <Button type="button" variant="outline" onClick={() => setImportOpen(true)} title="Импорт из .xlsx (Фамилия|Имя|Отчество|Группа|Телефон|Дата рождения)">
          <Upload className="size-3.5" aria-hidden="true" />
          Импорт Excel
        </Button>
        <Button type="button" onClick={onCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Ученик
        </Button>
      </Card>

      {rows.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-[var(--color-muted-fg)]">
          Ученики не найдены
          <div className="mt-2.5">
            <Button type="button" variant="outline" onClick={reset}>
              Сбросить фильтры
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-muted-fg)]">
                  <th className="px-3 py-2.5">ФИО</th>
                  <th className="px-3 py-2.5">Группа</th>
                  <th className="px-3 py-2.5 text-right">Баланс</th>
                  <th className="px-3 py-2.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((st) => (
                  <tr key={st.id} className="border-t border-[var(--color-border-color)]">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenCard(st)}
                        title="Открыть карточку"
                        className="cursor-pointer bg-transparent p-0 text-left text-sm font-semibold text-[var(--color-primary-600)] hover:underline dark:text-[var(--color-primary-300)]"
                      >
                        {st.full_name}
                      </button>
                      {st.status === 'archived' && (
                        <span className="text-[11px] text-[var(--color-muted-fg)]"> · архив</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-muted-fg)]">{st.group_name || '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <b className="money-num">{st.balance}</b>{' '}
                      {st.balance < 0 && <Badge variant="destructive">долг</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {st.status === 'active' ? (
                        <span className="inline-flex gap-1">
                          <Button type="button" variant="secondary" size="icon-sm" onClick={() => onQuickOp(st)} title="Быстрая операция (2 клика)">
                            <Zap className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button type="button" variant="secondary" size="icon-sm" onClick={() => onFullOp(st)} title="Начислить / списать с комментарием">
                            <Plus className="size-3.5" aria-hidden="true" />
                            <Minus className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(st)} title="Редактировать">
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onArchive(st, 'archive')} title="В архив">
                            <Archive className="size-3.5" aria-hidden="true" />
                          </Button>
                        </span>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => onArchive(st, 'restore')} title="Восстановить из архива">
                          Восстановить
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border-color)] px-3 py-2.5 text-[13px] text-[var(--color-muted-fg)]">
            <span>
              Показано {from}–{to} из {total}
            </span>
            <span className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                ‹ Назад
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage(page + 1)}
              >
                Вперёд ›
              </Button>
            </span>
          </div>
        </Card>
      )}
      {importOpen && (
        <ImportStudentsDialog
          onClose={() => setImportOpen(false)}
          onChanged={onChanged}
          onDone={onToast}
        />
      )}
    </div>
  );
}

