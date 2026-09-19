import { useMemo, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { localRepo } from '../lib/localRepo';
import { mapBusinessError } from '../lib/ui-validation';
import { BulkAccrualBar } from './BulkAccrualBar';
import { Modal } from './Modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Card } from '../ui/card';
import { cn } from '../lib/utils';

interface GroupsPageProps {
  version: number;
  authorName: string;
  onChanged: () => void;
  onToast: (message: string) => void;
}

/**
 * Группы: CRUD названий + состав через group_name/group_members +
 * выбор чекбоксами → BulkAccrualBar + перенос сменой группы.
 */
export function GroupsPage({ version, authorName, onChanged, onToast }: GroupsPageProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ id: string; fullName: string; from: string } | null>(null);
  const [moveValue, setMoveValue] = useState('');

  // version в зависимостях: localRepo не реактивен, пересчёт по bump из App.
  const groups = useMemo(() => {
    void version;
    return localRepo.listGroups();
  }, [version]);
  const students = useMemo(() => {
    void version;
    return localRepo.listStudents({ status: 'active' });
  }, [version]);
  const nameOf = useMemo(() => {
    const m = new Map(students.map((s) => [s.id, s.full_name]));
    return (id: string) => m.get(id) ?? 'ученик';
  }, [students]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => (selectedGroup ? s.group_name === selectedGroup : true))
      .filter((s) => (q ? s.full_name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
  }, [students, selectedGroup, search]);

  const ungrouped = useMemo(() => students.filter((s) => !s.group_name), [students]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const ids = visible.map((s) => s.id);
      const all = ids.every((id) => next.has(id));
      if (all) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  }

  function run(fn: () => void, okMsg: string) {
    setError(null);
    try {
      fn();
      setSelectedIds(new Set());
      onChanged();
      onToast(okMsg);
    } catch (e) {
      setError(mapBusinessError(e instanceof Error ? e.message : 'Не удалось выполнить'));
    }
  }

  return (
    <div>
      <Card className="mb-3 flex flex-wrap items-end gap-2 p-3">
        <Label className="min-w-40 flex-1 text-xs text-[var(--color-muted-fg)]">
          Группа
          <Select value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setSelectedIds(new Set()); }} className="mt-1">
            <option value="">Все группы</option>
            {groups.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.count})
              </option>
            ))}
          </Select>
        </Label>
        <Label className="min-w-44 flex-[2] text-xs text-[var(--color-muted-fg)]">
          Поиск ученика
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Фамилия…" className="mt-1" />
        </Label>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Группа
        </Button>
      </Card>

      {error && (
        <p className="mb-3 rounded-[var(--radius-m)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger-text)]">{error}</p>
      )}

      <Card className="mb-3 p-3">
        <div className="mb-2 text-[13px] font-bold text-[var(--color-fg)]">Группы ({groups.length})</div>
        {groups.length === 0 ? (
          <p className="text-[13px] text-[var(--color-muted-fg)]">Групп пока нет — создайте первую кнопкой «+ Группа».</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <span
                key={g.name}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-color)] py-1 pr-1.5 pl-2.5 text-[13px]',
                  selectedGroup === g.name && 'bg-[var(--color-primary-100)]',
                )}
              >
                <button
                  type="button"
                  onClick={() => { setSelectedGroup(selectedGroup === g.name ? '' : g.name); setSelectedIds(new Set()); }}
                  title="Показать состав"
                  className="cursor-pointer bg-transparent text-[13px] font-bold text-[var(--color-fg)]"
                >
                  {g.name} · {g.count}
                </button>
                <Button type="button" variant="ghost" size="icon-xs" title="Переименовать" onClick={() => { setRenameTarget(g.name); setRenameValue(g.name); }}>
                  <Pencil className="size-3" aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" title="Удалить группу" onClick={() => setDeleteTarget(g.name)}>
                  <X className="size-3" aria-hidden="true" />
                </Button>
              </span>
            ))}
          </div>
        )}
        {ungrouped.length > 0 && (
          <p className="mt-2 text-xs text-[var(--color-muted-fg)]">Без группы: {ungrouped.length}</p>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 border-b border-[var(--color-border-color)] px-3 py-2.5 text-[13px]">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={visible.length > 0 && visible.every((s) => selectedIds.has(s.id))} onChange={toggleVisible} />
            Выбрать всех на экране ({visible.length})
          </label>
          <span className="flex-1" />
          <span className="text-[var(--color-muted-fg)]">Выбрано: {selectedIds.size}</span>
        </div>
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--color-muted-fg)]">Нет учеников</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--color-border-color)] first:border-t-0">
                    <td className="w-8 px-3 py-2">
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Выбрать ${s.full_name}`} />
                    </td>
                    <td className="px-3 py-2">
                      <b className="text-[var(--color-fg)]">{s.full_name}</b>
                      <span className="text-xs text-[var(--color-muted-fg)]"> · {s.group_name || 'без группы'} · <span className="money-num">{s.balance}</span></span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title="Перенести в другую группу"
                        onClick={() => { setMoveTarget({ id: s.id, fullName: s.full_name, from: s.group_name }); setMoveValue(s.group_name); }}
                        className="mr-1"
                      >
                        Перенос
                      </Button>
                      {s.group_name && (
                        <Button type="button" variant="ghost" size="sm" title="Убрать из группы" onClick={() => run(() => localRepo.removeGroupMember(s.id), `«${s.full_name}» убран из группы`)}>
                          Убрать
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedIds.size > 0 && (
        <BulkAccrualBar
          selectedIds={[...selectedIds]}
          studentName={nameOf}
          authorName={authorName}
          onDone={(m) => { setSelectedIds(new Set()); onToast(m); }}
          onError={(m) => setError(m)}
          onApplied={onChanged}
        />
      )}

      {createOpen && (
        <Modal title="Новая группа" subtitle="Название — до 10 символов" onClose={() => setCreateOpen(false)} maxWidth={400}>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Например: А-1" maxLength={10} />
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button
              type="button"
              onClick={() => {
                run(() => localRepo.createGroup(newName), `Группа «${newName.trim()}» создана`);
                setCreateOpen(false);
                setNewName('');
              }}
            >
              Создать
            </Button>
          </div>
        </Modal>
      )}

      {renameTarget && (
        <Modal title={`Переименовать «${renameTarget}»`} onClose={() => setRenameTarget(null)} maxWidth={400}>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={10} />
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>Отмена</Button>
            <Button
              type="button"
              onClick={() => {
                const from = renameTarget;
                run(() => localRepo.renameGroup(from, renameValue), `Группа «${from}» → «${renameValue.trim()}»`);
                setRenameTarget(null);
                if (selectedGroup === from) setSelectedGroup(renameValue.trim());
              }}
            >
              Сохранить
            </Button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title={`Удалить группу «${deleteTarget}»?`} onClose={() => setDeleteTarget(null)} maxWidth={400}>
          <p className="text-sm">Ученики останутся в базе, но станут «без группы». История операций сохранится.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const name = deleteTarget;
                run(() => localRepo.deleteGroup(name), `Группа «${name}» удалена`);
                setDeleteTarget(null);
                if (selectedGroup === name) setSelectedGroup('');
              }}
            >
              Удалить
            </Button>
          </div>
        </Modal>
      )}

      {moveTarget && (
        <Modal title="Перенос ученика" subtitle={`${moveTarget.fullName} · сейчас: ${moveTarget.from || 'без группы'}`} onClose={() => setMoveTarget(null)} maxWidth={420}>
          <Label className="text-xs text-[var(--color-muted-fg)]">
            Новая группа (пусто = без группы)
            <Input value={moveValue} onChange={(e) => setMoveValue(e.target.value)} maxLength={10} placeholder="А-1" list="groups-datalist" className="mt-1" />
            <datalist id="groups-datalist">
              {groups.map((g) => (
                <option key={g.name} value={g.name} />
              ))}
            </datalist>
          </Label>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMoveTarget(null)}>Отмена</Button>
            <Button
              type="button"
              onClick={() => {
                const t = moveTarget;
                run(() => localRepo.moveStudent(t.id, moveValue), `«${t.fullName}» → ${moveValue.trim() || 'без группы'}`);
                setMoveTarget(null);
              }}
            >
              Перенести
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
