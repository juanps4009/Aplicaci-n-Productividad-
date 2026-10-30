@echo off
chcp 65001 >nul
setlocal
title Crear el widget de Pendientes

set "URL=https://juanps4009.github.io/Aplicaci-n-Productividad-/"
set "DIR=%LOCALAPPDATA%\Pendientes"
set "ICON=%DIR%\icon.ico"
set "SCRIPT=%DIR%\Widget-Pendientes.ps1"
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

echo.
echo  Creando el widget de Pendientes para tu escritorio...
echo.

if not exist "%DIR%" mkdir "%DIR%"

rem 1) Icono (curl viene incluido en Windows 10 y 11)
curl.exe -L -s -f -o "%ICON%" "%URL%icons/icon.ico"
if errorlevel 1 set "ICON="

rem 2) El programa del widget: el que esta junto a este archivo, o si no, el de la pagina
if exist "%~dp0Widget-Pendientes.ps1" (
  copy /y "%~dp0Widget-Pendientes.ps1" "%SCRIPT%" >nul
) else (
  curl.exe -L -s -f -o "%SCRIPT%" "%URL%escritorio/Widget-Pendientes.ps1"
)
if not exist "%SCRIPT%" (
  echo  No pude conseguir el programa del widget. Revisa tu internet y vuelve a abrir este archivo.
  goto :fin
)

rem 3) Descargar el componente de Microsoft (WebView2, el motor de Edge que trae Windows 11) la primera vez
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -SoloPreparar
if not exist "%DIR%\webview2\WebView2Loader.dll" (
  echo  No pude preparar el componente. Revisa tu internet y vuelve a abrir este archivo.
  goto :fin
)

rem 4) Crear el acceso directo en el escritorio
set "ARGS=-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT%""
"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Pendientes (widget).lnk'); $s.TargetPath=$env:PS; $s.Arguments=$env:ARGS; $s.WindowStyle=7; $s.Description='Widget de Pendientes'; if($env:ICON){$s.IconLocation=$env:ICON}; $s.Save()"
if errorlevel 1 (
  echo  No pude crear el acceso directo.
  goto :fin
)
echo  Listo! En tu escritorio aparecio "Pendientes (widget)".

rem 5) Opcional: que se abra solo al encender el PC
echo.
choice /c SN /n /m " Quieres que se abra solo al encender el PC? (S/N) "
if errorlevel 2 goto :siguiente
"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Pendientes (widget).lnk'); $s.TargetPath=$env:PS; $s.Arguments=$env:ARGS; $s.WindowStyle=7; if($env:ICON){$s.IconLocation=$env:ICON}; $s.Save()"
echo  Hecho. Para quitarlo: borra "Pendientes (widget)" del escritorio y de la carpeta de Inicio (Win+R, escribe shell:startup).

:siguiente
echo.
echo  IMPORTANTE (solo la primera vez): el widget guarda sus datos aparte de tu navegador.
echo  Abre el widget, toca la flecha de arriba a la derecha y conecta la sincronizacion
echo  con tu codigo, igual que en el celular. Despues veras tus tareas.

:fin
echo.
pause
endlocal
