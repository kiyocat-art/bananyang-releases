; build/installer.nsh
; 기존 BanaNyang 설치 감지 → 안내 메시지 → 자동 제거 후 설치 진행
; electron-builder NSIS는 appId를 GUID 형태로 레지스트리에 등록함
; e.g. "{com.kiyocat.bananyang}" 또는 제품명 "BanaNyang"

!macro customInit
  StrCpy $0 ""
  StrCpy $1 ""

  ; ─── 1) appId 기반 키 (electron-builder 기본값) ───
  ; HKCU (per-user)
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kiyocat.bananyang}" "UninstallString"
  ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kiyocat.bananyang}" "InstallLocation"

  ${If} $0 == ""
    ; HKLM (per-machine)
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kiyocat.bananyang}" "UninstallString"
    ReadRegStr $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kiyocat.bananyang}" "InstallLocation"
  ${EndIf}

  ; ─── 2) 제품명 기반 키 (fallback) ───
  ${If} $0 == ""
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BanaNyang" "UninstallString"
    ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BanaNyang" "InstallLocation"
  ${EndIf}

  ${If} $0 == ""
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BanaNyang" "UninstallString"
    ReadRegStr $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BanaNyang" "InstallLocation"
  ${EndIf}

  ; ─── 3) QuietUninstallString 시도 (fallback) ───
  ${If} $0 == ""
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kiyocat.bananyang}" "QuietUninstallString"
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kiyocat.bananyang}" "QuietUninstallString"
  ${EndIf}

  ; ─── 기존 설치 감지 시 제거 진행 ───
  ${If} $0 != ""
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION \
      "BanaNyang이 이미 설치되어 있습니다.$\n$\n기존 버전을 자동으로 제거한 후 새 버전을 설치합니다.$\n$\n계속하시겠습니까?" \
      IDOK doUninstall
    Abort

    doUninstall:
      ; UninstallString에 따옴표가 포함되어 있을 수 있으므로 제거 후 재조립
      ; e.g. "C:\Users\...\Uninstall BanaNyang.exe" → C:\Users\...\Uninstall BanaNyang.exe
      StrCpy $2 $0 1      ; 첫 글자 확인
      ${If} $2 == '"'
        ; 따옴표 제거
        StrCpy $0 $0 "" 1  ; 첫 따옴표 제거
        StrLen $3 $0
        IntOp $3 $3 - 1
        StrCpy $0 $0 $3    ; 마지막 따옴표 제거
      ${EndIf}

      ; 언인스톨러가 존재하는지 확인
      IfFileExists $0 0 skipUninstall
        ; /S = silent, _?= 은 언인스톨러가 완료될 때까지 대기하는 NSIS 표준 방법
        ExecWait '"$0" /S _?=$1'

        ; 언인스톨러 파일 잔존 시 삭제
        Delete "$0"

        ; 설치 디렉토리 잔존 시 삭제 시도 (빈 폴더만 삭제됨)
        ${If} $1 != ""
          RMDir "$1"
        ${EndIf}

        ; 레지스트리 정리 확인 (언인스톨러가 정리하지 못한 경우 대비)
        DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kiyocat.bananyang}"
        DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BanaNyang"
        DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kiyocat.bananyang}"
        DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\BanaNyang"

      skipUninstall:
  ${EndIf}
!macroend

!macro customInstall
  ; Register BanaNyang Shell Thumbnail Provider
  IfFileExists "$INSTDIR\resources\bananyang_thumb.dll" 0 skipThumbReg
    nsExec::Exec '"$SYSDIR\regsvr32.exe" /s "$INSTDIR\resources\bananyang_thumb.dll"'
    Pop $0
    ${If} $0 != 0
      DetailPrint "Warning: Thumbnail provider registration failed (code $0)"
    ${EndIf}
  skipThumbReg:

  ; 확장자 레벨 TypeOverlay 억제
  WriteRegStr HKCU "Software\Classes\.nyang"     "TypeOverlay" ""
  WriteRegStr HKCU "Software\Classes\.rfy"       "TypeOverlay" ""
  WriteRegStr HKCU "Software\Classes\.bananyang" "TypeOverlay" ""
  WriteRegStr HKLM "Software\Classes\.nyang"     "TypeOverlay" ""
  WriteRegStr HKLM "Software\Classes\.rfy"       "TypeOverlay" ""
  WriteRegStr HKLM "Software\Classes\.bananyang" "TypeOverlay" ""

  ; ProgID 레벨 TypeOverlay 억제 — Windows가 실제로 조회하는 위치
  WriteRegStr HKCU "Software\Classes\BanaNyang Workspace"          "TypeOverlay" ""
  WriteRegStr HKCU "Software\Classes\BanaNyang Workspace (Legacy)" "TypeOverlay" ""

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  ; Unregister BanaNyang Shell Thumbnail Provider
  IfFileExists "$INSTDIR\resources\bananyang_thumb.dll" 0 skipThumbUnreg
    nsExec::Exec '"$SYSDIR\regsvr32.exe" /s /u "$INSTDIR\resources\bananyang_thumb.dll"'
    DeleteRegKey HKCU "Software\Classes\CLSID\{6F1B2C7E-9E2A-4F1D-8C2B-7B1A4D2F9C3E}"
    DeleteRegKey HKCU "Software\Classes\.nyang\ShellEx\{E357FCCD-A995-4576-B01F-234630154E96}"
  skipThumbUnreg:

  ; TypeOverlay 정리 (확장자 레벨)
  DeleteRegValue HKCU "Software\Classes\.nyang"     "TypeOverlay"
  DeleteRegValue HKCU "Software\Classes\.rfy"       "TypeOverlay"
  DeleteRegValue HKCU "Software\Classes\.bananyang" "TypeOverlay"
  DeleteRegValue HKLM "Software\Classes\.nyang"     "TypeOverlay"
  DeleteRegValue HKLM "Software\Classes\.rfy"       "TypeOverlay"
  DeleteRegValue HKLM "Software\Classes\.bananyang" "TypeOverlay"

  ; TypeOverlay 정리 (ProgID 레벨)
  DeleteRegValue HKCU "Software\Classes\BanaNyang Workspace"          "TypeOverlay"
  DeleteRegValue HKCU "Software\Classes\BanaNyang Workspace (Legacy)" "TypeOverlay"

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
