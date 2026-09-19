import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootStorage } from './lib/tauriBootstrap'
import { setupAutoBackupOnExit } from './lib/autoBackup'
import { initPalette } from './lib/palette'
import { initAppearance } from './lib/appearance'
import { initTheme } from './components/ThemeToggle'

// Тема/палитра/appearance — до первого рендера (как в оригинале),
// чтобы не мигать дефолтной темой.
initTheme()
initPalette()
initAppearance()

// WP1: хранилище (SQLite-файл в Tauri, иначе localStorage) — ДО render,
// чтобы первый рендер читал уже смерженное состояние.
await bootStorage()

// П.2: silent-автобэкап при выходе (только в Tauri; в браузере no-op).
setupAutoBackupOnExit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
