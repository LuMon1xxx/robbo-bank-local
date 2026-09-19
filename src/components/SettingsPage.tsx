import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Moon, Palette, Pencil, Plus, RefreshCw, RotateCcw, Settings, Sun, Trash2, Upload, Zap } from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from './ThemeToggle';
import { PalettePicker } from './PalettePicker';
import { getPalette, applyPalette, PALETTES, type PaletteId } from '../lib/palette';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { cn } from '../lib/utils';
import { localRepo } from '../lib/localRepo';
import { mapBusinessError } from '../lib/ui-validation';
import {
  CHANGELOG,
  checkForUpdates,
  downloadAndInstallUpdate,
  formatReleaseDate,
  getAppVersion,
  relaunchApp,
  type UpdateStatus,
} from '../lib/updater';
import {
  applyAppearance,
  BTN_SHAPES,
  DEFAULT_APPEARANCE,
  FONT_SIZES,
  loadAppearance,
  RADII,
  resetAppearance,
  updateAppearance,
  type AppearanceSettings,
  type BtnShapeKey,
  type BtnStyleKey,
  type RadiusKey,
} from '../lib/appearance';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ThemeTransfer({ onChanged }: { onChanged: () => void }) {
  function exportTheme() {
    downloadJson(
      { version: 1, palette: getPalette(), appearance: loadAppearance() },
      'robbo-theme.json',
    );
    toast.success('Файл темы сохранён в загрузки');
  }

  async function importTheme(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as {
        palette?: string;
        appearance?: AppearanceSettings;
      };
      if (typeof parsed.palette === 'string') applyPalette(parsed.palette as never);
      if (parsed.appearance && typeof parsed.appearance === 'object') {
        const clean = { ...DEFAULT_APPEARANCE, ...parsed.appearance };
        applyAppearance(clean);
        toast.success('Тема применена');
        onChanged();
        setTimeout(() => window.location.reload(), 600);
      } else {
        toast.error('В файле нет настроек внешнего вида');
      }
    } catch {
      toast.error('Не удалось прочитать файл темы');
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={exportTheme} data-testid="theme-export">
        <Download className="size-3.5" aria-hidden="true" />
        Экспорт темы
      </Button>
      <label>
        <input
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importTheme(f);
            e.target.value = '';
          }}
          data-testid="theme-import-input"
        />
        <span
          className="group/button inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[var(--btn-radius,var(--radius-m))] border border-[var(--color-border-color)] bg-transparent px-3 text-sm font-medium transition-all hover:bg-[var(--color-muted-fg)/10]"
          data-testid="theme-import-button"
        >
          <Upload className="size-3.5" aria-hidden="true" />
          Импорт темы
        </span>
      </label>
    </div>
  );
}

const SIZE_LABELS: Record<keyof typeof FONT_SIZES, string> = { sm: 'Мелкий', md: 'Обычный', lg: 'Крупный' };
const RADIUS_LABELS: Record<RadiusKey, string> = { sharp: 'Острые', default: 'Обычные', round: 'Мягкие' };
const SHAPE_LABELS: Record<BtnShapeKey, string> = { default: 'Обычные', pill: 'Пилюли', square: 'Прямые' };
const STYLE_LABELS: Record<BtnStyleKey, string> = { filled: 'Заливка', soft: 'Мягкий' };

function setThemeMode(mode: 'light' | 'dark' | 'system') {
  localStorage.setItem('robbo.theme', mode);
  const systemDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', mode === 'dark' || (mode === 'system' && systemDark));
}

function ThemePresets({ onApplied }: { onApplied: () => void }) {
  const swatchOf = (id: PaletteId): readonly [string, string, string] =>
    PALETTES.find((p) => p.id === id)?.swatch ?? ['#335e4b', '#4a7d65', '#b9d2c3'];

  const presets = [
    {
      id: 'cabinet',
      title: 'Кабинет',
      desc: 'Тёплая бумага, мох',
      palette: 'classic' as PaletteId,
      mode: 'light' as const,
      look: {},
    },
    {
      id: 'evening',
      title: 'Вечерняя смена',
      desc: 'Тёплая тёмная',
      palette: 'classic' as PaletteId,
      mode: 'dark' as const,
      look: {},
    },
    {
      id: 'ocean',
      title: 'Морская волна',
      desc: 'Светлая, мягкие кнопки',
      palette: 'ocean' as PaletteId,
      mode: 'light' as const,
      look: { radius: 'round', btnShape: 'pill' } as const,
    },
    {
      id: 'forest',
      title: 'Лесная поляна',
      desc: 'Глубокая тёмная зелень',
      palette: 'forest' as PaletteId,
      mode: 'dark' as const,
      look: {},
    },
    {
      id: 'sunset',
      title: 'Закат',
      desc: 'Тёплая, крупнее шрифт',
      palette: 'sunset' as PaletteId,
      mode: 'light' as const,
      look: { fontSize: 'lg', radius: 'round' } as const,
    },
    {
      id: 'graphite',
      title: 'Строгий',
      desc: 'Тёмный, прямые углы',
      palette: 'graphite' as PaletteId,
      mode: 'dark' as const,
      look: { radius: 'sharp', btnShape: 'square' } as const,
    },
  ];

  function applyPreset(p: (typeof presets)[number]) {
    setThemeMode(p.mode);
    applyPalette(p.palette);
    applyAppearance({ ...DEFAULT_APPEARANCE, primaryOverride: null, fontSize: 'md', ...p.look });
    toast.success(`Тема «${p.title}» применена`);
    onApplied();
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Готовые темы">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => applyPreset(p)}
          data-testid={`theme-preset-${p.id}`}
          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-[var(--radius-m)] border border-[var(--color-border-color)] px-2 py-2 text-xs transition-colors outline-none hover:text-[var(--color-fg)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)]"
        >
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <span className="flex overflow-hidden rounded-full ring-1 ring-black/10">
              {swatchOf(p.palette).map((c) => (
                <span key={c} className="h-5 w-5" style={{ backgroundColor: c }} />
              ))}
            </span>
            {p.mode === 'dark' ? (
              <Moon className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
            ) : (
              <Sun className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
            )}
          </span>
          <span className="font-semibold text-[var(--color-fg)]">{p.title}</span>
          <span className="text-[11px] text-[var(--color-muted-fg)]">{p.desc}</span>
        </button>
      ))}
    </div>
  );
}

export function SettingsPage({ onToast }: { onToast: (m: string) => void }) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => loadAppearance());
  const [, setTick] = useState(0);

  function patch(p: Partial<AppearanceSettings>) {
    setAppearance(updateAppearance(p));
  }

  function onAccentHex(raw: string) {
    const hex = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) patch({ primaryOverride: hex.toLowerCase() });
  }

  function resetAll() {
    resetAppearance();
    applyPalette('classic');
    setAppearance({ ...DEFAULT_APPEARANCE });
    setTick((t) => t + 1);
    onToast('Внешний вид сброшен');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-m)] bg-[var(--color-primary-100)] text-[var(--color-primary-600)] dark:text-[var(--color-primary-300)]">
          <Settings className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-fg)]">Настройки</h1>
          <p className="text-sm text-[var(--color-muted-fg)]">
            Внешний вид применяется сразу и запоминается на этом устройстве
          </p>
        </div>
      </div>

      <Card title="Тема" hint="Светлая, тёмная или как в системе">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-muted-fg)]">Режим оформления</p>
          <ThemeToggle />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm text-[var(--color-muted-fg)]">Готовые темы для учителя</p>
          <ThemePresets onApplied={() => setAppearance(loadAppearance())} />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm text-[var(--color-muted-fg)]">Базовая палитра</p>
          <PalettePicker testIdPrefix="settings-palette" />
        </div>
      </Card>

      <Card
        title="Свой акцентный цвет"
        hint="Перекрывает палитру: из одного цвета соберётся вся гамма с контрастом по WCAG"
      >
        <div className="flex flex-wrap items-center gap-3">
          <label
            className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-[var(--radius-m)] ring-1 ring-[var(--color-border-color)]"
            style={{ backgroundColor: appearance.primaryOverride ?? 'var(--color-primary-600)' }}
            aria-label="Выбрать акцентный цвет"
          >
            <input
              type="color"
              value={appearance.primaryOverride ?? '#335e4b'}
              onChange={(e) => patch({ primaryOverride: e.target.value.toLowerCase() })}
              className="absolute inset-0 cursor-pointer opacity-0"
              data-testid="accent-color-input"
            />
          </label>
          <Input
            value={appearance.primaryOverride ?? ''}
            onChange={(e) => onAccentHex(e.target.value)}
            placeholder="#335e4b"
            className="w-44 font-mono text-sm"
            maxLength={7}
            spellCheck={false}
            aria-label="Hex акцентного цвета"
            data-testid="accent-hex-input"
          />
          {appearance.primaryOverride && (
            <Button variant="ghost" size="sm" onClick={() => patch({ primaryOverride: null })}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Вернуть палитру
            </Button>
          )}
        </div>
        {appearance.primaryOverride && (
          <p
            className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-dark)]"
            data-testid="accent-active-hint"
          >
            <Check className="size-3.5" aria-hidden="true" />
            Свой акцент активен — кнопки, ссылки и акценты перекрашены
          </p>
        )}
      </Card>

      <Card title="Масштаб и скругления">
        <div className="space-y-3">
          <SegmentedRow
            label="Размер интерфейса"
            value={appearance.fontSize}
            options={Object.keys(FONT_SIZES) as Array<keyof typeof FONT_SIZES>}
            labels={SIZE_LABELS}
            onChange={(fontSize) => patch({ fontSize })}
            testId="settings-font-size"
          />
          <SegmentedRow
            label="Скругления углов"
            value={appearance.radius}
            options={Object.keys(RADII) as RadiusKey[]}
            labels={RADIUS_LABELS}
            onChange={(radius) => patch({ radius })}
            testId="settings-radius"
          />
        </div>
      </Card>

      <Card title="Кнопки" hint="Форма и стиль всех кнопок приложения">
        <div className="space-y-3">
          <SegmentedRow
            label="Форма"
            value={appearance.btnShape}
            options={Object.keys(BTN_SHAPES) as BtnShapeKey[]}
            labels={SHAPE_LABELS}
            onChange={(btnShape) => patch({ btnShape })}
            testId="settings-btn-shape"
          />
          <SegmentedRow
            label="Стиль главной кнопки"
            value={appearance.btnStyle}
            options={['filled', 'soft'] as BtnStyleKey[]}
            labels={STYLE_LABELS}
            onChange={(btnStyle) => patch({ btnStyle })}
            testId="settings-btn-style"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-m)] border border-[var(--color-border-color)] p-3">
          <span className="mr-1 text-xs text-[var(--color-muted-fg)]">Превью:</span>
          <Button size="sm">Главная</Button>
          <Button size="sm" variant="outline">
            Обычная
          </Button>
          <Button size="sm" variant="ghost">
            Призрачная
          </Button>
        </div>
      </Card>

      <OperationPresetsCard />

      <UpdateCard />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <ThemeTransfer onChanged={() => setAppearance(loadAppearance())} />
        <Button
          variant="ghost"
          size="sm"
          onClick={resetAll}
          disabled={
            JSON.stringify(appearance) === JSON.stringify(DEFAULT_APPEARANCE) && getPalette() === 'classic'
          }
          className="text-[var(--color-muted-fg)]"
          data-testid="appearance-reset"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Сбросить внешний вид
        </Button>
      </div>
    </div>
  );
}

function OperationPresetsCard() {
  const [tick, setTick] = useState(0);
  const presets = useMemo(() => {
    void tick;
    return localRepo.listPresets();
  }, [tick]);
  const reasons = useMemo(() => {
    void tick;
    return localRepo.listReasons().filter((r) => r.is_active && (r.kind === 'accrual' || r.kind === 'any'));
  }, [tick]);

  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [reasonId, setReasonId] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editReasonId, setEditReasonId] = useState('');

  function add() {
    const amt = parseInt(amount, 10);
    if (!label.trim() || !reasonId || !Number.isInteger(amt) || amt <= 0) return;
    try {
      localRepo.createPreset({ label: label.trim(), amount: amt, reason_id: Number(reasonId) });
      toast.success('Шаблон добавлен');
      setLabel('');
      setAmount('');
      setReasonId('');
      setTick((t) => t + 1);
    } catch (err) {
      toast.error(mapBusinessError(err instanceof Error ? err.message : 'Ошибка'));
    }
  }

  function startEdit(p: { id: string; label: string; amount: number; reason_id: number | null }) {
    setEditingId(p.id);
    setEditLabel(p.label);
    setEditAmount(String(p.amount));
    setEditReasonId(p.reason_id != null ? String(p.reason_id) : '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditLabel('');
    setEditAmount('');
    setEditReasonId('');
  }

  function saveEdit() {
    if (!editingId) return;
    const amt = parseInt(editAmount, 10);
    if (!editLabel.trim() || !editReasonId || !Number.isInteger(amt) || amt <= 0) return;
    try {
      localRepo.updatePreset(editingId, { label: editLabel.trim(), amount: amt, reason_id: Number(editReasonId) });
      toast.success('Шаблон обновлён');
      cancelEdit();
      setTick((t) => t + 1);
    } catch (err) {
      toast.error(mapBusinessError(err instanceof Error ? err.message : 'Ошибка'));
    }
  }

  function remove(id: string) {
    try {
      localRepo.deletePreset(id);
      toast.success('Шаблон удалён');
      setTick((t) => t + 1);
    } catch (err) {
      toast.error(mapBusinessError(err instanceof Error ? err.message : 'Ошибка'));
    }
  }

  const canAdd =
    label.trim().length > 0 && reasonId !== '' && Number.isInteger(parseInt(amount, 10)) && parseInt(amount, 10) > 0;
  const canSaveEdit =
    editLabel.trim().length > 0 &&
    editReasonId !== '' &&
    Number.isInteger(parseInt(editAmount, 10)) &&
    parseInt(editAmount, 10) > 0;

  return (
    <section className="rounded-[var(--radius-l)] border border-[var(--color-border-color)] bg-[var(--color-card-bg)] p-5">
      <div className="mb-1 flex items-center gap-2">
        <Zap className="size-4 text-[var(--color-primary-500)]" aria-hidden="true" />
        <h2 className="font-semibold text-[var(--color-fg)]">Шаблоны операций</h2>
      </div>
      <p className="mb-4 text-xs text-[var(--color-muted-fg)]">
        Свои пресеты в быстром начислении: один клик вместо выбора причины и суммы
      </p>

      {presets.length > 0 && (
        <ul className="mb-4 space-y-1.5" data-testid="presets-list">
          {presets.map((p) => {
            const isEditing = editingId === p.id;
            return (
              <li key={p.id} className="rounded-[var(--radius-m)] border border-[var(--color-border-color)] px-3 py-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-36 flex-1 space-y-1">
                        <Label htmlFor={`edit-label-${p.id}`} className="text-xs">Название</Label>
                        <Input id={`edit-label-${p.id}`} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} maxLength={40} data-testid={`edit-label-${p.id}`} />
                      </div>
                      <div className="w-24 space-y-1">
                        <Label htmlFor={`edit-amount-${p.id}`} className="text-xs">Монет</Label>
                        <Input id={`edit-amount-${p.id}`} type="number" inputMode="numeric" min={1} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} data-testid={`edit-amount-${p.id}`} />
                      </div>
                      <div className="min-w-40 flex-1 space-y-1">
                        <Label className="text-xs">Причина</Label>
                        <Select value={editReasonId} onChange={(e) => setEditReasonId(e.target.value)} data-testid={`edit-reason-${p.id}`}>
                          <option value="">Причина</option>
                          {reasons.map((r) => (
                            <option key={r.id} value={String(r.id)}>{r.label}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={saveEdit} disabled={!canSaveEdit} data-testid={`edit-save-${p.id}`}>
                        Сохранить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} data-testid={`edit-cancel-${p.id}`}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-fg)]">{p.label}</span>
                    <span className="money-num shrink-0 text-sm font-semibold text-[var(--color-success-text)] dark:text-[var(--color-success-dark)]">
                      +{p.amount}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Редактировать шаблон ${p.label}`}
                      onClick={() => startEdit(p)}
                      disabled={editingId !== null}
                      className="shrink-0 text-[var(--color-muted-fg)] hover:text-[var(--color-fg)]"
                      data-testid={`edit-preset-${p.id}`}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Удалить шаблон ${p.label}`}
                      onClick={() => remove(p.id)}
                      className="shrink-0 text-[var(--color-muted-fg)] hover:text-[var(--color-danger-text)] dark:hover:text-[var(--color-danger-dark)]"
                      data-testid={`delete-preset-${p.id}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-36 flex-1 space-y-1">
          <Label htmlFor="preset-label">Название</Label>
          <Input id="preset-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Конкурс" data-testid="preset-label" />
        </div>
        <div className="w-24 space-y-1">
          <Label htmlFor="preset-amount">Монет</Label>
          <Input id="preset-amount" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50" data-testid="preset-amount" />
        </div>
        <div className="min-w-40 flex-1 space-y-1">
          <Label>Причина</Label>
          <Select value={reasonId} onChange={(e) => setReasonId(e.target.value)} data-testid="preset-reason">
            <option value="">Причина</option>
            {reasons.map((r) => (
              <option key={r.id} value={String(r.id)}>{r.label}</option>
            ))}
          </Select>
        </div>
        <Button onClick={add} disabled={!canAdd} data-testid="preset-add">
          <Plus className="size-4" aria-hidden="true" />
          Добавить
        </Button>
      </div>
    </section>
  );
}

function UpdateCard() {
  const [version, setVersion] = useState<string>('…');
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getAppVersion()
      .then(setVersion)
      .catch(() => setVersion('?'));
  }, []);

  async function onCheck() {
    setBusy(true);
    try {
      setStatus(await checkForUpdates());
    } finally {
      setBusy(false);
    }
  }

  async function onInstall() {
    setBusy(true);
    try {
      setStatus(await downloadAndInstallUpdate((p) =>
        setStatus({ status: 'downloading', version: status?.status === 'available' ? status.version : '?', progress: p }),
      ));
    } finally {
      setBusy(false);
    }
  }

  async function onRelaunch() {
    try {
      await relaunchApp();
    } catch {
      toast.error('Не удалось перезапустить — закройте и откройте приложение вручную');
    }
  }

  return (
    <section className="rounded-[var(--radius-l)] border border-[var(--color-border-color)] bg-[var(--color-card-bg)] p-5">
      <div className="mb-1 flex items-center gap-2">
        <RefreshCw className="size-4 text-[var(--color-primary-500)]" aria-hidden="true" />
        <h2 className="font-semibold text-[var(--color-fg)]">Обновления</h2>
      </div>
      <p className="mb-4 text-xs text-[var(--color-muted-fg)]">
        Текущая версия: <span className="money-num font-semibold">{version}</span>
        <br />
        Приложение само проверяет обновления при запуске и каждые 12 часов —
        кнопки ниже нужны только для ручной проверки.
      </p>

      {status?.status === 'unconfigured' && (
        <p className="text-sm text-[var(--color-muted-fg)]">
          Сервер обновлений ещё не подключён — новые версии учитель ставит вручную
          (новый RobboBank.exe поверх старого, данные сохранятся).
        </p>
      )}
      {status?.status === 'uptodate' && (
        <p className="text-sm text-[var(--color-success-text)] dark:text-[var(--color-success-dark)]">
          Установлена {status.version} — это последняя версия.
        </p>
      )}
      {status?.status === 'available' && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-fg)]">
            Установлена <span className="money-num">{status.currentVersion}</span>, вышла{' '}
            <b className="money-num">{status.version}</b>
            {status.date ? ` (${formatReleaseDate(status.date)})` : ''}.
            {status.notes ? ` Что нового: ${status.notes}` : ''}
          </p>
          <Button size="sm" onClick={() => void onInstall()} disabled={busy} data-testid="update-install">
            <Download className="size-3.5" aria-hidden="true" />
            Скачать и установить
          </Button>
        </div>
      )}
      {status?.status === 'downloading' && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-muted-fg)]">
            Скачивание {status.version}: {status.progress}%
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--color-muted-fg)/15]"
            role="progressbar"
            aria-valuenow={status.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-[var(--color-primary-600)] transition-[width]"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      )}
      {status?.status === 'ready' && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-success-text)] dark:text-[var(--color-success-dark)]">
            Версия {status.version} установлена.
          </p>
          <Button size="sm" onClick={() => void onRelaunch()} data-testid="update-relaunch">
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Перезапустить
          </Button>
        </div>
      )}
      {status?.status === 'error' && (
        <p className="text-sm text-[var(--color-danger-text)] dark:text-[var(--color-danger-dark)]">
          Не удалось проверить: {status.message}
        </p>
      )}

      {status?.status !== 'downloading' && status?.status !== 'ready' && (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => void onCheck()} disabled={busy} data-testid="update-check">
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Проверить обновления
          </Button>
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-[var(--color-muted-fg)] hover:text-[var(--color-fg)]">
          Что нового в версиях
        </summary>
        <ul className="mt-2 space-y-2">
          {CHANGELOG.map((e) => (
            <li key={e.version} className="rounded-[var(--radius-m)] border border-[var(--color-border-color)] px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <b className="money-num">{e.version}</b>
                <span className="text-xs text-[var(--color-muted-fg)]">{e.date}</span>
              </div>
              <div className="font-medium text-[var(--color-fg)]">{e.title}</div>
              <div className="text-xs text-[var(--color-muted-fg)]">{e.notes}</div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-l)] border border-[var(--color-border-color)] bg-[var(--color-card-bg)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Palette className="size-4 text-[var(--color-primary-500)]" aria-hidden="true" />
        <h2 className="font-semibold text-[var(--color-fg)]">{title}</h2>
      </div>
      {hint && <p className="-mt-2 mb-4 text-xs text-[var(--color-muted-fg)]">{hint}</p>}
      {children}
    </section>
  );
}

function SegmentedRow<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  testId: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-[var(--color-muted-fg)]">{label}</span>
      <div className="flex rounded-[var(--radius-s)] border border-[var(--color-border-color)] p-0.5" role="group" aria-label={label}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              aria-pressed={active}
              data-testid={`${testId}-${opt}`}
              className={cn(
                'rounded-[calc(var(--radius-s)-2px)] px-3 py-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)]',
                active ? 'bg-[var(--color-primary-600)] text-white' : 'text-[var(--color-muted-fg)] hover:text-[var(--color-fg)]',
              )}
            >
              {labels[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
