; Installeur Windows (electron-builder) : aperçu des plans DXF et .des dans l'Explorateur (vignettes et
; volet de visualisation), par la DLL resources\apercu\BluePrintApercu.dll (voir app/windows).
; Enregistrement COM sans regasm, pour l'utilisateur ou pour tous selon le choix fait à l'installation.

!define BP_VIGNETTE "{3740D409-1DA1-46D6-8692-11D942B815F7}"
!define BP_VISUALISATION "{EF0E0296-BDEC-49B2-A0E3-D062D12C9DA5}"
!define BP_IVIGNETTE "{e357fccd-a995-4576-b01f-234630154e96}"
!define BP_IVISUALISATION "{8895b1c6-b41f-4c1c-a562-0d564250836f}"
!define BP_PREVHOST "{6d2b5079-2f0b-48dd-ab7f-97cec514d30b}"

!macro bpClasse CLSID NOM CLASSE
  WriteRegStr SHCTX "Software\Classes\CLSID\${CLSID}" "" "${NOM}"
  WriteRegStr SHCTX "Software\Classes\CLSID\${CLSID}\InprocServer32" "" "mscoree.dll"
  WriteRegStr SHCTX "Software\Classes\CLSID\${CLSID}\InprocServer32" "ThreadingModel" "Both"
  WriteRegStr SHCTX "Software\Classes\CLSID\${CLSID}\InprocServer32" "Class" "${CLASSE}"
  WriteRegStr SHCTX "Software\Classes\CLSID\${CLSID}\InprocServer32" "Assembly" "BluePrintApercu, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null"
  WriteRegStr SHCTX "Software\Classes\CLSID\${CLSID}\InprocServer32" "RuntimeVersion" "v4.0.30319"
  WriteRegStr SHCTX "Software\Classes\CLSID\${CLSID}\InprocServer32" "CodeBase" "file:///$INSTDIR\resources\apercu\BluePrintApercu.dll"
!macroend

!macro customInstall
  SetRegView 64
  !insertmacro bpClasse "${BP_VIGNETTE}" "BluePrint CAD : vignettes des plans" "BluePrint.Apercu.Vignette"
  !insertmacro bpClasse "${BP_VISUALISATION}" "BluePrint CAD : aperçu des plans" "BluePrint.Apercu.Visualisation"
  WriteRegStr SHCTX "Software\Classes\CLSID\${BP_VISUALISATION}" "AppID" "${BP_PREVHOST}"
  WriteRegStr SHCTX "Software\Classes\CLSID\${BP_VISUALISATION}" "DisplayName" "BluePrint CAD"
  ; Le code .NET ne démarre pas dans le processus d'aperçu à faible intégrité (réglage par défaut).
  WriteRegDWORD SHCTX "Software\Classes\CLSID\${BP_VISUALISATION}" "DisableLowILProcessIsolation" 1
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers" "${BP_VISUALISATION}" "BluePrint CAD"
  WriteRegStr SHCTX "Software\Classes\.dxf\ShellEx\${BP_IVIGNETTE}" "" "${BP_VIGNETTE}"
  WriteRegStr SHCTX "Software\Classes\.des\ShellEx\${BP_IVIGNETTE}" "" "${BP_VIGNETTE}"
  WriteRegStr SHCTX "Software\Classes\.dxf\ShellEx\${BP_IVISUALISATION}" "" "${BP_VISUALISATION}"
  WriteRegStr SHCTX "Software\Classes\.des\ShellEx\${BP_IVISUALISATION}" "" "${BP_VISUALISATION}"
  ; Prévenir l'Explorateur (SHCNE_ASSOCCHANGED).
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  SetRegView 64
  DeleteRegKey SHCTX "Software\Classes\CLSID\${BP_VIGNETTE}"
  DeleteRegKey SHCTX "Software\Classes\CLSID\${BP_VISUALISATION}"
  DeleteRegValue SHCTX "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers" "${BP_VISUALISATION}"
  DeleteRegKey SHCTX "Software\Classes\.dxf\ShellEx\${BP_IVIGNETTE}"
  DeleteRegKey SHCTX "Software\Classes\.des\ShellEx\${BP_IVIGNETTE}"
  DeleteRegKey SHCTX "Software\Classes\.dxf\ShellEx\${BP_IVISUALISATION}"
  DeleteRegKey SHCTX "Software\Classes\.des\ShellEx\${BP_IVISUALISATION}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
