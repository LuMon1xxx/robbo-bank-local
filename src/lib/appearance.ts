/**
 * Кастомизатор внешнего вида (Settings → Внешний вид).
 *
 * Поверх базовой палитры (robbo.palette) пользователь настраивает:
 *  — свой акцентный цвет: из ОДНОГО цвета генерируется полный primary-рамп
 *    (100..800 + dark-тинт) с принудительным контрастом white-on-600 ≥ 4.5;
 *  — масштаб интерфейса (корневой font-size);
 *  — скругления (radius-токены);
 *  — форму и стиль кнопок (data-атрибуты на <html> + CSS в index.css).
 *
 * Применяется мгновенно, хранится в localStorage 'robbo.appearance'.
 * Переменные инжектируются через <style id="robbo-custom-vars">, чтобы
 * корректно переопределить и light (:root), и dark (.dark) значения.
 */

export interface AppearanceSettings {
  /** hex своего акцента (#rrggbb) или null — цвета базовой палитры */
  primaryOverride: string | null
  fontSize: FontSizeKey
  radius: RadiusKey
  btnShape: BtnShapeKey
  btnStyle: BtnStyleKey
}

export type FontSizeKey = 'sm' | 'md' | 'lg'
export type RadiusKey = 'sharp' | 'default' | 'round'
export type BtnShapeKey = 'default' | 'pill' | 'square'
export type BtnStyleKey = 'filled' | 'soft'

export const APPEARANCE_KEY = 'robbo.appearance'

export const FONT_SIZES: Record<FontSizeKey, string> = {
  sm: '14.5px',
  md: '16px',
  lg: '17.5px',
}

export const RADII: Record<RadiusKey, { s: string; m: string; l: string; xl: string }> = {
  sharp: { s: '4px', m: '6px', l: '8px', xl: '12px' },
  default: { s: '8px', m: '12px', l: '16px', xl: '24px' },
  round: { s: '10px', m: '16px', l: '20px', xl: '28px' },
}

export const BTN_SHAPES: Record<BtnShapeKey, string> = {
  default: '',
  pill: '9999px',
  square: '4px',
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  primaryOverride: null,
  fontSize: 'md',
  radius: 'default',
  btnShape: 'default',
  btnStyle: 'filled',
}

/* ==================== цветовая математика ==================== */

/** hex → {h 0..360, s 0..1, l 0..1} */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { h: 248, s: 0.52, l: 0.52 } // индиго-дефолт на мусорный ввод
  const int = parseInt(m[1], 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s, l }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** {h,s,l} → #rrggbb */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp01(s)
  const lig = clamp01(l)
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lig - c / 2
  let rgb: [number, number, number]
  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const to255 = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return '#' + to255(rgb[0]) + to255(rgb[1]) + to255(rgb[2])
}

/** Относительная яркость WCAG */
function luminance(hex: string): number {
  const int = parseInt(hex.replace('#', ''), 16)
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * lin((int >> 16) & 255) + 0.7152 * lin((int >> 8) & 255) + 0.0722 * lin(int & 255)
  )
}

/** Контраст-рейшо WCAG */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export interface PrimaryRamp {
  p100: string
  p300: string
  p500: string
  p600: string
  p700: string
  p800: string
  dark100: string
}

/**
 * Полный primary-рамп из одного цвета.
 * Светлота 600 затемняется, пока контраст с белым не достигнет 4.5 (WCAG AA).
 */
export function buildPrimaryRamp(baseHex: string): PrimaryRamp {
  const { h, s } = hexToHsl(baseHex)
  const sat = clamp01(Math.max(s, 0.25)) // слишком серый вход всё же даёт оттенок
  let l600 = 0.5
  let p600 = hslToHex(h, sat, l600)
  while (contrastRatio(p600, '#ffffff') < 4.5 && l600 > 0.25) {
    l600 -= 0.01
    p600 = hslToHex(h, sat, l600)
  }
  return {
    p100: hslToHex(h, Math.min(1, sat * 1.15), 0.955),
    p300: hslToHex(h, Math.min(1, sat * 1.05), 0.78),
    p500: hslToHex(h, sat, 0.58),
    p600,
    p700: hslToHex(h, sat, Math.max(0.25, l600 - 0.1)),
    p800: hslToHex(h, sat, Math.max(0.18, l600 - 0.2)),
    dark100: hslToHex(h, Math.min(0.6, sat * 0.7), 0.17),
  }
}

/* ==================== загрузка / применение ==================== */

const STYLE_TAG_ID = 'robbo-custom-vars'

/** Прочитать настройки из localStorage (некорректные поля → дефолты). */
export function loadAppearance(): AppearanceSettings {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>
    return {
      primaryOverride:
        typeof parsed.primaryOverride === 'string' &&
        /^#[0-9a-f]{6}$/i.test(parsed.primaryOverride)
          ? parsed.primaryOverride.toLowerCase()
          : null,
      fontSize: parsed.fontSize && parsed.fontSize in FONT_SIZES ? parsed.fontSize : 'md',
      radius: parsed.radius && parsed.radius in RADII ? parsed.radius : 'default',
      btnShape: parsed.btnShape && parsed.btnShape in BTN_SHAPES ? parsed.btnShape : 'default',
      btnStyle: parsed.btnStyle === 'soft' ? 'soft' : 'filled',
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function saveAppearance(settings: AppearanceSettings): void {
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(settings))
}

/** CSS-текст с переменными кастомного акцента для :root (light) и .dark. */
export function buildCustomVarsCss(primaryHex: string): string {
  const ramp = buildPrimaryRamp(primaryHex)
  return [
    ':root {',
    `  --color-primary-100: ${ramp.p100};`,
    `  --color-primary-300: ${ramp.p300};`,
    `  --color-primary-500: ${ramp.p500};`,
    `  --color-primary-600: ${ramp.p600};`,
    `  --color-primary-700: ${ramp.p700};`,
    `  --color-primary-800: ${ramp.p800};`,
    `  --color-primary: ${ramp.p600};`,
    `  --color-secondary: ${ramp.p100};`,
    `  --color-secondary-foreground: ${ramp.p700};`,
    `  --color-ring: ${ramp.p300};`,
    `  --hero-stop-1: ${ramp.p700};`,
    `  --hero-stop-2: ${ramp.p500};`,
    `  --hero-stop-3: ${ramp.p300};`,
    '}',
    '.dark {',
    `  --color-primary-100: ${ramp.dark100};`,
    `  --color-primary-300: ${ramp.p300};`,
    `  --color-primary-600: ${ramp.p600};`,
    `  --color-primary: ${ramp.p600};`,
    `  --color-ring: ${ramp.p300};`,
    `  --hero-stop-1: ${ramp.p800};`,
    `  --hero-stop-2: ${ramp.p700};`,
    `  --hero-stop-3: ${ramp.p500};`,
    '}',
  ].join('\n')
}

/**
 * Применить настройки к документу. Вызывается до рендера (main.tsx) и
 * при каждом изменении в настройках — эффект мгновенный.
 */
export function applyAppearance(s: AppearanceSettings): void {
  const root = document.documentElement

  // 1) масштаб интерфейса (rem-базирующийся — масштабируется всё)
  root.style.fontSize = FONT_SIZES[s.fontSize]

  // 3) скругления
  const r = RADII[s.radius]
  root.style.setProperty('--radius-s', r.s)
  root.style.setProperty('--radius-m', r.m)
  root.style.setProperty('--radius-l', r.l)
  root.style.setProperty('--radius-xl', r.xl)
  // форма кнопок (CSS в index.css читает data-атрибут)
  if (s.btnShape === 'default') delete root.dataset.btnShape
  else root.dataset.btnShape = s.btnShape

  // 4) стиль кнопок
  if (s.btnStyle === 'filled') delete root.dataset.btnStyle
  else root.dataset.btnStyle = s.btnStyle

  // 5) свой акцент: инжект <style> с light+dark переменными
  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (s.primaryOverride) {
    if (!tag) {
      tag = document.createElement('style')
      tag.id = STYLE_TAG_ID
      document.head.appendChild(tag)
    }
    tag.textContent = buildCustomVarsCss(s.primaryOverride)
  } else if (tag) {
    tag.remove()
  }
}

/** Сохранить и применить одной командой (контролы настроек). */
export function updateAppearance(patch: Partial<AppearanceSettings>): AppearanceSettings {
  const next = { ...loadAppearance(), ...patch }
  saveAppearance(next)
  applyAppearance(next)
  return next
}

/** Сброс к дефолтам (базовая палитра robbo.palette остаётся). */
export function resetAppearance(): void {
  saveAppearance(DEFAULT_APPEARANCE)
  applyAppearance(DEFAULT_APPEARANCE)
}

/** Инициализация до первого рендера (main.tsx). */
export function initAppearance(): void {
  applyAppearance(loadAppearance())
}
