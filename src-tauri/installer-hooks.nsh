; RobboBank · NSIS installer hooks (Tauri 2, Unicode).
; Создаёт ярлык «РоббоБанк» на рабочем столе при установке
; и удаляет его при деинсталляции.

!macro NSIS_HOOK_POSTINSTALL
  CreateShortCut "$DESKTOP\РоббоБанк.lnk" "$INSTDIR\RobboBank.exe"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$DESKTOP\РоббоБанк.lnk"
!macroend
