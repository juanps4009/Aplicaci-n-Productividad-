@echo off
chcp 65001 >nul
setlocal
title Crear acceso directo de Pendientes

set "URL=https://juanps4009.github.io/Aplicaci-n-Productividad-/"
set "DIR=%LOCALAPPDATA%\Pendientes"
set "ICON=%DIR%\icon.ico"

echo.
echo  Creando el acceso directo de Pendientes en tu escritorio...
echo.

if not exist "%DIR%" mkdir "%DIR%"

rem 1) Descargar el icono (curl viene incluido en Windows 10 y 11)
curl.exe -L -s -f -o "%ICON%" "%URL%icons/icon.ico"
if errorlevel 1 (
  echo  No pude descargar el icono. Se usara el icono normal del navegador.
  set "ICON="
)

rem 2) Buscar Microsoft Edge o Google Chrome para abrir la app en ventana propia
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

rem 3) Crear el acceso directo en el escritorio
if defined BROWSER (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Pendientes.lnk'); $s.TargetPath=$env:BROWSER; $s.Arguments='--app='+$env:URL; $s.Description='Pendientes y Resumenes'; if($env:ICON){$s.IconLocation=$env:ICON}; $s.Save()"
  if errorlevel 1 goto :fallback
  echo  Listo! En tu escritorio aparecio "Pendientes".
  echo  Se abre en su propia ventana, sin pestanas.
) else (
  goto :fallback
)
goto :fin

:fallback
echo  Creando un acceso directo normal (se abrira en tu navegador)...
(
  echo [InternetShortcut]
  echo URL=%URL%
) > "%USERPROFILE%\Desktop\Pendientes.url"
if exist "%USERPROFILE%\Desktop\Pendientes.url" (
  echo  Listo! En tu escritorio aparecio "Pendientes".
) else (
  echo  No pude crearlo. Abre este enlace y usa el icono "Instalar" del navegador:
  echo  %URL%
)

:fin
echo.
pause
endlocal
