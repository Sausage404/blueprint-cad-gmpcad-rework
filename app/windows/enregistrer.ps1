# Pour essayer l'extension sans l'installeur : enregistre (ou retire avec -Retirer) BluePrintApercu.dll
# pour l'utilisateur, comme le fait build/installer.nsh. À lancer dans PowerShell 64 bits :
#   powershell -ExecutionPolicy Bypass -File enregistrer.ps1 -Dll C:\chemin\BluePrintApercu.dll
param([string]$Dll = "$PSScriptRoot\build\BluePrintApercu.dll", [switch]$Retirer)

$vignette = '{3740D409-1DA1-46D6-8692-11D942B815F7}'
$visualisation = '{EF0E0296-BDEC-49B2-A0E3-D062D12C9DA5}'
$iVignette = '{e357fccd-a995-4576-b01f-234630154e96}'
$iVisualisation = '{8895b1c6-b41f-4c1c-a562-0d564250836f}'
$racine = 'HKCU:\Software\Classes'

function Cle($chemin, $defaut) {
  New-Item -Path $chemin -Force | Out-Null
  if ($defaut) { Set-ItemProperty -Path $chemin -Name '(default)' -Value $defaut }
}

if ($Retirer) {
  foreach ($c in @("$racine\CLSID\$vignette", "$racine\CLSID\$visualisation", "$racine\.dxf\ShellEx\$iVignette", "$racine\.des\ShellEx\$iVignette", "$racine\.dxf\ShellEx\$iVisualisation", "$racine\.des\ShellEx\$iVisualisation")) {
    Remove-Item -Path $c -Recurse -Force -ErrorAction SilentlyContinue
  }
  Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\PreviewHandlers' -Name $visualisation -ErrorAction SilentlyContinue
  Write-Output 'Extension retirée.'
  exit
}

$Dll = (Resolve-Path $Dll).Path
foreach ($c in @(@($vignette, 'BluePrint CAD : vignettes des plans', 'BluePrint.Apercu.Vignette'), @($visualisation, 'BluePrint CAD : aperçu des plans', 'BluePrint.Apercu.Visualisation'))) {
  Cle "$racine\CLSID\$($c[0])" $c[1]
  $i = "$racine\CLSID\$($c[0])\InprocServer32"
  Cle $i 'mscoree.dll'
  Set-ItemProperty -Path $i -Name ThreadingModel -Value Both
  Set-ItemProperty -Path $i -Name Class -Value $c[2]
  Set-ItemProperty -Path $i -Name Assembly -Value 'BluePrintApercu, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null'
  Set-ItemProperty -Path $i -Name RuntimeVersion -Value 'v4.0.30319'
  Set-ItemProperty -Path $i -Name CodeBase -Value "file:///$Dll"
}
Set-ItemProperty -Path "$racine\CLSID\$visualisation" -Name AppID -Value '{6d2b5079-2f0b-48dd-ab7f-97cec514d30b}'
Set-ItemProperty -Path "$racine\CLSID\$visualisation" -Name DisplayName -Value 'BluePrint CAD'
# Le code .NET ne démarre pas dans le processus d'aperçu à faible intégrité (réglage par défaut).
Set-ItemProperty -Path "$racine\CLSID\$visualisation" -Name DisableLowILProcessIsolation -Value 1 -Type DWord
Cle 'HKCU:\Software\Microsoft\Windows\CurrentVersion\PreviewHandlers' $null
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\PreviewHandlers' -Name $visualisation -Value 'BluePrint CAD'
foreach ($ext in '.dxf', '.des') {
  Cle "$racine\$ext\ShellEx\$iVignette" $vignette
  Cle "$racine\$ext\ShellEx\$iVisualisation" $visualisation
}
Add-Type -Namespace BP -Name Shell -MemberDefinition '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, int f, System.IntPtr a, System.IntPtr b);'
[BP.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output "Extension enregistrée : $Dll"
