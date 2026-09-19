/**
 * robbo-bank-local · Обновления приложения (вариант A: tauri-plugin-updater).
 *
 * Как это работает для учителя: НИЧЕГО ДЕЛАТЬ НЕ НАДО.
 * Приложение само проверяется при запуске и потом раз в полдня,
 * само тихо качает новую версию и показывает одну кнопку «Перезапустить».
 *
 * Как выпустить новую версию (владелец):
 * 1. Один раз: сгенерировать ключ (npx tauri signer generate),
 *    публичный вписать в tauri.conf.json → plugins.updater.pubkey,
 *    приватный положить в GitHub Secrets → TAURI_SIGNING_PRIVATE_KEY,
 *    в updater.ts выставить UPDATE_CONFIGURED = true.
 * 2. Каждый релиз: поднять версию в 3 местах
 *    (tauri.conf.json + Cargo.toml + APP_VERSION ниже),
 *    закоммитить и запушить тег `vX.Y.Z` — GitHub Action сам
 *    соберёт, подпишет и выложит релиз (см. .github/workflows/release.yml).
 * Пока UPDATE_CONFIGURED === false — проверка возвращает 'unconfigured'
 * и никуда не лезет (ни одного сетевого запроса).
 */

export const APP_VERSION = '0.1.5';

/** Переключить в true после настройки ключа и endpoint (см. выше). */
export const UPDATE_CONFIGURED = true;

/** Как часто проверять обновления в фоне, пока приложение открыто. */
export const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // раз в полдня

export type UpdateStatus =
  | { status: 'unconfigured' }
  | { status: 'uptodate'; version: string }
  | {
      status: 'available';
      version: string;
      currentVersion: string;
      /** Дата выхода релиза (pub_date из latest.json), null если сервер не прислал. */
      date: string | null;
      notes: string | null;
    }
  | { status: 'downloading'; version: string; progress: number }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string };

/** Чистая: true если latest строго новее current (semver 1.2.3, суффиксы игнорятся). */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string): number[] =>
    v
      .trim()
      .replace(/^[vV=]/, '')
      .split(/[+-]/)[0]
      .split('.')
      .map((p) => {
        const n = parseInt(p.replace(/[^0-9]/g, ''), 10);
        return Number.isFinite(n) ? n : 0;
      });
  const a = parse(latest);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/** Версия запущенного приложения (в браузере — константа). */
export async function getAppVersion(): Promise<string> {
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } catch {
    return APP_VERSION;
  }
}

let pendingVersion: string | null = null;

/** Проверить обновления (тихо — для автопроверки при запуске). */
export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!UPDATE_CONFIGURED) return { status: 'unconfigured' };
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) {
      return { status: 'uptodate', version: await getAppVersion() };
    }
    pendingVersion = update.version;
    return {
      status: 'available',
      version: update.version,
      currentVersion: update.currentVersion,
      date: update.date ?? null,
      notes: update.body ?? null,
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Скачать и поставить обновление из последней проверки.
 * onProgress — 0..100. После успеха НУЖЕН перезапуск (relaunch()).
 */
export async function downloadAndInstallUpdate(
  onProgress?: (pct: number) => void,
): Promise<UpdateStatus> {
  if (!UPDATE_CONFIGURED) return { status: 'unconfigured' };
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) {
      return { status: 'uptodate', version: await getAppVersion() };
    }
    pendingVersion = update.version;
    let done = 0;
    let total = 0;
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength ?? 0;
        done = 0;
      } else if (event.event === 'Progress') {
        done += event.data.chunkLength;
        if (total > 0) onProgress?.(Math.min(100, Math.round((done / total) * 100)));
      } else if (event.event === 'Finished') {
        onProgress?.(100);
      }
    });
    return { status: 'ready', version: update.version };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** Перезапустить приложение (применить обновление). */
export async function relaunchApp(): Promise<void> {
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}

export function getPendingVersion(): string | null {
  return pendingVersion;
}

/** «19 сентября 2026» из ISO-даты релиза; пустая строка если даты нет. */
export function formatReleaseDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  notes: string;
}

/**
 * История версий для карточки «Обновления» (пополнять сверху при каждом релизе).
 * notes для свежих версий прилетают и с сервера (body из latest.json),
 * но история хранится здесь — сервер отдаёт только последний релиз.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.5',
    date: '19 сентября 2026',
    title: 'Группы с расписанием, один учитель',
    notes: 'У групп день недели и время занятий. Группы создаются только в разделе «Группы». Один учитель без выбора. Кнопки причин в цвете темы, явная кнопка «Все группы».',
  },
  {
    version: '0.1.4',
    date: '19 сентября 2026',
    title: 'Крестик закрывает, логотип «Мир Робот»',
    notes: 'Исправлено закрытие окна, логотип в сайдбаре и установщике, 6 готовых тем оформления.',
  },
  {
    version: '0.1.3',
    date: '19 сентября 2026',
    title: 'Красота: тёмная тема и быстрое начисление',
    notes: 'Читаемые списки в тёмной теме, убраны уродливые стрелки у сумм, в быстром начислении — кнопка «Начислить», перенос в группу — из списка.',
  },
  {
    version: '0.1.2',
    date: '19 сентября 2026',
    title: 'Карточка обновлений и удобные группы',
    notes: 'Видно какая версия стоит и какая вышла, дата релиза и что нового. При создании ученика группы выбираются из списка. Год рождения ограничен 4 цифрами.',
  },
  {
    version: '0.1.1',
    date: '19 сентября 2026',
    title: 'Автообновления',
    notes: 'Приложение само проверяет обновления при запуске и раз в 12 часов, тихо качает и предлагает перезапуститься одной кнопкой.',
  },
  {
    version: '0.1.0',
    date: '18 сентября 2026',
    title: 'Первый релиз',
    notes: 'Ученики, группы, начисления и отчёты, темы оформления, шаблоны операций, импорт из Excel, резервные копии.',
  },
];

export interface AutoUpdaterEvents {
  /** Новая версия скачалась и готова — нужен перезапуск. */
  onDownloaded?: (version: string) => void;
  /** Тихие ошибки фона (показывать не надо, только для лога). */
  onError?: (message: string) => void;
}

/**
 * Автопроверка обновлений: сразу при запуске + потом по таймеру
 * (UPDATE_CHECK_INTERVAL_MS). Найденное обновление тихо качается само,
 * учителю остаётся только перезапустить по кнопке из onDownloaded.
 * Возвращает функцию остановки (для размонтирования).
 * Пока UPDATE_CONFIGURED === false — ничего не делает.
 */
export function startAutoUpdater(events: AutoUpdaterEvents = {}): () => void {
  if (!UPDATE_CONFIGURED) return () => {};
  let stopped = false;
  async function tick() {
    try {
      const st = await checkForUpdates();
      if (stopped) return;
      if (st.status === 'available') {
        const done = await downloadAndInstallUpdate();
        if (stopped) return;
        if (done.status === 'ready') events.onDownloaded?.(done.version);
      }
    } catch (e) {
      events.onError?.(e instanceof Error ? e.message : String(e));
    }
  }
  void tick();
  const id = setInterval(() => void tick(), UPDATE_CHECK_INTERVAL_MS);
  return () => {
    stopped = true;
    clearInterval(id);
  };
}
