import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';
import {
  Users,
  Layers,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Coins,
} from 'lucide-react';
import { localRepo, type Student } from './lib/localRepo';
import { mapBusinessError } from './lib/ui-validation';
import { cn } from './lib/utils';
import { ToastHost, type ToastData } from './components/Toast';
import { StudentsPage } from './components/StudentsPage';
import { GroupsPage } from './components/GroupsPage';
import { ReportsPage } from './components/ReportsPage';
import { BackupButtons } from './components/BackupButtons';
import { StudentCard } from './components/StudentCard';
import { QuickOperationDialog } from './components/QuickOperationDialog';
import { OperationDialog } from './components/OperationDialog';
import { ArchiveDialog, StudentFormDialog } from './components/StudentFormDialog';
import { SettingsPage } from './components/SettingsPage';
import ThemeToggle from './components/ThemeToggle';
import { Select } from './ui/select';

const TEACHER_KEY = 'robbo-bank-local:teacher';
const TEACHERS = ['Учитель 1', 'Учитель 2'];
const SIDEBAR_KEY = 'robbo.sidebar.collapsed';

function loadTeacher(): string {
  try {
    const v = localStorage.getItem(TEACHER_KEY);
    if (v && TEACHERS.includes(v)) return v;
  } catch {
    // ignore
  }
  return TEACHERS[0];
}

function initialCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    // ignore
  }
  return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type Tab = 'students' | 'groups' | 'reports' | 'settings';

const NAV: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'students', label: 'Ученики', icon: Users },
  { id: 'groups', label: 'Группы', icon: Layers },
  { id: 'reports', label: 'Отчёты', icon: BarChart3 },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

const TITLES: Record<Tab, string> = {
  students: 'Ученики',
  groups: 'Группы',
  reports: 'Отчёты',
  settings: 'Настройки',
};

export default function App() {
  const [teacher, setTeacher] = useState(loadTeacher);
  const [tab, setTab] = useState<Tab>('students');
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);

  const [cardId, setCardId] = useState<string | null>(null);
  const [quickStudent, setQuickStudent] = useState<Student | null>(null);
  const [fullStudent, setFullStudent] = useState<Student | null>(null);
  const [formStudent, setFormStudent] = useState<Student | null | undefined>(undefined);
  const [archiveReq, setArchiveReq] = useState<{ student: Student; mode: 'archive' | 'restore' } | null>(null);

  const navRef = useRef<HTMLElement>(null);
  const [barTop, setBarTop] = useState<number | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) {
      setBarTop(null);
      return;
    }
    setBarTop(active.offsetTop + (active.offsetHeight - 20) / 2);
  }, [tab, collapsed]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  function switchTeacher(name: string) {
    setTeacher(name);
    try {
      localStorage.setItem(TEACHER_KEY, name);
    } catch {
      // ignore
    }
  }

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  const showToast = useCallback((message: string, opId: string | null) => {
    setToast({ id: Date.now(), message, opId });
  }, []);

  const closeToast = useCallback(() => setToast(null), []);

  // Автопроверка обновлений: при запуске + раз в полдня (см. updater.ts).
  // Учителю ничего делать не надо: новая версия качается сама,
  // остаётся только нажать «Перезапустить» в уведомлении.
  useEffect(() => {
    let stop: (() => void) | undefined;
    void (async () => {
      try {
        const { startAutoUpdater, relaunchApp } = await import('./lib/updater');
        stop = startAutoUpdater({
          onDownloaded: (version) => {
            sonnerToast.success(`Скачалась новая версия ${version}`, {
              description: 'Данные сохранятся. Перезапустить приложение?',
              duration: 60_000,
              action: {
                label: 'Перезапустить',
                onClick: () =>
                  void relaunchApp().catch(() =>
                    showToast('Не удалось перезапустить — закройте и откройте вручную', null),
                  ),
              },
            });
          },
        });
      } catch {
        // тихая проверка не должна мешать запуску
      }
    })();
    return () => stop?.();
  }, [showToast]);

  function handleUndo(opId: string) {
    try {
      localRepo.reverseOperation(opId, teacher);
      refresh();
      setToast({ id: Date.now(), message: 'Операция отменена', opId: null });
    } catch (e) {
      setToast({ id: Date.now(), message: mapBusinessError(e instanceof Error ? e.message : 'Не удалось отменить'), opId: null });
    }
  }

  return (
    <div className="density-compact flex min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* Sidebar слева */}
      <aside
        className={cn(
          'flex h-screen shrink-0 sticky top-0 flex-col border-r border-[var(--color-border-color)] bg-[var(--color-card-bg)] transition-[width] duration-200 ease-[var(--ease-smooth)]',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        <div className={cn('flex items-center gap-2.5 px-3 py-4', collapsed && 'justify-center px-0')}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-600)]">
            <Coins className="size-4 text-white" aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--color-fg)]">Мир Робот</div>
              <div className="text-[10px] tracking-wide text-[var(--color-muted-fg)] uppercase">
                RobboCoins
              </div>
            </div>
          )}
        </div>

        <nav ref={navRef} className="relative flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
          <span
            aria-hidden="true"
            data-testid="nav-indicator"
            className="pointer-events-none absolute left-0 w-1 rounded-r-full bg-[var(--color-primary-600)] transition-[top,opacity] duration-200 ease-[var(--ease-smooth)] dark:bg-[var(--color-primary-300)]"
            style={{ top: barTop ?? 0, opacity: barTop === null ? 0 : 1, height: 20 }}
          />
          {NAV.map((item) => {
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                data-active={isActive ? 'true' : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'nav-item relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)]',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-600)] dark:bg-[var(--color-primary-800)]/30 dark:text-[var(--color-primary-300)]'
                    : 'text-[var(--color-muted-fg)]',
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[var(--color-border-color)] p-2">
          <div
            data-testid="sidebar-user"
            className={cn('mb-1 flex items-center gap-2.5 rounded-md px-1.5 py-1.5', collapsed && 'justify-center px-0')}
            title={collapsed ? teacher : undefined}
          >
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-semibold text-[var(--color-primary-700)] dark:text-[var(--color-primary-300)]"
              aria-hidden="true"
            >
              {initialsOf(teacher)}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-[var(--color-fg)]">{teacher}</div>
                <div className="text-[10px] tracking-wide text-[var(--color-muted-fg)] uppercase">Учитель</div>
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="mb-1 px-1.5">
              <Select value={teacher} onChange={(e) => switchTeacher(e.target.value)} aria-label="Учитель">
                {TEACHERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            className={cn(
              'nav-item flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--color-muted-fg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)]',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
            {!collapsed && <span>Свернуть</span>}
          </button>
        </div>
      </aside>

      {/* Правая колонка: топбар + контент */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border-color)] bg-[var(--color-card-bg)] px-4">
          <div className="text-sm font-semibold text-[var(--color-fg)]">{TITLES[tab]}</div>
          <div className="flex items-center gap-2">
            <BackupButtons compact onChanged={refresh} onToast={(m) => showToast(m, null)} onError={(m) => showToast(m, null)} />
            {collapsed && (
              <Select value={teacher} onChange={(e) => switchTeacher(e.target.value)} aria-label="Учитель" className="w-36">
                {TEACHERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            )}
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-4">
          <div key={tab} className="animate-page-in">
            {tab === 'students' && (
              <StudentsPage
                version={version}
                onOpenCard={(st) => setCardId(st.id)}
                onQuickOp={setQuickStudent}
                onFullOp={setFullStudent}
                onEdit={(st) => setFormStudent(st)}
                onArchive={(student, mode) => setArchiveReq({ student, mode })}
                onCreate={() => setFormStudent(null)}
                onChanged={refresh}
                onToast={(m) => showToast(m, null)}
              />
            )}
            {tab === 'groups' && (
              <GroupsPage version={version} authorName={teacher} onChanged={refresh} onToast={(m) => showToast(m, null)} />
            )}
            {tab === 'reports' && (
              <ReportsPage version={version} onChanged={refresh} onToast={(m) => showToast(m, null)} />
            )}
            {tab === 'settings' && <SettingsPage onToast={(m) => showToast(m, null)} />}
          </div>
        </main>
      </div>

      {cardId && (
        <StudentCard
          studentId={cardId}
          authorName={teacher}
          onClose={() => setCardId(null)}
          onChanged={refresh}
          onDone={showToast}
          onQuickOp={(st) => setQuickStudent(st)}
          onFullOp={(st) => setFullStudent(st)}
          onEdit={(st) => setFormStudent(st)}
        />
      )}
      {quickStudent && (
        <QuickOperationDialog
          student={quickStudent}
          authorName={teacher}
          onClose={() => setQuickStudent(null)}
          onChanged={refresh}
          onDone={showToast}
        />
      )}
      {fullStudent && (
        <OperationDialog
          student={fullStudent}
          authorName={teacher}
          onClose={() => setFullStudent(null)}
          onChanged={refresh}
          onDone={showToast}
        />
      )}
      {formStudent !== undefined && (
        <StudentFormDialog
          student={formStudent}
          onClose={() => setFormStudent(undefined)}
          onChanged={refresh}
          onDone={showToast}
        />
      )}
      {archiveReq && (
        <ArchiveDialog
          student={archiveReq.student}
          mode={archiveReq.mode}
          onClose={() => setArchiveReq(null)}
          onChanged={refresh}
          onDone={showToast}
        />
      )}

      <ToastHost toast={toast} onUndo={handleUndo} onClose={closeToast} />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

