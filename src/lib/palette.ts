/**
 * Палитры интерфейса (PKG-THEMES, решение заказчика 24.08).
 *
 * Палитра применяется атрибутом [data-palette] на <html>; классика = отсутствие
 * атрибута (дефолтные токены index.css не тронуты — нулевой регрессионный риск).
 * Выбор хранится в localStorage 'robbo.palette' и применяется до первого рендера
 * (main.tsx), чтобы не мигать дефолтным индиго.
 *
 * Правила заказчика: тёмная тема меняет только primary-100/600 + shadcn
 * primary/ring; нейтральные 300/700/800 в dark не трогаются; золото общее.
 * Контраст белого на primary-600 ≥ 4.5 проверен для всех шести палитр.
 */

export const PALETTE_IDS = ['classic', 'ocean', 'forest', 'sunset', 'rose', 'graphite'] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

export interface PaletteMeta {
  id: PaletteId;
  label: string;
  /** Свотч [600, 500, 300] — как в CSS-блоках палитры. */
  swatch: readonly [string, string, string];
}

export const PALETTES: readonly PaletteMeta[] = [
  { id: 'classic', label: 'Кабинет', swatch: ['#335e4b', '#4a7d65', '#b9d2c3'] },
  { id: 'ocean', label: 'Океан', swatch: ['#2563eb', '#3b82f6', '#93c5fd'] },
  { id: 'forest', label: 'Лес', swatch: ['#15803d', '#16a34a', '#86efac'] },
  { id: 'sunset', label: 'Закат', swatch: ['#c2410c', '#f97316', '#fdba74'] },
  { id: 'rose', label: 'Роза', swatch: ['#be123c', '#f43f5e', '#fda4af'] },
  { id: 'graphite', label: 'Графит', swatch: ['#475569', '#64748b', '#94a3b8'] },
];

const STORAGE_KEY = 'robbo.palette';

/** Сохранённая палитра; classic — значение по умолчанию. */
export function getPalette(): PaletteId {
  if (typeof window === 'undefined') return 'classic';
  const saved = localStorage.getItem(STORAGE_KEY);
  return isPaletteId(saved) ? saved : 'classic';
}

/**
 * Применить палитру к документу и сохранить выбор.
 * classic убирает атрибут (дефолтные токены). Неизвестный id игнорируется.
 */
export function applyPalette(id: PaletteId): void {
  if (!isPaletteId(id)) return;
  localStorage.setItem(STORAGE_KEY, id);
  if (id === 'classic') {
    delete document.documentElement.dataset.palette;
  } else {
    document.documentElement.dataset.palette = id;
  }
}

/** Инициализация до первого рендера (main.tsx). */
export function initPalette(): void {
  applyPalette(getPalette());
}

function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && (PALETTE_IDS as readonly string[]).includes(value);
}
